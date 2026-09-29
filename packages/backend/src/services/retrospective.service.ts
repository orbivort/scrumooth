import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ConflictError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import type { DodReflection } from '@scrumooth/shared';
import {
  isRetrospectiveScrumMaster,
  assertRetrospectiveAccess,
  assertRetrospectiveTeamMember,
  type RetrospectiveMembership,
} from './retrospectiveAccess';
import { definitionOfDoneService } from './dod.service';
import { productBacklogService } from './backlog.service';
import { sprintReviewService } from './sprintReview.service';
import { logger } from '../utils/logger';
import {
  auditResourceEvent,
  AuditActions,
  AuditEventTypes,
  AuditResults,
} from '../utils/auditLogger';
import { Prisma } from '../generated/prisma/client';
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
  /** The Product Backlog item this improvement produced, or was linked to. */
  productBacklogItemId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Evidence of the follow-through: the linked item, when one exists. */
  productBacklogItem?: { id: string; title: string } | null;
  owner?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
  };
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
  /** Per-criterion Definition of Done reflection recorded during the event. */
  dodReflections: DodReflection[] | null;
  /** The Definition of Done version this Retrospective produced, once its changes were applied. */
  dodVersionAtPush: number | null;
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

/**
 * The Product Backlog item an action item produced or was linked to.
 *
 * Loaded through a relation rather than a second query so a Retrospective read stays one statement
 * however many action items it holds.
 */
const LINKED_BACKLOG_ITEM_SELECT = { select: { id: true, title: true } } as const;

/**
 * The label a backlog item created from a Retrospective action item carries.
 *
 * A stable contract, matching the label the Backlog page already prefixes when it prefills a new
 * item from a pending action item, so the two paths remain indistinguishable to a filter.
 */
export const RETRO_ACTION_ITEM_LABEL = 'retro-action';

class RetrospectiveService {
  async getRetrospectivesByTeam(
    teamId: string,
    userId: string | undefined
  ): Promise<SprintRetrospective[]> {
    const membership = await assertRetrospectiveTeamMember(userId, teamId);

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
        actionItems: {
          include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
        },
        attendees: true,
      },
      orderBy: { retroDate: 'desc' },
    });

    return retrospectives.map((retro) => this.formatRetrospective(retro, membership));
  }

  async getRetrospectiveById(id: string, userId: string | undefined): Promise<SprintRetrospective> {
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
            productBacklogItem: LINKED_BACKLOG_ITEM_SELECT,
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
      throw new NotFoundError('Retrospective');
    }

    const membership = await assertRetrospectiveTeamMember(userId, retrospective.teamId);

    return this.formatRetrospective(retrospective, membership);
  }

  async getRetrospectiveBySprintId(
    sprintId: string,
    userId: string | undefined
  ): Promise<SprintRetrospective | null> {
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
            productBacklogItem: LINKED_BACKLOG_ITEM_SELECT,
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

    // A Sprint id is not a Retrospective id, so the owning team is only known once the row is
    // loaded. Nothing is returned before the check, and a non-member is refused rather than told
    // whether the Sprint holds a Retrospective at all.
    const membership = await assertRetrospectiveTeamMember(userId, retrospective.teamId);

    return this.formatRetrospective(retrospective, membership);
  }

  async createRetrospective(
    data: Partial<SprintRetrospective>,
    userId: string | undefined
  ): Promise<SprintRetrospective> {
    const sprintId = data.sprintId;
    const teamId = data.teamId;
    const facilitatorId = data.facilitatorId;

    if (!sprintId || !teamId || !facilitatorId) {
      throw new BadRequestError('Sprint ID, Team ID, and Facilitator ID are required');
    }

    const membership = await assertRetrospectiveTeamMember(userId, teamId);

    // The Sprint and the team must agree. Without this, a caller could open a Retrospective against
    // another team's Sprint under their own team id: the Retrospective is unique per Sprint, and a
    // Sprint cannot close until its Retrospective is COMPLETED, so a foreign retrospective is a way
    // to hold another team's Sprint open.
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { teamId: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    if (sprint.teamId !== teamId) {
      throw localizedError(
        'errors:retrospective.teamMembersOnly',
        {},
        403,
        GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY
      );
    }

    // Check if a retrospective already exists for this sprint
    const existingRetrospective = await prisma.sprintRetrospective.findUnique({
      where: { sprintId },
    });

    if (existingRetrospective) {
      throw new ConflictError(
        `A retrospective already exists for sprint ${sprintId}`,
        'RETROSPECTIVE_ALREADY_EXISTS'
      );
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

    return this.formatRetrospective(retrospective, membership);
  }

  async addItem(
    retrospectiveId: string,
    item: Partial<RetrospectiveItem>,
    userId: string | undefined
  ): Promise<RetrospectiveItem> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id: retrospectiveId },
      select: { teamId: true, isAnonymous: true },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective');
    }

    await assertRetrospectiveTeamMember(userId, retrospective.teamId);

    const content = item.content;
    if (!content) {
      throw new BadRequestError('Item content is required');
    }

    // Authorship comes from the session, never from the request body. A client-supplied author
    // would let one member post in another member's name, and would survive into an anonymous
    // Retrospective as a way to de-anonymise it. For the same reason an anonymous Retrospective
    // stores no author at all: "hidden in the interface" is not anonymity, "not recorded" is.
    let authorId: string | null = null;
    let authorName: string | null = null;

    if (!retrospective.isAnonymous && userId) {
      const author = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      authorId = userId;
      authorName = author ? `${author.firstName} ${author.lastName}`.trim() : null;
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
        authorId,
        authorName,
        votes: 0,
        order: (maxOrder?.order ?? 0) + 1,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    return newItem;
  }

  async voteItem(
    retrospectiveId: string,
    itemId: string,
    userId: string
  ): Promise<RetrospectiveItem> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

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
        createdBy: userId,
      },
    });

    const updatedItem = await prisma.retrospectiveItem.update({
      where: { id: itemId },
      data: {
        votes: { increment: 1 },
        updatedBy: userId,
      },
    });

    return updatedItem;
  }

  async unvoteItem(
    retrospectiveId: string,
    itemId: string,
    userId: string
  ): Promise<RetrospectiveItem> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

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
        updatedBy: userId,
      },
    });

    return updatedItem;
  }

  async updateItem(
    retrospectiveId: string,
    itemId: string,
    updates: Partial<RetrospectiveItem>,
    userId: string | undefined
  ): Promise<RetrospectiveItem> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

    const item = await prisma.retrospectiveItem.findUnique({
      where: { id: itemId },
    });

    if (item?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Item not found');
    }

    const updateData: { content?: string; updatedBy?: string } = {};
    if (updates.content !== undefined) {
      updateData.content = updates.content;
    }
    if (userId !== undefined) {
      updateData.updatedBy = userId;
    }

    const updatedItem = await prisma.retrospectiveItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return updatedItem;
  }

  async deleteItem(
    retrospectiveId: string,
    itemId: string,
    userId: string | undefined
  ): Promise<void> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

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
    actionItem: Partial<RetroActionItem>,
    userId: string | undefined
  ): Promise<RetroActionItem> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

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
        createdBy: userId,
        updatedBy: userId,
      },
      include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
    });

    return this.formatActionItem(newActionItem);
  }

  async updateActionItem(
    retrospectiveId: string,
    actionItemId: string,
    updates: Partial<RetroActionItem>,
    userId: string | undefined
  ): Promise<RetroActionItem> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

    const actionItem = await prisma.retroActionItem.findUnique({
      where: { id: actionItemId },
      include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
    });

    if (actionItem?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Action item');
    }

    const updateData: {
      title?: string;
      description?: string | null;
      status?: ActionItemStatus;
      dueDate?: Date | null;
      addedToSprintBacklog?: boolean;
      completedAt?: Date | null;
      updatedBy?: string;
    } = {};

    // The manual flag is an assertion; the link is the evidence. Once an action item has produced
    // a backlog item, "not added to the backlog" is not a state the caller may write, because the
    // record would then contradict itself. Use the link endpoints to change that relationship.
    if (updates.addedToSprintBacklog === false && actionItem.productBacklogItemId) {
      throw localizedError(
        'errors:retrospective.actionItemLinked',
        { title: actionItem.productBacklogItem?.title ?? '' },
        409,
        GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED
      );
    }

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
    if (updates.status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }
    if (userId !== undefined) {
      updateData.updatedBy = userId;
    }

    const updatedActionItem = await prisma.retroActionItem.update({
      where: { id: actionItemId },
      data: updateData,
      include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
    });

    return this.formatActionItem(updatedActionItem);
  }

  async deleteActionItem(
    retrospectiveId: string,
    actionItemId: string,
    userId: string | undefined
  ): Promise<void> {
    await assertRetrospectiveAccess(userId, retrospectiveId);

    const actionItem = await prisma.retroActionItem.findUnique({
      where: { id: actionItemId },
    });

    if (actionItem?.retrospectiveId !== retrospectiveId) {
      throw new NotFoundError('Action item');
    }

    await prisma.retroActionItem.delete({
      where: { id: actionItemId },
    });
  }

  /**
   * Carry an action item into the Product Backlog as a new item.
   *
   * "The most impactful improvements are addressed as soon as possible. They may even be added to
   * the Sprint Backlog for the next Sprint." The link recorded here is what makes that follow-
   * through provable: `addedToSprintBacklog` alone was an assertion nobody could check, and a
   * frontend that prefilled the backlog's create form could not guarantee the link at all (the
   * user may edit or cancel before saving).
   *
   * Item creation goes through the Product Backlog service so the Product Goal anchor, the backlog
   * rank and the workflow history are identical to a hand-made item. The two writes cannot share
   * one transaction without bypassing those invariants, so the item is removed again if the link
   * cannot be recorded, and no orphan is left behind.
   *
   * @throws ConflictError (409, `GATE_RETROSPECTIVE_ACTION_ITEM_LINKED`) when the improvement
   *   already has a linked item.
   */
  async materializeActionItem(
    actionItemId: string,
    userId: string | undefined
  ): Promise<RetroActionItem> {
    const actionItem = await prisma.retroActionItem.findUnique({
      where: { id: actionItemId },
      include: {
        retrospective: { select: { id: true, teamId: true } },
        productBacklogItem: LINKED_BACKLOG_ITEM_SELECT,
      },
    });

    if (!actionItem) {
      throw new NotFoundError('Action item');
    }

    await assertRetrospectiveTeamMember(userId, actionItem.retrospective.teamId);

    if (!userId) {
      throw localizedError(
        'errors:unauthorized',
        {},
        403,
        GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY
      );
    }

    if (actionItem.productBacklogItemId) {
      throw localizedError(
        'errors:retrospective.actionItemLinked',
        { title: actionItem.productBacklogItem?.title ?? '' },
        409,
        GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED
      );
    }

    // "added to the Sprint Backlog for the next Sprint": the improvement lands in the Sprint the
    // team is running now, which is the next one after the Sprint the Retrospective concluded.
    const targetSprint = await prisma.sprint.findFirst({
      where: { teamId: actionItem.retrospective.teamId, status: 'ACTIVE' },
      select: { id: true },
    });

    const pbi = await productBacklogService.createPBI(userId, {
      teamId: actionItem.retrospective.teamId,
      title: actionItem.title,
      description: actionItem.description ?? undefined,
      labels: [RETRO_ACTION_ITEM_LABEL],
      priority: 'COULD_HAVE',
    });

    try {
      const linked = await prisma.retroActionItem.update({
        where: { id: actionItemId },
        data: {
          productBacklogItemId: pbi.id,
          addedToSprintBacklog: true,
          relatedSprintId: targetSprint?.id ?? null,
          updatedBy: userId,
        },
        include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
      });

      logger.info('Retrospective action item materialised into a backlog item', {
        actionItemId,
        pbiId: pbi.id,
        retrospectiveId: actionItem.retrospective.id,
      });

      auditResourceEvent(
        AuditEventTypes.RETROSPECTIVE,
        AuditActions.CREATE,
        AuditResults.SUCCESS,
        { type: 'RETRO_ACTION_ITEM_MATERIALIZED', id: actionItemId },
        {
          teamId: actionItem.retrospective.teamId,
          pbiId: pbi.id,
          relatedSprintId: targetSprint?.id,
        }
      );

      return this.formatActionItem(linked);
    } catch (error) {
      logger.error(
        'Failed to link the materialised backlog item to the action item; removing the item',
        { error, actionItemId, pbiId: pbi.id }
      );
      await prisma.productBacklogItem.delete({ where: { id: pbi.id } }).catch((cleanupError) => {
        logger.error('Failed to remove the orphaned backlog item', {
          cleanupError,
          pbiId: pbi.id,
        });
      });
      throw error;
    }
  }

  /**
   * Record an existing Product Backlog item as the improvement an action item produced.
   *
   * Used when the improvement was already captured as a backlog item, so the same traceability the
   * materialise path provides is not lost for it. The item must belong to the same team: linking
   * across teams would make one team's Retrospective claim another team's work.
   */
  async linkActionItemToPbi(
    actionItemId: string,
    pbiId: string,
    userId: string | undefined
  ): Promise<RetroActionItem> {
    const actionItem = await prisma.retroActionItem.findUnique({
      where: { id: actionItemId },
      include: {
        retrospective: { select: { id: true, teamId: true } },
        productBacklogItem: LINKED_BACKLOG_ITEM_SELECT,
      },
    });

    if (!actionItem) {
      throw new NotFoundError('Action item');
    }

    await assertRetrospectiveTeamMember(userId, actionItem.retrospective.teamId);

    if (actionItem.productBacklogItemId) {
      throw localizedError(
        'errors:retrospective.actionItemLinked',
        { title: actionItem.productBacklogItem?.title ?? '' },
        409,
        GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED
      );
    }

    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      select: { id: true, teamId: true },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    if (pbi.teamId !== actionItem.retrospective.teamId) {
      throw new BadRequestError(
        'The backlog item must belong to the same team as the retrospective'
      );
    }

    const targetSprint = await prisma.sprint.findFirst({
      where: { teamId: actionItem.retrospective.teamId, status: 'ACTIVE' },
      select: { id: true },
    });

    const linked = await prisma.retroActionItem.update({
      where: { id: actionItemId },
      data: {
        productBacklogItemId: pbi.id,
        addedToSprintBacklog: true,
        relatedSprintId: targetSprint?.id ?? null,
        updatedBy: userId,
      },
      include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
    });

    auditResourceEvent(
      AuditEventTypes.RETROSPECTIVE,
      AuditActions.ASSIGN,
      AuditResults.SUCCESS,
      { type: 'RETRO_ACTION_ITEM_LINKED', id: actionItemId },
      { teamId: actionItem.retrospective.teamId, pbiId: pbi.id, relatedSprintId: targetSprint?.id }
    );

    return this.formatActionItem(linked);
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
    },
    membership: RetrospectiveMembership
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
        // An anonymous Retrospective never records an author, and this second removal keeps rows
        // written before the flag was honoured from being attributed retroactively.
        authorId: retro.isAnonymous ? null : item.authorId,
        authorName: retro.isAnonymous ? null : item.authorName,
        createdBy: retro.isAnonymous ? null : item.createdBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        order: item.order,
        votes: item.votesBy?.length ?? 0,
        votedBy: item.votesBy?.map((vote) => vote.userId) ?? [],
      })) ?? [];

    const actionItems = retro.actionItems?.map((action) => this.formatActionItem(action)) ?? [];

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
      // The Scrum Master's notes are coaching observations about the event, so they are serialized
      // only for the team's Scrum Master. Hiding the editor is not a gate; withholding the value is.
      smNotes: isRetrospectiveScrumMaster(membership.role)
        ? (retro.smNotes ?? undefined)
        : undefined,
      dodEvolutionNotes: retro.dodEvolutionNotes ?? undefined,
      dodReflections: (retro.dodReflections as unknown as DodReflection[] | null) ?? null,
      dodVersionAtPush: retro.dodVersionAtPush ?? null,
      createdAt: retro.createdAt,
      updatedAt: retro.updatedAt,
      items,
      actionItems,
      participants,
      attendees,
    };
  }

  /**
   * Serialize one action item, attaching the linked backlog item as the evidence of follow-through.
   */
  private formatActionItem(
    action: PrismaRetroActionItem & {
      owner?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
      productBacklogItem?: Pick<{ id: string; title: string }, 'id' | 'title'> | null;
    }
  ): RetroActionItem {
    return {
      id: action.id,
      retrospectiveId: action.retrospectiveId,
      title: action.title,
      description: action.description,
      ownerId: action.ownerId,
      dueDate: action.dueDate,
      status: action.status,
      addedToSprintBacklog: action.addedToSprintBacklog,
      relatedSprintId: action.relatedSprintId,
      productBacklogItemId: action.productBacklogItemId,
      completedAt: action.completedAt,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
      productBacklogItem: action.productBacklogItem ?? null,
      owner: action.owner
        ? {
            id: action.owner.id,
            firstName: action.owner.firstName,
            lastName: action.owner.lastName,
            email: action.owner.email,
          }
        : undefined,
    };
  }

  async updateRetrospective(
    id: string,
    data: {
      summary?: string;
      dodEvolutionNotes?: string;
      dodReflections?: DodReflection[] | null;
      status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
    },
    userId: string | undefined
  ): Promise<SprintRetrospective> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective');
    }

    const membership = await assertRetrospectiveTeamMember(userId, retrospective.teamId);

    // "The Sprint Review is the second-to-last event of the Sprint and the Sprint Retrospective
    // concludes the Sprint." Completing the Retrospective is therefore gated twice: the Sprint
    // must have reached the day its end date names (the Retrospective concludes it, it does not
    // pre-empt it), and the Sprint Review must already be completed (the ordering the Guide
    // prescribes). The end-date rule is asked of the Review service, which owns it for both
    // events, so the two cannot drift into two definitions of "the Sprint has ended".
    if (data.status === 'COMPLETED' && retrospective.status !== 'COMPLETED') {
      await sprintReviewService.assertSprintEnded(retrospective.sprintId);

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
      dodReflections?: Prisma.InputJsonValue | typeof Prisma.DbNull;
      status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
      updatedBy?: string;
    } = {};

    if (data.summary !== undefined) {
      updateData.summary = data.summary;
    }

    if (data.dodEvolutionNotes !== undefined) {
      updateData.dodEvolutionNotes = data.dodEvolutionNotes;
    }

    if (data.dodReflections !== undefined) {
      // Reflection is optional; clearing it writes SQL NULL rather than the JSON literal `null`,
      // so "not inspected" stays distinguishable from "inspected, and empty".
      updateData.dodReflections =
        data.dodReflections === null
          ? Prisma.DbNull
          : (data.dodReflections as unknown as Prisma.InputJsonValue);
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (userId !== undefined) {
      updateData.updatedBy = userId;
    }

    const updated = await prisma.sprintRetrospective.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        actionItems: {
          include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
        },
        attendees: true,
      },
    });

    return this.formatRetrospective(updated, membership);
  }

  /**
   * Apply the Definition of Done changes this Retrospective recorded.
   *
   * "The Scrum Team inspects ... their Definition of Done ... and identifies the most helpful
   * changes to improve its effectiveness." Without this the inspection would end in prose: the
   * team could write down that its Definition of Done is wrong and still work to it next Sprint.
   *
   * The change set is the persisted reflection, never a request body, so a client cannot apply a
   * different set from the one the team agreed. The write itself is delegated to the Definition of
   * Done service, which owns the version bump, the superseded-version snapshot, the row lock that
   * keeps two concurrent edits from losing a version between them, and the rule that a Definition
   * of Done can never be emptied.
   *
   * @throws BadRequestError (400, `GATE_RETROSPECTIVE_DOD_CHANGES_MISSING`) when nothing was
   *   inspected.
   * @throws BadRequestError (400, `GATE_DOD_REQUIRED`) when the reflection would retire every
   *   criterion.
   */
  async applyDodChanges(id: string, userId: string | undefined): Promise<SprintRetrospective> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective');
    }

    const membership = await assertRetrospectiveTeamMember(userId, retrospective.teamId);

    const reflections = (retrospective.dodReflections as unknown as DodReflection[] | null) ?? [];
    if (reflections.length === 0) {
      throw localizedError(
        'errors:retrospective.dodChangesMissing',
        {},
        400,
        GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING
      );
    }

    const currentDod = await definitionOfDoneService.getDefinitionOfDone(retrospective.teamId);
    const currentItems = currentDod?.items ?? [];
    const reflectionByDodItemId = new Map(
      reflections
        .filter((reflection) => reflection.dodItemId)
        .map((r) => [r.dodItemId as string, r])
    );

    const resultingItems: Array<{
      id?: string;
      description: string;
      category?: string;
      isActive: boolean;
      order: number;
    }> = [];

    // Criteria the team inspected: KEEP preserves, CHANGE rewrites, RETIRE drops. A criterion that
    // the reflection does not mention at all is left exactly as it was -- the event inspects what
    // the team chose to inspect, and an unmentioned criterion must not be silently retired.
    for (const item of currentItems) {
      const reflection = reflectionByDodItemId.get(item.id);

      if (!reflection) {
        resultingItems.push({
          id: item.id,
          description: item.description,
          category: item.category ?? undefined,
          isActive: item.isActive,
          order: resultingItems.length,
        });
        continue;
      }

      if (reflection.decision === 'RETIRE') {
        continue;
      }

      resultingItems.push({
        id: item.id,
        description:
          reflection.decision === 'CHANGE'
            ? (reflection.proposedDescription ?? reflection.description).trim()
            : item.description,
        category: item.category ?? undefined,
        isActive: true,
        order: resultingItems.length,
      });
    }

    // Proposed criteria have no Definition of Done item yet; they are appended in the order the
    // team recorded them, after everything that already existed.
    for (const reflection of reflections) {
      if (reflection.dodItemId) {
        continue;
      }

      const description =
        reflection.decision === 'CHANGE'
          ? (reflection.proposedDescription ?? reflection.description)
          : reflection.description;

      resultingItems.push({
        description: description.trim(),
        isActive: true,
        order: resultingItems.length,
      });
    }

    const updatedDod = await definitionOfDoneService.updateDefinitionOfDone(
      retrospective.teamId,
      resultingItems,
      userId
    );

    const updated = await prisma.sprintRetrospective.update({
      where: { id },
      data: { dodVersionAtPush: updatedDod.version, updatedBy: userId },
      include: {
        items: true,
        actionItems: {
          include: { productBacklogItem: LINKED_BACKLOG_ITEM_SELECT },
        },
        attendees: true,
      },
    });

    auditResourceEvent(
      AuditEventTypes.RETROSPECTIVE,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'RETROSPECTIVE_DEFINITION_OF_DONE', id },
      {
        teamId: retrospective.teamId,
        version: updatedDod.version,
        inspectedCount: reflections.length,
        retiredCount: reflections.filter((r) => r.decision === 'RETIRE').length,
        changedCount: reflections.filter((r) => r.decision === 'CHANGE').length,
        addedCount: reflections.filter((r) => !r.dodItemId).length,
      }
    );

    return this.formatRetrospective(updated, membership);
  }

  async getPendingActionItemsByTeam(
    teamId: string,
    userId: string | undefined
  ): Promise<RetroActionItem[]> {
    await assertRetrospectiveTeamMember(userId, teamId);

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
            productBacklogItem: LINKED_BACKLOG_ITEM_SELECT,
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
          ...this.formatActionItem(actionItem),
          retrospectiveId: retro.id,
          sprint: retro.sprint,
        });
      }
    }

    return pendingActionItems;
  }

  async addAttendee(
    retrospectiveId: string,
    data: { name: string; email?: string; role: string; attended: boolean },
    userId: string | undefined
  ): Promise<RetroAttendee> {
    const retrospective = await prisma.sprintRetrospective.findUnique({
      where: { id: retrospectiveId },
      select: { teamId: true },
    });

    if (!retrospective) {
      throw new NotFoundError('Retrospective');
    }

    await assertRetrospectiveTeamMember(userId, retrospective.teamId);

    const attendee = await prisma.retroAttendee.create({
      data: {
        id: uuidv4(),
        retrospectiveId,
        name: data.name,
        email: data.email,
        role: data.role,
        attended: data.attended,
        createdBy: userId,
        updatedBy: userId,
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
    },
    userId: string | undefined
  ): Promise<RetroAttendee> {
    const attendee = await prisma.retroAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      throw new NotFoundError('Attendee');
    }

    // An attendee id names no team, so the Retrospective it belongs to is the only way to reach the
    // team whose membership is required. Without this, any authenticated user could rewrite the
    // attendance record of a Retrospective they cannot even see.
    await assertRetrospectiveAccess(userId, attendee.retrospectiveId);

    const updateData: {
      name?: string;
      email?: string | null;
      role?: string;
      attended?: boolean;
      updatedBy?: string;
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
    if (userId !== undefined) {
      updateData.updatedBy = userId;
    }

    const updated = await prisma.retroAttendee.update({
      where: { id: attendeeId },
      data: updateData,
    });

    return updated;
  }

  async deleteAttendee(attendeeId: string, userId: string | undefined): Promise<void> {
    const attendee = await prisma.retroAttendee.findUnique({
      where: { id: attendeeId },
    });

    if (!attendee) {
      throw new NotFoundError('Attendee');
    }

    await assertRetrospectiveAccess(userId, attendee.retrospectiveId);

    await prisma.retroAttendee.delete({
      where: { id: attendeeId },
    });
  }
}

export const retrospectiveService = new RetrospectiveService();
