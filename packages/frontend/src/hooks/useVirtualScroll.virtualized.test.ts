import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Focused tests that cover the "virtualizer has produced items" path of
 * `useVirtualScroll`.
 *
 * In jsdom the real `@tanstack/react-virtual` never measures a scroll element,
 * so `getVirtualItems()` is always empty and the hook falls back to
 * `INITIAL_RENDER_LIMIT` items. Mocking the virtualizer lets us exercise the
 * mapping branch and the `scrollToIndex`/`measureElement` delegations, which the
 * jsdom-based suite in `useVirtualScroll.test.ts` cannot reach.
 */
const { virtualizerMock } = vi.hoisted(() => ({
  virtualizerMock: {
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
    getTotalSize: vi.fn(),
    getVirtualItems: vi.fn(),
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => virtualizerMock,
}));

import { useVirtualScroll } from './useVirtualScroll';

const virtualItems = [
  { index: 0, size: 50, start: 0, end: 50, key: 'k0' },
  { index: 2, size: 50, start: 100, end: 150, key: 'k2' },
];

describe('useVirtualScroll (populated virtualizer)', () => {
  beforeEach(() => {
    virtualizerMock.scrollToIndex.mockReset();
    virtualizerMock.measureElement.mockReset();
    virtualizerMock.getTotalSize.mockReset().mockReturnValue(500);
    virtualizerMock.getVirtualItems.mockReset().mockReturnValue(virtualItems);
  });

  it('maps the virtualizer items back to their source items', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const { result } = renderHook(() => useVirtualScroll(items, 50, 5));

    expect(result.current.virtualItems).toHaveLength(2);
    expect(result.current.virtualItems[0]).toMatchObject({
      index: 0,
      size: 50,
      start: 0,
      end: 50,
      key: 'k0',
    });
    expect(result.current.virtualItems[0]?.item).toEqual(items[0]);
    expect(result.current.virtualItems[1]?.item).toEqual(items[2]);
    expect(result.current.totalSize).toBe(500);
  });

  it('delegates scrollToIndex to the underlying virtualizer', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const { result } = renderHook(() => useVirtualScroll(items, 50, 5));

    act(() => {
      result.current.scrollToIndex(2, { align: 'center' });
    });

    expect(virtualizerMock.scrollToIndex).toHaveBeenCalledWith(2, { align: 'center' });
  });

  it('delegates measureElement to the underlying virtualizer', () => {
    const items = [{ id: 'a' }];

    const { result } = renderHook(() => useVirtualScroll(items, 50, 5));

    act(() => {
      result.current.measureElement(null);
    });

    expect(virtualizerMock.measureElement).toHaveBeenCalledWith(null);
  });
});
