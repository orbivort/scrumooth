import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ConflictError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import {
  type RetrospectiveCategory,
  type RetrospectiveItem as PrismaRetrospectiveItem,
  type RetroActionItem as PrismaRetroActionItem,
  type SprintRetrospective as PrismaSprintRetrospective,
  type RetroAttendee,
  type TeamMember,
  type User,
  type RetroItemVote,
  type ActionItemStatus,
} from '../generated/prisma/client';

export interface RetrospectiveItem {
  id: string;
  retrospectiveId: string;
  category: 'WENT_WELL' | 'DIDNT_GO_WELL' | 'IMPROVEMENT';
  content: string;
  authorId: string | null;
  authorName: string | null;
  votes: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetroActionItem {
  id: string;
  retrospectiveId: string;
  title: string;
  description: string | null;
  ownerId: string;
  dueDate: Date | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  addedToSprintBacklog: boolean;
  relatedSprintId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SprintRetrospective {
  id: string;
  sprintId: string;
  teamId: string;
  retroDate: Date;
  facilitatorId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  isAnonymous: boolean;
  summary?: string;
  smNotes?: string;
  dodEvolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  items: RetrospectiveItem[];
  actionItems: RetroActionItem[];
  participants: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role: string;
  }>;
  attendees?: Array<{
    id: string;
    name: string;
    email?: string;
    role: string;
    attended: boolean;
  }>;
}

class RetrospectiveService {
  async getRetrospectivesByTeam(teamId: string): Promise<SprintRetrospective[]> {
    const retrospectives = await prisma.sprintRetrospective.findMany({
      where: { teamId },
      include: {
        items: {
          include: {
            votesBy: {
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
          },
        },
        actionItems: true,
        attendees: true,
      },
      orderBy: { retroDate: 'desc' },
    });

    return retrospectives.map((retro) => this.formatRetrospective(retro));
  }

  async getRetrospectiveById(id: string): Promise<SprintRetrospective> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            votesBy: {
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
          },
        },
        actionItems: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attendees: true,
        sprint: {
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
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective not found');
    }

    return this.formatRetrospective(retrospective);
  }

  async getRetrospectiveBySprintId(sprintId: string): Promise<SprintRetrospective | null> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { sprintId },
      include: {
        items: {
          include: {
            votesBy: {
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
          },
        },
        actionItems: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attendees: true,
        sprint: {
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
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!retrospective) {
      return null;
    }

    return this.formatRetrospective(retrospective);
  }

  async createRetrospective(data: Partial<SprintRetrospective>): Promise<SprintRetrospective> {
    const sprintId = data.sprintId;
    const teamId = data.teamId;
    const facilitatorId = data.facilitatorId;

    if (!sprintId || !teamId || !facilitatorId) {
      throw new BadRequestError('Sprint ID, Team ID, and Facilitator ID are required');
    }

    // Check if a retrospective already exists for this sprint
    const existingRetrospective = await prisma.sprintRetrospective.findUnique({
      where: { sprintId },
    });

    if (existingRetrospective) {
      throw new Error(`A retrospective already exists for sprint ${sprintId}`);
    }

    // Convert string date to Date object if needed
    const retroDate = data.retroDate ? new Date(data.retroDate) : new Date();

    const retrospective = await prisma.sprintRetrospective.create({
      data: {
        id: uuidv4(),
        sprintId,
        teamId,
        retroDate,
        facilitatorId,
        isAnonymous: data.isAnonymous ?? false,
      },
      include: {
        items: true,
        actionItems: true,
        attendees: true,
      },
    });

    return this.formatRetrospective(retrospective);
  }

  async addItem(
    retrospectiveId: string,
    item: Partial<RetrospectiveItem>
  ): Promise<RetrospectiveItem> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id: retrospectiveId },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective not found');
    }

    const content = item.content;
    if (!content) {
      throw new BadRequestError('Item content is required');
    }

    const maxOrder = await prisma.retrospectiveItem.findFirst({
      where: { retrospectiveId },
      orderBy: { order: 'desc' },
    });

    const newItem = await prisma.retrospectiveItem.create({
      data: {
        id: uuidv4(),
        retrospectiveId,
        category: item.category as RetrospectiveCategory,
        content,
        authorId: item.authorId,
        authorName: item.authorName,
        votes: 0,
        order: (maxOrder?.order ?? 0) + 1,
      },
    });

    return newItem;
  }

  async voteItem(
    retrospectiveId: string,
    itemId: string,
    userId: string
  ): Promise<RetrospectiveItem> {
    const item = await prisma.retrospectiveItem.findUnique({
      where: { id: itemId },
    });

    if (item?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Item not found');
    }

    const existingVote = await prisma.retroItemVote.findUnique({
      where: {
        retrospectiveItemId_userId: {
          retrospectiveItemId: itemId,
          userId,
        },
      },
    });

    if (existingVote) {
      throw new ConflictError('User has already voted for this item');
    }

    await prisma.retroItemVote.create({
      data: {
        id: uuidv4(),
        retrospectiveItemId: itemId,
        userId,
      },
    });

    const updatedItem = await prisma.retrospectiveItem.update({
      where: { id: itemId },
      data: {
        votes: { increment: 1 },
      },
    });

    return updatedItem;
  }

  async unvoteItem(
    retrospectiveId: string,
    itemId: string,
    userId: string
  ): Promise<RetrospectiveItem> {
    const item = await prisma.retrospectiveItem.findUnique({
      where: { id: itemId },
    });

    if (item?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Item not found');
    }

    const existingVote = await prisma.retroItemVote.findUnique({
      where: {
        retrospectiveItemId_userId: {
          retrospectiveItemId: itemId,
          userId,
        },
      },
    });

    if (!existingVote) {
      throw new NotFoundError('User has not voted for this item');
    }

    await prisma.retroItemVote.delete({
      where: {
        retrospectiveItemId_userId: {
          retrospectiveItemId: itemId,
          userId,
        },
      },
    });

    const updatedItem = await prisma.retrospectiveItem.update({
      where: { id: itemId },
      data: {
        votes: { decrement: 1 },
      },
    });

    return updatedItem;
  }

  async updateItem(
    retrospectiveId: string,
    itemId: string,
    updates: Partial<RetrospectiveItem>
  ): Promise<RetrospectiveItem> {
    const item = await prisma.retrospectiveItem.findUnique({
      where: { id: itemId },
    });

    if (item?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Item not found');
    }

    const updateData: { content?: string } = {};
    if (updates.content !== undefined) {
      updateData.content = updates.content;
    }

    const updatedItem = await prisma.retrospectiveItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return updatedItem;
  }

  async deleteItem(retrospectiveId: string, itemId: string): Promise<void> {
    const item = await prisma.retrospectiveItem.findUnique({
      where: { id: itemId },
    });

    if (item?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Item not found');
    }

    await prisma.retrospectiveItem.delete({
      where: { id: itemId },
    });
  }

  async addActionItem(
    retrospectiveId: string,
    actionItem: Partial<RetroActionItem>
  ): Promise<RetroActionItem> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id: retrospectiveId },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective not found');
    }

    if (!actionItem.title) {
      throw new BadRequestError('Action item title is required');
    }

    if (!actionItem.ownerId) {
      throw new BadRequestError('Action item owner is required');
    }

    const newActionItem = await prisma.retroActionItem.create({
      data: {
        id: uuidv4(),
        retrospectiveId,
        title: actionItem.title,
        description: actionItem.description ?? undefined,
        ownerId: actionItem.ownerId,
        dueDate: actionItem.dueDate ? new Date(actionItem.dueDate) : null,
        status: actionItem.status ?? 'PENDING',
        addedToSprintBacklog: false,
      },
    });

    return newActionItem;
  }

  async updateActionItem(
    retrospectiveId: string,
    actionItemId: string,
    updates: Partial<RetroActionItem>
  ): Promise<RetroActionItem> {
    const actionItem = await prisma.retroActionItem.findUnique({
      where: { id: actionItemId },
    });

    if (actionItem?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Action item not found');
    }

    const updateData: {
      title?: string;
      description?: string | null;
      status?: ActionItemStatus;
      dueDate?: Date | null;
      addedToSprintBacklog?: boolean;
      relatedSprintId?: string | null;
      completedAt?: Date | null;
    } = {};
    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description ?? undefined;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status as ActionItemStatus;
    }
    if (updates.dueDate !== undefined) {
      updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if (updates.addedToSprintBacklog !== undefined) {
      updateData.addedToSprintBacklog = updates.addedToSprintBacklog;
    }
    if (updates.relatedSprintId !== undefined) {
      updateData.relatedSprintId = updates.relatedSprintId;
    }
    if (updates.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updatedActionItem = await prisma.retroActionItem.update({
      where: { id: actionItemId },
      data: updateData,
    });

    return updatedActionItem;
  }

  async deleteActionItem(retrospectiveId: string, actionItemId: string): Promise<void> {
    const actionItem = await prisma.retroActionItem.findUnique({
      where: { id: actionItemId },
    });

    if (actionItem?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Action item not found');
    }

    await prisma.retroActionItem.delete({
      where: { id: actionItemId },
    });
  }

  private formatRetrospective(
    retro: PrismaSprintRetrospective & {
      items?: (PrismaRetrospectiveItem & {
        votesBy?: (RetroItemVote & {
          user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
        })[];
      })[];
      actionItems?: (PrismaRetroActionItem & {
        owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
      })[];
      attendees?: RetroAttendee[];
      sprint?: {
        team?: {
          members?: (TeamMember & {
            user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
          })[];
        } | null;
      } | null;
    }
  ): SprintRetrospective {
    const participants =
      retro.sprint?.team?.members?.map((member) => ({
        id: member.userId,
        firstName: member.user?.firstName,
        lastName: member.user?.lastName,
        email: member.user?.email,
        role: member.role,
      })) ?? [];

    const items =
      retro.items?.map((item) => ({
        id: item.id,
        retrospectiveId: item.retrospectiveId,
        category: item.category,
        content: item.content,
        authorId: item.authorId,
        authorName: item.authorName,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        order: item.order,
        votes: item.votesBy?.length ?? 0,
        votedBy: item.votesBy?.map((vote) => vote.userId) ?? [],
      })) ?? [];

    const actionItems =
      retro.actionItems?.map((action) => ({
        ...action,
        owner: action.owner
          ? {
              id: action.owner.id,
              firstName: action.owner.firstName,
              lastName: action.owner.lastName,
              email: action.owner.email,
            }
          : undefined,
      })) ?? [];

    const attendees =
      retro.attendees?.map((attendee) => ({
        id: attendee.id,
        name: attendee.name,
        email: attendee.email ?? undefined,
        role: attendee.role,
        attended: attendee.attended,
      })) ?? [];

    return {
      id: retro.id,
      sprintId: retro.sprintId,
      teamId: retro.teamId,
      retroDate: retro.retroDate,
      facilitatorId: retro.facilitatorId,
      status: retro.status as SprintRetrospective['status'],
      isAnonymous: retro.isAnonymous,
      summary: retro.summary ?? undefined,
      smNotes: retro.smNotes ?? undefined,
      dodEvolutionNotes: retro.dodEvolutionNotes ?? undefined,
      createdAt: retro.createdAt,
      updatedAt: retro.updatedAt,
      items,
      actionItems,
      participants,
      attendees,
    };
  }

  async updateRetrospective(
    id: string,
    data: {
      summary?: string;
      dodEvolutionNotes?: string;
      status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
    }
  ): Promise<SprintRetrospective> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective not found');
    }

    // "The Sprint Review is the second-to-last event of the Sprint and the Sprint Retrospective
    // concludes the Sprint." Completing the Retrospective is therefore gated twice: the Sprint
    // Review must already be completed (the ordering the Guide prescribes), and the Sprint must
    // have reached its end date (the Retrospective concludes it, it does not pre-empt it).
    if (data.status === 'COMPLETED' && retrospective.status !== 'COMPLETED') {
      const sprint = await prisma.sprint.findUnique({
        where: { id: retrospective.sprintId },
        select: { endDate: true },
      });

      if (!sprint) {
        throw new NotFoundError('Sprint');
      }

      if (new Date() < sprint.endDate) {
        throw localizedError(
          'errors:sprintReview.eventBeforeEndDate',
          { endDate: sprint.endDate.toISOString().slice(0, 10) },
          400,
          GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE
        );
      }

      const sprintReview = await prisma.sprintReview.findUnique({
        where: { sprintId: retrospective.sprintId },
        select: { status: true },
      });

      if (sprintReview?.status !== 'completed') {
        throw localizedError(
          'errors:sprintReview.retrospectiveRequiresReview',
          {},
          400,
          GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW
        );
      }
    }

    const updateData: {
      summary?: string;
      dodEvolutionNotes?: string;
      status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
    } = {};

    if (data.summary !== undefined) {
      updateData.summary = data.summary;
    }

    if (data.dodEvolutionNotes !== undefined) {
      updateData.dodEvolutionNotes = data.dodEvolutionNotes;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const updated = await prisma.sprintRetrospective.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        actionItems: true,
        attendees: true,
      },
    });

    return this.formatRetrospective(updated);
  }

  async getPendingActionItemsByTeam(teamId: string): Promise<RetroActionItem[]> {
    const retrospectives = await prisma.sprintRetrospective.findMany({
      where: { teamId },
      include: {
        actionItems: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            addedToSprintBacklog: false,
          },
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { retroDate: 'desc' },
    });

    const pendingActionItems: Array<
      RetroActionItem & { sprint?: { id: string; name: string } | null }
    > = [];

    for (const retro of retrospectives) {
      for (const actionItem of retro.actionItems) {
        pendingActionItems.push({
          ...actionItem,
          retrospectiveId: retro.id,
          sprint: retro.sprint,
        });
      }
    }

    return pendingActionItems;
  }

  async addAttendee(
    retrospectiveId: string,
    data: { name: string; email?: string; role: string; attended: boolean }
  ): Promise<RetroAttendee> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id: retrospectiveId },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective not found');
    }

    const attendee = await prisma.retroAttendee.create({
      data: {
        id: uuidv4(),
        retrospectiveId,
        name: data.name,
        email: data.email,
        role: data.role,
        attended: data.attended,
      },
    });

    return attendee;
  }

  async updateAttendee(
    attendeeId: string,
    updates: {
      name?: string;
      email?: string;
      role?: string;
      attended?: boolean;
    }
  ): Promise<RetroAttendee> {
    const attendee = await prisma.retroAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      throw new NotFoundError('Attendee not found');
    }

    const updateData: {
      name?: string;
      email?: string | null;
      role?: string;
      attended?: boolean;
    } = {};
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.email !== undefined) {
      updateData.email = updates.email;
    }
    if (updates.role !== undefined) {
      updateData.role = updates.role;
    }
    if (updates.attended !== undefined) {
      updateData.attended = updates.attended;
    }

    const updated = await prisma.retroAttendee.update({
      where: { id: attendeeId },
      data: updateData,
    });

    return updated;
  }

  async deleteAttendee(attendeeId: string): Promise<void> {
    const attendee = await prisma.retroAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      throw new NotFoundError('Attendee not found');
    }

    await prisma.retroAttendee.delete({
      where: { id: attendeeId },
    });
  }
}

export const retrospectiveService = new RetrospectiveService();
