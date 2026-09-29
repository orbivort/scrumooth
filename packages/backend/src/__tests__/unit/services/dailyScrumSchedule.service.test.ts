import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    dailyScrumSchedule: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teamNonWorkingDay: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

vi.mock('../../../i18n/requestT.js', () => ({
  t: vi.fn((key: string) => key),
}));

import {
  NON_WORKING_DAY_MAX_WINDOW_DAYS,
  buildWorkingDayCalendar,
  dailyScrumScheduleService,
  resolveCadenceWindow,
  toLocalIsoDate,
} from '../../../services/dailyScrumSchedule.service';
import prisma from '../../../utils/prisma';
import { NotFoundError } from '../../../utils/errors';

const scheduleRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'schedule-1',
  teamId: 'team-1',
  timezone: 'Europe/Berlin',
  startMinute: 570,
  location: 'Room 4',
  locationUrl: null,
  workingDays: [1, 2, 3, 4, 5],
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  createdBy: 'sm-1',
  updatedAt: new Date('2026-08-02T10:00:00.000Z'),
  updatedBy: 'sm-1',
  ...overrides,
});

const exceptionRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'nwd-1',
  teamId: 'team-1',
  date: new Date('2026-12-25T00:00:00.000Z'),
  name: 'Christmas Day',
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  createdBy: 'sm-1',
  updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  updatedBy: 'sm-1',
  ...overrides,
});

const validInput = {
  timezone: 'Europe/Berlin',
  startMinute: 570,
  location: 'Room 4',
  workingDays: [1, 2, 3, 4, 5],
};

describe('DailyScrumScheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.teamNonWorkingDay.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  describe('getSchedule', () => {
    it('returns null while the team has not recorded a commitment', async () => {
      await expect(dailyScrumScheduleService.getSchedule('team-1')).resolves.toBeNull();
    });

    it('publishes the commitment with instants as ISO strings', async () => {
      (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduleRow()
      );

      const schedule = await dailyScrumScheduleService.getSchedule('team-1');

      expect(schedule).toEqual({
        id: 'schedule-1',
        teamId: 'team-1',
        timezone: 'Europe/Berlin',
        startMinute: 570,
        location: 'Room 4',
        locationUrl: null,
        workingDays: [1, 2, 3, 4, 5],
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      });
    });
  });

  describe('saveSchedule', () => {
    it('records a new commitment with its audit trail', async () => {
      (prisma.dailyScrumSchedule.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduleRow()
      );

      await dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', validInput);

      expect(prisma.dailyScrumSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: 'team-1',
          timezone: 'Europe/Berlin',
          startMinute: 570,
          location: 'Room 4',
          workingDays: [1, 2, 3, 4, 5],
          createdBy: 'sm-1',
          updatedBy: 'sm-1',
        }),
      });
    });

    it('revises the existing commitment instead of creating a second one', async () => {
      (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'schedule-1',
      });
      (prisma.dailyScrumSchedule.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduleRow({ startMinute: 600 })
      );

      const result = await dailyScrumScheduleService.saveSchedule('sm-2', 'team-1', {
        ...validInput,
        startMinute: 600,
      });

      expect(prisma.dailyScrumSchedule.create).not.toHaveBeenCalled();
      expect(prisma.dailyScrumSchedule.update).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        data: expect.objectContaining({ startMinute: 600, updatedBy: 'sm-2' }),
      });
      expect(result.startMinute).toBe(600);
    });

    it('normalises the working week to whole ISO weekdays, Monday first', async () => {
      (prisma.dailyScrumSchedule.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduleRow()
      );

      await dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
        ...validInput,
        workingDays: [5, 1, 1, 3],
      });

      expect(prisma.dailyScrumSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ workingDays: [1, 3, 5] }),
      });
    });

    it('refuses a time zone the runtime cannot resolve', async () => {
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
          ...validInput,
          timezone: 'Mars/Olympus',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(prisma.dailyScrumSchedule.create).not.toHaveBeenCalled();
    });

    it('refuses a start outside the day', async () => {
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
          ...validInput,
          startMinute: 1440,
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', { ...validInput, startMinute: -1 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('refuses a working week with no working days in it', async () => {
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', { ...validInput, workingDays: [] })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
          ...validInput,
          workingDays: [0, 9],
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('refuses a schedule that records neither a room nor a link', async () => {
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
          ...validInput,
          location: null,
          locationUrl: null,
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('refuses a link whose scheme could be executed rather than followed', async () => {
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
          ...validInput,
          location: null,
          locationUrl: 'javascript:alert(1)',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
      await expect(
        dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
          ...validInput,
          location: null,
          locationUrl: 'not a url',
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('accepts a meeting link instead of a room', async () => {
      (prisma.dailyScrumSchedule.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduleRow()
      );

      await dailyScrumScheduleService.saveSchedule('sm-1', 'team-1', {
        ...validInput,
        location: null,
        locationUrl: 'https://meet.example.com/daily',
      });

      expect(prisma.dailyScrumSchedule.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          location: null,
          locationUrl: 'https://meet.example.com/daily',
        }),
      });
    });
  });

  describe('resolveWindow', () => {
    it('defaults to the current calendar year', () => {
      const window = dailyScrumScheduleService.resolveWindow();
      expect(window.from).toBe(`${new Date().getUTCFullYear()}-01-01`);
      expect(window.to).toBe(`${new Date().getUTCFullYear()}-12-31`);
    });

    it('refuses a window wider than a year', () => {
      expect(() =>
        dailyScrumScheduleService.resolveWindow({ from: '2020-01-01', to: '2026-12-31' })
      ).toThrow();
    });

    it('refuses a reversed or unparseable window', () => {
      expect(() =>
        dailyScrumScheduleService.resolveWindow({ from: '2026-12-31', to: '2026-01-01' })
      ).toThrow();
      expect(() => dailyScrumScheduleService.resolveWindow({ from: 'someday' })).toThrow();
    });

    it('allows a window of exactly the documented maximum', () => {
      const from = '2026-01-01';
      const to = new Date(
        Date.UTC(2026, 0, 1) + NON_WORKING_DAY_MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10);
      expect(() => dailyScrumScheduleService.resolveWindow({ from, to })).not.toThrow();
    });
  });

  describe('listNonWorkingDays', () => {
    it('maps stored exceptions onto calendar dates', async () => {
      (prisma.teamNonWorkingDay.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        exceptionRow(),
      ]);

      const exceptions = await dailyScrumScheduleService.listNonWorkingDays('team-1', {
        from: '2026-01-01',
        to: '2026-12-31',
      });

      expect(exceptions).toEqual([
        {
          id: 'nwd-1',
          teamId: 'team-1',
          date: '2026-12-25',
          name: 'Christmas Day',
          createdAt: '2026-08-01T10:00:00.000Z',
        },
      ]);
    });

    it('scopes the query to the team and the window', async () => {
      await dailyScrumScheduleService.listNonWorkingDays('team-1', {
        from: '2026-09-01',
        to: '2026-09-30',
      });

      expect(prisma.teamNonWorkingDay.findMany).toHaveBeenCalledWith({
        where: {
          teamId: 'team-1',
          date: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lte: new Date('2026-09-30T00:00:00.000Z'),
          },
        },
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('addNonWorkingDay', () => {
    it('records the exception as a calendar date', async () => {
      (prisma.teamNonWorkingDay.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        exceptionRow()
      );

      await dailyScrumScheduleService.addNonWorkingDay('sm-1', 'team-1', {
        date: '2026-12-25',
        name: 'Christmas Day',
      });

      expect(prisma.teamNonWorkingDay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: 'team-1',
          date: new Date('2026-12-25T00:00:00.000Z'),
          name: 'Christmas Day',
          createdBy: 'sm-1',
        }),
      });
    });

    it('refuses a date that does not exist', async () => {
      await expect(
        dailyScrumScheduleService.addNonWorkingDay('sm-1', 'team-1', { date: '2026-02-31' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('refuses an exception the team has already recorded', async () => {
      (prisma.teamNonWorkingDay.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'nwd-1',
      });

      await expect(
        dailyScrumScheduleService.addNonWorkingDay('sm-1', 'team-1', { date: '2026-12-25' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('answers a lost race with the same conflict as a duplicate', async () => {
      const uniqueViolation = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      (prisma.teamNonWorkingDay.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        uniqueViolation
      );

      await expect(
        dailyScrumScheduleService.addNonWorkingDay('sm-1', 'team-1', { date: '2026-12-25' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('refuses an over-long name', async () => {
      await expect(
        dailyScrumScheduleService.addNonWorkingDay('sm-1', 'team-1', {
          date: '2026-12-25',
          name: 'x'.repeat(121),
        })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('deleteNonWorkingDay', () => {
    it('removes an exception scoped to the team', async () => {
      (prisma.teamNonWorkingDay.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      await dailyScrumScheduleService.deleteNonWorkingDay('team-1', 'nwd-1');

      expect(prisma.teamNonWorkingDay.deleteMany).toHaveBeenCalledWith({
        where: { id: 'nwd-1', teamId: 'team-1' },
      });
    });

    it('reports a missing exception rather than silently succeeding', async () => {
      (prisma.teamNonWorkingDay.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 0,
      });

      await expect(
        dailyScrumScheduleService.deleteNonWorkingDay('team-1', 'nwd-1')
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('resolveCalendar', () => {
    it('composes the schedule, the exceptions and the calendar they produce', async () => {
      (prisma.dailyScrumSchedule.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        scheduleRow({ workingDays: [1, 2, 3, 4, 5, 6] })
      );
      (prisma.teamNonWorkingDay.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        exceptionRow(),
      ]);

      const resolved = await dailyScrumScheduleService.resolveCalendar('team-1', {
        from: '2026-12-01',
        to: '2026-12-31',
      });

      expect(resolved.schedule?.id).toBe('schedule-1');
      expect(resolved.calendar.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
      expect(resolved.calendar.nonWorkingDays).toEqual(['2026-12-25']);
      expect(resolved.window).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });

    it('falls back to the Monday-to-Friday week when nothing is configured', async () => {
      const resolved = await dailyScrumScheduleService.resolveCalendar('team-1', {
        from: '2026-01-01',
        to: '2026-12-31',
      });

      expect(resolved.schedule).toBeNull();
      expect(resolved.calendar.workingDays).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe('buildWorkingDayCalendar', () => {
  it('uses the configured week and normalises the exception dates', () => {
    const calendar = buildWorkingDayCalendar(scheduleRow({ workingDays: [2, 4] }), [
      { date: new Date('2026-12-25T00:00:00.000Z') },
      { date: new Date('2026-01-01T00:00:00.000Z') },
    ]);

    expect(calendar).toEqual({
      workingDays: [2, 4],
      nonWorkingDays: ['2026-01-01', '2026-12-25'],
    });
  });

  it('defaults to Monday-to-Friday with no schedule', () => {
    expect(buildWorkingDayCalendar(null, [])).toEqual({
      workingDays: [1, 2, 3, 4, 5],
      nonWorkingDays: [],
    });
  });
});

describe('resolveCadenceWindow', () => {
  /**
   * The window ends on today as a *local* wall-clock day, the convention this module -- and the
   * Daily Scrum module it shares its `@db.Date` column with -- reads and writes dates under
   * (`toLocalIsoDate`). Expectations have to name the same day: `toISOString()` reports UTC
   * components, which sit on the previous date between local midnight and the UTC offset, so
   * deriving them that way made these tests fail for the first hours of every day east of UTC.
   */
  const localToday = (): string => toLocalIsoDate(new Date());

  it('spans the earliest and latest dates it was given', () => {
    expect(
      resolveCadenceWindow([
        new Date('2026-09-18T00:00:00.000Z'),
        new Date('2026-09-07T00:00:00.000Z'),
      ])
    ).toEqual({ from: '2026-09-07', to: localToday() });
  });

  it('always includes today, so a finished Sprint still knows whether today is a working day', () => {
    const window = resolveCadenceWindow([new Date('2026-09-07T00:00:00.000Z')]);
    expect(window.from).toBe('2026-09-07');
    expect(window.to).toBe(localToday());
  });

  it('clamps a window wider than the calendar API accepts instead of throwing', () => {
    // A sweep over years of history must degrade to a bounded read -- the alternative is a
    // dashboard request failing outright because its oldest Sprint is too old.
    const window = resolveCadenceWindow([new Date('2020-01-06T00:00:00.000Z')]);

    expect(window.to).toBe(localToday());
    expect(window.from).not.toBe('2020-01-06');
    // The clamp keeps the most recent year, which is what a report is actually about.
    expect(() => dailyScrumScheduleService.resolveWindow(window)).not.toThrow();
  });

  it('ignores missing dates rather than failing on them', () => {
    const today = localToday();
    expect(resolveCadenceWindow([null, undefined])).toEqual({ from: today, to: today });
  });
});
