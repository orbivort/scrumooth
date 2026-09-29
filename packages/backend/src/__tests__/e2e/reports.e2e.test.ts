import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  uniqueTestId,
  HTTP_STATUS,
  ERROR_CODES,
  DEFAULT_PASSWORD,
  createTestUser,
  createTestTeamInDb,
  addTeamMember,
  createTestSprintInDb,
  createTestPBIInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  SPRINT_STATUSES,
  PBI_STATUSES,
  getCsrfToken,
  CSRF_CONSTANTS,
} from '@e2e-helpers';
import { GATE_CODES } from '@scrumooth/shared';

describe('E2E: Reports', () => {
  const testEmails: string[] = [];
  const testTeamNames: string[] = [];

  afterEach(async () => {
    await cleanupTeams(testTeamNames);
    await cleanupUsers(testEmails);
    testEmails.length = 0;
    testTeamNames.length = 0;
  });

  const loginAndGetCookies = async (email: string): Promise<string[]> => {
    const { csrfCookie, csrfToken } = await getCsrfToken();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrfCookie)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
      .send({ email, password: DEFAULT_PASSWORD });

    const setCookie = response.headers['set-cookie'];
    if (!setCookie) {
      return [csrfCookie];
    }
    const authCookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return [...authCookies, csrfCookie];
  };

  const setupTeamWithUser = async (
    email: string,
    role: (typeof ROLES)[keyof typeof ROLES] = ROLES.SCRUM_MASTER
  ) => {
    const user = await createTestUser(email);
    const teamName = `Reports Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('GET /api/v1/reports/velocity', () => {
    it('should return velocity data for a team', async () => {
      const email = `velocity-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.points)).toBe(true);
      expect(response.body.data).toHaveProperty('averageCompletedPoints');
      expect(response.body.data).toHaveProperty('observedSprints');
      expect(response.body.data).toHaveProperty('unavailableSprints');
    });

    it('should return velocity data with sprint history', async () => {
      const email = `velocity-history-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      await createTestSprintInDb(team.id, `Sprint 1 ${uniqueTestId()}`, SPRINT_STATUSES.COMPLETED);
      await createTestSprintInDb(team.id, `Sprint 2 ${uniqueTestId()}`, SPRINT_STATUSES.COMPLETED);

      await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`, PBI_STATUSES.DONE);
      await createTestPBIInDb(team.id, `PBI 2 ${uniqueTestId()}`, PBI_STATUSES.DONE);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 BAD_REQUEST with missing teamId', async () => {
      const email = `velocity-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      // The team-context gate answers a missing team before any handler runs.
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/reports/sprint-history', () => {
    it('should return sprint history for a team', async () => {
      const email = `sprint-history-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      await createTestSprintInDb(team.id, `Sprint ${uniqueTestId()}`, SPRINT_STATUSES.COMPLETED);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return empty array for team with no completed sprints', async () => {
      const email = `no-history-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return 400 BAD_REQUEST with missing teamId', async () => {
      const email = `history-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      // The team-context gate answers a missing team before any handler runs.
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/reports/metrics', () => {
    it('should return team metrics', async () => {
      const email = `metrics-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('averageCompletedPoints');
      expect(response.body.data).toHaveProperty('completionRate');
      expect(response.body.data).toHaveProperty('itemCompletion');
      expect(response.body.data).toHaveProperty('sprintGoalVerdicts');
      // Velocity is descriptive history, never a trend to police.
      expect(response.body.data).not.toHaveProperty('velocityTrend');
    });

    it('should return metrics with sprint data', async () => {
      const email = `metrics-sprints-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      await createTestSprintInDb(team.id, `Sprint 1 ${uniqueTestId()}`, SPRINT_STATUSES.COMPLETED);
      await createTestSprintInDb(team.id, `Sprint 2 ${uniqueTestId()}`, SPRINT_STATUSES.COMPLETED);
      await createTestSprintInDb(team.id, `Sprint 3 ${uniqueTestId()}`, SPRINT_STATUSES.ACTIVE);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 BAD_REQUEST with missing teamId', async () => {
      const email = `metrics-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      // The team-context gate answers a missing team before any handler runs.
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/reports/insights', () => {
    it('should return team insights', async () => {
      const email = `insights-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/insights')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return insights with recommendations', async () => {
      const email = `insights-recs-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      for (let i = 0; i < 5; i++) {
        await createTestSprintInDb(
          team.id,
          `Sprint ${i} ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
      }

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/insights')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 BAD_REQUEST with missing teamId', async () => {
      const email = `insights-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/insights')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      // The team-context gate answers a missing team before any handler runs.
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/reports/insights')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle velocity for team with no completed sprints', async () => {
      const email = `velocity-empty-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.points).toEqual([]);
      // Nothing was observed, so there is no average -- rather than an average of zero.
      expect(response.body.data.averageCompletedPoints).toBeNull();
      expect(response.body.data.observedSprints).toBe(0);
    });

    it('should handle metrics for team with no data', async () => {
      const email = `metrics-empty-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.averageCompletedPoints).toBeNull();
      expect(response.body.data.completionRate).toBeNull();
    });

    it('should handle insights for team with no data', async () => {
      const email = `insights-empty-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/insights')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should refuse every report for a team the caller does not belong to', async () => {
      const email = `non-member-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      // Another team entirely: a report reads that team's own observed history, so a caller who is
      // not a member of it is refused rather than shown an empty report.
      const otherTeamName = `Reports Other Team ${uniqueTestId()}`;
      testTeamNames.push(otherTeamName);
      const otherTeam = await createTestTeamInDb(otherTeamName);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      for (const endpoint of ['velocity', 'sprint-history', 'metrics', 'insights']) {
        const response = await request(app)
          .get(`/api/v1/reports/${endpoint}`)
          .query({ teamId: otherTeam.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.FORBIDDEN);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY);
      }
    });

    it('should refuse a report for a team that does not exist', async () => {
      const email = `nonexistent-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.FORBIDDEN);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY);
    });
  });

  describe('Authorization and Permissions', () => {
    it('should allow scrum master to view reports', async () => {
      const email = `sm-reports-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/velocity')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should allow product owner to view reports', async () => {
      const email = `po-reports-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/metrics')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should allow developer to view reports', async () => {
      const email = `dev-reports-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/sprint-history')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should allow product owner to view reports', async () => {
      const email = `admin-reports-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/reports/insights')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });
  });
});
