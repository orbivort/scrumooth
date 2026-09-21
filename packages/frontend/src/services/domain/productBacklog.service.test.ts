import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoSCoWPriority } from '../../types';
import type { BulkUploadItem } from '../../pages/Backlog/BulkUpload/bulkUploadUtils';
import { productBacklogService } from './productBacklog.service';
import { coreApiService } from '../core/api.core';

// Mock the core API service
vi.mock('../core/api.core', () => ({
  coreApiService: {
    axiosInstance: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('ProductBacklogService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProductBacklog', () => {
    it('should get product backlog with teamId', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            items: [
              { id: '1', title: 'Item 1', status: 'TODO' },
              { id: '2', title: 'Item 2', status: 'IN_PROGRESS' },
            ],
            pagination: {
              page: 1,
              limit: 20,
              total: 2,
              totalPages: 1,
            },
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await productBacklogService.getProductBacklog('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/product-backlog', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
    });

    it('should get product backlog with filters', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            items: [{ id: '1', title: 'Filtered Item', status: 'DONE' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await productBacklogService.getProductBacklog('team-1', {
        status: 'DONE',
        labels: 'bug,critical',
        page: 1,
        limit: 10,
      });

      expect(mockApi.get).toHaveBeenCalledWith('/product-backlog', {
        params: {
          teamId: 'team-1',
          status: 'DONE',
          labels: 'bug,critical',
          page: 1,
          limit: 10,
        },
      });
      expect(result.data?.items[0].status).toBe('DONE');
    });
  });

  describe('createProductBacklogItem', () => {
    it('should create a new backlog item', async () => {
      const itemData = {
        title: 'New Backlog Item',
        description: 'Description',
        priority: 'HIGH',
        teamId: 'team-1',
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '3', ...itemData },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await productBacklogService.createProductBacklogItem(itemData);

      expect(mockApi.post).toHaveBeenCalledWith('/product-backlog', itemData);
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('New Backlog Item');
    });

    it('should create item with minimal data', async () => {
      const itemData = { title: 'Quick Item' };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '4', title: 'Quick Item' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await productBacklogService.createProductBacklogItem(itemData);

      expect(mockApi.post).toHaveBeenCalledWith('/product-backlog', itemData);
      expect(result.success).toBe(true);
    });
  });

  describe('updateProductBacklogItem', () => {
    it('should update an existing backlog item', async () => {
      const updates = {
        title: 'Updated Title',
        description: 'Updated Description',
        priority: 'MEDIUM',
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', ...updates },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await productBacklogService.updateProductBacklogItem('1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/product-backlog/1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Updated Title');
    });

    it('should update item status', async () => {
      const updates = { status: 'IN_PROGRESS' };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', title: 'Item 1', status: 'IN_PROGRESS' },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await productBacklogService.updateProductBacklogItem('1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/product-backlog/1', updates);
      expect(result.data?.status).toBe('IN_PROGRESS');
    });
  });

  describe('updateBacklogItemPriority', () => {
    it('should update item priority', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', title: 'Item 1', priority: 'CRITICAL' },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await productBacklogService.updateBacklogItemPriority('1', 'CRITICAL');

      expect(mockApi.put).toHaveBeenCalledWith('/product-backlog/1/priority', {
        priority: 'CRITICAL',
      });
      expect(result.success).toBe(true);
      expect(result.data?.priority).toBe('CRITICAL');
    });

    it('should update priority to LOW', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '2', title: 'Item 2', priority: 'LOW' },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await productBacklogService.updateBacklogItemPriority('2', 'LOW');

      expect(mockApi.put).toHaveBeenCalledWith('/product-backlog/2/priority', {
        priority: 'LOW',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('reorderProductBacklogItems', () => {
    it('should send the canonical full ordered list and return the resulting order', async () => {
      const ordered = [
        { id: 'pbi-3', rank: 1, priority: MoSCoWPriority.MUST_HAVE },
        { id: 'pbi-1', rank: 2, priority: MoSCoWPriority.SHOULD_HAVE },
        { id: 'pbi-2', rank: 3, priority: MoSCoWPriority.COULD_HAVE },
      ];
      const mockResponse = { data: { success: true, data: { items: ordered } } };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await productBacklogService.reorderProductBacklogItems({
        pbiIds: ['pbi-3', 'pbi-1', 'pbi-2'],
      });

      expect(mockApi.post).toHaveBeenCalledWith('/product-backlog/reorder', {
        pbiIds: ['pbi-3', 'pbi-1', 'pbi-2'],
      });
      expect(result.data?.items).toEqual(ordered);
    });

    it('should send a positional move so a filtered view can reorder', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { items: [{ id: 'pbi-1', rank: 1, priority: MoSCoWPriority.MUST_HAVE }] },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      await productBacklogService.reorderProductBacklogItems({
        pbiId: 'pbi-1',
        targetPbiId: 'pbi-2',
        position: 'before',
      });

      expect(mockApi.post).toHaveBeenCalledWith('/product-backlog/reorder', {
        pbiId: 'pbi-1',
        targetPbiId: 'pbi-2',
        position: 'before',
      });
    });

    it('should surface the Product Owner gate refusal', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: {
            code: 'GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER',
            message: 'Only the Product Owner orders the Product Backlog',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await productBacklogService.reorderProductBacklogItems({
        pbiIds: ['pbi-1'],
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER');
    });
  });

  describe('deleteProductBacklogItem', () => {
    it('should delete a backlog item', async () => {
      const mockResponse = {
        data: { success: true },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await productBacklogService.deleteProductBacklogItem('1');

      expect(mockApi.delete).toHaveBeenCalledWith('/product-backlog/1');
      expect(result.success).toBe(true);
    });

    it('should handle delete with error response', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Item not found' },
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await productBacklogService.deleteProductBacklogItem('999');

      expect(mockApi.delete).toHaveBeenCalledWith('/product-backlog/999');
      expect(result.success).toBe(false);
    });
  });

  describe('bulkCreateProductBacklogItems', () => {
    it('should successfully bulk create backlog items', async () => {
      const items: BulkUploadItem[] = [
        {
          title: 'Feature A',
          description: 'Implement feature A',
          storyPoints: 5,
          businessValue: 10,
          priority: MoSCoWPriority.MUST_HAVE,
          labels: ['frontend'],
          acceptanceCriteria: 'Must work',
          _rowNumber: 1,
        },
        {
          title: 'Feature B',
          _rowNumber: 2,
        },
      ];
      const teamId = 'team-1';
      const goalId = 'goal-1';

      const mockResponse = {
        data: {
          success: true,
          data: {
            successful: 2,
            failed: 0,
            errors: [],
            createdItems: [
              { id: 'pbi-1', title: 'Feature A', teamId, goalId },
              { id: 'pbi-2', title: 'Feature B', teamId, goalId },
            ],
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await productBacklogService.bulkCreateProductBacklogItems(
        items,
        teamId,
        goalId
      );

      expect(mockApi.post).toHaveBeenCalledWith(
        '/product-backlog/bulk',
        expect.any(Array),
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.data?.successful).toBe(2);
      expect(result.data?.failed).toBe(0);
      expect(result.data?.createdItems).toHaveLength(2);
    });

    it('should POST to /product-backlog/bulk endpoint', async () => {
      const items: BulkUploadItem[] = [{ title: 'Item 1', _rowNumber: 1 }];
      const teamId = 'team-1';
      const goalId = 'goal-1';

      const mockResponse = {
        data: {
          success: true,
          data: { successful: 1, failed: 0, errors: [], createdItems: [] },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      await productBacklogService.bulkCreateProductBacklogItems(items, teamId, goalId);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/product-backlog/bulk',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should map items with teamId and goalId in request body', async () => {
      const items: BulkUploadItem[] = [
        {
          title: 'Feature A',
          description: 'Desc A',
          storyPoints: 3,
          businessValue: 8,
          priority: MoSCoWPriority.SHOULD_HAVE,
          labels: ['backend'],
          acceptanceCriteria: 'AC for A',
          _rowNumber: 1,
        },
      ];
      const teamId = 'team-1';
      const goalId = 'goal-1';

      const mockResponse = {
        data: {
          success: true,
          data: { successful: 1, failed: 0, errors: [], createdItems: [] },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      await productBacklogService.bulkCreateProductBacklogItems(items, teamId, goalId);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/product-backlog/bulk',
        [
          {
            teamId,
            goalId,
            title: 'Feature A',
            description: 'Desc A',
            storyPoints: 3,
            businessValue: 8,
            priority: MoSCoWPriority.SHOULD_HAVE,
            labels: ['backend'],
            acceptanceCriteria: 'AC for A',
            _rowNumber: 1,
          },
        ],
        expect.any(Object)
      );
    });

    it('should handle API error response', async () => {
      const items: BulkUploadItem[] = [{ title: 'Item 1', _rowNumber: 1 }];
      const teamId = 'team-1';
      const goalId = 'goal-1';

      const mockResponse = {
        data: {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid data' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await productBacklogService.bulkCreateProductBacklogItems(
        items,
        teamId,
        goalId
      );

      expect(mockApi.post).toHaveBeenCalledWith(
        '/product-backlog/bulk',
        expect.any(Array),
        expect.any(Object)
      );
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });
});
