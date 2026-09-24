// Organizational barrier register -- the second panel of the Impediments module.
//
// The Guide gives the Scrum Master a service beyond the team -- *"serving the organization ...
// removing barriers between stakeholders and Scrum Teams"* -- and this is that register: the
// barriers the team cannot remove alone, who owns each one, and the actions taken with the people
// outside the team who have to act. Restricting the writes to the team's Scrum Master is the
// server's rule; the panel only hides affordances it knows will be refused.
//
// The module shell (`pages/Impediments/Impediments.tsx`) owns the page header and the tab strip,
// so this panel renders its content and its own toolbar, never a page title.
import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  BarrierStatus,
  StakeholderActionStatus,
  UserRole,
  type BarrierPriority,
  type BarrierStatus as BarrierStatusType,
  type OrganizationalBarrier,
} from '@scrumooth/shared';

import { useTeamStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../hooks/queryKeys';
import { ToastContainer } from '../../components/common/ToastContainer';
import { LoadingState } from '../../components/common/Loading';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/EmptyState';
import { organizationalBarriersService } from '../../services';

import { BarrierForm, type BarrierFormValues } from './components/BarrierForm';
import { StakeholderActionList } from './components/StakeholderActionList';
import styles from './OrganizationalBarriers.module.css';

const PRIORITY_CLASS: Record<BarrierPriority, string> = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};

/** Typed label keys, so `t()` accepts them and no translation key is spelled inline. */
const PRIORITY_LABEL_KEYS = {
  CRITICAL: 'priority.critical',
  HIGH: 'priority.high',
  MEDIUM: 'priority.medium',
  LOW: 'priority.low',
} as const satisfies Record<BarrierPriority, string>;

const STATUS_LABEL_KEYS = {
  OPEN: 'stats.open',
  IN_PROGRESS: 'stats.inProgress',
  RESOLVED: 'stats.resolved',
  CLOSED: 'stats.closed',
} as const satisfies Record<BarrierStatusType, string>;

export const OrganizationalBarriers: React.FC = () => {
  const { t } = useTranslation(['barriers', 'common']);
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { toasts, success, error: toastError, removeToast } = useToast();
  const queryClient = useQueryClient();

  const teamId = currentTeam?.id;
  const canWrite =
    String(userRoleInCurrentTeam).toLowerCase() === UserRole.SCRUM_MASTER.toLowerCase();

  const [statusFilter, setStatusFilter] = useState<BarrierStatusType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<BarrierPriority | ''>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);

  const members = useMemo(
    () =>
      (currentTeam?.members ?? []).map((member) => ({
        userId: member.userId,
        name: member.user
          ? `${member.user.firstName} ${member.user.lastName}`.trim()
          : member.userId,
      })),
    [currentTeam?.members]
  );

  const barriersQuery = useQuery({
    queryKey: queryKeys.barriers.list({
      teamId,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    queryFn: () =>
      organizationalBarriersService.getBarriers({
        teamId: teamId ?? '',
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }),
    enabled: !!teamId,
  });

  const statsQuery = useQuery({
    queryKey: queryKeys.barriers.stats(teamId ?? ''),
    queryFn: () => organizationalBarriersService.getStats(teamId ?? ''),
    enabled: !!teamId,
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.barriers.detail(selectedId ?? ''),
    queryFn: () => organizationalBarriersService.getBarrier(selectedId ?? ''),
    enabled: !!selectedId,
  });

  const invalidateRegister = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.barriers.all });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (values: BarrierFormValues) =>
      organizationalBarriersService.createBarrier({
        teamId: teamId ?? '',
        title: values.title,
        description: values.description,
        priority: values.priority,
        ownerId: values.ownerId,
        targetDate: values.targetDate || null,
      }),
    onSuccess: async () => {
      setFormMode(null);
      await invalidateRegister();
      success(t('actions.created'));
    },
    onError: () => toastError(t('errors.save')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: BarrierFormValues }) =>
      organizationalBarriersService.updateBarrier(id, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        ownerId: values.ownerId,
        targetDate: values.targetDate || null,
        status: values.status,
        ...(values.resolution ? { resolution: values.resolution } : {}),
      }),
    onSuccess: async () => {
      setFormMode(null);
      await invalidateRegister();
      success(t('actions.saved'));
    },
    onError: () => toastError(t('errors.resolve')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationalBarriersService.deleteBarrier(id),
    onSuccess: async () => {
      setSelectedId(null);
      await invalidateRegister();
      success(t('actions.deleted'));
    },
    onError: () => toastError(t('errors.delete')),
  });

  const addActionMutation = useMutation({
    mutationFn: ({
      barrierId,
      values,
    }: {
      barrierId: string;
      values: { description: string; ownerId: string | null; dueDate: string };
    }) =>
      organizationalBarriersService.addStakeholderAction(barrierId, {
        description: values.description,
        ownerId: values.ownerId,
        dueDate: values.dueDate || null,
      }),
    onSuccess: invalidateRegister,
    onError: () => toastError(t('errors.save')),
  });

  const updateActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      organizationalBarriersService.updateStakeholderAction(actionId, {
        status: StakeholderActionStatus.DONE,
      }),
    onSuccess: invalidateRegister,
    onError: () => toastError(t('errors.save')),
  });

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      organizationalBarriersService.deleteStakeholderAction(actionId),
    onSuccess: invalidateRegister,
    onError: () => toastError(t('errors.delete')),
  });

  const barriers = useMemo(() => {
    const rows = barriersQuery.data?.data ?? [];
    const needle = search.trim().toLowerCase();

    if (!needle) {
      return rows;
    }

    return rows.filter(
      (barrier) =>
        barrier.title.toLowerCase().includes(needle) ||
        (barrier.ownerName ?? '').toLowerCase().includes(needle)
    );
  }, [barriersQuery.data?.data, search]);

  const detail: OrganizationalBarrier | undefined = detailQuery.data?.data;

  // The module shell already refuses to render a tab without a team; this stays as the panel's own
  // guarantee that it never queries for an unknown team.
  if (!teamId) {
    return <EmptyState type="no-team" variant="default" />;
  }

  return (
    <div className={styles.panel} data-testid="organizational-barriers">
      {/* Panel toolbar -- the module header owns the title, so the register's own description and
          the action that adds to it share one row instead of repeating a page heading. */}
      <div className={styles['panel-toolbar']}>
        <p className={styles.subtitle}>{t('page.subtitle')}</p>
        {canWrite && formMode !== 'create' && (
          <div className={styles['page-actions']}>
            <Button onClick={() => setFormMode('create')}>{t('actions.new')}</Button>
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div className={styles.stats}>
        <BarrierStat
          testId="barrier-stat-open"
          label={t('stats.open')}
          value={statsQuery.data?.data?.open ?? 0}
        />
        <BarrierStat
          testId="barrier-stat-in-progress"
          label={t('stats.inProgress')}
          value={statsQuery.data?.data?.inProgress ?? 0}
        />
        <BarrierStat
          testId="barrier-stat-resolved"
          label={t('stats.resolved')}
          value={statsQuery.data?.data?.resolved ?? 0}
        />
        <BarrierStat
          testId="barrier-stat-overdue"
          label={t('stats.overdue')}
          value={statsQuery.data?.data?.overdue ?? 0}
          overdue
        />
      </div>

      <div className={styles.filters}>
        <label className={styles.field}>
          <span className={styles.label}>{t('filters.status')}</span>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as BarrierStatusType | '')}
          >
            <option value="">{t('filters.all')}</option>
            <option value={BarrierStatus.OPEN}>{t('stats.open')}</option>
            <option value={BarrierStatus.IN_PROGRESS}>{t('stats.inProgress')}</option>
            <option value={BarrierStatus.RESOLVED}>{t('stats.resolved')}</option>
            <option value={BarrierStatus.CLOSED}>{t('stats.closed')}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t('filters.priority')}</span>
          <select
            className={styles.select}
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as BarrierPriority | '')}
          >
            <option value="">{t('filters.all')}</option>
            <option value="CRITICAL">{t('priority.critical')}</option>
            <option value="HIGH">{t('priority.high')}</option>
            <option value="MEDIUM">{t('priority.medium')}</option>
            <option value="LOW">{t('priority.low')}</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t('filters.search')}</span>
          <input
            className={styles.input}
            type="search"
            value={search}
            placeholder={t('filters.searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {formMode === 'create' && (
        <BarrierForm
          isEdit={false}
          members={members}
          submitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => setFormMode(null)}
        />
      )}

      <div className={styles.layout}>
        <section aria-label={t('page.title')}>
          {barriersQuery.isLoading ? (
            <LoadingState variant="spinner" label={t('common:loading')} />
          ) : barriers.length === 0 ? (
            <div className={styles.card}>
              <p className={styles.muted}>{t('list.empty')}</p>
              <p className={styles.muted}>{t('list.emptyHint')}</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {barriers.map((barrier) => (
                <li
                  key={barrier.id}
                  className={`${styles.card} ${selectedId === barrier.id ? styles['card-selected'] : ''}`}
                >
                  <button
                    type="button"
                    className={styles['card-button']}
                    onClick={() => setSelectedId(barrier.id)}
                    aria-current={selectedId === barrier.id}
                  >
                    <span className={styles['card-top']}>
                      <span className={styles['card-title']}>{barrier.title}</span>
                      <span
                        className={`${styles.badge} ${styles[PRIORITY_CLASS[barrier.priority]]}`}
                      >
                        {t(PRIORITY_LABEL_KEYS[barrier.priority])}
                      </span>
                      <span className={styles.badge}>{t(STATUS_LABEL_KEYS[barrier.status])}</span>
                      {barrier.isOverdue && (
                        <span className={`${styles.badge} ${styles['badge-overdue']}`}>
                          {t('list.overdue')}
                        </span>
                      )}
                    </span>
                    <span className={styles.meta}>
                      <span>
                        {t('list.owner')}: {barrier.ownerName ?? t('list.unassigned')}
                      </span>
                      <span>
                        {barrier.targetDate
                          ? `${t('list.targetDate')}: ${barrier.targetDate.slice(0, 10)}`
                          : t('list.noTargetDate')}
                      </span>
                      <span>
                        {t('list.age')}: {barrier.ageDays}
                      </span>
                      {barrier.sourceImpedimentTitle && (
                        <span>
                          {t('list.source')}: {barrier.sourceImpedimentTitle}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {detail && (
          <aside className={styles.detail} aria-label={detail.title}>
            <h2 className={styles['card-title']}>{detail.title}</h2>
            <p className={styles['detail-description']}>{detail.description}</p>

            <p className={styles.provenance}>
              {detail.sourceImpedimentTitle
                ? `${t('detail.escalatedFrom')}: ${detail.sourceImpedimentTitle}`
                : t('detail.provenance')}
            </p>

            {detail.resolution && (
              <p className={styles.resolution}>
                {t('detail.resolution')}: {detail.resolution}
              </p>
            )}

            {canWrite && formMode !== 'edit' && (
              <div className={styles['page-actions']}>
                <Button variant="secondary" size="sm" onClick={() => setFormMode('edit')}>
                  {t('actions.edit')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(detail.id)}
                >
                  {t('actions.delete')}
                </Button>
              </div>
            )}

            {formMode === 'edit' && (
              <BarrierForm
                isEdit
                members={members}
                submitting={updateMutation.isPending}
                initial={{
                  title: detail.title,
                  description: detail.description,
                  priority: detail.priority,
                  ownerId: detail.ownerId ?? null,
                  targetDate: detail.targetDate ?? '',
                  status: detail.status,
                  resolution: detail.resolution ?? '',
                }}
                onSubmit={(values) => updateMutation.mutate({ id: detail.id, values })}
                onCancel={() => setFormMode(null)}
              />
            )}

            <StakeholderActionList
              actions={detail.actions ?? []}
              canWrite={canWrite}
              members={members}
              busy={addActionMutation.isPending || updateActionMutation.isPending}
              onAdd={(values) => addActionMutation.mutate({ barrierId: detail.id, values })}
              onComplete={(actionId) => updateActionMutation.mutate(actionId)}
              onDelete={(actionId) => deleteActionMutation.mutate(actionId)}
            />
          </aside>
        )}
      </div>
    </div>
  );
};

const BarrierStat: React.FC<{
  label: string;
  value: number;
  /** Highlight a count that is a warning rather than a tally. */
  overdue?: boolean;
  testId: string;
}> = ({ label, value, overdue = false, testId }) => (
  <div className={`${styles.stat} ${overdue ? styles['stat-overdue'] : ''}`} data-testid={testId}>
    <span className={styles['stat-value']}>{value}</span>
    <span className={styles['stat-label']}>{label}</span>
  </div>
);

export default OrganizationalBarriers;
