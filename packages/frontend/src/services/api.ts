// API Service Facade
// This file re-exports all domain services for backward compatibility
// New code should import services directly from their domain files

// Core infrastructure
export { coreApiService, setAuthCallbacks } from './core/api.core';

// Domain services
export { authService } from './domain/auth.service';
export { teamService } from './domain/team.service';
export { productBacklogService } from './domain/productBacklog.service';
export { sprintService } from './domain/sprint.service';
export { sprintBacklogService } from './domain/sprintBacklog.service';
export { dailyScrumService } from './domain/dailyScrum.service';
export { impedimentsService } from './domain/impediments.service';
export { reportsService } from './domain/reports.service';
export { productGoalsService } from './domain/productGoals.service';
export { sprintConfigService } from './domain/sprintConfig.service';
export { definitionService } from './domain/definition.service';
export { incrementService } from './domain/increment.service';
export { sprintReviewService } from './domain/sprintReview.service';
export { retrospectiveService } from './domain/retrospective.service';
export { systemParamsService } from './domain/systemParams.service';
export { dataExportService } from './domain/dataExport.service';
export { timeboxService } from './domain/timebox.service';

// Legacy ApiService class for backward compatibility
// This maintains the existing API while encouraging direct service imports
import { coreApiService } from './core/api.core';
import { authService } from './domain/auth.service';
import { teamService } from './domain/team.service';
import { productBacklogService } from './domain/productBacklog.service';
import { sprintService } from './domain/sprint.service';
import { sprintBacklogService } from './domain/sprintBacklog.service';
import { dailyScrumService } from './domain/dailyScrum.service';
import { impedimentsService } from './domain/impediments.service';
import { reportsService } from './domain/reports.service';
import { productGoalsService } from './domain/productGoals.service';
import { sprintConfigService } from './domain/sprintConfig.service';
import { incrementService } from './domain/increment.service';
import { sprintReviewService } from './domain/sprintReview.service';
import { retrospectiveService } from './domain/retrospective.service';
import { systemParamsService } from './domain/systemParams.service';
import { dataExportService } from './domain/dataExport.service';
import { timeboxService } from './domain/timebox.service';
import { definitionService } from './domain/definition.service';

class ApiService {
  // Auth endpoints
  login = authService.login.bind(authService);
  register = authService.register.bind(authService);
  getRegistrationPolicy = authService.getRegistrationPolicy.bind(authService);
  logout = authService.logout.bind(authService);
  logoutAllSessions = authService.logoutAllSessions.bind(authService);
  getCurrentUser = authService.getCurrentUser.bind(authService);
  updateActivity = authService.updateActivity.bind(authService);
  getActiveSessions = authService.getActiveSessions.bind(authService);
  revokeSession = authService.revokeSession.bind(authService);
  checkDeletionEligibility = authService.checkDeletionEligibility.bind(authService);
  deleteAccount = authService.deleteAccount.bind(authService);
  scheduleDeletion = authService.scheduleDeletion.bind(authService);
  cancelScheduledDeletion = authService.cancelScheduledDeletion.bind(authService);
  forceDeleteAccount = authService.forceDeleteAccount.bind(authService);
  getDeletionStatus = authService.getDeletionStatus.bind(authService);
  updateProfile = authService.updateProfile.bind(authService);
  changePassword = authService.changePassword.bind(authService);
  forgotPassword = authService.forgotPassword.bind(authService);
  validateResetToken = authService.validateResetToken.bind(authService);
  resetPassword = authService.resetPassword.bind(authService);

  // Team endpoints
  getTeams = teamService.getTeams.bind(teamService);
  getTeam = teamService.getTeam.bind(teamService);
  createTeam = teamService.createTeam.bind(teamService);
  updateTeam = teamService.updateTeam.bind(teamService);
  deleteTeam = teamService.deleteTeam.bind(teamService);
  addTeamMember = teamService.addTeamMember.bind(teamService);
  removeTeamMember = teamService.removeTeamMember.bind(teamService);
  updateTeamMemberRole = teamService.updateTeamMemberRole.bind(teamService);
  getMyTeams = teamService.getMyTeams.bind(teamService);
  getMyRoleInTeam = teamService.getMyRoleInTeam.bind(teamService);
  selectTeam = teamService.selectTeam.bind(teamService);

  // Product Backlog endpoints
  getProductBacklog = productBacklogService.getProductBacklog.bind(productBacklogService);
  createProductBacklogItem =
    productBacklogService.createProductBacklogItem.bind(productBacklogService);
  bulkCreateProductBacklogItems =
    productBacklogService.bulkCreateProductBacklogItems.bind(productBacklogService);
  updateProductBacklogItem =
    productBacklogService.updateProductBacklogItem.bind(productBacklogService);
  updateBacklogItemPriority =
    productBacklogService.updateBacklogItemPriority.bind(productBacklogService);
  getBacklogItemCountByGoal =
    productBacklogService.getBacklogItemCountByGoal.bind(productBacklogService);
  deleteProductBacklogItem =
    productBacklogService.deleteProductBacklogItem.bind(productBacklogService);

  // Sprint endpoints
  getSprints = sprintService.getSprints.bind(sprintService);
  getActiveSprint = sprintService.getActiveSprint.bind(sprintService);
  createSprint = sprintService.createSprint.bind(sprintService);
  getSprint = sprintService.getSprint.bind(sprintService);
  startSprint = sprintService.startSprint.bind(sprintService);
  saveSprintBacklog = sprintService.saveSprintBacklog.bind(sprintService);
  saveSprintPlanningDraft = sprintService.saveSprintPlanningDraft.bind(sprintService);
  getSprintPlanningDraft = sprintService.getSprintPlanningDraft.bind(sprintService);
  rollbackSprintStart = sprintService.rollbackSprintStart.bind(sprintService);
  updateSprint = sprintService.updateSprint.bind(sprintService);
  completeSprint = sprintService.completeSprint.bind(sprintService);
  cancelSprint = sprintService.cancelSprint.bind(sprintService);
  getBurndownData = sprintService.getBurndownData.bind(sprintService);
  getAvailablePBIsForSprint = sprintService.getAvailablePBIsForSprint.bind(sprintService);
  getSprintBacklogPBIs = sprintService.getSprintBacklogPBIs.bind(sprintService);
  getEligiblePBIsForIncrement = sprintService.getEligiblePBIsForIncrement.bind(sprintService);

  // Sprint Backlog / Tasks endpoints
  getSprintTasks = sprintBacklogService.getSprintTasks.bind(sprintBacklogService);
  createTask = sprintBacklogService.createTask.bind(sprintBacklogService);
  updateTask = sprintBacklogService.updateTask.bind(sprintBacklogService);
  deleteTask = sprintBacklogService.deleteTask.bind(sprintBacklogService);
  getTasksByPbiId = sprintBacklogService.getTasksByPbiId.bind(sprintBacklogService);
  addPBIToSprint = sprintBacklogService.addPBIToSprint.bind(sprintBacklogService);
  removePBIFromSprint = sprintBacklogService.removePBIFromSprint.bind(sprintBacklogService);
  getSprintBacklogChanges = sprintBacklogService.getSprintBacklogChanges.bind(sprintBacklogService);

  // Daily Scrum endpoints (team-level, goal-focused)
  getDailyScrum = dailyScrumService.getDailyScrum.bind(dailyScrumService);
  getDailyScrums = dailyScrumService.getDailyScrums.bind(dailyScrumService);
  createDailyScrum = dailyScrumService.createDailyScrum.bind(dailyScrumService);
  updateDailyScrum = dailyScrumService.updateDailyScrum.bind(dailyScrumService);
  recordDailyScrumParticipation = dailyScrumService.recordParticipation.bind(dailyScrumService);
  getDailyScrumParticipation = dailyScrumService.getParticipation.bind(dailyScrumService);
  sendDailyScrumTeamSignal = dailyScrumService.sendTeamSignal.bind(dailyScrumService);
  promoteImpedimentFromDailyScrum = dailyScrumService.promoteToImpediment.bind(dailyScrumService);

  // Impediments endpoints
  getImpediments = impedimentsService.getImpediments.bind(impedimentsService);
  createImpediment = impedimentsService.createImpediment.bind(impedimentsService);
  updateImpediment = impedimentsService.updateImpediment.bind(impedimentsService);
  deleteImpediment = impedimentsService.deleteImpediment.bind(impedimentsService);

  // Reports endpoints
  getVelocityData = reportsService.getVelocityData.bind(reportsService);
  getSprintHistory = reportsService.getSprintHistory.bind(reportsService);
  getTeamMetrics = reportsService.getTeamMetrics.bind(reportsService);
  getInsights = reportsService.getInsights.bind(reportsService);
  getStatusChangeHistory = reportsService.getStatusChangeHistory.bind(reportsService);

  // Product Goals endpoints
  getProductGoals = productGoalsService.getProductGoals.bind(productGoalsService);
  createProductGoal = productGoalsService.createProductGoal.bind(productGoalsService);
  updateProductGoal = productGoalsService.updateProductGoal.bind(productGoalsService);
  deleteProductGoal = productGoalsService.deleteProductGoal.bind(productGoalsService);
  getProductGoalStatusHistory =
    productGoalsService.getProductGoalStatusHistory.bind(productGoalsService);
  getProductGoalSnapshots = productGoalsService.getSnapshots.bind(productGoalsService);

  // Sprint Configuration endpoints
  getSprintConfiguration = sprintConfigService.getSprintConfiguration.bind(sprintConfigService);
  createSprintConfiguration =
    sprintConfigService.createSprintConfiguration.bind(sprintConfigService);
  updateSprintConfiguration =
    sprintConfigService.updateSprintConfiguration.bind(sprintConfigService);
  generateSprintsForYear = sprintConfigService.generateSprintsForYear.bind(sprintConfigService);
  getGeneratedSprints = sprintConfigService.getGeneratedSprints.bind(sprintConfigService);
  deleteGeneratedSprint = sprintConfigService.deleteGeneratedSprint.bind(sprintConfigService);
  updateGeneratedSprint = sprintConfigService.updateGeneratedSprint.bind(sprintConfigService);

  // System Parameters endpoints
  getSystemParameters = systemParamsService.getSystemParameters.bind(systemParamsService);
  updateSystemParameter = systemParamsService.updateSystemParameter.bind(systemParamsService);

  // Increment endpoints
  getIncrements = incrementService.getIncrements.bind(incrementService);
  getIncrement = incrementService.getIncrement.bind(incrementService);
  createIncrement = incrementService.createIncrement.bind(incrementService);
  updateIncrement = incrementService.updateIncrement.bind(incrementService);
  deliverIncrement = incrementService.deliverIncrement.bind(incrementService);
  verifyIntegration = incrementService.verifyIntegration.bind(incrementService);
  getIncrementMetrics = incrementService.getIncrementMetrics.bind(incrementService);

  // Sprint Review endpoints
  getSprintReviews = sprintReviewService.getSprintReviews.bind(sprintReviewService);
  getSprintReview = sprintReviewService.getSprintReview.bind(sprintReviewService);
  createSprintReview = sprintReviewService.createSprintReview.bind(sprintReviewService);
  updateSprintReview = sprintReviewService.updateSprintReview.bind(sprintReviewService);
  addStakeholderFeedback = sprintReviewService.addStakeholderFeedback.bind(sprintReviewService);
  getPendingAdjustments = sprintReviewService.getPendingAdjustments.bind(sprintReviewService);
  markAdjustmentImplemented =
    sprintReviewService.markAdjustmentImplemented.bind(sprintReviewService);
  getPendingFeedback = sprintReviewService.getPendingFeedback.bind(sprintReviewService);
  markFeedbackAddressed = sprintReviewService.markFeedbackAddressed.bind(sprintReviewService);
  addAttendee = sprintReviewService.addAttendee.bind(sprintReviewService);
  updateAttendee = sprintReviewService.updateAttendee.bind(sprintReviewService);
  deleteAttendee = sprintReviewService.deleteAttendee.bind(sprintReviewService);
  getProductGoalForReview = sprintReviewService.getProductGoalForReview.bind(sprintReviewService);
  submitProductGoalAssessment =
    sprintReviewService.submitProductGoalAssessment.bind(sprintReviewService);

  // Sprint Retrospective endpoints
  getRetrospectives = retrospectiveService.getRetrospectives.bind(retrospectiveService);
  getPendingRetroActionItems =
    retrospectiveService.getPendingRetroActionItems.bind(retrospectiveService);
  getRetrospective = retrospectiveService.getRetrospective.bind(retrospectiveService);
  getRetrospectiveBySprintId =
    retrospectiveService.getRetrospectiveBySprintId.bind(retrospectiveService);
  createRetrospective = retrospectiveService.createRetrospective.bind(retrospectiveService);
  updateRetrospective = retrospectiveService.updateRetrospective.bind(retrospectiveService);
  addRetrospectiveItem = retrospectiveService.addRetrospectiveItem.bind(retrospectiveService);
  voteRetrospectiveItem = retrospectiveService.voteRetrospectiveItem.bind(retrospectiveService);
  unvoteRetrospectiveItem = retrospectiveService.unvoteRetrospectiveItem.bind(retrospectiveService);
  updateRetrospectiveItem = retrospectiveService.updateRetrospectiveItem.bind(retrospectiveService);
  deleteRetrospectiveItem = retrospectiveService.deleteRetrospectiveItem.bind(retrospectiveService);
  addActionItem = retrospectiveService.addActionItem.bind(retrospectiveService);
  updateActionItem = retrospectiveService.updateActionItem.bind(retrospectiveService);
  deleteActionItem = retrospectiveService.deleteActionItem.bind(retrospectiveService);
  addRetroAttendee = retrospectiveService.addRetroAttendee.bind(retrospectiveService);
  updateRetroAttendee = retrospectiveService.updateRetroAttendee.bind(retrospectiveService);
  deleteRetroAttendee = retrospectiveService.deleteRetroAttendee.bind(retrospectiveService);

  // Timebox endpoints (Scrum event timeboxes)
  getTimebox = timeboxService.getTimebox.bind(timeboxService);
  startTimebox = timeboxService.startTimebox.bind(timeboxService);
  pauseTimebox = timeboxService.pauseTimebox.bind(timeboxService);
  resetTimebox = timeboxService.resetTimebox.bind(timeboxService);
  concludeTimebox = timeboxService.concludeTimebox.bind(timeboxService);

  // Definition of Done endpoints
  getDefinitionOfDone = definitionService.getDefinitionOfDone.bind(definitionService);
  getDoDComplianceReport = definitionService.getDoDComplianceReport.bind(definitionService);

  // Data Export endpoints (GDPR Article 20)
  initiateDataExport = dataExportService.initiateExport.bind(dataExportService);
  getExportStatus = dataExportService.getExportStatus.bind(dataExportService);
  downloadExport = dataExportService.downloadExport.bind(dataExportService);
  cancelExport = dataExportService.cancelExport.bind(dataExportService);
  getActiveExports = dataExportService.getActiveExports.bind(dataExportService);

  // Team context methods
  setCurrentTeamContext = coreApiService.setCurrentTeamContext.bind(coreApiService);
  clearTeamContext = coreApiService.clearTeamContext.bind(coreApiService);

  // Generic HTTP methods for extensibility
  async get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }> {
    return coreApiService.axiosInstance.get(url, config);
  }

  async post<T>(url: string, data?: unknown): Promise<{ data: T }> {
    return coreApiService.axiosInstance.post(url, data);
  }

  async put<T>(url: string, data?: unknown): Promise<{ data: T }> {
    return coreApiService.axiosInstance.put(url, data);
  }

  async patch<T>(url: string, data?: unknown): Promise<{ data: T }> {
    return coreApiService.axiosInstance.patch(url, data);
  }

  async delete<T = never>(url: string): Promise<{ data: T }> {
    return coreApiService.axiosInstance.delete(url);
  }
}

export const apiService = new ApiService();
export default apiService;
export type { ApiService };
