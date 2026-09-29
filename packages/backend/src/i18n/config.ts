import i18next, { type i18n as I18nType } from 'i18next';
import 'intl-pluralrules';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@scrumooth/shared';
import { logger } from '../utils/logger.js';

import enEmails from '../locales/en/emails.json' with { type: 'json' };
import enNotifications from '../locales/en/notifications.json' with { type: 'json' };
import enErrors from '../locales/en/errors.json' with { type: 'json' };
import enValidation from '../locales/en/validation.json' with { type: 'json' };
import deEmails from '../locales/de/emails.json' with { type: 'json' };
import deNotifications from '../locales/de/notifications.json' with { type: 'json' };
import deErrors from '../locales/de/errors.json' with { type: 'json' };
import deValidation from '../locales/de/validation.json' with { type: 'json' };
import frEmails from '../locales/fr/emails.json' with { type: 'json' };
import frNotifications from '../locales/fr/notifications.json' with { type: 'json' };
import frErrors from '../locales/fr/errors.json' with { type: 'json' };
import frValidation from '../locales/fr/validation.json' with { type: 'json' };
import esEmails from '../locales/es/emails.json' with { type: 'json' };
import esNotifications from '../locales/es/notifications.json' with { type: 'json' };
import esErrors from '../locales/es/errors.json' with { type: 'json' };
import esValidation from '../locales/es/validation.json' with { type: 'json' };
import itEmails from '../locales/it/emails.json' with { type: 'json' };
import itNotifications from '../locales/it/notifications.json' with { type: 'json' };
import itErrors from '../locales/it/errors.json' with { type: 'json' };
import itValidation from '../locales/it/validation.json' with { type: 'json' };
import itRetrospectives from '../locales/it/retrospectives.json' with { type: 'json' };
import enRetrospectives from '../locales/en/retrospectives.json' with { type: 'json' };
import deRetrospectives from '../locales/de/retrospectives.json' with { type: 'json' };
import frRetrospectives from '../locales/fr/retrospectives.json' with { type: 'json' };
import esRetrospectives from '../locales/es/retrospectives.json' with { type: 'json' };
import enCompliance from '../locales/en/scrumGuideCompliance.json' with { type: 'json' };
import deCompliance from '../locales/de/scrumGuideCompliance.json' with { type: 'json' };
import frCompliance from '../locales/fr/scrumGuideCompliance.json' with { type: 'json' };
import esCompliance from '../locales/es/scrumGuideCompliance.json' with { type: 'json' };
import itCompliance from '../locales/it/scrumGuideCompliance.json' with { type: 'json' };
import enReports from '../locales/en/reports.json' with { type: 'json' };
import deReports from '../locales/de/reports.json' with { type: 'json' };
import frReports from '../locales/fr/reports.json' with { type: 'json' };
import esReports from '../locales/es/reports.json' with { type: 'json' };
import itReports from '../locales/it/reports.json' with { type: 'json' };

const resources = {
  en: {
    emails: enEmails,
    notifications: enNotifications,
    errors: enErrors,
    validation: enValidation,
    retrospectives: enRetrospectives,
    scrumGuideCompliance: enCompliance,
    reports: enReports,
  },
  de: {
    emails: deEmails,
    notifications: deNotifications,
    errors: deErrors,
    validation: deValidation,
    retrospectives: deRetrospectives,
    scrumGuideCompliance: deCompliance,
    reports: deReports,
  },
  fr: {
    emails: frEmails,
    notifications: frNotifications,
    errors: frErrors,
    validation: frValidation,
    retrospectives: frRetrospectives,
    scrumGuideCompliance: frCompliance,
    reports: frReports,
  },
  es: {
    emails: esEmails,
    notifications: esNotifications,
    errors: esErrors,
    validation: esValidation,
    retrospectives: esRetrospectives,
    scrumGuideCompliance: esCompliance,
    reports: esReports,
  },
  it: {
    emails: itEmails,
    notifications: itNotifications,
    errors: itErrors,
    validation: itValidation,
    retrospectives: itRetrospectives,
    scrumGuideCompliance: itCompliance,
    reports: itReports,
  },
};

export const i18nInstance: I18nType = i18next.createInstance({
  resources,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  // Use 'currentOnly' so that compound locale codes like 'pseudo-rtl' are
  // loaded as-is instead of being stripped to their base language.
  // Production locales (en, de, fr, es, it) are single-segment codes so they
  // are unaffected by this change.
  load: 'currentOnly',
  nonExplicitSupportedLngs: true,
  ns: [
    'emails',
    'notifications',
    'errors',
    'validation',
    'retrospectives',
    'scrumGuideCompliance',
    'reports',
  ],
  defaultNS: 'errors',
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  missingKeyHandler: (lngs, ns, key) => {
    void logger.warn('Missing i18n key', { lng: lngs, ns, key });
  },
  parseMissingKeyHandler: (key) => {
    const parts = key.split(/[:.]/);
    // `String.prototype.split` always returns at least one element, so the last element can
    // never be `undefined`; the fallback only satisfies `noUncheckedIndexedAccess` and is
    // therefore unreachable at runtime.
    /* v8 ignore next */
    return parts[parts.length - 1] ?? key;
  },
});

export const i18nInitPromise: Promise<void> = i18nInstance.init().then(() => {});
