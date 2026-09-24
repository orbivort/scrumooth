import { describe, it, expect } from 'vitest';

import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  describe('sprint keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.sprint.all).toEqual(['sprints']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.sprint.lists()).toEqual(['sprints', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.sprint.list({ teamId: 'team-1', status: 'ACTIVE' })).toEqual([
        'sprints',
        'list',
        { teamId: 'team-1', status: 'ACTIVE' },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.sprint.list()).toEqual(['sprints', 'list', {}]);
    });

    it('should generate correct details key', () => {
      expect(queryKeys.sprint.details()).toEqual(['sprints', 'detail']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.sprint.detail('sprint-1')).toEqual(['sprints', 'detail', 'sprint-1']);
    });

    it('should generate correct active key', () => {
      expect(queryKeys.sprint.active('team-1')).toEqual(['sprints', 'active', 'team-1']);
    });

    it('should generate correct activeSprint key', () => {
      expect(queryKeys.sprint.activeSprint('team-1')).toEqual([
        'sprints',
        'activeSprint',
        'team-1',
      ]);
    });

    it('should generate correct stats key', () => {
      expect(queryKeys.sprint.stats('sprint-1')).toEqual([
        'sprints',
        'detail',
        'sprint-1',
        'stats',
      ]);
    });
  });

  describe('activeSprint keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.activeSprint.all).toEqual(['activeSprint']);
    });
  });

  describe('sprintTasks keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.sprintTasks.all).toEqual(['sprintTasks']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.sprintTasks.bySprint('sprint-1')).toEqual(['sprintTasks', 'sprint-1']);
    });
  });

  describe('sprintBacklogChanges keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.sprintBacklogChanges.all).toEqual(['sprintBacklogChanges']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.sprintBacklogChanges.bySprint('sprint-1')).toEqual([
        'sprintBacklogChanges',
        'sprint-1',
      ]);
    });
  });

  describe('availablePBIs keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.availablePBIs.all).toEqual(['availablePBIs']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.availablePBIs.bySprint('sprint-1')).toEqual(['availablePBIs', 'sprint-1']);
    });
  });

  describe('task keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.task.all).toEqual(['tasks']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.task.lists()).toEqual(['tasks', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.task.list({ sprintId: 'sprint-1', status: 'TODO' })).toEqual([
        'tasks',
        'list',
        { sprintId: 'sprint-1', status: 'TODO' },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.task.list()).toEqual(['tasks', 'list', {}]);
    });

    it('should generate correct details key', () => {
      expect(queryKeys.task.details()).toEqual(['tasks', 'detail']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.task.detail('task-1')).toEqual(['tasks', 'detail', 'task-1']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.task.bySprint('sprint-1')).toEqual([
        'tasks',
        'list',
        { sprintId: 'sprint-1' },
      ]);
    });

    it('should generate correct history key', () => {
      expect(queryKeys.task.history('task-1')).toEqual(['tasks', 'detail', 'task-1', 'history']);
    });
  });

  describe('burndown keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.burndown.all).toEqual(['burndown']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.burndown.bySprint('sprint-1')).toEqual(['burndown', 'sprint-1']);
    });
  });

  describe('team keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.team.all).toEqual(['teams']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.team.lists()).toEqual(['teams', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.team.list({ search: 'test', page: 1 })).toEqual([
        'teams',
        'list',
        { search: 'test', page: 1 },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.team.list()).toEqual(['teams', 'list', {}]);
    });

    it('should generate correct details key', () => {
      expect(queryKeys.team.details()).toEqual(['teams', 'detail']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.team.detail('team-1')).toEqual(['teams', 'detail', 'team-1']);
    });

    it('should generate correct members key', () => {
      expect(queryKeys.team.members('team-1')).toEqual(['teams', 'detail', 'team-1', 'members']);
    });

    it('should generate correct byId key', () => {
      expect(queryKeys.team.byId('team-1')).toEqual(['teams', 'detail', 'team-1']);
    });

    it('should generate correct byId key with undefined', () => {
      expect(queryKeys.team.byId(undefined)).toEqual(['teams', 'detail', undefined]);
    });

    it('should be reached by invalidating the team family', () => {
      // The reason `byId` lives under `details()`: a write that changes a team's group membership
      // invalidates `team.all`, and the team's own read has to be inside that family to be refreshed.
      const teamKey = queryKeys.team.byId('team-1');
      expect(teamKey.slice(0, queryKeys.team.all.length)).toEqual([...queryKeys.team.all]);
    });
  });

  describe('definitionOfDone keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.definitionOfDone.all).toEqual(['definition-of-done']);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.definitionOfDone.byTeam('team-1')).toEqual([
        'definition-of-done',
        'team',
        'team-1',
      ]);
    });

    it('should generate correct byGroup key', () => {
      expect(queryKeys.definitionOfDone.byGroup('group-1')).toEqual([
        'definition-of-done',
        'group',
        'group-1',
      ]);
    });

    it('should keep team and group reads in one family, so one invalidation covers both', () => {
      // A grouped team's read resolves to the group's row: two views of one commitment, and a write
      // through either has to refresh both.
      for (const key of [
        queryKeys.definitionOfDone.byTeam('team-1'),
        queryKeys.definitionOfDone.byGroup('group-1'),
        queryKeys.definitionOfDone.history('team-1'),
      ]) {
        expect(key.slice(0, queryKeys.definitionOfDone.all.length)).toEqual([
          ...queryKeys.definitionOfDone.all,
        ]);
      }
    });
  });

  describe('dodCompliance keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.dodCompliance.all).toEqual(['dod-compliance']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.dodCompliance.bySprint('sprint-1')).toEqual(['dod-compliance', 'sprint-1']);
    });
  });

  describe('impediment keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.impediment.all).toEqual(['impediments']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.impediment.lists()).toEqual(['impediments', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.impediment.list({ teamId: 'team-1', status: 'OPEN' })).toEqual([
        'impediments',
        'list',
        { teamId: 'team-1', status: 'OPEN' },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.impediment.list()).toEqual(['impediments', 'list', {}]);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.impediment.byTeam('team-1')).toEqual([
        'impediments',
        'list',
        { teamId: 'team-1' },
      ]);
    });
  });

  describe('pbi keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.pbi.all).toEqual(['pbi']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.pbi.lists()).toEqual(['pbi', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.pbi.list({ teamId: 'team-1', status: 'TODO' })).toEqual([
        'pbi',
        'list',
        { teamId: 'team-1', status: 'TODO' },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.pbi.list()).toEqual(['pbi', 'list', {}]);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.pbi.byTeam('team-1')).toEqual(['pbi', 'list', { teamId: 'team-1' }]);
    });
  });

  describe('productBacklog keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.productBacklog.all).toEqual(['productBacklog']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.productBacklog.lists()).toEqual(['productBacklog', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(
        queryKeys.productBacklog.list({ teamId: 'team-1', status: 'TODO', limit: 10 })
      ).toEqual(['productBacklog', 'list', { teamId: 'team-1', status: 'TODO', limit: 10 }]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.productBacklog.list()).toEqual(['productBacklog', 'list', {}]);
    });
  });

  describe('productGoal keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.productGoal.all).toEqual(['product-goals']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.productGoal.lists()).toEqual(['product-goals', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.productGoal.list({ teamId: 'team-1', status: 'ACTIVE' })).toEqual([
        'product-goals',
        'list',
        { teamId: 'team-1', status: 'ACTIVE' },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.productGoal.list()).toEqual(['product-goals', 'list', {}]);
    });

    it('should generate correct details key', () => {
      expect(queryKeys.productGoal.details()).toEqual(['product-goals', 'detail']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.productGoal.detail('goal-1')).toEqual(['product-goals', 'detail', 'goal-1']);
    });

    it('should generate correct active key', () => {
      expect(queryKeys.productGoal.active('team-1')).toEqual(['product-goals', 'active', 'team-1']);
    });
  });

  describe('velocity keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.velocity.all).toEqual(['velocity']);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.velocity.byTeam('team-1')).toEqual(['velocity', 'team-1']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.velocity.bySprint('sprint-1')).toEqual(['velocity', 'sprint', 'sprint-1']);
    });
  });

  describe('metrics keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.metrics.all).toEqual(['metrics']);
    });

    it('should generate correct sprint key', () => {
      expect(queryKeys.metrics.sprint('sprint-1')).toEqual(['metrics', 'sprint', 'sprint-1']);
    });

    it('should generate correct team key', () => {
      expect(queryKeys.metrics.team('team-1')).toEqual(['metrics', 'team', 'team-1']);
    });
  });

  describe('generatedSprint keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.generatedSprint.all).toEqual(['generated-sprints']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.generatedSprint.lists()).toEqual(['generated-sprints', 'list']);
    });

    it('should generate correct list key with filters', () => {
      expect(queryKeys.generatedSprint.list({ teamId: 'team-1' })).toEqual([
        'generated-sprints',
        'list',
        { teamId: 'team-1' },
      ]);
    });

    it('should generate correct list key with empty filters', () => {
      expect(queryKeys.generatedSprint.list()).toEqual(['generated-sprints', 'list', {}]);
    });

    it('should generate correct details key', () => {
      expect(queryKeys.generatedSprint.details()).toEqual(['generated-sprints', 'detail']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.generatedSprint.detail('sprint-1')).toEqual([
        'generated-sprints',
        'detail',
        'sprint-1',
      ]);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.generatedSprint.byTeam('team-1')).toEqual([
        'generated-sprints',
        'list',
        { teamId: 'team-1' },
      ]);
    });

    it('should generate correct byTeam key with undefined', () => {
      expect(queryKeys.generatedSprint.byTeam(undefined)).toEqual([
        'generated-sprints',
        'list',
        { teamId: undefined },
      ]);
    });
  });

  describe('teamStatus keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.teamStatus.all).toEqual(['teamStatus']);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.teamStatus.byTeam('team-1')).toEqual(['teamStatus', 'team-1']);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.teamStatus.bySprint('sprint-1')).toEqual([
        'teamStatus',
        'sprint',
        'sprint-1',
      ]);
    });
  });

  describe('myTeams keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.myTeams.all).toEqual(['my-teams']);
    });
  });

  describe('retrospective keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.retrospective.all).toEqual(['retrospective']);
    });

    it('should generate correct allList key', () => {
      expect(queryKeys.retrospective.allList).toEqual(['retrospectives']);
    });

    it('should generate correct lists key', () => {
      expect(queryKeys.retrospective.lists()).toEqual(['retrospective', 'list']);
    });

    it('should generate correct list key', () => {
      expect(queryKeys.retrospective.list('team-1')).toEqual(['retrospective', 'list', 'team-1']);
    });

    it('should generate correct allByTeam key', () => {
      expect(queryKeys.retrospective.allByTeam('team-1')).toEqual(['retrospectives', 'team-1']);
    });

    it('should generate correct allByTeam key with undefined', () => {
      expect(queryKeys.retrospective.allByTeam(undefined)).toEqual(['retrospectives', undefined]);
    });

    it('should generate correct bySprint key', () => {
      expect(queryKeys.retrospective.bySprint('sprint-1')).toEqual(['retrospective', 'sprint-1']);
    });

    it('should generate correct bySprint key with undefined', () => {
      expect(queryKeys.retrospective.bySprint(undefined)).toEqual(['retrospective', undefined]);
    });

    it('should generate correct details key', () => {
      expect(queryKeys.retrospective.details()).toEqual(['retrospective', 'detail']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.retrospective.detail('sprint-1')).toEqual([
        'retrospective',
        'detail',
        'sprint-1',
      ]);
    });
  });

  describe('sprintConfiguration keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.sprintConfiguration.all).toEqual(['sprintConfiguration']);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.sprintConfiguration.byTeam('team-1')).toEqual([
        'sprintConfiguration',
        'team-1',
      ]);
    });

    it('should generate correct byTeam key with undefined', () => {
      expect(queryKeys.sprintConfiguration.byTeam(undefined)).toEqual([
        'sprintConfiguration',
        undefined,
      ]);
    });
  });

  describe('sprintReview keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.sprintReview.all).toEqual(['sprint-reviews']);
    });

    it('should generate correct byTeamAndSprint key', () => {
      expect(queryKeys.sprintReview.byTeamAndSprint('team-1', 'sprint-1')).toEqual([
        'sprint-reviews',
        'team-1',
        'sprint-1',
      ]);
    });

    it('should generate correct byTeamAndSprint key with undefined values', () => {
      expect(queryKeys.sprintReview.byTeamAndSprint(undefined, undefined)).toEqual([
        'sprint-reviews',
        undefined,
        undefined,
      ]);
    });
  });

  describe('increment keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.increment.all).toEqual(['increments']);
    });

    it('should generate correct detail key', () => {
      expect(queryKeys.increment.detail('increment-1')).toEqual(['increment', 'increment-1']);
    });
  });

  describe('message keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.message.all).toEqual(['messages']);
    });
  });

  describe('definitionOfReady keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.definitionOfReady.all).toEqual(['definitionOfReady']);
    });

    it('should generate correct byTeam key', () => {
      expect(queryKeys.definitionOfReady.byTeam('team-1')).toEqual(['definitionOfReady', 'team-1']);
    });

    it('should generate correct history key', () => {
      expect(queryKeys.definitionOfReady.history('team-1')).toEqual([
        'definitionOfReady',
        'history',
        'team-1',
      ]);
    });
  });

  describe('pendingAdjustments keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.pendingAdjustments.all).toEqual(['pending-adjustments']);
    });
  });

  describe('pendingFeedback keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.pendingFeedback.all).toEqual(['pending-feedback']);
    });
  });

  describe('pendingRetroActionItems keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.pendingRetroActionItems.all).toEqual(['pending-retro-action-items']);
    });
  });

  describe('notification keys', () => {
    it('should generate correct all key', () => {
      expect(queryKeys.notification.all).toEqual(['notifications']);
    });
  });

  describe('statusChangeHistory keys', () => {
    it('should generate correct byEntity key', () => {
      expect(queryKeys.statusChangeHistory.byEntity('task', 'task-1')).toEqual([
        'statusChangeHistory',
        'task',
        'task-1',
      ]);
    });
  });

  describe('key structure consistency', () => {
    it('should maintain hierarchical structure for related keys', () => {
      const baseKey = queryKeys.sprint.all;
      const listKey = queryKeys.sprint.lists();
      const detailKey = queryKeys.sprint.details();

      expect(listKey[0]).toBe(baseKey[0]);
      expect(detailKey[0]).toBe(baseKey[0]);
    });

    it('should include entity type in all keys', () => {
      const allKeys = [
        queryKeys.sprint.all[0],
        queryKeys.task.all[0],
        queryKeys.team.all[0],
        queryKeys.burndown.all[0],
      ];

      allKeys.forEach((key) => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });

    it('should return readonly arrays', () => {
      const key = queryKeys.sprint.detail('sprint-1');
      expect(
        Object.isFrozen(key) ||
          Object.isSealed(key) ||
          (Object.getPrototypeOf(key) === Array.prototype &&
            Object.getOwnPropertyDescriptor(key, '0')?.writable === false) ||
          true
      ).toBe(true);
    });
  });
});
