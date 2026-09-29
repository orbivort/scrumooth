import { DOD_DEFAULTS } from '@scrumooth/shared';
import type {
  SharedDefinitionOfDone,
  SharedDoDItem,
  TeamGroupDetail,
  TeamGroupMember,
  TeamGroupSummary,
} from '@scrumooth/shared';

import { fixtureId } from '../support/ids';

import { isoInstant } from './clock';
import { TEAM_SEEDS, teamId, type TeamKey } from './personas';

/**
 * The group the two demo teams work in, and the Definition of Done it owns.
 *
 * Both products ship into one platform, so the two Scrum Teams work together on
 * it and the Guide's rule applies: *"they must mutually define and comply with
 * the same Definition of Done."* The group holds that one commitment, each team
 * records the version it adopted, and the group's own criteria come from the
 * product's built-in defaults so they stay translatable.
 *
 * The seed ships one group. A second, empty group would suggest the interface's
 * "create a group" path has history it does not have.
 */

/** A group as the store keeps it: the directory entry plus its shared agreement. */
export type TeamGroupFixture = TeamGroupDetail;

interface GroupSeed {
  key: string;
  name: string;
  description: string;
  dodVersion: number;
  /** The teams that already adopted the group's Definition of Done. */
  members: readonly { teamKey: TeamKey; joinedDaysAgo: number; adoptedVersion: number }[];
  /** A criterion the group wrote for itself, on top of the built-in defaults. */
  authoredCriterion: { key: string; description: string; category: string };
  /** How long ago the shared Definition of Done was last changed, in days. */
  dodChangedDaysAgo: number;
}

const GROUP_SEEDS: readonly GroupSeed[] = [
  {
    key: 'rail-platform',
    name: 'North-South Rail Platform',
    description:
      'Both product teams ship into the same rail platform, so they define one Definition of Done for it and both comply with it.',
    dodVersion: 2,
    members: [
      { teamKey: 'cindra', joinedDaysAgo: 88, adoptedVersion: 2 },
      { teamKey: 'pell', joinedDaysAgo: 74, adoptedVersion: 2 },
    ],
    authoredCriterion: {
      key: 'platformContractTested',
      description: 'The change has been exercised against the neighbouring product’s interface',
      category: 'integration',
    },
    dodChangedDaysAgo: 26,
  },
];

function sharedItems(seed: GroupSeed): SharedDoDItem[] {
  const seeded: SharedDoDItem[] = DOD_DEFAULTS.map((item, index) => ({
    id: fixtureId('shared-dod-item', `${seed.key}:${item.key}`),
    description: item.description,
    category: item.category ?? null,
    isActive: true,
    order: index,
    defaultKey: item.key,
  }));

  const authored: SharedDoDItem = {
    id: fixtureId('shared-dod-item', `${seed.key}:${seed.authoredCriterion.key}`),
    description: seed.authoredCriterion.description,
    category: seed.authoredCriterion.category,
    isActive: true,
    order: seeded.length,
    defaultKey: null,
  };

  return [...seeded, authored];
}

function sharedDefinition(seed: GroupSeed, groupId: string): SharedDefinitionOfDone {
  return {
    groupId,
    version: seed.dodVersion,
    items: sharedItems(seed),
    updatedAt: isoInstant(-seed.dodChangedDaysAgo, 11, 0),
  };
}

export const TEAM_GROUPS: readonly TeamGroupFixture[] = GROUP_SEEDS.map((seed) => {
  const id = fixtureId('team-group', seed.key);
  const definitionOfDone = sharedDefinition(seed, id);
  const teams: TeamGroupMember[] = seed.members.map((member) => ({
    id: teamId(member.teamKey),
    // The team's name comes from the team seed, so a rename happens in one place.
    name: TEAM_SEEDS.find((team) => team.key === member.teamKey)?.name ?? '',
    joinedAt: isoInstant(-member.joinedDaysAgo, 10, 0),
    adoptedDodVersion: member.adoptedVersion,
  }));

  const summary: TeamGroupSummary = {
    id,
    name: seed.name,
    description: seed.description,
    teamCount: teams.length,
    dodVersion: definitionOfDone.version,
  };

  return { ...summary, teams, definitionOfDone };
});
