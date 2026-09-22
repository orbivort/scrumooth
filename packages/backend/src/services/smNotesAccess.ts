// Scrum Master notes access rule.
//
// The 2020 Scrum Guide makes the Scrum Master accountable for the Scrum Team's effectiveness, and
// the notes on a Sprint, a Sprint Review and a Sprint Retrospective are where that coaching is
// written down. They are therefore not a shared field: they are readable and writable only by the
// team's Scrum Master, and the rule has to be answered identically from every entry point.
//
// This lives in its own module (mirroring `retrospectiveAccess.ts` and `incrementAccess.ts`) for
// two reasons: the three events must not drift apart, and the redaction on the read path has to be
// a single, auditable decision rather than a `select` someone can forget.
import prisma from '../utils/prisma';
import { localizedError, NotFoundError } from '../utils/errors';
import { GATE_CODES, SmNotesEntityType } from '@scrumooth/shared';
import type { GateCode } from '@scrumooth/shared';

/** Why a notes request was refused, in the calling module's own gate vocabulary. */
export interface SmNotesRefusal {
  messageKey: string;
  gateCode: GateCode;
}

const REFUSALS: Record<SmNotesEntityType, SmNotesRefusal> = {
  [SmNotesEntityType.SPRINT]: {
    messageKey: 'errors:sprint.smNotesSmOnly',
    gateCode: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY,
  },
  [SmNotesEntityType.SPRINT_REVIEW]: {
    messageKey: 'errors:sprintReview.smNotesSmOnly',
    gateCode: GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY,
  },
  [SmNotesEntityType.SPRINT_RETROSPECTIVE]: {
    messageKey: 'errors:retrospective.smNotesSmOnly',
    gateCode: GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY,
  },
};

const NOT_FOUND_LABELS: Record<SmNotesEntityType, string> = {
  [SmNotesEntityType.SPRINT]: 'Sprint',
  [SmNotesEntityType.SPRINT_REVIEW]: 'Sprint Review',
  [SmNotesEntityType.SPRINT_RETROSPECTIVE]: 'Sprint Retrospective',
};

/** The `TeamMember` role that owns the notes. Never the account's global role. */
export const isSmNotesScrumMasterRole = (role: string | undefined): boolean =>
  role === 'SCRUM_MASTER';

/** The refusal a given event's notes carry. */
export const smNotesRefusal = (entityType: SmNotesEntityType): SmNotesRefusal =>
  REFUSALS[entityType];

/** An event whose notes were resolved together with the team that owns them. */
export interface SmNotesSubject {
  entityType: SmNotesEntityType;
  entityId: string;
  teamId: string;
  /** The current text, used to tell a real edit from a no-op write. */
  smNotes: string | null;
}

/**
 * Load the event a set of notes belongs to, together with its team.
 *
 * The team has to come from the row itself: a route carries no team for `/sprints/:id/sm-notes`,
 * and a caller's role *somewhere* is not a role *here*.
 */
export const resolveSmNotesSubject = async (
  entityType: SmNotesEntityType,
  entityId: string
): Promise<SmNotesSubject> => {
  switch (entityType) {
    case SmNotesEntityType.SPRINT: {
      const sprint = await prisma.sprint.findUnique({
        where: { id: entityId },
        select: { id: true, teamId: true, smNotes: true },
      });

      if (!sprint) {
        throw new NotFoundError(NOT_FOUND_LABELS[entityType]);
      }

      return {
        entityType,
        entityId: sprint.id,
        teamId: sprint.teamId,
        smNotes: sprint.smNotes,
      };
    }
    case SmNotesEntityType.SPRINT_REVIEW: {
      const review = await prisma.sprintReview.findUnique({
        where: { id: entityId },
        select: { id: true, teamId: true, smNotes: true },
      });

      if (!review) {
        throw new NotFoundError(NOT_FOUND_LABELS[entityType]);
      }

      return {
        entityType,
        entityId: review.id,
        teamId: review.teamId,
        smNotes: review.smNotes,
      };
    }
    case SmNotesEntityType.SPRINT_RETROSPECTIVE: {
      const retrospective = await prisma.sprintRetrospective.findUnique({
        where: { id: entityId },
        select: { id: true, teamId: true, smNotes: true },
      });

      if (!retrospective) {
        throw new NotFoundError(NOT_FOUND_LABELS[entityType]);
      }

      return {
        entityType,
        entityId: retrospective.id,
        teamId: retrospective.teamId,
        smNotes: retrospective.smNotes,
      };
    }
  }
};

/**
 * Assert that the caller is the Scrum Master of the team the notes belong to.
 *
 * Fail-closed: a missing caller is refused rather than treated as exempt, and a member who holds
 * the role in another team is refused too -- the check is scoped to this team, not to the account.
 */
export const assertSmNotesScrumMaster = async (
  subject: Pick<SmNotesSubject, 'teamId' | 'entityType'>,
  userId: string | undefined
): Promise<void> => {
  const refusal = smNotesRefusal(subject.entityType);

  if (!userId) {
    throw localizedError('errors:unauthorized', {}, 403, refusal.gateCode);
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: subject.teamId, userId } },
    select: { role: true },
  });

  if (!isSmNotesScrumMasterRole(membership?.role)) {
    throw localizedError(refusal.messageKey, {}, 403, refusal.gateCode);
  }
};

/**
 * Which of the given teams the caller leads, resolved in one indexed query.
 *
 * Used by the read path: a list of Sprints or Reviews can span one team, and the redaction must not
 * cost one membership lookup per row.
 */
export const teamsLedBy = async (
  teamIds: readonly string[],
  userId: string | undefined
): Promise<ReadonlySet<string>> => {
  if (!userId || teamIds.length === 0) {
    return new Set<string>();
  }

  const memberships = await prisma.teamMember.findMany({
    where: { userId, teamId: { in: [...new Set(teamIds)] }, role: 'SCRUM_MASTER' },
    select: { teamId: true },
  });

  return new Set(memberships.map((membership) => membership.teamId));
};

/**
 * Redact `smNotes` from rows whose team the caller does not lead.
 *
 * Hiding the editor in the interface was never a gate; not serializing the value is. The field is
 * removed rather than blanked, so a client cannot tell an empty note from a withheld one.
 */
export const redactSmNotesForCaller = async <T extends { teamId: string; smNotes?: string | null }>(
  rows: T[],
  userId: string | undefined
): Promise<T[]> => {
  if (rows.length === 0) {
    return rows;
  }

  const ledTeams = await teamsLedBy(
    rows.map((row) => row.teamId),
    userId
  );

  return rows.map((row) => {
    if (ledTeams.has(row.teamId)) {
      return row;
    }

    const { smNotes: _smNotes, ...rest } = row;
    return rest as T;
  });
};
