import { describe, it, expect, vi, beforeEach } from 'vitest';

import { dailyScrumScheduleService } from './dailyScrumSchedule.service';
import { coreApiService } from '../core/api.core';
import type { DailyScrumSchedule, TeamNonWorkingDay } from '../../types';

vi.mock('../core/api.core', () => ({
  coreApiService: {
    axiosInstance: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const TEAM_ID = 'team-123';

const storedSchedule: DailyScrumSchedule = {
  id: 'schedule-1',
  teamId: TEAM_ID,
  timezone: 'Europe/Berlin',
  startMinute: 570,
  location: 'Room 4',
  locationUrl: null,
  workingDays: [1, 2, 3, 4, 5],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
};

const storedException: TeamNonWorkingDay = {
  id: 'nwd-1',
  teamId: TEAM_ID,
  date: '2026-12-25',
  name: 'Christmas Day',
  createdAt: '2026-08-01T10:00:00.000Z',
};

/**
 * The API resolves the team from the request itself, so these assertions are the client half of
 * that contract. A call that dropped the team identifier is answered with "Team context is
 * required", and the page then falls back to an empty form that looks like a real commitment.
 */
describe('DailyScrumScheduleService team scoping', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for the commitment in the team scope', async () => {
    vi.mocked(mockApi.get).mockResolvedValue({ data: { success: true, data: storedSchedule } });

    const result = await dailyScrumScheduleService.getSchedule(TEAM_ID);

    expect(mockApi.get).toHaveBeenCalledWith('/daily-scrum-schedule', {
      params: { teamId: TEAM_ID },
    });
    expect(result.data?.startMinute).toBe(570);
  });

  it('sends the team alongside the commitment it writes', async () => {
    vi.mocked(mockApi.put).mockResolvedValue({ data: { success: true, data: storedSchedule } });

    await dailyScrumScheduleService.saveSchedule(TEAM_ID, {
      timezone: 'Europe/Berlin',
      startMinute: 570,
      location: 'Room 4',
      locationUrl: null,
      workingDays: [1, 2, 3, 4, 5],
    });

    expect(mockApi.put).toHaveBeenCalledWith('/daily-scrum-schedule', {
      timezone: 'Europe/Berlin',
      startMinute: 570,
      location: 'Room 4',
      locationUrl: null,
      workingDays: [1, 2, 3, 4, 5],
      teamId: TEAM_ID,
    });
  });

  it('scopes the non-working-day window to the team', async () => {
    vi.mocked(mockApi.get).mockResolvedValue({ data: { success: true, data: [storedException] } });

    const result = await dailyScrumScheduleService.listNonWorkingDays(TEAM_ID, {
      from: '2026-01-01',
      to: '2026-12-31',
    });

    expect(mockApi.get).toHaveBeenCalledWith('/daily-scrum-schedule/non-working-days', {
      params: { from: '2026-01-01', to: '2026-12-31', teamId: TEAM_ID },
    });
    expect(result.data).toHaveLength(1);
  });

  it('sends the team alongside a recorded non-working day', async () => {
    vi.mocked(mockApi.post).mockResolvedValue({ data: { success: true, data: storedException } });

    await dailyScrumScheduleService.addNonWorkingDay(TEAM_ID, {
      date: '2026-12-25',
      name: 'Christmas Day',
    });

    expect(mockApi.post).toHaveBeenCalledWith('/daily-scrum-schedule/non-working-days', {
      date: '2026-12-25',
      name: 'Christmas Day',
      teamId: TEAM_ID,
    });
  });

  it('scopes the removal of a non-working day to the team', async () => {
    vi.mocked(mockApi.delete).mockResolvedValue({ data: { success: true, data: null } });

    await dailyScrumScheduleService.deleteNonWorkingDay(TEAM_ID, 'nwd-1');

    expect(mockApi.delete).toHaveBeenCalledWith('/daily-scrum-schedule/non-working-days/nwd-1', {
      params: { teamId: TEAM_ID },
    });
  });
});
