import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRetrospectives,
  getRetrospectiveById,
  getRetrospectiveBySprintId,
  createRetrospective,
  addItem,
  voteItem,
  unvoteItem,
  updateItem,
  deleteItem,
  addActionItem,
  updateActionItem,
  deleteActionItem,
  updateRetrospective,
  getPendingActionItems,
  addRetroAttendee,
  updateRetroAttendee,
  deleteRetroAttendee,
  applyDodChanges,
  materializeActionItem,
  linkActionItemToPbi,
} from '../../../controllers/retrospective.controller';
import { retrospectiveService } from '../../../services/retrospective.service';
import { BadRequestError, NotFoundError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { createMockRequest, createMockResponse } from '../../setup/testSetup';

vi.mock('../../../services/retrospective.service', () => ({
  retrospectiveService: {
    getRetrospectivesByTeam: vi.fn(),
    getRetrospectiveById: vi.fn(),
    getRetrospectiveBySprintId: vi.fn(),
    createRetrospective: vi.fn(),
    addItem: vi.fn(),
    voteItem: vi.fn(),
    unvoteItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    addActionItem: vi.fn(),
    updateActionItem: vi.fn(),
    deleteActionItem: vi.fn(),
    updateRetrospective: vi.fn(),
    getPendingActionItemsByTeam: vi.fn(),
    addAttendee: vi.fn(),
    updateAttendee: vi.fn(),
    deleteAttendee: vi.fn(),
    applyDodChanges: vi.fn(),
    materializeActionItem: vi.fn(),
    linkActionItemToPbi: vi.fn(),
  },
}));

describe('Retrospective Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
  });

  describe('getRetrospectives', () => {
    it('should return retrospectives for a team', async () => {
      mockReq.params = { teamId: 'team-123' };
      const mockRetrospectives = [{ id: 'retro-1', name: 'Sprint 1 Retro' }];

      (retrospectiveService.getRetrospectivesByTeam as any).mockResolvedValue(mockRetrospectives);

      await getRetrospectives(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockRetrospectives,
      });
    });

    it('should return 404 when team not found', async () => {
      mockReq.params = { teamId: 'team-123' };
      const error = new NotFoundError('Team not found');

      (retrospectiveService.getRetrospectivesByTeam as any).mockRejectedValue(error);

      await getRetrospectives(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    });

    it('should return 500 on unexpected errors', async () => {
      mockReq.params = { teamId: 'team-123' };

      (retrospectiveService.getRetrospectivesByTeam as any).mockRejectedValue(
        new Error('Database error')
      );

      await getRetrospectives(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch retrospectives',
        },
      });
    });
  });

  describe('getRetrospectiveById', () => {
    it('should return retrospective by ID', async () => {
      mockReq.params = { id: 'retro-123' };
      const mockRetro = { id: 'retro-123', name: 'Test Retro' };

      (retrospectiveService.getRetrospectiveById as any).mockResolvedValue(mockRetro);

      await getRetrospectiveById(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockRetro,
      });
    });

    it('should return 404 when retrospective not found', async () => {
      mockReq.params = { id: 'retro-123' };
      const error = new NotFoundError('Retrospective not found');

      (retrospectiveService.getRetrospectiveById as any).mockRejectedValue(error);

      await getRetrospectiveById(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    });
  });

  describe('getRetrospectiveBySprintId', () => {
    it('should return retrospective by sprint ID', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      const mockRetro = { id: 'retro-123', sprintId: 'sprint-123' };

      (retrospectiveService.getRetrospectiveBySprintId as any).mockResolvedValue(mockRetro);

      await getRetrospectiveBySprintId(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockRetro,
      });
    });

    it('should return 500 on errors', async () => {
      mockReq.params = { sprintId: 'sprint-123' };

      (retrospectiveService.getRetrospectiveBySprintId as any).mockRejectedValue(
        new Error('Database error')
      );

      await getRetrospectiveBySprintId(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
    });
  });

  describe('createRetrospective', () => {
    it('should create a new retrospective', async () => {
      mockReq.body = { name: 'New Retro', teamId: 'team-123' };
      const mockRetro = { id: 'retro-123', name: 'New Retro' };

      (retrospectiveService.createRetrospective as any).mockResolvedValue(mockRetro);

      await createRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockRetro,
      });
    });

    it('should return 400 when retrospective already exists', async () => {
      mockReq.body = { name: 'New Retro' };

      (retrospectiveService.createRetrospective as any).mockRejectedValue(
        new Error('A retrospective already exists')
      );

      await createRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'RETROSPECTIVE_ALREADY_EXISTS',
          message: 'A retrospective already exists',
        },
      });
    });
  });

  describe('addItem', () => {
    it('should add item to retrospective', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { content: 'Good teamwork', category: 'WENT_WELL' };
      const mockItem = { id: 'item-123', content: 'Good teamwork' };

      (retrospectiveService.addItem as any).mockResolvedValue(mockItem);

      await addItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockItem,
      });
    });

    it('should return 404 when retrospective not found', async () => {
      mockReq.params = { retroId: 'retro-123' };
      const error = new NotFoundError('Retrospective not found');

      (retrospectiveService.addItem as any).mockRejectedValue(error);

      await addItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
    });
  });

  describe('voteItem', () => {
    it('should vote for an item', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.user = { id: 'user-123' };
      const mockItem = { id: 'item-456', votes: 1 };

      (retrospectiveService.voteItem as any).mockResolvedValue(mockItem);

      await voteItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockItem,
      });
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.user = undefined;

      await voteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
    });
  });

  describe('unvoteItem', () => {
    it('should remove vote from an item', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.user = { id: 'user-123' };
      const mockItem = { id: 'item-456', votes: 0 };

      (retrospectiveService.unvoteItem as any).mockResolvedValue(mockItem);

      await unvoteItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockItem,
      });
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.user = undefined;

      await unvoteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(401);
    });
  });

  describe('updateItem', () => {
    it('should update an item', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.body = { content: 'Updated content' };
      const mockItem = { id: 'item-456', content: 'Updated content' };

      (retrospectiveService.updateItem as any).mockResolvedValue(mockItem);

      await updateItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockItem,
      });
    });

    it('should return 404 when item not found', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      const error = new NotFoundError('Item not found');

      (retrospectiveService.updateItem as any).mockRejectedValue(error);

      await updateItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
    });
  });

  describe('deleteItem', () => {
    it('should delete an item', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };

      (retrospectiveService.deleteItem as any).mockResolvedValue(undefined);

      await deleteItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: null,
      });
    });
  });

  describe('addActionItem', () => {
    it('should add action item', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { title: 'Action item 1', assigneeId: 'user-123' };
      const mockActionItem = { id: 'action-123', title: 'Action item 1' };

      (retrospectiveService.addActionItem as any).mockResolvedValue(mockActionItem);

      await addActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockActionItem,
      });
    });
  });

  describe('updateActionItem', () => {
    it('should update action item', async () => {
      mockReq.params = { retroId: 'retro-123', actionItemId: 'action-456' };
      mockReq.body = { status: 'COMPLETED' };
      const mockActionItem = { id: 'action-456', status: 'COMPLETED' };

      (retrospectiveService.updateActionItem as any).mockResolvedValue(mockActionItem);

      await updateActionItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockActionItem,
      });
    });
  });

  describe('deleteActionItem', () => {
    it('should delete action item', async () => {
      mockReq.params = { retroId: 'retro-123', actionItemId: 'action-456' };

      (retrospectiveService.deleteActionItem as any).mockResolvedValue(undefined);

      await deleteActionItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: null,
      });
    });
  });

  describe('updateRetrospective', () => {
    it('should update retrospective', async () => {
      mockReq.params = { id: 'retro-123' };
      mockReq.body = { name: 'Updated Retro' };
      const mockRetro = { id: 'retro-123', name: 'Updated Retro' };

      (retrospectiveService.updateRetrospective as any).mockResolvedValue(mockRetro);

      await updateRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockRetro,
      });
    });
  });

  describe('getPendingActionItems', () => {
    it('should return pending action items', async () => {
      mockReq.params = { teamId: 'team-123' };
      const mockItems = [{ id: 'action-1', title: 'Pending action' }];

      (retrospectiveService.getPendingActionItemsByTeam as any).mockResolvedValue(mockItems);

      await getPendingActionItems(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockItems,
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};

      await getPendingActionItems(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Team ID is required',
        },
      });
    });
  });

  describe('addRetroAttendee', () => {
    it('should add attendee', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { name: 'John Doe', email: 'john@example.com', role: 'DEVELOPERS' };
      const mockAttendee = { id: 'attendee-123', name: 'John Doe' };

      (retrospectiveService.addAttendee as any).mockResolvedValue(mockAttendee);

      await addRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockAttendee,
      });
    });

    it('should trim name and email', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { name: '  John Doe  ', email: '  john@example.com  ', role: 'DEVELOPERS' };
      const mockAttendee = { id: 'attendee-123', name: 'John Doe' };

      (retrospectiveService.addAttendee as any).mockResolvedValue(mockAttendee);

      await addRetroAttendee(mockReq as any, mockRes as any);

      expect(retrospectiveService.addAttendee).toHaveBeenCalledWith(
        'retro-123',
        {
          name: 'John Doe',
          email: 'john@example.com',
          role: 'DEVELOPERS',
          attended: true,
        },
        'user-123'
      );
    });
  });

  describe('updateRetroAttendee', () => {
    it('should update attendee', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };
      mockReq.body = { name: 'Updated Name', attended: false };
      const mockAttendee = { id: 'attendee-123', name: 'Updated Name' };

      (retrospectiveService.updateAttendee as any).mockResolvedValue(mockAttendee);

      await updateRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockAttendee,
      });
    });
  });

  describe('deleteRetroAttendee', () => {
    it('should delete attendee', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };

      (retrospectiveService.deleteAttendee as any).mockResolvedValue(undefined);

      await deleteRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Participant removed successfully' },
      });
    });

    it('should return 404 when attendee not found', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };
      const error = new NotFoundError('Attendee not found');

      (retrospectiveService.deleteAttendee as any).mockRejectedValue(error);

      await deleteRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    });

    it('should return 500 on unexpected errors', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };

      (retrospectiveService.deleteAttendee as any).mockRejectedValue(new Error('Database error'));

      await deleteRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete participant',
        },
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing params gracefully', async () => {
      mockReq.params = {};

      (retrospectiveService.getRetrospectivesByTeam as any).mockRejectedValue(
        new Error('Team ID is required')
      );

      await getRetrospectives(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
    });

    it('should handle service throwing non-Error objects', async () => {
      mockReq.params = { id: 'retro-123' };

      (retrospectiveService.getRetrospectiveById as any).mockRejectedValue('String error');

      await getRetrospectiveById(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
    });

    it('should handle null response from service', async () => {
      mockReq.params = { sprintId: 'sprint-123' };

      (retrospectiveService.getRetrospectiveBySprintId as any).mockResolvedValue(null);

      await getRetrospectiveBySprintId(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: null,
      });
    });

    it('should handle update retrospective with partial data', async () => {
      mockReq.params = { id: 'retro-123' };
      mockReq.body = { summary: 'Updated summary only' };
      const mockRetro = { id: 'retro-123', summary: 'Updated summary only' };

      (retrospectiveService.updateRetrospective as any).mockResolvedValue(mockRetro);

      await updateRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockRetro,
      });
    });

    it('should handle addActionItem with minimal data', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { title: 'Action item' };
      const mockActionItem = { id: 'action-123', title: 'Action item' };

      (retrospectiveService.addActionItem as any).mockResolvedValue(mockActionItem);

      await addActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(201);
    });

    it('should handle updateActionItem with all fields', async () => {
      mockReq.params = { retroId: 'retro-123', actionItemId: 'action-456' };
      mockReq.body = {
        title: 'Updated Title',
        description: 'Updated Description',
        status: 'COMPLETED',
        dueDate: '2024-12-31',
      };
      const mockActionItem = {
        id: 'action-456',
        title: 'Updated Title',
        description: 'Updated Description',
        status: 'COMPLETED',
        dueDate: '2024-12-31',
      };

      (retrospectiveService.updateActionItem as any).mockResolvedValue(mockActionItem);

      await updateActionItem(mockReq as any, mockRes as any);

      expect(mockRes._json).toEqual({
        success: true,
        data: mockActionItem,
      });
    });

    it('should handle deleteItem with 404 error', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      const error = new NotFoundError('Item not found');

      (retrospectiveService.deleteItem as any).mockRejectedValue(error);

      await deleteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json.error.code).toBe('NOT_FOUND');
    });

    it('should handle deleteActionItem with 404 error', async () => {
      mockReq.params = { retroId: 'retro-123', actionItemId: 'action-456' };
      const error = new NotFoundError('Action item not found');

      (retrospectiveService.deleteActionItem as any).mockRejectedValue(error);

      await deleteActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json.error.code).toBe('NOT_FOUND');
    });

    it('should handle updateRetroAttendee with 404 error', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };
      mockReq.body = { name: 'Updated Name' };
      const error = new NotFoundError('Attendee not found');

      (retrospectiveService.updateAttendee as any).mockRejectedValue(error);

      await updateRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json.error.code).toBe('NOT_FOUND');
    });

    it('should handle voteItem with 500 error', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.user = { id: 'user-123' };

      (retrospectiveService.voteItem as any).mockRejectedValue(new Error('Database error'));

      await voteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle unvoteItem with 500 error', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.user = { id: 'user-123' };

      (retrospectiveService.unvoteItem as any).mockRejectedValue(new Error('Database error'));

      await unvoteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle getPendingActionItems with 500 error', async () => {
      mockReq.params = { teamId: 'team-123' };

      (retrospectiveService.getPendingActionItemsByTeam as any).mockRejectedValue(
        new Error('Database error')
      );

      await getPendingActionItems(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle addRetroAttendee with 500 error', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { name: 'John Doe', role: 'DEVELOPERS' };

      (retrospectiveService.addAttendee as any).mockRejectedValue(new Error('Database error'));

      await addRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle empty teamId in getPendingActionItems', async () => {
      mockReq.params = { teamId: '' };

      await getPendingActionItems(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle createRetrospective with 500 error for unexpected errors', async () => {
      mockReq.body = { name: 'New Retro', teamId: 'team-123' };

      (retrospectiveService.createRetrospective as any).mockRejectedValue(
        new Error('Database error')
      );

      await createRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle updateItem with 500 error', async () => {
      mockReq.params = { retroId: 'retro-123', itemId: 'item-456' };
      mockReq.body = { content: 'Updated content' };

      (retrospectiveService.updateItem as any).mockRejectedValue(new Error('Database error'));

      await updateItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle addItem with 500 error', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { content: 'New item', category: 'WENT_WELL' };

      (retrospectiveService.addItem as any).mockRejectedValue(new Error('Database error'));

      await addItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle updateActionItem with 500 error', async () => {
      mockReq.params = { retroId: 'retro-123', actionItemId: 'action-456' };
      mockReq.body = { status: 'COMPLETED' };

      (retrospectiveService.updateActionItem as any).mockRejectedValue(new Error('Database error'));

      await updateActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should handle addRetroAttendee with attended set to false', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.userId = 'user-123';
      mockReq.body = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'DEVELOPERS',
        attended: false,
      };
      const mockAttendee = { id: 'attendee-123', name: 'John Doe', attended: false };

      (retrospectiveService.addAttendee as any).mockResolvedValue(mockAttendee);

      await addRetroAttendee(mockReq as any, mockRes as any);

      expect(retrospectiveService.addAttendee).toHaveBeenCalledWith(
        'retro-123',
        {
          name: 'John Doe',
          email: 'john@example.com',
          role: 'DEVELOPERS',
          attended: false,
        },
        'user-123'
      );
      expect(mockRes._status).toBe(201);
    });

    it('should handle updateRetroAttendee with partial updates', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { attended: true };
      const mockAttendee = { id: 'attendee-123', name: 'John Doe', attended: true };

      (retrospectiveService.updateAttendee as any).mockResolvedValue(mockAttendee);

      await updateRetroAttendee(mockReq as any, mockRes as any);

      expect(retrospectiveService.updateAttendee).toHaveBeenCalledWith(
        'attendee-123',
        {
          attended: true,
        },
        'user-123'
      );
    });

    it('should handle updateRetroAttendee with email as empty string', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { name: 'John Doe', email: '' };
      const mockAttendee = { id: 'attendee-123', name: 'John Doe', email: undefined };

      (retrospectiveService.updateAttendee as any).mockResolvedValue(mockAttendee);

      await updateRetroAttendee(mockReq as any, mockRes as any);

      expect(retrospectiveService.updateAttendee).toHaveBeenCalledWith(
        'attendee-123',
        {
          name: 'John Doe',
          email: undefined,
        },
        'user-123'
      );
    });
  });

  describe('gate refusals', () => {
    it('should propagate a gate refusal with its own status and code, not a generic 500', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { category: 'WENT_WELL', content: 'x' };

      (retrospectiveService.addItem as any).mockRejectedValue(
        new BadRequestError(
          'The Retrospective belongs to its Scrum Team',
          undefined,
          GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY
        )
      );

      await addItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json.error.code).toBe(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY);
    });
  });

  describe('applyDodChanges', () => {
    it('should apply the recorded Definition of Done changes', async () => {
      mockReq.params = { id: 'retro-123' };
      mockReq.userId = 'user-123';
      const updated = { id: 'retro-123', dodVersionAtPush: 4 };

      (retrospectiveService.applyDodChanges as any).mockResolvedValue(updated);

      await applyDodChanges(mockReq as any, mockRes as any);

      expect(retrospectiveService.applyDodChanges).toHaveBeenCalledWith('retro-123', 'user-123');
      expect(mockRes._json).toEqual({ success: true, data: updated });
    });

    it('should propagate the refusal when nothing was inspected', async () => {
      mockReq.params = { id: 'retro-123' };
      mockReq.userId = 'user-123';

      (retrospectiveService.applyDodChanges as any).mockRejectedValue(
        new BadRequestError(
          'Nothing to apply',
          undefined,
          GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING
        )
      );

      await applyDodChanges(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json.error.code).toBe(GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING);
    });
  });

  describe('materializeActionItem', () => {
    it('should create a backlog item from the action item', async () => {
      mockReq.params = { actionItemId: 'action-123' };
      mockReq.userId = 'user-123';
      const linked = { id: 'action-123', productBacklogItemId: 'pbi-1' };

      (retrospectiveService.materializeActionItem as any).mockResolvedValue(linked);

      await materializeActionItem(mockReq as any, mockRes as any);

      expect(retrospectiveService.materializeActionItem).toHaveBeenCalledWith(
        'action-123',
        'user-123'
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({ success: true, data: linked });
    });

    it('should require the action item id', async () => {
      mockReq.params = {};

      await materializeActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.materializeActionItem).not.toHaveBeenCalled();
    });
  });

  describe('linkActionItemToPbi', () => {
    it('should link the action item to an existing backlog item', async () => {
      mockReq.params = { actionItemId: 'action-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { pbiId: 'pbi-1' };
      const linked = { id: 'action-123', productBacklogItemId: 'pbi-1' };

      (retrospectiveService.linkActionItemToPbi as any).mockResolvedValue(linked);

      await linkActionItemToPbi(mockReq as any, mockRes as any);

      expect(retrospectiveService.linkActionItemToPbi).toHaveBeenCalledWith(
        'action-123',
        'pbi-1',
        'user-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: linked });
    });
  });

  describe('missing params', () => {
    it('getRetrospectiveById requires an id', async () => {
      mockReq.params = {};

      await getRetrospectiveById(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json.error.code).toBe('VALIDATION_ERROR');
      expect(retrospectiveService.getRetrospectiveById).not.toHaveBeenCalled();
    });

    it('getRetrospectiveBySprintId requires a sprint id', async () => {
      mockReq.params = {};

      await getRetrospectiveBySprintId(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.getRetrospectiveBySprintId).not.toHaveBeenCalled();
    });

    it('addItem requires a retrospective id', async () => {
      mockReq.params = {};

      await addItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.addItem).not.toHaveBeenCalled();
    });

    it('voteItem requires ids once authenticated', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'user-123' };

      await voteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.voteItem).not.toHaveBeenCalled();
    });

    it('unvoteItem requires ids once authenticated', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'user-123' };

      await unvoteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.unvoteItem).not.toHaveBeenCalled();
    });

    it('updateItem requires ids', async () => {
      mockReq.params = {};

      await updateItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.updateItem).not.toHaveBeenCalled();
    });

    it('deleteItem requires ids', async () => {
      mockReq.params = {};

      await deleteItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.deleteItem).not.toHaveBeenCalled();
    });

    it('addActionItem requires a retrospective id', async () => {
      mockReq.params = {};

      await addActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.addActionItem).not.toHaveBeenCalled();
    });

    it('updateActionItem requires ids', async () => {
      mockReq.params = {};

      await updateActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.updateActionItem).not.toHaveBeenCalled();
    });

    it('deleteActionItem requires ids', async () => {
      mockReq.params = {};

      await deleteActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.deleteActionItem).not.toHaveBeenCalled();
    });

    it('updateRetrospective requires an id', async () => {
      mockReq.params = {};

      await updateRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.updateRetrospective).not.toHaveBeenCalled();
    });

    it('addRetroAttendee requires a retrospective id', async () => {
      mockReq.params = {};
      mockReq.body = { name: 'John Doe' };

      await addRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.addAttendee).not.toHaveBeenCalled();
    });

    it('updateRetroAttendee requires an attendee id', async () => {
      mockReq.params = {};
      mockReq.body = {};

      await updateRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.updateAttendee).not.toHaveBeenCalled();
    });

    it('deleteRetroAttendee requires an attendee id', async () => {
      mockReq.params = {};

      await deleteRetroAttendee(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.deleteAttendee).not.toHaveBeenCalled();
    });

    it('applyDodChanges requires an id', async () => {
      mockReq.params = {};

      await applyDodChanges(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.applyDodChanges).not.toHaveBeenCalled();
    });

    it('linkActionItemToPbi requires an action item id', async () => {
      mockReq.params = {};
      mockReq.body = { pbiId: 'pbi-1' };

      await linkActionItemToPbi(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(400);
      expect(retrospectiveService.linkActionItemToPbi).not.toHaveBeenCalled();
    });
  });

  describe('attendee email handling', () => {
    it('trims a provided email when updating an attendee', async () => {
      mockReq.params = { attendeeId: 'attendee-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { email: '  john@example.com  ' };
      const mockAttendee = { id: 'attendee-123', email: 'john@example.com' };

      (retrospectiveService.updateAttendee as any).mockResolvedValue(mockAttendee);

      await updateRetroAttendee(mockReq as any, mockRes as any);

      expect(retrospectiveService.updateAttendee).toHaveBeenCalledWith(
        'attendee-123',
        expect.objectContaining({ email: 'john@example.com' }),
        'user-123'
      );
    });
  });

  describe('error propagation', () => {
    it('addActionItem returns 500 when the service fails', async () => {
      mockReq.params = { retroId: 'retro-123' };
      mockReq.body = { title: 'Action' };

      (retrospectiveService.addActionItem as any).mockRejectedValue(new Error('boom'));

      await addActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
      expect(mockRes._json.error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('updateRetrospective returns 500 when the service fails', async () => {
      mockReq.params = { id: 'retro-123' };
      mockReq.body = {};

      (retrospectiveService.updateRetrospective as any).mockRejectedValue(new Error('boom'));

      await updateRetrospective(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
    });

    it('materializeActionItem returns 500 when the service fails', async () => {
      mockReq.params = { actionItemId: 'action-1' };
      mockReq.userId = 'user-123';

      (retrospectiveService.materializeActionItem as any).mockRejectedValue(new Error('boom'));

      await materializeActionItem(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
    });

    it('linkActionItemToPbi returns 500 when the service fails', async () => {
      mockReq.params = { actionItemId: 'action-1' };
      mockReq.userId = 'user-123';
      mockReq.body = { pbiId: 'pbi-1' };

      (retrospectiveService.linkActionItemToPbi as any).mockRejectedValue(new Error('boom'));

      await linkActionItemToPbi(mockReq as any, mockRes as any);

      expect(mockRes._status).toBe(500);
    });
  });
});
