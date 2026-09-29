// The categories a criterion can carry, for both agreements.
//
// One set with a discriminator rather than two parallel lists. The two lists were structurally
// identical and differed only in values, so nothing stopped a caller from handing the readiness
// categories to the Definition of Done editor -- the labels would have been wrong, the saved values
// would have been valid strings, and no type would have objected. The discriminator makes that
// combination unrepresentable, and `categoriesFor` is the only way to get a list.
//
// There is deliberately no `label` field: a category's human-readable name is a translation, resolved
// from its value under `definitionEditor.dodCategories.*` / `definitionEditor.dorCategories.*`. A
// second English name here would be a string that no locale can reach.
import type { CSSProperties } from 'react';
import type { DefinitionType } from '@scrumooth/shared';

export interface CategoryConfig {
  /** Which agreement this category belongs to. */
  scope: DefinitionType;
  /** The value the API stores, and the suffix of the translation key that names it. */
  value: string;
  icon: string;
  color: {
    backgroundColor: string;
    color: string;
  };
}

/**
 * The Definition of Done's categories.
 *
 * They follow the quality measures a criterion can be about -- how the work was reviewed, tested,
 * documented, delivered and judged -- rather than the work itself.
 */
const DOD_CATEGORY_VALUES: readonly CategoryConfig[] = [
  {
    scope: 'DOD',
    value: 'quality',
    icon: '✓',
    color: { backgroundColor: '#D1FAE5', color: '#065F46' },
  },
  {
    scope: 'DOD',
    value: 'testing',
    icon: '🧪',
    color: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  },
  {
    scope: 'DOD',
    value: 'documentation',
    icon: '📄',
    color: { backgroundColor: '#FEF3C7', color: '#92400E' },
  },
  {
    scope: 'DOD',
    value: 'deployment',
    icon: '🚀',
    color: { backgroundColor: '#FCE7F3', color: '#9D174D' },
  },
  {
    scope: 'DOD',
    value: 'review',
    icon: '👀',
    color: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  },
];

/**
 * The Definition of Ready's categories.
 *
 * They follow what makes an item plannable -- that it is understood, agreed, estimated, unblocked
 * and worth doing -- which is why they share no value with the Definition of Done's set.
 */
const DOR_CATEGORY_VALUES: readonly CategoryConfig[] = [
  {
    scope: 'DOR',
    value: 'clarity',
    icon: '📝',
    color: { backgroundColor: '#E0F2FE', color: '#0369A1' },
  },
  {
    scope: 'DOR',
    value: 'acceptance',
    icon: '✓',
    color: { backgroundColor: '#D1FAE5', color: '#065F46' },
  },
  {
    scope: 'DOR',
    value: 'estimation',
    icon: '📊',
    color: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  },
  {
    scope: 'DOR',
    value: 'dependencies',
    icon: '🔗',
    color: { backgroundColor: '#FEF3C7', color: '#92400E' },
  },
  {
    scope: 'DOR',
    value: 'technical',
    icon: '⚙️',
    color: { backgroundColor: '#E5E7EB', color: '#374151' },
  },
  {
    scope: 'DOR',
    value: 'value',
    icon: '💎',
    color: { backgroundColor: '#FCE7F3', color: '#9D174D' },
  },
];

/** Every category, both agreements. The single declaration the two lists above are halves of. */
export const DEFINITION_CATEGORIES: readonly CategoryConfig[] = [
  ...DOD_CATEGORY_VALUES,
  ...DOR_CATEGORY_VALUES,
];

// Precomputed so the reference a renderer receives is stable: a fresh array per render would make
// every `useMemo` that depends on it recompute for nothing.
const CATEGORIES_BY_SCOPE: Record<DefinitionType, readonly CategoryConfig[]> = {
  DOD: DEFINITION_CATEGORIES.filter((category) => category.scope === 'DOD'),
  DOR: DEFINITION_CATEGORIES.filter((category) => category.scope === 'DOR'),
};

/** The categories of one agreement, in declaration order. */
export function categoriesFor(scope: DefinitionType): readonly CategoryConfig[] {
  return CATEGORIES_BY_SCOPE[scope];
}

/** The category a stored value names, or undefined when it names none this product declares. */
export function findCategory(
  scope: DefinitionType,
  value: string | null | undefined
): CategoryConfig | undefined {
  if (!value) {
    return undefined;
  }

  return categoriesFor(scope).find((category) => category.value === value);
}

const UNCATEGORISED_COLOR: CSSProperties = {
  backgroundColor: '#F3F4F6',
  color: '#374151',
};

/**
 * The chip colour for a stored category value.
 *
 * A value this product does not declare -- one written by an older seed, or by an installation that
 * added one -- falls back to a neutral chip rather than rendering nothing, because a criterion with an
 * unrecognised category is still a criterion.
 */
export function getCategoryColor(
  value: string | null | undefined,
  scope: DefinitionType
): CSSProperties {
  return findCategory(scope, value)?.color ?? UNCATEGORISED_COLOR;
}
