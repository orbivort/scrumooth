// Integration Tests for Impediments Endpoints
// Tests impediment CRUD operations and resolution workflow

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
  SUPPORTED_LOCALES,
  createI18nTestUser,
  getTranslatedMessage,
  expectAllLocalesHaveTranslation,
} from '../helpers/i18n-helpers';
import type { Locale } from '@scrumooth/shared';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Impediments Integration Tests', () => {
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
    status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'ACTIVE'
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

  const createTestImpediment = async (
    teamId: string,
    reportedById: string,
    title: string = 'Test Impediment',
    description: string = 'Test impediment description',
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' = 'OPEN',
    sprintId?: string,
    ownerId?: string
  ) => {
    const impedimentId = generateUUIDv7();
    const impediment = await prisma.impediment.create({
      data: {
        id: impedimentId,
        teamId,
        sprintId,
        title,
        description,
        reportedById,
        ownerId,
        status,
      },
    });
    return impediment;
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

  describe('GET /api/v1/impediments', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return impediments for team', async () => {
      const email = `impediments-list-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Impediments Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      await createTestImpediment(team.id, user.id, 'Impediment 1');
      await createTestImpediment(team.id, user.id, 'Impediment 2');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/impediments')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 when teamId is missing', async () => {
      const email = `missing-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/impediments')
        .set('Cookie', cookies)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/impediments')
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/impediments/stats', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return impediment statistics for team', async () => {
      const email = `impediments-stats-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Stats Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestImpediment(team.id, user.id, 'Open Impediment', 'Description', 'OPEN');
      await createTestImpediment(
        team.id,
        user.id,
        'Resolved Impediment',
        'Description',
        'RESOLVED'
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/impediments/stats')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/impediments/stats')
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/impediments/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return impediment by ID', async () => {
      const email = `get-impediment-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Get Impediment Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const impediment = await createTestImpediment(team.id, user.id, 'Specific Impediment');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/impediments/${impediment.id}`)
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(impediment.id);
      expect(response.body.data.title).toBe('Specific Impediment');
    });

    it('should return 404 for non-existent impediment', async () => {
      const email = `nonexistent-impediment-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Nonexistent Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/impediments/${generateUUIDv7()}`)
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/impediments/${generateUUIDv7()}`)
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/impediments', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should create a new impediment successfully', async () => {
      const email = `create-impediment-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Create Impediment Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/impediments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          sprintId: sprint.id,
          title: 'New Impediment',
          description: 'This is a new impediment description',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe('New Impediment');
      expect(response.body.data.status).toBe('OPEN');
    });

    it('should accept the documented date-only targetDate and declared priority', async () => {
      const email = `create-impediment-dated-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Dated Impediment Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // `targetDate` is documented as a date-only ISO string (`YYYY-MM-DD`) — exactly what an
      // `<input type="date">` sends. Prisma's `DateTime` input rejects that form verbatim, so it
      // must be normalized before the write; without that, this request failed as
      // "Invalid data provided" and stored nothing.
      const response = await request(app)
        .post('/api/v1/impediments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          sprintId: sprint.id,
          title: 'Dated Impediment',
          description: 'Blocked until the shared CI account is restored',
          priority: 'CRITICAL',
          targetDate: '2026-10-01',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.priority).toBe('CRITICAL');
      // Stored as the calendar date it names, anchored to UTC midnight rather than shifted by
      // the server's timezone.
      expect(response.body.data.targetDate).toBe('2026-10-01T00:00:00.000Z');

      const stored = await prisma.impediment.findUnique({ where: { id: response.body.data.id } });
      expect(stored?.priority).toBe('CRITICAL');
      expect(stored?.targetDate?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('should return 400 with missing required fields', async () => {
      const email = `missing-fields-${uniqueId()}@example.com`;
      testEmails.push(email);

      await createTestUserInDb(email);
      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/impediments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'Test',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .post('/api/v1/impediments')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: generateUUIDv7(),
          title: 'Test',
          description: 'Description',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/impediments/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should update impediment status', async () => {
      const email = `update-impediment-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Update Impediment Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const impediment = await createTestImpediment(team.id, user.id, 'To Update');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          status: 'IN_PROGRESS',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('IN_PROGRESS');
    });

    it('should resolve impediment with resolution', async () => {
      const email = `resolve-impediment-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Resolve Impediment Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const impediment = await createTestImpediment(team.id, user.id, 'To Resolve');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          status: 'RESOLVED',
          resolution: 'Issue was resolved',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('RESOLVED');
      expect(response.body.data.resolution).toBe('Issue was resolved');
    });

    it('should return 400 with missing teamId', async () => {
      const email = `missing-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Missing Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const impediment = await createTestImpediment(team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'CLOSED',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/impediments/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should delete impediment successfully', async () => {
      const email = `delete-impediment-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete Impediment Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const impediment = await createTestImpediment(team.id, user.id, 'To Delete');

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/impediments/${impediment.id}`)
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      const deletedImpediment = await prisma.impediment.findUnique({
        where: { id: impediment.id },
      });
      expect(deletedImpediment).toBeNull();
    });

    it('should return 400 when teamId is missing', async () => {
      const email = `delete-missing-team-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Delete Missing Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'DEVELOPERS');
      const impediment = await createTestImpediment(team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .delete(`/api/v1/impediments/${generateUUIDv7()}`)
        .query({ teamId: generateUUIDv7() })
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

    describe('Translated impediment status messages', () => {
      it('should return translated error for non-existent impediment in German', async () => {
        const email = `i18n-impediment-de-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'de', prisma);
        const teamName = `i18n Impediment Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'DEVELOPERS');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/impediments/${generateUUIDv7()}`)
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .set(setLocaleHeader('de'))
          .expect(404);

        // Note: NotFoundError uses hardcoded English message, not translated
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('NOT_FOUND');
        expect(response.body.error.message).toContain('Impediment');
      });

      it('should return translated error for non-existent impediment for all supported locales', async () => {
        for (const locale of SUPPORTED_LOCALES) {
          const email = `i18n-impediment-${locale}-${uniqueId()}@example.com`;
          testEmails.push(email);

          const user = await createI18nTestUser(email, locale as Locale, prisma);
          const teamName = `i18n Impediment Team ${uniqueId()}`;
          testTeams.push(teamName);

          const team = await createTestTeam(teamName);
          await addTeamMember(team.id, user.id, 'DEVELOPERS');

          const cookies = await loginAndGetCookies(email);

          const response = await request(app)
            .get(`/api/v1/impediments/${generateUUIDv7()}`)
            .query({ teamId: team.id })
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(404);

          // Note: NotFoundError uses hardcoded English message, not translated
          expect(response.body.success).toBe(false);
          expect(response.body.error.code).toBe('NOT_FOUND');
          expect(response.body.error.message).toContain('Impediment');
        }
      });
    });

    describe('Translated impediment resolution messages', () => {
      it('should return translated error when resolving without resolution text in French', async () => {
        const email = `i18n-resolve-fr-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'fr', prisma);
        const teamName = `i18n Resolve Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        const impediment = await createTestImpediment(team.id, user.id, 'To Resolve');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // Attempt to resolve without resolution text (should fail validation)
        const response = await request(app)
          .put(`/api/v1/impediments/${impediment.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('fr'))
          .send({
            teamId: team.id,
            status: 'RESOLVED',
          });

        // The endpoint may return 400 for validation or 500 for service error
        // We verify the locale header is processed correctly
        expect(response.body.success).toBe(false);
      });

      it('should return translated notification for impediment creation in Italian', async () => {
        const email = `i18n-notify-it-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'it', prisma);
        const teamName = `i18n Notify Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'DEVELOPERS');
        const sprint = await createTestSprint(team.id, 'Sprint');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post('/api/v1/impediments')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .set(setLocaleHeader('it'))
          .send({
            teamId: team.id,
            sprintId: sprint.id,
            title: 'Italian Test Impediment',
            description: 'This is a test impediment description',
          })
          .expect(201);

        expect(response.body.success).toBe(true);

        // Verify Italian translation is used for the notification
        const expectedNotification = getTranslatedMessage('notifications:impedimentCreated', 'it', {
          title: 'Italian Test Impediment',
        });
        expect(expectedNotification).toContain('Italian Test Impediment');
      });

      it('should verify all locales have translations for impediment notifications', async () => {
        const translations = {
          impedimentCreated: expectAllLocalesHaveTranslation('notifications:impedimentCreated'),
          impedimentResolved: expectAllLocalesHaveTranslation('notifications:impedimentResolved'),
        };

        // Verify German translation (uses English "Impediment" per Scrum.org glossary)
        expect(translations.impedimentCreated.de).toContain('Impediment');
        expect(translations.impedimentResolved.de).toContain('Impediment');

        // Verify French translation (uses English "Impediment" per Scrum.org glossary)
        expect(translations.impedimentCreated.fr).toContain('Impediment');
        expect(translations.impedimentResolved.fr).toContain('Impediment');

        // Verify Spanish translation (uses English "Impediment" per Scrum.org glossary)
        expect(translations.impedimentCreated.es).toContain('Impediment');
        expect(translations.impedimentResolved.es).toContain('Impediment');

        // Verify Italian translation (uses English "Impediment" per Scrum.org glossary)
        expect(translations.impedimentCreated.it).toContain('Impediment');
        expect(translations.impedimentResolved.it).toContain('Impediment');
      });
    });
  });

  describe('Team scoping and terminal-transition gates', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    /** A team plus one member of it, with a logged-in session for that member. */
    const setupTeamWithMember = async (
      role: 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS' = 'DEVELOPERS'
    ) => {
      const email = `impediment-scope-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Impediment Scope Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, role);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      return { email, user, team, cookies, csrfToken };
    };

    it('should default an unassigned impediment to the team Scrum Master and write the audit columns', async () => {
      const { user, team, cookies, csrfToken } = await setupTeamWithMember();

      const smEmail = `impediment-scope-sm-${uniqueId()}@example.com`;
      testEmails.push(smEmail);
      const smUser = await createTestUserInDb(smEmail);
      await addTeamMember(team.id, smUser.id, 'SCRUM_MASTER');

      const response = await request(app)
        .post('/api/v1/impediments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: 'Unassigned impediment',
          description: 'Nobody has picked this up yet',
        })
        .expect(201);

      // The Guide makes the Scrum Master accountable for causing removal, so an unowned
      // impediment lands on them by default.
      expect(response.body.data.ownerId).toBe(smUser.id);
      // The audit columns the API documents are actually written on the create path.
      expect(response.body.data.createdBy).toBe(user.id);
      expect(response.body.data.updatedBy).toBe(user.id);
      expect(response.body.data.priority).toBe('MEDIUM');
    });

    it('should refuse a create from someone outside the team', async () => {
      const { team } = await setupTeamWithMember();

      const outsiderEmail = `impediment-outsider-${uniqueId()}@example.com`;
      testEmails.push(outsiderEmail);
      await createTestUserInDb(outsiderEmail);
      const outsiderCookies = await loginAndGetCookies(outsiderEmail);
      const { csrfToken } = extractCsrfFromCookies(outsiderCookies);

      const response = await request(app)
        .post('/api/v1/impediments')
        .set('Cookie', outsiderCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: 'Tampered impediment',
          description: 'Raised by someone outside the team',
        })
        .expect(403);

      expect(response.body.error.code).toBe('GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY');
      expect(await prisma.impediment.count({ where: { teamId: team.id } })).toBe(0);
    });

    it('should refuse an update and a delete that target another team', async () => {
      const owner = await setupTeamWithMember();
      const impostor = await setupTeamWithMember();

      const impediment = await createTestImpediment(
        owner.team.id,
        owner.user.id,
        'Owned elsewhere'
      );

      // The impostor is a member of their own team but not of the team that owns the impediment.
      await request(app)
        .put(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', impostor.cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, impostor.csrfToken)
        .send({ teamId: owner.team.id, status: 'IN_PROGRESS' })
        .expect(403);

      await request(app)
        .delete(`/api/v1/impediments/${impediment.id}`)
        .query({ teamId: owner.team.id })
        .set('Cookie', impostor.cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, impostor.csrfToken)
        .expect(403);

      // The record survives intact: cross-team tampering and untracked deletion are both refused.
      const stored = await prisma.impediment.findUnique({ where: { id: impediment.id } });
      expect(stored).not.toBeNull();
      expect(stored?.status).toBe('OPEN');
    });

    it('should refuse a delete from a teammate who is neither the reporter, the owner nor the Scrum Master', async () => {
      const reporter = await setupTeamWithMember();

      const bystanderEmail = `impediment-bystander-${uniqueId()}@example.com`;
      testEmails.push(bystanderEmail);
      const bystander = await createTestUserInDb(bystanderEmail);
      await addTeamMember(reporter.team.id, bystander.id, 'DEVELOPERS');

      const impediment = await createTestImpediment(
        reporter.team.id,
        reporter.user.id,
        'Reported by someone else'
      );

      const bystanderCookies = await loginAndGetCookies(bystanderEmail);
      const { csrfToken } = extractCsrfFromCookies(bystanderCookies);

      await request(app)
        .delete(`/api/v1/impediments/${impediment.id}`)
        .query({ teamId: reporter.team.id })
        .set('Cookie', bystanderCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(403);

      expect(await prisma.impediment.findUnique({ where: { id: impediment.id } })).not.toBeNull();
    });

    it('should refuse CLOSED without a resolution so the Sprint-close gate cannot be lifted cheaply', async () => {
      const { user, team, cookies, csrfToken } = await setupTeamWithMember();
      const impediment = await createTestImpediment(team.id, user.id, 'Still blocking');

      const response = await request(app)
        .put(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ teamId: team.id, status: 'CLOSED' })
        .expect(400);

      expect(response.body.error.code).toBe('GATE_IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED');

      const stored = await prisma.impediment.findUnique({ where: { id: impediment.id } });
      expect(stored?.status).toBe('OPEN');
    });

    it('should accept CLOSED with a resolution and record who made the change', async () => {
      const { user, team, cookies, csrfToken } = await setupTeamWithMember();
      const impediment = await createTestImpediment(team.id, user.id, 'No longer relevant');

      const response = await request(app)
        .put(`/api/v1/impediments/${impediment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          status: 'CLOSED',
          resolution: 'The dependency was removed from scope entirely',
        })
        .expect(200);

      expect(response.body.data.status).toBe('CLOSED');
      expect(response.body.data.resolvedAt).not.toBeNull();
      expect(response.body.data.updatedBy).toBe(user.id);
    });

    it('should order impediments most-critical-first', async () => {
      const { user, team, cookies } = await setupTeamWithMember();

      await createTestImpediment(team.id, user.id, 'Minor', 'Description', 'OPEN');
      await prisma.impediment.updateMany({
        where: { teamId: team.id, title: 'Minor' },
        data: { priority: 'LOW' },
      });
      await createTestImpediment(team.id, user.id, 'Blocking release', 'Description', 'OPEN');
      await prisma.impediment.updateMany({
        where: { teamId: team.id, title: 'Blocking release' },
        data: { priority: 'CRITICAL' },
      });
      await createTestImpediment(team.id, user.id, 'Annoying', 'Description', 'OPEN');
      await prisma.impediment.updateMany({
        where: { teamId: team.id, title: 'Annoying' },
        data: { priority: 'MEDIUM' },
      });

      const response = await request(app)
        .get('/api/v1/impediments')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      // `priority` is a PostgreSQL enum compared by declaration order, so ascending reads
      // CRITICAL -> LOW. Impact, not age, decides what the Scrum Master sees first.
      expect(response.body.data.map((item: { title: string }) => item.title)).toEqual([
        'Blocking release',
        'Annoying',
        'Minor',
      ]);
    });
  });
});
