import prisma from '@utils/prisma';
import { generateUUIDv7 } from '@utils/uuid';
import bcrypt from 'bcrypt';

const uniqueTestId = () => `${Date.now()}-${Math.random().toString(36).substring(7)}`;
const DEFAULT_PASSWORD = 'TestPassword123!';

export const createTestUser = async (
  email?: string,
  password: string = DEFAULT_PASSWORD,
  firstName: string = 'Test',
  lastName: string = 'User'
): Promise<{
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}> => {
  const userEmail = email || `user-${uniqueTestId()}@example.com`;
  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = generateUUIDv7();

  const user = await prisma.user.create({
    data: {
      id: userId,
      email: userEmail.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
    },
  });

  return {
    id: user.id,
    email: user.email,
    password,
    firstName: user.firstName,
    lastName: user.lastName,
  };
};

export const createTestTeamInDb = async (
  name?: string,
  description: string = 'Test team for e2e testing'
): Promise<{ id: string; name: string; description: string }> => {
  const teamName = name || `Team-${uniqueTestId()}`;
  const teamId = generateUUIDv7();

  const team = await prisma.team.create({
    data: {
      id: teamId,
      name: teamName,
      description,
    },
  });

  return {
    id: team.id,
    name: team.name,
    description: team.description || '',
  };
};

export const addTeamMember = async (
  teamId: string,
  userId: string,
  role: 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPERS' = 'DEVELOPERS'
): Promise<void> => {
  const membershipId = generateUUIDv7();
  await prisma.teamMember.create({
    data: {
      id: membershipId,
      teamId,
      userId,
      role,
    },
  });
};

export const createTestSprintInDb = async (
  teamId: string,
  name?: string,
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' = 'PLANNED',
  startDate?: Date,
  endDate?: Date
): Promise<{
  id: string;
  teamId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
}> => {
  const sprintName = name || `Sprint-${uniqueTestId()}`;
  const sprintId = generateUUIDv7();
  const now = new Date();
  const sprintStartDate = startDate || new Date(now);
  const sprintEndDate = endDate || new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const sprint = await prisma.sprint.create({
    data: {
      id: sprintId,
      teamId,
      name: sprintName,
      startDate: sprintStartDate,
      endDate: sprintEndDate,
      status,
      sprintGoal: `Test sprint goal for ${sprintName}`,
    },
  });

  return {
    id: sprint.id,
    teamId: sprint.teamId,
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    status: sprint.status,
  };
};

export const createTestPBIInDb = async (
  teamId: string,
  title?: string,
  status: 'NEW' | 'REFINED' | 'READY' | 'IN_PROGRESS' | 'DONE' = 'NEW',
  priority: 'MUST_HAVE' | 'SHOULD_HAVE' | 'COULD_HAVE' | 'WONT_HAVE' = 'COULD_HAVE'
): Promise<{
  id: string;
  teamId: string;
  title: string;
  status: string;
  priority: string;
}> => {
  const pbiTitle = title || `PBI-${uniqueTestId()}`;
  const pbiId = generateUUIDv7();

  const pbi = await prisma.productBacklogItem.create({
    data: {
      id: pbiId,
      teamId,
      title: pbiTitle,
      description: `Test PBI description for ${pbiTitle}`,
      status,
      priority,
      storyPoints: 5,
      businessValue: 50,
      acceptanceCriteria: 'Test acceptance criteria',
    },
  });

  return {
    id: pbi.id,
    teamId: pbi.teamId,
    title: pbi.title,
    status: pbi.status,
    priority: pbi.priority,
  };
};

export const createTestTaskInDb = async (
  sprintId: string,
  pbiId: string,
  title?: string,
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' = 'TODO',
  assigneeId?: string
): Promise<{ id: string; title: string; status: string }> => {
  const taskTitle = title || `Task-${uniqueTestId()}`;
  const taskId = generateUUIDv7();

  const task = await prisma.task.create({
    data: {
      id: taskId,
      sprintId,
      pbiId,
      title: taskTitle,
      description: `Test task description for ${taskTitle}`,
      status,
      estimatedHours: 4,
      remainingHours: status === 'DONE' ? 0 : 4,
      assigneeId,
    },
  });

  return {
    id: task.id,
    title: task.title,
    status: task.status,
  };
};

export const createTestProductGoalInDb = async (
  teamId: string,
  title?: string,
  status: 'NEW' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED' = 'NEW'
): Promise<{ id: string; teamId: string; title: string; status: string }> => {
  const goalTitle = title || `Goal-${uniqueTestId()}`;
  const goalId = generateUUIDv7();

  const goal = await prisma.productGoal.create({
    data: {
      id: goalId,
      teamId,
      title: goalTitle,
      description: `Test product goal description for ${goalTitle}`,
      status,
      successMetrics: 'Test success metrics',
    },
  });

  return {
    id: goal.id,
    teamId: goal.teamId,
    title: goal.title,
    status: goal.status,
  };
};

export const createTestImpedimentInDb = async (
  teamId: string,
  reportedById: string,
  title?: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' = 'OPEN',
  sprintId?: string
): Promise<{ id: string; teamId: string; title: string; status: string }> => {
  const impedimentTitle = title || `Impediment-${uniqueTestId()}`;
  const impedimentId = generateUUIDv7();

  const impediment = await prisma.impediment.create({
    data: {
      id: impedimentId,
      teamId,
      sprintId,
      title: impedimentTitle,
      description: `Test impediment description for ${impedimentTitle}`,
      reportedById,
      status,
    },
  });

  return {
    id: impediment.id,
    teamId: impediment.teamId,
    title: impediment.title,
    status: impediment.status,
  };
};

export const createTestRetrospectiveInDb = async (
  sprintId: string,
  teamId: string,
  facilitatorId: string,
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' = 'DRAFT'
): Promise<{ id: string; sprintId: string; teamId: string; status: string }> => {
  const retroId = generateUUIDv7();

  const retrospective = await prisma.sprintRetrospective.create({
    data: {
      id: retroId,
      sprintId,
      teamId,
      facilitatorId,
      retroDate: new Date(),
      status,
    },
  });

  return {
    id: retrospective.id,
    sprintId: retrospective.sprintId,
    teamId: retrospective.teamId,
    status: retrospective.status,
  };
};

export const createTestDoDInDb = async (
  teamId: string
): Promise<{ id: string; teamId: string }> => {
  const dodId = generateUUIDv7();

  const dod = await prisma.definitionOfDone.create({
    data: {
      id: dodId,
      teamId,
      version: 1,
    },
  });

  const items = [
    { description: 'Code is reviewed', category: 'code_review', order: 0 },
    { description: 'Unit tests pass', category: 'testing', order: 1 },
    { description: 'Documentation updated', category: 'documentation', order: 2 },
  ];

  for (const item of items) {
    await prisma.doDItem.create({
      data: {
        id: generateUUIDv7(),
        dodId: dod.id,
        description: item.description,
        category: item.category,
        order: item.order,
        isActive: true,
      },
    });
  }

  return {
    id: dod.id,
    // A Definition of Done is created for a team here, so this is the scope it was made with. The
    // column is nullable since a group can own one instead, which this helper never does.
    teamId,
  };
};

export const createTestDoRInDb = async (
  teamId: string
): Promise<{ id: string; teamId: string }> => {
  const dorId = generateUUIDv7();

  const dor = await prisma.definitionOfReady.create({
    data: {
      id: dorId,
      teamId,
      version: 1,
    },
  });

  const items = [
    { description: 'User story defined', category: 'documentation', order: 0 },
    { description: 'Acceptance criteria defined', category: 'documentation', order: 1 },
    { description: 'Story points estimated', category: 'estimation', order: 2 },
  ];

  for (const item of items) {
    await prisma.doRItem.create({
      data: {
        id: generateUUIDv7(),
        dorId: dor.id,
        description: item.description,
        category: item.category,
        order: item.order,
        isActive: true,
      },
    });
  }

  return {
    id: dor.id,
    teamId: dor.teamId,
  };
};

export const cleanupUsers = async (emails: string[]): Promise<void> => {
  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (user) {
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        await prisma.notification.deleteMany({ where: { userId: user.id } });
        await prisma.teamMember.deleteMany({ where: { userId: user.id } });
        await prisma.retroItemVote.deleteMany({ where: { userId: user.id } });
        await prisma.statusChangeHistory.deleteMany({ where: { changedBy: user.id } });
        await prisma.impediment.deleteMany({ where: { reportedById: user.id } });
        await prisma.doDChecklistVerification.deleteMany({ where: { verifiedBy: user.id } });
        await prisma.doRChecklistVerification.deleteMany({ where: { verifiedBy: user.id } });
        await prisma.sprintRetrospective.deleteMany({ where: { facilitatorId: user.id } });
        await prisma.retroActionItem.deleteMany({ where: { ownerId: user.id } });
        await prisma.workflow.deleteMany({ where: { createdBy: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const cleanupTeams = async (teamNames: string[]): Promise<void> => {
  try {
    for (const name of teamNames) {
      const team = await prisma.team.findFirst({
        where: { name },
      });

      if (team) {
        await cleanupTeamById(team.id);
      }
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const cleanupTeamById = async (teamId: string): Promise<void> => {
  try {
    const pbis = await prisma.productBacklogItem.findMany({
      where: { teamId },
      select: { id: true },
    });
    const pbiIds = pbis.map((p) => p.id);

    await prisma.doDChecklistVerification.deleteMany({
      where: { pbiId: { in: pbiIds } },
    });
    await prisma.doRChecklistVerification.deleteMany({
      where: { pbiId: { in: pbiIds } },
    });

    const sprints = await prisma.sprint.findMany({
      where: { teamId },
      select: { id: true },
    });
    const sprintIds = sprints.map((s) => s.id);

    for (const sprintId of sprintIds) {
      await prisma.burndownData.deleteMany({ where: { sprintId } });
      await prisma.sprintBacklogChange.deleteMany({ where: { sprintId } });
      await prisma.sprintBacklogItem.deleteMany({ where: { sprintId } });

      const retro = await prisma.sprintRetrospective.findUnique({
        where: { sprintId },
      });
      if (retro) {
        await prisma.retroItemVote.deleteMany({
          where: {
            retrospectiveItem: { retrospectiveId: retro.id },
          },
        });
        await prisma.retroActionItem.deleteMany({ where: { retrospectiveId: retro.id } });
        await prisma.retroAttendee.deleteMany({ where: { retrospectiveId: retro.id } });
        await prisma.retrospectiveItem.deleteMany({ where: { retrospectiveId: retro.id } });
        await prisma.sprintRetrospective.delete({ where: { id: retro.id } });
      }

      const review = await prisma.sprintReview.findUnique({
        where: { sprintId },
      });
      if (review) {
        await prisma.stakeholderFeedback.deleteMany({ where: { reviewId: review.id } });
        await prisma.backlogAdjustment.deleteMany({ where: { reviewId: review.id } });
        await prisma.reviewAttendee.deleteMany({ where: { reviewId: review.id } });
        await prisma.sprintReview.delete({ where: { id: review.id } });
      }

      const increment = await prisma.increment.findFirst({
        where: { sprintId },
      });
      if (increment) {
        await prisma.incrementPBI.deleteMany({ where: { incrementId: increment.id } });
        await prisma.increment.delete({ where: { id: increment.id } });
      }
    }

    for (const pbiId of pbiIds) {
      await prisma.task.deleteMany({ where: { pbiId } });
    }
    await prisma.productBacklogItem.deleteMany({ where: { teamId } });

    await prisma.task.deleteMany({
      where: { sprintId: { in: sprintIds } },
    });
    await prisma.sprint.deleteMany({ where: { teamId } });

    await prisma.impediment.deleteMany({ where: { teamId } });
    await prisma.productGoal.deleteMany({ where: { teamId } });
    await prisma.definitionOfDone.deleteMany({ where: { teamId } });
    await prisma.definitionOfReady.deleteMany({ where: { teamId } });
    await prisma.sprintConfiguration.deleteMany({ where: { teamId } });
    await prisma.generatedSprint.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.delete({ where: { id: teamId } });
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const cleanupSprints = async (sprintIds: string[]): Promise<void> => {
  try {
    for (const sprintId of sprintIds) {
      await prisma.task.deleteMany({ where: { sprintId } });
      await prisma.burndownData.deleteMany({ where: { sprintId } });
      await prisma.sprintBacklogItem.deleteMany({ where: { sprintId } });
      await prisma.sprintBacklogChange.deleteMany({ where: { sprintId } });
      await prisma.sprint.delete({ where: { id: sprintId } });
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const cleanupPbis = async (pbiIds: string[]): Promise<void> => {
  try {
    for (const pbiId of pbiIds) {
      await prisma.doDChecklistVerification.deleteMany({ where: { pbiId } });
      await prisma.doRChecklistVerification.deleteMany({ where: { pbiId } });
      await prisma.task.deleteMany({ where: { pbiId } });
      await prisma.productBacklogItem.delete({ where: { id: pbiId } });
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const createTestIncrementInDb = async (
  sprintId: string,
  teamId: string,
  name?: string,
  status: 'DRAFT' | 'VERIFIED' | 'DELIVERED' | 'ARCHIVED' = 'DRAFT',
  /**
   * The two verifications an Increment must carry before it can be marked VERIFIED or delivered:
   * its integration with prior Increments, and the written attestation that it is usable.
   */
  verification: { integrationVerified?: boolean; usabilityVerified?: boolean } = {}
): Promise<{
  id: string;
  sprintId: string;
  teamId: string;
  name: string;
  status: string;
}> => {
  const incrementId = generateUUIDv7();
  const incrementName = name || `Increment-${uniqueTestId()}`;

  const increment = await prisma.increment.create({
    data: {
      id: incrementId,
      sprintId,
      teamId,
      name: incrementName,
      description: `Test increment description for ${incrementName}`,
      totalStoryPoints: 0,
      status,
      integrationVerified: verification.integrationVerified ?? false,
      usabilityVerified: verification.usabilityVerified ?? false,
      ...(verification.usabilityVerified
        ? {
            usabilityEvidence: 'Deployed and exercised by the team',
            usabilityVerifiedAt: new Date(),
          }
        : {}),
    },
  });

  return {
    id: increment.id,
    sprintId: increment.sprintId,
    teamId: increment.teamId,
    name: increment.name,
    status: increment.status,
  };
};

export const createTestSprintConfigurationInDb = async (
  teamId: string,
  year: number = new Date().getFullYear(),
  duration: 'TWO_WEEKS' | 'FOUR_WEEKS' = 'TWO_WEEKS',
  sprintStartDay: number = 1
): Promise<{
  id: string;
  teamId: string;
  year: number;
  duration: string;
  sprintStartDay: number;
}> => {
  const configId = generateUUIDv7();

  const config = await prisma.sprintConfiguration.create({
    data: {
      id: configId,
      teamId,
      year,
      duration,
      sprintStartDay,
    },
  });

  return {
    id: config.id,
    teamId: config.teamId,
    year: config.year,
    duration: config.duration,
    sprintStartDay: config.sprintStartDay,
  };
};

export const createTestSprintReviewInDb = async (
  sprintId: string,
  teamId: string,
  incrementId: string,
  createdBy: string,
  reviewDate?: Date,
  status: 'in_progress' | 'completed' = 'in_progress'
): Promise<{
  id: string;
  sprintId: string;
  teamId: string;
  incrementId: string;
  status: string;
}> => {
  const reviewId = generateUUIDv7();

  const review = await prisma.sprintReview.create({
    data: {
      id: reviewId,
      sprintId,
      teamId,
      incrementId,
      reviewDate: reviewDate || new Date(),
      summary: 'Test sprint review summary',
      status,
      createdBy,
    },
  });

  return {
    id: review.id,
    sprintId: review.sprintId,
    teamId: review.teamId,
    incrementId: review.incrementId,
    status: review.status,
  };
};

export const createTestRetrospectiveItemInDb = async (
  retrospectiveId: string,
  category: 'WENT_WELL' | 'DIDNT_GO_WELL' | 'IMPROVEMENT',
  content: string,
  authorId?: string
): Promise<{
  id: string;
  retrospectiveId: string;
  category: string;
  content: string;
}> => {
  const itemId = generateUUIDv7();

  const item = await prisma.retrospectiveItem.create({
    data: {
      id: itemId,
      retrospectiveId,
      category,
      content,
      authorId,
      votes: 0,
      order: 0,
    },
  });

  return {
    id: item.id,
    retrospectiveId: item.retrospectiveId,
    category: item.category,
    content: item.content,
  };
};

export const createTestRetroActionItemInDb = async (
  retrospectiveId: string,
  ownerId: string,
  title?: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' = 'PENDING'
): Promise<{
  id: string;
  retrospectiveId: string;
  ownerId: string;
  title: string;
  status: string;
}> => {
  const actionItemId = generateUUIDv7();
  const actionTitle = title || `Action Item-${uniqueTestId()}`;

  const actionItem = await prisma.retroActionItem.create({
    data: {
      id: actionItemId,
      retrospectiveId,
      title: actionTitle,
      description: `Test action item description for ${actionTitle}`,
      ownerId,
      status,
    },
  });

  return {
    id: actionItem.id,
    retrospectiveId: actionItem.retrospectiveId,
    ownerId: actionItem.ownerId,
    title: actionItem.title,
    status: actionItem.status,
  };
};

export const createTestNotificationInDb = async (
  userId: string,
  type:
    | 'TEAM_INVITATION'
    | 'TEAM_REMOVAL'
    | 'TASK_ASSIGNMENT'
    | 'IMPEDIMENT_ASSIGNMENT'
    | 'DAILY_SCRUM_SIGNAL'
    | 'TEAM_CREATED'
    | 'TEAM_UPDATED'
    | 'TEAM_DELETED'
    | 'DIRECT_MESSAGE'
    | 'ACCOUNT_DELETION_SCHEDULED'
    | 'ACCOUNT_DELETION_CANCELLED',
  title: string,
  message?: string,
  isRead: boolean = false
): Promise<{
  id: string;
  userId: string;
  type: string;
  title: string;
  isRead: boolean;
}> => {
  const notificationId = generateUUIDv7();

  const notification = await prisma.notification.create({
    data: {
      id: notificationId,
      userId,
      type,
      title,
      message: message || `Test notification message for ${title}`,
      isRead,
    },
  });

  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    isRead: notification.isRead,
  };
};

export const createTestConsentRecordInDb = async (
  userId: string | null,
  consentType: string,
  action: 'accept_all' | 'reject_all' | 'custom' | 'withdrawn' = 'accept_all',
  version: string = '1.0.0',
  ipAddress?: string,
  userAgent?: string
): Promise<{
  id: string;
  userId: string | null;
  consentType: string;
  action: string;
  version: string;
}> => {
  const recordId = generateUUIDv7();

  const record = await prisma.consentRecord.create({
    data: {
      id: recordId,
      userId,
      consentType,
      action,
      version,
      ipAddress: ipAddress || '127.0.0.1',
      userAgent: userAgent || 'test-agent',
    },
  });

  return {
    id: record.id,
    userId: record.userId,
    consentType: record.consentType,
    action: record.action,
    version: record.version,
  };
};

export const createTestStakeholderFeedbackInDb = async (
  reviewId: string,
  authorName: string,
  content: string,
  category: 'POSITIVE' | 'NEGATIVE' | 'SUGGESTION' | 'QUESTION' = 'POSITIVE'
): Promise<{
  id: string;
  reviewId: string;
  authorName: string;
  content: string;
  category: string;
}> => {
  const feedbackId = generateUUIDv7();

  const feedback = await prisma.stakeholderFeedback.create({
    data: {
      id: feedbackId,
      reviewId,
      authorName,
      content,
      category,
    },
  });

  return {
    id: feedback.id,
    reviewId: feedback.reviewId,
    authorName: feedback.authorName,
    content: feedback.content,
    category: feedback.category,
  };
};

export const createTestReviewAttendeeInDb = async (
  reviewId: string,
  name: string,
  role: string,
  email?: string
): Promise<{
  id: string;
  reviewId: string;
  name: string;
  role: string;
}> => {
  const attendeeId = generateUUIDv7();

  const attendee = await prisma.reviewAttendee.create({
    data: {
      id: attendeeId,
      reviewId,
      name,
      email,
      role,
    },
  });

  return {
    id: attendee.id,
    reviewId: attendee.reviewId,
    name: attendee.name,
    role: attendee.role,
  };
};

export const createTestBurndownDataInDb = async (
  sprintId: string,
  date: Date,
  idealRemaining: number,
  actualRemaining?: number
): Promise<{
  id: string;
  sprintId: string;
  date: Date;
  idealRemaining: number;
  actualRemaining: number | null;
}> => {
  const burndownId = generateUUIDv7();

  const burndown = await prisma.burndownData.create({
    data: {
      id: burndownId,
      sprintId,
      date,
      idealRemaining,
      actualRemaining,
    },
  });

  return {
    id: burndown.id,
    sprintId: burndown.sprintId,
    date: burndown.date,
    idealRemaining: burndown.idealRemaining,
    actualRemaining: burndown.actualRemaining,
  };
};

/**
 * Seed the Sprint Planning participation the start gate requires: the Product Owner and at least
 * one Developer recorded as present. Written directly so sprint-lifecycle tests can focus on the
 * behaviour under test; the planning-attendance API is covered by its own tests.
 */
export const seedPlanningParticipation = async (
  sprintId: string,
  createdBy?: string
): Promise<void> => {
  await prisma.sprintPlanningAttendee.createMany({
    data: [
      {
        id: generateUUIDv7(),
        sprintId,
        name: 'Product Owner',
        role: 'product_owner',
        attended: true,
        createdBy,
      },
      {
        id: generateUUIDv7(),
        sprintId,
        name: 'Developer',
        role: 'developers',
        attended: true,
        createdBy,
      },
    ],
  });
};

/**
 * Seed the two agreements the Sprint boundary requires: a Definition of Done the team holds, and a
 * Definition of Ready whose active criterion every given item satisfies.
 *
 * The boundary refuses a Sprint Backlog commit, and a Sprint start, when the team has no Definition
 * of Done, when its readiness agreement holds no active criterion, or when a selected item has an
 * unverified one — so a fixture that intends to open a Sprint has to represent a team that holds
 * both. Written directly so lifecycle tests can focus on the behaviour under test; the definitions'
 * own authorization and editing rules are covered by `integration/team-definitions.test.ts`.
 */
export const seedTeamDefinitions = async (
  teamId: string,
  pbiIds: string[],
  createdBy: string
): Promise<void> => {
  await prisma.definitionOfDone.create({
    data: {
      id: generateUUIDv7(),
      teamId,
      createdBy,
      items: {
        create: {
          id: generateUUIDv7(),
          description: 'Code is peer-reviewed and approved',
          category: 'review',
          isActive: true,
          order: 0,
          createdBy,
        },
      },
    },
  });

  const dorItemId = generateUUIDv7();
  await prisma.definitionOfReady.create({
    data: {
      id: generateUUIDv7(),
      teamId,
      createdBy,
      items: {
        create: {
          id: dorItemId,
          description: 'Acceptance criteria defined and agreed',
          category: 'acceptance',
          isActive: true,
          order: 0,
          createdBy,
        },
      },
    },
  });

  if (pbiIds.length > 0) {
    await prisma.doRChecklistVerification.createMany({
      data: pbiIds.map((pbiId) => ({
        id: generateUUIDv7(),
        pbiId,
        dorItemId,
        isVerified: true,
        verifiedBy: createdBy,
        createdBy,
      })),
    });
  }
};

export const addPBIToSprintBacklog = async (
  sprintId: string,
  pbiId: string
): Promise<{
  id: string;
  sprintId: string;
  pbiId: string;
}> => {
  const backlogItemId = generateUUIDv7();

  const backlogItem = await prisma.sprintBacklogItem.create({
    data: {
      id: backlogItemId,
      sprintId,
      pbiId,
    },
  });

  return {
    id: backlogItem.id,
    sprintId: backlogItem.sprintId,
    pbiId: backlogItem.pbiId,
  };
};

export const addPBIToIncrement = async (
  incrementId: string,
  pbiId: string
): Promise<{
  id: string;
  incrementId: string;
  pbiId: string;
}> => {
  const incrementPBIId = generateUUIDv7();

  const incrementPBI = await prisma.incrementPBI.create({
    data: {
      id: incrementPBIId,
      incrementId,
      pbiId,
    },
  });

  return {
    id: incrementPBI.id,
    incrementId: incrementPBI.incrementId,
    pbiId: incrementPBI.pbiId,
  };
};

export const cleanupIncrements = async (incrementIds: string[]): Promise<void> => {
  try {
    for (const incrementId of incrementIds) {
      await prisma.incrementPBI.deleteMany({ where: { incrementId } });
      await prisma.increment.delete({ where: { id: incrementId } });
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const cleanupNotifications = async (userIds: string[]): Promise<void> => {
  try {
    for (const userId of userIds) {
      await prisma.notification.deleteMany({ where: { userId } });
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};

export const cleanupConsentRecords = async (userIds: string[]): Promise<void> => {
  try {
    for (const userId of userIds) {
      await prisma.consentRecord.deleteMany({ where: { userId } });
    }
  } catch (_error) {
    // Ignore cleanup errors
  }
};
