/**
 * Query Key Factory
 *
 * Centralized query key management for React Query.
 * Follows the factory pattern for type-safe, maintainable query keys.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */

export const queryKeys = {
  // Sprint-related queries
  sprint: {
    all: ['sprints'] as const,
    lists: () => [...queryKeys.sprint.all, 'list'] as const,
    list: (filters: { teamId?: string; status?: string } = {}) =>
      [...queryKeys.sprint.lists(), filters] as const,
    details: () => [...queryKeys.sprint.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.sprint.details(), id] as const,
    active: (teamId: string) => [...queryKeys.sprint.all, 'active', teamId] as const,
    activeSprint: (teamId: string) => [...queryKeys.sprint.all, 'activeSprint', teamId] as const,
    stats: (sprintId: string) => [...queryKeys.sprint.detail(sprintId), 'stats'] as const,
  },

  // Standalone query keys used in specific contexts
  activeSprint: {
    all: ['activeSprint'] as const,
  },

  // Sprint Tasks queries
  sprintTasks: {
    all: ['sprintTasks'] as const,
    bySprint: (sprintId: string) => [...queryKeys.sprintTasks.all, sprintId] as const,
  },

  // Sprint Backlog Changes queries
  sprintBacklogChanges: {
    all: ['sprintBacklogChanges'] as const,
    bySprint: (sprintId: string) => [...queryKeys.sprintBacklogChanges.all, sprintId] as const,
  },

  // Available PBIs queries
  availablePBIs: {
    all: ['availablePBIs'] as const,
    bySprint: (sprintId: string) => [...queryKeys.availablePBIs.all, sprintId] as const,
  },

  // Task-related queries
  task: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.task.all, 'list'] as const,
    list: (filters: { sprintId?: string; assigneeId?: string; status?: string } = {}) =>
      [...queryKeys.task.lists(), filters] as const,
    details: () => [...queryKeys.task.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.task.details(), id] as const,
    bySprint: (sprintId: string) => [...queryKeys.task.lists(), { sprintId }] as const,
    history: (taskId: string) => [...queryKeys.task.detail(taskId), 'history'] as const,
  },

  // Burndown chart queries
  burndown: {
    all: ['burndown'] as const,
    bySprint: (sprintId: string) => [...queryKeys.burndown.all, sprintId] as const,
  },

  // Team-related queries
  team: {
    all: ['teams'] as const,
    lists: () => [...queryKeys.team.all, 'list'] as const,
    list: (filters: { search?: string; page?: number } = {}) =>
      [...queryKeys.team.lists(), filters] as const,
    details: () => [...queryKeys.team.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.team.details(), id] as const,
    members: (teamId: string) => [...queryKeys.team.detail(teamId), 'members'] as const,
    // Standalone keys matching actual query usage
    byId: (id: string | undefined) => ['team', id] as const,
  },

  // Definition of Done queries
  definitionOfDone: {
    all: ['definition-of-done'] as const,
    byTeam: (teamId: string) => [...queryKeys.definitionOfDone.all, teamId] as const,
  },

  // DoD Compliance queries
  dodCompliance: {
    all: ['dod-compliance'] as const,
    bySprint: (sprintId: string) => [...queryKeys.dodCompliance.all, sprintId] as const,
  },

  // Impediment queries
  impediment: {
    all: ['impediments'] as const,
    lists: () => [...queryKeys.impediment.all, 'list'] as const,
    list: (filters: { teamId?: string; status?: string } = {}) =>
      [...queryKeys.impediment.lists(), filters] as const,
    byTeam: (teamId: string) => [...queryKeys.impediment.lists(), { teamId }] as const,
  },

  // Product Backlog Item queries
  pbi: {
    all: ['pbi'] as const,
    lists: () => [...queryKeys.pbi.all, 'list'] as const,
    list: (filters: { teamId?: string; status?: string } = {}) =>
      [...queryKeys.pbi.lists(), filters] as const,
    byTeam: (teamId: string) => [...queryKeys.pbi.lists(), { teamId }] as const,
  },

  // Product Backlog queries (alias for pbi)
  productBacklog: {
    all: ['productBacklog'] as const,
    lists: () => [...queryKeys.productBacklog.all, 'list'] as const,
    list: (filters: { teamId?: string; status?: string; limit?: number } = {}) =>
      [...queryKeys.productBacklog.lists(), filters] as const,
    // Infinite query key for paginated backlog (different from regular list to avoid cache conflicts)
    infinite: (filters: { teamId?: string; limit?: number } = {}) =>
      [...queryKeys.productBacklog.all, 'infinite', filters] as const,
  },

  // Daily Scrum queries (team-level, goal-focused)
  dailyScrum: {
    all: ['daily-scrums'] as const,
    lists: () => [...queryKeys.dailyScrum.all, 'list'] as const,
    bySprint: (sprintId: string) => [...queryKeys.dailyScrum.lists(), { sprintId }] as const,
    bySprintAndDate: (sprintId: string, date: string) =>
      [...queryKeys.dailyScrum.bySprint(sprintId), { date }] as const,
    participation: (sprintId: string, date: string) =>
      [...queryKeys.dailyScrum.all, 'participation', { sprintId, date }] as const,
    /** The standing cadence, the team calendar and what the Sprint has recorded so far. */
    cadence: (sprintId: string, date: string) =>
      [...queryKeys.dailyScrum.all, 'cadence', { sprintId, date }] as const,
  },

  // Daily Scrum standing commitment (time, place, working-day calendar)
  dailyScrumSchedule: {
    all: ['daily-scrum-schedule'] as const,
    byTeam: (teamId: string) => [...queryKeys.dailyScrumSchedule.all, { teamId }] as const,
    nonWorkingDays: (teamId: string, from: string, to: string) =>
      [...queryKeys.dailyScrumSchedule.all, 'non-working-days', { teamId, from, to }] as const,
  },

  // Product Goal queries
  productGoal: {
    all: ['product-goals'] as const,
    lists: () => [...queryKeys.productGoal.all, 'list'] as const,
    list: (filters: { teamId?: string; status?: string } = {}) =>
      [...queryKeys.productGoal.lists(), filters] as const,
    details: () => [...queryKeys.productGoal.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.productGoal.details(), id] as const,
    active: (teamId: string) => [...queryKeys.productGoal.all, 'active', teamId] as const,
  },

  // Velocity queries
  velocity: {
    all: ['velocity'] as const,
    byTeam: (teamId: string) => [...queryKeys.velocity.all, teamId] as const,
    bySprint: (sprintId: string) => [...queryKeys.velocity.all, 'sprint', sprintId] as const,
  },

  // Metrics queries
  metrics: {
    all: ['metrics'] as const,
    sprint: (sprintId: string) => [...queryKeys.metrics.all, 'sprint', sprintId] as const,
    team: (teamId: string) => [...queryKeys.metrics.all, 'team', teamId] as const,
  },

  // Generated Sprint queries
  generatedSprint: {
    all: ['generated-sprints'] as const,
    lists: () => [...queryKeys.generatedSprint.all, 'list'] as const,
    list: (filters: { teamId?: string } = {}) =>
      [...queryKeys.generatedSprint.lists(), filters] as const,
    details: () => [...queryKeys.generatedSprint.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.generatedSprint.details(), id] as const,
    byTeam: (teamId: string | undefined) =>
      [...queryKeys.generatedSprint.lists(), { teamId }] as const,
  },

  // Team Status queries
  teamStatus: {
    all: ['teamStatus'] as const,
    byTeam: (teamId: string) => [...queryKeys.teamStatus.all, teamId] as const,
    bySprint: (sprintId: string) => [...queryKeys.teamStatus.all, 'sprint', sprintId] as const,
  },

  // My Teams queries
  myTeams: {
    all: ['my-teams'] as const,
  },

  // Retrospective queries
  retrospective: {
    all: ['retrospective'] as const,
    allList: ['retrospectives'] as const, // plural form used in list queries
    lists: () => [...queryKeys.retrospective.all, 'list'] as const,
    list: (teamId: string) => [...queryKeys.retrospective.lists(), teamId] as const,
    allByTeam: (teamId: string | undefined) => ['retrospectives', teamId] as const,
    bySprint: (sprintId: string | undefined) => ['retrospective', sprintId] as const,
    details: () => [...queryKeys.retrospective.all, 'detail'] as const,
    detail: (sprintId: string) => [...queryKeys.retrospective.details(), sprintId] as const,
  },

  // Sprint Configuration queries
  sprintConfiguration: {
    all: ['sprintConfiguration'] as const,
    byTeam: (teamId: string | undefined) => [...queryKeys.sprintConfiguration.all, teamId] as const,
  },

  // Sprint Review queries
  sprintReview: {
    all: ['sprint-reviews'] as const,
    byTeamAndSprint: (teamId: string | undefined, sprintId: string | undefined) =>
      [...queryKeys.sprintReview.all, teamId, sprintId] as const,
  },

  // Increment queries
  increment: {
    all: ['increments'] as const,
    lists: () => [...queryKeys.increment.all, 'list'] as const,
    list: (filters: { teamId?: string; sprintId?: string } = {}) =>
      [...queryKeys.increment.lists(), filters] as const,
    detail: (id: string) => ['increment', id] as const,
  },

  // Message queries
  message: {
    all: ['messages'] as const,
  },

  // Definition of Ready queries
  definitionOfReady: {
    all: ['definitionOfReady'] as const,
    byTeam: (teamId: string) => [...queryKeys.definitionOfReady.all, teamId] as const,
  },

  // Pending items queries
  pendingAdjustments: {
    all: ['pending-adjustments'] as const,
  },

  pendingFeedback: {
    all: ['pending-feedback'] as const,
  },

  pendingRetroActionItems: {
    all: ['pending-retro-action-items'] as const,
  },

  // Notification queries
  notification: {
    all: ['notifications'] as const,
  },

  // Status change history queries
  statusChangeHistory: {
    byEntity: (entityType: string, entityId: string) =>
      ['statusChangeHistory', entityType, entityId] as const,
  },

  // Scrum Values Health Check queries
  healthCheck: {
    all: ['health-check'] as const,
    latest: (teamId: string) => [...queryKeys.healthCheck.all, 'latest', teamId] as const,
    trend: (teamId: string) => [...queryKeys.healthCheck.all, 'trend', teamId] as const,
  },

  // Scrum event timebox queries
  timebox: {
    all: ['timebox'] as const,
    get: (event: string, sprintId: string, date?: string) =>
      [...queryKeys.timebox.all, event, sprintId, date] as const,
  },

  // Organizational barrier register (escalation beyond the team)
  barriers: {
    all: ['organizational-barriers'] as const,
    lists: () => [...queryKeys.barriers.all, 'list'] as const,
    list: (filters: { teamId?: string; status?: string; priority?: string } = {}) =>
      [...queryKeys.barriers.lists(), filters] as const,
    stats: (teamId: string) => [...queryKeys.barriers.all, 'stats', teamId] as const,
    escalatable: (teamId: string) => [...queryKeys.barriers.all, 'escalatable', teamId] as const,
    detail: (id: string) => [...queryKeys.barriers.all, 'detail', id] as const,
  },

  // Scrum Master notes revision history
  smNotesRevisions: {
    all: ['sm-notes-revisions'] as const,
    byEntity: (entityType: string, entityId: string) =>
      [...queryKeys.smNotesRevisions.all, entityType, entityId] as const,
  },

  // The Scrum Master's private coaching log
  coaching: {
    all: ['coaching-entries'] as const,
    byTeam: (teamId: string) => [...queryKeys.coaching.all, teamId] as const,
  },

  // The team's working agreements
  workingAgreement: {
    all: ['working-agreements'] as const,
    byTeam: (teamId: string) => [...queryKeys.workingAgreement.all, teamId] as const,
  },

  // The team-level cross-functionality assessment
  crossFunctionality: {
    all: ['cross-functionality'] as const,
    byTeam: (teamId: string) => [...queryKeys.crossFunctionality.all, teamId] as const,
  },

  // The groups the Scrum Teams share a product (and one Definition of Done) with
  teamGroup: {
    all: ['team-groups'] as const,
    directory: () => [...queryKeys.teamGroup.all, 'directory'] as const,
    detail: (groupId: string) => [...queryKeys.teamGroup.all, 'detail', groupId] as const,
    /** The shared Definition of Done of a group: what a team would adopt, and what it complies with. */
    sharedDoD: (groupId: string) => [...queryKeys.teamGroup.all, 'shared-dod', groupId] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
