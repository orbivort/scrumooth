import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    workingAgreement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('agreement-uuid'),
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  AuditEventTypes: { TEAM: 'TEAM' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

import { workingAgreementService } from '../../../services/workingAgreement.service';
import prisma from '../../../utils/prisma';
import { auditResourceEvent } from '../../../utils/auditLogger';
import { NotFoundError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const callerIsTeamMember = (role: string) =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role });
const callerIsNotAMember = () => asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

const agreement = {
  id: 'agreement-1',
  teamId: 'team-1',
  title: 'No meetings before 10:00',
  description: 'The team keeps the morning for focused work.',
  status: 'ACTIVE',
  agreedAt: new Date('2026-09-01T08:00:00.000Z'),
  retiredAt: null,
  createdBy: 'dev-1',
  updatedBy: 'dev-1',
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
  updatedAt: new Date('2026-09-01T08:00:00.000Z'),
};

describe('WorkingAgreementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsTeamMember('DEVELOPERS');
    asMock(prisma.user.findMany).mockResolvedValue([
      { id: 'dev-1', firstName: 'Ada', lastName: 'Lovelace' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getWorkingAgreements', () => {
    it('should refuse the agreements to someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        workingAgreementService.getWorkingAgreements('team-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY });
      expect(prisma.workingAgreement.findMany).not.toHaveBeenCalled();
    });

    it('should name the authors in one lookup rather than one per row', async () => {
      asMock(prisma.workingAgreement.findMany).mockResolvedValue([
        agreement,
        { ...agreement, id: 'agreement-2' },
      ]);

      const result = await workingAgreementService.getWorkingAgreements('team-1', 'dev-1');

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        title: 'No meetings before 10:00',
        createdByName: 'Ada Lovelace',
        status: 'ACTIVE',
        retiredAt: null,
      });
    });

    it('should list a team member of any role', async () => {
      callerIsTeamMember('PRODUCT_OWNER');
      asMock(prisma.workingAgreement.findMany).mockResolvedValue([]);

      await expect(workingAgreementService.getWorkingAgreements('team-1', 'po-1')).resolves.toEqual(
        []
      );
    });
  });

  describe('createWorkingAgreement', () => {
    it('should let any team member record an agreement', async () => {
      asMock(prisma.workingAgreement.create).mockResolvedValue(agreement);

      const result = await workingAgreementService.createWorkingAgreement('dev-1', {
        teamId: 'team-1',
        title: agreement.title,
        description: agreement.description,
      });

      expect(prisma.workingAgreement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'agreement-uuid',
            teamId: 'team-1',
            status: 'ACTIVE',
            createdBy: 'dev-1',
          }),
        })
      );
      expect(auditResourceEvent).toHaveBeenCalled();
      expect(result.id).toBe('agreement-1');
    });

    it('should refuse an agreement from someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        workingAgreementService.createWorkingAgreement('outsider', {
          teamId: 'team-1',
          title: 'x',
          description: 'y',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY });
      expect(prisma.workingAgreement.create).not.toHaveBeenCalled();
    });
  });

  describe('updateWorkingAgreement', () => {
    beforeEach(() => {
      asMock(prisma.workingAgreement.findUnique).mockResolvedValue({
        id: 'agreement-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        retiredAt: null,
      });
    });

    it('should throw NotFoundError when the agreement does not exist', async () => {
      asMock(prisma.workingAgreement.findUnique).mockResolvedValue(null);

      await expect(
        workingAgreementService.updateWorkingAgreement('missing', 'dev-1', { title: 'x' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse an amendment from someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        workingAgreementService.updateWorkingAgreement('agreement-1', 'outsider', { title: 'x' })
      ).rejects.toMatchObject({ code: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY });
      expect(prisma.workingAgreement.update).not.toHaveBeenCalled();
    });

    it('should retire an agreement with a timestamp rather than deleting it', async () => {
      asMock(prisma.workingAgreement.update).mockResolvedValue({
        ...agreement,
        status: 'RETIRED',
        retiredAt: new Date('2026-09-20T00:00:00.000Z'),
      });

      await workingAgreementService.updateWorkingAgreement('agreement-1', 'dev-1', {
        status: 'RETIRED',
      });

      expect(prisma.workingAgreement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RETIRED', retiredAt: expect.any(Date) }),
        })
      );
    });

    it('should clear the retirement timestamp when an agreement is reactivated', async () => {
      asMock(prisma.workingAgreement.findUnique).mockResolvedValue({
        id: 'agreement-1',
        teamId: 'team-1',
        status: 'RETIRED',
        retiredAt: new Date('2026-09-20T00:00:00.000Z'),
      });
      asMock(prisma.workingAgreement.update).mockResolvedValue(agreement);

      await workingAgreementService.updateWorkingAgreement('agreement-1', 'dev-1', {
        status: 'ACTIVE',
      });

      expect(prisma.workingAgreement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE', retiredAt: null }),
        })
      );
    });
  });
});
