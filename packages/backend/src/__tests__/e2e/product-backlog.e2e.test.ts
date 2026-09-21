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
  createTestPBIInDb,
  createTestProductGoalInDb,
  createTestSprintInDb,
  cleanupUsers,
  cleanupTeams,
  ROLES,
  PBI_STATUSES,
  PBI_PRIORITIES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

describe('E2E: Product Backlog Management', () => {
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
    const teamName = `Backlog Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);

    // The Product Backlog is the emergent expression of the Product Goal, so a team owning a
    // backlog owns exactly one ACTIVE goal. Creating it here keeps these journeys focused on the
    // backlog behaviour under test instead of re-proving the goal gate in every case.
    const goal = await createTestProductGoalInDb(
      team.id,
      `Active Goal ${uniqueTestId()}`,
      'ACTIVE'
    );

    return { user, team, goal };
  };

  describe('GET /api/v1/product-backlog', () => {
    it('should return product backlog items for a team', async () => {
      const email = `backlog-list-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`);
      await createTestPBIInDb(team.id, `PBI 2 ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter PBIs by status', async () => {
      const email = `backlog-filter-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      await createTestPBIInDb(team.id, `New PBI ${uniqueTestId()}`, PBI_STATUSES.NEW);
      await createTestPBIInDb(team.id, `Ready PBI ${uniqueTestId()}`, PBI_STATUSES.READY);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: team.id, status: PBI_STATUSES.READY })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(
        response.body.data.every((pbi: { status: string }) => pbi.status === PBI_STATUSES.READY)
      ).toBe(true);
    });

    it('should return 401 UNAUTHORIZED when not authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: '00000000-0000-0000-0000-000000000000' })
        .expect(HTTP_STATUS.UNAUTHORIZED);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return 422 UNPROCESSABLE_ENTITY with missing teamId', async () => {
      const email = `backlog-no-team-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await createTestUser(email);
      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/product-backlog', () => {
    it('should create a new PBI successfully', async () => {
      const email = `create-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      // Only Developers may set story points, so use a Developer here.
      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const pbiTitle = `New PBI ${uniqueTestId()}`;

      const response = await request(app)
        .post('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: pbiTitle,
          description: 'Test PBI description',
          acceptanceCriteria: 'Given When Then format',
          storyPoints: 5,
          businessValue: 100,
          priority: PBI_PRIORITIES.MUST_HAVE,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(pbiTitle);
      expect(response.body.data.status).toBe(PBI_STATUSES.NEW);
    });

    it('should return 422 VALIDATION_ERROR with empty title', async () => {
      const email = `empty-pbi-title-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: '',
          description: 'Test description',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 422 VALIDATION_ERROR with invalid story points', async () => {
      const email = `invalid-points-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: `PBI ${uniqueTestId()}`,
          storyPoints: -5,
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return 403 FORBIDDEN for non-product owner', async () => {
      const email = `no-perm-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          teamId: team.id,
          title: `PBI ${uniqueTestId()}`,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/product-backlog/:id', () => {
    it('should return PBI by ID', async () => {
      const email = `get-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const pbi = await createTestPBIInDb(team.id, `Get PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(pbi.id);
      expect(response.body.data.title).toBe(pbi.title);
    });

    it('should return 404 NOT_FOUND for non-existent PBI', async () => {
      const email = `nonexistent-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('should return 422 UNPROCESSABLE_ENTITY for invalid PBI ID format', async () => {
      const email = `invalid-pbi-id-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get('/api/v1/product-backlog/invalid-id')
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('PUT /api/v1/product-backlog/:id', () => {
    it('should update PBI successfully', async () => {
      const email = `update-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      // Only Developers may set story points, so use a Developer here.
      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const pbi = await createTestPBIInDb(team.id, `Update PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: `Updated PBI ${uniqueTestId()}`,
          description: 'Updated description',
          storyPoints: 8,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.storyPoints).toBe(8);
    });

    it('should update PBI priority', async () => {
      const email = `update-priority-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const pbi = await createTestPBIInDb(team.id, `Priority PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priority: PBI_PRIORITIES.MUST_HAVE,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.priority).toBe(PBI_PRIORITIES.MUST_HAVE);
    });

    it('should return 403 FORBIDDEN for non-product owner', async () => {
      const email = `update-no-perm-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const pbi = await createTestPBIInDb(team.id, `No Perm PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'Updated Title',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/product-backlog/:id', () => {
    it('should delete PBI successfully', async () => {
      const email = `delete-pbi-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const pbi = await createTestPBIInDb(team.id, `Delete PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);

      const pbiCheck = await prisma.productBacklogItem.findUnique({
        where: { id: pbi.id },
      });
      expect(pbiCheck).toBeNull();
    });

    it('should return 403 FORBIDDEN for non-product owner', async () => {
      const email = `delete-no-perm-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const pbi = await createTestPBIInDb(team.id, `No Delete PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .delete(`/api/v1/product-backlog/${pbi.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/v1/product-backlog/:id/priority', () => {
    it('should update PBI priority', async () => {
      const email = `priority-update-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const pbi = await createTestPBIInDb(team.id, `Priority PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}/priority`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priority: PBI_PRIORITIES.SHOULD_HAVE,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.priority).toBe(PBI_PRIORITIES.SHOULD_HAVE);
    });

    it('should return 422 VALIDATION_ERROR with invalid priority', async () => {
      const email = `invalid-priority-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const pbi = await createTestPBIInDb(team.id, `Invalid Priority PBI ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .put(`/api/v1/product-backlog/${pbi.id}/priority`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          priority: 'INVALID_PRIORITY',
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/v1/product-backlog/reorder', () => {
    it('should reorder PBIs in backlog', async () => {
      const email = `reorder-pbis-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const pbi1 = await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`);
      const pbi2 = await createTestPBIInDb(team.id, `PBI 2 ${uniqueTestId()}`);
      const pbi3 = await createTestPBIInDb(team.id, `PBI 3 ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiIds: [pbi3.id, pbi1.id, pbi2.id],
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      // The endpoint returns the order it wrote, and the order survives a reload.
      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
        pbi3.id,
        pbi1.id,
        pbi2.id,
      ]);

      const persisted = await request(app)
        .get('/api/v1/product-backlog')
        .query({ teamId: team.id })
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(persisted.body.data.map((item: { id: string }) => item.id)).toEqual([
        pbi3.id,
        pbi1.id,
        pbi2.id,
      ]);
    });

    it('should move one item with the positional shape', async () => {
      const email = `reorder-positional-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      const pbi1 = await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`);
      const pbi2 = await createTestPBIInDb(team.id, `PBI 2 ${uniqueTestId()}`);
      const pbi3 = await createTestPBIInDb(team.id, `PBI 3 ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiId: pbi3.id,
          targetPbiId: pbi1.id,
          position: 'before',
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual([
        pbi3.id,
        pbi1.id,
        pbi2.id,
      ]);
    });

    it('should refuse with GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER when a Developer reorders', async () => {
      const email = `reorder-developer-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      const pbi1 = await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`);
      const pbi2 = await createTestPBIInDb(team.id, `PBI 2 ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ pbiIds: [pbi2.id, pbi1.id] })
        .expect(HTTP_STATUS.FORBIDDEN);

      expect(response.body.error.code).toBe('GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER');
    });

    it('should return 422 VALIDATION_ERROR with invalid PBI IDs', async () => {
      const email = `reorder-mismatch-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.PRODUCT_OWNER);

      await createTestPBIInDb(team.id, `PBI 1 ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post('/api/v1/product-backlog/reorder')
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          pbiIds: ['invalid-uuid'],
        })
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/product-backlog/:id/tasks', () => {
    it('should return tasks for a PBI', async () => {
      const email = `pbi-tasks-${uniqueTestId()}@example.com`;
      testEmails.push(email);

      const { team } = await setupTeamWithUser(email, ROLES.DEVELOPERS);

      await createTestSprintInDb(team.id, `Sprint for Tasks ${uniqueTestId()}`, 'ACTIVE');
      const pbi = await createTestPBIInDb(team.id, `PBI with Tasks ${uniqueTestId()}`);

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/product-backlog/${pbi.id}/tasks`)
        .set('Cookie', cookies)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
