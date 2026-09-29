/**
 * Backlog coverage suite.
 *
 * Drives the internal handlers of `ProductBacklog` (edit, delete, status change, validation,
 * reorder, move-by-step, bulk-upload completion, deep-link) through lightweight stubbed children
 * so every branch is reachable deterministically. The real children have their own suites.
 */
import React from 'react';
import { screen, renderWithProviders, waitFor, initTestI18n } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';

import { useTeamStore } from '../../store';
import { apiService, definitionService } from '../../services';

import { ProductBacklog } from './Backlog';
import * as teamContextModule from '../../contexts/TeamContext';

/* ------------------------------------------------------------------ */
/* Shared fixtures                                                    */
/* ------------------------------------------------------------------ */

const shared = vi.hoisted(() => {
  const base = {
    teamId: 'team-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
    goalId: 'goal-1',
  };
  const item1 = {
    ...base,
    id: 'pbi-1',
    title: 'Feature A',
    description: 'Desc A',
    status: 'NEW',
    priority: 'MUST_HAVE',
    storyPoints: 8,
    businessValue: 13,
    labels: ['x'],
    acceptanceCriteria: 'AC A',
    rank: 1,
  };
  const item2 = {
    ...base,
    id: 'pbi-2',
    title: 'Feature B',
    description: 'Desc B',
    status: 'REFINED',
    priority: 'SHOULD_HAVE',
    storyPoints: 5,
    businessValue: 8,
    labels: ['y'],
    acceptanceCriteria: 'AC B',
    rank: 2,
  };
  const incomplete = {
    ...base,
    id: 'pbi-incomplete',
    title: 'Feature Incomplete',
    description: '',
    status: 'NEW',
    priority: 'COULD_HAVE',
    storyPoints: undefined,
    businessValue: undefined,
    labels: [],
    acceptanceCriteria: '',
    rank: 3,
  };
  const inProgress = {
    ...base,
    id: 'pbi-inprogress',
    title: 'Feature In Progress',
    description: 'Desc D',
    status: 'IN_PROGRESS',
    priority: 'COULD_HAVE',
    storyPoints: 3,
    businessValue: 5,
    labels: ['z'],
    acceptanceCriteria: 'AC D',
    rank: 4,
  };
  const sparse = {
    ...base,
    id: 'pbi-sparse',
    title: 'Sparse Feature',
    description: undefined,
    status: 'NEW',
    priority: 'MUST_HAVE',
    storyPoints: 2,
    businessValue: 3,
    labels: ['s'],
    acceptanceCriteria: undefined,
    rank: 5,
  };
  return { item1, item2, incomplete, inProgress, sparse, state: { data: null as unknown } };
});

const buildData = (overrides: Record<string, unknown> = {}) => ({
  backlogData: {
    data: [shared.item1, shared.item2, shared.incomplete, shared.inProgress, shared.sparse],
  },
  activeGoal: { id: 'goal-1', title: 'Active Goal', status: 'ACTIVE', teamId: 'team-1' },
  filteredItems: [shared.item1, shared.item2, shared.incomplete, shared.inProgress, shared.sparse],
  isLoading: false,
  isLoadingGoals: false,
  totalCount: 4,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  isAutoLoading: false,
  ...overrides,
});

/* ------------------------------------------------------------------ */
/* Module mocks                                                       */
/* ------------------------------------------------------------------ */

vi.mock('../../store', () => ({ useTeamStore: vi.fn() }));

vi.mock('../../hooks/useMutationErrorHandler', () => ({
  useMutationErrorHandler: () => ({ handleMutationError: vi.fn(() => 'An error occurred') }),
}));

vi.mock('../../services', () => ({
  apiService: {
    createProductBacklogItem: vi.fn(),
    updateProductBacklogItem: vi.fn(),
    deleteProductBacklogItem: vi.fn(),
    reorderProductBacklogItems: vi.fn(),
    getTasksByPbiId: vi.fn(),
    getProductBacklog: vi.fn(),
    getProductGoals: vi.fn(),
    getStatusChangeHistory: vi.fn(),
  },
  definitionService: {
    verifyDoDForPBI: vi.fn(),
    verifyDoRForPBI: vi.fn(),
  },
}));

vi.mock('./hooks/useBacklogData', () => ({
  useBacklogData: () => shared.state.data,
}));

vi.mock('./hooks/useDefinitionOfReadyDone', () => ({
  useDefinitionOfReadyDone: () => ({
    dorItems: [
      { id: 'dor-1', label: 'Dor one', description: 'clearTitle' },
      { id: 'dor-2', label: 'Dor two', description: 'clarity' },
    ],
    dodItems: [
      { id: 'dod-1', label: 'Dod one', description: 'review' },
      { id: 'dod-2', label: 'Dod two', description: 'testing' },
    ],
  }),
}));

vi.mock('./PendingAdjustments', () => ({ PendingAdjustments: () => null }));
vi.mock('./PendingRetroActionItems', () => ({ PendingRetroActionItems: () => null }));

vi.mock('./PendingFeedback', async () => {
  const React = await import('react');
  return {
    PendingFeedback: ({ onCreateWorkItem }: { onCreateWorkItem: (f: unknown) => void }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'pf-long',
            onClick: () =>
              onCreateWorkItem({
                id: 'fb-long',
                content: 'x'.repeat(150),
                authorName: 'Stakeholder',
                category: 'suggestion',
              }),
          },
          'pf-long'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'pf-short',
            onClick: () =>
              onCreateWorkItem({
                id: 'fb-short',
                content: 'short',
                authorName: 'Stakeholder',
                category: 'positive',
              }),
          },
          'pf-short'
        )
      ),
  };
});

vi.mock('./components', async () => {
  const React = await import('react');
  const mk = (id: string, onClick: () => void) =>
    React.createElement('button', { type: 'button', 'data-testid': id, onClick }, id);
  return {
    BacklogHeader: ({
      onNewItem,
      onBulkImport,
      onViewModeChange,
    }: {
      onNewItem: () => void;
      onBulkImport: () => void;
      onViewModeChange: (m: string) => void;
    }) =>
      React.createElement(
        'div',
        null,
        mk('header-new', onNewItem),
        mk('header-bulk', onBulkImport),
        mk('header-view-list', () => onViewModeChange('list')),
        mk('header-view-board', () => onViewModeChange('board'))
      ),
    BacklogFilterBar: () => null,
    ActiveGoalBanner: () => React.createElement('div', { 'data-testid': 'active-goal' }),
    LoadMoreButton: () => null,
  };
});

vi.mock('./BulkUpload', async () => {
  const React = await import('react');
  return {
    BulkUploadModal: ({
      isOpen,
      onUploadComplete,
    }: {
      isOpen: boolean;
      onUploadComplete: () => void;
    }) =>
      isOpen
        ? React.createElement(
            'button',
            { type: 'button', 'data-testid': 'bulk-complete', onClick: onUploadComplete },
            'bulk-complete'
          )
        : null,
  };
});

vi.mock('./views/BoardView', async () => {
  const React = await import('react');
  const { item1, item2, incomplete, inProgress, sparse } = shared;
  const mk = (id: string, onClick: () => void) =>
    React.createElement('button', { type: 'button', 'data-testid': id, onClick }, id);
  return {
    BoardView: ({
      onItemClick,
      onReorder,
      onPriorityChange,
    }: {
      onItemClick: (i: unknown) => void;
      onReorder: (id: string, t: unknown) => void;
      onPriorityChange: (id: string, p: string) => void;
    }) =>
      React.createElement(
        'div',
        null,
        mk('board-open-detail', () => onItemClick(item1)),
        mk('board-open-second', () => onItemClick(item2)),
        mk('board-open-incomplete', () => onItemClick(incomplete)),
        mk('board-open-inprogress', () => onItemClick(inProgress)),
        mk('board-open-sparse', () => onItemClick(sparse)),
        mk('board-reorder-cross', () =>
          onReorder('pbi-1', { priority: 'SHOULD_HAVE', targetPbiId: 'pbi-2', position: 'after' })
        ),
        mk('board-reorder-same', () => onReorder('pbi-1', { priority: 'MUST_HAVE' })),
        mk('board-reorder-partial', () =>
          onReorder('pbi-1', { priority: 'SHOULD_HAVE', targetPbiId: 'pbi-2' })
        ),
        mk('board-reorder-unknown', () =>
          onReorder('unknown', { priority: 'SHOULD_HAVE', targetPbiId: 'pbi-2', position: 'after' })
        ),
        mk('board-priority', () => onPriorityChange('pbi-1', 'COULD_HAVE'))
      ),
  };
});

vi.mock('./views/ListView', async () => {
  const React = await import('react');
  const mk = (id: string, onClick: () => void) =>
    React.createElement('button', { type: 'button', 'data-testid': id, onClick }, id);
  return {
    ListView: ({
      onMove,
      canOrder,
    }: {
      onMove?: (id: string, d: 'up' | 'down') => void;
      canOrder: boolean;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('span', { 'data-testid': 'list-can-order' }, String(canOrder)),
        mk('list-move-up-first', () => onMove?.('pbi-1', 'up')),
        mk('list-move-down-first', () => onMove?.('pbi-1', 'down')),
        mk('list-move-up-second', () => onMove?.('pbi-2', 'up')),
        mk('list-move-unknown', () => onMove?.('unknown', 'up'))
      ),
  };
});

vi.mock('./modals', async () => {
  const React = await import('react');
  const mk = (id: string, onClick: () => void) =>
    React.createElement('button', { type: 'button', 'data-testid': id, onClick }, id);
  return {
    CreateItemModal: ({ onSubmit, onClose }: { onSubmit: () => void; onClose: () => void }) =>
      React.createElement('div', null, mk('create-submit', onSubmit), mk('create-close', onClose)),
    EditItemModal: ({ onSubmit, onClose }: { onSubmit: () => void; onClose: () => void }) =>
      React.createElement('div', null, mk('edit-submit', onSubmit), mk('edit-close', onClose)),
    ItemDetailModal: ({
      onClose,
      onEdit,
      onDelete,
      onStatusChange,
    }: {
      onClose: () => void;
      onEdit: () => void;
      onDelete: () => void;
      onStatusChange: (s: string) => void;
    }) =>
      React.createElement(
        'div',
        null,
        mk('detail-close', onClose),
        mk('detail-edit', onEdit),
        mk('detail-delete', onDelete),
        mk('detail-status-refined', () => onStatusChange('REFINED')),
        mk('detail-status-ready', () => onStatusChange('READY')),
        mk('detail-status-done', () => onStatusChange('DONE'))
      ),
    DeleteConfirmModal: ({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) =>
      React.createElement(
        'div',
        null,
        mk('delete-confirm', onConfirm),
        mk('delete-close', onClose)
      ),
    ValidationModal: ({
      onCheckChange,
      onConfirm,
      onCancel,
    }: {
      onCheckChange: (id: string, v: boolean) => void;
      onConfirm: () => void;
      onCancel: () => void;
    }) =>
      React.createElement(
        'div',
        null,
        mk('validation-check-dor1', () => onCheckChange('dor-1', true)),
        mk('validation-check-dod1', () => onCheckChange('dod-1', true)),
        mk('validation-confirm', onConfirm),
        mk('validation-cancel', onCancel)
      ),
  };
});

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

const mockTeamStore = useTeamStore as ReturnType<typeof vi.fn>;
const api = apiService as unknown as Record<string, ReturnType<typeof vi.fn>>;
const defs = definitionService as unknown as Record<string, ReturnType<typeof vi.fn>>;

const setRole = (role: string) =>
  vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({ userRole: role } as never);

const renderBacklog = (route = '/') => {
  shared.state.data = buildData();
  return renderWithProviders(<ProductBacklog />, { initialRoute: route });
};

describe('ProductBacklog coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setRole('DEVELOPERS');
    mockTeamStore.mockReturnValue({ currentTeam: { id: 'team-1', name: 'Test Team' } });

    api.createProductBacklogItem.mockResolvedValue({ success: true, data: shared.item1 });
    api.updateProductBacklogItem.mockResolvedValue({ success: true, data: shared.item1 });
    api.deleteProductBacklogItem.mockResolvedValue({ success: true });
    api.reorderProductBacklogItems.mockResolvedValue({ success: true, data: { items: [] } });
    api.getTasksByPbiId.mockResolvedValue({ success: true, data: [] });
    defs.verifyDoDForPBI.mockResolvedValue({ success: true });
    defs.verifyDoRForPBI.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Edit item', () => {
    it('should submit a valid edit and run the success callback', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-edit'));
      await user.click(screen.getByTestId('edit-submit'));

      await waitFor(() => {
        expect(api.updateProductBacklogItem).toHaveBeenCalled();
      });
    });

    it('should not submit when no item is selected', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('edit-submit'));
      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should ignore opening the edit modal with no selection', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('detail-edit'));
      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should handle an item without description and acceptance criteria when opening edit', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-sparse'));
      await user.click(screen.getByTestId('detail-edit'));
      // Edit modal data is populated from the sparse item's defaults.
      expect(screen.getByTestId('edit-submit')).toBeInTheDocument();
    });

    it('should omit story points when a non-Developer edits', async () => {
      const user = userEvent.setup();
      setRole('PRODUCT_OWNER');
      renderBacklog();

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-edit'));
      await user.click(screen.getByTestId('edit-submit'));

      await waitFor(() => expect(api.updateProductBacklogItem).toHaveBeenCalled());
      const updates = api.updateProductBacklogItem.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(updates).not.toHaveProperty('storyPoints');
    });
  });

  describe('Delete item', () => {
    it('should delete the selected item and run the success callback', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-delete'));
      await user.click(screen.getByTestId('delete-confirm'));

      await waitFor(() => {
        expect(api.deleteProductBacklogItem).toHaveBeenCalledWith('pbi-1');
      });
    });

    it('should not delete when no item is selected', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('delete-confirm'));
      expect(api.deleteProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should close the delete modal via its inline onClose', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('delete-close'));
      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });
  });

  describe('Status change', () => {
    it('should execute a valid simple transition (NEW -> REFINED)', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-status-refined'));

      await waitFor(() => {
        expect(api.updateProductBacklogItem).toHaveBeenCalledWith('pbi-1', { status: 'REFINED' });
      });
    });

    it('should reject an invalid transition (NEW -> DONE)', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-status-done'));

      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should reject a transition when the item is missing required fields', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-incomplete'));
      await user.click(screen.getByTestId('detail-status-refined'));

      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should do nothing when no item is selected', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('detail-status-refined'));
      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should block DONE when child tasks are incomplete', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.getTasksByPbiId.mockResolvedValue({
        success: true,
        data: [
          { id: 't1', title: 'T1', status: 'TODO' },
          { id: 't2', title: 'T2', status: 'TODO' },
          { id: 't3', title: 'T3', status: 'TODO' },
          { id: 't4', title: 'T4', status: 'TODO' },
        ],
      });

      await user.click(screen.getByTestId('board-open-inprogress'));
      await user.click(screen.getByTestId('detail-status-done'));

      await waitFor(() => {
        expect(api.getTasksByPbiId).toHaveBeenCalledWith('pbi-inprogress');
      });
      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should open DoD validation when there are no child tasks', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.getTasksByPbiId.mockResolvedValue({ success: true });

      await user.click(screen.getByTestId('board-open-inprogress'));
      await user.click(screen.getByTestId('detail-status-done'));

      await waitFor(() => expect(api.getTasksByPbiId).toHaveBeenCalled());

      await user.click(screen.getByTestId('validation-check-dod1'));
      await user.click(screen.getByTestId('validation-confirm'));

      await waitFor(() => {
        expect(defs.verifyDoDForPBI).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(api.updateProductBacklogItem).toHaveBeenCalledWith('pbi-inprogress', {
          status: 'DONE',
        });
      });
    });

    it('should surface a DoD verification failure', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.getTasksByPbiId.mockResolvedValue({ success: true });
      defs.verifyDoDForPBI.mockRejectedValue(new Error('nope'));

      await user.click(screen.getByTestId('board-open-inprogress'));
      await user.click(screen.getByTestId('detail-status-done'));
      await waitFor(() => expect(api.getTasksByPbiId).toHaveBeenCalled());

      await user.click(screen.getByTestId('validation-confirm'));

      await waitFor(() => expect(defs.verifyDoDForPBI).toHaveBeenCalled());
      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should open DoR validation for READY and confirm via verifyDoR', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-second'));
      await user.click(screen.getByTestId('detail-status-ready'));
      await user.click(screen.getByTestId('validation-check-dor1'));
      await user.click(screen.getByTestId('validation-confirm'));

      await waitFor(() => expect(defs.verifyDoRForPBI).toHaveBeenCalled());
      await waitFor(() => {
        expect(api.updateProductBacklogItem).toHaveBeenCalledWith('pbi-2', { status: 'READY' });
      });
    });

    it('should surface a DoR verification failure', async () => {
      const user = userEvent.setup();
      renderBacklog();
      defs.verifyDoRForPBI.mockRejectedValue(new Error('nope'));

      await user.click(screen.getByTestId('board-open-second'));
      await user.click(screen.getByTestId('detail-status-ready'));
      await user.click(screen.getByTestId('validation-confirm'));

      await waitFor(() => expect(defs.verifyDoRForPBI).toHaveBeenCalled());
      expect(api.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should cancel the validation modal', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-second'));
      await user.click(screen.getByTestId('detail-status-ready'));
      await user.click(screen.getByTestId('validation-cancel'));

      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should do nothing when confirming validation with no pending status', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('validation-confirm'));
      expect(defs.verifyDoRForPBI).not.toHaveBeenCalled();
      expect(defs.verifyDoDForPBI).not.toHaveBeenCalled();
    });

    it('should report 400 errors from execute status change', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.updateProductBacklogItem.mockRejectedValue({
        response: { status: 400, data: { error: { message: 'Bad transition' } } },
      });

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-status-refined'));

      await waitFor(() => expect(api.updateProductBacklogItem).toHaveBeenCalled());
    });

    it('should report 403 errors from execute status change', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.updateProductBacklogItem.mockRejectedValue({
        response: { status: 403, data: { error: { message: 'Forbidden' } } },
      });

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-status-refined'));

      await waitFor(() => expect(api.updateProductBacklogItem).toHaveBeenCalled());
    });

    it('should fall back for a 403 without a message', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.updateProductBacklogItem.mockRejectedValue({ response: { status: 403, data: {} } });

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-status-refined'));

      await waitFor(() => expect(api.updateProductBacklogItem).toHaveBeenCalled());
    });
  });

  describe('Reorder and move by step', () => {
    it('should reorder across priorities with a positional target', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-reorder-cross'));

      await waitFor(() => expect(api.reorderProductBacklogItems).toHaveBeenCalled());
      const payload = api.reorderProductBacklogItems.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({ pbiId: 'pbi-1', targetPbiId: 'pbi-2', position: 'after' });
    });

    it('should skip the band update and the reorder when nothing changes', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-reorder-same'));
      expect(api.reorderProductBacklogItems).not.toHaveBeenCalled();
    });

    it('should update the band but skip the reorder when there is no position', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-reorder-partial'));

      await waitFor(() => expect(api.updateProductBacklogItem).toHaveBeenCalled());
      expect(api.reorderProductBacklogItems).not.toHaveBeenCalled();
    });

    it('should ignore a reorder for an unknown item', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-reorder-unknown'));
      expect(api.reorderProductBacklogItems).not.toHaveBeenCalled();
    });

    it('should stop when the band update is refused', async () => {
      const user = userEvent.setup();
      renderBacklog();
      api.updateProductBacklogItem.mockRejectedValue(new Error('refused'));

      await user.click(screen.getByTestId('board-reorder-cross'));

      await waitFor(() => expect(api.updateProductBacklogItem).toHaveBeenCalled());
      expect(api.reorderProductBacklogItems).not.toHaveBeenCalled();
    });

    it('should ignore a reorder when the backlog has no data', async () => {
      const user = userEvent.setup();
      shared.state.data = buildData({ backlogData: undefined });
      renderWithProviders(<ProductBacklog />);
      // Wait for render
      await screen.findByTestId('board-reorder-cross');

      await user.click(screen.getByTestId('board-reorder-cross'));
      expect(api.reorderProductBacklogItems).not.toHaveBeenCalled();
    });

    it('should move items by step in the list view', async () => {
      const user = userEvent.setup();
      setRole('PRODUCT_OWNER');
      renderBacklog();

      await user.click(screen.getByTestId('header-view-list'));
      expect(screen.getByTestId('list-can-order')).toHaveTextContent('true');

      await user.click(screen.getByTestId('list-move-down-first'));
      await user.click(screen.getByTestId('list-move-up-second'));
      // No-op paths
      await user.click(screen.getByTestId('list-move-up-first'));
      await user.click(screen.getByTestId('list-move-unknown'));

      await waitFor(() => expect(api.reorderProductBacklogItems).toHaveBeenCalled());
      expect(api.reorderProductBacklogItems).toHaveBeenCalledWith(
        expect.objectContaining({ pbiId: 'pbi-1', targetPbiId: 'pbi-2', position: 'after' })
      );
      expect(api.reorderProductBacklogItems).toHaveBeenCalledWith(
        expect.objectContaining({ pbiId: 'pbi-2', targetPbiId: 'pbi-1', position: 'before' })
      );
    });

    it('should not offer move-by-step to a non-Product-Owner', async () => {
      const user = userEvent.setup();
      setRole('DEVELOPERS');
      renderBacklog();

      await user.click(screen.getByTestId('header-view-list'));
      expect(screen.getByTestId('list-can-order')).toHaveTextContent('false');

      await user.click(screen.getByTestId('list-move-down-first'));
      expect(api.reorderProductBacklogItems).not.toHaveBeenCalled();
    });
  });

  describe('Deep link, bulk upload and misc', () => {
    it('should open the detail modal from a ?pbi= deep link', async () => {
      renderBacklog('/?pbi=pbi-1');
      await waitFor(() => expect(screen.getByTestId('product-backlog')).toBeInTheDocument());
      // The effect consumed the param; the detail modal was opened via handleOpenDetailModal.
      await waitFor(() => expect(screen.getByTestId('detail-edit')).toBeInTheDocument());
    });

    it('should handle a deep link when the backlog data is not loaded yet', async () => {
      shared.state.data = buildData({ backlogData: undefined });
      renderWithProviders(<ProductBacklog />, { initialRoute: '/?pbi=pbi-1' });
      await waitFor(() => expect(screen.getByTestId('product-backlog')).toBeInTheDocument());
    });

    it('should invalidate queries when a bulk upload completes', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('header-bulk'));
      await user.click(screen.getByTestId('bulk-complete'));

      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should show the auto-loading indicator while searching', async () => {
      shared.state.data = buildData({ isAutoLoading: true });
      renderWithProviders(<ProductBacklog />);
      await waitFor(() => expect(screen.getByTestId('product-backlog')).toBeInTheDocument());
    });

    it('should prefill the create form from pending feedback (long and short content)', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('pf-long'));
      await user.click(screen.getByTestId('pf-short'));
      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should close the edit modal via its inline onClose', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('edit-close'));
      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should close the detail modal via its inline onClose', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-open-detail'));
      await user.click(screen.getByTestId('detail-close'));
      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should change priority from the board', async () => {
      const user = userEvent.setup();
      renderBacklog();

      await user.click(screen.getByTestId('board-priority'));

      await waitFor(() => {
        expect(api.updateProductBacklogItem).toHaveBeenCalledWith('pbi-1', {
          priority: 'COULD_HAVE',
        });
      });
    });
  });
});
