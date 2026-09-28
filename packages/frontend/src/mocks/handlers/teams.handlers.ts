import { http, type RequestHandler } from 'msw';

import type { Team, TeamMember } from '../../types';
import { apiUrl, bodyOf, numberParam, paginate, paginationOf, queryOf } from '../support/http';
import { created, fail, ok, problems } from '../support/envelope';
import { scenarioResponse } from '../support/scenarios';
import {
  currentTeamId,
  currentUser,
  database,
  groupGovernanceOf,
  isMemberOf,
  membersOf,
  roleOf,
  selectTeamInSession,
  teamOf,
  teamsOf,
} from '../store';

/**
 * Teams, membership and the team context.
 *
 * Two things here are load-bearing for the rest of the interface:
 *
 * 1. `userRole` is returned in the upper-case casing the API uses
 *    (`PRODUCT_OWNER`, `SCRUM_MASTER`, `DEVELOPERS`). The role badges in
 *    `utils/roleUtils.ts` match only that casing, and the workflow gates mirror
 *    the backend, which stores the Prisma enum.
 * 2. The team that was signed in through or selected is listed first by
 *    `/teams/my-teams`, because the interface auto-selects the first team it is
 *    given. Signing in as the Product Owner of Pell whose same person is a Scrum
 *    Master on Cindra therefore resolves the role the card promised.
 */

/**
 * A team as the interface reads it: the acting user's role attached, plus the
 * group whose Definition of Done governs the team when it works with others on
 * one product.
 */
function withUserRole(team: Team, userId: string): Team & { userRole: string } {
  const governance = groupGovernanceOf(team.id);

  return {
    ...team,
    ...(governance ?? {}),
    members: membersOf(team.id),
    userRole: roleOf(userId, team.id) ?? 'DEVELOPERS',
  };
}

function findMember(teamId: string, memberId: string): TeamMember | undefined {
  return teamOf(teamId)?.members?.find((member) => member.id === memberId);
}

function findMembershipByUser(teamId: string, userId: string): TeamMember | undefined {
  return teamOf(teamId)?.members?.find((member) => member.userId === userId);
}

/** The same role-guard the backend applies, so a refusal here is a real one. */
function soleRoleholder(teamId: string, role: string): boolean {
  return (
    (teamOf(teamId)?.members ?? []).filter((member) => member.role.toUpperCase() === role)
      .length === 1
  );
}

export const teamHandlers: RequestHandler[] = [
  // Registered before `/teams/:id` so the literal paths are matched first.
  http.get(apiUrl('/teams/my-teams'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const selected = teamOf(selectedTeamIdOf(user.id) ?? '');
    const mine = teamsOf(user.id).map((team) => withUserRole(team, user.id));
    const ordered = selected
      ? [
          ...mine.filter((team) => team.id === selected.id),
          ...mine.filter((team) => team.id !== selected.id),
        ]
      : mine;

    return ok(ordered);
  }),

  http.post(apiUrl('/teams/select-team'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ teamId: string }>(request);
    const teamId = body.teamId ?? '';
    const team = teamOf(teamId);
    if (!team) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return problems.forbidden('You are not a member of that team');
    }

    selectTeamInSession(teamId);
    return ok(withUserRole(team, user.id));
  }),

  http.get(apiUrl('/teams'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const query = queryOf(request);
    const search = (query.get('search') ?? '').trim().toLowerCase();
    const mine = teamsOf(user.id).map((team) => withUserRole(team, user.id));
    const filtered = search
      ? mine.filter((team) => team.name.toLowerCase().includes(search))
      : mine;
    const page = paginate(
      filtered,
      numberParam(query.get('page'), 1),
      numberParam(query.get('limit'), 10)
    );

    // `getTeams` reads a nested shape rather than the standard paginated envelope.
    return ok({ teams: page.slice, pagination: paginationOf(page) });
  }),

  http.post(apiUrl('/teams'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ name: string; description?: string }>(request);
    const name = (body.name ?? '').trim();
    if (!name) {
      return problems.validation('A team name is required', 'name');
    }

    const now = new Date().toISOString();
    const team: Team = {
      id: crypto.randomUUID(),
      name,
      description: body.description,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      memberCount: 1,
      members: [
        {
          id: crypto.randomUUID(),
          teamId: '',
          userId: user.id,
          // A team needs a Product Owner, and whoever creates it is it.
          role: 'PRODUCT_OWNER' as TeamMember['role'],
          joinedAt: now,
        },
      ],
    };
    team.members = team.members?.map((member) => ({ ...member, teamId: team.id }));
    database().teams.push(team);

    return created(withUserRole(team, user.id));
  }),

  http.get(apiUrl('/teams/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const team = teamOf(String(params.id ?? ''));
    if (!team) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, team.id)) {
      return problems.forbidden('You are not a member of that team');
    }

    return ok(withUserRole(team, user.id));
  }),

  http.put(apiUrl('/teams/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const team = teamOf(String(params.id ?? ''));
    if (!team) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, team.id) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner can change the team');
    }

    const body = await bodyOf<{ name?: string; description?: string }>(request);
    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return problems.validation('A team name is required', 'name');
      }
      team.name = body.name.trim();
    }
    if (body.description !== undefined) {
      team.description = body.description;
    }
    team.updatedAt = new Date().toISOString();

    return ok(withUserRole(team, user.id));
  }),

  http.delete(apiUrl('/teams/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const team = teamOf(String(params.id ?? ''));
    if (!team) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, team.id) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner can delete the team');
    }

    const db = database();
    // A team is a container for work: its records go with it.
    db.teams = db.teams.filter((candidate) => candidate.id !== team.id);
    db.backlogItems = db.backlogItems.filter((item) => item.teamId !== team.id);
    db.sprints = db.sprints.filter((sprint) => sprint.teamId !== team.id);
    db.productGoals = db.productGoals.filter((goal) => goal.teamId !== team.id);
    db.impediments = db.impediments.filter((impediment) => impediment.teamId !== team.id);

    return ok(null);
  }),

  http.get(apiUrl('/teams/:teamId/my-role'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!isMemberOf(user.id, teamId)) {
      return problems.forbidden('You are not a member of that team');
    }
    return ok({ role: roleOf(user.id, teamId) ?? 'DEVELOPERS' });
  }),

  http.post(apiUrl('/teams/:teamId/members'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    const team = teamOf(teamId);
    if (!team) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner can add team members');
    }

    const body = await bodyOf<{ email: string; role: string }>(request);
    const email = (body.email ?? '').trim().toLowerCase();
    const role = (body.role ?? '').toUpperCase();
    if (!['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'].includes(role)) {
      return problems.validation('Unknown role', 'role');
    }

    const candidate = database().users.find((someone) => someone.email.toLowerCase() === email);
    if (!candidate) {
      return fail(
        404,
        'USER_NOT_FOUND',
        'Nobody with that email address has an account yet. Ask them to register first.'
      );
    }
    if (findMembershipByUser(teamId, candidate.id)) {
      return fail(409, 'ALREADY_A_MEMBER', 'That person is already in this team');
    }
    // The Guide gives a team one Product Owner and one Scrum Master.
    if (role !== 'DEVELOPERS' && soleRoleholder(teamId, role)) {
      return fail(
        409,
        'ROLE_TAKEN',
        role === 'PRODUCT_OWNER'
          ? 'This team already has a Product Owner'
          : 'This team already has a Scrum Master'
      );
    }

    const member: TeamMember = {
      id: crypto.randomUUID(),
      teamId,
      userId: candidate.id,
      role: role as TeamMember['role'],
      joinedAt: new Date().toISOString(),
    };
    team.members = [...(team.members ?? []), member];
    team.memberCount = team.members.length;
    team.updatedAt = new Date().toISOString();

    return created({ ...member, user: candidate });
  }),

  http.put(apiUrl('/teams/:teamId/members/:memberId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner can change a member’s role');
    }

    const member = findMember(teamId, String(params.memberId ?? ''));
    if (!member) {
      return problems.notFound('Team member');
    }

    const body = await bodyOf<{ role: string }>(request);
    const role = (body.role ?? '').toUpperCase();
    if (!['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'].includes(role)) {
      return problems.validation('Unknown role', 'role');
    }
    // Changing to a role somebody else already holds would leave the team with
    // two Product Owners, which the backend refuses too.
    if (role !== member.role.toUpperCase() && role !== 'DEVELOPERS') {
      const existing = (teamOf(teamId)?.members ?? []).find(
        (candidate) => candidate.id !== member.id && candidate.role.toUpperCase() === role
      );
      if (existing) {
        return fail(
          409,
          'ROLE_TAKEN',
          role === 'PRODUCT_OWNER'
            ? 'This team already has a Product Owner'
            : 'This team already has a Scrum Master'
        );
      }
    }

    member.role = role as TeamMember['role'];
    const team = teamOf(teamId);
    if (team) {
      team.updatedAt = new Date().toISOString();
    }

    return ok(member);
  }),

  http.delete(apiUrl('/teams/:teamId/members/:memberId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    const team = teamOf(teamId);
    if (!team) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner can remove team members');
    }

    const member = findMember(teamId, String(params.memberId ?? ''));
    if (!member) {
      return problems.notFound('Team member');
    }
    if (soleRoleholder(teamId, member.role.toUpperCase())) {
      return fail(
        409,
        'LAST_ROLEHOLDER',
        member.role.toUpperCase() === 'PRODUCT_OWNER'
          ? 'A team cannot be left without a Product Owner'
          : 'A team cannot be left without a Scrum Master'
      );
    }

    team.members = (team.members ?? []).filter((candidate) => candidate.id !== member.id);
    team.memberCount = team.members.length;
    team.updatedAt = new Date().toISOString();

    return ok(null);
  }),
];

/**
 * The team the session is working in: the one signed in through or switched to,
 * falling back to the first team the person belongs to.
 */
function selectedTeamIdOf(userId: string): string | null {
  const selected = currentTeamId();
  if (selected && isMemberOf(userId, selected)) {
    return selected;
  }
  return teamsOf(userId)[0]?.id ?? null;
}
