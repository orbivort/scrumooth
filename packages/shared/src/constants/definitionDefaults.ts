import type { DefinitionDefaultItem } from '../types/index.js';

/**
 * What the product seeds into a brand new Definition of Done.
 *
 * This is the single source of truth for "a built-in criterion": the service that creates an
 * agreement seeds from it, the migration that added `defaultKey` backfilled existing rows from it,
 * and the interface resolves a seeded criterion's wording from it. Keeping one list is what makes
 * the claim durable -- the previous arrangement translated a seeded criterion by matching its
 * English sentence, so polishing that sentence silently dropped the translation in all five
 * languages, and a re-seeded list would have silently stopped matching.
 *
 * `description` is the canonical English wording and is what a team sees when it has no translation
 * for a locale, so it is stored on the row as well as declared here. `i18nKey` is the translation
 * key under the frontend's `settings` namespace.
 */
export const DOD_DEFAULTS: readonly DefinitionDefaultItem[] = [
  {
    key: 'codeReviewed',
    description: 'Code is peer-reviewed and approved',
    category: 'review',
    i18nKey: 'dodPanel.item.codeReviewed',
  },
  {
    key: 'unitTests',
    description: 'Unit tests written and passing (minimum 80% coverage)',
    category: 'testing',
    i18nKey: 'dodPanel.item.unitTests',
  },
  {
    key: 'integrationTests',
    description: 'Integration tests passing',
    category: 'testing',
    i18nKey: 'dodPanel.item.integrationTests',
  },
  {
    key: 'documentation',
    description: 'Code is properly documented',
    category: 'documentation',
    i18nKey: 'dodPanel.item.documentation',
  },
  {
    key: 'noCriticalBugs',
    description: 'No critical or high-severity bugs',
    category: 'quality',
    i18nKey: 'dodPanel.item.noCriticalBugs',
  },
];

/**
 * What the product seeds into a brand new Definition of Ready.
 *
 * The readiness agreement is a complementary practice rather than a Guide artifact, but it is
 * enforced at the Sprint boundary and maintained by the team's Scrum Master, so its criteria need
 * the same stable identity as the Definition of Done's.
 */
export const DOR_DEFAULTS: readonly DefinitionDefaultItem[] = [
  {
    key: 'clearTitle',
    description: 'Clear title and description provided',
    category: 'acceptance',
    i18nKey: 'dorPanel.item.clearTitle',
  },
  {
    key: 'acceptanceCriteria',
    description: 'Acceptance criteria defined and agreed',
    category: 'acceptance',
    i18nKey: 'dorPanel.item.acceptanceCriteria',
  },
  {
    key: 'storyPointsEstimated',
    description: 'Story points estimated by the team',
    category: 'estimation',
    i18nKey: 'dorPanel.item.storyPointsEstimated',
  },
  {
    key: 'businessValue',
    description: 'Business value assigned',
    category: 'estimation',
    i18nKey: 'dorPanel.item.businessValue',
  },
  {
    key: 'dependencies',
    description: 'Dependencies identified and documented',
    category: 'dependencies',
    i18nKey: 'dorPanel.item.dependencies',
  },
  {
    key: 'noBlockers',
    description: 'No blockers or impediments',
    category: 'dependencies',
    i18nKey: 'dorPanel.item.noBlockers',
  },
];

/** The two agreements the product seeds criteria into. */
export type DefinitionType = 'DOD' | 'DOR';

/** The seeded criteria of one agreement. */
export function definitionDefaults(type: DefinitionType): readonly DefinitionDefaultItem[] {
  return type === 'DOD' ? DOD_DEFAULTS : DOR_DEFAULTS;
}

/**
 * The seeded criterion a stored English description corresponds to.
 *
 * Exists only for rows written before `defaultKey` did -- a criterion stored by an installation that
 * predates the column carries no key, and this is how the interface still shows it in the reader's
 * language. A criterion a team wrote itself matches nothing, which is correct: it is shown exactly
 * as it was written.
 *
 * @deprecated Remove once no stored criterion can lack a `defaultKey`.
 */
export function findDefaultByDescription(
  type: DefinitionType,
  description: string
): DefinitionDefaultItem | undefined {
  return definitionDefaults(type).find((item) => item.description === description);
}

/** The seeded criterion a stable key names, or undefined for a key no longer seeded. */
export function findDefaultByKey(
  type: DefinitionType,
  key: string
): DefinitionDefaultItem | undefined {
  return definitionDefaults(type).find((item) => item.key === key);
}
