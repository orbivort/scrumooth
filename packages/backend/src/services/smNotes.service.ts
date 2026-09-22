// SM Notes Service
// Simple annotations stored on Scrum event models (Sprint, SprintReview, SprintRetrospective).
import prisma from '../utils/prisma';
import { NotFoundError, ForbiddenError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { t as requestT } from '../i18n/requestT.js';
import {
  auditResourceEvent,
  AuditActions,
  AuditEventTypes,
  AuditResults,
} from '../utils/auditLogger';

export const smNotesService = {
  async updateSprintNotes(id: string, smNotes: string, userId: string | undefined) {
    const existing = await prisma.sprint.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Sprint');
    }
    return prisma.sprint.update({
      where: { id },
      data: { smNotes, updatedBy: userId, updatedAt: new Date() },
      select: { id: true, smNotes: true },
    });
  },

  /**
   * Write the Scrum Master's notes on a Sprint Review.
   *
   * These are the Scrum Master's coaching observations about the event, not a shared field, so
   * only the team's Scrum Master may write them. The interface already hides the editor from
   * everyone else; this closes the API path that would otherwise let any authenticated user
   * write (or overwrite) them.
   */
  async updateSprintReviewNotes(id: string, smNotes: string, userId: string | undefined) {
    const existing = await prisma.sprintReview.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    });
    if (!existing) {
      throw new NotFoundError('Sprint Review');
    }

    if (!userId) {
      throw new ForbiddenError(requestT('errors:unauthorized'));
    }

    const membership = await prisma.teamMember.findFirst({
      where: { teamId: existing.teamId, userId },
      select: { role: true },
    });

    if (membership?.role !== 'SCRUM_MASTER') {
      throw localizedError(
        'errors:sprintReview.smNotesSmOnly',
        {},
        403,
        GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY
      );
    }

    return prisma.sprintReview.update({
      where: { id },
      data: { smNotes, updatedBy: userId, updatedAt: new Date() },
      select: { id: true, smNotes: true },
    });
  },

  /**
   * Write the Scrum Master's notes on a Sprint Retrospective.
   *
   * A Retrospective records candid reflection about individuals and interactions, which is exactly
   * where a coaching observation belongs -- and exactly why it cannot also be a shared field. Only
   * the team's Scrum Master may read or write these notes; the interface already hides the editor
   * from everyone else, and this closes the API path that would otherwise expose them to any team
   * member (or to any authenticated user at all, before the team gate existed).
   *
   * The write is audited, but the note body is not: the audit trail records that the notes changed,
   * by whom, and how long they are -- never the criticism itself.
   */
  async updateRetrospectiveNotes(id: string, smNotes: string, userId: string | undefined) {
    const existing = await prisma.sprintRetrospective.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    });
    if (!existing) {
      throw new NotFoundError('Sprint Retrospective');
    }

    if (!userId) {
      throw new ForbiddenError(requestT('errors:unauthorized'));
    }

    const membership = await prisma.teamMember.findFirst({
      where: { teamId: existing.teamId, userId },
      select: { role: true },
    });

    if (membership?.role !== 'SCRUM_MASTER') {
      throw localizedError(
        'errors:retrospective.smNotesSmOnly',
        {},
        403,
        GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY
      );
    }

    const updated = await prisma.sprintRetrospective.update({
      where: { id },
      data: { smNotes, updatedBy: userId, updatedAt: new Date() },
      select: { id: true, smNotes: true },
    });

    auditResourceEvent(
      AuditEventTypes.RETROSPECTIVE,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'SPRINT_RETROSPECTIVE_SM_NOTES', id },
      { teamId: existing.teamId, noteLength: smNotes.length }
    );

    return updated;
  },
};
