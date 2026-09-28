/**
 * API base URL configuration.
 *
 * Deliberately dependency-free. The mock backend's URL helpers (`src/mocks/support/http.ts`)
 * need the base URL and nothing else, and importing it from `services/core/api.core` would
 * drag the whole axios client — its interceptors, the session callbacks and the i18n
 * singleton — into the mock layer's module graph. That matters beyond tidiness: `setupTests.ts`
 * loads the handler registry before any test file runs, so anything the registry pulls in is
 * evaluated ahead of a test file's `vi.mock(...)` registrations, which is how a mocked `axios`
 * or `i18next` silently stops being mocked.
 *
 * Keeping the value here means there is still exactly one definition of the API base URL,
 * while `services/core/api.core.ts` remains the only place an HTTP client is created.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api/v1';
