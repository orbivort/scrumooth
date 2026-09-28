import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders, initTestI18n } from '../../../test-utils';
import { useTeamStore } from '../../../store';
import { apiService } from '../../../services';

import { DailyScrumSchedule } from './DailyScrumSchedule';

// Mock the CSS module - return the class name as-is
vi.mock('./DailyScrumSchedule.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (target, prop) => prop,
    }
  ),
}));

vi.mock('../../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(() => ({ user: { id: 'user-1' } })),
}));

vi.mock('../../../services', () => ({
  apiService: {
    getDailyScrumSchedule: vi.fn(),
    saveDailyScrumSchedule: vi.fn(),
    getDailyScrumNonWorkingDays: vi.fn(),
    addDailyScrumNonWorkingDay: vi.fn(),
    deleteDailyScrumNonWorkingDay: vi.fn(),
  },
}));

const originalConsoleError = console.error;

const storedSchedule = {
  id: 'schedule-1',
  teamId: 'team-123',
  timezone: 'Europe/Berlin',
  startMinute: 570,
  location: 'Room 4',
  locationUrl: null,
  workingDays: [1, 2, 3, 4, 5],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
};

const storedException = {
  id: 'nwd-1',
  teamId: 'team-123',
  date: '2026-12-25',
  name: 'Christmas Day',
  createdAt: '2026-08-01T10:00:00.000Z',
};

describe('DailyScrumSchedule Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();

    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: { id: 'team-123', name: 'Test Team' },
      userRoleInCurrentTeam: 'SCRUM_MASTER',
    });

    vi.mocked(apiService.getDailyScrumSchedule).mockResolvedValue({
      success: true,
      data: storedSchedule,
    });
    vi.mocked(apiService.getDailyScrumNonWorkingDays).mockResolvedValue({
      success: true,
      data: [storedException],
    });
    vi.mocked(apiService.saveDailyScrumSchedule).mockResolvedValue({
      success: true,
      data: storedSchedule,
    });
    vi.mocked(apiService.addDailyScrumNonWorkingDay).mockResolvedValue({
      success: true,
      data: storedException,
    });
    vi.mocked(apiService.deleteDailyScrumNonWorkingDay).mockResolvedValue({
      success: true,
      data: null,
    });
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('loads the standing commitment into the form', async () => {
    renderWithProviders(<DailyScrumSchedule />);

    expect(await screen.findByTestId('daily-scrum-schedule')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Start time')).toHaveValue('09:30');
    });
    expect(screen.getByLabelText('Time zone')).toHaveValue('Europe/Berlin');
    expect(screen.getByLabelText('Room or place')).toHaveValue('Room 4');
  });

  it('lists the recorded non-working days for the year', async () => {
    renderWithProviders(<DailyScrumSchedule />);

    expect(await screen.findByText('2026-12-25')).toBeInTheDocument();
    expect(screen.getByText('Christmas Day')).toBeInTheDocument();
  });

  it('explains what an exception is for when none is recorded', async () => {
    vi.mocked(apiService.getDailyScrumNonWorkingDays).mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<DailyScrumSchedule />);

    expect(await screen.findByText(/no exceptions recorded for this year/i)).toBeInTheDocument();
  });

  it('saves the commitment as minutes past midnight', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const timeInput = await screen.findByLabelText('Start time');
    await waitFor(() => expect(timeInput).toHaveValue('09:30'));

    await user.clear(timeInput);
    await user.type(timeInput, '10:15');

    const saveButton = screen.getByRole('button', { name: /save schedule/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => {
      expect(apiService.saveDailyScrumSchedule).toHaveBeenCalledWith(
        'team-123',
        expect.objectContaining({
          timezone: 'Europe/Berlin',
          startMinute: 615,
          location: 'Room 4',
          workingDays: [1, 2, 3, 4, 5],
        })
      );
    });
  });

  it('summarises the working week as a count of days', async () => {
    renderWithProviders(<DailyScrumSchedule />);

    expect(await screen.findByText(/the team works 5 days a week/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Fri' }));

    expect(screen.getByText(/the team works 4 days a week/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Fri' })).toHaveAttribute('aria-checked', 'false');
  });

  it('warns without blocking when every working day is deselected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    await screen.findByTestId('daily-scrum-schedule');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await user.click(screen.getByRole('checkbox', { name: day }));
    }

    expect(screen.getByText(/no working days selected/i)).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /save schedule/i });
    await user.click(saveButton);
    expect(apiService.saveDailyScrumSchedule).not.toHaveBeenCalled();
  });

  it('records a non-working day', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const dateInput = await screen.findByLabelText('Date');
    await user.type(dateInput, '2026-11-11');
    await user.type(screen.getByLabelText('Name'), 'Company day');

    await user.click(screen.getByRole('button', { name: /add day/i }));

    await waitFor(() => {
      expect(apiService.addDailyScrumNonWorkingDay).toHaveBeenCalledWith('team-123', {
        date: '2026-11-11',
        name: 'Company day',
      });
    });
  });

  it('removes a recorded non-working day', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const removeButton = await screen.findByRole('button', {
      name: /remove the exception on 2026-12-25/i,
    });
    await user.click(removeButton);

    await waitFor(() => {
      expect(apiService.deleteDailyScrumNonWorkingDay).toHaveBeenCalledWith('team-123', 'nwd-1');
    });
  });

  it('lets a non-Scrum-Master read the commitment but not change it', async () => {
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: { id: 'team-123', name: 'Test Team' },
      userRoleInCurrentTeam: 'DEVELOPERS',
    });

    renderWithProviders(<DailyScrumSchedule />);

    expect(await screen.findByTestId('daily-scrum-schedule')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/only the scrum master/i);
    expect(screen.queryByRole('button', { name: /save schedule/i })).not.toBeInTheDocument();
  });

  it('refuses to save a commitment that records no place', async () => {
    vi.mocked(apiService.getDailyScrumSchedule).mockResolvedValue({
      success: true,
      data: { ...storedSchedule, location: null, locationUrl: null },
    });

    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const timeInput = await screen.findByLabelText('Start time');
    await waitFor(() => expect(timeInput).toHaveValue('09:30'));

    // Change the time so the save bar becomes actionable, then try to save with no place.
    await user.clear(timeInput);
    await user.type(timeInput, '11:00');

    const saveButton = screen.getByRole('button', { name: /save schedule/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    expect(apiService.saveDailyScrumSchedule).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Record a room, a meeting link, or both.'
      );
    });
  });

  it('names the current team on the reads it makes', async () => {
    renderWithProviders(<DailyScrumSchedule />);

    await screen.findByTestId('daily-scrum-schedule');

    expect(apiService.getDailyScrumSchedule).toHaveBeenCalledWith('team-123');
    expect(apiService.getDailyScrumNonWorkingDays).toHaveBeenCalledWith(
      'team-123',
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
    );
  });

  it('reports a commitment it could not read instead of showing an empty one', async () => {
    vi.mocked(apiService.getDailyScrumSchedule).mockRejectedValue(
      new Error('Team context is required')
    );

    renderWithProviders(<DailyScrumSchedule />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load Daily Scrum Schedule.'
    );
    expect(screen.queryByRole('button', { name: /save schedule/i })).not.toBeInTheDocument();
  });

  it('shows the no-team empty state when no team is selected', () => {
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: null,
      userRoleInCurrentTeam: 'SCRUM_MASTER',
    });

    renderWithProviders(<DailyScrumSchedule />);

    expect(screen.getByText('No Team Selected')).toBeInTheDocument();
  });

  it('falls back to the curated time zone list when the platform lookup throws', async () => {
    const intl = Intl as unknown as { supportedValuesOf: (key: string) => string[] };
    const spy = vi.spyOn(intl, 'supportedValuesOf').mockImplementation(() => {
      throw new Error('not supported');
    });

    try {
      renderWithProviders(<DailyScrumSchedule />);
      expect(await screen.findByTestId('daily-scrum-schedule')).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('reports no next meeting when the stored working days match no weekday', async () => {
    vi.mocked(apiService.getDailyScrumSchedule).mockResolvedValue({
      success: true,
      data: { ...storedSchedule, workingDays: [0] },
    });

    renderWithProviders(<DailyScrumSchedule />);

    expect(
      await screen.findByText(/select at least one working day to see when the team next meets/i)
    ).toBeInTheDocument();
  });

  it('retries both reads when the load failed', async () => {
    vi.mocked(apiService.getDailyScrumSchedule).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();

    renderWithProviders(<DailyScrumSchedule />);

    const alert = await screen.findByRole('alert');
    const retry = alert.querySelector('button') as HTMLButtonElement;
    const callsBefore = vi.mocked(apiService.getDailyScrumSchedule).mock.calls.length;

    await user.click(retry);

    await waitFor(() => {
      expect(vi.mocked(apiService.getDailyScrumSchedule).mock.calls.length).toBeGreaterThan(
        callsBefore
      );
    });
  });

  it('updates the time zone when a different zone is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const select = await screen.findByLabelText('Time zone');
    const targetOption = Array.from(select.querySelectorAll('option'))
      .map((option) => (option as HTMLOptionElement).value)
      .find((value) => value !== 'Europe/Berlin');
    expect(targetOption).toBeDefined();

    await user.selectOptions(select, targetOption!);

    expect(select).toHaveValue(targetOption);
  });

  it('records the room and the meeting link', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const location = await screen.findByLabelText('Room or place');
    await user.clear(location);
    await user.type(location, 'Room 12');

    const url = screen.getByLabelText('Meeting link');
    await user.type(url, 'https://meet.example.com/x');

    expect(location).toHaveValue('Room 12');
    expect(url).toHaveValue('https://meet.example.com/x');
  });

  it('adds a working day that was not selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    await screen.findByTestId('daily-scrum-schedule');
    await user.click(screen.getByRole('checkbox', { name: 'Sat' }));

    expect(screen.getByRole('checkbox', { name: 'Sat' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/the team works 6 days a week/i)).toBeInTheDocument();
  });

  it('resets the form to the stored commitment', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const time = await screen.findByLabelText('Start time');
    await waitFor(() => expect(time).toHaveValue('09:30'));

    await user.clear(time);
    await user.type(time, '11:45');

    const reset = screen.getByRole('button', { name: /reset/i });
    await waitFor(() => expect(reset).toBeEnabled());
    await user.click(reset);

    await waitFor(() => expect(time).toHaveValue('09:30'));
  });

  it('refuses to save an unparseable start time', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const time = await screen.findByLabelText('Start time');
    await waitFor(() => expect(time).toHaveValue('09:30'));

    await user.clear(time);

    const save = screen.getByRole('button', { name: /save schedule/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(apiService.saveDailyScrumSchedule).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Enter a valid start time.')
    );
  });

  it('refuses to save an unknown time zone', async () => {
    vi.mocked(apiService.getDailyScrumSchedule).mockResolvedValue({
      success: true,
      data: { ...storedSchedule, timezone: 'Not/AZone' },
    });

    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const time = await screen.findByLabelText('Start time');
    await waitFor(() => expect(time).toHaveValue('09:30'));

    await user.clear(time);
    await user.type(time, '10:00');

    const save = screen.getByRole('button', { name: /save schedule/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    expect(apiService.saveDailyScrumSchedule).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Choose a time zone the system recognises.'
      )
    );
  });

  it('reports a save failure', async () => {
    vi.mocked(apiService.saveDailyScrumSchedule).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const time = await screen.findByLabelText('Start time');
    await waitFor(() => expect(time).toHaveValue('09:30'));

    await user.clear(time);
    await user.type(time, '10:30');

    const save = screen.getByRole('button', { name: /save schedule/i });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Could not save the schedule.')
    );
  });

  it('reports a failure to record a non-working day', async () => {
    vi.mocked(apiService.addDailyScrumNonWorkingDay).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    const date = await screen.findByLabelText('Date');
    await user.type(date, '2026-10-10');
    await user.click(screen.getByRole('button', { name: /add day/i }));

    await waitFor(() => expect(screen.getByText('Could not record that day.')).toBeInTheDocument());
  });

  it('reports a failure to remove a non-working day', async () => {
    vi.mocked(apiService.deleteDailyScrumNonWorkingDay).mockRejectedValue(new Error('nope'));
    const user = userEvent.setup();
    renderWithProviders(<DailyScrumSchedule />);

    await user.click(
      await screen.findByRole('button', { name: /remove the exception on 2026-12-25/i })
    );

    await waitFor(() => expect(screen.getByText('Could not remove that day.')).toBeInTheDocument());
  });
});
