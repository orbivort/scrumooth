/**
 * What a criterion is shown as.
 *
 * Two rules have to hold at once and both failures are quiet. A criterion the team reworded must read
 * as the team wrote it, or a save that succeeded looks like a save that never landed -- which is the
 * state this surface was reported in. A criterion the team left alone must still resolve through its
 * key, or the four non-English locales are shown English.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { DOD_DEFAULTS, DOR_DEFAULTS } from '@scrumooth/shared';
import type { DefinitionType, Locale } from '@scrumooth/shared';

import { initTestI18n } from '../../../../test-utils';

import { criterionLabel } from './criterionLabel';

type TestI18n = Awaited<ReturnType<typeof initTestI18n>>;

// Assigned by the `beforeAll` below, which every assertion runs after: the helper takes the instance
// `initTestI18n` hands back rather than reaching for the module-level singleton, so the file proves
// its own setup instead of leaning on another file's.
let instance: TestI18n;

/** The seeded criterion a key names, so a test never restates the canonical wording by hand. */
const seedOf = (type: DefinitionType, key: string) => {
  const seeds = type === 'DOR' ? DOR_DEFAULTS : DOD_DEFAULTS;
  const seed = seeds.find((item) => item.key === key);

  if (!seed) {
    throw new Error(`The product seeds no ${type} criterion named ${key}`);
  }

  return seed;
};

/** `t` bound to the `settings` namespace in one locale, which is the shape a rendering component passes. */
const tFor = (locale: Locale): TFunction<'settings'> =>
  // i18next types `getFixedT` against its own resource map, which is not the compiled `settings`
  // namespace union; the cast keeps the helper's signature identical to a component's `t`.
  instance.getFixedT(locale, 'settings') as unknown as TFunction<'settings'>;

describe('criterionLabel', () => {
  beforeAll(async () => {
    instance = await initTestI18n();
  });

  it('translates a seeded criterion that still reads as the seed', () => {
    const label = criterionLabel(tFor('de'), 'DOR', {
      description: seedOf('DOR', 'clearTitle').description,
      defaultKey: 'clearTitle',
    });

    expect(label).toBe('Klarer Titel und Beschreibung bereitgestellt');
  });

  it('resolves each agreement from its own seed list', () => {
    // The same shape, a different scope: a Definition of Done key must not resolve through the
    // Definition of Ready's list, or one agreement is shown the other's wording.
    const label = criterionLabel(tFor('de'), 'DOD', {
      description: seedOf('DOD', 'documentation').description,
      defaultKey: 'documentation',
    });

    expect(label).toBe('Code ist ordnungsgemäß dokumentiert');
  });

  it('shows a seeded criterion the team reworded as the team wrote it', () => {
    const reworded = 'Titel und Beschreibung mit dem Product Owner abgestimmt';

    expect(
      criterionLabel(tFor('de'), 'DOR', { description: reworded, defaultKey: 'clearTitle' })
    ).toBe(reworded);
  });

  it('shows a reworded criterion as written even where the seed is in the same language', () => {
    // English is where a seed and its translation are one sentence, so nothing but the team's own
    // words can tell the two paths apart -- and those words are what must come back.
    const reworded = 'Story points agreed in Planning Poker';

    expect(
      criterionLabel(tFor('en'), 'DOR', {
        description: reworded,
        defaultKey: 'storyPointsEstimated',
      })
    ).toBe(reworded);
  });

  it('shows a criterion the team wrote itself exactly as it was written', () => {
    expect(
      criterionLabel(tFor('en'), 'DOD', {
        description: 'Shipped behind a feature flag',
        defaultKey: null,
      })
    ).toBe('Shipped behind a feature flag');
  });

  it('still translates a row written before the key existed', () => {
    const label = criterionLabel(tFor('de'), 'DOR', {
      description: seedOf('DOR', 'acceptanceCriteria').description,
      defaultKey: null,
    });

    expect(label).toBe('Akzeptanzkriterien definiert und vereinbart');
  });

  it('shows a legacy row the team reworded as the team wrote it', () => {
    const reworded = 'Unsere eigene Regel zur Akzeptanz';

    expect(criterionLabel(tFor('de'), 'DOR', { description: reworded, defaultKey: null })).toBe(
      reworded
    );
  });

  it('shows a criterion whose key is no longer seeded as written', () => {
    // A key can outlive its seed: the shared list changes, and a row keeps the key it was written
    // with. The row must not lose its wording to a lookup that no longer has an answer.
    const description = 'Criterion descending from a key the product no longer seeds';

    expect(
      criterionLabel(tFor('en'), 'DOR', { description, defaultKey: 'retiredReadinessCriterion' })
    ).toBe(description);
  });
});
