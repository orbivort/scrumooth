import { ItemStatus, MoSCoWPriority, ValueEffortLevel, type ProductBacklogItem } from '../../types';
import { fixtureId } from '../support/ids';

import { isoInstant } from './clock';
import { teamId, type TeamKey } from './personas';
import { activeGoalOf } from './products';
import { seededHolderOf } from './teams';

/**
 * The Product Backlog of both teams.
 *
 * Items are declared team by team, in the order the team has them: `rank` is
 * assigned from the position in the list, so the array *is* the ordering — the
 * one thing the Product Owner owns outright. Items the teams took into a Sprint
 * are referenced by key from `sprints.ts` rather than being duplicated here.
 */

interface BacklogSeed {
  key: string;
  title: string;
  description: string;
  priority: MoSCoWPriority;
  status: ItemStatus;
  storyPoints: number;
  businessValue: number;
  effort: ValueEffortLevel;
  labels: string[];
  acceptanceCriteria: string;
  /** How long ago the item was written, in days. */
  createdDaysAgo: number;
}

const CINDRA_BACKLOG: readonly BacklogSeed[] = [
  {
    key: 'depot-cutoff-warnings',
    title: 'Warn dispatchers before a depot cut-off is missed',
    description:
      'A missed cut-off costs the corridor a whole slot. Dispatchers should hear about a slipping plan while there is still time to re-route the load.',
    priority: MoSCoWPriority.MUST_HAVE,
    // The item Team Cindra has finished so far in its Active Sprint, so the Sprint
    // has a Done item for its open Increment to be composed from.
    status: ItemStatus.DONE,
    storyPoints: 8,
    businessValue: 90,
    effort: ValueEffortLevel.HIGH,
    labels: ['corridor', 'alerts'],
    acceptanceCriteria:
      '- A warning appears while the plan can still be changed\n- The warning names the depot and the cut-off time\n- Warnings clear themselves once the plan recovers',
    createdDaysAgo: 61,
  },
  {
    key: 'corridor-replan',
    title: 'Re-plan a corridor in one pass when a train runs late',
    description:
      'Dispatchers currently re-plan corridor by corridor and lose the interaction between them. One pass keeps the corridors consistent.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.READY,
    storyPoints: 13,
    businessValue: 100,
    effort: ValueEffortLevel.HIGH,
    labels: ['corridor', 'planning'],
    acceptanceCriteria:
      '- A single action re-plans every affected corridor\n- Two dispatchers re-planning at once do not overwrite each other\n- The re-plan is reversible for the rest of the shift',
    createdDaysAgo: 54,
  },
  {
    key: 'plan-history',
    title: 'Keep a readable history of every plan change',
    description:
      'When a plan is questioned after the fact, the control room needs to show what changed and who changed it.',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.REFINED,
    storyPoints: 5,
    businessValue: 60,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['audit'],
    acceptanceCriteria:
      '- Every change names the dispatcher and the time\n- The history can be filtered to one corridor\n- Nothing in the history is editable',
    createdDaysAgo: 44,
  },
  {
    key: 'dispatcher-override-log',
    title: 'Record why a dispatcher overrode the plan',
    description:
      'The safety review asked for the reason behind an override, not just the fact of it.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.DONE,
    storyPoints: 3,
    businessValue: 70,
    effort: ValueEffortLevel.LOW,
    labels: ['audit', 'safety'],
    acceptanceCriteria:
      '- An override cannot be saved without a reason\n- Reasons are selectable, with a free-text fallback\n- The reason is visible in the shift report',
    createdDaysAgo: 96,
  },
  {
    key: 'slot-hold',
    title: 'Hold a depot slot while the plan is recalculated',
    description:
      'Between a re-plan starting and finishing, another dispatcher can take the slot being freed.',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.REFINED,
    storyPoints: 5,
    businessValue: 55,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['corridor'],
    acceptanceCriteria:
      '- A slot under recalculation is visibly held\n- The hold expires if the dispatcher walks away\n- A held slot cannot be taken by a second dispatcher',
    createdDaysAgo: 31,
  },
  {
    key: 'weekend-rules',
    title: 'Apply weekend cut-off rules automatically',
    description: 'Weekend cut-offs differ per depot and are currently applied by memory.',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.IN_PROGRESS,
    storyPoints: 5,
    businessValue: 65,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['corridor', 'rules'],
    acceptanceCriteria:
      '- Depot-specific weekend rules are applied without a manual step\n- A plan that breaks a rule explains which one\n- The rules are editable by the corridor lead',
    createdDaysAgo: 27,
  },
  {
    key: 'late-train-alerts',
    title: 'Alert the control room when a train leaves late',
    description:
      'The control room learned about late departures from the depots, which is too late to re-plan.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.DONE,
    storyPoints: 5,
    businessValue: 80,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['alerts'],
    acceptanceCriteria:
      '- A departure more than ten minutes late raises an alert\n- The alert reaches the control room within a minute\n- Duplicate alerts for one train are suppressed',
    createdDaysAgo: 103,
  },
  {
    key: 'corridor-map-zoom',
    title: 'Zoom the corridor map to a single depot',
    description:
      'Dispatchers work one depot at a time for most of a shift and want the map to match.',
    priority: MoSCoWPriority.COULD_HAVE,
    status: ItemStatus.NEW,
    storyPoints: 3,
    businessValue: 30,
    effort: ValueEffortLevel.LOW,
    labels: ['interface'],
    acceptanceCriteria:
      '- A depot can be opened on its own\n- The surrounding corridor stays visible at the edge\n- The chosen zoom survives a reload',
    createdDaysAgo: 18,
  },
  {
    key: 'driver-shift-export',
    title: 'Export driver shift plans for the depots',
    description:
      'Depot supervisors rebuild the driver rota by hand from the corridor plan each week.',
    priority: MoSCoWPriority.COULD_HAVE,
    status: ItemStatus.NEW,
    storyPoints: 8,
    businessValue: 40,
    effort: ValueEffortLevel.HIGH,
    labels: ['export'],
    acceptanceCriteria:
      '- The export covers a chosen week\n- It can be opened without the planning tool\n- It matches the plan the dispatcher sees',
    createdDaysAgo: 11,
  },
];

const PELL_BACKLOG: readonly BacklogSeed[] = [
  {
    key: 'seven-day-view',
    title: 'Show depot capacity seven days ahead',
    description:
      'Capacity is planned one day at a time, which is why a single late train cascades through the region.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.READY,
    storyPoints: 13,
    businessValue: 100,
    effort: ValueEffortLevel.HIGH,
    labels: ['capacity', 'planning'],
    acceptanceCriteria:
      '- Seven days are visible for every depot in the region\n- The view loads within two seconds for the full region\n- Days beyond the planning horizon are visibly provisional',
    createdDaysAgo: 58,
  },
  {
    key: 'forecast-error',
    title: 'Show how far the forecast missed last week',
    description:
      'A forecast nobody measures is a forecast nobody trusts. Supervisors need to see the miss, not just the plan.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.READY,
    storyPoints: 8,
    businessValue: 85,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['capacity', 'reports'],
    acceptanceCriteria:
      '- The weekly miss is shown per depot and for the region\n- The figure states what it is measured against\n- A week with no data reads as a gap, never as zero',
    createdDaysAgo: 52,
  },
  {
    key: 'depot-input-form',
    title: 'Let regional depots enter their own figures',
    description:
      'Quarterly figures arrive as attachments and are retyped by two people at headquarters.',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.REFINED,
    storyPoints: 8,
    businessValue: 70,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['inputs'],
    acceptanceCriteria:
      '- A depot can enter and correct its own figures\n- The figures are attributed to the person who entered them\n- An incomplete entry cannot be submitted',
    createdDaysAgo: 40,
  },
  {
    key: 'loading-limits',
    title: 'Enforce loading limits per depot bay',
    description:
      'Bays have different limits and the plan could previously be published above them.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.DONE,
    storyPoints: 5,
    businessValue: 75,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['capacity', 'rules'],
    acceptanceCriteria:
      '- A bay cannot be planned above its limit\n- The refusal names the bay and the limit\n- Limits are maintained per depot',
    createdDaysAgo: 88,
  },
  {
    key: 'shared-model-migration',
    title: 'Import the legacy spreadsheet into the shared model',
    description:
      'Two historic years of depot planning sat in a spreadsheet only two people could read.',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.DONE,
    storyPoints: 13,
    businessValue: 95,
    effort: ValueEffortLevel.HIGH,
    labels: ['migration'],
    acceptanceCriteria:
      '- Every historical row is represented in the shared model\n- The totals reconcile with the spreadsheet\n- The import can be run twice without duplicating data',
    createdDaysAgo: 121,
  },
  {
    key: 'capacity-alerts',
    title: 'Warn when a depot exceeds its planned load',
    description: 'Supervisors find out a bay was over-planned when the lorries arrive.',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.IN_PROGRESS,
    storyPoints: 5,
    businessValue: 65,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['capacity', 'alerts'],
    acceptanceCriteria:
      '- An over-planned day raises a warning for that depot\n- The warning names the day and the amount\n- The warning clears when the plan is corrected',
    createdDaysAgo: 24,
  },
  {
    key: 'holiday-calendar',
    title: 'Respect regional holidays in the capacity plan',
    description: 'Each region keeps its own holidays, and the plan currently ignores them.',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.NEW,
    storyPoints: 5,
    businessValue: 50,
    effort: ValueEffortLevel.MEDIUM,
    labels: ['capacity', 'calendar'],
    acceptanceCriteria:
      '- Regional holidays are marked on the plan\n- A holiday does not count as available capacity\n- The calendar is maintained per region',
    createdDaysAgo: 15,
  },
  {
    key: 'weekly-export',
    title: 'Export the weekly capacity plan as a sheet',
    description: 'Depot supervisors take the plan into their own weekly meetings.',
    priority: MoSCoWPriority.COULD_HAVE,
    status: ItemStatus.NEW,
    storyPoints: 3,
    businessValue: 35,
    effort: ValueEffortLevel.LOW,
    labels: ['export'],
    acceptanceCriteria:
      '- The export covers the visible week\n- It matches the figures on screen\n- It opens without the planning tool',
    createdDaysAgo: 13,
  },
  {
    key: 'supervisor-notes',
    title: 'Let depot supervisors annotate a day',
    description:
      'Supervisors keep local reasons for a heavy day outside the plan, where nobody else can read them.',
    priority: MoSCoWPriority.COULD_HAVE,
    status: ItemStatus.REFINED,
    storyPoints: 3,
    businessValue: 30,
    effort: ValueEffortLevel.LOW,
    labels: ['interface'],
    acceptanceCriteria:
      '- A note can be attached to a depot and a day\n- The author is recorded with the note\n- Notes are visible to the other depots in the region',
    createdDaysAgo: 8,
  },
];

function buildTeamBacklog(teamKey: TeamKey, seeds: readonly BacklogSeed[]): ProductBacklogItem[] {
  const id = teamId(teamKey);
  const owner = seededHolderOf(id, 'PRODUCT_OWNER');
  const goal = activeGoalOf(id);

  return seeds.map((seed, index) => ({
    id: pbiId(teamKey, seed.key),
    teamId: id,
    goalId: goal?.id,
    title: seed.title,
    description: seed.description,
    priority: seed.priority,
    rank: index + 1,
    businessValue: seed.businessValue,
    effort: seed.effort,
    storyPoints: seed.storyPoints,
    status: seed.status,
    labels: seed.labels,
    acceptanceCriteria: seed.acceptanceCriteria,
    createdBy: owner ?? '',
    createdAt: isoInstant(-seed.createdDaysAgo, 10, 0),
    updatedAt: isoInstant(Math.min(-seed.createdDaysAgo + 5, -1), 15, 30),
  }));
}

/** The id of a backlog item, so `sprints.ts` can take items into a Sprint. */
export function pbiId(teamKey: TeamKey, key: string): string {
  return fixtureId('pbi', `${teamKey}:${key}`);
}

export const PRODUCT_BACKLOG_ITEMS: readonly ProductBacklogItem[] = [
  ...buildTeamBacklog('cindra', CINDRA_BACKLOG),
  ...buildTeamBacklog('pell', PELL_BACKLOG),
];

/** One team's items, in the order of record. */
export function seededBacklogOf(teamId: string): ProductBacklogItem[] {
  return PRODUCT_BACKLOG_ITEMS.filter((item) => item.teamId === teamId).sort(
    (a, b) => a.rank - b.rank
  );
}
