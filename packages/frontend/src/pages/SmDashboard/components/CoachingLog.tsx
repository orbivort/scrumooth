// The Scrum Master's private coaching log.
//
// The Guide's first two Scrum Master services -- coaching the team in self-management and
// cross-functionality -- leave no trace in any artifact, which is why they were invisible on this
// dashboard. This section is that surface: a composer and the log itself. The server serializes it
// only for the team's Scrum Master, so the page never has to decide who may read it.
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { COACHING_TOPICS, CoachingTopic } from '@scrumooth/shared';

import { Button } from '../../../components/common/Button';
import { queryKeys } from '../../../hooks/queryKeys';
import { apiService, coachingService } from '../../../services';
import styles from '../SmDashboard.module.css';

interface CoachingLogProps {
  teamId: string;
}

const TOPIC_LABEL_KEY = {
  [CoachingTopic.SELF_MANAGEMENT]: 'coaching.topicSelfManagement',
  [CoachingTopic.CROSS_FUNCTIONALITY]: 'coaching.topicCrossFunctionality',
  [CoachingTopic.OTHER]: 'coaching.topicOther',
} as const satisfies Record<CoachingTopic, string>;

export const CoachingLog: React.FC<CoachingLogProps> = ({ teamId }) => {
  const { t } = useTranslation(['scrum-master-dashboard', 'common']);
  const queryClient = useQueryClient();

  const [topic, setTopic] = useState<CoachingTopic>(CoachingTopic.SELF_MANAGEMENT);
  const [note, setNote] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const entriesQuery = useQuery({
    queryKey: queryKeys.coaching.byTeam(teamId),
    queryFn: () => coachingService.getEntries(teamId),
    enabled: !!teamId,
  });

  const sprintsQuery = useQuery({
    queryKey: queryKeys.sprint.all,
    queryFn: () => apiService.getSprints(teamId),
    enabled: !!teamId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      coachingService.createEntry({
        teamId,
        topic,
        note: note.trim(),
        sprintId: sprintId || null,
        followUpDate: followUpDate || null,
      }),
    onSuccess: async () => {
      setNote('');
      setFollowUpDate('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.coaching.all });
    },
    onError: () => setError(t('coaching.saveError')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coachingService.deleteEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.coaching.all }),
  });

  const entries = useMemo(() => entriesQuery.data?.data?.entries ?? [], [entriesQuery.data?.data]);
  const sprints = useMemo(() => sprintsQuery.data?.data ?? [], [sprintsQuery.data?.data]);

  const handleAdd = useCallback(() => {
    if (note.trim().length < 3) {
      setError(t('coaching.saveError'));
      return;
    }

    createMutation.mutate();
  }, [createMutation, note, t]);

  return (
    <div className={styles.section} data-testid="coaching-log">
      <h2 className={styles['section-title']}>{t('coaching.title')}</h2>
      <p className={styles.empty}>{t('coaching.hint')}</p>

      <div className={styles['coaching-form']}>
        <label className={styles['coaching-field']}>
          <span className={styles['stat-label']}>{t('coaching.topic')}</span>
          <select
            className={styles['coaching-input']}
            value={topic}
            onChange={(event) => setTopic(event.target.value as CoachingTopic)}
          >
            {COACHING_TOPICS.map((option) => (
              <option key={option} value={option}>
                {t(TOPIC_LABEL_KEY[option])}
              </option>
            ))}
          </select>
        </label>

        <label className={styles['coaching-field']}>
          <span className={styles['stat-label']}>{t('coaching.sprint')}</span>
          <select
            className={styles['coaching-input']}
            value={sprintId}
            onChange={(event) => setSprintId(event.target.value)}
          >
            <option value="">{t('coaching.noSprint')}</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles['coaching-field']}>
          <span className={styles['stat-label']}>{t('coaching.followUpDate')}</span>
          <input
            className={styles['coaching-input']}
            type="date"
            value={followUpDate}
            onChange={(event) => setFollowUpDate(event.target.value)}
          />
        </label>
      </div>

      <label className={styles['coaching-field']}>
        <span className={styles['stat-label']}>{t('coaching.note')}</span>
        <textarea
          className={styles['coaching-textarea']}
          value={note}
          rows={3}
          maxLength={4000}
          placeholder={t('coaching.notePlaceholder')}
          onChange={(event) => {
            setNote(event.target.value);
            setError(null);
          }}
        />
      </label>

      {error && (
        <p className={styles.empty} role="alert">
          {error}
        </p>
      )}

      <div className={styles['coaching-actions']}>
        <Button onClick={handleAdd} loading={createMutation.isPending}>
          {t('coaching.add')}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className={styles.empty}>{t('coaching.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles['list-item']}>
              <span className={styles['item-text']}>
                <strong>{t(TOPIC_LABEL_KEY[entry.topic])}</strong> — {entry.note}
                {entry.followUpDate && (
                  <>
                    {' · '}
                    {t('coaching.followUpOn')} {entry.followUpDate.slice(0, 10)}
                  </>
                )}
              </span>
              <span className={styles['age-tag']}>
                <Button variant="link" size="sm" onClick={() => deleteMutation.mutate(entry.id)}>
                  {t('coaching.delete')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CoachingLog;
