// Custom Error Classes and Error Handling Utilities

import { t as reqT } from '../i18n/requestT.js';

// Base Application Error
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Array<{ field: string; message: string }>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Array<{ field: string; message: string }>,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 Bad Request
export class BadRequestError extends AppError {
  constructor(
    message: string = 'Bad Request',
    details?: Array<{ field: string; message: string }>,
    code: string = 'BAD_REQUEST'
  ) {
    super(message, 400, code, details);
  }
}

// 401 Unauthorized
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

// 403 Forbidden
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code: string = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

// 404 Not Found
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

// 409 Conflict
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code: string = 'CONFLICT') {
    super(message, 409, code);
  }
}

// 422 Unprocessable Entity
export class ValidationError extends AppError {
  constructor(details: Array<{ field: string; message: string }>) {
    super('Validation failed', 422, 'VALIDATION_ERROR', details);
  }
}

// 500 Internal Server Error
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_ERROR', undefined, false);
  }
}

export class SessionIdleTimeoutError extends AppError {
  constructor(message: string = 'Session expired due to inactivity') {
    super(message, 401, 'SESSION_IDLE_TIMEOUT');
  }
}

export class SessionAbsoluteTimeoutError extends AppError {
  constructor(message: string = 'Session expired due to maximum duration reached') {
    super(message, 401, 'SESSION_ABSOLUTE_TIMEOUT');
  }
}

export class SessionRevokedError extends AppError {
  constructor(message: string = 'Session has been revoked') {
    super(message, 401, 'SESSION_REVOKED');
  }
}

export class SessionExpiredError extends AppError {
  constructor(message: string = 'Session has expired') {
    super(message, 401, 'SESSION_EXPIRED');
  }
}

// Account Deletion Errors
export class AccountDeletionBlockedError extends ForbiddenError {
  public readonly teams: Array<{ id: string; name: string }>;
  public readonly guidance: string;

  constructor(
    teams: Array<{ id: string; name: string }>,
    guidance: string = 'Account deletion is blocked. You are the only Product Owner for one or more teams.'
  ) {
    super(guidance);
    this.teams = teams;
    this.guidance = guidance;
  }
}

export class InvalidConfirmationError extends BadRequestError {
  constructor() {
    super('Invalid confirmation phrase. Please type "DELETE MY ACCOUNT" exactly.');
  }
}

// Email Errors
export class EmailError extends AppError {
  constructor(
    message: string = 'Email error',
    code: string = 'EMAIL_ERROR',
    details?: Array<{ field: string; message: string }>
  ) {
    super(message, 500, code, details);
  }
}

export class EmailRateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(message: string = 'Email rate limit exceeded', retryAfter: number = 60) {
    super(message, 429, 'EMAIL_RATE_LIMIT');
    this.retryAfter = retryAfter;
  }
}

export class EmailProviderError extends AppError {
  public readonly providerError?: string;

  constructor(message: string = 'Email provider error', providerError?: string) {
    super(message, 502, 'EMAIL_PROVIDER_ERROR');
    this.providerError = providerError;
  }
}

export class EmailConnectionError extends AppError {
  public readonly host?: string;

  constructor(message: string = 'Failed to connect to email server', host?: string) {
    super(message, 503, 'EMAIL_CONNECTION_ERROR');
    this.host = host;
  }
}

export class EmailAuthenticationError extends AppError {
  constructor(message: string = 'Email authentication failed') {
    super(message, 500, 'EMAIL_AUTH_ERROR');
  }
}

export class EmailTemplateError extends AppError {
  public readonly templateName?: string;

  constructor(message: string = 'Email template error', templateName?: string) {
    super(message, 500, 'EMAIL_TEMPLATE_ERROR');
    this.templateName = templateName;
  }
}

export class EmailValidationError extends BadRequestError {
  constructor(
    message: string = 'Invalid email address',
    details?: Array<{ field: string; message: string }>
  ) {
    super(message, details);
  }
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

// Success response interface
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

// API Response type
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Helper to create error response
export const createErrorResponse = (
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>
): ErrorResponse => ({
  success: false,
  error: { code, message, details },
});

// Helper to create success response
export const createSuccessResponse = <T>(data: T): SuccessResponse<T> => ({
  success: true,
  data,
});

import type { Request, Response, NextFunction } from 'express';

// Async handler wrapper
export const asyncHandler = <T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error formatter
export const formatValidationErrors = (
  errors: Array<{ path: string; message: string }>
): Array<{ field: string; message: string }> => {
  return errors.map((error) => ({
    field: error.path,
    message: error.message,
  }));
};

// i18n-localized error helpers (additive, non-breaking)
// These are opt-in replacements for raw error strings. Existing call sites continue to work.

/**
 * Resolve a localized "X not found" message. Prefer this over raw
 * `new NotFoundError('Notification')` so the phrase is translated per locale.
 */
export function notFound(entityKey: string, params?: Record<string, unknown>): NotFoundError {
  return new NotFoundError(reqT('errors:entityNotFound', { entity: reqT(entityKey, params) }));
}

/**
 * Resolve an arbitrary localized error. Use when the message must be translated.
 *
 * Returns the semantic subclass matching the status code (e.g. `BadRequestError`
 * for 400), mirroring the `notFound` helper, so callers can rely on `instanceof`
 * checks. The explicit `code` is always preserved.
 */
export function localizedError(
  key: string,
  params: Record<string, unknown> = {},
  statusCode = 400,
  code = 'BAD_REQUEST'
): AppError {
  const message = reqT(key, params);

  switch (statusCode) {
    case 400:
      return new BadRequestError(message, undefined, code);
    case 403:
      return new ForbiddenError(message, code);
    case 409:
      return new ConflictError(message, code);
    default:
      return new AppError(message, statusCode, code);
  }
}

export default {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
  AccountDeletionBlockedError,
  InvalidConfirmationError,
  EmailError,
  EmailRateLimitError,
  EmailProviderError,
  EmailConnectionError,
  EmailAuthenticationError,
  EmailTemplateError,
  EmailValidationError,
  createErrorResponse,
  createSuccessResponse,
  asyncHandler,
  notFound,
  localizedError,
};
