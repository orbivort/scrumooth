import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock prisma module (hoisted, so only vitest references allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    sprint: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sprintReview: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sprintRetrospective: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
  },
}));

// Freeze `new Date()` to a fixed timestamp so the service's updatedAt is deterministic.
function freezeDate(fixed: Date): void {
  vi.useFakeTimers();
  vi.setSystemTime(fixed);
}

// Now import the service and dependencies
import { smNotesService } from '../../../services/smNotes.service';
import prisma from '../../../utils/prisma';
import { NotFoundError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

describe('SM Notes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('updateSprintNotes', () => {
    const sprintId = 'sprint-1';
    const notes = 'Sprint annotation';
    const userId = 'user-1';
    const updatedAt = new Date('2024-01-15T10:00:00.000Z');

    it('should update notes for an existing sprint', async () => {
      const existingSprint = { id: sprintId };
      const updatedSprint = { id: sprintId, smNotes: notes };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(existingSprint as any);
      vi.mocked(prisma.sprint.update).mockResolvedValue(updatedSprint as any);
      // Freeze the updatedAt timestamp set by the service
      freezeDate(updatedAt);

      const result = await smNotesService.updateSprintNotes(sprintId, notes, userId);

      expect(result).toEqual(updatedSprint);
      expect(prisma.sprint.findUnique).toHaveBeenCalledWith({ where: { id: sprintId } });
      expect(prisma.sprint.update).toHaveBeenCalledWith({
        where: { id: sprintId },
        data: { smNotes: notes, updatedBy: userId, updatedAt },
        select: { id: true, smNotes: true },
      });
    });

    it('should update notes when userId is undefined', async () => {
      const existingSprint = { id: sprintId };
      const updatedSprint = { id: sprintId, smNotes: notes };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(existingSprint as any);
      vi.mocked(prisma.sprint.update).mockResolvedValue(updatedSprint as any);
      freezeDate(updatedAt);

      const result = await smNotesService.updateSprintNotes(sprintId, notes, undefined);

      expect(result).toEqual(updatedSprint);
      expect(prisma.sprint.update).toHaveBeenCalledWith({
        where: { id: sprintId },
        data: { smNotes: notes, updatedBy: undefined, updatedAt },
        select: { id: true, smNotes: true },
      });
    });

    it('should update notes with an empty string', async () => {
      const existingSprint = { id: sprintId };
      const updatedSprint = { id: sprintId, smNotes: '' };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(existingSprint as any);
      vi.mocked(prisma.sprint.update).mockResolvedValue(updatedSprint as any);
      freezeDate(updatedAt);

      const result = await smNotesService.updateSprintNotes(sprintId, '', userId);

      expect(result.smNotes).toBe('');
    });

    it('should throw NotFoundError when sprint does not exist', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as any);

      await expect(smNotesService.updateSprintNotes(sprintId, notes, userId)).rejects.toThrow(
        NotFoundError
      );

      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('should propagate errors from update', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ id: sprintId } as any);
      vi.mocked(prisma.sprint.update).mockRejectedValue(new Error('db failure'));
      freezeDate(updatedAt);

      await expect(smNotesService.updateSprintNotes(sprintId, notes, userId)).rejects.toThrow(
        'db failure'
      );
    });
  });

  describe('updateSprintReviewNotes', () => {
    const reviewId = 'review-1';
    const notes = 'Review annotation';
    const userId = 'user-1';
    const updatedAt = new Date('2024-01-16T10:00:00.000Z');

    it('should update notes for an existing sprint review', async () => {
      const existingReview = { id: reviewId, teamId: 'team-1' };
      const updatedReview = { id: reviewId, smNotes: notes };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' } as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue(updatedReview as any);
      freezeDate(updatedAt);

      const result = await smNotesService.updateSprintReviewNotes(reviewId, notes, userId);

      expect(result).toEqual(updatedReview);
      expect(prisma.sprintReview.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
        select: { id: true, teamId: true },
      });
      expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', userId },
        select: { role: true },
      });
      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: { smNotes: notes, updatedBy: userId, updatedAt },
        select: { id: true, smNotes: true },
      });
    });

    it('should refuse notes from a caller with no identity', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: reviewId,
        teamId: 'team-1',
      } as any);

      await expect(
        smNotesService.updateSprintReviewNotes(reviewId, notes, undefined)
      ).rejects.toThrow('Authentication required');
      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('should refuse notes from a non-Scrum-Master', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: reviewId,
        teamId: 'team-1',
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' } as any);

      await expect(
        smNotesService.updateSprintReviewNotes(reviewId, notes, userId)
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY });
      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when sprint review does not exist', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(smNotesService.updateSprintReviewNotes(reviewId, notes, userId)).rejects.toThrow(
        NotFoundError
      );

      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('should propagate errors from update', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: reviewId,
        teamId: 'team-1',
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' } as any);
      vi.mocked(prisma.sprintReview.update).mockRejectedValue(new Error('db failure'));
      freezeDate(updatedAt);

      await expect(smNotesService.updateSprintReviewNotes(reviewId, notes, userId)).rejects.toThrow(
        'db failure'
      );
    });
  });

  describe('updateRetrospectiveNotes', () => {
    const retroId = 'retro-1';
    const notes = 'Retrospective annotation';
    const userId = 'user-1';
    const updatedAt = new Date('2024-01-17T10:00:00.000Z');

    it('should update notes for an existing retrospective', async () => {
      const existingRetro = { id: retroId };
      const updatedRetro = { id: retroId, smNotes: notes };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(existingRetro as any);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue(updatedRetro as any);
      freezeDate(updatedAt);

      const result = await smNotesService.updateRetrospectiveNotes(retroId, notes, userId);

      expect(result).toEqual(updatedRetro);
      expect(prisma.sprintRetrospective.findUnique).toHaveBeenCalledWith({
        where: { id: retroId },
      });
      expect(prisma.sprintRetrospective.update).toHaveBeenCalledWith({
        where: { id: retroId },
        data: { smNotes: notes, updatedBy: userId, updatedAt },
        select: { id: true, smNotes: true },
      });
    });

    it('should update notes when userId is undefined', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({ id: retroId } as any);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue({
        id: retroId,
        smNotes: notes,
      } as any);
      freezeDate(updatedAt);

      const result = await smNotesService.updateRetrospectiveNotes(retroId, notes, undefined);

      expect(result.smNotes).toBe(notes);
      expect(prisma.sprintRetrospective.update).toHaveBeenCalledWith({
        where: { id: retroId },
        data: { smNotes: notes, updatedBy: undefined, updatedAt },
        select: { id: true, smNotes: true },
      });
    });

    it('should throw NotFoundError when retrospective does not exist', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as any);

      await expect(smNotesService.updateRetrospectiveNotes(retroId, notes, userId)).rejects.toThrow(
        NotFoundError
      );

      expect(prisma.sprintRetrospective.update).not.toHaveBeenCalled();
    });

    it('should propagate errors from update', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({ id: retroId } as any);
      vi.mocked(prisma.sprintRetrospective.update).mockRejectedValue(new Error('db failure'));
      freezeDate(updatedAt);

      await expect(smNotesService.updateRetrospectiveNotes(retroId, notes, userId)).rejects.toThrow(
        'db failure'
      );
    });
  });
});
