import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApiError } from './useApiError';
import { useAuthStore } from '../store';
import type { AxiosError } from 'axios';

// Mock the store
vi.mock('../store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
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

describe('useApiError', () => {
  const mockLogout = vi.fn();
  const mockSetError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslate.mockImplementation((_key: string, fallback: string) => fallback);
    vi.mocked(useAuthStore).mockReturnValue({
      error: null,
      setError: mockSetError,
      logout: mockLogout,
    });
  });

  describe('extractError', () => {
    it('should extract error from Axios error with API response', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: [{ field: 'email', message: 'Invalid email' }],
            },
          },
        },
      } as AxiosError;

      const extracted = result.current.extractError(axiosError);

      expect(extracted.code).toBe('VALIDATION_ERROR');
      expect(extracted.message).toBe('Invalid input');
      expect(extracted.details).toEqual([{ field: 'email', message: 'Invalid email' }]);
      expect(extracted.status).toBe(400);
    });

    it('should extract network error from Axios error without response', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        message: 'Network Error',
        response: undefined,
      } as AxiosError;

      const extracted = result.current.extractError(axiosError);

      expect(extracted.code).toBe('NETWORK_ERROR');
      expect(extracted.message).toBe('Network Error');
      expect(extracted.status).toBe(0);
    });

    it('should extract error from standard Error object', () => {
      const { result } = renderHook(() => useApiError());

      const error = new Error('Something went wrong');
      const extracted = result.current.extractError(error);

      expect(extracted.code).toBe('UNKNOWN_ERROR');
      expect(extracted.message).toBe('Something went wrong');
    });

    it('should extract error from string', () => {
      const { result } = renderHook(() => useApiError());

      const extracted = result.current.extractError('String error');

      expect(extracted.code).toBe('UNKNOWN_ERROR');
      expect(extracted.message).toBe('String error');
    });

    it('should handle unknown error types', () => {
      const { result } = renderHook(() => useApiError());

      const extracted = result.current.extractError(null);

      expect(extracted.code).toBe('UNKNOWN_ERROR');
      expect(extracted.message).toBe('An unexpected error occurred');
    });

    it('should extract HTTP error message for status without structured body', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: {},
        },
      } as AxiosError;

      const extracted = result.current.extractError(axiosError);

      expect(extracted.code).toBe('HTTP_500');
      expect(extracted.message).toBe('Server error. Please try again later.');
      expect(extracted.status).toBe(500);
    });

    it('should fall back to the status-based message when the translation is empty', () => {
      mockTranslate.mockReturnValue('');
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 503,
          data: {},
        },
      } as AxiosError;

      const extracted = result.current.extractError(axiosError);

      expect(extracted.message).toBe('Service unavailable. Please try again later.');
    });

    it('should handle various HTTP status codes', () => {
      const { result } = renderHook(() => useApiError());

      const testCases = [
        { status: 400, message: 'Invalid request. Please check your input.' },
        { status: 401, message: 'Authentication required. Please log in.' },
        { status: 403, message: 'You do not have permission to perform this action.' },
        { status: 404, message: 'The requested resource was not found.' },
        { status: 408, message: 'Request timeout. Please try again.' },
        { status: 409, message: 'Conflict with existing resource.' },
        { status: 422, message: 'Validation failed. Please check your input.' },
        { status: 429, message: 'Too many requests. Please wait and try again.' },
        { status: 502, message: 'Bad gateway. Please try again later.' },
        { status: 503, message: 'Service unavailable. Please try again later.' },
        { status: 504, message: 'Gateway timeout. Please try again later.' },
        { status: 999, message: 'An error occurred (status: 999)' },
      ];

      testCases.forEach(({ status, message }) => {
        const axiosError = {
          isAxiosError: true,
          response: { status, data: {} },
        } as AxiosError;

        const extracted = result.current.extractError(axiosError);
        expect(extracted.message).toBe(message);
      });
    });
  });

  describe('handleError', () => {
    it('should return custom message when provided', () => {
      const { result } = renderHook(() => useApiError());

      let message: string;
      act(() => {
        message = result.current.handleError(new Error('Original error'), 'Custom message');
      });

      expect(message!).toBe('Custom message');
    });

    it('should return error message when no custom message', () => {
      const { result } = renderHook(() => useApiError());

      let message: string;
      act(() => {
        message = result.current.handleError(new Error('Original error'));
      });

      expect(message!).toBe('Original error');
    });

    it('should handle 401 authentication error and logout', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: { code: 'UNAUTHORIZED', message: 'Session expired' } },
        },
      } as AxiosError;

      let message: string;
      act(() => {
        message = result.current.handleError(axiosError);
      });

      expect(mockLogout).toHaveBeenCalled();
      expect(message!).toBe('Your session has expired. Please log in again.');
    });

    it('should handle validation errors with details', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: [
                { field: 'email', message: 'Invalid email format' },
                { field: 'password', message: 'Password too short' },
              ],
            },
          },
        },
      } as AxiosError;

      let message: string;
      act(() => {
        message = result.current.handleError(axiosError);
      });

      expect(message!).toBe('email: Invalid email format, password: Password too short');
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => useApiError());

      act(() => {
        result.current.clearError();
      });

      expect(mockSetError).toHaveBeenCalledWith(null);
    });
  });

  describe('isNetworkError', () => {
    it('should return true for network errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: undefined,
      } as AxiosError;

      expect(result.current.isNetworkError(axiosError)).toBe(true);
    });

    it('should return false for non-network errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: { status: 500 },
      } as AxiosError;

      expect(result.current.isNetworkError(axiosError)).toBe(false);
    });

    it('should return false for non-Axios errors', () => {
      const { result } = renderHook(() => useApiError());

      expect(result.current.isNetworkError(new Error('Test'))).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401 errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: { status: 401 },
      } as AxiosError;

      expect(result.current.isAuthError(axiosError)).toBe(true);
    });

    it('should return false for non-401 errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: { status: 500 },
      } as AxiosError;

      expect(result.current.isAuthError(axiosError)).toBe(false);
    });

    it('should return false for non-Axios errors', () => {
      const { result } = renderHook(() => useApiError());

      expect(result.current.isAuthError(new Error('Test'))).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('should return true for 400 errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: { status: 400 },
      } as AxiosError;

      expect(result.current.isValidationError(axiosError)).toBe(true);
    });

    it('should return true for 422 errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: { status: 422 },
      } as AxiosError;

      expect(result.current.isValidationError(axiosError)).toBe(true);
    });

    it('should return true for errors with details', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: {
          status: 200,
          data: { error: { details: [{ field: 'test', message: 'error' }] } },
        },
      } as AxiosError;

      expect(result.current.isValidationError(axiosError)).toBe(true);
    });

    it('should return false for other errors', () => {
      const { result } = renderHook(() => useApiError());

      const axiosError = {
        isAxiosError: true,
        response: { status: 500, data: {} },
      } as AxiosError;

      expect(result.current.isValidationError(axiosError)).toBe(false);
    });

    it('should return false for non-Axios errors', () => {
      const { result } = renderHook(() => useApiError());

      expect(result.current.isValidationError(new Error('Test'))).toBe(false);
    });
  });

  describe('error property', () => {
    it('should return current error from store', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        error: 'Current error',
        setError: mockSetError,
        logout: mockLogout,
      });

      const { result } = renderHook(() => useApiError());

      expect(result.current.error).toBe('Current error');
    });
  });
});
