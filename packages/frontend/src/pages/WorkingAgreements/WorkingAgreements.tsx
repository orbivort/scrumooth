// The team's working agreements: the third and last section of the Team module's Definition tab.
//
// Self-management means the team decides how it works, so the agreements belong to the team: every
// member reads them and any member can add or retire one. That is why they sit under the same tab as
// the Definition of Done and the Definition of Ready -- all three are what the team has agreed to
// hold itself to -- while the other half of the picture, whether the team collectively holds the
// skills its work needs, is recorded beside the values health check on the Scrum Health tab.
//
// It renders no page chrome of its own: the module owns the h1, the header and the URL, so this is
// a section that assumes a team is already resolved above it.
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { WorkingAgreementStatus, type WorkingAgreement } from '@scrumooth/shared';

import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../hooks/queryKeys';
import { ToastContainer } from '../../components/common/ToastContainer';
import { LoadingState } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/EmptyState';
import { workingAgreementsService } from '../../services';

import { WorkingAgreementForm } from './components/WorkingAgreementForm';
import styles from './WorkingAgreements.module.css';

interface WorkingAgreementsProps {
  /** The team whose agreements these are, already resolved by the module shell. */
  teamId: string | undefined;
}

export const WorkingAgreements: React.FC<WorkingAgreementsProps> = ({ teamId }) => {
  const { t } = useTranslation(['agreements', 'common']);
  const { toasts, success, error: toastError, removeToast } = useToast();
  const queryClient = useQueryClient();

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<WorkingAgreement | null>(null);

  const agreementsQuery = useQuery({
    queryKey: queryKeys.workingAgreement.byTeam(teamId ?? ''),
    queryFn: () => workingAgreementsService.getAgreements(teamId ?? ''),
    enabled: !!teamId,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.workingAgreement.all });
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
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* The third section of the Definition tab, in the module's card language. The heading is a
          deep-link target, so it is focusable without joining the tab order. */}
      <section
        className={styles.panel}
        aria-labelledby="working-agreements"
        data-testid="working-agreements"
      >
        <div className={styles['panel-header']}>
          <h2 id="working-agreements" tabIndex={-1} className={styles['panel-title']}>
            {t('agreements.title')}
          </h2>
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
        </div>
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

        {formMode === 'create' && (
          <WorkingAgreementForm
            isEdit={false}
            submitting={createMutation.isPending}
            onSubmit={(values) => createMutation.mutate(values)}
            onCancel={() => setFormMode(null)}
          />
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
    </>
  );
};

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
