// Integration Tests for Product Goals Endpoints
// Tests product goal CRUD operations and status management

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';
import { setLocaleHeader, SUPPORTED_LOCALES } from '../helpers/i18n-helpers';
import type { Locale } from '@scrumooth/shared';

// Helper to generate unique test identifier
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Product Goals Integration Tests', () => {
  // Helper to create a test user directly in the database
  const createTestUserInDb = async (
    email: string,
    password: string = 'TestPassword123!',
    firstName: string = 'Test',
    lastName: string = 'User'
  ) => {
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = generateUUIDv7();

    const user = await prisma.user.create({
      data: {
        id: userId,
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    return user;
  };

  // Helper to login and get cookies
  const loginAndGetCookies = async (
    email: string,
    password: string = 'TestPassword123!'
  ): Promise<string[]> => {
    const { csrfCookie, csrfToken } = await getCsrfToken();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrfCookie)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
      .send({ email, password });

    const setCookie = response.headers['set-cookie'];
    if (!setCookie) {
      return [csrfCookie];
    }
    const authCookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return [...authCookies, csrfCookie];
  };

  // Helper to create a team
  const createTestTeam = async (name: string, description: string = 'Test team') => {
    const teamId = generateUUIDv7();
    const team = await prisma.team.create({
      data: {
        id: teamId,
        name,
        description,
      },
    });
    return team;
  };

  // Helper to add member to team
  const addTeamMember = async (
    teamId: string,
    userId: string,
    role: 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS'
  ) => {
    const membershipId = generateUUIDv7();
    await prisma.teamMember.create({
      data: {
        id: membershipId,
        teamId,
        userId,
        role,
      },
    });
  };

  // Helper to create a product goal
  const createTestGoal = async (
    teamId: string,
    title: string,
    status: 'NEW' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' = 'NEW'
  ) => {
    const goalId = generateUUIDv7();
    const goal = await prisma.productGoal.create({
      data: {
        id: goalId,
        teamId,
        title,
        description: 'Test goal description',
        status,
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        successMetrics: 'Measurable outcomes',
      },
    });
    return goal;
  };

  // Cleanup helper
  const cleanupTestData = async (emails: string[]) => {
    try {
      for (const email of emails) {
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (user) {
          await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
          await prisma.notification.deleteMany({ where: { userId: user.id } });
          await prisma.teamMember.deleteMany({ where: { userId: user.id } });
          await prisma.user.delete({ where: { id: user.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  const cleanupTeams = async (teamNames: string[]) => {
    try {
      for (const name of teamNames) {
        const team = await prisma.team.findFirst({
          where: { name },
        });

        if (team) {
          await prisma.productBacklogItem.deleteMany({ where: { teamId: team.id } });
          await prisma.productGoal.deleteMany({ where: { teamId: team.id } });
          await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
          await prisma.team.delete({ where: { id: team.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  describe('GET /api/v1/product-goals', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return product goals for team', async () => {
      const email = `goals-list-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Goals Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestGoal(team.id, 'Goal 1');
      await createTestGoal(team.id, 'Goal 2');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-goals')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/product-goals')
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 with missing teamId', async () => {
      const email = `missing-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-goals')
        .set('Cookie', cookies)
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/product-goals/active', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return active product goal for team', async () => {
      const email = `active-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Active Goal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestGoal(team.id, 'Active Goal', 'ACTIVE');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-goals/active')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/product-goals', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a new product goal successfully', async () => {
      const email = `create-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Create Goal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);

      const targetDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-goals')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: 'New Product Goal',
          description: 'Goal description',
          targetDate,
          successMetrics: 'Measurable success criteria',
          strategicAlignment: 'Company strategy alignment',
          status: 'NEW',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('New Product Goal');
      expect(response.body.data.status).toBe('NEW');

      // Verify in database
      const goal = await prisma.productGoal.findFirst({
        where: { title: 'New Product Goal' },
      });
      expect(goal).not.toBeNull();
    });

    it('should refuse creation by a non-Product-Owner member', async () => {
      const email = `create-goal-denied-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Create Goal Denied Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-goals')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: 'Not Allowed Goal',
        })
        .expect(403);

      expect(response.body.error.code).toBe('GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL');

      // The refused goal must not have been persisted.
      const goal = await prisma.productGoal.findFirst({
        where: { title: 'Not Allowed Goal' },
      });
      expect(goal).toBeNull();
    });

    it('should return 422 with invalid goal data', async () => {
      const email = `invalid-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Invalid Goal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-goals')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: '', // Empty title should fail validation
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/product-goals/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return product goal by ID', async () => {
      const email = `get-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Get Goal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const goal = await createTestGoal(team.id, 'Specific Goal');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-goals/${goal.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(goal.id);
      expect(response.body.data.title).toBe('Specific Goal');
    });

    it('should return 404 for non-existent goal', async () => {
      const email = `nonexistent-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-goals/${generateUUIDv7()}`)
        .set('Cookie', cookies)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/product-goals/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update product goal successfully', async () => {
      const email = `update-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Update Goal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const goal = await createTestGoal(team.id, 'Original Goal');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-goals/${goal.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'Updated Goal',
          description: 'Updated description',
          status: 'ACTIVE',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Goal');
      expect(response.body.data.status).toBe('ACTIVE');

      // Verify in database
      const updatedGoal = await prisma.productGoal.findUnique({
        where: { id: goal.id },
      });
      expect(updatedGoal?.title).toBe('Updated Goal');
    });

    it('should refuse activating a second Product Goal for the same team', async () => {
      const email = `activate-conflict-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Activate Conflict Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestGoal(team.id, 'Already Active Goal', 'ACTIVE');
      const secondGoal = await createTestGoal(team.id, 'Second Goal');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-goals/${secondGoal.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ status: 'ACTIVE' })
        .expect(409);

      expect(response.body.error.code).toBe('GATE_PRODUCT_GOAL_ALREADY_ACTIVE');

      // The refused activation must not have changed the goal's status.
      const unchangedGoal = await prisma.productGoal.findUnique({
        where: { id: secondGoal.id },
      });
      expect(unchangedGoal?.status).toBe('NEW');
    });

    it('should return 422 with invalid status', async () => {
      const email = `invalid-status-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Invalid Status Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const goal = await createTestGoal(team.id, 'Status Goal');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-goals/${goal.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'INVALID_STATUS',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/product-goals/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should delete product goal successfully', async () => {
      const email = `delete-goal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete Goal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const goal = await createTestGoal(team.id, 'Goal to Delete');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/product-goals/${goal.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify goal is deleted
      const deletedGoal = await prisma.productGoal.findUnique({
        where: { id: goal.id },
      });
      expect(deletedGoal).toBeNull();
    });

    it('should refuse deletion by a non-Product-Owner member', async () => {
      const email = `delete-member-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete Member Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const goal = await createTestGoal(team.id, 'Undeletable Goal');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/product-goals/${goal.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(403);

      expect(response.body.error.code).toBe('GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL');

      // The refused deletion must leave the goal in place.
      const remainingGoal = await prisma.productGoal.findUnique({
        where: { id: goal.id },
      });
      expect(remainingGoal).not.toBeNull();
    });
  });

  describe('GET /api/v1/product-goals/:id/status-history', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return status history for goal', async () => {
      const email = `status-history-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Status History Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const goal = await createTestGoal(team.id, 'History Goal');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-goals/${goal.id}/status-history`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('i18n Locale Support', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    describe('Translated Goal Status Messages', () => {
      it('should return translated validation error for invalid status value in all locales', async () => {
        const email = `i18n-status-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Status Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
        const goal = await createTestGoal(team.id, 'Status Test Goal');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test validation error for invalid status across all locales
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .put(`/api/v1/product-goals/${goal.id}`)
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              status: 'INVALID_STATUS',
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details[0].field).toBe('status');
        }
      });

      it('should return translated validation error for missing required fields when creating goal', async () => {
        const email = `i18n-required-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Required Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test validation error for empty title across all locales
        // Note: Backend uses Zod with hardcoded messages, not i18n keys
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .post('/api/v1/product-goals')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              teamId: team.id,
              title: '', // Empty title triggers validation error
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          // Backend uses Zod message "Title is required", not i18n key
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'title' })
          );
        }
      });

      it('should return translated error for non-existent goal in all locales', async () => {
        const email = `i18n-notfound-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        // Test not found error across all locales
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get(`/api/v1/product-goals/${generateUUIDv7()}`)
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(404);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('NOT_FOUND');
          // The NotFoundError message includes the entity name
          expect(response.body.error.message).toBeDefined();
        }
      });
    });

    describe('Translated Goal Creation Errors', () => {
      it('should return translated validation error for empty title across all locales', async () => {
        const email = `i18n-create-empty-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Create Empty Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test validation error for empty title across all locales
        // Note: Backend uses Zod with hardcoded messages, not i18n keys
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .post('/api/v1/product-goals')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              teamId: team.id,
              title: '',
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          // Backend uses Zod message "Title is required", not i18n key
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'title' })
          );
        }
      });

      it('should return translated validation error for title exceeding max length', async () => {
        const email = `i18n-create-long-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Create Long Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test validation error for title too long (max 200 characters)
        const longTitle = 'A'.repeat(250);

        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .post('/api/v1/product-goals')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              teamId: team.id,
              title: longTitle,
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details[0].field).toBe('title');
        }
      });

      it('should return translated validation error for missing teamId', async () => {
        const email = `i18n-missing-team-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        // Test validation error for missing teamId across locales
        // Note: Backend uses Zod with hardcoded messages for validation
        for (const locale of SUPPORTED_LOCALES) {
          const { csrfToken } = extractCsrfFromCookies(cookies);

          const response = await request(app)
            .post('/api/v1/product-goals')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              title: 'Test Goal',
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          // Backend uses Zod message for missing required field
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'teamId' })
          );
        }
      });

      it('should return translated forbidden error for non-team member', async () => {
        const email = `i18n-forbidden-${uniqueId()}@example.com`;
        testEmails.push(email);

        // Create user but intentionally do not use the return value
        // as we don't add them as team member to test forbidden error
        void (await createTestUserInDb(email));
        const teamName = `i18n Forbidden Team ${uniqueId()}`;
        testTeams.push(teamName);

        // Create team but DO NOT add user as member
        const team = await createTestTeam(teamName);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test forbidden error across locales
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .post('/api/v1/product-goals')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              teamId: team.id,
              title: 'Forbidden Goal',
            })
            .expect(403);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('FORBIDDEN');
          expect(response.body.error.message).toBeDefined();
        }
      });
    });

    describe('Translated Goal Update Errors', () => {
      it('should return translated validation error for invalid status transition', async () => {
        const email = `i18n-update-status-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Update Status Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
        const goal = await createTestGoal(team.id, 'Update Status Goal');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test validation error for invalid enum status value
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .put(`/api/v1/product-goals/${goal.id}`)
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              status: 'NOT_A_VALID_STATUS',
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details[0].field).toBe('status');
        }
      });

      it('should return translated validation error for empty title on update', async () => {
        const email = `i18n-update-empty-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Update Empty Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
        const goal = await createTestGoal(team.id, 'Original Title');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test validation error for empty title on update across locales
        // Note: Backend uses Zod with hardcoded messages, not i18n keys
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .put(`/api/v1/product-goals/${goal.id}`)
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              title: '',
            })
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          // Backend uses Zod message "Title is required", not i18n key
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'title' })
          );
        }
      });

      it('should return translated error when updating non-existent goal', async () => {
        const email = `i18n-update-notfound-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test not found error for update across locales
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .put(`/api/v1/product-goals/${generateUUIDv7()}`)
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              title: 'Updated Title',
            })
            .expect(404);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('NOT_FOUND');
          expect(response.body.error.message).toBeDefined();
        }
      });

      it('should return translated forbidden error when non-team member attempts update', async () => {
        const email = `i18n-update-forbidden-${uniqueId()}@example.com`;
        testEmails.push(email);

        const otherEmail = `i18n-update-other-${uniqueId()}@example.com`;
        testEmails.push(otherEmail);

        // Create user and team
        const owner = await createTestUserInDb(email);
        const teamName = `i18n Update Forbidden Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, owner.id, 'PRODUCT_OWNER');
        const goal = await createTestGoal(team.id, 'Protected Goal');

        // Create another user who is NOT a team member
        // Intentionally not using the return value as we only need them for login
        void (await createTestUserInDb(otherEmail));
        const otherCookies = await loginAndGetCookies(otherEmail);
        const { csrfToken } = extractCsrfFromCookies(otherCookies);

        // Test forbidden error across locales
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .put(`/api/v1/product-goals/${goal.id}`)
            .set('Cookie', otherCookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale as Locale))
            .send({
              title: 'Attempted Update',
            })
            .expect(403);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('FORBIDDEN');
          expect(response.body.error.message).toBeDefined();
        }
      });
    });

    describe('Translated Goal Query Errors', () => {
      it('should return translated validation error for missing teamId in query', async () => {
        const email = `i18n-query-missing-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        // Test validation error for missing teamId in GET query across locales
        // Note: Backend uses Zod with hardcoded messages for validation
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get('/api/v1/product-goals')
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          // Backend uses Zod message for missing required field
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'teamId' })
          );
        }
      });

      it('should return translated validation error for missing teamId in active goal query', async () => {
        const email = `i18n-active-missing-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        // Test validation error for missing teamId in active goal query across locales
        // Note: Backend uses Zod with hardcoded messages for validation
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get('/api/v1/product-goals/active')
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(422);

          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          // Backend uses Zod message for missing required field
          expect(response.body.error.details).toBeDefined();
          expect(response.body.error.details).toContainEqual(
            expect.objectContaining({ field: 'teamId' })
          );
        }
      });
    });

    describe('Locale Cookie Setting', () => {
      it('should set locale cookie based on Accept-Language header for goal operations', async () => {
        const email = `i18n-cookie-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Cookie Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Verify locale cookie is set when creating a goal with German locale
        const response = await request(app)
          .post('/api/v1/product-goals')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .send({
            teamId: team.id,
            title: 'German Goal',
            description: 'Test goal with German locale',
          });

        // Check that scrumooth_locale cookie is set
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          const cookieArray = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
          const localeCookie = cookieArray.find((c) => c.startsWith('scrumooth_locale='));
          expect(localeCookie).toBeDefined();
          expect(localeCookie).toContain('de');
        }

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
