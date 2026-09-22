import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useSprintCommitmentReadiness } from './useSprintCommitmentReadiness';
import { definitionService } from '@/services';

vi.mock('@/services', () => ({
  definitionService: {
    getDefinitionOfDone: vi.fn(),
    getDefinitionOfReady: vi.fn(),
    getDoRVerificationsForPBI: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
  setStoreProvider: vi.fn(),
}));

const definitionOfDoneWith = (activeItemCount: number) => ({
  success: true,
  data: {
    id: 'dod-1',
    teamId: 'team-1',
    version: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    items: Array.from({ length: activeItemCount }, (_, index) => ({
      id: `dod-item-${index}`,
      description: `Criterion ${index}`,
      isActive: true,
      order: index,
    })),
  },
});

const definitionOfReadyWith = (activeItemCount: number) => ({
  success: true,
  data: {
    id: 'dor-1',
    teamId: 'team-1',
    version: 1,
    updatedAt: '2024-01-01T00:00:00Z',
    items: Array.from({ length: activeItemCount }, (_, index) => ({
      id: `dor-item-${index}`,
      description: `Criterion ${index}`,
      isActive: true,
      order: index,
    })),
  },
});

describe('useSprintCommitmentReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(definitionService.getDefinitionOfDone).mockResolvedValue(
      definitionOfDoneWith(1) as never
    );
    vi.mocked(definitionService.getDefinitionOfReady).mockResolvedValue(
      definitionOfReadyWith(1) as never
    );
    vi.mocked(definitionService.getDoRVerificationsForPBI).mockResolvedValue({
      success: true,
      data: [{ dorItemId: 'dor-item-0', isVerified: true }],
    } as never);
  });

  it('should report a team that holds both agreements with every item verified', async () => {
    const { result } = renderHook(() => useSprintCommitmentReadiness('team-1', ['pbi-1']));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasDefinitionOfDone).toBe(true);
    expect(result.current.activeReadinessItemCount).toBe(1);
    expect(result.current.unreadyPbiIds).toEqual([]);
  });

  it('should report a missing Definition of Done', async () => {
    vi.mocked(definitionService.getDefinitionOfDone).mockResolvedValue(
      definitionOfDoneWith(0) as never
    );

    const { result } = renderHook(() => useSprintCommitmentReadiness('team-1', ['pbi-1']));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasDefinitionOfDone).toBe(false);
  });

  it('should report the items that still have an unverified criterion', async () => {
    vi.mocked(definitionService.getDefinitionOfReady).mockResolvedValue(
      definitionOfReadyWith(2) as never
    );
    // Only the first of the two active criteria is verified for pbi-2.
    vi.mocked(definitionService.getDoRVerificationsForPBI).mockImplementation(
      async (pbiId: string) =>
        ({
          success: true,
          data: [
            { dorItemId: 'dor-item-0', isVerified: true },
            ...(pbiId === 'pbi-2' ? [] : [{ dorItemId: 'dor-item-1', isVerified: true }]),
          ],
        }) as never
    );

    const { result } = renderHook(() => useSprintCommitmentReadiness('team-1', ['pbi-1', 'pbi-2']));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.unreadyPbiIds).toEqual(['pbi-2']);
  });

  it('should not read verifications when the team has no readiness agreement', async () => {
    vi.mocked(definitionService.getDefinitionOfReady).mockResolvedValue(
      definitionOfReadyWith(0) as never
    );

    const { result } = renderHook(() => useSprintCommitmentReadiness('team-1', ['pbi-1']));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeReadinessItemCount).toBe(0);
    expect(definitionService.getDoRVerificationsForPBI).not.toHaveBeenCalled();
  });

  it('should fail open so a read error never blocks the action the service still gates', async () => {
    vi.mocked(definitionService.getDefinitionOfDone).mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useSprintCommitmentReadiness('team-1', ['pbi-1']));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasDefinitionOfDone).toBe(true);
    expect(result.current.unreadyPbiIds).toEqual([]);
  });

  it('should not read the agreements without a team', async () => {
    const { result } = renderHook(() => useSprintCommitmentReadiness(undefined, ['pbi-1']));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(definitionService.getDefinitionOfDone).not.toHaveBeenCalled();
    expect(definitionService.getDefinitionOfReady).not.toHaveBeenCalled();
  });
});
