/* eslint-disable react-refresh/only-export-components -- Provider and hooks are co-located */
// How many active items each section of the Definition tab is holding.
//
// The in-page navigation shows that count beside each section's name, but the count is not the
// navigation's to know: each section reads its own agreement, and the tab is built so that no section
// can render another's read. So the sections publish the number they already computed and the
// navigation renders what it was told.
//
// Reading the agreements again inside the navigation would have been the obvious shortcut and the wrong
// one -- it would put three domain reads in a component whose only job is to draw three links, and it
// would make the navigation's count come from a second derivation of the same fact.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { DefinitionSectionId } from './hooks/useSectionDeepLink';

/** A section's count, absent while its read is still in flight. */
export type SectionCounts = Partial<Record<DefinitionSectionId, number>>;

interface SectionCountsValue {
  counts: SectionCounts;
  publish: (sectionId: DefinitionSectionId, count: number | undefined) => void;
}

const SectionCountsContext = createContext<SectionCountsValue | null>(null);

/** A stable empty value, so a section outside the provider never re-renders on a new object. */
const NO_COUNTS: SectionCounts = {};

/**
 * Holds the counts the sections publish.
 *
 * Only the runs that actually change anything produce a new object, so a section re-rendering for its
 * own reasons does not re-render every other section through this context.
 */
export const SectionCountsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [counts, setCounts] = useState<SectionCounts>({});

  const publish = useCallback((sectionId: DefinitionSectionId, count: number | undefined) => {
    setCounts((current) => {
      if (count === undefined) {
        if (!(sectionId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[sectionId];
        return next;
      }

      if (current[sectionId] === count) {
        return current;
      }

      return { ...current, [sectionId]: count };
    });
  }, []);

  const value = useMemo<SectionCountsValue>(() => ({ counts, publish }), [counts, publish]);

  return <SectionCountsContext.Provider value={value}>{children}</SectionCountsContext.Provider>;
};

/** The counts published so far. Empty outside the provider, so a section stays renderable alone. */
export function useSectionCounts(): SectionCounts {
  return useContext(SectionCountsContext)?.counts ?? NO_COUNTS;
}

/**
 * Publishes a section's count, and withdraws it when the section unmounts or the count is unknown.
 *
 * Withdrawing matters: a stale number left behind by a section that failed to read would be a claim
 * about an agreement nobody had loaded.
 */
export function usePublishSectionCount(
  sectionId: DefinitionSectionId,
  count: number | undefined
): void {
  const publish = useContext(SectionCountsContext)?.publish;

  useEffect(() => {
    if (!publish) {
      return;
    }

    publish(sectionId, count);

    return () => publish(sectionId, undefined);
  }, [publish, sectionId, count]);
}
