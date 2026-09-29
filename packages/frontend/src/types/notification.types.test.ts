import { describe, it, expect } from 'vitest';

import { NOTIFICATION_TYPES } from '@scrumooth/shared';

import { NotificationType } from './notification.types';

/**
 * The client's notification vocabulary against the API's.
 *
 * `NOTIFICATION_TYPES` in `@scrumooth/shared` is the value that is kept in lockstep
 * with the Prisma enum, so this is where a type the server can store but the
 * interface cannot name is caught. When the two drift, the interface does not fail
 * loudly: the notification draws the fallback icon, matches no filter and routes
 * nowhere, and it looks like a rendering quirk rather than a missing member.
 */
describe('NotificationType', () => {
  it('holds exactly the types the API can store', () => {
    expect(Object.values(NotificationType).sort()).toEqual(
      Object.values(NOTIFICATION_TYPES).sort()
    );
  });
});
