import type { SystemParameter } from '../../types';
import { fixtureId } from '../support/ids';

import { isoInstant } from './clock';

/**
 * The deployment's tunable parameters, as the administration surface reads them.
 *
 * Every value is a string because that is what the API stores and what the form
 * field binds to; the description is what tells an operator what the number
 * means, so it is never omitted.
 *
 * There is no administrator role in Scrumooth, so `updatedBy` names the person
 * who last changed the value rather than implying an admin account.
 */

interface ParameterSeed {
  key: string;
  value: string;
  description: string;
  changedDaysAgo: number;
}

const PARAMETER_SEEDS: readonly ParameterSeed[] = [
  {
    key: 'max_team_members',
    value: '12',
    description: 'Largest Scrum Team the deployment accepts. The Guide calls ten or fewer ideal.',
    changedDaysAgo: 96,
  },
  {
    key: 'session_timeout',
    value: '28800',
    description: 'Absolute session lifetime in seconds, counted from sign-in.',
    changedDaysAgo: 96,
  },
  {
    key: 'session_idle_timeout',
    value: '1800',
    description: 'Idle time in seconds after which a session is ended.',
    changedDaysAgo: 62,
  },
  {
    key: 'daily_scrum_reminder_lead_minutes',
    value: '15',
    description: 'How long before the standing Daily Scrum the team is reminded.',
    changedDaysAgo: 34,
  },
  {
    key: 'notification_retention_days',
    value: '90',
    description: 'Days a notification is kept before it is removed from the inbox.',
    changedDaysAgo: 34,
  },
  {
    key: 'notification_polling_interval_seconds',
    value: '30',
    description: 'How often an open interface asks the deployment for new notifications.',
    changedDaysAgo: 34,
  },
  {
    key: 'notification_max_page_size',
    value: '50',
    description: 'Largest page of notifications the deployment will return in one answer.',
    changedDaysAgo: 34,
  },
  {
    key: 'data_export_retention_days',
    value: '7',
    description: 'Days a requested data export stays downloadable before it expires.',
    changedDaysAgo: 20,
  },
];

/** The person the seed attributes the last change to: nobody, until somebody edits one. */
const SEEDED_EDITOR = 'system';

export const SYSTEM_PARAMETERS: readonly SystemParameter[] = PARAMETER_SEEDS.map((seed) => ({
  id: fixtureId('system-parameter', seed.key),
  key: seed.key,
  value: seed.value,
  description: seed.description,
  updatedBy: SEEDED_EDITOR,
  updatedAt: isoInstant(-seed.changedDaysAgo, 8, 0),
}));
