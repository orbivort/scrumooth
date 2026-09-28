// Services Index
// Re-export all services for convenient imports.
//
// This is a pure barrel: it selects nothing and substitutes nothing. Mock mode is
// answered at the HTTP boundary by `src/mocks` — the same domain services, the
// same axios client, the same interceptors — so there is no second implementation
// of the product for this file to choose between. See
// `src/mocks/README.md` and `docs/architecture/frontend-mock-architecture.md`.

// Core infrastructure
export { coreApiService, setAuthCallbacks } from './core/api.core';

// The facade that collects one method per endpoint on a single object. Kept for
// the modules written against it; new code imports the domain service directly.
export { apiService } from './api';
export type { ApiService } from './api';

// Domain services
export { authService } from './domain/auth.service';
export { teamService } from './domain/team.service';
export { teamGroupService } from './domain/teamGroup.service';
export { productBacklogService } from './domain/productBacklog.service';
export { productGoalsService } from './domain/productGoals.service';
export { sprintService } from './domain/sprint.service';
export { sprintBacklogService } from './domain/sprintBacklog.service';
export { sprintConfigService } from './domain/sprintConfig.service';
export { dailyScrumService } from './domain/dailyScrum.service';
export { dailyScrumScheduleService } from './domain/dailyScrumSchedule.service';
export { impedimentsService } from './domain/impediments.service';
export { definitionService } from './domain/definition.service';
export { incrementService } from './domain/increment.service';
export { sprintReviewService } from './domain/sprintReview.service';
export { retrospectiveService } from './domain/retrospective.service';
export { reportsService } from './domain/reports.service';
export { smDashboardService } from './domain/smDashboard.service';
export { healthCheckService } from './domain/healthCheck.service';
export { organizationalBarriersService } from './domain/organizationalBarriers.service';
export { coachingService } from './domain/coaching.service';
export { workingAgreementsService } from './domain/workingAgreements.service';
export { crossFunctionalityService } from './domain/crossFunctionality.service';
export { timeboxService } from './domain/timebox.service';
export { systemParamsService } from './domain/systemParams.service';
export { dataExportService } from './domain/dataExport.service';

// The session lifecycle, which owns the idle/absolute timeouts.
export { sessionManager } from './sessionManager';

// The notification client: the inbox endpoints, each answering the standard envelope.
export { notificationApi } from './notificationApi';

// Mapping utilities
export * from './utils/mapping.utils';

// Type exports
export type { ApiResponse, PaginatedResponse } from '../types';
