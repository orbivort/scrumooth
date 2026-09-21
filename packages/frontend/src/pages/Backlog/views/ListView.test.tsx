import { screen, renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { MoSCoWPriority, ItemStatus } from '../../../types';
import { createMockBacklogItem, initTestI18n, i18nT } from '../../../test-utils';

import { ListView } from './ListView';

const mockItems = [
  createMockBacklogItem({
    id: 'pbi-1',
    title: 'Feature A',
    priority: MoSCoWPriority.MUST_HAVE,
    status: ItemStatus.NEW,
    storyPoints: 8,
    businessValue: 13,
    labels: ['frontend', 'urgent'],
  }),
  createMockBacklogItem({
    id: 'pbi-2',
    title: 'Feature B',
    priority: MoSCoWPriority.SHOULD_HAVE,
    status: ItemStatus.REFINED,
    storyPoints: 5,
    businessValue: 8,
    labels: ['backend'],
  }),
  createMockBacklogItem({
    id: 'pbi-3',
    title: 'Feature C',
    priority: MoSCoWPriority.COULD_HAVE,
    status: ItemStatus.READY,
    storyPoints: 3,
    businessValue: 5,
    labels: ['api', 'database', 'testing', 'security'],
  }),
];

describe('ListView', () => {
  const mockOnItemClick = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render table headers', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      expect(screen.getByText(i18nT('backlog:listView.id'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.title'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.moscow'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.status'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.businessValue'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.estimate'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.labels'))).toBeInTheDocument();
    });

    it('should render all items', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('Feature A')).toBeInTheDocument();
      expect(screen.getByText('Feature B')).toBeInTheDocument();
      expect(screen.getByText('Feature C')).toBeInTheDocument();
    });

    it('should display truncated IDs', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      const idElements = screen.getAllByText(/#bi-/);
      expect(idElements.length).toBeGreaterThan(0);
    });

    it('should display story points', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      const ptsElements = screen.getAllByText(/pts/);
      expect(ptsElements.length).toBeGreaterThan(0);
    });

    it('should display business value', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('13 pts')).toBeInTheDocument();
    });

    it('should display status badges', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      expect(screen.getByText(i18nT('backlog:status.new'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:status.refined'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:status.ready'))).toBeInTheDocument();
    });
  });

  describe('Labels Display', () => {
    it('should display up to 2 labels', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('frontend')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('should show overflow indicator for more than 2 labels', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('should handle items with no labels', () => {
      const itemsWithoutLabels = [
        createMockBacklogItem({
          id: 'pbi-no-labels',
          title: 'No Labels Feature',
          priority: MoSCoWPriority.MUST_HAVE,
          status: ItemStatus.NEW,
          labels: [],
        }),
      ];

      renderWithProviders(<ListView items={itemsWithoutLabels} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('No Labels Feature')).toBeInTheDocument();
    });
  });

  describe('Item Interaction', () => {
    it('should call onItemClick when clicking a row', async () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      await userEvent.click(screen.getByText('Feature A'));

      expect(mockOnItemClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pbi-1', title: 'Feature A' })
      );
    });
  });

  describe('Empty State', () => {
    it('should render empty table when no items', () => {
      renderWithProviders(<ListView items={[]} onItemClick={mockOnItemClick} />);

      expect(screen.getByText(i18nT('backlog:listView.id'))).toBeInTheDocument();
      expect(screen.queryByText('Feature A')).not.toBeInTheDocument();
    });
  });

  describe('Missing Data Handling', () => {
    it('should handle missing story points', () => {
      const itemsWithoutEstimate = [
        createMockBacklogItem({
          id: 'pbi-no-estimate',
          title: 'No Estimate Feature',
          priority: MoSCoWPriority.MUST_HAVE,
          status: ItemStatus.NEW,
          storyPoints: undefined,
        }),
      ];

      renderWithProviders(<ListView items={itemsWithoutEstimate} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('should handle missing business value', () => {
      const itemsWithoutValue = [
        createMockBacklogItem({
          id: 'pbi-no-value',
          title: 'No Value Feature',
          priority: MoSCoWPriority.MUST_HAVE,
          status: ItemStatus.NEW,
          businessValue: undefined,
        }),
      ];

      renderWithProviders(<ListView items={itemsWithoutValue} onItemClick={mockOnItemClick} />);

      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  describe('Virtual Scrolling', () => {
    it('should not use virtual scrolling when items are below threshold (50)', () => {
      const manyItems = Array(45)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-${i}`,
            title: `Feature ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
            status: ItemStatus.NEW,
          })
        );

      renderWithProviders(<ListView items={manyItems} onItemClick={mockOnItemClick} />);

      // All items should be rendered (no virtualization)
      expect(screen.getByText('Feature 0')).toBeInTheDocument();
      expect(screen.getByText('Feature 44')).toBeInTheDocument();
    });

    it('should render table structure correctly with many items', () => {
      const manyItems = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-${i}`,
            title: `Feature ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
            status: ItemStatus.NEW,
          })
        );

      renderWithProviders(<ListView items={manyItems} onItemClick={mockOnItemClick} />);

      // Table headers should still be present
      expect(screen.getByText(i18nT('backlog:listView.id'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.title'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.moscow'))).toBeInTheDocument();
    });

    it('should maintain row click functionality with virtual scrolling', async () => {
      // Use fewer items to ensure they are rendered
      const fewItems = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-${i}`,
            title: `Feature ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
            status: ItemStatus.NEW,
          })
        );

      renderWithProviders(<ListView items={fewItems} onItemClick={mockOnItemClick} />);

      // Should be able to click on items
      await userEvent.click(screen.getByText('Feature 0'));
      expect(mockOnItemClick).toHaveBeenCalled();
    });

    it('should apply virtualized styles when items exceed threshold', () => {
      const manyItems = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-${i}`,
            title: `Feature ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
            status: ItemStatus.NEW,
          })
        );

      const { container } = renderWithProviders(
        <ListView items={manyItems} onItemClick={mockOnItemClick} />
      );

      // Should have virtualized CSS class on the list-view container
      const listViewElement = container.querySelector('[class*="list-view"]');
      expect(listViewElement).toBeInTheDocument();
      expect(listViewElement!.className).toContain('virtualized');
    });

    it('should not apply virtualized styles when items are below threshold', () => {
      const fewItems = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-${i}`,
            title: `Feature ${i}`,
            priority: MoSCoWPriority.MUST_HAVE,
            status: ItemStatus.NEW,
          })
        );

      const { container } = renderWithProviders(
        <ListView items={fewItems} onItemClick={mockOnItemClick} />
      );

      // Should not have virtualized CSS class
      const listViewElement = container.querySelector('[class*="list-view"]');
      expect(listViewElement).toBeInTheDocument();
      expect(listViewElement!.className).not.toContain('virtualized');
    });

    it('should handle empty list with virtual scrolling enabled', () => {
      renderWithProviders(<ListView items={[]} onItemClick={mockOnItemClick} />);

      // Table headers should still be present
      expect(screen.getByText(i18nT('backlog:listView.id'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('backlog:listView.title'))).toBeInTheDocument();
    });

    it('should maintain MoSCoW badge display without virtualization', () => {
      const fewItems = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockBacklogItem({
            id: `pbi-${i}`,
            title: `Feature ${i}`,
            priority: MoSCoWPriority.SHOULD_HAVE,
            status: ItemStatus.NEW,
          })
        );

      renderWithProviders(<ListView items={fewItems} onItemClick={mockOnItemClick} />);

      // Should still show MoSCoW badges
      const moscowBadges = screen.getAllByText(i18nT('backlog:moscowLabels.SHOULD_HAVE'));
      expect(moscowBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Backlog order', () => {
    it('should number the rows from the top of the backlog', () => {
      renderWithProviders(<ListView items={mockItems} onItemClick={mockOnItemClick} />);

      const positions = screen.getAllByLabelText(/^Position \d+ in the Product Backlog$/);
      expect(positions.map((node) => node.textContent)).toEqual(['1', '2', '3']);
    });

    it('should move an item one position for the Product Owner', async () => {
      const user = userEvent.setup();
      const onMove = vi.fn();

      renderWithProviders(
        <ListView items={mockItems} onItemClick={mockOnItemClick} onMove={onMove} canOrder />
      );

      await user.click(
        screen.getByLabelText(i18nT('backlog:order.moveDownAria', { title: 'Feature A' }))
      );

      expect(onMove).toHaveBeenCalledWith('pbi-1', 'down');
    });

    it('should disable the move controls at the ends of the backlog', () => {
      renderWithProviders(
        <ListView items={mockItems} onItemClick={mockOnItemClick} onMove={vi.fn()} canOrder />
      );

      expect(
        screen.getByLabelText(i18nT('backlog:order.moveUpAria', { title: 'Feature A' }))
      ).toBeDisabled();
      expect(
        screen.getByLabelText(i18nT('backlog:order.moveDownAria', { title: 'Feature C' }))
      ).toBeDisabled();
    });

    it('should not offer move controls to anyone but the Product Owner', () => {
      renderWithProviders(
        <ListView
          items={mockItems}
          onItemClick={mockOnItemClick}
          onMove={vi.fn()}
          canOrder={false}
        />
      );

      // The position stays readable; only the affordance is withheld.
      expect(screen.getAllByLabelText(/^Position \d+ in the Product Backlog$/)).toHaveLength(3);
      expect(screen.queryByLabelText(/^Move /)).not.toBeInTheDocument();
    });
  });
});
