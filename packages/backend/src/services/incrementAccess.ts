// Increment access and eligibility predicates.
//
// Two questions have to be answered the same way everywhere in the Increment lifecycle:
//
//  1. May this caller touch this Scrum Team's Increment at all? The Increment is the team's own
//     artifact, so reading or writing one requires membership of the team that owns it.
//  2. Does a Product Backlog item actually satisfy the team's Definition of Done? The Done gate
//     and Increment composition must agree, or an Increment can absorb work the gate would refuse.
//
// Both live here rather than on `increment.service.ts` because that service is already imported by
// `backlog.service.ts`: putting them there would create an import cycle, and duplicating them in
// each caller would be the real debt — two answers to one rule.
import prisma from '../utils/prisma';
import { localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import type { GateCode } from '@scrumooth/shared';

/**
 * Why a Product Backlog item is not yet eligible for Done / Increment membership.
 *
 * `NO_DOD` is separated from `UNVERIFIED` because they need different refusals: an empty
 * Definition of Done is a missing commitment to define, not a checklist to finish.
 */
export type DoDEligibility =
  | { eligible: true }
  | { eligible: false; reason: 'NO_DOD' | 'UNVERIFIED'; unverifiedCount: number };

/**
 * Assert that the caller is a member of the given team, refusing with the caller's own gate copy.
 *
 * Enforced in the service layer (not only on the routes) so a newly added route cannot bypass it:
 * every entry point calls this before reading or writing.
 *
 * @param userId - the authenticated caller
 * @param teamId - the team the artifact belongs to
 * @param refusal - the module's localized message key and stable gate code
 * @throws ForbiddenError (403) when the caller is not a member of the team.
 */
export async function assertTeamMember(
  userId: string,
  teamId: string,
  refusal: { messageKey: string; gateCode: GateCode }
): Promise<void> {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw localizedError(refusal.messageKey, {}, 403, refusal.gateCode);
  }
}

/**
 * Assert that the caller belongs to the team that owns the Increment.
 *
 * @throws ForbiddenError (403, `GATE_INCREMENT_TEAM_MEMBERS_ONLY`) when the caller is not a member.
 */
export async function assertIncrementTeamMember(userId: string, teamId: string): Promise<void> {
  await assertTeamMember(userId, teamId, {
    messageKey: 'errors:increment.teamMembersOnly',
    gateCode: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
  });
}

/**
 * Assert that the caller belongs to the team whose Definition of Done is being read or changed.
 *
 * The Definition of Done decides what "Done" means for the team's Increment, so a non-member who
 * could write a verification could decide that another team's work is Done.
 *
 * @throws ForbiddenError (403, `GATE_DOD_TEAM_MEMBERS_ONLY`) when the caller is not a member.
 */
export async function assertDoDTeamMember(userId: string, teamId: string): Promise<void> {
  await assertTeamMember(userId, teamId, {
    messageKey: 'errors:dodTeamMembersOnly',
    gateCode: GATE_CODES.DOD_TEAM_MEMBERS_ONLY,
  });
}

/**
 * Evaluate whether a Product Backlog item satisfies the team's active Definition of Done.
 *
 * A team with no active Definition of Done item has nothing to satisfy, which is exactly why it is
 * reported as ineligible rather than as automatically compliant: an empty commitment must never
 * make the gate pass. Callers decide which refusal (or skip) that deserves.
 *
 * @param pbiId - the Product Backlog item to evaluate
 * @param teamId - the team whose Definition of Done applies
 */
export async function checkDoDEligibility(pbiId: string, teamId: string): Promise<DoDEligibility> {
  const dod = await prisma.definitionOfDone.findUnique({
    where: { teamId },
    select: {
      items: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const activeDodItemIds = (dod?.items ?? []).map((item) => item.id);
  if (activeDodItemIds.length === 0) {
    return { eligible: false, reason: 'NO_DOD', unverifiedCount: 0 };
  }

  const verifiedRows = await prisma.doDChecklistVerification.findMany({
    where: {
      pbiId,
      dodItemId: { in: activeDodItemIds },
      isVerified: true,
    },
    select: { dodItemId: true },
  });

  const verifiedDodItemIds = new Set(verifiedRows.map((row) => row.dodItemId));
  const unverified = activeDodItemIds.filter((id) => !verifiedDodItemIds.has(id));

  if (unverified.length > 0) {
    return { eligible: false, reason: 'UNVERIFIED', unverifiedCount: unverified.length };
  }

  return { eligible: true };
}

/**
 * The subset of the given Product Backlog items that fully satisfies the team's active Definition
 * of Done, resolved in two queries regardless of how many items are asked about.
 *
 * Used where an item is skipped rather than refused (Increment composition and reconciliation),
 * so a whole Sprint's Done items can be re-checked without a query per item.
 *
 * @param pbiIds - the Product Backlog items to filter
 * @param teamId - the team whose Definition of Done applies
 */
export async function getFullyDoDVerifiedPbiIds(
  pbiIds: string[],
  teamId: string
): Promise<Set<string>> {
  if (pbiIds.length === 0) {
    return new Set();
  }

  const dod = await prisma.definitionOfDone.findUnique({
    where: { teamId },
    select: {
      items: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  const activeDodItemIds = (dod?.items ?? []).map((item) => item.id);
  if (activeDodItemIds.length === 0) {
    return new Set();
  }

  const verifiedRows = await prisma.doDChecklistVerification.findMany({
    where: {
      pbiId: { in: pbiIds },
      dodItemId: { in: activeDodItemIds },
      isVerified: true,
    },
    select: { pbiId: true, dodItemId: true },
  });

  const verifiedByPbi = new Map<string, Set<string>>();
  for (const row of verifiedRows) {
    const verified = verifiedByPbi.get(row.pbiId) ?? new Set<string>();
    verified.add(row.dodItemId);
    verifiedByPbi.set(row.pbiId, verified);
  }

  return new Set(
    pbiIds.filter((pbiId) => (verifiedByPbi.get(pbiId)?.size ?? 0) === activeDodItemIds.length)
  );
}

/**
 * Boolean form of {@link checkDoDEligibility}, for callers that only need the verdict (Increment
 * composition, which skips an ineligible item instead of refusing).
 */
export async function isFullyDoDVerified(pbiId: string, teamId: string): Promise<boolean> {
  const eligible = await getFullyDoDVerifiedPbiIds([pbiId], teamId);
  return eligible.has(pbiId);
}
