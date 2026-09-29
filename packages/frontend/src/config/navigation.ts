import type React from 'react';

/**
 * A destination in the menu. A settings row is the same shape as a primary row, so one interface
 * serves both lists: they differ in where they render, not in what they describe.
 */
export interface NavItem {
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelKey: string;
  /** Roles that may see this item. When omitted, visible to all team members. */
  roles?: string[];
  /**
   * Addresses this entry owns besides its own, for surfaces whose address differs from the registry
   * they belong to: the Increment register lives at `/increments` while a single Increment is read
   * at `/increment/:id`. Only the plural/singular pairs need this -- a detail route nested under the
   * entry's own path is covered by the entry's path itself.
   */
  activePrefixes?: string[];
}

/** The settings-side name of {@link NavItem}. The two lists share one shape. */
export type SettingsItem = NavItem;

/**
 * A run of destinations under one heading. When `labelKey` is omitted the run renders ungrouped,
 * which is how the home row and the trailing app concepts keep their deliberate asymmetry: a
 * heading over a single row adds neither a category signal nor a decision, so it is not drawn.
 */
export interface NavSection {
  id: string;
  labelKey?: string;
  items: NavItem[];
}

export interface SettingsGroup {
  id: string;
  /** Omitted for a run that sits directly under the Settings band without a heading of its own. */
  labelKey?: string;
  items: SettingsItem[];
}

import {
  DashboardIcon,
  TargetIcon,
  ListIcon,
  CalendarIcon,
  ZapIcon,
  SunIcon,
  ClockIcon,
  AlertTriangleIcon,
  PackageIcon,
  MessageCircleIcon,
  ClipboardListIcon,
  TrendingUpIcon,
  UsersIcon,
  BuildingIcon,
  FolderIcon,
  SettingsIcon,
} from '../components/common/Icons';

/**
 * The roles that lead a team. They administer the organization's teams and groups, so they are the
 * only roles the navigation and the route guards admit to those destinations.
 *
 * Declared once and read by both: a route that admits someone the sidebar hides would be two answers
 * to the same question, and the reader would meet whichever one their address bar reached first.
 */
export const TEAM_LEADERSHIP_ROLES = ['PRODUCT_OWNER', 'SCRUM_MASTER'];

/**
 * Ensuring the Scrum events take place is the Scrum Master's accountability, so the standing
 * commitment behind the Daily Scrum is theirs alone to set.
 *
 * Named here rather than written inline because the same list answers both halves of the question:
 * which entry the sidebar offers, and which address the router admits.
 */
export const SCRUM_MASTER_ROLES = ['SCRUM_MASTER'];

/** Whether a role may reach an entry guarded by `roles`. An entry without roles is open to members. */
export function hasAnyRole(userRole: string | null, roles?: string[]): boolean {
  if (!roles || roles.length === 0) {
    return true;
  }
  const normalizedUserRole = userRole?.toUpperCase() ?? null;
  return (
    normalizedUserRole !== null && roles.some((role) => role.toUpperCase() === normalizedUserRole)
  );
}

/**
 * Whether `pathname` is this entry's own address or belongs to a surface it owns.
 *
 * A candidate matches on exact equality or on a path boundary, never on a bare string prefix: the
 * delimiter is what stops `/sprint` from capturing `/sprint-review`, and without it the Active
 * Sprint row would light up on two unrelated pages. Boundary matching also makes competing entries
 * mutually exclusive, so no entry has to be ranked against another; only an entry's own candidates
 * are compared, longest first, so `/increment/create` resolves to the Increment register rather
 * than to nothing at all.
 */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const candidates = [item.path, ...(item.activePrefixes ?? [])].sort(
    (left, right) => right.length - left.length
  );
  return candidates.some(
    (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`)
  );
}

// Labels state their object and their scope. The sidebar carries two team-shaped surfaces that
// differ only in reach: "My Team" is the one the signed-in user belongs to, while the settings
// section holds what spans teams -- the directory of every Team, and the Team Groups that share one
// Definition of Done. A label that does not say which of the two it is leaves the reader to open the
// destination to find out, so "Team" is never used on its own.
//
// The sections are the Guide's own vocabulary read in order: the commitment and artifacts the work
// is expressed in, then the events that inspect and adapt it, then the app's own concepts that the
// Guide has no category for. A flat run of a dozen rows exceeds what a reader holds at once, so the
// headings are what make the list memorable rather than re-readable -- and they are the reason the
// three destinations that are not Guide vocabulary (Impediments, Reports, My Team) sit outside the
// sections instead of being forced into one that would name a category they do not belong to.
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    // Ungrouped on purpose: the app home is the first row by convention, and a heading reading
    // "Home" over the only Dashboard row would restate its own child.
    items: [{ path: '/dashboard', icon: DashboardIcon, labelKey: 'nav.dashboard' }],
  },
  {
    id: 'product',
    labelKey: 'nav.groups.product',
    items: [
      { path: '/product-goals', icon: TargetIcon, labelKey: 'nav.productGoals' },
      { path: '/backlog', icon: ListIcon, labelKey: 'nav.productBacklog' },
      {
        path: '/increments',
        icon: PackageIcon,
        labelKey: 'nav.increments',
        activePrefixes: ['/increment'],
      },
    ],
  },
  {
    id: 'scrumEvents',
    labelKey: 'nav.groups.scrumEvents',
    items: [
      { path: '/sprint-planning', icon: CalendarIcon, labelKey: 'nav.sprintPlanning' },
      { path: '/sprint', icon: ZapIcon, labelKey: 'nav.activeSprint' },
      { path: '/daily-scrum', icon: SunIcon, labelKey: 'nav.dailyScrum' },
      { path: '/sprint-review', icon: MessageCircleIcon, labelKey: 'nav.sprintReview' },
      // Not the magnifier it used to be: a magnifier promises search, and this app has no search
      // field for the promise to keep, so the mis-signal could never be resolved by clicking.
      {
        path: '/retrospectives',
        icon: ClipboardListIcon,
        labelKey: 'nav.retrospectives',
        activePrefixes: ['/retrospective'],
      },
    ],
  },
  {
    id: 'tracking',
    // Ungrouped tail: three app concepts the Guide has no category for. Giving them a heading would
    // invent a category and claim Guide vocabulary the product does not hold.
    items: [
      { path: '/impediments', icon: AlertTriangleIcon, labelKey: 'nav.impediments' },
      { path: '/reports', icon: TrendingUpIcon, labelKey: 'nav.reports' },
      // Two surfaces that once had destinations of their own are tabs now, reached where their
      // subject is rather than from the sidebar: the barriers are the second tab of the Impediments
      // module, the working agreements -- the team's own, readable by every member, with only the
      // assessment behind them recorded by the Scrum Master -- are the third tab of the Team module,
      // and the Scrum Master's facilitation overview is the second tab of the Dashboard. A
      // role-labelled peer row would frame the Scrum Master as a separate stakeholder inspecting the
      // team rather than a member serving it, and two destinations both named "Dashboard" would
      // force everyone to learn which of the two holds which facts.
      { path: '/team', icon: UsersIcon, labelKey: 'nav.team' },
    ],
  },
];

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'process',
    // The team's own Scrum parameters, ungrouped under the Settings band: they are Guide-governed
    // but they belong to no wider category, and a heading over them would name one that does not
    // exist.
    items: [
      {
        path: '/settings/sprint-configuration',
        icon: SettingsIcon,
        labelKey: 'nav.settings.sprintConfiguration',
        roles: TEAM_LEADERSHIP_ROLES,
      },
      {
        path: '/settings/daily-scrum-schedule',
        // A clock, not the Daily Scrum's sun: the two destinations would otherwise be one glyph
        // apart in the collapsed rail, where the label that separates them is not drawn.
        icon: ClockIcon,
        labelKey: 'nav.settings.dailyScrumSchedule',
        roles: SCRUM_MASTER_ROLES,
      },
    ],
  },
  {
    id: 'teamsAndGroups',
    labelKey: 'nav.settings.teamsAndGroups',
    items: [
      // The Definition of Done and the Definition of Ready are read on the Team module's Definition
      // tab, which every team member can reach: the Guide requires the Developers to conform to the
      // Definition of Done, so a commitment that is hidden behind a role is not a commitment they can
      // keep. Only group administration, which is a leadership act, is configured here.
      {
        path: '/settings/team-groups',
        // A container of teams, not a second roster: the people icon belongs to My Team, and reusing
        // it here would make two different destinations look like the same one.
        icon: FolderIcon,
        labelKey: 'nav.settings.teamGroups',
        // The group is created and its shared Definition of Done replaced by the Product Owner or
        // Scrum Master of one of its teams, so the entry belongs to the roles that can act on it.
        roles: TEAM_LEADERSHIP_ROLES,
      },
      {
        path: '/settings/team-management',
        icon: BuildingIcon,
        labelKey: 'nav.settings.teamManagement',
      },
    ],
  },
];

export function getFilteredSettingsGroups(
  groups: SettingsGroup[],
  userRole: string | null
): SettingsGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyRole(userRole, item.roles)),
    }))
    .filter((group) => group.items.length > 0);
}

export function getFilteredNavSections(
  sections: NavSection[],
  userRole: string | null
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasAnyRole(userRole, item.roles)),
    }))
    .filter((section) => section.items.length > 0);
}
