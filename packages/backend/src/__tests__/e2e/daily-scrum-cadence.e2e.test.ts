import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { GATE_CODES } from '@scrumooth/shared';
import {
  uniqueTestId,
  HTTP_STATUS,
  DEFAULT_PASSWORD,
  createTestUser,
  createTestTeamInDb,
  addTeamMember,
  createTestSprintInDb,
  createTestPBIInDb,
  addPBIToSprintBacklog,
  cleanupUsers,
  cleanupTeams,
  cleanupSprints,
  cleanupPbis,
  ROLES,
  getCsrfToken,
  extractCsrfFromCookies,
  CSRF_CONSTANTS,
} from '@e2e-helpers';

/**
 * End-to-end coverage for the two commitments that turned the Daily Scrum's cadence and its
 * adaptation outcome from implied into observable: the team's standing "same time and place
 * every working day" commitment, and the requirement that a record declare what the event
 * concluded about the Sprint Backlog.
 */
describe('E2E: Daily Scrum cadence and adaptation evidence', () => {
  const testEmails: string[] = [];
  const testTeamNames: string[] = [];
  const testSprintIds: string[] = [];
  const testPbiIds: string[] = [];

  afterEach(async () => {
    await cleanupSprints(testSprintIds);
    await cleanupPbis(testPbiIds);
    await cleanupTeams(testTeamNames);
    await cleanupUsers(testEmails);
    testEmails.length = 0;
    testTeamNames.length = 0;
    testSprintIds.length = 0;
    testPbiIds.length = 0;
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

  /**
   * Authenticate as a member of one team. The team is identified by the `X-Team-Id` header, which
   * is the point: none of the requests below sends a team identifier in a body or a query, so a
   * schedule can only ever be read or written for the team the caller actually belongs to.
   */
  const asMember = async (
    role: (typeof ROLES)[keyof typeof ROLES] = ROLES.SCRUM_MASTER
  ): Promise<{ cookies: string[]; teamId: string; userId: string }> => {
    const email = `cadence-${uniqueTestId()}@example.com`;
    testEmails.push(email);
    const user = await createTestUser(email);

    const teamName = `Cadence Team ${uniqueTestId()}`;
    testTeamNames.push(teamName);
    const team = await createTestTeamInDb(teamName);
    await addTeamMember(team.id, user.id, role);

    return { cookies: await loginAndGetCookies(email), teamId: team.id, userId: user.id };
  };

  const call = (method: 'get' | 'put' | 'post', path: string, cookies: string[], teamId: string) =>
    request(app)
      [method](path)
      .set('Cookie', cookies)
      .set('X-Team-Id', teamId)
      // Mutating requests are CSRF-protected; a GET ignores the header.
      .set(CSRF_CONSTANTS.HEADER_NAME, extractCsrfFromCookies(cookies).csrfToken);

  describe('PUT /api/v1/daily-scrum-schedule', () => {
    it('records the commitment for the Scrum Master and publishes it to the team', async () => {
      const { cookies, teamId } = await asMember(ROLES.SCRUM_MASTER);

      const saveResponse = await call('put', '/api/v1/daily-scrum-schedule', cookies, teamId)
        .send({
          timezone: 'Europe/Berlin',
          startMinute: 570,
          location: 'Room 4',
          workingDays: [1, 2, 3, 4, 5],
        })
        .expect(HTTP_STATUS.OK);

      expect(saveResponse.body.success).toBe(true);
      expect(saveResponse.body.data).toMatchObject({
        teamId,
        timezone: 'Europe/Berlin',
        startMinute: 570,
        location: 'Room 4',
        workingDays: [1, 2, 3, 4, 5],
      });

      const readResponse = await call(
        'get',
        '/api/v1/daily-scrum-schedule',
        cookies,
        teamId
      ).expect(HTTP_STATUS.OK);

      expect(readResponse.body.data.startMinute).toBe(570);
    });

    it('revises the commitment rather than creating a second one', async () => {
      const { cookies, teamId } = await asMember(ROLES.SCRUM_MASTER);

      await call('put', '/api/v1/daily-scrum-schedule', cookies, teamId)
        .send({
          timezone: 'UTC',
          startMinute: 540,
          location: 'Room 4',
          workingDays: [1, 2, 3, 4, 5],
        })
        .expect(HTTP_STATUS.OK);

      await call('put', '/api/v1/daily-scrum-schedule', cookies, teamId)
        .send({
          timezone: 'UTC',
          startMinute: 600,
          location: 'Room 5',
          workingDays: [1, 2, 3, 4],
        })
        .expect(HTTP_STATUS.OK);

      const rows = await prisma.dailyScrumSchedule.findMany({ where: { teamId } });
      expect(rows).toHaveLength(1);
    });

    it('refuses a schedule that records no place at all', async () => {
      const { cookies, teamId } = await asMember(ROLES.SCRUM_MASTER);

      const response = await call('put', '/api/v1/daily-scrum-schedule', cookies, teamId).send({
        timezone: 'Europe/Berlin',
        startMinute: 570,
        location: null,
        locationUrl: null,
      });

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.success).toBe(false);
    });

    it('refuses a Developer, and writes nothing', async () => {
      const { cookies, teamId } = await asMember(ROLES.DEVELOPERS);

      const response = await call('put', '/api/v1/daily-scrum-schedule', cookies, teamId).send({
        timezone: 'UTC',
        startMinute: 540,
        location: 'Room 4',
        workingDays: [1, 2, 3, 4, 5],
      });

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);

      const readResponse = await call(
        'get',
        '/api/v1/daily-scrum-schedule',
        cookies,
        teamId
      ).expect(HTTP_STATUS.OK);
      expect(readResponse.body.data).toBeNull();
    });
  });

  describe('GET /api/v1/daily-scrums/:sprintId/cadence', () => {
    it('reports a recorded non-working day and counts the Sprint on the team calendar', async () => {
      const { cookies, teamId } = await asMember(ROLES.SCRUM_MASTER);

      // A two-week Sprint, Monday 2026-09-07 through Friday 2026-09-18: ten working days, or
      // nine once the holiday below is recorded.
      const sprint = await createTestSprintInDb(
        teamId,
        `Cadence Sprint ${uniqueTestId()}`,
        'ACTIVE',
        new Date('2026-09-07T00:00:00.000Z'),
        new Date('2026-09-18T00:00:00.000Z')
      );
      testSprintIds.push(sprint.id);

      await call('put', '/api/v1/daily-scrum-schedule', cookies, teamId)
        .send({
          timezone: 'UTC',
          startMinute: 540,
          location: 'Room 4',
          workingDays: [1, 2, 3, 4, 5],
        })
        .expect(HTTP_STATUS.OK);

      await call('post', '/api/v1/daily-scrum-schedule/non-working-days', cookies, teamId)
        .send({ date: '2026-09-09', name: 'Company day' })
        .expect(HTTP_STATUS.CREATED);

      const response = await call(
        'get',
        `/api/v1/daily-scrums/${sprint.id}/cadence`,
        cookies,
        teamId
      )
        .query({ date: '2026-09-09' })
        .expect(HTTP_STATUS.OK);

      expect(response.body.data).toMatchObject({
        date: '2026-09-09',
        isWorkingDay: false,
        nonWorkingDayName: 'Company day',
        expected: 9,
        held: 0,
      });
      // The day number does not skip a day across the holiday.
      expect(response.body.data.sprintProgress).toEqual({ dayNumber: 2, totalDays: 9 });
    });

    it('refuses the same exception twice rather than recording it twice', async () => {
      const { cookies, teamId } = await asMember(ROLES.SCRUM_MASTER);
      const body = { date: '2026-12-25', name: 'Christmas Day' };

      await call('post', '/api/v1/daily-scrum-schedule/non-working-days', cookies, teamId)
        .send(body)
        .expect(HTTP_STATUS.CREATED);

      const duplicate = await call(
        'post',
        '/api/v1/daily-scrum-schedule/non-working-days',
        cookies,
        teamId
      ).send(body);

      expect(duplicate.status).toBe(HTTP_STATUS.CONFLICT);
    });
  });

  describe('POST /api/v1/daily-scrums/:sprintId', () => {
    const createSprint = async (teamId: string): Promise<string> => {
      const sprint = await createTestSprintInDb(
        teamId,
        `Evidence Sprint ${uniqueTestId()}`,
        'ACTIVE'
      );
      testSprintIds.push(sprint.id);
      return sprint.id;
    };

    it('refuses a record that declares neither an adjustment nor that none was needed', async () => {
      const { cookies, teamId } = await asMember(ROLES.DEVELOPERS);
      const sprintId = await createSprint(teamId);

      const response = await call('post', `/api/v1/daily-scrums/${sprintId}`, cookies, teamId).send(
        {
          planForNextDay: 'Pair on the checkout flow',
        }
      );

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.error.code).toBe(GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED);
    });

    it('accepts the acknowledgement that no adaptation was needed', async () => {
      const { cookies, teamId } = await asMember(ROLES.DEVELOPERS);
      const sprintId = await createSprint(teamId);

      const response = await call('post', `/api/v1/daily-scrums/${sprintId}`, cookies, teamId)
        .send({
          planForNextDay: 'Pair on the checkout flow',
          noAdaptationNeeded: true,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.data.noAdaptationNeeded).toBe(true);
      expect(response.body.data.backlogAdjustments).toEqual([]);
    });

    it('snapshots the Sprint Goal the event inspected, ignoring any goal sent by the caller', async () => {
      const { cookies, teamId } = await asMember(ROLES.DEVELOPERS);
      const sprintId = await createSprint(teamId);

      await prisma.sprint.update({
        where: { id: sprintId },
        data: { sprintGoal: 'Deliver the reporting module' },
      });

      const response = await call('post', `/api/v1/daily-scrums/${sprintId}`, cookies, teamId)
        .send({
          planForNextDay: 'Pair on the checkout flow',
          noAdaptationNeeded: true,
          // A goal this Sprint never had. The service must ignore it.
          sprintGoal: 'A goal the Sprint never had',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.data.sprintGoal).toBe('Deliver the reporting module');
    });

    it('records a typed adjustment with the state it will be judged against', async () => {
      const { cookies, teamId } = await asMember(ROLES.DEVELOPERS);
      const sprintId = await createSprint(teamId);

      const pbi = await createTestPBIInDb(teamId, `Checkout flow ${uniqueTestId()}`, 'READY');
      testPbiIds.push(pbi.id);
      const backlogItem = await addPBIToSprintBacklog(sprintId, pbi.id);

      const response = await call('post', `/api/v1/daily-scrums/${sprintId}`, cookies, teamId)
        .send({
          planForNextDay: 'Pair on the checkout flow',
          backlogAdjustments: [
            {
              sprintBacklogItemId: backlogItem.id,
              actionType: 'REFINED',
              action: 'Split into two slices',
            },
          ],
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.data.noAdaptationNeeded).toBe(false);
      expect(response.body.data.backlogAdjustments).toHaveLength(1);
      expect(response.body.data.backlogAdjustments[0]).toMatchObject({
        sprintBacklogItemId: backlogItem.id,
        pbiId: pbi.id,
        pbiTitleAtAdjustment: pbi.title,
        actionType: 'REFINED',
        // Nothing has moved since the declaration was recorded a moment ago.
        reflection: 'PENDING_REFLECTION',
      });
    });

    it('refuses an adjustment naming an item that is not in this Sprint Backlog', async () => {
      const { cookies, teamId } = await asMember(ROLES.DEVELOPERS);
      const sprintId = await createSprint(teamId);

      const response = await call('post', `/api/v1/daily-scrums/${sprintId}`, cookies, teamId).send(
        {
          planForNextDay: 'Pair on the checkout flow',
          backlogAdjustments: [
            {
              sprintBacklogItemId: '00000000-0000-7000-8000-000000000000',
              actionType: 'REMOVED',
              action: 'Cut it',
            },
          ],
        }
      );

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    });
  });
});
