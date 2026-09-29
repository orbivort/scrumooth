import {
  timeboxFor,
  type ScrumEvent,
  type TimeboxState,
  type TimeboxStatus,
} from '@scrumooth/shared';

import { weeksOf } from '../fixtures/cadence';

import { database } from './db';

/**
 * The Scrum event clocks.
 *
 * A timebox is a maximum, not a target: the tool reports how much of it an event
 * has used and never hard-stops one, because the team decides when its event is
 * over. That is also why a clock is working state rather than a record — it is
 * not part of the team's history until the event concludes.
 *
 * Elapsed time is derived rather than accumulated once a second: the state holds
 * what the clock has banked and when it was last started, so a reload, or a
 * second tab, reads the same number instead of a counter that only advances
 * while one tab is open.
 */

/**
 * The Sprint length assumed when a team has neither a running Sprint nor a
 * configured cadence to read one from.
 */
const DEFAULT_SPRINT_WEEKS = 2;

interface TimeboxRecord {
  status: TimeboxStatus;
  /** Milliseconds banked by completed running periods. */
  bankedMs: number;
  /** When the current running period started, or null when the clock is stopped. */
  startedAt: number | null;
  sprintId: string | null;
  version: number;
}

const clocks = new Map<string, TimeboxRecord>();

function keyOf(teamId: string, eventType: string, date: string): string {
  return `${teamId}:${eventType}:${date}`;
}

function blank(sprintId: string | null): TimeboxRecord {
  return { status: 'IDLE', bankedMs: 0, startedAt: null, sprintId, version: 0 };
}

/** The Sprint length in weeks, which every month-scaled timebox derives from. */
function sprintWeeks(teamId: string): number {
  const db = database();
  const active = db.sprints.find(
    (sprint) => sprint.teamId === teamId && sprint.status === 'active'
  );

  if (active) {
    const days =
      (new Date(active.endDate).getTime() - new Date(active.startDate).getTime()) / 86_400_000;
    return Math.max(Math.round(days / 7), 1);
  }

  // Nothing running, which is a team that has not started one or has just closed
  // one: scale by the cadence it has configured rather than by an absent Sprint.
  const configured = db.sprintConfigurations.find((config) => config.teamId === teamId);
  return configured ? weeksOf(configured.duration) : DEFAULT_SPRINT_WEEKS;
}

export function timeboxStateOf(
  teamId: string,
  eventType: ScrumEvent,
  sprintId: string | null,
  date: string
): TimeboxState {
  const record = clocks.get(keyOf(teamId, eventType, date)) ?? blank(sprintId);
  const runningMs =
    record.status === 'RUNNING' && record.startedAt !== null ? Date.now() - record.startedAt : 0;

  return {
    teamId,
    eventType,
    sprintId: record.sprintId ?? sprintId,
    date,
    status: record.status,
    elapsedMs: record.bankedMs + runningMs,
    timeboxSeconds: timeboxFor(eventType, sprintWeeks(teamId)),
    version: record.version,
  };
}

/** Applies a write to a clock and returns the state the caller reads back. */
export function transitionTimebox(
  teamId: string,
  eventType: ScrumEvent,
  sprintId: string | null,
  date: string,
  action: 'start' | 'pause' | 'reset' | 'conclude'
): TimeboxState {
  const key = keyOf(teamId, eventType, date);
  const current = clocks.get(key) ?? blank(sprintId);

  const banked =
    current.status === 'RUNNING' && current.startedAt !== null
      ? current.bankedMs + (Date.now() - current.startedAt)
      : current.bankedMs;

  const next: TimeboxRecord = {
    status: current.status,
    bankedMs: banked,
    startedAt: null,
    sprintId: sprintId ?? current.sprintId,
    version: current.version + 1,
  };

  switch (action) {
    case 'start':
      next.status = 'RUNNING';
      // Resuming after a pause continues the clock; a start from idle begins it.
      next.bankedMs = current.status === 'IDLE' ? 0 : banked;
      next.startedAt = Date.now();
      break;
    case 'pause':
      next.status = 'PAUSED';
      break;
    case 'reset':
      next.status = 'IDLE';
      next.bankedMs = 0;
      break;
    case 'conclude':
      // The event is over: the clock stops and keeps what it measured, so how
      // long the event actually took survives it.
      next.status = 'IDLE';
      break;
  }

  clocks.set(key, next);
  return timeboxStateOf(teamId, eventType, sprintId, date);
}

/**
 * Whether any of a Sprint's events has run past its timebox.
 *
 * Only a stopped clock can be over its box: a running one has not finished
 * spending the time, so calling it exceeded would be an accusation the evidence
 * does not support yet.
 */
export function isTimeboxExceeded(teamId: string, sprintId: string, date: string): boolean {
  const events: ScrumEvent[] = ['sprintPlanning', 'dailyScrum', 'sprintReview', 'retrospective'];

  return events.some((eventType) => {
    const state = timeboxStateOf(teamId, eventType, sprintId, date);
    return (
      state.status !== 'RUNNING' &&
      state.elapsedMs > 0 &&
      state.elapsedMs > state.timeboxSeconds * 1000
    );
  });
}

/** Forgets every clock, which is what a full mock reset does. */
export function clearTimeboxes(): void {
  clocks.clear();
}
