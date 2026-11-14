import '@testing-library/jest-dom';
import 'vi-axe/extend-expect';
import { vi, afterEach, afterAll, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import axios from 'axios';

import { MOCK_TEST_ON_UNHANDLED_FRAME } from './mocks/config';
import { server } from './mocks/server';
import { resetMockState } from './mocks/store';

// Extend Vitest expect with vi-axe matchers

// i18n is initialized globally in src/globalSetup.ts before all tests run

const fetchAdapter = axios.getAdapter('fetch');
const testOrigin = globalThis.location?.origin ?? 'http://localhost';

/**
 * Answer the API client's requests with axios' fetch adapter.
 *
 * MSW 3 intercepts jsdom's `XMLHttpRequest` through the ClientRequest it opens
 * internally, and in this environment the mocked response never makes it back to
 * the XHR: every request through `CoreApiService` (whose axios default is the XHR
 * adapter) would wait for its timeout instead of being answered. `fetch` is
 * intercepted directly and answers normally.
 *
 * The base URL is resolved to an absolute one on the way in, because the client
 * configures a same-origin path (`/api/v1`) that a browser resolves against the
 * document but Node's fetch refuses. `mocks/support/http.ts` resolves the same
 * base against the same origin, so handler patterns still match.
 *
 * This is a gap in the Node test environment, not in the product: the service
 * worker MSW registers in a browser intercepts XHR at the network layer, so
 * `pnpm dev`, the demo build and the E2E suite are unaffected. Setting the global
 * default here (rather than an `adapter` option in `api.core.ts`) keeps the
 * shipped client on the transport it uses everywhere else, and every application
 * instance is created after this module has run.
 *
 * Remove this once MSW routes jsdom XHR responses again — re-run
 * `src/mocks/handlers/*.handlers.test.ts` with this block deleted to check.
 */
axios.defaults.adapter = (config) =>
  fetchAdapter({
    ...config,
    baseURL: new URL(config.baseURL ?? '/', testOrigin).href,
  });

/**
 * The mock backend answers the HTTP layer for every test.
 *
 * One registry serves `pnpm dev`, the demo build and this file, so a request a
 * test makes is answered exactly as the browser would have it answered — which is
 * the point of mocking at the HTTP boundary rather than substituting services.
 * A test that mocks a service directly still works: it never reaches this.
 *
 * `error` on an unmatched request is deliberate. A test that reaches the network
 * would otherwise pass or fail depending on whether somebody happened to have a
 * backend running.
 */
beforeAll(() => {
  server.listen({ onUnhandledFrame: MOCK_TEST_ON_UNHANDLED_FRAME });
});

afterEach(() => {
  cleanup();
  // Any handler overridden by a test goes back to the shared one.
  server.resetHandlers();
  // Data, session and any armed failure scenario return to how they started, so
  // one test cannot leak state into the next.
  resetMockState();
});

afterAll(() => {
  server.close();
});

// Window-dependent mocks are skipped in non-DOM (e.g. node/SSR) test environments
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Mock window.confirm
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: vi.fn(() => true),
  });
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Create live region element for screen reader announcements
const createLiveRegion = () => {
  const existing = document.getElementById('sr-announcer');
  if (existing) return existing;

  const liveRegion = document.createElement('div');
  liveRegion.id = 'sr-announcer';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);
  return liveRegion;
};

// Mock LiveAnnouncer hooks
vi.mock('./components/LiveAnnouncer', () => ({
  useAnnouncement: () => ({
    announce: (message: string) => {
      const liveRegion = createLiveRegion();
      liveRegion.textContent = message;
    },
    announcer: null,
  }),
  useAnnounce: () => (message: string) => {
    const liveRegion = createLiveRegion();
    liveRegion.textContent = message;
  },
  AnnouncerProvider: ({ children }: { children: React.ReactNode }) => children,
  LiveAnnouncer: () => null,
}));
