import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ConflictError, localizedError } from '../utils/errors';
import {
  DEFAULT_IMPEDIMENT_PRIORITY,
  GATE_CODES,
  evaluateAdaptationReflection,
  hasAdaptationEvidence,
  hasContradictoryAdaptationEvidence,
  isDailyScrumAdjustmentAction,
  isWorkingDay as isWorkingDayOn,
  listWorkingDays,
  sprintWorkingDayProgress,
  toIsoDate,
  type AdaptationReflection,
  type AdaptationReflectionBasis,
  type DailyScrumAdjustmentAction,
  type DailyScrumCadence,
  type ImpedimentPriority,
} from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import {
  NotificationType,
  ImpedimentStatus,
  UserRole,
  type DailyScrum,
  type Impediment,
  type ItemStatus,
  type User,
  type Prisma,
} from '../generated/prisma/client';
import { t } from '../i18n/requestT.js';
import { notificationService } from './notification.service';
import {
  dailyScrumScheduleService,
  fromDateOnly,
  resolveCadenceWindow,
  toLocalIsoDate,
  toScheduleDto,
} from './dailyScrumSchedule.service';

/** An adaptation as the caller declares it: what was done, and a note explaining it. */
export interface DailyScrumAdjustmentInput {
  sprintBacklogItemId: string;
  actionType: DailyScrumAdjustmentAction;
  action: string;
}

export interface CreateDailyScrumData {
  sprintId: string;
  scrumDate?: string;
  progressNotes?: string;
  adaptationsNotes?: string;
  planForNextDay?: string;
  focusMode?: string | null;
  noAdaptationNeeded?: boolean;
  backlogAdjustments?: DailyScrumAdjustmentInput[];
}

export interface UpdateDailyScrumData {
  progressNotes?: string;
  adaptationsNotes?: string;
  planForNextDay?: string;
  focusMode?: string | null;
  noAdaptationNeeded?: boolean;
  backlogAdjustments?: DailyScrumAdjustmentInput[];
}

/**
 * A declared Sprint Backlog adjustment, with a verdict on whether the Sprint Backlog has since
 * borne it out. The verdict is computed on read from the snapshot stored at declaration time,
 * so it describes the Sprint Backlog now rather than the note's own claim.
 */
export interface DailyScrumAdjustmentDto {
  id: string;
  /** Null once the item has left the Sprint Backlog, which fulfils a `REMOVED` declaration. */
  sprintBacklogItemId: string | null;
  /** Denormalised target, so the declaration outlives the item it describes. */
  pbiId: string | null;
  pbiTitleAtAdjustment: string | null;
  actionType: DailyScrumAdjustmentAction | null;
  action: string;
  reflection: AdaptationReflection;
  reflectionBasis: AdaptationReflectionBasis;
  createdAt: Date;
  updatedAt: Date;
  sprintBacklogItem: {
    id: string;
    pbiId: string;
    pbi?: {
      id: string;
      title: string;
    } | null;
  } | null;
}

export interface DailyScrumWithRelations extends DailyScrum {
  participants: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
  backlogAdjustments: DailyScrumAdjustmentDto[];
}

/**
 * Everything a Daily Scrum is read with.
 *
 * The adjustment branch carries both the declared target and that target's *current* state, so
 * the reflection verdict can be computed from one joined read instead of a query per
 * adjustment. `pbi` is loaded alongside the Sprint Backlog item because a declaration whose
 * item has since left the Sprint Backlog must still be judgeable -- that absence is precisely
 * what fulfils a `REMOVED` declaration.
 */
const DAILY_SCRUM_INCLUDE = {
  participants: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  },
  backlogAdjustments: {
    include: {
      pbi: {
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
        },
      },
      sprintBacklogItem: {
        select: {
          id: true,
          pbiId: true,
          updatedAt: true,
          pbi: {
            select: {
              id: true,
              title: true,
              status: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.DailyScrumInclude;

type DailyScrumRow = Prisma.DailyScrumGetPayload<{ include: typeof DAILY_SCRUM_INCLUDE }>;

const isoOrNull = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

/**
 * Map a stored record onto the published shape, computing each adjustment's reflection verdict
 * on the way out.
 *
 * The verdict is derived here rather than stored because it describes the Sprint Backlog at the
 * moment of reading: a stored verdict would be a snapshot of a moving thing and would go stale
 * the first time someone acted on the adaptation.
 */
const toAdjustmentDto = (
  adjustment: DailyScrumRow['backlogAdjustments'][number]
): DailyScrumAdjustmentDto => {
  // The item's own view of its PBI is authoritative while the item exists; the denormalised
  // `pbi` relation is what remains once it does not.
  const pbi = adjustment.sprintBacklogItem?.pbi ?? adjustment.pbi ?? null;
  const actionType = isDailyScrumAdjustmentAction(adjustment.actionType)
    ? adjustment.actionType
    : null;

  const { reflection, basis } = evaluateAdaptationReflection(
    {
      actionType,
      pbiStatusAtAdjustment: adjustment.pbiStatusAtAdjustment,
      itemUpdatedAtAtAdjustment: isoOrNull(adjustment.itemUpdatedAtAtAdjustment),
      pbiUpdatedAtAtAdjustment: isoOrNull(adjustment.pbiUpdatedAtAtAdjustment),
    },
    {
      itemPresentInSprintBacklog: adjustment.sprintBacklogItem !== null,
      pbiStatus: pbi?.status ?? null,
      itemUpdatedAt: isoOrNull(adjustment.sprintBacklogItem?.updatedAt),
      pbiUpdatedAt: isoOrNull(pbi?.updatedAt),
    }
  );

  return {
    id: adjustment.id,
    sprintBacklogItemId: adjustment.sprintBacklogItemId,
    pbiId: adjustment.pbiId,
    pbiTitleAtAdjustment: adjustment.pbiTitleAtAdjustment,
    actionType,
    action: adjustment.action,
    reflection,
    reflectionBasis: basis,
    createdAt: adjustment.createdAt,
    updatedAt: adjustment.updatedAt,
    sprintBacklogItem: adjustment.sprintBacklogItem
      ? {
          id: adjustment.sprintBacklogItem.id,
          pbiId: adjustment.sprintBacklogItem.pbiId,
          // The item's PBI is a required relation, so it is present whenever the item is.
          pbi: {
            id: adjustment.sprintBacklogItem.pbi.id,
            title: adjustment.sprintBacklogItem.pbi.title,
          },
        }
      : null,
  };
};

const toDailyScrumDto = (row: DailyScrumRow): DailyScrumWithRelations => ({
  ...row,
  backlogAdjustments: row.backlogAdjustments.map(toAdjustmentDto),
});

class DailyScrumService {
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('-').map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    if (!year || !month || !day) {
      throw new BadRequestError('Invalid date format. Expected YYYY-MM-DD');
    }
    return new Date(year, month - 1, day);
  }

  private getTodayDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Enforce that the record declares what the event concluded about the Sprint Backlog.
   *
   * The Guide's purpose for the Daily Scrum is to "adapt the Sprint Backlog", so a record
   * declaring neither an adjustment nor a considered decision that none was needed leaves that
   * purpose unproven. Declaring both is a contradiction, and is refused as malformed input
   * rather than silently resolved in either direction.
   */
  private assertAdaptationEvidence(adjustmentCount: number, noAdaptationNeeded: boolean): void {
    if (hasContradictoryAdaptationEvidence({ adjustmentCount, noAdaptationNeeded })) {
      throw localizedError('validation:dailyScrum.adaptationExclusive', {}, 400);
    }
    if (!hasAdaptationEvidence({ adjustmentCount, noAdaptationNeeded })) {
      throw localizedError(
        'validation:dailyScrum.adaptationRequired',
        {},
        400,
        GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED
      );
    }
  }

  /**
   * Resolve each declared adjustment against the Sprint Backlog it claims to act on.
   *
   * The snapshot is read from the database, never taken from the caller: a declaration the
   * client could describe its own baseline for would be unverifiable by construction. One
   * batched query resolves every declaration, and a declaration naming an item that is not in
   * *this* Sprint's Sprint Backlog is refused rather than recorded against an unrelated item.
   */
  private async resolveAdjustmentSnapshots(
    sprintId: string,
    adjustments: DailyScrumAdjustmentInput[]
  ): Promise<
    Array<{
      sprintBacklogItemId: string;
      pbiId: string;
      pbiTitleAtAdjustment: string;
      actionType: DailyScrumAdjustmentAction;
      action: string;
      pbiStatusAtAdjustment: ItemStatus;
      itemUpdatedAtAtAdjustment: Date;
      pbiUpdatedAtAtAdjustment: Date;
    }>
  > {
    if (adjustments.length === 0) {
      return [];
    }

    // The same item twice would violate the record's unique constraint and, worse, would
    // describe two mutually exclusive outcomes. The last declaration for an item wins, which
    // is the caller's latest intent.
    const byItemId = new Map<string, DailyScrumAdjustmentInput>();
    for (const adjustment of adjustments) {
      byItemId.set(adjustment.sprintBacklogItemId, adjustment);
    }

    const items = await prisma.sprintBacklogItem.findMany({
      where: { id: { in: [...byItemId.keys()] }, sprintId },
      select: {
        id: true,
        updatedAt: true,
        pbi: {
          select: { id: true, title: true, status: true, updatedAt: true },
        },
      },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    return [...byItemId.values()].map((adjustment) => {
      const item = itemById.get(adjustment.sprintBacklogItemId);
      if (!item) {
        throw localizedError('validation:dailyScrum.adjustmentItemNotInSprint', {}, 400);
      }
      return {
        sprintBacklogItemId: item.id,
        pbiId: item.pbi.id,
        pbiTitleAtAdjustment: item.pbi.title,
        actionType: adjustment.actionType,
        action: adjustment.action,
        pbiStatusAtAdjustment: item.pbi.status,
        // The state the declaration will later be judged against, taken now.
        itemUpdatedAtAtAdjustment: item.updatedAt,
        pbiUpdatedAtAtAdjustment: item.pbi.updatedAt,
      };
    });
  }

  /**
   * The Daily Scrum is an event for the Developers (Scrum Guide 2020, "The
   * Daily Scrum is a 15-minute event for the Developers"). The Inspect & Adapt
   * content it produces — progress toward the Sprint Goal, adaptations, and the
   * next-day plan — is therefore authored by the Developers. The Product Owner
   * and Scrum Master may attend and observe, but only Developers may record or
   * edit the shared team record or register as participants.
   */
  private async assertDeveloperRole(sprintId: string, userId: string): Promise<void> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { teamId: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: sprint.teamId,
          userId,
        },
      },
      select: { role: true },
    });

    if (membership?.role !== UserRole.DEVELOPERS) {
      throw localizedError(
        'validation:dailyScrum.developersOnly',
        {},
        403,
        GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM
      );
    }
  }

  async getDailyScrum(sprintId: string, date?: string): Promise<DailyScrumWithRelations | null> {
    const scrumDate = date ? this.parseDate(date) : this.getTodayDate();
    const record = await prisma.dailyScrum.findUnique({
      where: {
        sprintId_scrumDate: {
          sprintId,
          scrumDate,
        },
      },
      include: DAILY_SCRUM_INCLUDE,
    });
    return record ? toDailyScrumDto(record) : null;
  }

  async getDailyScrums(sprintId: string, date?: string): Promise<DailyScrumWithRelations[]> {
    const whereClause: { sprintId: string; scrumDate?: Date } = {
      sprintId,
    };

    if (date) {
      whereClause.scrumDate = this.parseDate(date);
    }

    const records = await prisma.dailyScrum.findMany({
      where: whereClause,
      include: DAILY_SCRUM_INCLUDE,
      orderBy: {
        scrumDate: 'desc',
      },
    });
    return records.map(toDailyScrumDto);
  }

  /**
   * The team's standing cadence for a date, composed into one payload so the page needs no
   * follow-up calls.
   *
   * Everything is derived from the team's own calendar, and nothing here gates a Daily Scrum.
   * The counts describe what the calendar expected and what the Sprint recorded; a record on a
   * day the calendar did not expect still counts as held, because the Developers are free to
   * meet whenever they judge it useful.
   */
  async getCadence(sprintId: string, date?: string): Promise<DailyScrumCadence> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, teamId: true, startDate: true, endDate: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const reference = date ? this.parseDate(date) : this.getTodayDate();
    // The reference is a local wall-clock day, so it is pinned to its own calendar date before
    // any calendar arithmetic sees it.
    const referenceIso = toLocalIsoDate(reference);

    const { schedule, exceptions, calendar } = await dailyScrumScheduleService.resolveCalendar(
      sprint.teamId,
      resolveCadenceWindow([sprint.startDate, sprint.endDate, referenceIso])
    );

    const expectedDates = listWorkingDays(sprint.startDate, sprint.endDate, calendar);
    const recorded = await prisma.dailyScrum.findMany({
      where: { sprintId },
      select: { scrumDate: true },
    });
    // Read from the database, so these are `@db.Date` values and their UTC date is the calendar
    // date they name.
    const recordedDates = new Set(
      recorded
        .map((record) => toIsoDate(record.scrumDate))
        .filter((iso): iso is string => iso !== null)
    );

    // A Sprint still running has not missed tomorrow: only expected days that have already
    // passed without a record are reported as missed.
    const todayIso = toLocalIsoDate(new Date());
    const missedDates = expectedDates.filter(
      (expectedDate) => !recordedDates.has(expectedDate) && expectedDate <= todayIso
    );

    const exceptionForDate = exceptions.find(
      (exception) => fromDateOnly(exception.date) === referenceIso
    );

    return {
      schedule: schedule ? toScheduleDto(schedule) : null,
      calendar: {
        workingDays: [...calendar.workingDays],
        nonWorkingDays: [...calendar.nonWorkingDays],
      },
      date: referenceIso,
      isWorkingDay: isWorkingDayOn(referenceIso, calendar),
      nonWorkingDayName: exceptionForDate?.name ?? null,
      sprintProgress: sprintWorkingDayProgress(
        sprint.startDate,
        sprint.endDate,
        referenceIso,
        calendar
      ),
      held: recordedDates.size,
      expected: expectedDates.length,
      missedDates,
    };
  }

  async createDailyScrum(
    userId: string,
    data: CreateDailyScrumData
  ): Promise<DailyScrumWithRelations> {
    // Only Developers author the shared Daily Scrum record (Scrum Guide).
    await this.assertDeveloperRole(data.sprintId, userId);

    const sprint = await prisma.sprint.findUnique({
      where: { id: data.sprintId },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const today = this.getTodayDate();
    // The Inspect & Adapt record is authored per date. When a date is supplied
    // (e.g. recording for a past or selected day) it is honored; otherwise the
    // record is stamped with the server's current date.
    const scrumDate = data.scrumDate ? this.parseDate(data.scrumDate) : today;

    const existing = await prisma.dailyScrum.findUnique({
      where: {
        sprintId_scrumDate: {
          sprintId: data.sprintId,
          scrumDate,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError(
        'A Daily Scrum already exists for this date. Please edit the existing record.'
      );
    }

    const noAdaptationNeeded = data.noAdaptationNeeded === true;
    const adjustments = data.backlogAdjustments ?? [];
    this.assertAdaptationEvidence(adjustments.length, noAdaptationNeeded);

    const snapshots = await this.resolveAdjustmentSnapshots(data.sprintId, adjustments);

    const dailyScrum = await prisma.dailyScrum.create({
      data: {
        id: generateUUIDv7(),
        sprintId: data.sprintId,
        scrumDate,
        progressNotes: data.progressNotes ?? null,
        adaptationsNotes: data.adaptationsNotes ?? null,
        planForNextDay: data.planForNextDay ?? null,
        focusMode: data.focusMode ?? null,
        // The inspected baseline, captured once and never rewritten. The Sprint row is already
        // in hand, and the goal is read from it rather than from the request, so a caller cannot
        // record having inspected a goal the Sprint never had.
        sprintGoal: sprint.sprintGoal ?? null,
        noAdaptationNeeded,
        createdBy: userId,
        updatedBy: userId,
        participants: {
          create: {
            id: generateUUIDv7(),
            userId,
            createdBy: userId,
          },
        },
        backlogAdjustments: {
          create: snapshots.map((snapshot) => ({
            id: generateUUIDv7(),
            ...snapshot,
            createdBy: userId,
            updatedBy: userId,
          })),
        },
      },
      include: DAILY_SCRUM_INCLUDE,
    });

    return toDailyScrumDto(dailyScrum);
  }

  async updateDailyScrum(
    id: string,
    userId: string,
    data: UpdateDailyScrumData
  ): Promise<DailyScrumWithRelations> {
    const existing = await prisma.dailyScrum.findUnique({
      where: { id },
      select: {
        id: true,
        sprintId: true,
        noAdaptationNeeded: true,
        backlogAdjustments: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Daily Scrum');
    }

    // Only Developers may edit the shared Daily Scrum record (Scrum Guide).
    await this.assertDeveloperRole(existing.sprintId, userId);

    // The rule applies to the record's resulting state, not to the payload alone: editing only
    // the next-day plan on a record that already carries evidence must not be refused.
    const adjustmentsProvided = data.backlogAdjustments !== undefined;
    const effectiveAdjustmentCount = adjustmentsProvided
      ? (data.backlogAdjustments?.length ?? 0)
      : existing.backlogAdjustments.length;
    const effectiveNoAdaptationNeeded = data.noAdaptationNeeded ?? existing.noAdaptationNeeded;

    this.assertAdaptationEvidence(effectiveAdjustmentCount, effectiveNoAdaptationNeeded);

    const snapshots = adjustmentsProvided
      ? await this.resolveAdjustmentSnapshots(existing.sprintId, data.backlogAdjustments ?? [])
      : [];

    await prisma.$transaction(async (tx) => {
      await tx.dailyScrum.update({
        where: { id },
        data: {
          progressNotes: data.progressNotes ?? undefined,
          adaptationsNotes: data.adaptationsNotes ?? undefined,
          planForNextDay: data.planForNextDay ?? undefined,
          focusMode: data.focusMode === undefined ? undefined : data.focusMode,
          // `undefined` leaves the column unchanged, which is what an absent field means here.
          noAdaptationNeeded: data.noAdaptationNeeded,
          updatedBy: userId,
          // Anyone who contributes to today's Daily Scrum is a participant.
          participants: {
            connectOrCreate: {
              where: { dailyScrumId_userId: { dailyScrumId: id, userId } },
              create: {
                id: generateUUIDv7(),
                userId,
                createdBy: userId,
              },
            },
          },
        },
      });

      // Replace backlog adjustments wholesale when provided (Developers choose). Editing the
      // adaptations re-takes the state snapshot: the declaration is new, so the baseline it will
      // be judged against must be the state at the new declaration, not the original one.
      if (adjustmentsProvided) {
        await tx.dailyScrumBacklogItem.deleteMany({
          where: { dailyScrumId: id },
        });
        if (snapshots.length > 0) {
          await tx.dailyScrumBacklogItem.createMany({
            data: snapshots.map((snapshot) => ({
              id: generateUUIDv7(),
              dailyScrumId: id,
              ...snapshot,
              createdBy: userId,
              updatedBy: userId,
            })),
          });
        }
      }
    });

    const updated = await this.getDailyScrumById(id);
    if (!updated) {
      throw new NotFoundError('Daily Scrum');
    }
    return updated;
  }

  async getDailyScrumById(id: string): Promise<DailyScrumWithRelations | null> {
    const record = await prisma.dailyScrum.findUnique({
      where: { id },
      include: DAILY_SCRUM_INCLUDE,
    });
    return record ? toDailyScrumDto(record) : null;
  }

  /**
   * Adds the authenticated user as a participant of today's team-level Daily Scrum.
   * This records contribution without creating a per-user status report.
   */
  async recordParticipation(
    dailyScrumId: string,
    userId: string
  ): Promise<DailyScrumWithRelations> {
    const dailyScrum = await prisma.dailyScrum.findUnique({
      where: { id: dailyScrumId },
      select: { sprintId: true },
    });

    if (!dailyScrum) {
      throw new NotFoundError('Daily Scrum');
    }

    // Only Developers are participants of the Daily Scrum (Scrum Guide).
    await this.assertDeveloperRole(dailyScrum.sprintId, userId);

    const existing = await prisma.dailyScrumParticipant.findUnique({
      where: {
        dailyScrumId_userId: {
          dailyScrumId,
          userId,
        },
      },
    });

    if (!existing) {
      await prisma.dailyScrumParticipant.create({
        data: {
          id: generateUUIDv7(),
          dailyScrumId,
          userId,
          createdBy: userId,
        },
      });
    }

    const updated = await this.getDailyScrumById(dailyScrumId);
    if (!updated) {
      throw new NotFoundError('Daily Scrum');
    }
    return updated;
  }

  /**
   * Team participation view: who contributed to the Daily Scrum on a date,
   * without framing non-contributors as owing a report.
   */
  async getParticipation(
    sprintId: string,
    date: string
  ): Promise<{
    dailyScrum: DailyScrumWithRelations | null;
    participants: Array<{
      id: string;
      userId: string;
      userName: string;
    }>;
    nonParticipants: Array<{
      userId: string;
      userName: string;
    }>;
  }> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const dailyScrum = await this.getDailyScrum(sprintId, date);

    const participantUserIds = new Set(dailyScrum?.participants.map((p) => p.userId) ?? []);
    // The Daily Scrum is a Developers-only event (Scrum Guide), so only
    // Developers are listed as not yet joined. Product Owner and Scrum Master
    // attend/observe but are not expected to author or "join" the record.
    const developerMembers = sprint.team.members.filter(
      (member) => member.role === UserRole.DEVELOPERS
    );
    const nonParticipants = developerMembers
      .filter((member) => !participantUserIds.has(member.userId))
      .map((member) => ({
        userId: member.userId,
        userName: `${member.user.firstName} ${member.user.lastName}`.trim(),
      }));

    return {
      dailyScrum,
      participants: (dailyScrum?.participants ?? []).map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: `${p.user.firstName} ${p.user.lastName}`.trim(),
      })),
      nonParticipants,
    };
  }

  /**
   * Neutral team-wide Daily Scrum signal, reframing the legacy per-user reminder.
   * Because the Daily Scrum is a Developers-only event (Scrum Guide), the signal
   * is sent only to Developers who have not yet joined today's Daily Scrum. It
   * does not demand an individual report from anyone.
   */
  async sendTeamSignal(
    sprintId: string,
    userId: string
  ): Promise<{
    sentCount: number;
    message: string;
  }> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const dailyScrum = await this.getDailyScrum(sprintId);
    const participantUserIds = new Set(dailyScrum?.participants.map((p) => p.userId) ?? []);
    // Only Developers are signalled to join; Product Owner and Scrum Master
    // attend to observe but are not expected to "join" the record.
    const developerMembers = sprint.team.members.filter(
      (member) => member.role === UserRole.DEVELOPERS
    );
    const memberUserIds = developerMembers
      .map((m) => m.user.id)
      .filter((memberId): memberId is string => !!memberId && !participantUserIds.has(memberId));

    if (memberUserIds.length === 0) {
      return {
        sentCount: 0,
        message: t('notifications:remindersNone'),
      };
    }

    // Create each signal via createLocalized so the notification stores the
    // canonical i18n keys (params.titleKey/messageKey) in addition to the
    // rendered text. The frontend uses those keys to re-translate the title and
    // message at display time, so switching the UI language updates the text
    // instead of showing the language the signal was created in.
    await Promise.all(
      memberUserIds.map((memberUserId) =>
        notificationService.createLocalized({
          userId: memberUserId,
          type: NotificationType.DAILY_SCRUM_SIGNAL,
          titleKey: 'dailyScrumSignalTitle',
          messageKey: 'dailyScrumSignalMessage',
          messageParams: { sprintName: sprint.name },
          data: {
            sprintId,
            sprintName: sprint.name,
            teamId: sprint.teamId,
          },
          createdBy: userId,
        })
      )
    );

    return {
      sentCount: memberUserIds.length,
      message: t('notifications:remindersSent', { count: memberUserIds.length }),
    };
  }

  async promoteToImpediment(
    dailyScrumId: string,
    userId: string,
    data: {
      title: string;
      description: string;
      ownerId?: string;
      sprintId?: string;
      priority?: ImpedimentPriority;
      targetDate?: string | Date | null;
    }
  ): Promise<{
    dailyScrum: DailyScrumWithRelations;
    impediment: Impediment & {
      reportedBy: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
      owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
      sprint?: { id: string; name: string } | null;
    };
  }> {
    const dailyScrum = await prisma.dailyScrum.findUnique({
      where: { id: dailyScrumId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
        sprint: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    if (!dailyScrum) {
      throw new NotFoundError('Daily Scrum');
    }

    // Only Developers may promote an impediment surfaced at the Daily Scrum.
    await this.assertDeveloperRole(dailyScrum.sprintId, userId);

    // `sprint` is a required relation on DailyScrum, so it is always present.
    const sprintTeamId = dailyScrum.sprint.teamId;

    const result = await prisma.$transaction(async (tx) => {
      const impediment = await tx.impediment.create({
        data: {
          id: crypto.randomUUID(),
          // Derive the team and sprint from the Daily Scrum record rather than
          // trusting client-supplied values. This keeps an impediment bound to
          // the sprint in which it was raised (Scrum Guide: surfaced at the event).
          teamId: sprintTeamId,
          sprintId: data.sprintId ?? dailyScrum.sprintId,
          title: data.title,
          description: data.description,
          reportedById: userId,
          ownerId: data.ownerId,
          status: ImpedimentStatus.OPEN,
          // An impediment promoted from the Daily Scrum carries the same impact defaults and
          // audit trail as one reported directly, so every entry point tells the same story.
          priority: data.priority ?? DEFAULT_IMPEDIMENT_PRIORITY,
          targetDate: data.targetDate ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
        include: {
          reportedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          sprint: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return impediment;
    });

    const updatedDailyScrum = await this.getDailyScrumById(dailyScrumId);
    if (!updatedDailyScrum) {
      throw new NotFoundError('Daily Scrum');
    }

    return { dailyScrum: updatedDailyScrum, impediment: result };
  }
}

export const dailyScrumService = new DailyScrumService();
export default dailyScrumService;
