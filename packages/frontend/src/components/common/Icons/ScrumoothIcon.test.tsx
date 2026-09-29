import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { ScrumoothIcon } from './ScrumoothIcon';

/**
 * Focused tests for the brand mark's conditional rendering.
 *
 * The generic icon suite in `index.test.tsx` only renders each icon with default
 * props, so the `plate` conditional paths (the dark rounded plate + the scaled
 * flow group) are never exercised. These tests turn `plate` on and off to cover
 * both sides of those branches.
 */
describe('ScrumoothIcon', () => {
  it('renders the base mark without the plate by default (only the mask rect)', () => {
    const { container } = render(<ScrumoothIcon />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // Without a plate, the only <rect> is the mask's white keep rectangle.
    expect(container.querySelectorAll('rect').length).toBe(1);
    // The flow group is not transformed when there is no plate.
    expect(container.querySelector('g')?.getAttribute('transform')).toBeNull();
  });

  it('renders the dark rounded plate when plate is true (mask rect + 2 plate rects)', () => {
    const { container } = render(<ScrumoothIcon plate />);

    expect(container.querySelectorAll('rect').length).toBe(3);
    // With a plate, the flow group is scaled and centred inside it.
    expect(container.querySelector('g')?.getAttribute('transform')).toBe(
      'translate(50 50) scale(0.9) translate(-50 -50)'
    );
    // The plate gradient becomes part of the <defs>.
    expect(container.querySelectorAll('linearGradient').length).toBe(3);
  });

  it('does not render the plate gradient when plate is false', () => {
    const { container } = render(<ScrumoothIcon plate={false} />);

    expect(container.querySelectorAll('rect').length).toBe(1);
    expect(container.querySelectorAll('linearGradient').length).toBe(2);
  });

  it('applies the requested size and className to the svg', () => {
    const { container } = render(<ScrumoothIcon size={24} className="brand-mark" />);

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');
    expect(svg?.classList.contains('brand-mark')).toBe(true);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
