// Mock implementation of the team group service, used when VITE_USE_MOCK_API !== 'false'.
//
// It mirrors the real rules rather than only the shapes: a group owns one Definition of Done, a
// join is refused while the team already complies with one, and the version adopted is recorded.
// A demo that let the interface do things the API refuses would teach the wrong model of the rule.
import type {
  JoinTeamGroupInput,
  SharedDefinitionOfDone,
  TeamGroupDetail,
  TeamGroupSummary,
  UpdateSharedDoDInput,
  UpdateTeamGroupInput,
} from '@scrumooth/shared';

import type { ApiResponse } from '../types';

import { mockDelay } from './mockResponseUtils';

/** What the demo knows about the teams the mock API works with. */
const DEMO_TEAM_ID = 'team-1';

const sharedDoDTemplate = (): SharedDefinitionOfDone => ({
  groupId: 'group-1',
  version: 2,
  updatedAt: '2026-09-10T10:00:00.000Z',
  items: [
    {
      id: 'shared-item-1',
      description: 'Code is peer-reviewed and approved',
      category: 'review',
      isActive: true,
      order: 0,
    },
    {
      id: 'shared-item-2',
      description: 'Integration tests passing',
      category: 'testing',
      isActive: true,
      order: 1,
    },
    {
      id: 'shared-item-3',
      description: 'Deployed to staging and demonstrated',
      category: 'delivery',
      isActive: true,
      order: 2,
    },
  ],
});

/** One demo group, as the mock holds it. */
interface MockGroup {
  id: string;
  name: string;
  description: string | null;
  dod: SharedDefinitionOfDone;
  teams: Array<{ id: string; name: string; joinedAt: string; adopted: number }>;
}

/** Mutable demo state, so a join or a shared-DoD change is visible on the next read. */
const state: {
  groups: MockGroup[];
  membership: { teamId: string; groupId: string | null; adopted: number | null };
} = {
  groups: [
    {
      id: 'group-1',
      name: 'Payments product',
      description: 'Two teams, one product, one Definition of Done.',
      dod: sharedDoDTemplate(),
      teams: [
        { id: 'team-2', name: 'Platform team', joinedAt: '2026-08-15T09:00:00.000Z', adopted: 1 },
      ],
    },
    {
      id: 'group-2',
      name: 'Onboarding product',
      description: 'One team so far, with a Definition of Done ready to adopt.',
      dod: { ...sharedDoDTemplate(), groupId: 'group-2', version: 1 },
      teams: [],
    },
  ],
  /** The group the demo team complies with, and the version it adopted. */
  membership: {
    teamId: DEMO_TEAM_ID,
    groupId: null,
    adopted: null,
  },
};

const summarize = (groupId: string): TeamGroupSummary => {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    throw new Error('Team group not found');
  }

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    teamCount: group.teams.length,
    dodVersion: group.dod.version,
  };
};

const detail = (groupId: string): TeamGroupDetail => {
  const group = state.groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    throw new Error('Team group not found');
  }

  return {
    ...summarize(groupId),
    teams: group.teams.map((team) => ({
      id: team.id,
      name: team.name,
      joinedAt: team.joinedAt,
      adoptedDodVersion: team.adopted,
    })),
    definitionOfDone: group.dod,
  };
};

export class MockTeamGroupService {
  async listGroups(): Promise<ApiResponse<TeamGroupSummary[]>> {
    await mockDelay();
    return { success: true, data: state.groups.map((group) => summarize(group.id)) };
  }

  async getGroup(groupId: string): Promise<ApiResponse<TeamGroupDetail>> {
    await mockDelay();
    return { success: true, data: detail(groupId) };
  }

  async createGroup(payload: {
    name: string;
    description?: string | null;
  }): Promise<ApiResponse<TeamGroupDetail>> {
    await mockDelay();
    const id = `group-${state.groups.length + 1}`;
    state.groups.push({
      id,
      name: payload.name,
      description: payload.description ?? null,
      dod: { ...sharedDoDTemplate(), groupId: id, version: 1 },
      teams: [],
    });

    return { success: true, data: detail(id) };
  }

  async updateGroup(
    groupId: string,
    payload: UpdateTeamGroupInput
  ): Promise<ApiResponse<TeamGroupDetail>> {
    await mockDelay();
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team group not found' } };
    }

    if (payload.name !== undefined) {
      group.name = payload.name;
    }
    if (payload.description !== undefined) {
      group.description = payload.description;
    }

    return { success: true, data: detail(groupId) };
  }

  async deleteGroup(groupId: string): Promise<ApiResponse<{ message: string }>> {
    await mockDelay();
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (group && group.teams.length > 0) {
      return {
        success: false,
        error: {
          code: 'GATE_TEAM_GROUP_NOT_EMPTY',
          message: 'This group still has teams complying with its Definition of Done.',
        },
      };
    }

    state.groups = state.groups.filter((candidate) => candidate.id !== groupId);
    return { success: true, data: { message: 'Team group removed successfully' } };
  }

  async getSharedDefinitionOfDone(groupId: string): Promise<ApiResponse<SharedDefinitionOfDone>> {
    await mockDelay();
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team group not found' } };
    }

    return { success: true, data: group.dod };
  }

  async updateSharedDefinitionOfDone(
    groupId: string,
    payload: UpdateSharedDoDInput
  ): Promise<ApiResponse<SharedDefinitionOfDone>> {
    await mockDelay();
    const group = state.groups.find((candidate) => candidate.id === groupId);
    if (!group) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team group not found' } };
    }

    group.dod = {
      groupId,
      version: group.dod.version + 1,
      updatedAt: new Date().toISOString(),
      items: payload.items.map((item, index) => ({
        id: item.id ?? `shared-item-${index + 1}`,
        description: item.description,
        category: item.category ?? null,
        isActive: item.isActive,
        order: index,
      })),
    };

    return { success: true, data: group.dod };
  }

  async joinGroup(
    teamId: string,
    payload: JoinTeamGroupInput
  ): Promise<ApiResponse<TeamGroupSummary>> {
    await mockDelay();
    const group = state.groups.find((candidate) => candidate.id === payload.groupId);
    if (!group) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team group not found' } };
    }

    if (state.membership.groupId) {
      return {
        success: false,
        error: {
          code: 'GATE_TEAM_GROUP_ALREADY_MEMBER',
          message: 'This team already works with a group on one product.',
        },
      };
    }

    if (payload.acknowledgedDodVersion !== group.dod.version) {
      return {
        success: false,
        error: {
          code: 'GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED',
          message: `Name the version you are adopting — the group's current version is ${group.dod.version}.`,
        },
      };
    }

    state.membership = { teamId, groupId: group.id, adopted: group.dod.version };
    group.teams.push({
      id: teamId,
      name: 'Demo team',
      joinedAt: new Date().toISOString(),
      adopted: group.dod.version,
    });

    return { success: true, data: summarize(group.id) };
  }

  async leaveGroup(teamId: string): Promise<ApiResponse<{ message: string }>> {
    await mockDelay();
    if (!state.membership.groupId) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'This team does not work in a group.' },
      };
    }

    const group = state.groups.find((candidate) => candidate.id === state.membership.groupId);
    if (group) {
      group.teams = group.teams.filter((team) => team.id !== teamId);
    }

    state.membership = { teamId, groupId: null, adopted: null };

    return { success: true, data: { message: 'Team left the group successfully' } };
  }
}

export const mockTeamGroupService = new MockTeamGroupService();
