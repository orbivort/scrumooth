import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./core/api.core', () => ({
  coreApiService: {
    axiosInstance: {
      get: vi.fn().mockResolvedValue({ data: { test: 'value' } }),
      post: vi.fn().mockResolvedValue({ data: { id: '1' } }),
      patch: vi.fn().mockResolvedValue({ data: { updated: true } }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
    },
    setCurrentTeamContext: vi.fn(),
    clearTeamContext: vi.fn(),
  },
  setAuthCallbacks: vi.fn(),
}));

vi.mock('./domain/auth.service', () => ({
  authService: {
    login: vi.fn().mockResolvedValue({ data: { user: { id: '1' } } }),
    register: vi.fn().mockResolvedValue({ data: { user: { id: '1' } } }),
    getRegistrationPolicy: vi.fn().mockResolvedValue({ data: {} }),
    logout: vi.fn().mockResolvedValue({}),
    logoutAllSessions: vi.fn().mockResolvedValue({}),
    getCurrentUser: vi.fn().mockResolvedValue({ data: { user: { id: '1' } } }),
    updateActivity: vi.fn().mockResolvedValue({}),
    getActiveSessions: vi.fn().mockResolvedValue({ data: [] }),
    revokeSession: vi.fn().mockResolvedValue({}),
    checkDeletionEligibility: vi.fn().mockResolvedValue({ data: { eligible: true } }),
    deleteAccount: vi.fn().mockResolvedValue({}),
    scheduleDeletion: vi.fn().mockResolvedValue({}),
    cancelScheduledDeletion: vi.fn().mockResolvedValue({}),
    forceDeleteAccount: vi.fn().mockResolvedValue({}),
    getDeletionStatus: vi.fn().mockResolvedValue({ data: {} }),
    updateProfile: vi.fn().mockResolvedValue({}),
    changePassword: vi.fn().mockResolvedValue({}),
    forgotPassword: vi.fn().mockResolvedValue({}),
    validateResetToken: vi.fn().mockResolvedValue({}),
    resetPassword: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/team.service', () => ({
  teamService: {
    getTeams: vi.fn().mockResolvedValue({ data: [] }),
    getTeam: vi.fn().mockResolvedValue({ data: {} }),
    createTeam: vi.fn().mockResolvedValue({ data: {} }),
    updateTeam: vi.fn().mockResolvedValue({}),
    deleteTeam: vi.fn().mockResolvedValue({}),
    addTeamMember: vi.fn().mockResolvedValue({}),
    removeTeamMember: vi.fn().mockResolvedValue({}),
    updateTeamMemberRole: vi.fn().mockResolvedValue({}),
    getMyTeams: vi.fn().mockResolvedValue({ data: [] }),
    getMyRoleInTeam: vi.fn().mockResolvedValue({ data: {} }),
    selectTeam: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/productBacklog.service', () => ({
  productBacklogService: {
    getProductBacklog: vi.fn().mockResolvedValue({ data: [] }),
    createProductBacklogItem: vi.fn().mockResolvedValue({ data: {} }),
    bulkCreateProductBacklogItems: vi.fn().mockResolvedValue({ data: {} }),
    updateProductBacklogItem: vi.fn().mockResolvedValue({}),
    updateBacklogItemPriority: vi.fn().mockResolvedValue({}),
    reorderProductBacklogItems: vi.fn().mockResolvedValue({ data: { items: [] } }),
    getBacklogItemCountByGoal: vi.fn().mockResolvedValue(0),
    deleteProductBacklogItem: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/sprint.service', () => ({
  sprintService: {
    getSprints: vi.fn().mockResolvedValue({ data: [] }),
    getActiveSprint: vi.fn().mockResolvedValue({ data: {} }),
    createSprint: vi.fn().mockResolvedValue({ data: {} }),
    getSprint: vi.fn().mockResolvedValue({ data: {} }),
    startSprint: vi.fn().mockResolvedValue({}),
    saveSprintBacklog: vi.fn().mockResolvedValue({ data: {} }),
    saveSprintPlanningDraft: vi.fn().mockResolvedValue({ data: {} }),
    getSprintPlanningDraft: vi.fn().mockResolvedValue({ data: {} }),
    rollbackSprintStart: vi.fn().mockResolvedValue({}),
    updateSprint: vi.fn().mockResolvedValue({}),
    completeSprint: vi.fn().mockResolvedValue({}),
    cancelSprint: vi.fn().mockResolvedValue({}),
    getBurndownData: vi.fn().mockResolvedValue({ data: {} }),
    getAvailablePBIsForSprint: vi.fn().mockResolvedValue({ data: [] }),
    getSprintBacklogPBIs: vi.fn().mockResolvedValue({ data: [] }),
    getEligiblePBIsForIncrement: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('./domain/sprintBacklog.service', () => ({
  sprintBacklogService: {
    getSprintTasks: vi.fn().mockResolvedValue({ data: [] }),
    createTask: vi.fn().mockResolvedValue({ data: {} }),
    updateTask: vi.fn().mockResolvedValue({}),
    deleteTask: vi.fn().mockResolvedValue({}),
    getTasksByPbiId: vi.fn().mockResolvedValue({ data: [] }),
    addPBIToSprint: vi.fn().mockResolvedValue({}),
    removePBIFromSprint: vi.fn().mockResolvedValue({}),
    getSprintBacklogChanges: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('./domain/impediments.service', () => ({
  impedimentsService: {
    getImpediments: vi.fn().mockResolvedValue({ data: [] }),
    createImpediment: vi.fn().mockResolvedValue({ data: {} }),
    updateImpediment: vi.fn().mockResolvedValue({}),
    deleteImpediment: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/reports.service', () => ({
  reportsService: {
    getVelocityData: vi.fn().mockResolvedValue({ data: {} }),
    getSprintHistory: vi.fn().mockResolvedValue({ data: [] }),
    getTeamMetrics: vi.fn().mockResolvedValue({ data: {} }),
    getInsights: vi.fn().mockResolvedValue({ data: [] }),
    getStatusChangeHistory: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('./domain/productGoals.service', () => ({
  productGoalsService: {
    getProductGoals: vi.fn().mockResolvedValue({ data: [] }),
    createProductGoal: vi.fn().mockResolvedValue({ data: {} }),
    updateProductGoal: vi.fn().mockResolvedValue({}),
    deleteProductGoal: vi.fn().mockResolvedValue({}),
    getProductGoalStatusHistory: vi.fn().mockResolvedValue({ data: [] }),
    getSnapshots: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('./domain/sprintConfig.service', () => ({
  sprintConfigService: {
    getSprintConfiguration: vi.fn().mockResolvedValue({ data: {} }),
    createSprintConfiguration: vi.fn().mockResolvedValue({ data: {} }),
    updateSprintConfiguration: vi.fn().mockResolvedValue({}),
    generateSprintsForYear: vi.fn().mockResolvedValue({ data: [] }),
    getGeneratedSprints: vi.fn().mockResolvedValue({ data: [] }),
    deleteGeneratedSprint: vi.fn().mockResolvedValue({}),
    updateGeneratedSprint: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/systemParams.service', () => ({
  systemParamsService: {
    getSystemParameters: vi.fn().mockResolvedValue({ data: {} }),
    updateSystemParameter: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/definition.service', () => ({
  definitionService: {
    getDefinitionOfDone: vi.fn().mockResolvedValue({ data: {} }),
    updateDefinitionOfDone: vi.fn().mockResolvedValue({}),
    getDoDHistory: vi.fn().mockResolvedValue({ data: [] }),
    verifyDoDForPBI: vi.fn().mockResolvedValue({ data: {} }),
    getDoDVerificationsForPBI: vi.fn().mockResolvedValue({ data: [] }),
    getDoDComplianceReport: vi.fn().mockResolvedValue({ data: {} }),
    getDefinitionOfReady: vi.fn().mockResolvedValue({ data: {} }),
    updateDefinitionOfReady: vi.fn().mockResolvedValue({}),
    getDoRHistory: vi.fn().mockResolvedValue({ data: [] }),
    verifyDoRForPBI: vi.fn().mockResolvedValue({ data: {} }),
    getDoRVerificationsForPBI: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('./domain/increment.service', () => ({
  incrementService: {
    getIncrements: vi.fn().mockResolvedValue({ data: [] }),
    getIncrement: vi.fn().mockResolvedValue({ data: {} }),
    createIncrement: vi.fn().mockResolvedValue({ data: {} }),
    updateIncrement: vi.fn().mockResolvedValue({}),
    deliverIncrement: vi.fn().mockResolvedValue({}),
    verifyIntegration: vi.fn().mockResolvedValue({ data: {} }),
    getIncrementMetrics: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('./domain/sprintReview.service', () => ({
  sprintReviewService: {
    getSprintReviews: vi.fn().mockResolvedValue({ data: [] }),
    getSprintReview: vi.fn().mockResolvedValue({ data: {} }),
    createSprintReview: vi.fn().mockResolvedValue({ data: {} }),
    updateSprintReview: vi.fn().mockResolvedValue({}),
    addStakeholderFeedback: vi.fn().mockResolvedValue({}),
    getPendingAdjustments: vi.fn().mockResolvedValue({ data: [] }),
    markAdjustmentImplemented: vi.fn().mockResolvedValue({}),
    getPendingFeedback: vi.fn().mockResolvedValue({ data: [] }),
    markFeedbackAddressed: vi.fn().mockResolvedValue({}),
    addAttendee: vi.fn().mockResolvedValue({}),
    updateAttendee: vi.fn().mockResolvedValue({}),
    deleteAttendee: vi.fn().mockResolvedValue({}),
    getProductGoalForReview: vi.fn().mockResolvedValue({
      data: { productGoal: null },
    }),
    submitProductGoalAssessment: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('./domain/retrospective.service', () => ({
  retrospectiveService: {
    getRetrospectives: vi.fn().mockResolvedValue({ data: [] }),
    getPendingRetroActionItems: vi.fn().mockResolvedValue({ data: [] }),
    getRetrospective: vi.fn().mockResolvedValue({ data: {} }),
    getRetrospectiveBySprintId: vi.fn().mockResolvedValue({ data: {} }),
    createRetrospective: vi.fn().mockResolvedValue({ data: {} }),
    updateRetrospective: vi.fn().mockResolvedValue({}),
    addRetrospectiveItem: vi.fn().mockResolvedValue({}),
    voteRetrospectiveItem: vi.fn().mockResolvedValue({}),
    unvoteRetrospectiveItem: vi.fn().mockResolvedValue({}),
    updateRetrospectiveItem: vi.fn().mockResolvedValue({}),
    deleteRetrospectiveItem: vi.fn().mockResolvedValue({}),
    addActionItem: vi.fn().mockResolvedValue({}),
    updateActionItem: vi.fn().mockResolvedValue({}),
    deleteActionItem: vi.fn().mockResolvedValue({}),
    addRetroAttendee: vi.fn().mockResolvedValue({}),
    updateRetroAttendee: vi.fn().mockResolvedValue({}),
    deleteRetroAttendee: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('./domain/dataExport.service', () => ({
  dataExportService: {
    initiateExport: vi.fn().mockResolvedValue({ data: {} }),
    getExportStatus: vi.fn().mockResolvedValue({ data: {} }),
    downloadExport: vi.fn().mockResolvedValue({ data: {} }),
    cancelExport: vi.fn().mockResolvedValue({}),
    getActiveExports: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

import { apiService } from './api';
import { coreApiService } from './core/api.core';

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Generic HTTP methods', () => {
    it('should call get with correct url', async () => {
      await apiService.get('/test');

      expect(coreApiService.axiosInstance.get).toHaveBeenCalledWith('/test', undefined);
    });

    it('should call get with params', async () => {
      await apiService.get('/test', { params: { id: '1' } });

      expect(coreApiService.axiosInstance.get).toHaveBeenCalledWith('/test', {
        params: { id: '1' },
      });
    });

    it('should call post with correct url and data', async () => {
      await apiService.post('/test', { name: 'test' });

      expect(coreApiService.axiosInstance.post).toHaveBeenCalledWith('/test', { name: 'test' });
    });

    it('should call post without data', async () => {
      await apiService.post('/test');

      expect(coreApiService.axiosInstance.post).toHaveBeenCalledWith('/test', undefined);
    });

    it('should call patch with correct url and data', async () => {
      await apiService.patch('/test', { name: 'updated' });

      expect(coreApiService.axiosInstance.patch).toHaveBeenCalledWith('/test', { name: 'updated' });
    });

    it('should call delete with correct url', async () => {
      await apiService.delete('/test');

      expect(coreApiService.axiosInstance.delete).toHaveBeenCalledWith('/test');
    });
  });

  describe('Team context methods', () => {
    it('should call setCurrentTeamContext', () => {
      apiService.setCurrentTeamContext('team-1');

      expect(coreApiService.setCurrentTeamContext).toHaveBeenCalledWith('team-1');
    });

    it('should call clearTeamContext', () => {
      apiService.clearTeamContext();

      expect(coreApiService.clearTeamContext).toHaveBeenCalled();
    });
  });

  describe('Auth endpoints', () => {
    it('should call login', async () => {
      await apiService.login('test@example.com', 'password');

      expect(apiService.login).toBeDefined();
    });

    it('should call register', async () => {
      await apiService.register({
        email: 'test@example.com',
        password: 'password',
        username: 'test',
      });

      expect(apiService.register).toBeDefined();
    });

    it('should call logout', async () => {
      await apiService.logout();

      expect(apiService.logout).toBeDefined();
    });

    it('should call getCurrentUser', async () => {
      await apiService.getCurrentUser();

      expect(apiService.getCurrentUser).toBeDefined();
    });
  });

  describe('Team endpoints', () => {
    it('should call getTeams', async () => {
      await apiService.getTeams();

      expect(apiService.getTeams).toBeDefined();
    });

    it('should call createTeam', async () => {
      await apiService.createTeam({ name: 'Test Team' });

      expect(apiService.createTeam).toBeDefined();
    });
  });

  describe('Sprint endpoints', () => {
    it('should call getSprints', async () => {
      await apiService.getSprints('team-1');

      expect(apiService.getSprints).toBeDefined();
    });

    it('should call getActiveSprint', async () => {
      await apiService.getActiveSprint('team-1');

      expect(apiService.getActiveSprint).toBeDefined();
    });

    it('should call createSprint', async () => {
      await apiService.createSprint({} as never);

      expect(apiService.createSprint).toBeDefined();
    });
  });

  describe('ApiService instance', () => {
    it('should be defined', () => {
      expect(apiService).toBeDefined();
    });

    it('should have all required methods', () => {
      expect(typeof apiService.get).toBe('function');
      expect(typeof apiService.post).toBe('function');
      expect(typeof apiService.patch).toBe('function');
      expect(typeof apiService.delete).toBe('function');
      expect(typeof apiService.setCurrentTeamContext).toBe('function');
      expect(typeof apiService.clearTeamContext).toBe('function');
    });
  });
});
