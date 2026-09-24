// How healthy the team is, read from the two things the tool can actually observe about it.
//
// The Scrum Values health check is the team's own periodic self-inspection. The cross-functionality
// assessment says whether the team collectively holds the skills its work needs -- the half of the
// definition that a member list cannot show. They answer one question -- can this team, as it is
// constituted, deliver an Increment it stands behind -- so they share a tab rather than being
// scattered across the module.
//
// Which Definition of Done governs the team used to live here, as a third panel. It is a governance
// fact about a commitment rather than a reading of the team's health, so it moved to the Definition
// tab, beside the commitment it decides -- where the criteria it applies to are on screen.
import React, { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserRole } from '@scrumooth/shared';

import { crossFunctionalityService, healthCheckService } from '../../../services';
import { useTeamStore } from '../../../store';
import { useToast } from '../../../hooks/useToast';
import { ToastContainer } from '../../../components/common/ToastContainer';
import { HealthCheckSurvey } from '../../../components/common/HealthCheckSurvey';
import { SparklesIcon } from '../../../components/common/Icons';
import { queryKeys } from '../../../hooks/queryKeys';
import { HealthCheckStatus } from '../../../types';
import type { ApiResponse } from '../../../types';
import type { CrossFunctionalityRecord } from '../../../services/domain/crossFunctionality.service';
import {
  CrossFunctionalityPanel,
  type CrossFunctionalityAssessmentValues,
} from '../../WorkingAgreements/components/CrossFunctionalityPanel';
import styles from '../Team.module.css';

interface ScrumHealthPanelProps {
  teamId: string | undefined;
  isUninvitedUser: boolean;
}

export const ScrumHealthPanel: React.FC<ScrumHealthPanelProps> = ({ teamId, isUninvitedUser }) => {
  const { t } = useTranslation(['team', 'agreements']);
  const { userRoleInCurrentTeam } = useTeamStore();
  const queryClient = useQueryClient();
  const { toasts, success, error: toastError, removeToast } = useToast();

  const [showHealthCheck, setShowHealthCheck] = useState(false);

  // Recording an assessment is the Scrum Master's act, as the values check is: the Guide makes them
  // accountable for coaching the team's cross-functionality, so they are the one who writes it down.
  const isScrumMaster =
    String(userRoleInCurrentTeam).toLowerCase() === UserRole.SCRUM_MASTER.toLowerCase();

  const { data: healthCheckLatestData } = useQuery<
    ApiResponse<{ healthCheckId: string; status: HealthCheckStatus; createdAt: string } | null>,
    Error
  >({
    queryKey: queryKeys.healthCheck.latest(teamId ?? ''),
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return healthCheckService.getLatest(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 60 * 1000,
  });

  const latestHealthCheck = healthCheckLatestData?.success ? healthCheckLatestData.data : null;
  const hasOpenHealthCheck = latestHealthCheck?.status === HealthCheckStatus.OPEN;

  const { data: crossFunctionalityData } = useQuery<ApiResponse<CrossFunctionalityRecord>, Error>({
    queryKey: queryKeys.crossFunctionality.byTeam(teamId ?? ''),
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return crossFunctionalityService.getRecord(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 5 * 60 * 1000,
  });

  const crossFunctionalityRecord =
    crossFunctionalityData?.success && crossFunctionalityData.data
      ? crossFunctionalityData.data
      : null;

  const assessmentMutation = useMutation({
    mutationFn: (values: CrossFunctionalityAssessmentValues) =>
      crossFunctionalityService.createAssessment({
        teamId: teamId ?? '',
        summary: values.summary,
        skills: values.skills,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.crossFunctionality.all });
      success(t('agreements:assessmentForm.saved'));
    },
    onError: () => toastError(t('agreements:errors.record')),
  });

  const handleRecordAssessment = useCallback(
    (values: CrossFunctionalityAssessmentValues) => assessmentMutation.mutate(values),
    [assessmentMutation]
  );

  return (
    <div className={styles['health-panel']}>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {hasOpenHealthCheck && (
        <section className={styles['health-check']} aria-labelledby="health-check-heading">
          <div className={styles['health-check-header']}>
            <h2 id="health-check-heading" className={styles['health-check-title']}>
              <SparklesIcon size={18} />
              {t('healthCheck.sectionTitle')}
            </h2>
            <button
              type="button"
              className={styles['health-check-toggle']}
              onClick={() => setShowHealthCheck((prev) => !prev)}
              aria-expanded={showHealthCheck}
              aria-controls="team-health-check-survey"
            >
              {showHealthCheck ? t('healthCheck.collapse') : t('healthCheck.expand')}
            </button>
          </div>
          {showHealthCheck && (
            <div id="team-health-check-survey" className={styles['health-check-body']}>
              <HealthCheckSurvey
                teamId={teamId ?? ''}
                healthCheckId={latestHealthCheck.healthCheckId}
              />
            </div>
          )}
        </section>
      )}

      <CrossFunctionalityPanel
        record={crossFunctionalityRecord}
        canRecord={isScrumMaster}
        submitting={assessmentMutation.isPending}
        onRecord={handleRecordAssessment}
      />
    </div>
  );
};

export default ScrumHealthPanel;
