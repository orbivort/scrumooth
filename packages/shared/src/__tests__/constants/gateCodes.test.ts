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
  it('should define ten gates', () => {
    expect(GATE_CODE_LIST).toHaveLength(10);
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
