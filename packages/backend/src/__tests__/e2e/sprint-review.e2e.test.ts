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
  createTestPBIInDb,
  createTestProductGoalInDb,
  createTestStakeholderFeedbackInDb,
  createTestReviewAttendeeInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  SPRINT_STATUSES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';
import { GATE_CODES } from '@scrumooth/shared';

describe('E2E: Sprint Review Management', () => {
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
    const teamName = `Review Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('GET /api/v1/sprint-reviews', () => {
    it('should return sprint reviews for a team', async () => {
      const email = `get-reviews-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter sprint reviews by sprint', async () => {
      const email = `filter-reviews-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint1 = await createTestSprintInDb(
        team.id,
        `Sprint 1 ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const sprint2 = await createTestSprintInDb(
        team.id,
        `Sprint 2 ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const increment1 = await createTestIncrementInDb(sprint1.id, team.id);
      const increment2 = await createTestIncrementInDb(sprint2.id, team.id);

      await createTestSprintReviewInDb(sprint1.id, team.id, increment1.id, user.id);
      await createTestSprintReviewInDb(sprint2.id, team.id, increment2.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .query({ teamId: team.id, sprintId: sprint1.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((r: { sprintId: string }) => r.sprintId === sprint1.id)).toBe(
        true
      );
    });

    it('should return empty array for team with no reviews', async () => {
      const email = `no-reviews-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing teamId', async () => {
      const email = `missing-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid teamId format', async () => {
      const email = `invalid-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .query({ teamId: 'invalid-uuid' })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();
      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/sprint-reviews/:id', () => {
    it('should return sprint review by ID', async () => {
      const email = `get-review-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(review.id);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid review ID', async () => {
      const email = `invalid-id-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews/invalid-id')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/sprint-reviews', () => {
    it('should create sprint review successfully', async () => {
      const email = `create-review-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(
        sprint.id,
        team.id,
        'Test Increment',
        'DELIVERED'
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date().toISOString(),
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('in_progress');
    });

    it('should create sprint review with increment', async () => {
      const email = `review-increment-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date().toISOString(),
          summary: 'Initial review summary',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.incrementId).toBe(increment.id);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing required fields', async () => {
      const email = `missing-fields-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid sprint ID', async () => {
      const email = `invalid-sprint-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: 'invalid-uuid',
          teamId: '00000000-0000-0000-0000-000000000000',
          reviewDate: new Date().toISOString(),
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with summary too long', async () => {
      const email = `long-summary-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          reviewDate: new Date().toISOString(),
          summary: 'a'.repeat(2001),
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();
      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: '00000000-0000-0000-0000-000000000000',
          teamId: '00000000-0000-0000-0000-000000000000',
          reviewDate: new Date().toISOString(),
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/sprint-reviews/:id', () => {
    it('should update sprint review successfully', async () => {
      const email = `update-review-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      // Completing the Review is gated on the Sprint having reached its end date.
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED,
        new Date(now - 28 * day),
        new Date(now - 14 * day)
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          summary: 'Updated review summary',
          status: 'completed',
          // Concluding the Review requires the team's own verdict on the Sprint Goal.
          sprintGoalOutcome: 'ACHIEVED',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBe('Updated review summary');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.sprintGoalOutcome).toBe('ACHIEVED');
    });

    it('should refuse to complete a Review without the Sprint Goal verdict', async () => {
      const email = `review-no-verdict-${uniqueTestId()}@example.com`;
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
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ status: 'completed' })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED);
      expect(response.body.error.message).toBeDefined();
    });

    it('should update review with attendees', async () => {
      const email = `update-attendees-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          attendees: [
            {
              name: 'John Doe',
              email: 'john@example.com',
              role: 'product_owner',
              attended: true,
            },
            {
              name: 'Jane Smith',
              role: 'developers',
              attended: true,
            },
          ],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should update review with feedback', async () => {
      const email = `update-feedback-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          feedback: [
            {
              authorName: 'Stakeholder 1',
              content: 'Great progress on the feature',
              category: 'positive',
            },
            {
              authorName: 'Stakeholder 2',
              content: 'Need more documentation',
              category: 'suggestion',
              actionRequired: true,
            },
          ],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should update review with backlog adjustments', async () => {
      const email = `update-adjustments-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          backlogAdjustments: [
            {
              action: 'add',
              description: 'Add new feature request',
              reason: 'Stakeholder requested new feature',
            },
            {
              action: 'modify',
              description: 'Update existing feature',
              reason: 'Requirements changed',
            },
          ],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid status', async () => {
      const email = `invalid-status-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'invalid_status',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid feedback category', async () => {
      const email = `invalid-category-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          feedback: [
            {
              authorName: 'Test',
              content: 'Test',
              category: 'invalid_category',
            },
          ],
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('DELETE /api/v1/sprint-reviews/:id', () => {
    it('should delete sprint review successfully', async () => {
      const email = `delete-review-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);

      const checkReview = await prisma.sprintReview.findUnique({
        where: { id: review.id },
      });
      expect(checkReview).toBeNull();
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid review ID', async () => {
      const email = `delete-invalid-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete('/api/v1/sprint-reviews/invalid-id')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('Stakeholder Feedback', () => {
    describe('POST /api/v1/sprint-reviews/:id/feedback', () => {
      it('should add stakeholder feedback', async () => {
        const email = `add-feedback-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprint-reviews/${review.id}/feedback`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            authorName: 'Stakeholder Name',
            content: 'Very impressed with the progress',
            category: 'positive',
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.authorName).toBe('Stakeholder Name');
      });

      it('should add feedback with action required', async () => {
        const email = `action-feedback-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprint-reviews/${review.id}/feedback`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            authorName: 'Concerned Stakeholder',
            content: 'Need to address performance issues',
            category: 'negative',
            actionRequired: true,
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
      });

      it('should return 422 UNPROCESSABLE_ENTITY with missing author name', async () => {
        const email = `missing-author-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprint-reviews/${review.id}/feedback`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            content: 'Feedback without author',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/sprint-reviews/feedback/pending', () => {
      it('should return pending feedback for team', async () => {
        const email = `pending-feedback-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);
        await createTestStakeholderFeedbackInDb(
          review.id,
          'Stakeholder',
          'Pending feedback',
          'SUGGESTION'
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprint-reviews/feedback/pending')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return 422 UNPROCESSABLE_ENTITY with missing teamId', async () => {
        const email = `pending-no-team-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        await createTestUser(email);
        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprint-reviews/feedback/pending')
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/v1/sprint-reviews/feedback/:id/address', () => {
      it('should mark feedback as addressed', async () => {
        const email = `address-feedback-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);
        const feedback = await createTestStakeholderFeedbackInDb(
          review.id,
          'Stakeholder',
          'Feedback to address',
          'QUESTION'
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/sprint-reviews/feedback/${feedback.id}/address`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Attendees', () => {
    describe('POST /api/v1/sprint-reviews/:reviewId/attendees', () => {
      it('should add attendee to review', async () => {
        const email = `add-attendee-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprint-reviews/${review.id}/attendees`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            name: 'Product Owner',
            email: 'po@example.com',
            role: 'product_owner',
            attended: true,
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Product Owner');
      });

      it('should add attendee with different roles', async () => {
        const email = `attendee-roles-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const roles = ['product_owner', 'scrum_master', 'developers', 'stakeholder'];

        for (const role of roles) {
          const response = await request(app)
            .post(`/api/v1/sprint-reviews/${review.id}/attendees`)
            .set('Cookie', cookies)
            .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
            .send({
              name: `Attendee ${role}`,
              role,
              attended: true,
            })
            .expect(HTTP_STATUS.CREATED);

          expect(response.body.data.role).toBe(role);
        }
      });

      it('should return 422 UNPROCESSABLE_ENTITY with invalid role', async () => {
        const email = `invalid-role-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprint-reviews/${review.id}/attendees`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            name: 'Invalid Role',
            role: 'invalid_role',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/v1/sprint-reviews/attendees/:id', () => {
      it('should update attendee', async () => {
        const email = `update-attendee-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);
        const attendee = await createTestReviewAttendeeInDb(
          review.id,
          'Original Name',
          'developers'
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/sprint-reviews/attendees/${attendee.id}`)
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

    describe('DELETE /api/v1/sprint-reviews/attendees/:id', () => {
      it('should delete attendee', async () => {
        const email = `delete-attendee-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);
        const attendee = await createTestReviewAttendeeInDb(review.id, 'To Delete', 'stakeholder');

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/sprint-reviews/attendees/${attendee.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Backlog Adjustments', () => {
    describe('GET /api/v1/sprint-reviews/adjustments/pending', () => {
      it('should return pending adjustments for team', async () => {
        const email = `pending-adjustments-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprint-reviews/adjustments/pending')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return 422 UNPROCESSABLE_ENTITY with missing teamId', async () => {
        const email = `adjustments-no-team-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        await createTestUser(email);
        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprint-reviews/adjustments/pending')
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/v1/sprint-reviews/adjustments/:id/implement', () => {
      it('should mark adjustment as implemented', async () => {
        const email = `implement-adjustment-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
        const sprint = await createTestSprintInDb(
          team.id,
          `Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.COMPLETED
        );
        const increment = await createTestIncrementInDb(sprint.id, team.id);

        const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

        const adjustment = await prisma.backlogAdjustment.create({
          data: {
            id: crypto.randomUUID(),
            reviewId: review.id,
            action: 'add',
            description: 'New feature request',
            reason: 'Stakeholder feedback',
            implemented: false,
          },
        });

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/sprint-reviews/adjustments/${adjustment.id}/implement`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle review with special characters in summary', async () => {
      const email = `special-summary-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const specialSummary = 'Summary with <script>alert("xss")</script> & "quotes"';

      const response = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          summary: specialSummary,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should handle review with unicode characters', async () => {
      const email = `unicode-review-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Test', 'DELIVERED');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date().toISOString(),
          summary: '回顾总结 🚀 日本語版 テスト',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should handle multiple feedback items', async () => {
      const email = `multi-feedback-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const categories = ['positive', 'negative', 'suggestion', 'question'] as const;

      for (const category of categories) {
        const response = await request(app)
          .post(`/api/v1/sprint-reviews/${review.id}/feedback`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            authorName: `Author ${category}`,
            content: `Feedback for ${category}`,
            category,
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.data.category).toBe(category);
      }
    });
  });

  describe('Authorization and Permissions', () => {
    it('should allow scrum master to create review', async () => {
      const email = `sm-create-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Test', 'DELIVERED');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date().toISOString(),
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should allow product owner to create review', async () => {
      const email = `po-create-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Test', 'DELIVERED');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprint-reviews')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          sprintId: sprint.id,
          teamId: team.id,
          incrementId: increment.id,
          reviewDate: new Date().toISOString(),
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should allow developer to view reviews', async () => {
      const email = `dev-view-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);

      await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprint-reviews')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Review ownership (Scrum Guide gates)', () => {
    it('should refuse a Review write from a user outside the owning team', async () => {
      const ownerEmail = `review-owner-${uniqueTestId()}@example.com`;
      const outsiderEmail = `review-outsider-${uniqueTestId()}@example.com`;
      testEmails.push(ownerEmail, outsiderEmail);

      const { user, team } = await setupTeamWithUser(ownerEmail, ROLES.SCRUM_MASTER);
      await createTestUser(outsiderEmail);

      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(outsiderEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprint-reviews/${review.id}/attendees`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ name: 'Outsider', role: 'stakeholder', attended: true })
        .expect(HTTP_STATUS.FORBIDDEN);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('GATE_SPRINT_REVIEW_TEAM_MEMBERS_ONLY');
    });

    it('should refuse SM notes from a Developer', async () => {
      const email = `review-dev-notes-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .patch(`/api/v1/sprint-reviews/${review.id}/sm-notes`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ smNotes: 'Coaching observation' })
        .expect(HTTP_STATUS.FORBIDDEN);

      expect(response.body.error.code).toBe('GATE_SPRINT_REVIEW_SM_NOTES_SM_ONLY');
    });

    it('should let the Scrum Master write notes', async () => {
      const email = `review-sm-notes-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .patch(`/api/v1/sprint-reviews/${review.id}/sm-notes`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ smNotes: 'Coaching observation' })
        .expect(HTTP_STATUS.OK);

      expect(response.body.data.smNotes).toBe('Coaching observation');
    });
  });

  describe('Backlog adjustment traceability', () => {
    it('should materialise an adjustment into a linked backlog item', async () => {
      const email = `review-materialize-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      // Materialising goes through the Product Backlog service, which anchors a new item to the
      // team's ACTIVE Product Goal.
      await createTestProductGoalInDb(team.id, `Goal ${uniqueTestId()}`, 'ACTIVE');

      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED,
        new Date(now - 28 * day),
        new Date(now - 14 * day)
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Delivered', 'DELIVERED');
      // `pending` adjustments are read from completed Reviews, so complete it up-front.
      const review = await createTestSprintReviewInDb(
        sprint.id,
        team.id,
        increment.id,
        user.id,
        undefined,
        'completed'
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          backlogAdjustments: [
            {
              action: 'add',
              description: 'Add SSO login to the backlog',
              reason: 'Requested by stakeholders during the review',
            },
          ],
        })
        .expect(HTTP_STATUS.OK);

      const adjustmentId = created.body.data.backlogAdjustments[0].id;

      const materialized = await request(app)
        .post(`/api/v1/sprint-reviews/adjustments/${adjustmentId}/materialize`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ title: 'Add SSO login' })
        .expect(HTTP_STATUS.CREATED);

      expect(materialized.body.data.adjustment.createdPbiId).toBe(materialized.body.data.pbi.id);
      expect(materialized.body.data.adjustment.implemented).toBe(true);

      // The adjustment no longer appears as pending, because the link is the evidence.
      const pending = await request(app)
        .get('/api/v1/sprint-reviews/adjustments/pending')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(pending.body.data).toHaveLength(0);
    });

    it('should link an existing backlog item to an adjustment', async () => {
      const email = `review-link-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const pbi = await createTestPBIInDb(team.id, `Existing item ${uniqueTestId()}`, 'READY');

      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          backlogAdjustments: [
            {
              action: 'modify',
              description: 'Refine the checkout item',
              reason: 'Stakeholder feedback',
            },
          ],
        })
        .expect(HTTP_STATUS.OK);

      const adjustmentId = created.body.data.backlogAdjustments[0].id;

      const linked = await request(app)
        .put(`/api/v1/sprint-reviews/adjustments/${adjustmentId}/link`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ pbiId: pbi.id })
        .expect(HTTP_STATUS.OK);

      expect(linked.body.data.createdPbiId).toBe(pbi.id);
      expect(linked.body.data.implemented).toBe(true);
    });

    it('should refuse to link a backlog item from another team', async () => {
      const email = `review-link-foreign-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const otherTeamName = `Other Team ${uniqueTestId()}`;
      testTeamNames.push(otherTeamName);
      const otherTeam = await createTestTeamInDb(otherTeamName);
      const foreignPbi = await createTestPBIInDb(otherTeam.id, `Foreign item ${uniqueTestId()}`);

      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );
      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const review = await createTestSprintReviewInDb(sprint.id, team.id, increment.id, user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .put(`/api/v1/sprint-reviews/${review.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          backlogAdjustments: [{ action: 'modify', description: 'Refine', reason: 'Feedback' }],
        })
        .expect(HTTP_STATUS.OK);

      const adjustmentId = created.body.data.backlogAdjustments[0].id;

      await request(app)
        .put(`/api/v1/sprint-reviews/adjustments/${adjustmentId}/link`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ pbiId: foreignPbi.id })
        .expect(HTTP_STATUS.BAD_REQUEST);
    });
  });
});
