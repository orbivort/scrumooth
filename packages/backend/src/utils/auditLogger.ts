// Audit Logger for tracking security-relevant events
import { auditLogger } from './logger';
import { getRequestContext } from './requestContext';

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  /** ISO timestamp of the event */
  timestamp: string;
  /** Type of event (e.g., 'AUTH', 'USER', 'TEAM', 'SPRINT') */
  eventType: string;
  /** Action performed (e.g., 'LOGIN', 'CREATE', 'UPDATE', 'DELETE') */
  action: string;
  /** Actor who performed the action */
  actor: {
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  /** Resource affected by the action */
  resource: {
    type: string;
    id?: string;
    name?: string;
  };
  /** Result of the action */
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  /** Additional details about the event */
  details?: Record<string, unknown>;
}

/**
 * Log an audit event
 * @param entry - The audit log entry to record
 */
export const auditLog = (entry: Omit<AuditLogEntry, 'timestamp'>): void => {
  const context = getRequestContext();

  const auditEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    actor: {
      ...entry.actor,
      userId: entry.actor.userId ?? context?.userId,
    },
  };

  // Use dedicated audit logger for compliance separation
  auditLogger.info(`AUDIT: ${entry.eventType}.${entry.action}`, {
    audit: auditEntry,
    requestId: context?.requestId,
    teamId: context?.teamId,
  });
};

/**
 * Audit event types for common operations
 */
export const AuditEventTypes = {
  AUTH: 'AUTH',
  USER: 'USER',
  TEAM: 'TEAM',
  SPRINT: 'SPRINT',
  PROJECT: 'PROJECT',
  SESSION: 'SESSION',
  RETROSPECTIVE: 'RETROSPECTIVE',
  REPORTS: 'REPORTS',
} as const;

/**
 * Audit actions for common operations
 */
export const AuditActions = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  ASSIGN: 'ASSIGN',
  UNASSIGN: 'UNASSIGN',
} as const;

/**
 * Audit results
 */
export const AuditResults = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  DENIED: 'DENIED',
} as const;

/**
 * Helper function to create an audit log for authentication events
 */
export const auditAuthEvent = (
  action: string,
  result: 'SUCCESS' | 'FAILURE' | 'DENIED',
  details: {
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
  }
): void => {
  auditLog({
    eventType: AuditEventTypes.AUTH,
    action,
    actor: {
      userId: details.userId,
      email: details.email,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
    },
    resource: {
      type: 'SESSION',
    },
    result,
    details: details.reason ? { reason: details.reason } : undefined,
  });
};

/**
 * Helper function to create an audit log for resource operations
 */
export const auditResourceEvent = (
  eventType: string,
  action: string,
  result: 'SUCCESS' | 'FAILURE' | 'DENIED',
  resource: {
    type: string;
    id?: string;
    name?: string;
  },
  details?: Record<string, unknown>
): void => {
  auditLog({
    eventType,
    action,
    actor: {},
    resource,
    result,
    details,
  });
};

export default auditLog;
