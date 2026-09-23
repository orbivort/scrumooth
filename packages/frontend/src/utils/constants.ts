import { TIME, VALIDATION } from '@scrumooth/shared';

export const DEFAULT_USER_ID = 'default-user';
export const MAX_RETRIES = 3;
export const DEBOUNCE_DELAY = 300;
export const API_TIMEOUT = 30000;

export const CHART_STALE_TIME = TIME.MINUTE;
export const DATA_STALE_TIME = 30 * TIME.SECOND;
export const SPRINT_STALE_TIME = 30 * TIME.SECOND;

export const QUERY_RETRY_COUNT = 2;
export const QUERY_RETRY_DELAY = TIME.SECOND;

export const TOAST_DURATION = 5 * TIME.SECOND;
export const TOAST_SUCCESS_DURATION = 3 * TIME.SECOND;
/**
 * Errors carry the backend's explanation verbatim -- a gate refusal such as "Complete the Sprint
 * Review before completing the Retrospective" is a full sentence -- so they stay up longer than a
 * success confirmation.
 */
export const TOAST_ERROR_DURATION = 10 * TIME.SECOND;

export const ITEMS_PER_PAGE = 20;
export const MAX_LABELS_DISPLAY = 2;
export const MAX_ITEMS_PREVIEW = 5;

export const PLANNING_TIME_MULTIPLIER = 2;
export const BUSINESS_DAYS_PER_WEEK = 5;
export const HOURS_PER_DAY = 8;
export const DEFAULT_TEAM_CAPACITY = 40;

export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13, 21] as const;
export const BUSINESS_VALUE_SCALE = [1, 2, 3, 5, 8, 13] as const;

export const MIN_PASSWORD_LENGTH = VALIDATION.PASSWORD.MIN_LENGTH;
export const MAX_TITLE_LENGTH = VALIDATION.CONTENT.TITLE_MAX;
export const MAX_DESCRIPTION_LENGTH = VALIDATION.CONTENT.DESCRIPTION_MAX;
export const MAX_MESSAGE_LENGTH = VALIDATION.CONTENT.MESSAGE_MAX;

export const SESSION_WARNING_THRESHOLD = 2 * TIME.MINUTE;
export const SESSION_IDLE_TIMEOUT = 30 * TIME.MINUTE;
export const SESSION_ABSOLUTE_TIMEOUT = 24 * TIME.HOUR;
