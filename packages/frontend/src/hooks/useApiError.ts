// Standardized Error Handling Hook
// Provides consistent error handling across the application

import { useCallback } from 'react';
import type { AxiosError } from 'axios';

import { useAuthStore } from '../store';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types';
import { i18nInstance } from '../i18n/config';

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
  status?: number;
}

export interface UseApiErrorResult {
  error: string | null;
  extractError: (error: unknown) => ApiError;
  handleError: (error: unknown, customMessage?: string) => string;
  clearError: () => void;
  isNetworkError: (error: unknown) => boolean;
  isAuthError: (error: unknown) => boolean;
  isValidationError: (error: unknown) => boolean;
}

/**
 * Custom hook for standardized API error handling
 *
 * @example
 * const { handleError, extractError } = useApiError();
 *
 * const mutation = useMutation({
 *   mutationFn: apiService.createItem,
 *   onError: (error) => {
 *     const message = handleError(error, 'Failed to create item');
 *     toast.error(message);
 *   },
 * });
 */
export const useApiError = (): UseApiErrorResult => {
  const { error, setError, logout } = useAuthStore();

  /**
   * Extracts structured error information from various error types
   */
  const extractError = useCallback((error: unknown): ApiError => {
    // Handle Axios errors
    if (isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse<never>>;
      const response = axiosError.response;

      // API returned an error response
      if (response?.data.error) {
        return {
          code: response.data.error.code,
          message: response.data.error.message,
          details: response.data.error.details,
          status: response.status,
        };
      }

      // Network error (no response)
      if (!response) {
        return {
          code: 'NETWORK_ERROR',
          message: axiosError.message || 'Network error - please check your connection',
          status: 0,
        };
      }

      // HTTP error with no structured error body
      return {
        code: `HTTP_${response.status}`,
        message: getHttpErrorMessage(response.status),
        status: response.status,
      };
    }

    // Handle standard Error objects
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
      };
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
      };
    }

    // Unknown error type
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    };
  }, []);

  /**
   * Handles an error and returns a user-friendly message
   */
  const handleError = useCallback(
    (error: unknown, customMessage?: string): string => {
      const apiError = extractError(error);

      // Log error in development, but skip expected permission transition errors
      if (import.meta.env.DEV && !isPermissionTransitionError(error)) {
        logger.error('API Error', undefined, { apiError, error });
      }

      // Handle authentication errors
      if (apiError.status === 401 || apiError.code === 'UNAUTHORIZED') {
        void logout();
        return 'Your session has expired. Please log in again.';
      }

      // Return validation details if available
      if (apiError.details && apiError.details.length > 0) {
        return apiError.details.map((d) => `${d.field}: ${d.message}`).join(', ');
      }

      // Return custom message or error message
      return customMessage ?? apiError.message;
    },
    [extractError, logout]
  );

  /**
   * Clears the current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  /**
   * Checks if an error is a network error
   */
  const isNetworkError = useCallback((err: unknown): boolean => {
    if (isAxiosError(err)) {
      const axiosError = err as AxiosError;
      return !axiosError.response;
    }
    return false;
  }, []);

  /**
   * Checks if an error is an authentication error
   */
  const isAuthError = useCallback((error: unknown): boolean => {
    if (isAxiosError(error)) {
      const axiosError = error as AxiosError;
      return axiosError.response?.status === 401;
    }
    return false;
  }, []);

  /**
   * Checks if an error is a validation error
   */
  const isValidationError = useCallback((error: unknown): boolean => {
    if (isAxiosError(error)) {
      const axiosError = error as AxiosError<ApiResponse<never>>;
      return (
        axiosError.response?.status === 400 ||
        axiosError.response?.status === 422 ||
        !!axiosError.response?.data.error?.details
      );
    }
    return false;
  }, []);

  return {
    error,
    extractError,
    handleError,
    clearError,
    isNetworkError,
    isAuthError,
    isValidationError,
  };
};

// Helper functions
function isAxiosError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError?: boolean }).isAxiosError === true
  );
}

/**
 * Checks if an error is a permission transition error that should not be logged.
 * These are expected errors that are already displayed in the UI.
 */
function isPermissionTransitionError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }

  const axiosError = error as AxiosError<ApiResponse<never>>;
  const errorMessage = axiosError.response?.data.error?.message;

  return (
    (axiosError.response?.status === 403 || axiosError.response?.status === 400) &&
    typeof errorMessage === 'string' &&
    errorMessage.includes('You do not have permission to perform this transition')
  );
}

function getHttpErrorMessage(status: number): string {
  const key = `common:error.http.${status}`;
  const fallback = getHttpErrorMessageFallback(status);
  // `t()` answers an empty string on an instance that has not been `init()`-ed yet (i18next 26.7
  // changed this from `undefined`); the status-based fallback is always preferable to a blank
  // message, so it also covers a missing or empty translation.
  return i18nInstance.t(key, fallback) || fallback;
}

function getHttpErrorMessageFallback(status: number): string {
  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Authentication required. Please log in.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    405: 'Method not allowed.',
    408: 'Request timeout. Please try again.',
    409: 'Conflict with existing resource.',
    422: 'Validation failed. Please check your input.',
    429: 'Too many requests. Please wait and try again.',
    500: 'Server error. Please try again later.',
    502: 'Bad gateway. Please try again later.',
    503: 'Service unavailable. Please try again later.',
    504: 'Gateway timeout. Please try again later.',
  };

  return messages[status] ?? `An error occurred (status: ${status})`;
}

export default useApiError;
