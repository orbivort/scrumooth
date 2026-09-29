/**
 * BoardView Component
 *
 * A Kanban-style board view for displaying product backlog items organized by MoSCoW priority.
 * Supports drag-and-drop for re-prioritizing items between columns.
 * Includes keyboard-accessible drag and drop for accessibility.
 * Uses virtual scrolling for performance with large lists (>50 items per column).
 *
 * @module pages/Backlog/views/BoardView
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ProductBacklogItem, MoSCoWPriority } from '../../../types';
import { MOSCOW_CONFIG } from '../config/moscow.config';
import { MoscowCard } from '../components/MoscowCard';
import {
  useDragAndDrop,
  type BacklogDropTarget,
  type DropIndicator,
} from '../hooks/useDragAndDrop';
import { useVirtualScroll, shouldEnableVirtualization } from '../../../hooks/useVirtualScroll';

import styles from './BoardView.module.css';

/**
 * Helper function to get translated MoSCoW labels
 */
const getMoscowLabels = (t: (key: string) => string) => ({
  [MoSCoWPriority.MUST_HAVE]: {
    label: t('moscow.mustHave') as string,
    description: t('moscow.mustHaveDesc') as string,
  },
  [MoSCoWPriority.SHOULD_HAVE]: {
    label: t('moscow.shouldHave') as string,
    description: t('moscow.shouldHaveDesc') as string,
  },
  [MoSCoWPriority.COULD_HAVE]: {
    label: t('moscow.couldHave') as string,
    description: t('moscow.couldHaveDesc') as string,
  },
  [MoSCoWPriority.WONT_HAVE]: {
    label: t('moscow.wontHave') as string,
    description: t('moscow.wontHaveDesc') as string,
  },
});

/**
 * Props for the BoardView component
 */
export interface BoardViewProps {
  /** Items grouped by MoSCoW priority */
  itemsByMoscow: Record<MoSCoWPriority, ProductBacklogItem[]>;
  /** Callback when an item is clicked */
  onItemClick: (item: ProductBacklogItem) => void;
  /**
   * Callback when a card is dropped, carrying the band it landed in and — when it was dropped on
   * a neighbour — the position relative to that neighbour. This is what makes a MoSCoW board
   * able to express "this item is next" instead of only "this item is a Must Have".
   */
  onReorder: (itemId: string, target: BacklogDropTarget) => void;
  /** Callback when an item's band is changed without a pointer (keyboard move) */
  onPriorityChange: (itemId: string, newPriority: MoSCoWPriority) => void;
  /** Whether the viewer may order the backlog (Product Owner only) */
  canOrder: boolean;
}

/**
 * Estimated height of each MoscowCard in pixels
 */
const CARD_ESTIMATE_HEIGHT = 140;

/**
 * Number of items to render outside the visible area for smoother scrolling
 */
const OVERSCAN_COUNT = 3;

/**
 * Threshold for enabling virtual scrolling (items per column)
 */
const VIRTUALIZATION_THRESHOLD = 50;

/**
 * VirtualizedColumn Component
 *
 * Renders a single MoSCoW column with virtual scrolling support for large lists.
 */
interface VirtualizedColumnProps {
  priority: MoSCoWPriority;
  items: ProductBacklogItem[];
  config: (typeof MOSCOW_CONFIG)[MoSCoWPriority];
  isDraggingOver: boolean;
  itemsCountByPriority: Record<MoSCoWPriority, number>;
  draggedItem: ProductBacklogItem | null;
  dropIndicator: DropIndicator | null;
  onDragStart: (e: React.DragEvent, item: ProductBacklogItem) => void;
  onDragEnd: () => void;
  onDropOnColumn: (e: React.DragEvent, priority: MoSCoWPriority) => void;
  onDropOnCard: (e: React.DragEvent, item: ProductBacklogItem) => void;
  onDragOverCard: (e: React.DragEvent, item: ProductBacklogItem) => void;
  onDragOver: (e: React.DragEvent) => void;
  onItemClick: (item: ProductBacklogItem) => void;
  onPriorityChange: (itemId: string, newPriority: MoSCoWPriority) => void;
  canOrder: boolean;
  forceVirtualization?: boolean;
}

const VirtualizedColumn: React.FC<VirtualizedColumnProps> = ({
  priority,
  items,
  config,
  isDraggingOver,
  itemsCountByPriority,
  draggedItem,
  dropIndicator,
  onDragStart,
  onDragEnd,
  onDropOnColumn,
  onDropOnCard,
  onDragOverCard,
  onDragOver,
  onItemClick,
  onPriorityChange,
  canOrder,
  forceVirtualization,
}) => {
  const { t } = useTranslation('backlog');
  const moscowLabels = getMoscowLabels(t as (key: string) => string);
  const enableVirtualization =
    forceVirtualization ?? shouldEnableVirtualization(items.length, VIRTUALIZATION_THRESHOLD);

  const { virtualItems, totalSize, containerRef, measureElement } = useVirtualScroll(
    items,
    CARD_ESTIMATE_HEIGHT,
    OVERSCAN_COUNT,
    { enabled: enableVirtualization }
  );

  const handleDrop = (e: React.DragEvent) => {
    onDropOnColumn(e, priority);
  };

  /**
   * Build the drop-zone props for one card.
   *
   * The whole card is the drop target, and hovering it resolves which half the pointer is over so
   * the insertion line is visible before release. The wrapper is presentational: the card itself
   * stays the list item, so the board's list semantics are unchanged.
   */
  const cardDropZoneProps = (item: ProductBacklogItem) => ({
    role: 'presentation' as const,
    'data-drop-zone': item.id,
    className: `${styles['card-drop-zone']} ${
      dropIndicator?.itemId === item.id
        ? styles[dropIndicator.position === 'before' ? 'drop-before' : 'drop-after']
        : ''
    }`,
    onDragOver: (e: React.DragEvent) => onDragOverCard(e, item),
    onDrop: (e: React.DragEvent) => onDropOnCard(e, item),
  });

  const translatedLabel = moscowLabels[priority].label;
  const translatedDescription = moscowLabels[priority].description;

  return (
    <div
      className={`${styles['moscow-column']} ${isDraggingOver ? styles['drag-active'] : ''}`}
      onDrop={handleDrop}
      onDragOver={onDragOver}
      role="list"
      aria-label={`${translatedLabel} column, ${items.length} items`}
      style={
        {
          '--column-color': config.color,
          '--column-bg': config.bgColor,
          '--column-gradient-from': config.gradientFrom,
          '--column-gradient-to': config.gradientTo,
          '--column-border': config.borderColor,
        } as React.CSSProperties
      }
    >
      <div className={styles['moscow-column-header']}>
        <div className={styles['moscow-column-title-row']}>
          <div className={styles['moscow-column-icon']}>
            {/* eslint-disable-next-line icon-rules/no-inline-svg -- Dynamic icon from config */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={config.icon} />
            </svg>
          </div>
          <div className={styles['moscow-column-title-info']}>
            <h3 className={styles['moscow-column-title']}>{translatedLabel}</h3>
            <span className={styles['moscow-column-desc']}>{translatedDescription}</span>
          </div>
        </div>
        <div className={styles['moscow-column-count']}>
          <span className={styles['count-number']}>{items.length}</span>
          <span className={styles['count-label']}>{t('boardView.items') as string}</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`${styles['moscow-column-body']} ${enableVirtualization ? styles['virtualized'] : ''}`}
        style={
          enableVirtualization
            ? {
                flex: 'none',
                height: 'calc(100vh - 350px)',
                minHeight: '400px',
                overflow: 'auto',
              }
            : undefined
        }
      >
        {items.length === 0 ? (
          <div className={styles['moscow-empty-column']}>
            {/* eslint-disable-next-line icon-rules/no-inline-svg -- Dynamic icon from config */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.3"
            >
              <path d={config.icon} />
            </svg>
            <span>{t('boardView.dropItemsHere') as string}</span>
          </div>
        ) : enableVirtualization ? (
          <div style={{ height: totalSize, position: 'relative', width: '100%' }}>
            {virtualItems.map(({ item, key, start, index }) => (
              <div
                key={key}
                ref={measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${start}px)`,
                }}
                data-index={index}
                {...cardDropZoneProps(item)}
              >
                <MoscowCard
                  item={item}
                  onDragStart={(e) => onDragStart(e, item)}
                  onDragEnd={onDragEnd}
                  onClick={() => onItemClick(item)}
                  isDragging={draggedItem?.id === item.id}
                  onMovePriority={onPriorityChange}
                  itemsCountByPriority={itemsCountByPriority}
                  canOrder={canOrder}
                  position={item.rank}
                />
              </div>
            ))}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} {...cardDropZoneProps(item)}>
              <MoscowCard
                item={item}
                onDragStart={(e) => onDragStart(e, item)}
                onDragEnd={onDragEnd}
                onClick={() => onItemClick(item)}
                isDragging={draggedItem?.id === item.id}
                onMovePriority={onPriorityChange}
                itemsCountByPriority={itemsCountByPriority}
                canOrder={canOrder}
                position={item.rank}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * BoardView Component
 *
 * Renders a 4-column Kanban board with:
 * - Must Have column (critical items)
 * - Should Have column (important items)
 * - Could Have column (nice-to-have items)
 * - Won't Have column (out-of-scope items)
 *
 * Each column displays:
 * - Header with icon, title, description, and item count
 * - Draggable cards for each item (with virtual scrolling for large lists)
 * - Empty state placeholder when no items
 *
 * Virtual scrolling is automatically enabled when total items across all columns
 * exceed 50 to maintain smooth performance.
 *
 * @param props - Component props
 * @returns The rendered BoardView component
 *
 * @example
 * ```tsx
 * <BoardView
 *   itemsByMoscow={itemsByMoscow}
 *   onItemClick={(item) => openDetailModal(item)}
 *   onPriorityChange={(id, priority) => updatePriority(id, priority)}
 * />
 * ```
 */
export const BoardView: React.FC<BoardViewProps> = ({
  itemsByMoscow,
  onItemClick,
  onReorder,
  onPriorityChange,
  canOrder,
}) => {
  const { t } = useTranslation('backlog');
  const {
    draggedItem,
    dropIndicator,
    handleDragStart,
    handleDropOnColumn,
    handleDropOnCard,
    handleDragOverCard,
    handleDragOver,
    handleDragEnd,
  } = useDragAndDrop({
    onDrop: onReorder,
  });

  /**
   * Calculate item counts per priority for screen reader announcements
   */
  const itemsCountByPriority = useMemo(() => {
    return {
      [MoSCoWPriority.MUST_HAVE]: itemsByMoscow[MoSCoWPriority.MUST_HAVE].length,
      [MoSCoWPriority.SHOULD_HAVE]: itemsByMoscow[MoSCoWPriority.SHOULD_HAVE].length,
      [MoSCoWPriority.COULD_HAVE]: itemsByMoscow[MoSCoWPriority.COULD_HAVE].length,
      [MoSCoWPriority.WONT_HAVE]: itemsByMoscow[MoSCoWPriority.WONT_HAVE].length,
    };
  }, [itemsByMoscow]);

  /**
   * Calculate total items across all columns for virtualization decision
   * Virtual scrolling is enabled based on total items, not per-column count
   */
  const totalItems = useMemo(() => {
    return (
      itemsByMoscow[MoSCoWPriority.MUST_HAVE].length +
      itemsByMoscow[MoSCoWPriority.SHOULD_HAVE].length +
      itemsByMoscow[MoSCoWPriority.COULD_HAVE].length +
      itemsByMoscow[MoSCoWPriority.WONT_HAVE].length
    );
  }, [itemsByMoscow]);

  /**
   * Enable virtualization based on total items across all columns
   */
  const enableVirtualization = shouldEnableVirtualization(totalItems, VIRTUALIZATION_THRESHOLD);

  return (
    <div
      className={styles['moscow-board-view']}
      role="list"
      aria-label={t('aria.priorityBoard') as string}
    >
      {Object.values(MoSCoWPriority).map((priority) => {
        const config = MOSCOW_CONFIG[priority];
        const items = itemsByMoscow[priority];
        const isDraggingOver = draggedItem !== null;

        return (
          <VirtualizedColumn
            key={priority}
            priority={priority}
            items={items}
            config={config}
            isDraggingOver={isDraggingOver}
            itemsCountByPriority={itemsCountByPriority}
            draggedItem={draggedItem}
            dropIndicator={dropIndicator}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDropOnColumn={handleDropOnColumn}
            onDropOnCard={handleDropOnCard}
            onDragOverCard={handleDragOverCard}
            onDragOver={handleDragOver}
            onItemClick={onItemClick}
            onPriorityChange={onPriorityChange}
            canOrder={canOrder}
            forceVirtualization={enableVirtualization}
          />
        );
      })}
    </div>
  );
};

export default BoardView;
