#!/usr/bin/env node

/**
 * Gate Catalogue Verification
 *
 * Scrumooth's positioning is a claim about completeness: "if a rule is not enforced in that
 * catalogue, Scrumooth does not enforce it". That claim is only worth making if it cannot rot, so
 * this script is the guard that keeps the four surfaces that narrate the contract in step:
 *
 * 1. `packages/shared/src/constants/gateCodes.ts` — the contract itself (codes + statuses)
 * 2. `packages/shared/src/constants/gateOrigins.ts` — the class of rule each gate belongs to
 * 3. `docs/api/README.md` — the code-by-code catalogue (the published source of truth)
 * 4. `README*.md` — the rule-level summary, which states the totals and names classes, never codes
 *
 * Validates (exits with code 1 on failure):
 * 1. Every gate code has a contract entry, and every contract entry has a code
 * 2. Every gate code is classified, and nothing else is
 * 3. Every gate code appears in the published catalogue, with the status the contract declares
 * 4. The catalogue names no gate the contract does not define
 * 5. The README states no individual gate code (the summary stays at rule level)
 * 6. The README's totals match the contract, per class
 * 7. Every localized README delegates to the published catalogue
 *
 * Usage:
 *   node scripts/maintenance/verify-gate-catalogue.mjs
 *   pnpm run gates:verify
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const GATE_CODES_PATH = 'packages/shared/src/constants/gateCodes.ts';
const GATE_ORIGINS_PATH = 'packages/shared/src/constants/gateOrigins.ts';
const CATALOGUE_PATH = 'docs/api/README.md';
const CATALOGUE_ANCHOR = 'docs/api/README.md#gate-rejections';
const README_PATHS = ['README.md', 'README.de.md', 'README.es.md', 'README.fr.md', 'README.it.md'];

const ORIGIN_SUMMARY_LABELS = {
  GUIDE: 'Guide gates',
  COMPLEMENTARY: 'Complementary-practice gates',
  BOUNDARY: 'Process-integrity gates',
};

/** Matches a declaration line in the `GATE_CODES` block. */
const CODES_PATTERN = /^ {2}([A-Z][A-Z0-9_]*): '(GATE_[A-Z0-9_]+)',$/gm;

/** Matches one entry of the `GATE_DEFINITIONS` map, capturing its status and locale key. */
const DEFINITIONS_PATTERN =
  /\[GATE_CODES\.([A-Z0-9_]+)\]:\s*\{\s*code:\s*GATE_CODES\.\1,\s*httpStatus:\s*(\d+),\s*i18nKey:\s*'([^']+)',/g;

/** Matches one entry of the `GATE_ORIGINS` map. */
const ORIGINS_PATTERN = /^ {2}\[GATE_CODES\.([A-Z0-9_]+)\]: '(GUIDE|COMPLEMENTARY|BOUNDARY)',$/gm;

/** Matches the "totals" sentence the README prints, in its two halves. */
const README_TOTAL_PATTERN = /\*\*(\d+)\*\* of them/;
const README_CLASS_PATTERN =
  /(\d+) Guide gates, (\d+) complementary-practice gates and (\d+) process-integrity gates/;

/**
 * A gate code mentioned in prose, plus any wildcard family reference such as `GATE_*` or
 * `GATE_DOR_*`.
 *
 * A family reference names a prefix rather than a gate, so it is collected but not checked for
 * existence — `docs/api/README.md` legitimately says "the `GATE_DOR_*` rows".
 */
export function collectGateLiterals(text) {
  return [...text.matchAll(/GATE_[A-Z0-9_]*\*?/g)]
    .map((match) => match[0])
    .filter((literal) => literal !== 'GATE_');
}

function isFamilyReference(literal) {
  return literal.endsWith('*');
}

/**
 * Parse the gate contract: the codes it declares and the entries that describe them.
 *
 * @param {string} source contents of `gateCodes.ts`
 * @returns {{ codes: Map<string, string>, definitions: Map<string, {httpStatus: number, i18nKey: string}> }}
 */
export function parseGateCodes(source) {
  const codes = new Map();
  for (const [, name, code] of source.matchAll(CODES_PATTERN)) {
    codes.set(name, code);
  }

  const definitions = new Map();
  for (const [, name, httpStatus, i18nKey] of source.matchAll(DEFINITIONS_PATTERN)) {
    const code = codes.get(name);
    if (code === undefined) {
      continue;
    }
    definitions.set(code, { httpStatus: Number(httpStatus), i18nKey });
  }

  return { codes, definitions };
}

/**
 * Parse the taxonomy: which class of rule each gate belongs to.
 *
 * The map is keyed by the `GATE_CODES` name, so it is translated to gate codes on the way out —
 * the two files agree on the names, and the codes are what every other check compares.
 *
 * @param {string} source contents of `gateOrigins.ts`
 * @param {Map<string, string>} codes gate name to gate code, from `parseGateCodes`
 * @returns {Map<string, 'GUIDE'|'COMPLEMENTARY'|'BOUNDARY'>} keyed by gate code
 */
export function parseGateOrigins(source, codes) {
  const origins = new Map();
  for (const [, name, origin] of source.matchAll(ORIGINS_PATTERN)) {
    const code = codes.get(name);
    if (code === undefined) {
      continue;
    }
    origins.set(code, origin);
  }
  return origins;
}

/**
 * Parse the published catalogue table from the API reference.
 *
 * @param {string} markdown contents of `docs/api/README.md`
 * @returns {Map<string, number>} gate code to the HTTP status the table publishes
 */
export function parseCatalogueRows(markdown) {
  const rows = new Map();
  for (const [, code, status] of markdown.matchAll(
    /^\|\s*`(GATE_[A-Z0-9_]+)`\s*\|\s*(\d{3})\s*\|/gm
  )) {
    rows.set(code, Number(status));
  }
  return rows;
}

/**
 * Parse the totals the README prints, or null when the sentence is gone.
 *
 * @param {string} markdown contents of `README.md`
 * @returns {{ total: number, GUIDE: number, COMPLEMENTARY: number, BOUNDARY: number } | null}
 */
export function parseReadmeTotals(markdown) {
  const total = markdown.match(README_TOTAL_PATTERN);
  const classes = markdown.match(README_CLASS_PATTERN);
  if (total === null || classes === null) {
    return null;
  }
  return {
    total: Number(total[1]),
    GUIDE: Number(classes[1]),
    COMPLEMENTARY: Number(classes[2]),
    BOUNDARY: Number(classes[3]),
  };
}

/**
 * Compare the four surfaces and collect every disagreement.
 *
 * @param {string} rootDir repository root
 * @returns {{ errors: string[], counts: Record<string, number>, total: number }}
 */
export function verifyGateCatalogue(rootDir) {
  const errors = [];
  const read = (relativePath) => {
    const absolutePath = join(rootDir, relativePath);
    if (!existsSync(absolutePath)) {
      errors.push(`missing file: ${relativePath}`);
      return '';
    }
    return readFileSync(absolutePath, 'utf-8');
  };

  const { codes, definitions } = parseGateCodes(read(GATE_CODES_PATH));
  const origins = parseGateOrigins(read(GATE_ORIGINS_PATH), codes);
  const catalogueMarkdown = read(CATALOGUE_PATH);
  const catalogueRows = parseCatalogueRows(catalogueMarkdown);
  const declaredCodes = [...codes.values()];

  if (declaredCodes.length === 0) {
    errors.push(`no gate codes parsed from ${GATE_CODES_PATH} — the parser is stale`);
  }

  // 1. Contract self-consistency.
  for (const code of declaredCodes) {
    if (!definitions.has(code)) {
      errors.push(`${code} has no entry in GATE_DEFINITIONS`);
    }
  }
  if (definitions.size !== declaredCodes.length) {
    errors.push(
      `GATE_DEFINITIONS holds ${definitions.size} entries for ${declaredCodes.length} codes`
    );
  }

  // 2. Taxonomy completeness, both directions.
  for (const code of declaredCodes) {
    if (!origins.has(code)) {
      errors.push(`${code} is not classified in ${GATE_ORIGINS_PATH}`);
    }
  }
  for (const code of origins.keys()) {
    if (!declaredCodes.includes(code)) {
      errors.push(`${code} is classified but not defined in ${GATE_CODES_PATH}`);
    }
  }

  // 3. Published catalogue completeness and status agreement.
  for (const code of declaredCodes) {
    const row = catalogueRows.get(code);
    if (row === undefined) {
      errors.push(`${code} is missing from the catalogue in ${CATALOGUE_PATH}`);
      continue;
    }
    const declaredStatus = definitions.get(code)?.httpStatus;
    if (row !== declaredStatus) {
      errors.push(
        `${code} is published as HTTP ${row} but the contract declares ${declaredStatus}`
      );
    }
  }

  // 4. The catalogue names no gate the contract does not define.
  for (const literal of collectGateLiterals(catalogueMarkdown)) {
    if (!isFamilyReference(literal) && !catalogueRows.has(literal)) {
      errors.push(`${CATALOGUE_PATH} names ${literal}, which is not defined in the contract`);
    }
  }

  // 5. The rule-level README names no individual code.
  for (const relativePath of README_PATHS) {
    if (!existsSync(join(rootDir, relativePath))) {
      continue;
    }
    const markdown = read(relativePath);
    for (const literal of collectGateLiterals(markdown)) {
      if (isFamilyReference(literal)) {
        continue;
      }
      errors.push(`${relativePath} names the gate code ${literal}; the summary stays rule-level`);
    }
  }

  // 6. The totals the README prints agree with the taxonomy.
  const counts = { GUIDE: 0, COMPLEMENTARY: 0, BOUNDARY: 0 };
  for (const code of declaredCodes) {
    const origin = origins.get(code);
    if (origin !== undefined) {
      counts[origin] += 1;
    }
  }

  const readmeMarkdown = read(README_PATHS[0]);
  const totals = parseReadmeTotals(readmeMarkdown);
  if (totals === null) {
    errors.push(
      `${README_PATHS[0]} no longer carries the countable totals sentence; restore it or update the patterns in this script`
    );
  } else {
    if (totals.total !== declaredCodes.length) {
      errors.push(
        `${README_PATHS[0]} claims ${totals.total} refusal codes; the contract defines ${declaredCodes.length}`
      );
    }
    for (const origin of Object.keys(counts)) {
      if (totals[origin] !== counts[origin]) {
        errors.push(
          `${README_PATHS[0]} claims ${totals[origin]} ${origin} gates; the taxonomy holds ${counts[origin]}`
        );
      }
    }
  }

  // 7. Every translation delegates to the published catalogue.
  for (const relativePath of README_PATHS) {
    if (!existsSync(join(rootDir, relativePath))) {
      errors.push(`missing README translation: ${relativePath}`);
      continue;
    }
    if (!read(relativePath).includes(CATALOGUE_ANCHOR)) {
      errors.push(`${relativePath} does not link to ${CATALOGUE_ANCHOR}`);
    }
  }

  return { errors, counts, total: declaredCodes.length };
}

function main() {
  const { errors, counts, total } = verifyGateCatalogue(process.cwd());

  console.log('');
  console.log('Gate catalogue');
  console.log('--------------');
  for (const [origin, count] of Object.entries(counts)) {
    console.log(`  ${ORIGIN_SUMMARY_LABELS[origin] ?? origin}: ${count}`);
  }
  console.log(`  Total refusal codes: ${total}`);
  console.log('');

  if (errors.length > 0) {
    console.error(`❌ Gate catalogue check failed with ${errors.length} problem(s):`);
    for (const error of errors) {
      console.error(`   - ${error}`);
    }
    console.error('');
    process.exit(1);
  }

  console.log('✅ Gate catalogue is consistent across the contract, the taxonomy and the docs.');
  console.log('');
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main();
}
