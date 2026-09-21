/**
 * Returns a human-readable label for a user role.
 */
export function getRoleLabel(role: string | null): string {
  if (!role) return 'No Role';
  switch (role) {
    case 'PRODUCT_OWNER':
      return 'Product Owner';
    case 'SCRUM_MASTER':
      return 'Scrum Master';
    case 'DEVELOPERS':
      return 'Developers';
    default:
      return role;
  }
}

/**
 * Returns the CSS module class name for a role badge.
 * Accepts a styles object from a CSS module import.
 */
export function getRoleBadgeClass(role: string | null, styles: Record<string, string>): string {
  if (!role) return styles['badge-default'] ?? '';
  switch (role) {
    case 'PRODUCT_OWNER':
      return styles['badge-po'] ?? '';
    case 'SCRUM_MASTER':
      return styles['badge-sm'] ?? '';
    case 'DEVELOPERS':
      return styles['badge-dev'] ?? '';
    default:
      return styles['badge-default'] ?? '';
  }
}

/**
 * Returns a color string for role badges (used outside CSS module context).
 */
export function getRoleBadgeColor(role: string | null): string {
  if (!role) return '#6b7280';
  switch (role) {
    case 'PRODUCT_OWNER':
      return '#f59e0b';
    case 'SCRUM_MASTER':
      return '#3b82f6';
    case 'DEVELOPERS':
      return '#10b981';
    default:
      return '#6b7280';
  }
}

/**
 * Readiness inputs that determine whether a Sprint can be started.
 *
 * Starting a Sprint is no longer role-gated (any team member may do it). It is instead
 * gated on the Scrum Planning outputs being ready: a committed Sprint Goal AND a saved,
 * non-empty Sprint Backlog.
 */
export interface SprintStartReadiness {
  hasSprintGoal: boolean;
  hasSavedBacklog: boolean;
}

export function canStartSprint(readiness: SprintStartReadiness): boolean {
  return readiness.hasSprintGoal && readiness.hasSavedBacklog;
}

/**
 * Whether the given team role may mutate the Sprint Backlog on the Active Sprint Board.
 *
 * The Sprint Backlog is "a plan by and for the Developers" (Scrum Guide), so only
 * `DEVELOPERS`-role members may create/edit/delete/move tasks and manage the backlog.
 * PO/SM keep read-only inspection. The role may be uppercase (backend enum) or lowercase.
 */
export function canMutateSprintBacklog(role: string | null | undefined): boolean {
  return String(role ?? '').toLowerCase() === 'developers';
}

/**
 * Whether the given team role may cancel a Sprint.
 *
 * Only the Product Owner has authority to cancel a Sprint (Scrum Guide). The role may be
 * uppercase (backend enum) or lowercase.
 */
export function canCancelSprint(role: string | null | undefined): boolean {
  return String(role ?? '').toLowerCase() === 'product_owner';
}

/**
 * Whether the given team role may order the Product Backlog.
 *
 * "The Product Owner orders Product Backlog items" (Scrum Guide), so moving an item in the
 * backlog or changing its MoSCoW band is the Product Owner's call. The backend enforces this
 * with `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`; the interface mirrors it so the affordance is
 * not offered where it would be refused. The role may be uppercase (backend enum) or lowercase.
 */
export function canOrderBacklog(role: string | null | undefined): boolean {
  return String(role ?? '').toLowerCase() === 'product_owner';
}
