// What the team is, and how it has been doing.
//
// Identity answers "which team am I looking at" -- the name, what it is for, how full it is against
// its size limit, and when it was created or last changed. The metrics below are the team's own
// history read back: completed Sprints, the points they carried, the average velocity trend and the
// share of each Sprint Backlog that was finished. Both come from reads the page already made; the
// panel owns them so switching to another tab does no work here.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { apiService } from '../../../services';
import { ChartIcon, CheckSquareIcon, TargetIcon, ZapIcon } from '../../../components/common/Icons';
import type { ApiResponse, SprintHistoryItem, Team, TeamMetrics } from '../../../types';
import styles from '../Team.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

interface OverviewPanelProps {
  teamId: string | undefined;
  /** The resolved team, or null while the detail read is still settling. */
  team: Team | null;
  /** A user who is not yet in a team has nothing to read here. */
  isUninvitedUser: boolean;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ teamId, team, isUninvitedUser }) => {
  const { t } = useTranslation('team');
  const { locale } = useI18nStore();

  const { data: teamMetricsData } = useQuery<ApiResponse<TeamMetrics>, Error>({
    queryKey: ['teamMetrics', teamId],
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return apiService.getTeamMetrics(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sprintHistoryData } = useQuery<ApiResponse<SprintHistoryItem[]>, Error>({
    queryKey: ['sprintHistory', teamId],
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return apiService.getSprintHistory(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 5 * 60 * 1000,
  });

  const teamMetrics = teamMetricsData?.success ? teamMetricsData.data : null;
  const sprintHistory: SprintHistoryItem[] =
    (sprintHistoryData?.success ? sprintHistoryData.data : []) ?? [];

  const memberCount = team?.members?.length ?? 0;
  const maxSize = team?.maxSize;

  const completedSprintsCount = sprintHistory.filter(
    (sprint) => sprint.status === 'COMPLETED'
  ).length;
  // Only the Sprints whose completion was observed contribute: an unrecorded point is excluded
  // rather than counted as zero, exactly as the Reports page presents it.
  const totalStoryPointsCompleted = sprintHistory
    .filter((sprint) => sprint.status === 'COMPLETED' && sprint.completedPoints !== null)
    .reduce((sum, sprint) => sum + (sprint.completedPoints ?? 0), 0);
  const avgVelocity = teamMetrics?.averageCompletedPoints ?? 0;
  const sprintCompletionRate = teamMetrics?.completionRate ?? 0;

  return (
    <div className={styles['overview-panel']}>
      {team ? (
        <section className={styles['team-info-card']} aria-labelledby="team-name">
          <div className={styles['team-info-header']}>
            <h2 id="team-name">{team.name}</h2>
            <span className={styles['team-size']}>
              {maxSize !== undefined
                ? t('teamInfo.memberCountLimit', { count: memberCount, max: maxSize })
                : t('teamInfo.memberCount', { count: memberCount })}
            </span>
          </div>
          {team.description && <p className={styles['team-description']}>{team.description}</p>}
          <div className={styles['team-meta']}>
            <span className={styles['meta-item']}>
              {t('teamInfo.created', {
                date: formatLocaleDate(team.createdAt, locale),
              })}
            </span>
            <span className={styles['meta-item']}>
              {t('teamInfo.lastUpdated', {
                date: formatLocaleDate(team.updatedAt, locale),
              })}
            </span>
          </div>
        </section>
      ) : (
        <section className={styles['team-info-card']}>
          <div className={styles['team-info-header']}>
            <h2>{t('teamInfo.unavailable')}</h2>
          </div>
          <p className={styles['team-description']}>{t('teamInfo.unableToLoad')}</p>
        </section>
      )}

      <section className={styles['team-stats']} aria-labelledby="team-stats-heading">
        <h2 id="team-stats-heading" className={styles['section-heading']}>
          {t('overview.metricsTitle')}
        </h2>
        <div className={styles['stats-grid']}>
          <div className={styles['stat-card']}>
            <div className={styles['stat-icon']} aria-hidden="true">
              <ChartIcon size={24} />
            </div>
            <div className={styles['stat-content']}>
              <div className={styles['stat-value']}>{completedSprintsCount}</div>
              <div className={styles['stat-label']}>{t('teamStats.completedSprints')}</div>
            </div>
          </div>
          <div className={styles['stat-card']}>
            <div className={styles['stat-icon']} aria-hidden="true">
              <CheckSquareIcon size={24} />
            </div>
            <div className={styles['stat-content']}>
              <div className={styles['stat-value']}>{totalStoryPointsCompleted}</div>
              <div className={styles['stat-label']}>{t('teamStats.storyPointsCompleted')}</div>
            </div>
          </div>
          <div className={styles['stat-card']}>
            <div className={styles['stat-icon']} aria-hidden="true">
              <ZapIcon size={24} />
            </div>
            <div className={styles['stat-content']}>
              <div className={styles['stat-value']}>{avgVelocity.toFixed(1)}</div>
              <div className={styles['stat-label']}>{t('teamStats.avgVelocity')}</div>
            </div>
          </div>
          <div className={styles['stat-card']}>
            <div className={styles['stat-icon']} aria-hidden="true">
              <TargetIcon size={24} />
            </div>
            <div className={styles['stat-content']}>
              <div className={styles['stat-value']}>{sprintCompletionRate}%</div>
              <div className={styles['stat-label']}>{t('teamStats.sprintCompletionRate')}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OverviewPanel;
