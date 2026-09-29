import { describe, it, expect, vi, beforeEach } from 'vitest';
import { definitionService } from './definition.service';
import { apiService } from '../index';

vi.mock('../index', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('DefinitionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefinitionOfDone', () => {
    it('should get Definition of Done for a team', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'dod-1',
          teamId: 'team-1',
          items: [
            {
              id: 'item-1',
              description: 'Code reviewed',
              category: 'review',
              isActive: true,
              order: 1,
            },
          ],
          version: 1,
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDefinitionOfDone('team-1');

      expect(apiService.get).toHaveBeenCalledWith('/teams/team-1/definition-of-done');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('dod-1');
    });
  });

  describe('updateDefinitionOfDone', () => {
    it('should update Definition of Done for a team', async () => {
      const mockItems = [
        {
          id: 'item-1',
          description: 'Code reviewed',
          category: 'review',
          isActive: true,
          order: 1,
        },
      ];
      const mockResponse = {
        success: true,
        data: {
          id: 'dod-1',
          teamId: 'team-1',
          items: mockItems,
          version: 2,
          updatedAt: '2024-01-02T00:00:00Z',
        },
      };
      vi.mocked(apiService.put).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.updateDefinitionOfDone('team-1', mockItems);

      expect(apiService.put).toHaveBeenCalledWith('/teams/team-1/definition-of-done', {
        items: mockItems,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getDoDHistory', () => {
    it('should get Definition of Done history for a team', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'dod-1',
            teamId: 'team-1',
            items: [],
            version: 1,
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'dod-2',
            teamId: 'team-1',
            items: [],
            version: 2,
            updatedAt: '2024-01-15T00:00:00Z',
          },
        ],
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDoDHistory('team-1');

      expect(apiService.get).toHaveBeenCalledWith('/teams/team-1/definition-of-done/history');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('verifyDoDForPBI', () => {
    it('should verify DoD items for a PBI', async () => {
      const verifications = [
        { dodItemId: 'item-1', isVerified: true, notes: 'Reviewed' },
        { dodItemId: 'item-2', isVerified: false },
      ];
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'verification-1',
            pbiId: 'pbi-1',
            dodItemId: 'item-1',
            isVerified: true,
            verifiedBy: 'user-1',
            verifiedAt: '2024-01-15T00:00:00Z',
            notes: 'Reviewed',
          },
          {
            id: 'verification-2',
            pbiId: 'pbi-1',
            dodItemId: 'item-2',
            isVerified: false,
            verifiedBy: 'user-1',
            verifiedAt: '2024-01-15T00:00:00Z',
          },
        ],
      };
      vi.mocked(apiService.post).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.verifyDoDForPBI('pbi-1', verifications);

      expect(apiService.post).toHaveBeenCalledWith('/product-backlog/pbi-1/verify-dod', {
        verifications,
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getDoDVerificationsForPBI', () => {
    it('should get DoD verifications for a PBI', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'verification-1',
            pbiId: 'pbi-1',
            dodItemId: 'item-1',
            isVerified: true,
            verifiedBy: 'user-1',
            verifiedAt: '2024-01-15T00:00:00Z',
          },
        ],
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDoDVerificationsForPBI('pbi-1');

      expect(apiService.get).toHaveBeenCalledWith('/product-backlog/pbi-1/dod-verifications');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getDoDComplianceReport', () => {
    it('should get DoD compliance report for a sprint', async () => {
      const mockResponse = {
        success: true,
        data: {
          sprintId: 'sprint-1',
          totalPBIs: 10,
          dodCompliantPBIs: 8,
          pendingVerification: 1,
          failedCompliance: 1,
          complianceRate: 80,
          pbiDetails: [
            {
              pbiId: 'pbi-1',
              pbiTitle: 'Feature 1',
              status: 'DONE',
              dodItemsTotal: 5,
              dodItemsVerified: 5,
              compliancePercentage: 100,
              verifications: [],
            },
          ],
        },
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDoDComplianceReport('sprint-1');

      expect(apiService.get).toHaveBeenCalledWith('/sprints/sprint-1/dod-compliance');
      expect(result.success).toBe(true);
      expect(result.data?.complianceRate).toBe(80);
      expect(result.data?.totalPBIs).toBe(10);
    });
  });

  describe('getDefinitionOfReady', () => {
    it('should get Definition of Ready for a team', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'dor-1',
          teamId: 'team-1',
          items: [
            {
              id: 'item-1',
              description: 'Acceptance criteria defined',
              category: 'Documentation',
              isActive: true,
              order: 1,
            },
          ],
          version: 1,
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDefinitionOfReady('team-1');

      expect(apiService.get).toHaveBeenCalledWith('/teams/team-1/definition-of-ready');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('dor-1');
    });
  });

  describe('updateDefinitionOfReady', () => {
    it('should update Definition of Ready for a team', async () => {
      const mockItems = [
        {
          id: 'item-1',
          description: 'Acceptance criteria defined',
          category: 'Documentation',
          isActive: true,
          order: 1,
        },
      ];
      const mockResponse = {
        success: true,
        data: {
          id: 'dor-1',
          teamId: 'team-1',
          items: mockItems,
          version: 2,
          updatedAt: '2024-01-02T00:00:00Z',
        },
      };
      vi.mocked(apiService.put).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.updateDefinitionOfReady('team-1', mockItems);

      expect(apiService.put).toHaveBeenCalledWith('/teams/team-1/definition-of-ready', {
        items: mockItems,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getDoRHistory', () => {
    it('should get Definition of Ready history for a team, in the shape the DoD history uses', async () => {
      // The same shape as the Definition of Done's history, so one component renders both badges.
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'dor-1',
            teamId: 'team-1',
            version: 1,
            items: [
              {
                description: 'Clear title and description provided',
                category: 'acceptance',
                isActive: true,
                order: 0,
                defaultKey: 'clearTitle',
              },
            ],
            createdAt: '2024-01-01T00:00:00Z',
            createdBy: 'user-1',
            createdByName: 'Test User',
            isCurrent: true,
          },
        ],
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDoRHistory('team-1');

      expect(apiService.get).toHaveBeenCalledWith('/teams/team-1/definition-of-ready/history');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.isCurrent).toBe(true);
      expect(result.data?.[0]?.items[0]?.defaultKey).toBe('clearTitle');
    });
  });

  describe('verifyDoRForPBI', () => {
    it('should verify DoR items for a PBI', async () => {
      const verifications = [{ dorItemId: 'item-1', isVerified: true, notes: 'Criteria defined' }];
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'verification-1',
            pbiId: 'pbi-1',
            dorItemId: 'item-1',
            isVerified: true,
            verifiedBy: 'user-1',
            verifiedAt: '2024-01-15T00:00:00Z',
            notes: 'Criteria defined',
          },
        ],
      };
      vi.mocked(apiService.post).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.verifyDoRForPBI('pbi-1', verifications);

      expect(apiService.post).toHaveBeenCalledWith('/product-backlog/pbi-1/verify-dor', {
        verifications,
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getDoRVerificationsForPBI', () => {
    it('should get DoR verifications for a PBI', async () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: 'verification-1',
            pbiId: 'pbi-1',
            dorItemId: 'item-1',
            isVerified: true,
            verifiedBy: 'user-1',
            verifiedAt: '2024-01-15T00:00:00Z',
          },
        ],
      };
      vi.mocked(apiService.get).mockResolvedValue({ data: mockResponse });

      const result = await definitionService.getDoRVerificationsForPBI('pbi-1');

      expect(apiService.get).toHaveBeenCalledWith('/product-backlog/pbi-1/dor-verifications');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });
});
