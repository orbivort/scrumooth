import { vi, type Mock } from 'vitest';

type AnyFn = (...args: unknown[]) => unknown;

export const apiService: Record<string, Mock<AnyFn>> = {
  getActiveSprint: vi.fn(),
  getBurndownData: vi.fn(),
  getImpediments: vi.fn(),
  getTeams: vi.fn(),
  getTeam: vi.fn(),
  getMyTeams: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  getSprint: vi.fn(),
  getSprints: vi.fn(),
  createSprint: vi.fn(),
  updateSprint: vi.fn(),
  deleteSprint: vi.fn(),
  startSprint: vi.fn(),
  completeSprint: vi.fn(),
  getProductBacklog: vi.fn(),
  createProductBacklogItem: vi.fn(),
  updateProductBacklogItem: vi.fn(),
  deleteProductBacklogItem: vi.fn(),
  getTeamMembers: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
  updateTeamMemberRole: vi.fn(),
  getTeamMetrics: vi.fn(),
  getSprintHistory: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  getCurrentUser: vi.fn(),
  getProductGoals: vi.fn(),
  getGeneratedSprints: vi.fn(),
  getSprintTasks: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  getRetrospective: vi.fn(),
  getRetrospectives: vi.fn(),
  createRetrospective: vi.fn(),
  updateRetrospective: vi.fn(),
  addRetrospectiveItem: vi.fn(),
  voteRetrospectiveItem: vi.fn(),
  unvoteRetrospectiveItem: vi.fn(),
  deleteRetrospectiveItem: vi.fn(),
  updateRetrospectiveItem: vi.fn(),
  addActionItem: vi.fn(),
  updateActionItem: vi.fn(),
  deleteActionItem: vi.fn(),
  getPendingRetroActionItems: vi.fn(),
  addRetroAttendee: vi.fn(),
  updateRetroAttendee: vi.fn(),
  deleteRetroAttendee: vi.fn(),
  getSprintReviews: vi.fn(),
  getSprintReview: vi.fn(),
  createSprintReview: vi.fn(),
  updateSprintReview: vi.fn(),
  completeSprintReview: vi.fn(),
  addStakeholderFeedback: vi.fn(),
  updateStakeholderFeedback: vi.fn(),
  deleteStakeholderFeedback: vi.fn(),
  addBacklogAdjustment: vi.fn(),
  updateBacklogAdjustment: vi.fn(),
  deleteBacklogAdjustment: vi.fn(),
  getDefinitionOfDone: vi.fn(),
  updateDefinitionOfDone: vi.fn(),
  getDefinitionOfReady: vi.fn(),
  updateDefinitionOfReady: vi.fn(),
  getDoDChecklist: vi.fn(),
  verifyDoDItem: vi.fn(),
  getDoRChecklist: vi.fn(),
  verifyDoRItem: vi.fn(),
  getIncrements: vi.fn(),
  getIncrement: vi.fn(),
  createIncrement: vi.fn(),
  updateIncrement: vi.fn(),
  verifyUsability: vi.fn(),
  reconcileIncrement: vi.fn(),
  startIncrement: vi.fn(),
  completeIncrement: vi.fn(),
  getIncrementMetrics: vi.fn(),
  generateSprints: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTasksByPbiId: vi.fn(),
  addPBIToSprint: vi.fn(),
  removePBIFromSprint: vi.fn(),
  acknowledgeSprintBacklogChange: vi.fn(),
  getSprintBacklogChanges: vi.fn(),
  createImpediment: vi.fn(),
  updateImpediment: vi.fn(),
  resolveImpediment: vi.fn(),
  deleteImpediment: vi.fn(),
};

export const setAuthCallbacks: Mock<AnyFn> = vi.fn();

export const sessionManager: Record<string, Mock<AnyFn>> = {
  startSession: vi.fn(),
  endSession: vi.fn(),
  extendSession: vi.fn(),
  getSessionState: vi.fn(),
  setActivityNotifier: vi.fn(),
  initialize: vi.fn(),
  destroy: vi.fn(),
  resetIdleTimer: vi.fn(),
  resetWarningState: vi.fn(),
  updateConfig: vi.fn(),
  getTimeUntilTimeout: vi.fn(),
  getTimeUntilWarning: vi.fn(),
  isSessionExpired: vi.fn(),
};

export const smDashboardService: Record<string, Mock<AnyFn>> = {
  getDashboard: vi.fn(),
  getEventSchedule: vi.fn(),
  updateSprintSmNotes: vi.fn(),
  updateSprintReviewSmNotes: vi.fn(),
  updateRetrospectiveSmNotes: vi.fn(),
  getSprintSmNotesRevisions: vi.fn(),
  getSprintReviewSmNotesRevisions: vi.fn(),
  getRetrospectiveSmNotesRevisions: vi.fn(),
};

// The facilitation surfaces added for the Scrum Master dashboard remediation.
export const organizationalBarriersService: Record<string, Mock<AnyFn>> = {
  getBarriers: vi.fn(),
  getStats: vi.fn(),
  getEscalatableImpediments: vi.fn(),
  getBarrier: vi.fn(),
  createBarrier: vi.fn(),
  escalateImpediment: vi.fn(),
  updateBarrier: vi.fn(),
  deleteBarrier: vi.fn(),
  addStakeholderAction: vi.fn(),
  updateStakeholderAction: vi.fn(),
  deleteStakeholderAction: vi.fn(),
};

export const coachingService: Record<string, Mock<AnyFn>> = {
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
};

export const workingAgreementsService: Record<string, Mock<AnyFn>> = {
  getAgreements: vi.fn(),
  createAgreement: vi.fn(),
  updateAgreement: vi.fn(),
};

export const crossFunctionalityService: Record<string, Mock<AnyFn>> = {
  getRecord: vi.fn(),
  getAssessment: vi.fn(),
  createAssessment: vi.fn(),
};

export const teamGroupService: Record<string, Mock<AnyFn>> = {
  listGroups: vi.fn(),
  getGroup: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getSharedDefinitionOfDone: vi.fn(),
  updateSharedDefinitionOfDone: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
};

export const healthCheckService: Record<string, Mock<AnyFn>> = {
  getHealthChecks: vi.fn(),
  createHealthCheck: vi.fn(),
  getHealthCheck: vi.fn(),
  getResults: vi.fn(),
  submitResponses: vi.fn(),
  getTrend: vi.fn(),
  getLatest: vi.fn(),
};

export const definitionService: Record<string, Mock<AnyFn>> = {
  getDefinitionOfDone: vi.fn(),
  updateDefinitionOfDone: vi.fn(),
  getDoDHistory: vi.fn(),
  verifyDoDForPBI: vi.fn(),
  getDoDVerificationsForPBI: vi.fn(),
  getDoDComplianceReport: vi.fn(),
  getDefinitionOfReady: vi.fn(),
  updateDefinitionOfReady: vi.fn(),
  getDoRHistory: vi.fn(),
  verifyDoRForPBI: vi.fn(),
  getDoRVerificationsForPBI: vi.fn(),
};

export const notificationApi: Record<string, Mock<AnyFn>> = {
  getNotifications: vi.fn(),
  getConfig: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  sendDirectMessage: vi.fn(),
};

/**
 * The envelope the API answers with, mirroring `src/types/index.ts`.
 *
 * Kept in step with the real types on purpose: a test that mocks a service and
 * returns `{ success: false, error: 'nope' }` would type-check against a stale
 * shape and then fail against the real one, which is the opposite of what a mock
 * is for.
 */
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};

export type PaginatedResponse<T = unknown> = {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
