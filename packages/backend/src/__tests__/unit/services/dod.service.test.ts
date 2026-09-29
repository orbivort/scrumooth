import { describe, it, expect, vi, beforeEach } from 'vitest';
import { definitionOfDoneService } from '../../../services/dod.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, BadRequestError, InternalServerError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

vi.mock('../../../utils/prisma', () => ({
  default: {
    definitionOfDone: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    doDItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    doDVersionSnapshot: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    doDChecklistVerification: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productBacklogItem: {
      findUnique: vi.fn(),
    },
    sprint: {
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
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

/**
 * The transaction client handed to `prisma.$transaction`'s interactive callback. The DoD update must
 * snapshot the superseded version and then replace the criteria inside one transaction, so the
 * assertions target this client to prove every write shares it.
 */
const tx = {
  $queryRaw: vi.fn(),
  doDVersionSnapshot: { upsert: vi.fn() },
  doDItem: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  definitionOfDone: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
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

describe('DefinitionOfDoneService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation((callback) => callback(tx));
    // The caller belongs to the team that owns the Definition of Done unless a test says otherwise.
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ id: 'membership-1' } as never);
    tx.$queryRaw.mockResolvedValue([{ id: 'dod-1' }] as never);
    tx.definitionOfDone.findUniqueOrThrow.mockResolvedValue({ version: 1 } as never);
    tx.doDVersionSnapshot.upsert.mockResolvedValue({} as never);
    tx.doDItem.deleteMany.mockResolvedValue({ count: 0 } as never);
    tx.doDItem.findMany.mockResolvedValue([] as never);
    tx.doDItem.updateMany.mockResolvedValue({ count: 0 } as never);
    tx.doDItem.update.mockResolvedValue({} as never);
    tx.doDItem.create.mockResolvedValue({} as never);
  });

  describe('getDefinitionOfDone', () => {
    it('should return DoD with items for a team', async () => {
      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
        items: [
          {
            id: 'item-1',
            description: 'Code reviewed',
            category: 'review',
            isActive: true,
            order: 0,
          },
          {
            id: 'item-2',
            description: 'Tests passing',
            category: 'testing',
            isActive: true,
            order: 1,
          },
        ],
      };

      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(mockDoD as any);

      const result = await definitionOfDoneService.getDefinitionOfDone('team-1');

      expect(prisma.definitionOfDone.findUnique).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });
      expect(result).toEqual(mockDoD);
    });

    it('should return null when DoD does not exist', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(null as any);

      const result = await definitionOfDoneService.getDefinitionOfDone('team-1');

      expect(result).toBeNull();
    });
  });

  describe('createDefaultDefinitionOfDone', () => {
    it('should create default DoD with predefined items', async () => {
      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
        createdBy: 'user-1',
        items: [
          {
            id: 'item-1',
            description: 'Code is peer-reviewed and approved',
            category: 'review',
            isActive: true,
            order: 0,
          },
          {
            id: 'item-2',
            description: 'Unit tests written and passing (minimum 80% coverage)',
            category: 'testing',
            isActive: true,
            order: 1,
          },
          {
            id: 'item-3',
            description: 'Integration tests passing',
            category: 'testing',
            isActive: true,
            order: 2,
          },
          {
            id: 'item-4',
            description: 'Code is properly documented',
            category: 'documentation',
            isActive: true,
            order: 3,
          },
          {
            id: 'item-5',
            description: 'No critical or high-severity bugs',
            category: 'quality',
            isActive: true,
            order: 4,
          },
        ],
      };

      vi.mocked(prisma.definitionOfDone.create).mockResolvedValue(mockDoD as any);

      const result = await definitionOfDoneService.createDefaultDefinitionOfDone(
        'team-1',
        'user-1'
      );

      expect(prisma.definitionOfDone.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-uuid-v7',
          teamId: 'team-1',
          // Written explicitly so the database's exactly-one-owner CHECK is satisfied: this row is
          // a team's, so there is no group to name.
          groupId: null,
          version: 1,
          createdBy: 'user-1',
          items: {
            create: [
              {
                id: 'mock-uuid-v7',
                description: 'Code is peer-reviewed and approved',
                category: 'review',
                defaultKey: 'codeReviewed',
                isActive: true,
                order: 0,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Unit tests written and passing (minimum 80% coverage)',
                category: 'testing',
                defaultKey: 'unitTests',
                isActive: true,
                order: 1,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Integration tests passing',
                category: 'testing',
                defaultKey: 'integrationTests',
                isActive: true,
                order: 2,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'Code is properly documented',
                category: 'documentation',
                defaultKey: 'documentation',
                isActive: true,
                order: 3,
                createdBy: 'user-1',
              },
              {
                id: 'mock-uuid-v7',
                description: 'No critical or high-severity bugs',
                category: 'quality',
                defaultKey: 'noCriticalBugs',
                isActive: true,
                order: 4,
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
      expect(result).toEqual(mockDoD);
    });

    it('should create default DoD without userId', async () => {
      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
        createdBy: null,
        items: [],
      };

      vi.mocked(prisma.definitionOfDone.create).mockResolvedValue(mockDoD as any);

      await definitionOfDoneService.createDefaultDefinitionOfDone('team-1');

      expect(prisma.definitionOfDone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamId: 'team-1',
            createdBy: undefined,
          }),
        })
      );
    });
  });

  describe('updateDefinitionOfDone', () => {
    it('should update existing DoD with new items', async () => {
      const existingDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
      };

      const updatedDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 2,
        updatedBy: 'user-1',
        items: [
          {
            id: 'new-item-1',
            description: 'New item 1',
            category: 'quality',
            isActive: true,
            order: 0,
          },
        ],
      };

      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(existingDoD as any);
      // First read: the version being superseded (snapshotted). Second read: the criteria that
      // exist, which is what decides update-in-place versus insert.
      tx.doDItem.findMany
        .mockResolvedValueOnce([
          {
            description: 'Superseded item',
            category: 'review',
            isActive: true,
            order: 0,
          },
        ] as never)
        .mockResolvedValueOnce([{ id: 'existing-item-1' }] as never);
      tx.definitionOfDone.update.mockResolvedValue(updatedDoD as never);

      const items = [{ description: 'New item 1', category: 'quality', isActive: true, order: 0 }];

      const result = await definitionOfDoneService.updateDefinitionOfDone(
        'team-1',
        items,
        'user-1'
      );

      // The version being replaced is preserved before it is replaced...
      expect(tx.doDVersionSnapshot.upsert).toHaveBeenCalledWith({
        where: { dodId_version: { dodId: 'dod-1', version: 1 } },
        create: {
          id: 'mock-uuid-v7',
          dodId: 'dod-1',
          teamId: 'team-1',
          // The snapshot mirrors the owner of the Definition of Done it preserves.
          groupId: null,
          version: 1,
          items: [{ description: 'Superseded item', category: 'review', isActive: true, order: 0 }],
          createdBy: 'user-1',
        },
        update: {},
      });
      // ...a criterion the payload no longer carries is dropped...
      expect(tx.doDItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['existing-item-1'] } },
      });
      // ...a criterion the payload adds is inserted under a fresh id...
      expect(tx.doDItem.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-uuid-v7',
          dodId: 'dod-1',
          description: 'New item 1',
          category: 'quality',
          // A criterion the team adds is not a built-in one, so it carries no key. The write payload
          // cannot supply one either: the service keeps that column to itself.
          defaultKey: null,
          isActive: true,
          order: 0,
          createdBy: 'user-1',
        },
      });
      expect(tx.definitionOfDone.update).toHaveBeenCalledWith({
        where: { id: 'dod-1' },
        data: {
          version: { increment: 1 },
          updatedBy: 'user-1',
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });
      // The live row is only ever touched through the transaction client.
      expect(prisma.definitionOfDone.update).not.toHaveBeenCalled();
      expect(result).toEqual(updatedDoD);
    });

    it('should keep a criterion that survives the edit so its verifications are not cascaded away', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-1',
        teamId: 'team-1',
        version: 3,
      } as never);
      tx.definitionOfDone.findUniqueOrThrow.mockResolvedValue({ version: 3 } as never);
      tx.doDItem.findMany
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([{ id: 'item-a' }, { id: 'item-b' }] as never);
      tx.definitionOfDone.update.mockResolvedValue({ id: 'dod-1', version: 4 } as never);

      await definitionOfDoneService.updateDefinitionOfDone(
        'team-1',
        [
          // Same criterion, reworded: its row -- and therefore every verification recorded against
          // it -- has to survive.
          { id: 'item-a', description: 'Peer review completed', isActive: true, order: 0 },
          { description: 'Added this Sprint', isActive: true, order: 1 },
        ],
        'user-1'
      );

      // Only the criterion the payload dropped is deleted.
      expect(tx.doDItem.deleteMany).toHaveBeenCalledTimes(1);
      expect(tx.doDItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['item-b'] } } });

      // The surviving criterion is moved out of the final order range first, so the dense
      // renumbering cannot collide on `@@unique([dodId, order])`.
      expect(tx.doDItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-a'] } },
        data: { order: { increment: 10000 } },
      });

      expect(tx.doDItem.update).toHaveBeenCalledWith({
        where: { id: 'item-a' },
        data: {
          description: 'Peer review completed',
          category: 'quality',
          isActive: true,
          order: 0,
          updatedBy: 'user-1',
        },
      });

      expect(tx.doDItem.create).toHaveBeenCalledTimes(1);
      expect(tx.doDItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ description: 'Added this Sprint', order: 1 }),
      });
    });

    it('should lock the Definition of Done row so the superseded version cannot be skipped', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-1',
        teamId: 'team-1',
        version: 4,
      } as never);
      tx.definitionOfDone.findUniqueOrThrow.mockResolvedValue({ version: 4 } as never);
      tx.definitionOfDone.update.mockResolvedValue({ id: 'dod-1', version: 5 } as never);

      await definitionOfDoneService.updateDefinitionOfDone(
        'team-1',
        [{ description: 'New item', isActive: true, order: 0 }],
        'user-1'
      );

      // The row lock plus the in-transaction read are what make the history append-only under
      // concurrent updates.
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.doDVersionSnapshot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dodId_version: { dodId: 'dod-1', version: 4 } },
        })
      );
    });

    it('should refuse a Definition of Done that would keep no active item', async () => {
      const items = [
        { description: 'Retired item', category: 'quality', isActive: false, order: 0 },
      ];

      await expect(
        definitionOfDoneService.updateDefinitionOfDone('team-1', items, 'user-1')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOD_REQUIRED,
      });

      expect(prisma.definitionOfDone.findUnique).not.toHaveBeenCalled();
      expect(tx.definitionOfDone.update).not.toHaveBeenCalled();
    });

    it('should refuse an empty Definition of Done, so the Done gate cannot be deleted away', async () => {
      await expect(
        definitionOfDoneService.updateDefinitionOfDone('team-1', [], 'user-1')
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOD_REQUIRED,
      });

      expect(tx.definitionOfDone.update).not.toHaveBeenCalled();
    });

    it('should create default DoD if not exists and then update', async () => {
      const defaultDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
        items: [],
      };

      const updatedDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 2,
        items: [
          {
            id: 'new-item-1',
            description: 'Custom item',
            category: 'quality',
            isActive: true,
            order: 0,
          },
        ],
      };

      vi.mocked(prisma.definitionOfDone.findUnique)
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce(defaultDoD as any);
      vi.mocked(prisma.definitionOfDone.create).mockResolvedValue(defaultDoD as any);
      tx.doDItem.findMany.mockResolvedValue([] as never);
      tx.definitionOfDone.update.mockResolvedValue(updatedDoD as never);

      const items = [{ description: 'Custom item', category: 'quality', isActive: true, order: 0 }];

      const result = await definitionOfDoneService.updateDefinitionOfDone(
        'team-1',
        items,
        'user-1'
      );

      expect(prisma.definitionOfDone.create).toHaveBeenCalled();
      expect(result).toEqual(updatedDoD);
    });

    it('should use default category when item has no category', async () => {
      const existingDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
      };

      const updatedDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        version: 2,
        updatedBy: 'user-1',
        items: [
          {
            id: 'new-item-1',
            description: 'Item without category',
            category: 'quality',
            isActive: true,
            order: 0,
          },
        ],
      };

      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(existingDoD as any);
      tx.doDItem.findMany.mockResolvedValue([] as never);
      tx.definitionOfDone.update.mockResolvedValue(updatedDoD as never);

      const items = [{ description: 'Item without category', isActive: true, order: 0 }];

      await definitionOfDoneService.updateDefinitionOfDone('team-1', items, 'user-1');

      expect(tx.doDItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Item without category',
          category: 'quality',
        }),
      });
    });

    it('should drop a defaultKey a client tries to send, so a team cannot mint a built-in criterion', async () => {
      const existingDoD = { id: 'dod-1', teamId: 'team-1', version: 1 };
      const updatedDoD = { id: 'dod-1', teamId: 'team-1', version: 2, items: [] };

      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(existingDoD as any);
      tx.doDItem.findMany.mockResolvedValue([] as never);
      tx.definitionOfDone.update.mockResolvedValue(updatedDoD as never);

      // The field is not part of the write contract. A payload carrying one is the case the service
      // has to defend against: labelling a sentence the team wrote with the product's built-in wording
      // would show the reader a criterion nobody agreed to.
      const items = [
        {
          description: 'Whatever we typed',
          category: 'quality',
          isActive: true,
          order: 0,
          defaultKey: 'codeReviewed',
        } as never,
      ];

      await definitionOfDoneService.updateDefinitionOfDone('team-1', items, 'user-1');

      expect(tx.doDItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ defaultKey: null }),
      });
    });
  });

  describe('getDoDVersionSnapshots', () => {
    it('should return the current version first, then every preserved superseded version', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-1',
        teamId: 'team-1',
        version: 3,
        updatedBy: 'user-1',
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
        items: [{ description: 'Current item', category: 'quality', isActive: true, order: 0 }],
      } as never);
      vi.mocked(prisma.doDVersionSnapshot.findMany).mockResolvedValue([
        {
          id: 'snapshot-2',
          teamId: 'team-1',
          version: 2,
          items: [{ description: 'Version 2 item', category: 'review', isActive: true, order: 0 }],
          createdAt: new Date('2026-09-19T10:00:00.000Z'),
          createdBy: 'user-2',
        },
        {
          id: 'snapshot-1',
          teamId: 'team-1',
          version: 1,
          items: [{ description: 'Version 1 item', category: 'review', isActive: true, order: 0 }],
          createdAt: new Date('2026-09-18T10:00:00.000Z'),
          createdBy: null,
        },
      ] as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
        { id: 'user-2', firstName: 'Grace', lastName: 'Hopper' },
      ] as never);

      const result = await definitionOfDoneService.getDoDVersionSnapshots('team-1');

      expect(result.map((version) => version.version)).toEqual([3, 2, 1]);
      expect(result[0]).toMatchObject({
        version: 3,
        isCurrent: true,
        createdByName: 'Ada Lovelace',
      });
      expect(result[1]).toMatchObject({
        version: 2,
        isCurrent: false,
        createdByName: 'Grace Hopper',
      });
      expect(result[2]).toMatchObject({ version: 1, createdBy: null, createdByName: null });
      // One lookup resolves every author name, rather than one query per version.
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return an empty history when the team has no Definition of Done', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(null);

      const result = await definitionOfDoneService.getDoDVersionSnapshots('team-1');

      expect(result).toEqual([]);
      expect(prisma.doDVersionSnapshot.findMany).not.toHaveBeenCalled();
    });

    it('should drop malformed entries from a snapshot instead of failing the whole history', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-1',
        teamId: 'team-1',
        version: 2,
        updatedBy: null,
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
        items: [],
      } as never);
      vi.mocked(prisma.doDVersionSnapshot.findMany).mockResolvedValue([
        {
          id: 'snapshot-1',
          teamId: 'team-1',
          version: 1,
          items: [
            { description: 'Valid item', category: 'review', isActive: true, order: 0 },
            { category: 'review', isActive: true, order: 1 },
            'not-an-object',
          ],
          createdAt: new Date('2026-09-18T10:00:00.000Z'),
          createdBy: null,
        },
      ] as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

      const result = await definitionOfDoneService.getDoDVersionSnapshots('team-1');

      expect(result[1]!.items).toEqual([
        // A snapshot written before the key existed reads as null rather than being dropped, so the
        // interface can fall back to matching the sentence.
        {
          description: 'Valid item',
          category: 'review',
          isActive: true,
          order: 0,
          defaultKey: null,
        },
      ]);
    });

    it('should carry a seeded criterion’s key into the history', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-1',
        teamId: 'team-1',
        version: 3,
        updatedBy: null,
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
        items: [],
      } as never);
      vi.mocked(prisma.doDVersionSnapshot.findMany).mockResolvedValue([
        {
          id: 'snapshot-1',
          teamId: 'team-1',
          version: 2,
          items: [
            {
              description: 'Code is properly documented',
              category: 'documentation',
              isActive: true,
              order: 0,
              defaultKey: 'documentation',
            },
          ],
          createdAt: new Date('2026-09-18T10:00:00.000Z'),
          createdBy: null,
        },
      ] as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

      const result = await definitionOfDoneService.getDoDVersionSnapshots('team-1');

      // The key travels with the version, so a superseded criterion stays readable in the reader's
      // language after the team has reworded it.
      expect(result[1]!.items[0]!.defaultKey).toBe('documentation');
    });

    it('should not query author names when no version records one', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-1',
        teamId: 'team-1',
        version: 1,
        updatedBy: null,
        updatedAt: new Date('2026-09-20T10:00:00.000Z'),
        items: [],
      } as never);
      vi.mocked(prisma.doDVersionSnapshot.findMany).mockResolvedValue([] as never);

      const result = await definitionOfDoneService.getDoDVersionSnapshots('team-1');

      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getDoDItems', () => {
    it('should return items for existing DoD', async () => {
      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        items: [
          { id: 'item-1', description: 'Item 1', category: 'review', isActive: true, order: 0 },
        ],
      };

      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(mockDoD as any);

      const result = await definitionOfDoneService.getDoDItems('team-1');

      expect(result).toEqual(mockDoD.items);
    });

    it('should return empty array when DoD does not exist', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(null as any);

      const result = await definitionOfDoneService.getDoDItems('team-1');

      expect(result).toEqual([]);
    });
  });

  describe('verifyDoDForPBI', () => {
    it('should create new verifications for PBI', async () => {
      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Team 1' },
      };

      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        items: [
          { id: 'item-1', description: 'Code reviewed', category: 'review' },
          { id: 'item-2', description: 'Tests passing', category: 'testing' },
        ],
      };

      const mockVerification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dodItemId: 'item-1',
        isVerified: true,
        verifiedBy: 'user-1',
        notes: 'Looks good',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(mockDoD as any);
      vi.mocked(prisma.doDChecklistVerification.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.doDChecklistVerification.create).mockResolvedValue(mockVerification as any);

      const verifications = [{ dodItemId: 'item-1', isVerified: true, notes: 'Looks good' }];

      const result = await definitionOfDoneService.verifyDoDForPBI(
        'pbi-1',
        'user-1',
        verifications
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockVerification);
    });

    it('should update existing verifications for PBI', async () => {
      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Team 1' },
      };

      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        items: [{ id: 'item-1', description: 'Code reviewed', category: 'review' }],
      };

      const existingVerification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dodItemId: 'item-1',
        isVerified: false,
      };

      const updatedVerification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dodItemId: 'item-1',
        isVerified: true,
        verifiedBy: 'user-1',
        notes: 'Now verified',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(mockDoD as any);
      vi.mocked(prisma.doDChecklistVerification.findUnique).mockResolvedValue(
        existingVerification as any
      );
      vi.mocked(prisma.doDChecklistVerification.update).mockResolvedValue(
        updatedVerification as any
      );

      const verifications = [{ dodItemId: 'item-1', isVerified: true, notes: 'Now verified' }];

      const result = await definitionOfDoneService.verifyDoDForPBI(
        'pbi-1',
        'user-1',
        verifications
      );

      expect(prisma.doDChecklistVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-1' },
        data: {
          isVerified: true,
          verifiedBy: 'user-1',
          verifiedAt: expect.any(Date),
          notes: 'Now verified',
          updatedBy: 'user-1',
        },
      });
      expect(result[0]).toEqual(updatedVerification);
    });

    it('should throw NotFoundError when PBI does not exist', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as any);

      await expect(definitionOfDoneService.verifyDoDForPBI('pbi-1', 'user-1', [])).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when DoD does not exist', async () => {
      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Team 1' },
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(null as any);

      await expect(definitionOfDoneService.verifyDoDForPBI('pbi-1', 'user-1', [])).rejects.toThrow(
        NotFoundError
      );
    });

    it('should refuse an outsider who does not belong to the team that owns the item', async () => {
      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Team 1' },
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);

      // A non-member who could write a verification could decide another team's work is Done.
      await expect(
        definitionOfDoneService.verifyDoDForPBI('pbi-1', 'outsider', [
          { dodItemId: 'item-1', isVerified: true },
        ])
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DOD_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.doDChecklistVerification.create).not.toHaveBeenCalled();
      expect(prisma.doDChecklistVerification.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError for invalid DoD item IDs', async () => {
      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Team 1' },
      };

      const mockDoD = {
        id: 'dod-1',
        teamId: 'team-1',
        items: [{ id: 'item-1', description: 'Code reviewed', category: 'review' }],
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(mockDoD as any);

      const verifications = [{ dodItemId: 'invalid-item', isVerified: true }];

      await expect(
        definitionOfDoneService.verifyDoDForPBI('pbi-1', 'user-1', verifications)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getDoDVerificationsForPBI', () => {
    it('should return verifications with item details for PBI', async () => {
      const mockVerifications = [
        {
          id: 'ver-1',
          pbiId: 'pbi-1',
          dodItemId: 'item-1',
          isVerified: true,
          dodItem: {
            id: 'item-1',
            description: 'Code reviewed',
            category: 'review',
          },
        },
      ];

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        teamId: 'team-123',
      } as never);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue(
        mockVerifications as any
      );

      const result = await definitionOfDoneService.getDoDVerificationsForPBI('pbi-1', 'user-1');

      expect(prisma.doDChecklistVerification.findMany).toHaveBeenCalledWith({
        where: { pbiId: 'pbi-1' },
        include: {
          dodItem: {
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
        teamId: 'team-123',
      } as never);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([]);

      const result = await definitionOfDoneService.getDoDVerificationsForPBI('pbi-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('should refuse to read verifications for an outsider', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        teamId: 'team-123',
      } as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);

      await expect(
        definitionOfDoneService.getDoDVerificationsForPBI('pbi-1', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DOD_TEAM_MEMBERS_ONLY,
      });

      expect(prisma.doDChecklistVerification.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle getDefinitionOfDone with database error', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(definitionOfDoneService.getDefinitionOfDone('team-123')).rejects.toThrow(
        'Connection failed'
      );
    });

    it('should handle createDefaultDefinitionOfDone with empty userId', async () => {
      const mockDoD = {
        id: 'dod-123',
        teamId: 'team-123',
        version: 1,
        createdBy: null,
        items: [],
      };

      vi.mocked(prisma.definitionOfDone.create).mockResolvedValue(mockDoD as any);

      const result = await definitionOfDoneService.createDefaultDefinitionOfDone('team-123');

      expect(result.createdBy).toBeNull();
    });

    it('should treat an all-inactive payload as an attempt to empty the Definition of Done', async () => {
      await expect(
        definitionOfDoneService.updateDefinitionOfDone(
          'team-123',
          [
            { description: 'Retired', isActive: false, order: 0 },
            { description: 'Also retired', isActive: false, order: 1 },
          ],
          'user-1'
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOD_REQUIRED,
      });

      expect(tx.definitionOfDone.update).not.toHaveBeenCalled();
    });

    it('should handle getDoDItems when DoD does not exist', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(null);

      const result = await definitionOfDoneService.getDoDItems('team-123');

      expect(result).toEqual([]);
    });

    it('should handle verifyDoDForPBI with empty verifications array', async () => {
      const pbi = {
        id: 'pbi-1',
        teamId: 'team-123',
        team: { id: 'team-123' },
      };

      const dod = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [],
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(pbi as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(dod as any);

      const result = await definitionOfDoneService.verifyDoDForPBI('pbi-1', 'user-1', []);

      expect(result).toEqual([]);
    });

    it('should handle getDoDVerificationsForPBI with database error', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue({
        teamId: 'team-123',
      } as never);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        definitionOfDoneService.getDoDVerificationsForPBI('pbi-1', 'user-1')
      ).rejects.toThrow('Database error');
    });

    it('should handle getDoDComplianceReport with no PBIs in sprint', async () => {
      const sprint = {
        id: 'sprint-1',
        teamId: 'team-123',
        sprintBacklogItems: [],
      };

      const dod = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [],
      };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(sprint as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(dod as any);

      const result = await definitionOfDoneService.getDoDComplianceReport('sprint-1', 'user-1');

      expect(result.totalPBIs).toBe(0);
      expect(result.complianceRate).toBe(0);
      expect(result.pbiDetails).toEqual([]);
    });

    it('should handle getDoDComplianceReport with no DoD defined', async () => {
      const sprint = {
        id: 'sprint-1',
        teamId: 'team-123',
        sprintBacklogItems: [
          {
            pbi: {
              id: 'pbi-1',
              title: 'Test PBI',
              status: 'IN_PROGRESS',
            },
          },
        ],
      };

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(sprint as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([]);

      const result = await definitionOfDoneService.getDoDComplianceReport('sprint-1', 'user-1');

      expect(result.totalPBIs).toBe(1);
      expect(result.dodCompliantPBIs).toBe(0);
    });

    it('should throw NotFoundError for non-existent sprint in compliance report', async () => {
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(null);

      await expect(
        definitionOfDoneService.getDoDComplianceReport('non-existent-sprint', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle updateDefinitionOfDone when DoD does not exist', async () => {
      const newDoD = {
        id: 'dod-123',
        teamId: 'team-123',
        version: 1,
        items: [],
      };

      const updatedDod = {
        id: 'dod-123',
        teamId: 'team-123',
        version: 2,
        items: [
          {
            id: 'item-1',
            description: 'Test item',
            category: 'quality',
            isActive: true,
            order: 0,
          },
        ],
      };

      vi.mocked(prisma.definitionOfDone.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newDoD as any);
      vi.mocked(prisma.definitionOfDone.create).mockResolvedValue(newDoD as any);
      tx.doDItem.findMany.mockResolvedValue([] as never);
      tx.definitionOfDone.update.mockResolvedValue(updatedDod as never);

      const items = [
        {
          description: 'Test item',
          category: 'quality',
          isActive: true,
          order: 0,
        },
      ];

      const result = await definitionOfDoneService.updateDefinitionOfDone(
        'team-123',
        items,
        'user-1'
      );

      expect(result.items).toHaveLength(1);
    });

    it('should handle verifyDoDForPBI with notes', async () => {
      const pbi = {
        id: 'pbi-1',
        teamId: 'team-123',
        team: { id: 'team-123' },
      };

      const dod = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [
          {
            id: 'item-1',
            description: 'Code reviewed',
          },
        ],
      };

      const verification = {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dodItemId: 'item-1',
        isVerified: true,
        verifiedBy: 'user-1',
        verifiedAt: new Date(),
        notes: 'Reviewed by senior dev',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(pbi as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(dod as any);
      vi.mocked(prisma.doDChecklistVerification.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.doDChecklistVerification.create).mockResolvedValue(verification as any);

      const result = await definitionOfDoneService.verifyDoDForPBI('pbi-1', 'user-1', [
        {
          dodItemId: 'item-1',
          isVerified: true,
          notes: 'Reviewed by senior dev',
        },
      ]);

      expect(result[0]!.notes).toBe('Reviewed by senior dev');
    });

    it('should handle InternalServerError in getDoDComplianceReport', async () => {
      vi.mocked(prisma.sprint.findUnique).mockRejectedValue(new Error('Unexpected error'));

      await expect(
        definitionOfDoneService.getDoDComplianceReport('sprint-1', 'user-1')
      ).rejects.toThrow(InternalServerError);
    });

    it('should handle verifications referencing DoD items not in current definition', async () => {
      const sprint = {
        id: 'sprint-1',
        teamId: 'team-123',
        sprintBacklogItems: [
          {
            pbi: {
              id: 'pbi-1',
              title: 'Feature A',
              status: 'DONE',
            },
          },
        ],
      };

      const dod = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [
          {
            id: 'current-item-1',
            description: 'Current item',
            category: 'quality',
            isActive: true,
          },
        ],
      };

      const verifications = [
        {
          id: 'ver-1',
          pbiId: 'pbi-1',
          dodItemId: 'old-item-1',
          isVerified: true,
          verifiedBy: 'user-1',
          verifiedAt: new Date(),
          notes: null,
          createdAt: new Date(),
          createdBy: 'user-1',
          updatedAt: new Date(),
          updatedBy: null,
        },
      ];

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(sprint as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(dod as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue(verifications as any);

      const result = await definitionOfDoneService.getDoDComplianceReport('sprint-1', 'user-1');

      expect(result.totalPBIs).toBe(1);
      expect(result.pbiDetails[0]!.verifications[0]!.dodItem.description).toBe('');
      expect(result.pbiDetails[0]!.verifications[0]!.dodItem.category).toBe('quality');
    });

    it('should calculate compliance percentage correctly when DoD items exist', async () => {
      const sprint = {
        id: 'sprint-1',
        teamId: 'team-123',
        sprintBacklogItems: [
          {
            pbi: {
              id: 'pbi-1',
              title: 'Feature A',
              status: 'DONE',
            },
          },
          {
            pbi: {
              id: 'pbi-2',
              title: 'Feature B',
              status: 'IN_PROGRESS',
            },
          },
        ],
      };

      const dod = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [
          { id: 'item-1', description: 'Code reviewed', category: 'review', isActive: true },
          { id: 'item-2', description: 'Tests passing', category: 'testing', isActive: true },
        ],
      };

      const verificationsPBI1 = [
        {
          id: 'ver-1',
          pbiId: 'pbi-1',
          dodItemId: 'item-1',
          isVerified: true,
          verifiedBy: 'user-1',
          verifiedAt: new Date(),
          notes: null,
          createdAt: new Date(),
          createdBy: 'user-1',
          updatedAt: new Date(),
          updatedBy: null,
        },
        {
          id: 'ver-2',
          pbiId: 'pbi-1',
          dodItemId: 'item-2',
          isVerified: true,
          verifiedBy: 'user-1',
          verifiedAt: new Date(),
          notes: null,
          createdAt: new Date(),
          createdBy: 'user-1',
          updatedAt: new Date(),
          updatedBy: null,
        },
      ];

      const verificationsPBI2 = [
        {
          id: 'ver-3',
          pbiId: 'pbi-2',
          dodItemId: 'item-1',
          isVerified: true,
          verifiedBy: 'user-1',
          verifiedAt: new Date(),
          notes: 'Some notes',
          createdAt: new Date(),
          createdBy: 'user-1',
          updatedAt: new Date(),
          updatedBy: null,
        },
        {
          id: 'ver-4',
          pbiId: 'pbi-2',
          dodItemId: 'item-2',
          isVerified: false,
          verifiedBy: 'user-1',
          verifiedAt: new Date(),
          notes: null,
          createdAt: new Date(),
          createdBy: 'user-1',
          updatedAt: new Date(),
          updatedBy: null,
        },
      ];

      vi.mocked(prisma.sprint.findUnique).mockResolvedValue(sprint as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(dod as any);
      vi.mocked(prisma.doDChecklistVerification.findMany)
        .mockResolvedValueOnce(verificationsPBI1 as any)
        .mockResolvedValueOnce(verificationsPBI2 as any);

      const result = await definitionOfDoneService.getDoDComplianceReport('sprint-1', 'user-1');

      expect(result.totalPBIs).toBe(2);
      expect(result.dodCompliantPBIs).toBe(1);
      expect(result.pbiDetails[0]!.compliancePercentage).toBe(100);
      expect(result.pbiDetails[1]!.compliancePercentage).toBe(50);
      expect(result.complianceRate).toBe(50);
    });
  });

  describe('a Definition of Done shared by a group', () => {
    /** Put the team in a group, so the group's row is the one that governs it. */
    const placeTeamInGroup = () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ groupId: 'group-1' } as never);
    };

    it("reads the group's row rather than the team's inert one", async () => {
      placeTeamInGroup();
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-group',
        teamId: null,
        groupId: 'group-1',
        version: 3,
        items: [{ id: 'item-1', description: 'Integrated', category: 'quality', isActive: true }],
      } as never);

      const result = await definitionOfDoneService.getDefinitionOfDone('team-1');

      // The read targets the one row the group owns, never the team's own row by `teamId`.
      expect(prisma.definitionOfDone.findUnique).toHaveBeenCalledWith({
        where: { groupId: 'group-1' },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      // The response is still a team-scoped view of the commitment: it is reported under the team
      // that asked, so no consumer has to handle a null team on a field that has always been one.
      expect(result?.teamId).toBe('team-1');
      expect(result?.version).toBe(3);
    });

    it('refuses a team-scoped write, because the shared Definition of Done is changed at the group', async () => {
      placeTeamInGroup();

      await expect(
        definitionOfDoneService.updateDefinitionOfDone(
          'team-1',
          [{ description: 'Reviewed', isActive: true, order: 0 }],
          'user-1'
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.DOD_GROUP_GOVERNED,
      });

      expect(prisma.definitionOfDone.create).not.toHaveBeenCalled();
      expect(prisma.definitionOfDone.update).not.toHaveBeenCalled();
      expect(tx.definitionOfDone.update).not.toHaveBeenCalled();
    });

    it('hands a leaving team the shared items as its own Definition of Done', async () => {
      vi.mocked(prisma.definitionOfDone.findUnique)
        .mockResolvedValueOnce({
          id: 'dod-team',
          teamId: 'team-1',
          groupId: null,
          version: 2,
        } as never)
        .mockResolvedValueOnce(null as never);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        id: 'dod-team',
        teamId: 'team-1',
        groupId: null,
        version: 2,
      } as never);
      vi.mocked(prisma.definitionOfDone.create).mockResolvedValue({ version: 1 } as never);
      tx.definitionOfDone.update.mockResolvedValue({
        id: 'dod-team',
        teamId: 'team-1',
        groupId: null,
        version: 3,
      } as never);

      const result = await definitionOfDoneService.adoptDefinitionOfDoneAsOwn(
        'team-1',
        [{ description: 'Integrated', category: 'quality', isActive: true, order: 0 }],
        'user-1'
      );

      // The write names the team scope directly, so it is the one path allowed behind the gate.
      expect(prisma.definitionOfDone.findUnique).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
      });
      expect(tx.definitionOfDone.update).toHaveBeenCalled();
      expect(result.teamId).toBe('team-1');
    });
  });
});
