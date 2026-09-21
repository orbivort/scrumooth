import { screen, renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { MoSCoWPriority, ItemStatus } from '../../../types';
import { createMockBacklogItem, initTestI18n } from '../../../test-utils';

import { BoardView } from './BoardView';

const mockItems = [
  createMockBacklogItem({
    id: 'pbi-1',
    title: 'Must Have Feature',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.NEW,
    storyPoints: 8,
    businessValue: 13,
  }),
  createMockBacklogItem({
    id: 'pbi-2',
    title: 'Should Have Feature',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.REFINED,
    storyPoints: 5,
    businessValue: 8,
  }),
  createMockBacklogItem({
    id: 'pbi-3',
    title: 'Could Have Feature',
    priority: MoSCoWPriority.COULD_HAVE,
    status: ItemStatus.READY,
    storyPoints: 3,
    businessValue: 5,
  }),
  createMockBacklogItem({
    id: 'pbi-4',
    title: 'Wont Have Feature',
    priority: MoSCoWPriority.WONT_HAVE,
    status: ItemStatus.DONE,
    storyPoints: 2,
    businessValue: 1,
  }),
];

const mockItemsByMoscow = {
  [MoSCoWPriority.MUST_HAVE]: [mockItems[0]],
  [MoSCoWPriority.SHOULD_HAVE]: [mockItems[1]],
  [MoSCoWPriority.COULD_HAVE]: [mockItems[2]],
  [MoSCoWPriority.WONT_HAVE]: [mockItems[3]],
};

describe('BoardView', () => {
  const mockOnItemClick = vi.fn();
  const mockOnPriorityChange = vi.fn();
  const mockOnReorder = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all MoSCoW columns', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      const mustHaveElements = screen.getAllByText('Must Have');
      expect(mustHaveElements.length).toBeGreaterThan(0);

      const shouldHaveElements = screen.getAllByText('Should Have');
      expect(shouldHaveElements.length).toBeGreaterThan(0);

      const couldHaveElements = screen.getAllByText('Could Have');
      expect(couldHaveElements.length).toBeGreaterThan(0);

      const wontHaveElements = screen.getAllByText("Won't Have");
      expect(wontHaveElements.length).toBeGreaterThan(0);
    });

    it('should render items in correct columns', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      expect(screen.getByText('Must Have Feature')).toBeInTheDocument();
      expect(screen.getByText('Should Have Feature')).toBeInTheDocument();
      expect(screen.getByText('Could Have Feature')).toBeInTheDocument();
      expect(screen.getByText('Wont Have Feature')).toBeInTheDocument();
    });

    it('should render item counts in column headers', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      const countElements = screen.getAllByText('1');
      expect(countElements.length).toBeGreaterThan(0);
    });

    it('should render empty state for empty columns', () => {
      const emptyItemsByMoscow = {
        [MoSCoWPriority.MUST_HAVE]: [],
        [MoSCoWPriority.SHOULD_HAVE]: [],
        [MoSCoWPriority.COULD_HAVE]: [],
        [MoSCoWPriority.WONT_HAVE]: [],
      };

      renderWithProviders(
        <BoardView
          itemsByMoscow={emptyItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      const dropPlaceholders = screen.getAllByText('Drop items here');
      expect(dropPlaceholders.length).toBe(4);
    });
  });

  describe('Drag and Drop', () => {
    it('should render draggable cards', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      const cards = document.querySelectorAll('[draggable="true"]');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should have proper ARIA attributes for accessibility', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      const board = document.querySelector('[aria-label="MoSCoW priority board"]');
      expect(board).toBeInTheDocument();
    });
  });

  describe('Item Interaction', () => {
    it('should call onItemClick when clicking an item', async () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      await userEvent.click(screen.getByText('Must Have Feature'));

      expect(mockOnItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pbi-1', title: 'Must Have Feature' })
      );
    });
  });

  describe('Column Descriptions', () => {
    it('should display column descriptions', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      expect(screen.getByText('Critical for delivery - Non-negotiable')).toBeInTheDocument();
      expect(screen.getByText('Important but not vital - High priority')).toBeInTheDocument();
      expect(screen.getByText('Desirable if possible - Nice to have')).toBeInTheDocument();
      expect(screen.getByText('Not in this release - Out of scope')).toBeInTheDocument();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should not use virtual scrolling when items are below threshold (50)', () => {
      const itemsByMoscowWithFewItems = {
        [MoSCoWPriority.MUST_HAVE]: Array(10)
          .fill(null)
          .map((_, i) =>
            createMockBacklogItem({
              id: `pbi-must-${i}`,
              title: `Must Have Item ${i}`,
              priority: MoSCoWPriority.MUST_HAVE,
            })
          ),
        [MoSCoWPriority.SHOULD_HAVE]: [],
        [MoSCoWPriority.COULD_HAVE]: [],
        [MoSCoWPriority.WONT_HAVE]: [],
      };

      renderWithProviders(
        <BoardView
          itemsByMoscow={itemsByMoscowWithFewItems}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      // All 10 items should be rendered (no virtualization)
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Must Have Item ${i}`)).toBeInTheDocument();
      }
    });

    it('should render all items when virtualization is not needed', () => {
      const manyItems = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-must-${i}`,
            title: `Must Have Item ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
          })
        );

      const itemsByMoscowWithManyItems = {
        [MoSCoWPriority.MUST_HAVE]: manyItems,
        [MoSCoWPriority.SHOULD_HAVE]: [],
        [MoSCoWPriority.COULD_HAVE]: [],
        [MoSCoWPriority.WONT_HAVE]: [],
      };

      renderWithProviders(
        <BoardView
          itemsByMoscow={itemsByMoscowWithManyItems}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      // Column should show correct count
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('should maintain drag and drop functionality without virtualization', () => {
      // Use fewer items to avoid virtualization
      const fewItems = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-must-${i}`,
            title: `Must Have Item ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
          })
        );

      const itemsByMoscowWithFewItems = {
        [MoSCoWPriority.MUST_HAVE]: fewItems,
        [MoSCoWPriority.SHOULD_HAVE]: [],
        [MoSCoWPriority.COULD_HAVE]: [],
        [MoSCoWPriority.WONT_HAVE]: [],
      };

      renderWithProviders(
        <BoardView
          itemsByMoscow={itemsByMoscowWithFewItems}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      // Should still have draggable cards
      const cards = document.querySelectorAll('[draggable="true"]');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should maintain ARIA labels for accessibility with virtual scrolling', () => {
      const manyItems = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-must-${i}`,
            title: `Must Have Item ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
          })
        );

      const itemsByMoscowWithManyItems = {
        [MoSCoWPriority.MUST_HAVE]: manyItems,
        [MoSCoWPriority.SHOULD_HAVE]: [],
        [MoSCoWPriority.COULD_HAVE]: [],
        [MoSCoWPriority.WONT_HAVE]: [],
      };

      renderWithProviders(
        <BoardView
          itemsByMoscow={itemsByMoscowWithManyItems}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      // Should have aria-label indicating item count
      const column = screen.getByRole('list', { name: /Must Have column/i });
      expect(column).toBeInTheDocument();
      expect(column).toHaveAttribute('aria-label', expect.stringContaining('60'));
    });

    it('should handle mixed columns with and without virtualization', () => {
      const itemsByMoscowMixed = {
        [MoSCoWPriority.MUST_HAVE]: Array(60)
          .fill(null)
          .map((_, i) =>
            createMockBacklogItem({
              id: `pbi-must-${i}`,
              title: `Must Have Item ${i}`,
              priority: MoSCoWPriority.MUST_HAVE,
            })
          ),
        [MoSCoWPriority.SHOULD_HAVE]: Array(5)
          .fill(null)
          .map((_, i) =>
            createMockBacklogItem({
              id: `pbi-should-${i}`,
              title: `Should Have Item ${i}`,
              priority: MoSCoWPriority.SHOULD_HAVE,
            })
          ),
        [MoSCoWPriority.COULD_HAVE]: [],
        [MoSCoWPriority.WONT_HAVE]: [],
      };

      renderWithProviders(
        <BoardView
          itemsByMoscow={itemsByMoscowMixed}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      // Both columns should show correct counts
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Positional ordering', () => {
    it('should expose a drop zone per card so a drop can name a position', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      // One drop zone per card, addressed by the item it sits before/after.
      const dropZones = document.querySelectorAll('[data-drop-zone]');
      expect(dropZones).toHaveLength(mockItems.length);
      expect(dropZones[0]).toHaveAttribute('data-drop-zone', 'pbi-1');
    });

    it('should show the item position in the backlog order', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder
        />
      );

      expect(screen.getAllByLabelText(/^Position \d+ in the Product Backlog$/).length).toBe(
        mockItems.length
      );
    });

    it('should not offer the ordering affordance to a non-Product-Owner', () => {
      renderWithProviders(
        <BoardView
          itemsByMoscow={mockItemsByMoscow}
          onItemClick={mockOnItemClick}
          onReorder={mockOnReorder}
          onPriorityChange={mockOnPriorityChange}
          canOrder={false}
        />
      );

      // Cards stay readable and clickable, but nothing is draggable and the lock is exposed so
      // the refusal is discoverable rather than implicit.
      expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-order-locked="true"]')).toHaveLength(
        mockItems.length
      );
    });
  });
});
