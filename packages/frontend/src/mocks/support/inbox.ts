import { deleteKey, readKey, writeKey } from './storage';

/**
 * An empty inbox, on demand.
 *
 * The seed gives every persona activity, which is what makes the demo worth
 * signing into and what made the other end of the inbox unreachable: the empty
 * state, and the bell that stays silent. Arming this answers the inbox endpoints
 * as a brand-new account's would be answered, so the state the interface has to
 * render for somebody with nothing waiting can actually be looked at.
 *
 * Armed once from the console and cleared the same way, exactly as a failure
 * scenario is (see `src/mocks/README.md`); `resetMockState()` clears it with the
 * rest of the mock state.
 */

const EMPTY_INBOX_KEY = 'notifications-empty';

/** Arms or clears the empty inbox. */
export function setInboxEmpty(empty: boolean): void {
  if (!empty) {
    deleteKey(EMPTY_INBOX_KEY);
    return;
  }
  writeKey(EMPTY_INBOX_KEY, 'true');
}

/** Whether the acting person's inbox is being answered as empty. */
export function isInboxEmpty(): boolean {
  return readKey(EMPTY_INBOX_KEY) === 'true';
}
