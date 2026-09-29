/**
 * Which class of rule each gate belongs to — the taxonomy the three enforcement tables present.
 *
 * The project README presents the enforced rules in three separate tables: the 2020 Scrum Guide's
 * own rules, the complementary practices the product adds (the Definition of Ready), and the
 * process-integrity boundaries it reads out of the Guide's transparency, self-management and
 * single-team values. It states that the three "can never be mistaken for one another", and the
 * gate rejections reference discloses the complementary class in place.
 *
 * That separation was previously asserted in prose alone, in two hand-maintained documents and in
 * four translations. This module is what makes it checkable: the `Record<GateCode, GateOrigin>`
 * below is exhaustive by construction, so a new gate cannot be added without declaring which class
 * it belongs to, and `scripts/maintenance/verify-gate-catalogue.mjs` counts the classes from here
 * and verifies the totals the README prints.
 *
 * The classification rule, applied in order:
 *
 * 1. `COMPLEMENTARY` — the gate enforces the Definition of Ready, which is not a 2020 Scrum Guide
 *    artifact at all (the Guide's artifacts are the Product Backlog, the Sprint Backlog and the
 *    Increment). The class follows the *agreement*, not the mechanism: the readiness agreement's
 *    membership and Scrum-Master-only gates are complementary too, because what is governed is the
 *    product's own practice rather than a Guide commitment.
 * 2. `BOUNDARY` — the gate decides who may see or change which Scrum Team's record, or which role
 *    owns a candid surface (the Scrum Master's notes, the coaching log, the values health check).
 *    These are the product's reading of the Guide's transparency, not sentences of the Guide.
 * 3. `GUIDE` — everything else: a rule the 2020 Scrum Guide states or directly entails about what
 *    the process must be — event sequencing, role authority, artifact commitments, and the evidence
 *    a claim rests on.
 *
 * Ordering note: a gate with both a Guide subject and a membership test (an Increment, say) is
 * classified by what it enforces. "Only this team may read its own Increment" is a boundary, not an
 * Increment rule; "an Increment is not verified before it integrates" is a Guide rule, not a
 * boundary. When a gate sits on the line, the README's own table placement decides, because the
 * README's three tables are the claim this taxonomy exists to keep honest.
 */

import { GATE_CODES, type GateCode } from './gateCodes.js';

/**
 * The class of rule a gate belongs to — one per README enforcement table.
 *
 * - `GUIDE`: a 2020 Scrum Guide rule, enforced.
 * - `COMPLEMENTARY`: a practice the product adds on top of the Guide (the Definition of Ready).
 * - `BOUNDARY`: a process-integrity boundary read out of the Guide's transparency and
 *   self-management.
 */
export type GateOrigin = 'GUIDE' | 'COMPLEMENTARY' | 'BOUNDARY';

/** Every origin, in the order the README presents them. */
export const GATE_ORIGIN_LIST: readonly GateOrigin[] = ['GUIDE', 'COMPLEMENTARY', 'BOUNDARY'];

/**
 * The class each gate belongs to.
 *
 * Exhaustive over `GateCode`: adding a gate without classifying it is a compile error, which is the
 * point — the README's separation of the three classes cannot silently rot as gates are added.
 */
export const GATE_ORIGINS: Record<GateCode, GateOrigin> = {
  // --- 2020 Scrum Guide rules ---
  [GATE_CODES.SPRINT_EVENTS_MISSING]: 'GUIDE',
  [GATE_CODES.IMPEDIMENTS_UNRESOLVED]: 'GUIDE',
  [GATE_CODES.IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED]: 'GUIDE',
  [GATE_CODES.DOD_NOT_VERIFIED]: 'GUIDE',
  [GATE_CODES.DOD_REQUIRED]: 'GUIDE',
  [GATE_CODES.LEADERSHIP_ROLE_TAKEN]: 'GUIDE',
  [GATE_CODES.TEAM_SIZE_LIMIT]: 'GUIDE',
  [GATE_CODES.DEVELOPER_ONLY_SIZING]: 'GUIDE',
  [GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM]: 'GUIDE',
  [GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED]: 'GUIDE',
  [GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION]: 'GUIDE',
  [GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER]: 'GUIDE',
  [GATE_CODES.INCREMENT_LOCKED]: 'GUIDE',
  [GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED]: 'GUIDE',
  [GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED]: 'GUIDE',
  [GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED]: 'GUIDE',
  [GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG]: 'GUIDE',
  [GATE_CODES.PRODUCT_GOAL_ALREADY_ACTIVE]: 'GUIDE',
  [GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL]: 'GUIDE',
  [GATE_CODES.PRODUCT_GOAL_REQUIRED]: 'GUIDE',
  [GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG]: 'GUIDE',
  [GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE]: 'GUIDE',
  [GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED]: 'GUIDE',
  [GATE_CODES.PLANNING_PARTICIPATION_REQUIRED]: 'GUIDE',
  [GATE_CODES.CAPACITY_EXCEEDED]: 'GUIDE',
  [GATE_CODES.SPRINT_DURATION_LIMIT]: 'GUIDE',
  [GATE_CODES.SPRINT_DATES_OVERLAP]: 'GUIDE',
  [GATE_CODES.SPRINT_NOT_CONTIGUOUS]: 'GUIDE',
  [GATE_CODES.SPRINT_GOAL_LOCKED]: 'GUIDE',
  [GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO]: 'GUIDE',
  [GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING]: 'GUIDE',
  [GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED]: 'GUIDE',
  [GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_NOT_APPLICABLE]: 'GUIDE',
  [GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW]: 'GUIDE',
  [GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE]: 'GUIDE',
  [GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED]: 'GUIDE',
  [GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING]: 'GUIDE',
  [GATE_CODES.DOD_GROUP_GOVERNED]: 'GUIDE',
  [GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED]: 'GUIDE',

  // --- Complementary practices (the Definition of Ready) ---
  [GATE_CODES.DOR_TEAM_MEMBERS_ONLY]: 'COMPLEMENTARY',
  [GATE_CODES.DOR_SCRUM_MASTER_ONLY]: 'COMPLEMENTARY',
  [GATE_CODES.DOR_REQUIRED]: 'COMPLEMENTARY',
  [GATE_CODES.DOR_NOT_VERIFIED]: 'COMPLEMENTARY',
  [GATE_CODES.PBI_NOT_READY]: 'COMPLEMENTARY',

  // --- Process-integrity and transparency boundaries ---
  [GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.DOD_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY]: 'BOUNDARY',
  [GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY]: 'BOUNDARY',
  [GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.SPRINT_SM_NOTES_SM_ONLY]: 'BOUNDARY',
  [GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY]: 'BOUNDARY',
  [GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY]: 'BOUNDARY',
  [GATE_CODES.ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED]: 'BOUNDARY',
  [GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED]: 'BOUNDARY',
  [GATE_CODES.ORGANIZATIONAL_BARRIER_SOURCE_NOT_OF_TEAM]: 'BOUNDARY',
  [GATE_CODES.COACHING_SM_ONLY]: 'BOUNDARY',
  [GATE_CODES.CROSS_FUNCTIONALITY_SM_ONLY]: 'BOUNDARY',
  [GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.TEAM_GROUP_MEMBERS_ONLY]: 'BOUNDARY',
  [GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY]: 'BOUNDARY',
  [GATE_CODES.TEAM_GROUP_ALREADY_MEMBER]: 'BOUNDARY',
  [GATE_CODES.TEAM_GROUP_NOT_EMPTY]: 'BOUNDARY',
};

/** The origin of one gate, or `undefined` when the code is not a gate. */
export const getGateOrigin = (code: unknown): GateOrigin | undefined =>
  typeof code === 'string' && Object.hasOwn(GATE_ORIGINS, code)
    ? GATE_ORIGINS[code as GateCode]
    : undefined;
