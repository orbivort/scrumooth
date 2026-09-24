export * from './definitionDefaults.js';
export * from './gateCodes.js';
export * from './time.js';
export * from './validation.js';

export const WORKFLOW_STATES = {
  PRODUCT_BACKLOG_ITEM: {
    NEW: 'NEW',
    REFINED: 'REFINED',
    READY: 'READY',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
  },
  TASK: {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    REVIEW: 'REVIEW',
    DONE: 'DONE',
  },
  SPRINT: {
    PLANNED: 'PLANNED',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
} as const;

/**
 * Notification types persisted on `notifications.type` — the Prisma `NotificationType`
 * enum. Kept in lockstep with `packages/backend/prisma/schema.prisma`: a value that is
 * absent from the database enum cannot be stored, so new types are added here and in the
 * schema (with a migration) in the same change set.
 */
export const NOTIFICATION_TYPES = {
  TEAM_INVITATION: 'TEAM_INVITATION',
  TEAM_REMOVAL: 'TEAM_REMOVAL',
  TASK_ASSIGNMENT: 'TASK_ASSIGNMENT',
  IMPEDIMENT_ASSIGNMENT: 'IMPEDIMENT_ASSIGNMENT',
  IMPEDIMENT_ESCALATION: 'IMPEDIMENT_ESCALATION',
  DAILY_SCRUM_SIGNAL: 'DAILY_SCRUM_SIGNAL',
  TEAM_CREATED: 'TEAM_CREATED',
  TEAM_UPDATED: 'TEAM_UPDATED',
  TEAM_DELETED: 'TEAM_DELETED',
  DIRECT_MESSAGE: 'DIRECT_MESSAGE',
  ACCOUNT_DELETION_SCHEDULED: 'ACCOUNT_DELETION_SCHEDULED',
  ACCOUNT_DELETION_CANCELLED: 'ACCOUNT_DELETION_CANCELLED',
  ORGANIZATIONAL_BARRIER: 'ORGANIZATIONAL_BARRIER',
  SPRINT_BACKLOG_CHANGE_PENDING: 'SPRINT_BACKLOG_CHANGE_PENDING',
} as const;

/**
 * Impediment priority, declared most-critical-first.
 *
 * The declaration order is load-bearing: PostgreSQL compares enum values by the order in
 * which they were declared on the type, so a Prisma `orderBy: { priority: 'asc' }` means
 * CRITICAL → LOW. Reordering these values is a database migration, not a code change.
 */
export const IMPEDIMENT_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ImpedimentPriority = (typeof IMPEDIMENT_PRIORITIES)[number];

/** An impediment reported without an explicit priority is treated as Medium. */
export const DEFAULT_IMPEDIMENT_PRIORITY: ImpedimentPriority = 'MEDIUM';

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'it', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Development-only locale list that includes the pseudo-localization locale.
 * Use this in dev builds to allow switching to the "pseudo" locale for
 * visual testing of i18n string expansion and accent folding.
 */
export const SUPPORTED_LOCALES_DEV = [...SUPPORTED_LOCALES, 'pseudo', 'pseudo-rtl'] as const;
export type LocaleDev = (typeof SUPPORTED_LOCALES_DEV)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
};

export const LOCALE_CURRENCIES: Record<Locale, string> = {
  en: 'EUR',
  de: 'EUR',
  fr: 'EUR',
  it: 'EUR',
  es: 'EUR',
};

/**
 * Locale-specific date format patterns for input fields
 * These formats match user expectations in each language/region
 */
export const DATE_INPUT_FORMATS: Record<Locale, string> = {
  en: 'dd/MM/yyyy', // British format (matches enGB locale)
  de: 'dd.MM.yyyy', // German format with dots
  fr: 'dd/MM/yyyy', // French format
  it: 'dd/MM/yyyy', // Italian format
  es: 'dd/MM/yyyy', // Spanish format
};

/**
 * Human-readable date format examples for each locale
 * Used in placeholders and help text
 */
export const DATE_FORMAT_EXAMPLES: Record<Locale, string> = {
  en: 'dd/mm/yyyy',
  de: 'tt.mm.jjjj',
  fr: 'jj/mm/aaaa',
  it: 'gg/mm/aaaa',
  es: 'dd/mm/aaaa',
};

/**
 * Locale-specific date separators
 */
export const DATE_SEPARATORS: Record<Locale, string> = {
  en: '/',
  de: '.',
  fr: '/',
  it: '/',
  es: '/',
};

/**
 * BCP47 locale mapping for each supported locale.
 * Used by Accept-Language resolution (resolve-accept-language).
 * When adding a new locale, TypeScript will flag this as incomplete.
 */
export const LOCALE_BCP47_MAP: Record<Locale, string> = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
};

/** Default BCP47 locale for Accept-Language fallback */
export const BCP47_DEFAULT = 'en-US' as const;
