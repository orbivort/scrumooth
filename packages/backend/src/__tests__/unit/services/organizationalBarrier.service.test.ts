import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => {
  const client: any = {
    organizationalBarrier: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    barrierStakeholderAction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    impediment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // The escalation writes the barrier and stamps the impediment in one transaction; the double
  // runs the callback against the same mocked client so both writes stay assertable.
  client.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)(client)
      : Promise.all(arg as unknown[])
  );

  return { default: client };
});

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  AuditEventTypes: { TEAM: 'TEAM' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

import { organizationalBarrierService } from '../../../services/organizationalBarrier.service';
import prisma from '../../../utils/prisma';
import { auditResourceEvent } from '../../../utils/auditLogger';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

/** The caller leads the team unless a test says otherwise. */
const callerIsScrumMaster = () =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' });

const callerIsDeveloper = () =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' });

const callerIsNotAMember = () => asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

const bar = {
  id: 'barrier-1',
  teamId: 'team-1',
  sourceImpedimentId: null,
  title: 'Procurement takes six weeks',
  description: 'We cannot ship without a signed licence.',
  priority: 'HIGH',
  status: 'OPEN',
  ownerId: 'owner-1',
  raisedById: 'sm-1',
  targetDate: null,
  resolution: null,
  resolvedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  owner: { id: 'owner-1', firstName: 'Ada', lastName: 'Lovelace' },
  raisedBy: { id: 'sm-1', firstName: 'Grace', lastName: 'Hopper' },
  sourceImpediment: null,
};

describe('OrganizationalBarrierService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsScrumMaster();
    asMock(prisma.user.findUnique).mockResolvedValue({ id: 'owner-1' });
    asMock(prisma.notification.create).mockResolvedValue({ id: 'notif-1' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBarriers', () => {
    it('should refuse the register for someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        organizationalBarrierService.getBarriers('team-1', 'outsider')
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
      });
      expect(prisma.organizationalBarrier.findMany).not.toHaveBeenCalled();
    });

    it('should read the register impact first and derive age and overdue', async () => {
      asMock(prisma.organizationalBarrier.findMany).mockResolvedValue([
        { ...bar, targetDate: new Date('2026-09-05T00:00:00.000Z') },
      ]);

      const [result] = await organizationalBarrierService.getBarriers('team-1', 'user-1');

      expect(prisma.organizationalBarrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1' },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        })
      );
      expect(result).toMatchObject({
        id: 'barrier-1',
        ownerName: 'Ada Lovelace',
        raisedByName: 'Grace Hopper',
        sourceImpedimentTitle: null,
        isOverdue: true,
      });
      expect(result?.ageDays).toBeGreaterThan(0);
    });

    it('should apply the status and priority filters', async () => {
      asMock(prisma.organizationalBarrier.findMany).mockResolvedValue([]);

      await organizationalBarrierService.getBarriers('team-1', 'user-1', {
        status: 'OPEN',
        priority: 'CRITICAL',
      });

      expect(prisma.organizationalBarrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1', status: 'OPEN', priority: 'CRITICAL' },
        })
      );
    });
  });

  describe('getBarrierStats', () => {
    it('should count by status and flag overdue unresolved barriers', async () => {
      asMock(prisma.organizationalBarrier.findMany).mockResolvedValue([
        { status: 'OPEN', targetDate: new Date('2020-01-01T00:00:00.000Z') },
        { status: 'IN_PROGRESS', targetDate: null },
        { status: 'RESOLVED', targetDate: new Date('2020-01-01T00:00:00.000Z') },
      ]);

      const stats = await organizationalBarrierService.getBarrierStats('team-1', 'user-1');

      expect(stats).toEqual({ open: 1, inProgress: 1, resolved: 1, closed: 0, overdue: 1 });
    });

    it('should refuse the stats for someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        organizationalBarrierService.getBarrierStats('team-1', 'outsider')
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
      });
    });
  });

  describe('getBarrierById', () => {
    it('should throw NotFoundError when the barrier does not exist', async () => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.getBarrierById('missing', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a barrier of a team the caller is not in', async () => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValueOnce({
        id: 'barrier-1',
        teamId: 'team-9',
        title: 'Other team barrier',
        status: 'OPEN',
        resolvedAt: null,
      });
      callerIsNotAMember();

      await expect(
        organizationalBarrierService.getBarrierById('barrier-1', 'outsider')
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
      });
    });

    it('should resolve the owning team from the barrier itself', async () => {
      asMock(prisma.organizationalBarrier.findUnique)
        .mockResolvedValueOnce({
          id: 'barrier-1',
          teamId: 'team-9',
          title: 'Other team barrier',
          status: 'OPEN',
          resolvedAt: null,
        })
        .mockResolvedValueOnce({
          ...bar,
          teamId: 'team-9',
          actions: [
            {
              id: 'action-1',
              barrierId: 'barrier-1',
              description: 'Ask the vendor for the licence',
              ownerId: 'owner-1',
              owner: bar.owner,
              dueDate: null,
              status: 'OPEN',
              completedAt: null,
              createdAt: new Date('2026-09-02T00:00:00.000Z'),
              updatedAt: new Date('2026-09-02T00:00:00.000Z'),
            },
          ],
        });

      const result = await organizationalBarrierService.getBarrierById('barrier-1', 'user-1');

      expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-9', userId: 'user-1' },
        select: { role: true },
      });
      expect(result.actions).toHaveLength(1);
      expect(result.actions?.[0]).toMatchObject({
        description: 'Ask the vendor for the licence',
        ownerName: 'Ada Lovelace',
      });
    });

    it('should report a barrier that vanished between the stub read and the detail read', async () => {
      asMock(prisma.organizationalBarrier.findUnique)
        .mockResolvedValueOnce({
          id: 'barrier-1',
          teamId: 'team-1',
          title: bar.title,
          status: 'OPEN',
          resolvedAt: null,
        })
        .mockResolvedValueOnce(null);

      await expect(
        organizationalBarrierService.getBarrierById('barrier-1', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('createBarrier', () => {
    it('should refuse a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        organizationalBarrierService.createBarrier('user-1', {
          teamId: 'team-1',
          title: 'Barrier',
          description: 'Description',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY });
      expect(prisma.organizationalBarrier.create).not.toHaveBeenCalled();
    });

    it('should refuse an owner who is not a user of the installation', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.createBarrier('sm-1', {
          teamId: 'team-1',
          title: 'Barrier',
          description: 'Description',
          ownerId: 'nobody',
        })
      ).rejects.toThrow(BadRequestError);
      expect(prisma.organizationalBarrier.create).not.toHaveBeenCalled();
    });

    it('should raise a barrier and notify its owner', async () => {
      asMock(prisma.organizationalBarrier.create).mockResolvedValue(bar);

      const result = await organizationalBarrierService.createBarrier('sm-1', {
        teamId: 'team-1',
        title: 'Procurement takes six weeks',
        description: 'We cannot ship without a signed licence.',
        priority: 'HIGH',
        ownerId: 'owner-1',
      });

      expect(prisma.organizationalBarrier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'test-uuid',
            teamId: 'team-1',
            priority: 'HIGH',
            ownerId: 'owner-1',
            raisedById: 'sm-1',
            status: 'OPEN',
          }),
        })
      );
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'owner-1',
            type: 'ORGANIZATIONAL_BARRIER',
          }),
        })
      );
      expect(auditResourceEvent).toHaveBeenCalledWith(
        'TEAM',
        'CREATE',
        'SUCCESS',
        expect.objectContaining({ type: 'ORGANIZATIONAL_BARRIER', id: 'barrier-1' }),
        expect.objectContaining({ teamId: 'team-1' })
      );
      expect(result.id).toBe('barrier-1');
    });

    it('should not notify the owner when the owner is the caller', async () => {
      asMock(prisma.organizationalBarrier.create).mockResolvedValue({ ...bar, ownerId: 'sm-1' });

      await organizationalBarrierService.createBarrier('sm-1', {
        teamId: 'team-1',
        title: 'Barrier',
        description: 'Description',
        ownerId: 'sm-1',
      });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should raise a barrier that names no owner', async () => {
      asMock(prisma.organizationalBarrier.create).mockResolvedValue({
        ...bar,
        ownerId: null,
        owner: null,
      });

      const result = await organizationalBarrierService.createBarrier('sm-1', {
        teamId: 'team-1',
        title: 'Barrier',
        description: 'Description',
      });

      expect(prisma.organizationalBarrier.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ownerId: null }) })
      );
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(result.ownerName).toBeNull();
    });

    it('should anchor a Date target date as given', async () => {
      asMock(prisma.organizationalBarrier.create).mockResolvedValue(bar);

      await organizationalBarrierService.createBarrier('sm-1', {
        teamId: 'team-1',
        title: 'Barrier',
        description: 'Description',
        targetDate: new Date('2026-10-01T00:00:00.000Z'),
      });

      expect(prisma.organizationalBarrier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ targetDate: new Date('2026-10-01T00:00:00.000Z') }),
        })
      );
    });

    it('should refuse a target date that is not a real date', async () => {
      await expect(
        organizationalBarrierService.createBarrier('sm-1', {
          teamId: 'team-1',
          title: 'Barrier',
          description: 'Description',
          targetDate: 'not-a-date',
        })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.organizationalBarrier.create).not.toHaveBeenCalled();
    });

    it('should serialize a barrier with no recorded raiser', async () => {
      asMock(prisma.organizationalBarrier.create).mockResolvedValue({
        ...bar,
        raisedBy: null,
        raisedById: 'sm-1',
      });

      const result = await organizationalBarrierService.createBarrier('sm-1', {
        teamId: 'team-1',
        title: 'Barrier',
        description: 'Description',
      });

      expect(result.raisedByName).toBeNull();
    });
  });

  describe('escalateImpediment', () => {
    const impediment = {
      id: 'imp-1',
      teamId: 'team-1',
      title: 'Procurement takes six weeks',
      description: 'We cannot ship without a signed licence.',
      priority: 'HIGH',
      ownerId: 'owner-1',
      escalatedBarrier: null,
    };

    beforeEach(() => {
      asMock(prisma.impediment.findUnique).mockResolvedValue(impediment);
      asMock(prisma.organizationalBarrier.create).mockResolvedValue({
        ...bar,
        sourceImpedimentId: 'imp-1',
        sourceImpediment: { id: 'imp-1', title: impediment.title },
      });
      asMock(prisma.impediment.update).mockResolvedValue({ id: 'imp-1' });
    });

    it('should throw NotFoundError when the impediment does not exist', async () => {
      asMock(prisma.impediment.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.escalateImpediment('sm-1', {
          teamId: 'team-1',
          impedimentId: 'missing',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse to escalate another team impediment', async () => {
      asMock(prisma.impediment.findUnique).mockResolvedValue({
        ...impediment,
        teamId: 'team-2',
      });

      await expect(
        organizationalBarrierService.escalateImpediment('sm-1', {
          teamId: 'team-1',
          impedimentId: 'imp-1',
        })
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_SOURCE_NOT_OF_TEAM,
      });
      expect(prisma.organizationalBarrier.create).not.toHaveBeenCalled();
    });

    it('should refuse a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        organizationalBarrierService.escalateImpediment('user-1', {
          teamId: 'team-1',
          impedimentId: 'imp-1',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY });
    });

    it('should refuse to escalate an impediment that already has a barrier', async () => {
      asMock(prisma.impediment.findUnique).mockResolvedValue({
        ...impediment,
        escalatedBarrier: { id: 'barrier-1', title: 'Procurement takes six weeks' },
      });

      await expect(
        organizationalBarrierService.escalateImpediment('sm-1', {
          teamId: 'team-1',
          impedimentId: 'imp-1',
        })
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED,
      });
      expect(prisma.organizationalBarrier.create).not.toHaveBeenCalled();
    });

    it('should link the barrier and stamp the impediment in one transaction', async () => {
      const result = await organizationalBarrierService.escalateImpediment('sm-1', {
        teamId: 'team-1',
        impedimentId: 'imp-1',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.organizationalBarrier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceImpedimentId: 'imp-1',
            teamId: 'team-1',
            title: 'Procurement takes six weeks',
            description: 'We cannot ship without a signed licence.',
            priority: 'HIGH',
            ownerId: 'owner-1',
          }),
        })
      );
      expect(prisma.impediment.update).toHaveBeenCalledWith({
        where: { id: 'imp-1' },
        data: {
          escalatedAt: expect.any(Date),
          escalationCount: { increment: 1 },
          updatedBy: 'sm-1',
        },
      });
      expect(result.sourceImpedimentId).toBe('imp-1');
      expect(result.sourceImpedimentTitle).toBe('Procurement takes six weeks');
    });

    it('should answer a racing double escalation with the barrier that won', async () => {
      asMock(prisma.impediment.update).mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' })
      );
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue({
        title: 'Procurement takes six weeks',
      });

      await expect(
        organizationalBarrierService.escalateImpediment('sm-1', {
          teamId: 'team-1',
          impedimentId: 'imp-1',
        })
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED,
      });
      expect(prisma.organizationalBarrier.findUnique).toHaveBeenCalledWith({
        where: { sourceImpedimentId: 'imp-1' },
        select: { title: true },
      });
    });

    it('should fall back to the impediment title when the racing winner cannot be re-read', async () => {
      asMock(prisma.impediment.update).mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' })
      );
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.escalateImpediment('sm-1', {
          teamId: 'team-1',
          impedimentId: 'imp-1',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED });
    });

    it('should rethrow an unexpected escalation failure', async () => {
      const boom = new Error('boom');
      asMock(prisma.impediment.update).mockRejectedValue(boom);

      await expect(
        organizationalBarrierService.escalateImpediment('sm-1', {
          teamId: 'team-1',
          impedimentId: 'imp-1',
        })
      ).rejects.toBe(boom);
    });
  });

  describe('updateBarrier', () => {
    beforeEach(() => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue({
        id: 'barrier-1',
        teamId: 'team-1',
        title: bar.title,
        status: 'OPEN',
        resolvedAt: null,
      });
      asMock(prisma.organizationalBarrier.update).mockResolvedValue(bar);
    });

    it('should throw NotFoundError when the barrier does not exist', async () => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.updateBarrier('missing', 'sm-1', { title: 'x' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        organizationalBarrierService.updateBarrier('barrier-1', 'user-1', { status: 'OPEN' })
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY });
      expect(prisma.organizationalBarrier.update).not.toHaveBeenCalled();
    });

    it('should refuse a terminal status without a written resolution', async () => {
      await expect(
        organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', { status: 'RESOLVED' })
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED,
      });
      expect(prisma.organizationalBarrier.update).not.toHaveBeenCalled();
    });

    it('should refuse a terminal status with a blank resolution', async () => {
      await expect(
        organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', {
          status: 'CLOSED',
          resolution: '   ',
        })
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED,
      });
    });

    it('should stamp the resolution date when the barrier is resolved', async () => {
      await organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', {
        status: 'RESOLVED',
        resolution: 'The licence was signed on 20 September.',
      });

      expect(prisma.organizationalBarrier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolution: 'The licence was signed on 20 September.',
            resolvedAt: expect.any(Date),
            updatedBy: 'sm-1',
          }),
        })
      );
      expect(auditResourceEvent).toHaveBeenCalled();
    });

    it('should clear the resolution date when a barrier is reopened', async () => {
      await organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', { status: 'OPEN' });

      expect(prisma.organizationalBarrier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'OPEN', resolvedAt: null }),
        })
      );
    });

    it('should refuse an unknown owner', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', { ownerId: 'nobody' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should apply every amendable field in one write', async () => {
      asMock(prisma.organizationalBarrier.update).mockResolvedValue({
        ...bar,
        status: 'RESOLVED',
        resolvedAt: new Date('2026-09-20T00:00:00.000Z'),
      });

      await organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', {
        title: 'New title',
        description: 'New description',
        status: 'RESOLVED',
        resolution: 'Resolved by negotiation.',
        ownerId: 'owner-1',
        priority: 'LOW',
        targetDate: '2026-10-10',
      });

      expect(prisma.organizationalBarrier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New title',
            description: 'New description',
            status: 'RESOLVED',
            resolution: 'Resolved by negotiation.',
            ownerId: 'owner-1',
            priority: 'LOW',
            targetDate: new Date('2026-10-10T00:00:00.000Z'),
            resolvedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should leave the resolution state untouched when no status is given', async () => {
      await organizationalBarrierService.updateBarrier('barrier-1', 'sm-1', {
        title: 'Only the title',
      });

      const [arg] = asMock(prisma.organizationalBarrier.update).mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(arg.data).not.toHaveProperty('resolvedAt');
      expect(arg.data).not.toHaveProperty('status');
    });
  });

  describe('deleteBarrier', () => {
    it('should refuse a member who is not the Scrum Master', async () => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue({
        id: 'barrier-1',
        teamId: 'team-1',
        title: bar.title,
        status: 'OPEN',
        resolvedAt: null,
      });
      callerIsDeveloper();

      await expect(
        organizationalBarrierService.deleteBarrier('barrier-1', 'user-1')
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY });
      expect(prisma.organizationalBarrier.delete).not.toHaveBeenCalled();
    });

    it('should delete the barrier and audit it', async () => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue({
        id: 'barrier-1',
        teamId: 'team-1',
        title: bar.title,
        status: 'OPEN',
        resolvedAt: null,
      });
      asMock(prisma.organizationalBarrier.delete).mockResolvedValue(bar);

      const result = await organizationalBarrierService.deleteBarrier('barrier-1', 'sm-1');

      expect(result).toEqual({ id: 'barrier-1' });
      expect(auditResourceEvent).toHaveBeenCalledWith(
        'TEAM',
        'DELETE',
        'SUCCESS',
        expect.objectContaining({ type: 'ORGANIZATIONAL_BARRIER', id: 'barrier-1' }),
        expect.objectContaining({ teamId: 'team-1' })
      );
    });
  });

  describe('stakeholder actions', () => {
    const action = {
      id: 'action-1',
      barrierId: 'barrier-1',
      description: 'Ask the vendor for the licence',
      ownerId: 'owner-1',
      owner: { id: 'owner-1', firstName: 'Ada', lastName: 'Lovelace' },
      dueDate: null,
      status: 'OPEN',
      completedAt: null,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    };

    beforeEach(() => {
      asMock(prisma.organizationalBarrier.findUnique).mockResolvedValue({
        id: 'barrier-1',
        teamId: 'team-1',
        title: bar.title,
        status: 'OPEN',
        resolvedAt: null,
      });
    });

    it('should refuse an action from someone outside the team', async () => {
      callerIsDeveloper();

      await expect(
        organizationalBarrierService.addAction('barrier-1', 'user-1', {
          description: 'Ask the vendor',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY });
      expect(prisma.barrierStakeholderAction.create).not.toHaveBeenCalled();
    });

    it('should record an action with a due date', async () => {
      asMock(prisma.barrierStakeholderAction.create).mockResolvedValue(action);

      const result = await organizationalBarrierService.addAction('barrier-1', 'sm-1', {
        description: 'Ask the vendor for the licence',
        ownerId: 'owner-1',
        dueDate: '2026-09-30',
      });

      expect(prisma.barrierStakeholderAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            barrierId: 'barrier-1',
            status: 'OPEN',
            dueDate: new Date('2026-09-30T00:00:00.000Z'),
          }),
        })
      );
      expect(result.id).toBe('action-1');
    });

    it('should throw NotFoundError when the action does not exist', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue(null);

      await expect(
        organizationalBarrierService.updateAction('missing', 'sm-1', { status: 'DONE' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should stamp completion when an action is done and clear it when reopened', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue({
        ...action,
        barrier: { teamId: 'team-1' },
      });
      asMock(prisma.barrierStakeholderAction.update).mockResolvedValue({
        ...action,
        status: 'DONE',
      });

      await organizationalBarrierService.updateAction('action-1', 'sm-1', { status: 'DONE' });

      expect(prisma.barrierStakeholderAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DONE', completedAt: expect.any(Date) }),
        })
      );

      await organizationalBarrierService.updateAction('action-1', 'sm-1', { status: 'OPEN' });

      expect(prisma.barrierStakeholderAction.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'OPEN', completedAt: null }),
        })
      );
    });

    it('should refuse deleting an action of another team', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue({
        ...action,
        barrier: { teamId: 'team-9' },
      });
      callerIsNotAMember();

      await expect(
        organizationalBarrierService.deleteAction('action-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY });
      expect(prisma.barrierStakeholderAction.delete).not.toHaveBeenCalled();
    });

    it('should delete an action', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue({
        ...action,
        barrier: { teamId: 'team-1' },
      });
      asMock(prisma.barrierStakeholderAction.delete).mockResolvedValue(action);

      const result = await organizationalBarrierService.deleteAction('action-1', 'sm-1');

      expect(result).toEqual({ id: 'action-1' });
    });

    it('should throw NotFoundError when the action to delete does not exist', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue(null);

      await expect(organizationalBarrierService.deleteAction('missing', 'sm-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should record an action that names no owner', async () => {
      asMock(prisma.barrierStakeholderAction.create).mockResolvedValue({
        ...action,
        ownerId: null,
        owner: null,
      });

      const result = await organizationalBarrierService.addAction('barrier-1', 'sm-1', {
        description: 'Ask the vendor',
      });

      expect(prisma.barrierStakeholderAction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ownerId: null }) })
      );
      expect(result.ownerName).toBeNull();
    });

    it('should stamp the due date and completion of a returned action when recorded', async () => {
      asMock(prisma.barrierStakeholderAction.create).mockResolvedValue({
        ...action,
        dueDate: new Date('2026-09-30T00:00:00.000Z'),
        completedAt: new Date('2026-09-29T00:00:00.000Z'),
      });

      const result = await organizationalBarrierService.addAction('barrier-1', 'sm-1', {
        description: 'Ask the vendor',
        dueDate: '2026-09-30',
      });

      expect(result.dueDate).toBe('2026-09-30T00:00:00.000Z');
      expect(result.completedAt).toBe('2026-09-29T00:00:00.000Z');
    });

    it('should amend every action field and stamp completion when it is done', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue({
        ...action,
        barrier: { teamId: 'team-1' },
      });
      asMock(prisma.barrierStakeholderAction.update).mockResolvedValue({
        ...action,
        status: 'DONE',
        completedAt: new Date('2026-09-29T00:00:00.000Z'),
      });

      await organizationalBarrierService.updateAction('action-1', 'sm-1', {
        description: 'Updated description',
        status: 'DONE',
        ownerId: 'owner-1',
        dueDate: '2026-10-01',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'owner-1' },
        select: { id: true },
      });
      expect(prisma.barrierStakeholderAction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Updated description',
            status: 'DONE',
            ownerId: 'owner-1',
            dueDate: new Date('2026-10-01T00:00:00.000Z'),
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should leave completion untouched when no action status is given', async () => {
      asMock(prisma.barrierStakeholderAction.findUnique).mockResolvedValue({
        ...action,
        barrier: { teamId: 'team-1' },
      });
      asMock(prisma.barrierStakeholderAction.update).mockResolvedValue(action);

      await organizationalBarrierService.updateAction('action-1', 'sm-1', {
        description: 'Only the description',
      });

      const [arg] = asMock(prisma.barrierStakeholderAction.update).mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(arg.data).not.toHaveProperty('completedAt');
      expect(arg.data).not.toHaveProperty('status');
    });
  });

  describe('getEscalatableImpediments', () => {
    it('should refuse the list for someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        organizationalBarrierService.getEscalatableImpediments('team-1', 'outsider')
      ).rejects.toMatchObject({
        code: GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
      });
      expect(prisma.impediment.findMany).not.toHaveBeenCalled();
    });

    it('should report escalation state as one field, not a query per row', async () => {
      asMock(prisma.impediment.findMany).mockResolvedValue([
        {
          id: 'imp-1',
          title: 'Blocked',
          description: 'Blocked',
          priority: 'HIGH',
          ownerId: null,
          escalatedBarrier: { id: 'barrier-1', title: 'Procurement' },
        },
        {
          id: 'imp-2',
          title: 'Still internal',
          description: 'Still internal',
          priority: 'LOW',
          ownerId: 'owner-1',
          escalatedBarrier: null,
        },
      ]);

      const result = await organizationalBarrierService.getEscalatableImpediments('team-1', 'sm-1');

      expect(prisma.impediment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.impediment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'team-1', status: { in: ['OPEN', 'IN_PROGRESS'] } },
        })
      );
      expect(result[0]).toMatchObject({
        escalatedBarrierId: 'barrier-1',
        escalatedBarrierTitle: 'Procurement',
      });
      expect(result[1]).toMatchObject({ escalatedBarrierId: null });
    });
  });
});
