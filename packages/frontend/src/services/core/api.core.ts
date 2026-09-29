// Core API Infrastructure
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import type { ApiResponse } from '../../types';
import { API_BASE_URL } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { navigateTo, getCurrentPath } from '../../utils/navigation';
import { i18nInstance } from '../../i18n/config';

// Re-exported for the callers that already depend on this module (the keepalive
// flush in `SprintPlanning.tsx`, the persona catalogue). The value itself lives in
// `config/api.config.ts` — dependency-free — so the mock backend can read it
// without pulling this module's client, interceptors and i18n wiring along with it.
export { API_BASE_URL };

const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT ?? '30000', 10);

const CSRF_COOKIE_NAME = 'csrfToken';
const CSRF_HEADER_NAME = 'x-csrf-token';

function getCsrfTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME && value) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Build the CSRF header for raw `fetch` calls (e.g. a keepalive flush on unload)
 * that bypass the axios instance and therefore the interceptor that normally adds
 * the header. Used because `navigator.sendBeacon` cannot set custom headers.
 */
export function getCsrfHeader(): Record<string, string> {
  const token = getCsrfTokenFromCookie();
  return token ? { [CSRF_HEADER_NAME]: token } : {};
}

async function fetchCsrfToken(): Promise<string | null> {
  try {
    // Include Accept-Language header so the backend locale middleware
    // resolves the correct locale and sets the cookie accordingly.
    const headers: Record<string, string> = {};
    const currentLng = i18nInstance.language;
    if (currentLng) {
      headers['Accept-Language'] = currentLng;
    }
    const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
      credentials: 'include',
      headers,
    });
    if (response.ok) {
      return getCsrfTokenFromCookie();
    }
  } catch (error) {
    logger.error('Failed to fetch CSRF token', undefined, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return null;
}

let onLogout: (() => void) | null = null;

export const setAuthCallbacks = (_refreshCallback: () => void, logoutCallback: () => void) => {
  onLogout = logoutCallback;
};

export class CoreApiService {
  private api: AxiosInstance;
  private currentTeamId: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      if (this.currentTeamId) {
        config.headers['X-Team-Id'] = this.currentTeamId;
      }

      // Add Accept-Language header for i18n
      // Priority: i18next's current language (authoritative) > cookie fallback
      // Using i18next directly ensures the backend always receives the correct
      // locale even on first visit when the cookie may not yet be set.
      const currentLng = i18nInstance.language;
      if (currentLng) {
        config.headers['Accept-Language'] = currentLng;
      } else {
        // Fallback: read from cookie if i18next hasn't initialized yet
        const locale = document.cookie
          .split(';')
          .find((c) => c.trim().startsWith('scrumooth_locale='))
          ?.split('=')[1];
        if (locale) {
          config.headers['Accept-Language'] = locale;
        }
      }

      const method = config.method?.toUpperCase();
      if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        let csrfToken = getCsrfTokenFromCookie();
        csrfToken ??= await fetchCsrfToken();
        if (csrfToken) {
          config.headers[CSRF_HEADER_NAME] = csrfToken;
        }
      }

      if (
        import.meta.env.DEV &&
        (config.url?.includes('/items/') || config.url?.includes('/action-items/'))
      ) {
        logger.debug('API Request Debug', undefined, {
          baseURL: config.baseURL,
          requestURL: config.url,
          fullURL: config.baseURL + config.url,
          method: config.method,
          data: config.data,
        });
      }

      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiResponse<never>>) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
          _retry?: boolean;
          _csrfRetry?: boolean;
        };
        const requestUrl = originalRequest.url ?? '';

        const isAuthEndpoint =
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/register') ||
          requestUrl.includes('/auth/refresh');

        const isLoginPage = getCurrentPath() === '/login' || getCurrentPath() === '/register';

        if (
          error.response?.status === 403 &&
          !originalRequest._csrfRetry &&
          error.response.data.error?.message.includes('CSRF')
        ) {
          originalRequest._csrfRetry = true;

          const newCsrfToken = await fetchCsrfToken();
          if (newCsrfToken) {
            originalRequest.headers[CSRF_HEADER_NAME] = newCsrfToken;
            return this.api(originalRequest);
          }
        }

        if (
          error.response?.status === 401 &&
          !isAuthEndpoint &&
          !originalRequest._retry &&
          !isLoginPage
        ) {
          originalRequest._retry = true;

          try {
            await this.refreshToken();
            return this.api(originalRequest);
          } catch (refreshError) {
            onLogout?.();
            navigateTo('/login');
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshToken(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.api
      .post('/auth/refresh')
      .then(() => {
        // Token refreshed successfully via httpOnly cookie
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  setCurrentTeamContext(teamId: string): void {
    this.currentTeamId = teamId;
  }

  clearTeamContext(): void {
    this.currentTeamId = null;
  }

  get axiosInstance(): AxiosInstance {
    return this.api;
  }
}

export const coreApiService = new CoreApiService();
