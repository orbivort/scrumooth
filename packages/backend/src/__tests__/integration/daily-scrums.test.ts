// Integration Tests for the team-level Daily Scrum endpoints
// Covers: team-level create/read/update, participation, team signal, impediment promotion

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, extractCsrfFromCookies } from '../helpers/test-helpers';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Daily Scrum Integration Tests (team-level, goal-focused)', () => {
  const createTestUserInDb = async (email: string, password: string = 'TestPassword123!') => {
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = generateUUIDv7();
    return prisma.user.create({
      data: {
        id: userId,
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: 'Daily',
        lastName: 'Scrum',
      },
    });
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

  const createTestTeam = async (name: string) => {
    return prisma.team.create({
      data: { id: generateUUIDv7(), name, description: 'Test team' },
    });
  };

  const addTeamMember = async (
    teamId: string,
    userId: string,
    role: 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS' = 'DEVELOPERS'
  ) => {
    await prisma.teamMember.create({
      data: { id: generateUUIDv7(), teamId, userId, role },
    });
  };

  const createTestSprint = async (teamId: string, name: string) => {
    return prisma.sprint.create({
      data: {
        id: generateUUIDv7(),
        teamId,
        name,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
        sprintGoal: 'Deliver the reporting module',
      },
    });
  };

  const cleanupTestData = async (emails: string[]) => {
    try {
      for (const email of emails) {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
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
        const team = await prisma.team.findFirst({ where: { name } });
        if (team) {
          await prisma.dailyScrumParticipant.deleteMany({
            where: { dailyScrum: { sprint: { teamId: team.id } } },
          });
          await prisma.dailyScrumBacklogItem.deleteMany({
            where: { dailyScrum: { sprint: { teamId: team.id } } },
          });
          await prisma.dailyScrum.deleteMany({ where: { sprint: { teamId: team.id } } });
          await prisma.impediment.deleteMany({ where: { teamId: team.id } });
          await prisma.task.deleteMany({ where: { sprint: { teamId: team.id } } });
          await prisma.sprint.deleteMany({ where: { teamId: team.id } });
          await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
          await prisma.team.delete({ where: { id: team.id } });
        }
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  };

  describe('GET /api/v1/daily-scrums/:sprintId/today', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('returns null when no team-level Daily Scrum exists for the sprint', async () => {
      const email = `scrum-empty-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Empty Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);

      const response = await request(app)
        .get(`/api/v1/daily-scrums/${sprint.id}/today`)
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/daily-scrums/${generateUUIDv7()}/today`)
        .expect(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/daily-scrums/:sprintId', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('creates a team-level Daily Scrum with goal-focused fields', async () => {
      const email = `scrum-create-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Create Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          progressNotes: 'On track toward the goal',
          planForNextDay: 'Pair up on feature Y',
          // A record must declare its adaptation outcome: the Guides' purpose for the event is to
          // adapt the Sprint Backlog, so "nothing needed changing" is a decision to state.
          noAdaptationNeeded: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.progressNotes).toBe('On track toward the goal');
      expect(response.body.data.planForNextDay).toBe('Pair up on feature Y');
      // The creator is recorded as a participant, not a per-user report
      expect(response.body.data.participants.length).toBe(1);
    });

    it('creates a team-level Daily Scrum for a specific supplied date', async () => {
      const email = `scrum-dated-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Dated Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          scrumDate: '2026-08-20',
          progressNotes: 'On track for the date',
          planForNextDay: 'Pair up on feature Z',
          noAdaptationNeeded: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);

      // The record is retrievable for the supplied date via the by-date endpoint.
      // This confirms the create honored the client-supplied scrumDate rather than
      // always stamping "today".
      const fetched = await request(app)
        .get(`/api/v1/daily-scrums/${sprint.id}/today`)
        .set('Cookie', cookies)
        .query({ date: '2026-08-20' } as Record<string, string | undefined>)
        .expect(200);

      expect(fetched.body.data).not.toBeNull();
      expect(fetched.body.data.id).toBe(response.body.data.id);
    });

    it('rejects a non-Developer (Product Owner) from creating the Daily Scrum (403)', async () => {
      const email = `scrum-po-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum PO Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ progressNotes: 'Progress', planForNextDay: 'Plan' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('rejects a second team-level Daily Scrum for the same sprint and day', async () => {
      const email = `scrum-conflict-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Conflict Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ progressNotes: 'First', planForNextDay: 'First plan', noAdaptationNeeded: true })
        .expect(201);

      const second = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ progressNotes: 'Second', planForNextDay: 'Second plan' });

      expect(second.status).toBe(409);
      expect(second.body.success).toBe(false);
    });

    it('rejects a Daily Scrum without an actionable next-day plan (422)', async () => {
      const email = `scrum-no-plan-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum No Plan Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const blank = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ progressNotes: 'Progress without a plan' });

      expect(blank.status).toBe(422);
      expect(blank.body.success).toBe(false);
      expect(blank.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'planForNextDay' })])
      );
    });
  });

  describe('PUT /api/v1/daily-scrums/record/:id', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('updates the team-level Daily Scrum', async () => {
      const email = `scrum-update-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Update Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          progressNotes: 'Initial',
          planForNextDay: 'Initial plan',
          noAdaptationNeeded: true,
        })
        .expect(201);

      const scrumId = created.body.data.id;

      const response = await request(app)
        .put(`/api/v1/daily-scrums/record/${scrumId}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ planForNextDay: 'Adapted plan' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.planForNextDay).toBe('Adapted plan');
    });
  });

  describe('POST /api/v1/daily-scrums/record/:id/participate', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('records the current user as a participant', async () => {
      const email = `scrum-participate-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Participate Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          progressNotes: 'Progress',
          planForNextDay: 'Plan for next day',
          noAdaptationNeeded: true,
        })
        .expect(201);

      const scrumId = created.body.data.id;

      const response = await request(app)
        .post(`/api/v1/daily-scrums/record/${scrumId}/participate`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/daily-scrums/:sprintId/team-signal', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('signals only Developers who have not yet joined (excludes PO/SM and joiners)', async () => {
      const senderEmail = `scrum-signal-sender-${uniqueId()}@example.com`;
      const joinedDevEmail = `scrum-signal-joined-${uniqueId()}@example.com`;
      const pendingDevEmail = `scrum-signal-pending-${uniqueId()}@example.com`;
      const poEmail = `scrum-signal-po-${uniqueId()}@example.com`;
      testEmails.push(senderEmail, joinedDevEmail, pendingDevEmail, poEmail);

      const sender = await createTestUserInDb(senderEmail);
      const joinedDev = await createTestUserInDb(joinedDevEmail);
      const pendingDev = await createTestUserInDb(pendingDevEmail);
      const po = await createTestUserInDb(poEmail);

      const teamName = `Scrum Signal Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, sender.id, 'SCRUM_MASTER');
      await addTeamMember(team.id, joinedDev.id, 'DEVELOPERS');
      await addTeamMember(team.id, pendingDev.id, 'DEVELOPERS');
      await addTeamMember(team.id, po.id, 'PRODUCT_OWNER');
      const sprint = await createTestSprint(team.id, 'Sprint');

      // Seed today's Daily Scrum with joinedDev already recorded as a participant.
      // scrumDate uses local-time midnight, matching DailyScrumService.getTodayDate().
      const today = new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      await prisma.dailyScrum.create({
        data: {
          id: generateUUIDv7(),
          sprintId: sprint.id,
          scrumDate: todayMidnight,
          progressNotes: 'Progress',
          planForNextDay: 'Plan for next day',
          participants: {
            create: { id: generateUUIDv7(), userId: joinedDev.id },
          },
        },
      });

      const cookies = await loginAndGetCookies(senderEmail);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const response = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}/team-signal`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Only the non-joined Developer receives the signal (the PO, SM, and the
      // already-joined Developer are excluded).
      expect(response.body.data.sentCount).toBe(1);

      const notifications = await prisma.notification.findMany({
        where: { type: 'DAILY_SCRUM_SIGNAL' },
        select: { userId: true },
      });
      const notifiedIds = notifications.map((n) => n.userId);
      expect(notifiedIds).toContain(pendingDev.id);
      expect(notifiedIds).not.toContain(joinedDev.id);
      expect(notifiedIds).not.toContain(po.id);
      expect(notifiedIds).not.toContain(sender.id);
    });
  });

  describe('POST /api/v1/daily-scrums/:id/promote-impediment', () => {
    const testEmails: string[] = [];
    const testTeams: string[] = [];

    afterEach(async () => {
      await cleanupTeams(testTeams);
      await cleanupTestData(testEmails);
      testEmails.length = 0;
      testTeams.length = 0;
    });

    it('promotes an impediment from a Daily Scrum', async () => {
      const email = `scrum-promote-${uniqueId()}@example.com`;
      testEmails.push(email);

      const user = await createTestUserInDb(email);
      const teamName = `Scrum Promote Team ${uniqueId()}`;
      testTeams.push(teamName);

      const team = await createTestTeam(teamName);
      await addTeamMember(team.id, user.id);
      const sprint = await createTestSprint(team.id, 'Sprint');

      const cookies = await loginAndGetCookies(email);
      const { csrfToken } = extractCsrfFromCookies(cookies);

      const created = await request(app)
        .post(`/api/v1/daily-scrums/${sprint.id}`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({ progressNotes: 'Blocked on API', planForNextDay: 'Plan', noAdaptationNeeded: true })
        .expect(201);

      const scrumId = created.body.data.id;

      const response = await request(app)
        .post(`/api/v1/daily-scrums/${scrumId}/promote-impediment`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
        .send({
          title: 'API access blocked',
          description: 'Team cannot proceed without API access',
          sprintId: sprint.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.impediment.title).toBe('API access blocked');
      // Team/sprint are derived from the Daily Scrum record, not the request body.
      expect(response.body.data.impediment.teamId).toBe(team.id);
    });
  });
});
