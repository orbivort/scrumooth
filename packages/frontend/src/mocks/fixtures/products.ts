import type { ProductGoal } from '../../types';
import { fixtureId } from '../support/ids';

import { isoDate, isoInstant } from './clock';
import { teamId, type TeamKey } from './personas';

/**
 * The Product Goals each team is working towards.
 *
 * A Product Goal is the Product Backlog's long-term objective, so every item in
 * `backlog.ts` is ordered under one of these. Each team gets exactly one active
 * goal — the state the Product Goals screen treats as the team's current
 * commitment — plus a completed one to read as history and a new one to show
 * what is queued behind it.
 *
 * Status is upper case because that is what the API returns: the backend stores
 * the Prisma enum (`NEW`, `ACTIVE`, `COMPLETED`, `ABANDONED`) and serialises it
 * unchanged.
 */

interface GoalSeed {
  teamKey: TeamKey;
  key: string;
  title: string;
  description: string;
  status: 'NEW' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  /** Days from today, for the goals that carry a target date. */
  targetInDays?: number;
  successMetrics?: string;
  strategicAlignment?: string;
  /** How long ago the goal was set, in days. */
  setDaysAgo: number;
}

const GOAL_SEEDS: readonly GoalSeed[] = [
  {
    teamKey: 'cindra',
    key: 'northern-transit',
    title: 'Cut northern corridor transit time by a fifth',
    description:
      'Scheduled freight on the northern corridor averages 41 hours door to door. The goal is to bring the plan the dispatchers see down to 33 hours without adding a single train.',
    status: 'ACTIVE',
    targetInDays: 84,
    successMetrics:
      'Median planned transit time at or below 33 hours, measured weekly from the dispatcher plan; no increase in missed cut-offs at the northern depots.',
    strategicAlignment: 'delivery',
    setDaysAgo: 47,
  },
  {
    teamKey: 'cindra',
    key: 'dispatch-audit',
    title: 'Pass the dispatcher safety audit with no findings',
    description:
      'The corridor operations review audited how dispatchers override the plan under pressure. Every override now has to be recorded with its reason.',
    status: 'COMPLETED',
    targetInDays: -21,
    successMetrics:
      'Zero findings in the corridor operations review; override reasons recorded on 100% of audited shifts.',
    strategicAlignment: 'compliance',
    setDaysAgo: 168,
  },
  {
    teamKey: 'cindra',
    key: 'depot-self-service',
    title: 'Let northern depots schedule their own slots',
    description:
      'Depot planners currently phone the control room to change a slot. The next goal is to let them move their own slots inside the corridor rules.',
    status: 'NEW',
    successMetrics:
      'Depot planners change at least half of their slots without contacting the control room.',
    strategicAlignment: 'customer',
    setDaysAgo: 12,
  },
  {
    teamKey: 'pell',
    key: 'depot-capacity-model',
    title: 'Plan depot capacity a week ahead instead of a day',
    description:
      'Pell plans depot loading one day at a time, which is why a single late train cascades. The goal is a capacity view that holds up seven days out.',
    status: 'ACTIVE',
    targetInDays: 70,
    successMetrics:
      'A published seven-day capacity plan with a forecast error under 8% of actual loads, reviewed weekly with the depot supervisors.',
    strategicAlignment: 'delivery',
    setDaysAgo: 38,
  },
  {
    teamKey: 'pell',
    key: 'capacity-migration',
    title: 'Move the southern depots off the legacy planner',
    description:
      'The southern region planned capacity in a spreadsheet that only two people understood. All six depots now work from the shared model.',
    status: 'COMPLETED',
    targetInDays: -14,
    successMetrics:
      'All six southern depots planning from the shared model; the legacy spreadsheet is retired.',
    strategicAlignment: 'delivery',
    setDaysAgo: 149,
  },
  {
    teamKey: 'pell',
    key: 'regional-inputs',
    title: 'Take depot input figures straight from the regions',
    description:
      'Regional depots send their quarterly figures as attachments. The goal is to let them enter the figures where the model can read them directly.',
    status: 'NEW',
    successMetrics: 'Every quarterly figure arrives through the model rather than by attachment.',
    strategicAlignment: 'customer',
    setDaysAgo: 9,
  },
];

export const PRODUCT_GOALS: readonly ProductGoal[] = GOAL_SEEDS.map((seed) => ({
  id: goalId(seed.teamKey, seed.key),
  teamId: teamId(seed.teamKey),
  title: seed.title,
  description: seed.description,
  status: seed.status,
  targetDate: seed.targetInDays === undefined ? undefined : isoDate(seed.targetInDays),
  successMetrics: seed.successMetrics,
  strategicAlignment: seed.strategicAlignment,
  createdAt: isoInstant(-seed.setDaysAgo, 9, 15),
  updatedAt: isoInstant(-seed.setDaysAgo, 9, 15),
}));

/** The id of a goal, so other fixtures can order items under it. */
export function goalId(teamKey: TeamKey, key: string): string {
  return fixtureId('goal', `${teamKey}:${key}`);
}

/** The goal a team is currently committed to, which is where new items are ordered. */
export function activeGoalOf(teamId: string): ProductGoal | undefined {
  return PRODUCT_GOALS.find((goal) => goal.teamId === teamId && goal.status === 'ACTIVE');
}
