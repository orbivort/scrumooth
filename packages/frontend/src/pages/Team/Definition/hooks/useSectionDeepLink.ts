// Which section of the Definition tab the reader is in, and pointing a link at one of them.
//
// The tab renders three commitments in a fixed order, and published links -- the Dashboard's Definition
// of Done card, the Sprint Planning refusals, the retired Team Definitions addresses -- name the one
// they meant. Without the reveal below, a link to the readiness agreement would open the page and leave
// the reader to find it.
//
// The page also carries an in-page navigation for those three sections, and it has to know which one the
// reader is in. That is the same question the fragment answers, so it is answered in one place: this
// hook is the single source of truth for section identity, and both the reveal and the navigation read
// from it. Two independent readers of the same fact would be the one way for the highlighted link and
// the section it names to disagree.
//
// The offset the sections have to clear is measured, not assumed. The shell's topbar has a
// content-driven height, and below the 768px breakpoint it becomes `fixed` while the shell pads the
// content by a different amount -- so a hardcoded offset would be wrong on one of the two breakpoints.
// The measurement is published as custom properties on the root element, where both the sticky
// navigation and the section headings consume it.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

/** The section container whose growth means the sections are still filling in. */
export const DEFINITION_PANEL_ID = 'team-definition-panel';

/** The in-page navigation itself, whose height the section headings must also clear. */
export const DEFINITION_NAV_ID = 'definition-section-nav';

/** The properties the measurement is published under, consumed by the navigation and the headings. */
export const TOPBAR_HEIGHT_VAR = '--app-topbar-height';
export const NAV_HEIGHT_VAR = '--definition-nav-height';

/** The running app's sticky bar, which a class name cannot address because CSS modules hash it. */
const TOPBAR_SELECTOR = '[data-app-topbar]';

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

/**
 * The breathing room between the sticky chrome and a section heading.
 *
 * The scroll-spy decides which section is current using the same sum the headings' `scroll-margin-top`
 * uses, so the highlighted link and the heading the browser put there agree. These two values are one
 * fact and must stay equal: `--space-4`.
 */
const ANCHOR_GAP_PX = 16;

/** Two pixels of slack, because fractional scroll positions never land exactly on the last pixel. */
const SCROLL_END_TOLERANCE_PX = 2;

/**
 * How far below the sticky line a heading may still be and count as entered.
 *
 * The line the navigation marks a section by and the line `scrollIntoView` leaves a heading on are the
 * same line, so a heading the reader has just navigated to sits exactly at the offset -- and layout is
 * fractional, so "exactly" arrives as a fraction of a pixel either side of zero. Without the slack the
 * one section the reader asked for would be the one section the navigation refuses to mark.
 */
const CROSSING_TOLERANCE_PX = 2;

/** What the reader sees before anything is measured, and when no section can be resolved. */
const DEFAULT_SECTION_ID = 'definition-of-done';

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

/** A section's heading, as the scroll-spy sees it. */
export interface SectionHeading {
  id: DefinitionSectionId;
  /** The heading's top edge, in viewport coordinates. */
  top: number;
}

/**
 * The section the reader is in: the last one whose heading has crossed the sticky line.
 *
 * Pure, so the rule can be tested directly rather than through a scrolling document. The last section
 * wins at the end of the page because the final section is often shorter than the viewport and would
 * otherwise never cross the line.
 */
export function resolveActiveSection(
  headings: readonly SectionHeading[],
  offsetPx: number,
  atScrollEnd: boolean
): DefinitionSectionId {
  const first = headings[0];

  if (!first) {
    return DEFAULT_SECTION_ID;
  }

  if (atScrollEnd) {
    return headings[headings.length - 1]?.id ?? first.id;
  }

  let active = first.id;

  for (const heading of headings) {
    if (heading.top - offsetPx <= CROSSING_TOLERANCE_PX) {
      active = heading.id;
    }
  }

  return active;
}

/** What the Definition panel needs to know about where the reader is. */
export interface DefinitionSectionsHandle {
  /** The section the reader is currently in. Always one of `DEFINITION_SECTION_IDS`. */
  activeSectionId: DefinitionSectionId;
}

/** Reads the three headings in the order the page renders them, skipping any that is not mounted. */
function readSectionHeadings(): SectionHeading[] {
  const headings: SectionHeading[] = [];

  for (const id of DEFINITION_SECTION_IDS) {
    const element = document.getElementById(id);

    if (element) {
      headings.push({ id, top: element.getBoundingClientRect().top });
    }
  }

  return headings;
}

function isAtScrollEnd(): boolean {
  return (
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - SCROLL_END_TOLERANCE_PX
  );
}

/**
 * Reveals the section a link pointed at, and reports the section being read.
 *
 * The heading is focused as well as scrolled to, so a keyboard user continues from the section the
 * link promised rather than from wherever focus happened to be. Each heading carries a
 * `scroll-margin-top` so it clears the sticky chrome, and a reader who asked for reduced motion gets an
 * instant jump instead of a smooth one.
 *
 * Only the first reveal is animated. Corrections are instant, because a reader should see the section
 * settle into place rather than watch it scroll several times -- and they stop the moment the reader
 * takes over, so a correction can never pull the view back from someone who has moved on.
 */
export function useSectionDeepLink(): DefinitionSectionsHandle {
  const { hash } = useLocation();

  // Seeded from the fragment so a link that names a section starts with the navigation already on it,
  // before any scroll has happened.
  const [activeSectionId, setActiveSectionId] = useState<DefinitionSectionId>(
    () => readDefinitionSection(hash) ?? DEFAULT_SECTION_ID
  );

  // What was last published, so a measurement that changed nothing costs no style recalculation -- and
  // so an observer can never be driven in a circle by its own writes.
  const publishedRef = useRef<{ topbar: number; nav: number } | null>(null);

  // Where the reader is, and how tall the chrome is. One effect, because the second is an input to the
  // first: a bar that changes height changes which section has crossed the line.
  useEffect(() => {
    const root = document.documentElement;
    const topbar = document.querySelector(TOPBAR_SELECTOR);
    const nav = document.getElementById(DEFINITION_NAV_ID);

    let frame: number | undefined;

    const update = (): void => {
      frame = undefined;

      // Every layout read happens in one batch, before anything is written back, so measuring the page
      // can never interleave with changing it.
      const topbarHeight =
        topbar instanceof HTMLElement ? topbar.getBoundingClientRect().height : 0;
      const navHeight = nav instanceof HTMLElement ? nav.getBoundingClientRect().height : 0;
      const headings = readSectionHeadings();
      const atScrollEnd = isAtScrollEnd();

      const published = publishedRef.current;

      // Read as two values rather than one chained condition: each may be absent on its own, and the
      // comparison is with a number, so an absent one is always a change.
      const previousTopbar = published?.topbar;
      const previousNav = published?.nav;

      if (previousTopbar !== topbarHeight || previousNav !== navHeight) {
        publishedRef.current = { topbar: topbarHeight, nav: navHeight };
        root.style.setProperty(TOPBAR_HEIGHT_VAR, `${Math.round(topbarHeight)}px`);
        root.style.setProperty(NAV_HEIGHT_VAR, `${Math.round(navHeight)}px`);
      }

      const next = resolveActiveSection(
        headings,
        topbarHeight + navHeight + ANCHOR_GAP_PX,
        atScrollEnd
      );

      // Written only when it actually changes, so scrolling inside one section costs no re-render.
      setActiveSectionId((current) => (current === next ? current : next));
    };

    const schedule = (): void => {
      if (frame !== undefined) {
        return;
      }

      frame = window.requestAnimationFrame(update);
    };

    update();

    // The shell's bar and this page's own navigation are both content-driven, so either can change
    // height after the first paint -- a wrapped label, a longer team name, a narrower viewport.
    let observer: ResizeObserver | undefined;

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);

      if (topbar) {
        observer.observe(topbar);
      }

      if (nav) {
        observer.observe(nav);
      }
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame);
      }

      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  // The reveal, re-run whenever the address names a different section.
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

    /**
     * Whether the reader is working in this page's own section navigation.
     *
     * The reveal moves focus to the heading so a keyboard reader continues from the section a link
     * promised. That is right for a cold deep link, where focus is nowhere in particular -- and wrong
     * for the strip, which is made of links to these same sections: taking focus off the entry the
     * reader just activated would answer their next Tab or Enter with a jump they did not ask for,
     * and the section they asked for would never arrive.
     */
    const readerIsInSectionNav = (): boolean => {
      const active = document.activeElement;
      return active instanceof Element && active.closest(`#${DEFINITION_NAV_ID}`) !== null;
    };

    const reveal = (scrollBehaviour: ScrollBehavior): void => {
      // Read before the scroll, because moving the page can move focus with it.
      const keepFocusWhereItIs = readerIsInSectionNav();

      heading.scrollIntoView({ behavior: scrollBehaviour, block: 'start' });

      if (!keepFocusWhereItIs) {
        heading.focus({ preventScroll: true });
      }
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

  return { activeSectionId };
}
