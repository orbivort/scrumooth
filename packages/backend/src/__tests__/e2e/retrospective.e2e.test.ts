import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import {
  uniqueTestId,
  HTTP_STATUS,
  ERROR_CODES,
  DEFAULT_PASSWORD,
  createTestUser,
  createTestTeamInDb,
  addTeamMember,
  createTestSprintInDb,
  createTestIncrementInDb,
  createTestSprintReviewInDb,
  createTestRetrospectiveInDb,
  createTestRetrospectiveItemInDb,
  createTestRetroActionItemInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  SPRINT_STATUSES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

describe('E2E: Retrospective Management', () => {
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
    const teamName = `Retro Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('GET /api/v1/retrospectives/team/:teamId', () => {
    it('should return retrospectives for a team', async () => {
      const email = `get-retros-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/team/${team.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for team with no retrospectives', async () => {
      const email = `no-retros-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/team/${team.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/retrospectives/team/00000000-0000-0000-0000-000000000000')
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/retrospectives/:id', () => {
    it('should return retrospective by ID', async () => {
      const email = `get-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(retro.id);
    });

    it('should return 404 NOT_FOUND for non-existent retrospective', async () => {
      const email = `nonexistent-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/retrospectives/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });
  });

  describe('GET /api/v1/retrospectives/sprint/:sprintId', () => {
    it('should return retrospective for a sprint', async () => {
      const email = `get-sprint-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/sprint/${sprint.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should return null for sprint without retrospective', async () => {
      const email = `no-sprint-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/sprint/${sprint.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('POST /api/v1/retrospectives', () => {
    it('should create retrospective successfully', async () => {
      const email = `create-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

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
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('DRAFT');
    });

    it('should create retrospective with isAnonymous flag', async () => {
      const email = `anonymous-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

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
          isAnonymous: true,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isAnonymous).toBe(true);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing required fields', async () => {
      const email = `missing-fields-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/retrospectives')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 400 BAD_REQUEST when retrospective already exists for sprint', async () => {
      const email = `duplicate-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

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
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .post('/api/v1/retrospectives')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: '00000000-0000-0000-0000-000000000000',
          teamId: '00000000-0000-0000-0000-000000000000',
          facilitatorId: '00000000-0000-0000-0000-000000000000',
          retroDate: new Date().toISOString(),
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/retrospectives/:id', () => {
    it('should update retrospective successfully', async () => {
      const email = `update-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'IN_PROGRESS',
          summary: 'Retrospective summary',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('IN_PROGRESS');
    });

    it('should complete retrospective', async () => {
      const email = `complete-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED,
        new Date(now - 28 * day),
        new Date(now - 14 * day)
      );

      // The Sprint Review is the second-to-last event, so it must be completed before the
      // Retrospective may conclude the Sprint.
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      await createTestSprintReviewInDb(
        sprint.id,
        team.id,
        increment.id,
        user.id,
        undefined,
        'completed'
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id, 'IN_PROGRESS');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'COMPLETED',
          summary: 'Final retrospective summary',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('should refuse to complete before the sprint review is completed', async () => {
      const email = `complete-retro-order-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED,
        new Date(now - 28 * day),
        new Date(now - 14 * day)
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id, 'IN_PROGRESS');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ status: 'COMPLETED' })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_SPRINT_RETROSPECTIVE_REQUIRES_REVIEW');
    });

    it('should return 404 NOT_FOUND for non-existent retrospective', async () => {
      const email = `update-nonexistent-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put('/api/v1/retrospectives/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'IN_PROGRESS',
        })
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Retrospective Items', () => {
    describe('POST /api/v1/retrospectives/:retroId/items', () => {
      it('should add item to retrospective', async () => {
        const email = `add-item-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            category: 'WENT_WELL',
            content: 'Good team collaboration',
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.category).toBe('WENT_WELL');
        expect(response.body.data.content).toBe('Good team collaboration');
      });

      it('should add item with different categories', async () => {
        const email = `categories-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const categories = ['WENT_WELL', 'DIDNT_GO_WELL', 'IMPROVEMENT'];

        for (const category of categories) {
          const response = await request(app)
            .post(`/api/v1/retrospectives/${retro.id}/items`)
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .send({
              category,
              content: `Item for ${category}`,
            })
            .expect(HTTP_STATUS.CREATED);

          expect(response.body.data.category).toBe(category);
        }
      });

      it('should return 422 UNPROCESSABLE_ENTITY with invalid category', async () => {
        const email = `invalid-category-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            category: 'INVALID_CATEGORY',
            content: 'Test content',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/retrospectives/:retroId/items/:itemId/vote', () => {
      it('should vote for an item', async () => {
        const email = `vote-item-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const item = await createTestRetrospectiveItemInDb(
          retro.id,
          'WENT_WELL',
          'Item to vote for'
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.votes).toBeGreaterThanOrEqual(1);
      });

      it('should return 404 NOT_FOUND for non-existent item', async () => {
        const email = `vote-nonexistent-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(
            `/api/v1/retrospectives/${retro.id}/items/00000000-0000-0000-0000-000000000000/vote`
          )
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.NOT_FOUND);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/retrospectives/:retroId/items/:itemId/vote', () => {
      it('should remove vote from an item', async () => {
        const email = `unvote-item-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const item = await createTestRetrospectiveItemInDb(retro.id, 'WENT_WELL', 'Item to unvote');

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
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });

    describe('PUT /api/v1/retrospectives/:retroId/items/:itemId', () => {
      it('should update item content', async () => {
        const email = `update-item-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const item = await createTestRetrospectiveItemInDb(
          retro.id,
          'WENT_WELL',
          'Original content'
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/retrospectives/${retro.id}/items/${item.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            content: 'Updated content',
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.content).toBe('Updated content');
      });
    });

    describe('DELETE /api/v1/retrospectives/:retroId/items/:itemId', () => {
      it('should delete item', async () => {
        const email = `delete-item-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const item = await createTestRetrospectiveItemInDb(retro.id, 'WENT_WELL', 'Item to delete');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/retrospectives/${retro.id}/items/${item.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);

        const checkItem = await prisma.retrospectiveItem.findUnique({
          where: { id: item.id },
        });
        expect(checkItem).toBeNull();
      });
    });
  });

  describe('Action Items', () => {
    describe('POST /api/v1/retrospectives/:retroId/action-items', () => {
      it('should add action item to retrospective', async () => {
        const email = `add-action-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/action-items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            title: 'Improve code review process',
            description: 'Set up automated code review tools',
            ownerId: user.id,
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Improve code review process');
        expect(response.body.data.status).toBe('PENDING');
      });

      it('should add action item with due date', async () => {
        const email = `action-due-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/action-items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            title: 'Action with due date',
            ownerId: user.id,
            dueDate: dueDate.toISOString(),
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
      });

      it('should return 422 UNPROCESSABLE_ENTITY with missing required fields', async () => {
        const email = `action-missing-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/action-items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({})
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/v1/retrospectives/:retroId/action-items/:actionItemId', () => {
      it('should update action item status', async () => {
        const email = `update-action-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const actionItem = await createTestRetroActionItemInDb(retro.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/retrospectives/${retro.id}/action-items/${actionItem.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: 'IN_PROGRESS',
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('IN_PROGRESS');
      });

      it('should mark action item as completed', async () => {
        const email = `complete-action-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const actionItem = await createTestRetroActionItemInDb(
          retro.id,
          user.id,
          'Test',
          'IN_PROGRESS'
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/retrospectives/${retro.id}/action-items/${actionItem.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: 'COMPLETED',
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('COMPLETED');
      });
    });

    describe('DELETE /api/v1/retrospectives/:retroId/action-items/:actionItemId', () => {
      it('should delete action item', async () => {
        const email = `delete-action-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
        const actionItem = await createTestRetroActionItemInDb(retro.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/retrospectives/${retro.id}/action-items/${actionItem.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);

        const checkItem = await prisma.retroActionItem.findUnique({
          where: { id: actionItem.id },
        });
        expect(checkItem).toBeNull();
      });
    });
  });

  describe('GET /api/v1/retrospectives/team/:teamId/pending-action-items', () => {
    it('should return pending action items for team', async () => {
      const email = `pending-actions-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
      await createTestRetroActionItemInDb(retro.id, user.id, 'Pending Action');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/team/${team.id}/pending-action-items`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Attendees', () => {
    describe('POST /api/v1/retrospectives/:retroId/attendees', () => {
      it('should add attendee to retrospective', async () => {
        const email = `add-attendee-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/attendees`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            name: 'John Doe',
            email: 'john@example.com',
            role: 'developers',
            attended: true,
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('John Doe');
      });

      it('should add attendee without email', async () => {
        const email = `attendee-no-email-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/attendees`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            name: 'Jane Smith',
            role: 'product_owner',
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
      });
    });

    describe('PUT /api/v1/retrospectives/attendees/:attendeeId', () => {
      it('should update attendee', async () => {
        const email = `update-attendee-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookiesForCreate = await loginAndGetCookies(email);
        const { csrfToken: csrfToken1 } = extractCsrfFromCookies(cookiesForCreate);

        const createResponse = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/attendees`)
          .set('Cookie', cookiesForCreate)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken1)
          .send({
            name: 'Original Name',
            role: 'developers',
          });

        const attendeeId = createResponse.body.data.id;
        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/retrospectives/attendees/${attendeeId}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            name: 'Updated Name',
            attended: false,
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Name');
        expect(response.body.data.attended).toBe(false);
      });
    });

    describe('DELETE /api/v1/retrospectives/attendees/:attendeeId', () => {
      it('should delete attendee', async () => {
        const email = `delete-attendee-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );

        const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

        const cookiesForCreate = await loginAndGetCookies(email);
        const { csrfToken: csrfToken1 } = extractCsrfFromCookies(cookiesForCreate);

        const createResponse = await request(app)
          .post(`/api/v1/retrospectives/${retro.id}/attendees`)
          .set('Cookie', cookiesForCreate)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken1)
          .send({
            name: 'To Delete',
            role: 'developers',
          });

        const attendeeId = createResponse.body.data.id;
        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/retrospectives/attendees/${attendeeId}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle retrospective with special characters in content', async () => {
      const email = `special-content-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const specialContent = 'Content with <script>alert("xss")</script> & "quotes"';

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          category: 'WENT_WELL',
          content: specialContent,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should handle multiple votes on same item', async () => {
      const email1 = `multi-vote-1-${uniqueTestId()}@example.com`;
      const email2 = `multi-vote-2-${uniqueTestId()}@example.com`;
      testEmails.push(email1, email2);

      const user1 = await createTestUser(email1);
      const user2 = await createTestUser(email2);

      const teamName = `Multi Vote Team ${uniqueTestId()}`;
      testTeamNames.push(teamName);
      const team = await createTestTeamInDb(teamName);

      await addTeamMember(team.id, user1.id, ROLES.DEVELOPERS);
      await addTeamMember(team.id, user2.id, ROLES.DEVELOPERS);

      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user1.id);
      const item = await createTestRetrospectiveItemInDb(retro.id, 'WENT_WELL', 'Multi-vote item');

      const cookies1 = await loginAndGetCookies(email1);
      const { csrfToken: csrfToken1 } = extractCsrfFromCookies(cookies1);

      await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
        .set('Cookie', cookies1)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken1);

      const cookies2 = await loginAndGetCookies(email2);
      const { csrfToken: csrfToken2 } = extractCsrfFromCookies(cookies2);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
        .set('Cookie', cookies2)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken2)
        .expect(HTTP_STATUS.OK);

      expect(response.body.data.votes).toBeGreaterThanOrEqual(2);
    });

    it('should handle action item status transitions', async () => {
      const email = `status-trans-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
      const actionItem = await createTestRetroActionItemInDb(retro.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const statuses = ['IN_PROGRESS', 'COMPLETED', 'PENDING'];

      for (const status of statuses) {
        const response = await request(app)
          .put(`/api/v1/retrospectives/${retro.id}/action-items/${actionItem.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({ status })
          .expect(HTTP_STATUS.OK);

        expect(response.body.data.status).toBe(status);
      }
    });
  });

  describe('Authorization and Permissions', () => {
    it('should allow scrum master to create retrospective', async () => {
      const email = `sm-create-retro-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

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
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should allow developer to vote on items', async () => {
      const email = `dev-vote-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);
      const item = await createTestRetrospectiveItemInDb(retro.id, 'WENT_WELL', 'Item for voting');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items/${item.id}/vote`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should allow developer to add items', async () => {
      const email = `dev-add-item-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/retrospectives/${retro.id}/items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          category: 'IMPROVEMENT',
          content: 'Developer suggestion',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });
  });
});
