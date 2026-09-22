import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ForbiddenError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { logger } from '../utils/logger';
import { GATE_CODES, type GateCode, type SprintGoalOutcome } from '@scrumooth/shared';
import { NotificationService } from './notification.service';
import { productBacklogService } from './backlog.service';
import { reportsService } from './reports.service';
import { NotificationType, type FeedbackCategory } from '../generated/prisma/client';
import { t as requestT } from '../i18n/requestT.js';
import {
  auditResourceEvent,
  AuditActions,
  AuditEventTypes,
  AuditResults,
} from '../utils/auditLogger';

interface ReviewAttendeeInput {
  id?: string;
  /** Optional link to a registered user. When set, name/email are derived from the account. */
  userId?: string | null;
  name: string;
  email?: string;
  role: string;
  attended: boolean;
}

interface ReviewFeedbackInput {
  id?: string;
  authorName: string;
  content: string;
  productGoalAssessment?: string;
  category: string;
  relatedPbiId?: string | null;
  actionRequired?: boolean;
  actionTaken?: boolean;
  ownerId?: string | null;
}

interface ReviewAdjustmentInput {
  id?: string;
  action: string;
  description: string;
  reason: string;
  pbiId?: string | null;
  implemented?: boolean;
  ownerId?: string | null;
}

interface CreateReviewData {
  sprintId: string;
  teamId: string;
  incrementId?: string;
  reviewDate: Date;
  summary?: string;
  /** The Scrum Team's own verdict on the Sprint Goal, when the Sprint has one. */
  sprintGoalOutcome?: SprintGoalOutcome;
  /** The team's own words for that verdict. */
  sprintGoalNote?: string;
}

interface UpdateReviewData {
  summary?: string;
  reviewDate?: Date;
  status?: string;
  sprintGoalOutcome?: SprintGoalOutcome;
  sprintGoalNote?: string;
  attendees?: ReviewAttendeeInput[];
  feedback?: ReviewFeedbackInput[];
  backlogAdjustments?: ReviewAdjustmentInput[];
}

interface AddFeedbackData {
  authorName: string;
  content: string;
  productGoalAssessment?: string;
  category: string;
  relatedPbiId?: string | null;
  actionRequired?: boolean;
  ownerId?: string | null;
}

interface AddAttendeeData {
  userId?: string | null;
  name: string;
  email?: string;
  role: string;
  attended: boolean;
}

interface UpdateAttendeeData {
  userId?: string | null;
  name?: string;
  email?: string;
  role?: string;
  attended?: boolean;
}

/** Optional overrides applied when an adjustment is materialised into a new backlog item. */
interface MaterializeAdjustmentOverrides {
  title?: string;
  description?: string;
  storyPoints?: number;
  acceptanceCriteria?: string;
}

/**
 * The default label a materialised adjustment carries. The prefix is a stable contract: the
 * Backlog page can filter on it to show which items came out of a Sprint Review.
 */
export const REVIEW_ADJUSTMENT_LABEL = 'review-adjustment';

const categoryMap: Record<string, FeedbackCategory> = {
  positive: 'POSITIVE',
  negative: 'NEGATIVE',
  suggestion: 'SUGGESTION',
  question: 'QUESTION',
};

export const sprintReviewService = {
  /**
   * Assert that the acting user belongs to the Scrum Team that owns a Review.
   *
   * The Review is the Scrum Team's own event (Scrum Guide: "the Scrum Team presents the results
   * of their work to key stakeholders"). Recording attendance, leaving feedback, adjusting the
   * Product Backlog, and completing the Review are all acts of that team, so they require
   * membership — no outsider may speak for a team at its Review. The refusal carries
   * `GATE_SPRINT_REVIEW_TEAM_MEMBERS_ONLY` so it is accounted as a Guide gate, not a generic 403.
   */
  async assertTeamMember(
    teamId: string,
    userId: string | undefined,
    options?: { messageKey?: string; gateCode?: GateCode }
  ): Promise<void> {
    if (!userId) {
      throw new ForbiddenError(requestT('errors:unauthorized'));
    }

    const member = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { id: true },
    });

    if (!member) {
      throw localizedError(
        options?.messageKey ?? 'errors:sprintReview.teamMembersOnly',
        {},
        403,
        options?.gateCode ?? GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY
      );
    }
  },

  /**
   * Assert that a Sprint has reached its end date.
   *
   * The Review inspects the outcome of the Sprint and the Retrospective concludes it, so neither
   * can be completed while the Sprint is still running. Without this, a team could close a Sprint
   * that never ran its course by recording both events early.
   */
  async assertSprintEnded(sprintId: string): Promise<void> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
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
  },

  /**
   * The Sprint Goal in force for a Sprint, or null when the Sprint never had one.
   *
   * Read only when a Review has to judge a Goal it did not snapshot, which is the case for a Review
   * created before the verdict existed. A Sprint still running has a locked Sprint Goal, so this is
   * the same text the Review would have recorded at creation.
   */
  async sprintGoalOf(sprintId: string): Promise<string | null> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { sprintGoal: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    return sprint.sprintGoal;
  },

  /**
   * Refuse a verdict that judges nothing.
   *
   * A Sprint Goal verdict is a judgement about an objective the team committed to, so one recorded
   * against a Sprint that has no Goal would let an unassessed Sprint be presented as assessed.
   */
  assertGoalOutcomeApplicable(
    sprintGoal: string | null | undefined,
    outcome: SprintGoalOutcome | undefined
  ): void {
    if (outcome !== undefined && !sprintGoal?.trim()) {
      throw localizedError(
        'errors:sprintReview.goalOutcomeNotApplicable',
        {},
        400,
        GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_NOT_APPLICABLE
      );
    }
  },

  /**
   * Record that a Sprint Goal verdict was written.
   *
   * Identifiers, the verdict and the note's length -- never the note body. The trail only has to
   * say that the team's own words were recorded, and where; quoting them would duplicate the
   * team's reflection into a second store.
   */
  auditGoalOutcome(input: {
    reviewId: string;
    teamId: string;
    sprintId: string;
    outcome: SprintGoalOutcome;
    noteLength: number;
  }): void {
    auditResourceEvent(
      AuditEventTypes.SPRINT,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'SPRINT_REVIEW_GOAL_OUTCOME', id: input.reviewId },
      {
        teamId: input.teamId,
        sprintId: input.sprintId,
        outcome: input.outcome,
        noteLength: input.noteLength,
      }
    );
  },

  /**
   * Resolve the optional `userId` link on an attendee.
   *
   * When the user exists, the attendee's display name, email, and role are derived from the
   * account so attendance is attributable and the stored copy cannot drift from the account.
   * A supplied `userId` that names no account is refused: silently keeping a broken link would
   * be worse than the free-text fallback an external stakeholder already has.
   */
  async resolveAttendeeUser(
    reviewTeamId: string,
    data: { userId?: string | null; name?: string; email?: string; role?: string }
  ): Promise<{ userId: string | null; name?: string; email?: string; role?: string }> {
    if (!data.userId) {
      return {
        userId: null,
        name: data.name,
        email: data.email,
        role: data.role,
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // The role recorded for a linked user is their role on the team that owns the Review; a
    // user who is not a team member (an external stakeholder with an account) is recorded as
    // such, which is the honest answer.
    const membership = await prisma.teamMember.findFirst({
      where: { teamId: reviewTeamId, userId: user.id },
      select: { role: true },
    });

    return {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: membership ? membership.role.toLowerCase() : (data.role ?? 'stakeholder'),
    };
  },

  async getSprintReviews(teamId: string, sprintId?: string) {
    const where: { teamId: string; sprintId?: string } = { teamId };
    if (sprintId) {
      where.sprintId = sprintId;
    }

    const reviews = await prisma.sprintReview.findMany({
      where,
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
            goal: true,
          },
        },
        attendees: true,
        feedback: {
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
        backlogAdjustments: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            createdPbi: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                storyPoints: true,
              },
            },
          },
        },
      },
      orderBy: {
        reviewDate: 'desc',
      },
    });

    return reviews.map((review) => ({
      ...review,
      attendees: review.attendees.map((a) => ({
        id: a.id,
        userId: a.userId,
        name: a.name,
        email: a.email,
        role: a.role,
        attended: a.attended,
      })),
      feedback: review.feedback.map((f) => ({
        ...f,
        category: f.category.toLowerCase(),
      })),
    }));
  },

  async getSprintReviewById(id: string) {
    const review = await prisma.sprintReview.findUnique({
      where: { id },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
            goal: true,
          },
        },
        attendees: true,
        feedback: {
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
        backlogAdjustments: {
          include: {
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            createdPbi: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                storyPoints: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Sprint Review');
    }

    const increment = review.incrementId
      ? await prisma.increment.findUnique({
          where: { id: review.incrementId },
          include: {
            pbis: {
              include: {
                pbi: {
                  select: {
                    id: true,
                    title: true,
                    storyPoints: true,
                    status: true,
                  },
                },
              },
            },
          },
        })
      : null;

    return {
      ...review,
      attendees: review.attendees.map((a) => ({
        id: a.id,
        userId: a.userId,
        name: a.name,
        email: a.email,
        role: a.role,
        attended: a.attended,
      })),
      feedback: review.feedback.map((f) => ({
        ...f,
        category: f.category.toLowerCase(),
      })),
      increment: increment
        ? {
            ...increment,
            pbis: increment.pbis.map((p) => p.pbi),
          }
        : null,
    };
  },

  async createSprintReview(userId: string, data: CreateReviewData) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: data.sprintId },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    // A Review belongs to the team that owns the Sprint it inspects. Refuse a payload that
    // pairs a Sprint with another team before any membership check, so a member of team A cannot
    // open a Review against team B's Sprint.
    if (sprint.teamId !== data.teamId) {
      throw new BadRequestError('Sprint does not belong to the specified team');
    }

    await this.assertTeamMember(data.teamId, userId);

    // A verdict must judge a Goal that exists: a Sprint with no Sprint Goal has nothing to assess.
    this.assertGoalOutcomeApplicable(sprint.sprintGoal, data.sprintGoalOutcome);

    const existingReview = await prisma.sprintReview.findUnique({
      where: { sprintId: data.sprintId },
    });

    if (existingReview) {
      throw new BadRequestError('A sprint review already exists for this sprint');
    }

    let incrementId = data.incrementId;
    if (!incrementId) {
      const increment = await prisma.increment.findFirst({
        where: {
          sprintId: data.sprintId,
          status: { in: ['DELIVERED', 'VERIFIED'] },
        },
      });
      if (increment) {
        incrementId = increment.id;
      }
    }

    if (!incrementId) {
      throw new BadRequestError('No delivered increment found for this sprint');
    }

    const reviewId = generateUUIDv7();

    const review = await prisma.sprintReview.create({
      data: {
        id: reviewId,
        sprintId: data.sprintId,
        teamId: data.teamId,
        incrementId,
        reviewDate: data.reviewDate,
        summary: data.summary,
        // The Goal this Review judged, frozen beside the verdict: a later renegotiation must not
        // make the record appear to have assessed a goal it never saw.
        sprintGoal: sprint.sprintGoal,
        sprintGoalOutcome: data.sprintGoalOutcome,
        sprintGoalNote: data.sprintGoalNote,
        createdBy: userId,
      },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        attendees: true,
        feedback: true,
        backlogAdjustments: true,
      },
    });

    if (data.sprintGoalOutcome !== undefined) {
      reportsService.invalidateCache(data.teamId);
      this.auditGoalOutcome({
        reviewId,
        teamId: data.teamId,
        sprintId: data.sprintId,
        outcome: data.sprintGoalOutcome,
        noteLength: data.sprintGoalNote?.length ?? 0,
      });
    }

    return {
      ...review,
      attendees: [],
      feedback: [],
      backlogAdjustments: [],
    };
  },

  /**
   * Refuse a child payload that names a row belonging to a different Review.
   *
   * Sync-by-id means a caller could otherwise pass the id of another team's attendee, feedback,
   * or adjustment and have it silently rewritten under this Review.
   */
  assertKnownChildIds(
    label: string,
    existingIds: string[],
    incoming: Array<{ id?: string }>
  ): void {
    const known = new Set(existingIds);
    for (const row of incoming) {
      if (row.id && !known.has(row.id)) {
        throw new BadRequestError(`${label} does not belong to this sprint review`);
      }
    }
  },

  /**
   * Resolve the incoming attendee rows into the shape written to the database.
   *
   * Runs before the update transaction so the user/membership lookups do not hold a transaction
   * open. A linked user's display fields are derived from the account; an omitted `userId`
   * leaves an existing link untouched (the frontend resends the whole list on every save, so
   * `undefined` must not be read as "unlink"); an explicit `null` clears the link.
   */
  async normalizeAttendees(
    teamId: string,
    existing: Array<{
      id: string;
      userId: string | null;
      name: string;
      email: string | null;
      role: string;
      attended: boolean;
    }>,
    inputs: ReviewAttendeeInput[]
  ) {
    const byId = new Map(existing.map((row) => [row.id, row]));
    const normalized: Array<{
      id?: string;
      userId: string | null;
      name: string;
      email: string | null | undefined;
      role: string;
      attended: boolean;
    }> = [];

    for (const input of inputs) {
      const current = input.id ? byId.get(input.id) : undefined;

      if (typeof input.userId === 'string' && input.userId.length > 0) {
        const linked = await this.resolveAttendeeUser(teamId, input);
        normalized.push({
          id: input.id,
          userId: linked.userId,
          name: linked.name ?? input.name,
          email: linked.email ?? input.email,
          role: linked.role ?? input.role,
          attended: input.attended,
        });
      } else {
        // `name` and `role` are required by the update schema, so the validated payload always
        // carries them. Email is optional and falls back to the stored value when omitted.
        normalized.push({
          id: input.id,
          userId: input.userId !== undefined ? input.userId : (current?.userId ?? null),
          name: input.name,
          email: input.email ?? current?.email,
          role: input.role,
          attended: input.attended,
        });
      }
    }

    return normalized;
  },

  async updateSprintReview(id: string, userId: string | undefined, data: UpdateReviewData) {
    logger.debug('Updating sprint review', { id, userId });

    const existing = await prisma.sprintReview.findUnique({
      where: { id },
      include: {
        attendees: true,
        feedback: true,
        backlogAdjustments: true,
      },
    });

    if (!existing) {
      logger.warn('Sprint Review not found', { id });
      throw new NotFoundError('Sprint Review');
    }

    await this.assertTeamMember(existing.teamId, userId);

    // Completing the Review records that the Sprint has been inspected. The Sprint must have
    // reached its end date first: the Guide places the Review at the end of the Sprint, so
    // completing it early would close a Sprint that never ran its course.
    const isCompleting = data.status === 'completed' && existing.status !== 'completed';

    // The Goal this Review judges: the one it already snapshotted, or the Sprint's own Goal for a
    // Review created before the verdict was recorded. Resolved only when a verdict or a conclusion
    // is actually being recorded, so an ordinary save does not pay for a lookup it has no use for.
    const goal =
      data.sprintGoalOutcome !== undefined || isCompleting
        ? (existing.sprintGoal ?? (await this.sprintGoalOf(existing.sprintId)))
        : null;

    if (data.sprintGoalOutcome !== undefined) {
      this.assertGoalOutcomeApplicable(goal, data.sprintGoalOutcome);
    }

    if (isCompleting) {
      await this.assertSprintEnded(existing.sprintId);

      // "The Scrum Team discusses ... progress toward the Sprint Goal." Concluding the event
      // without the team's own verdict would leave the tool to infer attainment from item
      // completion, so the verdict is what concluding a Review requires. Only at conclusion: a
      // Review is assembled over its session, and the judgement is what the session produces. A
      // Sprint with no Sprint Goal is never asked for one.
      const outcome = data.sprintGoalOutcome ?? existing.sprintGoalOutcome;
      if (goal?.trim() && outcome == null) {
        throw localizedError(
          'errors:sprintReview.goalOutcomeRequired',
          {},
          400,
          GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED
        );
      }
    }

    // Child rows are synced by id, not deleted and recreated: the frontend resends the whole
    // list on every save, and a delete/recreate cycle would silently erase each attendee's
    // `userId` link and each adjustment's `createdPbiId` traceability.
    if (data.attendees !== undefined) {
      this.assertKnownChildIds(
        'Attendee',
        existing.attendees.map((row) => row.id),
        data.attendees
      );
    }
    if (data.feedback !== undefined) {
      this.assertKnownChildIds(
        'Feedback',
        existing.feedback.map((row) => row.id),
        data.feedback
      );
    }
    if (data.backlogAdjustments !== undefined) {
      this.assertKnownChildIds(
        'Backlog adjustment',
        existing.backlogAdjustments.map((row) => row.id),
        data.backlogAdjustments
      );
    }

    const normalizedAttendees =
      data.attendees !== undefined
        ? await this.normalizeAttendees(existing.teamId, existing.attendees, data.attendees)
        : undefined;

    // Notifications are dispatched after the transaction commits, so no external work runs
    // while the transaction is open.
    const pendingAdjustmentNotifications: Array<{
      adjustmentId: string;
      ownerId: string;
      action: string;
      description: string;
    }> = [];

    await prisma.$transaction(async (tx) => {
      const updateData: {
        summary?: string;
        reviewDate?: Date;
        status?: string;
        sprintGoal?: string | null;
        sprintGoalOutcome?: SprintGoalOutcome;
        sprintGoalNote?: string;
        updatedBy?: string;
      } = {};

      if (data.summary !== undefined) updateData.summary = data.summary;
      if (data.reviewDate !== undefined) updateData.reviewDate = data.reviewDate;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.sprintGoalOutcome !== undefined) {
        updateData.sprintGoalOutcome = data.sprintGoalOutcome;
        // Snapshot the Goal the verdict judges, for a Review created before that was recorded.
        updateData.sprintGoal = goal;
      }
      if (data.sprintGoalNote !== undefined) updateData.sprintGoalNote = data.sprintGoalNote;
      if (userId) updateData.updatedBy = userId;

      if (Object.keys(updateData).length > 0) {
        await tx.sprintReview.update({ where: { id }, data: updateData });
      }

      if (normalizedAttendees !== undefined) {
        const incomingIds = new Set(
          normalizedAttendees
            .map((row) => row.id)
            .filter((value): value is string => Boolean(value))
        );
        const removedIds = existing.attendees
          .map((row) => row.id)
          .filter((childId) => !incomingIds.has(childId));

        if (removedIds.length > 0) {
          await tx.reviewAttendee.deleteMany({ where: { id: { in: removedIds } } });
        }

        for (const attendee of normalizedAttendees) {
          if (attendee.id) {
            await tx.reviewAttendee.update({
              where: { id: attendee.id },
              data: {
                userId: attendee.userId,
                name: attendee.name,
                email: attendee.email,
                role: attendee.role,
                attended: attendee.attended,
                updatedBy: userId,
              },
            });
          } else {
            await tx.reviewAttendee.create({
              data: {
                id: generateUUIDv7(),
                reviewId: id,
                userId: attendee.userId,
                name: attendee.name,
                email: attendee.email,
                role: attendee.role,
                attended: attendee.attended,
                createdBy: userId,
              },
            });
          }
        }
      }

      if (data.feedback !== undefined) {
        const incomingIds = new Set(
          data.feedback.map((row) => row.id).filter((value): value is string => Boolean(value))
        );
        const removedIds = existing.feedback
          .map((row) => row.id)
          .filter((childId) => !incomingIds.has(childId));

        if (removedIds.length > 0) {
          await tx.stakeholderFeedback.deleteMany({ where: { id: { in: removedIds } } });
        }

        for (const feedback of data.feedback) {
          const payload = {
            authorName: feedback.authorName,
            content: feedback.content,
            productGoalAssessment: feedback.productGoalAssessment,
            category: categoryMap[feedback.category] ?? 'POSITIVE',
            relatedPbiId: feedback.relatedPbiId ?? null,
            actionRequired: feedback.actionRequired ?? false,
            actionTaken: feedback.actionTaken ?? false,
            ownerId: feedback.ownerId ?? null,
          };

          if (feedback.id) {
            await tx.stakeholderFeedback.update({
              where: { id: feedback.id },
              data: { ...payload, updatedBy: userId },
            });
          } else {
            await tx.stakeholderFeedback.create({
              data: {
                id: generateUUIDv7(),
                reviewId: id,
                ...payload,
                createdBy: userId,
              },
            });
          }
        }
      }

      if (data.backlogAdjustments !== undefined) {
        const incomingIds = new Set(
          data.backlogAdjustments
            .map((row) => row.id)
            .filter((value): value is string => Boolean(value))
        );
        const removedIds = existing.backlogAdjustments
          .map((row) => row.id)
          .filter((childId) => !incomingIds.has(childId));

        if (removedIds.length > 0) {
          await tx.backlogAdjustment.deleteMany({ where: { id: { in: removedIds } } });
        }

        for (const adjustment of data.backlogAdjustments) {
          const current = adjustment.id
            ? existing.backlogAdjustments.find((row) => row.id === adjustment.id)
            : undefined;

          // An adjustment that produced a backlog item is implemented by definition: the link
          // is the evidence, so a payload cannot un-set it or clear the link.
          const implemented = current?.createdPbiId
            ? true
            : (adjustment.implemented ?? current?.implemented ?? false);

          const payload = {
            action: adjustment.action,
            description: adjustment.description,
            reason: adjustment.reason,
            pbiId: adjustment.pbiId !== undefined ? adjustment.pbiId : (current?.pbiId ?? null),
            implemented,
            ownerId:
              adjustment.ownerId !== undefined ? adjustment.ownerId : (current?.ownerId ?? null),
          };

          if (adjustment.id) {
            await tx.backlogAdjustment.update({
              where: { id: adjustment.id },
              data: { ...payload, updatedBy: userId },
            });
          } else {
            const created = await tx.backlogAdjustment.create({
              data: {
                id: generateUUIDv7(),
                reviewId: id,
                ...payload,
                createdBy: userId,
              },
            });

            if (payload.ownerId && !implemented) {
              pendingAdjustmentNotifications.push({
                adjustmentId: created.id,
                ownerId: payload.ownerId,
                action: payload.action,
                description: payload.description,
              });
            }
          }
        }
      }
    });

    if (pendingAdjustmentNotifications.length > 0) {
      const notificationService = new NotificationService();
      for (const notification of pendingAdjustmentNotifications) {
        try {
          await notificationService.createLocalized({
            userId: notification.ownerId,
            type: NotificationType.TASK_ASSIGNMENT,
            titleKey: 'backlogAdjustmentRequired',
            messageKey: 'backlogAdjustmentRequiredMessage',
            messageParams: {
              action: notification.action.toUpperCase(),
              description:
                notification.description.length > 100
                  ? `${notification.description.substring(0, 100)}...`
                  : notification.description,
            },
            data: {
              adjustmentId: notification.adjustmentId,
              reviewId: id,
              action: notification.action,
            },
            createdBy: userId,
          });
          logger.debug('Notification sent to adjustment owner', {
            ownerId: notification.ownerId,
            adjustmentId: notification.adjustmentId,
          });
        } catch (error) {
          logger.error('Failed to send notification to adjustment owner', {
            error,
            ownerId: notification.ownerId,
          });
        }
      }
    }

    // The reports read Sprint Goal attainment out of the recorded verdicts, so a review that
    // recorded or changed one makes the cached coverage stale.
    if (data.sprintGoalOutcome !== undefined || isCompleting) {
      reportsService.invalidateCache(existing.teamId);

      if (data.sprintGoalOutcome !== undefined) {
        this.auditGoalOutcome({
          reviewId: id,
          teamId: existing.teamId,
          sprintId: existing.sprintId,
          outcome: data.sprintGoalOutcome,
          noteLength: data.sprintGoalNote?.length ?? 0,
        });
      }
    }

    const result = await this.getSprintReviewById(id);
    logger.debug('Sprint review updated successfully', { id });
    return result;
  },

  async addStakeholderFeedback(id: string, userId: string | undefined, data: AddFeedbackData) {
    const existing = await prisma.sprintReview.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Sprint Review');
    }

    await this.assertTeamMember(existing.teamId, userId);

    const feedback = await prisma.stakeholderFeedback.create({
      data: {
        id: generateUUIDv7(),
        reviewId: id,
        authorName: data.authorName,
        content: data.content,
        productGoalAssessment: data.productGoalAssessment,
        category: categoryMap[data.category] ?? 'POSITIVE',
        relatedPbiId: data.relatedPbiId,
        actionRequired: data.actionRequired ?? false,
        actionTaken: false,
        ownerId: data.ownerId,
        createdBy: userId,
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
    });

    // Send notification to owner if assigned
    if (data.ownerId && data.actionRequired) {
      try {
        const notificationService = new NotificationService();
        await notificationService.createLocalized({
          userId: data.ownerId,
          type: NotificationType.TASK_ASSIGNMENT,
          titleKey: 'feedbackRequired',
          messageKey: 'feedbackRequiredMessage',
          messageParams: {
            authorName: data.authorName,
            content:
              data.content.length > 100 ? `${data.content.substring(0, 100)}...` : data.content,
          },
          data: {
            feedbackId: feedback.id,
            reviewId: id,
            category: data.category,
          },
          createdBy: userId,
        });
        logger.debug('Notification sent to feedback owner', {
          ownerId: data.ownerId,
          feedbackId: feedback.id,
        });
      } catch (error) {
        logger.error('Failed to send notification to feedback owner', {
          error,
          ownerId: data.ownerId,
        });
      }
    }

    return {
      ...feedback,
      category: feedback.category.toLowerCase(),
    };
  },

  async deleteSprintReview(id: string, userId: string | undefined) {
    const existing = await prisma.sprintReview.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Sprint Review');
    }

    await this.assertTeamMember(existing.teamId, userId);

    await prisma.sprintReview.delete({
      where: { id },
    });
  },

  async getPendingAdjustments(teamId: string) {
    const reviews = await prisma.sprintReview.findMany({
      where: {
        teamId,
        status: 'completed',
      },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        backlogAdjustments: {
          where: {
            implemented: false,
          },
        },
      },
      orderBy: {
        reviewDate: 'desc',
      },
    });

    const pendingAdjustments = reviews.flatMap((review) =>
      review.backlogAdjustments.map((adjustment) => ({
        ...adjustment,
        reviewId: review.id,
        reviewDate: review.reviewDate,
        sprint: review.sprint,
      }))
    );

    return pendingAdjustments;
  },

  /**
   * Mark an adjustment implemented without producing a backlog item.
   *
   * This remains for adjustments whose outcome is not an item (a reorder, or a removal already
   * performed on the backlog). An adjustment that already produced an item is returned as-is:
   * its `createdPbiId` is the evidence, and a manual flag must not contradict it.
   */
  async markAdjustmentImplemented(adjustmentId: string, userId: string | undefined) {
    const adjustment = await prisma.backlogAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        review: { select: { teamId: true } },
      },
    });

    if (!adjustment) {
      throw new NotFoundError('Backlog Adjustment');
    }

    await this.assertTeamMember(adjustment.review.teamId, userId);

    if (adjustment.createdPbiId) {
      logger.debug('Adjustment already implemented through a linked backlog item', {
        adjustmentId,
        createdPbiId: adjustment.createdPbiId,
      });
      return adjustment;
    }

    const updated = await prisma.backlogAdjustment.update({
      where: { id: adjustmentId },
      data: {
        implemented: true,
        updatedAt: new Date(),
        updatedBy: userId,
      },
    });

    return updated;
  },

  /**
   * Materialise a Review's backlog adjustment into a new Product Backlog item.
   *
   * This is what makes "the Product Backlog may also be adjusted" provable: the created item is
   * recorded on the adjustment as `createdPbiId`, and `implemented` is derived from that link
   * rather than set by hand. Item creation goes through the Product Backlog service so the
   * Product Goal anchor, backlog rank, and workflow history are the same as any other item.
   *
   * The two writes cannot share one transaction without bypassing those invariants, so the link
   * is written immediately after the item and, if it fails, the just-created item is removed to
   * avoid leaving an orphan behind.
   */
  async materializeAdjustment(
    adjustmentId: string,
    userId: string | undefined,
    overrides: MaterializeAdjustmentOverrides = {}
  ) {
    const adjustment = await prisma.backlogAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        review: { select: { id: true, teamId: true } },
      },
    });

    if (!adjustment) {
      throw new NotFoundError('Backlog Adjustment');
    }

    await this.assertTeamMember(adjustment.review.teamId, userId);

    if (!userId) {
      throw new ForbiddenError(requestT('errors:unauthorized'));
    }

    if (adjustment.createdPbiId) {
      throw new BadRequestError('This adjustment has already produced a backlog item');
    }

    const title = (overrides.title ?? adjustment.description).trim();
    if (!title) {
      throw new BadRequestError('A backlog item needs a title');
    }

    const pbi = await productBacklogService.createPBI(userId, {
      teamId: adjustment.review.teamId,
      title,
      description: overrides.description ?? `Reason: ${adjustment.reason}`,
      storyPoints: overrides.storyPoints,
      acceptanceCriteria: overrides.acceptanceCriteria,
      labels: [REVIEW_ADJUSTMENT_LABEL],
    });

    try {
      const updated = await prisma.backlogAdjustment.update({
        where: { id: adjustmentId },
        data: {
          createdPbiId: pbi.id,
          implemented: true,
          updatedBy: userId,
        },
        include: {
          createdPbi: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              storyPoints: true,
            },
          },
        },
      });

      logger.info('Backlog adjustment materialised into a backlog item', {
        adjustmentId,
        pbiId: pbi.id,
        reviewId: adjustment.review.id,
      });

      return { adjustment: updated, pbi };
    } catch (error) {
      logger.error('Failed to link materialised backlog item to adjustment; removing the item', {
        error,
        adjustmentId,
        pbiId: pbi.id,
      });
      await prisma.productBacklogItem.delete({ where: { id: pbi.id } }).catch((cleanupError) => {
        logger.error('Failed to remove the orphaned backlog item', {
          cleanupError,
          pbiId: pbi.id,
        });
      });
      throw error;
    }
  },

  /**
   * Record an existing Product Backlog item as the outcome of a Review adjustment.
   *
   * Used when the adjustment was carried out against an item that already exists (a modify or
   * reorder), so the same traceability the materialise path provides is not lost for those
   * actions. The item must belong to the Review's team.
   */
  async linkAdjustmentToPbi(adjustmentId: string, pbiId: string, userId: string | undefined) {
    const adjustment = await prisma.backlogAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        review: { select: { id: true, teamId: true } },
      },
    });

    if (!adjustment) {
      throw new NotFoundError('Backlog Adjustment');
    }

    await this.assertTeamMember(adjustment.review.teamId, userId);

    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      select: { id: true, teamId: true },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    if (pbi.teamId !== adjustment.review.teamId) {
      throw new BadRequestError('The backlog item must belong to the same team as the review');
    }

    const updated = await prisma.backlogAdjustment.update({
      where: { id: adjustmentId },
      data: {
        createdPbiId: pbi.id,
        implemented: true,
        updatedBy: userId,
      },
      include: {
        createdPbi: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            storyPoints: true,
          },
        },
      },
    });

    logger.info('Backlog adjustment linked to an existing backlog item', {
      adjustmentId,
      pbiId,
      reviewId: adjustment.review.id,
    });

    return updated;
  },

  async getPendingFeedback(teamId: string) {
    const reviews = await prisma.sprintReview.findMany({
      where: {
        teamId,
        status: 'completed',
      },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        feedback: {
          where: {
            actionRequired: true,
            actionTaken: false,
          },
        },
      },
      orderBy: {
        reviewDate: 'desc',
      },
    });

    const pendingFeedback = reviews.flatMap((review) =>
      review.feedback.map((feedback) => ({
        ...feedback,
        reviewId: review.id,
        reviewDate: review.reviewDate,
        sprint: review.sprint,
        category: feedback.category.toLowerCase(),
      }))
    );

    return pendingFeedback;
  },

  async markFeedbackAddressed(feedbackId: string, userId: string | undefined) {
    const feedback = await prisma.stakeholderFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        review: { select: { teamId: true } },
      },
    });

    if (!feedback) {
      throw new NotFoundError('Stakeholder Feedback');
    }

    await this.assertTeamMember(feedback.review.teamId, userId);

    const updated = await prisma.stakeholderFeedback.update({
      where: { id: feedbackId },
      data: {
        actionTaken: true,
        updatedAt: new Date(),
        updatedBy: userId,
      },
    });

    return {
      ...updated,
      category: updated.category.toLowerCase(),
    };
  },

  async addAttendee(reviewId: string, userId: string | undefined, data: AddAttendeeData) {
    const review = await prisma.sprintReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('Sprint Review');
    }

    await this.assertTeamMember(review.teamId, userId);

    const resolved = await this.resolveAttendeeUser(review.teamId, data);

    const attendee = await prisma.reviewAttendee.create({
      data: {
        id: generateUUIDv7(),
        reviewId,
        userId: resolved.userId,
        name: resolved.name ?? data.name,
        email: resolved.email ?? data.email,
        role: resolved.role ?? data.role,
        attended: data.attended,
        createdBy: userId,
      },
    });

    return {
      id: attendee.id,
      userId: attendee.userId,
      name: attendee.name,
      email: attendee.email,
      role: attendee.role,
      attended: attendee.attended,
    };
  },

  async updateAttendee(attendeeId: string, userId: string | undefined, data: UpdateAttendeeData) {
    const attendee = await prisma.reviewAttendee.findUnique({
      where: { id: attendeeId },
      include: {
        review: { select: { teamId: true } },
      },
    });

    if (!attendee) {
      throw new NotFoundError('Review Attendee');
    }

    await this.assertTeamMember(attendee.review.teamId, userId);

    // `undefined` leaves the existing link untouched; a string links (or re-links) the attendee
    // to a user and adopts that account's display fields; `null` detaches the link.
    let resolvedUserId = attendee.userId;
    let name = data.name;
    let email = data.email;
    let role = data.role;

    if (typeof data.userId === 'string' && data.userId.length > 0) {
      const linked = await this.resolveAttendeeUser(attendee.review.teamId, {
        userId: data.userId,
        name: data.name ?? attendee.name,
        email: data.email ?? attendee.email ?? undefined,
        role: data.role ?? attendee.role,
      });
      resolvedUserId = linked.userId;
      name = linked.name ?? name;
      email = linked.email ?? email;
      role = linked.role ?? role;
    } else if (data.userId === null) {
      resolvedUserId = null;
    }

    const updated = await prisma.reviewAttendee.update({
      where: { id: attendeeId },
      data: {
        userId: resolvedUserId,
        name,
        email,
        role,
        attended: data.attended,
        updatedBy: userId,
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      attended: updated.attended,
    };
  },

  async deleteAttendee(attendeeId: string, userId: string | undefined) {
    const attendee = await prisma.reviewAttendee.findUnique({
      where: { id: attendeeId },
      include: {
        review: { select: { teamId: true } },
      },
    });

    if (!attendee) {
      throw new NotFoundError('Review Attendee');
    }

    await this.assertTeamMember(attendee.review.teamId, userId);

    await prisma.reviewAttendee.delete({
      where: { id: attendeeId },
    });

    return { success: true };
  },
};
