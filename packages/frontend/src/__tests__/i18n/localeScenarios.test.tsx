/**
 * Locale-specific test scenarios for i18n integration.
 *
 * Verifies that key UI elements render correctly across all supported locales
 * using parameterized tests. This catches missing translations, untranslated
 * keys, and locale-specific rendering issues.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';

import {
  initTestI18n,
  getTestI18nInstance,
  changeTestLanguage,
  getSupportedLocalesForTest,
} from '@/i18n/testConfig';
import {
  tInLocale,
  i18nMatchersForAllLocales,
  createLocaleTestHelper,
} from '@/test-utils/i18nHelpers';

import { EmptyState } from '@/components/EmptyState/EmptyState';

vi.mock('@/components/EmptyState/EmptyState.module.css', () => ({
  default: {
    'empty-state-container': 'empty-state-container',
    'empty-state-content': 'empty-state-content',
    'empty-state-icon': 'empty-state-icon',
    'empty-state-title': 'empty-state-title',
    'empty-state-description': 'empty-state-description',
    'empty-state-actions': 'empty-state-actions',
    'empty-state-button': 'empty-state-button',
    'button-primary': 'button-primary',
    'button-secondary': 'button-secondary',
    default: 'default',
    compact: 'compact',
    'full-page': 'full-page',
  },
}));

describe('i18n Locale-Specific Tests', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  describe('Translation Completeness', () => {
    const criticalKeys = [
      'common:save',
      'common:cancel',
      'common:delete',
      'common:edit',
      'common:loading',
      'common:search',
      'common:retry',
      'common:nav.dashboard',
      'common:nav.productGoals',
      'common:nav.productBacklog',
      'common:nav.sprintPlanning',
      'common:nav.activeSprint',
      'common:nav.dailyScrum',
      'common:nav.impediments',
      'common:nav.increments',
      'common:nav.sprintReview',
      'common:nav.retrospectives',
      'common:nav.reports',
      'common:nav.team',
      'common:nav.groups.product',
      'common:nav.groups.scrumEvents',
      'common:nav.mainNavigation',
      'common:nav.settings.teamsAndGroups',
      'common:nav.settings.teamManagement',
      'common:userMenu.privacyData',
      'common:accessDenied.title',
      'common:accessDenied.description',
      'common:accessDenied.action',
      'common:nav.settingsLabel',
    ];

    const locales = getSupportedLocalesForTest();

    locales.forEach((locale) => {
      describe(`Locale: ${locale}`, () => {
        criticalKeys.forEach((key) => {
          it(`should have a non-key translation for "${key}"`, () => {
            const translation = tInLocale(key, locale);
            // The translation should NOT equal the raw key (which would
            // indicate a missing translation)
            expect(translation).not.toBe(key);
            expect(translation.length).toBeGreaterThan(0);
          });
        });
      });
    });
  });

  describe('EmptyState renders in all locales', () => {
    const locales = getSupportedLocalesForTest();

    locales.forEach((locale) => {
      describe(`Locale: ${locale}`, () => {
        it('renders "no-team" type with translated text', async () => {
          await changeTestLanguage(locale);

          render(
            <I18nextProvider i18n={getTestI18nInstance()}>
              <MemoryRouter>
                <EmptyState type="no-team" />
              </MemoryRouter>
            </I18nextProvider>
          );

          const helper = createLocaleTestHelper(locale);
          const title = helper.t('emptyState.noTeam.title');
          const description = helper.t('emptyState.noTeam.description');

          expect(screen.getByText(title)).toBeInTheDocument();
          expect(screen.getByText(description)).toBeInTheDocument();
        });

        it('renders "no-active-goal" type with translated action button', async () => {
          await changeTestLanguage(locale);

          render(
            <I18nextProvider i18n={getTestI18nInstance()}>
              <MemoryRouter>
                <EmptyState type="no-active-goal" />
              </MemoryRouter>
            </I18nextProvider>
          );

          const helper = createLocaleTestHelper(locale);
          const actionLabel = helper.t('emptyState.noActiveGoal.action');

          expect(screen.getByRole('button', { name: actionLabel })).toBeInTheDocument();
        });
      });
    });
  });

  describe('Translation Key Consistency', () => {
    it('all locales have critical keys for common namespace', () => {
      const instance = getTestI18nInstance();
      const locales = getSupportedLocalesForTest();

      // Critical keys that MUST exist in all locales
      const criticalKeys = [
        'appName',
        'save',
        'cancel',
        'delete',
        'edit',
        'loading',
        'search',
        'retry',
        'confirm',
        'close',
        'nav',
        'userMenu',
        'error',
        'emptyState',
        'aria',
        'confirmDialog',
      ];

      for (const locale of locales) {
        const localeResource = instance.getResourceBundle(locale, 'common');
        const localeKeys = Object.keys(localeResource);

        for (const key of criticalKeys) {
          expect(localeKeys).toContain(key);
        }
      }
    });

    it('reports missing keys in non-English locales for common namespace', () => {
      const instance = getTestI18nInstance();
      const locales = getSupportedLocalesForTest();

      const enResource = instance.getResourceBundle('en', 'common');
      const enKeys = Object.keys(enResource);

      const missingByLocale: Record<string, string[]> = {};

      for (const locale of locales.filter((l) => l !== 'en')) {
        const localeResource = instance.getResourceBundle(locale, 'common');
        const localeKeys = new Set(Object.keys(localeResource));
        const missing = enKeys.filter((key) => !localeKeys.has(key));

        if (missing.length > 0) {
          missingByLocale[locale] = missing;
        }
      }

      // Log missing keys as a soft assertion (not a hard failure)
      // This helps track sync issues without blocking CI
      if (Object.keys(missingByLocale).length > 0) {
        console.warn('Missing i18n keys by locale:', JSON.stringify(missingByLocale, null, 2));
      }

      // Allow up to 5% missing keys (rough parity)
      for (const [_locale, missing] of Object.entries(missingByLocale)) {
        const missingRatio = missing.length / enKeys.length;
        expect(missingRatio).toBeLessThan(0.05);
      }
    });

    it('common action words differ across locales', () => {
      const matchers = i18nMatchersForAllLocales('common:save', getSupportedLocalesForTest());

      // Each locale should have a unique translation for "save"
      const values = Object.values(matchers);
      const uniqueValues = new Set(values);
      // At least some locales should differ (not all the same word)
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });
});
