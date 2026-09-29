/**
 * RetrospectiveList — container boundaries.
 *
 * Three of the list's branches live outside the happy path: the no-team guard, the create panel's
 * own cancel, and the creation path when the signed-in user is not available. None of them is
 * reachable from the rendered card alone (the user is always present while a team is selected), so
 * they are driven from the container side. The CSS module is emptied so the `?? ''` fallbacks in
 * the status helpers are observable too.
 */
import React from 'react';
import {
  screen,
  waitFor,
  fireEvent,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { RetrospectiveList } from './RetrospectiveList';
import { SprintStatus, RetrospectiveStatus } from '../../types';
import * as apiServiceModule from '../../services';
import * as storeModule from '../../store';
import { logger } from '../../utils/logger';

vi.mock('./RetrospectiveList.module.css', () => ({ default: {} }));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'Test',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
};

const completedSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T23:59:59Z',
  sprintGoal: 'Goal',
  status: SprintStatus.COMPLETED,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-14T23:59:59Z',
};

describe('RetrospectiveList coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(storeModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as never);
    vi.spyOn(storeModule, 'useAuthStore').mockReturnValue({
      user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
    } as never);
    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [completedSprint],
    });
    vi.spyOn(apiServiceModule.apiService, 'getRetrospectives').mockResolvedValue({
      success: true,
      data: [],
    });
    vi.spyOn(apiServiceModule.apiService, 'createRetrospective').mockResolvedValue({
      success: true,
      data: {},
    } as never);
  });

  it('should show the no-team empty state when no team is selected', () => {
    vi.spyOn(storeModule, 'useTeamStore').mockReturnValue({
      currentTeam: null,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as never);

    renderWithProviders(<RetrospectiveList />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('retrospective-list')).not.toBeInTheDocument();
  });

  it('should close the create panel when the Retrospective is not created', async () => {
    renderWithProviders(<RetrospectiveList />);

    await waitFor(() => expect(screen.getByText('Sprint 1')).toBeInTheDocument());

    fireEvent.click(screen.getByText(i18nT('retrospective:list.createRetrospective')));
    expect(screen.getByText(i18nT('retrospective:list.createConfirm'))).toBeInTheDocument();

    fireEvent.click(screen.getByText(i18nT('retrospective:list.createCancel')));

    expect(screen.queryByText(i18nT('retrospective:list.createConfirm'))).not.toBeInTheDocument();
    expect(apiServiceModule.apiService.createRetrospective).not.toHaveBeenCalled();
  });

  it('should refuse to create a Retrospective when the signed-in user is unknown', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(storeModule, 'useAuthStore').mockReturnValue({ user: null } as never);

    renderWithProviders(<RetrospectiveList />);

    await waitFor(() => expect(screen.getByText('Sprint 1')).toBeInTheDocument());

    fireEvent.click(screen.getByText(i18nT('retrospective:list.createRetrospective')));
    fireEvent.click(screen.getByText(i18nT('retrospective:list.createConfirm')));

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(apiServiceModule.apiService.createRetrospective).not.toHaveBeenCalled();
    // The failed creation releases the pending flag so the panel can be used again.
    expect(screen.getByText(i18nT('retrospective:list.createConfirm'))).toBeInTheDocument();
  });

  it('should report progress on the card whose Retrospective is being created', async () => {
    vi.spyOn(apiServiceModule.apiService, 'createRetrospective').mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<RetrospectiveList />);

    await waitFor(() => expect(screen.getByText('Sprint 1')).toBeInTheDocument());

    fireEvent.click(screen.getByText(i18nT('retrospective:list.createRetrospective')));
    fireEvent.click(screen.getByText(i18nT('retrospective:list.createConfirm')));

    await waitFor(() =>
      expect(screen.getByText(i18nT('retrospective:list.creating'))).toBeInTheDocument()
    );
  });

  it('should mark a completed Retrospective in the header statistics', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getRetrospectives').mockResolvedValue({
      success: true,
      data: [
        {
          id: 'retro-1',
          sprintId: 'sprint-1',
          teamId: 'team-1',
          retroDate: '2026-01-15',
          facilitatorId: 'user-1',
          status: RetrospectiveStatus.COMPLETED,
          participants: [],
          attendees: [],
          items: [],
          actionItems: [],
          isAnonymous: false,
          createdAt: '2026-01-15T00:00:00Z',
          updatedAt: '2026-01-15T00:00:00Z',
        },
      ],
    });

    renderWithProviders(<RetrospectiveList />);

    await waitFor(() => expect(screen.getByText('Sprint 1')).toBeInTheDocument());

    expect(screen.getByText(i18nT('retrospective:list.reviewed'))).toBeInTheDocument();
  });
});
