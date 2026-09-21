import { describe, it, expect } from 'vitest';
import {
  ADAPTATION_REFLECTIONS,
  DAILY_SCRUM_ADJUSTMENT_ACTIONS,
  evaluateAdaptationReflection,
  hasAdaptationEvidence,
  hasContradictoryAdaptationEvidence,
  isDailyScrumAdjustmentAction,
  type AdaptationAdjustmentSnapshot,
  type AdaptationCurrentState,
} from '../../utils/dailyScrumAdaptation.js';

const snapshot = (
  overrides: Partial<AdaptationAdjustmentSnapshot> = {}
): AdaptationAdjustmentSnapshot => ({
  actionType: 'REFINED',
  pbiStatusAtAdjustment: 'READY',
  itemUpdatedAtAtAdjustment: '2026-09-21T08:00:00.000Z',
  pbiUpdatedAtAtAdjustment: '2026-09-21T08:00:00.000Z',
  ...overrides,
});

const currentState = (overrides: Partial<AdaptationCurrentState> = {}): AdaptationCurrentState => ({
  itemPresentInSprintBacklog: true,
  pbiStatus: 'READY',
  itemUpdatedAt: '2026-09-21T08:00:00.000Z',
  pbiUpdatedAt: '2026-09-21T08:00:00.000Z',
  ...overrides,
});

describe('DAILY_SCRUM_ADJUSTMENT_ACTIONS', () => {
  it('lists the five typed adaptations', () => {
    expect([...DAILY_SCRUM_ADJUSTMENT_ACTIONS]).toEqual([
      'ADDED',
      'REMOVED',
      'REPRIORITIZED',
      'REFINED',
      'SPLIT',
    ]);
  });

  it('recognises a typed action and refuses anything else', () => {
    expect(isDailyScrumAdjustmentAction('REMOVED')).toBe(true);
    expect(isDailyScrumAdjustmentAction('DELETED')).toBe(false);
    expect(isDailyScrumAdjustmentAction(undefined)).toBe(false);
  });
});

describe('evaluateAdaptationReflection — REMOVED', () => {
  it('is reflected once the item has left the Sprint Backlog', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'REMOVED' }),
      currentState({ itemPresentInSprintBacklog: false })
    );
    expect(verdict).toEqual({ reflection: 'REFLECTED', basis: 'ITEM_REMOVED' });
  });

  it('is pending while the item is still in the Sprint Backlog', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'REMOVED' }),
      currentState({ itemPresentInSprintBacklog: true })
    );
    expect(verdict).toEqual({
      reflection: ADAPTATION_REFLECTIONS.PENDING_REFLECTION,
      basis: 'NO_CHANGE_OBSERVED',
    });
  });
});

describe('evaluateAdaptationReflection — ADDED', () => {
  it('is reflected once the declared item is in the Sprint Backlog', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'ADDED' }),
      currentState({ itemPresentInSprintBacklog: true })
    );
    expect(verdict).toEqual({ reflection: 'REFLECTED', basis: 'ITEM_PRESENT' });
  });

  it('is pending when the declared item is not there', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'ADDED' }),
      currentState({ itemPresentInSprintBacklog: false })
    );
    expect(verdict).toEqual({
      reflection: 'PENDING_REFLECTION',
      basis: 'NO_CHANGE_OBSERVED',
    });
  });
});

describe('evaluateAdaptationReflection — movement-based actions', () => {
  it.each(['REPRIORITIZED', 'REFINED', 'SPLIT'] as const)(
    'reflects a %s once the Sprint Backlog item has moved',
    (actionType) => {
      const verdict = evaluateAdaptationReflection(
        snapshot({ actionType }),
        currentState({ itemUpdatedAt: '2026-09-21T11:00:00.000Z' })
      );
      expect(verdict).toEqual({ reflection: 'REFLECTED', basis: 'ITEM_UPDATED' });
    }
  );

  it('reflects a change to the Product Backlog Item', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'REPRIORITIZED' }),
      currentState({ pbiUpdatedAt: '2026-09-21T11:00:00.000Z' })
    );
    expect(verdict).toEqual({ reflection: 'REFLECTED', basis: 'PBI_UPDATED' });
  });

  it('reflects a moved status even without a row-version change', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'REFINED', pbiStatusAtAdjustment: 'READY' }),
      currentState({ pbiStatus: 'DONE' })
    );
    expect(verdict).toEqual({
      reflection: 'REFLECTED',
      basis: 'PBI_STATUS_CHANGED',
    });
  });

  it('is pending while nothing has moved', () => {
    const verdict = evaluateAdaptationReflection(snapshot(), currentState());
    expect(verdict).toEqual({
      reflection: 'PENDING_REFLECTION',
      basis: 'NO_CHANGE_OBSERVED',
    });
  });

  it('treats an earlier timestamp as no movement', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'REFINED' }),
      currentState({ itemUpdatedAt: '2026-09-20T08:00:00.000Z' })
    );
    expect(verdict.reflection).toBe('PENDING_REFLECTION');
  });
});

describe('evaluateAdaptationReflection — legacy declarations', () => {
  it('falls back to the movement check when the action type is unknown', () => {
    const moved = evaluateAdaptationReflection(
      snapshot({ actionType: null }),
      currentState({ itemUpdatedAt: '2026-09-21T11:00:00.000Z' })
    );
    expect(moved).toEqual({ reflection: 'REFLECTED', basis: 'ITEM_UPDATED' });

    const still = evaluateAdaptationReflection(snapshot({ actionType: null }), currentState());
    expect(still.reflection).toBe('PENDING_REFLECTION');
  });

  it('does not claim a verdict it cannot support from missing timestamps', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({
        actionType: 'REFINED',
        itemUpdatedAtAtAdjustment: null,
        pbiUpdatedAtAtAdjustment: null,
      }),
      currentState({ itemUpdatedAt: null, pbiUpdatedAt: null })
    );
    expect(verdict.reflection).toBe('PENDING_REFLECTION');
  });

  it('ignores a status comparison when either side is unknown', () => {
    const verdict = evaluateAdaptationReflection(
      snapshot({ actionType: 'REFINED', pbiStatusAtAdjustment: null }),
      currentState({ pbiStatus: 'DONE' })
    );
    expect(verdict).toEqual({ reflection: 'PENDING_REFLECTION', basis: 'NO_CHANGE_OBSERVED' });
  });
});

describe('hasAdaptationEvidence', () => {
  it('accepts a record carrying at least one adjustment', () => {
    expect(hasAdaptationEvidence({ adjustmentCount: 1, noAdaptationNeeded: false })).toBe(true);
  });

  it('accepts an explicit acknowledgement that none was needed', () => {
    expect(hasAdaptationEvidence({ adjustmentCount: 0, noAdaptationNeeded: true })).toBe(true);
  });

  it('refuses a record that declares neither', () => {
    expect(hasAdaptationEvidence({ adjustmentCount: 0, noAdaptationNeeded: false })).toBe(false);
  });
});

describe('hasContradictoryAdaptationEvidence', () => {
  it('flags claiming no adaptation while listing adjustments', () => {
    expect(
      hasContradictoryAdaptationEvidence({ adjustmentCount: 2, noAdaptationNeeded: true })
    ).toBe(true);
  });

  it('accepts either declaration on its own', () => {
    expect(
      hasContradictoryAdaptationEvidence({ adjustmentCount: 2, noAdaptationNeeded: false })
    ).toBe(false);
    expect(
      hasContradictoryAdaptationEvidence({ adjustmentCount: 0, noAdaptationNeeded: true })
    ).toBe(false);
  });
});
