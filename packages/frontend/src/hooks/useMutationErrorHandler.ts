// Centralized Mutation Error Handler
// Provides standardized error handling for React Query mutations

import { useCallback } from 'react';
import type { AxiosError } from 'axios';

import type { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { i18nInstance } from '../i18n/config';

import { useApiError } from './useApiError';

export interface MutationErrorContext {
  operationName: string;
  setFormErrors?: (errors: Record<string, string>) => void;
  setWorkflowError?: (error: string | null) => void;
  setModalError?: (error: string | null) => void;
  showToast?: (message: string) => void;
  onError?: (error: unknown, message: string) => void;
}

export interface UseMutationErrorHandlerResult {
  handleMutationError: (error: unknown, context: MutationErrorContext) => string;
  createMutationConfig: <TData, TVariables>(
    operationName: string,
    context: Omit<MutationErrorContext, 'operationName'>
  ) => {
    onError: (error: unknown) => void;
    onSuccess: (data: TData, variables: TVariables) => void;
  };
}

/**
 * Checks if an error is a permission transition error that should not be logged.
 * These are expected errors that are already displayed in the UI.
 */
function isPermissionTransitionError(error: unknown): boolean {
  const isAxiosError =
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as { isAxiosError?: boolean }).isAxiosError === true;

  if (!isAxiosError) {
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

/**
 * Resolves a translated message, keeping the literal fallback when i18next has nothing to say.
 *
 * `t()` answers an empty string on an instance that has not been `init()`-ed yet (i18next 26.7
 * changed this from `undefined`), and an empty message would otherwise be shown to the user as a
 * blank toast or a blank dialog field. Callers here always have a human-readable fallback, so the
 * fallback wins whenever the translation is empty.
 */
function translateMessage(key: string, fallback: string): string {
  const translated = i18nInstance.t(key, fallback);
  return translated || fallback;
}

/**
 * Centralized hook for handling mutation errors consistently
 *
 * @example
 * const { handleMutationError } = useMutationErrorHandler();
 *
 * const mutation = useMutation({
 *   mutationFn: apiService.createItem,
 *   onError: (error) => handleMutationError(error, {
 *     operationName: 'create item',
 *     setFormErrors,
 *     showToast: (msg) => toast.error(msg),
 *   }),
 * });
 */
export const useMutationErrorHandler = (): UseMutationErrorHandlerResult => {
  const { handleError } = useApiError();

  /**
   * Maps operation names to i18n keys for error messages
   */
  const getOperationErrorKey = (operationName: string): string => {
    // Convert "create backlog item" → "createBacklogItem"
    const camelCase = operationName
      .split(' ')
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');

    return `common:error.operations.${camelCase}`;
  };

  /**
   * Handles mutation errors with standardized logic
   */
  const handleMutationError = useCallback(
    (error: unknown, context: MutationErrorContext): string => {
      const { operationName, setFormErrors, setWorkflowError, setModalError, showToast, onError } =
        context;

      // Log error in development, but skip expected permission transition errors
      if (import.meta.env.DEV && !isPermissionTransitionError(error)) {
        logger.error(`Failed to ${operationName}`, undefined, { error });
      }

      // Check if this is a permission transition error for user-friendly messaging
      const isPermissionError = isPermissionTransitionError(error);

      // Get translated error message for this operation
      const operationErrorKey = getOperationErrorKey(operationName);
      const translatedMessage = translateMessage(operationErrorKey, `Failed to ${operationName}`);

      // Extract user-friendly message
      let userMessage = handleError(error, translatedMessage);

      // For permission transition errors, show a cleaner message
      if (isPermissionError) {
        userMessage = translateMessage(
          'common:permission.transitionError',
          'You do not have permission to perform this transition.'
        );
      }

      // Handle validation errors (400)
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 400
      ) {
        const response = (error as { response?: { data?: { error?: { message?: string } } } })
          .response;
        const errorMessage = response?.data?.error?.message;

        if (errorMessage) {
          if (errorMessage.includes('teamId') && setFormErrors) {
            setFormErrors({ teamId: errorMessage });
          } else if (
            setWorkflowError &&
            (errorMessage.includes('Transition') ||
              errorMessage.includes('not allowed') ||
              errorMessage.includes('Cannot modify') ||
              errorMessage.includes('You do not have permission'))
          ) {
            // Use user-friendly message for permission errors
            setWorkflowError(isPermissionError ? userMessage : errorMessage);
          } else if (setFormErrors) {
            setFormErrors({ title: userMessage });
          }
        }
      }

      // Handle permission errors (403)
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 403
      ) {
        const response = (error as { response?: { data?: { error?: { message?: string } } } })
          .response;
        const errorMessage = response?.data?.error?.message;

        // Detect permission-related backend messages and use translated version
        const isPermissionMessage =
          errorMessage &&
          (errorMessage.includes('You do not have permission') ||
            errorMessage.includes('Required roles') ||
            errorMessage.includes('Insufficient permissions'));

        if (setWorkflowError) {
          if (isPermissionMessage) {
            // Use translated message instead of backend message
            setWorkflowError(
              translateMessage(
                'common:permission.transitionError',
                'You do not have permission to perform this transition.'
              )
            );
          } else {
            setWorkflowError(
              errorMessage ??
                translateMessage(
                  'common:permission.actionError',
                  'You do not have permission to perform this action.'
                )
            );
          }
        }
      }

      // Set modal error if provided
      if (setModalError) {
        setModalError(userMessage);
      }

      // Show toast if provided (skip for permission errors if workflow error is already set)
      if (showToast && !(isPermissionError && setWorkflowError)) {
        showToast(userMessage);
      }

      // Call custom error handler if provided
      if (onError) {
        onError(error, userMessage);
      }

      return userMessage;
    },
    [handleError]
  );

  /**
   * Creates standardized mutation configuration
   */
  const createMutationConfig = useCallback(
    <TData, TVariables>(
      operationName: string,
      context: Omit<MutationErrorContext, 'operationName'>
    ) => ({
      onError: (error: unknown) => {
        handleMutationError(error, { operationName, ...context });
      },
      onSuccess: (_data: TData, _variables: TVariables) => {
        // Clear errors on success
        if (context.setFormErrors) {
          context.setFormErrors({});
        }
        if (context.setWorkflowError) {
          context.setWorkflowError(null);
        }
        if (context.setModalError) {
          context.setModalError(null);
        }
      },
    }),
    [handleMutationError]
  );

  return {
    handleMutationError,
    createMutationConfig,
  };
};

export default useMutationErrorHandler;
