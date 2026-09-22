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
      findFirst: vi.fn(),
    },
    sprintReview: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    productBacklogItem: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// The Definition of Done and Product Backlog services are collaborators, not the unit under test:
// their own suites cover version bumps and item creation, so they are stubbed here to keep this
// suite focused on the Retrospective's decisions.
vi.mock('../../../services/dod.service', () => ({
  definitionOfDoneService: {
    getDefinitionOfDone: vi.fn(),
    updateDefinitionOfDone: vi.fn(),
  },
}));

vi.mock('../../../services/backlog.service', () => ({
  productBacklogService: {
    createPBI: vi.fn(),
  },
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: { CREATE: 'CREATE', UPDATE: 'UPDATE', ASSIGN: 'ASSIGN' },
  AuditEventTypes: { RETROSPECTIVE: 'RETROSPECTIVE' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid'),
}));

// Now import the service and other dependencies
import { retrospectiveService } from '../../../services/retrospective.service';
import { definitionOfDoneService } from '../../../services/dod.service';
import { productBacklogService } from '../../../services/backlog.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, ForbiddenError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const USER_ID = 'user-1';
const TEAM_ID = 'team-1';

/** Grant the caller membership of the team that owns the resource under test. */
const grantMembership = (role = 'DEVELOPERS') => {
  vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ role } as never);
};

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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findMany).mockResolvedValue(mockRetrospectives as never);

      const result = await retrospectiveService.getRetrospectivesByTeam(teamId, USER_ID);

      expect(result).toHaveLength(2);
      expect(prisma.sprintRetrospective.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId },
          orderBy: { retroDate: 'desc' },
        })
      );
    });

    it('should refuse a caller who is not a member of the team', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.getRetrospectivesByTeam(TEAM_ID, USER_ID)
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.sprintRetrospective.findMany).not.toHaveBeenCalled();
    });

    it('should refuse a caller with no session, rather than treating them as exempt', async () => {
      await expect(
        retrospectiveService.getRetrospectivesByTeam(TEAM_ID, undefined)
      ).rejects.toBeInstanceOf(ForbiddenError);
      expect(prisma.sprintRetrospective.findMany).not.toHaveBeenCalled();
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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );

      const result = await retrospectiveService.getRetrospectiveById(retroId, USER_ID);

      expect(result.id).toBe(retroId);
    });

    it('should throw NotFoundError for non-existent retrospective', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.getRetrospectiveById('non-existent', USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a caller from another team', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: 'retro-1',
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.getRetrospectiveById('retro-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
    });

    it('should withhold the Scrum Master notes from everyone but the Scrum Master', async () => {
      const row = {
        id: 'retro-1',
        teamId: TEAM_ID,
        sprintId: 'sprint-1',
        retroDate: new Date(),
        status: 'COMPLETED',
        smNotes: 'Coaching observation about the facilitator',
        items: [],
        actionItems: [],
        attendees: [],
      };

      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(row as never);

      grantMembership('DEVELOPERS');
      const asDeveloper = await retrospectiveService.getRetrospectiveById('retro-1', USER_ID);
      expect(asDeveloper.smNotes).toBeUndefined();

      grantMembership('SCRUM_MASTER');
      const asScrumMaster = await retrospectiveService.getRetrospectiveById('retro-1', USER_ID);
      expect(asScrumMaster.smNotes).toBe('Coaching observation about the facilitator');
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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );

      const result = await retrospectiveService.getRetrospectiveBySprintId(sprintId, USER_ID);

      expect(result).not.toBeNull();
      expect(result!.sprintId).toBe(sprintId);
    });

    it('should return null when no retrospective exists for sprint', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as never);

      const result = await retrospectiveService.getRetrospectiveBySprintId('sprint-1', USER_ID);

      expect(result).toBeNull();
    });

    it('should refuse a caller from another team', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: 'retro-1',
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.getRetrospectiveBySprintId('sprint-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
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

      grantMembership('SCRUM_MASTER');
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ teamId: TEAM_ID } as never);
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.sprintRetrospective.create).mockResolvedValue(mockRetrospective as never);

      const result = await retrospectiveService.createRetrospective(
        {
          sprintId: 'sprint-1',
          teamId: 'team-1',
          facilitatorId: 'user-1',
        },
        USER_ID
      );

      expect(result.sprintId).toBe('sprint-1');
      expect(result.status).toBe('DRAFT');
    });

    it('should throw error if retrospective already exists for sprint', async () => {
      grantMembership('SCRUM_MASTER');
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ teamId: TEAM_ID } as never);
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: 'existing',
      } as never);

      await expect(
        retrospectiveService.createRetrospective(
          {
            sprintId: 'sprint-1',
            teamId: 'team-1',
            facilitatorId: 'user-1',
          },
          USER_ID
        )
      ).rejects.toThrow('A retrospective already exists for sprint');
    });

    it('should refuse a Sprint that belongs to another team', async () => {
      grantMembership('SCRUM_MASTER');
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ teamId: 'other-team' } as never);

      await expect(
        retrospectiveService.createRetrospective(
          { sprintId: 'sprint-1', teamId: TEAM_ID, facilitatorId: USER_ID },
          USER_ID
        )
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.sprintRetrospective.create).not.toHaveBeenCalled();
    });

    it('should refuse a caller who is not a member of the team', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.createRetrospective(
          { sprintId: 'sprint-1', teamId: TEAM_ID, facilitatorId: USER_ID },
          'outsider'
        )
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.sprintRetrospective.create).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('should add item to retrospective and attribute it to the session user', async () => {
      const mockRetrospective = { id: 'retro-1', teamId: TEAM_ID, isAnonymous: false };
      const mockItem = {
        id: 'test-uuid',
        retrospectiveId: 'retro-1',
        category: 'WENT_WELL',
        content: 'Great teamwork!',
        authorId: USER_ID,
        votes: 0,
        order: 1,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        firstName: 'Jo',
        lastName: 'Doe',
      } as never);
      vi.mocked(prisma.retrospectiveItem.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.retrospectiveItem.create).mockResolvedValue(mockItem as never);

      const result = await retrospectiveService.addItem(
        'retro-1',
        {
          category: 'WENT_WELL',
          content: 'Great teamwork!',
          // A client-supplied author must be ignored, not stored.
          authorId: 'someone-else',
          authorName: 'Someone Else',
        },
        USER_ID
      );

      expect(result.content).toBe('Great teamwork!');
      expect(result.category).toBe('WENT_WELL');
      expect(prisma.retrospectiveItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authorId: USER_ID, authorName: 'Jo Doe' }),
        })
      );
    });

    it('should record no author at all in an anonymous retrospective', async () => {
      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: 'retro-1',
        teamId: TEAM_ID,
        isAnonymous: true,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.retrospectiveItem.create).mockResolvedValue({} as never);

      await retrospectiveService.addItem(
        'retro-1',
        { category: 'WENT_WELL', content: 'Anonymous contribution' },
        USER_ID
      );

      expect(prisma.retrospectiveItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authorId: null, authorName: null }),
        })
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent retrospective', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.addItem(
          'non-existent',
          {
            category: 'WENT_WELL',
            content: 'Test',
          },
          USER_ID
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a caller from another team', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: 'retro-1',
        teamId: TEAM_ID,
        isAnonymous: false,
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.addItem(
          'retro-1',
          { category: 'WENT_WELL', content: 'Outsider' },
          'outsider'
        )
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.retrospectiveItem.create).not.toHaveBeenCalled();
    });
  });

  describe('voteItem', () => {
    it('should add vote to item', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
        votes: 1,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.retroItemVote.create).mockResolvedValue({} as never);
      vi.mocked(prisma.retrospectiveItem.update).mockResolvedValue({
        ...mockItem,
        votes: 1,
      } as never);

      const result = await retrospectiveService.voteItem('retro-1', 'item-1', 'user-1');

      expect(result.votes).toBe(1);
    });

    it('should throw error if user already voted', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue({ id: 'vote-1' } as never);

      await expect(retrospectiveService.voteItem('retro-1', 'item-1', 'user-1')).rejects.toThrow(
        'User has already voted for this item'
      );
    });

    it('should refuse a caller from another team', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.voteItem('retro-1', 'item-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.retroItemVote.create).not.toHaveBeenCalled();
    });
  });

  describe('unvoteItem', () => {
    it('should remove vote from item', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
        votes: 0,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue({ id: 'vote-1' } as never);
      vi.mocked(prisma.retroItemVote.delete).mockResolvedValue({} as never);
      vi.mocked(prisma.retrospectiveItem.update).mockResolvedValue(mockItem as never);

      const result = await retrospectiveService.unvoteItem('retro-1', 'item-1', 'user-1');

      expect(result.votes).toBe(0);
    });

    it('should throw NotFoundError if user has not voted', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.retroItemVote.findUnique).mockResolvedValue(null as never);

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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.retrospectiveItem.update).mockResolvedValue(mockItem as never);

      const result = await retrospectiveService.updateItem(
        'retro-1',
        'item-1',
        {
          content: 'Updated content',
        },
        USER_ID
      );

      expect(result.content).toBe('Updated content');
    });
  });

  describe('deleteItem', () => {
    it('should delete item', async () => {
      const mockItem = {
        id: 'item-1',
        retrospectiveId: 'retro-1',
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retrospectiveItem.findUnique).mockResolvedValue(mockItem as never);
      vi.mocked(prisma.retrospectiveItem.delete).mockResolvedValue(mockItem as never);

      await expect(
        retrospectiveService.deleteItem('retro-1', 'item-1', USER_ID)
      ).resolves.not.toThrow();
    });
  });

  describe('addActionItem', () => {
    it('should add action item to retrospective', async () => {
      const mockActionItem = {
        id: 'test-uuid',
        retrospectiveId: 'retro-1',
        title: 'Improve CI/CD',
        description: 'Set up automated testing',
        ownerId: 'user-1',
        status: 'PENDING',
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroActionItem.create).mockResolvedValue(mockActionItem as never);

      const result = await retrospectiveService.addActionItem(
        'retro-1',
        {
          title: 'Improve CI/CD',
          description: 'Set up automated testing',
          ownerId: 'user-1',
        },
        USER_ID
      );

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
        productBacklogItemId: null,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as never);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(mockActionItem as never);

      const result = await retrospectiveService.updateActionItem(
        'retro-1',
        'action-1',
        {
          title: 'Updated Title',
          status: 'IN_PROGRESS',
        },
        USER_ID
      );

      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should set completedAt when status changes to COMPLETED', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
        status: 'COMPLETED',
        completedAt: new Date(),
        productBacklogItemId: null,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as never);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(mockActionItem as never);

      const result = await retrospectiveService.updateActionItem(
        'retro-1',
        'action-1',
        {
          status: 'COMPLETED',
        },
        USER_ID
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('should never let a client move the linked Sprint', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
        title: 'Improve CI/CD',
        productBacklogItemId: null,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as never);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(mockActionItem as never);

      await retrospectiveService.updateActionItem(
        'retro-1',
        'action-1',
        { relatedSprintId: 'sprint-999' },
        USER_ID
      );

      expect(prisma.retroActionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ relatedSprintId: expect.anything() }),
        })
      );
    });

    it('should refuse to un-mark an improvement that is carried by a linked item', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
        productBacklogItemId: 'pbi-1',
        productBacklogItem: { id: 'pbi-1', title: 'Improve CI/CD' },
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as never);

      await expect(
        retrospectiveService.updateActionItem(
          'retro-1',
          'action-1',
          { addedToSprintBacklog: false },
          USER_ID
        )
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED });
      expect(prisma.retroActionItem.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteActionItem', () => {
    it('should delete action item', async () => {
      const mockActionItem = {
        id: 'action-1',
        retrospectiveId: 'retro-1',
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(mockActionItem as never);
      vi.mocked(prisma.retroActionItem.delete).mockResolvedValue(mockActionItem as never);

      await expect(
        retrospectiveService.deleteActionItem('retro-1', 'action-1', USER_ID)
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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue(mockRetrospective as never);

      const result = await retrospectiveService.updateRetrospective(
        'retro-1',
        {
          summary: 'Sprint summary',
          status: 'COMPLETED',
        },
        USER_ID
      );

      expect(result.summary).toBe('Sprint summary');
      expect(result.status).toBe('COMPLETED');
    });

    it('should persist the Definition of Done reflection', async () => {
      const mockRetrospective = {
        id: 'retro-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        status: 'IN_PROGRESS',
        items: [],
        actionItems: [],
        attendees: [],
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue({
        ...mockRetrospective,
        dodReflections: [{ dodItemId: 'dod-item-1', description: 'Reviewed', decision: 'KEEP' }],
      } as never);

      await retrospectiveService.updateRetrospective(
        'retro-1',
        {
          dodReflections: [{ dodItemId: 'dod-item-1', description: 'Reviewed', decision: 'KEEP' }],
        },
        USER_ID
      );

      expect(prisma.sprintRetrospective.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dodReflections: [
              { dodItemId: 'dod-item-1', description: 'Reviewed', decision: 'KEEP' },
            ],
          }),
        })
      );
    });

    it('should refuse completion before the sprint has ended', async () => {
      const mockRetrospective = {
        id: 'retro-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        status: 'IN_PROGRESS',
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() + 86_400_000),
      } as never);

      await expect(
        retrospectiveService.updateRetrospective('retro-1', { status: 'COMPLETED' }, USER_ID)
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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() - 86_400_000),
      } as never);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        status: 'in_progress',
      } as never);

      await expect(
        retrospectiveService.updateRetrospective('retro-1', { status: 'COMPLETED' }, USER_ID)
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

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        mockRetrospective as never
      );
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() - 86_400_000),
      } as never);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        status: 'completed',
      } as never);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue({
        ...mockRetrospective,
        status: 'COMPLETED',
      } as never);

      const result = await retrospectiveService.updateRetrospective(
        'retro-1',
        {
          status: 'COMPLETED',
        },
        USER_ID
      );

      expect(result.status).toBe('COMPLETED');
    });

    it('should refuse a caller from another team', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        id: 'retro-1',
        teamId: TEAM_ID,
        status: 'IN_PROGRESS',
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.updateRetrospective('retro-1', { summary: 'Outsider' }, 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.sprintRetrospective.update).not.toHaveBeenCalled();
    });
  });

  describe('applyDodChanges', () => {
    const reflectionRow = (reflections: unknown[]) => ({
      id: 'retro-1',
      teamId: TEAM_ID,
      dodReflections: reflections,
      items: [],
      actionItems: [],
      attendees: [],
    });

    it('should refuse to apply an empty reflection', async () => {
      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        reflectionRow([]) as never
      );

      await expect(retrospectiveService.applyDodChanges('retro-1', USER_ID)).rejects.toMatchObject({
        code: GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING,
      });
      expect(definitionOfDoneService.updateDefinitionOfDone).not.toHaveBeenCalled();
    });

    it('should apply keep, change and retire, append proposals and stamp the version', async () => {
      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        reflectionRow([
          { dodItemId: 'dod-1', description: 'Peer reviewed', decision: 'KEEP' },
          {
            dodItemId: 'dod-2',
            description: 'Unit tests pass',
            decision: 'CHANGE',
            proposedDescription: 'Unit tests pass with 80% coverage',
          },
          { dodItemId: 'dod-3', description: 'Manual sign-off', decision: 'RETIRE' },
          { dodItemId: null, description: 'Deployed to staging', decision: 'KEEP' },
        ]) as never
      );
      vi.mocked(definitionOfDoneService.getDefinitionOfDone).mockResolvedValue({
        items: [
          {
            id: 'dod-1',
            description: 'Peer reviewed',
            category: 'review',
            isActive: true,
            order: 0,
          },
          {
            id: 'dod-2',
            description: 'Unit tests pass',
            category: 'testing',
            isActive: true,
            order: 1,
          },
          {
            id: 'dod-3',
            description: 'Manual sign-off',
            category: 'quality',
            isActive: true,
            order: 2,
          },
          {
            id: 'dod-4',
            description: 'Uninspected criterion',
            category: 'quality',
            isActive: true,
            order: 3,
          },
        ],
      } as never);
      vi.mocked(definitionOfDoneService.updateDefinitionOfDone).mockResolvedValue({
        version: 4,
      } as never);
      vi.mocked(prisma.sprintRetrospective.update).mockResolvedValue({
        ...reflectionRow([]),
        dodVersionAtPush: 4,
      } as never);

      const result = await retrospectiveService.applyDodChanges('retro-1', USER_ID);

      expect(definitionOfDoneService.updateDefinitionOfDone).toHaveBeenCalledWith(
        TEAM_ID,
        [
          {
            id: 'dod-1',
            description: 'Peer reviewed',
            category: 'review',
            isActive: true,
            order: 0,
          },
          {
            id: 'dod-2',
            description: 'Unit tests pass with 80% coverage',
            category: 'testing',
            isActive: true,
            order: 1,
          },
          // dod-3 was retired, and dod-4 was never inspected so it survives untouched.
          {
            id: 'dod-4',
            description: 'Uninspected criterion',
            category: 'quality',
            isActive: true,
            order: 2,
          },
          { description: 'Deployed to staging', isActive: true, order: 3 },
        ],
        USER_ID
      );
      expect(prisma.sprintRetrospective.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ dodVersionAtPush: 4 }) })
      );
      expect(result.dodVersionAtPush).toBe(4);
    });

    it('should refuse a caller from another team', async () => {
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue(
        reflectionRow([{ dodItemId: 'dod-1', description: 'X', decision: 'KEEP' }]) as never
      );
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.applyDodChanges('retro-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(definitionOfDoneService.updateDefinitionOfDone).not.toHaveBeenCalled();
    });
  });

  describe('materializeActionItem', () => {
    const actionItemRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'action-1',
      retrospectiveId: 'retro-1',
      title: 'Improve CI/CD',
      description: 'Set up automated testing',
      retrospective: { id: 'retro-1', teamId: TEAM_ID },
      productBacklogItemId: null,
      productBacklogItem: null,
      ...overrides,
    });

    it('should create the backlog item, link it and record the target Sprint', async () => {
      grantMembership();
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(actionItemRow() as never);
      vi.mocked(prisma.sprint.findFirst).mockResolvedValue({ id: 'sprint-next' } as never);
      vi.mocked(productBacklogService.createPBI).mockResolvedValue({
        id: 'pbi-1',
        title: 'Improve CI/CD',
      } as never);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(
        actionItemRow({
          productBacklogItemId: 'pbi-1',
          addedToSprintBacklog: true,
          relatedSprintId: 'sprint-next',
          productBacklogItem: { id: 'pbi-1', title: 'Improve CI/CD' },
        }) as never
      );

      const result = await retrospectiveService.materializeActionItem('action-1', USER_ID);

      expect(productBacklogService.createPBI).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          teamId: TEAM_ID,
          title: 'Improve CI/CD',
          labels: ['retro-action'],
        })
      );
      expect(prisma.retroActionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productBacklogItemId: 'pbi-1',
            addedToSprintBacklog: true,
            relatedSprintId: 'sprint-next',
          }),
        })
      );
      expect(result.productBacklogItemId).toBe('pbi-1');
    });

    it('should refuse an improvement that is already linked', async () => {
      grantMembership();
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(
        actionItemRow({
          productBacklogItemId: 'pbi-1',
          productBacklogItem: { id: 'pbi-1', title: 'Improve CI/CD' },
        }) as never
      );

      await expect(
        retrospectiveService.materializeActionItem('action-1', USER_ID)
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED });
      expect(productBacklogService.createPBI).not.toHaveBeenCalled();
    });

    it('should remove the just-created item when the link cannot be written', async () => {
      grantMembership();
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(actionItemRow() as never);
      vi.mocked(prisma.sprint.findFirst).mockResolvedValue(null as never);
      vi.mocked(productBacklogService.createPBI).mockResolvedValue({ id: 'pbi-1' } as never);
      vi.mocked(prisma.retroActionItem.update).mockRejectedValue(new Error('link failed'));
      vi.mocked(prisma.productBacklogItem.delete).mockResolvedValue({} as never);

      await expect(retrospectiveService.materializeActionItem('action-1', USER_ID)).rejects.toThrow(
        'link failed'
      );
      expect(prisma.productBacklogItem.delete).toHaveBeenCalledWith({ where: { id: 'pbi-1' } });
    });
  });

  describe('linkActionItemToPbi', () => {
    const actionItemRow = (overrides: Record<string, unknown> = {}) => ({
      id: 'action-1',
      retrospectiveId: 'retro-1',
      retrospective: { id: 'retro-1', teamId: TEAM_ID },
      productBacklogItemId: null,
      productBacklogItem: null,
      ...overrides,
    });

    it('should link an existing item of the same team', async () => {
      grantMembership();
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(actionItemRow() as never);
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        id: 'pbi-1',
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.sprint.findFirst).mockResolvedValue({ id: 'sprint-next' } as never);
      vi.mocked(prisma.retroActionItem.update).mockResolvedValue(
        actionItemRow({
          productBacklogItemId: 'pbi-1',
          addedToSprintBacklog: true,
          relatedSprintId: 'sprint-next',
        }) as never
      );

      const result = await retrospectiveService.linkActionItemToPbi('action-1', 'pbi-1', USER_ID);

      expect(result.productBacklogItemId).toBe('pbi-1');
      expect(prisma.retroActionItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ addedToSprintBacklog: true }),
        })
      );
    });

    it('should refuse an item that belongs to another team', async () => {
      grantMembership();
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(actionItemRow() as never);
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        id: 'pbi-1',
        teamId: 'other-team',
      } as never);

      await expect(
        retrospectiveService.linkActionItemToPbi('action-1', 'pbi-1', USER_ID)
      ).rejects.toThrow('must belong to the same team');
      expect(prisma.retroActionItem.update).not.toHaveBeenCalled();
    });

    it('should refuse an improvement that is already linked', async () => {
      grantMembership();
      vi.mocked(prisma.retroActionItem.findUnique).mockResolvedValue(
        actionItemRow({ productBacklogItemId: 'pbi-0' }) as never
      );

      await expect(
        retrospectiveService.linkActionItemToPbi('action-1', 'pbi-1', USER_ID)
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED });
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
              retrospectiveId: 'retro-1',
              title: 'Action 1',
              description: null,
              ownerId: 'user-1',
              dueDate: null,
              status: 'PENDING',
              addedToSprintBacklog: false,
              relatedSprintId: null,
              productBacklogItemId: null,
              completedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              owner: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
            },
          ],
          sprint: { id: 'sprint-1', name: 'Sprint 1' },
        },
      ];

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findMany).mockResolvedValue(mockRetrospectives as never);

      const result = await retrospectiveService.getPendingActionItemsByTeam(teamId, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe('Action 1');
    });

    it('should refuse a caller who is not a member of the team', async () => {
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.getPendingActionItemsByTeam(TEAM_ID, 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.sprintRetrospective.findMany).not.toHaveBeenCalled();
    });
  });

  describe('attendees', () => {
    it('should add attendee to retrospective', async () => {
      const mockAttendee = {
        id: 'test-uuid',
        retrospectiveId: 'retro-1',
        name: 'John Doe',
        email: 'john@test.com',
        role: 'DEVELOPERS',
        attended: true,
      };

      grantMembership();
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroAttendee.create).mockResolvedValue(mockAttendee as never);

      const result = await retrospectiveService.addAttendee(
        'retro-1',
        {
          name: 'John Doe',
          email: 'john@test.com',
          role: 'DEVELOPERS',
          attended: true,
        },
        USER_ID
      );

      expect(result.name).toBe('John Doe');
      expect(result.attended).toBe(true);
    });

    it('should update attendee', async () => {
      const mockAttendee = {
        id: 'attendee-1',
        retrospectiveId: 'retro-1',
        name: 'Jane Doe',
        email: 'jane@test.com',
        role: 'SCRUM_MASTER',
        attended: false,
      };

      grantMembership();
      vi.mocked(prisma.retroAttendee.findUnique).mockResolvedValue(mockAttendee as never);
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroAttendee.update).mockResolvedValue(mockAttendee as never);

      const result = await retrospectiveService.updateAttendee(
        'attendee-1',
        {
          name: 'Jane Doe',
          attended: false,
        },
        USER_ID
      );

      expect(result.name).toBe('Jane Doe');
      expect(result.attended).toBe(false);
    });

    it('should delete attendee', async () => {
      const mockAttendee = { id: 'attendee-1', retrospectiveId: 'retro-1' };

      grantMembership();
      vi.mocked(prisma.retroAttendee.findUnique).mockResolvedValue(mockAttendee as never);
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.retroAttendee.delete).mockResolvedValue(mockAttendee as never);

      await expect(
        retrospectiveService.deleteAttendee('attendee-1', USER_ID)
      ).resolves.not.toThrow();
    });

    it('should refuse to rewrite an attendee of another team', async () => {
      vi.mocked(prisma.retroAttendee.findUnique).mockResolvedValue({
        id: 'attendee-1',
        retrospectiveId: 'retro-1',
      } as never);
      vi.mocked(prisma.sprintRetrospective.findUnique).mockResolvedValue({
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        retrospectiveService.deleteAttendee('attendee-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY });
      expect(prisma.retroAttendee.delete).not.toHaveBeenCalled();
    });
  });
});
