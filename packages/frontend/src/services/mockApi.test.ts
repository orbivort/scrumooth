import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiService } from './mockApi';
import { mockSprints, UUIDS } from './mockData';
import { SprintStatus, ImpedimentStatus, TaskStatus } from '../types';

describe('MockApiService', () => {
  describe('cancelSprint', () => {
    it('cancels an existing sprint and sets its status to CANCELLED', async () => {
      const result = await mockApiService.cancelSprint('sprint-3', 'Scope re-prioritized');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(SprintStatus.CANCELLED);
      expect(result.data?.cancellationReason).toBe('Scope re-prioritized');
      // The shared store should reflect the cancellation.
      const sprintInStore = mockSprints.find((s) => s.id === 'sprint-3');
      expect(sprintInStore?.status).toBe(SprintStatus.CANCELLED);
    });

    it('returns NOT_FOUND when the sprint does not exist', async () => {
      const result = await mockApiService.cancelSprint('sprint-does-not-exist', 'Reason');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('promoteImpedimentFromDailyScrum', () => {
    beforeEach(async () => {
      // Ensure a Daily Scrum exists for today's date in the mock store.
      const existing = await mockApiService.getDailyScrum(UUIDS.teams.alpha);
      if (!existing.data) {
        await mockApiService.createDailyScrum(UUIDS.teams.alpha, {
          progressNotes: 'Making steady progress toward the Sprint Goal',
        });
      }
    });

    it('creates an impediment from a Daily Scrum record', async () => {
      const scrum = await mockApiService.getDailyScrum(UUIDS.teams.alpha);
      expect(scrum.data).toBeDefined();

      const result = await mockApiService.promoteImpedimentFromDailyScrum(scrum.data?.id ?? '', {
        title: 'Blocked by flaky CI pipeline',
        description: 'Builds fail intermittently.',
        priority: 'High',
      });

      expect(result.success).toBe(true);
      expect(result.data?.impediment).toBeDefined();
      expect(result.data?.impediment.title).toBe('Blocked by flaky CI pipeline');
      expect(result.data?.impediment.status).toBe(ImpedimentStatus.OPEN);
      expect(result.data?.dailyScrum.id).toBe(scrum.data?.id);
    });

    it('returns BAD_REQUEST when the title is missing', async () => {
      const scrum = await mockApiService.getDailyScrum(UUIDS.teams.alpha);

      const result = await mockApiService.promoteImpedimentFromDailyScrum(scrum.data?.id ?? '', {
        title: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BAD_REQUEST');
    });

    it('returns NOT_FOUND when the Daily Scrum does not exist', async () => {
      const result = await mockApiService.promoteImpedimentFromDailyScrum('scrum-nope', {
        title: 'Some impediment',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('getPendingAdjustments', () => {
    it('returns no pending adjustments because mock data flow is disabled', async () => {
      const result = await mockApiService.getPendingAdjustments(UUIDS.teams.alpha);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getPendingFeedback', () => {
    it('returns no pending feedback because mock data flow is disabled', async () => {
      const result = await mockApiService.getPendingFeedback(UUIDS.teams.alpha);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getSprintHistory', () => {
    it('returns deterministic sprint history for the team', async () => {
      const first = await mockApiService.getSprintHistory(UUIDS.teams.alpha);
      const second = await mockApiService.getSprintHistory(UUIDS.teams.alpha);

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      // No Math.random: repeated calls must yield identical, deterministic data.
      expect(second.data).toEqual(first.data);
      expect(Array.isArray(first.data)).toBe(true);
    });
  });

  describe('getSprintTasks', () => {
    it('returns tasks in REVIEW status for the active sprint board', async () => {
      const result = await mockApiService.getSprintTasks('sprint-3');

      expect(result.success).toBe(true);
      const reviewTasks = (result.data ?? []).filter((t) => t.status === TaskStatus.REVIEW);
      expect(reviewTasks.length).toBeGreaterThan(0);
      // Every REVIEW task must belong to the active sprint and carry an assignee.
      for (const task of reviewTasks) {
        expect(task.sprintId).toBe('sprint-3');
        expect(task.assigneeId).toBeTruthy();
      }
    });

    it('embeds the parent PBI on every task so the board can resolve it', async () => {
      const result = await mockApiService.getSprintTasks('sprint-3');

      expect(result.success).toBe(true);
      const tasks = result.data ?? [];
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        expect(task.pbi).toBeDefined();
        expect(task.pbi?.id).toBe(task.pbiId);
        expect(task.pbi?.title).toBeTruthy();
      }
    });

    it('returns no tasks for a sprint without seeded tasks', async () => {
      const result = await mockApiService.getSprintTasks('sprint-1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getActiveSprint (PBI preview / mark-as-done)', () => {
    beforeEach(() => {
      // Restore the active sprint status, since the shared mock store is mutated by
      // earlier tests (e.g. cancelSprint) and getActiveSprint depends on an ACTIVE sprint.
      const sprint = mockSprints.find((s) => s.id === 'sprint-3');
      if (sprint) {
        sprint.status = SprintStatus.ACTIVE;
      }
    });

    it('returns the active sprint with its product backlog items populated', async () => {
      const result = await mockApiService.getActiveSprint(UUIDS.teams.alpha);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('sprint-3');
      // The board resolves a task's parent PBI from these items (PBI preview popup).
      expect(result.data?.items.length).toBeGreaterThan(0);
    });

    it('exposes a PBI that is a ready-to-done candidate (IN_PROGRESS, all child tasks DONE)', async () => {
      const active = await mockApiService.getActiveSprint(UUIDS.teams.alpha);
      const candidate = (active.data?.items ?? []).find((item) => item.id === 'pbi-012');

      expect(candidate).toBeDefined();
      expect(candidate?.status).toBe('IN_PROGRESS');

      const tasks = await mockApiService.getTasksByPbiId('pbi-012');
      expect(tasks.success).toBe(true);
      expect(tasks.data?.length).toBeGreaterThan(0);
      // All child tasks are DONE, making the PBI eligible to be marked done.
      expect(tasks.data?.every((t) => t.status === TaskStatus.DONE)).toBe(true);
    });
  });

  describe('getSprintPlanningDraft', () => {
    it('returns a seeded planning draft with task assignments for the first selectable draft sprint', async () => {
      // Ensure generated sprints for the current year exist in the mock store.
      const currentYear = new Date().getFullYear();
      const generated = await mockApiService.getGeneratedSprints(UUIDS.teams.alpha, currentYear);
      expect(generated.success).toBe(true);

      const sprints = generated.data ?? [];
      expect(sprints.length).toBeGreaterThan(0);

      // The first selectable draft sprint is the earliest PLANNED sprint not in the past.
      const firstSelectable = sprints
        .filter(
          (s) => s.status === SprintStatus.PLANNED && new Date(s.endDate).getTime() >= Date.now()
        )
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

      expect(firstSelectable).toBeDefined();

      const result = await mockApiService.getSprintPlanningDraft(firstSelectable?.id ?? '');

      expect(result.success).toBe(true);
      expect(result.data?.sprintId).toBe(firstSelectable?.id);
      // The seeded draft pre-fills the sprint goal and decomposes READY items into assigned tasks.
      expect(result.data?.sprintGoal).toBeTruthy();
      expect(result.data?.items.length).toBeGreaterThan(0);
      expect(result.data?.tasks.length).toBeGreaterThan(0);
      expect(result.data?.conflicts).toEqual([]);
      // Every seeded task carries a Developer assignment so the assignment flow is visible.
      for (const task of result.data?.tasks ?? []) {
        expect(task.assigneeId).toBeTruthy();
        expect(task.estimatedHours).toBeGreaterThan(0);
      }

      // Repeated calls must be deterministic (no Math.random).
      const second = await mockApiService.getSprintPlanningDraft(firstSelectable?.id ?? '');
      expect(second.data).toEqual(result.data);
    });

    it('returns an empty draft for a sprint that is not the first selectable draft sprint', async () => {
      await mockApiService.getGeneratedSprints(UUIDS.teams.alpha, new Date().getFullYear());

      const result = await mockApiService.getSprintPlanningDraft('non-existent-sprint');

      expect(result.success).toBe(true);
      expect(result.data?.items).toEqual([]);
      expect(result.data?.tasks).toEqual([]);
      expect(result.data?.sprintGoal).toBeNull();
      expect(result.data?.capacity).toEqual([]);
      expect(result.data?.attendees).toEqual([]);
      expect(result.data?.participation.isReadyToStart).toBe(false);
    });

    it('persists recorded capacity and participation across a draft save and reload', async () => {
      // Use an existing mock sprint that is not the first selectable draft sprint, so this test
      // does not interfere with the seeded-draft assertions above.
      const sprintId = 'sprint-2';

      const saveResult = await mockApiService.saveSprintPlanningDraft(sprintId, {
        capacity: [{ memberId: 'member-1', userId: 'user-1', availableHours: 24 }],
        attendees: [
          { name: 'Product Owner', role: 'product_owner', attended: true },
          { name: 'Developer', role: 'developers', attended: true },
        ],
      });
      expect(saveResult.success).toBe(true);

      const draft = await mockApiService.getSprintPlanningDraft(sprintId);
      expect(draft.data?.capacity).toEqual([
        { memberId: 'member-1', userId: 'user-1', availableHours: 24 },
      ]);
      expect(draft.data?.participation.hasProductOwner).toBe(true);
      expect(draft.data?.participation.developerCount).toBe(1);
      expect(draft.data?.participation.isReadyToStart).toBe(true);

      const participation = await mockApiService.getPlanningParticipation(sprintId);
      expect(participation.data?.isReadyToStart).toBe(true);
    });

    it('supports planning attendance CRUD without touching the recorded capacity', async () => {
      const added = await mockApiService.addPlanningAttendee('sprint-attendee-1', {
        name: 'Ada',
        role: 'developers',
        attended: true,
      });
      expect(added.success).toBe(true);
      const attendeeId = added.data?.id ?? '';

      const updated = await mockApiService.updatePlanningAttendee('sprint-attendee-1', attendeeId, {
        attended: false,
      });
      expect(updated.data?.attended).toBe(false);

      const deleted = await mockApiService.deletePlanningAttendee('sprint-attendee-1', attendeeId);
      expect(deleted.success).toBe(true);

      const participation = await mockApiService.getPlanningParticipation('sprint-attendee-1');
      expect(participation.data?.attendees).toEqual([]);
    });
  });

  describe('getDailyScrum (Inspect & Adapt seed for the active sprint)', () => {
    it('returns the seeded Inspect & Adapt record for the active sprint', async () => {
      const result = await mockApiService.getDailyScrum('sprint-3');

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data?.sprintId).toBe('sprint-3');
      expect(result.data?.progressNotes).toBeTruthy();
      expect(result.data?.adaptationsNotes).toBeTruthy();
      expect(result.data?.planForNextDay).toBeTruthy();
    });

    it('returns the same seed record regardless of the requested date', async () => {
      // The mock must not depend on the real date: querying with any date yields
      // the same seeded record so the Dashboard/Daily Scrum Inspect & Adapt card
      // never falls back to the empty state when the date changes.
      const [noDate, past, future] = await Promise.all([
        mockApiService.getDailyScrum('sprint-3'),
        mockApiService.getDailyScrum('sprint-3', '1999-01-01'),
        mockApiService.getDailyScrum('sprint-3', '2999-12-31'),
      ]);

      expect(noDate.success).toBe(true);
      expect(past.success).toBe(true);
      expect(future.success).toBe(true);
      expect(noDate.data?.id).toBe('scrum-seed-active');
      expect(past.data?.id).toBe(noDate.data?.id);
      expect(future.data?.id).toBe(noDate.data?.id);
    });
  });

  describe('timebox (max time present in mock flow)', () => {
    // The active sprint (sprint-3) runs 2026-02-02 .. 2026-02-15 = 13 days,
    // which rounds to 2 weeks. timeboxFor scales the one-month maximum linearly
    // by weeks/4, so the max (timeboxSeconds) must always be present and correct.
    const expectedMax = {
      sprintPlanning: 8 * 60 * 60 * 0.5, // 4h
      sprintReview: 4 * 60 * 60 * 0.5, // 2h
      retrospective: 3 * 60 * 60 * 0.5, // 1.5h
      dailyScrum: 15 * 60, // fixed, not scaled
    } as const;

    // The mock timebox methods mirror the real timeboxService signature and accept
    // a TimeboxQuery object (teamId/sprintId/date), matching how EventTimebox calls it.
    const sprintQuery = { teamId: UUIDS.teams.alpha, sprintId: 'sprint-3' } as const;

    it('returns a timebox with a positive max (timeboxSeconds) for the 2-week active sprint', async () => {
      const result = await mockApiService.getTimebox('sprintPlanning', sprintQuery);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.timeboxSeconds).toBeGreaterThan(0);
      expect(result.data?.timeboxSeconds).toBe(expectedMax.sprintPlanning);
    });

    it('scales the max correctly for every month-scaled event on the 2-week sprint', async () => {
      const planning = await mockApiService.getTimebox('sprintPlanning', sprintQuery);
      const review = await mockApiService.getTimebox('sprintReview', sprintQuery);
      const retro = await mockApiService.getTimebox('retrospective', sprintQuery);

      expect(planning.data?.timeboxSeconds).toBe(expectedMax.sprintPlanning);
      expect(review.data?.timeboxSeconds).toBe(expectedMax.sprintReview);
      expect(retro.data?.timeboxSeconds).toBe(expectedMax.retrospective);
    });

    it('keeps the Daily Scrum max fixed (15 min) regardless of sprint length', async () => {
      const daily = await mockApiService.getTimebox('dailyScrum', sprintQuery);

      expect(daily.data?.timeboxSeconds).toBe(expectedMax.dailyScrum);
    });

    it('start/reset/pause/conclude preserve the max (timeboxSeconds) on every state', async () => {
      const started = await mockApiService.startTimebox('sprintPlanning', sprintQuery);
      expect(started.data?.timeboxSeconds).toBe(expectedMax.sprintPlanning);

      const paused = await mockApiService.pauseTimebox('sprintPlanning', sprintQuery);
      expect(paused.data?.timeboxSeconds).toBe(expectedMax.sprintPlanning);

      const reset = await mockApiService.resetTimebox('sprintPlanning', sprintQuery);
      expect(reset.data?.timeboxSeconds).toBe(expectedMax.sprintPlanning);

      const concluded = await mockApiService.concludeTimebox('sprintPlanning', sprintQuery);
      expect(concluded.data?.timeboxSeconds).toBe(expectedMax.sprintPlanning);
    });

    it('defaults to the full one-month max when no sprint id is supplied', async () => {
      const result = await mockApiService.getTimebox('sprintPlanning', {
        teamId: UUIDS.teams.alpha,
      });

      expect(result.success).toBe(true);
      expect(result.data?.timeboxSeconds).toBe(8 * 60 * 60);
    });
  });
});
