// Cross-Feature Integration Tests
// Tests interactions between different features and components

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';
import {
  setLocaleHeader,
  createI18nTestUser,
  expectLocaleCookie,
  SUPPORTED_LOCALES,
} from '../helpers/i18n-helpers';
import type { Locale } from '@scrumooth/shared';
import {
  ItemStatus,
  MoSCoWPriority,
  SprintStatus,
  NotificationType,
} from '../../generated/prisma/client';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Cross-Feature Integration Tests', () => {
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
    status: SprintStatus = SprintStatus.ACTIVE
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
        sprintGoal: 'Test sprint goal',
      },
    });
    return sprint;
  };

  const createTestPBI = async (
    teamId: string,
    title: string = 'Test PBI',
    status: ItemStatus = ItemStatus.READY,
    storyPoints: number = 5
  ) => {
    const pbiId = generateUUIDv7();
    const pbi = await prisma.productBacklogItem.create({
      data: {
        id: pbiId,
        teamId,
        title,
        status,
        storyPoints,
        priority: MoSCoWPriority.COULD_HAVE,
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
          await prisma.task.deleteMany({ where: { sprint: { teamId: team.id } } });
          await prisma.sprintBacklogChange.deleteMany({ where: { sprint: { teamId: team.id } } });
          await prisma.sprintRetrospective.deleteMany({ where: { sprint: { teamId: team.id } } });
          await prisma.increment.deleteMany({ where: { teamId: team.id } });
          await prisma.impediment.deleteMany({ where: { teamId: team.id } });
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

  describe('Sprint to Backlog Integration', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should add PBI to sprint and see it in backlog', async () => {
      const email = `add-pbi-integration-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Add PBI Integration Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');
      const pbi = await createTestPBI(team.id, 'PBI To Add');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog-items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi.id,
          reason: 'Cross-feature regression check',
          goalImpact: 'SUPPORTS_GOAL',
        })
        .expect(201);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/backlog-pbis`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Sprint to Retrospective Integration', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create retrospective after sprint completion', async () => {
      const email = `retro-after-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro After Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Completed Sprint', 'COMPLETED');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const retroResponse = await request(app)
        .post('/api/v1/retrospectives')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date().toISOString(),
        })
        .expect(201);

      expect(retroResponse.body.success).toBe(true);
      expect(retroResponse.body.data.sprintId).toBe(sprint.id);
    });

    it('should retrieve retrospective by sprint ID', async () => {
      const email = `retro-by-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro By Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint', 'COMPLETED');

      await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/sprint/${sprint.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Daily Updates to Impediment Integration', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should promote impediment from daily update', async () => {
      const email = `promote-from-daily-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Promote From Daily Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          progressNotes: 'Blocked by external dependency',
          planForNextDay: 'Plan to unblock',
          // A Daily Scrum must declare its adaptation outcome.
          noAdaptationNeeded: true,
        })
        .expect(201);

      const scrumId = created.body.data.id;

      const response = await request(app)
        .post(`/api/v1/daily-scrums/${scrumId}/promote-impediment`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'External Dependency Block',
          description: 'Blocked by external dependency - needs resolution',
          sprintId: sprint.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Sprint to Increment Integration', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create increment from completed sprint', async () => {
      const email = `increment-from-sprint-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Increment From Sprint Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Completed Sprint', 'COMPLETED');
      const pbi = await createTestPBI(team.id, 'Completed PBI', ItemStatus.DONE, 8);

      await prisma.sprintBacklogChange.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          changeType: 'ADD',
          createdBy: user.id,
          newStatus: 'DONE',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Sprint Increment',
          description: 'Increment from completed sprint',
          sprintId: sprint.id,
          teamId: team.id,
          includedPBIs: [pbi.id],
          totalStoryPoints: 8,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sprintId).toBe(sprint.id);
    });

    it('should deliver increment after sprint review', async () => {
      const email = `deliver-after-review-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Deliver After Review Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint', 'COMPLETED');

      const increment = await prisma.increment.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          name: 'Deliverable Increment',
          status: 'VERIFIED',
          totalStoryPoints: 20,
          // Delivery requires both the integration verification and the written attestation that
          // the Increment is in usable condition.
          integrationVerified: true,
          usabilityVerified: true,
          usabilityEvidence: 'Exercised in the staging environment',
          usabilityVerifiedAt: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${increment.id}/deliver`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          deliveryMethod: 'sprint_review',
          notes: 'Delivered during sprint review meeting',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('DELIVERED');
    });
  });

  describe('Team Management Cross-Feature Integration', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create team, add members, and start sprint', async () => {
      const email1 = `cross-feature-1-${uniqueId()}@example.com`;
      const email2 = `cross-feature-2-${uniqueId()}@example.com`;
      testEmails.push(email1, email2);

      const scrumMaster = await createTestUserInDb(email1, 'TestPassword123!', 'Scrum', 'Master');
      const developer = await createTestUserInDb(email2, 'TestPassword123!', 'Dev', 'eloper');

      const teamName = `Cross-Feature Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, scrumMaster.id, 'SCRUM_MASTER');
      await addTeamMember(team.id, developer.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email1);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const sprintResponse = await request(app)
        .post('/api/v1/sprints')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          name: 'Cross-Feature Sprint',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          sprintGoal: 'Demonstrate cross-feature integration',
        })
        .expect(201);

      expect(sprintResponse.body.success).toBe(true);

      const teamResponse = await request(app)
        .get(`/api/v1/teams/${team.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(teamResponse.body.success).toBe(true);
    });
  });

  describe('Notification Integration with Features', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create and manage notifications', async () => {
      const email = `notification-integration-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Notification Integration Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      await prisma.notification.create({
        data: {
          id: generateUUIDv7(),
          userId: user.id,
          type: NotificationType.DAILY_SCRUM_SIGNAL,
          title: 'Daily Scrum Signal',
          message: 'Daily Scrum team signal',
        },
      });

      await prisma.notification.create({
        data: {
          id: generateUUIDv7(),
          userId: user.id,
          type: NotificationType.TASK_ASSIGNMENT,
          title: 'Sprint Started',
          message: 'Sprint 1 has been started',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/notifications')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Data Export Integration', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should export data from multiple features', async () => {
      const email = `export-integration-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Export Integration Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      await prisma.productBacklogItem.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          title: 'Export PBI',
          status: ItemStatus.DONE,
          storyPoints: 5,
          priority: MoSCoWPriority.COULD_HAVE,
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/user/export-data')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          options: {
            includeSessions: true,
            includeNotifications: true,
            dataCategories: ['teams', 'sprints', 'backlog'],
          },
        })
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobId');
    });
  });

  describe('Workflow Cross-Feature Integration', () => {
    const testEmails: string[] = [];

    afterEach(async () => {
      await cleanupTestData(testEmails);
      testEmails.length = 0;
    });

    it('should validate workflow transitions for ProductGoal', async () => {
      const email = `workflow-integration-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email, 'TestPassword123!', 'Product', 'Owner');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const validateResponse = await request(app)
        .post('/api/v1/workflows/validate')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          entityType: 'ProductGoal',
          fromStatus: 'NEW',
          toStatus: 'ACTIVE',
        })
        .expect(200);

      expect(validateResponse.body.success).toBe(true);
      expect(validateResponse.body.data.isValid).toBe(true);
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

    describe('Cross-locale feature consistency', () => {
      it('should create sprint with consistent behavior across all locales', async () => {
        const testLocales: Locale[] = ['en', 'de', 'fr', 'it', 'es'];

        for (const locale of testLocales) {
          const email = `sprint-locale-${locale}-${uniqueId()}@example.com`;
          testEmails.push(email);

          await createI18nTestUser(email, locale, prisma);
          const cookies = await loginAndGetCookies(email);
          const { csrfToken } = extractCsrfFromCookies(cookies);

          const teamName = `Locale Team ${locale} ${uniqueId()}`;
          testTeams.push(teamName);

          const team = await createTestTeam(teamName);
          await addTeamMember(team.id, await getUserIdFromEmail(email), 'SCRUM_MASTER');

          const response = await request(app)
            .post('/api/v1/sprints')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale))
            .send({
              teamId: team.id,
              name: `Sprint ${locale}`,
              startDate: new Date().toISOString(),
              endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              sprintGoal: `Goal for locale ${locale}`,
            });

          // All locales should have consistent success response
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
          expectLocaleCookie(response, locale);
        }
      });

      it('should create PBI with consistent validation across locales', async () => {
        const email = `pbi-consistency-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createI18nTestUser(email, 'de', prisma);
        const cookies = await loginAndGetCookies(email);

        const teamName = `PBI Consistency Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        // Only Developers may set story points, so use a Developer here.
        await addTeamMember(team.id, await getUserIdFromEmail(email), 'DEVELOPERS');
        // A PBI must serve the team's ACTIVE Product Goal, so give the team one first.
        await createActiveProductGoal(team.id, await getUserIdFromEmail(email));

        // Test with each locale header - validation should be consistent
        for (const locale of SUPPORTED_LOCALES) {
          const { csrfToken } = extractCsrfFromCookies(cookies);

          const response = await request(app)
            .post('/api/v1/product-backlog')
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .set(setLocaleHeader(locale))
            .send({
              teamId: team.id,
              title: `Test PBI ${locale}`,
              description: 'Test description',
              priority: 'MUST_HAVE',
              storyPoints: 5,
            })
            .expect(201);

          expect(response.body.success).toBe(true);
          expect(response.body.data.title).toBe(`Test PBI ${locale}`);
        }
      });

      it('should handle notification creation consistently across locales', async () => {
        const email = `notification-consistency-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createI18nTestUser(email, 'fr', prisma);
        const cookies = await loginAndGetCookies(email);

        const teamName = `Notification Locale Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, await getUserIdFromEmail(email), 'SCRUM_MASTER');

        // Create notifications and verify consistent response structure
        const userId = await getUserIdFromEmail(email);

        await prisma.notification.create({
          data: {
            id: generateUUIDv7(),
            userId,
            type: NotificationType.TASK_ASSIGNMENT,
            title: 'Task Assigned',
            message: 'A new task has been assigned to you',
          },
        });

        // Verify notifications are returned consistently with locale headers
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get('/api/v1/notifications')
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale))
            .expect(200);

          expect(response.body.success).toBe(true);
          expect(response.body.data.notifications.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Locale persistence across features', () => {
      it('should maintain locale preference across sprint and backlog operations', async () => {
        const email = `locale-persistence-${uniqueId()}@example.com`;
        testEmails.push(email);

        // Create user with Italian locale
        await createI18nTestUser(email, 'it', prisma);
        const cookies = await loginAndGetCookies(email);

        const teamName = `Locale Persistence Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        // Only Developers may set story points, so use a Developer here.
        await addTeamMember(team.id, await getUserIdFromEmail(email), 'DEVELOPERS');
        // A PBI must serve the team's ACTIVE Product Goal, so give the team one first.
        await createActiveProductGoal(team.id, await getUserIdFromEmail(email));

        // Create sprint with Italian locale
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const sprintResponse = await request(app)
          .post('/api/v1/sprints')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('it'))
          .send({
            teamId: team.id,
            name: 'Italian Sprint',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            sprintGoal: 'Italian sprint goal',
          })
          .expect(201);

        expectLocaleCookie(sprintResponse, 'it');

        // Create PBI - locale cookie should persist
        const pbiResponse = await request(app)
          .post('/api/v1/product-backlog')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('it'))
          .send({
            teamId: team.id,
            title: 'Italian PBI',
            priority: 'MUST_HAVE',
            storyPoints: 5,
          })
          .expect(201);

        expectLocaleCookie(pbiResponse, 'it');

        // Get team info - locale should still be Italian
        const teamResponse = await request(app)
          .get(`/api/v1/teams/${team.id}`)
          .set('Cookie', cookies)
          .set(setLocaleHeader('it'))
          .expect(200);

        expectLocaleCookie(teamResponse, 'it');
      });

      it('should preserve locale through daily update and impediment workflow', async () => {
        const email = `workflow-locale-${uniqueId()}@example.com`;
        testEmails.push(email);

        // Create user with Spanish locale
        await createI18nTestUser(email, 'es', prisma);
        const cookies = await loginAndGetCookies(email);

        const teamName = `Workflow Locale Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, await getUserIdFromEmail(email), 'DEVELOPERS');
        const sprint = await createTestSprint(team.id, 'Spanish Sprint');

        // Create a Daily Scrum with Spanish locale
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const created = await request(app)
          .post(`/api/v1/daily-scrums/${sprint.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('es'))
          .send({
            progressNotes: 'Blocked by API issue',
            planForNextDay: 'Plan to resolve API',
            noAdaptationNeeded: true,
          })
          .expect(201);

        const scrumId = created.body.data.id;

        // Promote impediment - locale should persist
        const impedimentResponse = await request(app)
          .post(`/api/v1/daily-scrums/${scrumId}/promote-impediment`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('es'))
          .send({
            title: 'API Blocking Issue',
            description: 'API issue blocking progress',
            sprintId: sprint.id,
          })
          .expect(201);

        expectLocaleCookie(impedimentResponse, 'es');
      });

      it('should switch locale and maintain consistency in subsequent operations', async () => {
        const email = `switch-locale-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createI18nTestUser(email, 'en', prisma);
        const cookies = await loginAndGetCookies(email);

        const teamName = `Switch Locale Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        // Only Developers may set story points, so use a Developer here.
        await addTeamMember(team.id, await getUserIdFromEmail(email), 'DEVELOPERS');
        // A PBI must serve the team's ACTIVE Product Goal, so give the team one first.
        await createActiveProductGoal(team.id, await getUserIdFromEmail(email));

        // First operation with English
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const pbi1Response = await request(app)
          .post('/api/v1/product-backlog')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('en'))
          .send({
            teamId: team.id,
            title: 'English PBI',
            priority: 'MUST_HAVE',
            storyPoints: 3,
          })
          .expect(201);

        expectLocaleCookie(pbi1Response, 'en');

        // Second operation with German - locale should switch
        const pbi2Response = await request(app)
          .post('/api/v1/product-backlog')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('de'))
          .send({
            teamId: team.id,
            title: 'German PBI',
            priority: 'COULD_HAVE',
            storyPoints: 5,
          })
          .expect(201);

        expectLocaleCookie(pbi2Response, 'de');

        // Third operation with French - locale should switch again
        const pbi3Response = await request(app)
          .post('/api/v1/product-backlog')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('fr'))
          .send({
            teamId: team.id,
            title: 'French PBI',
            priority: 'SHOULD_HAVE',
            storyPoints: 8,
          })
          .expect(201);

        expectLocaleCookie(pbi3Response, 'fr');
      });
    });

    // Helper function to get user ID from email
    async function getUserIdFromEmail(email: string): Promise<string> {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        throw new Error(`User not found for email: ${email}`);
      }
      return user.id;
    }
  });
});
