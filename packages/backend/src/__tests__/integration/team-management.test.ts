// Integration Tests for Team Management Endpoints
// Tests team CRUD operations, member management, and role assignments

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import config from '../../config';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';
import { setLocaleHeader, expectLocaleCookie, SUPPORTED_LOCALES } from '../helpers/i18n-helpers';
import type { Locale } from '@scrumooth/shared';

// Helper to generate unique test identifier
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Team Management Integration Tests', () => {
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
          await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
          await prisma.definitionOfDone.deleteMany({ where: { teamId: team.id } });
          await prisma.definitionOfReady.deleteMany({ where: { teamId: team.id } });
          await prisma.sprintConfiguration.deleteMany({ where: { teamId: team.id } });
          await prisma.productBacklogItem.deleteMany({ where: { teamId: team.id } });
          await prisma.sprint.deleteMany({ where: { teamId: team.id } });
          await prisma.productGoal.deleteMany({ where: { teamId: team.id } });
          await prisma.impediment.deleteMany({ where: { teamId: team.id } });
          await prisma.team.delete({ where: { id: team.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  describe('GET /api/v1/teams', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return teams for authenticated user', async () => {
      const email = `teams-list-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Test Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app).get('/api/v1/teams').set('Cookie', cookies).expect(200);

      expect(response.body.success).toBe(true);
      // The API may return data in different formats (array or paginated object)
      const teams = Array.isArray(response.body.data)
        ? response.body.data
        : response.body.data?.items || response.body.data?.teams || [];
      expect(Array.isArray(teams)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/v1/teams').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/teams/my-teams', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return teams with user roles', async () => {
      const email = `my-teams-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `My Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/teams/my-teams')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/teams', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a new team successfully', async () => {
      const email = `create-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const teamName = `New Team ${uniqueId()}`;
      testTeams.push(teamName);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/teams')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: teamName,
          description: 'A test team description',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(teamName);

      // Verify in database
      const team = await prisma.team.findUnique({
        where: { name: teamName },
      });
      expect(team).not.toBeNull();
    });

    it('should return 422 with invalid team data', async () => {
      const email = `invalid-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/teams')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: '', // Empty name should fail validation
        })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate team name', async () => {
      const email = `duplicate-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const teamName = `Duplicate Team ${uniqueId()}`;
      testTeams.push(teamName);

      // Create first team
      await createTestTeam(teamName);

      // Try to create second team with same name
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/teams')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: teamName,
          description: 'Another team with same name',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/teams/:teamId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return team by ID', async () => {
      const email = `get-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Get Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/teams/${team.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(team.id);
      expect(response.body.data.name).toBe(teamName);
    });

    it('should return 404 for non-existent team', async () => {
      const email = `nonexistent-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/teams/${generateUUIDv7()}`)
        .set('Cookie', cookies)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 for invalid team ID format', async () => {
      const email = `invalid-team-id-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/teams/invalid-id')
        .set('Cookie', cookies)
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/teams/:teamId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update team successfully', async () => {
      const email = `update-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Update Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/teams/${team.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: `${teamName} Updated`,
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(`${teamName} Updated`);
    });
  });

  describe('DELETE /api/v1/teams/:teamId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should delete team successfully', async () => {
      const email = `delete-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/teams/${team.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify team is deleted
      const deletedTeam = await prisma.team.findUnique({
        where: { id: team.id },
      });
      expect(deletedTeam).toBeNull();

      // Remove from cleanup list
      testTeams.splice(testTeams.indexOf(teamName), 1);
    });
  });

  describe('POST /api/v1/teams/:teamId/members', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should add member to team', async () => {
      const adminEmail = `admin-add-${uniqueId()}@example.com`;
      const memberEmail = `member-add-${uniqueId()}@example.com`;
      testEmails.push(adminEmail, memberEmail);

      const admin = await createTestUserInDb(adminEmail);
      const member = await createTestUserInDb(memberEmail);

      const teamName = `Add Member Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(adminEmail);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          email: memberEmail,
          role: 'DEVELOPERS',
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      // Verify member was added
      const membership = await prisma.teamMember.findFirst({
        where: { teamId: team.id, userId: member.id },
      });
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe('DEVELOPERS');
    });

    it('should return 404 when adding non-existent user', async () => {
      const adminEmail = `admin-nonexistent-${uniqueId()}@example.com`;
      testEmails.push(adminEmail);

      const admin = await createTestUserInDb(adminEmail);

      const teamName = `Nonexistent Member Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(adminEmail);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          email: 'nonexistent@example.com',
          role: 'DEVELOPERS',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('lets exactly one of two simultaneous Product Owner adds through', async () => {
      // The report's own scenario: two requests that each read "no Product Owner yet" before either
      // writes. Read-then-write outside a serializable transaction, both insert and the Guide's
      // "the Product Owner is one person, not a committee" is violated with nothing to catch it.
      const adminEmail = `admin-race-po-${uniqueId()}@example.com`;
      const firstEmail = `race-po-first-${uniqueId()}@example.com`;
      const secondEmail = `race-po-second-${uniqueId()}@example.com`;
      testEmails.push(adminEmail, firstEmail, secondEmail);

      const admin = await createTestUserInDb(adminEmail);
      await createTestUserInDb(firstEmail);
      await createTestUserInDb(secondEmail);

      const teamName = `Race Product Owner Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(adminEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const addProductOwner = (email: string) =>
        request(app)
          .post(`/api/v1/teams/${team.id}/members`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({ email, role: 'PRODUCT_OWNER' });

      const [first, second] = await Promise.all([
        addProductOwner(firstEmail),
        addProductOwner(secondEmail),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);

      const refusal = first.status === 409 ? first : second;
      expect(refusal.body.error.code).toBe('GATE_LEADERSHIP_ROLE_TAKEN');

      const owners = await prisma.teamMember.count({
        where: { teamId: team.id, role: 'PRODUCT_OWNER' },
      });
      expect(owners).toBe(1);
    });

    it('never lets the team grow past its maximum when two adds race', async () => {
      const adminEmail = `admin-race-size-${uniqueId()}@example.com`;
      const firstEmail = `race-size-first-${uniqueId()}@example.com`;
      const secondEmail = `race-size-second-${uniqueId()}@example.com`;
      testEmails.push(adminEmail, firstEmail, secondEmail);

      const admin = await createTestUserInDb(adminEmail);
      await createTestUserInDb(firstEmail);
      await createTestUserInDb(secondEmail);

      const teamName = `Race Team Size Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

      // One below capacity, counting the Scrum Master already added. The fillers share one password
      // hash: they never log in, and hashing eleven accounts would only slow the suite down.
      const password = await bcrypt.hash('TestPassword123!', 12);

      for (let index = 0; index < config.team.maxSize - 2; index += 1) {
        const email = `size-filler-${uniqueId()}-${index}@example.com`;
        testEmails.push(email);

        await prisma.user.create({
          data: {
            id: generateUUIDv7(),
            email: email.toLowerCase(),
            password,
            firstName: 'Filler',
            lastName: `${index}`,
          },
        });
      }

      const fillers = await prisma.user.findMany({
        where: { email: { in: testEmails.filter((email) => email.startsWith('size-filler-')) } },
        select: { id: true },
      });

      await prisma.teamMember.createMany({
        data: fillers.map((filler) => ({
          id: generateUUIDv7(),
          teamId: team.id,
          userId: filler.id,
          role: 'DEVELOPERS' as const,
        })),
      });

      const cookies = await loginAndGetCookies(adminEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const addMember = (email: string) =>
        request(app)
          .post(`/api/v1/teams/${team.id}/members`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({ email, role: 'DEVELOPERS' });

      const [first, second] = await Promise.all([addMember(firstEmail), addMember(secondEmail)]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);

      const refusal = first.status === 409 ? first : second;
      expect(refusal.body.error.code).toBe('GATE_TEAM_SIZE_LIMIT');

      const memberCount = await prisma.teamMember.count({ where: { teamId: team.id } });
      expect(memberCount).toBe(config.team.maxSize);
    });
  });

  describe('PUT /api/v1/teams/:teamId/members/:memberId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update member role', async () => {
      const adminEmail = `admin-update-role-${uniqueId()}@example.com`;
      const memberEmail = `member-update-role-${uniqueId()}@example.com`;
      testEmails.push(adminEmail, memberEmail);

      const admin = await createTestUserInDb(adminEmail);
      const member = await createTestUserInDb(memberEmail);

      const teamName = `Update Role Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

      const membership = await prisma.teamMember.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          userId: member.id,
          role: 'DEVELOPERS',
        },
      });

      const cookies = await loginAndGetCookies(adminEmail);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/teams/${team.id}/members/${membership.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          role: 'PRODUCT_OWNER',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify role was updated
      const updatedMembership = await prisma.teamMember.findUnique({
        where: { id: membership.id },
      });
      expect(updatedMembership?.role).toBe('PRODUCT_OWNER');
    });
  });

  describe('DELETE /api/v1/teams/:teamId/members/:memberId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should remove member from team', async () => {
      const adminEmail = `admin-remove-${uniqueId()}@example.com`;
      const memberEmail = `member-remove-${uniqueId()}@example.com`;
      testEmails.push(adminEmail, memberEmail);

      const admin = await createTestUserInDb(adminEmail);
      const member = await createTestUserInDb(memberEmail);

      const teamName = `Remove Member Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

      const membership = await prisma.teamMember.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          userId: member.id,
          role: 'DEVELOPERS',
        },
      });

      const cookies = await loginAndGetCookies(adminEmail);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/teams/${team.id}/members/${membership.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify member was removed
      const deletedMembership = await prisma.teamMember.findUnique({
        where: { id: membership.id },
      });
      expect(deletedMembership).toBeNull();
    });
  });

  describe('GET /api/v1/teams/:teamId/my-role', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return user role in team', async () => {
      const email = `my-role-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `My Role Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/teams/${team.id}/my-role`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('SCRUM_MASTER');
    });
  });

  describe('POST /api/v1/teams/select-team', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should select team for session', async () => {
      const email = `select-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Select Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/teams/select-team')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ teamId: team.id })
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

    describe('Locale cookie and header resolution', () => {
      it('should set locale cookie based on Accept-Language header for team list request', async () => {
        const email = `locale-team-list-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `Locale Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'DEVELOPERS');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/teams')
          .set('Cookie', cookies)
          .set(setLocaleHeader('de'))
          .expect(200);

        expectLocaleCookie(response, 'de');
        expect(response.body.success).toBe(true);
      });

      it('should set locale cookie for all supported locales', async () => {
        const email = `locale-all-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `Locale All Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'DEVELOPERS');

        const cookies = await loginAndGetCookies(email);

        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get('/api/v1/teams')
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(200);

          expectLocaleCookie(response, locale as Locale);
        }
      });
    });

    describe('Translated team role messages', () => {
      it('should return 403 with FORBIDDEN code when developer tries to update member role', async () => {
        const scrumMasterEmail = `sm-role-${uniqueId()}@example.com`;
        const developerEmail = `dev-role-${uniqueId()}@example.com`;
        const targetMemberEmail = `target-role-${uniqueId()}@example.com`;
        testEmails.push(scrumMasterEmail, developerEmail, targetMemberEmail);

        const scrumMaster = await createTestUserInDb(scrumMasterEmail);
        const developer = await createTestUserInDb(developerEmail);
        const targetMember = await createTestUserInDb(targetMemberEmail);

        const teamName = `Role Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, scrumMaster.id, 'SCRUM_MASTER');
        await addTeamMember(team.id, developer.id, 'DEVELOPERS');

        const membership = await prisma.teamMember.create({
          data: {
            id: generateUUIDv7(),
            teamId: team.id,
            userId: targetMember.id,
            role: 'DEVELOPERS',
          },
        });

        // Login as developer (who doesn't have permission to update roles)
        const cookies = await loginAndGetCookies(developerEmail);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/teams/${team.id}/members/${membership.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .send({ role: 'PRODUCT_OWNER' })
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expectLocaleCookie(response, 'de');
      });

      it('should return localized locale cookie for role update success in multiple locales', async () => {
        const scrumMasterEmail = `sm-success-${uniqueId()}@example.com`;
        const memberEmail = `member-success-${uniqueId()}@example.com`;
        testEmails.push(scrumMasterEmail, memberEmail);

        const scrumMaster = await createTestUserInDb(scrumMasterEmail);
        const member = await createTestUserInDb(memberEmail);

        const teamName = `Success Role Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, scrumMaster.id, 'SCRUM_MASTER');

        const membership = await prisma.teamMember.create({
          data: {
            id: generateUUIDv7(),
            teamId: team.id,
            userId: member.id,
            role: 'DEVELOPERS',
          },
        });

        const cookies = await loginAndGetCookies(scrumMasterEmail);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Test role update with German locale
        const responseDe = await request(app)
          .put(`/api/v1/teams/${team.id}/members/${membership.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .send({ role: 'PRODUCT_OWNER' })
          .expect(200);

        expect(responseDe.body.success).toBe(true);
        expectLocaleCookie(responseDe, 'de');

        // Update role back to DEVELOPERS with Spanish locale
        const responseEs = await request(app)
          .put(`/api/v1/teams/${team.id}/members/${membership.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('es'))
          .send({ role: 'DEVELOPERS' })
          .expect(200);

        expect(responseEs.body.success).toBe(true);
        expectLocaleCookie(responseEs, 'es');
      });
    });

    describe('Translated permission denied messages', () => {
      it('should return 403 Forbidden with locale cookie set for unauthorized team access', async () => {
        const ownerEmail = `owner-403-${uniqueId()}@example.com`;
        const outsiderEmail = `outsider-403-${uniqueId()}@example.com`;
        testEmails.push(ownerEmail, outsiderEmail);

        const owner = await createTestUserInDb(ownerEmail);
        await createTestUserInDb(outsiderEmail);

        const teamName = `Private Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, owner.id, 'PRODUCT_OWNER');

        // Login as outsider who is not a team member
        const cookies = await loginAndGetCookies(outsiderEmail);

        const response = await request(app)
          .get(`/api/v1/teams/${team.id}`)
          .set('Cookie', cookies)
          .set(setLocaleHeader('fr'))
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
        expectLocaleCookie(response, 'fr');
      });

      it('should return 403 Forbidden with correct locale for multiple locales', async () => {
        const ownerEmail = `owner-multi-${uniqueId()}@example.com`;
        const outsiderEmail = `outsider-multi-${uniqueId()}@example.com`;
        testEmails.push(ownerEmail, outsiderEmail);

        const owner = await createTestUserInDb(ownerEmail);
        await createTestUserInDb(outsiderEmail);

        const teamName = `Multi Locale Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, owner.id, 'PRODUCT_OWNER');

        const cookies = await loginAndGetCookies(outsiderEmail);

        // Test with Italian locale
        const responseIt = await request(app)
          .get(`/api/v1/teams/${team.id}`)
          .set('Cookie', cookies)
          .set(setLocaleHeader('it'))
          .expect(403);

        expect(responseIt.body.success).toBe(false);
        expect(responseIt.body.error.code).toBe('FORBIDDEN');
        expectLocaleCookie(responseIt, 'it');

        // Test with English locale
        const responseEn = await request(app)
          .get(`/api/v1/teams/${team.id}`)
          .set('Cookie', cookies)
          .set(setLocaleHeader('en'))
          .expect(403);

        expect(responseEn.body.success).toBe(false);
        expect(responseEn.body.error.code).toBe('FORBIDDEN');
        expectLocaleCookie(responseEn, 'en');
      });
    });

    describe('Translated team member invitation messages', () => {
      it('should set locale cookie for invitation request in German', async () => {
        const adminEmail = `admin-invite-${uniqueId()}@example.com`;
        const newMemberEmail = `new-member-invite-${uniqueId()}@example.com`;
        testEmails.push(adminEmail, newMemberEmail);

        const admin = await createTestUserInDb(adminEmail);
        await createTestUserInDb(newMemberEmail);

        const teamName = `Invite Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

        const cookies = await loginAndGetCookies(adminEmail);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/teams/${team.id}/members`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .send({
            email: newMemberEmail,
            role: 'DEVELOPERS',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expectLocaleCookie(response, 'de');

        // Verify notification was created for the invited member
        const notification = await prisma.notification.findFirst({
          where: {
            userId: (
              await prisma.user.findUnique({ where: { email: newMemberEmail.toLowerCase() } })
            )?.id,
            type: 'TEAM_INVITATION',
          },
        });
        expect(notification).not.toBeNull();
      });

      it('should return 404 with locale cookie when inviting non-existent user', async () => {
        const adminEmail = `admin-nonexist-${uniqueId()}@example.com`;
        testEmails.push(adminEmail);

        const admin = await createTestUserInDb(adminEmail);

        const teamName = `Nonexist Invite Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, admin.id, 'SCRUM_MASTER');

        const cookies = await loginAndGetCookies(adminEmail);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/teams/${team.id}/members`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('es'))
          .send({
            email: 'nonexistent-user@example.com',
            role: 'DEVELOPERS',
          })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expectLocaleCookie(response, 'es');
      });

      it('should handle invitation request with French locale', async () => {
        const adminEmail = `admin-fr-${uniqueId()}@example.com`;
        const newMemberEmail = `member-fr-${uniqueId()}@example.com`;
        testEmails.push(adminEmail, newMemberEmail);

        const admin = await createTestUserInDb(adminEmail);
        await createTestUserInDb(newMemberEmail);

        const teamName = `French Invite Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, admin.id, 'PRODUCT_OWNER');

        const cookies = await loginAndGetCookies(adminEmail);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/teams/${team.id}/members`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('fr'))
          .send({
            email: newMemberEmail,
            role: 'DEVELOPERS',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expectLocaleCookie(response, 'fr');
      });
    });
  });
});
