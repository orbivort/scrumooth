// Working agreements and the team-level cross-functionality assessment.
//
// Self-management means the team decides how it works, so the agreements belong to the team: every
// member reads them and any member can add or retire one. The cross-functionality assessment is the
// other half of the same picture -- it says whether the team collectively holds the skills its work
// needs -- and is recorded by the Scrum Master, as the values health check is.
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  type SkillCoverage,
  UserRole,
  WorkingAgreementStatus,
  type WorkingAgreement,
} from '@scrumooth/shared';

import { useTeamStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../hooks/queryKeys';
import { ToastContainer } from '../../components/common/ToastContainer';
import { LoadingState } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/EmptyState';
import { crossFunctionalityService, workingAgreementsService } from '../../services';

import { WorkingAgreementForm } from './components/WorkingAgreementForm';
import { CrossFunctionalityPanel } from './components/CrossFunctionalityPanel';
import styles from './WorkingAgreements.module.css';

export const WorkingAgreements: React.FC = () => {
  const { t } = useTranslation(['agreements', 'common']);
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { toasts, success, error: toastError, removeToast } = useToast();
  const queryClient = useQueryClient();

  const teamId = currentTeam?.id;
  const isScrumMaster =
    String(userRoleInCurrentTeam).toLowerCase() === UserRole.SCRUM_MASTER.toLowerCase();

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<WorkingAgreement | null>(null);

  const agreementsQuery = useQuery({
    queryKey: queryKeys.workingAgreement.byTeam(teamId ?? ''),
    queryFn: () => workingAgreementsService.getAgreements(teamId ?? ''),
    enabled: !!teamId,
  });

  const recordQuery = useQuery({
    queryKey: queryKeys.crossFunctionality.byTeam(teamId ?? ''),
    queryFn: () => crossFunctionalityService.getRecord(teamId ?? ''),
    enabled: !!teamId,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workingAgreement.all });
    await queryClient.invalidateQueries({ queryKey: queryKeys.crossFunctionality.all });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (values: { title: string; description: string }) =>
      workingAgreementsService.createAgreement({
        teamId: teamId ?? '',
        title: values.title,
        description: values.description,
      }),
    onSuccess: async () => {
      setFormMode(null);
      await invalidate();
      success(t('agreements.created'));
    },
    onError: () => toastError(t('errors.save')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { title: string; description: string } }) =>
      workingAgreementsService.updateAgreement(id, values),
    onSuccess: async () => {
      setFormMode(null);
      setEditing(null);
      await invalidate();
      success(t('agreements.saved'));
    },
    onError: () => toastError(t('errors.save')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkingAgreementStatus }) =>
      workingAgreementsService.updateAgreement(id, { status }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: () => toastError(t('errors.save')),
  });

  const assessmentMutation = useMutation({
    mutationFn: (values: CrossFunctionalityAssessmentValues) =>
      crossFunctionalityService.createAssessment({
        teamId: teamId ?? '',
        summary: values.summary,
        skills: values.skills,
      }),
    onSuccess: async () => {
      await invalidate();
      success(t('assessmentForm.saved'));
    },
    onError: () => toastError(t('errors.record')),
  });

  const { active, retired } = useMemo(() => {
    const rows = agreementsQuery.data?.data ?? [];

    return {
      active: rows.filter((agreement) => agreement.status === WorkingAgreementStatus.ACTIVE),
      retired: rows.filter((agreement) => agreement.status === WorkingAgreementStatus.RETIRED),
    };
  }, [agreementsQuery.data?.data]);

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  return (
    <div className={styles.page} data-testid="working-agreements">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('page.title')}</h1>
          <p className={styles.subtitle}>{t('page.subtitle')}</p>
        </div>
        {formMode !== 'create' && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormMode('create');
            }}
          >
            {t('agreements.add')}
          </Button>
        )}
      </header>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      {formMode === 'create' && (
        <WorkingAgreementForm
          isEdit={false}
          submitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => setFormMode(null)}
        />
      )}

      <div className={styles.layout}>
        <section className={styles.panel} aria-label={t('agreements.title')}>
          <h2 className={styles['panel-title']}>{t('agreements.title')}</h2>
          <p className={styles.muted}>{t('agreements.hint')}</p>

          {agreementsQuery.isLoading ? (
            <LoadingState variant="spinner" label={t('common:loading')} />
          ) : active.length === 0 ? (
            <p className={styles.muted}>{t('agreements.empty')}</p>
          ) : (
            <ul className={styles.list}>
              {active.map((agreement) => (
                <AgreementCard
                  key={agreement.id}
                  agreement={agreement}
                  onEdit={() => {
                    setEditing(agreement);
                    setFormMode('edit');
                  }}
                  onToggleStatus={() =>
                    statusMutation.mutate({
                      id: agreement.id,
                      status: WorkingAgreementStatus.RETIRED,
                    })
                  }
                />
              ))}
            </ul>
          )}

          {retired.length > 0 && (
            <>
              <h3 className={styles['section-title']}>{t('agreements.retiredGroup')}</h3>
              <ul className={styles.list}>
                {retired.map((agreement) => (
                  <AgreementCard
                    key={agreement.id}
                    agreement={agreement}
                    onEdit={() => undefined}
                    onToggleStatus={() =>
                      statusMutation.mutate({
                        id: agreement.id,
                        status: WorkingAgreementStatus.ACTIVE,
                      })
                    }
                  />
                ))}
              </ul>
            </>
          )}

          {formMode === 'edit' && editing && (
            <WorkingAgreementForm
              isEdit
              initial={{ title: editing.title, description: editing.description }}
              submitting={updateMutation.isPending}
              onSubmit={(values) => updateMutation.mutate({ id: editing.id, values })}
              onCancel={() => {
                setFormMode(null);
                setEditing(null);
              }}
            />
          )}
        </section>

        <CrossFunctionalityPanel
          record={recordQuery.data?.data ?? null}
          canRecord={isScrumMaster}
          submitting={assessmentMutation.isPending}
          onRecord={(values) => assessmentMutation.mutate(values)}
        />
      </div>
    </div>
  );
};

export interface CrossFunctionalityAssessmentValues {
  summary: string;
  skills: Array<{ name: string; coverage: SkillCoverage; note?: string | null }>;
}

interface AgreementCardProps {
  agreement: WorkingAgreement;
  onEdit: () => void;
  onToggleStatus: () => void;
}

const AgreementCard: React.FC<AgreementCardProps> = ({ agreement, onEdit, onToggleStatus }) => {
  const { t } = useTranslation(['agreements']);
  const isActive = agreement.status === WorkingAgreementStatus.ACTIVE;

  return (
    <li className={styles.card}>
      <div className={styles['card-top']}>
        <h4 className={styles['card-title']}>{agreement.title}</h4>
        <span className={styles.badge}>
          {isActive ? t('agreements.active') : t('agreements.retired')}
        </span>
      </div>
      <p className={styles.description}>{agreement.description}</p>
      <div className={styles.meta}>
        <span>
          {t('agreements.createdBy')}: {agreement.createdByName ?? '—'}
        </span>
        <span>
          {isActive
            ? `${t('agreements.agreedAt')}: ${agreement.agreedAt.slice(0, 10)}`
            : `${t('agreements.retiredAt')}: ${(agreement.retiredAt ?? '').slice(0, 10)}`}
        </span>
      </div>
      <div className={styles.actions}>
        {isActive && (
          <Button variant="link" size="sm" onClick={onEdit}>
            {t('agreements.edit')}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onToggleStatus}>
          {isActive ? t('agreements.retire') : t('agreements.reactivate')}
        </Button>
      </div>
    </li>
  );
};

export default WorkingAgreements;
