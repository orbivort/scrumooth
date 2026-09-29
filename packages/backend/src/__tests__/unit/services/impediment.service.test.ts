import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    impediment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    sprint: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// Now import the service and other dependencies
import { impedimentService } from '../../../services/impediment.service';
import prisma from '../../../utils/prisma';
import { ImpedimentStatus, NotificationType, UserRole } from '../../../generated/prisma/client';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

/** The caller holds PRODUCT_OWNER unless a test needs a specific role. */
const mockMembership = (role: UserRole = UserRole.PRODUCT_OWNER) =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ id: 'member-1', role });

const mockNoMembership = () => asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

describe('ImpedimentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sprint scoping passes by default; tests that care override it.
    asMock(prisma.sprint.findFirst).mockResolvedValue({ id: 'sprint-1' });
  });

  describe('getImpedimentsByTeam', () => {
    it('should return all impediments for a team, ordered by impact then age', async () => {
      const teamId = 'team-1';
      const mockImpediments = [
        {
          id: 'imp-1',
          teamId,
          title: 'Blocked API',
          status: ImpedimentStatus.OPEN,
          priority: 'CRITICAL',
          reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
          owner: null,
          sprint: null,
          createdAt: new Date(),
        },
        {
          id: 'imp-2',
          teamId,
          title: 'Server Issue',
          status: ImpedimentStatus.IN_PROGRESS,
          priority: 'MEDIUM',
          reportedBy: { id: 'user-2', firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com' },
          owner: { id: 'user-3', firstName: 'Bob', lastName: 'Smith', email: 'bob@test.com' },
          sprint: { id: 'sprint-1', name: 'Sprint 1' },
          createdAt: new Date(),
        },
      ];

      asMock(prisma.impediment.findMany).mockResolvedValue(mockImpediments);

      const result = await impedimentService.getImpedimentsByTeam(teamId);

      expect(result).toHaveLength(2);
      // Impact first: `priority` is a PostgreSQL enum compared by declaration order, so `asc`
      // reads CRITICAL -> LOW. Age is the tie-breaker, oldest first.
      expect(prisma.impediment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        })
      );
    });
  });

  describe('getImpedimentById', () => {
    it('should return impediment by ID', async () => {
      const impedimentId = 'imp-1';
      const teamId = 'team-1';
      const mockImpediment = {
        id: impedimentId,
        teamId,
        title: 'Blocked API',
        status: ImpedimentStatus.OPEN,
        reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        owner: null,
        sprint: null,
      };

      asMock(prisma.impediment.findFirst).mockResolvedValue(mockImpediment);

      const result = await impedimentService.getImpedimentById(impedimentId, teamId);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Blocked API');
      expect(prisma.impediment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: impedimentId, teamId } })
      );
    });

    it('should return null for non-existent impediment', async () => {
      asMock(prisma.impediment.findFirst).mockResolvedValue(null);

      const result = await impedimentService.getImpedimentById('non-existent', 'team-1');

      expect(result).toBeNull();
    });
  });

  describe('createImpediment', () => {
    it('should create impediment successfully with a default priority and an audit trail', async () => {
      const mockImpediment = {
        id: 'imp-1',
        teamId: 'team-1',
        title: 'New Impediment',
        description: 'Description of the impediment',
        status: ImpedimentStatus.OPEN,
        priority: 'MEDIUM',
        reportedById: 'user-1',
        ownerId: null,
        reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        owner: null,
        sprint: null,
      };

      mockMembership();
      asMock(prisma.teamMember.findFirst)
        .mockResolvedValueOnce({ id: 'member-1', role: UserRole.PRODUCT_OWNER }) // membership
        .mockResolvedValueOnce(null); // no Scrum Master to default to
      asMock(prisma.impediment.create).mockResolvedValue(mockImpediment);

      const result = await impedimentService.createImpediment('user-1', {
        teamId: 'team-1',
        title: 'New Impediment',
        description: 'Description of the impediment',
      });

      expect(result.title).toBe('New Impediment');
      // The audit columns the API documents are actually written.
      expect(prisma.impediment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reportedById: 'user-1',
            createdBy: 'user-1',
            updatedBy: 'user-1',
            priority: 'MEDIUM',
            status: ImpedimentStatus.OPEN,
          }),
        })
      );
    });

    it('should normalize a date-only target date before handing it to Prisma', async () => {
      mockMembership();
      asMock(prisma.impediment.create).mockResolvedValue({ id: 'imp-1' });

      await impedimentService.createImpediment('user-1', {
        teamId: 'team-1',
        title: 'Blocked',
        description: 'Blocked on the shared CI account',
        targetDate: '2026-10-01',
      });

      // Prisma's `DateTime` input accepts a `Date` or a full ISO timestamp, not the bare
      // `YYYY-MM-DD` this API documents. Forwarding it unchanged surfaced to the user as
      // "Invalid data provided" and stored nothing.
      expect(prisma.impediment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ targetDate: new Date('2026-10-01T00:00:00.000Z') }),
        })
      );
    });

    it('should refuse an unparseable target date instead of passing it to Prisma', async () => {
      mockMembership();

      await expect(
        impedimentService.createImpediment('user-1', {
          teamId: 'team-1',
          title: 'Blocked',
          description: 'Blocked on the shared CI account',
          targetDate: 'not-a-date',
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.impediment.create).not.toHaveBeenCalled();
    });

    it('should refuse a caller who is not a member of the team', async () => {
      mockNoMembership();

      await expect(
        impedimentService.createImpediment('outsider', {
          teamId: 'team-1',
          title: 'Blocked',
          description: 'Blocked on access',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.impediment.create).not.toHaveBeenCalled();
    });

    it('should default the owner to the team Scrum Master and notify them', async () => {
      const mockImpediment = {
        id: 'imp-1',
        teamId: 'team-1',
        title: 'Blocked',
        description: 'Blocked',
        status: ImpedimentStatus.OPEN,
        priority: 'MEDIUM',
        reportedById: 'user-1',
        ownerId: 'sm-1',
        reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        owner: { id: 'sm-1', firstName: 'Sam', lastName: 'Miller', email: 'sm@test.com' },
        sprint: null,
      };

      asMock(prisma.teamMember.findFirst)
        .mockResolvedValueOnce({ id: 'member-1', role: UserRole.DEVELOPERS }) // membership
        .mockResolvedValueOnce({ userId: 'sm-1' }); // Scrum Master lookup
      asMock(prisma.impediment.create).mockResolvedValue(mockImpediment);
      asMock(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      });
      asMock(prisma.notification.create).mockResolvedValue({ id: 'notif-1' });

      await impedimentService.createImpediment('user-1', {
        teamId: 'team-1',
        title: 'Blocked',
        description: 'Blocked',
      });

      expect(prisma.impediment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: 'sm-1' }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'sm-1',
            type: NotificationType.IMPEDIMENT_ASSIGNMENT,
          }),
        })
      );
    });

    it('should refuse an owner who is not a member of the team', async () => {
      asMock(prisma.teamMember.findFirst)
        .mockResolvedValueOnce({ id: 'member-1', role: UserRole.PRODUCT_OWNER }) // membership
        .mockResolvedValueOnce(null); // owner lookup fails

      await expect(
        impedimentService.createImpediment('user-1', {
          teamId: 'team-1',
          title: 'Blocked',
          description: 'Blocked',
          ownerId: 'outsider',
        })
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.impediment.create).not.toHaveBeenCalled();
    });

    it('should refuse a Sprint that belongs to another team', async () => {
      mockMembership();
      asMock(prisma.sprint.findFirst).mockResolvedValue(null);

      await expect(
        impedimentService.createImpediment('user-1', {
          teamId: 'team-1',
          title: 'Blocked',
          description: 'Blocked',
          sprintId: 'sprint-of-another-team',
        })
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.impediment.create).not.toHaveBeenCalled();
    });

    it('should not create notification when owner is the same as reporter', async () => {
      const mockImpediment = {
        id: 'imp-1',
        teamId: 'team-1',
        title: 'New Impediment',
        description: 'Description',
        status: ImpedimentStatus.OPEN,
        priority: 'MEDIUM',
        reportedById: 'user-1',
        ownerId: 'user-1',
        reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        owner: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
        sprint: null,
      };

      mockMembership();
      asMock(prisma.impediment.create).mockResolvedValue(mockImpediment);

      await impedimentService.createImpediment('user-1', {
        teamId: 'team-1',
        title: 'New Impediment',
        description: 'Description',
        ownerId: 'user-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('updateImpediment', () => {
    const existingOpen = {
      id: 'imp-1',
      status: ImpedimentStatus.OPEN,
      resolution: null,
      resolvedAt: null,
    };

    it('should refuse a caller who is not a member of the team', async () => {
      mockNoMembership();

      await expect(
        impedimentService.updateImpediment('imp-1', 'team-1', 'outsider', {
          status: ImpedimentStatus.IN_PROGRESS,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.impediment.update).not.toHaveBeenCalled();
    });

    it('should refuse an impediment that is not part of the team', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue(null);

      await expect(
        impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
          status: ImpedimentStatus.IN_PROGRESS,
        })
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.impediment.update).not.toHaveBeenCalled();
    });

    it('should set resolvedAt and updatedBy when status changes to RESOLVED', async () => {
      const mockImpediment = {
        id: 'imp-1',
        teamId: 'team-1',
        status: ImpedimentStatus.RESOLVED,
        resolution: 'Fixed the issue',
        resolvedAt: new Date(),
      };

      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue(existingOpen);
      asMock(prisma.impediment.update).mockResolvedValue(mockImpediment);

      const result = await impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
        status: ImpedimentStatus.RESOLVED,
        resolution: 'Fixed the issue',
      });

      expect(result.status).toBe(ImpedimentStatus.RESOLVED);
      expect(prisma.impediment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ImpedimentStatus.RESOLVED,
            resolution: 'Fixed the issue',
            resolvedAt: expect.any(Date),
            updatedBy: 'user-1',
          }),
        })
      );
    });

    it('should refuse RESOLVED without a resolution', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue(existingOpen);

      await expect(
        impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
          status: ImpedimentStatus.RESOLVED,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED,
      });

      expect(prisma.impediment.update).not.toHaveBeenCalled();
    });

    it('should refuse CLOSED without a resolution, so the Sprint-close gate cannot be lifted cheaply', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue(existingOpen);

      await expect(
        impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
          status: ImpedimentStatus.CLOSED,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED,
      });

      expect(prisma.impediment.update).not.toHaveBeenCalled();
    });

    it('should accept CLOSED when a resolution was recorded earlier in the lifecycle', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue({
        id: 'imp-1',
        status: ImpedimentStatus.RESOLVED,
        resolution: 'Fixed the issue',
        resolvedAt: new Date(),
      });
      asMock(prisma.impediment.update).mockResolvedValue({ id: 'imp-1' });

      await impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
        status: ImpedimentStatus.CLOSED,
      });

      expect(prisma.impediment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ImpedimentStatus.CLOSED }),
        })
      );
    });

    it('should clear resolvedAt when status leaves a terminal state', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue({
        id: 'imp-1',
        status: ImpedimentStatus.RESOLVED,
        resolution: 'Fixed',
        resolvedAt: new Date(),
      });
      asMock(prisma.impediment.update).mockResolvedValue({
        id: 'imp-1',
        status: ImpedimentStatus.OPEN,
        resolvedAt: null,
      });

      const result = await impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
        status: ImpedimentStatus.OPEN,
      });

      expect(result.status).toBe(ImpedimentStatus.OPEN);
      expect(prisma.impediment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ImpedimentStatus.OPEN,
            resolvedAt: null,
          }),
        })
      );
    });

    it('should update the declared priority and target date', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue(existingOpen);
      asMock(prisma.impediment.update).mockResolvedValue({ id: 'imp-1' });

      await impedimentService.updateImpediment('imp-1', 'team-1', 'user-1', {
        priority: 'CRITICAL',
        targetDate: '2026-10-01',
      });

      expect(prisma.impediment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'CRITICAL',
            // The documented date-only form is normalized, because Prisma rejects it verbatim.
            targetDate: new Date('2026-10-01T00:00:00.000Z'),
          }),
        })
      );
    });
  });

  describe('deleteImpediment', () => {
    const existing = { id: 'imp-1', reportedById: 'reporter-1', ownerId: 'owner-1' };

    it('should refuse a caller who is not a member of the team', async () => {
      mockNoMembership();

      await expect(
        impedimentService.deleteImpediment('imp-1', 'team-1', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.impediment.delete).not.toHaveBeenCalled();
    });

    it('should refuse an impediment that is not part of the team', async () => {
      mockMembership();
      asMock(prisma.impediment.findFirst).mockResolvedValue(null);

      await expect(
        impedimentService.deleteImpediment('imp-1', 'team-1', 'user-1')
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.impediment.delete).not.toHaveBeenCalled();
    });

    it('should allow the reporter to delete', async () => {
      mockMembership(UserRole.DEVELOPERS);
      asMock(prisma.impediment.findFirst).mockResolvedValue(existing);
      asMock(prisma.impediment.delete).mockResolvedValue(existing);

      await impedimentService.deleteImpediment('imp-1', 'team-1', 'reporter-1');

      expect(prisma.impediment.delete).toHaveBeenCalledWith({ where: { id: 'imp-1' } });
    });

    it('should allow the owner to delete', async () => {
      mockMembership(UserRole.DEVELOPERS);
      asMock(prisma.impediment.findFirst).mockResolvedValue(existing);
      asMock(prisma.impediment.delete).mockResolvedValue(existing);

      await impedimentService.deleteImpediment('imp-1', 'team-1', 'owner-1');

      expect(prisma.impediment.delete).toHaveBeenCalled();
    });

    it('should allow the Scrum Master to delete', async () => {
      mockMembership(UserRole.SCRUM_MASTER);
      asMock(prisma.impediment.findFirst).mockResolvedValue(existing);
      asMock(prisma.impediment.delete).mockResolvedValue(existing);

      await impedimentService.deleteImpediment('imp-1', 'team-1', 'sm-9');

      expect(prisma.impediment.delete).toHaveBeenCalled();
    });

    it('should refuse a team member who is neither the reporter, the owner, nor the Scrum Master', async () => {
      mockMembership(UserRole.DEVELOPERS);
      asMock(prisma.impediment.findFirst).mockResolvedValue(existing);

      await expect(
        impedimentService.deleteImpediment('imp-1', 'team-1', 'bystander')
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.impediment.delete).not.toHaveBeenCalled();
    });
  });

  describe('getImpedimentStats', () => {
    it('should return impediment statistics', async () => {
      const teamId = 'team-1';
      const mockImpediments = [
        { status: ImpedimentStatus.OPEN },
        { status: ImpedimentStatus.OPEN },
        { status: ImpedimentStatus.IN_PROGRESS },
        { status: ImpedimentStatus.RESOLVED },
        { status: ImpedimentStatus.RESOLVED },
        { status: ImpedimentStatus.CLOSED },
      ];

      asMock(prisma.impediment.findMany).mockResolvedValue(mockImpediments);

      const result = await impedimentService.getImpedimentStats(teamId);

      expect(result.open).toBe(2);
      expect(result.inProgress).toBe(1);
      expect(result.resolved).toBe(2);
      expect(result.closed).toBe(1);
    });

    it('should return zero stats when no impediments exist', async () => {
      asMock(prisma.impediment.findMany).mockResolvedValue([]);

      const result = await impedimentService.getImpedimentStats('team-1');

      expect(result.open).toBe(0);
      expect(result.inProgress).toBe(0);
      expect(result.resolved).toBe(0);
      expect(result.closed).toBe(0);
    });
  });

  describe('escalateAgedImpediments', () => {
    const now = new Date('2026-09-21T09:00:00.000Z');
    const agedImpediment = {
      id: 'imp-1',
      teamId: 'team-1',
      title: 'Blocked CI',
      createdAt: new Date('2026-09-01T09:00:00.000Z'),
    };

    it('should do nothing when no impediment is past the threshold', async () => {
      asMock(prisma.impediment.findMany).mockResolvedValue([]);

      const count = await impedimentService.escalateAgedImpediments(7, now);

      expect(count).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(prisma.impediment.update).not.toHaveBeenCalled();
      // The scan is scoped to unresolved work and the escalation window, so it cannot
      // re-notify on every run.
      expect(prisma.impediment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [ImpedimentStatus.OPEN, ImpedimentStatus.IN_PROGRESS] },
            createdAt: { lte: expect.any(Date) },
            OR: [{ escalatedAt: null }, { escalatedAt: { lte: expect.any(Date) } }],
          }),
        })
      );
    });

    it('should notify the Scrum Master and stamp the escalation', async () => {
      asMock(prisma.impediment.findMany).mockResolvedValue([agedImpediment]);
      asMock(prisma.teamMember.findMany).mockResolvedValue([{ teamId: 'team-1', userId: 'sm-1' }]);
      asMock(prisma.notification.create).mockResolvedValue({ id: 'notif-1' });
      asMock(prisma.impediment.update).mockResolvedValue({ id: 'imp-1' });

      const count = await impedimentService.escalateAgedImpediments(7, now);

      expect(count).toBe(1);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'sm-1',
            type: NotificationType.IMPEDIMENT_ESCALATION,
          }),
        })
      );
      expect(prisma.impediment.update).toHaveBeenCalledWith({
        where: { id: 'imp-1' },
        data: { escalatedAt: now, escalationCount: { increment: 1 } },
      });
    });

    it('should skip a team without a Scrum Master and leave the impediment unstamped', async () => {
      asMock(prisma.impediment.findMany).mockResolvedValue([agedImpediment]);
      asMock(prisma.teamMember.findMany).mockResolvedValue([]);

      const count = await impedimentService.escalateAgedImpediments(7, now);

      expect(count).toBe(0);
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(prisma.impediment.update).not.toHaveBeenCalled();
    });
  });
});
