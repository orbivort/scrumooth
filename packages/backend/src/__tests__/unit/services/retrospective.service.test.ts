import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    sprintRetrospective: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    retrospectiveItem: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    retroItemVote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    retroActionItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    retroAttendee: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
    },
    sprintReview: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid'),
}));

// Now import the service and other dependencies
import { retrospectiveService } from '../../../services/retrospective.service';
import prisma from '../../../utils/prisma';
import { NotFoundError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

describe('RetrospectiveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRetrospectivesByTeam', () => {
    it('should return all retrospectives for a team', async () => {
      const teamId = 'team-1';
      const mockRetrospectives = [
        {
          id: 'retro-1',
          teamId,
          sprintId: 'sprint-1',
          retroDate: new Date('2024-01-15'),
          status: 'COMPLETED',
          items: [],
          actionItems: [],
        },
        {
          id: 'retro-2',
          teamId,
          sprintId: 'sprint-2',
          retroDate: new Date('2024-01-29'),
          status: 'IN_PROGRESS',
          items: [],
          actionItems: [],
        },
      ];

      vi.mocked(prisma.sprintRetrospective.findMany).mockResolvedValue(mockRetrospectives as any);

      const result = await retrospectiveService.getRetrospectivesByTeam(teamId);

      expect(result).toHaveLength(2);
      expect(prisma.sprintRetrospective.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId },
          orderBy: { retroDate: 'desc' },
        })
      );
    });
  });

  describe('getRetrospectiveById', () => {
    it('should return retrospective by ID', async () => {
      const retroId = 'retro-1';
      const mockRetrospective = {
        id: retroId,
        teamId: 'team-1',
        sprintId: 'sprint-1',
        retroDate: new Date(),
        status: 'COMPLETED',
        items: [],
        actionItems: [],
        attendees: [],
        sprint: {
          team: {
            members: [],
          },
        },
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);

      const result = await retrospectiveService.getRetrospectiveById(retroId);

      expect(result.id).toBe(retroId);
    });

    it('should throw NotFoundError for non-existent retrospective', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as any);

      await expect(retrospectiveService.getRetrospectiveById('non-existent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getRetrospectiveBySprintId', () => {
    it('should return retrospective by sprint ID', async () => {
      const sprintId = 'sprint-1';
      const mockRetrospective = {
        id: 'retro-1',
        teamId: 'team-1',
        sprintId,
        retroDate: new Date(),
        status: 'COMPLETED',
        items: [],
        actionItems: [],
        attendees: [],
        sprint: {
          team: {
            members: [],
          },
        },
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);

      const result = await retrospectiveService.getRetrospectiveBySprintId(sprintId);

      expect(result).not.toBeNull();
      expect(result!.sprintId).toBe(sprintId);
    });

    it('should return null when no retrospective exists for sprint', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as any);

      const result = await retrospectiveService.getRetrospectiveBySprintId('sprint-1');

      expect(result).toBeNull();
    });
  });

  describe('createRetrospective', () => {
    it('should create retrospective successfully', async () => {
      const mockRetrospective = {
        id: 'test-uuid',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        retroDate: new Date(),
        facilitatorId: 'user-1',
        status: 'DRAFT',
        isAnonymous: false,
        items: [],
        actionItems: [],
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.sprintRetrospective.create).mockResolvedValue(mockRetrospective as any);

      const result = await retrospectiveService.createRetrospective({
        sprintId: 'sprint-1',
        teamId: 'team-1',
        facilitatorId: 'user-1',
      });

      expect(result.sprintId).toBe('sprint-1');
      expect(result.status).toBe('DRAFT');
    });

    it('should throw error if retrospective already exists for sprint', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(
        retrospectiveService.createRetrospective({
          sprintId: 'sprint-1',
          teamId: 'team-1',
          facilitatorId: 'user-1',
        })
      ).rejects.toThrow('A retrospective already exists for sprint');
    });
  });

  describe('addItem', () => {
    it('should add item to retrospective', async () => {
      const mockRetrospective = { id: 'retro-1' };
      const mockItem = {
        id: 'test-uuid',
        retrospectiveId: 'retro-1',
        category: 'WENT_WELL',
        content: 'Great teamwork!',
        authorId: 'user-1',
        votes: 0,
        order: 1,
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.retrospectiveItem.findFirst).mockResolvedValue(null as any);
      vi.mocked(prisma.retrospectiveItem.create).mockResolvedValue(mockItem as any);

      const result = await retrospectiveService.addItem('retro-1', {
        category: 'WENT_WELL',
        content: 'Great teamwork!',
        authorId: 'user-1',
      });

      expect(result.content).toBe('Great teamwork!');
      expect(result.category).toBe('WENT_WELL');
    });

    it('should throw NotFoundError for non-existent retrospective', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as any);

      await expect(
        retrospectiveService.addItem('non-existent', {
          category: 'WENT_WELL',
          content: 'Test',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('voteItem', () => {
    it('should add vote to item', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
        votes: 1,
      };

      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.retroItemVote.create).mockResolvedValue({} as any);
      vi.mocked(prisma.retrospectiveItem.update).mockResolvedValue({
        ...mockItem,
        votes: 1,
      } as any);

      const result = await retrospectiveService.voteItem('retro-1', 'item-1', 'user-1');

      expect(result.votes).toBe(1);
    });

    it('should throw error if user already voted', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
      };

      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue({ id: 'vote-1' } as any);

      await expect(retrospectiveService.voteItem('retro-1', 'item-1', 'user-1')).rejects.toThrow(
        'User has already voted for this item'
      );
    });
  });

  describe('unvoteItem', () => {
    it('should remove vote from item', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
        votes: 0,
      };

      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue({ id: 'vote-1' } as any);
      vi.mocked(prisma.retroItemVote.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.retrospectiveItem.update).mockResolvedValue(mockItem as any);

      const result = await retrospectiveService.unvoteItem('retro-1', 'item-1', 'user-1');

      expect(result.votes).toBe(0);
    });

    it('should throw NotFoundError if user has not voted', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
      };

      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue(null as any);

      await expect(retrospectiveService.unvoteItem('retro-1', 'item-1', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('updateItem', () => {
    it('should update item content', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
        content: 'Updated content',
      };

      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.retrospectiveItem.update).mockResolvedValue(mockItem as any);

      const result = await retrospectiveService.updateItem('retro-1', 'item-1', {
        content: 'Updated content',
      });

      expect(result.content).toBe('Updated content');
    });
  });

  describe('deleteItem', () => {
    it('should delete item', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
      };

      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as any);
      vi.mocked(prisma.retrospectiveItem.delete).mockResolvedValue(mockItem as any);

      await expect(retrospectiveService.deleteItem('retro-1', 'item-1')).resolves.not.toThrow();
    });
  });

  describe('addActionItem', () => {
    it('should add action item to retrospective', async () => {
      const mockRetrospective = { id: 'retro-1' };
      const mockActionItem = {
        id: 'test-uuid',
        retrospectiveId: 'retro-1',
        title: 'Improve CI/CD',
        description: 'Set up automated testing',
        ownerId: 'user-1',
        status: 'PENDING',
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.retroActionItem.create).mockResolvedValue(mockActionItem as any);

      const result = await retrospectiveService.addActionItem('retro-1', {
        title: 'Improve CI/CD',
        description: 'Set up automated testing',
        ownerId: 'user-1',
      });

      expect(result.title).toBe('Improve CI/CD');
      expect(result.status).toBe('PENDING');
    });
  });

  describe('updateActionItem', () => {
    it('should update action item', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
        title: 'Updated Title',
        status: 'IN_PROGRESS',
      };

      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as any);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(mockActionItem as any);

      const result = await retrospectiveService.updateActionItem('retro-1', 'action-1', {
        title: 'Updated Title',
        status: 'IN_PROGRESS',
      });

      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should set completedAt when status changes to COMPLETED', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
        status: 'COMPLETED',
        completedAt: new Date(),
      };

      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as any);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(mockActionItem as any);

      const result = await retrospectiveService.updateActionItem('retro-1', 'action-1', {
        status: 'COMPLETED',
      });

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('deleteActionItem', () => {
    it('should delete action item', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
      };

      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as any);
      vi.mocked(prisma.retroActionItem.delete).mockResolvedValue(mockActionItem as any);

      await expect(
        retrospectiveService.deleteActionItem('retro-1', 'action-1')
      ).resolves.not.toThrow();
    });
  });

  describe('updateRetrospective', () => {
    it('should update retrospective summary and status', async () => {
      const mockRetrospective = {
        id: 'retro-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        summary: 'Sprint summary',
        status: 'COMPLETED',
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue(mockRetrospective as any);

      const result = await retrospectiveService.updateRetrospective('retro-1', {
        summary: 'Sprint summary',
        status: 'COMPLETED',
      });

      expect(result.summary).toBe('Sprint summary');
      expect(result.status).toBe('COMPLETED');
    });

    it('should refuse completion before the sprint has ended', async () => {
      const mockRetrospective = {
        id: 'retro-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        status: 'IN_PROGRESS',
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() + 86_400_000),
      } as any);

      await expect(
        retrospectiveService.updateRetrospective('retro-1', { status: 'COMPLETED' })
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE });
      expect(prisma.sprintRetrospective.update).not.toHaveBeenCalled();
    });

    it('should refuse completion before the sprint review is completed', async () => {
      const mockRetrospective = {
        id: 'retro-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        status: 'IN_PROGRESS',
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() - 86_400_000),
      } as any);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        status: 'in_progress',
      } as any);

      await expect(
        retrospectiveService.updateRetrospective('retro-1', { status: 'COMPLETED' })
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW });
      expect(prisma.sprintRetrospective.update).not.toHaveBeenCalled();
    });

    it('should complete once the review is completed and the sprint has ended', async () => {
      const mockRetrospective = {
        id: 'retro-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        status: 'IN_PROGRESS',
        items: [],
        actionItems: [],
        attendees: [],
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() - 86_400_000),
      } as any);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        status: 'completed',
      } as any);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue({
        ...mockRetrospective,
        status: 'COMPLETED',
      } as any);

      const result = await retrospectiveService.updateRetrospective('retro-1', {
        status: 'COMPLETED',
      });

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('getPendingActionItemsByTeam', () => {
    it('should return pending action items for team', async () => {
      const teamId = 'team-1';
      const mockRetrospectives = [
        {
          id: 'retro-1',
          actionItems: [
            {
              id: 'action-1',
              title: 'Action 1',
              status: 'PENDING',
              addedToSprintBacklog: false,
              owner: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
            },
          ],
          sprint: { id: 'sprint-1', name: 'Sprint 1' },
        },
      ];

      vi.mocked(prisma.sprintRetrospective.findMany).mockResolvedValue(mockRetrospectives as any);

      const result = await retrospectiveService.getPendingActionItemsByTeam(teamId);

      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe('Action 1');
    });
  });

  describe('addAttendee', () => {
    it('should add attendee to retrospective', async () => {
      const mockRetrospective = { id: 'retro-1' };
      const mockAttendee = {
        id: 'test-uuid',
        retrospectiveId: 'retro-1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'DEVELOPERS',
        attended: true,
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(mockRetrospective as any);
      vi.mocked(prisma.retroAttendee.create).mockResolvedValue(mockAttendee as any);

      const result = await retrospectiveService.addAttendee('retro-1', {
        name: 'John Doe',
        email: 'john@test.com',
        role: 'DEVELOPERS',
        attended: true,
      });

      expect(result.name).toBe('John Doe');
      expect(result.attended).toBe(true);
    });
  });

  describe('updateAttendee', () => {
    it('should update attendee', async () => {
      const mockAttendee = {
        id: 'attendee-1',
        name: 'Jane Doe',
        email: 'jane@test.com',
        role: 'SCRUM_MASTER',
        attended: false,
      };

      vi.mocked(prisma.retroAttendee.findUnique).mockResolvedValue(mockAttendee as any);
      vi.mocked(prisma.retroAttendee.update).mockResolvedValue(mockAttendee as any);

      const result = await retrospectiveService.updateAttendee('attendee-1', {
        name: 'Jane Doe',
        attended: false,
      });

      expect(result.name).toBe('Jane Doe');
      expect(result.attended).toBe(false);
    });
  });

  describe('deleteAttendee', () => {
    it('should delete attendee', async () => {
      const mockAttendee = { id: 'attendee-1' };

      vi.mocked(prisma.retroAttendee.findUnique).mockResolvedValue(mockAttendee as any);
      vi.mocked(prisma.retroAttendee.delete).mockResolvedValue(mockAttendee as any);

      await expect(retrospectiveService.deleteAttendee('attendee-1')).resolves.not.toThrow();
    });
  });
});
