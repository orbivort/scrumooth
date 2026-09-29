import { describe, it, expect } from 'vitest';

import {
  DEFAULT_ADHOC_TASK_CONFIG,
  STORY_POINTS_TO_TASKS,
  generateAdHocTaskDrafts,
} from '../../utils/adhocTasks.js';

describe('generateAdHocTaskDrafts', () => {
  it('seeds a single task for a one-point item', () => {
    const drafts = generateAdHocTaskDrafts('Login', 1);

    expect(drafts).toEqual([
      { title: 'Adhoc: Login - Task', estimatedHours: 2, remainingHours: 2 },
    ]);
  });

  it('splits a larger estimate into numbered tasks', () => {
    const drafts = generateAdHocTaskDrafts('Checkout', 5);

    expect(drafts).toHaveLength(2);
    expect(drafts.map((draft) => draft.title)).toEqual([
      'Adhoc: Checkout - Task 1',
      'Adhoc: Checkout - Task 2',
    ]);
    expect(drafts.every((draft) => draft.estimatedHours === 8)).toBe(true);
  });

  it('numbers every task when the estimate is split into many', () => {
    const drafts = generateAdHocTaskDrafts('Epic', 13);

    expect(drafts).toHaveLength(5);
    expect(drafts.map((draft) => draft.title)).toEqual([
      'Adhoc: Epic - Task 1',
      'Adhoc: Epic - Task 2',
      'Adhoc: Epic - Task 3',
      'Adhoc: Epic - Task 4',
      'Adhoc: Epic - Task 5',
    ]);
  });

  it('starts a task with its full estimate remaining', () => {
    for (const draft of generateAdHocTaskDrafts('Anything', 8)) {
      expect(draft.remainingHours).toBe(draft.estimatedHours);
    }
  });

  it('falls back to the default decomposition for an estimate outside the table', () => {
    for (const estimate of [21, 100, 0]) {
      const drafts = generateAdHocTaskDrafts('Unmapped', estimate);

      expect(drafts).toEqual([
        {
          title: 'Adhoc: Unmapped - Task',
          estimatedHours: DEFAULT_ADHOC_TASK_CONFIG.estimatedHours,
          remainingHours: DEFAULT_ADHOC_TASK_CONFIG.estimatedHours,
        },
      ]);
    }
  });

  it('falls back to the default decomposition when the item is not estimated', () => {
    for (const unestimated of [null, undefined] as const) {
      const drafts = generateAdHocTaskDrafts('Unestimated', unestimated);

      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.title).toBe('Adhoc: Unestimated - Task');
    }
  });

  it('covers every estimate in the table', () => {
    for (const [estimate, config] of Object.entries(STORY_POINTS_TO_TASKS)) {
      const drafts = generateAdHocTaskDrafts('Item', Number(estimate));

      expect(drafts).toHaveLength(config.taskCount);
      expect(drafts.every((draft) => draft.estimatedHours === config.estimatedHours)).toBe(true);
    }
  });
});
