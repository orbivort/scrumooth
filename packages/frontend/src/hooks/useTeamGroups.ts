// Team group data layer: the groups the Scrum Teams on one product share, the single Definition of
// Done they comply with, and the mutations that manage both.
//
// The reads are split deliberately, because the API's two read paths have different audiences.
// Reading a group's roster requires membership of one of its teams, but the shared Definition of
// Done is readable by any authenticated caller -- a team cannot "mutually define" a commitment it is
// not allowed to read before agreeing to it. A role held in some other team is not a role here, so
// permission is resolved by the API rather than inferred from the caller's global role; these hooks
// therefore expose the refusal as an ordinary error and let the surface decide what it can show.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateSharedDoDInput, UpdateTeamGroupInput } from '@scrumooth/shared';

import { teamGroupService } from '../services';

import { queryKeys } from './queryKeys';
import { useMutationErrorHandler } from './useMutationErrorHandler';

/**
 * Reads here are point reads of agreements that change a handful of times per product, so a
 * five-minute cache removes the refetch without ever showing a version that has moved on for long.
 */
const GROUP_READ_STALE_TIME = 5 * 60 * 1000;

export interface GroupFormInput {
  name: string;
  description?: string | null;
}

/** The directory: what a team can join, and which shared Definition of Done version it would adopt. */
export const useTeamGroups = () =>
  useQuery({
    queryKey: queryKeys.teamGroup.directory(),
    queryFn: () => teamGroupService.listGroups(),
    staleTime: GROUP_READ_STALE_TIME,
  });

/**
 * One group, with its roster and the shared Definition of Done it owns.
 *
 * `retry: false` is part of the contract rather than a preference: a caller who leads none of the
 * group's teams is refused with `403 GATE_TEAM_GROUP_MEMBERS_ONLY`, which is a normal state the
 * surface degrades from -- it still reads the commitment -- and not a transient failure to retry.
 */
export const useTeamGroupDetail = (groupId: string) =>
  useQuery({
    queryKey: queryKeys.teamGroup.detail(groupId),
    queryFn: () => teamGroupService.getGroup(groupId),
    enabled: !!groupId,
    retry: false,
    staleTime: GROUP_READ_STALE_TIME,
  });

/**
 * The shared Definition of Done a group owns.
 *
 * Readable before joining, and readable when the roster is not. That openness is what makes
 * "mutually define" an act rather than a claim, so this is also the read the surface falls back to
 * when it may not see who is in the group.
 *
 * @param enabled set to `false` when the roster read already carried the Definition of Done, so a
 * successful detail read does not pay for a second request for the same fact.
 */
export const useTeamGroupSharedDoD = (groupId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.teamGroup.sharedDoD(groupId),
    queryFn: () => teamGroupService.getSharedDefinitionOfDone(groupId),
    enabled: !!groupId && enabled,
    staleTime: GROUP_READ_STALE_TIME,
  });

/**
 * Create a group. The API creates it together with the Definition of Done it will own, so
 * "adopt the shared Definition of Done" is never a promise about nothing.
 */
export const useCreateTeamGroup = () => {
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  return useMutation({
    mutationFn: (data: GroupFormInput) => teamGroupService.createGroup(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'create group' });
    },
  });
};

/** Rename a group or change what it is for. */
export const useUpdateTeamGroup = () => {
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateTeamGroupInput }) =>
      teamGroupService.updateGroup(groupId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'update group' });
    },
  });
};

/**
 * Remove a group, which the API refuses with `409 GATE_TEAM_GROUP_NOT_EMPTY` while any team still
 * complies with its Definition of Done: removing it would take the commitment away from them rather
 * than move them to another one.
 */
export const useDeleteTeamGroup = () => {
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  return useMutation({
    mutationFn: (groupId: string) => teamGroupService.deleteGroup(groupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'delete group' });
    },
  });
};

/**
 * Replace the Definition of Done every team in the group complies with.
 *
 * This is the write the Guide's "mutually define" points at: one change, made where every team that
 * shares the commitment can see it. It therefore invalidates the member teams' own Definition of
 * Done reads as well as the group's -- for a grouped team that read resolves to this very row, so
 * leaving it cached would let the editor and the commitment disagree.
 */
export const useUpdateSharedDoD = () => {
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  return useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateSharedDoDInput }) =>
      teamGroupService.updateSharedDefinitionOfDone(groupId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfDone.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'update the shared Definition of Done' });
    },
  });
};
