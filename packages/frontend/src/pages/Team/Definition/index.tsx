// The team's Definition: one tab, three commitments, in the order the Guide implies.
//
// The Definition of Done is the commitment of the Increment, so it leads. The Definition of Ready is
// this product's complementary practice and follows, marked as such. The working agreements are the
// team's own way of working and close the page. They share one tab because they answer one question
// -- what has this team agreed to hold itself to -- which is what the module's own description of the
// tab says.
//
// This panel owns only the order, the anchors a link can name, and the fallback while a translation
// namespace is fetched. Each section owns its own read, its own states and its own edit affordance,
// so no section can render another's refusal as its own content.
import React, { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/common/Loading';
import type { Team } from '../../../types';
import { WorkingAgreements } from '../../WorkingAgreements/WorkingAgreements';

import { DefinitionOfDoneSection, DefinitionOfReadySection } from './components';
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

  // Reveals the section a link named, when there is one.
  useSectionDeepLink();

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  return (
    <div className={styles.tab} data-testid="team-definition-tab">
      {/* The fallback is scoped to this tab, so a namespace that is still being fetched can never
          replace the module's header and tab strip with a route-level loading screen. */}
      <Suspense fallback={<LoadingState variant="spinner" size="md" label={t('common:loading')} />}>
        <DefinitionOfDoneSection teamId={teamId} team={team} />
        <DefinitionOfReadySection teamId={teamId} />
        <WorkingAgreements teamId={teamId} />
      </Suspense>
    </div>
  );
}

export default DefinitionPanel;
