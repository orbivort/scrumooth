import { afterEach, describe, expect, it } from 'vitest';

import { DEMO_TODAY, installDemoClock, restoreDemoClock } from './demoClock';
import { FROZEN_NOW, TODAY } from './fixtures/clock';

/**
 * The demo clock is the piece that makes the frozen universe hold together: the
 * Daily Scrum page asks for the record of *its* day, so the day the interface
 * believes in has to be the day the seed was written on.
 *
 * These cases pin both halves of that: the clock stands still where the seed is
 * anchored, and everything a caller does with a date they named themselves keeps
 * working — a frozen default must not become a broken `Date`.
 */
describe('the demo clock', () => {
  afterEach(() => {
    restoreDemoClock();
  });

  it('resolves the frozen day to a fixed calendar date', () => {
    expect(DEMO_TODAY).toBe('2026-09-25');
  });

  it('leaves the real constructor in place until it is installed', () => {
    const real = Date;

    installDemoClock();
    expect(Date).not.toBe(real);

    restoreDemoClock();
    expect(Date).toBe(real);
  });

  it('answers "now" with the demo instant, and keeps answering it', async () => {
    installDemoClock();

    const first = new Date();
    expect(Date.now()).toBe(FROZEN_NOW.getTime());
    expect(first.getTime()).toBe(FROZEN_NOW.getTime());

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(Date.now()).toBe(FROZEN_NOW.getTime());
    expect(new Date().getTime()).toBe(first.getTime());
  });

  it('still constructs, parses and formats a date the caller named', () => {
    installDemoClock();

    // Long form on purpose: the frozen patch has to pass a spread of arguments
    // through to the real constructor, not swallow it.
    expect(new Date(2026, 8, 25, 11, 0, 0).getTime()).toBe(FROZEN_NOW.getTime());
    expect(new Date(2026, 8, 25).getTime()).toBe(TODAY.getTime());
    expect(new Date(0).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(new Date(FROZEN_NOW).getTime()).toBe(FROZEN_NOW.getTime());
    expect(Date.parse('1970-01-01T00:00:01.000Z')).toBe(1000);
    expect(Date.UTC(1970, 0, 1)).toBe(0);
  });

  it('hands out instances the application can still recognise as dates', () => {
    installDemoClock();

    expect(new Date()).toBeInstanceOf(Date);
    expect(Number.isNaN(new Date('not a date').getTime())).toBe(true);
  });
});
