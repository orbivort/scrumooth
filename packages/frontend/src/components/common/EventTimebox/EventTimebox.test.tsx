import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { initTestI18n } from '@/test-utils';

import { EventTimebox } from './EventTimebox';
import type { TimeboxState } from '../../../types';

const { currentRole, currentTeamId, mockStore } = vi.hoisted(() => {
  const currentRole = { value: 'scrum_master' };
  const currentTeamId = { value: 'team-1' };
  return {
    currentRole,
    currentTeamId,
    mockStore: {
      useTeamStore: () => ({
        currentTeamId: currentTeamId.value,
        userRoleInCurrentTeam: currentRole.value,
      }),
    },
  };
});

vi.mock('../../../store', () => mockStore);

vi.mock('./EventTimebox.module.css', () => ({
  default: {
    timebox: 'timebox',
    icon: 'icon',
    value: 'value',
    'value-unit': 'value-unit',
    status: 'status',
    'live-dot': 'live-dot',
    warning: 'warning',
    overtime: 'overtime',
    running: 'running',
    controls: 'controls',
    progress: 'progress',
    'progress-fill': 'progress-fill',
    'control-button': 'control-button',
    'start-button': 'start-button',
    'pause-button': 'pause-button',
    'reset-button': 'reset-button',
  },
}));

const { timeboxServiceMock } = vi.hoisted(() => {
  return {
    timeboxServiceMock: {
      getTimebox: vi.fn(),
      startTimebox: vi.fn(),
      pauseTimebox: vi.fn(),
      resetTimebox: vi.fn(),
    },
  };
});

// The component uses the swapped `apiService` (mock in dev, real otherwise), so the
// test mocks `apiService` from the services index rather than the domain service.
vi.mock('../../../services', () => ({
  apiService: timeboxServiceMock,
}));

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const baseState: TimeboxState = {
  teamId: 'team-1',
  eventType: 'dailyScrum',
  sprintId: 'sprint-1',
  date: '2026-08-22T00:00:00.000Z',
  status: 'IDLE',
  elapsedMs: 0,
  timeboxSeconds: 15 * 60,
  version: 0,
};

describe('EventTimebox Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    currentRole.value = 'scrum_master';
    currentTeamId.value = 'team-1';
    timeboxServiceMock.getTimebox.mockReset();
    timeboxServiceMock.startTimebox.mockReset();
    timeboxServiceMock.pauseTimebox.mockReset();
    timeboxServiceMock.resetTimebox.mockReset();
  });

  it('renders an idle timebox with start and reset controls for a Scrum Master', async () => {
    timeboxServiceMock.getTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    expect(await screen.findByText('Idle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('includes the active teamId when fetching the timebox (team-scoped request)', async () => {
    timeboxServiceMock.getTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    await screen.findByText('Idle');
    expect(timeboxServiceMock.getTimebox).toHaveBeenCalledWith(
      'dailyScrum',
      expect.objectContaining({ teamId: 'team-1', sprintId: 'sprint-1' })
    );
  });

  it('disables controls for a non-Scrum-Master (view-only transparency)', async () => {
    currentRole.value = 'DEVELOPERS';
    timeboxServiceMock.getTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    expect(await screen.findByText('Idle')).toBeInTheDocument();
    const start = screen.getByRole('button', { name: 'Start' });
    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(start).toBeDisabled();
    expect(reset).toBeDisabled();
    // The disabled reason is surfaced as a tooltip so it's clear this is a role
    // restriction (Scrum Master only), not a broken control.
    expect(start).toHaveAttribute('title', 'Only the Scrum Master can control the timebox');
    expect(reset).toHaveAttribute('title', 'Only the Scrum Master can control the timebox');
  });

  it('renders an empty state (no timer) when there is no active team', async () => {
    currentTeamId.value = null;
    timeboxServiceMock.getTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    expect(await screen.findByText('Select a team to start the timer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('shows the overtime label when the timebox has been exceeded', async () => {
    timeboxServiceMock.getTimebox.mockResolvedValue({
      success: true,
      data: {
        ...baseState,
        status: 'RUNNING',
        elapsedMs: 16 * 60 * 1000, // 16 minutes, past the 15-minute Daily Scrum timebox
      },
    });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    expect(await screen.findByText('Over time')).toBeInTheDocument();
  });

  it('formats a multi-hour countdown as H:MM:SS and exposes it via the timer aria-label', async () => {
    timeboxServiceMock.getTimebox.mockResolvedValue({
      success: true,
      data: { ...baseState, elapsedMs: 0, timeboxSeconds: 2 * 60 * 60 },
    });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    await waitFor(() =>
      expect(screen.getByRole('timer')).toHaveAttribute('aria-label', 'Time remaining: 2:00:00')
    );
  });

  it('shows the warning styling when little time remains', async () => {
    timeboxServiceMock.getTimebox.mockResolvedValue({
      success: true,
      data: { ...baseState, status: 'RUNNING', elapsedMs: 14 * 60 * 1000 },
    });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    expect(await screen.findByText('Running')).toBeInTheDocument();
    // 1 minute remaining of a 15-minute timebox is <= 10% → warning styling.
    expect(screen.getByRole('timer').className).toContain('warning');
  });

  it('starts the timebox when the Start control is clicked', async () => {
    const user = userEvent.setup();
    timeboxServiceMock.getTimebox.mockResolvedValue({ success: true, data: baseState });
    timeboxServiceMock.startTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    await screen.findByText('Idle');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(timeboxServiceMock.startTimebox).toHaveBeenCalled());
  });

  it('pauses a running timebox when the Pause control is clicked', async () => {
    const user = userEvent.setup();
    timeboxServiceMock.getTimebox.mockResolvedValue({
      success: true,
      data: { ...baseState, status: 'RUNNING', elapsedMs: 60 * 1000 },
    });
    timeboxServiceMock.pauseTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    expect(await screen.findByText('Running')).toBeInTheDocument();
    const pause = screen.getByRole('button', { name: 'Pause' });
    expect(pause).not.toBeDisabled();

    await user.click(pause);

    await waitFor(() => expect(timeboxServiceMock.pauseTimebox).toHaveBeenCalled());
  });

  it('resets the timebox when the Reset control is clicked', async () => {
    const user = userEvent.setup();
    timeboxServiceMock.getTimebox.mockResolvedValue({ success: true, data: baseState });
    timeboxServiceMock.resetTimebox.mockResolvedValue({ success: true, data: baseState });

    renderWithClient(<EventTimebox event="dailyScrum" sprintId="sprint-1" />);

    await screen.findByText('Idle');
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(timeboxServiceMock.resetTimebox).toHaveBeenCalled());
  });
});
