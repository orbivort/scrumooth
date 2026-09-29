import {
  GATE_CODES,
  SmNotesEntityType,
  type GateCode,
  type SmNotesRevision,
} from '@scrumooth/shared';

import { database, displayNameOf, roleOf } from '../store';

import { accepted, gate } from './envelope';

/**
 * Writing the Scrum Master's notes, and the trail they leave.
 *
 * Three events carry the same field and the same rule — the notes are coaching
 * observations about an event, readable and writable only by the team's Scrum
 * Master — so the rule, the gate code and the revision bookkeeping live here
 * rather than in three handlers that would eventually disagree.
 *
 * The event row keeps the current text and the revision trail sits behind it. A
 * write whose text did not change appends nothing: a "revision" that says exactly
 * what the last one said is not a change of mind, and counting it as one would
 * make the history unreadable.
 */

const GATE_FOR_ENTITY: Record<SmNotesEntityType, GateCode> = {
  [SmNotesEntityType.SPRINT]: GATE_CODES.SPRINT_SM_NOTES_SM_ONLY,
  [SmNotesEntityType.SPRINT_REVIEW]: GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY,
  [SmNotesEntityType.SPRINT_RETROSPECTIVE]: GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY,
};

const REFUSAL_FOR_ENTITY: Record<SmNotesEntityType, string> = {
  [SmNotesEntityType.SPRINT]: 'The Sprint’s coaching notes are the Scrum Master’s',
  [SmNotesEntityType.SPRINT_REVIEW]: 'The Review’s coaching notes are the Scrum Master’s',
  [SmNotesEntityType.SPRINT_RETROSPECTIVE]:
    'The Retrospective’s coaching notes are the Scrum Master’s',
};

/** The revisions recorded against one event, oldest first. */
export function notesFor(entityType: SmNotesEntityType, entityId: string): SmNotesRevision[] {
  return database()
    .smNotesRevisions.filter(
      (revision) => revision.entityType === entityType && revision.entityId === entityId
    )
    .sort((left, right) => left.revision - right.revision);
}

/** Where an event's notes live on the event itself, and how to write them back. */
function currentNotesOf(
  entityType: SmNotesEntityType,
  entityId: string
): { read: () => string | null | undefined; write: (notes: string) => void } | null {
  const db = database();

  if (entityType === SmNotesEntityType.SPRINT) {
    const sprint = db.sprints.find((candidate) => candidate.id === entityId);
    if (!sprint) {
      return null;
    }
    return {
      read: () => sprint.smNotes,
      write: (notes) => {
        sprint.smNotes = notes;
        sprint.updatedAt = new Date().toISOString();
      },
    };
  }

  if (entityType === SmNotesEntityType.SPRINT_REVIEW) {
    const review = db.reviews.find((candidate) => candidate.id === entityId);
    if (!review) {
      return null;
    }
    return {
      read: () => review.smNotes,
      write: (notes) => {
        review.smNotes = notes;
        review.updatedAt = new Date().toISOString();
      },
    };
  }

  const retro = db.retrospectives.find((candidate) => candidate.id === entityId);
  if (!retro) {
    return null;
  }
  return {
    read: () => retro.smNotes,
    write: (notes) => {
      retro.smNotes = notes;
      retro.updatedAt = new Date().toISOString();
    },
  };
}

/**
 * Records the notes the team's Scrum Master wrote on one event.
 *
 * @param teamId - The team the event belongs to. Membership is assumed to have
 *   been checked already; the role is what this decides.
 */
export function saveNotes(
  entityType: SmNotesEntityType,
  entityId: string,
  teamId: string,
  userId: string,
  smNotes: string
): Promise<Response> {
  if (roleOf(userId, teamId) !== 'SCRUM_MASTER') {
    return gate(GATE_FOR_ENTITY[entityType], REFUSAL_FOR_ENTITY[entityType]);
  }

  const notes = currentNotesOf(entityType, entityId);
  if (!notes) {
    return gate(GATE_FOR_ENTITY[entityType], 'That event could not be resolved');
  }

  const next = smNotes.trim();
  const previous = (notes.read() ?? '').trim();
  if (next === previous) {
    return accepted(null);
  }

  notes.write(smNotes);

  const latest = notesFor(entityType, entityId).at(-1);
  database().smNotesRevisions.push({
    id: crypto.randomUUID(),
    entityType,
    entityId,
    revision: (latest?.revision ?? 0) + 1,
    content: smNotes,
    createdBy: userId,
    authorName: displayNameOf(userId) ?? undefined,
    createdAt: new Date().toISOString(),
  });

  return accepted(null);
}
