import { describe, it, expect } from 'vitest';
import { GATE_CODE_LIST, GATE_CODES, GATE_DEFINITIONS } from '../../constants/gateCodes.js';
import { GATE_ORIGINS, GATE_ORIGIN_LIST, getGateOrigin } from '../../constants/gateOrigins.js';

describe('gateOrigins', () => {
  it('should classify every gate and no others', () => {
    expect(Object.keys(GATE_ORIGINS).sort()).toEqual([...GATE_CODE_LIST].sort());
  });

  it('should classify the contract the definitions describe', () => {
    // The two `Record<GateCode, …>` maps are independent, so one can gain a gate the other misses
    // without the compiler noticing; this is the pair that has to stay in step.
    expect(Object.keys(GATE_ORIGINS).sort()).toEqual(Object.keys(GATE_DEFINITIONS).sort());
  });

  it('should use only declared origins', () => {
    for (const origin of Object.values(GATE_ORIGINS)) {
      expect(GATE_ORIGIN_LIST).toContain(origin);
    }
  });

  it('should declare each origin once', () => {
    expect(new Set(GATE_ORIGIN_LIST).size).toBe(GATE_ORIGIN_LIST.length);
  });

  it('should classify the readiness agreement as a complementary practice', () => {
    // The Definition of Ready is not a 2020 Scrum Guide artifact, so neither is any gate that
    // governs it -- including the ones that only decide who may read or edit the agreement.
    expect(GATE_ORIGINS[GATE_CODES.DOR_REQUIRED]).toBe('COMPLEMENTARY');
    expect(GATE_ORIGINS[GATE_CODES.DOR_NOT_VERIFIED]).toBe('COMPLEMENTARY');
    expect(GATE_ORIGINS[GATE_CODES.DOR_TEAM_MEMBERS_ONLY]).toBe('COMPLEMENTARY');
    expect(GATE_ORIGINS[GATE_CODES.DOR_SCRUM_MASTER_ONLY]).toBe('COMPLEMENTARY');
    expect(GATE_ORIGINS[GATE_CODES.PBI_NOT_READY]).toBe('COMPLEMENTARY');
  });

  it('should classify membership and candid surfaces as boundaries', () => {
    expect(GATE_ORIGINS[GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY]).toBe('BOUNDARY');
    expect(GATE_ORIGINS[GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY]).toBe('BOUNDARY');
    expect(GATE_ORIGINS[GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY]).toBe('BOUNDARY');
    expect(GATE_ORIGINS[GATE_CODES.COACHING_SM_ONLY]).toBe('BOUNDARY');
    expect(GATE_ORIGINS[GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY]).toBe('BOUNDARY');
    expect(GATE_ORIGINS[GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY]).toBe('BOUNDARY');
  });

  it('should classify the process rules themselves as Guide gates', () => {
    expect(GATE_ORIGINS[GATE_CODES.SPRINT_EVENTS_MISSING]).toBe('GUIDE');
    expect(GATE_ORIGINS[GATE_CODES.DEVELOPER_ONLY_SIZING]).toBe('GUIDE');
    expect(GATE_ORIGINS[GATE_CODES.SPRINT_GOAL_LOCKED]).toBe('GUIDE');
    expect(GATE_ORIGINS[GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED]).toBe('GUIDE');
    expect(GATE_ORIGINS[GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED]).toBe('GUIDE');
  });

  it('should resolve one gate by code', () => {
    expect(getGateOrigin(GATE_CODES.SPRINT_EVENTS_MISSING)).toBe('GUIDE');
  });

  it('should not resolve a value that is not a gate', () => {
    expect(getGateOrigin('GATE_UNKNOWN')).toBeUndefined();
    expect(getGateOrigin('constructor')).toBeUndefined();
    expect(getGateOrigin(undefined)).toBeUndefined();
    expect(getGateOrigin(42)).toBeUndefined();
  });
});
