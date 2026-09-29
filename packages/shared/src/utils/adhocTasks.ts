/**
 * Ad-hoc task decomposition for a Product Backlog item that enters the running Sprint Backlog.
 *
 * When an item is pulled into the Sprint mid-flight the Developers have not decomposed it yet, so
 * the system seeds a standard set of tasks from the estimate: a larger estimate becomes more tasks
 * of a standard day's work. The rule lives here, once, so that the same item produces the same
 * tasks whether it entered the Sprint directly or through the Product Owner's later
 * acknowledgement of a change that endangered the Sprint Goal.
 */

/** How a story-point estimate decomposes into ad-hoc tasks. */
export interface AdHocTaskConfig {
  /** Number of tasks the estimate is broken into. */
  taskCount: number;
  /** Estimated (and initial remaining) hours per task. */
  estimatedHours: number;
}

/** The estimate-to-tasks table. This is the team's default working assumption, not a mandate. */
export const STORY_POINTS_TO_TASKS: Record<number, AdHocTaskConfig> = {
  1: { taskCount: 1, estimatedHours: 2 },
  2: { taskCount: 1, estimatedHours: 4 },
  3: { taskCount: 1, estimatedHours: 8 },
  5: { taskCount: 2, estimatedHours: 8 },
  8: { taskCount: 3, estimatedHours: 8 },
  13: { taskCount: 5, estimatedHours: 8 },
};

/** Applied to an estimate the table does not cover (e.g. 0 or an unusual scale). */
export const DEFAULT_ADHOC_TASK_CONFIG: AdHocTaskConfig = { taskCount: 1, estimatedHours: 8 };

/** A task to be persisted against the Sprint, before it has an identity of its own. */
export interface AdHocTaskDraft {
  title: string;
  estimatedHours: number;
  remainingHours: number;
}

/**
 * Generate the ad-hoc tasks for a PBI that has just entered the Sprint Backlog.
 *
 * The `Adhoc:` prefix marks the task as system-seeded, so it stays distinguishable from a task the
 * Developers decomposed themselves.
 */
export const generateAdHocTaskDrafts = (
  pbiTitle: string,
  storyPoints: number | null | undefined
): AdHocTaskDraft[] => {
  const config =
    (typeof storyPoints === 'number' ? STORY_POINTS_TO_TASKS[storyPoints] : undefined) ??
    DEFAULT_ADHOC_TASK_CONFIG;

  const drafts: AdHocTaskDraft[] = [];

  for (let index = 0; index < config.taskCount; index++) {
    drafts.push({
      title:
        config.taskCount === 1
          ? `Adhoc: ${pbiTitle} - Task`
          : `Adhoc: ${pbiTitle} - Task ${index + 1}`,
      estimatedHours: config.estimatedHours,
      remainingHours: config.estimatedHours,
    });
  }

  return drafts;
};
