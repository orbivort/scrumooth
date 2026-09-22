import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    definitionOfDone: {
      findUnique: vi.fn(),
    },
    doDChecklistVerification: {
      findMany: vi.fn(),
    },
    increment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    incrementPBI: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    productBacklogItem: {
      findMany: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
    },
    sprintBacklogItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    sprintReview: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
    },
    team: {
      // A team is not in a group unless a test puts it in one, so a Definition of Done resolves to
      // the team's own row by default.
      findUnique: vi.fn().mockResolvedValue({ groupId: null }),
    },
  },
}));

vi.mock('../../../services/incrementIntegration.service', () => ({
  incrementIntegrationService: {
    verifyIntegration: vi.fn(),
    refreshVerificationStatus: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// Now import the service and other dependencies
import { incrementService } from '../../../services/increment.service';
import { incrementIntegrationService } from '../../../services/incrementIntegration.service';
import prisma from '../../../utils/prisma';
import { NotFoundError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const USER_ID = 'user-123';
const TEAM_ID = 'team-1';

/** The caller belongs to the Increment's team unless a test says otherwise. */
function mockMembership(): void {
  vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ id: 'membership-1' } as never);
}

function mockNoMembership(): void {
  vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);
}

/** A team with one active Definition of Done item, fully verified for the given items. */
function mockEligibleDoD(verifiedPbiIds: string[] = ['pbi-1']): void {
  vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
    items: [{ id: 'dod-item-1' }],
  } as never);
  vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue(
    verifiedPbiIds.map((pbiId) => ({ pbiId, dodItemId: 'dod-item-1' })) as never
  );
}

describe('IncrementService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembership();
    vi.mocked(incrementIntegrationService.verifyIntegration).mockResolvedValue({
      integrationVerified: true,
      priorCount: 0,
      allPassed: true,
    } as never);
    vi.mocked(incrementIntegrationService.refreshVerificationStatus).mockResolvedValue(undefined);
    vi.mocked(prisma.incrementPBI.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.incrementPBI.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.increment.update).mockResolvedValue({} as never);
  });

  describe('team membership', () => {
    it('should refuse to read a team’s increments for an outsider', async () => {
      mockNoMembership();

      await expect(
        incrementService.getIncrements(TEAM_ID, undefined, USER_ID)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.increment.findMany).not.toHaveBeenCalled();
    });

    it('should refuse to read an Increment for an outsider', async () => {
      mockNoMembership();
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({ teamId: TEAM_ID } as never);

      await expect(incrementService.getIncrementById('increment-1', USER_ID)).rejects.toMatchObject(
        {
          statusCode: 403,
          code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
        }
      );
    });

    it('should refuse to create an Increment in a team the caller does not belong to', async () => {
      mockNoMembership();

      await expect(
        incrementService.createIncrement(USER_ID, {
          name: 'Outside Increment',
          sprintId: 'sprint-1',
          teamId: TEAM_ID,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.increment.create).not.toHaveBeenCalled();
    });

    it('should refuse to deliver an Increment of another team', async () => {
      mockNoMembership();
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
      } as never);

      await expect(
        incrementService.deliverIncrement('increment-1', USER_ID, 'sprint_review')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should refuse to attest usability on another team’s Increment', async () => {
      mockNoMembership();
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
      } as never);

      await expect(
        incrementService.attestUsability('increment-1', USER_ID, 'Works on staging')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });
    });
  });

  describe('getIncrements', () => {
    it('should return increments for a team', async () => {
      const mockIncrements = [
        {
          id: 'increment-1',
          name: 'Increment 1',
          teamId: TEAM_ID,
          sprintId: 'sprint-1',
          status: 'DRAFT',
          sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'ACTIVE' },
          pbis: [
            {
              pbiId: 'pbi-1',
              pbi: { id: 'pbi-1', title: 'PBI 1', storyPoints: 5, status: 'DONE', labels: [] },
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.increment.findMany).mockResolvedValue(mockIncrements as never);

      const result = await incrementService.getIncrements(TEAM_ID, undefined, USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Increment 1');
      expect(result[0]!.includedPBIs).toEqual(['pbi-1']);
      expect(prisma.increment.findMany).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by sprintId when provided', async () => {
      vi.mocked(prisma.increment.findMany).mockResolvedValue([]);

      await incrementService.getIncrements(TEAM_ID, 'sprint-1', USER_ID);

      expect(prisma.increment.findMany).toHaveBeenCalledWith({
        where: { teamId: TEAM_ID, sprintId: 'sprint-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getIncrementById', () => {
    it('should return increment by ID', async () => {
      const mockIncrement = {
        id: 'increment-1',
        name: 'Increment 1',
        teamId: TEAM_ID,
        sprintId: 'sprint-1',
        status: 'DRAFT',
        totalStoryPoints: 10,
        sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'ACTIVE' },
        pbis: [
          {
            pbiId: 'pbi-1',
            pbi: { id: 'pbi-1', title: 'PBI 1', storyPoints: 5, status: 'DONE', labels: [] },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.increment.findUnique).mockResolvedValue(mockIncrement as never);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([]);

      const result = await incrementService.getIncrementById('increment-1', USER_ID);

      expect(result.id).toBe('increment-1');
      expect(result.includedPBIs).toEqual(['pbi-1']);
      expect(result.dodVerifications).toEqual([]);
    });

    it('should throw NotFoundError when increment does not exist', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(null as never);

      await expect(incrementService.getIncrementById('non-existent-id', USER_ID)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createIncrement', () => {
    function mockCreateDependencies(): void {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: TEAM_ID,
        name: 'Sprint 1',
        status: 'ACTIVE',
      } as never);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([
        { id: 'pbi-1' },
        { id: 'pbi-2' },
      ] as never);
      vi.mocked(prisma.increment.create).mockResolvedValue({ id: 'test-uuid' } as never);
      vi.mocked(prisma.incrementPBI.findMany).mockResolvedValue([
        { pbi: { storyPoints: 5 } },
        { pbi: { storyPoints: 8 } },
      ] as never);
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        name: 'New Increment',
        teamId: TEAM_ID,
        sprintId: 'sprint-1',
        status: 'DRAFT',
        sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'ACTIVE' },
        pbis: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([]);
    }

    it('should create a draft increment and derive its story points from its items', async () => {
      mockCreateDependencies();

      const result = await incrementService.createIncrement(USER_ID, {
        name: 'New Increment',
        description: 'Description',
        sprintId: 'sprint-1',
        teamId: TEAM_ID,
        includedPBIs: ['pbi-1', 'pbi-2'],
      });

      expect(result.name).toBe('New Increment');
      expect(prisma.increment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'test-uuid',
          name: 'New Increment',
          description: 'Description',
          sprintId: 'sprint-1',
          teamId: TEAM_ID,
          totalStoryPoints: 0,
          status: 'DRAFT',
          createdBy: USER_ID,
        }),
      });
      expect(prisma.incrementPBI.createMany).toHaveBeenCalledWith({
        data: [
          { id: 'test-uuid', incrementId: 'test-uuid', pbiId: 'pbi-1', createdBy: USER_ID },
          { id: 'test-uuid', incrementId: 'test-uuid', pbiId: 'pbi-2', createdBy: USER_ID },
        ],
      });
      // The caller cannot declare the total: it is derived from the items the Increment holds.
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'test-uuid' },
        data: { totalStoryPoints: 13 },
      });
    });

    it('should always create a DRAFT, whatever status the caller asks for', async () => {
      mockCreateDependencies();

      await incrementService.createIncrement(USER_ID, {
        name: 'New Increment',
        sprintId: 'sprint-1',
        teamId: TEAM_ID,
        includedPBIs: [],
        status: 'VERIFIED',
      });

      expect(prisma.increment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'DRAFT' }),
      });
    });

    it('should mark the verification of the team’s first Increment through the integration service', async () => {
      mockCreateDependencies();

      await incrementService.createIncrement(USER_ID, {
        name: 'New Increment',
        sprintId: 'sprint-1',
        teamId: TEAM_ID,
        includedPBIs: [],
      });

      // The basis (exemption vs. verified against priors) must be recorded, not just the flag.
      expect(incrementIntegrationService.verifyIntegration).toHaveBeenCalledWith(
        USER_ID,
        'test-uuid'
      );
    });

    it('should throw NotFoundError when sprint does not exist', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as never);

      await expect(
        incrementService.createIncrement(USER_ID, {
          name: 'New Increment',
          sprintId: 'non-existent-sprint',
          teamId: TEAM_ID,
          includedPBIs: [],
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a Sprint that belongs to another team', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'other-team',
      } as never);

      await expect(
        incrementService.createIncrement(USER_ID, {
          name: 'New Increment',
          sprintId: 'sprint-1',
          teamId: TEAM_ID,
          includedPBIs: [],
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.increment.create).not.toHaveBeenCalled();
    });

    it('should refuse items that belong to another team’s Product Backlog', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: TEAM_ID,
      } as never);
      // One of the two requested items is not part of this team's backlog.
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([{ id: 'pbi-1' }] as never);

      await expect(
        incrementService.createIncrement(USER_ID, {
          name: 'New Increment',
          sprintId: 'sprint-1',
          teamId: TEAM_ID,
          includedPBIs: ['pbi-1', 'pbi-other-team'],
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.increment.create).not.toHaveBeenCalled();
    });
  });

  describe('updateIncrement', () => {
    it('should update an increment', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        name: 'Old Name',
        status: 'DRAFT',
      } as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1', name: 'New Name' } as never);

      const result = await incrementService.updateIncrement('increment-1', USER_ID, {
        name: 'New Name',
        description: 'New Description',
      });

      expect(result.name).toBe('New Name');
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-1' },
        data: {
          updatedBy: USER_ID,
          name: 'New Name',
          description: 'New Description',
        },
      });

      mockLoad.mockRestore();
    });

    it('should throw NotFoundError when increment does not exist', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(null as never);

      await expect(
        incrementService.updateIncrement('non-existent-id', USER_ID, { name: 'New Name' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse with GATE_INCREMENT_LOCKED when the increment is already delivered', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DELIVERED',
      } as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, { name: 'New Name' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_LOCKED,
      });
    });

    it('should refuse with GATE_INCREMENT_LOCKED when the increment was archived', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'ARCHIVED',
      } as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, { status: 'DRAFT' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_LOCKED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should refuse writing DELIVERED through the update path', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'VERIFIED',
      } as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, { status: 'DELIVERED' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should refuse VERIFIED while the integration with prior Increments has not passed', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: false,
        usabilityVerified: true,
      } as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, { status: 'VERIFIED' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should refuse VERIFIED before the usable condition is attested', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: true,
        usabilityVerified: false,
      } as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, { status: 'VERIFIED' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should allow VERIFIED once integration and usability are both established', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: true,
        usabilityVerified: true,
      } as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1', status: 'VERIFIED' } as never);

      const result = await incrementService.updateIncrement('increment-1', USER_ID, {
        status: 'VERIFIED',
      });

      expect(result.status).toBe('VERIFIED');
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-1' },
        data: { updatedBy: USER_ID, status: 'VERIFIED' },
      });

      mockLoad.mockRestore();
    });

    it('should clear both verifications when the contents change', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: true,
        usabilityVerified: true,
      } as never);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([{ id: 'pbi-9' }] as never);
      // The Increment previously held a different item, then the recomputed total is read back.
      vi.mocked(prisma.incrementPBI.findMany)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }] as never)
        .mockResolvedValueOnce([{ pbi: { storyPoints: 5 } }] as never);
      vi.mocked(prisma.incrementPBI.createMany).mockResolvedValue({ count: 1 } as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1' } as never);

      await incrementService.updateIncrement('increment-1', USER_ID, {
        includedPBIs: ['pbi-9'],
      });

      // Evidence about one set of work says nothing about another set.
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-1' },
        data: expect.objectContaining({
          usabilityVerified: false,
          usabilityEvidence: null,
          usabilityVerifiedAt: null,
          usabilityVerifiedBy: null,
          integrationVerified: false,
          integrationVerificationBasis: null,
          integrationVerifiedPriorCount: 0,
        }),
      });

      mockLoad.mockRestore();
    });

    it('should keep the verifications when the same contents are re-saved', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: true,
        usabilityVerified: true,
      } as never);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([
        { id: 'pbi-1' },
        { id: 'pbi-2' },
      ] as never);
      vi.mocked(prisma.incrementPBI.findMany)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }, { pbiId: 'pbi-2' }] as never)
        .mockResolvedValueOnce([{ pbi: { storyPoints: 5 } }, { pbi: { storyPoints: 8 } }] as never);
      vi.mocked(prisma.incrementPBI.createMany).mockResolvedValue({ count: 2 } as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1' } as never);

      await incrementService.updateIncrement('increment-1', USER_ID, {
        includedPBIs: ['pbi-2', 'pbi-1'],
      });

      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]![0];
      expect(updateCall.data).not.toHaveProperty('usabilityVerified');

      mockLoad.mockRestore();
    });

    it('should refuse items that belong to another team’s Product Backlog', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
      } as never);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([] as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, { includedPBIs: ['pbi-other'] })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should return a VERIFIED Increment to DRAFT when its contents change', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'VERIFIED',
        integrationVerified: true,
        usabilityVerified: true,
      } as never);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([{ id: 'pbi-9' }] as never);
      vi.mocked(prisma.incrementPBI.findMany)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }] as never)
        .mockResolvedValueOnce([{ pbi: { storyPoints: 5 } }] as never);
      vi.mocked(prisma.incrementPBI.createMany).mockResolvedValue({ count: 1 } as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1' } as never);

      await incrementService.updateIncrement('increment-1', USER_ID, { includedPBIs: ['pbi-9'] });

      // A verified label with no evidence behind it is the state the gate exists to forbid, so the
      // Increment drops back to draft and the team re-verifies the composition it now holds.
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-1' },
        data: expect.objectContaining({
          status: 'DRAFT',
          usabilityVerified: false,
          integrationVerified: false,
        }),
      });

      mockLoad.mockRestore();
    });

    it('should refuse VERIFIED in the same call that changes the contents', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: true,
        usabilityVerified: true,
      } as never);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([{ id: 'pbi-9' }] as never);
      vi.mocked(prisma.incrementPBI.findMany).mockResolvedValue([{ pbiId: 'pbi-1' }] as never);

      await expect(
        incrementService.updateIncrement('increment-1', USER_ID, {
          includedPBIs: ['pbi-9'],
          status: 'VERIFIED',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });
  });

  describe('attestUsability', () => {
    it('should record the evidence, the author and the moment', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
      } as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1', usabilityVerified: true } as never);

      await incrementService.attestUsability(
        'increment-1',
        USER_ID,
        'Deployed to staging and exercised by the Product Owner'
      );

      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-1' },
        data: {
          usabilityVerified: true,
          usabilityEvidence: 'Deployed to staging and exercised by the Product Owner',
          usabilityVerifiedAt: expect.any(Date),
          usabilityVerifiedBy: USER_ID,
          updatedBy: USER_ID,
        },
      });

      mockLoad.mockRestore();
    });

    it('should refuse to attest a delivered or archived Increment', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'ARCHIVED',
      } as never);

      await expect(
        incrementService.attestUsability('increment-1', USER_ID, 'Evidence')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_LOCKED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when the Increment does not exist', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(null as never);

      await expect(
        incrementService.attestUsability('missing', USER_ID, 'Evidence')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deliverIncrement', () => {
    const deliverableIncrement = {
      id: 'increment-1',
      name: 'Increment 1',
      status: 'VERIFIED',
      sprintId: 'sprint-1',
      teamId: TEAM_ID,
      integrationVerified: true,
      usabilityVerified: true,
    };

    it('should deliver an increment and record who delivered it', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(deliverableIncrement as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({
        id: 'increment-1',
        status: 'DELIVERED',
        deliveryMethod: 'SPRINT_REVIEW',
      } as never);

      const result = await incrementService.deliverIncrement(
        'increment-1',
        USER_ID,
        'sprint_review',
        'Delivery notes'
      );

      expect(result.status).toBe('DELIVERED');
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-1' },
        data: {
          status: 'DELIVERED',
          deliveredAt: expect.any(Date),
          deliveryMethod: 'SPRINT_REVIEW',
          deliveredBy: USER_ID,
          notes: 'Delivery notes',
          updatedBy: USER_ID,
        },
      });

      mockLoad.mockRestore();
    });

    it('should NOT auto-create a sprint review when delivering via sprint_review', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(deliverableIncrement as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1', status: 'DELIVERED' } as never);

      await incrementService.deliverIncrement('increment-1', USER_ID, 'sprint_review');

      // The Sprint Review is an explicit inspection event: delivering an Increment (even via
      // `sprint_review`) must never auto-create one.
      expect(prisma.sprintReview.findUnique).not.toHaveBeenCalled();
      expect(prisma.sprint.findUnique).not.toHaveBeenCalled();

      mockLoad.mockRestore();
    });

    it('should not auto-create sprint review for early_release delivery', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(deliverableIncrement as never);

      const mockLoad = vi.spyOn(incrementService, 'loadIncrementDetail');
      mockLoad.mockResolvedValue({ id: 'increment-1', status: 'DELIVERED' } as never);

      await incrementService.deliverIncrement('increment-1', USER_ID, 'early_release');

      expect(prisma.sprintReview.findUnique).not.toHaveBeenCalled();

      mockLoad.mockRestore();
    });

    it('should throw NotFoundError when increment does not exist', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(null as never);

      await expect(
        incrementService.deliverIncrement('non-existent-id', USER_ID, 'sprint_review')
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse with GATE_INCREMENT_LOCKED when increment is already delivered', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DELIVERED',
      } as never);

      await expect(
        incrementService.deliverIncrement('increment-1', USER_ID, 'sprint_review')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_LOCKED,
      });
    });

    it('should refuse delivering an archived Increment', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'ARCHIVED',
      } as never);

      await expect(
        incrementService.deliverIncrement('increment-1', USER_ID, 'sprint_review')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_LOCKED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should refuse delivering before integration with prior Increments has passed', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'DRAFT',
        integrationVerified: false,
        usabilityVerified: true,
      } as never);

      await expect(
        incrementService.deliverIncrement('increment-1', USER_ID, 'sprint_review')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it('should refuse delivering before the usable condition is attested', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValue({
        id: 'increment-1',
        teamId: TEAM_ID,
        status: 'VERIFIED',
        integrationVerified: true,
        usabilityVerified: false,
      } as never);

      await expect(
        incrementService.deliverIncrement('increment-1', USER_ID, 'sprint_review')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED,
      });

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });
  });

  describe('composeDonePBI', () => {
    it('should create the Sprint Increment and include the PBI when the first Done PBI arrives', async () => {
      const pbiId = 'pbi-1';
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-1',
        pbiId,
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'ACTIVE' },
      } as never);
      mockEligibleDoD();
      vi.mocked(prisma.increment.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.incrementPBI.findUnique).mockResolvedValue(null as never);

      const result = await incrementService.composeDonePBI(pbiId, USER_ID);

      expect(result).toEqual({ status: 'COMPOSED', incrementId: 'test-uuid' });
      // Only an open Increment (DRAFT/VERIFIED) may be reused.
      expect(prisma.increment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sprintId: 'sprint-1',
            status: { in: ['DRAFT', 'VERIFIED'] },
          }),
        })
      );
      expect(prisma.increment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sprintId: 'sprint-1',
            teamId: TEAM_ID,
            status: 'DRAFT',
            createdBy: USER_ID,
          }),
        })
      );
      expect(prisma.incrementPBI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ incrementId: 'test-uuid', pbiId }),
        })
      );
    });

    it('should add a subsequent Done PBI to the existing open Sprint Increment', async () => {
      const pbiId = 'pbi-2';
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-2',
        pbiId,
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'ACTIVE' },
      } as never);
      mockEligibleDoD([pbiId]);
      vi.mocked(prisma.increment.findFirst).mockResolvedValue({
        id: 'increment-existing',
        status: 'DRAFT',
        integrationVerified: false,
        usabilityVerified: false,
      } as never);
      vi.mocked(prisma.incrementPBI.findUnique).mockResolvedValue(null as never);

      const result = await incrementService.composeDonePBI(pbiId, USER_ID);

      expect(result).toEqual({ status: 'COMPOSED', incrementId: 'increment-existing' });
      expect(prisma.increment.create).not.toHaveBeenCalled();
      expect(prisma.incrementPBI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ incrementId: 'increment-existing', pbiId }),
        })
      );
    });

    it('should skip an item that no longer satisfies the active Definition of Done', async () => {
      const pbiId = 'pbi-1';
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-1',
        pbiId,
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'ACTIVE' },
      } as never);
      // One active DoD item, not verified for this item.
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'dod-item-1' }],
      } as never);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as never);

      const result = await incrementService.composeDonePBI(pbiId, USER_ID);

      expect(result.status).toBe('SKIPPED_ITEM_NOT_ELIGIBLE');
      expect(result.reason).toBeTruthy();
      expect(prisma.incrementPBI.create).not.toHaveBeenCalled();
      // Nothing is created for an item that cannot join an Increment.
      expect(prisma.increment.create).not.toHaveBeenCalled();
    });

    it('should skip an item whose team has no active Definition of Done item', async () => {
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-1',
        pbiId: 'pbi-1',
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'ACTIVE' },
      } as never);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({ items: [] } as never);

      const result = await incrementService.composeDonePBI('pbi-1', USER_ID);

      expect(result.status).toBe('SKIPPED_ITEM_NOT_ELIGIBLE');
      expect(prisma.incrementPBI.create).not.toHaveBeenCalled();
    });

    it('should be idempotent and not re-add a PBI already in the Increment', async () => {
      const pbiId = 'pbi-1';
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-1',
        pbiId,
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'ACTIVE' },
      } as never);
      mockEligibleDoD();
      vi.mocked(prisma.increment.findFirst).mockResolvedValue({
        id: 'increment-existing',
        status: 'DRAFT',
        integrationVerified: false,
        usabilityVerified: false,
      } as never);
      vi.mocked(prisma.incrementPBI.findUnique).mockResolvedValue({ id: 'link-1' } as never);

      const result = await incrementService.composeDonePBI(pbiId, USER_ID);

      expect(result.status).toBe('COMPOSED');
      expect(prisma.incrementPBI.create).not.toHaveBeenCalled();
    });

    it('should clear the evidence of a verified Increment that absorbs new work', async () => {
      const pbiId = 'pbi-7';
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-7',
        pbiId,
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'ACTIVE' },
      } as never);
      mockEligibleDoD([pbiId]);
      // The open Increment is already VERIFIED with a usability attestation.
      vi.mocked(prisma.increment.findFirst).mockResolvedValue({
        id: 'increment-existing',
        status: 'VERIFIED',
        integrationVerified: true,
        usabilityVerified: true,
      } as never);
      vi.mocked(prisma.incrementPBI.findUnique).mockResolvedValue(null as never);

      await incrementService.composeDonePBI(pbiId, USER_ID);

      // The new work is not covered by the old evidence, so both verifications fall away and the
      // Increment returns to draft rather than keeping a claim about work it no longer matches.
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'increment-existing' },
        data: expect.objectContaining({
          status: 'DRAFT',
          integrationVerified: false,
          usabilityVerified: false,
          usabilityEvidence: null,
        }),
      });

      // The two writes cannot be atomic here, so the order carries the invariant: evidence is
      // cleared before the link is added, making any failure conservative.
      const invalidationOrder = vi.mocked(prisma.increment.update).mock.invocationCallOrder[0]!;
      const linkOrder = vi.mocked(prisma.incrementPBI.create).mock.invocationCallOrder[0]!;
      expect(invalidationOrder).toBeLessThan(linkOrder);
    });

    it('should report SKIPPED_NO_ACTIVE_SPRINT when the PBI is not in an active Sprint', async () => {
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue(null as never);

      const result = await incrementService.composeDonePBI('pbi-1', USER_ID);

      expect(result.status).toBe('SKIPPED_NO_ACTIVE_SPRINT');
      expect(prisma.increment.findFirst).not.toHaveBeenCalled();
      expect(prisma.increment.create).not.toHaveBeenCalled();
    });

    it('should report SKIPPED_NO_ACTIVE_SPRINT when the Sprint is not ACTIVE', async () => {
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockResolvedValue({
        id: 'sbi-1',
        pbiId: 'pbi-1',
        sprint: { id: 'sprint-1', teamId: TEAM_ID, status: 'COMPLETED' },
      } as never);

      const result = await incrementService.composeDonePBI('pbi-1', USER_ID);

      expect(result.status).toBe('SKIPPED_NO_ACTIVE_SPRINT');
      expect(prisma.incrementPBI.create).not.toHaveBeenCalled();
    });

    it('should report FAILED without throwing when composition itself fails', async () => {
      vi.mocked(prisma.sprintBacklogItem.findFirst).mockRejectedValue(new Error('db down'));

      const result = await incrementService.composeDonePBI('pbi-1', USER_ID);

      expect(result.status).toBe('FAILED');
      expect(result.reason).toBeTruthy();
    });
  });

  describe('reconcileSprintIncrement', () => {
    it('should add the Done items the open Increment is missing', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([
        { pbiId: 'pbi-1' },
        { pbiId: 'pbi-2' },
      ] as never);
      vi.mocked(prisma.increment.findFirst).mockResolvedValue({
        id: 'increment-1',
        status: 'DRAFT',
        integrationVerified: false,
        usabilityVerified: false,
      } as never);
      vi.mocked(prisma.incrementPBI.findMany)
        // Existing links: pbi-1 is already there.
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }] as never)
        // Story-point recomputation.
        .mockResolvedValueOnce([{ pbi: { storyPoints: 5 } }, { pbi: { storyPoints: 3 } }] as never);
      mockEligibleDoD();
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { pbiId: 'pbi-1', dodItemId: 'dod-item-1' },
        { pbiId: 'pbi-2', dodItemId: 'dod-item-1' },
      ] as never);
      vi.mocked(prisma.incrementPBI.createMany).mockResolvedValue({ count: 1 } as never);

      const result = await incrementService.reconcileSprintIncrement(TEAM_ID, 'sprint-1', USER_ID);

      expect(result).toEqual({
        incrementId: 'increment-1',
        addedPbiIds: ['pbi-2'],
        skippedPbiIds: [],
        totalStoryPoints: 8,
      });
      expect(prisma.incrementPBI.createMany).toHaveBeenCalledWith({
        data: [
          {
            id: 'test-uuid',
            incrementId: 'increment-1',
            pbiId: 'pbi-2',
            createdBy: USER_ID,
          },
        ],
      });
    });

    it('should skip Done items that no longer satisfy the Definition of Done', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([{ pbiId: 'pbi-9' }] as never);
      vi.mocked(prisma.increment.findFirst).mockResolvedValue({
        id: 'increment-1',
        status: 'DRAFT',
        integrationVerified: false,
        usabilityVerified: false,
      } as never);
      vi.mocked(prisma.incrementPBI.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);
      mockEligibleDoD();
      // No verification rows for the candidate item.
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as never);

      const result = await incrementService.reconcileSprintIncrement(TEAM_ID, 'sprint-1', USER_ID);

      expect(result.addedPbiIds).toEqual([]);
      expect(result.skippedPbiIds).toEqual(['pbi-9']);
      expect(prisma.incrementPBI.createMany).not.toHaveBeenCalled();
    });

    it('should create the Sprint Increment when reconciliation finds none open', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: TEAM_ID,
      } as never);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.increment.findFirst).mockResolvedValue(null as never);
      vi.mocked(prisma.incrementPBI.findMany).mockResolvedValue([] as never);

      const result = await incrementService.reconcileSprintIncrement(TEAM_ID, 'sprint-1', USER_ID);

      expect(prisma.increment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sprintId: 'sprint-1', teamId: TEAM_ID, status: 'DRAFT' }),
        })
      );
      expect(result.incrementId).toBe('test-uuid');
    });

    it('should throw NotFoundError when the Sprint does not exist', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null as never);

      await expect(
        incrementService.reconcileSprintIncrement(TEAM_ID, 'missing-sprint', USER_ID)
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a Sprint that belongs to another team', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'other-team',
      } as never);

      await expect(
        incrementService.reconcileSprintIncrement(TEAM_ID, 'sprint-1', USER_ID)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(prisma.increment.findFirst).not.toHaveBeenCalled();
    });

    it('should refuse an outsider', async () => {
      mockNoMembership();

      await expect(
        incrementService.reconcileSprintIncrement(TEAM_ID, 'sprint-1', USER_ID)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });
    });
  });

  describe('getIncrementMetrics', () => {
    it('should return metrics for team increments', async () => {
      const mockIncrements = [
        {
          status: 'DELIVERED',
          totalStoryPoints: 10,
          deliveryMethod: 'EARLY_RELEASE',
          createdAt: new Date('2024-01-01'),
          deliveredAt: new Date('2024-01-05'),
        },
        {
          status: 'DELIVERED',
          totalStoryPoints: 20,
          deliveryMethod: 'SPRINT_REVIEW',
          createdAt: new Date('2024-01-10'),
          deliveredAt: new Date('2024-01-15'),
        },
        {
          status: 'DRAFT',
          totalStoryPoints: 15,
          deliveryMethod: null,
          createdAt: new Date(),
          deliveredAt: null,
        },
      ];

      vi.mocked(prisma.increment.findMany).mockResolvedValue(mockIncrements as never);

      const result = await incrementService.getIncrementMetrics(TEAM_ID, USER_ID);

      expect(result.totalIncrements).toBe(3);
      expect(result.deliveredIncrements).toBe(2);
      expect(result.earlyReleases).toBe(1);
      expect(result.sprintReviewDeliveries).toBe(1);
      expect(result.averageStoryPoints).toBe(15);
      expect(result.averageDeliveryTime).toBeGreaterThan(0);
    });

    it('should return zero metrics when no increments exist', async () => {
      vi.mocked(prisma.increment.findMany).mockResolvedValue([]);

      const result = await incrementService.getIncrementMetrics(TEAM_ID, USER_ID);

      expect(result.totalIncrements).toBe(0);
      expect(result.deliveredIncrements).toBe(0);
      expect(result.averageStoryPoints).toBe(0);
      expect(result.averageDeliveryTime).toBe(0);
    });
  });
});
