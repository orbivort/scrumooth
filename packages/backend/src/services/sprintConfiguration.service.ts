import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import type {
  SprintConfiguration,
  GeneratedSprint,
  SprintDuration,
  SprintStatus,
} from '../generated/prisma/client';

const DURATION_MAP: Record<SprintDuration, { days: number; label: string; offset: number }> = {
  ONE_WEEK: { days: 7, label: '1w', offset: 1 },
  TWO_WEEKS: { days: 14, label: '2w', offset: 2 },
  THREE_WEEKS: { days: 21, label: '3w', offset: 2 },
  FOUR_WEEKS: { days: 28, label: '4w', offset: 3 },
};

function adjustToPreviousFriday(date: Date): Date {
  const adjusted = new Date(date);
  const dayOfWeek = adjusted.getDay();
  if (dayOfWeek === 6) {
    adjusted.setDate(adjusted.getDate() - 1);
  } else if (dayOfWeek === 0) {
    adjusted.setDate(adjusted.getDate() - 2);
  }
  return adjusted;
}

export interface CreateSprintConfigData {
  teamId: string;
  duration: SprintDuration;
  year: number;
  sprintStartDay?: number;
}

export interface UpdateSprintConfigData {
  duration?: SprintDuration;
  year?: number;
  sprintStartDay?: number;
}

export interface GenerateSprintsData {
  teamId: string;
  duration: SprintDuration;
  year: number;
}

export interface SprintGenerationResult {
  success: boolean;
  generatedCount: number;
  sprints: GeneratedSprint[];
  message?: string;
}

class SprintConfigurationService {
  async getSprintConfiguration(teamId: string): Promise<SprintConfiguration | null> {
    const config = await prisma.sprintConfiguration.findUnique({
      where: { teamId },
    });
    return config;
  }

  async createSprintConfiguration(
    userId: string,
    data: CreateSprintConfigData
  ): Promise<SprintConfiguration> {
    const existingConfig = await prisma.sprintConfiguration.findUnique({
      where: { teamId: data.teamId },
    });

    if (existingConfig) {
      throw new BadRequestError('Sprint configuration already exists for this team');
    }

    const configId = generateUUIDv7();

    const config = await prisma.sprintConfiguration.create({
      data: {
        id: configId,
        teamId: data.teamId,
        duration: data.duration,
        year: data.year,
        sprintStartDay: data.sprintStartDay ?? 1,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return config;
  }

  async updateSprintConfiguration(
    id: string,
    userId: string,
    data: UpdateSprintConfigData
  ): Promise<SprintConfiguration> {
    const existingConfig = await prisma.sprintConfiguration.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      throw new NotFoundError('Sprint configuration');
    }

    const config = await prisma.sprintConfiguration.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
      },
    });

    return config;
  }

  async generateSprintsForYear(
    userId: string,
    data: GenerateSprintsData
  ): Promise<SprintGenerationResult> {
    const { teamId, duration, year } = data;

    await prisma.generatedSprint.deleteMany({
      where: { teamId, year },
    });

    const sprints: GeneratedSprint[] = [];
    const shortYear = year.toString().slice(-2);
    const durationConfig = DURATION_MAP[duration];
    const weekDuration = durationConfig.days;
    const durationStr = durationConfig.label;

    const currentDate = new Date(year, 0, 1);
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 1) {
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      currentDate.setDate(currentDate.getDate() + daysUntilMonday);
    }

    let sprintNumber = 1;

    while (currentDate.getFullYear() <= year) {
      const startDate = new Date(currentDate);
      const rawEndDate = new Date(currentDate);
      rawEndDate.setDate(rawEndDate.getDate() + weekDuration - durationConfig.offset);
      const endDate = adjustToPreviousFriday(rawEndDate);

      if (startDate.getFullYear() > year) break;

      const formattedSprintNum = sprintNumber.toString().padStart(2, '0');
      // Format date as ISO 8601 (YYYY-MM-DD) for unambiguous, sortable sprint names
      const formatDateSimple = (d: Date): string => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      // Use en-dash (U+2013) as typographically correct range separator
      const dateRange = `${formatDateSimple(startDate)} – ${formatDateSimple(endDate)}`;
      const name = `Sprint-${durationStr}-${shortYear}${formattedSprintNum} (${dateRange})`;

      const sprintId = generateUUIDv7();

      const sprint = await prisma.generatedSprint.create({
        data: {
          id: sprintId,
          teamId,
          name,
          sprintNumber,
          year,
          startDate,
          endDate,
          status: 'PLANNED' as SprintStatus,
          createdBy: userId,
        },
      });

      sprints.push(sprint);

      currentDate.setDate(currentDate.getDate() + weekDuration);
      sprintNumber++;
    }

    return {
      success: true,
      generatedCount: sprints.length,
      sprints,
      message: `Successfully generated ${sprints.length} sprints for ${year}`,
    };
  }

  async getGeneratedSprints(teamId: string, year?: number): Promise<GeneratedSprint[]> {
    const where: { teamId: string; year?: number } = { teamId };
    if (year) {
      where.year = year;
    }

    const sprints = await prisma.generatedSprint.findMany({
      where,
      orderBy: { sprintNumber: 'asc' },
      include: {
        sprint: { select: { id: true, status: true } },
      },
    });

    // The authoritative lifecycle status lives on the materialized Sprint (linked via
    // GeneratedSprint.sprintId). The GeneratedSprint.status field is not always kept in sync
    // for sprints completed before the sync fix, so surface the real status where available.
    return sprints.map(({ sprint, ...generated }) => ({
      ...generated,
      status: sprint?.status ?? generated.status,
    }));
  }

  async deleteGeneratedSprint(sprintId: string): Promise<void> {
    const sprint = await prisma.generatedSprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new NotFoundError('Generated sprint');
    }

    if (sprint.status === 'ACTIVE') {
      throw new BadRequestError('Cannot delete an active sprint');
    }

    await prisma.generatedSprint.delete({
      where: { id: sprintId },
    });
  }

  async updateGeneratedSprint(
    sprintId: string,
    userId: string,
    updates: { sprintGoal?: string }
  ): Promise<GeneratedSprint> {
    const sprint = await prisma.generatedSprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new NotFoundError('Generated sprint');
    }

    // The Sprint Goal is authored by the team that owns the Sprint: only a member of that team
    // may write it, so a non-member cannot rewrite another team's commitment through the API.
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId: sprint.teamId, userId },
      select: { id: true },
    });

    if (!teamMember) {
      throw localizedError(
        'errors:sprint.teamMembersOnly',
        {},
        403,
        GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY
      );
    }

    // The Guide treats the Sprint Goal as the commitment the team inspects during the Sprint.
    // Once the Sprint is running it is therefore frozen: the sanctioned way to revise it is the
    // Product Owner's acknowledgement of a goal-endangering Sprint Backlog change, which records
    // the renegotiation. The authoritative lifecycle status lives on the materialized Sprint
    // (the GeneratedSprint status is the planning-side mirror), so resolve both.
    const linkedSprint = sprint.sprintId
      ? await prisma.sprint.findUnique({
          where: { id: sprint.sprintId },
          select: { status: true },
        })
      : null;

    const authoritativeStatus = linkedSprint?.status ?? sprint.status;

    if (authoritativeStatus !== 'DRAFT' && authoritativeStatus !== 'PLANNED') {
      throw localizedError(
        'errors:sprint.goalLocked',
        { status: authoritativeStatus },
        400,
        GATE_CODES.SPRINT_GOAL_LOCKED
      );
    }

    // Keep the materialized Sprint record in sync: once a Sprint has been materialized from
    // this GeneratedSprint (e.g. during `saveSprintBacklog`), the Sprint Goal is committed on
    // the Sprint record. `startSprint` reads the goal from the Sprint, so it must be updated
    // here too, otherwise a later goal edit would be lost and the sprint could not be started.
    const updatedSprint = await prisma.$transaction(async (tx) => {
      const result = await tx.generatedSprint.update({
        where: { id: sprintId },
        data: {
          ...updates,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      });

      if (sprint.sprintId && updates.sprintGoal !== undefined) {
        await tx.sprint.update({
          where: { id: sprint.sprintId },
          data: { sprintGoal: updates.sprintGoal },
        });
      }

      return result;
    });

    return updatedSprint;
  }
}

export const sprintConfigurationService = new SprintConfigurationService();
export default sprintConfigurationService;
