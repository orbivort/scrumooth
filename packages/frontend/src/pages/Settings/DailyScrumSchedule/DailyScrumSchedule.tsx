import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_WORKING_DAYS,
  addDays,
  formatStartMinute,
  isKnownTimeZone,
  isWorkingDay,
  parseStartMinute,
  toIsoDate,
  type WorkingDayCalendar,
} from '@scrumooth/shared';

import { apiService } from '../../../services';
import { useTeamStore } from '../../../store';
import { queryKeys } from '../../../hooks/queryKeys';
import { useToast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/common/ToastContainer';
import { EmptyState } from '../../../components/EmptyState';
import { Button } from '../../../components/common/Button';
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  PlusIcon,
  SunIcon,
  TrashIcon,
} from '../../../components/common/Icons';

import styles from './DailyScrumSchedule.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

/** Weekday labels, Monday first, so the picker reads like a working week. */
const WEEKDAY_LABELS = {
  1: 'dailyScrumSchedule.weekdays.monday',
  2: 'dailyScrumSchedule.weekdays.tuesday',
  3: 'dailyScrumSchedule.weekdays.wednesday',
  4: 'dailyScrumSchedule.weekdays.thursday',
  5: 'dailyScrumSchedule.weekdays.friday',
  6: 'dailyScrumSchedule.weekdays.saturday',
  7: 'dailyScrumSchedule.weekdays.sunday',
} as const;

type IsoWeekday = keyof typeof WEEKDAY_LABELS;

const WEEKDAY_ORDER: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

const FALLBACK_TIME_ZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/**
 * The zones the runtime can resolve, with the values already in use kept reachable even if the
 * platform's list is unavailable.
 */
const buildTimeZoneOptions = (...inUse: Array<string | undefined>): string[] => {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;

  let supported: string[];
  try {
    supported = supportedValuesOf ? supportedValuesOf('timeZone') : [];
  } catch {
    // The platform either does not implement `Intl.supportedValuesOf` or refused the lookup;
    // the curated list below still leaves every zone in use selectable.
    supported = [];
  }

  const options = new Set(supported.length > 0 ? supported : FALLBACK_TIME_ZONES);
  for (const value of inUse) {
    if (value) {
      options.add(value);
    }
  }
  return [...options].sort((a, b) => a.localeCompare(b));
};

const isExceptionInThePast = (isoDate: string, todayIso: string): boolean => isoDate < todayIso;

export const DailyScrumSchedule: React.FC = () => {
  const { t } = useTranslation(['settings', 'errors']);
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { locale } = useI18nStore();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { toasts, success: showSuccessToast, error: showErrorToast, removeToast } = useToast();

  const teamId = currentTeam?.id;
  const isScrumMaster = userRoleInCurrentTeam?.toUpperCase() === 'SCRUM_MASTER';
  const browserTimeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  );

  const [startTime, setStartTime] = useState('09:30');
  const [timezone, setTimezone] = useState(browserTimeZone);
  const [locationName, setLocationName] = useState('');
  const [locationUrl, setLocationUrl] = useState('');
  const [workingDays, setWorkingDays] = useState<number[]>([...DEFAULT_WORKING_DAYS]);
  const [newExceptionDate, setNewExceptionDate] = useState('');
  const [newExceptionName, setNewExceptionName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const todayIso = toIsoDate(new Date()) ?? '';
  const windowFrom = `${year}-01-01`;
  const windowTo = `${year}-12-31`;

  const {
    data: scheduleData,
    isLoading: isScheduleLoading,
    isError: isScheduleError,
    refetch: refetchSchedule,
  } = useQuery({
    queryKey: queryKeys.dailyScrumSchedule.byTeam(teamId ?? ''),
    queryFn: () => apiService.getDailyScrumSchedule(teamId ?? ''),
    enabled: !!teamId,
  });

  const {
    data: exceptionsData,
    isLoading: isExceptionsLoading,
    isError: isExceptionsError,
    refetch: refetchExceptions,
  } = useQuery({
    queryKey: queryKeys.dailyScrumSchedule.nonWorkingDays(teamId ?? '', windowFrom, windowTo),
    queryFn: () =>
      apiService.getDailyScrumNonWorkingDays(teamId ?? '', { from: windowFrom, to: windowTo }),
    enabled: !!teamId,
  });

  const schedule = scheduleData?.data ?? null;
  const exceptions = useMemo(() => exceptionsData?.data ?? [], [exceptionsData]);

  // A commitment that could not be read is not the same as a team that has not recorded one: the
  // form below falls back to defaults, so rendering it after a failure would invent a schedule.
  const hasLoadError = isScheduleError || isExceptionsError;

  // Load the stored commitment into the form once, and whenever it changes underneath us.
  useEffect(() => {
    if (!schedule) {
      return;
    }
    setStartTime(formatStartMinute(schedule.startMinute) || '09:30');
    setTimezone(schedule.timezone);
    setLocationName(schedule.location ?? '');
    setLocationUrl(schedule.locationUrl ?? '');
    setWorkingDays(
      schedule.workingDays.length > 0 ? [...schedule.workingDays] : [...DEFAULT_WORKING_DAYS]
    );
  }, [schedule]);

  const timeZoneOptions = useMemo(
    () => buildTimeZoneOptions(browserTimeZone, schedule?.timezone, timezone),
    [browserTimeZone, schedule?.timezone, timezone]
  );

  const calendar: WorkingDayCalendar = useMemo(
    () => ({
      workingDays,
      nonWorkingDays: exceptions.map((exception) => exception.date),
    }),
    [workingDays, exceptions]
  );

  /** The next day the team is due to meet, from today forward. */
  const nextDailyScrum = useMemo(() => {
    if (!todayIso || workingDays.length === 0) {
      return null;
    }
    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = offset === 0 ? todayIso : addDays(todayIso, offset);
      if (candidate && isWorkingDay(candidate, calendar)) {
        return candidate;
      }
    }
    return null;
  }, [todayIso, workingDays.length, calendar]);

  const startMinute = parseStartMinute(startTime);
  const hasPlace = Boolean(locationName.trim() || locationUrl.trim());

  const isDirty = useMemo(() => {
    if (!schedule) {
      return (
        startTime !== '09:30' ||
        locationName.trim() !== '' ||
        locationUrl.trim() !== '' ||
        workingDays.join(',') !== DEFAULT_WORKING_DAYS.join(',')
      );
    }
    return (
      (startMinute ?? -1) !== schedule.startMinute ||
      timezone !== schedule.timezone ||
      locationName.trim() !== (schedule.location ?? '') ||
      locationUrl.trim() !== (schedule.locationUrl ?? '') ||
      workingDays.join(',') !== [...schedule.workingDays].sort((a, b) => a - b).join(',')
    );
  }, [schedule, startTime, startMinute, timezone, locationName, locationUrl, workingDays]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiService.saveDailyScrumSchedule(teamId ?? '', {
        timezone,
        // The form validates the time before this runs, so the fallback is unreachable.
        startMinute: startMinute ?? 0,
        location: locationName.trim() || null,
        locationUrl: locationUrl.trim() || null,
        workingDays,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyScrumSchedule.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyScrum.all });
      setFormError(null);
      showSuccessToast(t('dailyScrumSchedule.toast.saved'), 3000);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? t('dailyScrumSchedule.toast.saveFailed');
      setFormError(message);
      showErrorToast(message, 5000);
    },
  });

  const addExceptionMutation = useMutation({
    mutationFn: () =>
      apiService.addDailyScrumNonWorkingDay(teamId ?? '', {
        date: newExceptionDate,
        name: newExceptionName.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyScrumSchedule.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyScrum.all });
      setNewExceptionDate('');
      setNewExceptionName('');
      showSuccessToast(t('dailyScrumSchedule.toast.exceptionAdded'), 3000);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? t('dailyScrumSchedule.toast.exceptionAddFailed');
      showErrorToast(message, 5000);
    },
  });

  const deleteExceptionMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteDailyScrumNonWorkingDay(teamId ?? '', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyScrumSchedule.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyScrum.all });
      showSuccessToast(t('dailyScrumSchedule.toast.exceptionRemoved'), 3000);
    },
    onError: () => {
      showErrorToast(t('dailyScrumSchedule.toast.exceptionRemoveFailed'), 5000);
    },
  });

  const toggleWorkingDay = useCallback((weekday: number) => {
    setWorkingDays((previous) =>
      previous.includes(weekday)
        ? previous.filter((day) => day !== weekday)
        : [...previous, weekday].sort((a, b) => a - b)
    );
  }, []);

  const handleRetryLoad = useCallback(() => {
    void refetchSchedule();
    void refetchExceptions();
  }, [refetchSchedule, refetchExceptions]);

  const handleReset = useCallback(() => {
    setStartTime(formatStartMinute(schedule?.startMinute ?? 570) || '09:30');
    setTimezone(schedule?.timezone ?? browserTimeZone);
    setLocationName(schedule?.location ?? '');
    setLocationUrl(schedule?.locationUrl ?? '');
    setWorkingDays(
      schedule && schedule.workingDays.length > 0
        ? [...schedule.workingDays]
        : [...DEFAULT_WORKING_DAYS]
    );
    setFormError(null);
  }, [schedule, browserTimeZone]);

  const handleSave = useCallback(() => {
    if (startMinute === null) {
      setFormError(t('dailyScrumSchedule.validation.timeInvalid'));
      return;
    }
    if (!isKnownTimeZone(timezone)) {
      setFormError(t('dailyScrumSchedule.validation.timezoneInvalid'));
      return;
    }
    if (!hasPlace) {
      setFormError(t('dailyScrumSchedule.validation.placeRequired'));
      return;
    }
    if (workingDays.length === 0) {
      setFormError(t('dailyScrumSchedule.validation.workingDayRequired'));
      return;
    }
    setFormError(null);
    saveMutation.mutate();
  }, [startMinute, timezone, hasPlace, workingDays.length, saveMutation, t]);

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (isScheduleLoading || isExceptionsLoading) {
    return (
      <div className={styles['loading-container']}>
        <div className={styles['loading-spinner']} />
        <p className={styles['loading-text']}>{t('dailyScrumSchedule.loading')}</p>
      </div>
    );
  }

  const readOnly = !isScrumMaster;

  const pageHeader = (
    <header className={styles['header']}>
      <div className={styles['header-left']}>
        <h1 className={styles['page-title']}>
          <span className={styles['page-title-icon']}>
            <SunIcon />
          </span>
          {t('dailyScrumSchedule.title')}
        </h1>
        <p className={styles['page-subtitle']}>{t('dailyScrumSchedule.subtitle')}</p>
      </div>
      {location.state?.from === 'daily-scrum' && (
        <Link to="/daily-scrum" className={styles['return-link']}>
          <span className={styles['return-link-icon']}>
            <ArrowLeftIcon size={16} />
          </span>
          {t('dailyScrumSchedule.backToDailyScrum')}
        </Link>
      )}
    </header>
  );

  // The form below would silently fall back to defaults after a failed read, which would present
  // an invented commitment with the same confidence as a stored one. Say so instead, and offer
  // the one action that can help.
  if (hasLoadError) {
    return (
      <div className={styles['page']} data-testid="daily-scrum-schedule">
        {pageHeader}
        <div className={styles['load-error']} role="alert">
          <p className={styles['load-error-message']}>
            {t('errors:workflow.loadFailed', { resource: t('dailyScrumSchedule.title') })}
          </p>
          <Button type="button" variant="secondary" size="md" onClick={handleRetryLoad}>
            {t('errors:generic.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['page']} data-testid="daily-scrum-schedule">
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {pageHeader}

      {readOnly && (
        <p className={styles['read-only-note']} role="status">
          {t('dailyScrumSchedule.readOnlyNote')}
        </p>
      )}

      <div className={styles['cards']}>
        <section className={styles['card']} aria-labelledby="cadence-heading">
          <div className={styles['card-heading']}>
            <span className={styles['card-heading-icon']}>
              <ClockIcon size={18} />
            </span>
            <h2 id="cadence-heading" className={styles['card-title']}>
              {t('dailyScrumSchedule.cadence.title')}
            </h2>
          </div>

          <div className={styles['field-grid']}>
            <div className={styles['field']}>
              <label className={styles['field-label']} htmlFor="daily-scrum-start-time">
                {t('dailyScrumSchedule.cadence.startTime')}
              </label>
              <input
                id="daily-scrum-start-time"
                type="time"
                className={styles['input']}
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                disabled={readOnly}
                required
              />
              <span className={styles['field-hint']}>
                {startMinute === null
                  ? t('dailyScrumSchedule.validation.timeInvalid')
                  : t('dailyScrumSchedule.cadence.preview', {
                      time: formatStartMinute(startMinute),
                    })}
              </span>
            </div>

            <div className={styles['field']}>
              <label className={styles['field-label']} htmlFor="daily-scrum-timezone">
                {t('dailyScrumSchedule.cadence.timezone')}
              </label>
              <select
                id="daily-scrum-timezone"
                className={styles['input']}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                disabled={readOnly}
              >
                {timeZoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
              <span className={styles['field-hint']}>
                {t('dailyScrumSchedule.cadence.timezoneHint')}
              </span>
            </div>
          </div>

          <div className={styles['field-grid']}>
            <div className={styles['field']}>
              <label className={styles['field-label']} htmlFor="daily-scrum-location">
                {t('dailyScrumSchedule.cadence.location')}
              </label>
              <input
                id="daily-scrum-location"
                type="text"
                className={styles['input']}
                value={locationName}
                maxLength={200}
                placeholder={t('dailyScrumSchedule.cadence.locationPlaceholder')}
                onChange={(event) => setLocationName(event.target.value)}
                disabled={readOnly}
              />
            </div>

            <div className={styles['field']}>
              <label className={styles['field-label']} htmlFor="daily-scrum-location-url">
                {t('dailyScrumSchedule.cadence.locationUrl')}
              </label>
              <input
                id="daily-scrum-location-url"
                type="url"
                className={styles['input']}
                value={locationUrl}
                placeholder="https://"
                onChange={(event) => setLocationUrl(event.target.value)}
                disabled={readOnly}
              />
              <span className={styles['field-hint']}>
                {t('dailyScrumSchedule.cadence.placeHint')}
              </span>
            </div>
          </div>

          <p className={styles['next-meeting']}>
            <CalendarIcon size={16} />
            {nextDailyScrum
              ? t('dailyScrumSchedule.cadence.nextMeeting', {
                  date: new Intl.DateTimeFormat(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }).format(new Date(`${nextDailyScrum}T00:00:00`)),
                  time: formatStartMinute(startMinute ?? 0),
                  timezone,
                })
              : t('dailyScrumSchedule.cadence.noWorkingDays')}
          </p>
        </section>

        <section className={styles['card']} aria-labelledby="working-week-heading">
          <div className={styles['card-heading']}>
            <span className={styles['card-heading-icon']}>
              <CheckCircleIcon size={18} />
            </span>
            <h2 id="working-week-heading" className={styles['card-title']}>
              {t('dailyScrumSchedule.workingWeek.title')}
            </h2>
          </div>

          <fieldset className={styles['fieldset']} disabled={readOnly}>
            <legend className={styles['visually-hidden']}>
              {t('dailyScrumSchedule.workingWeek.legend')}
            </legend>
            <div className={styles['chips']}>
              {WEEKDAY_ORDER.map((weekday) => {
                const selected = workingDays.includes(weekday);
                return (
                  <button
                    key={weekday}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    className={`${styles['chip']} ${selected ? styles['chip-selected'] : ''}`}
                    onClick={() => toggleWorkingDay(weekday)}
                  >
                    {t(WEEKDAY_LABELS[weekday])}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p className={styles['field-hint']}>
            {workingDays.length === 0
              ? t('dailyScrumSchedule.workingWeek.noneSelected')
              : t('dailyScrumSchedule.workingWeek.summary', { count: workingDays.length })}
          </p>
        </section>

        <section className={styles['card']} aria-labelledby="exceptions-heading">
          <div className={styles['card-heading']}>
            <span className={styles['card-heading-icon']}>
              <CalendarIcon size={18} />
            </span>
            <h2 id="exceptions-heading" className={styles['card-title']}>
              {t('dailyScrumSchedule.exceptions.title', { year })}
            </h2>
          </div>

          {exceptions.length === 0 ? (
            <p className={styles['empty-note']}>{t('dailyScrumSchedule.exceptions.empty')}</p>
          ) : (
            <ul className={styles['exception-list']}>
              {exceptions.map((exception) => (
                <li
                  key={exception.id}
                  className={`${styles['exception-row']} ${
                    isExceptionInThePast(exception.date, todayIso)
                      ? styles['exception-row-past']
                      : ''
                  }`}
                >
                  <span className={styles['exception-date']}>{exception.date}</span>
                  <span className={styles['exception-name']}>
                    {exception.name ?? t('dailyScrumSchedule.exceptions.unnamed')}
                  </span>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      aria-label={t('dailyScrumSchedule.exceptions.removeLabel', {
                        date: exception.date,
                      })}
                      onClick={() => deleteExceptionMutation.mutate(exception.id)}
                      disabled={deleteExceptionMutation.isPending}
                    >
                      <TrashIcon size={16} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!readOnly && (
            <div className={styles['add-exception']}>
              <div className={styles['field']}>
                <label className={styles['field-label']} htmlFor="daily-scrum-exception-date">
                  {t('dailyScrumSchedule.exceptions.date')}
                </label>
                <input
                  id="daily-scrum-exception-date"
                  type="date"
                  className={styles['input']}
                  value={newExceptionDate}
                  onChange={(event) => setNewExceptionDate(event.target.value)}
                />
              </div>
              <div className={styles['field']}>
                <label className={styles['field-label']} htmlFor="daily-scrum-exception-name">
                  {t('dailyScrumSchedule.exceptions.name')}
                </label>
                <input
                  id="daily-scrum-exception-name"
                  type="text"
                  className={styles['input']}
                  value={newExceptionName}
                  maxLength={120}
                  placeholder={t('dailyScrumSchedule.exceptions.namePlaceholder')}
                  onChange={(event) => setNewExceptionName(event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => addExceptionMutation.mutate()}
                disabled={!newExceptionDate || addExceptionMutation.isPending}
              >
                <PlusIcon size={16} />
                {t('dailyScrumSchedule.exceptions.add')}
              </Button>
            </div>
          )}
        </section>
      </div>

      {!readOnly && (
        <div className={styles['save-bar']} data-testid="daily-scrum-schedule-save-bar">
          <span className={styles['save-status']} role="status" aria-live="polite">
            {formError ??
              (isDirty
                ? t('dailyScrumSchedule.saveBar.unsaved')
                : t('dailyScrumSchedule.saveBar.saved'))}
          </span>
          <div className={styles['save-actions']}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleReset}
              disabled={!isDirty || saveMutation.isPending}
            >
              {t('dailyScrumSchedule.saveBar.reset')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleSave}
              loading={saveMutation.isPending}
              disabled={!isDirty || saveMutation.isPending}
            >
              {t('dailyScrumSchedule.saveBar.save')}
            </Button>
          </div>
        </div>
      )}

      <p className={styles['footnote']}>
        <InfoIcon size={14} />
        {t('dailyScrumSchedule.footnote')}
      </p>
    </div>
  );
};

export default DailyScrumSchedule;
