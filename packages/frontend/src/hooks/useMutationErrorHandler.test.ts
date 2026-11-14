import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AxiosError } from 'axios';

import { useMutationErrorHandler } from './useMutationErrorHandler';

const mockLogout = vi.fn();
const mockSetError = vi.fn();

vi.mock('../store', () => ({
  useAuthStore: () => ({
    logout: mockLogout,
    error: null,
    setError: mockSetError,
  }),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
  setStoreProvider: vi.fn(),
}));

// Mock i18n config - i18nInstance.t returns fallback messages. Controllable so a test can
// reproduce an instance that answers '' (i18next does that while it is not yet initialised).
const { mockTranslate } = vi.hoisted(() => ({
  mockTranslate: vi.fn((_key: string, fallback: string) => fallback),
}));

vi.mock('../i18n/config', () => ({
  i18nInstance: {
    t: mockTranslate,
  },
}));

describe('useMutationErrorHandler', () => {
  const mockSetFormErrors = vi.fn();
  const mockSetWorkflowError = vi.fn();
  const mockSetModalError = vi.fn();
  const mockShowToast = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslate.mockImplementation((_key: string, fallback: string) => fallback);
    vi.stubEnv('DEV', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('handleMutationError', () => {
    it('should return user-friendly message for generic error', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const error = new Error('Something went wrong');
      const message = result.current.handleMutationError(error, {
        operationName: 'create item',
      });

      expect(message).toBe('Failed to create item');
    });

    it('should fall back to the literal message when the translation is empty', () => {
      // An i18next instance answers '' for every key until it is init()-ed; the user must still
      // see the operation's message instead of a blank toast.
      mockTranslate.mockReturnValue('');
      const { result } = renderHook(() => useMutationErrorHandler());

      const message = result.current.handleMutationError(new Error('boom'), {
        operationName: 'create item',
      });

      expect(message).toBe('Failed to create item');
    });

    it('should handle validation error (400) with teamId field', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              message: 'teamId is required',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'create team',
        setFormErrors: mockSetFormErrors,
      });

      expect(mockSetFormErrors).toHaveBeenCalledWith({ teamId: 'teamId is required' });
    });

    it('should handle validation error (400) with title field when message does not contain teamId', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              message: 'Title is required',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'create item',
        setFormErrors: mockSetFormErrors,
      });

      expect(mockSetFormErrors).toHaveBeenCalledWith({ title: 'Failed to create item' });
    });

    it('should handle workflow transition error', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              message: 'Transition not allowed',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'update status',
        setWorkflowError: mockSetWorkflowError,
      });

      expect(mockSetWorkflowError).toHaveBeenCalledWith('Transition not allowed');
    });

    it('should handle permission error (403)', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error: {
              message: 'You do not have permission',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'delete item',
        setWorkflowError: mockSetWorkflowError,
      });

      expect(mockSetWorkflowError).toHaveBeenCalledWith(
        'You do not have permission to perform this transition.'
      );
    });

    it('should handle 403 error without message', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {},
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'delete item',
        setWorkflowError: mockSetWorkflowError,
      });

      expect(mockSetWorkflowError).toHaveBeenCalledWith(
        'You do not have permission to perform this action.'
      );
    });

    it('should set modal error when provided', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const error = new Error('Modal error');
      result.current.handleMutationError(error, {
        operationName: 'create item',
        setModalError: mockSetModalError,
      });

      expect(mockSetModalError).toHaveBeenCalled();
    });

    it('should show toast when provided', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const error = new Error('Toast error');
      result.current.handleMutationError(error, {
        operationName: 'create item',
        showToast: mockShowToast,
      });

      expect(mockShowToast).toHaveBeenCalledWith('Failed to create item');
    });

    it('should call custom onError handler', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const error = new Error('Custom error');
      result.current.handleMutationError(error, {
        operationName: 'create item',
        onError: mockOnError,
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'Failed to create item');
    });

    it('should skip toast for permission errors when workflow error is set', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error: {
              message: 'You do not have permission to perform this transition',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'transition item',
        setWorkflowError: mockSetWorkflowError,
        showToast: mockShowToast,
      });

      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('should show user-friendly message for permission transition errors', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error: {
              message: 'You do not have permission to perform this transition',
            },
          },
        },
      } as unknown as AxiosError;

      const message = result.current.handleMutationError(axiosError, {
        operationName: 'transition item',
      });

      expect(message).toBe('You do not have permission to perform this transition.');
    });
  });

  describe('createMutationConfig', () => {
    it('should return onError handler', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        showToast: mockShowToast,
      });

      expect(config.onError).toBeDefined();
      expect(typeof config.onError).toBe('function');
    });

    it('should return onSuccess handler', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        showToast: mockShowToast,
      });

      expect(config.onSuccess).toBeDefined();
      expect(typeof config.onSuccess).toBe('function');
    });

    it('should call handleMutationError in onError', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        showToast: mockShowToast,
      });

      const error = new Error('Test error');
      config.onError(error);

      expect(mockShowToast).toHaveBeenCalled();
    });

    it('should clear form errors on success', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        setFormErrors: mockSetFormErrors,
      });

      config.onSuccess({}, {});

      expect(mockSetFormErrors).toHaveBeenCalledWith({});
    });

    it('should clear workflow error on success', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        setWorkflowError: mockSetWorkflowError,
      });

      config.onSuccess({}, {});

      expect(mockSetWorkflowError).toHaveBeenCalledWith(null);
    });

    it('should clear modal error on success', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        setModalError: mockSetModalError,
      });

      config.onSuccess({}, {});

      expect(mockSetModalError).toHaveBeenCalledWith(null);
    });

    it('should clear all error types on success', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const config = result.current.createMutationConfig('create item', {
        setFormErrors: mockSetFormErrors,
        setWorkflowError: mockSetWorkflowError,
        setModalError: mockSetModalError,
      });

      config.onSuccess({}, {});

      expect(mockSetFormErrors).toHaveBeenCalledWith({});
      expect(mockSetWorkflowError).toHaveBeenCalledWith(null);
      expect(mockSetModalError).toHaveBeenCalledWith(null);
    });
  });

  describe('error type detection', () => {
    it('should handle non-axios errors', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const message = result.current.handleMutationError('string error', {
        operationName: 'test',
      });

      expect(message).toBe('Failed to test');
    });

    it('should handle null error', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const message = result.current.handleMutationError(null, {
        operationName: 'test',
      });

      expect(message).toBe('Failed to test');
    });

    it('should handle Cannot modify error message', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              message: 'Cannot modify this item',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'update item',
        setWorkflowError: mockSetWorkflowError,
      });

      expect(mockSetWorkflowError).toHaveBeenCalledWith('Cannot modify this item');
    });

    it('should handle not allowed error message', () => {
      const { result } = renderHook(() => useMutationErrorHandler());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              message: 'Action not allowed',
            },
          },
        },
      } as unknown as AxiosError;

      result.current.handleMutationError(axiosError, {
        operationName: 'perform action',
        setWorkflowError: mockSetWorkflowError,
      });

      expect(mockSetWorkflowError).toHaveBeenCalledWith('Action not allowed');
    });
  });
});
