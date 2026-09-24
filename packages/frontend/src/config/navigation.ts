import type React from 'react';

export interface NavItem {
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelKey: string;
  /** Roles that may see this item. When omitted, visible to all team members. */
  roles?: string[];
}

export interface SettingsItem {
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelKey: string;
  roles?: string[];
}

export interface SettingsGroup {
  id: string;
  labelKey: string;
  items: SettingsItem[];
}

import {
  DashboardIcon,
  TargetIcon,
  ListIcon,
  CalendarIcon,
  ZapIcon,
  SunIcon,
  AlertTriangleIcon,
  PackageIcon,
  SearchIcon,
  MessageCircleIcon,
  TrendingUpIcon,
  UsersIcon,
  BuildingIcon,
  FolderIcon,
  SettingsIcon,
  DownloadIcon,
} from '../components/common/Icons';

/**
 * The roles that lead a team. They administer the organization's teams and groups, so they are the
 * only roles the navigation and the route guards admit to those destinations.
 *
 * Declared once and read by both: a route that admits someone the sidebar hides would be two answers
 * to the same question, and the reader would meet whichever one their address bar reached first.
 */
export const TEAM_LEADERSHIP_ROLES = ['PRODUCT_OWNER', 'SCRUM_MASTER'];

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

// Labels state their object and their scope. The sidebar carries two team-shaped surfaces that
// differ only in reach: "My Team" is the one the signed-in user belongs to, while the settings
// section holds what spans teams -- the directory of every Team, and the Team Groups that share one
// Definition of Done. A label that does not say which of the two it is leaves the reader to open the
// destination to find out, so "Team" is never used on its own.
export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', icon: DashboardIcon, labelKey: 'nav.dashboard' },
  { path: '/product-goals', icon: TargetIcon, labelKey: 'nav.productGoals' },
  { path: '/backlog', icon: ListIcon, labelKey: 'nav.productBacklog' },
  { path: '/sprint-planning', icon: CalendarIcon, labelKey: 'nav.sprintPlanning' },
  { path: '/sprint', icon: ZapIcon, labelKey: 'nav.activeSprint' },
  { path: '/daily-scrum', icon: SunIcon, labelKey: 'nav.dailyScrum' },
  { path: '/impediments', icon: AlertTriangleIcon, labelKey: 'nav.impediments' },
  { path: '/increments', icon: PackageIcon, labelKey: 'nav.increments' },
  { path: '/sprint-review', icon: MessageCircleIcon, labelKey: 'nav.sprintReview' },
  { path: '/retrospectives', icon: SearchIcon, labelKey: 'nav.retrospectives' },
  { path: '/reports', icon: TrendingUpIcon, labelKey: 'nav.reports' },
  // Three surfaces that once had destinations of their own are tabs now, reached where their subject
  // is rather than from the sidebar: the barriers are the second tab of the Impediments module, the
  // working agreements -- the team's own, readable by every member, with only the assessment behind
  // them recorded by the Scrum Master -- are the third tab of the Team module, and the Scrum
  // Master's facilitation overview is the second tab of the Dashboard. A role-labelled peer row
  // would frame the Scrum Master as a separate stakeholder inspecting the team rather than a member
  // serving it, and two destinations both named "Dashboard" would force everyone to learn which of
  // the two holds which facts.
  { path: '/team', icon: UsersIcon, labelKey: 'nav.team' },
];

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'team',
    labelKey: 'nav.settings.team',
    items: [
      {
        path: '/settings/sprint-configuration',
        icon: SettingsIcon,
        labelKey: 'nav.settings.sprintConfiguration',
        roles: ['PRODUCT_OWNER', 'SCRUM_MASTER'],
      },
      {
        path: '/settings/daily-scrum-schedule',
        icon: SunIcon,
        labelKey: 'nav.settings.dailyScrumSchedule',
        // The Scrum Master is accountable for ensuring the Scrum events take place, so the
        // standing commitment behind the Daily Scrum is theirs to set.
        roles: ['SCRUM_MASTER'],
      },
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
  {
    id: 'data',
    labelKey: 'nav.settings.data',
    items: [
      {
        path: '/settings/privacy-data',
        icon: DownloadIcon,
        labelKey: 'nav.settings.privacyData',
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

export function getFilteredNavItems(items: NavItem[], userRole: string | null): NavItem[] {
  return items.filter((item) => hasAnyRole(userRole, item.roles));
}
