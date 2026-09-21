import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    dailyScrum: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dailyScrumBacklogItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    dailyScrumParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    dailyScrumSchedule: {
      findUnique: vi.fn(),
    },
    teamNonWorkingDay: {
      findMany: vi.fn(),
    },
    sprintBacklogItem: {
      findMany: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    impediment: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        dailyScrum: {
          update: vi.fn(),
        },
        dailyScrumBacklogItem: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        impediment: {
          create: vi.fn(),
        },
      })
    ),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// t/i18n mock used by sendTeamSignal and by the localized gate refusals
vi.mock('../../../i18n/requestT.js', () => ({
  t: vi.fn((key: string, params?: Record<string, unknown>) => {
    if (key === 'notifications:dailyScrumSignalTitle') return 'Daily Scrum starting';
    if (key === 'notifications:dailyScrumSignalMessage') {
      return `The Daily Scrum for "${params?.sprintName}" is starting.`;
    }
    if (key === 'notifications:remindersNone') return 'No team members';
    if (key === 'notifications:remindersSent') return 'Signal sent to 1 member';
    return key;
  }),
}));

// notificationService.createLocalized is used by sendTeamSignal to persist each
// signal with canonical i18n keys so the frontend can re-translate at display time.
vi.mock('../../../services/notification.service', () => ({
  notificationService: {
    createLocalized: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  },
}));

import { dailyScrumService } from '../../../services/dailyScrum.service';
import { notificationService } from '../../../services/notification.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, ConflictError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { UserRole, NotificationType } from '../../../generated/prisma/client';

const baseInclude = {
  participants: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  backlogAdjustments: {
    include: {
      pbi: { select: { id: true, title: true, status: true, updatedAt: true } },
      sprintBacklogItem: {
        select: {
          id: true,
          pbiId: true,
          updatedAt: true,
          pbi: { select: { id: true, title: true, status: true, updatedAt: true } },
        },
      },
    },
  },
};

const mockScrum = {
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: new Date('2026-08-23'),
  progressNotes: 'On track toward the goal',
  adaptationsNotes: 'Will adjust backlog item X',
  planForNextDay: 'Pair up on Y',
  participants: [],
  backlogAdjustments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** A Sprint Backlog item as `resolveAdjustmentSnapshots` reads it. */
const mockSprintBacklogItem = {
  id: 'item-1',
  updatedAt: new Date('2026-08-23T08:00:00.000Z'),
  pbi: {
    id: 'pbi-1',
    title: 'Checkout flow',
    status: 'READY',
    updatedAt: new Date('2026-08-23T08:00:00.000Z'),
  },
};

/** A stored adjustment as Prisma returns it, projection included. */
const rawAdjustment = (overrides: Record<string, unknown> = {}) => ({
  id: 'adj-1',
  sprintBacklogItemId: 'item-1',
  pbiId: 'pbi-1',
  pbiTitleAtAdjustment: 'Checkout flow',
  actionType: 'REFINED',
  action: 'Split into two slices',
  pbiStatusAtAdjustment: 'READY',
  itemUpdatedAtAtAdjustment: new Date('2026-08-23T08:00:00.000Z'),
  pbiUpdatedAtAtAdjustment: new Date('2026-08-23T08:00:00.000Z'),
  createdAt: new Date('2026-08-23T09:00:00.000Z'),
  updatedAt: new Date('2026-08-23T09:00:00.000Z'),
  pbi: {
    id: 'pbi-1',
    title: 'Checkout flow',
    status: 'READY',
    updatedAt: new Date('2026-08-23T08:00:00.000Z'),
  },
  sprintBacklogItem: {
    id: 'item-1',
    pbiId: 'pbi-1',
    updatedAt: new Date('2026-08-23T08:00:00.000Z'),
    pbi: {
      id: 'pbi-1',
      title: 'Checkout flow',
      status: 'READY',
      updatedAt: new Date('2026-08-23T08:00:00.000Z'),
    },
  },
  ...overrides,
});

describe('DailyScrumService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default role guard setup: the acting user is a Developer on the sprint's team.
    (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sprint-1',
      teamId: 'team-1',
      sprintGoal: 'Protect the checkout flow',
    });
    (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: UserRole.DEVELOPERS,
    });
    (prisma.sprintBacklogItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      mockSprintBacklogItem,
    ]);
    // No standing schedule and no exceptions unless a test says otherwise.
    (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.teamNonWorkingDay.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  describe('getDailyScrum', () => {
    it('returns the team-level Daily Scrum for a sprint and date', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      const result = await dailyScrumService.getDailyScrum('sprint-1');

      expect(prisma.dailyScrum.findUnique).toHaveBeenCalledWith({
        where: { sprintId_scrumDate: { sprintId: 'sprint-1', scrumDate: expect.any(Date) } },
        include: baseInclude,
      });
      expect(result).toEqual(mockScrum);
    });

    it('parses the requested date', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await dailyScrumService.getDailyScrum('sprint-1', '2026-08-20');

      expect(prisma.dailyScrum.findUnique).toHaveBeenCalledWith({
        where: {
          sprintId_scrumDate: {
            sprintId: 'sprint-1',
            scrumDate: new Date(2026, 7, 20),
          },
        },
        include: baseInclude,
      });
    });
  });

  describe('createDailyScrum', () => {
    it('throws ConflictError if a Daily Scrum already exists for the sprint today', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          progressNotes: 'Progress',
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('honors a client-supplied scrumDate when creating for a specific date', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        scrumDate: '2026-08-20',
        planForNextDay: 'Plan',
        noAdaptationNeeded: true,
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scrumDate: new Date(2026, 7, 20) }),
        })
      );
    });

    it('throws ConflictError if a Daily Scrum already exists for the requested date', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          scrumDate: '2026-08-20',
          planForNextDay: 'Plan',
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('creates a team-level Daily Scrum with participant and backlog adjustments', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        backlogAdjustments: [rawAdjustment()],
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        progressNotes: 'Progress',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REFINED', action: 'reassigned' },
        ],
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalled();
      expect(result.backlogAdjustments).toHaveLength(1);
      expect(result.backlogAdjustments[0]?.actionType).toBe('REFINED');
    });

    it('persists the Developer-chosen focus mode on the record', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        focusMode: 'impediment',
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        focusMode: 'impediment',
        noAdaptationNeeded: true,
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ focusMode: 'impediment' }),
        })
      );
      expect(result.focusMode).toBe('impediment');
    });

    it('throws NotFoundError if the sprint does not exist', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          noAdaptationNeeded: true,
        })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('Sprint Goal snapshot (Scrum Guide: inspect progress toward the Sprint Goal)', () => {
    beforeEach(() => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
    });

    it('records the Sprint Goal in force when the record is created', async () => {
      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        noAdaptationNeeded: true,
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sprintGoal: 'Protect the checkout flow' }),
        })
      );
    });

    it('records a null goal when the Sprint has none rather than inventing one', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        sprintGoal: null,
      });

      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        noAdaptationNeeded: true,
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sprintGoal: null }),
        })
      );
    });

    it('ignores a goal supplied by the caller, so the inspected baseline cannot be forged', async () => {
      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        noAdaptationNeeded: true,
        sprintGoal: 'A goal this Sprint never had',
      } as never);

      const createArgs = (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as { data: Record<string, unknown> };
      expect(createArgs.data.sprintGoal).toBe('Protect the checkout flow');
    });

    it('never rewrites the snapshot on update, even when the Sprint Goal changes', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        sprintGoal: 'The goal as inspected',
        noAdaptationNeeded: false,
        backlogAdjustments: [{ id: 'adj-1' }],
      });
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        sprintGoal: 'A renegotiated goal',
      });

      const txUpdate = vi.fn().mockResolvedValue(mockScrum);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ dailyScrum: { update: txUpdate } })
      );
      (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await dailyScrumService.updateDailyScrum('scrum-1', 'user-1', {
        planForNextDay: 'Revised plan',
      });

      const updateArgs = txUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(updateArgs.data).not.toHaveProperty('sprintGoal');
    });
  });

  describe('adaptation evidence (Scrum Guide: adapt the Sprint Backlog)', () => {
    beforeEach(() => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
    });

    it('refuses a record that declares neither an adjustment nor a decision that none was needed', async () => {
      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          planForNextDay: 'Plan',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED,
      });
      expect(prisma.dailyScrum.create).not.toHaveBeenCalled();
    });

    it('accepts an explicit acknowledgement that no adaptation was needed', async () => {
      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        noAdaptationNeeded: true,
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ noAdaptationNeeded: true }),
        })
      );
    });

    it('refuses a record that claims no adaptation while listing adjustments', async () => {
      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          planForNextDay: 'Plan',
          noAdaptationNeeded: true,
          backlogAdjustments: [
            { sprintBacklogItemId: 'item-1', actionType: 'REFINED', action: 'Split it' },
          ],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('allows a plan-only edit to a record that already carries evidence', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        noAdaptationNeeded: false,
        backlogAdjustments: [{ id: 'adj-1' }],
      });
      const txUpdate = vi.fn().mockResolvedValue(mockScrum);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ dailyScrum: { update: txUpdate } })
      );

      await expect(
        dailyScrumService.updateDailyScrum('scrum-1', 'user-1', { planForNextDay: 'New plan' })
      ).resolves.toBeDefined();
    });

    it('refuses an edit that would leave the record with no evidence at all', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        noAdaptationNeeded: false,
        backlogAdjustments: [],
      });

      await expect(
        dailyScrumService.updateDailyScrum('scrum-1', 'user-1', { planForNextDay: 'New plan' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED,
      });
    });

    it('lets a record switch from adjustments to an acknowledgement in one edit', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        noAdaptationNeeded: false,
        backlogAdjustments: [{ id: 'adj-1' }],
      });
      const txUpdate = vi.fn().mockResolvedValue(mockScrum);
      const txDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            dailyScrum: { update: txUpdate },
            dailyScrumBacklogItem: { deleteMany: txDeleteMany, createMany: vi.fn() },
          })
      );

      await dailyScrumService.updateDailyScrum('scrum-1', 'user-1', {
        planForNextDay: 'New plan',
        noAdaptationNeeded: true,
        backlogAdjustments: [],
      });

      expect(txDeleteMany).toHaveBeenCalledWith({ where: { dailyScrumId: 'scrum-1' } });
      const updateArgs = txUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
      expect(updateArgs.data.noAdaptationNeeded).toBe(true);
    });
  });

  describe('adjustment snapshots and reflection verdicts', () => {
    beforeEach(() => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    });

    it('records the typed action and the state the declaration will be judged against', async () => {
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        backlogAdjustments: [rawAdjustment({ actionType: 'REMOVED' })],
      });

      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        backlogAdjustments: [
          {
            sprintBacklogItemId: 'item-1',
            actionType: 'REMOVED',
            action: 'Cut to protect the goal',
          },
        ],
      });

      const createArgs = (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as {
        data: { backlogAdjustments: { create: Array<Record<string, unknown>> } };
      };
      expect(createArgs.data.backlogAdjustments.create[0]).toMatchObject({
        sprintBacklogItemId: 'item-1',
        pbiId: 'pbi-1',
        pbiTitleAtAdjustment: 'Checkout flow',
        actionType: 'REMOVED',
        pbiStatusAtAdjustment: 'READY',
        itemUpdatedAtAtAdjustment: mockSprintBacklogItem.updatedAt,
        pbiUpdatedAtAtAdjustment: mockSprintBacklogItem.pbi.updatedAt,
      });
    });

    it('resolves every declaration in one batched query', async () => {
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REFINED', action: 'Split it' },
        ],
      });

      expect(prisma.sprintBacklogItem.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.sprintBacklogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['item-1'] }, sprintId: 'sprint-1' } })
      );
    });

    it('refuses a declaration naming an item that is not in the Sprint Backlog', async () => {
      (prisma.sprintBacklogItem.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          planForNextDay: 'Plan',
          backlogAdjustments: [
            { sprintBacklogItemId: 'other-sprint-item', actionType: 'REFINED', action: 'Split it' },
          ],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.dailyScrum.create).not.toHaveBeenCalled();
    });

    it('reports a fulfilled removal as reflected', async () => {
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        backlogAdjustments: [
          rawAdjustment({
            actionType: 'REMOVED',
            sprintBacklogItemId: null,
            sprintBacklogItem: null,
          }),
        ],
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REMOVED', action: 'Cut it' },
        ],
      });

      expect(result.backlogAdjustments[0]).toMatchObject({
        reflection: 'REFLECTED',
        reflectionBasis: 'ITEM_REMOVED',
      });
    });

    it('reports a removal that has not happened yet as pending', async () => {
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        backlogAdjustments: [rawAdjustment({ actionType: 'REMOVED' })],
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REMOVED', action: 'Cut it' },
        ],
      });

      expect(result.backlogAdjustments[0]).toMatchObject({
        reflection: 'PENDING_REFLECTION',
        reflectionBasis: 'NO_CHANGE_OBSERVED',
      });
    });

    it('reports a refinement as reflected once the Sprint Backlog item has moved', async () => {
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        backlogAdjustments: [
          rawAdjustment({
            sprintBacklogItem: {
              ...rawAdjustment().sprintBacklogItem,
              updatedAt: new Date('2026-08-23T12:00:00.000Z'),
            },
          }),
        ],
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REFINED', action: 'Split it' },
        ],
      });

      expect(result.backlogAdjustments[0]).toMatchObject({
        reflection: 'REFLECTED',
        reflectionBasis: 'ITEM_UPDATED',
      });
    });

    it('keeps the declaration readable after the item it describes is gone', async () => {
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        backlogAdjustments: [
          rawAdjustment({
            actionType: 'REMOVED',
            sprintBacklogItemId: null,
            sprintBacklogItem: null,
            pbiId: 'pbi-1',
            pbiTitleAtAdjustment: 'Checkout flow',
          }),
        ],
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REMOVED', action: 'Cut it' },
        ],
      });

      expect(result.backlogAdjustments[0]).toMatchObject({
        sprintBacklogItemId: null,
        pbiId: 'pbi-1',
        pbiTitleAtAdjustment: 'Checkout flow',
      });
    });
  });

  describe('Developers-only access (Scrum Guide)', () => {
    it('throws a 403 gate refusal when a non-Developer tries to create the Daily Scrum', async () => {
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        role: UserRole.PRODUCT_OWNER,
      });

      await expect(
        dailyScrumService.createDailyScrum('po-user', {
          sprintId: 'sprint-1',
          noAdaptationNeeded: true,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });

    it('throws a 403 gate refusal when a non-Developer tries to update the Daily Scrum', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        role: UserRole.SCRUM_MASTER,
      });

      await expect(
        dailyScrumService.updateDailyScrum('scrum-1', 'sm-user', { planForNextDay: 'Plan' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });

    it('throws a 403 gate refusal when a non-Developer tries to record participation', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        dailyScrumService.recordParticipation('scrum-1', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });

    it('throws a 403 gate refusal when a non-Developer tries to promote an impediment', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        sprint: { id: 'sprint-1', teamId: 'team-1' },
      });
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        role: UserRole.PRODUCT_OWNER,
      });

      await expect(
        dailyScrumService.promoteToImpediment('scrum-1', 'po-user', {
          title: 'Blocked',
          description: 'Blocked on access',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });
  });

  describe('updateDailyScrum', () => {
    it('replaces backlog adjustments and auto-joins the editor as a participant', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.dailyScrum.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.dailyScrumBacklogItem.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });
      (prisma.dailyScrumBacklogItem.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      const txUpdate = vi.fn().mockResolvedValue(mockScrum);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (
          callback: (tx: {
            dailyScrum: { update: typeof txUpdate };
            dailyScrumBacklogItem: {
              deleteMany: ReturnType<typeof vi.fn>;
              createMany: ReturnType<typeof vi.fn>;
            };
          }) => Promise<unknown>
        ) =>
          callback({
            dailyScrum: { update: txUpdate },
            dailyScrumBacklogItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          })
      );

      const result = await dailyScrumService.updateDailyScrum('scrum-1', 'user-1', {
        planForNextDay: 'New plan',
        backlogAdjustments: [
          { sprintBacklogItemId: 'item-1', actionType: 'REPRIORITIZED', action: 'flagged' },
        ],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            participants: {
              connectOrCreate: {
                where: { dailyScrumId_userId: { dailyScrumId: 'scrum-1', userId: 'user-1' } },
                create: expect.objectContaining({ userId: 'user-1' }),
              },
            },
          }),
        })
      );
      expect(result).toEqual(mockScrum);
    });

    it('throws NotFoundError if the Daily Scrum does not exist', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        dailyScrumService.updateDailyScrum('scrum-1', 'user-1', { planForNextDay: 'Plan' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('getCadence', () => {
    // A two-week Sprint, Monday 2026-09-07 through Friday 2026-09-18.
    const sprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      startDate: new Date('2026-09-07T00:00:00.000Z'),
      endDate: new Date('2026-09-18T00:00:00.000Z'),
    };

    beforeEach(() => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(sprint);
      (prisma.dailyScrum.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { scrumDate: new Date('2026-09-07T00:00:00.000Z') },
        { scrumDate: new Date('2026-09-08T00:00:00.000Z') },
      ]);
    });

    it('counts the Sprint on the team calendar rather than assuming five days a week', async () => {
      const cadence = await dailyScrumService.getCadence('sprint-1', '2026-09-09');

      expect(cadence.expected).toBe(10);
      expect(cadence.held).toBe(2);
      expect(cadence.isWorkingDay).toBe(true);
      expect(cadence.sprintProgress).toEqual({ dayNumber: 3, totalDays: 10 });
      expect(cadence.schedule).toBeNull();
    });

    it('excludes a recorded non-working day from what the Sprint expected', async () => {
      (prisma.teamNonWorkingDay.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'nwd-1',
          teamId: 'team-1',
          date: new Date('2026-09-09T00:00:00.000Z'),
          name: 'Company day',
        },
      ]);

      const cadence = await dailyScrumService.getCadence('sprint-1', '2026-09-09');

      expect(cadence.expected).toBe(9);
      expect(cadence.isWorkingDay).toBe(false);
      expect(cadence.nonWorkingDayName).toBe('Company day');
      // The day number holds steady across the holiday rather than skipping a day.
      expect(cadence.sprintProgress).toEqual({ dayNumber: 2, totalDays: 9 });
    });

    it('reports the expected working days that carry no record', async () => {
      const cadence = await dailyScrumService.getCadence('sprint-1', '2026-09-09');

      expect(cadence.missedDates).toEqual([
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
        '2026-09-14',
        '2026-09-15',
        '2026-09-16',
        '2026-09-17',
        '2026-09-18',
      ]);
      expect(cadence.missedDates).not.toContain('2026-09-07');
    });

    it('publishes the standing commitment alongside the counts', async () => {
      (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'schedule-1',
        teamId: 'team-1',
        timezone: 'Europe/Berlin',
        startMinute: 570,
        location: 'Room 4',
        locationUrl: null,
        workingDays: [1, 2, 3, 4, 5],
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-02T10:00:00.000Z'),
      });

      const cadence = await dailyScrumService.getCadence('sprint-1', '2026-09-09');

      expect(cadence.schedule).toMatchObject({
        timezone: 'Europe/Berlin',
        startMinute: 570,
        location: 'Room 4',
        workingDays: [1, 2, 3, 4, 5],
        createdAt: '2026-08-01T10:00:00.000Z',
      });
    });

    it('honours a team that does not work every weekday', async () => {
      (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'schedule-1',
        teamId: 'team-1',
        timezone: 'UTC',
        startMinute: 540,
        location: null,
        locationUrl: 'https://meet.example.com/daily',
        workingDays: [1, 2, 3, 4],
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-01T10:00:00.000Z'),
      });

      const cadence = await dailyScrumService.getCadence('sprint-1', '2026-09-11');

      // Fridays are no longer working days, so the fortnight holds eight.
      expect(cadence.expected).toBe(8);
      expect(cadence.isWorkingDay).toBe(false);
    });

    it('throws NotFoundError if the sprint does not exist', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(dailyScrumService.getCadence('sprint-1')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('recordParticipation', () => {
    it('adds the user as a participant once', async () => {
      (prisma.dailyScrumParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrumParticipant.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'p-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      const result = await dailyScrumService.recordParticipation('scrum-1', 'user-1');

      expect(prisma.dailyScrumParticipant.create).toHaveBeenCalled();
      expect(result).toEqual(mockScrum);
    });
  });

  describe('getParticipation', () => {
    it('only lists Developers as not yet joined (Daily Scrum is Developers-only)', async () => {
      const members = [
        {
          userId: 'dev-1',
          role: UserRole.DEVELOPERS,
          user: { id: 'dev-1', firstName: 'Dev', lastName: 'One' },
        },
        {
          userId: 'dev-2',
          role: UserRole.DEVELOPERS,
          user: { id: 'dev-2', firstName: 'Dev', lastName: 'Two' },
        },
        {
          userId: 'po-1',
          role: UserRole.PRODUCT_OWNER,
          user: { id: 'po-1', firstName: 'Prod', lastName: 'Owner' },
        },
        {
          userId: 'sm-1',
          role: UserRole.SCRUM_MASTER,
          user: { id: 'sm-1', firstName: 'Scrum', lastName: 'Master' },
        },
      ];
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        team: { members },
      });
      // dev-1 already joined; dev-2 has not; PO and SM are excluded entirely.
      const devOne = members[0]!;
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        participants: [{ id: 'p-1', userId: 'dev-1', user: devOne.user }],
      });

      const result = await dailyScrumService.getParticipation('sprint-1', '2026-08-23');

      expect(result.nonParticipants).toEqual([{ userId: 'dev-2', userName: 'Dev Two' }]);
      expect(result.participants).toHaveLength(1);
    });
  });

  describe('sendTeamSignal', () => {
    it('sends a signal only to Developers who have not yet joined', async () => {
      // Team has two Developers, one Product Owner, one Scrum Master.
      const members = [
        { userId: 'dev-1', role: UserRole.DEVELOPERS, user: { id: 'dev-1' } },
        { userId: 'dev-2', role: UserRole.DEVELOPERS, user: { id: 'dev-2' } },
        { userId: 'po-1', role: UserRole.PRODUCT_OWNER, user: { id: 'po-1' } },
        { userId: 'sm-1', role: UserRole.SCRUM_MASTER, user: { id: 'sm-1' } },
      ];
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        teamId: 'team-1',
        team: { members },
      });
      // dev-1 already joined; dev-2 has not. PO/SM are excluded entirely.
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        participants: [{ id: 'p-1', userId: 'dev-1', user: { id: 'dev-1' } }],
      });

      const result = await dailyScrumService.sendTeamSignal('sprint-1', 'user-1');

      expect(notificationService.createLocalized).toHaveBeenCalledTimes(1);
      expect(notificationService.createLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'dev-2',
          type: NotificationType.DAILY_SCRUM_SIGNAL,
          titleKey: 'dailyScrumSignalTitle',
          messageKey: 'dailyScrumSignalMessage',
          messageParams: { sprintName: 'Sprint 1' },
        })
      );
      expect(result.sentCount).toBe(1);
    });

    it('throws NotFoundError if the sprint does not exist', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(dailyScrumService.sendTeamSignal('sprint-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('promoteToImpediment', () => {
    it('creates an impediment from a Daily Scrum, deriving team from the record', async () => {
      // Both the initial lookup (with sprint relation) and the post-create
      // read via getDailyScrumById return a scrum that belongs to a sprint.
      const scrumWithSprint = {
        ...mockScrum,
        sprint: { id: 'sprint-1', teamId: 'team-1' },
      };
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(scrumWithSprint);
      const mockImpediment = {
        id: 'imp-1',
        title: 'API access',
        description: 'Blocked',
        reportedBy: { id: 'user-1' },
        owner: null,
        sprint: { id: 'sprint-1', name: 'Sprint 1' },
      };
      const createMock = vi.fn().mockResolvedValue(mockImpediment);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            impediment: { create: createMock },
          })
      );

      const result = await dailyScrumService.promoteToImpediment('scrum-1', 'user-1', {
        title: 'API access',
        description: 'Blocked on API access',
      });

      // The team must be derived from the Daily Scrum's sprint, not the request body.
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamId: 'team-1', sprintId: 'sprint-1' }),
        })
      );
      expect(result.impediment).toEqual(mockImpediment);
    });
  });
});
