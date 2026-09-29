/**
 * Unit tests for verify-gate-catalogue.mjs — Gate Catalogue Verification
 *
 * The parsers are covered with fixtures, and the checks are covered once against the repository
 * itself: a guard that silently stops parsing the contract would report success forever, so the
 * integration case asserts that every declared gate is found rather than only that no error was
 * raised.
 */

import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  collectGateLiterals,
  parseCatalogueRows,
  parseGateCodes,
  parseGateOrigins,
  parseReadmeTotals,
  verifyGateCatalogue,
} from '../verify-gate-catalogue.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const CODES_FIXTURE = `export const GATE_CODES = {
  /** A Sprint cannot close before its events. */
  SPRINT_EVENTS_MISSING: 'GATE_SPRINT_EVENTS_MISSING',
  /** Only Developers size work. */
  DEVELOPER_ONLY_SIZING: 'GATE_DEVELOPER_ONLY_SIZING',
} as const;`;

const DEFINITIONS_FIXTURE = `export const GATE_DEFINITIONS: Record<GateCode, GateDefinition> = {
  [GATE_CODES.SPRINT_EVENTS_MISSING]: {
    code: GATE_CODES.SPRINT_EVENTS_MISSING,
    httpStatus: 400,
    i18nKey: 'sprintEventsMissing',
  },
  [GATE_CODES.DEVELOPER_ONLY_SIZING]: {
    code: GATE_CODES.DEVELOPER_ONLY_SIZING,
    httpStatus: 403,
    i18nKey: 'developerOnlySizing',
  },
};`;

const ORIGINS_FIXTURE = `export const GATE_ORIGINS: Record<GateCode, GateOrigin> = {
  [GATE_CODES.SPRINT_EVENTS_MISSING]: 'GUIDE',
  [GATE_CODES.DEVELOPER_ONLY_SIZING]: 'GUIDE',
};`;

describe('parseGateCodes', () => {
  it('maps every declared name to its code', () => {
    const { codes } = parseGateCodes(CODES_FIXTURE);
    expect([...codes.entries()]).toEqual([
      ['SPRINT_EVENTS_MISSING', 'GATE_SPRINT_EVENTS_MISSING'],
      ['DEVELOPER_ONLY_SIZING', 'GATE_DEVELOPER_ONLY_SIZING'],
    ]);
  });

  it('reads the status and locale key of each definition', () => {
    const { definitions } = parseGateCodes(`${CODES_FIXTURE}\n${DEFINITIONS_FIXTURE}`);
    expect(definitions.get('GATE_SPRINT_EVENTS_MISSING')).toEqual({
      httpStatus: 400,
      i18nKey: 'sprintEventsMissing',
    });
    expect(definitions.get('GATE_DEVELOPER_ONLY_SIZING')).toEqual({
      httpStatus: 403,
      i18nKey: 'developerOnlySizing',
    });
  });

  it('ignores a definition whose code is not declared', () => {
    const orphan = DEFINITIONS_FIXTURE.replace(
      'GATE_CODES.DEVELOPER_ONLY_SIZING',
      'GATE_CODES.TEAM_SIZE_LIMIT'
    ).replace('developerOnlySizing', 'teamSizeLimit');
    const { definitions } = parseGateCodes(`${CODES_FIXTURE}\n${orphan}`);
    expect(definitions.has('GATE_TEAM_SIZE_LIMIT')).toBe(false);
  });

  it('finds nothing in a source it cannot parse', () => {
    const { codes, definitions } = parseGateCodes('export const GATE_CODES = {} as const;');
    expect(codes.size).toBe(0);
    expect(definitions.size).toBe(0);
  });
});

describe('parseGateOrigins', () => {
  const { codes } = parseGateCodes(CODES_FIXTURE);

  it('maps each gate code to the class of rule it enforces', () => {
    expect([...parseGateOrigins(ORIGINS_FIXTURE, codes).entries()]).toEqual([
      ['GATE_SPRINT_EVENTS_MISSING', 'GUIDE'],
      ['GATE_DEVELOPER_ONLY_SIZING', 'GUIDE'],
    ]);
  });

  it('rejects an origin outside the taxonomy', () => {
    const fixture = ORIGINS_FIXTURE.replace("'GUIDE',", "'NICE_TO_HAVE',");
    expect(parseGateOrigins(fixture, codes).has('GATE_SPRINT_EVENTS_MISSING')).toBe(false);
  });

  it('ignores a classification of a gate the contract does not declare', () => {
    const fixture = ORIGINS_FIXTURE.replace(
      '[GATE_CODES.DEVELOPER_ONLY_SIZING]',
      '[GATE_CODES.TEAM_SIZE_LIMIT]'
    );
    expect(parseGateOrigins(fixture, codes).has('GATE_TEAM_SIZE_LIMIT')).toBe(false);
  });
});

describe('parseCatalogueRows', () => {
  it('reads the code and published status of each table row', () => {
    const markdown = [
      '| Code | HTTP | Rule enforced |',
      '| ---- | ---- | ------------- |',
      '| `GATE_SPRINT_EVENTS_MISSING` | 400 | A Sprint cannot close early. |',
      '| `GATE_DOR_REQUIRED` | 400 | A team keeps one criterion. |',
    ].join('\n');
    const rows = parseCatalogueRows(markdown);
    expect(rows.get('GATE_SPRINT_EVENTS_MISSING')).toBe(400);
    expect(rows.get('GATE_DOR_REQUIRED')).toBe(400);
    expect(rows.size).toBe(2);
  });

  it('ignores codes mentioned in prose rather than tabled', () => {
    const rows = parseCatalogueRows('The codes are defined in `packages/shared/gateCodes.ts`.');
    expect(rows.size).toBe(0);
  });
});

describe('parseReadmeTotals', () => {
  it('reads the totals the README prints', () => {
    const markdown =
      'The contract holds **68** of them: 39 Guide gates, 5 complementary-practice gates and 24 process-integrity gates.';
    expect(parseReadmeTotals(markdown)).toEqual({
      total: 68,
      GUIDE: 39,
      COMPLEMENTARY: 5,
      BOUNDARY: 24,
    });
  });

  it('returns null when the sentence is gone', () => {
    expect(parseReadmeTotals('We enforce the Scrum Guide.')).toBeNull();
  });
});

describe('collectGateLiterals', () => {
  it('collects codes and wildcard families, and ignores the bare prefix', () => {
    const literals = collectGateLiterals(
      'The `GATE_*` value, the `GATE_DOR_*` rows, and `GATE_TEAM_SIZE_LIMIT` itself.'
    );
    expect(literals).toEqual(['GATE_*', 'GATE_DOR_*', 'GATE_TEAM_SIZE_LIMIT']);
  });
});

describe('verifyGateCatalogue', () => {
  it('finds every gate the contract declares', () => {
    const { errors, counts, total } = verifyGateCatalogue(REPO_ROOT);
    expect(errors).toEqual([]);
    expect(total).toBeGreaterThan(0);
    expect(counts.GUIDE + counts.COMPLEMENTARY + counts.BOUNDARY).toBe(total);
  });
});
