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
  FlagIcon,
  ClipboardListIcon,
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
  // The barrier register is the team's view of what blocks it from outside; the working agreements
  // are the team's own. Both are readable by every member -- only the writes are the Scrum
  // Master's (barriers) or recorded by them (the assessment) -- so neither carries a role gate.
  { path: '/organizational-barriers', icon: FlagIcon, labelKey: 'nav.organizationalBarriers' },
  { path: '/working-agreements', icon: ClipboardListIcon, labelKey: 'nav.workingAgreements' },
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
