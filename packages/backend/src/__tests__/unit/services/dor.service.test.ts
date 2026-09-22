import { describe, it, expect, vi, beforeEach } from 'vitest';
import { definitionOfReadyService } from '../../../services/dor.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

vi.mock('../../../utils/prisma', () => ({
  default: {
    definitionOfReady: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    doRItem: {
      deleteMany: vi.fn(),
    },
    doRChecklistVerification: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productBacklogItem: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

/**
 * The transaction client handed to `prisma.$transaction`'s interactive callback. The readiness write
 * replaces the agreement's criteria inside one transaction, so the assertions target this client.
 */
const tx = {
  $queryRaw: vi.fn(),
  doRItem: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  definitionOfReady: { update: vi.fn() },
};

/**
 * `prisma.$transaction`'s interactive overload is not expressible through `mockImplementation`, so
 * the mock is narrowed to the single shape the service uses: run the callback with the stub client.
 */
const transactionMock = prisma.$transaction as unknown as {
  mockImplementation: (
    implementation: (callback: (client: typeof tx) => Promise<unknown>) => Promise<unknown>
  ) => void;
};

describe('DefinitionOfReadyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation((callback) => callback(tx));
    // The caller is a member of the team unless a test says otherwise...
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ id: 'membership-1' } as never);
    // ...and the team's Scrum Master unless a test says otherwise (readiness is a Scrum Master's
    // agreement to maintain, which is what its published contract promises).
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
      role: 'SCRUM_MASTER',
    } as never);
    tx.$queryRaw.mockResolvedValue([{ id: 'dor-1' }] as never);
    tx.doRItem.findMany.mockResolvedValue([] as never);
    tx.doRItem.deleteMany.mockResolvedValue({ count: 0 } as never);
    tx.doRItem.updateMany.mockResolvedValue({ count: 0 } as never);
    tx.doRItem.update.mockResolvedValue({} as never);
    tx.doRItem.create.mockResolvedValue({} as never);
    tx.definitionOfReady.update.mockResolvedValue({ id: 'dor-1', version: 2 } as never);
  });

  describe('getDefinitionOfReady', () => {
    it('should return DoR with items for a team', async () => {
      const mockDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        version: 1,
        items: [
          {
            id: 'item-1',
            description: 'Clear title and description',
            category: 'acceptance',
            isActive: true,
            order: 0,
          },
          {
            id: 'item-2',
            description: 'Acceptance criteria defined',
            category: 'acceptance',
            isActive: true,
            order: 1,
          },
        ],
      };

      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(mockDoR as any);

      const result = await definitionOfReadyService.getDefinitionOfReady('team-1');

      expect(prisma.definitionOfReady.findUnique).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result).toEqual(mockDoR);
    });

    it('should return null when DoR does not exist', async () => {
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(null as any);

      const result = await definitionOfReadyService.getDefinitionOfReady('team-1');

      expect(result).toBeNull();
    });
  });

  describe('createDefaultDefinitionOfReady', () => {
    it('should create a DoR with the six default criteria', async () => {
      const mockDoR = {
        id: 'mock-uuid-v7',
        teamId: 'team-1',
        version: 1,
        items: [],
      };

      vi.mocked(prisma.definitionOfReady.create).mockResolvedValue(mockDoR as any);

      const result = await definitionOfReadyService.createDefaultDefinitionOfReady(
        'team-1',
        'user-1'
      );

      expect(prisma.definitionOfReady.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-uuid-v7',
          teamId: 'team-1',
          version: 1,
          createdBy: 'user-1',
          items: {
            create: [
              {
                id: 'mock-uuid-v7',
                description: 'Clear title and description provided',
                category: 'acceptance',
                isActive: true,
                order: 0,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Acceptance criteria defined and agreed',
                category: 'acceptance',
                isActive: true,
                order: 1,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Story points estimated by the team',
                category: 'estimation',
                isActive: true,
                order: 2,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Business value assigned',
                category: 'estimation',
                isActive: true,
                order: 3,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Dependencies identified and documented',
                category: 'dependencies',
                isActive: true,
                order: 4,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'No blockers or impediments',
                category: 'dependencies',
                isActive: true,
                order: 5,
                createdBy: 'user-1',
              },
            ],
          },
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result).toEqual(mockDoR);
    });

    it('should default a criterion without a category to documentation', async () => {
      vi.mocked(prisma.definitionOfReady.create).mockResolvedValue({ id: 'dor-1' } as any);

      await definitionOfReadyService.createDefaultDefinitionOfReady('team-1');

      expect(prisma.definitionOfReady.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: 'team-1',
            createdBy: undefined,
          }),
        })
      );
    });
  });

  describe('updateDefinitionOfReady', () => {
    it('should refuse an editor who is not the team’s Scrum Master', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' } as never);

      await expect(
        definitionOfReadyService.updateDefinitionOfReady(
          'team-1',
          [{ description: 'Anything', isActive: true, order: 0 }],
          'user-1'
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DOR_SCRUM_MASTER_ONLY,
      });

      expect(tx.definitionOfReady.update).not.toHaveBeenCalled();
    });

    it('should refuse an agreement with no active criterion, so the Sprint gate cannot be emptied away', async () => {
      await expect(
        definitionOfReadyService.updateDefinitionOfReady(
          'team-1',
          [{ description: 'Retired', isActive: false, order: 0 }],
          'user-1'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOR_REQUIRED,
      });

      expect(prisma.definitionOfReady.findUnique).not.toHaveBeenCalled();
      expect(tx.definitionOfReady.update).not.toHaveBeenCalled();
    });

    it('should refuse an empty readiness agreement outright', async () => {
      await expect(
        definitionOfReadyService.updateDefinitionOfReady('team-1', [], 'user-1')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOR_REQUIRED,
      });

      expect(tx.definitionOfReady.update).not.toHaveBeenCalled();
    });

    it('should create the default agreement first when the team has none, then apply the update', async () => {
      const defaultDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        version: 1,
        items: [],
      };
      const updatedDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        version: 2,
        items: [
          {
            id: 'new-item-1',
            description: 'Custom item',
            category: 'documentation',
            isActive: true,
            order: 0,
          },
        ],
      };

      vi.mocked(prisma.definitionOfReady.findUnique)
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce({ id: 'dor-1' } as any);
      vi.mocked(prisma.definitionOfReady.create).mockResolvedValue(defaultDoR as any);
      tx.definitionOfReady.update.mockResolvedValue(updatedDoR as never);

      const result = await definitionOfReadyService.updateDefinitionOfReady(
        'team-1',
        [{ description: 'Custom item', category: 'documentation', isActive: true, order: 0 }],
        'user-1'
      );

      expect(prisma.definitionOfReady.create).toHaveBeenCalled();
      expect(tx.definitionOfReady.update).toHaveBeenCalledWith({
        where: { id: 'dor-1' },
        data: { version: { increment: 1 }, updatedBy: 'user-1' },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      expect(result).toEqual(updatedDoR);
    });

    it('should keep a criterion that survives the edit so its verifications are not cascaded away', async () => {
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue({ id: 'dor-1' } as any);
      // First read: the criteria that exist, which decides update-in-place versus insert.
      tx.doRItem.findMany.mockResolvedValueOnce([{ id: 'item-a' }, { id: 'item-b' }] as never);
      tx.definitionOfReady.update.mockResolvedValue({ id: 'dor-1', version: 4 } as never);

      await definitionOfReadyService.updateDefinitionOfReady(
        'team-1',
        [
          { id: 'item-a', description: 'Acceptance criteria agreed', isActive: true, order: 0 },
          { description: 'Added this Sprint', isActive: true, order: 1 },
        ],
        'user-1'
      );

      // Only the criterion the payload dropped is deleted -- the surviving one keeps its row, and
      // therefore every readiness verification recorded against it.
      expect(tx.doRItem.deleteMany).toHaveBeenCalledTimes(1);
      expect(tx.doRItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['item-b'] } } });

      // Survivors are moved out of the final order range before the dense renumbering, so a swap
      // cannot collide with `@@unique([dorId, order])`.
      expect(tx.doRItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-a'] } },
        data: { order: { increment: 10000 } },
      });

      expect(tx.doRItem.update).toHaveBeenCalledWith({
        where: { id: 'item-a' },
        data: {
          description: 'Acceptance criteria agreed',
          category: 'documentation',
          isActive: true,
          order: 0,
          updatedBy: 'user-1',
        },
      });

      expect(tx.doRItem.create).toHaveBeenCalledTimes(1);
      expect(tx.doRItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: 'Added this Sprint', order: 1 }),
      });
    });

    it('should treat an id that names no criterion of this agreement as a new criterion', async () => {
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue({ id: 'dor-1' } as any);
      tx.doRItem.findMany.mockResolvedValueOnce([{ id: 'item-a' }] as never);

      await definitionOfReadyService.updateDefinitionOfReady(
        'team-1',
        [
          { id: 'item-from-another-agreement', description: 'Foreign', isActive: true, order: 0 },
          { description: 'Another', isActive: true, order: 1 },
        ],
        'user-1'
      );

      // No update in place: an unknown id cannot reach across agreements.
      expect(tx.doRItem.update).not.toHaveBeenCalled();
      expect(tx.doRItem.create).toHaveBeenCalledTimes(2);
      // The team's own criterion is not in the payload, so it is dropped.
      expect(tx.doRItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['item-a'] } } });
    });
  });

  describe('getDoRItems', () => {
    it('should return items for existing DoR', async () => {
      const mockDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        items: [
          {
            id: 'item-1',
            description: 'Item 1',
            category: 'documentation',
            isActive: true,
            order: 0,
          },
        ],
      };

      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(mockDoR as any);

      const result = await definitionOfReadyService.getDoRItems('team-1');

      expect(result).toEqual(mockDoR.items);
    });

    it('should return empty array when DoR does not exist', async () => {
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(null as any);

      const result = await definitionOfReadyService.getDoRItems('team-1');

      expect(result).toEqual([]);
    });
  });

  describe('verifyDoRForPBI', () => {
    const mockPBI = {
      id: 'pbi-1',
      teamId: 'team-1',
      team: { id: 'team-1', name: 'Team 1' },
    };

    it('should refuse a caller who is not a member of the item’s team', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        definitionOfReadyService.verifyDoRForPBI('pbi-1', 'outsider', [
          { dorItemId: 'item-1', isVerified: true },
        ])
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DOR_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.definitionOfReady.findUnique).not.toHaveBeenCalled();
    });

    it('should create new verifications for PBI', async () => {
      const mockDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        items: [
          { id: 'item-1', description: 'Clear title', category: 'documentation' },
          { id: 'item-2', description: 'Acceptance criteria', category: 'documentation' },
        ],
      };

      const mockVerification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dorItemId: 'item-1',
        isVerified: true,
        verifiedBy: 'user-1',
        notes: 'Ready',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(mockDoR as any);
      vi.mocked(prisma.doRChecklistVerification.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.doRChecklistVerification.create).mockResolvedValue(mockVerification as any);

      const verifications = [{ dorItemId: 'item-1', isVerified: true, notes: 'Ready' }];

      const result = await definitionOfReadyService.verifyDoRForPBI(
        'pbi-1',
        'user-1',
        verifications
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockVerification);
    });

    it('should update existing verifications for PBI', async () => {
      const mockDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        items: [{ id: 'item-1', description: 'Clear title', category: 'documentation' }],
      };

      const existingVerification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dorItemId: 'item-1',
        isVerified: false,
      };

      const updatedVerification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dorItemId: 'item-1',
        isVerified: true,
        verifiedBy: 'user-1',
        notes: 'Now ready',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(mockDoR as any);
      vi.mocked(prisma.doRChecklistVerification.findUnique).mockResolvedValue(
        existingVerification as any
      );
      vi.mocked(prisma.doRChecklistVerification.update).mockResolvedValue(
        updatedVerification as any
      );

      const verifications = [{ dorItemId: 'item-1', isVerified: true, notes: 'Now ready' }];

      const result = await definitionOfReadyService.verifyDoRForPBI(
        'pbi-1',
        'user-1',
        verifications
      );

      expect(prisma.doRChecklistVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-1' },
        data: {
          isVerified: true,
          verifiedBy: 'user-1',
          verifiedAt: expect.any(Date),
          notes: 'Now ready',
          updatedBy: 'user-1',
        },
      });
      expect(result[0]).toEqual(updatedVerification);
    });

    it('should throw NotFoundError when PBI does not exist', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as any);

      await expect(definitionOfReadyService.verifyDoRForPBI('pbi-1', 'user-1', [])).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when DoR does not exist', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(null as any);

      await expect(definitionOfReadyService.verifyDoRForPBI('pbi-1', 'user-1', [])).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw BadRequestError for invalid DoR item IDs', async () => {
      const mockDoR = {
        id: 'dor-1',
        teamId: 'team-1',
        items: [{ id: 'item-1', description: 'Clear title', category: 'documentation' }],
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfReady.findUnique).mockResolvedValue(mockDoR as any);

      const verifications = [{ dorItemId: 'invalid-item', isVerified: true }];

      await expect(
        definitionOfReadyService.verifyDoRForPBI('pbi-1', 'user-1', verifications)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getDoRVerificationsForPBI', () => {
    it('should refuse a caller who is not a member of the item’s team', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        teamId: 'team-1',
      } as any);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as never);

      await expect(
        definitionOfReadyService.getDoRVerificationsForPBI('pbi-1', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DOR_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.doRChecklistVerification.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when the item does not exist', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as any);

      await expect(
        definitionOfReadyService.getDoRVerificationsForPBI('pbi-1', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should return verifications with item details for PBI', async () => {
      const mockVerifications = [
        {
          id: 'ver-1',
          pbiId: 'pbi-1',
          dorItemId: 'item-1',
          isVerified: true,
          dorItem: {
            id: 'item-1',
            description: 'Clear title',
            category: 'documentation',
          },
        },
      ];

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        teamId: 'team-1',
      } as any);
      vi.mocked(prisma.doRChecklistVerification.findMany).mockResolvedValue(
        mockVerifications as any
      );

      const result = await definitionOfReadyService.getDoRVerificationsForPBI('pbi-1', 'user-1');

      expect(prisma.doRChecklistVerification.findMany).toHaveBeenCalledWith({
        where: { pbiId: 'pbi-1' },
        include: {
          dorItem: {
            select: {
              id: true,
              description: true,
              category: true,
            },
          },
        },
      });
      expect(result).toEqual(mockVerifications);
    });

    it('should return empty array when no verifications exist', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        teamId: 'team-1',
      } as any);
      vi.mocked(prisma.doRChecklistVerification.findMany).mockResolvedValue([]);

      const result = await definitionOfReadyService.getDoRVerificationsForPBI('pbi-1', 'user-1');

      expect(result).toEqual([]);
    });
  });
});
