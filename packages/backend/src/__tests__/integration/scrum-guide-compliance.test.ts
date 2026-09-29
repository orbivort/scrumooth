// Integration Tests for Scrum Guide Compliance Enhancement Endpoints
// Covers Increment integration verification, SM facilitation dashboard,
// SM notes, Product Goal snapshots, and Scrum Values health checks.

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Scrum Guide Compliance Enhancement Integration Tests', () => {
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

  const createTestSprint = async (
    teamId: string,
    name: string,
    status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'COMPLETED',
    goalId?: string
  ) => {
    const sprintId = generateUUIDv7();
    const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const sprint = await prisma.sprint.create({
      data: {
        id: sprintId,
        teamId,
        name,
        startDate,
        endDate,
        status,
        sprintGoal: 'Test sprint goal',
        ...(goalId ? { goalId } : {}),
      },
    });
    return sprint;
  };

  const createTestIncrement = async (
    sprintId: string,
    teamId: string,
    name: string = 'Test Increment',
    status: 'DRAFT' | 'VERIFIED' | 'DELIVERED' | 'ARCHIVED' = 'DRAFT',
    integrationVerified: boolean = false
  ) => {
    const incrementId = generateUUIDv7();
    const increment = await prisma.increment.create({
      data: {
        id: incrementId,
        sprintId,
        teamId,
        name,
        status,
        integrationVerified,
        totalStoryPoints: 20,
      },
    });
    return increment;
  };

  const createTestProductGoal = async (teamId: string, title: string) => {
    const goalId = generateUUIDv7();
    const goal = await prisma.productGoal.create({
      data: {
        id: goalId,
        teamId,
        title,
        status: 'ACTIVE',
      },
    });
    return goal;
  };

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
          await prisma.teamHealthCheckResponse.deleteMany({
            where: { healthCheck: { teamId: team.id } },
          });
          await prisma.teamHealthCheck.deleteMany({ where: { teamId: team.id } });
          await prisma.productGoalSnapshot.deleteMany({
            where: { goal: { teamId: team.id } },
          });
          await prisma.productBacklogItem.deleteMany({ where: { teamId: team.id } });
          await prisma.productGoal.deleteMany({ where: { teamId: team.id } });
          await prisma.incrementIntegrationTest.deleteMany({
            where: { currentIncrement: { teamId: team.id } },
          });
          await prisma.increment.deleteMany({ where: { teamId: team.id } });
          await prisma.sprintRetrospective.deleteMany({
            where: { sprint: { teamId: team.id } },
          });
          await prisma.sprintReview.deleteMany({
            where: { sprint: { teamId: team.id } },
          });
          await prisma.impediment.deleteMany({ where: { teamId: team.id } });
          await prisma.sprintBacklogChange.deleteMany({
            where: { sprint: { teamId: team.id } },
          });
          await prisma.task.deleteMany({
            where: { sprint: { teamId: team.id } },
          });
          await prisma.sprint.deleteMany({ where: { teamId: team.id } });
          await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
          await prisma.team.delete({ where: { id: team.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  describe('Increment Integration Verification', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create an integration test between increments', async () => {
      const email = `integ-test-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Test Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const current = await createTestIncrement(sprint.id, team.id, 'Current');
      const prior = await createTestIncrement(sprint.id, team.id, 'Prior');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${current.id}/integration-tests`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priorIncrementId: prior.id,
          testResult: 'PASSED',
          notes: 'Integration verified',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.testResult).toBe('PASSED');
      expect(response.body.data.priorIncrementName).toBe('Prior');
    });

    it('should reject adding an integration test to a delivered increment', async () => {
      const email = `integ-delivered-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Delivered Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const current = await createTestIncrement(
        sprint.id,
        team.id,
        'Delivered Current',
        'DELIVERED'
      );
      const prior = await createTestIncrement(sprint.id, team.id, 'Prior');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${current.id}/integration-tests`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priorIncrementId: prior.id,
          testResult: 'PASSED',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject verifying integration for a delivered increment', async () => {
      const email = `integ-verify-delivered-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Verify Delivered Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const increment = await createTestIncrement(
        sprint.id,
        team.id,
        'Delivered Increment',
        'DELIVERED',
        true
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${increment.id}/verify-integration`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 when testResult is invalid', async () => {
      const email = `integ-invalid-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Invalid Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const current = await createTestIncrement(sprint.id, team.id, 'Current');
      const prior = await createTestIncrement(sprint.id, team.id, 'Prior');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${current.id}/integration-tests`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priorIncrementId: prior.id,
          testResult: 'NOT_A_RESULT',
        })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should list integration tests for an increment', async () => {
      const email = `integ-list-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ List Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const current = await createTestIncrement(sprint.id, team.id, 'Current');
      const prior = await createTestIncrement(sprint.id, team.id, 'Prior');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/increments/${current.id}/integration-tests`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priorIncrementId: prior.id,
          testResult: 'PASSED',
        })
        .expect(201);

      const response = await request(app)
        .get(`/api/v1/increments/${current.id}/integration-tests`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].testResult).toBe('PASSED');
    });

    it('should verify integration and set verified for first increment exemption', async () => {
      const email = `integ-verify-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Verify Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const increment = await createTestIncrement(sprint.id, team.id, 'First Increment');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${increment.id}/verify-integration`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.integrationVerified).toBe(true);
      expect(response.body.data.priorCount).toBe(0);
    });

    it('should mark integrationVerified false when a prior test is missing', async () => {
      const email = `integ-missing-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Missing Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const prior = await createTestIncrement(
        sprint.id,
        team.id,
        'Prior Verified',
        'VERIFIED',
        true
      );
      const current = await createTestIncrement(sprint.id, team.id, 'Current');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${current.id}/verify-integration`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.integrationVerified).toBe(false);
      expect(response.body.data.missingTests).toContain(prior.name);
    });

    it('should get the increment dependency chain', async () => {
      const email = `integ-chain-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Integ Chain Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const first = await createTestIncrement(sprint.id, team.id, 'First');
      const second = await createTestIncrement(sprint.id, team.id, 'Second');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/increments/${second.id}/chain`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      const firstItem = response.body.data.find((item: { id: string }) => item.id === first.id);
      expect(firstItem).toBeDefined();
      const isCurrent = response.body.data.find(
        (item: { id: string; isCurrent: boolean }) => item.id === second.id
      );
      expect(isCurrent.isCurrent).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/increments/${generateUUIDv7()}/chain`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('SM Facilitation Dashboard', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return dashboard for a scrum master', async () => {
      const email = `sm-dash-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `SM Dash Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestSprint(team.id, 'Sprint 1');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/dashboard/scrum-master')
        .set('Cookie', cookies)
        .set('x-team-id', team.id)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eventCompliance');
      expect(response.body.data).toHaveProperty('impedimentMetrics');
      expect(response.body.data).toHaveProperty('dodComplianceTrend');
      expect(response.body.data).toHaveProperty('sprintGoalAchievement');
      expect(response.body.data).toHaveProperty('actionItemCompletion');
    });

    it('should deny dashboard access to a developer', async () => {
      const email = `sm-dash-denied-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `SM Denied Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/dashboard/scrum-master')
        .set('Cookie', cookies)
        .set('x-team-id', team.id)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 when sprintCount is out of range', async () => {
      const email = `sm-dash-range-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `SM Range Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/dashboard/scrum-master')
        .set('Cookie', cookies)
        .set('x-team-id', team.id)
        .query({ sprintCount: 100 })
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should return event schedule for a scrum master', async () => {
      const email = `sm-schedule-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `SM Schedule Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/dashboard/scrum-master/schedule')
        .set('Cookie', cookies)
        .set('x-team-id', team.id)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should update sprint SM notes', async () => {
      const email = `sm-notes-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `SM Notes Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .patch(`/api/v1/sprints/${sprint.id}/sm-notes`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ smNotes: 'Facilitation observation' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.smNotes).toBe('Facilitation observation');
    });
  });

  describe('Scrum Values Health Checks', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a health check and submit responses', async () => {
      const email = `health-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Health Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const createResponse = await request(app)
        .post(`/api/v1/teams/${team.id}/health-checks`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      const healthCheckId = createResponse.body.data.id;

      const submitResponse = await request(app)
        .post(`/api/v1/health-checks/${healthCheckId}/responses`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          responses: [
            { scrumValue: 'COMMITMENT', score: 4, anonymous: true },
            { scrumValue: 'FOCUS', score: 5, anonymous: true },
            { scrumValue: 'OPENNESS', score: 3, anonymous: true },
            { scrumValue: 'RESPECT', score: 4, anonymous: true },
            { scrumValue: 'COURAGE', score: 4, anonymous: true },
          ],
        })
        .expect(201);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.data.saved).toHaveLength(5);
    });

    it('should return health check results', async () => {
      const email = `health-results-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Health Results Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const createResponse = await request(app)
        .post(`/api/v1/teams/${team.id}/health-checks`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(201);
      const healthCheckId = createResponse.body.data.id;

      await request(app)
        .post(`/api/v1/health-checks/${healthCheckId}/responses`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          responses: [
            { scrumValue: 'COMMITMENT', score: 4, anonymous: false },
            { scrumValue: 'FOCUS', score: 5, anonymous: false },
            { scrumValue: 'OPENNESS', score: 3, anonymous: false },
            { scrumValue: 'RESPECT', score: 4, anonymous: false },
            { scrumValue: 'COURAGE', score: 4, anonymous: false },
          ],
        })
        .expect(201);

      const response = await request(app)
        .get(`/api/v1/health-checks/${healthCheckId}/results`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(5);
      expect(response.body.data.overallAverage).toBeGreaterThan(0);
    });

    it('should return health check trend for a team', async () => {
      const email = `health-trend-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Health Trend Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/teams/${team.id}/health-checks`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(201);

      const response = await request(app)
        .get(`/api/v1/teams/${team.id}/health-check-trend`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('Product Goal Snapshots', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create and retrieve a product goal snapshot for a sprint review', async () => {
      const email = `pg-snapshot-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `PG Snapshot Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const goal = await createTestProductGoal(team.id, 'Launch MVP');
      const sprint = await createTestSprint(team.id, 'Sprint', 'COMPLETED', goal.id);
      const increment = await createTestIncrement(sprint.id, team.id, 'Review Increment');

      // Create a sprint review linked to the sprint
      const reviewId = generateUUIDv7();
      await prisma.sprintReview.create({
        data: {
          id: reviewId,
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date(),
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const submitResponse = await request(app)
        .post(`/api/v1/sprint-reviews/${reviewId}/product-goal-assessment`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          assessment: 'On track to deliver MVP',
          successMetricValues: { activeUsers: 100 },
        })
        .expect(201);

      expect(submitResponse.body.success).toBe(true);
      expect(submitResponse.body.data.assessment).toBe('On track to deliver MVP');

      const snapshotsResponse = await request(app)
        .get(`/api/v1/product-goals/${goal.id}/snapshots`)
        .set('Cookie', cookies)
        .expect(200);

      expect(snapshotsResponse.body.success).toBe(true);
      expect(snapshotsResponse.body.data).toHaveLength(1);
      expect(snapshotsResponse.body.data[0].assessment).toBe('On track to deliver MVP');
    });

    it('should return 400 when creating snapshot for sprint review without a product goal', async () => {
      const email = `pg-nogoal-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `PG NoGoal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const sprint = await createTestSprint(team.id, 'Sprint', 'COMPLETED');
      const increment = await createTestIncrement(sprint.id, team.id, 'Review Increment');

      const reviewId = generateUUIDv7();
      await prisma.sprintReview.create({
        data: {
          id: reviewId,
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date(),
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprint-reviews/${reviewId}/product-goal-assessment`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ assessment: 'No goal linked' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Single Product Owner / Scrum Master per Team', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should reject adding a second Product Owner with ROLE_ALREADY_TAKEN', async () => {
      const smEmail = `sm-po-second-${uniqueId()}@example.com`;
      const poEmail = `po-first-${uniqueId()}@example.com`;
      const targetEmail = `po-second-${uniqueId()}@example.com`;
      testEmails.push(smEmail, poEmail, targetEmail);

      const smUser = await createTestUserInDb(smEmail);
      const poUser = await createTestUserInDb(poEmail);
      const targetUser = await createTestUserInDb(targetEmail);

      const teamName = `Single PO Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');
      await addTeamMember(team.id, poUser.id, 'PRODUCT_OWNER');

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ email: targetEmail, role: 'PRODUCT_OWNER' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_LEADERSHIP_ROLE_TAKEN');

      // No membership row should have been created for the target user
      const membership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: team.id, userId: targetUser.id } },
      });
      expect(membership).toBeNull();
    });

    it('should reject adding a second Scrum Master with ROLE_ALREADY_TAKEN', async () => {
      const smEmail = `sm-second-${uniqueId()}@example.com`;
      const targetEmail = `sm-target-${uniqueId()}@example.com`;
      testEmails.push(smEmail, targetEmail);

      const smUser = await createTestUserInDb(smEmail);
      await createTestUserInDb(targetEmail);

      const teamName = `Single SM Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ email: targetEmail, role: 'SCRUM_MASTER' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_LEADERSHIP_ROLE_TAKEN');
    });

    it('should reject promoting a member to an already-taken Scrum Master role', async () => {
      const smEmail = `sm-promote-${uniqueId()}@example.com`;
      const devEmail = `dev-promote-${uniqueId()}@example.com`;
      testEmails.push(smEmail, devEmail);

      const smUser = await createTestUserInDb(smEmail);
      const devUser = await createTestUserInDb(devEmail);

      const teamName = `Promote SM Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');

      const membership = await prisma.teamMember.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          userId: devUser.id,
          role: 'DEVELOPERS',
        },
      });

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/teams/${team.id}/members/${membership.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ role: 'SCRUM_MASTER' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_LEADERSHIP_ROLE_TAKEN');

      // The role should remain unchanged in the database
      const unchanged = await prisma.teamMember.findUnique({ where: { id: membership.id } });
      expect(unchanged?.role).toBe('DEVELOPERS');
    });

    it('should return 404 NOT_FOUND when updating a member from another team', async () => {
      const smEmail = `sm-cross-${uniqueId()}@example.com`;
      const otherMemberEmail = `other-cross-${uniqueId()}@example.com`;
      testEmails.push(smEmail, otherMemberEmail);

      const smUser = await createTestUserInDb(smEmail);
      const otherMember = await createTestUserInDb(otherMemberEmail);

      const teamOneName = `Cross Team One ${uniqueId()}`;
      const teamTwoName = `Cross Team Two ${uniqueId()}`;
      testTeams.push(teamOneName, teamTwoName);

      const teamOne = await createTestTeam(teamOneName);
      const teamTwo = await createTestTeam(teamTwoName);
      await addTeamMember(teamOne.id, smUser.id, 'SCRUM_MASTER');
      await addTeamMember(teamTwo.id, otherMember.id, 'DEVELOPERS');

      const otherMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: teamTwo.id, userId: otherMember.id } },
      });
      expect(otherMembership).not.toBeNull();

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/teams/${teamOne.id}/members/${otherMembership?.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ role: 'DEVELOPERS' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should allow adding a developer and promoting to a free Product Owner role', async () => {
      const smEmail = `sm-regress-${uniqueId()}@example.com`;
      const devEmail = `dev-regress-${uniqueId()}@example.com`;
      testEmails.push(smEmail, devEmail);

      const smUser = await createTestUserInDb(smEmail);
      await createTestUserInDb(devEmail);

      const teamName = `Regression Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // Normal add of a DEVELOPERS member
      const addResponse = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ email: devEmail, role: 'DEVELOPERS' })
        .expect(201);

      expect(addResponse.body.success).toBe(true);
      const membershipId: string = addResponse.body.data.id;

      // Normal promotion to a free PRODUCT_OWNER role
      const promoteResponse = await request(app)
        .put(`/api/v1/teams/${team.id}/members/${membershipId}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ role: 'PRODUCT_OWNER' })
        .expect(200);

      expect(promoteResponse.body.success).toBe(true);
      expect(promoteResponse.body.data.role).toBe('PRODUCT_OWNER');

      const updated = await prisma.teamMember.findUnique({ where: { id: membershipId } });
      expect(updated?.role).toBe('PRODUCT_OWNER');
    });
  });

  describe('Team Size Limit', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should expose maxSize on the team detail response', async () => {
      const email = `size-meta-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Size Meta Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/teams/${team.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.maxSize).toBe(10);
      expect(response.body.data.memberCount).toBe(1);
    });

    it('should reject adding a member with TEAM_SIZE_LIMIT_REACHED when the team is at capacity', async () => {
      const smEmail = `size-sm-${uniqueId()}@example.com`;
      const targetEmail = `size-target-${uniqueId()}@example.com`;
      testEmails.push(smEmail, targetEmail);

      const smUser = await createTestUserInDb(smEmail);
      await createTestUserInDb(targetEmail);

      const teamName = `Size Limit Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');

      // Fill the team to the maximum size (default 10) with developers
      const maxSize = 10;
      const fillerEmails: string[] = [];
      for (let i = 0; i < maxSize - 1; i += 1) {
        const fillerEmail = `size-filler-${i}-${uniqueId()}@example.com`;
        const filler = await createTestUserInDb(fillerEmail);
        await addTeamMember(team.id, filler.id, 'DEVELOPERS');
        fillerEmails.push(fillerEmail);
      }
      testEmails.push(...fillerEmails);

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ email: targetEmail, role: 'DEVELOPERS' })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_TEAM_SIZE_LIMIT');

      // No membership row should have been created for the target user
      const targetUser = await prisma.user.findUnique({
        where: { email: targetEmail.toLowerCase() },
      });
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: team.id, userId: targetUser!.id },
        },
      });
      expect(membership).toBeNull();
    });

    it('should allow adding a member when the team is below capacity', async () => {
      const smEmail = `size-below-${uniqueId()}@example.com`;
      const devEmail = `size-dev-${uniqueId()}@example.com`;
      testEmails.push(smEmail, devEmail);

      const smUser = await createTestUserInDb(smEmail);
      await createTestUserInDb(devEmail);

      const teamName = `Size Below Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(smEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/teams/${team.id}/members`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ email: devEmail, role: 'DEVELOPERS' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});
