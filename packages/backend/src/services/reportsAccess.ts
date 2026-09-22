// Report access predicate.
//
// Transparency in Scrum is visibility to those doing and receiving the work, not to the whole
// installation: a report reads a team's own observed history -- what it committed to, delivered,
// and inspected. `docs/api/reports.md` already promised that "all report endpoints require team
// membership verification"; this module is what makes that promise true.
//
// It lives in its own module (mirroring `incrementAccess.ts` and `retrospectiveAccess.ts`) because
// the same rule has to be answered identically from every entry point. Unlike the route-level
// guard it is also called from the service layer, so a report endpoint added later cannot bypass
// the rule by forgetting the middleware.
import prisma from '../utils/prisma';
import { localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import type { GateCode } from '@scrumooth/shared';

/** Why a report read was refused, in the caller's own gate vocabulary. */
export interface ReportsRefusal {
  messageKey: string;
  gateCode: GateCode;
}

/** The default refusal: a report belongs to the Scrum Team whose history it reads. */
export const REPORTS_TEAM_REFUSAL: ReportsRefusal = {
  messageKey: 'errors:reports.teamMembersOnly',
  gateCode: GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY,
};

/**
 * Assert that the caller is a member of the team whose reports are being read.
 *
 * Enforced in the service layer (not only on the routes) so that a newly added route cannot bypass
 * it: every entry point calls this before reading. The check is fail-closed -- a missing caller is
 * refused rather than treated as exempt -- and it runs before the report cache is consulted, since
 * the cache is keyed by team alone and would otherwise answer a non-member from another caller's
 * read.
 *
 * @param userId - the authenticated caller
 * @param teamId - the team whose reports are being read
 * @param refusal - the module's localized message key and stable gate code
 * @throws ForbiddenError (403) when the caller is not a member of the team.
 */
export const assertReportsTeamMember = async (
  userId: string | undefined,
  teamId: string,
  refusal: ReportsRefusal = REPORTS_TEAM_REFUSAL
): Promise<void> => {
  if (!userId) {
    throw localizedError('errors:unauthorized', {}, 403, refusal.gateCode);
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw localizedError(refusal.messageKey, {}, 403, refusal.gateCode);
  }
};
