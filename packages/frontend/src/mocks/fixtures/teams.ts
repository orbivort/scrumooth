import type { Team, TeamMember, UserRole } from '../../types';
import { fixtureId } from '../support/ids';

import { findUser } from './people';
import { MEMBERSHIP_SEEDS, TEAM_SEEDS, type ApiRole } from './personas';

/**
 * The two demo teams and their memberships.
 *
 * Roles are stored the way the API returns them — `PRODUCT_OWNER`,
 * `SCRUM_MASTER`, `DEVELOPERS`. The frontend's own `UserRole` enum still spells
 * those values in lower case, while `utils/roleUtils.ts` (role labels and badges)
 * matches only the upper-case form. The conversion below keeps that known
 * inconsistency in a single place rather than spreading casts through the seed.
 */
function toMemberRole(role: ApiRole): UserRole {
  return role as unknown as UserRole;
}

/** When the seeded memberships started. Fixed, so the fixtures stay deterministic. */
const JOINED_AT = '2026-01-05T09:00:00.000Z';

function buildMembers(teamId: string): TeamMember[] {
  return (
    MEMBERSHIP_SEEDS.filter((membership) => membership.teamId === teamId)
      .map((membership) => ({
        id: fixtureId('member', `${membership.teamId}:${membership.userId}`),
        teamId: membership.teamId,
        userId: membership.userId,
        role: toMemberRole(membership.role),
        joinedAt: JOINED_AT,
        user: findUser(membership.userId),
      }))
      // The Product Owner first, as the team page lists them.
      .sort((a, b) => {
        const byRole = roleRank(a) - roleRank(b);
        return byRole !== 0 ? byRole : a.userId.localeCompare(b.userId);
      })
  );
}

/** The order the Guide lists the roles in: the Product Owner first, then the team. */
const ROLE_ORDER = new Map<string, number>([
  ['PRODUCT_OWNER', 0],
  ['SCRUM_MASTER', 1],
  ['DEVELOPERS', 2],
]);

function roleRank(member: TeamMember): number {
  return ROLE_ORDER.get(member.role.toUpperCase()) ?? 9;
}

export const TEAMS: readonly Team[] = TEAM_SEEDS.map((seed) => {
  const members = buildMembers(seed.id);
  return {
    id: seed.id,
    name: seed.name,
    description: seed.purpose,
    createdBy: members[0]?.userId ?? '',
    createdAt: JOINED_AT,
    updatedAt: JOINED_AT,
    memberCount: members.length,
    members,
  };
});

/** Every team, keyed by id. */
export const TEAM_BY_ID: ReadonlyMap<string, Team> = new Map(TEAMS.map((team) => [team.id, team]));

export function findTeam(teamId: string): Team | undefined {
  return TEAM_BY_ID.get(teamId);
}

/**
 * The role a person holds in a team, in the casing the API uses, or `undefined`
 * when the person is not a member.
 */
export function seededRoleOf(userId: string, teamId: string): ApiRole | undefined {
  return MEMBERSHIP_SEEDS.find(
    (membership) => membership.userId === userId && membership.teamId === teamId
  )?.role;
}

/** Every team a person belongs to. */
export function seededTeamsOf(userId: string): readonly string[] {
  return MEMBERSHIP_SEEDS.filter((membership) => membership.userId === userId).map(
    (membership) => membership.teamId
  );
}

/** The person holding a given role in a team, or `undefined` when nobody does. */
export function seededHolderOf(teamId: string, role: ApiRole): string | undefined {
  return MEMBERSHIP_SEEDS.find(
    (membership) => membership.teamId === teamId && membership.role === role
  )?.userId;
}

/** Everyone in a team, in the order `TEAMS` lists them. */
export function seededMembersOf(teamId: string): readonly string[] {
  return MEMBERSHIP_SEEDS.filter((membership) => membership.teamId === teamId).map(
    (membership) => membership.userId
  );
}

/** The Developers of a team. The Sprint Backlog belongs to them. */
export function seededDevelopersOf(teamId: string): readonly string[] {
  return MEMBERSHIP_SEEDS.filter(
    (membership) => membership.teamId === teamId && membership.role === 'DEVELOPERS'
  ).map((membership) => membership.userId);
}

/**
 * The role the interface needs after switching team, matching the API's
 * `getMyTeams`/`selectTeam` payload, which carries `userRole` alongside the team.
 */
export function withUserRole(team: Team, userId: string): Team & { userRole: string } {
  return { ...team, userRole: seededRoleOf(userId, team.id) ?? 'DEVELOPERS' };
}
