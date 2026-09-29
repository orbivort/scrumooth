import { DOD_DEFAULTS, DOR_DEFAULTS } from '@scrumooth/shared';

import type { DefinitionOfDone, DefinitionOfReady, DoDItem, DoRItem } from '../../types';
import { fixtureId } from '../support/ids';

import { isoInstant } from './clock';
import { TEAM_SEEDS, type TeamKey } from './personas';
import { seededHolderOf } from './teams';

/**
 * The two teams' Definitions of Done and Ready.
 *
 * The seeded criteria come from the product's own defaults
 * (`@scrumooth/shared` `definitionDefaults`), keys included, rather than being
 * re-typed here: a criterion's `defaultKey` is what lets the interface render it
 * in the visitor's language, so hand-written copies would silently lose their
 * translations. Each team then adds one criterion of its own, which is the case
 * the interface has to show as team-authored rather than built-in.
 */

/** A criterion this team wrote itself: no `defaultKey`, so it renders as written. */
interface AuthoredCriterion {
  key: string;
  description: string;
  category: string;
}

const AUTHORED_DOD: Record<TeamKey, AuthoredCriterion[]> = {
  cindra: [
    {
      key: 'depotHandoff',
      description: 'The hand-off script has been rehearsed with the receiving depot',
      category: 'quality',
    },
  ],
  pell: [
    {
      key: 'capacityModelReviewed',
      description: "The capacity model is checked against the previous week's actuals",
      category: 'quality',
    },
  ],
};

const AUTHORED_DOR: Record<TeamKey, AuthoredCriterion[]> = {
  cindra: [
    {
      key: 'corridorAgreed',
      description: 'The corridor and its cut-off times are agreed with the depot planners',
      category: 'context',
    },
  ],
  pell: [
    {
      key: 'regionalInputs',
      description: 'The regional depots have supplied their input figures for the quarter',
      category: 'context',
    },
  ],
};

function dodItems(teamKey: TeamKey): DoDItem[] {
  const seeded: DoDItem[] = DOD_DEFAULTS.map((item, index) => ({
    id: fixtureId('dod-item', `${teamKey}:${item.key}`),
    description: item.description,
    category: item.category ?? undefined,
    isActive: true,
    order: index,
    defaultKey: item.key,
  }));

  const authored: DoDItem[] = AUTHORED_DOD[teamKey].map((item, index) => ({
    id: fixtureId('dod-item', `${teamKey}:${item.key}`),
    description: item.description,
    category: item.category,
    isActive: true,
    order: seeded.length + index,
    defaultKey: null,
  }));

  return [...seeded, ...authored];
}

function dorItems(teamKey: TeamKey): DoRItem[] {
  const seeded: DoRItem[] = DOR_DEFAULTS.map((item, index) => ({
    id: fixtureId('dor-item', `${teamKey}:${item.key}`),
    description: item.description,
    category: item.category ?? undefined,
    isActive: true,
    order: index,
    defaultKey: item.key,
  }));

  const authored: DoRItem[] = AUTHORED_DOR[teamKey].map((item, index) => ({
    id: fixtureId('dor-item', `${teamKey}:${item.key}`),
    description: item.description,
    category: item.category,
    isActive: true,
    order: seeded.length + index,
    defaultKey: null,
  }));

  return [...seeded, ...authored];
}

export const DEFINITIONS_OF_DONE: readonly DefinitionOfDone[] = TEAM_SEEDS.map((team) => ({
  id: fixtureId('dod', team.id),
  teamId: team.id,
  items: dodItems(team.key),
  version: 2,
  updatedBy: seededHolderOf(team.id, 'SCRUM_MASTER'),
  updatedAt: isoInstant(-9, 10, 30),
}));

export const DEFINITIONS_OF_READY: readonly DefinitionOfReady[] = TEAM_SEEDS.map((team) => ({
  id: fixtureId('dor', team.id),
  teamId: team.id,
  items: dorItems(team.key),
  version: 1,
  updatedBy: seededHolderOf(team.id, 'SCRUM_MASTER'),
  updatedAt: isoInstant(-9, 10, 45),
}));

export function seededDefinitionOfDone(teamId: string): DefinitionOfDone | undefined {
  return DEFINITIONS_OF_DONE.find((definition) => definition.teamId === teamId);
}

export function seededDefinitionOfReady(teamId: string): DefinitionOfReady | undefined {
  return DEFINITIONS_OF_READY.find((definition) => definition.teamId === teamId);
}
