import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ConflictError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import {
  NotificationType,
  ImpedimentStatus,
  UserRole,
  type DailyScrum,
  type Impediment,
  type User,
  type Prisma,
} from '../generated/prisma/client';
import { t } from '../i18n/requestT.js';
import { notificationService } from './notification.service';

export interface CreateDailyScrumData {
  sprintId: string;
  scrumDate?: string;
  progressNotes?: string;
  adaptationsNotes?: string;
  planForNextDay?: string;
  focusMode?: string | null;
  backlogAdjustments?: Array<{
    sprintBacklogItemId: string;
    action: string;
  }>;
}

export interface UpdateDailyScrumData {
  progressNotes?: string;
  adaptationsNotes?: string;
  planForNextDay?: string;
  focusMode?: string | null;
  backlogAdjustments?: Array<{
    sprintBacklogItemId: string;
    action: string;
  }>;
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
  backlogAdjustments: Array<{
    id: string;
    sprintBacklogItemId: string;
    action: string;
    sprintBacklogItem?: {
      id: string;
      pbiId: string;
      pbi?: {
        id: string;
        title: string;
      };
    } | null;
  }>;
}

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

  private includeRelations() {
    return {
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
          sprintBacklogItem: {
            include: {
              pbi: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.DailyScrumInclude;
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
    return prisma.dailyScrum.findUnique({
      where: {
        sprintId_scrumDate: {
          sprintId,
          scrumDate,
        },
      },
      include: this.includeRelations(),
    });
  }

  async getDailyScrums(sprintId: string, date?: string): Promise<DailyScrumWithRelations[]> {
    const whereClause: { sprintId: string; scrumDate?: Date } = {
      sprintId,
    };

    if (date) {
      whereClause.scrumDate = this.parseDate(date);
    }

    return prisma.dailyScrum.findMany({
      where: whereClause,
      include: this.includeRelations(),
      orderBy: {
        scrumDate: 'desc',
      },
    });
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

    const dailyScrum = await prisma.dailyScrum.create({
      data: {
        id: generateUUIDv7(),
        sprintId: data.sprintId,
        scrumDate,
        progressNotes: data.progressNotes ?? null,
        adaptationsNotes: data.adaptationsNotes ?? null,
        planForNextDay: data.planForNextDay ?? null,
        focusMode: data.focusMode ?? null,
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
          create:
            data.backlogAdjustments?.map((adjustment) => ({
              id: generateUUIDv7(),
              sprintBacklogItemId: adjustment.sprintBacklogItemId,
              action: adjustment.action,
              createdBy: userId,
              updatedBy: userId,
            })) ?? [],
        },
      },
      include: this.includeRelations(),
    });

    return dailyScrum;
  }

  async updateDailyScrum(
    id: string,
    userId: string,
    data: UpdateDailyScrumData
  ): Promise<DailyScrumWithRelations> {
    const existing = await prisma.dailyScrum.findUnique({
      where: { id },
      select: { id: true, sprintId: true },
    });

    if (!existing) {
      throw new NotFoundError('Daily Scrum');
    }

    // Only Developers may edit the shared Daily Scrum record (Scrum Guide).
    await this.assertDeveloperRole(existing.sprintId, userId);

    await prisma.$transaction(async (tx) => {
      await tx.dailyScrum.update({
        where: { id },
        data: {
          progressNotes: data.progressNotes ?? undefined,
          adaptationsNotes: data.adaptationsNotes ?? undefined,
          planForNextDay: data.planForNextDay ?? undefined,
          focusMode: data.focusMode === undefined ? undefined : data.focusMode,
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

      // Replace backlog adjustments wholesale when provided (Developers choose).
      if (data.backlogAdjustments !== undefined) {
        await tx.dailyScrumBacklogItem.deleteMany({
          where: { dailyScrumId: id },
        });
        if (data.backlogAdjustments.length > 0) {
          await tx.dailyScrumBacklogItem.createMany({
            data: data.backlogAdjustments.map((adjustment) => ({
              id: generateUUIDv7(),
              dailyScrumId: id,
              sprintBacklogItemId: adjustment.sprintBacklogItemId,
              action: adjustment.action,
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
    return prisma.dailyScrum.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
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
          createdBy: userId,
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
