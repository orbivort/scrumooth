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
  createTestIncrementInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  SPRINT_STATUSES,
  PBI_STATUSES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

describe('E2E: Increment Management', () => {
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
    const teamName = `Increment Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);
    return { user, team };
  };

  describe('GET /api/v1/increments', () => {
    it('should return increments for a team', async () => {
      const email = `get-increments-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter increments by sprint', async () => {
      const email = `filter-increments-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
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

      await createTestIncrementInDb(sprint1.id, team.id, 'Increment 1');
      await createTestIncrementInDb(sprint2.id, team.id, 'Increment 2');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments')
        .query({ teamId: team.id, sprintId: sprint1.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(
        response.body.data.every((inc: { sprintId: string }) => inc.sprintId === sprint1.id)
      ).toBe(true);
    });

    it('should return empty array for team with no increments', async () => {
      const email = `no-increments-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments')
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
        .get('/api/v1/increments')
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
        .get('/api/v1/increments')
        .query({ teamId: 'invalid-uuid' })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/increments')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });
  });

  describe('GET /api/v1/increments/:id', () => {
    it('should return increment by ID', async () => {
      const email = `get-increment-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/increments/${increment.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(increment.id);
      expect(response.body.data.name).toBe(increment.name);
    });

    it('should return 404 NOT_FOUND for non-existent increment', async () => {
      const email = `nonexistent-increment-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid increment ID format', async () => {
      const email = `invalid-id-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments/invalid-id')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/increments', () => {
    it('should create increment successfully', async () => {
      const email = `create-increment-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Sprint 1 Increment',
          description: 'Test increment description',
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Sprint 1 Increment');
      expect(response.body.data.status).toBe('DRAFT');
    });

    it('should create increment with included PBIs', async () => {
      const email = `create-with-pbis-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const pbi1 = await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`, PBI_STATUSES.DONE);
      const pbi2 = await createTestPBIInDb(team.id, `PBI 2 ${uniqueTestId()}`, PBI_STATUSES.DONE);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Increment with PBIs',
          sprintId: sprint.id,
          teamId: team.id,
          includedPBIs: [pbi1.id, pbi2.id],
          totalStoryPoints: 10,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalStoryPoints).toBe(10);
    });

    it('should refuse creating an increment that declares a non-DRAFT status', async () => {
      const email = `verified-status-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // An Increment is always created as a draft: the gates on the way to VERIFIED and DELIVERED
      // are walked, not declared.
      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Verified Increment',
          sprintId: sprint.id,
          teamId: team.id,
          status: 'VERIFIED',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing required fields', async () => {
      const email = `missing-fields-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with empty name', async () => {
      const email = `empty-name-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: '',
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with name too long', async () => {
      const email = `long-name-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'a'.repeat(201),
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid status', async () => {
      const email = `invalid-status-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test Increment',
          sprintId: sprint.id,
          teamId: team.id,
          status: 'INVALID_STATUS',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with negative story points', async () => {
      const email = `negative-points-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test Increment',
          sprintId: sprint.id,
          teamId: team.id,
          totalStoryPoints: -5,
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test',
          sprintId: '00000000-0000-0000-0000-000000000000',
          teamId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/increments/:id', () => {
    it('should update increment successfully', async () => {
      const email = `update-increment-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/increments/${increment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Updated Increment Name',
          description: 'Updated description',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Increment Name');
    });

    it('should update increment status', async () => {
      const email = `update-status-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Test', 'DRAFT', {
        integrationVerified: true,
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      // The usable condition is attested before VERIFIED becomes reachable.
      await request(app)
        .post(`/api/v1/increments/${increment.id}/verify-usability`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ evidence: 'Exercised by the Product Owner in the staging environment' })
        .expect(HTTP_STATUS.OK);

      const response = await request(app)
        .put(`/api/v1/increments/${increment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          status: 'VERIFIED',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('VERIFIED');
    });

    it('should update increment with new PBIs', async () => {
      const email = `update-pbis-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id);
      const pbi = await createTestPBIInDb(team.id, `PBI ${uniqueTestId()}`, PBI_STATUSES.DONE);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/increments/${increment.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          includedPBIs: [pbi.id],
          totalStoryPoints: 5,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalStoryPoints).toBe(5);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid increment ID', async () => {
      const email = `invalid-id-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put('/api/v1/increments/invalid-id')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .put('/api/v1/increments/00000000-0000-0000-0000-000000000000')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test',
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/increments/:id/deliver', () => {
    it('should deliver increment via sprint review', async () => {
      const email = `deliver-review-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Test', 'VERIFIED', {
        integrationVerified: true,
        usabilityVerified: true,
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
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('DELIVERED');
      expect(response.body.data.deliveryMethod).toBe('SPRINT_REVIEW');
    });

    it('should deliver increment via early release', async () => {
      const email = `deliver-early-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id, 'Test', 'VERIFIED', {
        integrationVerified: true,
        usabilityVerified: true,
      });

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${increment.id}/deliver`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          deliveryMethod: 'early_release',
          notes: 'Released early due to stakeholder request',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('DELIVERED');
      expect(response.body.data.deliveryMethod).toBe('EARLY_RELEASE');
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid delivery method', async () => {
      const email = `invalid-method-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${increment.id}/deliver`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          deliveryMethod: 'invalid_method',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing delivery method', async () => {
      const email = `missing-method-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const increment = await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/increments/${increment.id}/deliver`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({})
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with invalid increment ID', async () => {
      const email = `invalid-id-deliver-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments/invalid-id/deliver')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          deliveryMethod: 'sprint_review',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const { csrfCookie, csrfToken } = await getCsrfToken();

      const response = await request(app)
        .post('/api/v1/increments/00000000-0000-0000-0000-000000000000/deliver')
        .set('Cookie', csrfCookie)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          deliveryMethod: 'sprint_review',
        })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/increments/metrics', () => {
    it('should return increment metrics for a team', async () => {
      const email = `metrics-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.COMPLETED
      );

      await createTestIncrementInDb(sprint.id, team.id, 'Inc 1', 'DELIVERED');
      await createTestIncrementInDb(sprint.id, team.id, 'Inc 2', 'DRAFT');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments/metrics')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalIncrements');
      expect(response.body.data).toHaveProperty('deliveredIncrements');
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing teamId', async () => {
      const email = `metrics-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments/metrics')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/increments/metrics')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle increment with maximum description length', async () => {
      const email = `max-desc-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test Increment',
          description: 'a'.repeat(2000),
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with description too long', async () => {
      const email = `desc-too-long-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test Increment',
          description: 'a'.repeat(2001),
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should handle increment with special characters in name', async () => {
      const email = `special-chars-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Increment #1 - "Sprint Alpha" & <Beta>',
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should handle increment with unicode characters', async () => {
      const email = `unicode-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: '增量版本 🚀 日本語版',
          description: '测试描述 with emoji 🎉',
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('增量版本 🚀 日本語版');
    });

    it('should handle updating non-existent increment', async () => {
      const email = `update-nonexistent-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put('/api/v1/increments/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'Test',
        });

      expect(response.body.success).toBe(false);
    });

    it('should handle delivering non-existent increment', async () => {
      const email = `deliver-nonexistent-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments/00000000-0000-0000-0000-000000000000/deliver')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          deliveryMethod: 'sprint_review',
        });

      expect(response.body.success).toBe(false);
    });
  });

  describe('Authorization and Permissions', () => {
    it('should allow product owner to create increment', async () => {
      const email = `po-create-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'PO Increment',
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should allow scrum master to create increment', async () => {
      const email = `sm-create-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.SCRUM_MASTER);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/increments')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          name: 'SM Increment',
          sprintId: sprint.id,
          teamId: team.id,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });

    it('should allow developer to view increments', async () => {
      const email = `dev-view-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);
      const sprint = await createTestSprintInDb(
        team.id,
        `Sprint ${uniqueTestId()}`,
        SPRINT_STATUSES.ACTIVE
      );

      await createTestIncrementInDb(sprint.id, team.id);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/increments')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });
  });
});
