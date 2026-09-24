import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedDefinitionOfDone, TeamGroupDetail, TeamGroupSummary } from '@scrumooth/shared';

import { teamGroupService } from '../services';

import { queryKeys } from './queryKeys';
import {
  useCreateTeamGroup,
  useDeleteTeamGroup,
  useTeamGroupDetail,
  useTeamGroupSharedDoD,
  useTeamGroups,
  useUpdateSharedDoD,
  useUpdateTeamGroup,
} from './useTeamGroups';

vi.mock('../services', () => ({
  teamGroupService: {
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    updateSharedDefinitionOfDone: vi.fn(),
  },
}));

const GROUP: TeamGroupSummary = {
  id: 'group-1',
  name: 'Payments product',
  description: 'Two teams, one product.',
  teamCount: 2,
  dodVersion: 3,
};

const SHARED_DOD: SharedDefinitionOfDone = {
  groupId: 'group-1',
  version: 3,
  updatedAt: '2026-09-10T10:00:00.000Z',
  items: [
    {
      id: 'item-1',
      description: 'Code is peer-reviewed',
      category: 'review',
      isActive: true,
      order: 0,
    },
  ],
};

const DETAIL: TeamGroupDetail = {
  ...GROUP,
  teams: [
    {
      id: 'team-1',
      name: 'Platform team',
      joinedAt: '2026-08-15T09:00:00.000Z',
      adoptedDodVersion: 2,
    },
  ],
  definitionOfDone: SHARED_DOD,
};

/** An axios-shaped refusal, so the surface can branch on the gate code the API sends. */
const gateRefusal = (code: string) => ({
  isAxiosError: true,
  response: {
    status: 403,
    data: { success: false, error: { code, message: 'The roster is not yours to read.' } },
  },
});

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

const createWrapper = (queryClient = createClient()) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

describe('useTeamGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(teamGroupService.listGroups).mockResolvedValue({ success: true, data: [GROUP] });
    vi.mocked(teamGroupService.getGroup).mockResolvedValue({ success: true, data: DETAIL });
    vi.mocked(teamGroupService.getSharedDefinitionOfDone).mockResolvedValue({
      success: true,
      data: SHARED_DOD,
    });
    vi.mocked(teamGroupService.createGroup).mockResolvedValue({ success: true, data: DETAIL });
    vi.mocked(teamGroupService.updateGroup).mockResolvedValue({ success: true, data: DETAIL });
    vi.mocked(teamGroupService.deleteGroup).mockResolvedValue({
      success: true,
      data: { message: 'Team group removed successfully' },
    });
    vi.mocked(teamGroupService.updateSharedDefinitionOfDone).mockResolvedValue({
      success: true,
      data: SHARED_DOD,
    });
  });

  describe('useTeamGroups', () => {
    it('should read the directory a team chooses from', async () => {
      const { result } = renderHook(() => useTeamGroups(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual([GROUP]);
    });
  });

  describe('useTeamGroupDetail', () => {
    it('should read the group with its roster and its commitment', async () => {
      const { result } = renderHook(() => useTeamGroupDetail(GROUP.id), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data?.teams).toEqual(DETAIL.teams);
      expect(result.current.data?.data?.definitionOfDone).toEqual(SHARED_DOD);
    });

    it('should not read the roster until a group is selected', () => {
      renderHook(() => useTeamGroupDetail(''), { wrapper: createWrapper() });

      expect(teamGroupService.getGroup).not.toHaveBeenCalled();
    });

    it('should not retry a refusal, because being refused is a state and not a failure', async () => {
      vi.mocked(teamGroupService.getGroup).mockRejectedValue(
        gateRefusal('GATE_TEAM_GROUP_MEMBERS_ONLY')
      );

      const { result } = renderHook(() => useTeamGroupDetail(GROUP.id), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(teamGroupService.getGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('useTeamGroupSharedDoD', () => {
    it('should read the commitment when asked to', async () => {
      const { result } = renderHook(() => useTeamGroupSharedDoD(GROUP.id), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.data).toEqual(SHARED_DOD);
    });

    it('should stay idle when the roster read already carried the commitment', () => {
      renderHook(() => useTeamGroupSharedDoD(GROUP.id, false), { wrapper: createWrapper() });

      expect(teamGroupService.getSharedDefinitionOfDone).not.toHaveBeenCalled();
    });
  });

  describe('mutations', () => {
    it('should create a group and refresh the directory', async () => {
      const queryClient = createClient();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useCreateTeamGroup(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({ name: 'Payments product', description: 'Two teams.' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(teamGroupService.createGroup).toHaveBeenCalledWith({
        name: 'Payments product',
        description: 'Two teams.',
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.teamGroup.all });
    });

    it('should rename a group through the group it belongs to', async () => {
      const { result } = renderHook(() => useUpdateTeamGroup(), { wrapper: createWrapper() });

      result.current.mutate({ groupId: GROUP.id, data: { name: 'Payments' } });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(teamGroupService.updateGroup).toHaveBeenCalledWith(GROUP.id, { name: 'Payments' });
    });

    it('should remove a group by id', async () => {
      const { result } = renderHook(() => useDeleteTeamGroup(), { wrapper: createWrapper() });

      result.current.mutate(GROUP.id);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(teamGroupService.deleteGroup).toHaveBeenCalledWith(GROUP.id);
    });

    it('should refresh every team Definition of Done as well as the group when the shared one changes', async () => {
      const queryClient = createClient();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const { result } = renderHook(() => useUpdateSharedDoD(), {
        wrapper: createWrapper(queryClient),
      });

      const items = [
        { description: 'Code is peer-reviewed', category: 'review', isActive: true, order: 0 },
      ];
      result.current.mutate({ groupId: GROUP.id, data: { items } });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(teamGroupService.updateSharedDefinitionOfDone).toHaveBeenCalledWith(GROUP.id, {
        items,
      });

      // A grouped team's own read resolves to this row, so leaving it cached would let the editor
      // and the commitment disagree about the same Definition of Done.
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.teamGroup.all });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.definitionOfDone.all });
    });

    it('should surface a refusal through the error the caller sees', async () => {
      vi.mocked(teamGroupService.deleteGroup).mockRejectedValue(
        gateRefusal('GATE_TEAM_GROUP_NOT_EMPTY')
      );

      const { result } = renderHook(() => useDeleteTeamGroup(), { wrapper: createWrapper() });

      result.current.mutate(GROUP.id);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });
});
