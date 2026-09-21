import { useState, useCallback } from 'react';

import { type MoSCoWPriority, type ProductBacklogItem } from '../../../types';

/** Where, relative to a neighbour, a dragged item lands. */
export type DropPosition = 'before' | 'after';

/**
 * The place a dragged card was released.
 *
 * `priority` is always resolved (from the card's own band when dropped on a card, or from the
 * column when dropped on empty space). `targetPbiId`/`position` are only present for a drop onto
 * a card: they are what makes "put this item next" expressible — the defect the board had when a
 * drop could only mean "move to this MoSCoW band".
 */
export interface BacklogDropTarget {
  priority: MoSCoWPriority;
  targetPbiId?: string;
  position?: DropPosition;
}

/** The card currently hovered as a drop target, plus the half that would receive the item. */
export interface DropIndicator {
  itemId: string;
  position: DropPosition;
}

/**
 * Props for the useDragAndDrop hook
 */
interface UseDragAndDropProps {
  /** Called when an item is dropped, with the place it was released. */
  onDrop: (itemId: string, target: BacklogDropTarget) => void;
}

/**
 * Return type for the useDragAndDrop hook
 */
interface UseDragAndDropReturn {
  /** Currently dragged item (null if not dragging) */
  draggedItem: ProductBacklogItem | null;
  /** Card + half currently hovered, used to render the insertion line (null if none) */
  dropIndicator: DropIndicator | null;
  /** Handler for drag start event */
  handleDragStart: (e: React.DragEvent, item: ProductBacklogItem) => void;
  /** Handler for a drop on empty column space: the item joins the end of that band */
  handleDropOnColumn: (e: React.DragEvent, priority: MoSCoWPriority) => void;
  /** Handler for a drop on a card: the item lands before/after that neighbour */
  handleDropOnCard: (e: React.DragEvent, targetItem: ProductBacklogItem) => void;
  /** Handler for hovering a card: resolves the half the insertion line is drawn on */
  handleDragOverCard: (e: React.DragEvent, targetItem: ProductBacklogItem) => void;
  /** Handler for drag over event */
  handleDragOver: (e: React.DragEvent) => void;
  /** Handler for drag end event */
  handleDragEnd: () => void;
}

/**
 * Resolve which half of a card the pointer is over.
 *
 * The split is the vertical midpoint of the card: above it the item is placed before the
 * neighbour, below it after. Reading the live rect (rather than tracking offsets) keeps the
 * calculation correct for the board's virtualised rows, which are absolutely positioned.
 */
const resolveDropPosition = (e: React.DragEvent): DropPosition => {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
};

/**
 * Custom hook for managing positional drag-and-drop in the backlog board.
 *
 * This hook encapsulates all drag-and-drop state and handlers including:
 * - Tracking the currently dragged item
 * - Setting drag data (itemId, currentPriority)
 * - Resolving a drop to a position (before/after a neighbour) and/or a MoSCoW band
 * - Tracking the hovered card so an insertion line can be rendered before release
 * - Handling drag end events for cleanup
 *
 * @param props - Configuration object with onDrop callback
 * @returns Object containing drag state and handlers
 *
 * @example
 * ```tsx
 * const { draggedItem, dropIndicator, handleDragStart, handleDropOnCard, handleDragOverCard } =
 *   useDragAndDrop({
 *     onDrop: (itemId, target) => {
 *       reorderItemMutation.mutate({
 *         pbiId: itemId,
 *         targetPbiId: target.targetPbiId!,
 *         position: target.position!,
 *       });
 *     },
 *   });
 * ```
 */
export const useDragAndDrop = (props: UseDragAndDropProps): UseDragAndDropReturn => {
  const { onDrop } = props;

  const [draggedItem, setDraggedItem] = useState<ProductBacklogItem | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  /**
   * Handler for drag start event
   * Sets the drag data and updates the dragged item state
   */
  const handleDragStart = useCallback((e: React.DragEvent, item: ProductBacklogItem) => {
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('currentPriority', item.priority);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(item);
  }, []);

  /**
   * Handler for a drop on empty column space.
   * The item moves to that band and lands at the end of it.
   */
  const handleDropOnColumn = useCallback(
    (e: React.DragEvent, priority: MoSCoWPriority) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('itemId');
      if (itemId) {
        onDrop(itemId, { priority });
      }
      setDraggedItem(null);
      setDropIndicator(null);
    },
    [onDrop]
  );

  /**
   * Handler for a drop on a card.
   * The item lands immediately before/after the hovered neighbour, which is what expresses an
   * order rather than a band.
   */
  const handleDropOnCard = useCallback(
    (e: React.DragEvent, targetItem: ProductBacklogItem) => {
      e.preventDefault();
      e.stopPropagation();

      const itemId = e.dataTransfer.getData('itemId');
      if (itemId && itemId !== targetItem.id) {
        onDrop(itemId, {
          priority: targetItem.priority,
          targetPbiId: targetItem.id,
          position: dropIndicator?.itemId === targetItem.id ? dropIndicator.position : 'before',
        });
      }

      setDraggedItem(null);
      setDropIndicator(null);
    },
    [dropIndicator, onDrop]
  );

  /**
   * Handler for hovering a card: records which half the pointer is over so the insertion line is
   * drawn before the drop.
   */
  const handleDragOverCard = useCallback(
    (e: React.DragEvent, targetItem: ProductBacklogItem) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';

      if (draggedItem?.id === targetItem.id) {
        setDropIndicator(null);
        return;
      }

      const position = resolveDropPosition(e);
      setDropIndicator((current) =>
        current?.itemId === targetItem.id && current.position === position
          ? current
          : { itemId: targetItem.id, position }
      );
    },
    [draggedItem?.id]
  );

  /**
   * Handler for drag over event
   * Prevents default to allow drop
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Handler for drag end event
   * Clears the dragged item state
   */
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropIndicator(null);
  }, []);

  return {
    draggedItem,
    dropIndicator,
    handleDragStart,
    handleDropOnColumn,
    handleDropOnCard,
    handleDragOverCard,
    handleDragOver,
    handleDragEnd,
  };
};
