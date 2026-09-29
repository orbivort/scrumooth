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
  createTestProductGoalInDb,
  createTestImpedimentInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

describe('E2E: Goals and Impediments', () => {
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
    const teamName = `Goals Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('Product Goals', () => {
    describe('GET /api/v1/product-goals', () => {
      it('should return product goals for a team', async () => {
        const email = `goals-list-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

        await createTestProductGoalInDb(team.id, `Goal 1 ${uniqueTestId()}`);
        await createTestProductGoalInDb(team.id, `Goal 2 ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/product-goals')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter goals by status', async () => {
        const email = `goals-filter-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

        await createTestProductGoalInDb(team.id, `New Goal ${uniqueTestId()}`, 'NEW');
        await createTestProductGoalInDb(team.id, `Active Goal ${uniqueTestId()}`, 'ACTIVE');

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/product-goals')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const { csrfCookie, csrfToken } = await getCsrfToken();
        const response = await request(app)
          .get('/api/v1/product-goals')
          .set('Cookie', csrfCookie)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .query({ teamId: '00000000-0000-0000-0000-000000000000' })
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      });

      it('should return 400 BAD_REQUEST with missing teamId', async () => {
        const email = `goals-no-team-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        await createTestUser(email);
        const cookies = await loginAndGetCookies(email);

        const response = await request(app).get('/api/v1/product-goals').set('Cookie', cookies);

        expect([HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.UNPROCESSABLE_ENTITY]).toContain(
          response.status
        );
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/v1/product-goals', () => {
      it('should create a new product goal successfully', async () => {
        const email = `create-goal-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const goalTitle = `New Goal ${uniqueTestId()}`;

        const response = await request(app)
          .post('/api/v1/product-goals')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            teamId: team.id,
            title: goalTitle,
            description: 'Test goal description',
            successMetrics: 'Metric 1, Metric 2',
            targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.title).toBe(goalTitle);
        expect(response.body.data.status).toBe('NEW');
      });

      it('should return 422 VALIDATION_ERROR with empty title', async () => {
        const email = `empty-goal-title-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post('/api/v1/product-goals')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            teamId: team.id,
            title: '',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      });

      it('should refuse creation by a non-Product-Owner member', async () => {
        const email = `no-perm-goal-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post('/api/v1/product-goals')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            teamId: team.id,
            title: `Goal ${uniqueTestId()}`,
            // Required by the Product Goal contract; the payload is otherwise valid so the
            // response is the Product Owner gate rather than a validation failure.
            successMetrics: 'Test success metrics',
          })
          .expect(HTTP_STATUS.FORBIDDEN);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL');
      });
    });

    describe('GET /api/v1/product-goals/:id', () => {
      it('should return goal by ID', async () => {
        const email = `get-goal-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const goal = await createTestProductGoalInDb(team.id, `Get Goal ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/product-goals/${goal.id}`)
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(goal.id);
        expect(response.body.data.title).toBe(goal.title);
      });

      it('should return 404 NOT_FOUND for non-existent goal', async () => {
        const email = `nonexistent-goal-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/product-goals/00000000-0000-0000-0000-000000000000')
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.NOT_FOUND);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      });
    });

    describe('PUT /api/v1/product-goals/:id', () => {
      it('should update goal successfully', async () => {
        const email = `update-goal-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

        const goal = await createTestProductGoalInDb(team.id, `Update Goal ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/product-goals/${goal.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            title: `Updated Goal ${uniqueTestId()}`,
            description: 'Updated description',
          })
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });

      it('should return 403 FORBIDDEN for non-product owner', async () => {
        const email = `update-no-perm-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const goal = await createTestProductGoalInDb(team.id, `No Perm Goal ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .put(`/api/v1/product-goals/${goal.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            title: 'Updated Title',
          })
          .expect(HTTP_STATUS.FORBIDDEN);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL');
      });
    });

    describe('DELETE /api/v1/product-goals/:id', () => {
      it('should delete a goal', async () => {
        const email = `delete-goal-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

        const goal = await createTestProductGoalInDb(team.id, `Delete Goal ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/product-goals/${goal.id}`)
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);

        const goalCheck = await prisma.productGoal.findUnique({
          where: { id: goal.id },
        });
        expect(goalCheck).toBeNull();
      });
    });
  });

  describe('Impediments', () => {
    describe('GET /api/v1/impediments', () => {
      it('should return impediments for a team', async () => {
        const email = `impediments-list-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        await createTestImpedimentInDb(team.id, user.id, `Impediment 1 ${uniqueTestId()}`);
        await createTestImpedimentInDb(team.id, user.id, `Impediment 2 ${uniqueTestId()}`);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/impediments')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      });

      it('should return 401 UNAUTHORIZED when not authenticated', async () => {
        const { csrfCookie, csrfToken } = await getCsrfToken();
        const response = await request(app)
          .get('/api/v1/impediments')
          .set('Cookie', csrfCookie)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .query({ teamId: '00000000-0000-0000-0000-000000000000' })
          .expect(HTTP_STATUS.UNAUTHORIZED);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      });
    });

    describe('POST /api/v1/impediments', () => {
      it('should create a new impediment successfully', async () => {
        const email = `create-impediment-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const impedimentTitle = `New Impediment ${uniqueTestId()}`;

        const response = await request(app)
          .post('/api/v1/impediments')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            teamId: team.id,
            title: impedimentTitle,
            description: 'Test impediment description',
            severity: 'HIGH',
          })
          .expect(HTTP_STATUS.CREATED);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.title).toBe(impedimentTitle);
      });

      it('should return 422 VALIDATION_ERROR with empty title', async () => {
        const email = `empty-impediment-title-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .post('/api/v1/impediments')
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .send({
            teamId: team.id,
            title: '',
          })
          .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      });
    });

    describe('GET /api/v1/impediments/:id', () => {
      it('should return impediment by ID', async () => {
        const email = `get-impediment-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const impediment = await createTestImpedimentInDb(
          team.id,
          user.id,
          `Get Impediment ${uniqueTestId()}`
        );

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get(`/api/v1/impediments/${impediment.id}`)
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(impediment.id);
      });

      it('should return 404 NOT_FOUND for non-existent impediment', async () => {
        const email = `nonexistent-impediment-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const cookies = await loginAndGetCookies(email);

        const response = await request(app)
          .get('/api/v1/impediments/00000000-0000-0000-0000-000000000000')
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .expect(HTTP_STATUS.NOT_FOUND);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/v1/impediments/:id', () => {
      it('should update impediment successfully', async () => {
        const email = `update-impediment-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

        const impediment = await createTestImpedimentInDb(
          team.id,
          user.id,
          `Update Impediment ${uniqueTestId()}`
        );

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
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });

    describe('DELETE /api/v1/impediments/:id', () => {
      it('should delete an impediment', async () => {
        const email = `delete-impediment-${uniqueTestId()}@example.com`;
        testEmails.push(email);

        const { user, team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);

        const impediment = await createTestImpedimentInDb(
          team.id,
          user.id,
          `Delete Impediment ${uniqueTestId()}`
        );

        const cookies = await loginAndGetCookies(email);
        const { csrfToken } = extractCsrfFromCookies(cookies);

        const response = await request(app)
          .delete(`/api/v1/impediments/${impediment.id}`)
          .query({ teamId: team.id })
          .set('Cookie', cookies)
          .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
      });
    });
  });
});
