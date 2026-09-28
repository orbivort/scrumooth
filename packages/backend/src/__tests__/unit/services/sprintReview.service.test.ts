import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => {
  const prismaMock: {
    $transaction: ReturnType<typeof vi.fn>;
    [key: string]: unknown;
  } = {
    $transaction: vi.fn(),
    sprintReview: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
    },
    increment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    reviewAttendee: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    stakeholderFeedback: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    backlogAdjustment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    productBacklogItem: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };

  // The service syncs child collections inside an interactive transaction. Running the callback
  // against the same mock client keeps every existing per-model assertion valid.
  prismaMock.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prismaMock)
      : Promise.all(arg as readonly unknown[])
  );

  return { default: prismaMock };
});

const mockCreatePBI = vi.hoisted(() => vi.fn());

vi.mock('../../../services/backlog.service', () => ({
  productBacklogService: {
    createPBI: mockCreatePBI,
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// The audit trail has its own logger, which the partial `utils/logger` mock above does not carry.
vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  AuditActions: { VIEW: 'VIEW', UPDATE: 'UPDATE', CREATE: 'CREATE', ASSIGN: 'ASSIGN' },
  AuditEventTypes: { SPRINT: 'SPRINT', REPORTS: 'REPORTS' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

const mockNotificationCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'notification-id' })
);

const mockNotificationCreateLocalized = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'notification-id' })
);

vi.mock('../../../services/notification.service', () => ({
  NotificationService: class {
    create = mockNotificationCreate;
    createLocalized = mockNotificationCreateLocalized;
  },
}));

// Now import the service and other dependencies
import { sprintReviewService } from '../../../services/sprintReview.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { auditResourceEvent } from '../../../utils/auditLogger';

describe('SprintReviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every Review write now asserts team membership. Individual tests override this to assert
    // the refusal path.
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ id: 'membership-1' } as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : Promise.all(arg as readonly unknown[])) as never);
  });

  describe('getSprintReviews', () => {
    it('should return sprint reviews for a team', async () => {
      const teamId = 'test-team-id';
      const mockReviews = [
        {
          id: 'review-1',
          teamId,
          sprintId: 'sprint-1',
          status: 'completed',
          reviewDate: new Date(),
          sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'COMPLETED', goal: 'Goal 1' },
          attendees: [],
          feedback: [],
          backlogAdjustments: [],
        },
      ];

      vi.mocked(prisma.sprintReview.findMany).mockResolvedValue(mockReviews as any);

      const result = await sprintReviewService.getSprintReviews(teamId);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('review-1');
      expect(prisma.sprintReview.findMany).toHaveBeenCalledWith({
        where: { teamId },
        include: expect.any(Object),
        orderBy: { reviewDate: 'desc' },
      });
    });

    it('should filter by sprintId when provided', async () => {
      const teamId = 'test-team-id';
      const sprintId = 'sprint-1';

      vi.mocked(prisma.sprintReview.findMany).mockResolvedValue([]);

      await sprintReviewService.getSprintReviews(teamId, sprintId);

      expect(prisma.sprintReview.findMany).toHaveBeenCalledWith({
        where: { teamId, sprintId },
        include: expect.any(Object),
        orderBy: { reviewDate: 'desc' },
      });
    });

    it('should withhold the Scrum Master notes from a caller who does not lead the team', async () => {
      vi.mocked(prisma.sprintReview.findMany).mockResolvedValue([
        {
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          smNotes: 'coaching',
          sprint: { id: 'sprint-1' },
          attendees: [],
          feedback: [],
          backlogAdjustments: [],
        },
      ] as any);
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue([] as any);

      const [review] = await sprintReviewService.getSprintReviews('team-id', undefined, 'user-1');

      expect(review).not.toHaveProperty('smNotes');
    });

    it('should keep the Scrum Master notes for the team Scrum Master', async () => {
      vi.mocked(prisma.sprintReview.findMany).mockResolvedValue([
        {
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          smNotes: 'coaching',
          sprint: { id: 'sprint-1' },
          attendees: [],
          feedback: [],
          backlogAdjustments: [],
        },
      ] as any);
      vi.mocked(prisma.teamMember.findMany).mockResolvedValue([{ teamId: 'team-id' }] as any);

      const [review] = await sprintReviewService.getSprintReviews('team-id', undefined, 'sm-1');

      expect(review?.smNotes).toBe('coaching');
    });
  });

  describe('getSprintReviewById', () => {
    it('should return sprint review by ID', async () => {
      const reviewId = 'review-1';
      const mockReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        incrementId: 'increment-1',
        status: 'completed',
        reviewDate: new Date(),
        sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'COMPLETED', goal: 'Goal 1' },
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(null as any);

      const result = await sprintReviewService.getSprintReviewById(reviewId);

      expect(result.id).toBe(reviewId);
      expect(result.increment).toBeNull();
    });

    it('should include increment with PBIs when incrementId exists', async () => {
      const reviewId = 'review-1';
      const mockReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        incrementId: 'increment-1',
        status: 'completed',
        reviewDate: new Date(),
        sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'COMPLETED', goal: 'Goal 1' },
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };
      const mockIncrement = {
        id: 'increment-1',
        name: 'Increment 1',
        pbis: [
          { pbi: { id: 'pbi-1', title: 'PBI 1', storyPoints: 5, status: 'DONE' } },
          { pbi: { id: 'pbi-2', title: 'PBI 2', storyPoints: 3, status: 'IN_PROGRESS' } },
        ],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(mockIncrement as any);

      const result = await sprintReviewService.getSprintReviewById(reviewId);

      expect(result.id).toBe(reviewId);
      expect(result.increment).not.toBeNull();
      expect(result.increment!.pbis).toHaveLength(2);
      expect(result.increment!.pbis[0]!.title).toBe('PBI 1');
      expect(result.increment!.pbis[1]!.title).toBe('PBI 2');
    });

    it('should throw NotFoundError when review does not exist', async () => {
      const reviewId = 'non-existent-id';

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(sprintReviewService.getSprintReviewById(reviewId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createSprintReview', () => {
    it('should create a new sprint review', async () => {
      const userId = 'test-user-id';
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'COMPLETED',
      };
      const mockIncrement = { id: 'increment-1', name: 'Increment 1', status: 'DELIVERED' };
      const mockReview = {
        id: 'test-uuid',
        sprintId: 'sprint-1',
        teamId: 'team-id',
        incrementId: 'increment-1',
        reviewDate: new Date(),
        summary: 'Review summary',
        status: 'completed',
        createdBy: userId,
        sprint: mockSprint,
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(mockSprint as any);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.increment.findFirst).mockResolvedValue(mockIncrement as any);
      vi.mocked(prisma.sprintReview.create).mockResolvedValue(mockReview as any);

      const result = await sprintReviewService.createSprintReview(userId, {
        sprintId: 'sprint-1',
        teamId: 'team-id',
        reviewDate: new Date(),
        summary: 'Review summary',
      });

      expect(result.id).toBe('test-uuid');
      expect(result.sprintId).toBe('sprint-1');
    });

    it('should throw NotFoundError when sprint does not exist', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.createSprintReview(userId, {
          sprintId: 'non-existent-sprint',
          teamId: 'team-id',
          reviewDate: new Date(),
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when review already exists for sprint', async () => {
      const userId = 'test-user-id';
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'COMPLETED',
      };
      const existingReview = { id: 'existing-review', sprintId: 'sprint-1' };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(mockSprint as any);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);

      await expect(
        sprintReviewService.createSprintReview(userId, {
          sprintId: 'sprint-1',
          teamId: 'team-id',
          reviewDate: new Date(),
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when no delivered increment found', async () => {
      const userId = 'test-user-id';
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'COMPLETED',
      };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(mockSprint as any);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.increment.findFirst).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.createSprintReview(userId, {
          sprintId: 'sprint-1',
          teamId: 'team-id',
          reviewDate: new Date(),
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should use provided incrementId when specified', async () => {
      const userId = 'test-user-id';
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'COMPLETED',
      };
      const mockReview = {
        id: 'test-uuid',
        sprintId: 'sprint-1',
        teamId: 'team-id',
        incrementId: 'custom-increment-id',
        reviewDate: new Date(),
        status: 'completed',
        createdBy: userId,
        sprint: mockSprint,
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(mockSprint as any);
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.sprintReview.create).mockResolvedValue(mockReview as any);

      const result = await sprintReviewService.createSprintReview(userId, {
        sprintId: 'sprint-1',
        teamId: 'team-id',
        incrementId: 'custom-increment-id',
        reviewDate: new Date(),
      });

      expect(result.incrementId).toBe('custom-increment-id');
      expect(prisma.increment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('updateSprintReview', () => {
    it('should update a sprint review', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.reviewAttendee.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.stakeholderFeedback.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.backlogAdjustment.deleteMany).mockResolvedValue({ count: 0 } as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId, summary: 'New summary' } as any);

      const result = await sprintReviewService.updateSprintReview(reviewId, userId, {
        summary: 'New summary',
      });

      expect(result.summary).toBe('New summary');
      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          summary: 'New summary',
          updatedBy: userId,
        },
      });

      mockGetById.mockRestore();
    });

    it('should update reviewDate when provided', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };
      const newDate = new Date('2025-01-15');

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId, reviewDate: newDate } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        reviewDate: newDate,
      });

      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          reviewDate: newDate,
          updatedBy: userId,
        },
      });

      mockGetById.mockRestore();
    });

    it('should refuse a write from a caller with no identity', async () => {
      const reviewId = 'review-1';
      const existingReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        status: 'in_progress',
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);

      await expect(
        sprintReviewService.updateSprintReview(reviewId, undefined, { summary: 'New summary' })
      ).rejects.toThrow(ForbiddenError);
      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('should refuse a write from a non-member of the owning team', async () => {
      const reviewId = 'review-1';
      const existingReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        status: 'in_progress',
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(
        sprintReviewService.updateSprintReview(reviewId, 'outsider-id', { summary: 'New summary' })
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY });
    });

    const inProgressReview = {
      id: 'review-1',
      teamId: 'team-id',
      sprintId: 'sprint-1',
      status: 'in_progress',
      summary: 'Old summary',
      attendees: [],
      feedback: [],
      backlogAdjustments: [],
    };

    /** Complete the Review with the Sprint's end date and status stubbed as given. */
    const completeWithSprint = async (sprint: { endDate: Date; status: string }) => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(inProgressReview as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(sprint as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: 'review-1', status: 'completed' } as any);

      await sprintReviewService.updateSprintReview('review-1', 'user-id', { status: 'completed' });

      mockGetById.mockRestore();
    };

    it('should refuse to complete a review before the sprint has ended', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(inProgressReview as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: new Date(Date.now() + 86_400_000),
        status: 'ACTIVE',
      } as any);

      await expect(
        sprintReviewService.updateSprintReview('review-1', 'user-id', { status: 'completed' })
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE });
      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('should complete a review on the day the sprint ends, whatever time its end date stores', async () => {
      // The refusal this rule was changed for: an end date written at 23:59:59 -- the form the
      // fixtures and the API examples use -- blocked the whole final day, while the same Sprint
      // written at midnight allowed it. A team holds its Review on that day either way.
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      await completeWithSprint({ endDate: endOfToday, status: 'ACTIVE' });

      expect(prisma.sprintReview.update).toHaveBeenCalled();
    });

    it('should complete a review of a sprint that was cancelled before its end date', async () => {
      // A cancelled Sprint ended when it ended; holding its Review back to the original end date
      // would leave the team no way to record what happened.
      await completeWithSprint({
        endDate: new Date(Date.now() + 86_400_000),
        status: 'CANCELLED',
      });

      expect(prisma.sprintReview.update).toHaveBeenCalled();
    });

    it('should complete a review once the sprint has ended', async () => {
      await completeWithSprint({ endDate: new Date(Date.now() - 86_400_000), status: 'ACTIVE' });

      expect(prisma.sprint.findUnique).toHaveBeenCalledWith({
        where: { id: 'sprint-1' },
        select: { endDate: true, status: true },
      });
    });

    it('should handle empty attendees array', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.reviewAttendee.deleteMany).mockResolvedValue({ count: 0 } as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        attendees: [],
      });

      // Sync-by-id only deletes rows the payload omitted, so an empty list on an empty review
      // writes nothing at all.
      expect(prisma.reviewAttendee.deleteMany).not.toHaveBeenCalled();
      expect(prisma.reviewAttendee.create).not.toHaveBeenCalled();

      mockGetById.mockRestore();
    });

    it('should handle empty feedback array', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stakeholderFeedback.deleteMany).mockResolvedValue({ count: 0 } as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        feedback: [],
      });

      expect(prisma.stakeholderFeedback.deleteMany).not.toHaveBeenCalled();
      expect(prisma.stakeholderFeedback.create).not.toHaveBeenCalled();

      mockGetById.mockRestore();
    });

    it('should handle empty backlogAdjustments array', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.backlogAdjustment.deleteMany).mockResolvedValue({ count: 0 } as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        backlogAdjustments: [],
      });

      expect(prisma.backlogAdjustment.deleteMany).not.toHaveBeenCalled();
      expect(prisma.backlogAdjustment.create).not.toHaveBeenCalled();

      mockGetById.mockRestore();
    });

    it('should handle unknown feedback category', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.stakeholderFeedback.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        feedback: [
          {
            authorName: 'John Doe',
            content: 'Some feedback',
            category: 'unknown_category',
          },
        ],
      });

      expect(prisma.stakeholderFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: 'POSITIVE',
          authorName: 'John Doe',
        }),
      });

      mockGetById.mockRestore();
    });

    it('should send notification to backlog adjustment owner', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };
      const mockAdjustment = {
        id: 'test-uuid',
        reviewId,
        action: 'ADD',
        description: 'Add new feature',
        reason: 'Customer request',
        implemented: false,
        ownerId: 'owner-1',
        createdBy: userId,
      };

      mockNotificationCreateLocalized.mockClear();

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.backlogAdjustment.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.backlogAdjustment.create).mockResolvedValue(mockAdjustment as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        backlogAdjustments: [
          {
            action: 'ADD',
            description: 'Add new feature',
            reason: 'Customer request',
            ownerId: 'owner-1',
            implemented: false,
          },
        ],
      });

      expect(prisma.backlogAdjustment.create).toHaveBeenCalled();
      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          type: 'TASK_ASSIGNMENT',
          titleKey: 'backlogAdjustmentRequired',
          messageKey: 'backlogAdjustmentRequiredMessage',
          data: {
            adjustmentId: 'test-uuid',
            reviewId,
            action: 'ADD',
          },
          createdBy: userId,
        })
      );

      mockGetById.mockRestore();
    });

    it('should truncate long backlog adjustment description in notification', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const existingReview = {
        id: reviewId,
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };
      const longDescription = 'A'.repeat(150);
      const mockAdjustment = {
        id: 'test-uuid',
        reviewId,
        action: 'ADD',
        description: longDescription,
        reason: 'Customer request',
        implemented: false,
        ownerId: 'owner-1',
        createdBy: userId,
      };

      mockNotificationCreateLocalized.mockClear();

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);
      vi.mocked(prisma.backlogAdjustment.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.backlogAdjustment.create).mockResolvedValue(mockAdjustment as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, userId, {
        backlogAdjustments: [
          {
            action: 'ADD',
            description: longDescription,
            reason: 'Customer request',
            ownerId: 'owner-1',
            implemented: false,
          },
        ],
      });

      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          messageParams: expect.objectContaining({
            description: expect.stringContaining('...'),
          }),
        })
      );
      const callArg = mockNotificationCreateLocalized.mock.calls[0]![0];
      const expectedTruncated = `${longDescription.substring(0, 100)}...`;
      expect(callArg.messageParams.description).toBe(expectedTruncated);

      mockGetById.mockRestore();
    });

    it('should throw NotFoundError when review does not exist', async () => {
      const reviewId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.updateSprintReview(reviewId, userId, { summary: 'New summary' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('recorded Sprint Goal verdict', () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existingReview = (overrides: Record<string, unknown> = {}) => ({
      id: 'review-1',
      sprintId: 'sprint-1',
      teamId: 'team-id',
      status: 'in_progress',
      sprintGoal: 'Deliver feature X',
      sprintGoalOutcome: null,
      attendees: [],
      feedback: [],
      backlogAdjustments: [],
      ...overrides,
    });

    it('records a verdict and snapshots the Goal it judged', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview() as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: 'review-1' } as any);

      await sprintReviewService.updateSprintReview('review-1', 'user-id', {
        sprintGoalOutcome: 'PARTIALLY_ACHIEVED',
        sprintGoalNote: 'Ran out of time',
      });

      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          sprintGoalOutcome: 'PARTIALLY_ACHIEVED',
          sprintGoal: 'Deliver feature X',
          sprintGoalNote: 'Ran out of time',
          updatedBy: 'user-id',
        },
      });

      mockGetById.mockRestore();
    });

    it('refuses a verdict when the Sprint has no Sprint Goal', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(
        existingReview({ sprintGoal: null }) as any
      );

      await expect(
        sprintReviewService.updateSprintReview('review-1', 'user-id', {
          sprintGoalOutcome: 'ACHIEVED',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_NOT_APPLICABLE,
      });

      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('refuses a new Review that arrives carrying a verdict for a Sprint with no Goal', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'COMPLETED',
        sprintGoal: null,
      } as any);

      await expect(
        sprintReviewService.createSprintReview('user-id', {
          sprintId: 'sprint-1',
          teamId: 'team-id',
          reviewDate: new Date(),
          sprintGoalOutcome: 'ACHIEVED',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_NOT_APPLICABLE,
      });

      expect(prisma.sprintReview.create).not.toHaveBeenCalled();
    });

    it('requires the verdict when a Review of a Sprint with a Goal is completed', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview() as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ endDate: pastEnd } as any);

      await expect(
        sprintReviewService.updateSprintReview('review-1', 'user-id', { status: 'completed' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED,
      });

      expect(prisma.sprintReview.update).not.toHaveBeenCalled();
    });

    it('accepts a verdict supplied with the conclusion', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview() as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ endDate: pastEnd } as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: 'review-1' } as any);

      await sprintReviewService.updateSprintReview('review-1', 'user-id', {
        status: 'completed',
        sprintGoalOutcome: 'ACHIEVED',
      });

      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: {
          status: 'completed',
          sprintGoalOutcome: 'ACHIEVED',
          sprintGoal: 'Deliver feature X',
          updatedBy: 'user-id',
        },
      });

      mockGetById.mockRestore();
    });

    it('completes a Review of a Sprint without a Goal without asking for a verdict', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(
        existingReview({ sprintGoal: null }) as any
      );
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        endDate: pastEnd,
        sprintGoal: null,
      } as any);
      vi.mocked(prisma.sprintReview.update).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: 'review-1' } as any);

      await sprintReviewService.updateSprintReview('review-1', 'user-id', {
        status: 'completed',
      });

      expect(prisma.sprintReview.update).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        data: { status: 'completed', updatedBy: 'user-id' },
      });

      mockGetById.mockRestore();
    });
  });

  describe('addStakeholderFeedback', () => {
    it('should add feedback to a review', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };
      const mockFeedback = {
        id: 'test-uuid',
        reviewId,
        authorName: 'John Doe',
        content: 'Great work!',
        category: 'POSITIVE',
        actionRequired: false,
        actionTaken: false,
        owner: null,
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue(mockFeedback as any);

      const result = await sprintReviewService.addStakeholderFeedback(reviewId, userId, {
        authorName: 'John Doe',
        content: 'Great work!',
        category: 'positive',
      });

      expect(result.authorName).toBe('John Doe');
      expect(result.category).toBe('positive');
    });

    it('should default to POSITIVE for unknown feedback category', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };
      const mockFeedback = {
        id: 'test-uuid',
        reviewId,
        authorName: 'John Doe',
        content: 'Some feedback',
        category: 'POSITIVE',
        actionRequired: false,
        actionTaken: false,
        owner: null,
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue(mockFeedback as any);

      const result = await sprintReviewService.addStakeholderFeedback(reviewId, userId, {
        authorName: 'John Doe',
        content: 'Some feedback',
        category: 'neutral',
      });

      expect(prisma.stakeholderFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'POSITIVE',
          }),
        })
      );
      expect(result.category).toBe('positive');
    });

    it('should send notification when ownerId and actionRequired are set', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };
      const mockFeedback = {
        id: 'test-uuid',
        reviewId,
        authorName: 'John Doe',
        content: 'Please fix this issue',
        category: 'NEGATIVE',
        actionRequired: true,
        actionTaken: false,
        owner: {
          id: 'owner-1',
          firstName: 'Owner',
          lastName: 'User',
          email: 'owner@example.com',
        },
      };

      mockNotificationCreateLocalized.mockClear();

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue(mockFeedback as any);

      const result = await sprintReviewService.addStakeholderFeedback(reviewId, userId, {
        authorName: 'John Doe',
        content: 'Please fix this issue',
        category: 'negative',
        actionRequired: true,
        ownerId: 'owner-1',
      });

      expect(result.category).toBe('negative');
      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'owner-1',
          type: 'TASK_ASSIGNMENT',
          titleKey: 'feedbackRequired',
          messageKey: 'feedbackRequiredMessage',
          data: {
            feedbackId: 'test-uuid',
            reviewId,
            category: 'negative',
          },
          createdBy: userId,
        })
      );
    });

    it('should truncate long feedback content in notification', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };
      const longContent = 'X'.repeat(150);
      const mockFeedback = {
        id: 'test-uuid',
        reviewId,
        authorName: 'John Doe',
        content: longContent,
        category: 'SUGGESTION',
        actionRequired: true,
        actionTaken: false,
        owner: {
          id: 'owner-1',
          firstName: 'Owner',
          lastName: 'User',
          email: 'owner@example.com',
        },
      };

      mockNotificationCreateLocalized.mockClear();

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue(mockFeedback as any);

      await sprintReviewService.addStakeholderFeedback(reviewId, userId, {
        authorName: 'John Doe',
        content: longContent,
        category: 'suggestion',
        actionRequired: true,
        ownerId: 'owner-1',
      });

      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          messageParams: expect.objectContaining({
            content: expect.stringContaining('...'),
          }),
        })
      );
      const callArg = mockNotificationCreateLocalized.mock.calls[0]![0];
      const expectedTruncated = `${longContent.substring(0, 100)}...`;
      expect(callArg.messageParams.content).toBe(expectedTruncated);
    });

    it('should throw NotFoundError when review does not exist', async () => {
      const reviewId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.addStakeholderFeedback(reviewId, userId, {
          authorName: 'John Doe',
          content: 'Great work!',
          category: 'positive',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteSprintReview', () => {
    it('should delete a sprint review', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.sprintReview.delete).mockResolvedValue(mockReview as any);

      await expect(sprintReviewService.deleteSprintReview(reviewId, userId)).resolves.not.toThrow();
      expect(prisma.sprintReview.delete).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
    });

    it('should refuse a delete from a non-member', async () => {
      const reviewId = 'review-1';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(
        sprintReviewService.deleteSprintReview(reviewId, 'outsider-id')
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY });
      expect(prisma.sprintReview.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when review does not exist', async () => {
      const reviewId = 'non-existent-id';

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(sprintReviewService.deleteSprintReview(reviewId, 'user-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getPendingAdjustments', () => {
    it('should return pending backlog adjustments', async () => {
      const teamId = 'test-team-id';
      const mockReviews = [
        {
          id: 'review-1',
          teamId,
          status: 'completed',
          reviewDate: new Date(),
          sprint: { id: 'sprint-1', name: 'Sprint 1' },
          backlogAdjustments: [
            { id: 'adj-1', action: 'ADD', description: 'Add feature', implemented: false },
          ],
        },
      ];

      vi.mocked(prisma.sprintReview.findMany).mockResolvedValue(mockReviews as any);

      const result = await sprintReviewService.getPendingAdjustments(teamId);

      expect(result).toHaveLength(1);
      expect(result[0]!.action).toBe('ADD');
    });
  });

  describe('markAdjustmentImplemented', () => {
    it('should mark adjustment as implemented', async () => {
      const adjustmentId = 'adj-1';
      const userId = 'user-id';
      const mockAdjustment = {
        id: adjustmentId,
        action: 'ADD',
        implemented: false,
        createdPbiId: null,
        review: { teamId: 'team-id' },
      };
      const updatedAdjustment = {
        ...mockAdjustment,
        implemented: true,
        updatedBy: userId,
      };

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(mockAdjustment as any);
      vi.mocked(prisma.backlogAdjustment.update).mockResolvedValue(updatedAdjustment as any);

      const result = await sprintReviewService.markAdjustmentImplemented(adjustmentId, userId);

      expect(result.implemented).toBe(true);
      expect(prisma.backlogAdjustment.update).toHaveBeenCalledWith({
        where: { id: adjustmentId },
        data: {
          implemented: true,
          updatedAt: expect.any(Date),
          updatedBy: userId,
        },
      });
    });

    it('should throw NotFoundError when adjustment does not exist', async () => {
      const adjustmentId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.markAdjustmentImplemented(adjustmentId, userId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getPendingFeedback', () => {
    it('should return pending feedback items', async () => {
      const teamId = 'test-team-id';
      const mockReviews = [
        {
          id: 'review-1',
          teamId,
          status: 'completed',
          reviewDate: new Date(),
          sprint: { id: 'sprint-1', name: 'Sprint 1' },
          feedback: [
            {
              id: 'fb-1',
              content: 'Fix bug',
              actionRequired: true,
              actionTaken: false,
              category: 'NEGATIVE',
            },
          ],
        },
      ];

      vi.mocked(prisma.sprintReview.findMany).mockResolvedValue(mockReviews as any);

      const result = await sprintReviewService.getPendingFeedback(teamId);

      expect(result).toHaveLength(1);
      expect(result[0]!.content).toBe('Fix bug');
    });
  });

  describe('markFeedbackAddressed', () => {
    it('should mark feedback as addressed', async () => {
      const feedbackId = 'fb-1';
      const userId = 'user-id';
      const mockFeedback = {
        id: feedbackId,
        content: 'Fix bug',
        actionRequired: true,
        actionTaken: false,
        category: 'NEGATIVE',
        review: { teamId: 'team-id' },
      };
      const updatedFeedback = {
        ...mockFeedback,
        actionTaken: true,
        updatedBy: userId,
      };

      vi.mocked(prisma.stakeholderFeedback.findUnique).mockResolvedValue(mockFeedback as any);
      vi.mocked(prisma.stakeholderFeedback.update).mockResolvedValue(updatedFeedback as any);

      const result = await sprintReviewService.markFeedbackAddressed(feedbackId, userId);

      expect(result.actionTaken).toBe(true);
      expect(prisma.stakeholderFeedback.update).toHaveBeenCalledWith({
        where: { id: feedbackId },
        data: {
          actionTaken: true,
          updatedAt: expect.any(Date),
          updatedBy: userId,
        },
      });
    });

    it('should throw NotFoundError when feedback does not exist', async () => {
      const feedbackId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.stakeholderFeedback.findUnique).mockResolvedValue(null as any);

      await expect(sprintReviewService.markFeedbackAddressed(feedbackId, userId)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('addAttendee', () => {
    it('should add an attendee to a review', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };
      const mockAttendee = {
        id: 'test-uuid',
        reviewId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Developer',
        attended: true,
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.reviewAttendee.create).mockResolvedValue(mockAttendee as any);

      const result = await sprintReviewService.addAttendee(reviewId, userId, {
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Developer',
        attended: true,
      });

      expect(result.name).toBe('Jane Doe');
      expect(result.attended).toBe(true);
    });

    it('should throw NotFoundError when review does not exist', async () => {
      const reviewId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.addAttendee(reviewId, userId, {
          name: 'Jane Doe',
          role: 'Developer',
          attended: true,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateAttendee', () => {
    it('should update an attendee', async () => {
      const attendeeId = 'attendee-1';
      const userId = 'user-id';
      const mockAttendee = {
        id: attendeeId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'Developer',
        attended: true,
        userId: null,
        review: { teamId: 'team-id' },
      };
      const updatedAttendee = {
        ...mockAttendee,
        attended: false,
        updatedBy: userId,
      };

      vi.mocked(prisma.reviewAttendee.findUnique).mockResolvedValue(mockAttendee as any);
      vi.mocked(prisma.reviewAttendee.update).mockResolvedValue(updatedAttendee as any);

      const result = await sprintReviewService.updateAttendee(attendeeId, userId, {
        attended: false,
      });

      expect(result.attended).toBe(false);
    });

    it('should throw NotFoundError when attendee does not exist', async () => {
      const attendeeId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.reviewAttendee.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.updateAttendee(attendeeId, userId, { attended: false })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteAttendee', () => {
    it('should delete an attendee', async () => {
      const attendeeId = 'attendee-1';
      const userId = 'user-id';
      const mockAttendee = {
        id: attendeeId,
        name: 'Jane Doe',
        review: { teamId: 'team-id' },
      };

      vi.mocked(prisma.reviewAttendee.findUnique).mockResolvedValue(mockAttendee as any);
      vi.mocked(prisma.reviewAttendee.delete).mockResolvedValue(mockAttendee as any);

      const result = await sprintReviewService.deleteAttendee(attendeeId, userId);

      expect(result.success).toBe(true);
      expect(prisma.reviewAttendee.delete).toHaveBeenCalledWith({
        where: { id: attendeeId },
      });
    });

    it('should throw NotFoundError when attendee does not exist', async () => {
      const attendeeId = 'non-existent-id';

      vi.mocked(prisma.reviewAttendee.findUnique).mockResolvedValue(null as any);

      await expect(sprintReviewService.deleteAttendee(attendeeId, 'user-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('addAttendee with a registered user', () => {
    it('should derive display fields from the linked account and record the membership role', async () => {
      const reviewId = 'review-1';
      const userId = 'user-id';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'linked-user',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
      } as any);
      vi.mocked(prisma.teamMember.findFirst)
        // First call is the acting user's membership; second resolves the linked user's role.
        .mockResolvedValueOnce({ id: 'membership-1', role: 'DEVELOPERS' } as any)
        .mockResolvedValueOnce({ id: 'membership-2', role: 'PRODUCT_OWNER' } as any);
      vi.mocked(prisma.reviewAttendee.create).mockResolvedValue({
        id: 'test-uuid',
        userId: 'linked-user',
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'product_owner',
        attended: true,
      } as any);

      const result = await sprintReviewService.addAttendee(reviewId, userId, {
        userId: 'linked-user',
        name: 'ignored',
        role: 'stakeholder',
        attended: true,
      });

      expect(prisma.reviewAttendee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'linked-user',
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'product_owner',
        }),
      });
      expect(result.userId).toBe('linked-user');
    });

    it('should refuse a link to a user that does not exist', async () => {
      const reviewId = 'review-1';
      const mockReview = { id: reviewId, teamId: 'team-id', status: 'completed' };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(mockReview as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintReviewService.addAttendee(reviewId, 'user-id', {
          userId: 'missing-user',
          name: 'Jane Doe',
          role: 'stakeholder',
          attended: true,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('child sync preserves traceability links', () => {
    it('should keep an adjustment createdPbiId and force implemented when the review is saved', async () => {
      const reviewId = 'review-1';
      const existingReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        status: 'in_progress',
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [
          {
            id: 'adj-1',
            reviewId,
            action: 'add',
            description: 'Add feature',
            reason: 'Requested',
            pbiId: null,
            implemented: true,
            createdPbiId: 'pbi-created',
            ownerId: null,
          },
        ],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.backlogAdjustment.update).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, 'user-id', {
        backlogAdjustments: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Add feature',
            reason: 'Requested',
            // A payload claiming the adjustment is not implemented must not erase the link.
            implemented: false,
          },
        ],
      });

      expect(prisma.backlogAdjustment.update).toHaveBeenCalledWith({
        where: { id: 'adj-1' },
        data: expect.objectContaining({ implemented: true, updatedBy: 'user-id' }),
      });
      expect(prisma.backlogAdjustment.deleteMany).not.toHaveBeenCalled();

      mockGetById.mockRestore();
    });

    it('should keep an attendee userId when the payload omits it', async () => {
      const reviewId = 'review-1';
      const existingReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        status: 'in_progress',
        summary: 'Old summary',
        attendees: [
          {
            id: 'attendee-1',
            reviewId,
            userId: 'linked-user',
            name: 'Jane Doe',
            email: 'jane@example.com',
            role: 'developers',
            attended: true,
          },
        ],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);
      vi.mocked(prisma.reviewAttendee.update).mockResolvedValue({} as any);

      const mockGetById = vi.spyOn(sprintReviewService, 'getSprintReviewById');
      mockGetById.mockResolvedValue({ id: reviewId } as any);

      await sprintReviewService.updateSprintReview(reviewId, 'user-id', {
        attendees: [
          {
            id: 'attendee-1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            role: 'developers',
            attended: false,
          },
        ],
      });

      expect(prisma.reviewAttendee.update).toHaveBeenCalledWith({
        where: { id: 'attendee-1' },
        data: expect.objectContaining({ userId: 'linked-user', attended: false }),
      });

      mockGetById.mockRestore();
    });

    it('should refuse a child row that belongs to another review', async () => {
      const reviewId = 'review-1';
      const existingReview = {
        id: reviewId,
        teamId: 'team-id',
        sprintId: 'sprint-1',
        status: 'in_progress',
        summary: 'Old summary',
        attendees: [],
        feedback: [],
        backlogAdjustments: [],
      };

      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(existingReview as any);

      await expect(
        sprintReviewService.updateSprintReview(reviewId, 'user-id', {
          attendees: [
            { id: 'someone-elses-attendee', name: 'X', role: 'stakeholder', attended: true },
          ],
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('materializeAdjustment', () => {
    it('should create a backlog item, link it, and mark the adjustment implemented', async () => {
      const adjustmentId = 'adj-1';
      const userId = 'user-id';
      const mockAdjustment = {
        id: adjustmentId,
        reviewId: 'review-1',
        action: 'add',
        description: 'Add SSO login',
        reason: 'Requested by stakeholders',
        createdPbiId: null,
        implemented: false,
        review: { id: 'review-1', teamId: 'team-id' },
      };
      const createdPbi = { id: 'pbi-1', title: 'Add SSO login' };
      const linkedAdjustment = {
        ...mockAdjustment,
        createdPbiId: 'pbi-1',
        implemented: true,
        createdPbi,
      };

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(mockAdjustment as any);
      mockCreatePBI.mockResolvedValue(createdPbi);
      vi.mocked(prisma.backlogAdjustment.update).mockResolvedValue(linkedAdjustment as any);

      const result = await sprintReviewService.materializeAdjustment(adjustmentId, userId);

      expect(mockCreatePBI).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          teamId: 'team-id',
          title: 'Add SSO login',
          description: 'Reason: Requested by stakeholders',
        })
      );
      expect(prisma.backlogAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adjustmentId },
          data: expect.objectContaining({ createdPbiId: 'pbi-1', implemented: true }),
        })
      );
      expect(result.pbi.id).toBe('pbi-1');
    });

    it('should refuse to materialise an adjustment twice', async () => {
      const adjustmentId = 'adj-1';
      const mockAdjustment = {
        id: adjustmentId,
        reviewId: 'review-1',
        description: 'Add SSO login',
        reason: 'Requested',
        createdPbiId: 'pbi-existing',
        implemented: true,
        review: { id: 'review-1', teamId: 'team-id' },
      };

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(mockAdjustment as any);

      await expect(
        sprintReviewService.materializeAdjustment(adjustmentId, 'user-id')
      ).rejects.toThrow(BadRequestError);
      expect(mockCreatePBI).not.toHaveBeenCalled();
    });

    it('should refuse a materialise from a non-member', async () => {
      const adjustmentId = 'adj-1';
      const mockAdjustment = {
        id: adjustmentId,
        reviewId: 'review-1',
        description: 'Add SSO login',
        reason: 'Requested',
        createdPbiId: null,
        review: { id: 'review-1', teamId: 'team-id' },
      };

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(mockAdjustment as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(
        sprintReviewService.materializeAdjustment(adjustmentId, 'outsider-id')
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY });
      expect(mockCreatePBI).not.toHaveBeenCalled();
    });
  });

  describe('linkAdjustmentToPbi', () => {
    it('should link an existing backlog item of the same team', async () => {
      const adjustmentId = 'adj-1';
      const mockAdjustment = {
        id: adjustmentId,
        reviewId: 'review-1',
        action: 'modify',
        createdPbiId: null,
        implemented: false,
        review: { id: 'review-1', teamId: 'team-id' },
      };

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(mockAdjustment as any);
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        id: 'pbi-1',
        teamId: 'team-id',
      } as any);
      vi.mocked(prisma.backlogAdjustment.update).mockResolvedValue({
        ...mockAdjustment,
        createdPbiId: 'pbi-1',
        implemented: true,
      } as any);

      await sprintReviewService.linkAdjustmentToPbi(adjustmentId, 'pbi-1', 'user-id');

      expect(prisma.backlogAdjustment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: adjustmentId },
          data: expect.objectContaining({ createdPbiId: 'pbi-1', implemented: true }),
        })
      );
    });

    it("should refuse a backlog item from another team's backlog", async () => {
      const adjustmentId = 'adj-1';
      const mockAdjustment = {
        id: adjustmentId,
        reviewId: 'review-1',
        createdPbiId: null,
        review: { id: 'review-1', teamId: 'team-id' },
      };

      vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(mockAdjustment as any);
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        id: 'pbi-1',
        teamId: 'other-team',
      } as any);

      await expect(
        sprintReviewService.linkAdjustmentToPbi(adjustmentId, 'pbi-1', 'user-id')
      ).rejects.toThrow(BadRequestError);
      expect(prisma.backlogAdjustment.update).not.toHaveBeenCalled();
    });
  });

  describe('guard clauses, child sync and materialisation (branch coverage)', () => {
    describe('assertSprintEnded / sprintGoalOf', () => {
      it('assertSprintEnded should throw NotFoundError when the sprint does not exist', async () => {
        vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as never);

        await expect(sprintReviewService.assertSprintEnded('missing')).rejects.toThrow(
          NotFoundError
        );
      });

      it('sprintGoalOf should throw NotFoundError when the sprint does not exist', async () => {
        vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as never);

        await expect(sprintReviewService.sprintGoalOf('missing')).rejects.toThrow(NotFoundError);
      });

      it('sprintGoalOf should return the sprint goal when the sprint exists', async () => {
        vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ sprintGoal: 'Goal' } as never);

        await expect(sprintReviewService.sprintGoalOf('sprint-1')).resolves.toBe('Goal');
      });
    });

    describe('getSprintReviews serialization', () => {
      it('should map attendees and lower-case the feedback category', async () => {
        vi.mocked(prisma.sprintReview.findMany).mockResolvedValue([
          {
            id: 'review-1',
            teamId: 'team-id',
            sprintId: 'sprint-1',
            status: 'completed',
            reviewDate: new Date(),
            sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'COMPLETED', goal: 'Goal' },
            attendees: [
              {
                id: 'a-1',
                userId: 'u-1',
                name: 'Jane',
                email: 'jane@test.com',
                role: 'developers',
                attended: true,
              },
            ],
            feedback: [{ id: 'f-1', category: 'NEGATIVE', content: 'Bug' }],
            backlogAdjustments: [],
          },
        ] as never);

        const result = await sprintReviewService.getSprintReviews('team-id');

        expect(result[0]!.attendees).toHaveLength(1);
        expect(result[0]!.attendees[0]!.name).toBe('Jane');
        expect(result[0]!.feedback[0]!.category).toBe('negative');
      });
    });

    describe('getSprintReviewById', () => {
      it('should serialize a review that has no increment', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          incrementId: null,
          attendees: [],
          feedback: [],
          backlogAdjustments: [],
        } as never);

        const result = await sprintReviewService.getSprintReviewById('review-1');

        expect(result.id).toBe('review-1');
        expect(result.increment).toBeNull();
      });

      it('should map attendees and feedback onto the review', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          incrementId: null,
          attendees: [
            {
              id: 'a-1',
              userId: null,
              name: 'Jane',
              email: 'j@test.com',
              role: 'developers',
              attended: true,
            },
          ],
          feedback: [{ id: 'f-1', category: 'POSITIVE', content: 'Nice' }],
          backlogAdjustments: [],
        } as never);

        const result = await sprintReviewService.getSprintReviewById('review-1');

        expect(result.attendees).toHaveLength(1);
        expect(result.feedback[0]!.category).toBe('positive');
      });
    });

    describe('createSprintReview', () => {
      it('should refuse a sprint that belongs to a different team', async () => {
        vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
          id: 'sprint-1',
          teamId: 'other-team',
          sprintGoal: 'Goal',
        } as never);

        await expect(
          sprintReviewService.createSprintReview('user-id', {
            sprintId: 'sprint-1',
            teamId: 'team-id',
            reviewDate: new Date(),
          })
        ).rejects.toThrow('Sprint does not belong to the specified team');
        expect(prisma.sprintReview.create).not.toHaveBeenCalled();
      });

      it('should invalidate the report cache and record an audit entry when a verdict is supplied', async () => {
        vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
          id: 'sprint-1',
          teamId: 'team-id',
          sprintGoal: 'Goal',
        } as never);
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as never);
        vi.mocked(prisma.sprintReview.create).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
        } as never);

        await sprintReviewService.createSprintReview('user-id', {
          sprintId: 'sprint-1',
          teamId: 'team-id',
          reviewDate: new Date(),
          incrementId: 'inc-1',
          sprintGoalOutcome: 'ACHIEVED',
          sprintGoalNote: 'Done',
        });

        expect(auditResourceEvent).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ type: 'SPRINT_REVIEW_GOAL_OUTCOME', id: 'test-uuid' }),
          expect.objectContaining({ teamId: 'team-id', sprintId: 'sprint-1', outcome: 'ACHIEVED' })
        );
      });
    });

    describe('normalizeAttendees', () => {
      it('should derive linked fields from the account and detach an explicit null link', async () => {
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          id: 'linked-user',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@test.com',
        } as never);
        vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' } as never);

        const result = await sprintReviewService.normalizeAttendees(
          'team-id',
          [
            {
              id: 'a-1',
              userId: 'linked-user',
              name: 'Old',
              email: 'old@test.com',
              role: 'stakeholder',
              attended: false,
            },
          ],
          [
            {
              id: 'a-1',
              userId: 'linked-user',
              name: 'ignored',
              role: 'stakeholder',
              attended: true,
            },
            {
              id: 'a-2',
              userId: null,
              name: 'Guest',
              email: 'guest@test.com',
              role: 'stakeholder',
              attended: false,
            },
          ]
        );

        expect(result[0]!.userId).toBe('linked-user');
        expect(result[0]!.name).toBe('Jane Doe');
        expect(result[0]!.role).toBe('developers');
        expect(result[1]!.userId).toBeNull();
      });
    });

    describe('updateSprintReview child sync', () => {
      const mockGetById = () =>
        vi
          .spyOn(sprintReviewService, 'getSprintReviewById')
          .mockResolvedValue({ id: 'review-1' } as never);

      it('should delete attendees omitted from the payload', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          attendees: [
            {
              id: 'a-1',
              userId: null,
              name: 'Jane',
              email: 'j@test.com',
              role: 'developers',
              attended: true,
            },
            {
              id: 'a-2',
              userId: null,
              name: 'Bob',
              email: 'b@test.com',
              role: 'developers',
              attended: false,
            },
          ],
          feedback: [],
          backlogAdjustments: [],
        } as never);
        vi.mocked(prisma.reviewAttendee.update).mockResolvedValue({} as never);
        const getById = mockGetById();

        await sprintReviewService.updateSprintReview('review-1', 'user-id', {
          attendees: [
            { id: 'a-1', name: 'Jane', email: 'j@test.com', role: 'developers', attended: false },
          ],
        });

        expect(prisma.reviewAttendee.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['a-2'] } },
        });
        getById.mockRestore();
      });

      it('should update known feedback, create new feedback and delete omitted feedback', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          attendees: [],
          feedback: [{ id: 'f-1' }, { id: 'f-2' }],
          backlogAdjustments: [],
        } as never);
        vi.mocked(prisma.stakeholderFeedback.update).mockResolvedValue({} as never);
        vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue({} as never);
        const getById = mockGetById();

        await sprintReviewService.updateSprintReview('review-1', 'user-id', {
          feedback: [
            { id: 'f-1', authorName: 'A', content: 'Keep', category: 'positive' },
            { authorName: 'B', content: 'New', category: 'suggestion' },
          ],
        });

        expect(prisma.stakeholderFeedback.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'f-1' } })
        );
        expect(prisma.stakeholderFeedback.create).toHaveBeenCalled();
        expect(prisma.stakeholderFeedback.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['f-2'] } },
        });
        getById.mockRestore();
      });

      it('should delete backlog adjustments omitted from the payload', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          attendees: [],
          feedback: [],
          backlogAdjustments: [{ id: 'adj-1' }, { id: 'adj-2' }],
        } as never);
        vi.mocked(prisma.backlogAdjustment.update).mockResolvedValue({} as never);
        const getById = mockGetById();

        await sprintReviewService.updateSprintReview('review-1', 'user-id', {
          backlogAdjustments: [
            { id: 'adj-1', action: 'add', description: 'Desc', reason: 'Because' },
          ],
        });

        expect(prisma.backlogAdjustment.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['adj-2'] } },
        });
        getById.mockRestore();
      });

      it('should swallow a notification failure for a newly assigned adjustment', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          attendees: [],
          feedback: [],
          backlogAdjustments: [],
        } as never);
        vi.mocked(prisma.backlogAdjustment.create).mockResolvedValue({ id: 'adj-new' } as never);
        mockNotificationCreateLocalized.mockRejectedValueOnce(new Error('notify failed'));
        const getById = mockGetById();

        await sprintReviewService.updateSprintReview('review-1', 'user-id', {
          backlogAdjustments: [
            {
              action: 'add',
              description: 'Desc',
              reason: 'Because',
              ownerId: 'owner-1',
              implemented: false,
            },
          ],
        });

        expect(mockNotificationCreateLocalized).toHaveBeenCalled();
        getById.mockRestore();
      });

      it('should create a new attendee supplied without an id', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          sprintId: 'sprint-1',
          status: 'in_progress',
          attendees: [],
          feedback: [],
          backlogAdjustments: [],
        } as never);
        vi.mocked(prisma.reviewAttendee.create).mockResolvedValue({} as never);
        const getById = mockGetById();

        await sprintReviewService.updateSprintReview('review-1', 'user-id', {
          attendees: [{ name: 'Guest', email: 'g@test.com', role: 'stakeholder', attended: true }],
        });

        expect(prisma.reviewAttendee.create).toHaveBeenCalled();
        getById.mockRestore();
      });
    });

    describe('addStakeholderFeedback notification failure', () => {
      it('should swallow a notification failure for assigned feedback', async () => {
        vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
          id: 'review-1',
          teamId: 'team-id',
          status: 'completed',
        } as never);
        vi.mocked(prisma.stakeholderFeedback.create).mockResolvedValue({
          id: 'f-new',
          category: 'POSITIVE',
        } as never);
        mockNotificationCreateLocalized.mockRejectedValueOnce(new Error('notify failed'));

        const result = await sprintReviewService.addStakeholderFeedback('review-1', 'user-id', {
          authorName: 'Stakeholder',
          content: 'Please fix',
          category: 'positive',
          ownerId: 'owner-1',
          actionRequired: true,
        });

        expect(result.id).toBe('f-new');
      });
    });

    describe('markAdjustmentImplemented', () => {
      it('should return an adjustment that already produced a backlog item', async () => {
        vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue({
          id: 'adj-1',
          createdPbiId: 'pbi-1',
          review: { teamId: 'team-id' },
        } as never);

        const result = await sprintReviewService.markAdjustmentImplemented('adj-1', 'user-id');

        expect(result.createdPbiId).toBe('pbi-1');
        expect(prisma.backlogAdjustment.update).not.toHaveBeenCalled();
      });
    });

    describe('materializeAdjustment', () => {
      it('should throw NotFoundError when the adjustment does not exist', async () => {
        vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(null as never);

        await expect(
          sprintReviewService.materializeAdjustment('missing', 'user-id')
        ).rejects.toThrow(NotFoundError);
        expect(mockCreatePBI).not.toHaveBeenCalled();
      });

      it('should refuse an adjustment that yields no title', async () => {
        vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue({
          id: 'adj-1',
          description: '   ',
          reason: 'Because',
          createdPbiId: null,
          review: { id: 'review-1', teamId: 'team-id' },
        } as never);

        await expect(sprintReviewService.materializeAdjustment('adj-1', 'user-id')).rejects.toThrow(
          'A backlog item needs a title'
        );
        expect(mockCreatePBI).not.toHaveBeenCalled();
      });

      it('should remove the created item when the link cannot be written', async () => {
        vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue({
          id: 'adj-1',
          description: 'Add SSO',
          reason: 'Because',
          createdPbiId: null,
          review: { id: 'review-1', teamId: 'team-id' },
        } as never);
        mockCreatePBI.mockResolvedValue({ id: 'pbi-1' });
        vi.mocked(prisma.backlogAdjustment.update).mockRejectedValue(new Error('link failed'));
        vi.mocked(prisma.productBacklogItem.delete).mockRejectedValue(new Error('cleanup failed'));

        await expect(sprintReviewService.materializeAdjustment('adj-1', 'user-id')).rejects.toThrow(
          'link failed'
        );
        expect(prisma.productBacklogItem.delete).toHaveBeenCalledWith({ where: { id: 'pbi-1' } });
      });
    });

    describe('linkAdjustmentToPbi', () => {
      it('should throw NotFoundError when the adjustment does not exist', async () => {
        vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue(null as never);

        await expect(
          sprintReviewService.linkAdjustmentToPbi('missing', 'pbi-1', 'user-id')
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw NotFoundError when the backlog item does not exist', async () => {
        vi.mocked(prisma.backlogAdjustment.findUnique).mockResolvedValue({
          id: 'adj-1',
          review: { id: 'review-1', teamId: 'team-id' },
        } as never);
        vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as never);

        await expect(
          sprintReviewService.linkAdjustmentToPbi('adj-1', 'pbi-1', 'user-id')
        ).rejects.toThrow(NotFoundError);
        expect(prisma.backlogAdjustment.update).not.toHaveBeenCalled();
      });
    });

    describe('updateAttendee link handling', () => {
      it('should adopt the linked account fields when a userId is supplied', async () => {
        vi.mocked(prisma.reviewAttendee.findUnique).mockResolvedValue({
          id: 'attendee-1',
          userId: null,
          name: 'Old',
          email: null,
          role: 'stakeholder',
          attended: false,
          review: { teamId: 'team-id' },
        } as never);
        vi.mocked(prisma.user.findUnique).mockResolvedValue({
          id: 'linked-user',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@test.com',
        } as never);
        vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' } as never);
        vi.mocked(prisma.reviewAttendee.update).mockResolvedValue({
          id: 'attendee-1',
          userId: 'linked-user',
          name: 'Jane Doe',
          email: 'jane@test.com',
          role: 'developers',
          attended: true,
        } as never);

        const result = await sprintReviewService.updateAttendee('attendee-1', 'user-id', {
          userId: 'linked-user',
          attended: true,
        });

        expect(result.userId).toBe('linked-user');
        expect(result.name).toBe('Jane Doe');
        expect(result.role).toBe('developers');
      });

      it('should detach the account link when userId is null', async () => {
        vi.mocked(prisma.reviewAttendee.findUnique).mockResolvedValue({
          id: 'attendee-1',
          userId: 'linked-user',
          name: 'Jane',
          email: 'jane@test.com',
          role: 'developers',
          attended: true,
          review: { teamId: 'team-id' },
        } as never);
        vi.mocked(prisma.reviewAttendee.update).mockResolvedValue({
          id: 'attendee-1',
          userId: null,
          name: 'Jane',
          email: 'jane@test.com',
          role: 'developers',
          attended: true,
        } as never);

        await sprintReviewService.updateAttendee('attendee-1', 'user-id', { userId: null });

        expect(prisma.reviewAttendee.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ userId: null }) })
        );
      });
    });
  });
});
