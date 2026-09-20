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
  createTestPBIInDb,
  createTestProductGoalInDb,
  createTestTaskInDb,
  createTestIncrementInDb,
  createTestSprintReviewInDb,
  createTestRetrospectiveInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  SPRINT_STATUSES,
  PBI_STATUSES,
  TASK_STATUSES,
  generateTestUUID,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

describe('E2E: Sprint Management', () => {
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
    const teamName = `Sprint Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('GET /api/v1/sprints', () => {
    it('should return sprints for a team', async () => {
      const email = `sprints-list-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      await createTestSprintInDb(team.id, `Sprint 1 ${uniqueTestId()}`);
      await createTestSprintInDb(team.id, `Sprint 2 ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/sprints')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing teamId', async () => {
      const email = `sprints-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('GET /api/v1/sprints/active', () => {
    it('should return active sprint for a team', async () => {
      const email = `active-sprint-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      await createTestSprintInDb(
        team.id,
        `Planned Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.PLANNED
      );
      await createTestSprintInDb(
        team.id,
        `Active Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints/active')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(SPRINT_STATUSES.ACTIVE);
    });

    it('should return null when no active sprint exists', async () => {
      const email = `no-active-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      await createTestSprintInDb(
        team.id,
        `Planned Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.PLANNED
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints/active')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /api/v1/sprints/available-pbis', () => {
    it('should return available PBIs for sprint planning', async () => {
      const email = `available-pbis-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      await createTestPBIInDb(team.id, `Ready PBI ${uniqueTestId()}`, PBI_STATUSES.READY);
      await createTestPBIInDb(team.id, `New PBI ${uniqueTestId()}`, PBI_STATUSES.NEW);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints/available-pbis')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/sprints', () => {
    it('should create a new sprint successfully', async () => {
      const email = `create-sprint-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const teamName = testTeamNames[0];
      const team = await prisma.team.findFirst({ where: { name: teamName } });

      const sprintName = `New Sprint ${uniqueTestId()}`;
      const startDate = new Date();
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/api/v1/sprints')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team!.id,
          name: sprintName,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          sprintGoal: 'Test sprint goal',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(sprintName);
      expect(response.body.data.status).toBe(SPRINT_STATUSES.PLANNED);
    });

    it('should reject sprint with end date before start date', async () => {
      const email = `invalid-dates-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const startDate = new Date();
      const endDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Database constraint violation returns 500 Internal Server Error
      const response = await request(app)
        .post('/api/v1/sprints')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          name: `Backward Dates Sprint ${uniqueTestId()}`,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 VALIDATION_ERROR with empty name', async () => {
      const email = `empty-sprint-name-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/sprints')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          name: '',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('GET /api/v1/sprints/:id', () => {
    it('should return sprint by ID', async () => {
      const email = `get-sprint-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const sprint = await createTestSprintInDb(team.id, `Get Sprint ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sprint.id);
      expect(response.body.data.name).toBe(sprint.name);
    });

    it('should return 404 NOT_FOUND for non-existent sprint', async () => {
      const email = `nonexistent-sprint-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('should return 422 UNPROCESSABLE_ENTITY for invalid sprint ID format', async () => {
      const email = `invalid-sprint-id-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/sprints/invalid-id')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/sprints/:id/start', () => {
    it('should start a planned sprint successfully', async () => {
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
      const pbi = await createTestPBIInDb(
        team.id,
        `PBI for Sprint ${uniqueTestId()}`,
        PBI_STATUSES.READY
      );

      // The Sprint Backlog must be saved before the sprint can start.
      await prisma.sprintBacklogItem.create({
        data: {
          id: generateTestUUID(),
          sprintId: sprint.id,
          pbiId: pbi.id,
          createdBy: user.id,
        },
      });

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

    it('should return 400 BAD_REQUEST when starting already active sprint', async () => {
      const email = `start-active-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const sprint = await createTestSprintInDb(
        team.id,
        `Already Active ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/start`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
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

    it('should complete an active sprint successfully', async () => {
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

    it('should return 400 BAD_REQUEST when completing non-active sprint', async () => {
      const email = `complete-planned-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const sprint = await createTestSprintInDb(
        team.id,
        `Planned Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.PLANNED
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/complete`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    });
  });

  describe('POST /api/v1/sprints/:id/cancel', () => {
    it('should cancel a sprint with reason', async () => {
      const email = `cancel-sprint-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const sprint = await createTestSprintInDb(
        team.id,
        `Cancel Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/cancel`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          reason: 'Business priorities changed',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(SPRINT_STATUSES.CANCELLED);
      expect(response.body.data.cancellationReason).toBe('Business priorities changed');
    });

    it('should return 422 VALIDATION_ERROR without cancellation reason', async () => {
      const email = `cancel-no-reason-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

      const sprint = await createTestSprintInDb(
        team.id,
        `Cancel No Reason ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/cancel`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('GET /api/v1/sprints/:sprintId/burndown', () => {
    it('should return burndown data for active sprint', async () => {
      const email = `burndown-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const sprint = await createTestSprintInDb(
        team.id,
        `Burndown Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/burndown`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('dates');
      expect(response.body.data).toHaveProperty('ideal');
      expect(response.body.data).toHaveProperty('actual');
    });
  });

  describe('Sprint Tasks', () => {
    describe('GET /api/v1/sprints/:sprintId/tasks', () => {
      it('should return tasks for a sprint', async () => {
        const email = `tasks-list-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Tasks Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Tasks ${uniqueTestId()}`);

        await createTestTaskInDb(sprint.id, pbi.id, `Task 1 ${uniqueTestId()}`);
        await createTestTaskInDb(sprint.id, pbi.id, `Task 2 ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/sprints/${sprint.id}/tasks`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('POST /api/v1/sprints/:sprintId/tasks', () => {
      it('should create a new task in sprint', async () => {
        const email = `create-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Create Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Task ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const taskTitle = `New Task ${uniqueTestId()}`;

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/tasks`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            pbiId: pbi.id,
            title: taskTitle,
            description: 'Task description',
            estimatedHours: 8,
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.title).toBe(taskTitle);
        expect(response.body.data.status).toBe(TASK_STATUSES.TODO);
      });

      it('should return 422 VALIDATION_ERROR with empty task title', async () => {
        const email = `empty-task-title-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Empty Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Empty Task ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post(`/api/v1/sprints/${sprint.id}/tasks`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            pbiId: pbi.id,
            title: '',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      });
    });

    describe('PUT /api/v1/sprints/:sprintId/tasks/:taskId', () => {
      it('should update task status successfully', async () => {
        const email = `update-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Update Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Update ${uniqueTestId()}`);

        const task = await createTestTaskInDb(
          sprint.id,
          pbi.id,
          `Task to Update ${uniqueTestId()}`
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: TASK_STATUSES.IN_PROGRESS,
            remainingHours: 6,
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(TASK_STATUSES.IN_PROGRESS);
      });

      it('should move a task to REVIEW for peer review', async () => {
        const email = `done-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Done Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Done ${uniqueTestId()}`);

        const task = await createTestTaskInDb(
          sprint.id,
          pbi.id,
          `Task to Done ${uniqueTestId()}`,
          TASK_STATUSES.IN_PROGRESS
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // With peer review enabled, a Developer can no longer jump straight from
        // IN_PROGRESS to DONE; the task must first move to REVIEW for peer approval.
        const response = await request(app)
          .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: TASK_STATUSES.REVIEW,
            remainingHours: 4,
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(TASK_STATUSES.REVIEW);
      });

      it('should move a task to REVIEW and have a peer approve it to DONE', async () => {
        const email = `review-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
        const sprint = await createTestSprintInDb(
          team.id,
          `Review Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Review ${uniqueTestId()}`);

        // The assignee is the logged-in user (so they cannot self-approve below).
        const task = await createTestTaskInDb(
          sprint.id,
          pbi.id,
          `Task to Review ${uniqueTestId()}`,
          TASK_STATUSES.IN_PROGRESS
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        // IN_PROGRESS → REVIEW
        const reviewResponse = await request(app)
          .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: TASK_STATUSES.REVIEW,
            remainingHours: 4,
          })
          .expect(HTTP_STATUS.OK);

        expect(reviewResponse.body.success).toBe(true);
        expect(reviewResponse.body.data.status).toBe(TASK_STATUSES.REVIEW);

        // A different team member (reviewer) approves REVIEW → DONE.
        const reviewerEmail = `reviewer-${uniqueTestId()}@example.com`;
        testEmails.push(reviewerEmail);
        const reviewer = await createTestUser(reviewerEmail);
        await addTeamMember(team.id, reviewer.id, ROLES.DEVELOPERS);
        const reviewerCookies = await loginAndGetCookies(reviewerEmail);
        const reviewerCsrf = extractCsrfFromCookies(reviewerCookies).csrfToken;

        const doneResponse = await request(app)
          .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', reviewerCookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, reviewerCsrf)
          .send({
            status: TASK_STATUSES.DONE,
            remainingHours: 0,
          })
          .expect(HTTP_STATUS.OK);

        expect(doneResponse.body.success).toBe(true);
        expect(doneResponse.body.data.status).toBe(TASK_STATUSES.DONE);
      });

      it('should reject the assignee self-approving REVIEW → DONE with 403', async () => {
        const email = `self-review-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
        const sprint = await createTestSprintInDb(
          team.id,
          `Self Review Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Self Review ${uniqueTestId()}`);

        // The assignee IS the logged-in user.
        const task = await createTestTaskInDb(
          sprint.id,
          pbi.id,
          `Self Review Task ${uniqueTestId()}`,
          TASK_STATUSES.REVIEW,
          user.id
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: TASK_STATUSES.DONE,
            remainingHours: 0,
          })
          .expect(HTTP_STATUS.FORBIDDEN);

        expect(response.body.success).toBe(false);
      });

      it('should allow the assignee to send their own REVIEW task back to IN_PROGRESS (rework)', async () => {
        const email = `rework-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
        const sprint = await createTestSprintInDb(
          team.id,
          `Rework Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Rework ${uniqueTestId()}`);

        const task = await createTestTaskInDb(
          sprint.id,
          pbi.id,
          `Rework Task ${uniqueTestId()}`,
          TASK_STATUSES.REVIEW,
          user.id
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            status: TASK_STATUSES.IN_PROGRESS,
            remainingHours: 6,
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe(TASK_STATUSES.IN_PROGRESS);
      });
    });

    describe('DELETE /api/v1/sprints/:sprintId/tasks/:taskId', () => {
      it('should delete a task successfully', async () => {
        const email = `delete-task-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Delete Task Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );
        const pbi = await createTestPBIInDb(team.id, `PBI for Delete ${uniqueTestId()}`);

        const task = await createTestTaskInDb(
          sprint.id,
          pbi.id,
          `Task to Delete ${uniqueTestId()}`
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/sprints/${sprint.id}/tasks/${task.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);

        const taskCheck = await prisma.task.findUnique({
          where: { id: task.id },
        });
        expect(taskCheck).toBeNull();
      });
    });
  });

  describe('Sprint Backlog Items', () => {
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
    });

    describe('POST /api/v1/sprints/:sprintId/backlog-items', () => {
      it('should add PBI to sprint backlog during active sprint', async () => {
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
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
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

        await prisma.sprintBacklogItem.create({
          data: {
            id: generateTestUUID(),
            sprintId: sprint.id,
            pbiId: pbi.id,
          },
        });

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/sprints/${sprint.id}/backlog-items/${pbi.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            taskAction: 'return_to_backlog',
            reason: 'Scope reduction',
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/sprints/:sprintId/backlog-changes', () => {
      it('should return sprint backlog change history', async () => {
        const email = `backlog-changes-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const sprint = await createTestSprintInDb(
          team.id,
          `Changes Sprint ${uniqueTestId()}`,
          SPRINT_STATUSES.ACTIVE
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/sprints/${sprint.id}/backlog-changes`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });
  });

  describe('Sprint Eligible PBIs for Increment', () => {
    it('should return eligible PBIs for increment', async () => {
      const email = `eligible-pbis-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const sprint = await createTestSprintInDb(
        team.id,
        `Eligible Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/sprints/${sprint.id}/eligible-pbis`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
