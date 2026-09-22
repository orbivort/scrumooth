// Increment access and eligibility predicates.
//
// Two questions have to be answered the same way everywhere in the Increment lifecycle:
//
//  1. May this caller touch this Scrum Team's artifact at all? The Increment is the team's own
//     artifact, so reading or writing one requires membership of the team that owns it.
//  2. Does a Product Backlog item actually satisfy the team's Definition of Done -- or, before the
//     Sprint opens, its Definition of Ready? The Done gate, the Sprint boundary and Increment
//     composition must agree, or a Sprint can be opened, or an Increment absorbed, with work the
//     gate would refuse.
//
// Both live here rather than on `increment.service.ts` because that service is already imported by
// `backlog.service.ts`: putting them there would create an import cycle, and duplicating them in
// each caller would be the real debt — two answers to one rule.
//
// The Definition of Ready is a complementary practice rather than a Guide artifact, but the same
// argument applies to it: one predicate, one answer, shared by the gate and the editor.
import prisma from '../utils/prisma';
import { localizedError } from '../utils/errors';
import { doDScopeWhere, resolveDoDScope } from './dodScope';
import { assertTeamScrumMaster } from './teamRoleAccess';
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
 * The ids of the active criteria of the Definition of Done that governs this team, or an empty list
 * when there is none.
 *
 * One rule, one query: the Done gate, the Sprint boundary gate and Increment composition all ask
 * "does this team hold work to a commitment at all?", and they must not each write their own version
 * of the question. "The team whose Definition of Done applies" is the group's shared one while the
 * team is in a group, so the scope is resolved exactly as the DoD editor resolves it — otherwise the
 * gate and the editor would disagree about which commitment an item has to satisfy.
 *
 * @param teamId - the team whose Definition of Done applies
 */
export async function getActiveDoDItemIds(teamId: string): Promise<string[]> {
  const scope = await resolveDoDScope(teamId);

  const dod = scope
    ? await prisma.definitionOfDone.findUnique({
        where: doDScopeWhere(scope),
        select: {
          items: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      })
    : null;

  return (dod?.items ?? []).map((item) => item.id);
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
  const activeDodItemIds = await getActiveDoDItemIds(teamId);

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

  const activeDodItemIds = await getActiveDoDItemIds(teamId);
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

/**
 * Why an item does not yet satisfy the team's Definition of Ready.
 *
 * `NO_DOR` is separated from `UNVERIFIED` for the same reason the Definition of Done separates them:
 * a missing agreement to define and a checklist to finish need different refusals, and neither may
 * be allowed to make the rule pass silently.
 */
export type DoREligibility =
  | { eligible: true }
  | { eligible: false; reason: 'NO_DOR' | 'UNVERIFIED'; unverifiedCount: number };

/**
 * Assert that the caller belongs to the team whose Definition of Ready is being read or verified.
 *
 * The Definition of Ready is a complementary practice rather than a Scrum Guide artifact, but it is
 * still the team's own agreement about when an item is ready to be planned, so it belongs to the
 * team that owns it: nobody outside the team records that another team's work is ready.
 *
 * @throws ForbiddenError (403, `GATE_DOR_TEAM_MEMBERS_ONLY`) when the caller is not a member.
 */
export async function assertDoRTeamMember(userId: string, teamId: string): Promise<void> {
  await assertTeamMember(userId, teamId, {
    messageKey: 'errors:dorTeamMembersOnly',
    gateCode: GATE_CODES.DOR_TEAM_MEMBERS_ONLY,
  });
}

/**
 * Assert that the caller is the team's Scrum Master, who owns the readiness agreement.
 *
 * The API reference already documented the readiness list as Scrum-Master-editable while nothing
 * enforced it; this is where the documented contract becomes true. Membership is implied: the role
 * is read from the caller's membership row.
 *
 * @throws ForbiddenError (403, `GATE_DOR_SCRUM_MASTER_ONLY`) when the caller is not that Scrum Master.
 */
export async function assertDoRScrumMaster(userId: string, teamId: string): Promise<void> {
  await assertTeamScrumMaster(teamId, userId, {
    messageKey: 'errors:dorScrumMasterOnly',
    gateCode: GATE_CODES.DOR_SCRUM_MASTER_ONLY,
  });
}

/**
 * The ids of the active criteria of the team's Definition of Ready, or an empty list when there is
 * none. Readiness is team-scoped (there is no group-shared readiness agreement), so the lookup is by
 * team alone.
 */
async function getActiveDoRItemIds(teamId: string): Promise<string[]> {
  const dor = await prisma.definitionOfReady.findUnique({
    where: { teamId },
    select: {
      items: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });

  return (dor?.items ?? []).map((item) => item.id);
}

/**
 * Evaluate whether a Product Backlog item satisfies the team's active Definition of Ready.
 *
 * Symmetrical with {@link checkDoDEligibility}: a team with no active criterion has nothing to
 * satisfy, which is why it is reported as ineligible rather than as automatically ready — an empty
 * agreement must never make the readiness rule pass.
 *
 * @param pbiId - the Product Backlog item to evaluate
 * @param teamId - the team whose Definition of Ready applies
 */
export async function checkDoREligibility(pbiId: string, teamId: string): Promise<DoREligibility> {
  const activeDoRItemIds = await getActiveDoRItemIds(teamId);

  if (activeDoRItemIds.length === 0) {
    return { eligible: false, reason: 'NO_DOR', unverifiedCount: 0 };
  }

  const verifiedRows = await prisma.doRChecklistVerification.findMany({
    where: {
      pbiId,
      dorItemId: { in: activeDoRItemIds },
      isVerified: true,
    },
    select: { dorItemId: true },
  });

  const verifiedDoRItemIds = new Set(verifiedRows.map((row) => row.dorItemId));
  const unverifiedCount = activeDoRItemIds.filter((id) => !verifiedDoRItemIds.has(id)).length;

  if (unverifiedCount > 0) {
    return { eligible: false, reason: 'UNVERIFIED', unverifiedCount };
  }

  return { eligible: true };
}

/**
 * The team's readiness shortfall for a whole set of Product Backlog items, resolved in two queries
 * regardless of how many items are asked about.
 *
 * The Sprint boundary refuses a *set* of items rather than one, and the refusal has to name the
 * items that are not ready — so the verdict and the active-criterion count come back together, and
 * an empty agreement (`activeItemCount === 0`) is distinguishable from "these items are not ready".
 */
export interface DoRShortfall {
  /** How many active readiness criteria the team's agreement holds. */
  activeItemCount: number;
  /** The items that still have at least one unverified active criterion, in the order asked. */
  incompletePbiIds: string[];
}

/**
 * @param teamId - the team whose Definition of Ready applies
 * @param pbiIds - the Product Backlog items the team is about to commit to
 */
export async function getDoRShortfall(teamId: string, pbiIds: string[]): Promise<DoRShortfall> {
  const uniquePbiIds = [...new Set(pbiIds)];
  const activeDoRItemIds = await getActiveDoRItemIds(teamId);

  if (activeDoRItemIds.length === 0) {
    return { activeItemCount: 0, incompletePbiIds: [] };
  }

  if (uniquePbiIds.length === 0) {
    return { activeItemCount: activeDoRItemIds.length, incompletePbiIds: [] };
  }

  const verifiedRows = await prisma.doRChecklistVerification.findMany({
    where: {
      pbiId: { in: uniquePbiIds },
      dorItemId: { in: activeDoRItemIds },
      isVerified: true,
    },
    select: { pbiId: true, dorItemId: true },
  });

  const verifiedByPbi = new Map<string, Set<string>>();
  for (const row of verifiedRows) {
    const verified = verifiedByPbi.get(row.pbiId) ?? new Set<string>();
    verified.add(row.dorItemId);
    verifiedByPbi.set(row.pbiId, verified);
  }

  const incompletePbiIds = uniquePbiIds.filter((pbiId) => {
    const verified = verifiedByPbi.get(pbiId);
    return activeDoRItemIds.some((itemId) => !verified?.has(itemId));
  });

  return { activeItemCount: activeDoRItemIds.length, incompletePbiIds };
}
