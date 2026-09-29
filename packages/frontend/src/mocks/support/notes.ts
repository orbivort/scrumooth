import { roleOf } from '../store';

/**
 * The Scrum Master's notes, and who may see them.
 *
 * The notes are coaching observations about an event rather than a shared field,
 * so the server withholds them from everyone but the team's Scrum Master —
 * exactly as it refuses a write from anyone else. An *absent* field therefore
 * means "not yours to read", which is why the value is deleted rather than
 * blanked: an empty string would read as "there are no notes".
 *
 * The rule lives here because three events carry the same field and the same
 * gate, and three copies of it would eventually disagree.
 */

/** A record whose notes the caller may or may not read. */
interface WithNotes {
  smNotes?: string | null;
}

/**
 * The record as the caller is allowed to read it: unchanged for the team's Scrum
 * Master, with the notes field withheld for anyone else.
 */
export function withVisibleNotes<T extends WithNotes>(
  record: T,
  teamId: string,
  userId: string
): T {
  if (roleOf(userId, teamId) === 'SCRUM_MASTER') {
    return record;
  }

  const { smNotes: _withheld, ...rest } = record;
  return rest as T;
}
