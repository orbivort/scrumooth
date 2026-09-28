import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    coachingEntry: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    sprint: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('entry-uuid'),
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  AuditEventTypes: { TEAM: 'TEAM' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

import { coachingEntryService } from '../../../services/coachingEntry.service';
import prisma from '../../../utils/prisma';
import { auditResourceEvent } from '../../../utils/auditLogger';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const callerIsScrumMaster = () =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' });
const callerIsDeveloper = () =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' });
const callerIsNotAMember = () => asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

const entry = {
  id: 'entry-1',
  teamId: 'team-1',
  topic: 'SELF_MANAGEMENT',
  note: 'The team decides who takes which item next Sprint.',
  sprintId: 'sprint-1',
  followUpDate: new Date('2026-10-01T00:00:00.000Z'),
  authorId: 'sm-1',
  createdAt: new Date('2026-09-20T09:00:00.000Z'),
  updatedAt: new Date('2026-09-20T09:00:00.000Z'),
  sprint: { id: 'sprint-1', name: 'Sprint 42' },
  author: { id: 'sm-1', firstName: 'Grace', lastName: 'Hopper' },
};

describe('CoachingEntryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsScrumMaster();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCoachingEntries', () => {
    it('should refuse the log to a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        coachingEntryService.getCoachingEntries('team-1', 'user-1')
      ).rejects.toMatchObject({ code: GATE_CODES.COACHING_SM_ONLY });
      expect(prisma.coachingEntry.findMany).not.toHaveBeenCalled();
    });

    it('should refuse the log to someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        coachingEntryService.getCoachingEntries('team-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.COACHING_SM_ONLY });
    });

    it('should return the newest entries with their Sprint and follow-up date', async () => {
      asMock(prisma.coachingEntry.findMany).mockResolvedValue([entry]);
      asMock(prisma.coachingEntry.count).mockResolvedValue(1);

      const page = await coachingEntryService.getCoachingEntries('team-1', 'sm-1');

      expect(prisma.coachingEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1' },
          orderBy: { createdAt: 'desc' },
          take: 50,
          skip: 0,
        })
      );
      expect(page.total).toBe(1);
      expect(page.entries[0]).toMatchObject({
        topic: 'SELF_MANAGEMENT',
        sprintName: 'Sprint 42',
        authorName: 'Grace Hopper',
        followUpDate: '2026-10-01T00:00:00.000Z',
      });
    });

    it('should clamp paging bounds', async () => {
      asMock(prisma.coachingEntry.findMany).mockResolvedValue([]);
      asMock(prisma.coachingEntry.count).mockResolvedValue(0);

      await coachingEntryService.getCoachingEntries('team-1', 'sm-1', {
        limit: 10_000,
        offset: -5,
      });

      expect(prisma.coachingEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200, skip: 0 })
      );
    });

    it('should serialize an entry with no Sprint, author or follow-up date', async () => {
      asMock(prisma.coachingEntry.findMany).mockResolvedValue([
        {
          id: 'entry-2',
          teamId: 'team-1',
          topic: 'OTHER',
          note: 'note',
          sprintId: null,
          followUpDate: null,
          authorId: 'sm-1',
          createdAt: new Date('2026-09-20T09:00:00.000Z'),
          updatedAt: new Date('2026-09-20T09:00:00.000Z'),
          sprint: null,
          author: null,
        },
      ]);
      asMock(prisma.coachingEntry.count).mockResolvedValue(1);

      const page = await coachingEntryService.getCoachingEntries('team-1', 'sm-1');

      expect(page.entries[0]).toMatchObject({
        sprintName: null,
        authorName: null,
        followUpDate: null,
      });
    });
  });

  describe('createCoachingEntry', () => {
    it('should refuse a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        coachingEntryService.createCoachingEntry('user-1', {
          teamId: 'team-1',
          topic: 'OTHER',
          note: 'Coaching note',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.COACHING_SM_ONLY });
      expect(prisma.coachingEntry.create).not.toHaveBeenCalled();
    });

    it('should record an entry for the Scrum Master', async () => {
      asMock(prisma.sprint.findFirst).mockResolvedValue({ id: 'sprint-1' });
      asMock(prisma.coachingEntry.create).mockResolvedValue(entry);

      const result = await coachingEntryService.createCoachingEntry('sm-1', {
        teamId: 'team-1',
        topic: 'SELF_MANAGEMENT',
        note: entry.note,
        sprintId: 'sprint-1',
        followUpDate: '2026-10-01',
      });

      expect(prisma.sprint.findFirst).toHaveBeenCalledWith({
        where: { id: 'sprint-1', teamId: 'team-1' },
        select: { id: true },
      });
      expect(prisma.coachingEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'entry-uuid',
            teamId: 'team-1',
            topic: 'SELF_MANAGEMENT',
            authorId: 'sm-1',
            followUpDate: new Date('2026-10-01T00:00:00.000Z'),
          }),
        })
      );
      expect(result.id).toBe('entry-1');
    });

    it('should refuse a Sprint that belongs to another team', async () => {
      asMock(prisma.sprint.findFirst).mockResolvedValue(null);

      await expect(
        coachingEntryService.createCoachingEntry('sm-1', {
          teamId: 'team-1',
          topic: 'OTHER',
          note: 'Coaching note',
          sprintId: 'sprint-of-another-team',
        })
      ).rejects.toThrow(BadRequestError);
      expect(prisma.coachingEntry.create).not.toHaveBeenCalled();
    });

    it('should audit the entry without recording the note body', async () => {
      asMock(prisma.coachingEntry.create).mockResolvedValue(entry);

      await coachingEntryService.createCoachingEntry('sm-1', {
        teamId: 'team-1',
        topic: 'SELF_MANAGEMENT',
        note: entry.note,
      });

      expect(auditResourceEvent).toHaveBeenCalledWith(
        'TEAM',
        'CREATE',
        'SUCCESS',
        expect.objectContaining({ type: 'COACHING_ENTRY' }),
        expect.objectContaining({ teamId: 'team-1', noteLength: entry.note.length })
      );
      expect(JSON.stringify(asMock(auditResourceEvent).mock.calls)).not.toContain(entry.note);
    });

    it('should accept a follow-up date given as a Date', async () => {
      asMock(prisma.coachingEntry.create).mockResolvedValue(entry);

      await coachingEntryService.createCoachingEntry('sm-1', {
        teamId: 'team-1',
        topic: 'OTHER',
        note: 'note',
        followUpDate: new Date('2026-10-01T00:00:00.000Z'),
      });

      expect(prisma.coachingEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            followUpDate: new Date('2026-10-01T00:00:00.000Z'),
          }),
        })
      );
    });

    it('should refuse a follow-up date that is not a real date', async () => {
      await expect(
        coachingEntryService.createCoachingEntry('sm-1', {
          teamId: 'team-1',
          topic: 'OTHER',
          note: 'note',
          followUpDate: 'not-a-date',
        })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.coachingEntry.create).not.toHaveBeenCalled();
    });
  });

  describe('updateCoachingEntry', () => {
    beforeEach(() => {
      asMock(prisma.coachingEntry.findUnique).mockResolvedValue({
        id: 'entry-1',
        teamId: 'team-1',
      });
    });

    it('should throw NotFoundError when the entry does not exist', async () => {
      asMock(prisma.coachingEntry.findUnique).mockResolvedValue(null);

      await expect(
        coachingEntryService.updateCoachingEntry('missing', 'sm-1', { note: 'x' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        coachingEntryService.updateCoachingEntry('entry-1', 'user-1', { note: 'x' })
      ).rejects.toMatchObject({ code: GATE_CODES.COACHING_SM_ONLY });
      expect(prisma.coachingEntry.update).not.toHaveBeenCalled();
    });

    it('should amend the entry', async () => {
      asMock(prisma.coachingEntry.update).mockResolvedValue({
        ...entry,
        topic: 'CROSS_FUNCTIONALITY',
      });

      const result = await coachingEntryService.updateCoachingEntry('entry-1', 'sm-1', {
        topic: 'CROSS_FUNCTIONALITY',
      });

      expect(prisma.coachingEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'entry-1' },
          data: expect.objectContaining({ topic: 'CROSS_FUNCTIONALITY' }),
        })
      );
      expect(result.topic).toBe('CROSS_FUNCTIONALITY');
    });

    it('should accept a Sprint that belongs to the team when amending', async () => {
      asMock(prisma.sprint.findFirst).mockResolvedValue({ id: 'sprint-1' });
      asMock(prisma.coachingEntry.update).mockResolvedValue({ ...entry, sprintId: 'sprint-1' });

      await coachingEntryService.updateCoachingEntry('entry-1', 'sm-1', { sprintId: 'sprint-1' });

      expect(prisma.sprint.findFirst).toHaveBeenCalledWith({
        where: { id: 'sprint-1', teamId: 'team-1' },
        select: { id: true },
      });
    });

    it('should refuse a Sprint that belongs to another team when amending', async () => {
      asMock(prisma.sprint.findFirst).mockResolvedValue(null);

      await expect(
        coachingEntryService.updateCoachingEntry('entry-1', 'sm-1', { sprintId: 'foreign-sprint' })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.coachingEntry.update).not.toHaveBeenCalled();
    });

    it('should amend the note, Sprint and follow-up date without changing the topic', async () => {
      asMock(prisma.sprint.findFirst).mockResolvedValue({ id: 'sprint-1' });
      asMock(prisma.coachingEntry.update).mockResolvedValue({ ...entry, note: 'New note' });

      await coachingEntryService.updateCoachingEntry('entry-1', 'sm-1', {
        note: 'New note',
        sprintId: 'sprint-1',
        followUpDate: '2026-11-01T00:00:00.000Z',
      });

      expect(prisma.coachingEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            note: 'New note',
            sprintId: 'sprint-1',
            followUpDate: new Date('2026-11-01T00:00:00.000Z'),
          }),
        })
      );
    });
  });

  describe('deleteCoachingEntry', () => {
    it('should throw NotFoundError when the entry does not exist', async () => {
      asMock(prisma.coachingEntry.findUnique).mockResolvedValue(null);

      await expect(coachingEntryService.deleteCoachingEntry('missing', 'sm-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should delete the entry for the Scrum Master', async () => {
      asMock(prisma.coachingEntry.findUnique).mockResolvedValue({
        id: 'entry-1',
        teamId: 'team-1',
      });
      asMock(prisma.coachingEntry.delete).mockResolvedValue(entry);

      const result = await coachingEntryService.deleteCoachingEntry('entry-1', 'sm-1');

      expect(result).toEqual({ id: 'entry-1' });
    });
  });
});
