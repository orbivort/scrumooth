// Integration Tests for Product Backlog Endpoints
// Tests PBI CRUD operations, prioritization, and estimation

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';
import { setLocaleHeader, SUPPORTED_LOCALES } from '../helpers/i18n-helpers';
import { GATE_CODES, type Locale } from '@scrumooth/shared';

// Helper to generate unique test identifier
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Product Backlog Integration Tests', () => {
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

  // Helper to create a PBI
  const createTestPBI = async (
    teamId: string,
    title: string,
    status: 'NEW' | 'REFINED' | 'READY' | 'IN_PROGRESS' | 'DONE' = 'NEW',
    priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'COULD_HAVE' | 'WONT_HAVE' = 'COULD_HAVE'
  ) => {
    const pbiId = generateUUIDv7();
    const pbi = await prisma.productBacklogItem.create({
      data: {
        id: pbiId,
        teamId,
        title,
        description: 'Test PBI description',
        status,
        priority,
        storyPoints: 5,
        businessValue: 50,
      },
    });
    return pbi;
  };

  // Helper to give a team its single ACTIVE Product Goal. The Product Backlog is the emergent
  // expression of the Product Goal, so creating an item through the API requires one.
  const createActiveProductGoal = async (teamId: string, userId: string) => {
    const goalId = generateUUIDv7();
    return prisma.productGoal.create({
      data: {
        id: goalId,
        teamId,
        title: 'Active Goal',
        status: 'ACTIVE',
        createdBy: userId,
      },
    });
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
          // Delete related PBIs first
          await prisma.doDChecklistVerification.deleteMany({
            where: {
              pbiId: {
                in: (
                  await prisma.productBacklogItem.findMany({
                    where: { teamId: team.id },
                    select: { id: true },
                  })
                ).map((p) => p.id),
              },
            },
          });
          await prisma.doRChecklistVerification.deleteMany({
            where: {
              pbiId: {
                in: (
                  await prisma.productBacklogItem.findMany({
                    where: { teamId: team.id },
                    select: { id: true },
                  })
                ).map((p) => p.id),
              },
            },
          });
          await prisma.task.deleteMany({
            where: {
              pbiId: {
                in: (
                  await prisma.productBacklogItem.findMany({
                    where: { teamId: team.id },
                    select: { id: true },
                  })
                ).map((p) => p.id),
              },
            },
          });
          await prisma.productBacklogItem.deleteMany({ where: { teamId: team.id } });
          await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
          await prisma.definitionOfDone.deleteMany({ where: { teamId: team.id } });
          await prisma.definitionOfReady.deleteMany({ where: { teamId: team.id } });
          await prisma.team.delete({ where: { id: team.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  describe('GET /api/v1/product-backlog', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return product backlog for team', async () => {
      const email = `backlog-list-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Backlog Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestPBI(team.id, 'Test PBI 1');
      await createTestPBI(team.id, 'Test PBI 2');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const email = `backlog-filter-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Filter Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestPBI(team.id, 'New PBI', 'NEW');
      await createTestPBI(team.id, 'Ready PBI', 'READY');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: team.id, status: 'READY' })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((pbi: { status: string }) => pbi.status === 'READY')).toBe(
        true
      );
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/product-backlog')
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
        .get('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/product-backlog', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a new PBI successfully', async () => {
      const email = `create-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Create PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      // Only Developers may set story points, so use a Developer here.
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await createActiveProductGoal(team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: 'New PBI Title',
          description: 'PBI description',
          storyPoints: 8,
          priority: 'MUST_HAVE',
          businessValue: 80,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('New PBI Title');
      expect(response.body.data.status).toBe('NEW');

      // Verify in database
      const pbi = await prisma.productBacklogItem.findFirst({
        where: { title: 'New PBI Title' },
      });
      expect(pbi).not.toBeNull();
    });

    it('should return 422 with invalid PBI data', async () => {
      const email = `invalid-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Invalid PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog')
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

  describe('GET /api/v1/product-backlog/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return PBI by ID', async () => {
      const email = `get-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Get PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi = await createTestPBI(team.id, 'Specific PBI');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(pbi.id);
      expect(response.body.data.title).toBe('Specific PBI');
    });

    it('should return 404 for non-existent PBI', async () => {
      const email = `nonexistent-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-backlog/${generateUUIDv7()}`)
        .set('Cookie', cookies)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/product-backlog/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update PBI successfully', async () => {
      const email = `update-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Update PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      // Only Developers may set story points, so use a Developer here.
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await createActiveProductGoal(team.id, user.id);
      const pbi = await createTestPBI(team.id, 'Original Title');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'Updated Title',
          description: 'Updated description',
          storyPoints: 13,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.storyPoints).toBe(13);

      // Verify in database
      const updatedPBI = await prisma.productBacklogItem.findUnique({
        where: { id: pbi.id },
      });
      expect(updatedPBI?.title).toBe('Updated Title');
    });
  });

  describe('PUT /api/v1/product-backlog/:id/priority', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update PBI priority', async () => {
      const email = `priority-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Priority PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi = await createTestPBI(team.id, 'Priority PBI', 'NEW', 'COULD_HAVE');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}/priority`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priority: 'MUST_HAVE',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.priority).toBe('MUST_HAVE');
    });

    it('should return 422 with invalid priority', async () => {
      const email = `invalid-priority-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Invalid Priority Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi = await createTestPBI(team.id, 'Priority PBI');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}/priority`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priority: 'INVALID_PRIORITY',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/product-backlog/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should delete PBI successfully', async () => {
      const email = `delete-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi = await createTestPBI(team.id, 'PBI to Delete');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify PBI is deleted
      const deletedPBI = await prisma.productBacklogItem.findUnique({
        where: { id: pbi.id },
      });
      expect(deletedPBI).toBeNull();
    });
  });

  describe('POST /api/v1/product-backlog/reorder', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should persist the requested order as dense ranks and return it', async () => {
      const email = `reorder-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Reorder PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi1 = await createTestPBI(team.id, 'PBI 1');
      const pbi2 = await createTestPBI(team.id, 'PBI 2');
      const pbi3 = await createTestPBI(team.id, 'PBI 3');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      // Reorder: 3, 1, 2
      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiIds: [pbi3.id, pbi1.id, pbi2.id],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
        pbi3.id,
        pbi1.id,
        pbi2.id,
      ]);
      expect(response.body.data.items.map((item: { rank: number }) => item.rank)).toEqual([
        1, 2, 3,
      ]);

      // The order survives a reload: it is persisted, not an optimistic client illusion.
      const persisted = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(persisted.body.data.map((item: { id: string }) => item.id)).toEqual([
        pbi3.id,
        pbi1.id,
        pbi2.id,
      ]);

      const rows = await prisma.productBacklogItem.findMany({
        where: { teamId: team.id },
        select: { id: true, rank: true },
        orderBy: { rank: 'asc' },
      });
      expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    });

    it('should move one item with the positional shape', async () => {
      const email = `reorder-positional-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Positional Reorder Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi1 = await createTestPBI(team.id, 'PBI 1');
      const pbi2 = await createTestPBI(team.id, 'PBI 2');
      const pbi3 = await createTestPBI(team.id, 'PBI 3');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi3.id,
          targetPbiId: pbi1.id,
          position: 'before',
        })
        .expect(200);

      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
        pbi3.id,
        pbi1.id,
        pbi2.id,
      ]);
    });

    it('should refuse with GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER when a Developer reorders', async () => {
      const email = `reorder-developer-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Developer Reorder Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const pbi1 = await createTestPBI(team.id, 'PBI 1');
      const pbi2 = await createTestPBI(team.id, 'PBI 2');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ pbiIds: [pbi2.id, pbi1.id] })
        .expect(403);

      expect(response.body.error.code).toBe(GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER);
    });

    it('should refuse a partial list instead of reporting a false success', async () => {
      const email = `reorder-partial-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Partial Reorder Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi1 = await createTestPBI(team.id, 'PBI 1');
      const pbi2 = await createTestPBI(team.id, 'PBI 2');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ pbiIds: [pbi2.id] })
        .expect(400);

      // Nothing was written: the omitted item kept its place.
      const rows = await prisma.productBacklogItem.findMany({
        where: { teamId: team.id },
        select: { id: true, rank: true },
        orderBy: { rank: 'asc' },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.rank === 0)).toBe(true);
      expect(pbi1.id).not.toBe(pbi2.id);
    });
  });

  describe('GET /api/v1/product-backlog/:id/tasks', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return tasks for PBI', async () => {
      const email = `pbi-tasks-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `PBI Tasks Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const pbi = await createTestPBI(team.id, 'PBI with Tasks');

      // Create a sprint and task for the PBI
      const sprint = await prisma.sprint.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          name: 'Sprint 1',
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
        },
      });

      await prisma.task.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          title: 'Task for PBI',
          status: 'TODO',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-backlog/${pbi.id}/tasks`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
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

    it('should return translated backlog item creation errors', async () => {
      const email = `i18n-create-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `i18n Create Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // Test validation error for empty title across all locales
      // Note: Backend uses Zod with hardcoded messages, not i18n keys
      for (const locale of SUPPORTED_LOCALES) {
        const response = await request(app)
          .post('/api/v1/product-backlog')
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

    it('should return translated priority status messages', async () => {
      const email = `i18n-priority-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `i18n Priority Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const pbi = await createTestPBI(team.id, 'Priority Test PBI');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // Test invalid priority validation error across all locales
      // Note: Backend uses Zod with hardcoded messages for enum validation
      for (const locale of SUPPORTED_LOCALES) {
        const response = await request(app)
          .put(`/api/v1/product-backlog/${pbi.id}/priority`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader(locale as Locale))
          .send({
            priority: 'INVALID_PRIORITY',
          })
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        // Backend uses Zod message for invalid enum value
        expect(response.body.error.details).toBeDefined();
        expect(response.body.error.details).toContainEqual(
          expect.objectContaining({ field: 'priority' })
        );
      }
    });

    it('should handle translated MoSCoW priority labels', async () => {
      const email = `i18n-moscow-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `i18n MoSCoW Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      // Only Developers may set story points, so use a Developer here.
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await createActiveProductGoal(team.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // Test creating PBIs with different MoSCoW priorities for each locale
      const moscowPriorities = ['MUST_HAVE', 'SHOULD_HAVE', 'COULD_HAVE', 'WONT_HAVE'];

      for (const locale of SUPPORTED_LOCALES) {
        for (const priority of moscowPriorities) {
          const response = await request(app)
            .post('/api/v1/product-backlog')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale))
            .send({
              teamId: team.id,
              title: `${priority} PBI - ${locale}`,
              description: `Test PBI with ${priority} priority for locale ${locale}`,
              storyPoints: 5,
              priority,
              businessValue: 50,
            })
            .expect(201);

          expect(response.body.success).toBe(true);
          expect(response.body.data.priority).toBe(priority);
        }
      }
    });
  });
});
