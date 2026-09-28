import React, { useRef, useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { useFocusTrap } from './useFocusTrap';

/**
 * jsdom does not lay out elements, so `offsetParent` is always `null` which makes the
 * hook's visibility filter drop every candidate. Stub it to mirror a rendered element
 * (an element has an offsetParet whenever it is attached to the document).
 */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });
});

interface TrapProps {
  withCloseButton?: boolean;
}

const Trap: React.FC<TrapProps> = ({ withCloseButton = true }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(true);
  useFocusTrap(true, modalRef);

  return (
    <div>
      <button type="button" onClick={() => setMounted(false)}>
        unmount-content
      </button>
      {mounted && (
        <div ref={modalRef} role="dialog">
          {withCloseButton && (
            <button type="button" data-modal-close>
              close
            </button>
          )}
          <input aria-label="field" />
        </div>
      )}
    </div>
  );
};

describe('useFocusTrap', () => {
  it('focuses the close button when the modal contains one', async () => {
    render(<Trap withCloseButton />);

    await waitFor(() => {
      expect(screen.getByText('close')).toHaveFocus();
    });
  });

  it('focuses the first focusable element when there is no close button', async () => {
    render(<Trap withCloseButton={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText('field')).toHaveFocus();
    });
  });

  it('cycles focus with Tab and Shift+Tab', async () => {
    render(<Trap withCloseButton />);

    const close = screen.getByText('close');
    const field = screen.getByLabelText('field');

    await waitFor(() => expect(close).toHaveFocus());

    // Shift+Tab on the first element wraps to the last element.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(field).toHaveFocus();

    // Shift+Tab on a middle/last element does nothing (not the first element).
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(field).toHaveFocus();

    // Tab on the last element wraps to the first element.
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    // Tab on a middle/first element does nothing (not the last element).
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
  });

  it('ignores non-Tab keys for focus cycling', async () => {
    render(<Trap withCloseButton />);

    const close = screen.getByText('close');
    await waitFor(() => expect(close).toHaveFocus());

    fireEvent.keyDown(document, { key: 'a' });
    expect(close).toHaveFocus();
  });

  it('dispatches modalCloseRequest on Escape', async () => {
    render(<Trap withCloseButton />);

    const dialog = screen.getByRole('dialog');
    const listener = vi.fn();
    dialog.addEventListener('modalCloseRequest', listener);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is a no-op while the modal element is not mounted', async () => {
    render(<Trap withCloseButton />);

    const close = screen.getByText('close');
    await waitFor(() => expect(close).toHaveFocus());

    // Remove the dialog from the tree while the trap stays active: the ref becomes null
    // and the keydown handler must bail out without throwing.
    fireEvent.click(screen.getByText('unmount-content'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(() => fireEvent.keyDown(document, { key: 'Tab' })).not.toThrow();
  });
});
