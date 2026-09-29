// Sprint Retrospective access predicate.
//
// "The Scrum Team inspects... individuals, interactions, processes, tools, and their Definition of
// Done." A Retrospective therefore holds candid criticism of people, not only of process, so the
// room has to be the Scrum Team rather than the whole installation: reading or writing one requires
// membership of the team whose Sprint it concludes.
//
// This lives in its own module (mirroring `incrementAccess.ts`) because the retrospective service
// is imported by the controller and by the Backlog page's action-item panel, and because the same
// rule has to be answered identically from every entry point. Unlike the Increment predicate it
// returns the caller's team role: the Retrospective must redact the Scrum Master's notes for
// everyone else, and returning the role here keeps that from costing a second membership lookup.
import prisma from '../utils/prisma';
import { localizedError, NotFoundError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import type { GateCode } from '@scrumooth/shared';
import { isSmNotesScrumMasterRole } from './smNotesAccess';

/** Why a Retrospective request was refused, in the caller's own gate vocabulary. */
export interface RetrospectiveRefusal {
  messageKey: string;
  gateCode: GateCode;
}

/**
 * The caller's standing in the team whose Sprint the Retrospective concludes.
 *
 * `role` is the `TeamMember` role (`PRODUCT_OWNER` | `SCRUM_MASTER` | `DEVELOPERS`), never the
 * account's global role: the Scrum Master who owns the notes is the team's Scrum Master.
 */
export interface RetrospectiveMembership {
  teamId: string;
  role: string;
}

/** The default refusal: the Retrospective belongs to the Scrum Team that owns the Sprint. */
export const RETROSPECTIVE_TEAM_REFUSAL: RetrospectiveRefusal = {
  messageKey: 'errors:retrospective.teamMembersOnly',
  gateCode: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY,
};

/**
 * Whether the caller holds the team role that owns the Retrospective's coaching notes.
 *
 * The same rule governs the notes on a Sprint, a Sprint Review and a Sprint Retrospective, so this
 * is the shared predicate rather than a third copy of it: the three events cannot drift apart.
 */
export const isRetrospectiveScrumMaster = isSmNotesScrumMasterRole;

/**
 * Assert that the caller is a member of the team that owns a Retrospective.
 *
 * Enforced in the service layer (not only on the routes) so that a newly added route cannot bypass
 * it: every entry point calls this before reading or writing. The check is fail-closed -- a missing
 * caller is refused rather than treated as exempt.
 *
 * @param userId - the authenticated caller
 * @param teamId - the team the Retrospective belongs to
 * @param refusal - the module's localized message key and stable gate code
 * @throws ForbiddenError (403) when the caller is not a member of the team.
 */
export const assertRetrospectiveTeamMember = async (
  userId: string | undefined,
  teamId: string,
  refusal: RetrospectiveRefusal = RETROSPECTIVE_TEAM_REFUSAL
): Promise<RetrospectiveMembership> => {
  if (!userId) {
    throw localizedError('errors:unauthorized', {}, 403, refusal.gateCode);
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true },
  });

  if (!membership) {
    throw localizedError(refusal.messageKey, {}, 403, refusal.gateCode);
  }

  return { teamId, role: membership.role };
};

/**
 * Assert access to a Retrospective identified by its own id.
 *
 * Returns the owning team and the caller's role in it, which is what the read path needs to decide
 * whether the Scrum Master's notes may be serialized.
 *
 * @throws NotFoundError when the Retrospective does not exist.
 * @throws ForbiddenError (403, `GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY`) for a non-member.
 */
export const assertRetrospectiveAccess = async (
  userId: string | undefined,
  retrospectiveId: string
): Promise<RetrospectiveMembership> => {
  const retrospective = await prisma.sprintRetrospective.findUnique({
    where: { id: retrospectiveId },
    select: { teamId: true },
  });

  if (!retrospective) {
    throw new NotFoundError('Retrospective');
  }

  return assertRetrospectiveTeamMember(userId, retrospective.teamId);
};
