// Main Application Component

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Layout } from './components/Layout/Sidebar';
import { ErrorBoundary, PageErrorBoundary } from './components/ErrorBoundary';
import { SessionWarningModal } from './components/SessionWarning/SessionWarningModal';
import { PageLoader } from './components/common/Page/PageLoader';
import { ChunkErrorBoundary } from './components/common/Form/ChunkErrorBoundary';
import { AnnouncerProvider } from './components/LiveAnnouncer';
import { GlobalToastContainer } from './components/common/ToastContainer/GlobalToastContainer';
import { LoginPage } from './pages/Auth/LoginPage';
import { ForgotPasswordPage } from './pages/Auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/Auth/ResetPasswordPage';
import { useAuthStore, useSessionStore, setQueryClient, initializeStoreSideEffects } from './store';
import { TeamProvider, TeamInitializer } from './contexts/TeamContext';
import { apiService } from './services';
import { logger } from './utils/logger';
import { getRouterBasename } from './utils/navigation';
import { I18nProvider } from './i18n/I18nProvider';
import { initI18n } from './i18n/config';
import loadingStyles from './components/common/Loading/LoadingState.module.css';
import {
  LazyDashboard as Dashboard,
  LazyDailyScrum as DailyScrum,
  LazyImpediments as Impediments,
  LazySprintConfiguration as SprintConfiguration,
  LazyDailyScrumSchedule as DailyScrumSchedulePage,
  LazyTeamGroupsPage as TeamGroupsPage,
  LazyProductBacklog as ProductBacklog,
  LazyProductGoalsPage as ProductGoalsPage,
  LazySprintPlanning as SprintPlanning,
  LazySprintBoard as SprintBoard,
  LazyTeamManagement as TeamManagement,
  LazyTeamManagementPage as TeamManagementPage,
  LazyReports as Reports,
  LazyIncrementList as IncrementList,
  LazyIncrementDetail as IncrementDetail,
  LazyIncrementCreate as IncrementCreate,
  LazySprintReviewList as SprintReviewList,
  LazySprintReview as SprintReview,
  LazySprintRetrospective as SprintRetrospective,
  LazyRetrospectiveList as RetrospectiveList,
  LazyNotifications as Notifications,
  LazyPrivacyData as PrivacyData,
  LazyIconGallery as IconGallery,
} from './routes/lazyComponents';
import { LegacyDefinitionRedirect } from './routes/LegacyDefinitionRedirect';

const ROUTER_BASENAME = getRouterBasename();

// Initialize i18n early (returns a promise but we let it resolve asynchronously;
// the bundled en/common namespace ensures no flash of untranslated text)
void initI18n();

// Lazy Route wrapper component
const LazyRoute: React.FC<{
  children: React.ReactNode;
  fallbackMessage?: string;
}> = ({ children, fallbackMessage = 'Loading page...' }) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<PageLoader message={fallbackMessage} />}>{children}</Suspense>
  </ChunkErrorBoundary>
);

// Create a query client with enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors
        if (error instanceof Error) {
          const status = (error as Error & { status?: number }).status;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading } = useAuthStore();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Prevent infinite loading - timeout after 5 seconds
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading]);

  // Show loading state while checking authentication (with timeout protection)
  if (isLoading && !loadingTimeout) {
    return (
      <div className={loadingStyles['loading-screen']}>
        <div className={loadingStyles['loading-spinner']} />
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

// Auth Callback Initializer Component
const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('common');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initTimeout, setInitTimeout] = useState(false);
  const { isAuthenticated, setUser, logout } = useAuthStore();
  const { initializeSession } = useSessionStore();

  // Prevent infinite initializing - timeout after 5 seconds
  useEffect(() => {
    if (!isInitialized) {
      const timer = setTimeout(() => {
        setInitTimeout(true);
        logger.warn('Auth initialization timeout - forcing completion');
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isInitialized]);

  useEffect(() => {
    const checkAuth = async () => {
      // With cookie-based auth, just check if user is authenticated
      // Tokens are managed via httpOnly cookies, not localStorage
      if (isAuthenticated) {
        try {
          const response = await apiService.getCurrentUser();
          if (response.success && response.data) {
            setUser(response.data);

            const storedSessionConfig = localStorage.getItem('sessionConfig');
            if (storedSessionConfig) {
              try {
                const parsedConfig = JSON.parse(storedSessionConfig);
                initializeSession({
                  expiresAt: new Date(parsedConfig.expiresAt),
                  idleTimeoutMs: parsedConfig.idleTimeoutMs,
                  absoluteTimeoutMs: parsedConfig.absoluteTimeoutMs,
                  warningThresholdMs: parsedConfig.warningThresholdMs,
                });
              } catch (e) {
                logger.warn('Failed to parse stored session config', undefined, { error: e });
              }
            }
          }
        } catch {
          void logout();
        }
      }

      setIsInitialized(true);
    };

    void checkAuth();
  }, [isAuthenticated, setUser, logout, initializeSession]);

  if (!isInitialized && !initTimeout) {
    return (
      <div className={loadingStyles['loading-screen']}>
        <div className={loadingStyles['loading-spinner']} />
        <p>{t('initializing')}</p>
      </div>
    );
  }

  return <>{children}</>;
};

// Session Warning Modal Wrapper Component
const SessionWarningWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showWarningModal, timeRemaining, extendSession } = useSessionStore();
  const { logout } = useAuthStore();

  const handleExtendSession = useCallback(async () => {
    await extendSession();
  }, [extendSession]);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  return (
    <>
      {children}
      <SessionWarningModal
        isOpen={showWarningModal}
        timeRemaining={timeRemaining}
        onExtendSession={() => {
          void handleExtendSession();
        }}
        onLogout={handleLogout}
      />
    </>
  );
};

// Main App Component
function App() {
  setQueryClient(queryClient);
  initializeStoreSideEffects();

  return (
    <ErrorBoundary>
      <GlobalToastContainer />
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <AnnouncerProvider>
            <Router basename={ROUTER_BASENAME}>
              <AuthInitializer>
                <SessionWarningWrapper>
                  <TeamProvider>
                    <TeamInitializer>
                      <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<LoginPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

                        {/* Protected Routes */}
                        <Route
                          path="/dashboard"
                          element={
                            <ProtectedRoute>
                              <LazyRoute>
                                <Dashboard />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/backlog"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading backlog...">
                                <ProductBacklog />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/product-goals"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading product goals...">
                                <ProductGoalsPage />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/sprint-planning"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading sprint planning...">
                                <SprintPlanning />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/sprint"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading sprint board...">
                                <SprintBoard />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/daily-scrum"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading daily scrum...">
                                <DailyScrum />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/impediments"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading impediments...">
                                <Impediments />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/team"
                          element={
                            <ProtectedRoute>
                              <PageErrorBoundary pageName="Team">
                                <LazyRoute fallbackMessage="Loading team...">
                                  <TeamManagement />
                                </LazyRoute>
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/team-management"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading team management...">
                                <TeamManagementPage />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/team-groups"
                          element={
                            <ProtectedRoute>
                              <PageErrorBoundary pageName="Team Groups">
                                <LazyRoute fallbackMessage="Loading team groups...">
                                  <TeamGroupsPage />
                                </LazyRoute>
                              </PageErrorBoundary>
                            </ProtectedRoute>
                          }
                        />
                        {/* The Definition of Done and the Definition of Ready are the team's own
                            agreements, so they are authored on the Definition tab of the Team
                            module. The addresses they used to live at are kept, so links and
                            bookmarks still land on the agreement they meant. */}
                        <Route
                          path="/settings/team-definitions"
                          element={<LegacyDefinitionRedirect />}
                        />
                        <Route
                          path="/settings/definition-of-done"
                          element={<LegacyDefinitionRedirect id="definition-of-done" />}
                        />
                        <Route
                          path="/reports"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading reports...">
                                <Reports />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        {/* The facilitation lens is the second tab of the Dashboard module; the
                            address it used to live at is kept, so bookmarks and shared links still
                            land on it. */}
                        <Route
                          path="/scrum-master-dashboard"
                          element={<Navigate to="/dashboard?tab=facilitation" replace />}
                        />
                        {/* The barrier register is the second tab of the Impediments module; the
                            address it used to live at is kept, so links and bookmarks still land
                            on it. */}
                        <Route
                          path="/organizational-barriers"
                          element={<Navigate to="/impediments?tab=barriers" replace />}
                        />
                        {/* The working agreements are the third section of the Team module's
                            Definition tab; the address they used to live at is kept, so links and
                            bookmarks still land on them. */}
                        <Route
                          path="/working-agreements"
                          element={<LegacyDefinitionRedirect id="working-agreements" />}
                        />
                        <Route
                          path="/settings/sprint-configuration"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading sprint configuration...">
                                <SprintConfiguration />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/daily-scrum-schedule"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading Daily Scrum schedule...">
                                <DailyScrumSchedulePage />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/privacy-data"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading privacy & data settings...">
                                <PrivacyData />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/increments"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading increments...">
                                <IncrementList />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/increment/:id"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading increment...">
                                <IncrementDetail />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/increment/create"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading increment creator...">
                                <IncrementCreate />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/sprint-review"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading sprint reviews...">
                                <SprintReviewList />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/sprint-review/:sprintId"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading sprint review...">
                                <SprintReview />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/retrospectives"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading retrospectives...">
                                <RetrospectiveList />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/retrospective/:sprintId"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading retrospective...">
                                <SprintRetrospective />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/notifications"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading notifications...">
                                <Notifications />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />

                        {/* Dev Tools - Icon Gallery (Protected) */}
                        <Route
                          path="/dev/icons"
                          element={
                            <ProtectedRoute>
                              <LazyRoute fallbackMessage="Loading icon gallery...">
                                <IconGallery />
                              </LazyRoute>
                            </ProtectedRoute>
                          }
                        />

                        {/* Default Route */}
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route path="*" element={<Navigate to="/login" replace />} />
                      </Routes>
                    </TeamInitializer>
                  </TeamProvider>
                </SessionWarningWrapper>
              </AuthInitializer>
            </Router>
          </AnnouncerProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App;
