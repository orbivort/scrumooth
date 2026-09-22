// Team-scoped role assertions.
//
// Every team-owned resource asks the same two questions: is the caller in this team, and is the
// caller this team's Scrum Master? The answer has to be the same everywhere, and it has to be
// resolved from the resource's own team -- a role held in *some* team is not a role in *this* one.
// The refusal is passed in so each module keeps its own localized message and stable gate code.
import prisma from '../utils/prisma';
import { localizedError } from '../utils/errors';
import { UserRole } from '../generated/prisma/client';
import type { GateCode } from '@scrumooth/shared';

/** A module's localized refusal: the message it shows and the gate code it returns. */
export interface TeamRoleRefusal {
  messageKey: string;
  gateCode: GateCode;
}

/**
 * Assert that the caller is a member of the team, returning the role they hold there.
 *
 * Fail-closed: a missing caller is refused rather than treated as exempt.
 */
export const assertTeamMembership = async (
  teamId: string,
  userId: string | undefined,
  refusal: TeamRoleRefusal
): Promise<UserRole> => {
  const membership = userId
    ? await prisma.teamMember.findFirst({
        where: { teamId, userId },
        select: { role: true },
      })
    : null;

  if (!membership) {
    throw localizedError(refusal.messageKey, {}, 403, refusal.gateCode);
  }

  return membership.role;
};

/** Assert that the caller is the team's Scrum Master, and nobody else. */
export const assertTeamScrumMaster = async (
  teamId: string,
  userId: string | undefined,
  refusal: TeamRoleRefusal
): Promise<void> => {
  const membership = userId
    ? await prisma.teamMember.findFirst({
        where: { teamId, userId },
        select: { role: true },
      })
    : null;

  if (membership?.role !== UserRole.SCRUM_MASTER) {
    throw localizedError(refusal.messageKey, {}, 403, refusal.gateCode);
  }
};

/** Whether the given role owns the team's Scrum Master-only surfaces. */
export const isTeamScrumMasterRole = (role: string | undefined): boolean =>
  role === UserRole.SCRUM_MASTER;
