// Integration tests for the Definition of Done / Definition of Ready remediation (module 3.15).
//
// Three claims are only worth anything against the real database: that the readiness agreement is
// authorised, that a Sprint cannot be committed against agreements the team has not met, and that
// editing a checklist no longer destroys the verifications recorded against it. A unit test with a
// mocked Prisma client can prove the service asks the right question; these prove the schema and the
// HTTP contract answer it.
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../app';
import prisma from '../../utils/prisma';
import { generateUUIDv7 } from '../../utils/uuid';
import { GATE_CODES } from '@scrumooth/shared';
import { CSRF_CONSTANTS } from '../../middleware/csrf.middleware';
import { getCsrfToken, replaceCsrfCookie } from '../helpers/test-helpers';

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

describe('Team Definitions Integration Tests', () => {
  const createdUserIds: string[] = [];
  const createdTeamIds: string[] = [];

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

  const createTeamWithMember = async (
    name: string,
    userId: string,
    role: 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS'
  ) => {
    const team = await prisma.team.create({
      data: {
        id: generateUUIDv7(),
        name,
        createdBy: userId,
        members: {
          create: { id: generateUUIDv7(), userId, role, createdBy: userId },
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

  const withCsrf = async (cookies: string[]) => {
    const fresh = await getCsrfToken();
    return { cookies: replaceCsrfCookie(cookies, fresh), token: fresh.csrfToken };
  };

  /** A team with a Scrum Master (who owns the readiness agreement) and a Developer (who plans). */
  const teamWithLeadershipAndDeveloper = async () => {
    const suffix = uniqueId();
    const scrumMaster = await createUser(`sm-${suffix}@example.com`, 'Sam');
    const developer = await createUser(`dev-${suffix}@example.com`, 'Dana');
    const team = await createTeamWithMember(`Team ${suffix}`, scrumMaster.id, 'SCRUM_MASTER');
    await prisma.teamMember.create({
      data: {
        id: generateUUIDv7(),
        teamId: team.id,
        userId: developer.id,
        role: 'DEVELOPERS',
        createdBy: scrumMaster.id,
      },
    });

    return {
      team,
      scrumMaster,
      developer,
      scrumMasterCookies: await loginAndGetCookies(scrumMaster.email),
      developerCookies: await loginAndGetCookies(developer.email),
    };
  };

  const createSprint = async (teamId: string, createdBy: string) => {
    const sprint = await prisma.sprint.create({
      data: {
        id: generateUUIDv7(),
        teamId,
        name: `Sprint ${uniqueId()}`,
        status: 'PLANNED',
        startDate: new Date('2026-03-02T00:00:00.000Z'),
        endDate: new Date('2026-03-13T00:00:00.000Z'),
        createdBy,
      },
    });
    return sprint;
  };

  const createReadyPbi = async (teamId: string, title: string, createdBy: string) => {
    const pbi = await prisma.productBacklogItem.create({
      data: {
        id: generateUUIDv7(),
        teamId,
        title,
        status: 'READY',
        storyPoints: 3,
        rank: 1,
        createdBy,
      },
    });
    return pbi;
  };

  afterEach(async () => {
    await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdTeamIds.length = 0;
    createdUserIds.length = 0;
  });

  describe('Definition of Ready authorization', () => {
    it('refuses the agreement to a caller outside the team', async () => {
      const { team } = await teamWithLeadershipAndDeveloper();
      const outsider = await createUser(`outsider-${uniqueId()}@example.com`, 'Olive');
      const outsiderCookies = await loginAndGetCookies(outsider.email);

      const response = await request(app)
        .get(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', outsiderCookies);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(GATE_CODES.DOR_TEAM_MEMBERS_ONLY);
    });

    it('lets a member read it but refuses the write to anyone but the Scrum Master', async () => {
      const { team, scrumMasterCookies, developerCookies } = await teamWithLeadershipAndDeveloper();

      const read = await request(app)
        .get(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', developerCookies);
      expect(read.status).toBe(200);
      // The agreement is created with sensible defaults when a team first reads it, so a team is
      // never left with nothing to satisfy.
      expect(read.body.data.items.length).toBeGreaterThan(0);

      const { cookies, token } = await withCsrf(developerCookies);
      const refused = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({
          items: [{ description: 'A Developer may not set this', isActive: true, order: 0 }],
        });

      expect(refused.status).toBe(403);
      expect(refused.body.error.code).toBe(GATE_CODES.DOR_SCRUM_MASTER_ONLY);

      const { cookies: smCookies, token: smToken } = await withCsrf(scrumMasterCookies);
      const accepted = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', smCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, smToken)
        .send({
          items: [{ description: 'Acceptance criteria agreed', isActive: true, order: 0 }],
        });

      expect(accepted.status).toBe(200);
      expect(accepted.body.data.items).toHaveLength(1);
    });
  });

  describe('Definition of Ready cannot be emptied', () => {
    it('refuses a payload with no active criterion', async () => {
      const { team, scrumMasterCookies } = await teamWithLeadershipAndDeveloper();
      const { cookies, token } = await withCsrf(scrumMasterCookies);

      const response = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ items: [{ description: 'Retired', isActive: false, order: 0 }] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(GATE_CODES.DOR_REQUIRED);
    });

    it('refuses an empty list outright', async () => {
      const { team, scrumMasterCookies } = await teamWithLeadershipAndDeveloper();
      const { cookies, token } = await withCsrf(scrumMasterCookies);

      const response = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ items: [] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(GATE_CODES.DOR_REQUIRED);
    });
  });

  describe('Editing a Definition of Ready keeps the evidence for the criteria it keeps', () => {
    it('keeps a criterion and its verification when another criterion is dropped', async () => {
      const { team, developer, scrumMasterCookies, developerCookies } =
        await teamWithLeadershipAndDeveloper();
      const { cookies, token } = await withCsrf(scrumMasterCookies);

      const created = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({
          items: [
            { description: 'Acceptance criteria agreed', isActive: true, order: 0 },
            { description: 'Dependencies identified', isActive: true, order: 1 },
          ],
        });

      expect(created.status).toBe(200);
      const [keptCriterion, droppedCriterion] = created.body.data.items;
      const pbi = await createReadyPbi(team.id, 'Checkout flow', developer.id);

      const { cookies: devCookies, token: devToken } = await withCsrf(developerCookies);
      const verified = await request(app)
        .post(`/api/v1/product-backlog/${pbi.id}/verify-dor`)
        .set('Cookie', devCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, devToken)
        .send({
          verifications: [{ dorItemId: keptCriterion.id, isVerified: true, notes: 'Agreed' }],
        });
      expect(verified.status).toBe(200);

      // Reword the surviving criterion and drop the other one.
      const { cookies: smCookies, token: smToken } = await withCsrf(scrumMasterCookies);
      const updated = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', smCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, smToken)
        .send({
          items: [
            {
              id: keptCriterion.id,
              description: 'Acceptance criteria agreed and testable',
              isActive: true,
              order: 0,
            },
          ],
        });

      expect(updated.status).toBe(200);
      // Same row, reworded: that is what keeps the verification meaningful.
      expect(updated.body.data.items).toHaveLength(1);
      expect(updated.body.data.items[0].id).toBe(keptCriterion.id);
      expect(updated.body.data.items[0].description).toBe(
        'Acceptance criteria agreed and testable'
      );

      const verifications = await request(app)
        .get(`/api/v1/product-backlog/${pbi.id}/dor-verifications`)
        .set('Cookie', developerCookies);

      expect(verifications.status).toBe(200);
      expect(verifications.body.data).toHaveLength(1);
      expect(verifications.body.data[0].dorItemId).toBe(keptCriterion.id);
      expect(verifications.body.data[0].isVerified).toBe(true);

      // The dropped criterion took its own record with it.
      const remaining = await prisma.doRItem.findMany({ where: { dorId: created.body.data.id } });
      expect(remaining.map((item) => item.id)).toEqual([keptCriterion.id]);
      expect(remaining.map((item) => item.id)).not.toContain(droppedCriterion.id);
    });

    it('refuses a verification from a caller outside the item’s team', async () => {
      const { team, developer } = await teamWithLeadershipAndDeveloper();
      const pbi = await createReadyPbi(team.id, 'Foreign check', developer.id);
      // The agreement exists so the refusal is membership, not a missing agreement.
      await request(app)
        .get(`/api/v1/teams/${team.id}/definition-of-ready`)
        .set('Cookie', await loginAndGetCookies(developer.email));

      const outsider = await createUser(`outsider-${uniqueId()}@example.com`, 'Olive');
      const outsiderCookies = await loginAndGetCookies(outsider.email);
      const { cookies, token } = await withCsrf(outsiderCookies);

      const response = await request(app)
        .post(`/api/v1/product-backlog/${pbi.id}/verify-dor`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ verifications: [{ dorItemId: generateUUIDv7(), isVerified: true }] });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(GATE_CODES.DOR_TEAM_MEMBERS_ONLY);
    });
  });

  describe('The Sprint boundary enforces both agreements', () => {
    it('refuses a Sprint Backlog commit when the team has no Definition of Done', async () => {
      const { team, scrumMaster, developer, developerCookies } =
        await teamWithLeadershipAndDeveloper();
      const sprint = await createSprint(team.id, scrumMaster.id);
      const pbi = await createReadyPbi(team.id, 'Uncommittable', developer.id);

      const { cookies, token } = await withCsrf(developerCookies);
      const response = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ items: [{ pbiId: pbi.id }] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(GATE_CODES.DOD_REQUIRED);
    });

    it('refuses a Sprint Backlog commit while a selected item has an unverified criterion', async () => {
      const { team, scrumMaster, developer, scrumMasterCookies, developerCookies } =
        await teamWithLeadershipAndDeveloper();
      const sprint = await createSprint(team.id, scrumMaster.id);
      const pbi = await createReadyPbi(team.id, 'Not ready yet', developer.id);

      // Give the team a Definition of Done so the readiness rule is what refuses.
      const { cookies: smCookies, token: smToken } = await withCsrf(scrumMasterCookies);
      const dod = await request(app)
        .put(`/api/v1/teams/${team.id}/definition-of-done`)
        .set('Cookie', smCookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, smToken)
        .send({ items: [{ description: 'Code reviewed', isActive: true, order: 0 }] });
      expect(dod.status).toBe(200);

      // The team's readiness agreement, with one active criterion the item has not met.
      const dorItemId = generateUUIDv7();
      await prisma.definitionOfReady.create({
        data: {
          id: generateUUIDv7(),
          teamId: team.id,
          createdBy: scrumMaster.id,
          items: {
            create: {
              id: dorItemId,
              description: 'Acceptance criteria agreed',
              category: 'acceptance',
              isActive: true,
              order: 0,
              createdBy: scrumMaster.id,
            },
          },
        },
      });

      const { cookies, token } = await withCsrf(developerCookies);
      const refused = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ items: [{ pbiId: pbi.id }] });

      expect(refused.status).toBe(400);
      expect(refused.body.error.code).toBe(GATE_CODES.DOR_NOT_VERIFIED);
      // The refusal names the item that is not ready, so the fix is obvious.
      expect(refused.body.error.message).toContain('Not ready yet');

      // Verify the criterion and the same commit is accepted.
      const verified = await request(app)
        .post(`/api/v1/product-backlog/${pbi.id}/verify-dor`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ verifications: [{ dorItemId, isVerified: true }] });
      expect(verified.status).toBe(200);

      const accepted = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/backlog`)
        .set('Cookie', cookies)
        .set(CSRF_CONSTANTS.HEADER_NAME, token)
        .send({ items: [{ pbiId: pbi.id }] });

      expect(accepted.status).toBe(200);
    });
  });
});
