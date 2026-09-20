import { TIME } from '@scrumooth/shared';

export const MAX_DISPLAY_ITEMS = 5;

export const STALE_TIME_SHORT = 30 * TIME.SECOND;

export const STALE_TIME_LONG = TIME.MINUTE;

export const TOAST_AUTO_DISMISS_DURATION = 3 * TIME.SECOND;

export const REFRESH_ANNOUNCEMENT_DELAY = 500;

/**
 * Upper bound on the Product Backlog page fetched for Dashboard goal-progress
 * aggregation.
 *
 * The Product Backlog endpoint is paginated (default limit 20) and exposes no
 * aggregate endpoint, so the Dashboard requests a larger page and derives
 * "items serving the Product Goal" client-side. The total backlog size always
 * comes from the response metadata (`pagination.total`), never from this page.
 * The value is intentionally generous for real backlogs while keeping the
 * payload bounded.
 */
export const BACKLOG_PROGRESS_SAMPLE_SIZE = 200;
