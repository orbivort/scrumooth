import '@testing-library/jest-dom';
import 'vi-axe/extend-expect';
import { vi, afterEach, afterAll, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

import { MOCK_TEST_ON_UNHANDLED_REQUEST } from './mocks/config';
import { server } from './mocks/server';
import { resetMockState } from './mocks/store';

// Extend Vitest expect with vi-axe matchers

// i18n is initialized globally in src/globalSetup.ts before all tests run

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
  server.listen({ onUnhandledRequest: MOCK_TEST_ON_UNHANDLED_REQUEST });
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
