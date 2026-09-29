// The team's Definition: one page, three commitments, in the order the Guide implies.
//
// The Definition of Done is the commitment of the Increment, so it leads. The Definition of Ready is
// this product's complementary practice and follows, marked as such. The working agreements are the
// team's own way of working and close the page. They share one page because they answer one question
// -- what has this team agreed to hold itself to -- which is what the module's own description of the
// tab says.
//
// They are reached by an in-page navigation rather than by tabs, and that is deliberate. Tabs would
// say three parallel views, two of them hidden, and would put a second "active" language directly
// under the module's own rail; the anchors are also the identity the deep links already publish
// (`#definition-of-done`, `#definition-of-ready`, `#working-agreements`). So the page keeps its one
// document and gains a way to enter it at the section the reader means.
//
// This panel owns the order, the anchors a link can name, the navigation above them, and the fallback
// while a translation namespace is fetched. Each section owns its own read, its own states and its own
// edit affordance, so no section can render another's refusal as its own content -- and the count the
// navigation shows is published by the section that read it, never derived a second time here.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/common/Loading';
import type { Team } from '../../../types';
import { WorkingAgreements } from '../../WorkingAgreements/WorkingAgreements';

import { SectionCountsProvider } from './SectionCountsContext';
import { DefinitionOfDoneSection, DefinitionOfReadySection, SectionNav } from './components';
import { useSectionDeepLink } from './hooks/useSectionDeepLink';
import styles from './DefinitionTab.module.css';

export interface DefinitionPanelProps {
  /** The team the module shell resolved; every section works from it. */
  teamId: string | undefined;
  /** The resolved team, which carries the group whose Definition of Done governs it. */
  team: Team | null;
}

export function DefinitionPanel({ teamId, team }: DefinitionPanelProps): React.ReactElement {
  const { t } = useTranslation(['settings', 'common']);

  // Reveals the section a link named, and reports the one being read so the navigation can mark it.
  const { activeSectionId } = useSectionDeepLink();

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  return (
    <div className={styles.tab} data-testid="team-definition-tab">
      {/* The fallback is scoped to this tab, so a namespace that is still being fetched can never
          replace the module's header and tab strip with a route-level loading screen. */}
      <Suspense fallback={<LoadingState variant="spinner" size="md" label={t('common:loading')} />}>
        <SectionCountsProvider>
          <SectionNav activeSectionId={activeSectionId} />

          <DefinitionOfDoneSection
            teamId={teamId}
            team={team}
            isActive={activeSectionId === 'definition-of-done'}
          />
          <DefinitionOfReadySection
            teamId={teamId}
            isActive={activeSectionId === 'definition-of-ready'}
          />
          <WorkingAgreements teamId={teamId} isActive={activeSectionId === 'working-agreements'} />
        </SectionCountsProvider>
      </Suspense>
    </div>
  );
}

export default DefinitionPanel;
