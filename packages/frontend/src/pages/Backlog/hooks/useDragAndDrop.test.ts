import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDragAndDrop } from './useDragAndDrop';
import { MoSCoWPriority, ItemStatus } from '../../../types';
import type { ProductBacklogItem } from '../../../types';

const createMockBacklogItem = (
  overrides: Partial<ProductBacklogItem> = {}
): ProductBacklogItem => ({
  id: 'pbi-1',
  teamId: 'team-1',
  title: 'Test Item',
  description: 'Test description',
  status: ItemStatus.NEW,
  priority: MoSCoWPriority.MUST_HAVE,
  rank: 1,
  storyPoints: 8,
  businessValue: 10,
  labels: ['frontend'],
  acceptanceCriteria: 'Test criteria',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'user-1',
  ...overrides,
});

const createMockDragEvent = (
  data: {
    itemId?: string;
    currentPriority?: string;
  },
  /** Where the pointer sits over the card, used to resolve before/after. */
  pointer: { clientY?: number; rectTop?: number; rectHeight?: number } = {}
): React.DragEvent => {
  const dataStore: Record<string, string> = {};
  const { clientY = 0, rectTop = 0, rectHeight = 100 } = pointer;

  const dataTransfer = {
    getData: vi.fn((key: string) => dataStore[key] || data[key as keyof typeof data] || ''),
    setData: vi.fn((key: string, value: string) => {
      dataStore[key] = value;
    }),
    effectAllowed: 'none' as 'none' | 'copy' | 'move' | 'link' | 'all',
    dropEffect: 'none' as 'none' | 'copy' | 'move' | 'link',
  };

  return {
    dataTransfer,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    type: 'drag',
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    timeStamp: Date.now(),
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    persist: vi.fn(),
    target: null,
    currentTarget: {
      getBoundingClientRect: () => ({ top: rectTop, height: rectHeight }) as DOMRect,
    },
    relatedTarget: null,
    nativeEvent: {},
  } as unknown as React.DragEvent;
};

describe('useDragAndDrop', () => {
  let onDrop: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onDrop = vi.fn();
  });

  describe('Initial State', () => {
    it('should have null draggedItem initially', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));

      expect(result.current.draggedItem).toBeNull();
    });

    it('should have no drop indicator initially', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));

      expect(result.current.dropIndicator).toBeNull();
    });

    it('should return all handler functions', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));

      expect(typeof result.current.handleDragStart).toBe('function');
      expect(typeof result.current.handleDropOnColumn).toBe('function');
      expect(typeof result.current.handleDropOnCard).toBe('function');
      expect(typeof result.current.handleDragOverCard).toBe('function');
      expect(typeof result.current.handleDragOver).toBe('function');
      expect(typeof result.current.handleDragEnd).toBe('function');
    });
  });

  describe('handleDragStart', () => {
    it('should set draggedItem when drag starts', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem();
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event, item);
      });

      expect(result.current.draggedItem).toEqual(item);
    });

    it('should set drag data with itemId', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem({ id: 'test-item-id' });
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event, item);
      });

      expect(event.dataTransfer.setData).toHaveBeenCalledWith('itemId', 'test-item-id');
    });

    it('should set drag data with currentPriority', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem({ priority: MoSCoWPriority.SHOULD_HAVE });
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event, item);
      });

      expect(event.dataTransfer.setData).toHaveBeenCalledWith(
        'currentPriority',
        MoSCoWPriority.SHOULD_HAVE
      );
    });

    it('should set effectAllowed to move', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem();
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event, item);
      });

      expect(event.dataTransfer.effectAllowed).toBe('move');
    });
  });

  describe('handleDropOnColumn', () => {
    it('should call onDrop with the item and the target band', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const event = createMockDragEvent({
        itemId: 'item-1',
        currentPriority: MoSCoWPriority.MUST_HAVE,
      });

      act(() => {
        result.current.handleDropOnColumn(event, MoSCoWPriority.SHOULD_HAVE);
      });

      // A column drop carries no neighbour: the item joins the end of that band.
      expect(onDrop).toHaveBeenCalledWith('item-1', { priority: MoSCoWPriority.SHOULD_HAVE });
    });

    it('should prevent default on drop', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const event = createMockDragEvent({
        itemId: 'item-1',
        currentPriority: MoSCoWPriority.MUST_HAVE,
      });

      act(() => {
        result.current.handleDropOnColumn(event, MoSCoWPriority.SHOULD_HAVE);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should clear draggedItem after drop', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem();
      const dragStartEvent = createMockDragEvent({});
      const dropEvent = createMockDragEvent({
        itemId: 'pbi-1',
        currentPriority: MoSCoWPriority.MUST_HAVE,
      });

      act(() => {
        result.current.handleDragStart(dragStartEvent, item);
      });

      expect(result.current.draggedItem).not.toBeNull();

      act(() => {
        result.current.handleDropOnColumn(dropEvent, MoSCoWPriority.SHOULD_HAVE);
      });

      expect(result.current.draggedItem).toBeNull();
    });

    it('should not call onDrop if itemId is empty', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const event = createMockDragEvent({
        itemId: '',
        currentPriority: MoSCoWPriority.MUST_HAVE,
      });

      act(() => {
        result.current.handleDropOnColumn(event, MoSCoWPriority.SHOULD_HAVE);
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should handle drops on every band', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const priorities = [
        MoSCoWPriority.MUST_HAVE,
        MoSCoWPriority.SHOULD_HAVE,
        MoSCoWPriority.COULD_HAVE,
        MoSCoWPriority.WONT_HAVE,
      ];

      priorities.forEach((priority) => {
        const event = createMockDragEvent({
          itemId: 'item-1',
          currentPriority: MoSCoWPriority.MUST_HAVE,
        });

        act(() => {
          result.current.handleDropOnColumn(event, priority);
        });

        expect(onDrop).toHaveBeenCalledWith('item-1', { priority });
      });
    });
  });

  describe('handleDropOnCard', () => {
    it('should place the item before the neighbour when dropped on the upper half', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const dragged = createMockBacklogItem({ id: 'pbi-1' });
      const target = createMockBacklogItem({
        id: 'pbi-2',
        priority: MoSCoWPriority.SHOULD_HAVE,
      });

      act(() => {
        result.current.handleDragStart(createMockDragEvent({}), dragged);
      });

      const hoverEvent = createMockDragEvent({}, { clientY: 10, rectTop: 0, rectHeight: 100 });

      act(() => {
        result.current.handleDragOverCard(hoverEvent, target);
      });

      expect(result.current.dropIndicator).toEqual({ itemId: 'pbi-2', position: 'before' });

      const dropEvent = createMockDragEvent({ itemId: 'pbi-1' });

      act(() => {
        result.current.handleDropOnCard(dropEvent, target);
      });

      expect(onDrop).toHaveBeenCalledWith('pbi-1', {
        priority: MoSCoWPriority.SHOULD_HAVE,
        targetPbiId: 'pbi-2',
        position: 'before',
      });
    });

    it('should place the item after the neighbour when dropped on the lower half', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const dragged = createMockBacklogItem({ id: 'pbi-1' });
      const target = createMockBacklogItem({ id: 'pbi-2' });

      act(() => {
        result.current.handleDragStart(createMockDragEvent({}), dragged);
      });

      act(() => {
        result.current.handleDragOverCard(
          createMockDragEvent({}, { clientY: 90, rectTop: 0, rectHeight: 100 }),
          target
        );
      });

      expect(result.current.dropIndicator).toEqual({ itemId: 'pbi-2', position: 'after' });

      act(() => {
        result.current.handleDropOnCard(createMockDragEvent({ itemId: 'pbi-1' }), target);
      });

      expect(onDrop).toHaveBeenCalledWith('pbi-1', {
        priority: target.priority,
        targetPbiId: 'pbi-2',
        position: 'after',
      });
    });

    it('should not treat a card as a drop target for itself', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem({ id: 'pbi-1' });

      act(() => {
        result.current.handleDragStart(createMockDragEvent({}), item);
      });

      act(() => {
        result.current.handleDragOverCard(createMockDragEvent({}), item);
      });

      expect(result.current.dropIndicator).toBeNull();

      act(() => {
        result.current.handleDropOnCard(createMockDragEvent({ itemId: 'pbi-1' }), item);
      });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should clear the insertion indicator after the drop', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const dragged = createMockBacklogItem({ id: 'pbi-1' });
      const target = createMockBacklogItem({ id: 'pbi-2' });

      act(() => {
        result.current.handleDragStart(createMockDragEvent({}), dragged);
      });

      act(() => {
        result.current.handleDragOverCard(createMockDragEvent({}), target);
      });

      act(() => {
        result.current.handleDropOnCard(createMockDragEvent({ itemId: 'pbi-1' }), target);
      });

      expect(result.current.dropIndicator).toBeNull();
      expect(result.current.draggedItem).toBeNull();
    });
  });

  describe('handleDragOver', () => {
    it('should prevent default on drag over', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragOver(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should set dropEffect to move', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragOver(event);
      });

      expect(event.dataTransfer.dropEffect).toBe('move');
    });
  });

  describe('handleDragEnd', () => {
    it('should clear draggedItem on drag end', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem();
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event, item);
      });

      expect(result.current.draggedItem).not.toBeNull();

      act(() => {
        result.current.handleDragEnd();
      });

      expect(result.current.draggedItem).toBeNull();
    });

    it('should clear the insertion indicator on drag end', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const dragged = createMockBacklogItem({ id: 'pbi-1' });

      act(() => {
        result.current.handleDragStart(createMockDragEvent({}), dragged);
      });

      act(() => {
        result.current.handleDragOverCard(createMockDragEvent({}), createMockBacklogItem());
      });

      act(() => {
        result.current.handleDragEnd();
      });

      expect(result.current.dropIndicator).toBeNull();
    });

    it('should clear draggedItem even if not dragging', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));

      expect(result.current.draggedItem).toBeNull();

      act(() => {
        result.current.handleDragEnd();
      });

      expect(result.current.draggedItem).toBeNull();
    });
  });

  describe('Complete Drag Flow', () => {
    it('should handle complete drag and drop flow onto a column', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem({
        id: 'flow-item',
        priority: MoSCoWPriority.MUST_HAVE,
      });

      const dragStartEvent = createMockDragEvent({});
      const dragOverEvent = createMockDragEvent({});
      const dropEvent = createMockDragEvent({
        itemId: 'flow-item',
        currentPriority: MoSCoWPriority.MUST_HAVE,
      });

      expect(result.current.draggedItem).toBeNull();

      act(() => {
        result.current.handleDragStart(dragStartEvent, item);
      });

      expect(result.current.draggedItem).toEqual(item);

      act(() => {
        result.current.handleDragOver(dragOverEvent);
      });

      expect(dragOverEvent.preventDefault).toHaveBeenCalled();

      act(() => {
        result.current.handleDropOnColumn(dropEvent, MoSCoWPriority.SHOULD_HAVE);
      });

      expect(onDrop).toHaveBeenCalledWith('flow-item', { priority: MoSCoWPriority.SHOULD_HAVE });
      expect(result.current.draggedItem).toBeNull();
    });

    it('should handle drag cancelled by drag end', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem();

      const dragStartEvent = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(dragStartEvent, item);
      });

      expect(result.current.draggedItem).not.toBeNull();

      act(() => {
        result.current.handleDragEnd();
      });

      expect(result.current.draggedItem).toBeNull();
      expect(onDrop).not.toHaveBeenCalled();
    });
  });

  describe('Stable References', () => {
    it('should have stable handleDragStart reference', () => {
      const { result, rerender } = renderHook(() => useDragAndDrop({ onDrop }));

      const firstRef = result.current.handleDragStart;
      rerender();
      const secondRef = result.current.handleDragStart;

      expect(firstRef).toBe(secondRef);
    });

    it('should have stable handleDropOnColumn reference', () => {
      const { result, rerender } = renderHook(() => useDragAndDrop({ onDrop }));

      const firstRef = result.current.handleDropOnColumn;
      rerender();
      const secondRef = result.current.handleDropOnColumn;

      expect(firstRef).toBe(secondRef);
    });

    it('should have stable handleDragOver reference', () => {
      const { result, rerender } = renderHook(() => useDragAndDrop({ onDrop }));

      const firstRef = result.current.handleDragOver;
      rerender();
      const secondRef = result.current.handleDragOver;

      expect(firstRef).toBe(secondRef);
    });

    it('should have stable handleDragEnd reference', () => {
      const { result, rerender } = renderHook(() => useDragAndDrop({ onDrop }));

      const firstRef = result.current.handleDragEnd;
      rerender();
      const secondRef = result.current.handleDragEnd;

      expect(firstRef).toBe(secondRef);
    });

    it('should update handleDropOnColumn when onDrop changes', () => {
      const onDrop1 = vi.fn();
      const onDrop2 = vi.fn();

      const { result, rerender } = renderHook(({ onDrop }) => useDragAndDrop({ onDrop }), {
        initialProps: { onDrop: onDrop1 },
      });

      const firstRef = result.current.handleDropOnColumn;

      rerender({ onDrop: onDrop2 });

      const secondRef = result.current.handleDropOnColumn;

      expect(firstRef).not.toBe(secondRef);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple sequential drags', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item1 = createMockBacklogItem({ id: 'item-1' });
      const item2 = createMockBacklogItem({ id: 'item-2' });

      const event1 = createMockDragEvent({});
      const event2 = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event1, item1);
      });

      expect(result.current.draggedItem?.id).toBe('item-1');

      act(() => {
        result.current.handleDragEnd();
      });

      expect(result.current.draggedItem).toBeNull();

      act(() => {
        result.current.handleDragStart(event2, item2);
      });

      expect(result.current.draggedItem?.id).toBe('item-2');
    });

    it('should handle drag start without drop', () => {
      const { result } = renderHook(() => useDragAndDrop({ onDrop }));
      const item = createMockBacklogItem();
      const event = createMockDragEvent({});

      act(() => {
        result.current.handleDragStart(event, item);
      });

      expect(result.current.draggedItem).not.toBeNull();
      expect(onDrop).not.toHaveBeenCalled();
    });
  });
});
