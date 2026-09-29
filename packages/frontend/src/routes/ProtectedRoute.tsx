// The app's route gate: it decides whether the signed-in user may see what a route renders.
//
// `roles` is optional and defaults to open, so only a route that genuinely belongs to a role names
// its roles. The list and the role itself come from the same two sources the sidebar reads -- the
// entry's declared roles and the team context -- so what the navigation offers and what the router
// admits cannot drift apart.
//
// A refusal is rendered, not redirected: a stale bookmark should show why the page is not for the
// reader and leave them a way onward, rather than silently landing them somewhere else.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { Layout } from '../components/Layout/Sidebar';
import { AccessDenied } from '../components/common/AccessDenied';
import { hasAnyRole } from '../config/navigation';
import { useTeamContext } from '../contexts/TeamContext';
import { useAuthStore } from '../store';
import loadingStyles from '../components/common/Loading/LoadingState.module.css';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Roles that may see the route. Omitted or empty means every authenticated user. */
  roles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading } = useAuthStore();
  const { userRole, isLoading: isRoleLoading } = useTeamContext();
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [roleTimeout, setRoleTimeout] = useState(false);

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

  // The caller's role arrives with the team context, so it is unknown for a moment after sign-in.
  // Waiting is the point: reading "no role yet" as a refusal would show the denial panel to someone
  // who holds the role. The same bound as the other loaders keeps a stuck request from spinning.
  useEffect(() => {
    if (isRoleLoading) {
      const timer = setTimeout(() => {
        setRoleTimeout(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isRoleLoading]);

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

  if (roles && roles.length > 0 && isRoleLoading && !roleTimeout) {
    return (
      <div className={loadingStyles['loading-screen']}>
        <div className={loadingStyles['loading-spinner']} />
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (!hasAnyRole(userRole, roles)) {
    return (
      <Layout>
        <AccessDenied />
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
};

export default ProtectedRoute;
