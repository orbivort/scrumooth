/**
 * The route gate.
 *
 * Two behaviours are why this file exists. A named role list is a boundary: someone outside it gets
 * the refusal panel instead of the page, which is the reachability half of hiding an entry from the
 * sidebar. And an unresolved role is not a refusal: the role arrives with the team context a moment
 * after sign-in, so reading "no role yet" as "not allowed" would refuse the very people the route is
 * for -- and the reader would see a denial flash that corrects itself.
 */
import React from 'react';
import { MemoryRouter } from 'react-router';
import { render, screen, initTestI18n, i18nT } from '../test-utils';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '../store';
import { useTeamContext } from '../contexts/TeamContext';

vi.mock('../store', () => ({ useAuthStore: vi.fn() }));
vi.mock('../contexts/TeamContext', () => ({ useTeamContext: vi.fn() }));
// The shell owns the sidebar, the topbar and the providers around them. The gate's own decision is
// what is under test, so the shell is reduced to a marker that proves it was reached.
vi.mock('../components/Layout/Sidebar', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

const authState = (overrides: Record<string, unknown> = {}): never =>
  ({ isAuthenticated: true, isLoading: false, ...overrides }) as never;

const teamState = (overrides: Record<string, unknown> = {}): never =>
  ({ userRole: 'PRODUCT_OWNER', isLoading: false, ...overrides }) as never;

const renderGuard = (roles?: string[]) =>
  render(
    <MemoryRouter>
      <ProtectedRoute roles={roles}>
        <p>guarded page</p>
      </ProtectedRoute>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.mocked(useAuthStore).mockReturnValue(authState());
    vi.mocked(useTeamContext).mockReturnValue(teamState());
  });

  it('should render the page for a role the entry names', () => {
    vi.mocked(useTeamContext).mockReturnValue(teamState({ userRole: 'SCRUM_MASTER' }));

    renderGuard(['PRODUCT_OWNER', 'SCRUM_MASTER']);

    expect(screen.getByText('guarded page')).toBeInTheDocument();
  });

  it('should refuse a role the entry does not name, and say why on the page', () => {
    vi.mocked(useTeamContext).mockReturnValue(teamState({ userRole: 'DEVELOPERS' }));

    renderGuard(['PRODUCT_OWNER', 'SCRUM_MASTER']);

    expect(screen.queryByText('guarded page')).not.toBeInTheDocument();
    expect(screen.getByTestId('access-denied')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: i18nT('common:accessDenied.title') })
    ).toBeInTheDocument();
  });

  it('should refuse a reader whose role is unknown once the context has settled', () => {
    // No team yet, or a team the reader does not belong to: there is no role to admit.
    vi.mocked(useTeamContext).mockReturnValue(teamState({ userRole: null }));

    renderGuard(['PRODUCT_OWNER', 'SCRUM_MASTER']);

    expect(screen.getByTestId('access-denied')).toBeInTheDocument();
  });

  it('should wait for a role that is still loading rather than refuse it', () => {
    vi.mocked(useTeamContext).mockReturnValue(teamState({ userRole: null, isLoading: true }));

    renderGuard(['PRODUCT_OWNER', 'SCRUM_MASTER']);

    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
    // Waiting looks like loading, which is the whole point: no denial is shown to correct itself.
    expect(screen.getByText(i18nT('common:loading'))).toBeInTheDocument();
  });

  it('should admit every authenticated role when the entry names none', () => {
    vi.mocked(useTeamContext).mockReturnValue(teamState({ userRole: 'DEVELOPERS' }));

    renderGuard();

    expect(screen.getByText('guarded page')).toBeInTheDocument();
  });

  it('should keep sending a signed-out reader to the sign-in page', () => {
    vi.mocked(useAuthStore).mockReturnValue(authState({ isAuthenticated: false }));

    renderGuard(['PRODUCT_OWNER', 'SCRUM_MASTER']);

    expect(screen.queryByText('guarded page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-denied')).not.toBeInTheDocument();
  });
});
