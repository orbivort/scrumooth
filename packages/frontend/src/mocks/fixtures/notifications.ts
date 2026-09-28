import { BarrierStatus } from '@scrumooth/shared';

import { ImpedimentStatus, SprintStatus, TaskStatus } from '../../types';
import { NotificationType, type Notification } from '../../types/notification.types';
import { fixtureId } from '../support/ids';
import { localizedNotification } from '../support/notificationRecord';

import { isoInstant } from './clock';
import { IMPEDIMENTS } from './events';
import { ORGANIZATIONAL_BARRIERS } from './facilitation';
import { displayName } from './people';
import { SPRINTS_FIXTURE, TASKS_FIXTURE } from './sprints';
import { seededDevelopersOf, seededHolderOf } from './teams';

/**
 * The notification inbox, derived from the rest of the seed rather than written
 * out again: every notification points at a Sprint, task, impediment or barrier
 * that really exists, so a link in the inbox can never lead to a missing record.
 *
 * Each record carries the canonical i18n keys the backend's `createLocalized`
 * stores alongside the rendered text, so the inbox re-labels itself when the
 * visitor switches language — the reason the keys exist.
 *
 * The types are the ones the backend actually emits, and the recipient of each is
 * the one the backend would choose: the Daily Scrum signal to the Developers, a
 * task assignment to its assignee, an impediment to its owner, an escalation to
 * the team's Scrum Master, a barrier to its owner. A type the server can send but
 * this seed cannot honestly produce (a pending Sprint Backlog change, a scheduled
 * account deletion) is left out rather than faked; the demo creates those by
 * using the feature, and `setInboxEmpty` covers the other end, the empty inbox.
 */

const NOTIFICATIONS: Notification[] = [];

/** The Daily Scrum signal, to the Developers who hold the event. */
for (const sprint of SPRINTS_FIXTURE) {
  if (sprint.status !== SprintStatus.ACTIVE) {
    continue;
  }
  for (const userId of seededDevelopersOf(sprint.teamId)) {
    NOTIFICATIONS.push(
      localizedNotification({
        id: fixtureId('notification', `daily-scrum-signal:${sprint.id}:${userId}`),
        userId,
        type: NotificationType.DAILY_SCRUM_SIGNAL,
        titleKey: 'dailyScrumSignalTitle',
        title: 'Daily Scrum starting',
        messageKey: 'dailyScrumSignalMessage',
        messageParams: { sprintName: sprint.name },
        message: `The Daily Scrum for "${sprint.name}" is starting. Developers, please gather to inspect progress toward the Sprint Goal and adapt the Sprint Backlog.`,
        data: { sprintId: sprint.id, sprintName: sprint.name, teamId: sprint.teamId },
        createdAt: isoInstant(0, 9, 5),
      })
    );
  }
}

/** "A task was assigned to you", to whoever owns it. */
for (const task of TASKS_FIXTURE) {
  if (!task.assigneeId || task.status === TaskStatus.DONE) {
    continue;
  }
  const sprint = SPRINTS_FIXTURE.find((candidate) => candidate.id === task.sprintId);
  const sprintName = sprint?.name ?? '';

  NOTIFICATIONS.push(
    localizedNotification({
      id: fixtureId('notification', `task-assignment:${task.id}:${task.assigneeId}`),
      userId: task.assigneeId,
      type: NotificationType.TASK_ASSIGNMENT,
      titleKey: 'newTaskAssignedTitle',
      titleParams: { taskTitle: task.title },
      title: `New task assigned: "${task.title}"`,
      messageKey: 'newTaskAssignedMessage',
      messageParams: { taskTitle: task.title, sprintName },
      message: `In sprint "${sprintName}"`,
      data: { taskId: task.id, sprintId: task.sprintId, pbiId: task.pbiId },
      createdAt: task.createdAt,
    })
  );
}

/**
 * The open impediments, to the person accountable for removing them.
 *
 * The backend notifies the owner when one is assigned and never notifies the
 * actor for their own action, which is the rule applied here.
 */
for (const impediment of IMPEDIMENTS) {
  if (
    impediment.status === ImpedimentStatus.RESOLVED ||
    impediment.status === ImpedimentStatus.CLOSED ||
    !impediment.ownerId
  ) {
    continue;
  }
  const reporterName = impediment.reportedById ? displayName(impediment.reportedById) : '';

  NOTIFICATIONS.push(
    localizedNotification({
      id: fixtureId('notification', `impediment-assignment:${impediment.id}:${impediment.ownerId}`),
      userId: impediment.ownerId,
      type: NotificationType.IMPEDIMENT_ASSIGNMENT,
      titleKey: 'impedimentAssigned',
      titleParams: { impedimentTitle: impediment.title },
      title: `New impediment assigned: "${impediment.title}"`,
      messageKey: 'impedimentAssignedMessage',
      messageParams: { reporterName },
      message: `Reported by ${reporterName}`,
      data: { impedimentId: impediment.id, teamId: impediment.teamId },
      createdAt: impediment.createdAt,
    })
  );
}

/**
 * The escalations, to the team's Scrum Master.
 *
 * Mirrors the backend's escalation scan: an impediment that has gone unresolved
 * past its threshold tells the Scrum Master, who is accountable for its removal,
 * and the age it reports is counted from the impediment's own record.
 */
for (const impediment of IMPEDIMENTS) {
  if (!impediment.escalatedAt) {
    continue;
  }
  const scrumMasterId = seededHolderOf(impediment.teamId, 'SCRUM_MASTER');
  if (!scrumMasterId) {
    continue;
  }
  const ageDays = Math.max(
    Math.floor((Date.now() - new Date(impediment.createdAt).getTime()) / 86_400_000),
    0
  );

  NOTIFICATIONS.push(
    localizedNotification({
      id: fixtureId('notification', `impediment-escalation:${impediment.id}:${scrumMasterId}`),
      userId: scrumMasterId,
      type: NotificationType.IMPEDIMENT_ESCALATION,
      titleKey: 'impedimentEscalation',
      titleParams: { impedimentTitle: impediment.title },
      title: `Impediment needs your action: "${impediment.title}"`,
      messageKey: 'impedimentEscalationMessage',
      messageParams: { ageDays },
      message: `This impediment has gone unresolved for ${ageDays} days. As Scrum Master you are accountable for causing its removal.`,
      data: { impedimentId: impediment.id, teamId: impediment.teamId, ageDays },
      createdAt: impediment.escalatedAt,
    })
  );
}

/**
 * The barriers outside the team, to the person who owns removing them.
 *
 * Read on arrival: a barrier is raised against the team rather than by it, so the
 * person who can act on it has usually seen it before the bell would ring again.
 */
for (const barrier of ORGANIZATIONAL_BARRIERS) {
  if (
    barrier.status === BarrierStatus.RESOLVED ||
    barrier.status === BarrierStatus.CLOSED ||
    !barrier.ownerId
  ) {
    continue;
  }

  NOTIFICATIONS.push(
    localizedNotification({
      id: fixtureId('notification', `organizational-barrier:${barrier.id}:${barrier.ownerId}`),
      userId: barrier.ownerId,
      type: NotificationType.ORGANIZATIONAL_BARRIER,
      titleKey: 'organizationalBarrierRaised',
      titleParams: { barrierTitle: barrier.title },
      title: `Organizational barrier assigned: "${barrier.title}"`,
      messageKey: 'organizationalBarrierRaisedMessage',
      messageParams: { barrierTitle: barrier.title },
      message:
        'This barrier lies outside the Scrum Team. You are accountable for removing it, so the team can continue.',
      data: { barrierId: barrier.id, teamId: barrier.teamId },
      isRead: true,
      readAt: isoInstant(-1, 8, 30),
      createdAt: barrier.createdAt,
    })
  );
}

/** Newest first, which is the order the interface reads them in. */
export const SEEDED_NOTIFICATIONS: readonly Notification[] = [...NOTIFICATIONS].sort((a, b) =>
  b.createdAt.localeCompare(a.createdAt)
);
