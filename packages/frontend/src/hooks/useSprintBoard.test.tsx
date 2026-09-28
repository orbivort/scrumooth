import { renderHook, waitFor, act, initTestI18n, AllProviders } from '../test-utils';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

import { useSprintBoard } from './useSprintBoard';
import { apiService } from '../services';
import type { Sprint, Task, ProductBacklogItem } from '../types';

vi.mock('../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    completeSprint: vi.fn(),
  },
}));

const createMockTask = (
  id: string,
  status: Task['status'],
  estimatedHours = 4,
  remainingHours = 4
): Task => ({
  id,
  title: `Task ${id}`,
  description: `Description for Task ${id}`,
  status,
  estimatedHours,
  remainingHours,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const createMockPbi = (
  id: string,
  status: ProductBacklogItem['status'],
  storyPoints = 5
): ProductBacklogItem => ({
  id,
  title: `PBI ${id}`,
  description: `Description for PBI ${id}`,
  status,
  storyPoints,
  priority: 'MUST_HAVE',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const createMockSprint = (
  id: string,
  startDate: string,
  endDate: string,
  tasks: Task[] = [],
  items: ProductBacklogItem[] = []
): Sprint => ({
  id,
  name: `Sprint ${id}`,
  startDate,
  endDate,
  status: 'ACTIVE',
  tasks,
  items,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

describe('useSprintBoard', () => {
  const mockTeamId = 'team-1';

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('data fetching', () => {
    it('should not fetch when teamId is null', () => {
      renderHook(() => useSprintBoard({ teamId: null }), { wrapper: AllProviders });

      expect(apiService.getActiveSprint).not.toHaveBeenCalled();
    });

    it('should fetch active sprint when teamId is provided', async () => {
      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14');

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      renderHook(() => useSprintBoard({ teamId: mockTeamId }), { wrapper: AllProviders });

      await waitFor(() => {
        expect(apiService.getActiveSprint).toHaveBeenCalledWith(mockTeamId);
      });
    });

    it('should return loading state correctly', async () => {
      vi.mocked(apiService.getActiveSprint).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should return error state correctly', async () => {
      vi.mocked(apiService.getActiveSprint).mockRejectedValue(new Error('Failed to fetch'));

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toBeDefined();
      });
    });

    it('should return null sprint when no active sprint', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprint).toBeNull();
      });
    });
  });

  describe('sprint duration calculation', () => {
    it('should calculate sprint duration correctly', async () => {
      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14');

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintDuration).toBe(13);
      });
    });

    it('should return 0 duration when no sprint', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintDuration).toBe(0);
      });
    });
  });

  describe('days remaining calculation', () => {
    it('should calculate days remaining correctly', async () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 5);

      const mockSprint = createMockSprint(
        'sprint-1',
        today.toISOString().split('T')[0],
        futureDate.toISOString().split('T')[0]
      );

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.daysRemaining).toBeGreaterThanOrEqual(4);
        expect(result.current.daysRemaining).toBeLessThanOrEqual(6);
      });
    });

    it('should return 0 when sprint has ended', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const mockSprint = createMockSprint(
        'sprint-1',
        new Date(pastDate.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        pastDate.toISOString().split('T')[0]
      );

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.daysRemaining).toBe(0);
      });
    });

    it('should return 0 when no sprint', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.daysRemaining).toBe(0);
      });
    });
  });

  describe('sprint statistics', () => {
    it('should calculate task statistics correctly', async () => {
      const tasks = [
        createMockTask('1', 'TODO'),
        createMockTask('2', 'TODO'),
        createMockTask('3', 'IN_PROGRESS'),
        createMockTask('4', 'REVIEW'),
        createMockTask('5', 'DONE'),
        createMockTask('6', 'DONE'),
      ];

      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14', tasks);

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintStats.totalTasks).toBe(6);
        expect(result.current.sprintStats.todoTasks).toBe(2);
        expect(result.current.sprintStats.inProgressTasks).toBe(1);
        expect(result.current.sprintStats.reviewTasks).toBe(1);
        expect(result.current.sprintStats.doneTasks).toBe(2);
      });
    });

    it('should calculate PBI statistics correctly', async () => {
      const items = [
        createMockPbi('1', 'TODO', 5),
        createMockPbi('2', 'IN_PROGRESS', 8),
        createMockPbi('3', 'DONE', 5),
        createMockPbi('4', 'DONE', 3),
      ];

      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14', [], items);

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintStats.totalPbis).toBe(4);
        expect(result.current.sprintStats.completedPbis).toBe(2);
        expect(result.current.sprintStats.totalStoryPoints).toBe(21);
        expect(result.current.sprintStats.completedStoryPoints).toBe(8);
      });
    });

    it('should calculate hours statistics correctly', async () => {
      const tasks = [
        createMockTask('1', 'TODO', 4, 4),
        createMockTask('2', 'IN_PROGRESS', 8, 5),
        createMockTask('3', 'DONE', 4, 0),
      ];

      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14', tasks);

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintStats.totalEstimatedHours).toBe(16);
      });

      const remainingHours = result.current.sprintStats.totalRemainingHours;
      expect(remainingHours).toBeGreaterThanOrEqual(9);
      expect(remainingHours).toBeLessThanOrEqual(13);
    });

    it('should calculate progress percentage correctly', async () => {
      const items = [
        createMockPbi('1', 'DONE', 5),
        createMockPbi('2', 'DONE', 5),
        createMockPbi('3', 'TODO', 10),
      ];

      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14', [], items);

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintStats.progressPercentage).toBe(50);
      });
    });

    it('should return zero statistics when no sprint', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprintStats).toEqual({
          totalTasks: 0,
          todoTasks: 0,
          inProgressTasks: 0,
          reviewTasks: 0,
          doneTasks: 0,
          totalPbis: 0,
          completedPbis: 0,
          totalStoryPoints: 0,
          completedStoryPoints: 0,
          totalEstimatedHours: 0,
          totalRemainingHours: 0,
          progressPercentage: 0,
        });
      });
    });
  });

  describe('completeSprint', () => {
    it('should complete sprint successfully', async () => {
      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14');

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      vi.mocked(apiService.completeSprint).mockResolvedValue({
        success: true,
        data: undefined,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprint).not.toBeNull();
      });

      act(() => {
        result.current.completeSprint();
      });

      await waitFor(() => {
        expect(apiService.completeSprint).toHaveBeenCalledWith('sprint-1');
      });
    });

    it('should throw error when no active sprint', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprint).toBeNull();
      });

      act(() => {
        result.current.completeSprint();
      });

      await waitFor(() => {
        expect(result.current.completeSprintError).not.toBeNull();
      });
    });

    it('should track completing state', async () => {
      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14');

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      vi.mocked(apiService.completeSprint).mockResolvedValue({
        success: true,
        data: undefined,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprint).not.toBeNull();
      });

      expect(result.current.isCompleting).toBe(false);

      act(() => {
        result.current.completeSprint();
      });

      await waitFor(() => {
        expect(result.current.isCompleting).toBe(false);
      });
    });

    it('should reset complete sprint error', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprint).toBeNull();
      });

      act(() => {
        result.current.completeSprint();
      });

      await waitFor(() => {
        expect(result.current.completeSprintError).not.toBeNull();
      });

      act(() => {
        result.current.resetCompleteSprintError();
      });

      await waitFor(() => {
        expect(result.current.completeSprintError).toBeNull();
      });
    });
  });

  describe('optional field fallbacks (branch coverage)', () => {
    it('handles PBIs without story points and tasks without hour estimates', async () => {
      const items = [
        { ...createMockPbi('1', 'DONE'), storyPoints: undefined },
        { ...createMockPbi('2', 'IN_PROGRESS'), storyPoints: undefined },
      ];
      const tasks = [
        { ...createMockTask('1', 'TODO'), estimatedHours: 4, remainingHours: undefined },
        { ...createMockTask('2', 'TODO'), estimatedHours: undefined, remainingHours: undefined },
      ];
      const mockSprint = createMockSprint('sprint-1', '2024-01-01', '2024-01-14', tasks, items);

      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      const { result } = renderHook(() => useSprintBoard({ teamId: mockTeamId }), {
        wrapper: AllProviders,
      });

      await waitFor(() => {
        expect(result.current.sprint).not.toBeNull();
      });

      // Missing story points fall back to 0 → progress percentage takes the `else` branch.
      expect(result.current.sprintStats.totalStoryPoints).toBe(0);
      expect(result.current.sprintStats.completedStoryPoints).toBe(0);
      expect(result.current.sprintStats.progressPercentage).toBe(0);
      // Missing remainingHours falls back to estimatedHours, then to 0.
      expect(result.current.sprintStats.totalEstimatedHours).toBe(4);
      expect(result.current.sprintStats.totalRemainingHours).toBe(4);
    });
  });
});
