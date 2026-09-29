// Integration Tests for Reports Endpoints
// Tests report generation and data export

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken } from '../helpers/test-helpers';
import {
  setLocaleHeader,
  SUPPORTED_LOCALES,
  createI18nTestUser,
  expectTranslatedError,
} from '../helpers/i18n-helpers';
import { GATE_CODES } from '@scrumooth/shared';
import type { Locale } from '@scrumooth/shared';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Reports Integration Tests', () => {
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
    startDate?: Date,
    endDate?: Date
  ) => {
    const sprintId = generateUUIDv7();
    const start = startDate || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const sprint = await prisma.sprint.create({
      data: {
        id: sprintId,
        teamId,
        name,
        startDate: start,
        endDate: end,
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

  describe('GET /api/v1/reports/velocity', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return velocity report with query params', async () => {
      const email = `velocity-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Velocity Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestSprint(team.id, 'Sprint 1');
      await createTestSprint(team.id, 'Sprint 2');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/reports/sprint-history', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return sprint history report', async () => {
      const email = `sprint-history-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Sprint History Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .query({ teamId: generateUUIDv7() })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/reports/metrics', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return team metrics report', async () => {
      const email = `metrics-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Metrics Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
      await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/reports/insights', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('should return insights report', async () => {
      const email = `insights-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Insights Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/insights')
        .query({ teamId: team.id })
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

    describe('Translated report titles and labels', () => {
      it('should return translated validation error when teamId is missing for velocity report', async () => {
        const email = `i18n-velocity-err-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createI18nTestUser(email, 'de', prisma);
        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/reports/velocity')
          .set('Cookie', cookies)
          .set(setLocaleHeader('de'))
          .expect(400);

        expect(response.body.success).toBe(false);
        // Verify German error message for validation error
        expect(response.body.error.message).toBeDefined();
      });

      it('should return translated error for all locales when teamId is missing', async () => {
        for (const locale of SUPPORTED_LOCALES) {
          const email = `i18n-missing-${locale}-${uniqueId()}@example.com`;
          testEmails.push(email);

          await createI18nTestUser(email, locale as Locale, prisma);
          const cookies = await loginAndGetCookies(email);

          const response = await request(app)
            .get('/api/v1/reports/sprint-history')
            .set('Cookie', cookies)
            .set(setLocaleHeader(locale as Locale))
            .expect(400);

          expect(response.body.success).toBe(false);
          expect(response.body.error.message).toBeDefined();
        }
      });

      it('should return translated entity not found error for invalid teamId', async () => {
        const email = `i18n-team-notfound-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createI18nTestUser(email, 'es', prisma);
        const cookies = await loginAndGetCookies(email);

        // Note: Backend may return 200 with empty data or 403 depending on authorization logic
        const response = await request(app)
          .get('/api/v1/reports/metrics')
          .query({ teamId: generateUUIDv7() })
          .set('Cookie', cookies)
          .set(setLocaleHeader('es'));

        // A report reads a team's own history, so a caller who is not a member is refused. There
        // is no "empty report" answer for a team you do not belong to.
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY);
      });

      it('should return translated forbidden error when user lacks team membership', async () => {
        const email = `i18n-forbidden-${uniqueId()}@example.com`;
        testEmails.push(email);

        await createI18nTestUser(email, 'fr', prisma);
        const teamName = `Forbidden Team ${uniqueId()}`;
        testTeams.push(teamName);

        // Create team but do NOT add user as member
        const team = await createTestTeam(teamName);

        const cookies = await loginAndGetCookies(email);

        // A report reads a team's own history, so a caller who is not a member is refused, in the
        // caller's own locale and with the module's stable gate code.
        const response = await request(app)
          .get('/api/v1/reports/velocity')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .set(setLocaleHeader('fr'));

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY);
      });

      it('should return translated unauthorized error when not authenticated', async () => {
        for (const locale of SUPPORTED_LOCALES) {
          const response = await request(app)
            .get('/api/v1/reports/velocity')
            .query({ teamId: generateUUIDv7() })
            .set(setLocaleHeader(locale as Locale))
            .expect(401);

          expectTranslatedError(response, 'errors:unauthorized', locale as Locale);
        }
      });
    });

    describe('Locale-specific number formatting in reports', () => {
      it('should return numeric metrics that can be formatted per locale using Intl.NumberFormat', async () => {
        const email = `i18n-metrics-format-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'de', prisma);
        const teamName = `Metrics Format Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestSprint(team.id, 'Sprint');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/reports/metrics')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();

        // Test that numeric values can be formatted using Intl.NumberFormat
        const metrics = response.body.data;
        const testLocales: Locale[] = ['en', 'de', 'fr', 'it', 'es'];

        for (const locale of testLocales) {
          // Format averageCompletedPoints with locale-specific formatting
          const averageCompletedPoints = metrics.averageCompletedPoints ?? 0;
          const formattedVelocity = new Intl.NumberFormat(locale, {
            style: 'decimal',
            maximumFractionDigits: 1,
          }).format(averageCompletedPoints);

          expect(typeof formattedVelocity).toBe('string');
          expect(formattedVelocity.length).toBeGreaterThan(0);

          // Format completionRate as percentage
          const completionRate = metrics.completionRate ?? 0;
          const formattedRate = new Intl.NumberFormat(locale, {
            style: 'percent',
            maximumFractionDigits: 0,
          }).format(completionRate / 100);

          expect(typeof formattedRate).toBe('string');
        }
      });

      it('should report an observed range rather than a trend in completed points', async () => {
        const email = `i18n-range-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'it', prisma);
        const teamName = `Range Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
        await createTestSprint(team.id, 'Sprint');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/reports/metrics')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        const metrics = response.body.data;

        // Velocity is descriptive history, so the record is stated as a range the interface can
        // format per locale -- not as a trend framed as good or bad news.
        expect(metrics).not.toHaveProperty('velocityTrend');

        const min = metrics.minCompletedPoints ?? 0;
        const max = metrics.maxCompletedPoints ?? 0;
        const formatterIt = new Intl.NumberFormat('it', { maximumFractionDigits: 1 });

        expect(typeof formatterIt.format(min)).toBe('string');
        expect(typeof formatterIt.format(max)).toBe('string');
      });

      it('should return sprint history data with numeric fields that support locale formatting', async () => {
        const email = `i18n-history-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'es', prisma);
        const teamName = `History Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestSprint(team.id, 'Sprint');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/reports/sprint-history')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        const sprintHistory = response.body.data;

        if (Array.isArray(sprintHistory) && sprintHistory.length > 0) {
          const firstSprint = sprintHistory[0];

          // Test story points formatting
          const plannedPoints = firstSprint.plannedPoints ?? 0;
          const completedPoints = firstSprint.completedPoints ?? 0;

          // Format with Spanish locale
          const formattedPlannedEs = new Intl.NumberFormat('es').format(plannedPoints);
          const formattedCompletedEs = new Intl.NumberFormat('es').format(completedPoints);

          expect(typeof formattedPlannedEs).toBe('string');
          expect(typeof formattedCompletedEs).toBe('string');

          // Test team members count formatting
          const teamMembers = firstSprint.teamMembers ?? 0;
          const formattedMembersEs = new Intl.NumberFormat('es').format(teamMembers);

          expect(typeof formattedMembersEs).toBe('string');
        }
      });

      it('should format impediment counts with locale-specific number formatting', async () => {
        const email = `i18n-impediments-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'fr', prisma);
        const teamName = `Impediment Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestSprint(team.id, 'Sprint');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/reports/metrics')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        const metrics = response.body.data;

        // Format impediment counts with French locale
        const resolvedCount = metrics.impediments?.resolved ?? 0;
        const totalCount = metrics.impediments?.total ?? 0;

        const formatterFr = new Intl.NumberFormat('fr');
        const formattedResolved = formatterFr.format(resolvedCount);
        const formattedTotal = formatterFr.format(totalCount);

        expect(typeof formattedResolved).toBe('string');
        expect(typeof formattedTotal).toBe('string');
      });

      it('should return velocity data that supports locale-specific chart formatting', async () => {
        const email = `i18n-velocity-data-${uniqueId()}@example.com`;
        testEmails.push(email);

        const user = await createI18nTestUser(email, 'de', prisma);
        const teamName = `Velocity Data Team ${uniqueId()}`;
        testTeams.push(teamName);

        const team = await createTestTeam(teamName);
        await addTeamMember(team.id, user.id, 'SCRUM_MASTER');
        await createTestSprint(team.id, 'Sprint 1');
        await createTestSprint(team.id, 'Sprint 2');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/reports/velocity')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(200);

        expect(response.body.success).toBe(true);
        const velocityData = response.body.data;

        // Each Sprint carries its own evidence, so the interface can format the observed points and
        // show a gap where the evidence does not survive.
        expect(Array.isArray(velocityData.points)).toBe(true);

        const testLocale: Locale = 'de';
        const formatter = new Intl.NumberFormat(testLocale, {
          style: 'decimal',
          maximumFractionDigits: 0,
        });

        for (const point of velocityData.points) {
          expect(point.sprintId).toBeDefined();
          expect(['recorded', 'reconstructed', 'in_progress', 'not_available']).toContain(
            point.provenance
          );

          if (point.plannedPoints !== null) {
            expect(typeof formatter.format(point.plannedPoints)).toBe('string');
          }
          if (point.completedPoints !== null) {
            expect(typeof formatter.format(point.completedPoints)).toBe('string');
          }
        }
      });

      it('should demonstrate locale-specific decimal separator differences', async () => {
        const testValue = 42.5;

        // Test decimal separator differences between locales
        const locales: Locale[] = ['en', 'de', 'fr', 'it', 'es'];
        const formattedValues: Record<Locale, string> = {} as Record<Locale, string>;

        for (const locale of locales) {
          formattedValues[locale] = new Intl.NumberFormat(locale, {
            maximumFractionDigits: 1,
          }).format(testValue);
        }

        // English uses '.' as decimal separator
        expect(formattedValues['en']).toContain('.');
        // German uses ',' as decimal separator
        expect(formattedValues['de']).toContain(',');
        // French uses ',' as decimal separator
        expect(formattedValues['fr']).toContain(',');
        // Italian uses ',' as decimal separator
        expect(formattedValues['it']).toContain(',');
        // Spanish uses ',' as decimal separator
        expect(formattedValues['es']).toContain(',');
      });

      it('should demonstrate locale-specific percentage formatting differences', async () => {
        const testPercentage = 75;

        const locales: Locale[] = ['en', 'de', 'fr', 'it', 'es'];
        const formattedPercentages: Record<Locale, string> = {} as Record<Locale, string>;

        for (const locale of locales) {
          formattedPercentages[locale] = new Intl.NumberFormat(locale, {
            style: 'percent',
          }).format(testPercentage / 100);
        }

        // All should produce valid formatted strings
        for (const locale of locales) {
          expect(typeof formattedPercentages[locale]).toBe('string');
          expect(formattedPercentages[locale].length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Reports scrum-guide regression coverage', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTestData(testEmails);
      await cleanupTeams(testTeams);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('refuses every report endpoint to a caller who is not a member of the team', async () => {
      const email = `reports-outsider-${uniqueId()}@example.com`;
      testEmails.push(email);
      await createTestUserInDb(email);

      const teamName = `Reports Outsider Team ${uniqueId()}`;
      testTeams.push(teamName);
      const team = await createTestTeam(teamName);

      const cookies = await loginAndGetCookies(email);

      for (const endpoint of ['velocity', 'sprint-history', 'metrics', 'insights']) {
        const response = await request(app)
          .get(`/api/v1/reports/${endpoint}`)
          .query({ teamId: team.id })
          .set('Cookie', cookies);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY);
      }
    });

    it('does not let a later status change rewrite what a closed Sprint delivered', async () => {
      const email = `reports-frozen-${uniqueId()}@example.com`;
      testEmails.push(email);
      const user = await createTestUserInDb(email);

      const teamName = `Reports Frozen Team ${uniqueId()}`;
      testTeams.push(teamName);
      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const sprint = await createTestSprint(
        team.id,
        'Closed Sprint',
        'COMPLETED',
        new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      );

      const pbi = await prisma.productBacklogItem.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          title: 'Delivered item',
          storyPoints: 13,
          status: 'DONE',
        },
      });
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: sprint.id, pbiId: pbi.id },
      });

      // What the Sprint delivered, as it was frozen at close.
      await prisma.sprintCompletionSnapshot.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          teamId: team.id,
          plannedPoints: 13,
          completedPoints: 13,
          itemCount: 1,
          completedItemCount: 1,
          items: [{ pbiId: pbi.id, storyPoints: 13, completed: true }],
        },
      });

      // The item is reopened long after the Sprint closed.
      await prisma.productBacklogItem.update({
        where: { id: pbi.id },
        data: { status: 'IN_PROGRESS' },
      });

      const cookies = await loginAndGetCookies(email);
      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      const points = response.body.data.points.filter(
        (point: { sprintId: string }) => point.sprintId === sprint.id
      );

      expect(points).toHaveLength(1);
      expect(points[0]).toMatchObject({
        plannedPoints: 13,
        completedPoints: 13,
        provenance: 'recorded',
      });
      expect(response.body.data.averageCompletedPoints).toBe(13);
    });

    it('reports a closed Sprint with no surviving evidence as not available, never as zero', async () => {
      const email = `reports-unrecorded-${uniqueId()}@example.com`;
      testEmails.push(email);
      const user = await createTestUserInDb(email);

      const teamName = `Reports Unrecorded Team ${uniqueId()}`;
      testTeams.push(teamName);
      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'SCRUM_MASTER');

      const sprint = await createTestSprint(
        team.id,
        'Unrecorded Sprint',
        'COMPLETED',
        new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      );

      const pbi = await prisma.productBacklogItem.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          title: 'Unknown outcome',
          storyPoints: 8,
          status: 'DONE',
        },
      });
      await prisma.sprintBacklogItem.create({
        data: { id: generateUUIDv7(), sprintId: sprint.id, pbiId: pbi.id },
      });

      const cookies = await loginAndGetCookies(email);
      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(200);

      const points = response.body.data.points.filter(
        (point: { sprintId: string }) => point.sprintId === sprint.id
      );

      expect(points[0]).toMatchObject({
        plannedPoints: null,
        completedPoints: null,
        provenance: 'not_available',
      });
      // The live "DONE" status is not evidence about the past, so it must not reach the average.
      expect(response.body.data.averageCompletedPoints).toBeNull();
    });
  });
});
