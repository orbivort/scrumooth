/**
 * Test-friendly i18next configuration.
 *
 * Loads translations directly from JSON files (no HTTP backend),
 * making i18n work in Vitest / jsdom without a running server.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@scrumooth/shared';

import enCommon from '../../public/locales/en/common.json';
import enAuth from '../../public/locales/en/auth.json';
import enDashboard from '../../public/locales/en/dashboard.json';
import enBacklog from '../../public/locales/en/backlog.json';
import enSprint from '../../public/locales/en/sprint.json';
import enDailyScrum from '../../public/locales/en/daily-scrum.json';
import enImpediments from '../../public/locales/en/impediments.json';
import enIncrements from '../../public/locales/en/increments.json';
import enSprintReview from '../../public/locales/en/sprint-review.json';
import enRetrospective from '../../public/locales/en/retrospective.json';
import enReports from '../../public/locales/en/reports.json';
import enTeam from '../../public/locales/en/team.json';
import enSettings from '../../public/locales/en/settings.json';
import enNotifications from '../../public/locales/en/notifications.json';
import enErrors from '../../public/locales/en/errors.json';
import enValidation from '../../public/locales/en/validation.json';
import enScrumMasterDashboard from '../../public/locales/en/scrum-master-dashboard.json';
import enTimebox from '../../public/locales/en/timebox.json';
import enBarriers from '../../public/locales/en/barriers.json';
import enAgreements from '../../public/locales/en/agreements.json';
import enGate from '../../public/locales/en/gate.json';
import deCommon from '../../public/locales/de/common.json';
import deAuth from '../../public/locales/de/auth.json';
import deDashboard from '../../public/locales/de/dashboard.json';
import deBacklog from '../../public/locales/de/backlog.json';
import deSprint from '../../public/locales/de/sprint.json';
import deDailyScrum from '../../public/locales/de/daily-scrum.json';
import deImpediments from '../../public/locales/de/impediments.json';
import deIncrements from '../../public/locales/de/increments.json';
import deSprintReview from '../../public/locales/de/sprint-review.json';
import deRetrospective from '../../public/locales/de/retrospective.json';
import deReports from '../../public/locales/de/reports.json';
import deTeam from '../../public/locales/de/team.json';
import deSettings from '../../public/locales/de/settings.json';
import deNotifications from '../../public/locales/de/notifications.json';
import deErrors from '../../public/locales/de/errors.json';
import deValidation from '../../public/locales/de/validation.json';
import deScrumMasterDashboard from '../../public/locales/de/scrum-master-dashboard.json';
import deTimebox from '../../public/locales/de/timebox.json';
import deBarriers from '../../public/locales/de/barriers.json';
import deAgreements from '../../public/locales/de/agreements.json';
import deGate from '../../public/locales/de/gate.json';
import frCommon from '../../public/locales/fr/common.json';
import frAuth from '../../public/locales/fr/auth.json';
import frDashboard from '../../public/locales/fr/dashboard.json';
import frBacklog from '../../public/locales/fr/backlog.json';
import frSprint from '../../public/locales/fr/sprint.json';
import frDailyScrum from '../../public/locales/fr/daily-scrum.json';
import frImpediments from '../../public/locales/fr/impediments.json';
import frIncrements from '../../public/locales/fr/increments.json';
import frSprintReview from '../../public/locales/fr/sprint-review.json';
import frRetrospective from '../../public/locales/fr/retrospective.json';
import frReports from '../../public/locales/fr/reports.json';
import frTeam from '../../public/locales/fr/team.json';
import frSettings from '../../public/locales/fr/settings.json';
import frNotifications from '../../public/locales/fr/notifications.json';
import frErrors from '../../public/locales/fr/errors.json';
import frValidation from '../../public/locales/fr/validation.json';
import frScrumMasterDashboard from '../../public/locales/fr/scrum-master-dashboard.json';
import frTimebox from '../../public/locales/fr/timebox.json';
import frBarriers from '../../public/locales/fr/barriers.json';
import frAgreements from '../../public/locales/fr/agreements.json';
import frGate from '../../public/locales/fr/gate.json';
import esCommon from '../../public/locales/es/common.json';
import esAuth from '../../public/locales/es/auth.json';
import esDashboard from '../../public/locales/es/dashboard.json';
import esBacklog from '../../public/locales/es/backlog.json';
import esSprint from '../../public/locales/es/sprint.json';
import esDailyScrum from '../../public/locales/es/daily-scrum.json';
import esImpediments from '../../public/locales/es/impediments.json';
import esIncrements from '../../public/locales/es/increments.json';
import esSprintReview from '../../public/locales/es/sprint-review.json';
import esRetrospective from '../../public/locales/es/retrospective.json';
import esReports from '../../public/locales/es/reports.json';
import esTeam from '../../public/locales/es/team.json';
import esSettings from '../../public/locales/es/settings.json';
import esNotifications from '../../public/locales/es/notifications.json';
import esErrors from '../../public/locales/es/errors.json';
import esValidation from '../../public/locales/es/validation.json';
import esScrumMasterDashboard from '../../public/locales/es/scrum-master-dashboard.json';
import esTimebox from '../../public/locales/es/timebox.json';
import esBarriers from '../../public/locales/es/barriers.json';
import esAgreements from '../../public/locales/es/agreements.json';
import esGate from '../../public/locales/es/gate.json';
import itCommon from '../../public/locales/it/common.json';
import itAuth from '../../public/locales/it/auth.json';
import itDashboard from '../../public/locales/it/dashboard.json';
import itBacklog from '../../public/locales/it/backlog.json';
import itSprint from '../../public/locales/it/sprint.json';
import itDailyScrum from '../../public/locales/it/daily-scrum.json';
import itImpediments from '../../public/locales/it/impediments.json';
import itIncrements from '../../public/locales/it/increments.json';
import itSprintReview from '../../public/locales/it/sprint-review.json';
import itRetrospective from '../../public/locales/it/retrospective.json';
import itReports from '../../public/locales/it/reports.json';
import itTeam from '../../public/locales/it/team.json';
import itSettings from '../../public/locales/it/settings.json';
import itNotifications from '../../public/locales/it/notifications.json';
import itErrors from '../../public/locales/it/errors.json';
import itValidation from '../../public/locales/it/validation.json';
import itScrumMasterDashboard from '../../public/locales/it/scrum-master-dashboard.json';
import itTimebox from '../../public/locales/it/timebox.json';
import itBarriers from '../../public/locales/it/barriers.json';
import itAgreements from '../../public/locales/it/agreements.json';
import itGate from '../../public/locales/it/gate.json';

const NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'backlog',
  'sprint',
  'daily-scrum',
  'impediments',
  'increments',
  'sprint-review',
  'retrospective',
  'reports',
  'team',
  'settings',
  'notifications',
  'errors',
  'validation',
  'scrum-master-dashboard',
  'timebox',
  'barriers',
  'agreements',
  'gate',
] as const;

// Build resource maps per locale
const enResources = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  backlog: enBacklog,
  sprint: enSprint,
  'daily-scrum': enDailyScrum,
  impediments: enImpediments,
  increments: enIncrements,
  'sprint-review': enSprintReview,
  retrospective: enRetrospective,
  reports: enReports,
  team: enTeam,
  settings: enSettings,
  notifications: enNotifications,
  errors: enErrors,
  validation: enValidation,
  'scrum-master-dashboard': enScrumMasterDashboard,
  timebox: enTimebox,
  barriers: enBarriers,
  agreements: enAgreements,
  gate: enGate,
};

const deResources = {
  common: deCommon,
  auth: deAuth,
  dashboard: deDashboard,
  backlog: deBacklog,
  sprint: deSprint,
  'daily-scrum': deDailyScrum,
  impediments: deImpediments,
  increments: deIncrements,
  'sprint-review': deSprintReview,
  retrospective: deRetrospective,
  reports: deReports,
  team: deTeam,
  settings: deSettings,
  notifications: deNotifications,
  errors: deErrors,
  validation: deValidation,
  'scrum-master-dashboard': deScrumMasterDashboard,
  timebox: deTimebox,
  barriers: deBarriers,
  agreements: deAgreements,
  gate: deGate,
};

const frResources = {
  common: frCommon,
  auth: frAuth,
  dashboard: frDashboard,
  backlog: frBacklog,
  sprint: frSprint,
  'daily-scrum': frDailyScrum,
  impediments: frImpediments,
  increments: frIncrements,
  'sprint-review': frSprintReview,
  retrospective: frRetrospective,
  reports: frReports,
  team: frTeam,
  settings: frSettings,
  notifications: frNotifications,
  errors: frErrors,
  validation: frValidation,
  'scrum-master-dashboard': frScrumMasterDashboard,
  timebox: frTimebox,
  barriers: frBarriers,
  agreements: frAgreements,
  gate: frGate,
};

const esResources = {
  common: esCommon,
  auth: esAuth,
  dashboard: esDashboard,
  backlog: esBacklog,
  sprint: esSprint,
  'daily-scrum': esDailyScrum,
  impediments: esImpediments,
  increments: esIncrements,
  'sprint-review': esSprintReview,
  retrospective: esRetrospective,
  reports: esReports,
  team: esTeam,
  settings: esSettings,
  notifications: esNotifications,
  errors: esErrors,
  validation: esValidation,
  'scrum-master-dashboard': esScrumMasterDashboard,
  timebox: esTimebox,
  barriers: esBarriers,
  agreements: esAgreements,
  gate: esGate,
};

const itResources = {
  common: itCommon,
  auth: itAuth,
  dashboard: itDashboard,
  backlog: itBacklog,
  sprint: itSprint,
  'daily-scrum': itDailyScrum,
  impediments: itImpediments,
  increments: itIncrements,
  'sprint-review': itSprintReview,
  retrospective: itRetrospective,
  reports: itReports,
  team: itTeam,
  settings: itSettings,
  notifications: itNotifications,
  errors: itErrors,
  validation: itValidation,
  'scrum-master-dashboard': itScrumMasterDashboard,
  timebox: itTimebox,
  barriers: itBarriers,
  agreements: itAgreements,
  gate: itGate,
};

type LocaleResources = Record<string, Record<string, unknown>>;
const resources: Record<string, LocaleResources> = {
  en: enResources as unknown as LocaleResources,
  de: deResources as unknown as LocaleResources,
  fr: frResources as unknown as LocaleResources,
  es: esResources as unknown as LocaleResources,
  it: itResources as unknown as LocaleResources,
};

/**
 * A singleton i18n instance pre-configured for tests.
 * Initialized once on first call, then reused.
 */
let testI18nInstance: typeof i18n | null = null;

/**
 * Initialize (or return the existing) test i18n instance.
 * Loads all locale bundles in-memory — no HTTP needed.
 */
export async function initTestI18n(locale: Locale = DEFAULT_LOCALE): Promise<typeof i18n> {
  if (testI18nInstance?.isInitialized) {
    // If already initialized, just change language if different
    if (testI18nInstance.language !== locale) {
      await testI18nInstance.changeLanguage(locale);
    }
    return testI18nInstance;
  }

  testI18nInstance = i18n.createInstance().use(initReactI18next);

  await testI18nInstance.init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...NAMESPACES],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
    returnEmptyString: false,
  });

  return testI18nInstance;
}

/**
 * Get the test i18n instance (must call initTestI18n first).
 */
export function getTestI18nInstance(): typeof i18n {
  if (!testI18nInstance?.isInitialized) {
    throw new Error('Test i18n not initialized. Call initTestI18n() first.');
  }
  return testI18nInstance;
}

/**
 * Change the test i18n language and wait for it to be ready.
 */
export async function changeTestLanguage(locale: Locale): Promise<void> {
  const instance = getTestI18nInstance();
  await instance.changeLanguage(locale);
}

/**
 * Get the translated text for a given key in a given locale,
 * without affecting the global i18n instance state.
 * Useful for assertions in locale-specific test scenarios.
 */
export function getTranslationForKey(
  key: string,
  locale: Locale = DEFAULT_LOCALE,
  options?: Record<string, unknown>
): string {
  const instance = getTestI18nInstance();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- i18next's getFixedT has complex overloaded types
  const fixedT = instance.getFixedT(locale) as (key: string, options?: any) => string;
  return fixedT(key, options);
}

/**
 * Get the list of all supported locales for parameterized tests.
 */
export function getSupportedLocalesForTest(): Locale[] {
  return [...SUPPORTED_LOCALES];
}
