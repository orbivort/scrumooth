// The Definition tab's in-page navigation.
//
// It is a list of links, not a tab strip, and that is the point. The three commitments are clauses of
// one answer to one question -- what has this team agreed to hold itself to -- and they are read in the
// order the Guide implies. A nested tablist would say the opposite: three parallel views, two of them
// hidden, and a second "active" language competing with the module's own rail directly above.
//
// So each entry is a real anchor to the section's heading, which is the same anchor the deep links
// already publish. Nothing is hidden, the browser's own in-page navigation works, middle-click and
// copy-link work, and `aria-current` says which one the reader is in.
//
// Deliberately quieter than the module rail: text only, no icons, and a bare 2px indicator with no track
// rule under it. Two strips of equal weight on one screen would leave the reader unsure which one they
// had just changed.
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useSectionCounts } from '../SectionCountsContext';
import { DEFINITION_NAV_ID, DEFINITION_SECTION_IDS } from '../hooks/useSectionDeepLink';
import type { DefinitionSectionId } from '../hooks/useSectionDeepLink';

import styles from './SectionNav.module.css';

export interface SectionNavProps {
  /** The section the reader is in, from the hook that also drives the deep-link reveal. */
  activeSectionId: DefinitionSectionId;
}

export function SectionNav({ activeSectionId }: SectionNavProps): React.ReactElement {
  // Two namespaces, because the three headings keep their own: the two agreements live in `settings`,
  // the working agreements in `agreements`.
  const { t } = useTranslation('settings');
  const { t: tAgreements } = useTranslation('agreements');

  const counts = useSectionCounts();

  /**
   * The label is the section's own title, taken from the same key the section renders.
   *
   * Not a copy of it: a navigation entry that could drift from the heading it points at would be worse
   * than no navigation at all.
   */
  const labels: Record<DefinitionSectionId, string> = {
    'definition-of-done': t('dodPanel.title'),
    'definition-of-ready': t('dorPanel.title'),
    'working-agreements': tAgreements('agreements.title'),
  };

  return (
    <nav
      id={DEFINITION_NAV_ID}
      className={styles.nav}
      aria-label={t('definitionNav.label')}
      data-testid="definition-section-nav"
    >
      <ul className={styles.list}>
        {DEFINITION_SECTION_IDS.map((sectionId) => {
          const label = labels[sectionId];
          const count = counts[sectionId];
          const isActive = sectionId === activeSectionId;

          return (
            <li key={sectionId} className={styles.item}>
              {/*
                The count is decoration on the visible surface and part of the name to a screen reader:
                a bare "5" read after the heading would be a number with nothing saying what it counts.
              */}
              <a
                className={styles.link}
                href={`#${sectionId}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={
                  count === undefined
                    ? undefined
                    : t('definitionNav.sectionWithCount', { name: label, count })
                }
              >
                <span className={styles['link-label']}>{label}</span>

                {count !== undefined && (
                  <span className={styles.count} aria-hidden="true">
                    {count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default SectionNav;
