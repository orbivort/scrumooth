// Which Definition of Done governs a team.
//
// A Definition of Done has exactly one owner: the team itself, or -- when the team works with
// other Scrum Teams on one product -- the group those teams belong to. The 2020 Scrum Guide:
// *"If there are multiple Scrum Teams working together on a product, they must mutually define and
// comply with the same Definition of Done."* The group owns the only row its teams read, so the
// rule holds by construction instead of by the teams' agreement to keep two copies in step.
//
// Every DoD read and write in the backend resolves its target through this module rather than
// assuming `where: { teamId }`. That assumption was correct while a Definition of Done could only
// belong to a team; it is now the one place the old assumption could silently return "no Definition
// of Done" for a team that has one.
import prisma from '../utils/prisma';

/** The owner of the Definition of Done that governs a team. */
export type DoDScope =
  | { readonly kind: 'TEAM'; readonly teamId: string }
  | { readonly kind: 'GROUP'; readonly groupId: string };

/**
 * The Prisma `where` that selects the row a scope owns.
 *
 * Both fields are unique in the schema, so this is a point read either way; the union is what keeps
 * "the row whose `teamId` is this team" from being written where "the row whose `groupId` is this
 * group" is meant.
 */
export type DoDScopeWhere = { teamId: string } | { groupId: string };

/**
 * The fields that stamp a new Definition of Done row with its owner.
 *
 * Both columns are set explicitly -- the unused one to `null` -- so the database's
 * `CHECK ((team_id IS NULL) <> (group_id IS NULL))` is satisfied on every create path and a row can
 * never be left owned by nobody.
 */
export type DoDScopeFields = { teamId: string; groupId: null } | { teamId: null; groupId: string };

/**
 * Resolve the Definition of Done that governs `teamId`.
 *
 * A team in a group is governed by that group's single row; any team-scoped row it still has is
 * inert -- retained so its version history survives, never read, and (see `dod.service.ts`) never
 * writable while the team is grouped.
 *
 * @returns the governing scope, or `null` when no such team exists. Callers use `null` exactly as
 * they used an absent row before: as "there is nothing here".
 */
export async function resolveDoDScope(teamId: string): Promise<DoDScope | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { groupId: true },
  });

  if (!team) {
    return null;
  }

  // The lookup is by `id`, so the row's id is the one asked for.
  return team.groupId ? { kind: 'GROUP', groupId: team.groupId } : { kind: 'TEAM', teamId };
}

/** Resolve the scope of a group's shared Definition of Done directly, without a team in hand. */
export function groupDoDScope(groupId: string): DoDScope {
  return { kind: 'GROUP', groupId };
}

/** The Prisma `where` that selects the row a scope owns. */
export function doDScopeWhere(scope: DoDScope): DoDScopeWhere {
  return scope.kind === 'GROUP' ? { groupId: scope.groupId } : { teamId: scope.teamId };
}

/** The Prisma fields that stamp a row as owned by `scope`. */
export function doDScopeFields(scope: DoDScope): DoDScopeFields {
  return scope.kind === 'GROUP'
    ? { teamId: null, groupId: scope.groupId }
    : { teamId: scope.teamId, groupId: null };
}

/** Whether a resolved scope is a group's shared Definition of Done. */
export function isGroupScope(scope: DoDScope): scope is { kind: 'GROUP'; groupId: string } {
  return scope.kind === 'GROUP';
}
