/**
 * Stable machine-readable codes for the Scrum Guide gates Scrumooth enforces.
 *
 * These codes are part of the public API contract: when a gate refuses an action the
 * response carries `error.code` set to one of the values below, so an integrator can
 * branch on the refusal without parsing the localized human-readable message. The
 * canonical, documented list lives in `docs/api/README.md` ("Gate rejections").
 *
 * Adding a gate means adding a code here first — the backend throw sites and the
 * frontend refusal presentation both read this module, so the contract cannot drift.
 */

export const GATE_CODES = {
  /** A Sprint cannot close before its Sprint Review and Sprint Retrospective are recorded. */
  SPRINT_EVENTS_MISSING: 'GATE_SPRINT_EVENTS_MISSING',
  /** A Sprint cannot close while it still has unresolved impediments. */
  IMPEDIMENTS_UNRESOLVED: 'GATE_IMPEDIMENTS_UNRESOLVED',
  /**
   * An impediment records why the Scrum Team is blocked, so it belongs to the team it was
   * raised for: reading and writing one requires membership of that team, and no member of
   * another team can tamper with the record of what held a team back.
   */
  IMPEDIMENT_TEAM_MEMBERS_ONLY: 'GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY',
  /**
   * Reaching a terminal state (`RESOLVED` or `CLOSED`) requires written resolution text.
   * Without it, `CLOSED` becomes a cheap way to lift the Sprint-close gate without removing
   * anything — the gate's own failure mode.
   */
  IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED: 'GATE_IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED',
  /** Nothing is Done until every active Definition of Done item is verified. */
  DOD_NOT_VERIFIED: 'GATE_DOD_NOT_VERIFIED',
  /**
   * A Definition of Done with no active item is not a commitment — it is an empty gate, and the
   * Done rule it exists to enforce would pass vacuously. A team must keep at least one active
   * item, and work cannot be marked Done while it has none.
   */
  DOD_REQUIRED: 'GATE_DOD_REQUIRED',
  /**
   * The Definition of Done is the whole Scrum Team's agreement about what "Done" means for the
   * product, so it belongs to the team that owns it: reading or changing one requires membership
   * of that team.
   */
  DOD_TEAM_MEMBERS_ONLY: 'GATE_DOD_TEAM_MEMBERS_ONLY',
  /** A team can hold exactly one Product Owner and one Scrum Master. */
  LEADERSHIP_ROLE_TAKEN: 'GATE_LEADERSHIP_ROLE_TAKEN',
  /** A Scrum Team cannot grow past `TEAM_MAX_SIZE`. */
  TEAM_SIZE_LIMIT: 'GATE_TEAM_SIZE_LIMIT',
  /** Only Developers size Product Backlog items. */
  DEVELOPER_ONLY_SIZING: 'GATE_DEVELOPER_ONLY_SIZING',
  /** Only Developers author or join the Daily Scrum. */
  DEVELOPER_ONLY_DAILY_SCRUM: 'GATE_DEVELOPER_ONLY_DAILY_SCRUM',
  /**
   * The purpose of the Daily Scrum is to "adapt the Sprint Backlog", so a record must declare
   * its adaptation outcome: at least one Sprint Backlog adjustment, or an explicit
   * acknowledgement that none was needed. A record that declares neither leaves the event's
   * stated purpose unproven, which is what made the adaptation loop optional.
   */
  DAILY_SCRUM_ADAPTATION_REQUIRED: 'GATE_DAILY_SCRUM_ADAPTATION_REQUIRED',
  /** Only the Product Owner can cancel an `ACTIVE` Sprint. */
  PRODUCT_OWNER_ONLY_CANCELLATION: 'GATE_PRODUCT_OWNER_ONLY_CANCELLATION',
  /**
   * The Product Owner orders the Product Backlog: changing an item's MoSCoW priority or its
   * position in the backlog is their accountability, and no one else's.
   */
  PRODUCT_OWNER_ONLY_BACKLOG_ORDER: 'GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER',
  /** A delivered or archived Increment is terminal and cannot be rewritten or revived. */
  INCREMENT_LOCKED: 'GATE_INCREMENT_LOCKED',
  /**
   * The Increment is the Scrum Team's own artifact: reading or writing one requires membership
   * of the team it belongs to, so no outsider can deliver, archive, or inspect another team's
   * increment.
   */
  INCREMENT_TEAM_MEMBERS_ONLY: 'GATE_INCREMENT_TEAM_MEMBERS_ONLY',
  /**
   * "Additive to all prior Increments and thoroughly verified": an Increment cannot be marked
   * `VERIFIED` before its integration with every prior Increment has actually passed.
   */
  INCREMENT_INTEGRATION_VERIFICATION_REQUIRED: 'GATE_INCREMENT_INTEGRATION_VERIFICATION_REQUIRED',
  /**
   * An Increment "must be in usable condition". A label is not evidence, so an Increment cannot
   * be `VERIFIED` or `DELIVERED` until someone attests, in writing, that it is usable — and the
   * attestation records who made it and when.
   */
  INCREMENT_USABILITY_ATTESTATION_REQUIRED: 'GATE_INCREMENT_USABILITY_ATTESTATION_REQUIRED',
  /**
   * `DELIVERED` records how value reached users. It is reachable only through the deliver
   * action, which requires a `deliveryMethod`, so the lifecycle cannot be advanced by a status
   * write that records nothing.
   */
  INCREMENT_DELIVERY_METHOD_REQUIRED: 'GATE_INCREMENT_DELIVERY_METHOD_REQUIRED',
  /** Only Developers save the Sprint Backlog. */
  DEVELOPER_ONLY_SPRINT_BACKLOG: 'GATE_DEVELOPER_ONLY_SPRINT_BACKLOG',
  /**
   * A Product Backlog item must be refined to `READY` before it can enter a Sprint — at
   * planning time exactly as when it is added mid-Sprint.
   */
  PBI_NOT_READY: 'GATE_PBI_NOT_READY',
  /** A team can pursue only one Product Goal at a time. */
  PRODUCT_GOAL_ALREADY_ACTIVE: 'GATE_PRODUCT_GOAL_ALREADY_ACTIVE',
  /** Only the Product Owner creates, edits, or deletes a Product Goal. */
  PRODUCT_OWNER_ONLY_PRODUCT_GOAL: 'GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL',
  /** A Sprint cannot start until it is linked to a Product Goal. */
  PRODUCT_GOAL_REQUIRED: 'GATE_PRODUCT_GOAL_REQUIRED',
  /**
   * The Product Backlog is the emergent expression of the Product Goal: a new item can only
   * be added while the team has an ACTIVE Product Goal to serve.
   */
  PRODUCT_GOAL_REQUIRED_FOR_BACKLOG: 'GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG',
  /** A backlog item may only be linked to the team's single ACTIVE Product Goal. */
  PRODUCT_GOAL_NOT_ACTIVE: 'GATE_PRODUCT_GOAL_NOT_ACTIVE',
  /** A Product Goal cannot be completed without recorded evidence of progress toward it. */
  PRODUCT_GOAL_EVIDENCE_REQUIRED: 'GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED',
  /**
   * The Sprint Backlog is "created by the collaborative work of the entire Scrum Team"
   * (Sprint Planning), so a Sprint cannot open unless planning participation is recorded and
   * includes the Product Owner and at least one Developer.
   */
  PLANNING_PARTICIPATION_REQUIRED: 'GATE_PLANNING_PARTICIPATION_REQUIRED',
  /**
   * A Sprint cannot open when the planned work exceeds the capacity the team recorded during
   * Sprint Planning (beyond the configured over-commitment tolerance).
   */
  CAPACITY_EXCEEDED: 'GATE_CAPACITY_EXCEEDED',
  /**
   * "Sprints are fixed length... a Sprint is one month or less." A Sprint spanning more than
   * `SPRINT_MAX_DURATION_DAYS` (the product's four-week convention) is refused.
   */
  SPRINT_DURATION_LIMIT: 'GATE_SPRINT_DURATION_LIMIT',
  /** A Sprint cannot run at the same time as another Sprint of the same team. */
  SPRINT_DATES_OVERLAP: 'GATE_SPRINT_DATES_OVERLAP',
  /**
   * "A new Sprint starts immediately after the conclusion of the previous Sprint." A Sprint
   * that leaves Sprint-less time in front of it (beyond the tolerated weekend gap) is refused.
   */
  SPRINT_NOT_CONTIGUOUS: 'GATE_SPRINT_NOT_CONTIGUOUS',
  /**
   * The Sprint is the Scrum Team's own container: creating, starting, or replanning it
   * requires membership of the team that owns it.
   */
  SPRINT_TEAM_MEMBERS_ONLY: 'GATE_SPRINT_TEAM_MEMBERS_ONLY',
  /**
   * The Sprint Goal is a commitment made during Sprint Planning. Once the Sprint is running it
   * can only be revised through the Product Owner's acknowledgement of a goal-endangering
   * scope change, not by editing the goal directly.
   */
  SPRINT_GOAL_LOCKED: 'GATE_SPRINT_GOAL_LOCKED',
  /**
   * "No changes are made that would endanger the Sprint Goal": a Sprint Backlog change
   * declared as goal-endangering stays pending until the Product Owner acknowledges it.
   */
  SPRINT_SCOPE_CHANGE_NEEDS_PO: 'GATE_SPRINT_SCOPE_CHANGE_NEEDS_PO',
  /** A goal-endangering change for the same item is already awaiting acknowledgement. */
  SPRINT_SCOPE_CHANGE_ALREADY_PENDING: 'GATE_SPRINT_SCOPE_CHANGE_ALREADY_PENDING',
  /**
   * The Sprint Review is the Scrum Team's own event. Recording attendance, leaving feedback,
   * adjusting the Product Backlog, and completing the Review all require membership of the team
   * that owns the Review, so no outsider can speak for a team at its Review.
   */
  SPRINT_REVIEW_TEAM_MEMBERS_ONLY: 'GATE_SPRINT_REVIEW_TEAM_MEMBERS_ONLY',
  /**
   * The Scrum Master's notes are coaching observations about the event, not a shared field, so
   * they are writable only by the team's Scrum Master -- matching the interface, which already
   * hides the editor from everyone else.
   */
  SPRINT_REVIEW_SM_NOTES_SM_ONLY: 'GATE_SPRINT_REVIEW_SM_NOTES_SM_ONLY',
  /**
   * "The Sprint Review is the second-to-last event of the Sprint and the Sprint Retrospective
   * concludes the Sprint." A Retrospective cannot be completed before its Sprint Review is, or
   * the ordering the Guide prescribes has been inverted without a trace.
   */
  SPRINT_RETROSPECTIVE_REQUIRES_REVIEW: 'GATE_SPRINT_RETROSPECTIVE_REQUIRES_REVIEW',
  /**
   * The Review inspects the outcome of the Sprint and the Retrospective concludes it, so neither
   * event can be completed before the Sprint's end date has passed. Completing them early would
   * close a Sprint that never ran its course.
   */
  SPRINT_EVENT_BEFORE_END_DATE: 'GATE_SPRINT_EVENT_BEFORE_END_DATE',
  /**
   * "The Scrum Team inspects... individuals, interactions, processes, tools, and their Definition
   * of Done." A Retrospective holds candid criticism of people as well as process, so the room
   * must be the Scrum Team and not the whole installation: reading or writing one requires
   * membership of the team whose Sprint it concludes.
   */
  RETROSPECTIVE_TEAM_MEMBERS_ONLY: 'GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY',
  /**
   * The Scrum Master's notes are coaching observations about the event, not a shared field, so
   * they are readable and writable only by the team's Scrum Master -- matching the interface,
   * which already hides the editor from everyone else.
   */
  RETROSPECTIVE_SM_NOTES_SM_ONLY: 'GATE_RETROSPECTIVE_SM_NOTES_SM_ONLY',
  /**
   * "The most impactful improvements are addressed as soon as possible." Once an action item has
   * produced (or been linked to) a Product Backlog item, that link is the evidence it was
   * addressed; the manual `addedToSprintBacklog` flag must not be turned back off, or the
   * improvement would look unaddressed while the work exists.
   */
  RETROSPECTIVE_ACTION_ITEM_LINKED: 'GATE_RETROSPECTIVE_ACTION_ITEM_LINKED',
  /**
   * "The Scrum Team inspects... their Definition of Done... and identifies the most helpful
   * changes." Applying DoD changes is refused when the Retrospective recorded no reflection,
   * because an empty application would bump the DoD version without changing anything and
   * present a version bump as evidence of adaptation that did not happen.
   */
  RETROSPECTIVE_DOD_CHANGES_MISSING: 'GATE_RETROSPECTIVE_DOD_CHANGES_MISSING',
} as const;

export type GateCode = (typeof GATE_CODES)[keyof typeof GATE_CODES];

/** Prefix shared by every gate refusal code (used for defensive detection). */
export const GATE_CODE_PREFIX = 'GATE_';

/**
 * i18n namespace holding the gate refusal copy in the frontend locale files
 * (`public/locales/<locale>/gate.json`). Each code resolves to the sub-tree named
 * by its definition's `i18nKey`, containing `rule`, `guideClause` and `recovery`.
 */
export const GATE_I18N_NAMESPACE = 'gate';

/**
 * The Scrum Guide rule a gate enforces, expressed as a stable contract entry.
 *
 * `guideClauseKey` deliberately does NOT resolve here: the 2020 Scrum Guide citation is
 * user-facing copy and therefore lives in the locale files, translated per language.
 */
export interface GateDefinition {
  /** Stable machine-readable refusal code returned in `error.code`. */
  readonly code: GateCode;
  /** HTTP status the refusal is returned with. */
  readonly httpStatus: 400 | 403 | 409;
  /** Key under `GATE_I18N_NAMESPACE` holding `rule`, `guideClause` and `recovery`. */
  readonly i18nKey: string;
}

/**
 * Single source of truth mapping each gate code to its HTTP status and the locale key
 * that holds its refusal copy. Consumed by the backend (codes only) and by the frontend
 * gate presentation (code → rule / Guide citation / recovery action).
 */
export const GATE_DEFINITIONS: Record<GateCode, GateDefinition> = {
  [GATE_CODES.SPRINT_EVENTS_MISSING]: {
    code: GATE_CODES.SPRINT_EVENTS_MISSING,
    httpStatus: 400,
    i18nKey: 'sprintEventsMissing',
  },
  [GATE_CODES.IMPEDIMENTS_UNRESOLVED]: {
    code: GATE_CODES.IMPEDIMENTS_UNRESOLVED,
    httpStatus: 400,
    i18nKey: 'impedimentsUnresolved',
  },
  [GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY]: {
    code: GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY,
    httpStatus: 403,
    i18nKey: 'impedimentTeamMembersOnly',
  },
  [GATE_CODES.IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED]: {
    code: GATE_CODES.IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED,
    httpStatus: 400,
    i18nKey: 'impedimentTerminalResolutionRequired',
  },
  [GATE_CODES.DOD_NOT_VERIFIED]: {
    code: GATE_CODES.DOD_NOT_VERIFIED,
    httpStatus: 400,
    i18nKey: 'dodNotVerified',
  },
  [GATE_CODES.DOD_REQUIRED]: {
    code: GATE_CODES.DOD_REQUIRED,
    httpStatus: 400,
    i18nKey: 'dodRequired',
  },
  [GATE_CODES.DOD_TEAM_MEMBERS_ONLY]: {
    code: GATE_CODES.DOD_TEAM_MEMBERS_ONLY,
    httpStatus: 403,
    i18nKey: 'dodTeamMembersOnly',
  },
  [GATE_CODES.LEADERSHIP_ROLE_TAKEN]: {
    code: GATE_CODES.LEADERSHIP_ROLE_TAKEN,
    httpStatus: 409,
    i18nKey: 'leadershipRoleTaken',
  },
  [GATE_CODES.TEAM_SIZE_LIMIT]: {
    code: GATE_CODES.TEAM_SIZE_LIMIT,
    httpStatus: 409,
    i18nKey: 'teamSizeLimit',
  },
  [GATE_CODES.DEVELOPER_ONLY_SIZING]: {
    code: GATE_CODES.DEVELOPER_ONLY_SIZING,
    httpStatus: 403,
    i18nKey: 'developerOnlySizing',
  },
  [GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM]: {
    code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
    httpStatus: 403,
    i18nKey: 'developerOnlyDailyScrum',
  },
  [GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED]: {
    code: GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED,
    httpStatus: 400,
    i18nKey: 'dailyScrumAdaptationRequired',
  },
  [GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION]: {
    code: GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION,
    httpStatus: 403,
    i18nKey: 'productOwnerOnlyCancellation',
  },
  [GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER]: {
    code: GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER,
    httpStatus: 403,
    i18nKey: 'productOwnerOnlyBacklogOrder',
  },
  [GATE_CODES.INCREMENT_LOCKED]: {
    code: GATE_CODES.INCREMENT_LOCKED,
    httpStatus: 400,
    i18nKey: 'incrementLocked',
  },
  [GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY]: {
    code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
    httpStatus: 403,
    i18nKey: 'incrementTeamMembersOnly',
  },
  [GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED]: {
    code: GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED,
    httpStatus: 400,
    i18nKey: 'incrementIntegrationVerificationRequired',
  },
  [GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED]: {
    code: GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED,
    httpStatus: 400,
    i18nKey: 'incrementUsabilityAttestationRequired',
  },
  [GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED]: {
    code: GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED,
    httpStatus: 400,
    i18nKey: 'incrementDeliveryMethodRequired',
  },
  [GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG]: {
    code: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
    httpStatus: 403,
    i18nKey: 'developerOnlySprintBacklog',
  },
  [GATE_CODES.PBI_NOT_READY]: {
    code: GATE_CODES.PBI_NOT_READY,
    httpStatus: 400,
    i18nKey: 'pbiNotReady',
  },
  [GATE_CODES.PRODUCT_GOAL_ALREADY_ACTIVE]: {
    code: GATE_CODES.PRODUCT_GOAL_ALREADY_ACTIVE,
    httpStatus: 409,
    i18nKey: 'productGoalAlreadyActive',
  },
  [GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL]: {
    code: GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL,
    httpStatus: 403,
    i18nKey: 'productOwnerOnlyProductGoal',
  },
  [GATE_CODES.PRODUCT_GOAL_REQUIRED]: {
    code: GATE_CODES.PRODUCT_GOAL_REQUIRED,
    httpStatus: 400,
    i18nKey: 'productGoalRequired',
  },
  [GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG]: {
    code: GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG,
    httpStatus: 400,
    i18nKey: 'productGoalRequiredForBacklog',
  },
  [GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE]: {
    code: GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE,
    httpStatus: 409,
    i18nKey: 'productGoalNotActive',
  },
  [GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED]: {
    code: GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED,
    httpStatus: 409,
    i18nKey: 'productGoalEvidenceRequired',
  },
  [GATE_CODES.PLANNING_PARTICIPATION_REQUIRED]: {
    code: GATE_CODES.PLANNING_PARTICIPATION_REQUIRED,
    httpStatus: 400,
    i18nKey: 'planningParticipationRequired',
  },
  [GATE_CODES.CAPACITY_EXCEEDED]: {
    code: GATE_CODES.CAPACITY_EXCEEDED,
    httpStatus: 400,
    i18nKey: 'capacityExceeded',
  },
  [GATE_CODES.SPRINT_DURATION_LIMIT]: {
    code: GATE_CODES.SPRINT_DURATION_LIMIT,
    httpStatus: 400,
    i18nKey: 'sprintDurationLimit',
  },
  [GATE_CODES.SPRINT_DATES_OVERLAP]: {
    code: GATE_CODES.SPRINT_DATES_OVERLAP,
    httpStatus: 409,
    i18nKey: 'sprintDatesOverlap',
  },
  [GATE_CODES.SPRINT_NOT_CONTIGUOUS]: {
    code: GATE_CODES.SPRINT_NOT_CONTIGUOUS,
    httpStatus: 400,
    i18nKey: 'sprintNotContiguous',
  },
  [GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY]: {
    code: GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY,
    httpStatus: 403,
    i18nKey: 'sprintTeamMembersOnly',
  },
  [GATE_CODES.SPRINT_GOAL_LOCKED]: {
    code: GATE_CODES.SPRINT_GOAL_LOCKED,
    httpStatus: 400,
    i18nKey: 'sprintGoalLocked',
  },
  [GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO]: {
    code: GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO,
    httpStatus: 403,
    i18nKey: 'sprintScopeChangeNeedsPo',
  },
  [GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING]: {
    code: GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING,
    httpStatus: 409,
    i18nKey: 'sprintScopeChangeAlreadyPending',
  },
  [GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY]: {
    code: GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY,
    httpStatus: 403,
    i18nKey: 'sprintReviewTeamMembersOnly',
  },
  [GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY]: {
    code: GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY,
    httpStatus: 403,
    i18nKey: 'sprintReviewSmNotesSmOnly',
  },
  [GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW]: {
    code: GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW,
    httpStatus: 400,
    i18nKey: 'sprintRetrospectiveRequiresReview',
  },
  [GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE]: {
    code: GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE,
    httpStatus: 400,
    i18nKey: 'sprintEventBeforeEndDate',
  },
  [GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY]: {
    code: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY,
    httpStatus: 403,
    i18nKey: 'retrospectiveTeamMembersOnly',
  },
  [GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY]: {
    code: GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY,
    httpStatus: 403,
    i18nKey: 'retrospectiveSmNotesSmOnly',
  },
  [GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED]: {
    code: GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED,
    httpStatus: 409,
    i18nKey: 'retrospectiveActionItemLinked',
  },
  [GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING]: {
    code: GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING,
    httpStatus: 400,
    i18nKey: 'retrospectiveDodChangesMissing',
  },
};

const GATE_CODE_VALUES: ReadonlySet<string> = new Set(Object.values(GATE_CODES));

/** All gate codes as a plain array (stable insertion order). */
export const GATE_CODE_LIST: readonly GateCode[] = Object.values(GATE_CODES);

/**
 * Type guard for an exact, known gate code. Use in the refusal-accounting middleware and
 * in the frontend presentation layer; unknown or non-gate codes return `false`.
 */
export const isGateCode = (value: unknown): value is GateCode =>
  typeof value === 'string' && GATE_CODE_VALUES.has(value);

/**
 * Resolve the contract entry for a gate code, or `undefined` when the code is not a gate.
 * Accepts a plain string so callers can pass an untrusted `error.code` directly.
 */
export const getGateDefinition = (code: unknown): GateDefinition | undefined =>
  isGateCode(code) ? GATE_DEFINITIONS[code] : undefined;
