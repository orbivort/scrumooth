// Facilitation -- the Scrum Master's lens on the team's process.
//
// This is the second tab of the Dashboard module rather than a page of its own: it aggregates facts
// that stay readable at their own subjects (the Definition of Done on the Team module, the Sprint
// Goal on the Sprint board, Daily Scrum cadence, impediments, retrospective action items), so it
// carries no landmark and no heading of its own -- the module shell owns the `main` region, the
// header and the rail. What is genuinely the Scrum Master's alone stays here and stays gated: the
// coaching log and the private Sprint notes.
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useTeamContext } from '../../contexts/TeamContext';
import {
  healthCheckService,
  organizationalBarriersService,
  smDashboardService,
} from '../../services';
import { LoadingState } from '../../components/common/Loading';
import { ScrumValuesBanner } from '../../components/common/ScrumValuesBanner';
import { Button } from '../../components/common/Button';
import {
  EscalateImpedimentDialog,
  type EscalationSource,
} from '../../components/EscalateImpedimentDialog/EscalateImpedimentDialog';
import type { DashboardPanelProps } from '../Dashboard/constants';

import { CoachingLog } from './components/CoachingLog';
import { DoDTrendChart } from './DoDTrendChart';
import { ScrumValuesRadar } from './ScrumValuesRadar';
import { HealthCheckTrendChart } from './HealthCheckTrendChart';
import styles from './SmDashboard.module.css';

export const FacilitationPanel: React.FC<DashboardPanelProps> = ({ registerRefresh }) => {
  const { t } = useTranslation(['scrum-master-dashboard', 'common']);
  const { currentTeam } = useTeamContext();
  const queryClient = useQueryClient();
  /** The impediment being escalated, when the Scrum Master opened the dialog for one. */
  const [escalationSource, setEscalationSource] = useState<EscalationSource | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sm-dashboard', currentTeam?.id],
    queryFn: () => {
      if (!currentTeam?.id) {
        throw new Error('No current team');
      }
      return smDashboardService.getDashboard(currentTeam.id);
    },
    enabled: !!currentTeam?.id,
    retry: 1,
  });

  const { data: healthTrendData } = useQuery({
    queryKey: ['health-check-trend', currentTeam?.id],
    queryFn: () => {
      if (!currentTeam?.id) {
        throw new Error('No current team');
      }
      return healthCheckService.getTrend(currentTeam.id);
    },
    enabled: !!currentTeam?.id,
  });

  // The barrier register, read here so the dashboard can show what the Scrum Master has carried to
  // the organization. The tile links to the register itself; nothing is written from this page
  // except the escalation, which is the act the register exists to make possible.
  const { data: barrierStats } = useQuery({
    queryKey: ['sm-dashboard-barriers', currentTeam?.id],
    queryFn: () => organizationalBarriersService.getStats(currentTeam?.id ?? ''),
    enabled: !!currentTeam?.id,
  });

  const { data: barriers } = useQuery({
    queryKey: ['sm-dashboard-barrier-list', currentTeam?.id],
    queryFn: () => organizationalBarriersService.getBarriers({ teamId: currentTeam?.id ?? '' }),
    enabled: !!currentTeam?.id,
  });

  const createHealthCheckMutation = useMutation({
    mutationFn: () => {
      if (!currentTeam?.id) {
        throw new Error('No current team');
      }
      return healthCheckService.createHealthCheck(currentTeam.id);
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['sm-dashboard', currentTeam?.id] });
      return res;
    },
  });

  // The refresh the header control calls while this lens is showing: the four reads this panel is
  // built on, and nothing of the overview's.
  const handlePanelRefresh = useCallback(async () => {
    const teamId = currentTeam?.id;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sm-dashboard', teamId] }),
      queryClient.invalidateQueries({ queryKey: ['health-check-trend', teamId] }),
      queryClient.invalidateQueries({ queryKey: ['sm-dashboard-barriers', teamId] }),
      queryClient.invalidateQueries({ queryKey: ['sm-dashboard-barrier-list', teamId] }),
    ]);
  }, [queryClient, currentTeam?.id]);

  // Every panel registers the refresh for whichever one is mounted. Only one ever is.
  useEffect(() => {
    registerRefresh(handlePanelRefresh);
    return () => registerRefresh(null);
  }, [registerRefresh, handlePanelRefresh]);

  if (isLoading) {
    return <LoadingState variant="page" label={t('common:loading')} />;
  }

  if (isError) {
    const message = error instanceof Error ? error.message : '';
    return (
      <p className={styles.empty}>
        {t('smDashboard.loadError')}
        {message ? `: ${message}` : ''}
      </p>
    );
  }

  if (!data?.data) {
    return <p className={styles.empty}>{t('smDashboard.noData')}</p>;
  }

  const dashboard = data.data;

  return (
    <div className={styles.container} data-testid="facilitation-panel">
      {/* The lens's own framing. It says what the surface is for -- facilitation, not reporting on
          the team -- in the voice the module header cannot: the header belongs to the whole module. */}
      <p className={styles['panel-lead']}>{t('smDashboard.subtitle')}</p>

      <ScrumValuesBanner />

      <div className={styles.section} data-testid="event-compliance">
        <h2 className={styles['section-title']}>{t('smDashboard.eventCompliance')}</h2>
        {dashboard.eventCompliance.length === 0 ? (
          <p className={styles.empty}>{t('common:noData')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('common:name')}</th>
                <th>{t('smDashboard.completedEvents')}</th>
                <th>{t('smDashboard.dailyScrumCount')}</th>
                <th>{t('smDashboard.adaptation')}</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.eventCompliance.map((event) => {
                const completed =
                  (event.sprintPlanningCompleted ? 1 : 0) +
                  (event.sprintReviewCompleted ? 1 : 0) +
                  (event.retrospectiveCompleted ? 1 : 0);
                const missedCount = event.dailyScrumMissedDates.length;
                return (
                  <tr key={event.sprintId}>
                    <td>{event.sprintName}</td>
                    <td>{completed}/3</td>
                    <td>
                      {/* Counted against the team's own working days and only up to today, so a
                          Sprint still running is not shown as having fallen behind. */}
                      <span className={styles['cadence-figure']}>
                        {t('smDashboard.cadenceHeldOfDue', {
                          held: event.dailyScrumHeld,
                          due: event.dailyScrumDue,
                        })}
                      </span>
                      <span className={styles['cadence-expected']}>
                        {t('smDashboard.cadenceExpectedTotal', {
                          expected: event.dailyScrumExpected,
                        })}
                      </span>
                      {missedCount > 0 ? (
                        <details className={styles['missed-days']}>
                          <summary>{t('smDashboard.missedDays', { count: missedCount })}</summary>
                          <ul className={styles['missed-days-list']}>
                            {event.dailyScrumMissedDates.map((date) => (
                              <li key={date}>{date}</li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        event.dailyScrumOnSchedule === true && (
                          <span className={styles['cadence-badge']}>
                            {t('smDashboard.onSchedule')}
                          </span>
                        )
                      )}
                    </td>
                    <td>
                      {event.adaptationDeclared === 0 ? (
                        <span className={styles['cadence-expected']}>
                          {t('smDashboard.adaptationNone')}
                        </span>
                      ) : (
                        <>
                          <span className={styles['cadence-figure']}>
                            {t('smDashboard.adaptationSummary', {
                              reflected: event.adaptationReflected,
                              declared: event.adaptationDeclared,
                            })}
                          </span>
                          {event.adaptationPending > 0 && (
                            <span className={styles['adaptation-pending']}>
                              {t('smDashboard.adaptationPending', {
                                count: event.adaptationPending,
                              })}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.section} data-testid="impediment-metrics">
          <h2 className={styles['section-title']}>{t('smDashboard.impedimentMetrics')}</h2>
          <div className={styles['stat-grid']}>
            <div className={styles.stat}>
              <span className={styles['stat-value']}>{dashboard.impedimentMetrics.open}</span>
              <span className={styles['stat-label']}>{t('common:open')}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles['stat-value']}>
                {dashboard.impedimentMetrics.averageResolutionDays}
              </span>
              <span className={styles['stat-label']}>{t('smDashboard.avgResolutionDays')}</span>
            </div>
          </div>
          {dashboard.impedimentMetrics.aging.length > 0 && (
            <ul className={styles.list}>
              {dashboard.impedimentMetrics.aging.slice(0, 5).map((imp) => (
                <li key={imp.id} className={styles['list-item']}>
                  <span className={styles['item-text']}>{imp.title}</span>
                  <span
                    className={`${styles['age-tag']} ${imp.atRisk ? styles['at-risk'] : styles.ok}`}
                  >
                    {imp.ageDays}d {imp.atRisk ? `· ${t('smDashboard.atRisk')}` : ''}
                  </span>
                  {/* The act the dashboard lacked: an impediment the team cannot remove alone is
                      carried to the organization, and the barrier register takes over from here. */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setEscalationSource({
                        id: imp.id,
                        title: imp.title,
                        priority: imp.priority,
                      })
                    }
                  >
                    {t('barriers.escalate')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section} data-testid="barrier-summary">
          <h2 className={styles['section-title']}>{t('barriers.title')}</h2>
          <p className={styles.empty}>{t('barriers.hint')}</p>

          <div className={styles['stat-grid']}>
            <div className={styles.stat}>
              <span className={styles['stat-value']} data-testid="barriers-open">
                {barrierStats?.data?.open ?? 0}
              </span>
              <span className={styles['stat-label']}>
                {t('barriers.open', { count: barrierStats?.data?.open ?? 0 })}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles['stat-value']} data-testid="barriers-overdue">
                {barrierStats?.data?.overdue ?? 0}
              </span>
              <span className={styles['stat-label']}>
                {t('barriers.overdue', { count: barrierStats?.data?.overdue ?? 0 })}
              </span>
            </div>
          </div>

          {(barriers?.data ?? []).length === 0 ? (
            <p className={styles.empty}>{t('barriers.empty')}</p>
          ) : (
            <ul className={styles.list}>
              <li className={styles['list-item']}>
                <span className={styles['stat-label']}>{t('barriers.oldest')}</span>
              </li>
              {(barriers?.data ?? []).slice(0, 3).map((barrier) => (
                <li key={barrier.id} className={styles['list-item']}>
                  <span className={styles['item-text']}>{barrier.title}</span>
                  <span className={styles['age-tag']}>
                    {t('barriers.ageDays', { count: barrier.ageDays })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link className={styles['barriers-link']} to="/impediments?tab=barriers">
            {t('barriers.viewRegister')}
          </Link>
        </div>

        <div className={styles.section} data-testid="dod-trend">
          <h2 className={styles['section-title']}>{t('smDashboard.dodCompliance')}</h2>
          <DoDTrendChart data={dashboard.dodComplianceTrend} />
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.section} data-testid="sprint-goal">
          <h2 className={styles['section-title']}>{t('smDashboard.sprintGoalAchievement')}</h2>
          {/* The Scrum Team's own recorded verdicts. Sprints it never assessed are reported as
              unassessed -- never as unmet, and never inferred from item completion. */}
          <div className={styles.stat}>
            <span className={styles['stat-value']} data-testid="goal-assessed-coverage">
              {dashboard.sprintGoalAchievement.assessed} / {dashboard.sprintGoalAchievement.total}
            </span>
            <span className={styles['stat-label']}>{t('smDashboard.goalAssessedCoverage')}</span>
          </div>
          <ul className={styles['verdict-list']}>
            <li>
              <span className={styles['verdict-label']}>{t('smDashboard.goalAchieved')}</span>
              <span className={styles['verdict-value']}>
                {dashboard.sprintGoalAchievement.achieved}
              </span>
            </li>
            <li>
              <span className={styles['verdict-label']}>
                {t('smDashboard.goalPartiallyAchieved')}
              </span>
              <span className={styles['verdict-value']}>
                {dashboard.sprintGoalAchievement.partiallyAchieved}
              </span>
            </li>
            <li>
              <span className={styles['verdict-label']}>{t('smDashboard.goalNotAchieved')}</span>
              <span className={styles['verdict-value']}>
                {dashboard.sprintGoalAchievement.notAchieved}
              </span>
            </li>
          </ul>
          {dashboard.sprintGoalAchievement.assessed === 0 ? (
            <p className={styles.note}>{t('smDashboard.goalNoneAssessed')}</p>
          ) : null}
          {/* Item completion is a different fact from goal attainment, so it is stated as one. */}
          <p className={styles.note} data-testid="goal-item-completion">
            {t('smDashboard.itemCompletionNote', {
              completed: dashboard.sprintGoalAchievement.itemCompletion.completedItems,
              total: dashboard.sprintGoalAchievement.itemCompletion.totalItems,
            })}
          </p>
        </div>

        <div className={styles.section} data-testid="action-items">
          <h2 className={styles['section-title']}>{t('smDashboard.actionItemCompletion')}</h2>
          <div className={styles.stat}>
            <span className={styles['stat-value']}>
              {dashboard.actionItemCompletion.completionRate}%
            </span>
            <span className={styles['stat-label']}>{t('smDashboard.completionRate')}</span>
          </div>
          {dashboard.actionItemCompletion.overdue > 0 && (
            <p className={styles.warning}>
              {dashboard.actionItemCompletion.overdue} {t('smDashboard.atRisk')}
            </p>
          )}
        </div>

        <div className={styles.section} data-testid="health-check">
          <div className={styles['section-header']}>
            <h2 className={styles['section-title']}>{t('smDashboard.healthCheck')}</h2>
            <button
              type="button"
              className={styles['run-survey-button']}
              onClick={() => createHealthCheckMutation.mutate()}
              disabled={createHealthCheckMutation.isPending}
            >
              {t('healthCheck.createNew')}
            </button>
          </div>

          {dashboard.healthCheck?.results.length ? (
            <>
              <div className={styles.stat}>
                <span className={styles['stat-value']} data-testid="health-score">
                  {dashboard.healthCheck.overallAverage}/5
                </span>
                <span className={styles['stat-label']}>{t('smDashboard.overallHealth')}</span>
              </div>
              <div className={styles.radar}>
                <ScrumValuesRadar results={dashboard.healthCheck.results} />
              </div>
              {healthTrendData?.data && healthTrendData.data.length >= 2 && (
                <div className={styles.radar}>
                  <HealthCheckTrendChart data={healthTrendData.data} />
                </div>
              )}
            </>
          ) : (
            <p className={styles.empty}>{t('healthCheck.noHealthCheck')}</p>
          )}
        </div>
      </div>

      {/* The coaching record: the Scrum Master's own notes on coaching self-management and
          cross-functionality, which no other artifact captures. */}
      {currentTeam?.id && <CoachingLog teamId={currentTeam.id} />}

      <EscalateImpedimentDialog
        open={escalationSource !== null}
        source={escalationSource}
        onClose={() => setEscalationSource(null)}
        onEscalated={() => {
          void queryClient.invalidateQueries({ queryKey: ['sm-dashboard-barriers'] });
          void queryClient.invalidateQueries({ queryKey: ['sm-dashboard-barrier-list'] });
        }}
      />
    </div>
  );
};

export default FacilitationPanel;
