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
  /** Nothing is Done until every active Definition of Done item is verified. */
  DOD_NOT_VERIFIED: 'GATE_DOD_NOT_VERIFIED',
  /** A team can hold exactly one Product Owner and one Scrum Master. */
  LEADERSHIP_ROLE_TAKEN: 'GATE_LEADERSHIP_ROLE_TAKEN',
  /** A Scrum Team cannot grow past `TEAM_MAX_SIZE`. */
  TEAM_SIZE_LIMIT: 'GATE_TEAM_SIZE_LIMIT',
  /** Only Developers size Product Backlog items. */
  DEVELOPER_ONLY_SIZING: 'GATE_DEVELOPER_ONLY_SIZING',
  /** Only Developers author or join the Daily Scrum. */
  DEVELOPER_ONLY_DAILY_SCRUM: 'GATE_DEVELOPER_ONLY_DAILY_SCRUM',
  /** Only the Product Owner can cancel an `ACTIVE` Sprint. */
  PRODUCT_OWNER_ONLY_CANCELLATION: 'GATE_PRODUCT_OWNER_ONLY_CANCELLATION',
  /** A delivered Increment cannot be rewritten. */
  INCREMENT_LOCKED: 'GATE_INCREMENT_LOCKED',
  /** Only Developers save the Sprint Backlog. */
  DEVELOPER_ONLY_SPRINT_BACKLOG: 'GATE_DEVELOPER_ONLY_SPRINT_BACKLOG',
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
  [GATE_CODES.DOD_NOT_VERIFIED]: {
    code: GATE_CODES.DOD_NOT_VERIFIED,
    httpStatus: 400,
    i18nKey: 'dodNotVerified',
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
  [GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION]: {
    code: GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION,
    httpStatus: 403,
    i18nKey: 'productOwnerOnlyCancellation',
  },
  [GATE_CODES.INCREMENT_LOCKED]: {
    code: GATE_CODES.INCREMENT_LOCKED,
    httpStatus: 400,
    i18nKey: 'incrementLocked',
  },
  [GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG]: {
    code: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
    httpStatus: 403,
    i18nKey: 'developerOnlySprintBacklog',
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
