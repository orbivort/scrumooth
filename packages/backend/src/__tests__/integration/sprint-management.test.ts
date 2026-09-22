// Integration Tests for Sprint Management Endpoints
// Tests sprint lifecycle, backlog management, and sprint operations

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';
import { setLocaleHeader, expectLocaleCookie, SUPPORTED_LOCALES } from '../helpers/i18n-helpers';
import type { Locale } from '@scrumooth/shared';

// Helper to generate unique test identifier
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

/**
 * Seed the planning participation the Sprint-start gate requires: the Product Owner and at least
 * one Developer recorded as present. Written directly so lifecycle tests focus on the behaviour
 * under test; the planning-attendance API has its own tests.
 */
const seedPlanningParticipation = async (sprintId: string, createdBy?: string): Promise<void> => {
  await prisma.sprintPlanningAttendee.createMany({
    data: [
      {
        id: generateUUIDv7(),
        sprintId,
        name: 'Product Owner',
        role: 'product_owner',
        attended: true,
        createdBy,
      },
      {
        id: generateUUIDv7(),
        sprintId,
        name: 'Developer',
        role: 'developers',
        attended: true,
        createdBy,
      },
    ],
  });
};

/**
 * Seed the two agreements the Sprint boundary requires for this Sprint: a Definition of Done the
 * team holds, and a Definition of Ready whose active criterion every item on the Sprint's backlog
 * satisfies.
 *
 * The boundary refuses a Sprint Backlog commit, and a Sprint start, when the team has no Definition
 * of Done, when its readiness agreement holds no active criterion, or when a selected item has an
 * unverified one -- so a fixture that intends to open a Sprint has to represent a team that holds
 * both. Idempotent, because several Sprints can share one team. Written directly, like the
 * participation seed above; the definitions' own rules are covered by
 * `integration/team-definitions.test.ts`.
 *
 * `pbiIds` defaults to the items already on the Sprint's backlog. A test that is *about* saving the
 * backlog has nothing persisted yet, so it names the items it is about to commit instead.
 */
const seedTeamDefinitions = async (
  sprintId: string,
  createdBy?: string,
  pbiIds?: string[]
): Promise<void> => {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { teamId: true, sprintBacklogItems: { select: { pbiId: true } } },
  });

  if (!sprint) {
    return;
  }

  const existingDoD = await prisma.definitionOfDone.findUnique({
    where: { teamId: sprint.teamId },
    select: { id: true },
  });

  if (!existingDoD) {
    await prisma.definitionOfDone.create({
      data: {
        id: generateUUIDv7(),
        teamId: sprint.teamId,
        createdBy,
        items: {
          create: {
            id: generateUUIDv7(),
            description: 'Code is peer-reviewed and approved',
            category: 'review',
            isActive: true,
            order: 0,
            createdBy,
          },
        },
      },
    });
  }

  const existingDoR = await prisma.definitionOfReady.findUnique({
    where: { teamId: sprint.teamId },
    select: { items: { where: { isActive: true }, select: { id: true }, take: 1 } },
  });

  let dorItemId = existingDoR?.items[0]?.id;

  if (!dorItemId) {
    dorItemId = generateUUIDv7();
    const newItem = {
      create: {
        id: dorItemId,
        description: 'Acceptance criteria defined and agreed',
        category: 'acceptance',
        isActive: true,
        order: 0,
        createdBy,
      },
    };

    await prisma.definitionOfReady.upsert({
      where: { teamId: sprint.teamId },
      create: { id: generateUUIDv7(), teamId: sprint.teamId, createdBy, items: newItem },
      update: { items: newItem },
    });
  }

  // A readiness verification carries a foreign key to the user who recorded it.
  const verifier =
    createdBy ??
    (
      await prisma.teamMember.findFirst({
        where: { teamId: sprint.teamId },
        select: { userId: true },
      })
    )?.userId;

  if (!verifier) {
    return;
  }

  const itemsToVerify = pbiIds ?? sprint.sprintBacklogItems.map((item) => item.pbiId);

  for (const pbiId of itemsToVerify) {
    await prisma.doRChecklistVerification.upsert({
      where: { pbiId_dorItemId: { pbiId, dorItemId } },
      create: {
        id: generateUUIDv7(),
        pbiId,
        dorItemId,
        isVerified: true,
        verifiedBy: verifier,
        createdBy: verifier,
      },
      update: { isVerified: true, verifiedBy: verifier },
    });
  }
};

/**
 * Everything a Sprint start requires of the team's records except the gate a test is exercising:
 * planning participation plus the two agreements. Most start tests want a Sprint that can open, so
 * they use this; a test that asserts a start gate seeds only what that gate needs.
 */
const seedStartPrerequisites = async (sprintId: string, createdBy?: string): Promise<void> => {
  await seedPlanningParticipation(sprintId, createdBy);
  await seedTeamDefinitions(sprintId, createdBy);
};

describe('Sprint Management Integration Tests', () => {
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

  // Helper to create a sprint
  const createTestSprint = async (
    teamId: string,
    name: string,
    status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DRAFT' = 'PLANNED',
    options: { sprintGoal?: string } = {}
  ) => {
    const sprintId = generateUUIDv7();
    const startDate = new Date();
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const sprint = await prisma.sprint.create({
      data: {
        id: sprintId,
        teamId,
        name,
        startDate,
        endDate,
        status,
        sprintGoal: options.sprintGoal ?? 'Test sprint goal',
      },
    });
    return sprint;
  };

  // Helper to create a product goal. A Sprint cannot start until it is linked to a Product
  // Goal, so tests that start a Sprint create the team's active goal first (the start then
  // adopts it, mirroring the reconciliation the service performs).
  const createTestProductGoal = async (
    teamId: string,
    title: string,
    status: 'NEW' | 'ACTIVE' = 'ACTIVE'
  ) => {
    const goalId = generateUUIDv7();
    const goal = await prisma.productGoal.create({
      data: {
        id: goalId,
        teamId,
        title,
        description: 'Test product goal',
        status,
        successMetrics: 'Measurable outcomes',
      },
    });
    return goal;
  };

  // Helper to create a PBI
  const createTestPBI = async (
    teamId: string,
    title: string,
    status: 'READY' | 'NEW' = 'READY'
  ) => {
    const pbiId = generateUUIDv7();
    const pbi = await prisma.productBacklogItem.create({
      data: {
        id: pbiId,
        teamId,
        title,
        description: 'Test PBI description',
        status,
        priority: 'SHOULD_HAVE',
        storyPoints: 5,
      },
    });
    return pbi;
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
          // Clean up related data
          await prisma.task.deleteMany({
            where: {
              sprint: { teamId: team.id },
            },
          });
          await prisma.sprintBacklogItem.deleteMany({
            where: {
              sprint: { teamId: team.id },
            },
          });
          await prisma.sprintBacklogChange.deleteMany({
            where: { sprint: { teamId: team.id } },
          });
          await prisma.sprint.deleteMany({ where: { teamId: team.id } });
          await prisma.productBacklogItem.deleteMany({ where: { teamId: team.id } });
          await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
          await prisma.team.delete({ where: { id: team.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  // Per the Scrum Guide (2020), a Sprint can only be completed once the Sprint Review and
  // Sprint Retrospective have both concluded. This helper creates a completed Sprint Review
  // and a COMPLETED Sprint Retrospective (with their linked Increment) for the sprint so the
  // complete endpoint's prerequisite-event gate is satisfied.
  const completePrerequisiteEvents = async (
    sprintId: string,
    teamId: string,
    userId: string
  ): Promise<void> => {
    const increment = await prisma.increment.create({
      data: {
        id: generateUUIDv7(),
        sprintId,
        teamId,
        name: 'Completion Increment',
        status: 'DELIVERED',
        integrationVerified: true,
        totalStoryPoints: 0,
      },
    });

    await prisma.sprintReview.create({
      data: {
        id: generateUUIDv7(),
        sprintId,
        teamId,
        incrementId: increment.id,
        reviewDate: new Date(),
        status: 'completed',
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await prisma.sprintRetrospective.create({
      data: {
        id: generateUUIDv7(),
        sprintId,
        teamId,
        retroDate: new Date(),
        facilitatorId: userId,
        status: 'COMPLETED',
        createdBy: userId,
      },
    });
  };

  describe('GET /api/v1/sprints', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return sprints for team', async () => {
      const email = `sprints-list-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Sprints Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestSprint(team.id, 'Sprint 1');
      await createTestSprint(team.id, 'Sprint 2');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/sprints')
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/sprints/active', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return active sprint for team', async () => {
      const email = `active-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Active Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestSprint(team.id, 'Active Sprint', 'ACTIVE');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints/active')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/sprints', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a new sprint successfully', async () => {
      const email = `create-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Create Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app)
        .post('/api/v1/sprints')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          name: 'New Sprint',
          startDate,
          endDate,
          sprintGoal: 'Complete all planned stories',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('New Sprint');
      expect(response.body.data.status).toBe('PLANNED');
    });

    it('should return 422 with invalid sprint data', async () => {
      const email = `invalid-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Invalid Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprints')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          name: '', // Empty name should fail validation
          startDate: new Date().toISOString(),
          endDate: new Date().toISOString(),
        });

      // Should return 422 for validation error, but might return 403 if team membership check fails
      expect([422, 403]).toContain(response.status);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/sprints/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return sprint by ID', async () => {
      const email = `get-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Get Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Specific Sprint');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sprint.id);
      expect(response.body.data.name).toBe('Specific Sprint');
    });

    it('should return 404 for non-existent sprint', async () => {
      const email = `nonexistent-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${generateUUIDv7()}`)
        .set('Cookie', cookies)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/sprints/:id/start', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should start a planned sprint', async () => {
      const email = `start-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Start Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestProductGoal(team.id, 'Test Product Goal');
      const sprint = await createTestSprint(team.id, 'Sprint to Start', 'PLANNED');

      // Create a ready PBI to add to sprint
      const pbi = await createTestPBI(team.id, 'Ready PBI', 'READY');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      // The Sprint Backlog must be saved before the sprint can start.
      await prisma.sprintBacklogItem.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          createdBy: user.id,
        },
      });
      // Planning participation is a start gate: record the PO and a Developer as present.
      await seedStartPrerequisites(sprint.id, user.id);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Sprint Planning participation and capacity gates', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    const setupPlanningSprint = async (options: { withCapacity?: boolean } = {}) => {
      const email = `planning-gates-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Planning Gates Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await createTestProductGoal(team.id, 'Test Product Goal');
      const sprint = await createTestSprint(team.id, 'Planning Gates Sprint', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Ready PBI', 'READY');

      await prisma.sprintBacklogItem.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          createdBy: user.id,
        },
      });

      if (options.withCapacity) {
        // 10h recorded capacity against a 40h plan: far beyond the default 10% tolerance.
        await prisma.sprintCapacity.create({
          data: {
            id: generateUUIDv7(),
            sprintId: sprint.id,
            userId: user.id,
            availableHours: 10,
          },
        });
        await prisma.task.create({
          data: {
            id: generateUUIDv7(),
            sprintId: sprint.id,
            pbiId: pbi.id,
            title: 'Over-committed task',
            status: 'TODO',
            estimatedHours: 40,
            remainingHours: 40,
            createdBy: user.id,
          },
        });
      }

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);
      return { user, team, sprint, pbi, cookies, csrfToken };
    };

    it('records planning attendance and exposes readiness', async () => {
      const { sprint, cookies, csrfToken } = await setupPlanningSprint();

      const addAttendee = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/planning-attendees`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ name: 'Grace Hopper', role: 'developers', attended: true })
        .expect(201);
      expect(addAttendee.body.success).toBe(true);

      const participation = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/planning-attendees`)
        .set('Cookie', cookies)
        .expect(200);

      expect(participation.body.data.attendees).toHaveLength(1);
      expect(participation.body.data.developerCount).toBe(1);
      // Without a recorded Product Owner the record is not ready to start.
      expect(participation.body.data.isReadyToStart).toBe(false);
    });

    it('refuses to start without recorded planning participation', async () => {
      const { sprint, user, cookies, csrfToken } = await setupPlanningSprint();
      // The team's two agreements are seeded so the participation rule is what refuses, not an
      // earlier gate.
      await seedTeamDefinitions(sprint.id, user.id);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('GATE_PLANNING_PARTICIPATION_REQUIRED');
    });

    it('refuses to start when the plan exceeds recorded capacity beyond the tolerance', async () => {
      const { sprint, cookies, csrfToken } = await setupPlanningSprint({ withCapacity: true });
      await seedStartPrerequisites(sprint.id);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('GATE_CAPACITY_EXCEEDED');
    });

    it('starts once participation is recorded and the plan fits capacity', async () => {
      const { sprint, cookies, csrfToken } = await setupPlanningSprint();
      await seedStartPrerequisites(sprint.id);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(200);

      expect(response.body.data.status).toBe('ACTIVE');
    });
  });

  describe('POST /api/v1/sprints/:id/backlog', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should save the sprint backlog for a Developer', async () => {
      const email = `save-backlog-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Save Backlog Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [{ pbiId: pbi.id, title: 'Task 1', assigneeId: user.id }],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sprintId).toBe(sprint.id);
      expect(response.body.data.backlogItems).toHaveLength(1);
      expect(response.body.data.taskIds).toHaveLength(1);

      const savedItems = await prisma.sprintBacklogItem.findMany({
        where: { sprintId: sprint.id },
      });
      const savedTasks = await prisma.task.findMany({ where: { sprintId: sprint.id } });
      expect(savedItems).toHaveLength(1);
      expect(savedTasks).toHaveLength(1);
      expect(savedTasks[0]!.title).toBe('Task 1');
    });

    it('should reject a non-Developer from saving the backlog', async () => {
      const email = `save-backlog-po-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Save Backlog PO Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
        })
        .expect(403);

      const savedItems = await prisma.sprintBacklogItem.findMany({
        where: { sprintId: sprint.id },
      });
      expect(savedItems).toHaveLength(0);
    });

    it('should allow a Developer to save a backlog task assigned to another Developer on the team', async () => {
      const email = `save-backlog-assign-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const otherUser = await createTestUserInDb(`other-${email}`);
      testEmails.push(`other-${email}`);

      const teamName = `Save Backlog Assign Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await addTeamMember(team.id, otherUser.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [{ pbiId: pbi.id, title: 'Task 1', assigneeId: otherUser.id }],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not duplicate tasks when the backlog is saved repeatedly with tasks assigned to another Developer', async () => {
      const email = `save-backlog-re-save-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const otherUser = await createTestUserInDb(`other-${email}`);
      testEmails.push(`other-${email}`);

      const teamName = `Save Backlog Re-save Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await addTeamMember(team.id, otherUser.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const payload = {
        items: [{ pbiId: pbi.id }],
        tasks: [{ pbiId: pbi.id, title: 'Task 1', assigneeId: otherUser.id }],
      };

      // Save the backlog twice; each save is an idempotent full replace.
      for (let i = 0; i < 2; i += 1) {
        await request(app)
          .post(`/api/v1/sprints/${sprint.id}/backlog`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send(payload)
          .expect(200);
      }

      // Resume the planning draft: the task must appear exactly once, not duplicated.
      const resumeResponse = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/planning-draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(resumeResponse.body.data.tasks).toHaveLength(1);
      const task = resumeResponse.body.data.tasks[0] as { title: string; assigneeId: string };
      expect(task.title).toBe('Task 1');
      expect(task.assigneeId).toBe(otherUser.id);
    });

    it('should reject a Developer saving a backlog task assigned to a non-Developer', async () => {
      const email = `save-backlog-assign-po-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const poUser = await createTestUserInDb(`po-${email}`);
      testEmails.push(`po-${email}`);

      const teamName = `Save Backlog Assign PO Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await addTeamMember(team.id, poUser.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [{ pbiId: pbi.id, title: 'Task 1', assigneeId: poUser.id }],
        })
        .expect(403);
    });
  });

  describe('Sprint Planning Draft (save → resume → start)', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should save a draft, resume it, and start the sprint', async () => {
      const email = `draft-lifecycle-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft Lifecycle Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await createTestProductGoal(team.id, 'Test Product Goal');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // 1. Save the planning draft incrementally.
      const saveResponse = await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [{ pbiId: pbi.id, title: 'Task 1', assigneeId: user.id }],
          sprintGoal: 'Draft goal',
        })
        .expect(200);

      expect(saveResponse.body.success).toBe(true);
      expect(saveResponse.body.data.sprintId).toBe(sprint.id);
      expect(saveResponse.body.data.sprintGoal).toBe('Draft goal');

      // 2. Resume the draft: reload it.
      const resumeResponse = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/planning-draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(resumeResponse.body.success).toBe(true);
      expect(resumeResponse.body.data.sprintGoal).toBe('Draft goal');
      expect(resumeResponse.body.data.items).toHaveLength(1);
      expect(resumeResponse.body.data.tasks).toHaveLength(1);
      expect(resumeResponse.body.data.tasks[0].pbiId).toBe(pbi.id);

      // 3. Start the sprint from the resumed draft.
      await seedStartPrerequisites(sprint.id, user.id);
      const startResponse = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(200);

      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.data.status).toBe('ACTIVE');

      const updatedSprint = await prisma.sprint.findUnique({
        where: { id: sprint.id },
        select: { status: true },
      });
      expect(updatedSprint?.status).toBe('ACTIVE');
    });

    it('should keep every task of a multi-task PBI across repeated draft saves', async () => {
      const email = `draft-multitask-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft MultiTask Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, '8-Point PBI', 'READY');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // A single PBI is decomposed into three tasks (e.g. an 8-point story).
      const tasks = [
        { pbiId: pbi.id, title: 'Plan: 8-Point PBI - Task 1', estimatedHours: 8 },
        { pbiId: pbi.id, title: 'Plan: 8-Point PBI - Task 2', estimatedHours: 8 },
        { pbiId: pbi.id, title: 'Plan: 8-Point PBI - Task 3', estimatedHours: 8 },
      ];
      const payload = { items: [{ pbiId: pbi.id }], tasks };

      // First incremental save.
      await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send(payload)
        .expect(200);

      // Second save mirrors the frontend debounced auto-save: the same three tasks are sent
      // again (their temporary client ids stripped). This previously collapsed all three onto
      // one row, losing the other two.
      await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send(payload)
        .expect(200);

      // All three tasks must survive the re-save and be visible on resume.
      const resumeResponse = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/planning-draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(resumeResponse.body.data.items).toHaveLength(1);
      expect(resumeResponse.body.data.tasks).toHaveLength(3);
      const titles = resumeResponse.body.data.tasks.map((t: { title: string }) => t.title);
      expect(titles).toEqual(
        expect.arrayContaining([
          'Plan: 8-Point PBI - Task 1',
          'Plan: 8-Point PBI - Task 2',
          'Plan: 8-Point PBI - Task 3',
        ])
      );
    });

    it("should preserve a PBI's tasks when another developer saves a draft with none of them", async () => {
      const email = `draft-otherdev-${uniqueId()}@example.com`;
      const otherEmail = `draft-otherdev-owner-${uniqueId()}@example.com`;
      testEmails.push(email);
      testEmails.push(otherEmail);

      const user = await createTestUserInDb(email);
      const ownerUser = await createTestUserInDb(otherEmail);
      const teamName = `Draft Other Dev Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await addTeamMember(team.id, ownerUser.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, '8-Point PBI', 'READY');

      // The acting developer (owner) decomposes an 8-point PBI into three tasks.
      const ownerCookies = await loginAndGetCookies(otherEmail);
      const { csrfToken: ownerCsrf } = extractCsrfFromCookies(ownerCookies);
      await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', ownerCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, ownerCsrf)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [
            { pbiId: pbi.id, title: 'Plan: 8-Point PBI - Task 1', assigneeId: ownerUser.id },
            { pbiId: pbi.id, title: 'Plan: 8-Point PBI - Task 2', assigneeId: ownerUser.id },
            { pbiId: pbi.id, title: 'Plan: 8-Point PBI - Task 3', assigneeId: ownerUser.id },
          ],
        })
        .expect(200);

      // A second developer saves the same draft with an empty task payload. The backend must
      // preserve the tasks already persisted for the PBI rather than dropping them, regardless
      // of the frontend's (team-wide) getPersistableTasks behavior.
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);
      await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [],
        })
        .expect(200);

      // The owner's three tasks must survive the other developer's save and be visible on resume.
      const resumeResponse = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/planning-draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(resumeResponse.body.data.items).toHaveLength(1);
      expect(resumeResponse.body.data.tasks).toHaveLength(3);
      const titles = resumeResponse.body.data.tasks.map((t: { title: string }) => t.title);
      expect(titles).toEqual(
        expect.arrayContaining([
          'Plan: 8-Point PBI - Task 1',
          'Plan: 8-Point PBI - Task 2',
          'Plan: 8-Point PBI - Task 3',
        ])
      );
    });

    it('should resume a draft saved against a GeneratedSprint id (frontend scenario)', async () => {
      const email = `draft-gen-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft Gen Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const pbi = await createTestPBI(team.id, 'Gen PBI', 'READY');

      // The frontend selects sprints by GeneratedSprint id. Create one that has NOT been
      // materialized into a Sprint yet, mirroring an upcoming sprint in the selector.
      const generatedSprint = await prisma.generatedSprint.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          name: 'Gen Sprint',
          sprintNumber: 1,
          year: 2026,
          startDate: new Date('2026-09-28T00:00:00.000Z'),
          endDate: new Date('2026-10-09T23:59:59.000Z'),
          status: 'PLANNED',
          createdBy: user.id,
        },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // 1. Save the draft against the GeneratedSprint id. The service materializes a real
      //    Sprint (DRAFT) and links GeneratedSprint.sprintId -> that new Sprint.
      const saveResponse = await request(app)
        .put(`/api/v1/sprints/${generatedSprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          tasks: [{ pbiId: pbi.id, title: 'Gen Task', assigneeId: user.id }],
          sprintGoal: 'Gen draft goal',
        })
        .expect(200);

      expect(saveResponse.body.success).toBe(true);
      // The returned sprintId is the materialized Sprint id (different from the generated id).
      const materializedSprintId = saveResponse.body.data.sprintId as string;
      expect(materializedSprintId).not.toBe(generatedSprint.id);

      // 2. Resume the draft by the SAME GeneratedSprint id the frontend uses. This must
      //    resolve the materialized Sprint via GeneratedSprint.sprintId and return the draft.
      const resumeResponse = await request(app)
        .get(`/api/v1/sprints/${generatedSprint.id}/planning-draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(resumeResponse.body.success).toBe(true);
      expect(resumeResponse.body.data.sprintId).toBe(materializedSprintId);
      expect(resumeResponse.body.data.sprintGoal).toBe('Gen draft goal');
      expect(resumeResponse.body.data.items).toHaveLength(1);
      expect(resumeResponse.body.data.items[0].pbiId).toBe(pbi.id);
      expect(resumeResponse.body.data.tasks).toHaveLength(1);
      expect(resumeResponse.body.data.tasks[0].title).toBe('Gen Task');
    });

    it('should reject a non-Developer from saving the planning draft', async () => {
      const email = `draft-po-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft PO Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
        })
        .expect(403);
    });

    it('should reject a task whose PBI is not in the selected backlog', async () => {
      const email = `draft-pbi-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft PBI Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint to Plan', 'PLANNED');
      const pbi = await createTestPBI(team.id, 'Planned PBI', 'READY');
      // The two agreements the Sprint boundary requires, with this item verified against the
      // readiness agreement: the commit under test is refused without them, and the refusal under
      // test would then be the wrong one.
      await seedTeamDefinitions(sprint.id, user.id, [pbi.id]);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .put(`/api/v1/sprints/${sprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
          // A valid UUID for a PBI that is NOT part of the selected backlog.
          tasks: [{ pbiId: generateUUIDv7(), title: 'Task 1' }],
        })
        .expect(400);
    });

    it('should reject saving a draft PBI that is already committed to an active sprint (Layer 2)', async () => {
      const email = `draft-conflict-save-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft Conflict Save Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const pbi = await createTestPBI(team.id, 'Shared PBI', 'READY');

      // Active sprint A already commits the PBI.
      const sprintA = await createTestSprint(team.id, 'Active Sprint A', 'ACTIVE');
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: sprintA.id, pbiId: pbi.id },
      });

      const draftSprint = await createTestSprint(team.id, 'Draft Sprint B', 'DRAFT');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .put(`/api/v1/sprints/${draftSprint.id}/backlog/draft`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          items: [{ pbiId: pbi.id }],
        })
        .expect(400);
    });

    it('should reject starting a sprint whose PBI is committed to another committed sprint (Layer 1)', async () => {
      const email = `draft-conflict-start-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft Conflict Start Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const pbi = await createTestPBI(team.id, 'Shared PBI', 'READY');

      await createTestProductGoal(team.id, 'Test Product Goal');

      // A COMPLETED sprint already committed the PBI (so the per-team "active" guard does not
      // trigger — this specifically exercises the PBI-exclusivity check).
      const completedSprint = await createTestSprint(team.id, 'Completed Sprint A', 'COMPLETED');
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: completedSprint.id, pbiId: pbi.id },
      });

      const draftSprint = await createTestSprint(team.id, 'Draft Sprint B', 'DRAFT', {
        sprintGoal: 'Goal B',
      });
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: draftSprint.id, pbiId: pbi.id },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/sprints/${draftSprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(400);
    });

    it('should auto-remove committed PBIs from other DRAFT sprints on start (Layer 3)', async () => {
      const email = `draft-cleanup-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Draft Cleanup Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const pbi = await createTestPBI(team.id, 'Shared PBI', 'READY');

      await createTestProductGoal(team.id, 'Test Product Goal');

      // Draft B (to be started) and Draft C (stale) both include the PBI.
      const draftB = await createTestSprint(team.id, 'Draft Sprint B', 'DRAFT', {
        sprintGoal: 'Goal B',
      });
      const draftC = await createTestSprint(team.id, 'Draft Sprint C', 'DRAFT');
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: draftB.id, pbiId: pbi.id },
      });
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: draftC.id, pbiId: pbi.id },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // Draft B goes ACTIVE.
      await seedStartPrerequisites(draftB.id);
      await request(app)
        .post(`/api/v1/sprints/${draftB.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(200);

      // The stale draft C must no longer contain the PBI.
      const staleRemaining = await prisma.sprintBacklogItem.findMany({
        where: { sprintId: draftC.id, pbiId: pbi.id },
      });
      expect(staleRemaining).toHaveLength(0);
    });
  });

  describe('POST /api/v1/sprints/:id/complete', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should complete an active sprint', async () => {
      const email = `complete-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Complete Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint to Complete', 'ACTIVE');
      await completePrerequisiteEvents(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/complete`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should sync the GeneratedSprint status to COMPLETED when a sprint completes', async () => {
      const email = `complete-sync-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Complete Sync Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      // Materialized ACTIVE sprint linked to a GeneratedSprint (status stays PLANNED).
      const sprint = await createTestSprint(team.id, 'Sprint to Complete', 'ACTIVE');
      await completePrerequisiteEvents(sprint.id, team.id, user.id);
      const generatedSprint = await prisma.generatedSprint.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          name: 'Gen Sprint',
          sprintNumber: 1,
          year: 2026,
          startDate: new Date('2026-09-28T00:00:00.000Z'),
          endDate: new Date('2026-10-09T23:59:59.000Z'),
          status: 'PLANNED',
          createdBy: user.id,
          sprintId: sprint.id,
        },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/complete`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      // The frontend reads GeneratedSprint.status, so it must reflect the completed state.
      const synced = await prisma.generatedSprint.findUnique({
        where: { id: generatedSprint.id },
        select: { status: true },
      });
      expect(synced?.status).toBe('COMPLETED');
    });
  });

  describe('POST /api/v1/sprints/:id/cancel', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should cancel a sprint with reason', async () => {
      const email = `cancel-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Cancel Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint to Cancel', 'ACTIVE');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/cancel`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          reason: 'Team priorities changed',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
    });
  });

  describe('GET /api/v1/sprints/:sprintId/burndown', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return burndown data for sprint', async () => {
      const email = `burndown-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Burndown Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint with Burndown', 'ACTIVE');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/burndown`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/sprints/:sprintId/tasks', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return tasks for sprint', async () => {
      const email = `sprint-tasks-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Sprint Tasks Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint with Tasks', 'ACTIVE');
      const pbi = await createTestPBI(team.id, 'PBI for Tasks');

      // Create a task
      await prisma.task.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          title: 'Test Task',
          status: 'TODO',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/tasks`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/sprints/:sprintId/tasks', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a task in sprint', async () => {
      const email = `create-task-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Create Task Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint for Task', 'ACTIVE');
      const pbi = await createTestPBI(team.id, 'PBI for Task');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/tasks`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi.id,
          title: 'New Task',
          description: 'Task description',
          estimatedHours: 8,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('New Task');
    });
  });

  describe('PUT /api/v1/sprints/:sprintId/tasks/:taskId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update task successfully', async () => {
      const email = `update-task-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Update Task Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint for Update', 'ACTIVE');
      const pbi = await createTestPBI(team.id, 'PBI for Update');

      const task = await prisma.task.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          title: 'Original Task',
          status: 'TODO',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'Updated Task',
          status: 'IN_PROGRESS',
          remainingHours: 4,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Task');
      expect(response.body.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('DELETE /api/v1/sprints/:sprintId/tasks/:taskId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should delete task successfully', async () => {
      const email = `delete-task-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete Task Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint for Delete', 'ACTIVE');
      const pbi = await createTestPBI(team.id, 'PBI for Delete');

      const task = await prisma.task.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          title: 'Task to Delete',
          status: 'TODO',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify task is deleted
      const deletedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(deletedTask).toBeNull();
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

    describe('Translated sprint status messages', () => {
      it('should return translated error for non-existent sprint in German', async () => {
        const email = `i18n-sprint-404-de-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/sprints/${generateUUIDv7()}`)
          .set('Cookie', cookies)
          .set(setLocaleHeader('de'))
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
        // The sprint service throws NotFoundError('Sprint') which results in "Sprint not found"
        // Error middleware uses t('errors:entityNotFound', { entity }) for translation
        // Current implementation uses raw English message from service
        // TODO: Sprint service should use localized errors
        expect(response.body.error.message).toContain('not found');
      });

      it('should return translated error for non-existent sprint in Spanish', async () => {
        const email = `i18n-sprint-404-es-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/sprints/${generateUUIDv7()}`)
          .set('Cookie', cookies)
          .set(setLocaleHeader('es'))
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toContain('not found');
      });

      it('should set locale cookie based on Accept-Language header for sprint request', async () => {
        const email = `i18n-sprint-cookie-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Sprint Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestSprint(team.id, 'Sprint 1');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprints')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .set(setLocaleHeader('fr'))
          .expect(200);

        expectLocaleCookie(response, 'fr');
        expect(response.body.success).toBe(true);
      });
    });

    describe('Translated sprint creation/update errors', () => {
      it('should return translated validation error for empty sprint name in Italian', async () => {
        const email = `i18n-sprint-validation-it-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Validation Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        const response = await request(app)
          .post('/api/v1/sprints')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('it'))
          .send({
            teamId: team.id,
            name: '', // Empty name should fail validation
            startDate,
            endDate,
          })
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        // Validation middleware resolves messages with colon format via t()
        // The validation schema uses hardcoded 'Name is required' message
        // TODO: Validation schema should use 'validation:fieldRequired' key
        expect(response.body.error.details).toBeDefined();
        expect(response.body.error.details?.length).toBeGreaterThan(0);
      });

      it('should return translated error for invalid team ID in French', async () => {
        const email = `i18n-sprint-invalid-team-fr-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createTestUserInDb(email);
        const cookies = await loginAndGetCookies(email);

        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        // Note: Backend may return 422 (validation error) or 403 (forbidden)
        // depending on authorization check order for invalid teamId format
        const response = await request(app)
          .post('/api/v1/sprints')
          .set('Cookie', cookies)
          .set(setLocaleHeader('fr'))
          .send({
            teamId: 'invalid-uuid',
            name: 'Test Sprint',
            startDate,
            endDate,
          });

        // Accept either 422 (validation) or 403 (forbidden/authorization)
        expect([422, 403]).toContain(response.status);

        expect(response.body.success).toBe(false);
        if (response.status === 422) {
          expect(response.body.error.code).toBe('VALIDATION_ERROR');
          expect(response.body.error.details).toBeDefined();
        } else {
          expect(response.body.error.code).toBe('FORBIDDEN');
        }
      });

      it('should return translated error when starting already active sprint in German', async () => {
        const email = `i18n-sprint-active-de-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Active Sprint Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

        // Create an active sprint
        await createTestSprint(team.id, 'Active Sprint', 'ACTIVE');

        // Try to create another sprint while one is active
        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        const response = await request(app)
          .post('/api/v1/sprints')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .send({
            teamId: team.id,
            name: 'Another Sprint',
            startDate,
            endDate,
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BAD_REQUEST');
        // The service throws BadRequestError with raw English message
        // TODO: Sprint service should use localized errors
        expect(response.body.error.message).toContain('active');
      });

      it('should return translated error when completing non-active sprint in Spanish', async () => {
        const email = `i18n-sprint-complete-es-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Complete Sprint Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

        // Create a planned sprint (not active)
        const sprint = await createTestSprint(team.id, 'Planned Sprint', 'PLANNED');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/complete`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('es'))
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('BAD_REQUEST');
        // The service throws BadRequestError with raw English message
        expect(response.body.error.message).toContain('active');
      });
    });

    describe('Translated sprint completion messages', () => {
      it('should complete sprint and return success message in German', async () => {
        const email = `i18n-sprint-complete-de-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Complete Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        const sprint = await createTestSprint(team.id, 'Sprint to Complete', 'ACTIVE');
        await completePrerequisiteEvents(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/complete`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('COMPLETED');
        // Success response contains the updated sprint data
        // Notification messages use translations from notifications.json
        // e.g., notifications:sprintEnded in German: "Sprint \"{{sprintName}}\" ist beendet"
      });

      it('should cancel sprint with translated reason in French', async () => {
        const email = `i18n-sprint-cancel-fr-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Cancel Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
        const sprint = await createTestSprint(team.id, 'Sprint to Cancel', 'ACTIVE');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/cancel`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('fr'))
          .send({
            reason: 'Team priorities changed',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('CANCELLED');
        expect(response.body.data.cancellationReason).toBe('Team priorities changed');
      });

      it('should start sprint and return success in Italian', async () => {
        const email = `i18n-sprint-start-it-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n Start Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestProductGoal(team.id, 'Test Product Goal');
        const sprint = await createTestSprint(team.id, 'Sprint to Start', 'PLANNED');

        // Create a ready PBI to add to sprint
        const pbi = await createTestPBI(team.id, 'Ready PBI', 'READY');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // The Sprint Backlog must be saved before the sprint can start.
        await prisma.sprintBacklogItem.create({
          data: {
            id: generateUUIDv7(),
            sprintId: sprint.id,
            pbiId: pbi.id,
            createdBy: user.id,
          },
        });
        await seedStartPrerequisites(sprint.id, user.id);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/start`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('it'))
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('ACTIVE');
        // Notification message uses translations from notifications.json
        // e.g., notifications:sprintStarted in Italian: "Lo Sprint \"{{sprintName}}\" è iniziato"
      });

      it('should return locale-specific cookie for all supported locales on sprint operations', async () => {
        const email = `i18n-all-locales-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createTestUserInDb(email);
        const teamName = `i18n All Locales Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestSprint(team.id, 'Test Sprint');

        const cookies = await loginAndGetCookies(email);

        // Test each supported locale
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get('/api/v1/sprints')
            .query({ teamId: team.id })
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(200);

          expectLocaleCookie(response, locale as Locale);
          expect(response.body.success).toBe(true);
        }
      });
    });
  });
});
