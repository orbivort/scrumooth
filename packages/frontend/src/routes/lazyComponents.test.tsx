/**
 * The lazy route table.
 *
 * Every entry is a `React.lazy` wrapper whose only logic is the `.then()` that picks the named
 * export out of the page module. A wrapper that names the wrong export (or drops the `.default`
 * unwrapping) fails only when the route is first visited, which no other test reaches — the routes
 * are rendered through the real router, not by name. This suite resolves each entry against a
 * stubbed page so the mapping itself is asserted, entry by entry.
 */
import React, { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '../test-utils';

import * as Lazy from './lazyComponents';

vi.mock('../pages/Dashboard/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('../pages/DailyScrum/DailyScrum', () => ({ default: () => <div>DailyScrum</div> }));
vi.mock('../pages/Impediments/Impediments', () => ({ default: () => <div>Impediments</div> }));
vi.mock('../pages/Settings/SprintConfiguration', () => ({
  SprintConfiguration: () => <div>SprintConfiguration</div>,
}));
vi.mock('../pages/Settings/DailyScrumSchedule', () => ({
  DailyScrumSchedule: () => <div>DailyScrumSchedule</div>,
}));
vi.mock('../pages/Settings/TeamGroups', () => ({ default: () => <div>TeamGroups</div> }));
vi.mock('../pages/Sprint/SprintBoard', () => ({ SprintBoard: () => <div>SprintBoard</div> }));
vi.mock('../pages/Backlog/Backlog', () => ({ ProductBacklog: () => <div>ProductBacklog</div> }));
vi.mock('../pages/ProductGoals/ProductGoals', () => ({
  ProductGoalsPage: () => <div>ProductGoalsPage</div>,
}));
vi.mock('../pages/SprintPlanning/SprintPlanning', () => ({
  SprintPlanning: () => <div>SprintPlanning</div>,
}));
vi.mock('../pages/Team/Team', () => ({ TeamManagement: () => <div>TeamManagement</div> }));
vi.mock('../pages/Settings/TeamManagement', () => ({
  TeamManagement: () => <div>TeamManagementPage</div>,
}));
vi.mock('../pages/Reports/Reports', () => ({ Reports: () => <div>Reports</div> }));
vi.mock('../pages/SmDashboard/FacilitationPanel', () => ({
  FacilitationPanel: () => <div>FacilitationPanel</div>,
}));
vi.mock('../pages/Increment/IncrementList', () => ({
  IncrementList: () => <div>IncrementList</div>,
}));
vi.mock('../pages/Increment/IncrementDetail', () => ({
  IncrementDetail: () => <div>IncrementDetail</div>,
}));
vi.mock('../pages/Increment/IncrementCreate', () => ({
  IncrementCreate: () => <div>IncrementCreate</div>,
}));
vi.mock('../pages/SprintReview/SprintReviewList', () => ({
  SprintReviewList: () => <div>SprintReviewList</div>,
}));
vi.mock('../pages/SprintReview/SprintReview', () => ({
  SprintReview: () => <div>SprintReview</div>,
}));
vi.mock('../pages/Retrospective/Retrospective', () => ({
  SprintRetrospective: () => <div>SprintRetrospective</div>,
}));
vi.mock('../pages/Retrospective/RetrospectiveList', () => ({
  RetrospectiveList: () => <div>RetrospectiveList</div>,
}));
vi.mock('../pages/Notifications/Notifications', () => ({
  Notifications: () => <div>Notifications</div>,
}));
vi.mock('../pages/Settings/PrivacyData', () => ({ PrivacyData: () => <div>PrivacyData</div> }));
vi.mock('../pages/Dev/IconGallery', () => ({ IconGallery: () => <div>IconGallery</div> }));

type LazyComponent = React.LazyExoticComponent<React.ComponentType>;

const cases: Array<[string, LazyComponent, string]> = [
  ['LazyDashboard', Lazy.LazyDashboard, 'Dashboard'],
  ['LazyDailyScrum', Lazy.LazyDailyScrum, 'DailyScrum'],
  ['LazyImpediments', Lazy.LazyImpediments, 'Impediments'],
  ['LazySprintConfiguration', Lazy.LazySprintConfiguration, 'SprintConfiguration'],
  ['LazyDailyScrumSchedule', Lazy.LazyDailyScrumSchedule, 'DailyScrumSchedule'],
  ['LazyTeamGroupsPage', Lazy.LazyTeamGroupsPage, 'TeamGroups'],
  ['LazySprintBoard', Lazy.LazySprintBoard, 'SprintBoard'],
  ['LazyProductBacklog', Lazy.LazyProductBacklog, 'ProductBacklog'],
  ['LazyProductGoalsPage', Lazy.LazyProductGoalsPage, 'ProductGoalsPage'],
  ['LazySprintPlanning', Lazy.LazySprintPlanning, 'SprintPlanning'],
  ['LazyTeamManagement', Lazy.LazyTeamManagement, 'TeamManagement'],
  ['LazyTeamManagementPage', Lazy.LazyTeamManagementPage, 'TeamManagementPage'],
  ['LazyReports', Lazy.LazyReports, 'Reports'],
  ['LazyFacilitationPanel', Lazy.LazyFacilitationPanel, 'FacilitationPanel'],
  ['LazyIncrementList', Lazy.LazyIncrementList, 'IncrementList'],
  ['LazyIncrementDetail', Lazy.LazyIncrementDetail, 'IncrementDetail'],
  ['LazyIncrementCreate', Lazy.LazyIncrementCreate, 'IncrementCreate'],
  ['LazySprintReviewList', Lazy.LazySprintReviewList, 'SprintReviewList'],
  ['LazySprintReview', Lazy.LazySprintReview, 'SprintReview'],
  ['LazySprintRetrospective', Lazy.LazySprintRetrospective, 'SprintRetrospective'],
  ['LazyRetrospectiveList', Lazy.LazyRetrospectiveList, 'RetrospectiveList'],
  ['LazyNotifications', Lazy.LazyNotifications, 'Notifications'],
  ['LazyPrivacyData', Lazy.LazyPrivacyData, 'PrivacyData'],
  ['LazyIconGallery', Lazy.LazyIconGallery, 'IconGallery'],
];

const renderLazy = (Component: LazyComponent) =>
  render(
    <Suspense fallback={<span>route-loading</span>}>
      <Component />
    </Suspense>
  );

describe('lazyComponents', () => {
  it('exposes a lazy component for every route entry', () => {
    for (const [name, Component] of cases) {
      // React.lazy components are exotic objects tagged by the runtime, not plain functions.
      expect(Component, name).toBeDefined();
      expect(typeof Component).toBe('object');
      expect(Component).toHaveProperty('$$typeof');
    }
  });

  it.each(cases)(
    '%s resolves the page module to its named export',
    async (_name, Component, text) => {
      renderLazy(Component);

      // The fallback proves the element suspended; the resolved text proves which export the
      // wrapper selected once the dynamic import settled.
      expect(screen.getByText('route-loading')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    }
  );
});
