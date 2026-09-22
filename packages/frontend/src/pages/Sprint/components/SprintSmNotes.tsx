// Sprint-level Scrum Master notes.
//
// The Sprint Review and the Retrospective each had a notes editor; the Sprint itself -- the event
// the Scrum Master lives in day to day -- had none, so `PATCH /sprints/:id/sm-notes` existed with no
// way to reach it. This panel is that surface: the same notes component, wired to the Sprint and to
// its revision history.
import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { SMNotes } from '../../../components/common/SMNotes';
import { smDashboardService } from '../../../services';
import { queryKeys } from '../../../hooks/queryKeys';

import styles from './SprintSmNotes.module.css';

interface SprintSmNotesProps {
  sprintId: string;
  /** The Sprint's notes. Present only for the team's Scrum Master. */
  smNotes?: string | null;
}

export const SprintSmNotes: React.FC<SprintSmNotesProps> = ({ sprintId, smNotes }) => {
  const { t } = useTranslation('scrum-master-dashboard');
  const queryClient = useQueryClient();

  const handleSave = useCallback(
    async (notes: string) => {
      await smDashboardService.updateSprintSmNotes(sprintId, notes);
      // The notes hang off the Sprint, so the board's active-sprint query is what has to refresh.
      await queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
    },
    [sprintId, queryClient]
  );

  const loadHistory = useCallback(async () => {
    const response = await smDashboardService.getSprintSmNotesRevisions(sprintId);

    return response.data?.revisions ?? [];
  }, [sprintId]);

  return (
    <section className={styles.panel} data-testid="sprint-sm-notes">
      <p className={styles.hint}>{t('sprintNotes.hint')}</p>
      <SMNotes value={smNotes} onSave={handleSave} loadHistory={loadHistory} />
    </section>
  );
};

export default SprintSmNotes;
