// The Scrum Master's private coaching log.
//
// The Guide's first two Scrum Master services are coaching the team in self-management and
// cross-functionality. That work leaves no trace in any artifact -- no backlog item, no increment,
// no event record -- so it is recorded here. It is readable and writable only by the team's Scrum
// Master: a note about a team's struggles with self-management is working material, not a published
// assessment of the team.
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { type CoachingTopic } from '../generated/prisma/client';
import { GATE_CODES } from '@scrumooth/shared';
import { t as requestT } from '../i18n/requestT.js';
import {
  AuditEventTypes,
  AuditActions,
  AuditResults,
  auditResourceEvent,
} from '../utils/auditLogger';
import { assertTeamScrumMaster, type TeamRoleRefusal } from './teamRoleAccess';

/** The coaching log is the Scrum Master's own record, so it is theirs alone to read and write. */
const COACHING_SM_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:coaching.smOnly',
  gateCode: GATE_CODES.COACHING_SM_ONLY,
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const ENTRY_RELATIONS = {
  sprint: { select: { id: true, name: true } },
  author: { select: { id: true, firstName: true, lastName: true } },
};

const formatEntry = (entry: {
  id: string;
  teamId: string;
  topic: CoachingTopic;
  note: string;
  sprintId: string | null;
  followUpDate: Date | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  sprint?: { id: string; name: string } | null;
  author?: { id: string; firstName: string; lastName: string } | null;
}) => ({
  id: entry.id,
  teamId: entry.teamId,
  topic: entry.topic,
  note: entry.note,
  sprintId: entry.sprintId,
  sprintName: entry.sprint?.name ?? null,
  followUpDate: entry.followUpDate ? entry.followUpDate.toISOString() : null,
  authorId: entry.authorId,
  authorName: entry.author ? `${entry.author.firstName} ${entry.author.lastName}`.trim() : null,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
});

const toNullableDate = (value: string | Date | null | undefined): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw localizedError('errors:coaching.invalidDate');
  }

  return date;
};

interface CreateCoachingEntryInput {
  teamId: string;
  topic: CoachingTopic;
  note: string;
  sprintId?: string | null;
  followUpDate?: string | Date | null;
}

interface UpdateCoachingEntryInput {
  topic?: CoachingTopic;
  note?: string;
  sprintId?: string | null;
  followUpDate?: string | Date | null;
}

class CoachingEntryService {
  /** The coaching log of one team, newest first, for that team's Scrum Master. */
  async getCoachingEntries(
    teamId: string,
    actorUserId: string | undefined,
    options: { limit?: number; offset?: number } = {}
  ) {
    await assertTeamScrumMaster(teamId, actorUserId, COACHING_SM_REFUSAL);

    const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const offset = Math.max(options.offset ?? 0, 0);

    const [entries, total] = await Promise.all([
      prisma.coachingEntry.findMany({
        where: { teamId },
        include: ENTRY_RELATIONS,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.coachingEntry.count({ where: { teamId } }),
    ]);

    return { entries: entries.map(formatEntry), total, limit, offset };
  }

  /** Record a coaching observation. */
  async createCoachingEntry(userId: string, data: CreateCoachingEntryInput) {
    await assertTeamScrumMaster(data.teamId, userId, COACHING_SM_REFUSAL);

    if (data.sprintId) {
      const sprint = await prisma.sprint.findFirst({
        where: { id: data.sprintId, teamId: data.teamId },
        select: { id: true },
      });

      if (!sprint) {
        throw new BadRequestError(requestT('errors:coaching.sprintNotOfTeam'));
      }
    }

    const entry = await prisma.coachingEntry.create({
      data: {
        id: generateUUIDv7(),
        teamId: data.teamId,
        topic: data.topic,
        note: data.note,
        sprintId: data.sprintId ?? null,
        followUpDate: toNullableDate(data.followUpDate),
        authorId: userId,
      },
      include: ENTRY_RELATIONS,
    });

    // The audit records that a coaching note exists and how long it is -- never what it says.
    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.CREATE,
      AuditResults.SUCCESS,
      { type: 'COACHING_ENTRY', id: entry.id },
      { teamId: entry.teamId, topic: entry.topic, noteLength: entry.note.length }
    );

    return formatEntry(entry);
  }

  /** Amend a coaching observation. */
  async updateCoachingEntry(
    id: string,
    userId: string | undefined,
    data: UpdateCoachingEntryInput
  ) {
    const existing = await prisma.coachingEntry.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    });

    if (!existing) {
      throw new NotFoundError('Coaching Entry');
    }

    await assertTeamScrumMaster(existing.teamId, userId, COACHING_SM_REFUSAL);

    if (data.sprintId) {
      const sprint = await prisma.sprint.findFirst({
        where: { id: data.sprintId, teamId: existing.teamId },
        select: { id: true },
      });

      if (!sprint) {
        throw new BadRequestError(requestT('errors:coaching.sprintNotOfTeam'));
      }
    }

    const entry = await prisma.coachingEntry.update({
      where: { id },
      data: {
        ...(data.topic !== undefined ? { topic: data.topic } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.sprintId !== undefined ? { sprintId: data.sprintId } : {}),
        ...(data.followUpDate !== undefined
          ? { followUpDate: toNullableDate(data.followUpDate) }
          : {}),
      },
      include: ENTRY_RELATIONS,
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'COACHING_ENTRY', id: entry.id },
      { teamId: entry.teamId, noteLength: entry.note.length }
    );

    return formatEntry(entry);
  }

  /** Remove a coaching observation. */
  async deleteCoachingEntry(id: string, userId: string | undefined) {
    const existing = await prisma.coachingEntry.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    });

    if (!existing) {
      throw new NotFoundError('Coaching Entry');
    }

    await assertTeamScrumMaster(existing.teamId, userId, COACHING_SM_REFUSAL);

    await prisma.coachingEntry.delete({ where: { id } });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.DELETE,
      AuditResults.SUCCESS,
      { type: 'COACHING_ENTRY', id },
      { teamId: existing.teamId }
    );

    return { id };
  }
}

export const coachingEntryService = new CoachingEntryService();
