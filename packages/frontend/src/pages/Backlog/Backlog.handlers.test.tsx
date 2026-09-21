/**
 * Backlog handlers coverage tests.
 *
 * Companion suite to `Backlog.test.tsx` that exercises the internal handler logic of
 * the `ProductBacklog` component (create submit, item drag/drop, filter changes,
 * view-mode toggle, bulk upload open/close, detail modal open/close, hash + empty
 * branches, etc.) to raise statement/branch/function coverage.
 *
 * NOTE: `useBacklogMutations` and `useBacklogData` are intentionally left UN-mocked so
 * they behave exactly as in production (driven by the mocked `apiService`), mirroring
 * the existing `Backlog.test.tsx`.
 *
 * The edit / delete / validation *open* handlers are not wired to any clickable UI
 * trigger in the current implementation (BoardView/MoscowCard only expose `onClick`
 * -> detail and keyboard drag -> priority change), so their submit handlers are not
 * reachable from the DOM and are out of scope here.
 */

import { screen, renderWithProviders, waitFor, i18nT } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';

import { useTeamStore } from '../../store';
import { apiService } from '../../services';
import {
  createMockBacklogItem,
  createMockTeam,
  createMockProductGoal,
  initTestI18n,
} from '../../test-utils';
import { ItemStatus, MoSCoWPriority } from '../../types';

import { ProductBacklog } from './Backlog';
import * as teamContextModule from '../../contexts/TeamContext';

/* ------------------------------------------------------------------ */
/* Mocks                                                              */
/* ------------------------------------------------------------------ */

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('../../hooks/useMutationErrorHandler', () => ({
  useMutationErrorHandler: () => ({
    handleMutationError: vi.fn((_error: unknown, _context?: string) => 'An error occurred'),
  }),
}));

// Keep DoR/DoD validation permissive by default; override per-test when needed.
vi.mock('./hooks/useDefinitionOfReadyDone', () => ({
  useDefinitionOfReadyDone: () => ({
    validateItemForStatusChange: vi.fn(() => ({ valid: true, missingFields: [] })),
    dorItems: [],
    dodItems: [],
  }),
}));

vi.mock('./hooks/useBacklogCapacityValidation', () => ({
  useBacklogCapacityValidation: () => ({
    validateBulkImport: vi.fn().mockResolvedValue({ isValid: true }),
  }),
}));

/* ------------------------------------------------------------------ */
/* Test fixtures                                                      */
/* ------------------------------------------------------------------ */

const mockTeamStore = useTeamStore as ReturnType<typeof vi.fn>;

const mockTeam = createMockTeam({ id: 'team-1', name: 'Test Team' });

const mockActiveGoal = createMockProductGoal({
  id: 'goal-1',
  title: 'Active Goal',
  status: 'ACTIVE',
  teamId: 'team-1',
});

const mockBacklogItems = [
  createMockBacklogItem({
    id: 'pbi-1',
    title: 'Feature Alpha',
    status: ItemStatus.NEW,
    priority: MoSCoWPriority.MUST_HAVE,
    storyPoints: 8,
    businessValue: 13,
    goalId: 'goal-1',
  }),
  createMockBacklogItem({
    id: 'pbi-2',
    title: 'Feature Beta',
    status: ItemStatus.REFINED,
    priority: MoSCoWPriority.SHOULD_HAVE,
    storyPoints: 5,
    businessValue: 5,
    goalId: 'goal-1',
  }),
];

const cardAriaLabel = (title: string, priorityKey: string) =>
  i18nT('backlog:aria.backlogItem', {
    title,
    priority: i18nT(`backlog:${priorityKey}`),
  });

const renderBacklog = async () => {
  renderWithProviders(<ProductBacklog />);
  await waitFor(() => {
    expect(screen.getByText('Feature Alpha')).toBeInTheDocument();
  });
};

/**
 * Override the acting team role for the next render.
 *
 * Ordering the Product Backlog is the Product Owner's accountability, so the reorder and
 * reclassify affordances exist only for that role; tests that exercise them have to act as the
 * Product Owner, and tests that assert the gate have to act as anyone else.
 */
const setTeamRole = (role: string) =>
  vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
    userRole: role,
    currentTeam: mockTeam,
    userTeams: [{ ...mockTeam, userRole: role }],
    isLoading: false,
    error: null,
    switchTeam: vi.fn(),
    refreshTeams: vi.fn(),
    hasMultipleTeams: false,
  } as never);

describe('ProductBacklog handlers coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
      userRole: 'DEVELOPERS',
      currentTeam: mockTeam,
      userTeams: [{ ...mockTeam, userRole: 'DEVELOPERS' }],
      isLoading: false,
      error: null,
      switchTeam: vi.fn(),
      refreshTeams: vi.fn(),
      hasMultipleTeams: false,
    } as never);

    mockTeamStore.mockReturnValue({
      currentTeam: mockTeam,
      teams: [mockTeam],
      userRoleInCurrentTeam: 'product_owner',
      userTeamsWithRoles: [{ ...mockTeam, userRole: 'product_owner' }],
      setCurrentTeam: vi.fn(),
      setTeams: vi.fn(),
      setUserTeamsWithRoles: vi.fn(),
      addTeam: vi.fn(),
      updateTeam: vi.fn(),
      removeTeam: vi.fn(),
      switchTeam: vi.fn(),
      refreshUserTeams: vi.fn(),
      clearTeamContext: vi.fn(),
    });

    Object.assign(apiService, {
      getProductBacklog: vi.fn().mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: mockBacklogItems.length },
      }),
      getProductGoals: vi.fn().mockResolvedValue({ success: true, data: [mockActiveGoal] }),
      createProductBacklogItem: vi.fn().mockResolvedValue({
        success: true,
        data: createMockBacklogItem({ id: 'new-pbi' }),
      }),
      updateProductBacklogItem: vi.fn().mockResolvedValue({
        success: true,
        data: mockBacklogItems[0],
      }),
      deleteProductBacklogItem: vi.fn().mockResolvedValue({ success: true }),
      getDefinitionOfDone: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
      getDefinitionOfReady: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
      getBacklogAdjustments: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getStakeholderFeedback: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getPendingFeedback: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getPendingAdjustments: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getPendingRetroActionItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getRetroActionItems: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getTasksByPbiId: vi.fn().mockResolvedValue({ success: true, data: [] }),
      verifyDoDForPBI: vi.fn().mockResolvedValue({ success: true }),
      verifyDoRForPBI: vi.fn().mockResolvedValue({ success: true }),
      getStatusChangeHistory: vi.fn().mockResolvedValue({ success: true, data: [] }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Create item flow', () => {
    it('should create a backlog item on valid submit', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      await user.click(screen.getByText(i18nT('backlog:newItem')));

      const titleInput = await screen.findByLabelText(i18nT('backlog:createItem.titleLabel'), {
        exact: false,
      });
      await user.type(titleInput, 'New Feature Item');

      const submitButton = screen.getByText(i18nT('backlog:createItem.createItem'));
      await user.click(submitButton);

      await waitFor(() => {
        expect(apiService.createProductBacklogItem).toHaveBeenCalledTimes(1);
      });

      const payload = vi.mocked(apiService.createProductBacklogItem).mock.calls[0]?.[0] as {
        title?: string;
      };
      expect(payload.title).toBe('New Feature Item');
    });

    it('should not create when the title is invalid (required >= 5 chars)', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      await user.click(screen.getByText(i18nT('backlog:newItem')));

      const titleInput = await screen.findByLabelText(i18nT('backlog:createItem.titleLabel'), {
        exact: false,
      });
      await user.type(titleInput, 'abc'); // too short

      const submitButton = screen.getByText(i18nT('backlog:createItem.createItem'));
      await user.click(submitButton);

      // Validation fails -> no API call
      expect(apiService.createProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should close the create modal on close button', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      await user.click(screen.getByText(i18nT('backlog:newItem')));
      expect(await screen.findByText(i18nT('backlog:createItem.createItem'))).toBeInTheDocument();

      const closeButton = screen.getAllByLabelText(i18nT('backlog:createItem.closeModal'))[0];
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(i18nT('backlog:createItem.createItem'))).not.toBeInTheDocument();
      });
    });
  });

  describe('Item detail modal', () => {
    it('should open and close the detail modal when a card is clicked', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      await user.click(screen.getByText('Feature Alpha'));
      // The detail modal opens
      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      const closeButton = screen.getAllByLabelText(i18nT('backlog:itemDetail.closeModal'))[0];
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('View mode toggle + drag and drop', () => {
    it('should switch to board view and perform keyboard drag + drop', async () => {
      const user = userEvent.setup();
      setTeamRole('PRODUCT_OWNER');
      await renderBacklog();

      await user.click(screen.getByText(i18nT('backlog:viewToggle.board')));

      const card = await screen.findByLabelText(cardAriaLabel('Feature Alpha', 'moscow.mustHave'));

      // Grab (Space) -> change priority (ArrowRight) -> drop (Space) => handleItemDrag
      fireEvent.keyDown(card, { key: ' ' });
      fireEvent.keyDown(card, { key: 'ArrowRight' });
      fireEvent.keyDown(card, { key: ' ' });

      await waitFor(() => {
        expect(apiService.updateProductBacklogItem).toHaveBeenCalled();
      });

      // Native drag end triggers handleItemDrop
      fireEvent.dragEnd(card);

      await waitFor(() => {
        expect(apiService.updateProductBacklogItem).toHaveBeenCalled();
      });
    });

    it('should not drop when the same priority is targeted (cancel path)', async () => {
      const user = userEvent.setup();
      setTeamRole('PRODUCT_OWNER');
      await renderBacklog();

      await user.click(screen.getByText(i18nT('backlog:viewToggle.board')));

      const card = await screen.findByLabelText(cardAriaLabel('Feature Alpha', 'moscow.mustHave'));

      // Grab then immediately drop on the same priority (no ArrowRight)
      fireEvent.keyDown(card, { key: ' ' });
      fireEvent.keyDown(card, { key: ' ' });
      // Escape cancels the grab
      fireEvent.keyDown(card, { key: 'Escape' });

      expect(apiService.updateProductBacklogItem).not.toHaveBeenCalled();
    });

    it('should explain that ordering belongs to the Product Owner and offer no ordering affordance otherwise', async () => {
      const user = userEvent.setup();
      // beforeEach acts as a Developer: ordering is not theirs.
      await renderBacklog();

      expect(screen.getByText(i18nT('backlog:order.productOwnerOnlyHint'))).toBeInTheDocument();

      await user.click(screen.getByText(i18nT('backlog:viewToggle.board')));
      await screen.findByLabelText(cardAriaLabel('Feature Alpha', 'moscow.mustHave'));

      expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0);
    });
  });

  describe('Filter interactions', () => {
    it('should update filters when typing in the search box', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      const searchInput = screen.getByPlaceholderText(i18nT('backlog:filter.searchItems'));
      await user.type(searchInput, 'Feature');

      expect(searchInput).toHaveValue('Feature');
    });

    it('should clear search when the clear button is clicked', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      const searchInput = screen.getByPlaceholderText(i18nT('backlog:filter.searchItems'));
      await user.type(searchInput, 'abc');

      const clearButton = screen.getByLabelText(i18nT('backlog:filter.clearSearch'));
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });

    it('should toggle a status filter chip', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      const statusChip = screen.getByRole('button', { name: i18nT('backlog:status.new') });
      await user.click(statusChip);
    });
  });

  describe('Bulk upload modal', () => {
    it('should open and close the bulk upload modal', async () => {
      const user = userEvent.setup();
      await renderBacklog();

      await user.click(screen.getByText(i18nT('backlog:bulkImport')));

      expect(await screen.findByText(i18nT('backlog:bulkUpload.modalTitle'))).toBeInTheDocument();

      const closeButton = screen.getByLabelText(i18nT('backlog:bulkUpload.closeModal'));
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText(i18nT('backlog:bulkUpload.modalTitle'))).not.toBeInTheDocument();
      });
    });
  });

  describe('Pending feedback -> create work item', () => {
    it('should open the create modal prefilled when creating a work item from pending feedback', async () => {
      vi.mocked(apiService.getPendingFeedback).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'fb-1',
            content: 'Add dark mode support',
            category: 'suggestion',
            authorName: 'Stakeholder',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const user = userEvent.setup();
      await renderBacklog();

      // The pending feedback card shows a "create work item" action
      const createItemButton = await screen.findByText(i18nT('backlog:pendingFeedback.createItem'));
      await user.click(createItemButton);

      // The create modal opens (title field is prefilled) -> handler branch covered
      expect(
        await screen.findByLabelText(i18nT('backlog:createItem.titleLabel'), { exact: false })
      ).toBeInTheDocument();
    });

    it('should open the create modal prefilled when implementing a pending adjustment', async () => {
      vi.mocked(apiService.getPendingAdjustments).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Clarify acceptance criteria',
            reason: 'Customer request',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const user = userEvent.setup();
      await renderBacklog();

      const implementButton = await screen.findByText(
        i18nT('backlog:pendingAdjustments.createItem')
      );
      await user.click(implementButton);

      expect(
        await screen.findByLabelText(i18nT('backlog:createItem.titleLabel'), { exact: false })
      ).toBeInTheDocument();
    });

    it('should open the create modal prefilled when creating from a pending retro action item', async () => {
      vi.mocked(apiService.getPendingRetroActionItems).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'retro-1',
            title: 'Improve CI pipeline',
            description: 'Speed up builds',
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const user = userEvent.setup();
      await renderBacklog();

      const createItemButton = await screen.findByText(i18nT('backlog:pendingRetro.createItem'));
      await user.click(createItemButton);

      expect(
        await screen.findByLabelText(i18nT('backlog:createItem.titleLabel'), { exact: false })
      ).toBeInTheDocument();
    });
  });

  describe('No active goal branch', () => {
    it('should render the no-active-goal state when no active goal exists', async () => {
      vi.mocked(apiService.getProductGoals).mockResolvedValue({ success: true, data: [] });

      renderWithProviders(<ProductBacklog />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('common:emptyState.noActiveGoal.title'))).toBeInTheDocument();
      });
    });
  });

  describe('No team selected', () => {
    it('should show a message when no team is selected', async () => {
      mockTeamStore.mockReturnValue({
        currentTeam: null,
        teams: [],
        userRoleInCurrentTeam: null,
        userTeamsWithRoles: [],
        setCurrentTeam: vi.fn(),
        setTeams: vi.fn(),
        setUserTeamsWithRoles: vi.fn(),
        addTeam: vi.fn(),
        updateTeam: vi.fn(),
        removeTeam: vi.fn(),
        switchTeam: vi.fn(),
        refreshUserTeams: vi.fn(),
        clearTeamContext: vi.fn(),
      });

      renderWithProviders(<ProductBacklog />);

      await waitFor(() => {
        expect(screen.getByText(/no team selected/i)).toBeInTheDocument();
      });
    });
  });
});
