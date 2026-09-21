// Mock API Service for Prototype Demo
// This service returns mock data instead of making real API calls

import i18n from 'i18next';
import { timeboxFor, type ScrumEvent } from '@scrumooth/shared';

import {
  RetrospectiveCategory,
  IncrementStatus,
  DeliveryMethod,
  ItemStatus,
  TaskStatus,
  SprintStatus,
  ImpedimentStatus,
  MoSCoWPriority,
  RetrospectiveStatus,
  type UserRole,
  type ApiResponse,
  type PaginatedResponse,
  type LoginCredentials,
  type RegisterData,
  type RegistrationPolicy,
  type AuthTokens,
  type User,
  type Team,
  type TeamMember,
  type ProductBacklogItem,
  type Sprint,
  type Task,
  type Impediment,
  type DailyScrum,
  type DailyScrumParticipant,
  type ProductGoal,
  type SprintConfiguration,
  type SprintDuration,
  type GeneratedSprint,
  type SprintGenerationResult,
  type SystemParameter,
  type Increment,
  type SprintReview,
  type SprintRetrospective,
  type TimeboxState,
  type DefinitionOfDone,
  type DoDItem,
  type DoDChecklistVerification,
  type DoDComplianceReport,
  type DefinitionOfReady,
  type DoRItem,
  type DoRChecklistVerification,
  type StakeholderFeedback,
  type BacklogAdjustment,
  type ProductGoalSnapshot,
  type ProductGoalProgressAssessment,
  type RetroActionItem,
  type RetrospectiveItem,
  type IncrementMetrics,
  type SprintHistoryItem,
  type TeamMetrics,
  type Insight,
  type ReviewAttendee,
  type RetroAttendee,
  type StatusChangeHistoryItem,
  type SessionInfo,
  type SprintBacklogItem,
  type BacklogChange,
  type Notification as AppNotification,
  type ConsentRecord,
  type WorkflowState,
  type WorkflowTransition,
  type BulkCreateResponseData,
  type BulkCreateError,
  type SprintPlanningAttendee,
  type SprintPlanningCapacityEntry,
  type SprintPlanningParticipation,
  type SprintBacklogChangeResult,
  type SprintGoalImpact,
  type AcknowledgeSprintBacklogChangeRequest,
  type AcknowledgeSprintBacklogChangeResult,
} from '../types';
import type { BulkUploadItem } from '../pages/Backlog/BulkUpload/bulkUploadUtils';

import type { ReorderBacklogPayload, ReorderedBacklogItem } from './domain/productBacklog.service';
import type { TimeboxQuery } from './domain/timebox.service';
import { mockSuccess, mockError, mockDelay } from './mockResponseUtils';
import {
  mockUsers,
  mockTeams,
  mockProductBacklogItems,
  mockSprints,
  mockTasks,
  mockImpediments,
  mockBurndownData,
  mockVelocityData,
  mockProductGoals,
  mockDefinitionOfDone,
  getCurrentUser,
  getCurrentTeam,
  UUIDS,
} from './mockData';

const generateUUID = () => crypto.randomUUID();

const delay = (ms: number = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// Returns the date in the user's local timezone (YYYY-MM-DD). The Daily Scrum
// page queries by its locally-formatted "today" (formatLocalDate), so the mock
// seed and lookups must use the same local date or "Today's Daily Scrum" would
// show the empty state whenever the local timezone differs from UTC.
const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMockSessionInfo = (): SessionInfo => ({
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  idleTimeoutMs: 30 * 60 * 1000,
  absoluteTimeoutMs: 24 * 60 * 60 * 1000,
  warningThresholdMs: 2 * 60 * 1000,
});

class MockApiService {
  private consentStore: ConsentRecord[] = [];

  /** Recorded Sprint Planning capacity and participation (keyed by sprint id). */
  private planningCapacityStore = new Map<string, SprintPlanningCapacityEntry[]>();
  private planningAttendeeStore = new Map<string, SprintPlanningAttendee[]>();

  async login(
    credentials: LoginCredentials
  ): Promise<ApiResponse<{ user: User; tokens: AuthTokens; sessionInfo: SessionInfo }>> {
    await delay(500);

    const user = mockUsers.find((u) => u.email === credentials.email);
    if (!user) {
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      };
    }

    return {
      success: true,
      data: {
        user,
        tokens: {
          accessToken: `mock-access-token-${Date.now()}`,
          refreshToken: `mock-refresh-token-${Date.now()}`,
        },
        sessionInfo: getMockSessionInfo(),
      },
    };
  }

  async register(
    userData: RegisterData
  ): Promise<ApiResponse<{ user: User; tokens: AuthTokens; sessionInfo: SessionInfo }>> {
    await delay(500);

    const existingUser = mockUsers.find((u) => u.email === userData.email);
    if (existingUser) {
      return {
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
        },
      };
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      locale: userData.locale ?? 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: {
        user: newUser,
        tokens: {
          accessToken: `mock-access-token-${Date.now()}`,
          refreshToken: `mock-refresh-token-${Date.now()}`,
        },
        sessionInfo: getMockSessionInfo(),
      },
    };
  }

  async getRegistrationPolicy(): Promise<ApiResponse<RegistrationPolicy>> {
    await delay(100);
    // Mock mode defaults to open registration (no domain restriction).
    return {
      success: true,
      data: {
        restricted: false,
        allowedDomains: [],
      },
    };
  }

  async logout(): Promise<ApiResponse<never>> {
    await delay(200);
    return { success: true };
  }

  async logoutAllSessions(): Promise<ApiResponse<{ message: string }>> {
    await delay(200);
    return { success: true, data: { message: 'All sessions logged out' } };
  }

  async updateActivity(): Promise<ApiResponse<{ message: string }>> {
    await delay(100);
    return { success: true, data: { message: 'Activity updated' } };
  }

  async checkDeletionEligibility(): Promise<
    ApiResponse<{
      canDelete: boolean;
      teams: Array<{ id: string; name: string; role: string; isLastPO: boolean }>;
      blockedReason: string | null;
    }>
  > {
    await delay(200);
    return {
      success: true,
      data: {
        canDelete: true,
        teams: [],
        blockedReason: null,
      },
    };
  }

  async deleteAccount(_confirmation: string): Promise<ApiResponse<void>> {
    await delay(300);
    return { success: true };
  }

  async getActiveSessions(): Promise<
    ApiResponse<
      Array<{
        id: string;
        createdAt: string;
        lastActivityAt: string;
        expiresAt: string;
        userAgent: string | null;
        ipAddress: string | null;
      }>
    >
  > {
    await delay(200);
    return {
      success: true,
      data: [
        {
          id: 'session-1',
          createdAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          userAgent: navigator.userAgent,
          ipAddress: '127.0.0.1',
        },
      ],
    };
  }

  async revokeSession(_tokenId: string): Promise<ApiResponse<{ message: string }>> {
    await delay(200);
    return { success: true, data: { message: 'Session revoked' } };
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    await delay(200);
    return {
      success: true,
      data: getCurrentUser(),
    };
  }

  // ==================== Teams ====================
  async getTeams(): Promise<ApiResponse<Team[]>> {
    await delay(300);
    return {
      success: true,
      data: mockTeams,
    };
  }

  async getTeam(id: string): Promise<ApiResponse<Team>> {
    await delay(300);
    const team = mockTeams.find((t) => t.id === id);
    if (!team) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team not found',
        },
      };
    }
    return { success: true, data: team };
  }

  async createTeam(teamData: Partial<Team>): Promise<ApiResponse<Team>> {
    await delay(500);
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: teamData.name ?? 'New Team',
      description: teamData.description,
      createdBy: getCurrentUser().id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return { success: true, data: newTeam };
  }

  async addTeamMember(
    _teamId: string,
    email: string,
    role: string
  ): Promise<ApiResponse<TeamMember>> {
    await delay(400);
    const user = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      };
    }
    const newMember: TeamMember = {
      id: `member-${Date.now()}`,
      teamId: _teamId,
      userId: user.id,
      role: role as UserRole,
      joinedAt: new Date().toISOString(),
      user,
    };
    return { success: true, data: newMember };
  }

  async removeTeamMember(_teamId: string, _memberId: string): Promise<ApiResponse<never>> {
    await delay(300);
    return { success: true };
  }

  // ==================== Product Backlog ====================
  async getProductBacklog(
    teamId: string,
    params?: { status?: string; labels?: string; page?: number; limit?: number }
  ): Promise<PaginatedResponse<ProductBacklogItem>> {
    await delay(400);

    let items = mockProductBacklogItems.filter((item) => item.teamId === teamId);

    // Apply filters
    if (params?.status) {
      items = items.filter((item) => item.status === params.status);
    }

    if (params?.labels) {
      const labels = params.labels.split(',');
      items = items.filter((item) => labels.some((label) => item.labels.includes(label)));
    }

    // The Product Backlog is an ordered list, so it is read in the persisted order of record.
    items = [...items].sort((a, b) => a.rank - b.rank);

    // Apply pagination
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = items.slice(startIndex, endIndex);

    return {
      success: true,
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit),
      },
    };
  }

  async getBacklogItemCountByGoal(goalId: string): Promise<number> {
    await delay(200);
    return mockProductBacklogItems.filter((item) => item.goalId === goalId).length;
  }

  async createProductBacklogItem(
    item: Partial<ProductBacklogItem>
  ): Promise<ApiResponse<ProductBacklogItem>> {
    await delay(500);

    const teamId = item.teamId ?? getCurrentTeam().id;

    const newItem: ProductBacklogItem = {
      id: `pbi-${Date.now()}`,
      teamId,
      title: item.title ?? 'New Item',
      description: item.description,
      priority: item.priority ?? MoSCoWPriority.COULD_HAVE,
      // A new item joins the end of its team's order.
      rank: this.nextBacklogRank(teamId),
      storyPoints: item.storyPoints,
      businessValue: item.businessValue,
      status: item.status ?? ItemStatus.NEW,
      labels: item.labels ?? [],
      acceptanceCriteria: item.acceptanceCriteria,
      goalId: item.goalId,
      createdBy: getCurrentUser().id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockProductBacklogItems.push(newItem);

    return { success: true, data: newItem };
  }

  async bulkCreateProductBacklogItems(
    items: BulkUploadItem[],
    teamId: string,
    goalId: string
  ): Promise<ApiResponse<BulkCreateResponseData>> {
    await delay(500);

    const createdItems: ProductBacklogItem[] = [];
    const errors: BulkCreateError[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as BulkUploadItem;
      const rowNumber = item._rowNumber;

      // Validate title (mirrors backend Zod: min 1, max 200)
      if (!item.title || item.title.trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'title',
          message: 'Title is required',
        });
        continue;
      }

      if (item.title.trim().length > 200) {
        errors.push({
          row: rowNumber,
          field: 'title',
          message: 'Title must be less than 200 characters',
        });
        continue;
      }

      // Validate story points range (mirrors backend Zod: int 1-100)
      if (item.storyPoints !== undefined) {
        if (item.storyPoints < 1 || item.storyPoints > 100) {
          errors.push({
            row: rowNumber,
            field: 'storyPoints',
            message: 'Story points must be between 1 and 100',
          });
          continue;
        }
      }

      // Validate priority (mirrors backend Zod enum)
      if (item.priority) {
        const validPriorities = ['MUST_HAVE', 'SHOULD_HAVE', 'COULD_HAVE', 'WONT_HAVE'];
        if (!validPriorities.includes(item.priority)) {
          errors.push({
            row: rowNumber,
            field: 'priority',
            message: 'Invalid priority value',
          });
          continue;
        }
      }

      const newItem: ProductBacklogItem = {
        id: `pbi-bulk-${timestamp}-${i}`,
        teamId,
        title: item.title,
        description: item.description,
        priority: item.priority ?? MoSCoWPriority.COULD_HAVE,
        rank: this.nextBacklogRank(teamId),
        storyPoints: item.storyPoints,
        businessValue: item.businessValue,
        status: ItemStatus.NEW,
        labels: item.labels ?? [],
        acceptanceCriteria: item.acceptanceCriteria,
        goalId,
        createdBy: getCurrentUser().id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockProductBacklogItems.push(newItem);
      createdItems.push(newItem);
    }

    return {
      success: true,
      data: {
        successful: createdItems.length,
        failed: errors.length,
        errors,
        createdItems,
      },
    };
  }

  async updateProductBacklogItem(
    id: string,
    updates: Partial<ProductBacklogItem>
  ): Promise<ApiResponse<ProductBacklogItem>> {
    await delay(400);

    const itemIndex = mockProductBacklogItems.findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Item not found',
        },
      };
    }

    const updatedItem = {
      ...(mockProductBacklogItems[itemIndex] as ProductBacklogItem),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    mockProductBacklogItems[itemIndex] = updatedItem;

    return { success: true, data: updatedItem };
  }

  async updateBacklogItemPriority(
    id: string,
    priority: MoSCoWPriority
  ): Promise<ApiResponse<ProductBacklogItem>> {
    return this.updateProductBacklogItem(id, { priority });
  }

  /**
   * The rank that appends an item to the end of a team's Product Backlog order.
   */
  private nextBacklogRank(teamId: string): number {
    return (
      mockProductBacklogItems
        .filter((item) => item.teamId === teamId)
        .reduce((max, item) => Math.max(max, item.rank), 0) + 1
    );
  }

  /**
   * Persist a new Product Backlog order, mirroring the two payload shapes the API accepts.
   *
   * The mock has no authorization layer — the Product Owner ordering gate is exercised against
   * the real backend — so what is simulated here is the ordering semantics: dense 1..N ranks,
   * both shapes, and a refusal instead of a false success for a partial list.
   */
  async reorderProductBacklogItems(
    payload: ReorderBacklogPayload
  ): Promise<ApiResponse<{ items: ReorderedBacklogItem[] }>> {
    await delay(300);

    const isPositionalMove = 'pbiId' in payload;
    const namedIds = isPositionalMove ? [payload.pbiId, payload.targetPbiId] : payload.pbiIds;

    const namedItems = mockProductBacklogItems.filter((item) => namedIds.includes(item.id));
    const firstNamed = namedItems[0];
    if (!firstNamed) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product Backlog Item not found' },
      };
    }

    const teamId = firstNamed.teamId;
    if (namedItems.some((item) => item.teamId !== teamId)) {
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: "All reordered items must belong to the same team's Product Backlog",
        },
      };
    }

    const currentIds = mockProductBacklogItems
      .filter((item) => item.teamId === teamId)
      .sort((a, b) => a.rank - b.rank)
      .map((item) => item.id);

    let nextIds: string[];

    if (isPositionalMove) {
      const withoutMoved = currentIds.filter((id) => id !== payload.pbiId);
      const targetIndex = withoutMoved.indexOf(payload.targetPbiId);

      if (targetIndex === -1) {
        return {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product Backlog Item not found' },
        };
      }

      const insertAt = payload.position === 'before' ? targetIndex : targetIndex + 1;
      nextIds = [
        ...withoutMoved.slice(0, insertAt),
        payload.pbiId,
        ...withoutMoved.slice(insertAt),
      ];
    } else {
      const requestedSet = new Set(payload.pbiIds);

      if (
        requestedSet.size !== payload.pbiIds.length ||
        requestedSet.size !== currentIds.length ||
        !currentIds.every((id) => requestedSet.has(id))
      ) {
        return {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: "A full reorder must contain every item of the team's Product Backlog",
          },
        };
      }

      nextIds = payload.pbiIds;
    }

    const rankById = new Map(nextIds.map((id, index) => [id, index + 1]));
    mockProductBacklogItems.forEach((item, index) => {
      const nextRank = rankById.get(item.id);
      if (nextRank !== undefined) {
        mockProductBacklogItems[index] = { ...item, rank: nextRank };
      }
    });

    const items: ReorderedBacklogItem[] = nextIds.map((id) => ({
      id,
      rank: rankById.get(id) ?? 0,
      priority:
        mockProductBacklogItems.find((item) => item.id === id)?.priority ??
        MoSCoWPriority.COULD_HAVE,
    }));

    return { success: true, data: { items } };
  }

  async deleteProductBacklogItem(_id: string): Promise<ApiResponse<never>> {
    await delay(300);
    return { success: true };
  }

  // ==================== Sprints ====================
  async getSprints(teamId: string): Promise<ApiResponse<Sprint[]>> {
    await delay(300);
    const sprints = mockSprints.filter((s) => s.teamId === teamId);
    return { success: true, data: sprints };
  }

  async getActiveSprint(teamId: string): Promise<ApiResponse<Sprint>> {
    await delay(300);
    const activeSprint = mockSprints.find(
      (s) => s.status === SprintStatus.ACTIVE && s.teamId === teamId
    );

    if (!activeSprint) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No active sprint found',
        },
      };
    }

    const sprintTasks = mockTasks.filter((t) => t.sprintId === activeSprint.id);

    // Derive SprintBacklogItems (the PBI-level sprint backlog entries) from the
    // sprint's items so the Daily Scrum "Sprint Backlog adjustments" dropdown can
    // offer the same SprintBacklogItem IDs the backend FK expects.
    const sprintBacklogItems: SprintBacklogItem[] = (activeSprint.items ?? []).map((pbi) => ({
      id: `sbi-${activeSprint.id}-${pbi.id}`,
      sprintId: activeSprint.id,
      pbiId: pbi.id,
      pbi,
    }));

    return {
      success: true,
      data: {
        ...activeSprint,
        // Keep the sprint's product backlog items so the board can resolve each task's
        // parent PBI (e.g. for the PBI preview "mark as done" popup).
        items: activeSprint.items,
        tasks: sprintTasks,
        sprintBacklogItems,
      },
    };
  }

  async createSprint(sprint: Partial<Sprint>): Promise<ApiResponse<Sprint>> {
    await delay(500);

    const newSprint: Sprint = {
      id: `sprint-${Date.now()}`,
      teamId: sprint.teamId ?? getCurrentTeam().id,
      name: sprint.name ?? 'New Sprint',
      startDate: sprint.startDate ?? new Date().toISOString(),
      endDate: sprint.endDate ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      sprintGoal: sprint.sprintGoal,
      status: SprintStatus.PLANNED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: newSprint };
  }

  async getSprint(id: string): Promise<ApiResponse<Sprint>> {
    await delay(300);
    const sprint = mockSprints.find((s) => s.id === id);

    if (!sprint) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sprint not found',
        },
      };
    }

    return { success: true, data: sprint };
  }

  async startSprint(
    id: string,
    data?: {
      backlogItems?: Array<{ pbiId: string }>;
      tasks?: Array<{
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
    }
  ): Promise<ApiResponse<Sprint>> {
    await delay(500);

    const existingActiveSprint = mockSprints.find((s) => s.status === SprintStatus.ACTIVE);
    if (existingActiveSprint) {
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Another sprint is already active',
        },
      };
    }

    const sprintIndex = mockSprints.findIndex((s) => s.id === id);

    if (sprintIndex === -1) {
      const generatedSprintIndex = this.generatedSprintsStore.findIndex((s) => s.id === id);

      if (generatedSprintIndex !== -1) {
        const generatedSprint = this.generatedSprintsStore[generatedSprintIndex] as GeneratedSprint;
        const newSprintId = generateUUID();
        const newSprint: Sprint = {
          id: newSprintId,
          teamId: generatedSprint.teamId,
          name: generatedSprint.name,
          startDate: generatedSprint.startDate,
          endDate: generatedSprint.endDate,
          sprintGoal: generatedSprint.sprintGoal,
          status: SprintStatus.ACTIVE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        mockSprints.push(newSprint);
        this.generatedSprintsStore[generatedSprintIndex] = {
          ...generatedSprint,
          status: SprintStatus.ACTIVE,
        };

        if (data?.backlogItems) {
          data.backlogItems.forEach((item) => {
            const pbiIndex = mockProductBacklogItems.findIndex((p) => p.id === item.pbiId);
            if (pbiIndex !== -1) {
              mockProductBacklogItems[pbiIndex] = {
                ...(mockProductBacklogItems[pbiIndex] as ProductBacklogItem),
                status: ItemStatus.IN_PROGRESS,
              };
            }
          });
        }

        if (data?.tasks) {
          data.tasks.forEach((task) => {
            mockTasks.push({
              id: generateUUID(),
              sprintId: newSprintId,
              pbiId: task.pbiId,
              title: task.title,
              description: task.description,
              assigneeId: task.assigneeId,
              status: TaskStatus.TODO,
              estimatedHours: task.estimatedHours,
              remainingHours: task.remainingHours ?? task.estimatedHours,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });
        }

        return { success: true, data: newSprint };
      }

      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sprint not found',
        },
      };
    }

    mockSprints[sprintIndex] = {
      ...(mockSprints[sprintIndex] as Sprint),
      status: SprintStatus.ACTIVE,
      updatedAt: new Date().toISOString(),
    };

    const activeSprintId = (mockSprints[sprintIndex] as Sprint).id;

    if (data?.backlogItems) {
      data.backlogItems.forEach((item) => {
        const pbiIndex = mockProductBacklogItems.findIndex((p) => p.id === item.pbiId);
        if (pbiIndex !== -1) {
          mockProductBacklogItems[pbiIndex] = {
            ...(mockProductBacklogItems[pbiIndex] as ProductBacklogItem),
            status: ItemStatus.IN_PROGRESS,
          };
        }
      });
    }

    if (data?.tasks) {
      data.tasks.forEach((task) => {
        mockTasks.push({
          id: generateUUID(),
          sprintId: activeSprintId,
          pbiId: task.pbiId,
          title: task.title,
          description: task.description,
          assigneeId: task.assigneeId,
          status: TaskStatus.TODO,
          estimatedHours: task.estimatedHours,
          remainingHours: task.remainingHours ?? task.estimatedHours,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    }

    return { success: true, data: mockSprints[sprintIndex] as Sprint };
  }

  async saveSprintBacklog(
    id: string,
    data?: {
      items?: Array<{ pbiId: string }>;
      tasks?: Array<{
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
    }
  ): Promise<ApiResponse<{ sprintId: string; backlogItems: string[]; taskIds: string[] }>> {
    await delay(400);

    const sprintIndex = mockSprints.findIndex((s) => s.id === id);
    if (sprintIndex === -1) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sprint not found' },
      };
    }

    // Idempotent replace: clear existing draft tasks for the sprint, then re-create.
    for (let i = mockTasks.length - 1; i >= 0; i--) {
      if (mockTasks[i]?.sprintId === id) {
        mockTasks.splice(i, 1);
      }
    }

    const backlogItemIds = (data?.items ?? []).map(() => generateUUID());
    const taskIds = (data?.tasks ?? []).map(() => generateUUID());

    (data?.tasks ?? []).forEach((task, i) => {
      mockTasks.push({
        id: taskIds[i] ?? generateUUID(),
        sprintId: id,
        pbiId: task.pbiId,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        status: TaskStatus.TODO,
        estimatedHours: task.estimatedHours,
        remainingHours: task.remainingHours ?? task.estimatedHours,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return { success: true, data: { sprintId: id, backlogItems: backlogItemIds, taskIds } };
  }

  async saveSprintPlanningDraft(
    id: string,
    data?: {
      items?: Array<{ pbiId: string }>;
      tasks?: Array<{
        id?: string;
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string | null;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
      sprintGoal?: string;
      capacity?: SprintPlanningCapacityEntry[];
      attendees?: Array<{ name: string; email?: string; role: string; attended: boolean }>;
    }
  ): Promise<ApiResponse<{ sprintId: string; sprintGoal: string | null }>> {
    await delay(400);

    const sprintIndex = mockSprints.findIndex((s) => s.id === id);
    if (sprintIndex === -1) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sprint not found' },
      };
    }

    // Incremental upsert: replace existing draft tasks for the sprint, then re-create.
    for (let i = mockTasks.length - 1; i >= 0; i--) {
      if (mockTasks[i]?.sprintId === id) {
        mockTasks.splice(i, 1);
      }
    }
    (data?.tasks ?? []).forEach((task) => {
      mockTasks.push({
        id: task.id ?? `task-${Date.now()}`,
        sprintId: id,
        pbiId: task.pbiId,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId ?? undefined,
        status: TaskStatus.TODO,
        estimatedHours: task.estimatedHours,
        remainingHours: task.remainingHours ?? task.estimatedHours,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    if (data?.sprintGoal !== undefined && mockSprints[sprintIndex]) {
      mockSprints[sprintIndex] = {
        ...(mockSprints[sprintIndex] as Sprint),
        sprintGoal: data.sprintGoal,
      };
    }

    // Persist recorded capacity/participation exactly as the backend does: capacity is a diff
    // upsert keyed by user, attendance (when supplied) is a full snapshot replace.
    if (data?.capacity !== undefined) {
      this.planningCapacityStore.set(
        id,
        data.capacity.map((entry) => ({
          memberId: entry.memberId ?? null,
          userId: entry.userId,
          availableHours: entry.availableHours,
        }))
      );
    }

    if (data?.attendees !== undefined) {
      this.planningAttendeeStore.set(
        id,
        data.attendees.map((attendee, index) => ({
          id: `planning-attendee-${id}-${index}`,
          name: attendee.name,
          email: attendee.email ?? null,
          role: attendee.role,
          attended: attendee.attended,
        }))
      );
    }

    return {
      success: true,
      data: { sprintId: id, sprintGoal: data?.sprintGoal ?? null },
    };
  }

  /** Derive the participation readiness the same way the backend gate does. */
  private buildPlanningParticipation(attendees: SprintPlanningAttendee[]) {
    const present = attendees.filter((attendee) => attendee.attended);
    const hasProductOwner = present.some((attendee) => attendee.role === 'product_owner');
    const developerCount = present.filter((attendee) => attendee.role === 'developers').length;
    return {
      attendees,
      hasProductOwner,
      developerCount,
      isReadyToStart: hasProductOwner && developerCount > 0,
    };
  }

  async getPlanningParticipation(id: string): Promise<ApiResponse<SprintPlanningParticipation>> {
    await delay(200);
    const attendees = this.planningAttendeeStore.get(id) ?? [];
    return { success: true, data: this.buildPlanningParticipation(attendees) };
  }

  async addPlanningAttendee(
    id: string,
    data: { name: string; email?: string; role: string; attended: boolean }
  ): Promise<ApiResponse<SprintPlanningAttendee>> {
    await delay(200);
    const attendees = this.planningAttendeeStore.get(id) ?? [];
    const attendee: SprintPlanningAttendee = {
      id: `planning-attendee-${id}-${attendees.length}-${Date.now()}`,
      name: data.name,
      email: data.email ?? null,
      role: data.role,
      attended: data.attended,
    };
    this.planningAttendeeStore.set(id, [...attendees, attendee]);
    return { success: true, data: attendee };
  }

  async updatePlanningAttendee(
    id: string,
    attendeeId: string,
    data: { name?: string; email?: string; role?: string; attended?: boolean }
  ): Promise<ApiResponse<SprintPlanningAttendee>> {
    await delay(200);
    const attendees = this.planningAttendeeStore.get(id) ?? [];
    const index = attendees.findIndex((attendee) => attendee.id === attendeeId);
    if (index === -1 || !attendees[index]) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Attendee not found' } };
    }
    const updated: SprintPlanningAttendee = {
      ...attendees[index],
      ...data,
    };
    attendees[index] = updated;
    this.planningAttendeeStore.set(id, [...attendees]);
    return { success: true, data: updated };
  }

  async deletePlanningAttendee(
    id: string,
    attendeeId: string
  ): Promise<ApiResponse<{ message: string }>> {
    await delay(200);
    const attendees = this.planningAttendeeStore.get(id) ?? [];
    this.planningAttendeeStore.set(
      id,
      attendees.filter((attendee) => attendee.id !== attendeeId)
    );
    return { success: true, data: { message: 'Planning attendee deleted successfully' } };
  }

  /**
   * Return the id of the first selectable draft sprint for the current team: the earliest
   * PLANNED (draft) sprint that is not yet in the past and therefore appears in the Sprint
   * Planning sprint selector. This sprint is seeded with a ready-to-resume planning draft
   * so the prototype demonstrates task decomposition + assignment out of the box.
   */
  private getFirstSelectableSprintId(): string | null {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const teamId = getCurrentTeam().id;

    const selectable = this.generatedSprintsStore
      .filter(
        (s) =>
          s.teamId === teamId &&
          s.status === SprintStatus.PLANNED &&
          !!s.startDate &&
          !!s.endDate &&
          new Date(s.endDate).getTime() >= now.getTime()
      )
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return selectable[0]?.id ?? null;
  }

  /**
   * Build a deterministic, pre-populated Sprint Planning draft (with task decomposition and
   * Developer assignment) for the first selectable draft sprint. It is only used when the
   * selected sprint has no persisted draft yet, so a real saved draft always takes priority.
   */
  private buildSeededPlanningDraft(): {
    sprintGoal: string;
    items: Array<{ pbiId: string }>;
    tasks: Array<{
      id: string;
      pbiId: string;
      title: string;
      description: string | null;
      assigneeId: string | null;
      estimatedHours: number | null;
      remainingHours: number | null;
    }>;
    conflicts: Array<{ pbiId: string; sprintName: string }>;
  } {
    // Developers on the Alpha team (self-managed: any Developer may be assigned).
    const sarah = UUIDS.users.scrumMaster;
    const emma = UUIDS.users.developer2;
    const alex = UUIDS.users.guest;

    const seed = (
      id: string,
      pbiId: string,
      title: string,
      assigneeId: string,
      estimatedHours: number
    ) => ({
      id,
      pbiId,
      title,
      description: null,
      assigneeId,
      estimatedHours,
      remainingHours: estimatedHours,
    });

    return {
      sprintGoal: 'Deliver product backlog management and team dashboard to streamline planning',
      items: [{ pbiId: 'pbi-005' }, { pbiId: 'pbi-006' }],
      tasks: [
        // pbi-005: Product backlog management (13 story points -> 5 tasks)
        seed('seed-task-001', 'pbi-005', 'Design backlog data model', sarah, 8),
        seed('seed-task-002', 'pbi-005', 'Implement list and filtering UI', emma, 8),
        seed('seed-task-003', 'pbi-005', 'Build drag-and-drop prioritization', alex, 8),
        seed('seed-task-004', 'pbi-005', 'Add search functionality', sarah, 8),
        seed('seed-task-005', 'pbi-005', 'Write unit tests for backlog utils', emma, 8),
        // pbi-006: Team management dashboard (8 story points -> 3 tasks)
        seed('seed-task-006', 'pbi-006', 'Design dashboard layout', alex, 8),
        seed('seed-task-007', 'pbi-006', 'Implement role management', sarah, 8),
        seed('seed-task-008', 'pbi-006', 'Build activity timeline', emma, 8),
      ],
      conflicts: [],
    };
  }

  /**
   * Seed the demo planning session's capacity and attendance deterministically from the current
   * team roster, so the prototype opens with a ready-to-start planning record.
   */
  private seedPlanningRecords(): {
    capacity: SprintPlanningCapacityEntry[];
    attendees: SprintPlanningAttendee[];
  } {
    const members = getCurrentTeam().members ?? [];
    const capacity: SprintPlanningCapacityEntry[] = [];
    const attendees: SprintPlanningAttendee[] = [];

    members.forEach((member, index) => {
      const user = member.user;
      const name = user ? `${user.firstName} ${user.lastName}` : `Team member ${index + 1}`;
      const role = String(member.role).toLowerCase();

      attendees.push({
        id: `seed-planning-attendee-${member.id}`,
        name,
        email: user?.email ?? null,
        role,
        attended: true,
      });

      if (role === 'developers') {
        capacity.push({ memberId: member.id, userId: member.userId, availableHours: 40 });
      }
    });

    return { capacity, attendees };
  }

  async getSprintPlanningDraft(id: string): Promise<
    ApiResponse<{
      sprintId: string | null;
      sprintGoal: string | null;
      items: Array<{ pbiId: string }>;
      tasks: Array<{
        id: string;
        pbiId: string;
        title: string;
        description: string | null;
        assigneeId: string | null;
        estimatedHours: number | null;
        remainingHours: number | null;
      }>;
      capacity: SprintPlanningCapacityEntry[];
      attendees: SprintPlanningAttendee[];
      participation: SprintPlanningParticipation;
      conflicts: Array<{ pbiId: string; sprintName: string }>;
    }>
  > {
    await delay(300);

    const tasks = mockTasks
      .filter((t) => t.sprintId === id)
      .map((t) => ({
        id: t.id,
        pbiId: t.pbiId,
        title: t.title,
        description: t.description ?? null,
        assigneeId: t.assigneeId ?? null,
        estimatedHours: t.estimatedHours ?? null,
        remainingHours: t.remainingHours ?? null,
      }));
    const itemPbiIds = Array.from(new Set(tasks.map((t) => t.pbiId)));

    const storedCapacity = this.planningCapacityStore.get(id);
    const storedAttendees = this.planningAttendeeStore.get(id);

    // When the selected sprint is the first selectable draft sprint and it has no persisted
    // draft yet, seed a realistic planning draft (items + task assignment) so the demo shows
    // the full planning flow and enables the "Save Sprint Backlog" action immediately.
    if (tasks.length === 0 && id === this.getFirstSelectableSprintId()) {
      const seeded = this.buildSeededPlanningDraft();
      const seededRecords = this.seedPlanningRecords();
      const attendees = storedAttendees ?? seededRecords.attendees;
      return {
        success: true,
        data: {
          sprintId: id,
          sprintGoal: seeded.sprintGoal,
          items: seeded.items,
          tasks: seeded.tasks,
          capacity: storedCapacity ?? seededRecords.capacity,
          attendees,
          participation: this.buildPlanningParticipation(attendees),
          conflicts: seeded.conflicts,
        },
      };
    }

    const attendees = storedAttendees ?? [];
    return {
      success: true,
      data: {
        sprintId: id,
        sprintGoal: null,
        items: itemPbiIds.map((pbiId) => ({ pbiId })),
        tasks,
        capacity: storedCapacity ?? [],
        attendees,
        participation: this.buildPlanningParticipation(attendees),
        conflicts: [],
      },
    };
  }

  async updateSprint(id: string, updates: Partial<Sprint>): Promise<ApiResponse<Sprint>> {
    await delay(400);

    const sprintIndex = mockSprints.findIndex((s) => s.id === id);

    if (sprintIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sprint not found',
        },
      };
    }

    mockSprints[sprintIndex] = {
      ...(mockSprints[sprintIndex] as Sprint),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: mockSprints[sprintIndex] as Sprint };
  }

  async getBurndownData(
    _sprintId: string
  ): Promise<ApiResponse<{ dates: string[]; ideal: number[]; actual: (number | null)[] }>> {
    await delay(300);

    const dates = mockBurndownData.map((d) => d.date);
    const ideal = mockBurndownData.map((d) => d.ideal);
    const actual = mockBurndownData.map((d) => (d.actual === -1 ? null : d.actual));

    return {
      success: true,
      data: { dates, ideal, actual },
    };
  }

  // ==================== Tasks ====================
  /**
   * Enrich a task with its parent Product Backlog Item so the Sprint Board can show
   * the parent PBI (TaskCard) and open the PBI preview popup. Mirrors the backend,
   * which embeds `pbi: { id, title }` on every task.
   */
  private attachParentPbi(tasks: Task[]): Task[] {
    return tasks.map((task) => {
      const pbi = mockProductBacklogItems.find((p) => p.id === task.pbiId);
      return pbi ? { ...task, pbi } : task;
    });
  }

  async getSprintTasks(sprintId: string): Promise<ApiResponse<Task[]>> {
    await delay(300);
    const tasks = mockTasks.filter((t) => t.sprintId === sprintId);
    return { success: true, data: this.attachParentPbi(tasks) };
  }

  async createTask(sprintId: string, task: Partial<Task>): Promise<ApiResponse<Task>> {
    await delay(400);

    const newTask: Task = {
      id: `task-${Date.now()}`,
      sprintId,
      pbiId: task.pbiId ?? '',
      title: task.title ?? 'New Task',
      description: task.description,
      assigneeId: task.assigneeId,
      status: TaskStatus.TODO,
      estimatedHours: task.estimatedHours,
      remainingHours: task.remainingHours,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: newTask };
  }

  async updateTask(
    _sprintId: string,
    taskId: string,
    updates: Partial<Task>
  ): Promise<ApiResponse<Task>> {
    await delay(300);

    const taskIndex = mockTasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Task not found',
        },
      };
    }

    const updatedTask = {
      ...(mockTasks[taskIndex] as Task),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: updatedTask };
  }

  async deleteTask(_sprintId: string, _taskId: string): Promise<ApiResponse<never>> {
    await delay(300);
    return { success: true };
  }

  async completeSprint(_sprintId: string): Promise<ApiResponse<Sprint>> {
    await delay(500);
    const activeSprint = mockSprints.find((s) => s.status === SprintStatus.ACTIVE);
    if (activeSprint) {
      activeSprint.status = SprintStatus.COMPLETED;
      activeSprint.updatedAt = new Date().toISOString();
    }
    return { success: true, data: activeSprint ?? (mockSprints[0] as Sprint) };
  }

  async cancelSprint(id: string, reason: string): Promise<ApiResponse<Sprint>> {
    await delay(500);
    const sprintIndex = mockSprints.findIndex((s) => s.id === id);
    if (sprintIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sprint not found',
        },
      };
    }

    const sprint = mockSprints[sprintIndex] as Sprint;
    const cancelledSprint: Sprint = {
      ...sprint,
      status: SprintStatus.CANCELLED,
      cancellationReason: reason.trim() ? reason : sprint.cancellationReason,
      updatedAt: new Date().toISOString(),
    };

    mockSprints[sprintIndex] = cancelledSprint;

    return { success: true, data: cancelledSprint };
  }

  async getStatusChangeHistory(
    _entityType: string,
    _entityId: string,
    _limit?: number,
    _offset?: number
  ): Promise<ApiResponse<StatusChangeHistoryItem[]>> {
    await delay(300);
    return { success: true, data: [] };
  }

  async rollbackSprintStart(
    _sprintId: string,
    _rollbackData?: { reason: string }
  ): Promise<ApiResponse<Sprint>> {
    await delay(400);
    return { success: true, data: mockSprints[0] as Sprint };
  }

  async getSprintBacklogPBIs(_sprintId: string): Promise<ApiResponse<ProductBacklogItem[]>> {
    await delay(300);
    return {
      success: true,
      data: mockProductBacklogItems.filter((p) => p.status === ItemStatus.IN_PROGRESS),
    };
  }

  // In-memory timebox state for Scrum event timeboxes
  private timeboxStore: Record<string, TimeboxState & { lastTick?: number }> = {};

  // ==================== Daily Scrum (team-level, goal-focused) ====================
  /**
   * Seed a Daily Scrum record for the active Sprint (sprint-3) so the Dashboard
   * "Inspect & Adapt" card (and the Daily Scrum page) render realistic data out
   * of the box in mock mode, instead of showing the empty state. The date is a
   * fixed constant so the same record is shown regardless of the real date; the
   * query methods below deliberately match by sprint and ignore the date.
   */
  private static readonly SCRUM_SEED_DATE = '2026-08-25';

  private dynamicDailyScrums: DailyScrum[] = [
    {
      id: 'scrum-seed-active',
      sprintId: 'sprint-3',
      scrumDate: MockApiService.SCRUM_SEED_DATE,
      progressNotes:
        'Burndown chart analytics and historical daily updates are progressing well; the team resolved the notification reminder review early.',
      adaptationsNotes:
        'Adjusted pairing so Emma and Mike can unblock the impediment workflow before the end of sprint.',
      planForNextDay:
        'Focus on completing the impediment CRUD operations and updating the API documentation for new endpoints.',
      focusMode: 'goal',
      sprintGoal:
        'Complete daily Scrum and impediment tracking features to improve team collaboration',
      participants: mockUsers.slice(0, 4).map((u) => ({
        id: `sp-seed-${u.id}`,
        userId: u.id,
        user: u,
      })) as DailyScrumParticipant[],
      backlogAdjustments: [],
      createdAt: `${MockApiService.SCRUM_SEED_DATE}T09:15:00.000Z`,
      updatedAt: `${MockApiService.SCRUM_SEED_DATE}T09:18:00.000Z`,
    },
  ];

  // The mock deliberately returns the seeded Inspect & Adapt record for a sprint
  // regardless of the requested date. This keeps the same realistic data visible
  // even when the date changes (e.g. timezone differences or a new day), instead
  // of dropping to the empty state whenever the queried date differs from a seed
  // date. This is mock-only behavior and does not affect the production API.
  async getDailyScrum(sprintId: string, _date?: string): Promise<ApiResponse<DailyScrum | null>> {
    await delay(250);

    const found = this.dynamicDailyScrums.find((s) => s.sprintId === sprintId);
    return { success: true, data: found ?? null };
  }

  async getDailyScrums(sprintId: string, _date?: string): Promise<ApiResponse<DailyScrum[]>> {
    await delay(250);

    const scrums = this.dynamicDailyScrums
      .filter((s) => s.sprintId === sprintId)
      .sort((a, b) => b.scrumDate.localeCompare(a.scrumDate));
    return { success: true, data: scrums };
  }

  async createDailyScrum(
    sprintId: string,
    scrum: Partial<DailyScrum>
  ): Promise<ApiResponse<DailyScrum>> {
    await delay(300);

    const currentUser = getCurrentUser();
    const today = formatLocalDate();

    const existing = this.dynamicDailyScrums.find(
      (s) => s.sprintId === sprintId && s.scrumDate === today
    );
    if (existing) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'A Daily Scrum already exists for today' },
      };
    }

    const newScrum: DailyScrum = {
      id: `scrum-${Date.now()}`,
      sprintId,
      scrumDate: today,
      progressNotes: scrum.progressNotes,
      adaptationsNotes: scrum.adaptationsNotes,
      planForNextDay: scrum.planForNextDay,
      focusMode: scrum.focusMode ?? null,
      participants: [
        {
          id: `sp-${Date.now()}`,
          userId: currentUser.id,
          user: currentUser,
        },
      ],
      backlogAdjustments: scrum.backlogAdjustments ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.dynamicDailyScrums.push(newScrum);
    return { success: true, data: newScrum };
  }

  async updateDailyScrum(id: string, scrum: Partial<DailyScrum>): Promise<ApiResponse<DailyScrum>> {
    await delay(300);

    const index = this.dynamicDailyScrums.findIndex((s) => s.id === id);
    if (index === -1) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Daily Scrum not found' },
      };
    }

    const current = this.dynamicDailyScrums[index] as DailyScrum;
    const updated: DailyScrum = {
      ...current,
      progressNotes: scrum.progressNotes ?? current.progressNotes,
      adaptationsNotes: scrum.adaptationsNotes ?? current.adaptationsNotes,
      planForNextDay: scrum.planForNextDay ?? current.planForNextDay,
      focusMode: scrum.focusMode === undefined ? current.focusMode : scrum.focusMode,
      backlogAdjustments: scrum.backlogAdjustments ?? current.backlogAdjustments,
      updatedAt: new Date().toISOString(),
    };
    this.dynamicDailyScrums[index] = updated;
    return { success: true, data: updated };
  }

  async recordDailyScrumParticipation(id: string): Promise<ApiResponse<DailyScrum>> {
    await delay(200);

    const index = this.dynamicDailyScrums.findIndex((s) => s.id === id);
    if (index === -1) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Daily Scrum not found' },
      };
    }

    const currentUser = getCurrentUser();
    const current = this.dynamicDailyScrums[index] as DailyScrum;
    const alreadyParticipating = current.participants.some((p) => p.userId === currentUser.id);

    const updated: DailyScrum = {
      ...current,
      participants: alreadyParticipating
        ? current.participants
        : [
            ...current.participants,
            { id: `sp-${Date.now()}`, userId: currentUser.id, user: currentUser },
          ],
    };
    this.dynamicDailyScrums[index] = updated;
    return { success: true, data: updated };
  }

  async getDailyScrumParticipation(
    sprintId: string,
    _date?: string
  ): Promise<
    ApiResponse<{
      dailyScrum: DailyScrum | null;
      participants: DailyScrumParticipant[];
      nonParticipants: { userId: string; userName: string }[];
    }>
  > {
    await delay(250);

    const dailyScrum = this.dynamicDailyScrums.find((s) => s.sprintId === sprintId) ?? null;

    const team = getCurrentTeam();
    const participantUserIds = new Set(dailyScrum?.participants.map((p) => p.userId) ?? []);
    const nonParticipants = (team.members ?? [])
      .filter((m) => !participantUserIds.has(m.userId))
      .map((m) => ({
        userId: m.userId,
        userName: `${m.user?.firstName ?? ''} ${m.user?.lastName ?? ''}`.trim(),
      }));

    return {
      success: true,
      data: {
        dailyScrum,
        participants: dailyScrum?.participants ?? [],
        nonParticipants,
      },
    };
  }

  async sendDailyScrumTeamSignal(
    sprintId: string
  ): Promise<ApiResponse<{ sentCount: number; message: string }>> {
    await delay(250);

    const dailyScrum = this.dynamicDailyScrums.find((s) => s.sprintId === sprintId) ?? null;
    const team = getCurrentTeam();
    const participantUserIds = new Set(dailyScrum?.participants.map((p) => p.userId) ?? []);
    const memberCount = (team.members ?? []).filter(
      (m) => !participantUserIds.has(m.userId)
    ).length;
    return {
      success: true,
      data: {
        sentCount: memberCount,
        message:
          memberCount === 1
            ? 'Daily Scrum signal sent to 1 team member'
            : `Daily Scrum signal sent to ${memberCount} team members`,
      },
    };
  }

  async promoteImpedimentFromDailyScrum(
    dailyScrumId: string,
    impedimentData: {
      title: string;
      description?: string;
      ownerId?: string;
      priority?: string;
      sprintId?: string;
    }
  ): Promise<ApiResponse<{ dailyScrum: DailyScrum; impediment: Impediment }>> {
    await delay(350);

    const title = impedimentData.title.trim();
    if (!title) {
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'An impediment title is required',
        },
      };
    }

    const scrumIndex = this.dynamicDailyScrums.findIndex((s) => s.id === dailyScrumId);
    if (scrumIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Daily Scrum not found',
        },
      };
    }

    const dailyScrum = this.dynamicDailyScrums[scrumIndex] as DailyScrum;
    const currentUser = getCurrentUser();
    const newImpediment: Impediment = {
      id: `imp-${Date.now()}`,
      teamId: dailyScrum.sprintId
        ? (mockSprints.find((s) => s.id === dailyScrum.sprintId)?.teamId ?? getCurrentTeam().id)
        : getCurrentTeam().id,
      sprintId: impedimentData.sprintId ?? dailyScrum.sprintId,
      title,
      description: impedimentData.description ?? '',
      reportedById: currentUser.id,
      ownerId: impedimentData.ownerId,
      status: ImpedimentStatus.OPEN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportedBy: currentUser,
    };

    mockImpediments.push(newImpediment);

    return { success: true, data: { dailyScrum, impediment: newImpediment } };
  }

  // ==================== Impediments ====================
  async getImpediments(teamId: string): Promise<ApiResponse<Impediment[]>> {
    await delay(300);
    const impediments = mockImpediments.filter((i) => i.teamId === teamId);
    return { success: true, data: impediments };
  }

  async createImpediment(impediment: Partial<Impediment>): Promise<ApiResponse<Impediment>> {
    await delay(400);

    const currentUser = getCurrentUser();
    const newImpediment: Impediment = {
      id: `imp-${Date.now()}`,
      teamId: impediment.teamId ?? getCurrentTeam().id,
      sprintId: impediment.sprintId,
      title: impediment.title ?? 'New Impediment',
      description: impediment.description ?? '',
      reportedById: currentUser.id,
      ownerId: impediment.ownerId,
      status: ImpedimentStatus.OPEN,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reportedBy: currentUser,
    };

    return { success: true, data: newImpediment };
  }

  async updateImpediment(
    id: string,
    updates: Partial<Impediment>
  ): Promise<ApiResponse<Impediment>> {
    await delay(300);

    const impedimentIndex = mockImpediments.findIndex((i) => i.id === id);
    if (impedimentIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Impediment not found',
        },
      };
    }

    const updatedImpediment = {
      ...(mockImpediments[impedimentIndex] as Impediment),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (updates.status === ImpedimentStatus.RESOLVED) {
      updatedImpediment.resolvedAt = new Date().toISOString();
    }

    return { success: true, data: updatedImpediment };
  }

  // ==================== Reports ====================
  async getVelocityData(_teamId: string): Promise<
    ApiResponse<{
      sprints: string[];
      planned: number[];
      completed: number[];
      statuses: string[];
    }>
  > {
    await delay(300);

    const sprints = mockVelocityData.map((v) => v.sprintName);
    const planned = mockVelocityData.map((v) => v.planned);
    const completed = mockVelocityData.map((v) => v.completed);
    // The most recent entry is the in-flight Sprint: planning averages completed velocity only.
    const statuses = mockVelocityData.map((_v, index) =>
      index === mockVelocityData.length - 1 ? 'ACTIVE' : 'COMPLETED'
    );

    return {
      success: true,
      data: { sprints, planned, completed, statuses },
    };
  }

  async getSprintHistory(teamId: string): Promise<ApiResponse<SprintHistoryItem[]>> {
    await delay(300);

    const team = mockTeams.find((t) => t.id === teamId);
    const memberCount = (team?.members ?? []).length || 5;

    const history: SprintHistoryItem[] = mockSprints
      .filter((sprint) => sprint.teamId === teamId)
      .map((sprint) => {
        const items = sprint.items ?? [];
        const plannedPoints = items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
        const completedPoints = items
          .filter((item) => item.status === ItemStatus.DONE)
          .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);

        return {
          id: sprint.id,
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          status: sprint.status,
          sprintGoal: sprint.sprintGoal,
          plannedPoints,
          completedPoints:
            sprint.status === SprintStatus.COMPLETED
              ? completedPoints || plannedPoints
              : completedPoints,
          teamMembers: memberCount,
          impediments: mockImpediments.filter((i) => i.sprintId === sprint.id).length,
        };
      });

    return { success: true, data: history };
  }

  async getTeamMetrics(teamId: string): Promise<ApiResponse<TeamMetrics>> {
    await delay(300);

    const history = mockSprints.filter((sprint) => sprint.teamId === teamId);
    const completedSprints = history.filter((sprint) => sprint.status === SprintStatus.COMPLETED);

    const completedPointsList = completedSprints.map((sprint) => {
      const items = sprint.items ?? [];
      const plannedPoints = items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
      const donePoints = items
        .filter((item) => item.status === ItemStatus.DONE)
        .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
      return {
        plannedPoints,
        completedPoints: donePoints || plannedPoints,
      };
    });

    const averageVelocity =
      completedPointsList.length === 0
        ? 0
        : completedPointsList.reduce((sum, entry) => sum + entry.completedPoints, 0) /
          completedPointsList.length;

    const velocityTrend = (() => {
      if (completedPointsList.length < 2) return 0;
      const previous = completedPointsList[completedPointsList.length - 2]?.completedPoints ?? 0;
      const latest = completedPointsList[completedPointsList.length - 1]?.completedPoints ?? 0;
      if (previous === 0) return 0;
      return Math.round(((latest - previous) / previous) * 100);
    })();

    const fullyDelivered = completedPointsList.filter(
      (entry) => entry.completedPoints >= entry.plannedPoints
    ).length;
    const completionRate =
      completedPointsList.length === 0
        ? 0
        : Math.round((fullyDelivered / completedPointsList.length) * 100);

    const teamImpediments = mockImpediments.filter((i) => i.teamId === teamId);

    const metrics: TeamMetrics = {
      averageVelocity: Math.round(averageVelocity * 10) / 10,
      velocityTrend,
      completionRate,
      impediments: {
        resolved: teamImpediments.filter((i) => i.status === ImpedimentStatus.RESOLVED).length,
        total: teamImpediments.length,
      },
    };

    return { success: true, data: metrics };
  }

  async getInsights(teamId: string): Promise<ApiResponse<Insight[]>> {
    await delay(300);

    const history = mockSprints.filter((sprint) => sprint.teamId === teamId);
    const completedSprints = history.filter((sprint) => sprint.status === SprintStatus.COMPLETED);

    const allDelivered = completedSprints.every((sprint) => {
      const items = sprint.items ?? [];
      const plannedPoints = items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
      const donePoints = items
        .filter((item) => item.status === ItemStatus.DONE)
        .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
      return (donePoints || plannedPoints) >= plannedPoints;
    });

    const teamImpediments = mockImpediments.filter((i) => i.teamId === teamId);
    const openImpediments = teamImpediments.filter(
      (i) => i.status !== ImpedimentStatus.RESOLVED
    ).length;

    const insights: Insight[] = [
      {
        id: 'consistent-delivery',
        type: 'positive',
        icon: 'positive',
        title: 'Consistent Backlog Completion',
        description: allDelivered
          ? 'All planned points were delivered in the completed sprints.'
          : 'Some planned points remain undelivered in recent completed sprints.',
      },
      {
        id: 'impediment-trend',
        type: openImpediments > 0 ? 'warning' : 'positive',
        icon: openImpediments > 0 ? 'warning' : 'positive',
        title: openImpediments > 0 ? 'Open Impediments' : 'No Open Impediments',
        description:
          openImpediments > 0
            ? `${openImpediments} impediment(s) currently open. Consider addressing proactively.`
            : 'No impediments are currently open.',
      },
      {
        id: 'velocity-improvement',
        type: 'positive',
        icon: 'positive',
        title: 'Sprint Velocity',
        description: `Completed sprints show a stable delivery cadence of ${
          completedSprints.length || 0
        } sprint(s).`,
      },
      {
        id: 'adaptation',
        type: 'positive',
        icon: 'positive',
        title: 'Inspect & Adapt',
        description:
          'Use the Sprint Retrospective to turn these signals into improvements for the next Sprint.',
      },
    ];

    return { success: true, data: insights };
  }

  // ==================== Product Goals ====================
  async getProductGoals(teamId: string): Promise<ApiResponse<ProductGoal[]>> {
    await delay(300);
    const goals = mockProductGoals.filter((g) => g.teamId === teamId);
    return { success: true, data: goals };
  }

  async getActiveProductGoal(teamId: string): Promise<ApiResponse<ProductGoal>> {
    await delay(300);
    const activeGoal = mockProductGoals.find((g) => g.teamId === teamId && g.status === 'ACTIVE');

    if (!activeGoal) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'No active product goal found',
        },
      };
    }

    return { success: true, data: activeGoal };
  }

  async createProductGoal(goal: Partial<ProductGoal>): Promise<ApiResponse<ProductGoal>> {
    await delay(500);

    const newGoal: ProductGoal = {
      id: `goal-${Date.now()}`,
      teamId: goal.teamId ?? getCurrentTeam().id,
      title: goal.title ?? 'New Goal',
      description: goal.description,
      status: (goal.status ?? 'active').toUpperCase() as ProductGoal['status'],
      targetDate: goal.targetDate,
      successMetrics: goal.successMetrics,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: newGoal };
  }

  async updateProductGoal(
    id: string,
    updates: Partial<ProductGoal>
  ): Promise<ApiResponse<ProductGoal>> {
    await delay(400);

    const goalIndex = mockProductGoals.findIndex((g) => g.id === id);
    if (goalIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product goal not found',
        },
      };
    }

    const updatedGoal = {
      ...(mockProductGoals[goalIndex] as ProductGoal),
      ...updates,
      status: updates.status
        ? (updates.status.toUpperCase() as ProductGoal['status'])
        : (mockProductGoals[goalIndex] as ProductGoal).status,
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: updatedGoal };
  }

  async deleteProductGoal(_id: string): Promise<ApiResponse<never>> {
    await delay(300);
    return { success: true };
  }

  async getProductGoalStatusHistory(_id: string): Promise<ApiResponse<StatusChangeHistoryItem[]>> {
    await delay(300);
    // Return empty array for mock - real implementation will fetch from database
    return { success: true, data: [] };
  }

  // ==================== Sprint Configuration ====================

  // Store generated sprints in memory for demo
  private generatedSprintsStore: GeneratedSprint[] = [];
  private sprintConfigStore: SprintConfiguration | null = null;

  async getSprintConfiguration(teamId: string): Promise<ApiResponse<SprintConfiguration>> {
    await delay(300);

    if (this.sprintConfigStore?.teamId === teamId) {
      return { success: true, data: this.sprintConfigStore };
    }

    // Return and store default configuration
    const defaultConfig: SprintConfiguration = {
      id: `config-${teamId}`,
      teamId,
      duration: '2weeks' as SprintDuration,
      year: new Date().getFullYear(),
      sprintStartDay: 1,
      generatedAt: new Date().toISOString(),
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };

    this.sprintConfigStore = defaultConfig;
    return { success: true, data: defaultConfig };
  }

  async createSprintConfiguration(
    config: Partial<SprintConfiguration>
  ): Promise<ApiResponse<SprintConfiguration>> {
    await delay(400);

    const newConfig: SprintConfiguration = {
      id: `config-${Date.now()}`,
      teamId: config.teamId ?? 'team-1',
      duration: config.duration ?? ('2weeks' as SprintDuration),
      year: config.year ?? new Date().getFullYear(),
      sprintStartDay: config.sprintStartDay ?? 1,
      generatedAt: new Date().toISOString(),
      updatedBy: 'current-user',
      updatedAt: new Date().toISOString(),
    };

    this.sprintConfigStore = newConfig;
    return { success: true, data: newConfig };
  }

  async updateSprintConfiguration(
    id: string,
    updates: Partial<SprintConfiguration>
  ): Promise<ApiResponse<SprintConfiguration>> {
    await delay(400);

    if (this.sprintConfigStore?.id === id) {
      this.sprintConfigStore = {
        ...this.sprintConfigStore,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return { success: true, data: this.sprintConfigStore };
    }

    // If config doesn't exist, create a new one
    const newConfig: SprintConfiguration = {
      id,
      teamId: updates.teamId ?? 'team-1',
      duration: updates.duration ?? ('2weeks' as SprintDuration),
      year: updates.year ?? new Date().getFullYear(),
      sprintStartDay: updates.sprintStartDay ?? 1,
      generatedAt: new Date().toISOString(),
      updatedBy: 'current-user',
      updatedAt: new Date().toISOString(),
    };

    this.sprintConfigStore = newConfig;
    return { success: true, data: newConfig };
  }

  async generateSprintsForYear(
    teamId: string,
    duration: SprintDuration,
    year: number
  ): Promise<ApiResponse<SprintGenerationResult>> {
    await delay(800);

    const sprints: GeneratedSprint[] = [];
    const shortYear = year.toString().slice(-2);

    const durationConfig = {
      '1week': { days: 7, label: '1w', offset: 1 },
      '2weeks': { days: 14, label: '2w', offset: 2 },
      '3weeks': { days: 21, label: '3w', offset: 2 },
      '4weeks': { days: 28, label: '4w', offset: 3 },
    };
    const config = durationConfig[duration];
    const weekDuration = config.days;

    const currentDate = new Date(year, 0, 1);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 1) {
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      currentDate.setDate(currentDate.getDate() + daysUntilMonday);
    }

    let sprintNumber = 1;

    while (currentDate.getFullYear() <= year) {
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + weekDuration - config.offset);

      if (startDate.getFullYear() > year) break;

      const formattedSprintNum = sprintNumber.toString().padStart(2, '0');
      const formatDateSimple = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      // Use en-dash (U+2013) as typographically correct range separator
      const dateRange = `${formatDateSimple(startDate)} – ${formatDateSimple(endDate)}`;
      const name = `Sprint-${config.label}-${shortYear}${formattedSprintNum} (${dateRange})`;

      sprints.push({
        id: `sprint-${year}-${sprintNumber}`,
        teamId,
        name,
        sprintNumber,
        year,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: SprintStatus.PLANNED,
        createdAt: new Date().toISOString(),
      });

      currentDate.setDate(currentDate.getDate() + weekDuration);
      sprintNumber++;
    }

    // Store generated sprints
    this.generatedSprintsStore = [
      ...this.generatedSprintsStore.filter((s) => s.year !== year || s.teamId !== teamId),
      ...sprints,
    ];

    return {
      success: true,
      data: {
        success: true,
        generatedCount: sprints.length,
        sprints,
        message: `Successfully generated ${sprints.length} sprints for ${year}`,
      },
    };
  }

  async getGeneratedSprints(
    teamId: string,
    year?: number
  ): Promise<ApiResponse<GeneratedSprint[]>> {
    await delay(300);

    let filtered = this.generatedSprintsStore.filter((s) => s.teamId === teamId);

    if (year) {
      filtered = filtered.filter((s) => s.year === year);
    }

    // If no sprints exist, generate some for demo
    if (filtered.length === 0 && year === new Date().getFullYear()) {
      const result = await this.generateSprintsForYear(teamId, '2weeks' as SprintDuration, year);
      if (result.success && result.data) {
        filtered = result.data.sprints;
      }
    }

    return { success: true, data: filtered };
  }

  async deleteGeneratedSprint(sprintId: string): Promise<ApiResponse<never>> {
    await delay(300);

    this.generatedSprintsStore = this.generatedSprintsStore.filter((s) => s.id !== sprintId);
    return { success: true };
  }

  async updateGeneratedSprint(
    sprintId: string,
    updates: { sprintGoal?: string }
  ): Promise<ApiResponse<GeneratedSprint>> {
    await delay(400);

    const sprintIndex = this.generatedSprintsStore.findIndex((s) => s.id === sprintId);

    if (sprintIndex === -1) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Generated sprint not found',
        },
      };
    }

    this.generatedSprintsStore[sprintIndex] = {
      ...(this.generatedSprintsStore[sprintIndex] as GeneratedSprint),
      ...updates,
    };

    return { success: true, data: this.generatedSprintsStore[sprintIndex] as GeneratedSprint };
  }

  // ==================== System Parameters ====================

  private systemParametersStore: SystemParameter[] = [
    {
      id: 'param-1',
      key: 'sprint_duration',
      value: '2weeks',
      description: 'Default sprint duration',
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    },
  ];

  async getSystemParameters(): Promise<ApiResponse<SystemParameter[]>> {
    await delay(300);
    return { success: true, data: this.systemParametersStore };
  }

  async updateSystemParameter(key: string, value: string): Promise<ApiResponse<SystemParameter>> {
    await delay(400);

    const paramIndex = this.systemParametersStore.findIndex((p) => p.key === key);
    if (paramIndex === -1) {
      const newParam: SystemParameter = {
        id: `param-${Date.now()}`,
        key,
        value,
        updatedBy: 'current-user',
        updatedAt: new Date().toISOString(),
      };
      this.systemParametersStore.push(newParam);
      return { success: true, data: newParam };
    }

    this.systemParametersStore[paramIndex] = {
      ...(this.systemParametersStore[paramIndex] as SystemParameter),
      value,
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: this.systemParametersStore[paramIndex] as SystemParameter };
  }

  // ==================== Definition of Done ====================

  async getDefinitionOfDone(teamId: string): Promise<ApiResponse<DefinitionOfDone>> {
    await delay(300);
    const team = mockTeams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } };
    }

    const dod = mockDefinitionOfDone[teamId];
    if (!dod) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Definition of Done not found for this team' },
      };
    }

    return { success: true, data: dod };
  }

  async updateDefinitionOfDone(
    teamId: string,
    items: DoDItem[]
  ): Promise<ApiResponse<DefinitionOfDone>> {
    await delay(400);
    const team = mockTeams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } };
    }

    const existingDoD = mockDefinitionOfDone[teamId];
    const updatedDoD: DefinitionOfDone = {
      ...existingDoD,
      id: existingDoD?.id ?? `dod-${teamId}`,
      teamId,
      items,
      version: (existingDoD?.version ?? 0) + 1,
      updatedBy: getCurrentUser().id,
      updatedAt: new Date().toISOString(),
    };

    // Update the mock data store
    mockDefinitionOfDone[teamId] = updatedDoD;

    return { success: true, data: updatedDoD };
  }

  async getDoDHistory(_teamId: string): Promise<ApiResponse<DefinitionOfDone[]>> {
    await delay(300);
    return { success: true, data: [] };
  }

  async verifyDoDForPBI(
    pbiId: string,
    verifications: { dodItemId: string; isVerified: boolean; notes?: string }[]
  ): Promise<ApiResponse<DoDChecklistVerification[]>> {
    await delay(400);
    const results: DoDChecklistVerification[] = verifications.map((v) => ({
      id: `verification-${Date.now()}-${v.dodItemId}`,
      pbiId,
      dodItemId: v.dodItemId,
      isVerified: v.isVerified,
      verifiedBy: 'current-user',
      verifiedAt: new Date().toISOString(),
      notes: v.notes,
    }));
    return { success: true, data: results };
  }

  async getDoDComplianceReport(sprintId: string): Promise<ApiResponse<DoDComplianceReport>> {
    await delay(300);
    return {
      success: true,
      data: {
        sprintId,
        totalPBIs: 5,
        dodCompliantPBIs: 3,
        pendingVerification: 2,
        failedCompliance: 0,
        complianceRate: 60,
        pbiDetails: [],
      },
    };
  }

  // ==================== Definition of Ready ====================

  private mockDefinitionOfReady: Record<string, DefinitionOfReady> = {
    'team-1': {
      id: 'dor-team-1',
      teamId: 'team-1',
      items: [
        {
          id: 'dor-1',
          description: 'Clear title and description',
          category: 'acceptance',
          isActive: true,
          order: 1,
        },
        {
          id: 'dor-2',
          description: 'Acceptance criteria defined',
          category: 'acceptance',
          isActive: true,
          order: 2,
        },
        {
          id: 'dor-3',
          description: 'Story points estimated',
          category: 'estimation',
          isActive: true,
          order: 3,
        },
        {
          id: 'dor-4',
          description: 'Business value assigned',
          category: 'value',
          isActive: true,
          order: 4,
        },
        {
          id: 'dor-5',
          description: 'Dependencies identified',
          category: 'dependencies',
          isActive: true,
          order: 5,
        },
        {
          id: 'dor-6',
          description: 'No blockers',
          category: 'dependencies',
          isActive: true,
          order: 6,
        },
      ],
      version: 1,
      updatedAt: new Date().toISOString(),
    },
    [UUIDS.teams.alpha]: {
      id: 'dor-alpha',
      teamId: UUIDS.teams.alpha,
      items: [
        {
          id: 'dor-alpha-1',
          description: 'User story has a clear title and detailed description',
          category: 'acceptance',
          isActive: true,
          order: 1,
        },
        {
          id: 'dor-alpha-2',
          description: 'Acceptance criteria are defined and testable',
          category: 'acceptance',
          isActive: true,
          order: 2,
        },
        {
          id: 'dor-alpha-3',
          description: 'Story points estimated by the team',
          category: 'estimation',
          isActive: true,
          order: 3,
        },
        {
          id: 'dor-alpha-4',
          description: 'Business value and priority assigned by Product Owner',
          category: 'value',
          isActive: true,
          order: 4,
        },
        {
          id: 'dor-alpha-5',
          description: 'Dependencies identified and documented',
          category: 'dependencies',
          isActive: true,
          order: 5,
        },
        {
          id: 'dor-alpha-6',
          description: 'No external blockers preventing sprint inclusion',
          category: 'dependencies',
          isActive: true,
          order: 6,
        },
        {
          id: 'dor-alpha-7',
          description: 'Technical approach discussed and agreed upon',
          category: 'technical',
          isActive: true,
          order: 7,
        },
        {
          id: 'dor-alpha-8',
          description: 'UI/UX designs reviewed (if applicable)',
          category: 'clarity',
          isActive: true,
          order: 8,
        },
      ],
      version: 1,
      updatedBy: UUIDS.users.admin,
      updatedAt: '2026-02-05T10:00:00Z',
    },
  };

  async getDefinitionOfReady(teamId: string): Promise<ApiResponse<DefinitionOfReady>> {
    await delay(300);
    const team = mockTeams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } };
    }

    const dor = this.mockDefinitionOfReady[teamId];
    if (!dor) {
      return {
        success: true,
        data: {
          id: `dor-${teamId}`,
          teamId,
          items: [],
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    return { success: true, data: dor };
  }

  async updateDefinitionOfReady(
    teamId: string,
    items: DoRItem[]
  ): Promise<ApiResponse<DefinitionOfReady>> {
    await delay(400);
    const team = mockTeams.find((t) => t.id === teamId);
    if (!team) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } };
    }

    const existingDoR = this.mockDefinitionOfReady[teamId];
    const updatedDoR: DefinitionOfReady = {
      ...existingDoR,
      id: existingDoR?.id ?? `dor-${teamId}`,
      teamId,
      items,
      version: (existingDoR?.version ?? 0) + 1,
      updatedBy: getCurrentUser().id,
      updatedAt: new Date().toISOString(),
    };

    this.mockDefinitionOfReady[teamId] = updatedDoR;

    return { success: true, data: updatedDoR };
  }

  async getDoRHistory(_teamId: string): Promise<ApiResponse<DefinitionOfReady[]>> {
    await delay(300);
    return { success: true, data: [] };
  }

  async verifyDoRForPBI(
    pbiId: string,
    verifications: { dorItemId: string; isVerified: boolean; notes?: string }[]
  ): Promise<ApiResponse<DoRChecklistVerification[]>> {
    await delay(400);
    const results: DoRChecklistVerification[] = verifications.map((v) => ({
      id: `verification-${Date.now()}-${v.dorItemId}`,
      pbiId,
      dorItemId: v.dorItemId,
      isVerified: v.isVerified,
      verifiedBy: 'current-user',
      verifiedAt: new Date().toISOString(),
      notes: v.notes,
    }));
    return { success: true, data: results };
  }

  // ==================== Increments ====================

  private incrementsStore: Increment[] = [
    // ==================== DELIVERED Increments ====================
    {
      id: 'increment-1',
      sprintId: 'sprint-1',
      teamId: UUIDS.teams.alpha,
      name: 'Sprint 1 - Core Infrastructure',
      description:
        'Initial project setup with core infrastructure including build configuration, CI/CD pipeline, and basic component library. Foundation for the Scrum management platform.',
      includedPBIs: ['pbi-009', 'pbi-010', 'pbi-011'],
      dodVerifications: [
        {
          id: 'dod-v1-1',
          pbiId: 'pbi-009',
          dodItemId: 'dod-1',
          isVerified: true,
          verifiedBy: UUIDS.users.scrumMaster,
          verifiedAt: '2026-01-18T14:00:00Z',
          dodItemDescription: 'Code reviewed and approved',
          dodItemCategory: 'quality',
        },
        {
          id: 'dod-v1-2',
          pbiId: 'pbi-009',
          dodItemId: 'dod-2',
          isVerified: true,
          verifiedBy: UUIDS.users.developer1,
          verifiedAt: '2026-01-18T14:30:00Z',
          dodItemDescription: 'Unit tests passing (80% coverage)',
          dodItemCategory: 'testing',
        },
        {
          id: 'dod-v1-3',
          pbiId: 'pbi-010',
          dodItemId: 'dod-3',
          isVerified: true,
          verifiedBy: UUIDS.users.developer2,
          verifiedAt: '2026-01-18T15:00:00Z',
          dodItemDescription: 'Integration tests passing',
          dodItemCategory: 'testing',
        },
        {
          id: 'dod-v1-4',
          pbiId: 'pbi-011',
          dodItemId: 'dod-4',
          isVerified: true,
          verifiedBy: UUIDS.users.admin,
          verifiedAt: '2026-01-18T15:30:00Z',
          dodItemDescription: 'Documentation updated',
          dodItemCategory: 'documentation',
        },
      ],
      totalStoryPoints: 31,
      status: IncrementStatus.DELIVERED,
      createdAt: '2026-01-05T09:00:00Z',
      deliveredAt: '2026-01-18T17:00:00Z',
      deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
      createdBy: UUIDS.users.scrumMaster,
      notes:
        'Successfully delivered on time with all DoD criteria met. Stakeholders impressed with the foundation.',
    },
    {
      id: 'increment-2',
      sprintId: 'sprint-2',
      teamId: UUIDS.teams.alpha,
      name: 'Sprint 2 - Dashboard & Sprint Board',
      description:
        'Interactive Kanban board for sprint task management with drag-and-drop functionality, real-time updates, and comprehensive dashboard showing sprint progress and key metrics.',
      includedPBIs: ['pbi-005', 'pbi-006'],
      dodVerifications: [
        {
          id: 'dod-v2-1',
          pbiId: 'pbi-005',
          dodItemId: 'dod-1',
          isVerified: true,
          verifiedBy: UUIDS.users.scrumMaster,
          verifiedAt: '2026-02-01T14:00:00Z',
          dodItemDescription: 'Code reviewed and approved',
          dodItemCategory: 'quality',
        },
        {
          id: 'dod-v2-2',
          pbiId: 'pbi-005',
          dodItemId: 'dod-2',
          isVerified: true,
          verifiedBy: UUIDS.users.developer2,
          verifiedAt: '2026-02-01T14:30:00Z',
          dodItemDescription: 'Unit tests passing (80% coverage)',
          dodItemCategory: 'testing',
        },
        {
          id: 'dod-v2-3',
          pbiId: 'pbi-006',
          dodItemId: 'dod-5',
          isVerified: true,
          verifiedBy: UUIDS.users.admin,
          verifiedAt: '2026-02-01T15:00:00Z',
          dodItemDescription: 'Accessibility audit passed',
          dodItemCategory: 'quality',
        },
        {
          id: 'dod-v2-4',
          pbiId: 'pbi-006',
          dodItemId: 'dod-6',
          isVerified: true,
          verifiedBy: UUIDS.users.developer1,
          verifiedAt: '2026-02-01T15:30:00Z',
          dodItemDescription: 'Performance benchmarks met',
          dodItemCategory: 'performance',
        },
      ],
      totalStoryPoints: 21,
      status: IncrementStatus.DELIVERED,
      createdAt: '2026-01-19T09:00:00Z',
      deliveredAt: '2026-02-01T16:00:00Z',
      deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
      createdBy: UUIDS.users.admin,
      notes:
        'Kanban board highly praised by team. Dashboard widgets provide excellent visibility into sprint health.',
    },
    // ==================== Sprint 3 increments ====================
    // Sprint 3 produced multiple increments: the main Sprint Review delivery and
    // an early release of the Daily Scrum summary widget. Keeping both DELIVERED
    // lets the Sprint Review Increment page render the multi-increment selector.
    {
      id: 'increment-3',
      sprintId: 'sprint-3',
      teamId: UUIDS.teams.alpha,
      name: 'Sprint 3 - Daily Scrum & Impediments',
      description:
        'Daily Scrum interface for team updates with historical tracking, and comprehensive impediment management system with status workflow and resolution tracking.',
      includedPBIs: ['pbi-007'],
      dodVerifications: [
        {
          id: 'dod-v3-1',
          pbiId: 'pbi-007',
          dodItemId: 'dod-1',
          isVerified: true,
          verifiedBy: UUIDS.users.scrumMaster,
          verifiedAt: '2026-02-15T14:00:00Z',
          dodItemDescription: 'Code reviewed and approved',
          dodItemCategory: 'quality',
        },
        {
          id: 'dod-v3-2',
          pbiId: 'pbi-007',
          dodItemId: 'dod-2',
          isVerified: true,
          verifiedBy: UUIDS.users.developer1,
          verifiedAt: '2026-02-15T14:30:00Z',
          dodItemDescription: 'Unit tests passing (80% coverage)',
          dodItemCategory: 'testing',
        },
        {
          id: 'dod-v3-3',
          pbiId: 'pbi-007',
          dodItemId: 'dod-3',
          isVerified: true,
          verifiedBy: UUIDS.users.developer2,
          verifiedAt: '2026-02-15T15:00:00Z',
          dodItemDescription: 'Integration tests passing',
          dodItemCategory: 'testing',
        },
      ],
      totalStoryPoints: 8,
      status: IncrementStatus.DELIVERED,
      createdAt: '2026-02-02T09:00:00Z',
      deliveredAt: '2026-02-15T16:00:00Z',
      deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
      createdBy: UUIDS.users.scrumMaster,
      notes:
        'Daily Scrum interface delivered and well received. Impediment tracking still in progress for the next sprint.',
    },
    {
      id: 'increment-3-early',
      sprintId: 'sprint-3',
      teamId: UUIDS.teams.alpha,
      name: 'Early Release - Daily Scrum Summary Widget',
      description:
        'Compact Daily Scrum summary widget surfacing the latest team updates and open blockers directly on the sprint board. Shipped early to give stakeholders live visibility.',
      includedPBIs: ['pbi-012'],
      dodVerifications: [
        {
          id: 'dod-ve3-1',
          pbiId: 'pbi-012',
          dodItemId: 'dod-1',
          isVerified: true,
          verifiedBy: UUIDS.users.developer1,
          verifiedAt: '2026-02-12T10:00:00Z',
          dodItemDescription: 'Code reviewed and approved',
          dodItemCategory: 'quality',
        },
        {
          id: 'dod-ve3-2',
          pbiId: 'pbi-012',
          dodItemId: 'dod-2',
          isVerified: true,
          verifiedBy: UUIDS.users.admin,
          verifiedAt: '2026-02-12T10:30:00Z',
          dodItemDescription: 'Unit tests passing (80% coverage)',
          dodItemCategory: 'testing',
        },
      ],
      totalStoryPoints: 3,
      status: IncrementStatus.DELIVERED,
      createdAt: '2026-02-08T09:00:00Z',
      deliveredAt: '2026-02-12T11:00:00Z',
      deliveryMethod: DeliveryMethod.EARLY_RELEASE,
      createdBy: UUIDS.users.developer1,
      notes:
        'Widget shipped ahead of the Sprint Review so stakeholders could track daily progress in real time.',
    },
    // ==================== Early Release Increment ====================
    {
      id: 'increment-early-1',
      sprintId: 'sprint-2',
      teamId: UUIDS.teams.alpha,
      name: 'Hotfix - Authentication Security',
      description:
        'Critical security patch for authentication system addressing session management vulnerability. Released early to production.',
      includedPBIs: [],
      dodVerifications: [
        {
          id: 'dod-ve-1',
          pbiId: 'pbi-003',
          dodItemId: 'dod-7',
          isVerified: true,
          verifiedBy: UUIDS.users.admin,
          verifiedAt: '2026-01-26T08:00:00Z',
          dodItemDescription: 'Security audit passed',
          dodItemCategory: 'security',
        },
        {
          id: 'dod-ve-2',
          pbiId: 'pbi-003',
          dodItemId: 'dod-8',
          isVerified: true,
          verifiedBy: UUIDS.users.admin,
          verifiedAt: '2026-01-26T08:30:00Z',
          dodItemDescription: 'Penetration testing completed',
          dodItemCategory: 'security',
        },
        {
          id: 'dod-ve-3',
          pbiId: 'pbi-003',
          dodItemId: 'dod-3',
          isVerified: true,
          verifiedBy: UUIDS.users.developer1,
          verifiedAt: '2026-01-26T09:00:00Z',
          dodItemDescription: 'Regression tests passing',
          dodItemCategory: 'testing',
        },
      ],
      totalStoryPoints: 5,
      status: IncrementStatus.DELIVERED,
      createdAt: '2026-01-25T14:00:00Z',
      deliveredAt: '2026-01-26T10:00:00Z',
      deliveryMethod: DeliveryMethod.EARLY_RELEASE,
      createdBy: UUIDS.users.admin,
      notes:
        'Critical security fix deployed to production within 20 hours of discovery. No user impact.',
    },
  ];

  async getIncrements(teamId: string, sprintId?: string): Promise<ApiResponse<Increment[]>> {
    await delay(300);
    let filtered = this.incrementsStore.filter((i) => i.teamId === teamId);
    if (sprintId) {
      filtered = filtered.filter((i) => i.sprintId === sprintId);
    }
    // Resolve each increment's `includedPBIs` into full PBI objects so consumers
    // (e.g. the Sprint Review Increment page) can render the included items directly.
    const populated = filtered.map((increment) => ({
      ...increment,
      pbis: increment.includedPBIs
        .map((pbiId) => mockProductBacklogItems.find((p) => p.id === pbiId))
        .filter((pbi): pbi is ProductBacklogItem => Boolean(pbi)),
    }));
    return { success: true, data: populated };
  }

  async getIncrement(id: string): Promise<ApiResponse<Increment>> {
    await delay(300);
    const increment = this.incrementsStore.find((i) => i.id === id);
    if (!increment) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Increment not found' } };
    }
    return { success: true, data: increment };
  }

  async createIncrement(increment: Partial<Increment>): Promise<ApiResponse<Increment>> {
    await delay(400);
    const newIncrement: Increment = {
      id: `increment-${Date.now()}`,
      sprintId: increment.sprintId ?? '',
      teamId: increment.teamId ?? 'team-1',
      name: increment.name ?? 'New Increment',
      description: increment.description,
      includedPBIs: increment.includedPBIs ?? [],
      dodVerifications: increment.dodVerifications ?? [],
      totalStoryPoints: increment.totalStoryPoints ?? 0,
      status: IncrementStatus.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: increment.createdBy ?? 'current-user',
    };
    this.incrementsStore.push(newIncrement);
    return { success: true, data: newIncrement };
  }

  async updateIncrement(id: string, updates: Partial<Increment>): Promise<ApiResponse<Increment>> {
    await delay(400);
    const index = this.incrementsStore.findIndex((i) => i.id === id);
    if (index === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Increment not found' } };
    }
    this.incrementsStore[index] = { ...(this.incrementsStore[index] as Increment), ...updates };
    return { success: true, data: this.incrementsStore[index] as Increment };
  }

  async deliverIncrement(
    id: string,
    deliveryMethod: 'sprint_review' | 'early_release',
    notes?: string
  ): Promise<ApiResponse<Increment>> {
    await delay(400);
    const index = this.incrementsStore.findIndex((i) => i.id === id);
    if (index === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Increment not found' } };
    }
    this.incrementsStore[index] = {
      ...(this.incrementsStore[index] as Increment),
      status: IncrementStatus.DELIVERED,
      deliveredAt: new Date().toISOString(),
      deliveryMethod: deliveryMethod as DeliveryMethod,
      notes,
    };
    return { success: true, data: this.incrementsStore[index] as Increment };
  }

  async verifyIntegration(_incrementId: string): Promise<
    ApiResponse<{
      integrationVerified: boolean;
      priorCount: number;
      allPassed: boolean;
      missingTests?: string[];
      failedTests?: string[];
    }>
  > {
    await delay(300);
    // Mock always returns a verified, all-passed result so the workflow fast path is preserved in dev.
    return {
      success: true,
      data: {
        integrationVerified: true,
        priorCount: 0,
        allPassed: true,
      },
    };
  }

  async getIncrementMetrics(_teamId: string): Promise<ApiResponse<IncrementMetrics>> {
    await delay(300);
    return {
      success: true,
      data: {
        totalIncrements: 10,
        deliveredIncrements: 8,
        averageDeliveryTime: 12,
        averageStoryPoints: 21,
        earlyReleases: 2,
        sprintReviewDeliveries: 8,
      },
    };
  }

  async getEligiblePBIsForIncrement(_sprintId: string): Promise<ApiResponse<ProductBacklogItem[]>> {
    await delay(300);
    const eligible = mockProductBacklogItems.filter((p) => p.status === ItemStatus.DONE);
    return { success: true, data: eligible };
  }

  // ==================== Sprint Reviews ====================

  // Product Goal progress snapshots captured at Sprint Reviews (mock).
  private productGoalSnapshotsStore: ProductGoalSnapshot[] = [];

  private sprintReviewsStore: SprintReview[] = [
    // ==================== Completed Sprint Reviews ====================
    {
      id: 'review-1',
      sprintId: 'sprint-1',
      teamId: UUIDS.teams.alpha,
      incrementId: 'increment-1',
      reviewDate: '2026-01-18T15:00:00Z',
      attendees: [
        {
          id: 'attendee-1',
          name: 'John Administrator',
          email: 'john.admin@company.com',
          role: 'stakeholder',
          attended: true,
        },
        {
          id: 'attendee-2',
          name: 'Sarah Smith',
          email: 'sarah.smith@company.com',
          role: 'scrum_master',
          attended: true,
        },
        {
          id: 'attendee-3',
          name: 'Mike Wilson',
          email: 'mike.wilson@company.com',
          role: 'product_owner',
          attended: true,
        },
        {
          id: 'attendee-4',
          name: 'Emma Davis',
          email: 'emma.davis@company.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-5',
          name: 'Alex Brown',
          email: 'alex.brown@company.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-6',
          name: 'Jennifer Lee',
          email: 'jennifer.lee@company.com',
          role: 'stakeholder',
          attended: false,
        },
      ],
      feedback: [
        {
          id: 'feedback-1',
          reviewId: 'review-1',
          authorName: 'Jennifer Lee',
          content:
            'Great foundation! The dashboard layout is intuitive and clean. Looking forward to seeing the Kanban board in action.',
          category: 'positive',
          actionRequired: false,
          actionTaken: false,
          createdAt: '2026-01-18T15:30:00Z',
        },
        {
          id: 'feedback-2',
          reviewId: 'review-1',
          authorName: 'John Administrator',
          content:
            'Impressed with the CI/CD pipeline setup. Deployment process is smooth and well-documented.',
          category: 'positive',
          actionRequired: false,
          actionTaken: false,
          createdAt: '2026-01-18T15:45:00Z',
        },
        {
          id: 'feedback-3',
          reviewId: 'review-1',
          authorName: 'Mike Wilson',
          content:
            'Consider adding more detailed analytics in future increments. The current metrics are a good start.',
          category: 'suggestion',
          actionRequired: true,
          actionTaken: true,
          createdAt: '2026-01-18T16:00:00Z',
        },
      ],
      backlogAdjustments: [
        {
          id: 'adjustment-1',
          reviewId: 'review-1',
          pbiId: 'pbi-003',
          action: 'modify',
          description: 'Increased priority for authentication system based on stakeholder feedback',
          reason: 'Security requirements elevated by stakeholders',
          implemented: true,
          createdAt: '2026-01-18T16:15:00Z',
        },
      ],
      summary:
        'Sprint 1 review completed successfully. Core infrastructure delivered on time with all DoD criteria met. Stakeholders impressed with the foundation and eager to see the Kanban board in Sprint 2.',
      createdAt: '2026-01-18T15:00:00Z',
      updatedAt: '2026-01-18T16:30:00Z',
    },
    {
      id: 'review-2',
      sprintId: 'sprint-2',
      teamId: UUIDS.teams.alpha,
      incrementId: 'increment-2',
      reviewDate: '2026-02-01T15:00:00Z',
      attendees: [
        {
          id: 'attendee-7',
          name: 'John Administrator',
          email: 'john.admin@company.com',
          role: 'stakeholder',
          attended: true,
        },
        {
          id: 'attendee-8',
          name: 'Sarah Smith',
          email: 'sarah.smith@company.com',
          role: 'scrum_master',
          attended: true,
        },
        {
          id: 'attendee-9',
          name: 'Mike Wilson',
          email: 'mike.wilson@company.com',
          role: 'product_owner',
          attended: true,
        },
        {
          id: 'attendee-10',
          name: 'Emma Davis',
          email: 'emma.davis@company.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-11',
          name: 'Alex Brown',
          email: 'alex.brown@company.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-12',
          name: 'David Chen',
          email: 'david.chen@company.com',
          role: 'stakeholder',
          attended: true,
        },
        {
          id: 'attendee-13',
          name: 'Lisa Wang',
          email: 'lisa.wang@company.com',
          role: 'stakeholder',
          attended: false,
        },
      ],
      feedback: [
        {
          id: 'feedback-4',
          reviewId: 'review-2',
          authorName: 'David Chen',
          content:
            'The Kanban board is exactly what we needed! Drag-and-drop functionality is smooth and intuitive.',
          category: 'positive',
          actionRequired: false,
          actionTaken: false,
          createdAt: '2026-02-01T15:30:00Z',
        },
        {
          id: 'feedback-5',
          reviewId: 'review-2',
          authorName: 'Lisa Wang',
          content:
            'Dashboard widgets provide excellent visibility. Would love to see burndown chart integration.',
          category: 'positive',
          actionRequired: false,
          actionTaken: false,
          createdAt: '2026-02-01T15:45:00Z',
        },
        {
          id: 'feedback-6',
          reviewId: 'review-2',
          authorName: 'Mike Wilson',
          content: 'Team velocity tracking is very helpful for sprint planning. Great progress!',
          category: 'positive',
          actionRequired: false,
          actionTaken: false,
          createdAt: '2026-02-01T16:00:00Z',
        },
        {
          id: 'feedback-7',
          reviewId: 'review-2',
          authorName: 'John Administrator',
          content:
            'Mobile responsiveness could be improved. Some UI elements are hard to use on smaller screens.',
          category: 'suggestion',
          actionRequired: true,
          actionTaken: false,
          createdAt: '2026-02-01T16:15:00Z',
        },
      ],
      backlogAdjustments: [
        {
          id: 'adjustment-2',
          reviewId: 'review-2',
          pbiId: 'pbi-007',
          action: 'modify',
          description:
            'Added notification reminders feature to Daily Scrum PBI based on stakeholder request',
          reason: 'Stakeholder requested push notifications for daily updates',
          implemented: true,
          createdAt: '2026-02-01T16:30:00Z',
        },
        {
          id: 'adjustment-3',
          reviewId: 'review-2',
          action: 'add',
          description: 'Created new PBI for mobile responsiveness improvements',
          reason: 'Mobile UI issues identified during review',
          implemented: false,
          createdAt: '2026-02-01T16:45:00Z',
        },
      ],
      summary:
        'Sprint 2 review completed with excellent stakeholder engagement. Kanban board and dashboard well-received. Mobile responsiveness identified as area for improvement. Two backlog adjustments made based on feedback.',
      createdAt: '2026-02-01T15:00:00Z',
      updatedAt: '2026-02-01T17:00:00Z',
    },
    // ==================== Draft Sprint Review ====================
    {
      id: 'review-3',
      sprintId: 'sprint-3',
      teamId: UUIDS.teams.alpha,
      incrementId: 'increment-3',
      reviewDate: '2026-02-15T15:00:00Z',
      attendees: [
        {
          id: 'attendee-14',
          name: 'Sarah Smith',
          email: 'sarah.smith@company.com',
          role: 'scrum_master',
          attended: false,
        },
        {
          id: 'attendee-15',
          name: 'Mike Wilson',
          email: 'mike.wilson@company.com',
          role: 'product_owner',
          attended: false,
        },
      ],
      feedback: [],
      backlogAdjustments: [],
      summary: '',
      createdAt: '2026-02-14T09:00:00Z',
      updatedAt: '2026-02-14T09:00:00Z',
    },
  ];

  async getSprintReviews(teamId: string, sprintId?: string): Promise<ApiResponse<SprintReview[]>> {
    await delay(300);
    let reviews = this.sprintReviewsStore.filter((r) => r.teamId === teamId);
    if (sprintId) {
      reviews = reviews.filter((r) => r.sprintId === sprintId);
    }
    return { success: true, data: reviews };
  }

  async getSprintReview(id: string): Promise<ApiResponse<SprintReview>> {
    await delay(300);
    const review = this.sprintReviewsStore.find((r) => r.id === id);
    if (!review) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } };
    }
    return { success: true, data: review };
  }

  async createSprintReview(review: Partial<SprintReview>): Promise<ApiResponse<SprintReview>> {
    await delay(400);
    const newReview: SprintReview = {
      id: `review-${Date.now()}`,
      sprintId: review.sprintId ?? '',
      teamId: review.teamId ?? 'team-1',
      incrementId: review.incrementId ?? '',
      reviewDate: review.reviewDate ?? new Date().toISOString(),
      attendees: review.attendees ?? [],
      feedback: review.feedback ?? [],
      backlogAdjustments: review.backlogAdjustments ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sprintReviewsStore.push(newReview);
    return { success: true, data: newReview };
  }

  async updateSprintReview(
    id: string,
    updates: Partial<SprintReview>
  ): Promise<ApiResponse<SprintReview>> {
    await delay(400);
    const index = this.sprintReviewsStore.findIndex((r) => r.id === id);
    if (index === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } };
    }
    this.sprintReviewsStore[index] = {
      ...(this.sprintReviewsStore[index] as SprintReview),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, data: this.sprintReviewsStore[index] as SprintReview };
  }

  async addAttendee(
    _reviewId: string,
    attendee: Partial<ReviewAttendee>
  ): Promise<ApiResponse<ReviewAttendee>> {
    await delay(300);
    const newAttendee: ReviewAttendee = {
      id: `attendee-${Date.now()}`,
      name: attendee.name ?? 'New Attendee',
      email: attendee.email,
      role: attendee.role ?? 'stakeholder',
      attended: attendee.attended ?? false,
    };
    return { success: true, data: newAttendee };
  }

  async updateAttendee(
    _attendeeId: string,
    updates: Partial<ReviewAttendee>
  ): Promise<ApiResponse<ReviewAttendee>> {
    await delay(300);
    return {
      success: true,
      data: {
        id: _attendeeId,
        name: 'Updated',
        role: 'stakeholder',
        attended: updates.attended ?? false,
      },
    };
  }

  async deleteAttendee(_attendeeId: string): Promise<ApiResponse<never>> {
    await delay(300);
    return { success: true };
  }

  async addStakeholderFeedback(
    reviewId: string,
    feedback: Partial<StakeholderFeedback>
  ): Promise<ApiResponse<StakeholderFeedback>> {
    await delay(400);
    const newFeedback: StakeholderFeedback = {
      id: `feedback-${Date.now()}`,
      reviewId,
      authorName: feedback.authorName ?? 'Anonymous',
      content: feedback.content ?? '',
      category: feedback.category ?? 'positive',
      actionRequired: feedback.actionRequired ?? false,
      actionTaken: false,
      productGoalAssessment: feedback.productGoalAssessment,
      createdAt: new Date().toISOString(),
    };
    return { success: true, data: newFeedback };
  }

  // ==================== Product Goal at Sprint Review ====================

  // Returns the active Product Goal for the review's sprint, along with
  // progress computed from the goal's backlog items. Mirrors the backend
  // GET /sprint-reviews/:id/product-goal response shape.
  async getProductGoalForReview(reviewId: string): Promise<
    ApiResponse<{
      reviewId: string;
      reviewDate: string;
      sprintId: string;
      sprintName: string;
      productGoal: {
        id: string;
        title: string;
        description?: string;
        successMetrics?: string;
        status: string;
        completedPbiCount: number;
        totalPbiCount: number;
        completedStoryPoints: number;
        totalStoryPoints: number;
      } | null;
    }>
  > {
    await delay(300);
    const review = this.sprintReviewsStore.find((r) => r.id === reviewId);
    const sprint = mockSprints.find((s) => s.id === review?.sprintId);
    const teamId = review?.teamId ?? getCurrentTeam().id;

    // In mock mode the Sprint model has no goalId, so we apply the team's
    // active Product Goal (see "apply the active goal accordingly").
    const activeGoal = mockProductGoals.find((g) => g.teamId === teamId && g.status === 'ACTIVE');

    if (!activeGoal) {
      return {
        success: true,
        data: {
          reviewId,
          reviewDate: review?.reviewDate ?? new Date().toISOString(),
          sprintId: sprint?.id ?? '',
          sprintName: sprint?.name ?? '',
          productGoal: null,
        },
      };
    }

    const goalItems = mockProductBacklogItems.filter((b) => b.goalId === activeGoal.id);
    const completedItems = goalItems.filter((b) => b.status === 'DONE');
    const completedStoryPoints = completedItems.reduce((sum, b) => sum + (b.storyPoints ?? 0), 0);
    const totalStoryPoints = goalItems.reduce((sum, b) => sum + (b.storyPoints ?? 0), 0);

    return {
      success: true,
      data: {
        reviewId,
        reviewDate: review?.reviewDate ?? new Date().toISOString(),
        sprintId: sprint?.id ?? '',
        sprintName: sprint?.name ?? '',
        productGoal: {
          id: activeGoal.id,
          title: activeGoal.title,
          description: activeGoal.description,
          successMetrics: activeGoal.successMetrics,
          status: activeGoal.status,
          completedPbiCount: completedItems.length,
          totalPbiCount: goalItems.length,
          completedStoryPoints,
          totalStoryPoints,
        },
      },
    };
  }

  // Records a Product Goal progress assessment as a snapshot. Mirrors the
  // backend POST /sprint-reviews/:id/product-goal-assessment endpoint.
  async submitProductGoalAssessment(
    reviewId: string,
    payload: ProductGoalProgressAssessment
  ): Promise<ApiResponse<ProductGoalSnapshot>> {
    await delay(300);
    const review = this.sprintReviewsStore.find((r) => r.id === reviewId);
    const sprint = mockSprints.find((s) => s.id === review?.sprintId);
    const teamId = review?.teamId ?? getCurrentTeam().id;
    const activeGoal = mockProductGoals.find((g) => g.teamId === teamId && g.status === 'ACTIVE');

    if (!activeGoal) {
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'This sprint is not linked to a Product Goal',
        },
      };
    }

    const snapshot: ProductGoalSnapshot = {
      id: `snapshot-${Date.now()}`,
      goalId: activeGoal.id,
      sprintReviewId: reviewId,
      successMetricValues: payload.successMetricValues ?? null,
      assessment: payload.assessment,
      completedPbiCount: mockProductBacklogItems.filter(
        (b) => b.goalId === activeGoal.id && b.status === 'DONE'
      ).length,
      completedStoryPoints: mockProductBacklogItems
        .filter((b) => b.goalId === activeGoal.id && b.status === 'DONE')
        .reduce((sum, b) => sum + (b.storyPoints ?? 0), 0),
      createdAt: new Date().toISOString(),
      sprintName: sprint?.name,
      reviewDate: review?.reviewDate,
    };
    this.productGoalSnapshotsStore.push(snapshot);
    return { success: true, data: snapshot };
  }

  // Returns the Product Goal progress snapshots captured across Sprint Reviews.
  // Mirrors the backend GET /product-goals/:id/snapshots endpoint.
  async getProductGoalSnapshots(goalId: string): Promise<ApiResponse<ProductGoalSnapshot[]>> {
    await delay(300);
    const snapshots = this.productGoalSnapshotsStore.filter((s) => s.goalId === goalId);
    // Seed a couple of historical snapshots so the timeline is populated in mock mode.
    const seeded: ProductGoalSnapshot[] = [
      {
        id: 'snapshot-seed-1',
        goalId,
        sprintReviewId: 'review-1',
        successMetricValues: null,
        assessment: 'Infrastructure delivered on schedule; core UI scaffolding in place.',
        completedPbiCount: 3,
        completedStoryPoints: 21,
        createdAt: '2026-01-18T16:00:00Z',
        sprintName: 'Sprint-2w-2601 (2026-01-05 – 2026-01-16)',
        reviewDate: '2026-01-18T15:00:00Z',
      },
      {
        id: 'snapshot-seed-2',
        goalId,
        sprintReviewId: 'review-2',
        successMetricValues: null,
        assessment: 'Dashboard and sprint board delivered; mobile responsiveness still open.',
        completedPbiCount: 5,
        completedStoryPoints: 34,
        createdAt: '2026-02-01T17:00:00Z',
        sprintName: 'Sprint-2w-2602 (2026-01-19 – 2026-01-30)',
        reviewDate: '2026-02-01T15:00:00Z',
      },
    ];
    return { success: true, data: [...seeded, ...snapshots] };
  }

  // ==================== Sprint Retrospectives ====================

  private retrospectivesStore: SprintRetrospective[] = [
    // ==================== COMPLETED Retrospectives ====================
    {
      id: 'retro-1',
      sprintId: 'sprint-1',
      teamId: UUIDS.teams.alpha,
      retroDate: '2026-01-18T18:00:00Z',
      facilitatorId: UUIDS.users.scrumMaster,
      status: RetrospectiveStatus.COMPLETED,
      participants: [
        { id: UUIDS.users.admin, firstName: 'John', lastName: 'Administrator', role: 'developers' },
        {
          id: UUIDS.users.scrumMaster,
          firstName: 'Sarah',
          lastName: 'Smith',
          role: 'scrum_master',
        },
        {
          id: UUIDS.users.developer1,
          firstName: 'Mike',
          lastName: 'Wilson',
          role: 'product_owner',
        },
        { id: UUIDS.users.developer2, firstName: 'Emma', lastName: 'Davis', role: 'developers' },
        { id: UUIDS.users.guest, firstName: 'Alex', lastName: 'Brown', role: 'developers' },
      ],
      attendees: [
        {
          id: 'attendee-1-1',
          userId: UUIDS.users.admin,
          name: 'John Administrator',
          email: 'demo@example.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-1-2',
          userId: UUIDS.users.scrumMaster,
          name: 'Sarah Smith',
          email: 'sarah.smith@example.com',
          role: 'scrum_master',
          attended: true,
        },
        {
          id: 'attendee-1-3',
          userId: UUIDS.users.developer1,
          name: 'Mike Wilson',
          email: 'mike.wilson@example.com',
          role: 'product_owner',
          attended: true,
        },
        {
          id: 'attendee-1-4',
          userId: UUIDS.users.developer2,
          name: 'Emma Davis',
          email: 'emma.davis@example.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-1-5',
          userId: UUIDS.users.guest,
          name: 'Alex Brown',
          email: 'alex.brown@example.com',
          role: 'developers',
          attended: false,
        },
      ],
      items: [
        {
          id: 'item-1-1',
          retrospectiveId: 'retro-1',
          category: RetrospectiveCategory.WENT_WELL,
          content:
            'Excellent team collaboration during infrastructure setup. Everyone contributed effectively.',
          authorName: 'Sarah Smith',
          votes: 5,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 0,
          createdAt: '2026-01-18T18:05:00Z',
        },
        {
          id: 'item-1-2',
          retrospectiveId: 'retro-1',
          category: RetrospectiveCategory.WENT_WELL,
          content: 'CI/CD pipeline setup was smooth. Automated deployments saved significant time.',
          authorName: 'Mike Wilson',
          votes: 4,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 1,
          createdAt: '2026-01-18T18:10:00Z',
        },
        {
          id: 'item-1-3',
          retrospectiveId: 'retro-1',
          category: RetrospectiveCategory.DIDNT_GO_WELL,
          content: 'Initial requirements were unclear, causing some rework.',
          authorName: 'Emma Davis',
          votes: 3,
          votedBy: [UUIDS.users.scrumMaster, UUIDS.users.developer1, UUIDS.users.developer2],
          order: 0,
          createdAt: '2026-01-18T18:15:00Z',
        },
        {
          id: 'item-1-4',
          retrospectiveId: 'retro-1',
          category: RetrospectiveCategory.IMPROVEMENT,
          content: 'Start each sprint with a brief requirements clarification session.',
          authorName: 'Sarah Smith',
          votes: 5,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 0,
          createdAt: '2026-01-18T18:20:00Z',
        },
      ],
      actionItems: [
        {
          id: 'action-1-1',
          retrospectiveId: 'retro-1',
          title: 'Create requirements clarification checklist',
          description: 'Develop a standard checklist for requirements review at sprint start',
          ownerId: UUIDS.users.scrumMaster,
          status: 'COMPLETED',
          addedToSprintBacklog: true,
          createdAt: '2026-01-18T18:45:00Z',
        },
      ],
      summary:
        'Sprint 1 retrospective highlighted strong team collaboration and successful CI/CD implementation. The main improvement area identified was requirements clarity at sprint start. Action item: Create a requirements clarification checklist for future sprints. 4 of 5 team members attended.',
      isAnonymous: false,
      createdAt: '2026-01-18T18:00:00Z',
      updatedAt: '2026-01-18T19:00:00Z',
    },
    {
      id: 'retro-2',
      sprintId: 'sprint-2',
      teamId: UUIDS.teams.alpha,
      retroDate: '2026-02-01T18:00:00Z',
      facilitatorId: UUIDS.users.scrumMaster,
      status: RetrospectiveStatus.COMPLETED,
      participants: [
        { id: UUIDS.users.admin, firstName: 'John', lastName: 'Administrator', role: 'developers' },
        {
          id: UUIDS.users.scrumMaster,
          firstName: 'Sarah',
          lastName: 'Smith',
          role: 'scrum_master',
        },
        {
          id: UUIDS.users.developer1,
          firstName: 'Mike',
          lastName: 'Wilson',
          role: 'product_owner',
        },
        { id: UUIDS.users.developer2, firstName: 'Emma', lastName: 'Davis', role: 'developers' },
        { id: UUIDS.users.guest, firstName: 'Alex', lastName: 'Brown', role: 'developers' },
      ],
      attendees: [
        {
          id: 'attendee-2-1',
          userId: UUIDS.users.admin,
          name: 'John Administrator',
          email: 'demo@example.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-2-2',
          userId: UUIDS.users.scrumMaster,
          name: 'Sarah Smith',
          email: 'sarah.smith@example.com',
          role: 'scrum_master',
          attended: true,
        },
        {
          id: 'attendee-2-3',
          userId: UUIDS.users.developer1,
          name: 'Mike Wilson',
          email: 'mike.wilson@example.com',
          role: 'product_owner',
          attended: true,
        },
        {
          id: 'attendee-2-4',
          userId: UUIDS.users.developer2,
          name: 'Emma Davis',
          email: 'emma.davis@example.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-2-5',
          userId: UUIDS.users.guest,
          name: 'Alex Brown',
          email: 'alex.brown@example.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-2-6',
          name: 'David Chen',
          email: 'david.chen@stakeholder.com',
          role: 'stakeholder',
          attended: true,
        },
      ],
      items: [
        {
          id: 'item-2-1',
          retrospectiveId: 'retro-2',
          category: RetrospectiveCategory.WENT_WELL,
          content:
            'Kanban board implementation exceeded expectations. Drag-and-drop works flawlessly.',
          authorName: 'Emma Davis',
          votes: 5,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 0,
          createdAt: '2026-02-01T18:05:00Z',
        },
        {
          id: 'item-2-2',
          retrospectiveId: 'retro-2',
          category: RetrospectiveCategory.WENT_WELL,
          content: 'Dashboard widgets provide great visibility. Team loves the sprint overview.',
          authorName: 'Mike Wilson',
          votes: 4,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
          ],
          order: 1,
          createdAt: '2026-02-01T18:10:00Z',
        },
        {
          id: 'item-2-3',
          retrospectiveId: 'retro-2',
          category: RetrospectiveCategory.DIDNT_GO_WELL,
          content: 'Sprint planning took too long (3+ hours). Need better preparation.',
          authorName: 'Sarah Smith',
          votes: 5,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 0,
          createdAt: '2026-02-01T18:15:00Z',
        },
        {
          id: 'item-2-4',
          retrospectiveId: 'retro-2',
          category: RetrospectiveCategory.DIDNT_GO_WELL,
          content: 'Mobile testing was rushed. Found issues late in the sprint.',
          authorName: 'Alex Brown',
          votes: 3,
          votedBy: [UUIDS.users.admin, UUIDS.users.developer1, UUIDS.users.developer2],
          order: 1,
          createdAt: '2026-02-01T18:20:00Z',
        },
        {
          id: 'item-2-5',
          retrospectiveId: 'retro-2',
          category: RetrospectiveCategory.IMPROVEMENT,
          content:
            'Introduce time-boxing for sprint planning (max 2 hours with pre-read materials).',
          authorName: 'Sarah Smith',
          votes: 5,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 0,
          createdAt: '2026-02-01T18:25:00Z',
        },
        {
          id: 'item-2-6',
          retrospectiveId: 'retro-2',
          category: RetrospectiveCategory.IMPROVEMENT,
          content: 'Add mobile testing to DoD checklist and test early in each sprint.',
          authorName: 'Emma Davis',
          votes: 4,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
          ],
          order: 1,
          createdAt: '2026-02-01T18:30:00Z',
        },
      ],
      actionItems: [
        // {
        //   id: 'action-2-1',
        //   retrospectiveId: 'retro-2',
        //   title: 'Create time-boxing guidelines for ceremonies',
        //   description: 'Define time limits for each ceremony with pre-read requirements',
        //   ownerId: UUIDS.users.scrumMaster,
        //   status: 'IN_PROGRESS',
        //   addedToSprintBacklog: true,
        //   createdAt: '2026-02-01T18:45:00Z',
        // },
        // {
        //   id: 'action-2-2',
        //   retrospectiveId: 'retro-2',
        //   title: 'Update DoD with mobile testing requirement',
        //   description: 'Add mobile responsiveness testing to Definition of Done checklist',
        //   ownerId: UUIDS.users.developer2,
        //   status: 'PENDING',
        //   addedToSprintBacklog: false,
        //   createdAt: '2026-02-01T18:50:00Z',
        // },
      ],
      summary:
        'Sprint 2 was highly productive with successful Kanban and dashboard implementations. Key issues: sprint planning duration and mobile testing timing. Action items include time-boxing guidelines and updating DoD for mobile testing. All 6 attendees participated including stakeholder David Chen.',
      isAnonymous: false,
      createdAt: '2026-02-01T18:00:00Z',
      updatedAt: '2026-02-01T19:15:00Z',
    },
    // ==================== IN_PROGRESS Retrospective ====================
    {
      id: 'retro-3',
      sprintId: 'sprint-3',
      teamId: UUIDS.teams.alpha,
      retroDate: '2026-02-14T18:00:00Z',
      facilitatorId: UUIDS.users.scrumMaster,
      status: RetrospectiveStatus.IN_PROGRESS,
      participants: [
        { id: UUIDS.users.admin, firstName: 'John', lastName: 'Administrator', role: 'developers' },
        {
          id: UUIDS.users.scrumMaster,
          firstName: 'Sarah',
          lastName: 'Smith',
          role: 'scrum_master',
        },
        {
          id: UUIDS.users.developer1,
          firstName: 'Mike',
          lastName: 'Wilson',
          role: 'product_owner',
        },
        { id: UUIDS.users.developer2, firstName: 'Emma', lastName: 'Davis', role: 'developers' },
        { id: UUIDS.users.guest, firstName: 'Alex', lastName: 'Brown', role: 'developers' },
      ],
      attendees: [
        {
          id: 'attendee-3-1',
          userId: UUIDS.users.admin,
          name: 'John Administrator',
          email: 'demo@example.com',
          role: 'developers',
          attended: true,
        },
        {
          id: 'attendee-3-2',
          userId: UUIDS.users.scrumMaster,
          name: 'Sarah Smith',
          email: 'sarah.smith@example.com',
          role: 'scrum_master',
          attended: true,
        },
        {
          id: 'attendee-3-3',
          userId: UUIDS.users.developer1,
          name: 'Mike Wilson',
          email: 'mike.wilson@example.com',
          role: 'product_owner',
          attended: true,
        },
        {
          id: 'attendee-3-4',
          userId: UUIDS.users.developer2,
          name: 'Emma Davis',
          email: 'emma.davis@example.com',
          role: 'developers',
          attended: false,
        },
        {
          id: 'attendee-3-5',
          userId: UUIDS.users.guest,
          name: 'Alex Brown',
          email: 'alex.brown@example.com',
          role: 'developers',
          attended: true,
        },
      ],
      items: [
        {
          id: 'item-3-1',
          retrospectiveId: 'retro-3',
          category: RetrospectiveCategory.WENT_WELL,
          content:
            'Daily Scrum feature implementation going smoothly. Form validation works great.',
          authorName: 'John Administrator',
          votes: 3,
          votedBy: [UUIDS.users.scrumMaster, UUIDS.users.developer1, UUIDS.users.developer2],
          order: 0,
          createdAt: '2026-02-14T18:05:00Z',
        },
        {
          id: 'item-3-2',
          retrospectiveId: 'retro-3',
          category: RetrospectiveCategory.WENT_WELL,
          content: 'Impediment tracking design received positive feedback from stakeholders.',
          authorName: 'Emma Davis',
          votes: 2,
          votedBy: [UUIDS.users.admin, UUIDS.users.scrumMaster],
          order: 1,
          createdAt: '2026-02-14T18:10:00Z',
        },
        {
          id: 'item-3-3',
          retrospectiveId: 'retro-3',
          category: RetrospectiveCategory.DIDNT_GO_WELL,
          content: 'API documentation incomplete, causing integration delays.',
          authorName: 'Mike Wilson',
          votes: 4,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
            UUIDS.users.guest,
          ],
          order: 0,
          createdAt: '2026-02-14T18:15:00Z',
        },
        {
          id: 'item-3-4',
          retrospectiveId: 'retro-3',
          category: RetrospectiveCategory.IMPROVEMENT,
          content: 'Establish API documentation standards and review process.',
          authorName: 'Sarah Smith',
          votes: 4,
          votedBy: [
            UUIDS.users.admin,
            UUIDS.users.scrumMaster,
            UUIDS.users.developer1,
            UUIDS.users.developer2,
          ],
          order: 0,
          createdAt: '2026-02-14T18:20:00Z',
        },
      ],
      actionItems: [],
      summary:
        'Sprint 3 retrospective in progress. Daily Scrum and impediment tracking features are progressing well. Main concern: API documentation needs improvement. 4 of 5 team members attended. Summary to be finalized upon completion.',
      isAnonymous: false,
      createdAt: '2026-02-14T18:00:00Z',
      updatedAt: '2026-02-14T18:30:00Z',
    },
    // ==================== DRAFT Retrospective ====================
    {
      id: 'retro-4',
      sprintId: 'sprint-3',
      teamId: UUIDS.teams.beta,
      retroDate: '2026-02-15T18:00:00Z',
      facilitatorId: UUIDS.users.scrumMaster,
      status: RetrospectiveStatus.DRAFT,
      participants: [
        {
          id: UUIDS.users.scrumMaster,
          firstName: 'Sarah',
          lastName: 'Smith',
          role: 'scrum_master',
        },
      ],
      attendees: [
        {
          id: 'attendee-4-1',
          userId: UUIDS.users.scrumMaster,
          name: 'Sarah Smith',
          email: 'sarah.smith@example.com',
          role: 'scrum_master',
          attended: false,
        },
      ],
      items: [
        {
          id: 'item-4-1',
          retrospectiveId: 'retro-4',
          category: RetrospectiveCategory.WENT_WELL,
          content: 'Initial sprint setup completed on time.',
          authorName: 'Sarah Smith',
          votes: 1,
          votedBy: [UUIDS.users.scrumMaster],
          order: 0,
          createdAt: '2026-02-15T18:05:00Z',
        },
        {
          id: 'item-4-2',
          retrospectiveId: 'retro-4',
          category: RetrospectiveCategory.DIDNT_GO_WELL,
          content: 'Story point estimation took longer than expected.',
          authorName: 'Sarah Smith',
          votes: 0,
          votedBy: [],
          order: 0,
          createdAt: '2026-02-15T18:10:00Z',
        },
        {
          id: 'item-4-3',
          retrospectiveId: 'retro-4',
          category: RetrospectiveCategory.IMPROVEMENT,
          content: 'Consider using planning poker for more accurate estimations.',
          authorName: 'Sarah Smith',
          votes: 1,
          votedBy: [UUIDS.users.scrumMaster],
          order: 0,
          createdAt: '2026-02-15T18:15:00Z',
        },
      ],
      actionItems: [],
      isAnonymous: true,
      createdAt: '2026-02-14T09:00:00Z',
      updatedAt: '2026-02-14T09:00:00Z',
    },
  ];

  async getRetrospectives(teamId: string): Promise<ApiResponse<SprintRetrospective[]>> {
    await delay(300);
    return { success: true, data: this.retrospectivesStore.filter((r) => r.teamId === teamId) };
  }

  async getRetrospective(id: string): Promise<ApiResponse<SprintRetrospective>> {
    await delay(300);
    const retro = this.retrospectivesStore.find((r) => r.id === id);
    if (!retro) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    return { success: true, data: retro };
  }

  async createRetrospective(
    retro: Partial<SprintRetrospective>
  ): Promise<ApiResponse<SprintRetrospective>> {
    await delay(400);
    const newRetro: SprintRetrospective = {
      id: `retro-${Date.now()}`,
      sprintId: retro.sprintId ?? '',
      teamId: retro.teamId ?? 'team-1',
      retroDate: retro.retroDate ?? new Date().toISOString(),
      facilitatorId: retro.facilitatorId ?? 'current-user',
      status: RetrospectiveStatus.DRAFT,
      participants: retro.participants ?? [],
      attendees: retro.attendees ?? [],
      items: retro.items ?? [],
      actionItems: retro.actionItems ?? [],
      isAnonymous: retro.isAnonymous ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.retrospectivesStore.push(newRetro);
    return { success: true, data: newRetro };
  }

  async updateRetrospective(
    id: string,
    updates: Partial<SprintRetrospective>
  ): Promise<ApiResponse<SprintRetrospective>> {
    await delay(400);
    const index = this.retrospectivesStore.findIndex((r) => r.id === id);
    if (index === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    this.retrospectivesStore[index] = {
      ...(this.retrospectivesStore[index] as SprintRetrospective),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return { success: true, data: this.retrospectivesStore[index] as SprintRetrospective };
  }

  async addRetrospectiveItem(
    retroId: string,
    item: Partial<RetrospectiveItem>
  ): Promise<ApiResponse<RetrospectiveItem>> {
    await delay(400);
    const newItem: RetrospectiveItem = {
      id: `item-${Date.now()}`,
      retrospectiveId: retroId,
      category: item.category ?? RetrospectiveCategory.IMPROVEMENT,
      content: item.content ?? '',
      authorName: item.authorName,
      votes: 0,
      votedBy: [],
      order: 0,
      createdAt: new Date().toISOString(),
    };
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex !== -1) {
      (this.retrospectivesStore[retroIndex] as SprintRetrospective).items.push(newItem);
    }
    return { success: true, data: newItem };
  }

  async voteRetrospectiveItem(
    retroId: string,
    itemId: string
  ): Promise<ApiResponse<RetrospectiveItem>> {
    await delay(300);
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    const itemIndex = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items.findIndex(
      (i) => i.id === itemId
    );
    if (itemIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }
    const currentUser = getCurrentUser();
    const existingItems = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items;
    const item = existingItems[itemIndex];
    if (!item) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }

    // Add user to votedBy if not already voted
    item.votedBy ??= [];
    if (!item.votedBy.includes(currentUser.id)) {
      item.votedBy.push(currentUser.id);
      item.votes += 1;
    }

    return { success: true, data: item };
  }

  async unvoteRetrospectiveItem(
    retroId: string,
    itemId: string
  ): Promise<ApiResponse<RetrospectiveItem>> {
    await delay(300);
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    const itemIndex = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items.findIndex(
      (i) => i.id === itemId
    );
    if (itemIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }
    const currentUser = getCurrentUser();
    const existingItems = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items;
    const item = existingItems[itemIndex];
    if (!item) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }

    // Remove user from votedBy if they have voted
    item.votedBy ??= [];
    const voteIndex = item.votedBy.indexOf(currentUser.id);
    if (voteIndex !== -1) {
      item.votedBy.splice(voteIndex, 1);
      if (item.votes > 0) {
        item.votes -= 1;
      }
    }

    return { success: true, data: item };
  }

  async updateRetrospectiveItem(
    retroId: string,
    itemId: string,
    updates: Partial<RetrospectiveItem>
  ): Promise<ApiResponse<RetrospectiveItem>> {
    await delay(400);
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    const itemIndex = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items.findIndex(
      (i) => i.id === itemId
    );
    if (itemIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }
    const existingItems = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items;
    const existingItem = existingItems[itemIndex];
    if (!existingItem) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }
    existingItems[itemIndex] = {
      ...existingItem,
      ...updates,
    };
    return { success: true, data: existingItems[itemIndex] };
  }

  async deleteRetrospectiveItem(retroId: string, itemId: string): Promise<ApiResponse<void>> {
    await delay(400);
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    const itemIndex = (this.retrospectivesStore[retroIndex] as SprintRetrospective).items.findIndex(
      (i) => i.id === itemId
    );
    if (itemIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } };
    }
    (this.retrospectivesStore[retroIndex] as SprintRetrospective).items.splice(itemIndex, 1);
    return { success: true, data: undefined };
  }

  async addActionItem(
    retroId: string,
    actionItem: Partial<RetroActionItem>
  ): Promise<ApiResponse<RetroActionItem>> {
    await delay(400);
    const newActionItem: RetroActionItem = {
      id: `action-${Date.now()}`,
      retrospectiveId: retroId,
      title: actionItem.title ?? '',
      description: actionItem.description,
      ownerId: actionItem.ownerId ?? 'current-user',
      dueDate: actionItem.dueDate,
      status: 'PENDING',
      addedToSprintBacklog: false,
      createdAt: new Date().toISOString(),
    };
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex !== -1) {
      (this.retrospectivesStore[retroIndex] as SprintRetrospective).actionItems.push(newActionItem);
    }
    return { success: true, data: newActionItem };
  }

  async updateActionItem(
    retroId: string,
    actionItemId: string,
    updates: Partial<RetroActionItem>
  ): Promise<ApiResponse<RetroActionItem>> {
    await delay(400);
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    const actionIndex = (
      this.retrospectivesStore[retroIndex] as SprintRetrospective
    ).actionItems.findIndex((a) => a.id === actionItemId);
    if (actionIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Action item not found' } };
    }
    const existingActionItems = (this.retrospectivesStore[retroIndex] as SprintRetrospective)
      .actionItems;
    const existingActionItem = existingActionItems[actionIndex];
    if (!existingActionItem) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Action item not found' } };
    }
    existingActionItems[actionIndex] = {
      ...existingActionItem,
      ...updates,
    };
    return { success: true, data: existingActionItems[actionIndex] };
  }

  async deleteActionItem(retroId: string, actionItemId: string): Promise<ApiResponse<void>> {
    await delay(400);
    const retroIndex = this.retrospectivesStore.findIndex((r) => r.id === retroId);
    if (retroIndex === -1) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Retrospective not found' } };
    }
    const retro = this.retrospectivesStore[retroIndex] as SprintRetrospective;
    retro.actionItems = retro.actionItems.filter((a) => a.id !== actionItemId);
    return { success: true, data: undefined };
  }

  // ==================== Team Context ====================

  setCurrentTeamContext(_teamId: string): void {
    // No-op for mock
  }

  clearTeamContext(): void {
    // No-op for mock
  }

  async getMyTeams(): Promise<ApiResponse<(Team & { userRole: string })[]>> {
    await delay(300);
    const currentUser = getCurrentUser();
    const teamsWithRoles = mockTeams.map((team) => {
      const member = team.members?.find((m) => m.userId === currentUser.id);
      const userRole = member?.role ?? 'developers';
      return {
        ...team,
        userRole,
      };
    });
    return {
      success: true,
      data: teamsWithRoles,
    };
  }

  async getMyRoleInTeam(teamId: string): Promise<ApiResponse<{ role: string }>> {
    await delay(200);
    const currentUser = getCurrentUser();
    const team = mockTeams.find((t) => t.id === teamId);
    const member = team?.members?.find((m) => m.userId === currentUser.id);
    const role = member?.role ?? 'developers';
    return {
      success: true,
      data: { role },
    };
  }

  async selectTeam(teamId: string): Promise<ApiResponse<Team & { userRole: string }>> {
    await delay(300);
    const team = mockTeams.find((t) => t.id === teamId);
    if (!team) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Team not found',
        },
      };
    }
    const currentUser = getCurrentUser();
    const member = team.members?.find((m) => m.userId === currentUser.id);
    const userRole = member?.role ?? 'developers';
    return {
      success: true,
      data: {
        ...team,
        userRole,
      },
    };
  }

  // ==================== DoD Verifications ====================

  async getDoDVerificationsForPBI(
    _pbiId: string
  ): Promise<ApiResponse<DoDChecklistVerification[]>> {
    await delay(300);
    return { success: true, data: [] };
  }

  // ==================== Retrospective Attendees ====================

  async getRetrospectiveBySprintId(sprintId: string): Promise<ApiResponse<SprintRetrospective>> {
    await delay(300);
    const retro = this.retrospectivesStore.find((r) => r.sprintId === sprintId);
    if (!retro) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Retrospective not found for this sprint' },
      };
    }
    return { success: true, data: retro };
  }

  async addRetroAttendee(
    _retroId: string,
    attendeeData: { name: string; email?: string; role: string; attended: boolean }
  ): Promise<ApiResponse<RetroAttendee>> {
    await delay(300);
    const newAttendee: RetroAttendee = {
      id: `retro-attendee-${Date.now()}`,
      name: attendeeData.name,
      email: attendeeData.email,
      role: attendeeData.role,
      attended: attendeeData.attended,
    };
    return { success: true, data: newAttendee };
  }

  async updateRetroAttendee(
    _attendeeId: string,
    attendeeData: { name?: string; email?: string; role?: string; attended?: boolean }
  ): Promise<ApiResponse<RetroAttendee>> {
    await delay(300);
    return {
      success: true,
      data: {
        id: _attendeeId,
        name: attendeeData.name ?? 'Updated',
        role: attendeeData.role ?? 'stakeholder',
        attended: attendeeData.attended ?? false,
      },
    };
  }

  async deleteRetroAttendee(_attendeeId: string): Promise<ApiResponse<{ message: string }>> {
    await delay(300);
    return { success: true, data: { message: 'Attendee deleted' } };
  }

  // ==================== Sprint Backlog Management ====================

  async getAvailablePBIsForSprint(teamId: string): Promise<ApiResponse<ProductBacklogItem[]>> {
    await delay(300);
    const available = mockProductBacklogItems.filter(
      (p) =>
        p.teamId === teamId &&
        (p.status === ItemStatus.NEW ||
          p.status === ItemStatus.REFINED ||
          p.status === ItemStatus.READY)
    );
    return { success: true, data: available };
  }

  async getSprintBacklogChanges(
    _sprintId: string,
    _limit?: number
  ): Promise<ApiResponse<BacklogChange[]>> {
    await delay(300);
    return { success: true, data: [] };
  }

  async addPBIToSprint(
    _sprintId: string,
    _pbiId: string,
    _reason: string,
    _goalImpact: SprintGoalImpact
  ): Promise<ApiResponse<SprintBacklogChangeResult>> {
    await delay(400);
    const pending = _goalImpact === 'ENDANGERS_GOAL';
    return {
      success: true,
      data: {
        sprintBacklogItem: pending
          ? null
          : {
              id: `sbi-${Date.now()}`,
              sprintId: _sprintId,
              pbiId: _pbiId,
              addedAt: new Date().toISOString(),
            },
        pending,
        change: {
          id: `change-${Date.now()}`,
          sprintId: _sprintId,
          pbiId: _pbiId,
          changeType: 'ADDED' as const,
          reason: _reason,
          goalImpact: _goalImpact,
          approvalStatus: pending ? ('PENDING' as const) : ('APPLIED' as const),
          changedBy: 'mock-user',
          changedAt: new Date().toISOString(),
        },
      },
    };
  }

  async acknowledgeSprintBacklogChange(
    _sprintId: string,
    _changeId: string,
    payload: AcknowledgeSprintBacklogChangeRequest
  ): Promise<ApiResponse<AcknowledgeSprintBacklogChangeResult>> {
    await delay(400);
    const applied = payload.decision === 'APPROVE';
    const sprint = mockSprints.find((entry) => entry.id === _sprintId);
    return {
      success: true,
      data: {
        applied,
        sprint:
          applied && sprint
            ? { ...sprint, sprintGoal: payload.sprintGoal ?? sprint.sprintGoal }
            : null,
        change: {
          id: _changeId,
          sprintId: _sprintId,
          pbiId: 'mock-pbi',
          changeType: 'ADDED' as const,
          reason: 'Mock change',
          goalImpact: 'ENDANGERS_GOAL' as const,
          approvalStatus: applied ? ('APPLIED' as const) : ('REJECTED' as const),
          acknowledgementNote: payload.note,
          changedBy: 'mock-user',
          changedAt: new Date().toISOString(),
        },
      },
    };
  }

  async removePBIFromSprint(
    _sprintId: string,
    _pbiId: string,
    _taskAction: 'delete' | 'return_to_backlog' | 'keep_in_sprint',
    _reason: string,
    _goalImpact: SprintGoalImpact
  ): Promise<ApiResponse<SprintBacklogChangeResult>> {
    await delay(400);
    const pending = _goalImpact === 'ENDANGERS_GOAL';
    return {
      success: true,
      data: {
        sprintBacklogItem: null,
        pending,
        change: {
          id: `change-${Date.now()}`,
          sprintId: _sprintId,
          pbiId: _pbiId,
          changeType: 'REMOVED' as const,
          reason: _reason,
          goalImpact: _goalImpact,
          approvalStatus: pending ? ('PENDING' as const) : ('APPLIED' as const),
          changedBy: 'mock-user',
          changedAt: new Date().toISOString(),
          taskAction: _taskAction,
        },
      },
    };
  }

  async getPendingRetroActionItems(teamId: string): Promise<ApiResponse<RetroActionItem[]>> {
    await delay(300);
    const pendingItems: RetroActionItem[] = [];
    this.retrospectivesStore
      .filter((r) => r.teamId === teamId)
      .forEach((retro) => {
        retro.actionItems
          .filter((a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS')
          .forEach((item) => pendingItems.push(item));
      });
    return { success: true, data: pendingItems };
  }

  async getPendingAdjustments(_teamId: string): Promise<ApiResponse<BacklogAdjustment[]>> {
    await delay(300);
    // Mock data flow disabled: return no pending adjustments so the "Pending
    // Adjustments" section is hidden.
    return { success: true, data: [] };
  }

  async markAdjustmentImplemented(_adjustmentId: string): Promise<ApiResponse<BacklogAdjustment>> {
    await delay(300);
    return {
      success: true,
      data: {
        id: _adjustmentId,
        reviewId: '',
        action: 'modify',
        description: 'Implemented',
        reason: '',
        implemented: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async getPendingFeedback(_teamId: string): Promise<ApiResponse<StakeholderFeedback[]>> {
    await delay(300);
    // Mock data flow disabled: return no pending feedback so the "Pending
    // Feedback" section is hidden.
    return { success: true, data: [] };
  }

  async markFeedbackAddressed(_feedbackId: string): Promise<ApiResponse<StakeholderFeedback>> {
    await delay(300);
    return {
      success: true,
      data: {
        id: _feedbackId,
        reviewId: '',
        authorName: 'Anonymous',
        content: '',
        category: 'positive',
        actionRequired: false,
        actionTaken: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async deleteImpediment(_id: string, _teamId: string): Promise<ApiResponse<never>> {
    await delay(300);
    return { success: true };
  }

  async getTasksByPbiId(pbiId: string): Promise<ApiResponse<Task[]>> {
    await delay(300);
    const tasks = mockTasks.filter((t) => t.pbiId === pbiId);
    return { success: true, data: this.attachParentPbi(tasks) };
  }

  async getDoRVerificationsForPBI(
    _pbiId: string
  ): Promise<ApiResponse<DoRChecklistVerification[]>> {
    await delay(300);
    return { success: true, data: [] };
  }

  async updateTeam(_id: string, _teamData: Partial<Team>): Promise<ApiResponse<Team>> {
    await delay(400);
    const team = mockTeams.find((t) => t.id === _id);
    if (!team) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } };
    }
    return { success: true, data: { ...team, ..._teamData, updatedAt: new Date().toISOString() } };
  }

  async deleteTeam(_id: string): Promise<ApiResponse<null>> {
    await delay(300);
    return { success: true };
  }

  // ==================== Notification Config ====================

  async getNotificationConfig(): Promise<
    ApiResponse<{
      emailEnabled: boolean;
      pushEnabled: boolean;
      slackEnabled: boolean;
      digestFrequency: string;
    }>
  > {
    await mockDelay(200);
    return mockSuccess({
      emailEnabled: true,
      pushEnabled: false,
      slackEnabled: true,
      digestFrequency: 'daily',
    });
  }

  // ==================== Notifications ====================

  private notificationsStore: AppNotification[] = [
    {
      id: 'notif-1',
      userId: 'user-1',
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: 'You have been assigned to "Implement login feature"',
      data: { taskId: 'task-1', pbiId: 'pbi-1' },
      isRead: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      userId: 'user-1',
      type: 'system',
      title: 'Team Invitation',
      message: 'You have been invited to join "Alpha Team"',
      data: { teamId: 'team-1', teamName: 'Alpha Team' },
      isRead: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'notif-3',
      userId: 'user-1',
      type: 'impediment',
      title: 'Impediment Assigned',
      message: 'You have been assigned to resolve impediment "Database connection issue"',
      data: { impedimentId: 'impediment-1' },
      isRead: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'notif-4',
      userId: 'user-1',
      type: 'system',
      title: 'Daily Update Reminder',
      message: 'Remember to submit your daily update for Sprint-2603',
      data: { sprintId: 'sprint-1' },
      isRead: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'notif-5',
      userId: 'user-1',
      type: 'direct_message',
      title: 'Direct Message from John Doe',
      message: 'Hey, can you review my pull request when you get a chance?',
      data: { senderId: 'user-2', senderName: 'John Doe' },
      isRead: true,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'notif-6',
      userId: 'user-1',
      type: 'sprint_update',
      title: 'Sprint Started',
      message: 'Sprint-2603 has started',
      data: { sprintId: 'sprint-1' },
      isRead: false,
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
  ];

  async getNotifications(): Promise<
    ApiResponse<{
      notifications: AppNotification[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
      unreadCount: number;
    }>
  > {
    await mockDelay(300);
    const unreadCount = this.notificationsStore.filter((n) => !n.isRead).length;
    return mockSuccess({
      notifications: [...this.notificationsStore],
      pagination: {
        page: 1,
        limit: 10,
        total: this.notificationsStore.length,
        totalPages: 1,
      },
      unreadCount,
    });
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number; lastCheckedAt: string }>> {
    await mockDelay(100);
    const count = this.notificationsStore.filter((n) => !n.isRead).length;
    return mockSuccess({ count, lastCheckedAt: new Date().toISOString() });
  }

  async markAsRead(id: string): Promise<ApiResponse<AppNotification>> {
    await mockDelay(200);
    const notif = this.notificationsStore.find((n) => n.id === id);
    if (!notif) {
      return mockError('NOT_FOUND', 'Notification not found');
    }
    notif.isRead = true;
    return mockSuccess({ ...notif });
  }

  async markAllAsRead(): Promise<ApiResponse<{ count: number }>> {
    await mockDelay(200);
    let count = 0;
    this.notificationsStore.forEach((n) => {
      if (!n.isRead) {
        n.isRead = true;
        count++;
      }
    });
    return mockSuccess({ count });
  }

  async deleteNotification(id: string): Promise<ApiResponse<never>> {
    await mockDelay(200);
    const index = this.notificationsStore.findIndex((n) => n.id === id);
    if (index === -1) {
      return mockError('NOT_FOUND', 'Notification not found');
    }
    this.notificationsStore.splice(index, 1);
    return mockSuccess(undefined as never);
  }

  async sendDirectMessage(data: {
    recipientId: string;
    message: string;
  }): Promise<ApiResponse<{ success: boolean }>> {
    await mockDelay(300);
    const newNotification: AppNotification = {
      id: `notif-${Date.now()}`,
      userId: data.recipientId,
      type: 'direct_message',
      title: 'New Message',
      message: data.message,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.notificationsStore.push(newNotification);
    return mockSuccess({ success: true });
  }

  // ==================== Workflow ====================

  private workflowStatesStore: Record<string, WorkflowState[]> = {
    ProductBacklogItem: [
      {
        id: 'state-1',
        workflowId: 'workflow-pbi',
        name: 'NEW',
        displayName: 'New',
        orderIndex: 0,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-2',
        workflowId: 'workflow-pbi',
        name: 'REFINED',
        displayName: 'Refined',
        orderIndex: 1,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-3',
        workflowId: 'workflow-pbi',
        name: 'READY',
        displayName: 'Ready',
        orderIndex: 2,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-4',
        workflowId: 'workflow-pbi',
        name: 'IN_PROGRESS',
        displayName: 'In Progress',
        orderIndex: 3,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-5',
        workflowId: 'workflow-pbi',
        name: 'DONE',
        displayName: 'Done',
        orderIndex: 4,
        isFinal: true,
        createdAt: new Date().toISOString(),
      },
    ],
    Task: [
      {
        id: 'state-10',
        workflowId: 'workflow-task',
        name: 'TODO',
        displayName: 'To Do',
        orderIndex: 0,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-11',
        workflowId: 'workflow-task',
        name: 'IN_PROGRESS',
        displayName: 'In Progress',
        orderIndex: 1,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-12',
        workflowId: 'workflow-task',
        name: 'DONE',
        displayName: 'Done',
        orderIndex: 2,
        isFinal: true,
        createdAt: new Date().toISOString(),
      },
    ],
    Impediment: [
      {
        id: 'state-20',
        workflowId: 'workflow-impediment',
        name: 'OPEN',
        displayName: 'Open',
        orderIndex: 0,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-21',
        workflowId: 'workflow-impediment',
        name: 'IN_PROGRESS',
        displayName: 'In Progress',
        orderIndex: 1,
        isFinal: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'state-22',
        workflowId: 'workflow-impediment',
        name: 'RESOLVED',
        displayName: 'Resolved',
        orderIndex: 2,
        isFinal: true,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  private workflowTransitionsStore: Record<string, WorkflowTransition[]> = {
    ProductBacklogItem: [
      { id: 'trans-1', entityType: 'ProductBacklogItem', fromState: 'NEW', toState: 'REFINED' },
      { id: 'trans-2', entityType: 'ProductBacklogItem', fromState: 'REFINED', toState: 'READY' },
      {
        id: 'trans-3',
        entityType: 'ProductBacklogItem',
        fromState: 'READY',
        toState: 'IN_PROGRESS',
      },
      {
        id: 'trans-4',
        entityType: 'ProductBacklogItem',
        fromState: 'IN_PROGRESS',
        toState: 'DONE',
      },
    ],
    Task: [
      { id: 'trans-10', entityType: 'Task', fromState: 'TODO', toState: 'IN_PROGRESS' },
      { id: 'trans-11', entityType: 'Task', fromState: 'IN_PROGRESS', toState: 'DONE' },
    ],
    Impediment: [
      { id: 'trans-20', entityType: 'Impediment', fromState: 'OPEN', toState: 'IN_PROGRESS' },
      { id: 'trans-21', entityType: 'Impediment', fromState: 'IN_PROGRESS', toState: 'RESOLVED' },
    ],
  };

  private statusChangeHistoryStore: Array<{
    id: string;
    entityType: string;
    entityId: string;
    fromStatus: string;
    toStatus: string;
    changedBy: string;
    changedAt: string;
  }> = [
    {
      id: 'history-1',
      entityType: 'ProductBacklogItem',
      entityId: 'pbi-001',
      fromStatus: 'NEW',
      toStatus: 'REFINED',
      changedBy: 'user-1',
      changedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  async getWorkflowStates(entityType: string): Promise<ApiResponse<WorkflowState[]>> {
    await mockDelay(200);
    const states = this.workflowStatesStore[entityType] ?? [];
    return mockSuccess(states);
  }

  async getAllowedTransitions(
    entityType: string,
    fromStatus: string
  ): Promise<ApiResponse<string[]>> {
    await mockDelay(200);
    const transitions = this.workflowTransitionsStore[entityType] ?? [];
    const allowed = transitions.filter((t) => t.fromState === fromStatus).map((t) => t.toState);
    return mockSuccess(allowed);
  }

  async getWorkflowTransitions(entityType: string): Promise<ApiResponse<WorkflowTransition[]>> {
    await mockDelay(200);
    const transitions = this.workflowTransitionsStore[entityType] ?? [];
    return mockSuccess(transitions);
  }

  async getWorkflowByEntityType(
    entityType: string
  ): Promise<ApiResponse<{ states: WorkflowState[]; transitions: WorkflowTransition[] }>> {
    await mockDelay(200);
    return mockSuccess({
      states: this.workflowStatesStore[entityType] ?? [],
      transitions: this.workflowTransitionsStore[entityType] ?? [],
    });
  }

  async validateTransition(
    entityType: string,
    _entityId: string,
    fromStatus: string,
    toStatus: string
  ): Promise<ApiResponse<{ valid: boolean; message?: string }>> {
    await mockDelay(200);
    const transitions = this.workflowTransitionsStore[entityType] ?? [];
    const isValid = transitions.some((t) => t.fromState === fromStatus && t.toState === toStatus);
    if (isValid) {
      return mockSuccess({ valid: true });
    }
    return mockSuccess({
      valid: false,
      message: i18n.t('validation.workflow.transitionNotAllowed' as never, {
        fromStatus,
        toStatus,
      }) as string,
    });
  }

  async getWorkflowStatusChangeHistory(
    entityType: string,
    entityId: string
  ): Promise<
    ApiResponse<
      Array<{
        id: string;
        entityType: string;
        entityId: string;
        fromStatus: string;
        toStatus: string;
        changedBy: string;
        changedAt: string;
      }>
    >
  > {
    await mockDelay(200);
    const history = this.statusChangeHistoryStore.filter(
      (h) => h.entityType === entityType && h.entityId === entityId
    );
    return mockSuccess(history);
  }

  // ==================== Data Export ====================

  private exportStore: Map<
    string,
    {
      status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
      progress: number;
      downloadUrl?: string;
      createdAt: string;
      completedAt?: string;
      expiresAt?: string;
      error?: string;
      fileSize?: number;
    }
  > = new Map();

  async initiateExport(_options?: {
    includeSessions?: boolean;
    includeNotifications?: boolean;
    dataCategories?: string[];
  }): Promise<
    ApiResponse<{
      jobId: string;
      status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
      estimatedCompletionTime: string;
      message: string;
    }>
  > {
    await mockDelay(500);
    const jobId = `export-${Date.now()}`;
    const now = new Date();
    const estimatedCompletion = new Date(now.getTime() + 30 * 1000);

    this.exportStore.set(jobId, {
      status: 'processing',
      progress: 0,
      createdAt: now.toISOString(),
    });

    setTimeout(() => {
      const exp = this.exportStore.get(jobId);
      if (exp?.status === 'processing') {
        exp.status = 'completed';
        exp.progress = 100;
        exp.downloadUrl = `/mock-exports/${jobId}.zip`;
        exp.completedAt = new Date().toISOString();
        exp.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        exp.fileSize = 1024 * 256;
      }
    }, 5000);

    return mockSuccess({
      jobId,
      status: 'processing',
      estimatedCompletionTime: estimatedCompletion.toISOString(),
      message: 'Data export initiated successfully',
    });
  }

  async getExportStatus(jobId: string): Promise<
    ApiResponse<{
      jobId: string;
      status: string;
      progress: number;
      fileSize: number | null;
      completedAt: string | null;
      expiresAt: string | null;
      errorMessage: string | null;
    }>
  > {
    await mockDelay(200);
    const exp = this.exportStore.get(jobId);
    if (!exp) {
      return mockError('NOT_FOUND', 'Export not found');
    }
    return mockSuccess({
      jobId,
      status: exp.status,
      progress: exp.progress,
      fileSize: exp.fileSize ?? null,
      completedAt: exp.completedAt ?? null,
      expiresAt: exp.expiresAt ?? null,
      errorMessage: exp.error ?? null,
    });
  }

  async downloadExport(jobId: string): Promise<Blob> {
    await mockDelay(300);
    const exp = this.exportStore.get(jobId);
    if (!exp) {
      throw new Error('Export not found');
    }
    if (exp.status !== 'completed') {
      throw new Error('Export is not ready for download');
    }
    const mockData = {
      exportMetadata: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        userId: UUIDS.users.admin,
        format: 'JSON',
        dataController: 'Scrumooth',
        contactEmail: 'privacy@scrumooth.com',
        exportId: jobId,
      },
      dataCategories: ['profile', 'teams', 'tasks', 'notifications'],
      recordCounts: {
        profile: 1,
        teams: 2,
        tasks: 50,
        notifications: 25,
      },
    };
    return new Blob([JSON.stringify(mockData, null, 2)], {
      type: 'application/json',
    });
  }

  async cancelExport(jobId: string): Promise<void> {
    await mockDelay(200);
    const exp = this.exportStore.get(jobId);
    if (!exp) {
      throw new Error('Export not found');
    }
    if (exp.status === 'completed') {
      throw new Error('Cannot cancel a completed export');
    }
    this.exportStore.delete(jobId);
  }

  async getActiveExports(): Promise<
    ApiResponse<{
      exports: Array<{
        jobId: string;
        status: string;
        startedAt: string;
        createdAt: string;
      }>;
      count: number;
    }>
  > {
    await mockDelay(200);
    const active = Array.from(this.exportStore.entries())
      .filter(([_, v]) => v.status === 'processing')
      .map(([k, v]) => ({
        jobId: k,
        status: v.status,
        startedAt: v.createdAt,
        createdAt: v.createdAt,
      }));
    return mockSuccess({
      exports: active,
      count: active.length,
    });
  }

  // ==================== Consent Management ====================

  async recordConsent(data: {
    consentType: string;
    granted: boolean;
  }): Promise<ApiResponse<ConsentRecord>> {
    await mockDelay(300);
    const record: ConsentRecord = {
      id: `consent-${Date.now()}`,
      userId: 'user-1', // Mock current user
      consentType: data.consentType as ConsentRecord['consentType'],
      granted: data.granted,
      grantedAt: data.granted ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };
    this.consentStore.push(record);
    return mockSuccess(record);
  }

  async getConsentHistory(): Promise<ApiResponse<ConsentRecord[]>> {
    await mockDelay(300);
    return mockSuccess([...this.consentStore]);
  }

  async getLatestConsent(): Promise<ApiResponse<ConsentRecord | null>> {
    await mockDelay(200);
    const latest =
      this.consentStore.length > 0 ? this.consentStore[this.consentStore.length - 1] : null;
    return mockSuccess(latest ?? null);
  }

  async withdrawConsent(): Promise<ApiResponse<{ message: string }>> {
    await mockDelay(300);
    this.consentStore.forEach((c) => {
      if (c.granted) {
        c.granted = false;
        c.withdrawnAt = new Date().toISOString();
      }
    });
    return mockSuccess({ message: 'Consent withdrawn successfully' });
  }

  async getAnonymousConsent(consentId: string): Promise<ApiResponse<ConsentRecord | null>> {
    await mockDelay(200);
    const consent = this.consentStore.find((c) => c.id === consentId) ?? null;
    return mockSuccess(consent);
  }

  // ==================== Generic HTTP Methods ====================
  // These methods route requests to specific mock implementations

  // ==================== Timebox mock methods ====================

  private timeboxKey(eventType: string, sprintId?: string): string {
    return `${eventType}:${sprintId ?? 'no-sprint'}`;
  }

  /**
   * Derive the timebox cap for an event using the same strict linear scale as
   * the backend (`timeboxFor`): sprint length in weeks scales the one-month
   * maximum proportionally. No hardcoded per-week values.
   */
  private timeboxSecondsFor(eventType: string, sprintId?: string): number {
    // Resolve weeks from either a materialized Sprint or a GeneratedSprint,
    // mirroring the backend's `resolveSprintId` + `toState`. The Planning page
    // selects sprints by their GeneratedSprint id, so both lookups are needed.
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (sprintId) {
      const sprint = mockSprints.find((s) => s.id === sprintId);
      if (sprint) {
        startDate = sprint.startDate;
        endDate = sprint.endDate;
      } else {
        const generated = this.generatedSprintsStore.find((s) => s.id === sprintId);
        if (generated) {
          startDate = generated.startDate;
          endDate = generated.endDate;
        }
      }
    }

    let weeks = 4;
    if (startDate && endDate) {
      const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
      weeks = Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
    }
    return timeboxFor(eventType as ScrumEvent, weeks);
  }

  /**
   * Accept the same `TimeboxQuery` shape as the real `timeboxService` so the
   * swapped `apiService` (mock in dev) is a drop-in replacement. Sprint length
   * (and therefore the max `timeboxSeconds`) is derived from the sprint's dates.
   */
  async getTimebox(
    eventType: string,
    query: TimeboxQuery = {}
  ): Promise<ApiResponse<TimeboxState>> {
    await delay(200);
    const sprintId = query.sprintId;
    const key = this.timeboxKey(eventType, sprintId);
    const now = Date.now();
    const timeboxSeconds = this.timeboxSecondsFor(eventType, sprintId);

    const existing = this.timeboxStore[key];
    if (!existing) {
      const state: TimeboxState = {
        teamId: query.teamId ?? 'team-1',
        eventType,
        sprintId: sprintId ?? null,
        date: new Date().toISOString(),
        status: 'IDLE',
        elapsedMs: 0,
        timeboxSeconds,
        version: 0,
      };
      this.timeboxStore[key] = state;
      return { success: true, data: state };
    }

    const elapsedMs =
      existing.status === 'RUNNING'
        ? existing.elapsedMs + (now - (existing.lastTick ?? now))
        : existing.elapsedMs;
    this.timeboxStore[key] = { ...existing, elapsedMs, lastTick: now };
    return { success: true, data: this.timeboxStore[key] };
  }

  async startTimebox(
    eventType: string,
    query: TimeboxQuery = {}
  ): Promise<ApiResponse<TimeboxState>> {
    await delay(200);
    const sprintId = query.sprintId;
    const key = this.timeboxKey(eventType, sprintId);
    const state = await this.getTimebox(eventType, query);
    const current = state.data ?? {
      teamId: query.teamId ?? 'team-1',
      eventType,
      sprintId: sprintId ?? null,
      date: new Date().toISOString(),
      status: 'IDLE',
      elapsedMs: 0,
      timeboxSeconds: this.timeboxSecondsFor(eventType, sprintId),
      version: 0,
    };
    const running: TimeboxState = {
      ...current,
      status: 'RUNNING',
      version: current.version + 1,
    };
    this.timeboxStore[key] = { ...running, lastTick: Date.now() };
    return { success: true, data: running };
  }

  async pauseTimebox(
    eventType: string,
    query: TimeboxQuery = {}
  ): Promise<ApiResponse<TimeboxState>> {
    await delay(200);
    const key = this.timeboxKey(eventType, query.sprintId);
    const current = this.timeboxStore[key];
    if (!current) {
      const state: TimeboxState = {
        teamId: query.teamId ?? 'team-1',
        eventType,
        sprintId: query.sprintId ?? null,
        date: new Date().toISOString(),
        status: 'PAUSED',
        elapsedMs: 0,
        timeboxSeconds: this.timeboxSecondsFor(eventType, query.sprintId),
        version: 1,
      };
      this.timeboxStore[key] = { ...state, lastTick: Date.now() };
      return { success: true, data: state };
    }
    const elapsedMs =
      current.status === 'RUNNING'
        ? current.elapsedMs + (Date.now() - (current.lastTick ?? Date.now()))
        : current.elapsedMs;
    const paused: TimeboxState = {
      teamId: current.teamId,
      eventType,
      sprintId: current.sprintId,
      date: current.date,
      status: 'PAUSED',
      elapsedMs,
      timeboxSeconds: current.timeboxSeconds,
      version: current.version + 1,
    };
    this.timeboxStore[key] = { ...paused, lastTick: Date.now() };
    return { success: true, data: paused };
  }

  async resetTimebox(
    eventType: string,
    query: TimeboxQuery = {}
  ): Promise<ApiResponse<TimeboxState>> {
    await delay(200);
    const sprintId = query.sprintId;
    const key = this.timeboxKey(eventType, sprintId);
    const state: TimeboxState = {
      teamId: query.teamId ?? 'team-1',
      eventType,
      sprintId: sprintId ?? null,
      date: new Date().toISOString(),
      status: 'IDLE',
      elapsedMs: 0,
      timeboxSeconds: this.timeboxSecondsFor(eventType, sprintId),
      version: (this.timeboxStore[key]?.version ?? 0) + 1,
    };
    this.timeboxStore[key] = { ...state, lastTick: Date.now() };
    return { success: true, data: state };
  }

  async concludeTimebox(
    eventType: string,
    query: TimeboxQuery = {}
  ): Promise<ApiResponse<TimeboxState>> {
    await delay(200);
    const sprintId = query.sprintId;
    const key = this.timeboxKey(eventType, sprintId);
    const current = this.timeboxStore[key];
    const elapsedMs = current
      ? current.status === 'RUNNING'
        ? current.elapsedMs + (Date.now() - (current.lastTick ?? Date.now()))
        : current.elapsedMs
      : 0;
    const state: TimeboxState = {
      teamId: query.teamId ?? 'team-1',
      eventType,
      sprintId: sprintId ?? null,
      date: new Date().toISOString(),
      status: 'PAUSED',
      elapsedMs,
      timeboxSeconds: this.timeboxSecondsFor(eventType, sprintId),
      version: (current?.version ?? 0) + 1,
    };
    this.timeboxStore[key] = { ...state, lastTick: Date.now() };
    return { success: true, data: state };
  }

  async get<T>(url: string, _config?: { params?: Record<string, unknown> }): Promise<{ data: T }> {
    await mockDelay(200);

    // Route timebox read requests
    if (url.startsWith('/timeboxes/')) {
      const eventType = url.split('/')[2] ?? '';
      const params = (_config?.params as { teamId?: string; sprintId?: string } | undefined) ?? {};
      const result = await this.getTimebox(eventType, params);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route definition of done requests
    if (url.includes('/definition-of-done') && !url.includes('/history')) {
      const parts = url.split('/');
      const teamId = parts[2] ?? '';
      const result = await this.getDefinitionOfDone(teamId);
      return { data: { success: result.success, data: result.data } as T };
    }

    if (url.includes('/definition-of-done/history')) {
      const parts = url.split('/');
      const teamId = parts[2] ?? '';
      const result = await this.getDoDHistory(teamId);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route definition of ready requests
    if (url.includes('/definition-of-ready') && !url.includes('/history')) {
      const parts = url.split('/');
      const teamId = parts[2] ?? '';
      const result = await this.getDefinitionOfReady(teamId);
      return { data: { success: result.success, data: result.data } as T };
    }

    if (url.includes('/definition-of-ready/history')) {
      const parts = url.split('/');
      const teamId = parts[2] ?? '';
      const result = await this.getDoRHistory(teamId);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route notification requests
    if (url === '/config/notifications') {
      const result = await this.getNotificationConfig();
      return { data: { success: result.success, data: result.data } as T };
    }

    if (url.startsWith('/notifications?')) {
      const result = await this.getNotifications();
      return { data: { success: result.success, data: result.data } as T };
    }

    if (url === '/notifications/unread-count') {
      const result = await this.getUnreadCount();
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route data export requests
    if (url === '/user/export-data/active') {
      const result = await this.getActiveExports();
      return { data: { success: result.success, data: result.data } as T };
    }

    if (url.startsWith('/user/export-data/status/')) {
      const jobId = url.split('/').pop() ?? '';
      const result = await this.getExportStatus(jobId);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Default: return empty success response
    return { data: { success: true } as T };
  }

  async put<T>(_url: string, data?: unknown): Promise<{ data: T }> {
    await mockDelay(200);

    // Route definition of done update
    if (_url.includes('/definition-of-done')) {
      const parts = _url.split('/');
      const teamId = parts[2] ?? '';
      const typedData = data as { items?: DoDItem[] } | undefined;
      const items = typedData?.items ?? [];
      const result = await this.updateDefinitionOfDone(teamId, items);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route definition of ready update
    if (_url.includes('/definition-of-ready')) {
      const parts = _url.split('/');
      const teamId = parts[2] ?? '';
      const typedData = data as { items?: DoRItem[] } | undefined;
      const items = typedData?.items ?? [];
      const result = await this.updateDefinitionOfReady(teamId, items);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Default: return empty success response
    return { data: { success: true } as T };
  }

  async post<T>(_url: string, data?: unknown): Promise<{ data: T }> {
    await mockDelay(200);

    // Route timebox control requests
    if (_url.startsWith('/timeboxes/')) {
      const segments = _url.split('/');
      const eventType = segments[2] ?? '';
      const action = segments[3];
      const body = (data as { teamId?: string; sprintId?: string } | undefined) ?? {};
      let result: ApiResponse<TimeboxState>;
      if (action === 'start') {
        result = await this.startTimebox(eventType, body);
      } else if (action === 'pause') {
        result = await this.pauseTimebox(eventType, body);
      } else if (action === 'reset') {
        result = await this.resetTimebox(eventType, body);
      } else if (action === 'conclude') {
        result = await this.concludeTimebox(eventType, body);
      } else {
        result = await this.getTimebox(eventType, body);
      }
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route data export requests
    if (_url === '/user/export-data') {
      const options = data as
        | {
            options?: {
              includeSessions?: boolean;
              includeNotifications?: boolean;
              dataCategories?: string[];
            };
          }
        | undefined;
      const result = await this.initiateExport(options?.options);
      return { data: { success: result.success, data: result.data } as T };
    }

    // Route notification requests
    if (typeof data === 'object' && data !== null && 'recipientId' in data) {
      const result = await this.sendDirectMessage(data as { recipientId: string; message: string });
      return {
        data: {
          success: result.success,
          data: { notification: this.notificationsStore[this.notificationsStore.length - 1] },
        } as T,
      };
    }

    // Default: return empty success response
    return { data: { success: true } as T };
  }

  async patch<T>(_url: string, _data?: unknown): Promise<{ data: T }> {
    await mockDelay(200);

    // Route notification requests
    if (_url.includes('/read') && !_url.includes('mark-all')) {
      const id = _url.split('/')[2];
      if (id) {
        const result = await this.markAsRead(id);
        return { data: { success: result.success, data: { notification: result.data } } as T };
      }
    }

    if (_url.includes('mark-all-read')) {
      const result = await this.markAllAsRead();
      return {
        data: { success: result.success, data: { updatedCount: result.data?.count ?? 0 } } as T,
      };
    }

    // Default: return empty success response
    return { data: { success: true } as T };
  }

  async delete<T = never>(_url: string): Promise<{ data: T }> {
    await mockDelay(200);

    // Route data export cancel requests
    if (
      _url.startsWith('/user/export-data/') &&
      !_url.includes('/status/') &&
      !_url.includes('/download/') &&
      !_url.includes('/active')
    ) {
      const jobId = _url.split('/').pop() ?? '';
      await this.cancelExport(jobId);
      return { data: { success: true } as T };
    }

    // Route notification requests
    if (_url.startsWith('/notifications/')) {
      const id = _url.split('/')[2];
      if (id) {
        await this.deleteNotification(id);
      }
    }

    // Default: return empty success response
    return { data: { success: true } as T };
  }
}

export const mockApiService = new MockApiService();
