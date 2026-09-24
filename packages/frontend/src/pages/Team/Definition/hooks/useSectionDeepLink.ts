// Pointing a link at one section of the Definition tab.
//
// The tab renders three commitments in a fixed order, and published links -- the Dashboard's
// Definition of Done card, the retired Team Definitions addresses -- name the one they meant. Without
// this, a link to the readiness agreement would open the page and leave the reader to find it.
import { useEffect } from 'react';
import { useLocation } from 'react-router';

/** The section container whose growth means the sections are still filling in. */
export const DEFINITION_PANEL_ID = 'team-definition-panel';

/**
 * How long the layout must hold still before a reveal correction is treated as final.
 *
 * Each section reads its agreement asynchronously, so the page goes on growing after the first paint
 * and the target drifts out from under an immediate scroll. Waiting for the layout to settle is what
 * makes the reveal land on the section the link named rather than where it was when the read began.
 */
const SETTLE_DELAY_MS = 120;

/** A stop for a read that never settles, so the observer can never outlive the visit. */
const SETTLE_BACKSTOP_MS = 3000;

/** The sections of the Definition tab that a link may point straight at. */
export const DEFINITION_SECTION_IDS = [
  'definition-of-done',
  'definition-of-ready',
  'working-agreements',
] as const;

export type DefinitionSectionId = (typeof DEFINITION_SECTION_IDS)[number];

/** Resolves a URL fragment to a section of this tab, or `null` when it names nothing here. */
export function readDefinitionSection(hash: string): DefinitionSectionId | null {
  const candidate = hash.replace(/^#/, '');
  return (DEFINITION_SECTION_IDS as readonly string[]).includes(candidate)
    ? (candidate as DefinitionSectionId)
    : null;
}

/**
 * Reveals the section a link pointed at.
 *
 * The heading is focused as well as scrolled to, so a keyboard user continues from the section the
 * link promised rather than from wherever focus happened to be. Each heading carries a
 * `scroll-margin-top` so it clears anything pinned above it, and a reader who asked for reduced
 * motion gets an instant jump instead of a smooth one.
 *
 * Only the first reveal is animated. Corrections are instant, because a reader should see the section
 * settle into place rather than watch it scroll several times -- and they stop the moment the reader
 * takes over, so a correction can never pull the view back from someone who has moved on.
 */
export function useSectionDeepLink(): void {
  const { hash } = useLocation();

  useEffect(() => {
    const sectionId = readDefinitionSection(hash);
    if (!sectionId) {
      return;
    }

    const heading = document.getElementById(sectionId);
    if (!heading) {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const reveal = (scrollBehaviour: ScrollBehavior): void => {
      heading.scrollIntoView({ behavior: scrollBehaviour, block: 'start' });
      heading.focus({ preventScroll: true });
    };

    reveal(prefersReducedMotion ? 'auto' : 'smooth');

    const panel = document.getElementById(DEFINITION_PANEL_ID);
    if (!panel || typeof ResizeObserver === 'undefined') {
      return;
    }

    let settleTimer: number | undefined;

    const observer = new ResizeObserver(() => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => reveal('auto'), SETTLE_DELAY_MS);
    });

    const stopCorrecting = (): void => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      window.clearTimeout(backstop);
      window.removeEventListener('wheel', stopCorrecting);
      window.removeEventListener('touchstart', stopCorrecting);
      window.removeEventListener('keydown', stopCorrecting);
    };

    observer.observe(panel);

    // Declared before the listeners are attached, so nothing can call `stopCorrecting` -- and read
    // this binding -- before it exists.
    const backstop = window.setTimeout(stopCorrecting, SETTLE_BACKSTOP_MS);

    // The reader's own input outranks any correction still pending.
    window.addEventListener('wheel', stopCorrecting, { passive: true });
    window.addEventListener('touchstart', stopCorrecting, { passive: true });
    window.addEventListener('keydown', stopCorrecting);

    return stopCorrecting;
  }, [hash]);
}
