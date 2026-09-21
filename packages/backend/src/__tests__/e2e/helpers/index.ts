export const uniqueTestId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;

import request from 'supertest';
import app from '../../../app';
import { CSRF_CONSTANTS } from '../../../middleware/csrf.middleware';

export function getCookiesAsArray(response: request.Response): string[] {
  const setCookie = response.headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    return setCookie;
  }
  if (typeof setCookie === 'string') {
    return [setCookie];
  }
  return [];
}

export async function getCsrfToken(): Promise<{ csrfCookie: string; csrfToken: string }> {
  const response = await request(app).get('/api/v1/auth/csrf-token');
  const cookies = getCookiesAsArray(response);
  const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_CONSTANTS.COOKIE_NAME}=`));

  if (!csrfCookie) {
    throw new Error('CSRF cookie not found');
  }

  const cookieValue = csrfCookie.split(';')[0];
  if (!cookieValue) {
    throw new Error('Invalid CSRF cookie format');
  }

  const tokenParts = cookieValue.split('=');
  const csrfToken = tokenParts[1] ?? '';

  return { csrfCookie, csrfToken };
}

export function extractCsrfFromCookies(cookies: string[]): {
  csrfCookie: string;
  csrfToken: string;
} {
  const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_CONSTANTS.COOKIE_NAME}=`));

  if (!csrfCookie) {
    throw new Error('CSRF cookie not found in cookies array');
  }

  const cookieValue = csrfCookie.split(';')[0];
  if (!cookieValue) {
    throw new Error('Invalid CSRF cookie format');
  }

  const tokenParts = cookieValue.split('=');
  const csrfToken = tokenParts[1] ?? '';

  return { csrfCookie, csrfToken };
}

export function replaceCsrfCookie(
  cookies: string[],
  newCsrf: { csrfCookie: string; csrfToken: string }
): string[] {
  const filtered = cookies.filter((c) => !c.startsWith(`${CSRF_CONSTANTS.COOKIE_NAME}=`));
  return [...filtered, newCsrf.csrfCookie];
}

export { CSRF_CONSTANTS };

export function extractAccessToken(cookies: string[]): string | null {
  const accessTokenCookie = cookies.find((c) => c.includes('accessToken='));
  if (!accessTokenCookie) return null;
  const match = accessTokenCookie.match(/accessToken=([^;]+)/);
  return match?.[1] ?? null;
}

export function extractRefreshToken(cookies: string[]): string | null {
  const refreshTokenCookie = cookies.find((c) => c.includes('refreshToken='));
  if (!refreshTokenCookie) return null;
  const match = refreshTokenCookie.match(/refreshToken=([^;]+)/);
  return match?.[1] ?? null;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  cookies?: string[];
}

export interface TestTeam {
  id: string;
  name: string;
  description: string;
}

export interface TestSprint {
  id: string;
  teamId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface TestPBI {
  id: string;
  teamId: string;
  title: string;
  status: string;
  priority: string;
}

export const DEFAULT_PASSWORD = 'TestPassword123!';

export const VALIDATION_SCENARIOS = {
  email: {
    valid: ['test@example.com', 'user.name@example.com', 'user+tag@example.co.uk'],
    invalid: ['invalid', 'invalid@', '@example.com', 'user@.com', 'user@example'],
  },
  password: {
    strong: ['StrongPassword123!', 'Another$tr0ngP@ss', 'C0mpl3x!Pass#'],
    weak: ['short', 'noNumbers!', 'NoSpecialChars123', 'nouppercase123!'],
  },
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};

export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SESSION_IDLE_TIMEOUT: 'SESSION_IDLE_TIMEOUT',
  SESSION_ABSOLUTE_TIMEOUT: 'SESSION_ABSOLUTE_TIMEOUT',
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};

export const ROLES = {
  PRODUCT_OWNER: 'PRODUCT_OWNER',
  SCRUM_MASTER: 'SCRUM_MASTER',
  DEVELOPERS: 'DEVELOPERS',
} as const;

export const SPRINT_STATUSES = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const PBI_STATUSES = {
  NEW: 'NEW',
  REFINED: 'REFINED',
  READY: 'READY',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;

export const PBI_PRIORITIES = {
  MUST_HAVE: 'MUST_HAVE',
  SHOULD_HAVE: 'SHOULD_HAVE',
  COULD_HAVE: 'COULD_HAVE',
  WONT_HAVE: 'WONT_HAVE',
} as const;

export const TASK_STATUSES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  DONE: 'DONE',
} as const;

export function generateTestUUID(): string {
  return 'xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export {
  createTestUser,
  createTestTeamInDb,
  addTeamMember,
  createTestSprintInDb,
  createTestPBIInDb,
  createTestTaskInDb,
  createTestProductGoalInDb,
  createTestImpedimentInDb,
  createTestRetrospectiveInDb,
  createTestDoDInDb,
  createTestDoRInDb,
  createTestIncrementInDb,
  createTestSprintConfigurationInDb,
  createTestSprintReviewInDb,
  createTestRetrospectiveItemInDb,
  createTestRetroActionItemInDb,
  createTestNotificationInDb,
  createTestConsentRecordInDb,
  createTestStakeholderFeedbackInDb,
  createTestReviewAttendeeInDb,
  createTestBurndownDataInDb,
  addPBIToSprintBacklog,
  seedPlanningParticipation,
  addPBIToIncrement,
  cleanupUsers,
  cleanupTeams,
  cleanupTeamById,
  cleanupSprints,
  cleanupPbis,
  cleanupIncrements,
  cleanupNotifications,
  cleanupConsentRecords,
} from './db-utils';
