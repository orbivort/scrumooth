import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    dailyScrum: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dailyScrumBacklogItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    dailyScrumParticipant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    impediment: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        dailyScrum: {
          update: vi.fn(),
        },
        dailyScrumBacklogItem: {
          deleteMany: vi.fn(),
          createMany: vi.fn(),
        },
        impediment: {
          create: vi.fn(),
        },
      })
    ),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// t/i18n mock used by sendTeamSignal
vi.mock('../../../i18n/requestT.js', () => ({
  t: vi.fn((key: string, params?: Record<string, unknown>) => {
    if (key === 'notifications:dailyScrumSignalTitle') return 'Daily Scrum starting';
    if (key === 'notifications:dailyScrumSignalMessage') {
      return `The Daily Scrum for "${params?.sprintName}" is starting.`;
    }
    if (key === 'notifications:remindersNone') return 'No team members';
    if (key === 'notifications:remindersSent') return 'Signal sent to 1 member';
    return key;
  }),
}));

// notificationService.createLocalized is used by sendTeamSignal to persist each
// signal with canonical i18n keys so the frontend can re-translate at display time.
vi.mock('../../../services/notification.service', () => ({
  notificationService: {
    createLocalized: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  },
}));

import { dailyScrumService } from '../../../services/dailyScrum.service';
import { notificationService } from '../../../services/notification.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, ConflictError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { UserRole, NotificationType } from '../../../generated/prisma/client';

const baseInclude = {
  participants: {
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  backlogAdjustments: {
    include: {
      sprintBacklogItem: {
        include: {
          pbi: { select: { id: true, title: true } },
        },
      },
    },
  },
};

const mockScrum = {
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: new Date('2026-08-23'),
  progressNotes: 'On track toward the goal',
  adaptationsNotes: 'Will adjust backlog item X',
  planForNextDay: 'Pair up on Y',
  participants: [],
  backlogAdjustments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DailyScrumService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default role guard setup: the acting user is a Developer on the sprint's team.
    (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sprint-1',
      teamId: 'team-1',
    });
    (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      role: UserRole.DEVELOPERS,
    });
  });

  describe('getDailyScrum', () => {
    it('returns the team-level Daily Scrum for a sprint and date', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      const result = await dailyScrumService.getDailyScrum('sprint-1');

      expect(prisma.dailyScrum.findUnique).toHaveBeenCalledWith({
        where: { sprintId_scrumDate: { sprintId: 'sprint-1', scrumDate: expect.any(Date) } },
        include: baseInclude,
      });
      expect(result).toEqual(mockScrum);
    });

    it('parses the requested date', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await dailyScrumService.getDailyScrum('sprint-1', '2026-08-20');

      expect(prisma.dailyScrum.findUnique).toHaveBeenCalledWith({
        where: {
          sprintId_scrumDate: {
            sprintId: 'sprint-1',
            scrumDate: new Date(2026, 7, 20),
          },
        },
        include: baseInclude,
      });
    });
  });

  describe('createDailyScrum', () => {
    it('throws ConflictError if a Daily Scrum already exists for the sprint today', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          progressNotes: 'Progress',
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('honors a client-supplied scrumDate when creating for a specific date', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const createMock = vi.fn().mockResolvedValue(mockScrum);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockImplementation(createMock);

      await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        scrumDate: '2026-08-20',
        planForNextDay: 'Plan',
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scrumDate: new Date(2026, 7, 20) }),
        })
      );
    });

    it('throws ConflictError if a Daily Scrum already exists for the requested date', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        dailyScrumService.createDailyScrum('user-1', {
          sprintId: 'sprint-1',
          scrumDate: '2026-08-20',
          planForNextDay: 'Plan',
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('creates a team-level Daily Scrum with participant and backlog adjustments', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        progressNotes: 'Progress',
        backlogAdjustments: [{ sprintBacklogItemId: 'item-1', action: 'reassigned' }],
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalled();
      expect(result).toEqual(mockScrum);
    });

    it('persists the Developer-chosen focus mode on the record', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrum.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        focusMode: 'impediment',
      });

      const result = await dailyScrumService.createDailyScrum('user-1', {
        sprintId: 'sprint-1',
        planForNextDay: 'Plan',
        focusMode: 'impediment',
      });

      expect(prisma.dailyScrum.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ focusMode: 'impediment' }),
        })
      );
      expect(result.focusMode).toBe('impediment');
    });

    it('throws NotFoundError if the sprint does not exist', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        dailyScrumService.createDailyScrum('user-1', { sprintId: 'sprint-1' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('Developers-only access (Scrum Guide)', () => {
    it('throws a 403 gate refusal when a non-Developer tries to create the Daily Scrum', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
      });
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        role: UserRole.PRODUCT_OWNER,
      });

      await expect(
        dailyScrumService.createDailyScrum('po-user', { sprintId: 'sprint-1' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });

    it('throws a 403 gate refusal when a non-Developer tries to update the Daily Scrum', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        role: UserRole.SCRUM_MASTER,
      });

      await expect(
        dailyScrumService.updateDailyScrum('scrum-1', 'sm-user', { planForNextDay: 'Plan' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });

    it('throws a 403 gate refusal when a non-Developer tries to record participation', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        dailyScrumService.recordParticipation('scrum-1', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });

    it('throws a 403 gate refusal when a non-Developer tries to promote an impediment', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        sprint: { id: 'sprint-1', teamId: 'team-1' },
      });
      (prisma.teamMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        role: UserRole.PRODUCT_OWNER,
      });

      await expect(
        dailyScrumService.promoteToImpediment('scrum-1', 'po-user', {
          title: 'Blocked',
          description: 'Blocked on access',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_DAILY_SCRUM,
      });
    });
  });

  describe('updateDailyScrum', () => {
    it('replaces backlog adjustments and auto-joins the editor as a participant', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.dailyScrum.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);
      (prisma.dailyScrumBacklogItem.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });
      (prisma.dailyScrumBacklogItem.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 1,
      });

      const txUpdate = vi.fn().mockResolvedValue(mockScrum);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (
          callback: (tx: {
            dailyScrum: { update: typeof txUpdate };
            dailyScrumBacklogItem: {
              deleteMany: ReturnType<typeof vi.fn>;
              createMany: ReturnType<typeof vi.fn>;
            };
          }) => Promise<unknown>
        ) =>
          callback({
            dailyScrum: { update: txUpdate },
            dailyScrumBacklogItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
              createMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          })
      );

      const result = await dailyScrumService.updateDailyScrum('scrum-1', 'user-1', {
        planForNextDay: 'New plan',
        backlogAdjustments: [{ sprintBacklogItemId: 'item-1', action: 'flagged' }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            participants: {
              connectOrCreate: {
                where: { dailyScrumId_userId: { dailyScrumId: 'scrum-1', userId: 'user-1' } },
                create: expect.objectContaining({ userId: 'user-1' }),
              },
            },
          }),
        })
      );
      expect(result).toEqual(mockScrum);
    });

    it('throws NotFoundError if the Daily Scrum does not exist', async () => {
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        dailyScrumService.updateDailyScrum('scrum-1', 'user-1', { planForNextDay: 'Plan' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('recordParticipation', () => {
    it('adds the user as a participant once', async () => {
      (prisma.dailyScrumParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dailyScrumParticipant.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'p-1',
      });
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockScrum);

      const result = await dailyScrumService.recordParticipation('scrum-1', 'user-1');

      expect(prisma.dailyScrumParticipant.create).toHaveBeenCalled();
      expect(result).toEqual(mockScrum);
    });
  });

  describe('getParticipation', () => {
    it('only lists Developers as not yet joined (Daily Scrum is Developers-only)', async () => {
      const members = [
        {
          userId: 'dev-1',
          role: UserRole.DEVELOPERS,
          user: { id: 'dev-1', firstName: 'Dev', lastName: 'One' },
        },
        {
          userId: 'dev-2',
          role: UserRole.DEVELOPERS,
          user: { id: 'dev-2', firstName: 'Dev', lastName: 'Two' },
        },
        {
          userId: 'po-1',
          role: UserRole.PRODUCT_OWNER,
          user: { id: 'po-1', firstName: 'Prod', lastName: 'Owner' },
        },
        {
          userId: 'sm-1',
          role: UserRole.SCRUM_MASTER,
          user: { id: 'sm-1', firstName: 'Scrum', lastName: 'Master' },
        },
      ];
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        team: { members },
      });
      // dev-1 already joined; dev-2 has not; PO and SM are excluded entirely.
      const devOne = members[0]!;
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        participants: [{ id: 'p-1', userId: 'dev-1', user: devOne.user }],
      });

      const result = await dailyScrumService.getParticipation('sprint-1', '2026-08-23');

      expect(result.nonParticipants).toEqual([{ userId: 'dev-2', userName: 'Dev Two' }]);
      expect(result.participants).toHaveLength(1);
    });
  });

  describe('sendTeamSignal', () => {
    it('sends a signal only to Developers who have not yet joined', async () => {
      // Team has two Developers, one Product Owner, one Scrum Master.
      const members = [
        { userId: 'dev-1', role: UserRole.DEVELOPERS, user: { id: 'dev-1' } },
        { userId: 'dev-2', role: UserRole.DEVELOPERS, user: { id: 'dev-2' } },
        { userId: 'po-1', role: UserRole.PRODUCT_OWNER, user: { id: 'po-1' } },
        { userId: 'sm-1', role: UserRole.SCRUM_MASTER, user: { id: 'sm-1' } },
      ];
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        teamId: 'team-1',
        team: { members },
      });
      // dev-1 already joined; dev-2 has not. PO/SM are excluded entirely.
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockScrum,
        participants: [{ id: 'p-1', userId: 'dev-1', user: { id: 'dev-1' } }],
      });

      const result = await dailyScrumService.sendTeamSignal('sprint-1', 'user-1');

      expect(notificationService.createLocalized).toHaveBeenCalledTimes(1);
      expect(notificationService.createLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'dev-2',
          type: NotificationType.DAILY_SCRUM_SIGNAL,
          titleKey: 'dailyScrumSignalTitle',
          messageKey: 'dailyScrumSignalMessage',
          messageParams: { sprintName: 'Sprint 1' },
        })
      );
      expect(result.sentCount).toBe(1);
    });

    it('throws NotFoundError if the sprint does not exist', async () => {
      (prisma.sprint.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(dailyScrumService.sendTeamSignal('sprint-1', 'user-1')).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('promoteToImpediment', () => {
    it('creates an impediment from a Daily Scrum, deriving team from the record', async () => {
      // Both the initial lookup (with sprint relation) and the post-create
      // read via getDailyScrumById return a scrum that belongs to a sprint.
      const scrumWithSprint = {
        ...mockScrum,
        sprint: { id: 'sprint-1', teamId: 'team-1' },
      };
      (prisma.dailyScrum.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(scrumWithSprint);
      const mockImpediment = {
        id: 'imp-1',
        title: 'API access',
        description: 'Blocked',
        reportedBy: { id: 'user-1' },
        owner: null,
        sprint: { id: 'sprint-1', name: 'Sprint 1' },
      };
      const createMock = vi.fn().mockResolvedValue(mockImpediment);
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
        (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            impediment: { create: createMock },
          })
      );

      const result = await dailyScrumService.promoteToImpediment('scrum-1', 'user-1', {
        title: 'API access',
        description: 'Blocked on API access',
      });

      // The team must be derived from the Daily Scrum's sprint, not the request body.
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamId: 'team-1', sprintId: 'sprint-1' }),
        })
      );
      expect(result.impediment).toEqual(mockImpediment);
    });
  });
});
