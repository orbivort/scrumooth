import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    workflow: { findUnique: vi.fn() },
    statusChangeHistory: { findMany: vi.fn() },
    sprintCompletionSnapshot: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    sprintBacklogItem: { findMany: vi.fn() },
  },
}));

import prisma from '../../../utils/prisma';
import {
  averageCompletedPoints,
  captureSprintCompletion,
  resolveSprintCompletions,
  summariseItemCompletion,
  type SprintCompletionInput,
  type SprintCompletionPoint,
} from '../../../services/sprintCompletion';

const DONE_STATE_ID = 'state-done';
const OTHER_STATE_ID = 'state-in-progress';
const NOW = new Date('2026-03-01T00:00:00.000Z');

const sprint = (overrides: Partial<SprintCompletionInput>): SprintCompletionInput => ({
  id: 'sprint-1',
  name: 'Sprint 1',
  status: 'COMPLETED',
  endDate: NOW,
  sprintBacklogItems: [],
  ...overrides,
});

const item = (pbiId: string, storyPoints: number | null, status: string) => ({
  pbiId,
  pbi: { storyPoints, status },
});

/** The point for one Sprint. Fails loudly rather than returning undefined into an assertion. */
const pointFor = (
  resolved: Map<string, SprintCompletionPoint>,
  sprintId = 'sprint-1'
): SprintCompletionPoint => {
  const point = resolved.get(sprintId);
  if (!point) {
    throw new Error(`No completion point was resolved for ${sprintId}`);
  }
  return point;
};

describe('sprintCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([]);
    (prisma.statusChangeHistory.findMany as any).mockResolvedValue([]);
    (prisma.workflow.findUnique as any).mockResolvedValue({
      states: [{ id: DONE_STATE_ID }],
    });
  });

  describe('resolveSprintCompletions', () => {
    it('returns nothing for no Sprints', async () => {
      const resolved = await resolveSprintCompletions([]);

      expect(resolved.size).toBe(0);
      expect(prisma.sprintCompletionSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('reads a closed Sprint from its snapshot, not from the live item statuses', async () => {
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        {
          sprintId: 'sprint-1',
          plannedPoints: 26,
          completedPoints: 21,
          itemCount: 3,
          completedItemCount: 2,
        },
      ]);

      const resolved = await resolveSprintCompletions([
        sprint({
          sprintBacklogItems: [
            // Every item has since been reopened: the snapshot must ignore that entirely.
            item('pbi-1', 13, 'IN_PROGRESS'),
            item('pbi-2', 8, 'READY'),
            item('pbi-3', 5, 'NEW'),
          ],
        }),
      ]);

      expect(pointFor(resolved)).toMatchObject({
        plannedPoints: 26,
        completedPoints: 21,
        itemCount: 3,
        completedItemCount: 2,
        provenance: 'recorded',
      });
      expect(prisma.statusChangeHistory.findMany).not.toHaveBeenCalled();
    });

    it('reconstructs a Sprint that closed before the snapshot existed', async () => {
      (prisma.statusChangeHistory.findMany as any).mockResolvedValue([
        { entityId: 'pbi-1', toStateId: OTHER_STATE_ID, createdAt: new Date('2026-02-01') },
        { entityId: 'pbi-1', toStateId: DONE_STATE_ID, createdAt: new Date('2026-02-10') },
        { entityId: 'pbi-2', toStateId: OTHER_STATE_ID, createdAt: new Date('2026-02-11') },
      ]);

      const resolved = await resolveSprintCompletions([
        sprint({ sprintBacklogItems: [item('pbi-1', 13, 'NEW'), item('pbi-2', 8, 'NEW')] }),
      ]);

      expect(pointFor(resolved)).toMatchObject({
        plannedPoints: 21,
        completedPoints: 13,
        itemCount: 2,
        completedItemCount: 1,
        provenance: 'reconstructed',
      });
    });

    it('counts an item as done at close even when it was reopened afterwards', async () => {
      (prisma.statusChangeHistory.findMany as any).mockResolvedValue([
        { entityId: 'pbi-1', toStateId: DONE_STATE_ID, createdAt: new Date('2026-02-10') },
        // Reopened a month after the Sprint ended: this is after the close and must be ignored.
        { entityId: 'pbi-1', toStateId: OTHER_STATE_ID, createdAt: new Date('2026-04-10') },
      ]);

      const resolved = await resolveSprintCompletions([
        sprint({ sprintBacklogItems: [item('pbi-1', 13, 'IN_PROGRESS')] }),
      ]);

      expect(pointFor(resolved)).toMatchObject({
        completedPoints: 13,
        completedItemCount: 1,
        provenance: 'reconstructed',
      });
    });

    it('reports no observation at all when one item has no surviving evidence', async () => {
      (prisma.statusChangeHistory.findMany as any).mockResolvedValue([
        { entityId: 'pbi-1', toStateId: DONE_STATE_ID, createdAt: new Date('2026-02-10') },
      ]);

      const resolved = await resolveSprintCompletions([
        sprint({ sprintBacklogItems: [item('pbi-1', 13, 'DONE'), item('pbi-2', 8, 'DONE')] }),
      ]);

      // An under-reported total is indistinguishable from a real one, so no total is claimed.
      expect(pointFor(resolved)).toMatchObject({
        plannedPoints: null,
        completedPoints: null,
        itemCount: null,
        completedItemCount: null,
        provenance: 'not_available',
      });
    });

    it('reads the running Sprint live and labels it as in progress', async () => {
      const resolved = await resolveSprintCompletions([
        sprint({
          status: 'ACTIVE',
          sprintBacklogItems: [item('pbi-1', 13, 'DONE'), item('pbi-2', 8, 'IN_PROGRESS')],
        }),
      ]);

      expect(pointFor(resolved)).toMatchObject({
        plannedPoints: 21,
        completedPoints: 13,
        itemCount: 2,
        completedItemCount: 1,
        provenance: 'in_progress',
      });
    });

    it.each(['DRAFT', 'PLANNED', 'CANCELLED'])(
      'reports a %s Sprint as unobserved rather than as zero',
      async (status) => {
        const resolved = await resolveSprintCompletions([
          sprint({ status, sprintBacklogItems: [item('pbi-1', 13, 'DONE')] }),
        ]);

        expect(pointFor(resolved)).toMatchObject({
          plannedPoints: null,
          completedPoints: null,
          provenance: 'not_available',
        });
      }
    );

    it('loads status history once for every Sprint needing reconstruction', async () => {
      await resolveSprintCompletions([
        sprint({ id: 'sprint-1', sprintBacklogItems: [item('pbi-1', 5, 'DONE')] }),
        sprint({ id: 'sprint-2', sprintBacklogItems: [item('pbi-2', 3, 'DONE')] }),
      ]);

      expect(prisma.statusChangeHistory.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.statusChangeHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: 'BacklogItem',
            entityId: { in: ['pbi-1', 'pbi-2'] },
          }),
        })
      );
    });
  });

  describe('averageCompletedPoints', () => {
    it('averages only the points that were observed', () => {
      expect(
        averageCompletedPoints([
          { completedPoints: 10, provenance: 'recorded' },
          { completedPoints: null, provenance: 'not_available' },
          { completedPoints: 20, provenance: 'reconstructed' },
        ] as never)
      ).toBe(15);
    });

    it('is null rather than zero when nothing was observed', () => {
      expect(averageCompletedPoints([{ completedPoints: null } as never])).toBeNull();
      expect(averageCompletedPoints([])).toBeNull();
    });
  });

  describe('summariseItemCompletion', () => {
    it('sums item counts across observed Sprints', () => {
      expect(
        summariseItemCompletion([
          { itemCount: 4, completedItemCount: 3 },
          { itemCount: 2, completedItemCount: 2 },
        ] as never)
      ).toEqual({ totalItems: 6, completedItems: 5, rate: 83 });
    });

    it('has no rate when no Sprint could be observed', () => {
      expect(
        summariseItemCompletion([{ itemCount: null, completedItemCount: null } as never])
      ).toEqual({ totalItems: 0, completedItems: 0, rate: null });
    });
  });

  describe('captureSprintCompletion', () => {
    const tx = () => ({
      sprintCompletionSnapshot: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      sprintBacklogItem: {
        findMany: vi.fn().mockResolvedValue([
          { pbiId: 'pbi-1', pbi: { storyPoints: 13, status: 'DONE' } },
          { pbiId: 'pbi-2', pbi: { storyPoints: 8, status: 'IN_PROGRESS' } },
          { pbiId: 'pbi-3', pbi: { storyPoints: null, status: 'DONE' } },
        ]),
      },
    });

    it('freezes the Sprint Backlog and its delivered points', async () => {
      const client = tx();

      await captureSprintCompletion(client as never, {
        sprintId: 'sprint-1',
        teamId: 'team-1',
        userId: 'user-1',
      });

      expect(client.sprintCompletionSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sprintId: 'sprint-1',
          teamId: 'team-1',
          plannedPoints: 21,
          completedPoints: 13,
          itemCount: 3,
          completedItemCount: 2,
          capturedBy: 'user-1',
          items: [
            { pbiId: 'pbi-1', storyPoints: 13, completed: true },
            { pbiId: 'pbi-2', storyPoints: 8, completed: false },
            { pbiId: 'pbi-3', storyPoints: null, completed: true },
          ],
        }),
      });
    });

    it('leaves an existing snapshot untouched', async () => {
      const client = tx();
      client.sprintCompletionSnapshot.findUnique.mockResolvedValue({ id: 'snapshot-1' });

      await captureSprintCompletion(client as never, { sprintId: 'sprint-1', teamId: 'team-1' });

      expect(client.sprintBacklogItem.findMany).not.toHaveBeenCalled();
      expect(client.sprintCompletionSnapshot.create).not.toHaveBeenCalled();
    });
  });
});
