// Shared rules for the adaptation half of the Daily Scrum.
//
// Grounded in the November 2020 Scrum Guide:
//  - "The purpose of the Daily Scrum is to inspect progress toward the Sprint Goal and adapt the
//    Sprint Backlog."
//
// A Daily Scrum that adapts nothing and a Daily Scrum that adapts something are both legitimate
// outcomes of the event; what the Guide does not allow is the purpose going unevidenced. So a
// record declares its outcome -- one or more typed Sprint Backlog adjustments, or an explicit
// acknowledgement that none were needed -- and every declaration carries the state of the item
// it concerns at the moment it was made.
//
// That snapshot is what makes the declaration checkable. Comparing it with the item's current
// state distinguishes "declared" from "reflected in the Sprint Backlog" without taking the
// note's word for it. The verdict is computed rather than stored, so it stays truthful as the
// Sprint Backlog evolves instead of going stale the moment it is written.
//
// Every helper here is pure and total, so the backend store and the interface describe an
// adaptation in exactly the same words.

/**
 * How the Sprint Backlog was adapted.
 *
 * Typed rather than free text because the type is what makes the declaration checkable: a
 * removal is confirmed by the item leaving the Sprint Backlog, an addition by it being there.
 */
export const DAILY_SCRUM_ADJUSTMENT_ACTIONS = [
  'ADDED',
  'REMOVED',
  'REPRIORITIZED',
  'REFINED',
  'SPLIT',
] as const;

export type DailyScrumAdjustmentAction = (typeof DAILY_SCRUM_ADJUSTMENT_ACTIONS)[number];

/** Type guard for an action value received from an untrusted payload. */
export const isDailyScrumAdjustmentAction = (value: unknown): value is DailyScrumAdjustmentAction =>
  typeof value === 'string' &&
  (DAILY_SCRUM_ADJUSTMENT_ACTIONS as readonly string[]).includes(value);

/**
 * Whether a declaration has been borne out by the Sprint Backlog yet.
 *
 * `PENDING_REFLECTION` is not an accusation: the Sprint Backlog is adapted continuously, and a
 * declaration made this morning may simply not have been acted on yet.
 */
export const ADAPTATION_REFLECTIONS = {
  REFLECTED: 'REFLECTED',
  PENDING_REFLECTION: 'PENDING_REFLECTION',
} as const;

export type AdaptationReflection =
  (typeof ADAPTATION_REFLECTIONS)[keyof typeof ADAPTATION_REFLECTIONS];

/**
 * Which observation produced the verdict. Kept alongside the verdict so the interface can
 * explain itself ("the item left the Sprint Backlog") instead of merely asserting a status.
 */
export const ADAPTATION_REFLECTION_BASES = {
  ITEM_REMOVED: 'ITEM_REMOVED',
  ITEM_PRESENT: 'ITEM_PRESENT',
  ITEM_UPDATED: 'ITEM_UPDATED',
  PBI_UPDATED: 'PBI_UPDATED',
  PBI_STATUS_CHANGED: 'PBI_STATUS_CHANGED',
  NO_CHANGE_OBSERVED: 'NO_CHANGE_OBSERVED',
} as const;

export type AdaptationReflectionBasis =
  (typeof ADAPTATION_REFLECTION_BASES)[keyof typeof ADAPTATION_REFLECTION_BASES];

/**
 * The affected item's state when the declaration was recorded. Every field is server-derived:
 * a caller must not be able to choose the baseline it is later judged against.
 */
export interface AdaptationAdjustmentSnapshot {
  /** `null` only on declarations recorded before the typed action existed. */
  actionType: DailyScrumAdjustmentAction | null;
  pbiStatusAtAdjustment: string | null;
  itemUpdatedAtAtAdjustment: string | null;
  pbiUpdatedAtAtAdjustment: string | null;
}

/** The affected item's state now, read from the Sprint Backlog. */
export interface AdaptationCurrentState {
  /** False once the item has left the Sprint Backlog, which is how a removal is fulfilled. */
  itemPresentInSprintBacklog: boolean;
  pbiStatus: string | null;
  itemUpdatedAt: string | null;
  pbiUpdatedAt: string | null;
}

/** The verdict for one declaration, with the observation that produced it. */
export interface AdaptationReflectionVerdict {
  reflection: AdaptationReflection;
  basis: AdaptationReflectionBasis;
}

const timestampOf = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

/** True when `after` is a later, comparable instant than `before`. */
const advanced = (before: string | null, after: string | null): boolean => {
  const beforeTime = timestampOf(before);
  const afterTime = timestampOf(after);
  if (beforeTime === null || afterTime === null) {
    return false;
  }
  return afterTime > beforeTime;
};

/**
 * Decide whether the Sprint Backlog reflects a declaration.
 *
 *  - `REMOVED` is reflected once the item is no longer in the Sprint Backlog.
 *  - `ADDED` is reflected once the declared item is in the Sprint Backlog.
 *  - `REPRIORITIZED` / `REFINED` / `SPLIT` -- and declarations recorded before the typed action
 *    existed, where the intent is unknown -- are reflected once the item or its Product Backlog
 *    Item has moved: a later row version, or a changed PBI status.
 *
 * The check is deliberately about the declared end state, not about intent. An `ADDED`
 * declaration naming an item that was already in the Sprint Backlog reads as reflected, because
 * the state it asserted is true.
 */
export const evaluateAdaptationReflection = (
  snapshot: AdaptationAdjustmentSnapshot,
  current: AdaptationCurrentState
): AdaptationReflectionVerdict => {
  if (snapshot.actionType === 'REMOVED') {
    return current.itemPresentInSprintBacklog
      ? {
          reflection: ADAPTATION_REFLECTIONS.PENDING_REFLECTION,
          basis: ADAPTATION_REFLECTION_BASES.NO_CHANGE_OBSERVED,
        }
      : {
          reflection: ADAPTATION_REFLECTIONS.REFLECTED,
          basis: ADAPTATION_REFLECTION_BASES.ITEM_REMOVED,
        };
  }

  if (snapshot.actionType === 'ADDED') {
    return current.itemPresentInSprintBacklog
      ? {
          reflection: ADAPTATION_REFLECTIONS.REFLECTED,
          basis: ADAPTATION_REFLECTION_BASES.ITEM_PRESENT,
        }
      : {
          reflection: ADAPTATION_REFLECTIONS.PENDING_REFLECTION,
          basis: ADAPTATION_REFLECTION_BASES.NO_CHANGE_OBSERVED,
        };
  }

  if (
    snapshot.pbiStatusAtAdjustment !== null &&
    current.pbiStatus !== null &&
    current.pbiStatus !== snapshot.pbiStatusAtAdjustment
  ) {
    return {
      reflection: ADAPTATION_REFLECTIONS.REFLECTED,
      basis: ADAPTATION_REFLECTION_BASES.PBI_STATUS_CHANGED,
    };
  }

  if (advanced(snapshot.itemUpdatedAtAtAdjustment, current.itemUpdatedAt)) {
    return {
      reflection: ADAPTATION_REFLECTIONS.REFLECTED,
      basis: ADAPTATION_REFLECTION_BASES.ITEM_UPDATED,
    };
  }

  if (advanced(snapshot.pbiUpdatedAtAtAdjustment, current.pbiUpdatedAt)) {
    return {
      reflection: ADAPTATION_REFLECTIONS.REFLECTED,
      basis: ADAPTATION_REFLECTION_BASES.PBI_UPDATED,
    };
  }

  return {
    reflection: ADAPTATION_REFLECTIONS.PENDING_REFLECTION,
    basis: ADAPTATION_REFLECTION_BASES.NO_CHANGE_OBSERVED,
  };
};

/** The evidence a Daily Scrum record declares about its own adaptation outcome. */
export interface AdaptationEvidenceDeclaration {
  /** Number of Sprint Backlog adjustments the record carries. */
  adjustmentCount: number;
  /** Whether the Developers acknowledged that no adaptation was needed. */
  noAdaptationNeeded: boolean;
}

/**
 * True when the record carries evidence of its adaptation outcome.
 *
 * The Guide's purpose for the event is "adapt the Sprint Backlog", so a record that declares
 * neither an adjustment nor a considered decision that none was needed leaves that purpose
 * unproven. One of the two, never neither.
 */
export const hasAdaptationEvidence = ({
  adjustmentCount,
  noAdaptationNeeded,
}: AdaptationEvidenceDeclaration): boolean => noAdaptationNeeded || adjustmentCount > 0;

/**
 * True when a declaration contradicts itself: claiming no adaptation was needed while also
 * listing the adjustments that were made. Both may not be true at once.
 */
export const hasContradictoryAdaptationEvidence = ({
  adjustmentCount,
  noAdaptationNeeded,
}: AdaptationEvidenceDeclaration): boolean => noAdaptationNeeded && adjustmentCount > 0;
