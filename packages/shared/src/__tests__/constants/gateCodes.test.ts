import { describe, it, expect } from 'vitest';
import {
  GATE_CODE_LIST,
  GATE_CODE_PREFIX,
  GATE_CODES,
  GATE_DEFINITIONS,
  GATE_I18N_NAMESPACE,
  getGateDefinition,
  isGateCode,
} from '../../constants/gateCodes.js';

describe('gateCodes', () => {
  it('should define thirty-six gates', () => {
    expect(GATE_CODE_LIST).toHaveLength(36);
  });

  it('should prefix every gate code with GATE_', () => {
    expect(GATE_CODE_LIST.every((code) => code.startsWith(GATE_CODE_PREFIX))).toBe(true);
  });

  it('should keep code values and definition keys aligned', () => {
    for (const code of GATE_CODE_LIST) {
      expect(GATE_DEFINITIONS[code].code).toBe(code);
    }
  });

  it('should give every gate an HTTP status and a locale key', () => {
    for (const code of GATE_CODE_LIST) {
      const definition = GATE_DEFINITIONS[code];
      expect([400, 403, 409]).toContain(definition.httpStatus);
      expect(definition.i18nKey.length).toBeGreaterThan(0);
    }
  });

  it('should expose a gate i18n namespace', () => {
    expect(GATE_I18N_NAMESPACE).toBe('gate');
  });

  it('should identify known gate codes', () => {
    expect(isGateCode(GATE_CODES.SPRINT_EVENTS_MISSING)).toBe(true);
    expect(isGateCode(GATE_CODES.IMPEDIMENTS_UNRESOLVED)).toBe(true);
    expect(isGateCode(GATE_CODES.PLANNING_PARTICIPATION_REQUIRED)).toBe(true);
    expect(isGateCode(GATE_CODES.CAPACITY_EXCEEDED)).toBe(true);
  });

  it('should refuse participation and capacity gates with HTTP 400', () => {
    expect(GATE_DEFINITIONS[GATE_CODES.PLANNING_PARTICIPATION_REQUIRED].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.PLANNING_PARTICIPATION_REQUIRED].i18nKey).toBe(
      'planningParticipationRequired'
    );
    expect(GATE_DEFINITIONS[GATE_CODES.CAPACITY_EXCEEDED].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.CAPACITY_EXCEEDED].i18nKey).toBe('capacityExceeded');
  });

  it('should refuse an unevidenced Daily Scrum adaptation with HTTP 400', () => {
    expect(isGateCode(GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED)).toBe(true);
    expect(GATE_DEFINITIONS[GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED].i18nKey).toBe(
      'dailyScrumAdaptationRequired'
    );
  });

  it('should identify the Sprint container, membership and goal gates', () => {
    expect(isGateCode(GATE_CODES.SPRINT_DURATION_LIMIT)).toBe(true);
    expect(isGateCode(GATE_CODES.SPRINT_DATES_OVERLAP)).toBe(true);
    expect(isGateCode(GATE_CODES.SPRINT_NOT_CONTIGUOUS)).toBe(true);
    expect(isGateCode(GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY)).toBe(true);
    expect(isGateCode(GATE_CODES.SPRINT_GOAL_LOCKED)).toBe(true);
    expect(isGateCode(GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO)).toBe(true);
    expect(isGateCode(GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING)).toBe(true);
  });

  it('should refuse container and membership gates with the documented status', () => {
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_DURATION_LIMIT].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_DURATION_LIMIT].i18nKey).toBe('sprintDurationLimit');
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_DATES_OVERLAP].httpStatus).toBe(409);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_DATES_OVERLAP].i18nKey).toBe('sprintDatesOverlap');
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_NOT_CONTIGUOUS].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_NOT_CONTIGUOUS].i18nKey).toBe('sprintNotContiguous');
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY].httpStatus).toBe(403);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY].i18nKey).toBe(
      'sprintTeamMembersOnly'
    );
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_GOAL_LOCKED].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_GOAL_LOCKED].i18nKey).toBe('sprintGoalLocked');
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO].httpStatus).toBe(403);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO].i18nKey).toBe(
      'sprintScopeChangeNeedsPo'
    );
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING].httpStatus).toBe(409);
    expect(GATE_DEFINITIONS[GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING].i18nKey).toBe(
      'sprintScopeChangeAlreadyPending'
    );
  });

  it('should identify the Definition of Done commitment gates', () => {
    expect(isGateCode(GATE_CODES.DOD_REQUIRED)).toBe(true);
    expect(isGateCode(GATE_CODES.DOD_TEAM_MEMBERS_ONLY)).toBe(true);
    expect(GATE_DEFINITIONS[GATE_CODES.DOD_REQUIRED].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.DOD_REQUIRED].i18nKey).toBe('dodRequired');
    expect(GATE_DEFINITIONS[GATE_CODES.DOD_TEAM_MEMBERS_ONLY].httpStatus).toBe(403);
    expect(GATE_DEFINITIONS[GATE_CODES.DOD_TEAM_MEMBERS_ONLY].i18nKey).toBe('dodTeamMembersOnly');
  });

  it('should identify the Increment ownership, usability and lifecycle gates', () => {
    expect(isGateCode(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY)).toBe(true);
    expect(isGateCode(GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED)).toBe(true);
    expect(isGateCode(GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED)).toBe(true);
    expect(isGateCode(GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED)).toBe(true);
  });

  it('should refuse Increment membership with 403 and the evidence gates with 400', () => {
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY].httpStatus).toBe(403);
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY].i18nKey).toBe(
      'incrementTeamMembersOnly'
    );
    expect(
      GATE_DEFINITIONS[GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED].httpStatus
    ).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED].i18nKey).toBe(
      'incrementIntegrationVerificationRequired'
    );
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED].httpStatus).toBe(
      400
    );
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED].i18nKey).toBe(
      'incrementUsabilityAttestationRequired'
    );
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED].httpStatus).toBe(400);
    expect(GATE_DEFINITIONS[GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED].i18nKey).toBe(
      'incrementDeliveryMethodRequired'
    );
  });

  it('should reject unknown or non-string values', () => {
    expect(isGateCode('FORBIDDEN')).toBe(false);
    expect(isGateCode('GATE_UNKNOWN')).toBe(false);
    expect(isGateCode(undefined)).toBe(false);
    expect(isGateCode(42)).toBe(false);
  });

  it('should resolve a definition for a known gate code', () => {
    expect(getGateDefinition(GATE_CODES.INCREMENT_LOCKED)).toEqual(
      GATE_DEFINITIONS[GATE_CODES.INCREMENT_LOCKED]
    );
  });

  it('should return undefined for an unknown code', () => {
    expect(getGateDefinition('NOT_A_GATE')).toBeUndefined();
  });
});
