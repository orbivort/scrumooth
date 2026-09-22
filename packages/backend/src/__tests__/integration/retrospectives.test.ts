// Integration Tests for Retrospectives Endpoints
// Tests retrospective CRUD operations and action item management

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';
import {
  createI18nTestUser,
  getTranslatedMessage,
  expectAllLocalesHaveTranslation,
} from '../helpers/i18n-helpers';
import type { Locale } from '@scrumooth/shared';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Retrospectives Integration Tests', () => {
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
    status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'COMPLETED'
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
      },
    });
    return sprint;
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
          await prisma.retroItemVote.deleteMany({
            where: { retrospectiveItem: { retrospective: { teamId: team.id } } },
          });
          await prisma.retrospectiveItem.deleteMany({
            where: { retrospective: { teamId: team.id } },
          });
          await prisma.retroActionItem.deleteMany({
            where: { retrospective: { teamId: team.id } },
          });
          await prisma.retroAttendee.deleteMany({
            where: { retrospective: { teamId: team.id } },
          });
          await prisma.sprintRetrospective.deleteMany({
            where: { teamId: team.id },
          });
          await prisma.impediment.deleteMany({ where: { teamId: team.id } });
          await prisma.sprintBacklogChange.deleteMany({
            where: { sprint: { teamId: team.id } },
          });
          await prisma.task.deleteMany({
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

  describe('GET /api/v1/retrospectives/team/:teamId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return retrospectives for a team', async () => {
      const email = `retro-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint1 = await createTestSprint(team.id, 'Sprint 1');
      const sprint2 = await createTestSprint(team.id, 'Sprint 2');

      await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint1.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint2.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/team/${team.id}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/retrospectives/team/${generateUUIDv7()}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/retrospectives', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a new retrospective', async () => {
      const email = `retro-create-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Create Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
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

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
    });

    it('should return 422 with invalid data', async () => {
      const email = `retro-invalid-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/retrospectives')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/retrospectives/:retroId/items', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should add an item to retrospective', async () => {
      const email = `retro-item-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Item Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          category: 'WENT_WELL',
          content: 'We completed all sprint goals',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe('We completed all sprint goals');
      expect(response.body.data.category).toBe('WENT_WELL');
    });

    it('should return 401 when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .post(`/api/v1/retrospectives/${generateUUIDv7()}/items`)
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ category: 'WENT_WELL', content: 'Test' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/retrospectives/:retroId/items/:itemId/vote', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should vote for a retro item', async () => {
      const email = `retro-vote-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Vote Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const item = await prisma.retrospectiveItem.create({
        data: {
          id: generateUUIDv7(),
          retrospectiveId: retro.id,
          category: 'WENT_WELL',
          content: 'Voting item',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should remove vote from a retro item', async () => {
      const email = `retro-unvote-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Unvote Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const item = await prisma.retrospectiveItem.create({
        data: {
          id: generateUUIDv7(),
          retrospectiveId: retro.id,
          category: 'IMPROVEMENT',
          content: 'Unvoting item',
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken);

      const response = await request(app)
        .delete(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/retrospectives/:retroId/action-items', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should add an action item to retrospective', async () => {
      const email = `retro-action-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Action Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/action-items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'Improve CI/CD pipeline',
          description: 'We need to fix our build times',
          ownerId: user.id,
          status: 'PENDING',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
    });
  });

  describe('PUT /api/v1/retrospectives/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update retrospective', async () => {
      const email = `retro-update-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Update Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      // "The Sprint Review is the second-to-last event of the Sprint and the Sprint Retrospective
      // concludes the Sprint": the Review must be completed before the Retrospective can be.
      const increment = await prisma.increment.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          name: 'Review Increment',
          status: 'DELIVERED',
          integrationVerified: true,
          totalStoryPoints: 0,
        },
      });

      await prisma.sprintReview.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date(),
          status: 'completed',
          createdBy: user.id,
          updatedBy: user.id,
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          summary: 'Updated retrospective summary',
          status: 'COMPLETED',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should refuse to complete the Retrospective while its Sprint Review is still open', async () => {
      const email = `retro-update-gate-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Gate Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ status: 'COMPLETED' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_SPRINT_RETROSPECTIVE_REQUIRES_REVIEW');

      const unchanged = await prisma.sprintRetrospective.findUnique({ where: { id: retro.id } });
      expect(unchanged?.status).not.toBe('COMPLETED');
    });

    it('should refuse a caller who is not a member of the team that owns the Retrospective', async () => {
      const ownerEmail = `retro-owner-${uniqueId()}@example.com`;
      const outsiderEmail = `retro-outsider-${uniqueId()}@example.com`;
      testEmails.push(ownerEmail, outsiderEmail);

      const owner = await createTestUserInDb(ownerEmail);
      await createTestUserInDb(outsiderEmail);
      const teamName = `Retro Access Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, owner.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: owner.id,
          retroDate: new Date(),
          smNotes: 'Coaching observation about the facilitator',
        },
      });

      const cookies = await loginAndGetCookies(outsiderEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const readResponse = await request(app)
        .get(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .expect(403);

      expect(readResponse.body.error.code).toBe('GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY');

      const writeResponse = await request(app)
        .put(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ summary: 'An outsider rewriting a team’s retrospective' })
        .expect(403);

      expect(writeResponse.body.error.code).toBe('GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY');
    });

    it('should withhold the Scrum Master notes from a member who is not the Scrum Master', async () => {
      const developerEmail = `retro-dev-${uniqueId()}@example.com`;
      const smEmail = `retro-sm-${uniqueId()}@example.com`;
      testEmails.push(developerEmail, smEmail);

      const developer = await createTestUserInDb(developerEmail);
      const scrumMaster = await createTestUserInDb(smEmail);
      const teamName = `Retro Notes Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, developer.id, 'DEVELOPERS');
      await addTeamMember(team.id, scrumMaster.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: scrumMaster.id,
          retroDate: new Date(),
          smNotes: 'Coaching observation about the facilitator',
        },
      });

      const developerCookies = await loginAndGetCookies(developerEmail);
      const developerView = await request(app)
        .get(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', developerCookies)
        .expect(200);

      expect(developerView.body.data.smNotes).toBeUndefined();

      const smCookies = await loginAndGetCookies(smEmail);
      const scrumMasterView = await request(app)
        .get(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', smCookies)
        .expect(200);

      expect(scrumMasterView.body.data.smNotes).toBe('Coaching observation about the facilitator');
    });
  });

  describe('PATCH /api/v1/retrospectives/:id/sm-notes', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    const setupRetrospective = async (
      email: string,
      role: 'SCRUM_MASTER' | 'DEVELOPERS'
    ): Promise<{ retrospectiveId: string; cookies: string[]; csrfToken: string }> => {
      testEmails.push(email);
      const user = await createTestUserInDb(email);
      const teamName = `Retro Notes Write Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, role);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      return { retrospectiveId: retro.id, cookies, csrfToken };
    };

    it('should refuse the notes from anyone but the team’s Scrum Master', async () => {
      const setup = await setupRetrospective(
        `retro-notes-dev-${uniqueId()}@example.com`,
        'DEVELOPERS'
      );

      const response = await request(app)
        .patch(`/api/v1/retrospectives/${setup.retrospectiveId}/sm-notes`)
        .set('Cookie', setup.cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, setup.csrfToken)
        .send({ smNotes: 'A developer writing the Scrum Master’s notes' })
        .expect(403);

      expect(response.body.error.code).toBe('GATE_RETROSPECTIVE_SM_NOTES_SM_ONLY');
    });

    it('should let the team’s Scrum Master write the notes', async () => {
      const setup = await setupRetrospective(
        `retro-notes-sm-${uniqueId()}@example.com`,
        'SCRUM_MASTER'
      );

      const response = await request(app)
        .patch(`/api/v1/retrospectives/${setup.retrospectiveId}/sm-notes`)
        .set('Cookie', setup.cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, setup.csrfToken)
        .send({ smNotes: 'Coaching observation' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.smNotes).toBe('Coaching observation');
    });
  });

  describe('POST /api/v1/retrospectives/:retroId/attendees', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should add attendee to retrospective', async () => {
      const email = `retro-attendee-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Attendee Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/attendees`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'John Doe',
          role: 'developers',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('John Doe');
    });

    it('should return 401 when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .post(`/api/v1/retrospectives/${generateUUIDv7()}/attendees`)
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ name: 'Test', role: 'DEVELOPERS' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/retrospectives/attendees/:attendeeId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should remove attendee from retrospective', async () => {
      const email = `retro-remove-attendee-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Retro Remove Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const retro = await prisma.sprintRetrospective.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          facilitatorId: user.id,
          retroDate: new Date(),
        },
      });

      const attendeeId = generateUUIDv7();
      await prisma.retroAttendee.create({
        data: {
          id: attendeeId,
          retrospectiveId: retro.id,
          name: 'Test Attendee',
          role: 'developers',
          attended: true,
        },
      });

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/retrospectives/attendees/${attendeeId}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .delete(`/api/v1/retrospectives/attendees/${generateUUIDv7()}`)
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(401);

      expect(response.body.success).toBe(false);
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

    describe('Translated retrospective category labels', () => {
      it('should have category translation keys in all supported locales', () => {
        // Verify all locales have translation keys for retrospective categories
        const categoryTranslations = {
          'retrospectives:categoryWentWell': {
            en: 'What went well',
            de: 'Was gut lief',
            es: 'Qué funcionó bien',
            fr: 'Ce qui a bien fonctionné',
            it: 'Cosa ha funzionato bene',
          },
          'retrospectives:categoryDidntGoWell': {
            en: "What didn't go well",
            de: 'Was nicht gut lief',
            es: 'Qué no funcionó bien',
            fr: "Ce qui n'a pas bien fonctionné",
            it: 'Cosa non ha funzionato bene',
          },
          'retrospectives:categoryImprovement': {
            en: 'Improvements',
            de: 'Verbesserungen',
            es: 'Mejoras',
            fr: 'Améliorations',
            it: 'Miglioramenti',
          },
        };

        for (const [key, expected] of Object.entries(categoryTranslations)) {
          const translations = expectAllLocalesHaveTranslation(key);
          expect(translations.en).toBe(expected.en);
          expect(translations.de).toBe(expected.de);
          expect(translations.es).toBe(expected.es);
          expect(translations.fr).toBe(expected.fr);
          expect(translations.it).toBe(expected.it);
        }
      });

      it('should return translated category label based on locale preference', async () => {
        const email = `i18n-category-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'de', prisma);
        const teamName = `i18n Category Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        const sprint = await createTestSprint(team.id, 'Sprint');

        const retro = await prisma.sprintRetrospective.create({
          data: {
            id: generateUUIDv7(),
            sprintId: sprint.id,
            teamId: team.id,
            facilitatorId: user.id,
            retroDate: new Date(),
          },
        });

        const item = await prisma.retrospectiveItem.create({
          data: {
            id: generateUUIDv7(),
            retrospectiveId: retro.id,
            category: 'WENT_WELL',
            content: 'Team collaboration was excellent',
          },
        });

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/retrospectives/${retro.id}`)
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toBeDefined();
        const retroItem = response.body.data.items.find((i: { id: string }) => i.id === item.id);
        expect(retroItem).toBeDefined();
        expect(retroItem.category).toBe('WENT_WELL');

        // Verify German category label translation exists
        const germanLabel = getTranslatedMessage('retrospectives:categoryWentWell', 'de');
        expect(germanLabel).toBe('Was gut lief');
      });

      it('should have different category labels for each locale', async () => {
        const testCases: { locale: Locale; expectedLabel: string }[] = [
          { locale: 'en', expectedLabel: 'What went well' },
          { locale: 'de', expectedLabel: 'Was gut lief' },
          { locale: 'es', expectedLabel: 'Qué funcionó bien' },
          { locale: 'fr', expectedLabel: 'Ce qui a bien fonctionné' },
          { locale: 'it', expectedLabel: 'Cosa ha funzionato bene' },
        ];

        for (const { locale, expectedLabel } of testCases) {
          const label = getTranslatedMessage('retrospectives:categoryWentWell', locale);
          expect(label).toBe(expectedLabel);
        }
      });
    });

    describe('Translated action item messages', () => {
      it('should have action item status translation keys in all supported locales', () => {
        const statusKeys = [
          'retrospectives:statusPending',
          'retrospectives:statusInProgress',
          'retrospectives:statusCompleted',
          'retrospectives:statusCancelled',
        ];

        for (const key of statusKeys) {
          const translations = expectAllLocalesHaveTranslation(key);
          expect(typeof translations.en).toBe('string');
          expect(typeof translations.de).toBe('string');
          expect(typeof translations.es).toBe('string');
          expect(typeof translations.fr).toBe('string');
          expect(typeof translations.it).toBe('string');
        }
      });

      it('should have action item message translation keys in all supported locales', () => {
        const messageKeysWithInterpolation = [
          'retrospectives:actionItemCreated',
          'retrospectives:actionItemUpdated',
        ];

        for (const key of messageKeysWithInterpolation) {
          const translations = expectAllLocalesHaveTranslation(key);
          // Verify interpolation placeholder exists
          expect(translations.en).toContain('{{title}}');
          expect(translations.de).toContain('{{title}}');
          expect(translations.es).toContain('{{title}}');
          expect(translations.fr).toContain('{{title}}');
          expect(translations.it).toContain('{{title}}');
        }

        // actionItemDeleted doesn't need interpolation
        const deleteTranslations = expectAllLocalesHaveTranslation(
          'retrospectives:actionItemDeleted'
        );
        expect(typeof deleteTranslations.en).toBe('string');
        expect(typeof deleteTranslations.de).toBe('string');
        expect(typeof deleteTranslations.es).toBe('string');
        expect(typeof deleteTranslations.fr).toBe('string');
        expect(typeof deleteTranslations.it).toBe('string');
      });

      it('should translate action item creation message with interpolation', async () => {
        const email = `i18n-action-msg-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'fr', prisma);
        const teamName = `i18n Action Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        const sprint = await createTestSprint(team.id, 'Sprint');

        const retro = await prisma.sprintRetrospective.create({
          data: {
            id: generateUUIDv7(),
            sprintId: sprint.id,
            teamId: team.id,
            facilitatorId: user.id,
            retroDate: new Date(),
          },
        });

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const actionItemTitle = 'Improve code review process';
        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/action-items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            title: actionItemTitle,
            description: 'We need to improve our code review practices',
            ownerId: user.id,
            status: 'PENDING',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe(actionItemTitle);

        // Verify French action item message translation with interpolation
        const frenchMessage = getTranslatedMessage('retrospectives:actionItemCreated', 'fr', {
          title: actionItemTitle,
        });
        expect(frenchMessage).toContain(actionItemTitle);
        expect(frenchMessage).toContain('créée');
      });

      it('should have error translation keys available for retrospective operations', () => {
        // Verify that error translation keys exist for all supported locales
        // Note: The retrospective controller uses hardcoded English messages,
        // but these translation keys are available for future i18n integration
        const errorKeys = [
          'retrospectives:itemCreated',
          'retrospectives:itemUpdated',
          'retrospectives:itemDeleted',
          'retrospectives:voteAdded',
          'retrospectives:voteRemoved',
          'retrospectives:attendeeAdded',
          'retrospectives:attendeeRemoved',
          'retrospectives:retrospectiveCreated',
          'retrospectives:retrospectiveUpdated',
        ];

        for (const key of errorKeys) {
          const translations = expectAllLocalesHaveTranslation(key);
          expect(typeof translations.en).toBe('string');
          expect(typeof translations.de).toBe('string');
          expect(typeof translations.es).toBe('string');
          expect(typeof translations.fr).toBe('string');
          expect(typeof translations.it).toBe('string');
        }
      });

      it('should translate action item status labels for all locales', () => {
        const statusTranslations = {
          'retrospectives:statusPending': {
            en: 'Pending',
            de: 'Ausstehend',
            es: 'Pendiente',
            fr: 'En attente',
            it: 'In sospeso',
          },
          'retrospectives:statusInProgress': {
            en: 'In progress',
            de: 'In Bearbeitung',
            es: 'En progreso',
            fr: 'En cours',
            it: 'In corso',
          },
          'retrospectives:statusCompleted': {
            en: 'Completed',
            de: 'Abgeschlossen',
            es: 'Completado',
            fr: 'Terminé',
            it: 'Completato',
          },
          'retrospectives:statusCancelled': {
            en: 'Cancelled',
            de: 'Abgebrochen',
            es: 'Cancelado',
            fr: 'Annulé',
            it: 'Annullato',
          },
        };

        for (const [key, expected] of Object.entries(statusTranslations)) {
          const translations = expectAllLocalesHaveTranslation(key);
          expect(translations.en).toBe(expected.en);
          expect(translations.de).toBe(expected.de);
          expect(translations.es).toBe(expected.es);
          expect(translations.fr).toBe(expected.fr);
          expect(translations.it).toBe(expected.it);
        }
      });
    });
  });
});
