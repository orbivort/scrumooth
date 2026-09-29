// Integration tests for team groups and the Definition of Done they share.
//
// The point of a group is structural: two Scrum Teams working on one product read *one* Definition
// of Done row, cannot diverge from it by editing their own, and record the version each of them
// adopted. These tests exercise that end to end, over HTTP, against the real database -- a unit test
// with a mocked Prisma client can only prove the service asks the right question, not that the
// schema answers it.
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import bcrypt from 'bcrypt';
import { GATE_CODES } from '@scrumooth/shared';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, replaceCsrfCookie } from '../helpers/test-helpers';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

const doDItems = (description: string) => [
  { description, category: 'quality', isActive: true, order: 0 },
];

describe('Team Groups Integration Tests', () => {
  const createdUserIds: string[] = [];
  const createdTeamIds: string[] = [];
  const createdGroupIds: string[] = [];

  const createUser = async (email: string, firstName: string) => {
    const user = await prisma.user.create({
      data: {
        id: generateUUIDv7(),
        email: email.toLowerCase(),
        password: await bcrypt.hash('TestPassword123!', 12),
        firstName,
        lastName: 'Tester',
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  /** A team owned by `userId` as its Product Owner, which is the role that may join a group. */
  const createTeam = async (name: string, userId: string) => {
    const team = await prisma.team.create({
      data: {
        id: generateUUIDv7(),
        name,
        createdBy: userId,
        members: {
          create: { id: generateUUIDv7(), userId, role: 'PRODUCT_OWNER', createdBy: userId },
        },
      },
    });
    createdTeamIds.push(team.id);
    return team;
  };

  const loginAndGetCookies = async (email: string): Promise<string[]> => {
    const { csrfCookie, csrfToken } = await getCsrfToken();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrfCookie)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrfToken)
      .send({ email, password: 'TestPassword123!' });

    const setCookie = response.headers['set-cookie'];
    const authCookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    return [...authCookies, csrfCookie];
  };

  /**
   * The authenticated cookies plus one CSRF cookie whose value is the header token, so a write
   * carries a matching double-submit pair no matter how many cookies the login already set.
   */
  const withCsrf = async (cookies: string[]) => {
    const fresh = await getCsrfToken();
    return { cookies: replaceCsrfCookie(cookies, fresh), token: fresh.csrfToken };
  };

  afterEach(async () => {
    // Teams first: `teams.groupId` is `ON DELETE RESTRICT`, because a group's Definition of Done is
    // the commitment of its teams and removing it out from under them is exactly what the API
    // refuses (`GATE_TEAM_GROUP_NOT_EMPTY`). Clearing the detached teams' membership re-establishes
    // the same three-columns-together invariant the CHECK asserts.
    await prisma.team.updateMany({
      where: { id: { in: createdTeamIds } },
      data: { groupId: null, groupJoinedAt: null, groupDodVersionAtJoin: null },
    });
    await prisma.teamGroup.deleteMany({ where: { id: { in: createdGroupIds } } });
    await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdGroupIds.length = 0;
    createdTeamIds.length = 0;
    createdUserIds.length = 0;
  });

  /**
   * Two teams, one product, one group, and each team's Product Owner logged in. This is the
   * scenario the Guide's rule is about, so most tests start here.
   */
  const twoTeamsInOneGroup = async () => {
    const suffix = uniqueId();
    const alice = await createUser(`alice-${suffix}@example.com`, 'Alice');
    const bob = await createUser(`bob-${suffix}@example.com`, 'Bob');
    const teamA = await createTeam(`Team A ${suffix}`, alice.id);
    const teamB = await createTeam(`Team B ${suffix}`, bob.id);
    const aliceCookies = await loginAndGetCookies(alice.email);
    const bobCookies = await loginAndGetCookies(bob.email);

    const groupCsrf = await withCsrf(aliceCookies);
    const groupResponse = await request(app)
      .post('/api/v1/team-groups')
      .set('Cookie', groupCsrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, groupCsrf.token)
      .send({ name: `Payments product ${suffix}`, description: 'Two teams, one product.' });

    expect(groupResponse.status).toBe(201);
    const groupId = groupResponse.body.data.id as string;
    createdGroupIds.push(groupId);

    const dodVersion = groupResponse.body.data.definitionOfDone.version as number;

    const join = async (teamId: string, cookies: string[]) => {
      const csrf = await withCsrf(cookies);
      return request(app)
        .post(`/api/v1/teams/${teamId}/group`)
        .set('Cookie', csrf.cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, csrf.token)
        .send({ groupId, acknowledgedDodVersion: dodVersion });
    };

    return { alice, bob, teamA, teamB, aliceCookies, bobCookies, groupId, dodVersion, join };
  };

  it('has both teams read one and the same Definition of Done', async () => {
    const { teamA, teamB, aliceCookies, bobCookies, join } = await twoTeamsInOneGroup();

    expect((await join(teamA.id, aliceCookies)).status).toBe(200);
    expect((await join(teamB.id, bobCookies)).status).toBe(200);

    const dodOfA = await request(app)
      .get(`/api/v1/teams/${teamA.id}/definition-of-done`)
      .set('Cookie', aliceCookies);
    const dodOfB = await request(app)
      .get(`/api/v1/teams/${teamB.id}/definition-of-done`)
      .set('Cookie', bobCookies);

    expect(dodOfA.status).toBe(200);
    expect(dodOfB.status).toBe(200);
    // One row, read by both teams: the rule holds by construction, not by keeping two copies equal.
    expect(dodOfA.body.data.id).toBe(dodOfB.body.data.id);
    expect(dodOfA.body.data.version).toBe(dodOfB.body.data.version);
  });

  it('refuses a grouped team its own Definition of Done edit', async () => {
    const { teamA, aliceCookies, join } = await twoTeamsInOneGroup();
    expect((await join(teamA.id, aliceCookies)).status).toBe(200);

    const csrf = await withCsrf(aliceCookies);
    const response = await request(app)
      .put(`/api/v1/teams/${teamA.id}/definition-of-done`)
      .set('Cookie', csrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrf.token)
      .send({ items: doDItems('Team A decides alone') });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(GATE_CODES.DOD_GROUP_GOVERNED);
  });

  it('applies one change to the shared Definition of Done for every team in the group', async () => {
    const { teamA, teamB, aliceCookies, bobCookies, groupId, join } = await twoTeamsInOneGroup();
    await join(teamA.id, aliceCookies);
    await join(teamB.id, bobCookies);

    const csrf = await withCsrf(aliceCookies);
    const update = await request(app)
      .put(`/api/v1/team-groups/${groupId}/shared-definition-of-done`)
      .set('Cookie', csrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrf.token)
      .send({ items: doDItems('Integrated and measured') });

    expect(update.status).toBe(200);
    expect(update.body.data.version).toBe(2);

    const dodOfB = await request(app)
      .get(`/api/v1/teams/${teamB.id}/definition-of-done`)
      .set('Cookie', bobCookies);

    expect(dodOfB.body.data.version).toBe(2);
    expect(dodOfB.body.data.items[0].description).toBe('Integrated and measured');
  });

  it('refuses an adoption that names a version that is not in force', async () => {
    const { teamA, aliceCookies, groupId } = await twoTeamsInOneGroup();

    const csrf = await withCsrf(aliceCookies);
    const response = await request(app)
      .post(`/api/v1/teams/${teamA.id}/group`)
      .set('Cookie', csrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrf.token)
      .send({ groupId, acknowledgedDodVersion: 99 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED);
  });

  it('refuses a second group for a team that already complies with one', async () => {
    const { teamA, aliceCookies, join, groupId } = await twoTeamsInOneGroup();
    expect((await join(teamA.id, aliceCookies)).status).toBe(200);

    const csrf = await withCsrf(aliceCookies);
    const response = await request(app)
      .post(`/api/v1/teams/${teamA.id}/group`)
      .set('Cookie', csrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrf.token)
      .send({ groupId, acknowledgedDodVersion: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(GATE_CODES.TEAM_GROUP_ALREADY_MEMBER);
  });

  it('keeps the roster to the group, and the shared commitment readable before joining', async () => {
    const { groupId } = await twoTeamsInOneGroup();
    const outsider = await createUser(`outsider-${uniqueId()}@example.com`, 'Outsider');
    const outsiderCookies = await loginAndGetCookies(outsider.email);

    const detail = await request(app)
      .get(`/api/v1/team-groups/${groupId}`)
      .set('Cookie', outsiderCookies);

    expect(detail.status).toBe(403);
    expect(detail.body.error.code).toBe(GATE_CODES.TEAM_GROUP_MEMBERS_ONLY);

    // The commitment itself is readable, because a team cannot "mutually define" what it cannot see.
    const shared = await request(app)
      .get(`/api/v1/team-groups/${groupId}/shared-definition-of-done`)
      .set('Cookie', outsiderCookies);

    expect(shared.status).toBe(200);
    expect(shared.body.data.items.length).toBeGreaterThan(0);
  });

  it('lets a leaving team keep the Definition of Done it complied with, and edit it again', async () => {
    const { teamA, teamB, aliceCookies, bobCookies, groupId, join } = await twoTeamsInOneGroup();
    await join(teamA.id, aliceCookies);
    await join(teamB.id, bobCookies);

    // The shared commitment changes, so the leaving team has something distinguishable to keep.
    const sharedCsrf = await withCsrf(aliceCookies);
    await request(app)
      .put(`/api/v1/team-groups/${groupId}/shared-definition-of-done`)
      .set('Cookie', sharedCsrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, sharedCsrf.token)
      .send({ items: doDItems('Integrated and measured') });

    const leaveCsrf = await withCsrf(bobCookies);
    const leave = await request(app)
      .delete(`/api/v1/teams/${teamB.id}/group`)
      .set('Cookie', leaveCsrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, leaveCsrf.token);

    expect(leave.status).toBe(200);

    const ownDoD = await request(app)
      .get(`/api/v1/teams/${teamB.id}/definition-of-done`)
      .set('Cookie', bobCookies);

    expect(ownDoD.body.data.items[0].description).toBe('Integrated and measured');

    // And it owns it again: the team can change what it is held to without the group's leave.
    const editCsrf = await withCsrf(bobCookies);
    const edit = await request(app)
      .put(`/api/v1/teams/${teamB.id}/definition-of-done`)
      .set('Cookie', editCsrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, editCsrf.token)
      .send({ items: doDItems('Team B decides now') });

    expect(edit.status).toBe(200);
    expect(edit.body.data.items[0].description).toBe('Team B decides now');
  });

  it('refuses to remove a group whose teams still comply with its Definition of Done', async () => {
    const { teamA, aliceCookies, groupId, join } = await twoTeamsInOneGroup();
    expect((await join(teamA.id, aliceCookies)).status).toBe(200);

    const csrf = await withCsrf(aliceCookies);
    const response = await request(app)
      .delete(`/api/v1/team-groups/${groupId}`)
      .set('Cookie', csrf.cookies)
      .set(CSRF_CONSTANTS.HEADER_NAME, csrf.token);

    // Alice created the group and leads a team in it, so this is the not-empty rule and not a role.
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(GATE_CODES.TEAM_GROUP_NOT_EMPTY);

    // The group and the Definition of Done its team complies with are both still there.
    const stillThere = await prisma.teamGroup.findUnique({ where: { id: groupId } });
    const teamStillGrouped = await prisma.team.findUnique({ where: { id: teamA.id } });
    expect(stillThere).not.toBeNull();
    expect(teamStillGrouped?.groupId).toBe(groupId);
  });
});
