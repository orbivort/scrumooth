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
import type {
  JoinTeamGroupInput,
  UpdateSharedDoDInput,
  UpdateTeamGroupInput,
} from '@scrumooth/shared';

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

/**
 * The directory: what a team can join, and which shared Definition of Done version it would adopt.
 *
 * @param enabled set to `false` for a reader who cannot act on it -- a team that already belongs to a
 * group, or a member who does not lead one. The directory is only ever read to choose from.
 */
export const useTeamGroups = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.teamGroup.directory(),
    queryFn: () => teamGroupService.listGroups(),
    enabled,
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
 * Keyed in the `definitionOfDone` family rather than under `teamGroup`, because that is what it is:
 * the same commitment a member team reads as its own. Two families for one row is what let the
 * group's copy and the team's copy cache separately and drift apart.
 *
 * @param enabled set to `false` when the roster read already carried the Definition of Done, so a
 * successful detail read does not pay for a second request for the same fact.
 */
export const useTeamGroupSharedDoD = (groupId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.definitionOfDone.byGroup(groupId),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfDone.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
      // The version in force moved, and every member team reports it: the roster's drift column and
      // the team's own `groupDodVersionAtJoin` comparison both read from the team detail.
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'update the shared Definition of Done' });
    },
  });
};

/**
 * A team adopts a group's shared Definition of Done, naming the version it adopts.
 *
 * The acknowledgement is what makes "mutually define" an act rather than a claim, so the version is
 * part of the mutation's input and not resolved at submit time: a version that moved between the
 * review and the commit is refused by the API (`GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED`)
 * rather than adopted unseen.
 */
export const useJoinTeamGroup = (teamId: string) => {
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  return useMutation({
    mutationFn: (input: JoinTeamGroupInput) => teamGroupService.joinGroup(teamId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfDone.all });
      // The team now complies with another commitment, and that is recorded on the team itself.
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'adopt a sharing team group' });
    },
  });
};

/**
 * A team leaves its group, keeping the Definition of Done it has been complying with.
 *
 * The team's own row is rewritten by the API as part of leaving, so the invalidations here are not
 * cosmetic: a stale read would show the group's commitment as still governing a team that has left.
 */
export const useLeaveTeamGroup = (teamId: string) => {
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  return useMutation({
    mutationFn: () => teamGroupService.leaveGroup(teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfDone.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    },
    onError: (error: unknown) => {
      handleMutationError(error, { operationName: 'leave the sharing team group' });
    },
  });
};
