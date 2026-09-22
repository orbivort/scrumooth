import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    increment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    incrementIntegrationTest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    teamMember: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

import { incrementIntegrationService } from '../../../services/incrementIntegration.service';
import prisma from '../../../utils/prisma';
import { generateUUIDv7 } from '../../../utils/uuid';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const mockIncrement = (overrides: Record<string, unknown> = {}) => ({
  id: 'inc-current',
  teamId: 'team-1',
  name: 'Current',
  status: 'DRAFT',
  ...overrides,
});

const mockTestRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-uuid',
  currentIncrementId: 'inc-current',
  priorIncrementId: 'inc-prior',
  testResult: 'PASSED',
  testedById: 'user-1',
  testedAt: new Date('2026-08-12T10:00:00.000Z'),
  notes: null,
  currentIncrement: { id: 'inc-current', name: 'Current' },
  priorIncrement: { id: 'inc-prior', name: 'Prior' },
  testedBy: { id: 'user-1', firstName: 'Jane', lastName: 'Doe' },
  ...overrides,
});

describe('IncrementIntegrationService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateUUIDv7).mockReturnValue('test-uuid');
    // The caller belongs to the Increment's team unless a test says otherwise.
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({ id: 'membership-1' } as never);
  });

  describe('createTest', () => {
    it('should create a new integration test when none exists', async () => {
      const currentIncrementId = 'inc-current';
      const priorIncrementId = 'inc-prior';
      const currentIncrement = mockIncrement({ id: currentIncrementId, teamId: 'team-1' });
      const priorIncrement = mockIncrement({
        id: priorIncrementId,
        teamId: 'team-1',
        name: 'Prior',
      });

      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(currentIncrement as never);
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(priorIncrement as never);
      // refreshVerificationStatus re-fetches the increment internally
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(currentIncrement as never);
      vi.mocked(prisma.incrementIntegrationTest.findUnique).mockResolvedValueOnce(null as never);
      vi.mocked(prisma.incrementIntegrationTest.create).mockImplementation((async (args: any) =>
        mockTestRecord({
          id: args.data.id,
          testResult: args.data.testResult,
          notes: args.data.notes,
        } as never)) as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.createTest('user-1', {
        currentIncrementId,
        priorIncrementId,
        testResult: 'PASSED',
        notes: 'all good',
      });

      expect(result.testResult).toBe('PASSED');
      expect(result.priorIncrementName).toBe('Prior');
      expect(result.testerName).toBe('Jane Doe');
      expect(result.notes).toBe('all good');
      expect(result.testedById).toBe('user-1');

      const createCall = vi.mocked(prisma.incrementIntegrationTest.create).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(createCall).toBeDefined();
      expect(createCall.data).toMatchObject({
        currentIncrementId,
        priorIncrementId,
        testResult: 'PASSED',
        testedById: 'user-1',
        notes: 'all good',
        createdBy: 'user-1',
        updatedBy: 'user-1',
      });
      expect(createCall.data.id).toBe('test-uuid');
      // refreshVerificationStatus should have run
      expect(prisma.increment.update).toHaveBeenCalled();
    });

    it('should create without notes when notes omitted', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-prior', name: 'Prior' }) as never
      );
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(mockIncrement() as never);
      vi.mocked(prisma.incrementIntegrationTest.findUnique).mockResolvedValueOnce(null as never);
      vi.mocked(prisma.incrementIntegrationTest.create).mockImplementation((async (args: any) =>
        mockTestRecord({
          id: args.data.id,
          testResult: args.data.testResult,
          notes: args.data.notes,
        } as never)) as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.createTest('user-1', {
        currentIncrementId: 'inc-current',
        priorIncrementId: 'inc-prior',
        testResult: 'PASSED',
      });

      expect(result.notes).toBeNull();
      const createCall = vi.mocked(prisma.incrementIntegrationTest.create).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(createCall.data.notes).toBeUndefined();
    });

    it('should update an existing integration test instead of creating', async () => {
      const existing = { id: 'existing-id' };
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-prior', name: 'Prior' }) as never
      );
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(mockIncrement() as never);
      vi.mocked(prisma.incrementIntegrationTest.findUnique).mockResolvedValueOnce(
        existing as never
      );
      vi.mocked(prisma.incrementIntegrationTest.update).mockImplementation((async (args: any) =>
        mockTestRecord({
          id: args.where.id,
          testResult: args.data.testResult,
          notes: args.data.notes,
        } as never)) as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.createTest('user-1', {
        currentIncrementId: 'inc-current',
        priorIncrementId: 'inc-prior',
        testResult: 'FAILED',
        notes: 'regression',
      });

      expect(result.testResult).toBe('FAILED');
      expect(prisma.incrementIntegrationTest.create).not.toHaveBeenCalled();
      expect(prisma.incrementIntegrationTest.update).toHaveBeenCalledTimes(1);

      const updateCall = vi.mocked(prisma.incrementIntegrationTest.update).mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      };
      expect(updateCall.where).toEqual({ id: 'existing-id' });
      expect(updateCall.data).toMatchObject({
        testResult: 'FAILED',
        testedById: 'user-1',
        notes: 'regression',
        updatedBy: 'user-1',
      });
    });

    it('should use undefined notes when updating an existing test without notes', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-prior', name: 'Prior' }) as never
      );
      vi.mocked(prisma.increment.findUnique).mockResolvedValue(mockIncrement() as never);
      vi.mocked(prisma.incrementIntegrationTest.findUnique).mockResolvedValueOnce({
        id: 'existing-id',
      } as never);
      vi.mocked(prisma.incrementIntegrationTest.update).mockImplementation((async (args: any) =>
        mockTestRecord({
          id: args.where.id,
          testResult: args.data.testResult,
          notes: args.data.notes,
        } as never)) as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.createTest('user-1', {
        currentIncrementId: 'inc-current',
        priorIncrementId: 'inc-prior',
        testResult: 'PASSED',
      });

      const updateCall = vi.mocked(prisma.incrementIntegrationTest.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.notes).toBeUndefined();
    });

    it('should throw NotFoundError when current increment is missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(null as never);

      await expect(
        incrementIntegrationService.createTest('user-1', {
          currentIncrementId: 'missing',
          priorIncrementId: 'inc-prior',
          testResult: 'PASSED',
        })
      ).rejects.toThrow(NotFoundError);
      expect(prisma.incrementIntegrationTest.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when prior increment is missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(null as never);

      await expect(
        incrementIntegrationService.createTest('user-1', {
          currentIncrementId: 'inc-current',
          priorIncrementId: 'missing',
          testResult: 'PASSED',
        })
      ).rejects.toThrow(NotFoundError);
      expect(prisma.incrementIntegrationTest.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when current and prior increment are the same', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'same' }) as never
      );
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'same' }) as never
      );

      await expect(
        incrementIntegrationService.createTest('user-1', {
          currentIncrementId: 'same',
          priorIncrementId: 'same',
          testResult: 'PASSED',
        })
      ).rejects.toThrow(BadRequestError);
      expect(prisma.incrementIntegrationTest.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError when increments belong to different teams', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-current', teamId: 'team-1' }) as never
      );
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-prior', teamId: 'team-2', name: 'Prior' }) as never
      );

      await expect(
        incrementIntegrationService.createTest('user-1', {
          currentIncrementId: 'inc-current',
          priorIncrementId: 'inc-prior',
          testResult: 'PASSED',
        })
      ).rejects.toThrow(BadRequestError);
      expect(prisma.incrementIntegrationTest.create).not.toHaveBeenCalled();
    });

    it.each(['DELIVERED', 'ARCHIVED'])(
      'should throw BadRequestError when current increment is %s (locked)',
      async (status) => {
        vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
          mockIncrement({ id: 'inc-current', status }) as never
        );

        await expect(
          incrementIntegrationService.createTest('user-1', {
            currentIncrementId: 'inc-current',
            priorIncrementId: 'inc-prior',
            testResult: 'PASSED',
          })
        ).rejects.toThrow(BadRequestError);
        expect(prisma.incrementIntegrationTest.create).not.toHaveBeenCalled();
        expect(prisma.incrementIntegrationTest.update).not.toHaveBeenCalled();
      }
    );
  });

  describe('getTestsForIncrement', () => {
    it('should return serialized tests for an increment', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        mockTestRecord(),
        mockTestRecord({
          id: 'test-2',
          priorIncrementId: 'inc-prior2',
          testResult: 'FAILED',
          priorIncrement: { id: 'inc-prior2', name: 'Prior2' },
        }),
      ] as never);

      const result = await incrementIntegrationService.getTestsForIncrement(
        'inc-current',
        'user-1'
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.testResult).toBe('PASSED');
      expect(result[0]!.priorIncrementName).toBe('Prior');
      expect(result[1]!.testResult).toBe('FAILED');
      expect(result[1]!.priorIncrementName).toBe('Prior2');
      expect(prisma.incrementIntegrationTest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { currentIncrementId: 'inc-current' },
          orderBy: { testedAt: 'desc' },
        })
      );
    });

    it('should return empty array when increment has no tests', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([] as never);

      const result = await incrementIntegrationService.getTestsForIncrement(
        'inc-current',
        'user-1'
      );

      expect(result).toEqual([]);
    });

    it('should throw NotFoundError when increment is missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(null as never);

      await expect(
        incrementIntegrationService.getTestsForIncrement('missing', 'user-1')
      ).rejects.toThrow(NotFoundError);
      expect(prisma.incrementIntegrationTest.findMany).not.toHaveBeenCalled();
    });

    it('should refuse an outsider', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);

      await expect(
        incrementIntegrationService.getTestsForIncrement('inc-current', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });
      expect(prisma.incrementIntegrationTest.findMany).not.toHaveBeenCalled();
    });

    it('should handle test without priorIncrement or testedBy (null serialization)', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        {
          ...mockTestRecord(),
          priorIncrement: null,
          testedBy: null,
        },
      ] as never);

      const result = await incrementIntegrationService.getTestsForIncrement(
        'inc-current',
        'user-1'
      );

      expect(result[0]!.priorIncrementName).toBeNull();
      expect(result[0]!.testerName).toBeNull();
    });
  });

  describe('verifyIntegration', () => {
    it('should mark first increment as verified (no prior increments)', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.verifyIntegration('user-1', 'inc-current');

      expect(result.integrationVerified).toBe(true);
      expect(result.priorCount).toBe(0);
      expect(result.allPassed).toBe(true);
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'inc-current' },
        data: expect.objectContaining({
          integrationVerified: true,
          // The exemption is recorded as an exemption: no prior Increment was tested.
          integrationVerificationBasis: 'FIRST_INCREMENT_EXEMPT',
          integrationVerifiedPriorCount: 0,
          updatedBy: 'user-1',
        }),
      });
    });

    it('should set verified=true when all prior increments PASSED', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        { id: 'inc-prior', name: 'Prior', status: 'DELIVERED' },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        { priorIncrementId: 'inc-prior', testResult: 'PASSED' },
      ] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.verifyIntegration('user-1', 'inc-current');

      expect(result.integrationVerified).toBe(true);
      expect(result.allPassed).toBe(true);
      expect(result.priorCount).toBe(1);
      expect(result.missingTests).toEqual([]);
      expect(result.failedTests).toEqual([]);
      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'inc-current' },
        data: expect.objectContaining({
          integrationVerificationBasis: 'PRIOR_INCREMENTS',
          integrationVerifiedPriorCount: 1,
        }),
      });
    });

    it('should set verified=false when a prior increment has a FAILED test', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        { id: 'inc-prior', name: 'Prior', status: 'DELIVERED' },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        { priorIncrementId: 'inc-prior', testResult: 'FAILED' },
      ] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.verifyIntegration('user-1', 'inc-current');

      expect(result.integrationVerified).toBe(false);
      expect(result.failedTests).toEqual(['Prior']);
    });

    it('should set verified=false when a prior increment test is PENDING/missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        { id: 'inc-prior', name: 'Prior', status: 'DELIVERED' },
        { id: 'inc-prior2', name: 'Prior2', status: 'ARCHIVED' },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        { priorIncrementId: 'inc-prior', testResult: 'PENDING' },
      ] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      const result = await incrementIntegrationService.verifyIntegration('user-1', 'inc-current');

      expect(result.integrationVerified).toBe(false);
      expect(result.missingTests).toEqual(['Prior', 'Prior2']);
      expect(result.failedTests).toEqual([]);
    });

    it('should throw NotFoundError when increment is missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(null as never);

      await expect(
        incrementIntegrationService.verifyIntegration('user-1', 'missing')
      ).rejects.toThrow(NotFoundError);
      expect(prisma.increment.update).not.toHaveBeenCalled();
    });

    it.each(['DELIVERED', 'ARCHIVED'])(
      'should throw BadRequestError when increment is %s (locked)',
      async (status) => {
        vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
          mockIncrement({ id: 'inc-current', status }) as never
        );

        await expect(
          incrementIntegrationService.verifyIntegration('user-1', 'inc-current')
        ).rejects.toThrow(BadRequestError);
        expect(prisma.increment.findMany).not.toHaveBeenCalled();
        expect(prisma.increment.update).not.toHaveBeenCalled();
      }
    );
  });

  describe('getIncrementChain', () => {
    it('should return the increment chain newest first with test counts', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-3' }) as never
      );
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        {
          id: 'inc-1',
          name: 'Inc 1',
          status: 'DELIVERED',
          integrationVerified: true,
          deliveredAt: new Date(),
          sprint: { id: 's1', name: 'Sprint 1' },
        },
        {
          id: 'inc-2',
          name: 'Inc 2',
          status: 'VERIFIED',
          integrationVerified: false,
          deliveredAt: new Date(),
          sprint: { id: 's2', name: 'Sprint 2' },
        },
        {
          id: 'inc-3',
          name: 'Inc 3',
          status: 'DRAFT',
          integrationVerified: false,
          deliveredAt: null,
          sprint: { id: 's3', name: 'Sprint 3' },
        },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.groupBy).mockResolvedValueOnce([
        { currentIncrementId: 'inc-1', _count: { _all: 2 } },
        { currentIncrementId: 'inc-2', _count: { _all: 0 } },
      ] as never);

      const result = await incrementIntegrationService.getIncrementChain('inc-3', 'user-1');

      expect(result).toHaveLength(3);
      // Newest first
      expect(result[0]!.id).toBe('inc-3');
      expect(result[2]!.id).toBe('inc-1');
      expect(result[0]!.isCurrent).toBe(true);
      expect(result[1]!.isCurrent).toBe(false);
      expect(result[0]!.sprintName).toBe('Sprint 3');
      expect(result[2]!.hasTests).toBe(true);
      expect(result[1]!.hasTests).toBe(false);
    });

    it('should mark increment without groupBy entry as having no tests', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        {
          id: 'inc-1',
          name: 'Inc 1',
          status: 'DELIVERED',
          integrationVerified: false,
          deliveredAt: null,
          sprint: { id: 's1', name: 'Sprint 1' },
        },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.groupBy).mockResolvedValueOnce([] as never);

      const result = await incrementIntegrationService.getIncrementChain('inc-current', 'user-1');

      expect(result[0]!.hasTests).toBe(false);
    });

    it('should expose what each node’s verification rests on', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(
        mockIncrement({ id: 'inc-2' }) as never
      );
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        {
          id: 'inc-1',
          name: 'Inc 1',
          status: 'DELIVERED',
          integrationVerified: true,
          integrationVerificationBasis: 'FIRST_INCREMENT_EXEMPT',
          integrationVerifiedPriorCount: 0,
          deliveredAt: new Date(),
          sprint: { id: 's1', name: 'Sprint 1' },
        },
        {
          id: 'inc-2',
          name: 'Inc 2',
          status: 'VERIFIED',
          integrationVerified: true,
          integrationVerificationBasis: 'PRIOR_INCREMENTS',
          integrationVerifiedPriorCount: 1,
          deliveredAt: null,
          sprint: { id: 's2', name: 'Sprint 2' },
        },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.groupBy).mockResolvedValueOnce([] as never);

      const result = await incrementIntegrationService.getIncrementChain('inc-2', 'user-1');

      // Newest first: the current Increment was verified against one prior...
      expect(result[0]!.integrationVerificationBasis).toBe('PRIOR_INCREMENTS');
      expect(result[0]!.integrationVerifiedPriorCount).toBe(1);
      // ...while the team's first Increment carries the exemption, not a bare green flag.
      expect(result[1]!.integrationVerificationBasis).toBe('FIRST_INCREMENT_EXEMPT');
      expect(result[1]!.integrationVerifiedPriorCount).toBe(0);
    });

    it('should throw NotFoundError when increment is missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(null as never);

      await expect(
        incrementIntegrationService.getIncrementChain('missing', 'user-1')
      ).rejects.toThrow(NotFoundError);
      expect(prisma.increment.findMany).not.toHaveBeenCalled();
    });

    it('should refuse an outsider', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);

      await expect(
        incrementIntegrationService.getIncrementChain('inc-current', 'outsider')
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });
      expect(prisma.increment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('refreshVerificationStatus', () => {
    it('should mark verified=true when no prior increments exist', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.refreshVerificationStatus('inc-current');

      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'inc-current' },
        data: expect.objectContaining({ integrationVerified: true }),
      });
      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.updatedBy).toBeUndefined();
    });

    it('should set verified=true when all priors PASSED', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        { id: 'inc-prior', status: 'DELIVERED' },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        { priorIncrementId: 'inc-prior', testResult: 'PASSED' },
      ] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.refreshVerificationStatus('inc-current');

      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.integrationVerified).toBe(true);
    });

    it('should set verified=false when not all priors PASSED (FAILED)', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        { id: 'inc-prior', status: 'DELIVERED' },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        { priorIncrementId: 'inc-prior', testResult: 'FAILED' },
      ] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.refreshVerificationStatus('inc-current');

      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.integrationVerified).toBe(false);
    });

    it('should set verified=false when a prior test is PENDING/missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(mockIncrement() as never);
      vi.mocked(prisma.increment.findMany).mockResolvedValueOnce([
        { id: 'inc-prior', status: 'DELIVERED' },
      ] as never);
      vi.mocked(prisma.incrementIntegrationTest.findMany).mockResolvedValueOnce([
        { priorIncrementId: 'inc-prior', testResult: 'PENDING' },
      ] as never);
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.refreshVerificationStatus('inc-current');

      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.integrationVerified).toBe(false);
    });

    it('should return early without updating when increment is missing', async () => {
      vi.mocked(prisma.increment.findUnique).mockResolvedValueOnce(null as never);

      await incrementIntegrationService.refreshVerificationStatus('missing');

      expect(prisma.increment.update).not.toHaveBeenCalled();
    });
  });

  describe('setVerified', () => {
    it('should update integrationVerified with userId when provided', async () => {
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.setVerified('inc-1', true, 'user-1', 'PRIOR_INCREMENTS', 3);

      expect(prisma.increment.update).toHaveBeenCalledWith({
        where: { id: 'inc-1' },
        data: expect.objectContaining({
          integrationVerified: true,
          integrationVerificationBasis: 'PRIOR_INCREMENTS',
          integrationVerifiedPriorCount: 3,
          updatedBy: 'user-1',
        }),
      });
    });

    it('should update integrationVerified without userId when not provided', async () => {
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.setVerified('inc-1', false);

      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data).toEqual({
        integrationVerified: false,
        integrationVerificationBasis: null,
        integrationVerifiedPriorCount: 0,
        updatedAt: expect.any(Date),
      });
    });

    it('should drop the basis and the covered count when a verification is cleared', async () => {
      vi.mocked(prisma.increment.update).mockResolvedValue({} as never);

      await incrementIntegrationService.setVerified(
        'inc-1',
        false,
        undefined,
        'PRIOR_INCREMENTS',
        3
      );

      const updateCall = vi.mocked(prisma.increment.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      // Nothing may claim an Increment was verified against work it is no longer verified with.
      expect(updateCall.data).toEqual({
        integrationVerified: false,
        integrationVerificationBasis: null,
        integrationVerifiedPriorCount: 0,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('serializeTest', () => {
    it('should serialize a full test record to ISO string and names', () => {
      const date = new Date('2026-08-12T10:00:00.000Z');
      const serialized = incrementIntegrationService.serializeTest({
        id: 'test-1',
        currentIncrementId: 'inc-c',
        priorIncrementId: 'inc-p',
        testResult: 'PASSED',
        testedById: 'user-1',
        testedAt: date,
        notes: 'note',
        priorIncrement: { id: 'inc-p', name: 'Prior' },
        testedBy: { id: 'user-1', firstName: 'Jane', lastName: 'Doe' },
      });

      expect(serialized).toEqual({
        id: 'test-1',
        currentIncrementId: 'inc-c',
        priorIncrementId: 'inc-p',
        testResult: 'PASSED',
        testedById: 'user-1',
        testedAt: date.toISOString(),
        notes: 'note',
        priorIncrementName: 'Prior',
        testerName: 'Jane Doe',
      });
    });

    it('should serialize null notes, priorIncrement and testedBy correctly', () => {
      const date = new Date('2026-08-12T10:00:00.000Z');
      const serialized = incrementIntegrationService.serializeTest({
        id: 'test-1',
        currentIncrementId: 'inc-c',
        priorIncrementId: 'inc-p',
        testResult: 'FAILED',
        testedById: 'user-1',
        testedAt: date,
        notes: null,
        priorIncrement: null,
        testedBy: null,
      });

      expect(serialized.notes).toBeNull();
      expect(serialized.priorIncrementName).toBeNull();
      expect(serialized.testerName).toBeNull();
      expect(serialized.testedAt).toBe(date.toISOString());
    });
  });
});
