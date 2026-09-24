/**
 * The deep link into one section of the Definition tab, and the section the reader is in.
 *
 * Layout cannot be asserted in jsdom, so this covers the contract the browser check cannot express in
 * code: a fragment that names a section of this tab reveals it, a fragment that names anything else is
 * left alone, and the navigation is told which section is current -- including the two values it needs
 * from the shell to know where the line is, which cannot be constants because the shell's bar is sized
 * by its contents.
 */
import React from 'react';
import { vi, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, renderWithProviders } from '../../../../test-utils';

import {
  NAV_HEIGHT_VAR,
  TOPBAR_HEIGHT_VAR,
  readDefinitionSection,
  resolveActiveSection,
  useSectionDeepLink,
} from './useSectionDeepLink';
import type { SectionHeading } from './useSectionDeepLink';

/** Reports what the hook says, so the assertions read as the navigation would. */
const ActiveSectionProbe: React.FC = () => {
  const { activeSectionId } = useSectionDeepLink();

  return <span data-testid="active-section">{activeSectionId}</span>;
};

const Harness: React.FC = () => (
  <>
    <ActiveSectionProbe />

    {/* The shell's sticky chrome, which the hook measures rather than assumes. */}
    <div data-app-topbar />
    <div id="definition-section-nav" />

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
      <section aria-labelledby="working-agreements">
        <h2 id="working-agreements" tabIndex={-1}>
          Agreements
        </h2>
      </section>
    </div>
  </>
);

interface RectSpec {
  top?: number;
  height?: number;
}

/**
 * Puts a geometry under the elements the hook measures.
 *
 * jsdom performs no layout, so every rect is zero unless it is stated. The hook is written against real
 * geometry, so the test has to supply some.
 */
const mockGeometry = (rects: Record<string, RectSpec>): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element
  ): DOMRect {
    const key = this.id || (this.hasAttribute('data-app-topbar') ? 'topbar' : '');
    const spec = rects[key] ?? {};
    const top = spec.top ?? 0;
    const height = spec.height ?? 0;

    return {
      top,
      height,
      bottom: top + height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  });
};

/** Stands in for a page long enough that the scroll position is not the end of it. */
const mockPageHeight = (height: number): void => {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: height,
    configurable: true,
  });
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

// The rule the navigation marks itself by, stated directly so it can be read without a viewport.
describe('resolveActiveSection', () => {
  const headings: SectionHeading[] = [
    { id: 'definition-of-done', top: 100 },
    { id: 'definition-of-ready', top: 600 },
    { id: 'working-agreements', top: 1200 },
  ];

  it('resolves the first section while nothing has crossed the line yet', () => {
    expect(resolveActiveSection(headings, 64, false)).toBe('definition-of-done');
  });

  it('resolves the last heading that has crossed the line', () => {
    expect(resolveActiveSection(headings, 700, false)).toBe('definition-of-ready');
  });

  // The last section is often shorter than the viewport, so its heading may never cross the line.
  it('resolves the last section at the end of the page whatever the geometry says', () => {
    expect(resolveActiveSection(headings, 2000, true)).toBe('working-agreements');
  });

  it('resolves a default when no heading is mounted', () => {
    expect(resolveActiveSection([], 0, false)).toBe('definition-of-done');
  });
});

describe('useSectionDeepLink', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;

    mockPageHeight(5000);
    mockGeometry({
      topbar: { height: 64 },
      'definition-section-nav': { height: 47 },
      'definition-of-done': { top: 100 },
      'definition-of-ready': { top: 600 },
      'working-agreements': { top: 1200 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('reports the section a link landed on', () => {
    // The fragment has already been scrolled to, so that heading is the one sitting on the line.
    mockGeometry({
      topbar: { height: 64 },
      'definition-section-nav': { height: 47 },
      'definition-of-done': { top: -1200 },
      'definition-of-ready': { top: -600 },
      'working-agreements': { top: 127 },
    });

    renderWithProviders(<Harness />, {
      initialRoute: '/team?tab=definition#working-agreements',
    });

    expect(screen.getByTestId('active-section')).toHaveTextContent('working-agreements');
  });

  it('reports the section being read as the reader scrolls, not the one the link named', async () => {
    renderWithProviders(<Harness />, {
      initialRoute: '/team?tab=definition#definition-of-done',
    });

    expect(screen.getByTestId('active-section')).toHaveTextContent('definition-of-done');

    // Two headings past the line now, one still below it.
    mockGeometry({
      topbar: { height: 64 },
      'definition-section-nav': { height: 47 },
      'definition-of-done': { top: -900 },
      'definition-of-ready': { top: -400 },
      'working-agreements': { top: 200 },
    });

    window.dispatchEvent(new Event('scroll'));

    await waitFor(() =>
      expect(screen.getByTestId('active-section')).toHaveTextContent('definition-of-ready')
    );
  });

  it('publishes the height of the chrome a link has to clear, measured rather than assumed', () => {
    renderWithProviders(<Harness />);

    // The shell's bar and this page's own navigation are both sized by their contents, so the offset
    // that clears them cannot be a constant -- it is read from the running document.
    const root = document.documentElement;

    expect(root.style.getPropertyValue(TOPBAR_HEIGHT_VAR)).toBe('64px');
    expect(root.style.getPropertyValue(NAV_HEIGHT_VAR)).toBe('47px');
  });
});
