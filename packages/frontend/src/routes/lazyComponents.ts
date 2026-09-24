import { lazy } from 'react';

// Lazy-loaded page components using consistent .then() pattern
export const LazyDashboard = lazy(() =>
  import('../pages/Dashboard/Dashboard').then((module) => ({
    default: module.default,
  }))
);

export const LazyDailyScrum = lazy(() =>
  import('../pages/DailyScrum/DailyScrum').then((module) => ({
    default: module.default,
  }))
);

export const LazyImpediments = lazy(() =>
  import('../pages/Impediments/Impediments').then((module) => ({
    default: module.default,
  }))
);

export const LazySprintConfiguration = lazy(() =>
  import('../pages/Settings/SprintConfiguration').then((module) => ({
    default: module.SprintConfiguration,
  }))
);

export const LazyDailyScrumSchedule = lazy(() =>
  import('../pages/Settings/DailyScrumSchedule').then((module) => ({
    default: module.DailyScrumSchedule,
  }))
);

export const LazyTeamGroupsPage = lazy(() =>
  import('../pages/Settings/TeamGroups').then((module) => ({
    default: module.default,
  }))
);

export const LazySprintBoard = lazy(() =>
  import('../pages/Sprint/SprintBoard').then((module) => ({
    default: module.SprintBoard,
  }))
);

export const LazyProductBacklog = lazy(() =>
  import('../pages/Backlog/Backlog').then((module) => ({
    default: module.ProductBacklog,
  }))
);

export const LazyProductGoalsPage = lazy(() =>
  import('../pages/ProductGoals/ProductGoals').then((module) => ({
    default: module.ProductGoalsPage,
  }))
);

export const LazySprintPlanning = lazy(() =>
  import('../pages/SprintPlanning/SprintPlanning').then((module) => ({
    default: module.SprintPlanning,
  }))
);

export const LazyTeamManagement = lazy(() =>
  import('../pages/Team/Team').then((module) => ({
    default: module.TeamManagement,
  }))
);

export const LazyTeamManagementPage = lazy(() =>
  import('../pages/Settings/TeamManagement').then((module) => ({
    default: module.TeamManagement,
  }))
);

export const LazyReports = lazy(() =>
  import('../pages/Reports/Reports').then((module) => ({
    default: module.Reports,
  }))
);

export const LazySmDashboard = lazy(() =>
  import('../pages/SmDashboard/SmDashboard').then((module) => ({
    default: module.SmDashboard,
  }))
);

export const LazyIncrementList = lazy(() =>
  import('../pages/Increment/IncrementList').then((module) => ({
    default: module.IncrementList,
  }))
);

export const LazyIncrementDetail = lazy(() =>
  import('../pages/Increment/IncrementDetail').then((module) => ({
    default: module.IncrementDetail,
  }))
);

export const LazyIncrementCreate = lazy(() =>
  import('../pages/Increment/IncrementCreate').then((module) => ({
    default: module.IncrementCreate,
  }))
);

export const LazySprintReviewList = lazy(() =>
  import('../pages/SprintReview/SprintReviewList').then((module) => ({
    default: module.SprintReviewList,
  }))
);

export const LazySprintReview = lazy(() =>
  import('../pages/SprintReview/SprintReview').then((module) => ({
    default: module.SprintReview,
  }))
);

export const LazySprintRetrospective = lazy(() =>
  import('../pages/Retrospective/Retrospective').then((module) => ({
    default: module.SprintRetrospective,
  }))
);

export const LazyRetrospectiveList = lazy(() =>
  import('../pages/Retrospective/RetrospectiveList').then((module) => ({
    default: module.RetrospectiveList,
  }))
);

export const LazyNotifications = lazy(() =>
  import('../pages/Notifications/Notifications').then((module) => ({
    default: module.Notifications,
  }))
);

export const LazyPrivacyData = lazy(() =>
  import('../pages/Settings/PrivacyData').then((module) => ({
    default: module.PrivacyData,
  }))
);

export const LazyIconGallery = lazy(() =>
  import('../pages/Dev/IconGallery').then((module) => ({
    default: module.IconGallery,
  }))
);
