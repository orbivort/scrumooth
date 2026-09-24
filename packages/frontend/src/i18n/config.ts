import i18n, { type TFunction, type PostProcessorModule } from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import 'intl-pluralrules';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  SUPPORTED_LOCALES_DEV,
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_PATH,
  LOCALE_COOKIE_SAME_SITE,
} from '@scrumooth/shared';

/**
 * Post-processor that replaces `__pending__` translation placeholders with a
 * localized fallback in production. In development the raw `__pending__` value
 * is kept so translators can easily spot un-translated keys.
 */
const pendingGuardPostProcessor: PostProcessorModule = {
  type: 'postProcessor',
  name: 'pendingGuard',
  process: (
    value: string,
    _key: string | string[],
    options: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction type is too restrictive for dynamic post-processor calls
    translator: any
  ) => {
    if (import.meta.env.PROD && value === '__pending__') {
      // Sampled metric emission (~1% of renders)
      if (Math.random() < 0.01) {
        console.warn('Pending translation rendered', { key: _key, lng: options.lng });
      }
      return translator.translate('common:translationPending', { ...options, lng: options.lng });
    }
    return value;
  },
};

// All locale JSON files are served from public/locales/ and fetched at runtime
// via i18next-http-backend. This keeps the main bundle lean and avoids
// duplicating locale files between src/ and public/.
export const i18nInstance = i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(pendingGuardPostProcessor);

export function initI18n(): Promise<TFunction> {
  // Derive the locale path prefix from VITE_BASE_PATH so that locale JSON
  // files are fetched from the correct sub-path when deployed (e.g. GitHub
  // Pages under /scrumooth/). Strip trailing slash to avoid double slashes.
  const localeBasePath = (import.meta.env.VITE_BASE_PATH ?? '/').replace(/\/+$/, '');

  return i18nInstance.init({
    // All locales fetched on demand from public/locales/{lng}/{ns}.json
    backend: {
      loadPath: `${localeBasePath}/locales/{{lng}}/{{ns}}.json`,
    },

    // Auto-detect language: cookie → navigator → default
    // NOTE: We intentionally exclude localStorage from detection because:
    // - Zustand persist uses localStorage key 'scrumooth.locale' with JSON format
    // - i18next LanguageDetector expects plain string format
    // - This collision causes i18next to overwrite and break Zustand's persisted state
    // - Cookie (set by Zustand's setLocale) is sufficient for detection
    detection: {
      order: ['cookie', 'navigator'],
      lookupCookie: LOCALE_COOKIE_NAME,
      caches: ['cookie'],
      // Align cookie cache attributes with Zustand setLocale and backend locale.middleware
      // so all three writers produce consistent cookie metadata.
      cookieOptions: {
        path: LOCALE_COOKIE_PATH,
        sameSite: LOCALE_COOKIE_SAME_SITE,
        secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
      },
    },

    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: import.meta.env.DEV ? [...SUPPORTED_LOCALES_DEV] : [...SUPPORTED_LOCALES],
    nonExplicitSupportedLngs: true,
    // Use 'currentOnly' so that compound locale codes like 'pseudo-rtl' are
    // loaded as-is instead of being stripped to their base language ('pseudo').
    // Production locales (en, de, fr, es, it) are single-segment codes so they
    // are unaffected by this change.
    load: 'currentOnly',

    ns: [
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
      // The Scrum Guide rule behind a refusal, keyed by gate code (`GATE_I18N_NAMESPACE`). Loaded
      // eagerly because a refusal can be rendered by any surface the moment it is provoked, and a
      // namespace fetched on demand would show the fallback message first.
      'gate',
    ],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React escapes by default
    },

    react: {
      useSuspense: true,
    },

    postProcess: ['pendingGuard'],

    returnNull: false,
    returnEmptyString: false,
    parseMissingKeyHandler: (key: string) => {
      if (import.meta.env.PROD) {
        // Return only the last segment in production to avoid exposing namespace structure
        const segments = key.split(':');
        const keyWithoutNs = segments.length > 1 ? segments.slice(1).join(':') : key;
        const parts = keyWithoutNs.split('.');
        return parts[parts.length - 1] ?? key;
      }
      return key;
    },
  });
}
