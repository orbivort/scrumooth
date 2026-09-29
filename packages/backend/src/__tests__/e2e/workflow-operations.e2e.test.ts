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
  createTestProductGoalInDb,
  createTestIncrementInDb,
  createTestSprintReviewInDb,
  createTestRetrospectiveInDb,
  createTestRetrospectiveItemInDb,
  addPBIToSprintBacklog,
  seedPlanningParticipation,
  seedTeamDefinitions,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  SPRINT_STATUSES,
  PBI_STATUSES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

describe('E2E: Workflow Operations', () => {
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
    role: (typeof ROLES)[keyof typeof ROLES] = ROLES.DEVELOPERS
  ) => {
    const user = await createTestUser(email);
    const teamName = `Workflow Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('Sprint Review Operations', () => {
    describe('GET /api/v1/sprint-reviews', () => {
      it('should return sprint reviews for a team', async () => {
        const email = `reviews-list-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprint-reviews')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return empty array for team with no reviews', async () => {
        const email = `no-reviews-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/sprint-reviews')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const response = await request(app)
          .get('/api/v1/sprint-reviews')
          .query({ teamId: '00000000-0000-0000-0000-000000000000' })
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/sprint-reviews', () => {
      it('should return 400 when no delivered increment exists', async () => {
        const email = `review-create-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Review Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
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
            summary: 'Sprint review summary',
          })
          .expect(HTTP_STATUS.BAD_REQUEST);

        expect(response.body.success).toBe(false);
      });

      it('should create a review with a date-only reviewDate string (regression)', async () => {
        const email = `review-dateonly-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Review Dateonly ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const increment = await createTestIncrementInDb(
          sprint.id,
          team.id,
          'Delivered Increment',
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
            // The frontend sends a date-only string like "2026-08-22".
            reviewDate: '2026-08-22',
            summary: 'Sprint review summary',
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data.reviewDate).toBeDefined();
      });

      it('should return 422 UNPROCESSABLE_ENTITY with missing required fields', async () => {
        const email = `review-missing-${uniqueTestId()}@example.com`;
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
    });
  });

  describe('Sprint Retrospective Operations', () => {
    describe('GET /api/v1/retrospectives/sprint/:sprintId', () => {
      it('should return retrospective for a sprint', async () => {
        const email = `retro-get-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Retro Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/retrospectives/sprint/${sprint.id}`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });

      it('should return null for sprint without retrospective', async () => {
        const email = `no-retro-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `No Retro Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.PLANNED
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/retrospectives/sprint/${sprint.id}`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeNull();
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const response = await request(app)
          .get('/api/v1/retrospectives/sprint/00000000-0000-0000-0000-000000000000')
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/retrospectives', () => {
      it('should create retrospective with valid data', async () => {
        const email = `retro-create-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Create Retro Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
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
      });

      it('should create retrospective with isAnonymous flag', async () => {
        const email = `retro-anonymous-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Anonymous Retro Sprint ${uniqueTestId()}`,
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
        const email = `retro-missing-${uniqueTestId()}@example.com`;
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

      it('should return 400 BAD_REQUEST when retrospective already exists', async () => {
        const email = `retro-duplicate-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Duplicate Retro Sprint ${uniqueTestId()}`,
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
    });
  });

  describe('Sprint Backlog Operations', () => {
    describe('GET /api/v1/sprints/:sprintId/backlog-pbis', () => {
      it('should return PBIs in sprint backlog', async () => {
        const email = `backlog-pbis-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Backlog PBIs Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/sprints/${sprint.id}/backlog-pbis`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return empty array for sprint with no PBIs', async () => {
        const email = `empty-backlog-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Empty Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.PLANNED
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/sprints/${sprint.id}/backlog-pbis`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const response = await request(app)
          .get('/api/v1/sprints/00000000-0000-0000-0000-000000000000/backlog-pbis')
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/sprints/:sprintId/backlog-items', () => {
      it('should add PBI to sprint backlog', async () => {
        const email = `add-pbi-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Add PBI Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(
          team.id,
          `PBI to Add ${uniqueTestId()}`,
          PBI_STATUSES.READY
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/backlog-items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            pbiId: pbi.id,
            reason: 'New priority requirement',
            goalImpact: 'SUPPORTS_GOAL',
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
      });

      it('should return 422 UNPROCESSABLE_ENTITY with missing pbiId', async () => {
        const email = `add-pbi-missing-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Missing PBI Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/backlog-items`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({})
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      });
    });

    describe('DELETE /api/v1/sprints/:sprintId/backlog-items/:pbiId', () => {
      it('should remove PBI from sprint backlog', async () => {
        const email = `remove-pbi-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Remove PBI Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(
          team.id,
          `PBI to Remove ${uniqueTestId()}`,
          PBI_STATUSES.READY
        );

        await addPBIToSprintBacklog(sprint.id, pbi.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/sprints/${sprint.id}/backlog-items/${pbi.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            taskAction: 'return_to_backlog',
            reason: 'Scope reduced after review',
            goalImpact: 'SUPPORTS_GOAL',
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const { csrfCookie, csrfToken } = await getCsrfToken();

        const response = await request(app)
          .delete(
            '/api/v1/sprints/00000000-0000-0000-0000-000000000000/backlog-items/00000000-0000-0000-0000-000000000000'
          )
          .set('Cookie', csrfCookie)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Sprint State Transitions', () => {
    describe('POST /api/v1/sprints/:id/start', () => {
      it('should start a sprint successfully', async () => {
        const email = `start-sprint-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team, user } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        // A Sprint cannot start until it is linked to a Product Goal.
        await createTestProductGoalInDb(team.id, `Goal ${uniqueTestId()}`, 'ACTIVE');

        const sprint = await createTestSprintInDb(
          team.id,
          `Start Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.PLANNED
        );

        // The Sprint Backlog must be saved before the sprint can start.
        const pbi = await createTestPBIInDb(
          team.id,
          `Start PBI ${uniqueTestId()}`,
          PBI_STATUSES.READY
        );
        await addPBIToSprintBacklog(sprint.id, pbi.id);
        // Planning participation is a start gate: the PO and a Developer must be recorded present.
        await seedPlanningParticipation(sprint.id);
        // So are the team's two agreements.
        await seedTeamDefinitions(team.id, [pbi.id], user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/start`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({})
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(SPRINT_STATUSES.ACTIVE);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const { csrfCookie, csrfToken } = await getCsrfToken();

        const response = await request(app)
          .post('/api/v1/sprints/00000000-0000-0000-0000-000000000000/start')
          .set('Cookie', csrfCookie)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/sprints/:id/complete', () => {
      // Per the Scrum Guide (2020), a Sprint can only be completed once the Sprint Review and
      // Sprint Retrospective have both concluded. This helper creates a completed Sprint Review
      // and a COMPLETED Sprint Retrospective (with their linked Increment) for the sprint so the
      // complete endpoint's prerequisite-event gate is satisfied.
      const completePrerequisiteEvents = async (
        sprintId: string,
        teamId: string,
        userId: string
      ): Promise<void> => {
        const increment = await createTestIncrementInDb(sprintId, teamId);
        await createTestSprintReviewInDb(
          sprintId,
          teamId,
          increment.id,
          userId,
          undefined,
          'completed'
        );
        await createTestRetrospectiveInDb(sprintId, teamId, userId, 'COMPLETED');
      };

      it('should complete a sprint successfully', async () => {
        const email = `complete-sprint-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const sprint = await createTestSprintInDb(
          team.id,
          `Complete Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        await completePrerequisiteEvents(sprint.id, team.id, user.id);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/complete`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(SPRINT_STATUSES.COMPLETED);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const { csrfCookie, csrfToken } = await getCsrfToken();

        const response = await request(app)
          .post('/api/v1/sprints/00000000-0000-0000-0000-000000000000/complete')
          .set('Cookie', csrfCookie)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('PBI Workflow Operations', () => {
    describe('PUT /api/v1/product-backlog/:id', () => {
      it('should update PBI status', async () => {
        const email = `pbi-status-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        // Editing an item that carries no Product Goal anchors it to the team's ACTIVE
        // goal, so the team needs one for the status update to be accepted.
        await createTestProductGoalInDb(team.id, `Goal ${uniqueTestId()}`, 'ACTIVE');

        const pbi = await createTestPBIInDb(
          team.id,
          `PBI Status ${uniqueTestId()}`,
          PBI_STATUSES.NEW
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/product-backlog/${pbi.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: PBI_STATUSES.REFINED,
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(PBI_STATUSES.REFINED);
      });

      it('should return 422 UNPROCESSABLE_ENTITY with invalid status', async () => {
        const email = `pbi-invalid-status-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const pbi = await createTestPBIInDb(
          team.id,
          `PBI Invalid ${uniqueTestId()}`,
          PBI_STATUSES.NEW
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/product-backlog/${pbi.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: 'INVALID_STATUS',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle concurrent sprint state transitions', async () => {
      const email = `concurrent-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team, user } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      // A Sprint cannot start until it is linked to a Product Goal.
      await createTestProductGoalInDb(team.id, `Goal ${uniqueTestId()}`, 'ACTIVE');

      const sprint = await createTestSprintInDb(
        team.id,
        `Concurrent Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.PLANNED
      );

      // The Sprint Backlog must be saved before the sprint can start.
      const pbi = await createTestPBIInDb(
        team.id,
        `Concurrent PBI ${uniqueTestId()}`,
        PBI_STATUSES.READY
      );
      await addPBIToSprintBacklog(sprint.id, pbi.id);
      await seedPlanningParticipation(sprint.id);
      await seedTeamDefinitions(team.id, [pbi.id], user.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const startPromise1 = request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({});

      const startPromise2 = request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({});

      const [response1, response2] = await Promise.all([startPromise1, startPromise2]);

      const statusCodes = [response1.status, response2.status];
      expect(statusCodes).toContain(HTTP_STATUS.OK);
    });

    it('should handle adding same PBI to multiple sprints', async () => {
      const email = `multi-sprint-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const sprint1 = await createTestSprintInDb(
        team.id,
        `Sprint 1 ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );
      const sprint2 = await createTestSprintInDb(
        team.id,
        `Sprint 2 ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const pbi = await createTestPBIInDb(
        team.id,
        `Multi Sprint PBI ${uniqueTestId()}`,
        PBI_STATUSES.READY
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response1 = await request(app)
        .post(`/api/v1/sprints/${sprint1.id}/backlog-items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi.id,
          reason: 'Adding to sprint 1',
          goalImpact: 'SUPPORTS_GOAL',
        });

      expect(response1.body.success).toBe(true);

      const response2 = await request(app)
        .post(`/api/v1/sprints/${sprint2.id}/backlog-items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi.id,
          reason: 'Adding to sprint 2',
          goalImpact: 'SUPPORTS_GOAL',
        });

      expect(response2.body.success).toBe(false);
    });

    it('should handle retrospective with multiple items', async () => {
      const email = `multi-items-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const sprint = await createTestSprintInDb(
        team.id,
        `Multi Items Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      const retro = await createTestRetrospectiveInDb(sprint.id, team.id, user.id);

      const categories = ['WENT_WELL', 'DIDNT_GO_WELL', 'IMPROVEMENT'] as const;

      for (const category of categories) {
        await createTestRetrospectiveItemInDb(retro.id, category, `Item for ${category}`);
      }

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/retrospectives/${retro.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });

    it('should handle sprint with maximum PBIs', async () => {
      const email = `max-pbis-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const sprint = await createTestSprintInDb(
        team.id,
        `Max PBIs Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      for (let i = 0; i < 10; i++) {
        const pbi = await createTestPBIInDb(
          team.id,
          `PBI ${i} ${uniqueTestId()}`,
          PBI_STATUSES.READY
        );
        await addPBIToSprintBacklog(sprint.id, pbi.id);
      }

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/backlog-pbis`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Authorization and Permissions', () => {
    it('should reject scrum master from managing sprint backlog', async () => {
      const email = `sm-backlog-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const sprint = await createTestSprintInDb(
        team.id,
        `SM Backlog Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );
      const pbi = await createTestPBIInDb(team.id, `SM PBI ${uniqueTestId()}`, PBI_STATUSES.READY);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog-items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi.id,
          reason: 'Scrum master adding PBI',
          goalImpact: 'SUPPORTS_GOAL',
        })
        .expect(HTTP_STATUS.FORBIDDEN);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should reject product owner from managing sprint backlog', async () => {
      const email = `po-backlog-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const sprint = await createTestSprintInDb(
        team.id,
        `PO Backlog Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );
      const pbi = await createTestPBIInDb(team.id, `PO PBI ${uniqueTestId()}`, PBI_STATUSES.READY);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog-items`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi.id,
          reason: 'Product owner adding PBI',
          goalImpact: 'SUPPORTS_GOAL',
        })
        .expect(HTTP_STATUS.FORBIDDEN);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should allow developer to view sprint backlog', async () => {
      const email = `dev-view-backlog-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const sprint = await createTestSprintInDb(
        team.id,
        `Dev View Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/backlog-pbis`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });
  });
});
