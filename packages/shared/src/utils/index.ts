export {
  RTL_LANGUAGES,
  RTL_LANGUAGES_DEV,
  isRTL,
  isRTLDev,
  getDirection,
  getDirectionDev,
  getBaseLanguage,
  isSupportedLocale,
  isSupportedLocaleDev,
  normalizeLocale,
  normalizeLocaleDev,
} from './locale.js';
export {
  getCachedNumberFormat,
  getCachedDateTimeFormat,
  getCachedRelativeTimeFormat,
  getCachedListFormat,
  getCachedCollator,
} from './intlCache.js';
export { escapeHtml } from './escapeHtml.js';
export {
  LOCALE_COOKIE_NAME,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_SAME_SITE,
  LOCALE_COOKIE_PATH,
  getLocaleCookieOptions,
  buildLocaleCookieString,
  type LocaleCookieOptions,
} from './cookieConfig.js';
export {
  formatDate as formatLocaleDate,
  formatNumber,
  formatCurrency,
  formatRelativeTime,
  formatList,
  createCollator,
  sortLocaleStrings,
  formatDateRange,
  formatDateRangeCompact,
  formatDateForInput,
  parseDateFromInput,
  isValidDateForLocale,
  formatTime,
  formatDateTime,
  formatChartDate,
} from './formatters.js';

// Backward-compatible formatDate (uses DEFAULT_LOCALE)
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0] ?? '';
}

export {
  SCRUM_EVENTS,
  TIMBOX_MAX_SECONDS,
  TIMBOX_WARNING_FRACTION,
  timeboxFor,
  type ScrumEvent,
} from './timebox.js';

export {
  SPRINT_MAX_DURATION_DAYS,
  SPRINT_CONTIGUITY_MAX_GAP_DAYS,
  SPRINT_GOAL_IMPACTS,
  SPRINT_GOAL_IMPACT_LIST,
  SPRINT_CHANGE_APPROVAL_STATUSES,
  SPRINT_CHANGE_DECISIONS,
  toUtcDay,
  sprintDurationDays,
  rangesOverlap,
  contiguityGapDays,
  isSprintGoalImpact,
  isSprintChangeApprovalStatus,
  type SprintGoalImpact,
  type SprintChangeApprovalStatus,
  type SprintChangeDecision,
  type DayRange,
} from './sprintCalendar.js';

export {
  MAX_CALENDAR_SPAN_DAYS,
  DEFAULT_WORKING_DAYS,
  ISO_WEEKDAYS,
  START_MINUTE_MIN,
  START_MINUTE_MAX,
  toIsoDate,
  isoDateToDayIndex,
  dayIndexToIsoDate,
  toIsoWeekday,
  addDays,
  normalizeWorkingDays,
  normalizeNonWorkingDays,
  normalizeCalendar,
  isWorkingDay,
  countWorkingDays,
  listWorkingDays,
  sprintWorkingDayProgress,
  isKnownTimeZone,
  formatStartMinute,
  parseStartMinute,
  type WorkingDayCalendar,
  type SprintWorkingDayProgress,
} from './workingDays.js';

export {
  DAILY_SCRUM_ADJUSTMENT_ACTIONS,
  isDailyScrumAdjustmentAction,
  ADAPTATION_REFLECTIONS,
  ADAPTATION_REFLECTION_BASES,
  evaluateAdaptationReflection,
  hasAdaptationEvidence,
  hasContradictoryAdaptationEvidence,
  type DailyScrumAdjustmentAction,
  type AdaptationReflection,
  type AdaptationReflectionBasis,
  type AdaptationReflectionVerdict,
  type AdaptationAdjustmentSnapshot,
  type AdaptationCurrentState,
  type AdaptationEvidenceDeclaration,
} from './dailyScrumAdaptation.js';

export {
  wholeDaysBetween,
  daysUntil,
  isBarrierOverdue,
  summarizeBarriers,
  summarizeSkillCoverage,
  isStakeholderActionOpen,
} from './smFacilitation.js';

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
