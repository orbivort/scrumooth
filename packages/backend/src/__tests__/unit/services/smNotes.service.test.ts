import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => {
  const client: any = {
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
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    smNotesRevision: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // The service writes the note and its revision in one transaction; the double runs the callback
  // against the same mocked client so the unit test can still assert both writes.
  client.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)(client)
      : Promise.all(arg as unknown[])
  );

  return { default: client };
});

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('revision-uuid'),
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: { UPDATE: 'UPDATE' },
  AuditEventTypes: { SPRINT: 'SPRINT', RETROSPECTIVE: 'RETROSPECTIVE' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

import { smNotesService } from '../../../services/smNotes.service';
import prisma from '../../../utils/prisma';
import { auditResourceEvent } from '../../../utils/auditLogger';
import { NotFoundError } from '../../../utils/errors';
import { GATE_CODES, SmNotesEntityType } from '@scrumooth/shared';

const callerIsScrumMaster = () =>
  vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ role: 'SCRUM_MASTER' } as any);

const callerIsDeveloper = () =>
  vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ role: 'DEVELOPERS' } as any);

const noMembership = () => vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as any);

const noPreviousRevision = () =>
  vi.mocked(prisma.smNotesRevision.findFirst).mockResolvedValue(null as any);

describe('SM Notes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsScrumMaster();
    noPreviousRevision();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateSprintNotes', () => {
    const sprintId = 'sprint-1';
    const notes = 'Sprint annotation';

    beforeEach(() => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: sprintId,
        teamId: 'team-1',
        smNotes: null,
      } as any);
      vi.mocked(prisma.sprint.update).mockResolvedValue({
        id: sprintId,
        smNotes: notes,
        updatedAt: new Date('2024-01-15T10:00:00.000Z'),
      } as any);
      vi.mocked(prisma.smNotesRevision.create).mockResolvedValue({} as any);
    });

    it('should resolve the owning team from the Sprint itself', async () => {
      await smNotesService.updateSprintNotes(sprintId, notes, 'user-1');

      expect(prisma.sprint.findUnique).toHaveBeenCalledWith({
        where: { id: sprintId },
        select: { id: true, teamId: true, smNotes: true },
      });
      expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: 'team-1', userId: 'user-1' } },
        select: { role: true },
      });
    });

    it('should write the notes and append the first revision in one transaction', async () => {
      const result = await smNotesService.updateSprintNotes(sprintId, notes, 'user-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.sprint.update).toHaveBeenCalledWith({
        where: { id: sprintId },
        data: { smNotes: notes, updatedBy: 'user-1', updatedAt: expect.any(Date) },
        select: { id: true, smNotes: true, updatedAt: true },
      });
      expect(prisma.smNotesRevision.create).toHaveBeenCalledWith({
        data: {
          id: 'revision-uuid',
          entityType: SmNotesEntityType.SPRINT,
          entityId: sprintId,
          teamId: 'team-1',
          revision: 1,
          content: notes,
          createdBy: 'user-1',
        },
      });
      expect(result).toMatchObject({ id: sprintId, smNotes: notes, revision: 1, changed: true });
    });

    it('should append the next dense revision number', async () => {
      vi.mocked(prisma.smNotesRevision.findFirst).mockResolvedValue({ revision: 3 } as any);

      const result = await smNotesService.updateSprintNotes(sprintId, notes, 'user-1');

      expect(prisma.smNotesRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revision: 4 }) })
      );
      expect(result.revision).toBe(4);
    });

    it('should treat unchanged text as a no-op rather than a revision', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: sprintId,
        teamId: 'team-1',
        smNotes: notes,
      } as any);

      const result = await smNotesService.updateSprintNotes(sprintId, notes, 'user-1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.sprint.update).not.toHaveBeenCalled();
      expect(prisma.smNotesRevision.create).not.toHaveBeenCalled();
      expect(auditResourceEvent).not.toHaveBeenCalled();
      expect(result).toMatchObject({ smNotes: notes, changed: false });
    });

    it('should treat an empty note on a never-annotated Sprint as a no-op', async () => {
      const result = await smNotesService.updateSprintNotes(sprintId, '', 'user-1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.changed).toBe(false);
    });

    it('should audit the change without recording the note body', async () => {
      await smNotesService.updateSprintNotes(sprintId, notes, 'user-1');

      expect(auditResourceEvent).toHaveBeenCalledWith(
        'SPRINT',
        'UPDATE',
        'SUCCESS',
        { type: 'SPRINT_SM_NOTES', id: sprintId },
        expect.objectContaining({ teamId: 'team-1', noteLength: notes.length, revision: 1 })
      );
      expect(JSON.stringify(vi.mocked(auditResourceEvent).mock.calls)).not.toContain(notes);
    });

    it('should refuse notes from a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        smNotesService.updateSprintNotes(sprintId, notes, 'user-2')
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY });
      expect(prisma.sprint.update).not.toHaveBeenCalled();
      expect(prisma.smNotesRevision.create).not.toHaveBeenCalled();
    });

    it('should refuse notes from someone outside the team', async () => {
      noMembership();

      await expect(
        smNotesService.updateSprintNotes(sprintId, notes, 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY });
    });

    it('should refuse notes from a caller with no identity', async () => {
      await expect(
        smNotesService.updateSprintNotes(sprintId, notes, undefined)
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY });
      expect(prisma.sprint.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when the Sprint does not exist', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as any);

      await expect(smNotesService.updateSprintNotes(sprintId, notes, 'user-1')).rejects.toThrow(
        NotFoundError
      );
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('should retry once when a concurrent write claims the same revision', async () => {
      vi.mocked(prisma.sprint.update)
        .mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }))
        .mockResolvedValue({
          id: sprintId,
          smNotes: notes,
          updatedAt: new Date('2024-01-15T10:00:00.000Z'),
        } as any);

      const result = await smNotesService.updateSprintNotes(sprintId, notes, 'user-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result.changed).toBe(true);
    });

    it('should propagate a non-conflict transaction failure', async () => {
      vi.mocked(prisma.sprint.update).mockRejectedValue(new Error('db failure'));

      await expect(smNotesService.updateSprintNotes(sprintId, notes, 'user-1')).rejects.toThrow(
        'db failure'
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateSprintReviewNotes', () => {
    const reviewId = 'review-1';
    const notes = 'Review annotation';

    beforeEach(() => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: reviewId,
        teamId: 'team-1',
        smNotes: null,
      } as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({
        id: reviewId,
        smNotes: notes,
        updatedAt: new Date('2024-01-16T10:00:00.000Z'),
      } as any);
      vi.mocked(prisma.smNotesRevision.create).mockResolvedValue({} as any);
    });

    it('should update notes for the team Scrum Master and version them', async () => {
      const result = await smNotesService.updateSprintReviewNotes(reviewId, notes, 'user-1');

      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: { smNotes: notes, updatedBy: 'user-1', updatedAt: expect.any(Date) },
        select: { id: true, smNotes: true, updatedAt: true },
      });
      expect(prisma.smNotesRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: SmNotesEntityType.SPRINT_REVIEW,
            revision: 1,
          }),
        })
      );
      expect(result).toMatchObject({ id: reviewId, smNotes: notes, revision: 1 });
    });

    it('should refuse notes from a non-Scrum-Master', async () => {
      callerIsDeveloper();

      await expect(
        smNotesService.updateSprintReviewNotes(reviewId, notes, 'user-2')
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY });
      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('should refuse notes from a caller with no identity', async () => {
      await expect(
        smNotesService.updateSprintReviewNotes(reviewId, notes, undefined)
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY });
      expect(prisma.sprintReview.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when the Sprint Review does not exist', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(
        smNotesService.updateSprintReviewNotes(reviewId, notes, 'user-1')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateRetrospectiveNotes', () => {
    const retroId = 'retro-1';
    const notes = 'Retrospective annotation';

    beforeEach(() => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: retroId,
        teamId: 'team-1',
        smNotes: null,
      } as any);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue({
        id: retroId,
        smNotes: notes,
        updatedAt: new Date('2024-01-17T10:00:00.000Z'),
      } as any);
      vi.mocked(prisma.smNotesRevision.create).mockResolvedValue({} as any);
    });

    it('should update notes for the team Scrum Master and version them', async () => {
      const result = await smNotesService.updateRetrospectiveNotes(retroId, notes, 'user-1');

      expect(prisma.sprintRetrospective.update).toHaveBeenCalledWith({
        where: { id: retroId },
        data: { smNotes: notes, updatedBy: 'user-1', updatedAt: expect.any(Date) },
        select: { id: true, smNotes: true, updatedAt: true },
      });
      expect(result).toMatchObject({ id: retroId, smNotes: notes, revision: 1 });
    });

    it('should keep auditing the Retrospective event type, without the note body', async () => {
      await smNotesService.updateRetrospectiveNotes(retroId, notes, 'user-1');

      expect(auditResourceEvent).toHaveBeenCalledWith(
        'RETROSPECTIVE',
        'UPDATE',
        'SUCCESS',
        { type: 'SPRINT_RETROSPECTIVE_SM_NOTES', id: retroId },
        expect.objectContaining({ teamId: 'team-1', noteLength: notes.length })
      );
      expect(JSON.stringify(vi.mocked(auditResourceEvent).mock.calls)).not.toContain(notes);
    });

    it('should refuse notes from a caller with no identity', async () => {
      await expect(
        smNotesService.updateRetrospectiveNotes(retroId, notes, undefined)
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY });
    });

    it('should refuse notes from a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        smNotesService.updateRetrospectiveNotes(retroId, notes, 'user-2')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY });
      expect(prisma.sprintRetrospective.update).not.toHaveBeenCalled();
    });

    it('should refuse notes from someone who is not a member of the team at all', async () => {
      noMembership();

      await expect(
        smNotesService.updateRetrospectiveNotes(retroId, notes, 'user-2')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY });
    });

    it('should throw NotFoundError when the Retrospective does not exist', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as any);

      await expect(
        smNotesService.updateRetrospectiveNotes(retroId, notes, 'user-1')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getRevisions', () => {
    beforeEach(() => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        smNotes: null,
      } as any);
      vi.mocked(prisma.smNotesRevision.findMany).mockResolvedValue([
        {
          id: 'rev-2',
          entityType: 'SPRINT',
          entityId: 'sprint-1',
          revision: 2,
          content: 'second',
          createdBy: 'user-1',
          createdAt: new Date('2024-01-16T10:00:00.000Z'),
          author: { firstName: 'Ada', lastName: 'Lovelace' },
        },
        {
          id: 'rev-1',
          entityType: 'SPRINT',
          entityId: 'sprint-1',
          revision: 1,
          content: 'first',
          createdBy: 'user-1',
          createdAt: new Date('2024-01-15T10:00:00.000Z'),
          author: { firstName: 'Ada', lastName: 'Lovelace' },
        },
      ] as any);
      vi.mocked(prisma.smNotesRevision.count).mockResolvedValue(2);
    });

    it('should return the history newest first with the author named', async () => {
      const page = await smNotesService.getRevisions(
        SmNotesEntityType.SPRINT,
        'sprint-1',
        'user-1'
      );

      expect(prisma.smNotesRevision.findMany).toHaveBeenCalledWith({
        where: { entityType: 'SPRINT', entityId: 'sprint-1' },
        orderBy: { revision: 'desc' },
        take: 20,
        skip: 0,
        include: { author: { select: { firstName: true, lastName: true } } },
      });
      expect(page.total).toBe(2);
      expect(page.revisions[0]).toMatchObject({
        revision: 2,
        content: 'second',
        authorName: 'Ada Lovelace',
        createdAt: '2024-01-16T10:00:00.000Z',
      });
    });

    it('should clamp paging bounds so a caller cannot ask for an unbounded history', async () => {
      await smNotesService.getRevisions(SmNotesEntityType.SPRINT, 'sprint-1', 'user-1', {
        limit: 5_000,
        offset: -10,
      });

      expect(prisma.smNotesRevision.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100, skip: 0 })
      );
    });

    it('should refuse the history to anyone but the team Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        smNotesService.getRevisions(SmNotesEntityType.SPRINT, 'sprint-1', 'user-2')
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY });
      expect(prisma.smNotesRevision.findMany).not.toHaveBeenCalled();
    });

    it('should refuse the history to a caller with no identity', async () => {
      await expect(
        smNotesService.getRevisions(SmNotesEntityType.SPRINT, 'sprint-1', undefined)
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY });
    });

    it('should throw NotFoundError for an event that does not exist', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as any);

      await expect(
        smNotesService.getRevisions(SmNotesEntityType.SPRINT, 'missing', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
