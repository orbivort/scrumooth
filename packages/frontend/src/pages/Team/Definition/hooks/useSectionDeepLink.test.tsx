/**
 * The deep link into one section of the Definition tab.
 *
 * Layout cannot be asserted in jsdom, so this covers the contract the browser check cannot express in
 * code: a fragment that names a section of this tab reveals it, and a fragment that names anything
 * else is left alone.
 */
import React from 'react';
import { vi } from 'vitest';

import { renderWithProviders } from '../../../../test-utils';

import { readDefinitionSection, useSectionDeepLink } from './useSectionDeepLink';

const Harness: React.FC = () => {
  useSectionDeepLink();

  return (
    <div id="team-definition-panel">
      <section aria-labelledby="definition-of-done">
        <h2 id="definition-of-done" tabIndex={-1}>
          Definition of Done
        </h2>
      </section>
      <section aria-labelledby="definition-of-ready">
        <h2 id="definition-of-ready" tabIndex={-1}>
          Definition of Ready
        </h2>
      </section>
    </div>
  );
};

describe('readDefinitionSection', () => {
  it('resolves every section a link may name', () => {
    expect(readDefinitionSection('#definition-of-done')).toBe('definition-of-done');
    expect(readDefinitionSection('#definition-of-ready')).toBe('definition-of-ready');
    expect(readDefinitionSection('#working-agreements')).toBe('working-agreements');
  });

  it('resolves nothing for a fragment that names no section of this tab', () => {
    expect(readDefinitionSection('')).toBeNull();
    expect(readDefinitionSection('#')).toBeNull();
    expect(readDefinitionSection('#somewhere-else')).toBeNull();
  });
});

describe('useSectionDeepLink', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  it('scrolls to and focuses the section the fragment names', () => {
    renderWithProviders(<Harness />, {
      initialRoute: '/team?tab=definition#definition-of-ready',
    });

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(document.getElementById('definition-of-ready')).toHaveFocus();
  });

  it('leaves the page alone when the fragment names no section of this tab', () => {
    renderWithProviders(<Harness />, { initialRoute: '/team?tab=definition#somewhere-else' });

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(document.getElementById('definition-of-done')).not.toHaveFocus();
    expect(document.getElementById('definition-of-ready')).not.toHaveFocus();
  });
});
