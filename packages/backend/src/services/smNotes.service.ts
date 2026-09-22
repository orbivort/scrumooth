// Scrumb Master notes service.
//
// The notes on a Sprint, a Sprint Review and a Sprint Retrospective are the Scrum Master's
// coaching record. They are readable and writable only by the team's Scrum Master (the rule lives
// in `smNotesAccess`), and every real edit appends a revision so the record is a trail rather than
// a field anyone can overwrite without a trace.
import prisma from '../utils/prisma';
import { localizedError } from '../utils/errors';
import { GATE_CODES, SmNotesEntityType } from '@scrumooth/shared';
import {
  assertSmNotesScrumMaster,
  resolveSmNotesSubject,
  type SmNotesSubject,
} from './smNotesAccess';
import { generateUUIDv7 } from '../utils/uuid';
import {
  auditResourceEvent,
  AuditActions,
  AuditEventTypes,
  AuditResults,
} from '../utils/auditLogger';

/** Default page size for a history read; the timeline loads on demand, not with the event. */
const DEFAULT_REVISION_PAGE_SIZE = 20;
const MAX_REVISION_PAGE_SIZE = 100;

/**
 * Prisma's `$transaction` cannot insert a dense per-entity `revision` atomically without a lock, so
 * two simultaneous writes for the same event can compute the same next number. The unique index on
 * `(entityType, entityId, revision)` turns that race into a refusal rather than a silent duplicate
 * history, and the write is retried so the loser of the race still succeeds with the next number.
 */
const MAX_REVISION_ATTEMPTS = 3;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';

const withRevisionRetry = async <T>(write: () => Promise<T>): Promise<T> => {
  for (let attempt = 0; attempt < MAX_REVISION_ATTEMPTS; attempt += 1) {
    try {
      return await write();
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === MAX_REVISION_ATTEMPTS - 1) {
        throw error;
      }
    }
  }

  // Unreachable: the loop above either returns or throws on its last attempt.
  throw localizedError('errors:unexpectedError', {}, 400);
};

interface StoredNotes {
  id: string;
  smNotes: string | null;
  updatedAt: Date;
}

/**
 * Write the notes on the event a subject describes, appending a revision in the same transaction.
 *
 * A write whose text is unchanged is a no-op: it appends nothing, touches nothing, and audits
 * nothing. A revision history that grows every time someone presses Save without editing would
 * make the trail useless for the question it exists to answer -- what did the notes say before.
 */
const saveNotes = async (
  entityType: SmNotesEntityType,
  entityId: string,
  smNotes: string,
  userId: string
): Promise<StoredNotes & { revision: number; changed: boolean }> => {
  const subject: SmNotesSubject = await resolveSmNotesSubject(entityType, entityId);

  await assertSmNotesScrumMaster(subject, userId);

  const current = subject.smNotes ?? '';

  if (current === smNotes) {
    return {
      id: subject.entityId,
      smNotes: subject.smNotes,
      updatedAt: new Date(),
      revision: await latestRevision(subject),
      changed: false,
    };
  }

  const saved = await withRevisionRetry(() =>
    prisma.$transaction(async (tx) => {
      const latest = await tx.smNotesRevision.findFirst({
        where: { entityType, entityId },
        orderBy: { revision: 'desc' },
        select: { revision: true },
      });
      const revision = (latest?.revision ?? 0) + 1;

      const updated =
        entityType === SmNotesEntityType.SPRINT
          ? await tx.sprint.update({
              where: { id: entityId },
              data: { smNotes, updatedBy: userId, updatedAt: new Date() },
              select: { id: true, smNotes: true, updatedAt: true },
            })
          : entityType === SmNotesEntityType.SPRINT_REVIEW
            ? await tx.sprintReview.update({
                where: { id: entityId },
                data: { smNotes, updatedBy: userId, updatedAt: new Date() },
                select: { id: true, smNotes: true, updatedAt: true },
              })
            : await tx.sprintRetrospective.update({
                where: { id: entityId },
                data: { smNotes, updatedBy: userId, updatedAt: new Date() },
                select: { id: true, smNotes: true, updatedAt: true },
              });

      await tx.smNotesRevision.create({
        data: {
          id: generateUUIDv7(),
          entityType,
          entityId,
          teamId: subject.teamId,
          revision,
          content: smNotes,
          createdBy: userId,
        },
      });

      return { ...updated, revision };
    })
  );

  // The audit trail records that the notes changed, by whom, and how long they are -- never the
  // criticism itself, which is why the revision table exists. The Retrospective keeps the event
  // type it has always been audited under.
  auditResourceEvent(
    entityType === SmNotesEntityType.SPRINT_RETROSPECTIVE
      ? AuditEventTypes.RETROSPECTIVE
      : AuditEventTypes.SPRINT,
    AuditActions.UPDATE,
    AuditResults.SUCCESS,
    { type: `${entityType}_SM_NOTES`, id: entityId },
    {
      teamId: subject.teamId,
      noteLength: smNotes.length,
      revision: saved.revision,
    }
  );

  return { ...saved, changed: true };
};

/** The newest revision number for an event; `0` when it has none. */
const latestRevision = async (subject: Pick<SmNotesSubject, 'entityType' | 'entityId'>) => {
  const latest = await prisma.smNotesRevision.findFirst({
    where: { entityType: subject.entityType, entityId: subject.entityId },
    orderBy: { revision: 'desc' },
    select: { revision: true },
  });

  return latest?.revision ?? 0;
};

export const smNotesService = {
  /** Write the team's Scrum Master notes on a Sprint. */
  async updateSprintNotes(id: string, smNotes: string, userId: string | undefined) {
    if (!userId) {
      throw localizedError('errors:unauthorized', {}, 403, GATE_CODES.SPRINT_SM_NOTES_SM_ONLY);
    }

    return saveNotes(SmNotesEntityType.SPRINT, id, smNotes, userId);
  },

  /**
   * Write the team's Scrum Master notes on a Sprint Review.
   *
   * These are the Scrum Master's coaching observations about the event, not a shared field, so only
   * the team's Scrum Master may write them. The interface already hides the editor from everyone
   * else; this closes the API path that would otherwise let any authenticated user write (or
   * overwrite) them.
   */
  async updateSprintReviewNotes(id: string, smNotes: string, userId: string | undefined) {
    if (!userId) {
      throw localizedError(
        'errors:unauthorized',
        {},
        403,
        GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY
      );
    }

    return saveNotes(SmNotesEntityType.SPRINT_REVIEW, id, smNotes, userId);
  },

  /**
   * Write the team's Scrum Master notes on a Sprint Retrospective.
   *
   * A Retrospective records candid reflection about individuals and interactions, which is exactly
   * where a coaching observation belongs -- and exactly why it cannot also be a shared field. Only
   * the team's Scrum Master may read or write these notes.
   */
  async updateRetrospectiveNotes(id: string, smNotes: string, userId: string | undefined) {
    if (!userId) {
      throw localizedError(
        'errors:unauthorized',
        {},
        403,
        GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY
      );
    }

    return saveNotes(SmNotesEntityType.SPRINT_RETROSPECTIVE, id, smNotes, userId);
  },

  /**
   * The revision history of one event's notes, newest first.
   *
   * Reading the trail is reading the notes themselves, so it carries the same rule: the team's
   * Scrum Master, and nobody else.
   */
  async getRevisions(
    entityType: SmNotesEntityType,
    entityId: string,
    userId: string | undefined,
    options: { limit?: number; offset?: number } = {}
  ) {
    const subject = await resolveSmNotesSubject(entityType, entityId);

    await assertSmNotesScrumMaster(subject, userId);

    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_REVISION_PAGE_SIZE, 1),
      MAX_REVISION_PAGE_SIZE
    );
    const offset = Math.max(options.offset ?? 0, 0);

    const [revisions, total] = await Promise.all([
      prisma.smNotesRevision.findMany({
        where: { entityType, entityId },
        orderBy: { revision: 'desc' },
        take: limit,
        skip: offset,
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.smNotesRevision.count({ where: { entityType, entityId } }),
    ]);

    return {
      revisions: revisions.map((revision) => ({
        id: revision.id,
        entityType: revision.entityType,
        entityId: revision.entityId,
        revision: revision.revision,
        content: revision.content,
        createdBy: revision.createdBy,
        authorName: `${revision.author.firstName} ${revision.author.lastName}`.trim(),
        createdAt: revision.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  },
};
