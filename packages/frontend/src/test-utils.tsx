/* eslint-disable react-refresh/only-export-components --
   This is a test utility file that intentionally exports both React components
   (AllProviders) and helper functions (createTestQueryClient, renderWithProviders,
   createMockUser, etc.) for use in tests. Separating these would reduce cohesion
   and make the testing API less ergonomic. */
import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { DEFAULT_LOCALE, type Locale } from '@scrumooth/shared';

import {
  SprintStatus,
  TaskStatus,
  ItemStatus,
  MoSCoWPriority,
  type User,
  type Team,
  type Sprint,
  type Task,
  type ProductBacklogItem,
  type ProductGoal,
} from './types';
import { getTestI18nInstance } from './i18n/testConfig';

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  initialRoute?: string;
  locale?: Locale;
}

export const AllProviders: React.FC<AllProvidersProps> = ({
  children,
  queryClient = createTestQueryClient(),
  initialRoute = '/',
  locale: _locale = DEFAULT_LOCALE,
}) => {
  // Try to get the test i18n instance; if not yet initialized,
  // render without I18nextProvider (tests that mock react-i18next
  // at the module level don't need the real provider).
  let i18nInstance: ReturnType<typeof getTestI18nInstance> | null = null;
  try {
    i18nInstance = getTestI18nInstance();
  } catch {
    // i18n not initialized — component test likely mocks react-i18next itself
  }

  const content = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  if (i18nInstance) {
    return <I18nextProvider i18n={i18nInstance}>{content}</I18nextProvider>;
  }

  return content;
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialRoute?: string;
  locale?: Locale;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult => {
  const { queryClient, initialRoute, locale, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient} initialRoute={initialRoute} locale={locale}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
};

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const createMockTeam = (overrides: Partial<Team> = {}): Team => ({
  id: 'team-1',
  name: 'Test Team',
  description: 'Test team description',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
  ...overrides,
});

export const createMockSprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T23:59:59Z',
  status: SprintStatus.ACTIVE,
  sprintGoal: 'Test goal',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  sprintId: 'sprint-1',
  pbiId: 'pbi-1',
  title: 'Test Task',
  status: TaskStatus.TODO,
  assigneeId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

export const createMockBacklogItem = (
  overrides: Partial<ProductBacklogItem> = {}
): ProductBacklogItem => ({
  id: 'pbi-1',
  teamId: 'team-1',
  title: 'User Authentication',
  description: 'Implement user login/logout',
  status: ItemStatus.NEW,
  priority: MoSCoWPriority.MUST_HAVE,
  storyPoints: 8,
  businessValue: 8,
  labels: ['security', 'authentication'],
  acceptanceCriteria: 'Users can log in and out securely',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'user-1',
  ...overrides,
  // The position in the Product Backlog order is always a number, even though `overrides` is
  // partial, so the resolved value is applied after the spread.
  rank: overrides.rank ?? 1,
});

export const createMockProductGoal = (overrides: Partial<ProductGoal> = {}): ProductGoal => ({
  id: 'goal-1',
  teamId: 'team-1',
  title: 'Test Product Goal',
  description: 'Test goal description',
  status: 'ACTIVE',
  targetDate: '2026-12-31T00:00:00Z',
  successMetrics: 'Test metrics',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

export * from '@testing-library/react';
export {
  initTestI18n,
  changeTestLanguage,
  getTranslationForKey,
  getSupportedLocalesForTest,
} from './i18n/testConfig';
export {
  t as i18nT,
  tInLocale,
  i18nMatcher,
  i18nMatchersForAllLocales,
  getByI18nText,
  getAllByI18nText,
  queryByI18nText,
  getByI18nRole,
  getByI18nLabelText,
  getByI18nPlaceholderText,
  createLocaleTestHelper,
  type LocaleTestHelper,
} from './test-utils/i18nHelpers';
