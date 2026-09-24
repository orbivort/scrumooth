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

/**
 * The tabs of the Dashboard module. The overview is the operational page every role reads, so it is
 * the default and the tab the URL stays silent about: `/dashboard` is the overview,
 * `/dashboard?tab=facilitation` is the Scrum Master's facilitation lens.
 */
export type DashboardTab = 'overview' | 'facilitation';

export const DASHBOARD_TAB_PARAM = 'tab';

export const DASHBOARD_TAB_IDS: readonly DashboardTab[] = ['overview', 'facilitation'];

/**
 * Resolve the tab the address asks for.
 *
 * A value that is unknown, or that names a tab this user does not have, resolves to the overview
 * rather than to an error: the rail is not rendered at all for a user with a single tab, and a typed
 * or shared `?tab=facilitation` must not strand a non-Scrum-Master on a surface they cannot open.
 */
export const readDashboardTab = (
  params: URLSearchParams,
  hasFacilitation: boolean
): DashboardTab =>
  hasFacilitation && params.get(DASHBOARD_TAB_PARAM) === 'facilitation'
    ? 'facilitation'
    : 'overview';

/**
 * The refresh a panel hands to the module shell, so the header's control acts on whatever is on
 * screen. Each panel keeps its own knowledge of the query keys involved; the shell never repeats them.
 */
export type DashboardRefreshHandler = () => Promise<void>;

/**
 * What every Dashboard panel is given. Only one panel is mounted at a time, so the registration slot
 * is unambiguous: a panel claims it on mount and releases it on unmount.
 */
export interface DashboardPanelProps {
  registerRefresh: (handler: DashboardRefreshHandler | null) => void;
}
