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
  FileTextIcon,
  SearchIcon,
  MessageCircleIcon,
  TrendingUpIcon,
  UsersIcon,
  BuildingIcon,
  SettingsIcon,
  DownloadIcon,
  ShieldIcon,
} from '../components/common/Icons';

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
  {
    path: '/scrum-master-dashboard',
    icon: ShieldIcon,
    labelKey: 'nav.scrumMaster',
    roles: ['SCRUM_MASTER'],
  },
  // Two registers that once had destinations of their own are tabs now, reached where their subject
  // is rather than from the sidebar: the barriers are the second tab of the Impediments module, and
  // the working agreements -- the team's own, readable by every member, with only the assessment
  // behind them recorded by the Scrum Master -- are the third tab of the Team module.
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
      {
        path: '/settings/team-definitions',
        icon: FileTextIcon,
        labelKey: 'nav.settings.teamDefinitions',
        roles: ['PRODUCT_OWNER', 'SCRUM_MASTER'],
      },
      {
        path: '/settings/team-groups',
        icon: UsersIcon,
        labelKey: 'nav.settings.teamGroups',
        // The group is created and its shared Definition of Done replaced by the Product Owner or
        // Scrum Master of one of its teams, so the entry belongs to the roles that can act on it.
        roles: ['PRODUCT_OWNER', 'SCRUM_MASTER'],
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
  const normalizedUserRole = userRole?.toUpperCase() ?? null;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.roles ||
          (normalizedUserRole &&
            item.roles.some((role) => role.toUpperCase() === normalizedUserRole))
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function getFilteredNavItems(items: NavItem[], userRole: string | null): NavItem[] {
  const normalizedUserRole = userRole?.toUpperCase() ?? null;
  return items.filter(
    (item) =>
      !item.roles ||
      (normalizedUserRole && item.roles.some((role) => role.toUpperCase() === normalizedUserRole))
  );
}
