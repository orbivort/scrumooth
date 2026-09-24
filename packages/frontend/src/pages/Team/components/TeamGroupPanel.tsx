// The group a team shares a product -- and one Definition of Done -- with.
//
// The 2020 Scrum Guide: *"If there are multiple Scrum Teams working together on a product, they
// must mutually define and comply with the same Definition of Done."* The backend holds that
// structurally: the group owns the only DoD its teams read, a grouped team cannot edit its own, and
// joining records the version the team adopted. This panel is where the team sees which commitment
// governs it, and -- for its Product Owner or Scrum Master -- where it adopts one or leaves.
//
// Two details are deliberate. The Definition of Done is shown *before* joining, because a
// commitment a team may not read before agreeing to it is not one the teams mutually defined. And
// the version adopted on joining is shown against the version in force, so a change made after the
// team agreed is visible to the team that has not re-adopted it.
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatLocaleDate } from '@scrumooth/shared';

import { Button } from '../../../components/common/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { useApiError } from '../../../hooks';
import { queryKeys } from '../../../hooks/queryKeys';
import { teamGroupService } from '../../../services';
import type { TeamGroupSummary } from '../../../types';
import styles from '../Team.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

interface TeamGroupPanelProps {
  teamId: string;
  /** The group the team complies with, as the team detail read reports it. */
  group?: TeamGroupSummary | null;
  /** The shared Definition of Done version the team adopted when it joined. */
  adoptedVersion?: number | null;
  joinedAt?: string | null;
  /** Whether the caller decides for this team: its Product Owner or Scrum Master. */
  canDecide: boolean;
  /** Called after a successful join or leave, so the team detail is re-read. */
  onChanged: () => void | Promise<void>;
}

export const TeamGroupPanel: React.FC<TeamGroupPanelProps> = ({
  teamId,
  group,
  adoptedVersion,
  joinedAt,
  canDecide,
  onChanged,
}) => {
  const { t } = useTranslation(['team', 'common']);
  const { locale } = useI18nStore();
  const queryClient = useQueryClient();
  const { handleError } = useApiError();

  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The directory is what makes joining possible at all: a team cannot adopt a collaboration it
  // cannot find.
  const { data: directoryData } = useQuery({
    queryKey: queryKeys.teamGroup.directory(),
    queryFn: () => teamGroupService.listGroups(),
    enabled: canDecide && !group,
    staleTime: 60 * 1000,
  });

  const directory = directoryData?.success && directoryData.data ? directoryData.data : [];

  // What the team would be adopting, read before it agrees.
  const { data: sharedDoDData } = useQuery({
    queryKey: queryKeys.teamGroup.sharedDoD(selectedGroupId),
    queryFn: () => teamGroupService.getSharedDefinitionOfDone(selectedGroupId),
    enabled: reviewing && !!selectedGroupId,
    staleTime: 60 * 1000,
  });

  const sharedDoD = sharedDoDData?.success && sharedDoDData.data ? sharedDoDData.data : null;
  const activeItems = (sharedDoD?.items ?? []).filter((item) => item.isActive);

  const refresh = useCallback(async () => {
    // The directory's team counts and the shared Definition of Done both moved; the surface that
    // owns the team's own detail (its page) is told separately, because only it knows its key.
    await queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
    await onChanged();
  }, [onChanged, queryClient]);

  const joinMutation = useMutation({
    mutationFn: (input: { groupId: string; acknowledgedDodVersion: number }) =>
      teamGroupService.joinGroup(teamId, input),
    onSuccess: async (response) => {
      if (!response.success) {
        setError(response.error?.message ?? t('teamGroup.joinError'));
        return;
      }

      setError(null);
      setReviewing(false);
      setSelectedGroupId('');
      await refresh();
    },
    onError: (mutationError: unknown) => setError(handleError(mutationError)),
  });

  const leaveMutation = useMutation({
    mutationFn: () => teamGroupService.leaveGroup(teamId),
    onSuccess: async (response) => {
      if (!response.success) {
        setError(response.error?.message ?? t('teamGroup.leaveError'));
        return;
      }

      setError(null);
      setIsLeaving(false);
      await refresh();
    },
    onError: (mutationError: unknown) => setError(handleError(mutationError)),
  });

  /** A change made after adoption is the drift the team has to see, not a silent mismatch. */
  const adoptionIsBehind =
    group !== null &&
    group !== undefined &&
    adoptedVersion !== null &&
    adoptedVersion !== undefined &&
    adoptedVersion < group.dodVersion;

  return (
    <section className={styles['team-group']} aria-label={t('teamGroup.title')}>
      <h2 className={styles['team-group-title']}>{t('teamGroup.title')}</h2>
      <p className={styles['team-group-hint']}>{t('teamGroup.hint')}</p>

      {group ? (
        <>
          <p className={styles['team-group-status']}>
            {t('teamGroup.current', { name: group.name, version: group.dodVersion })}
          </p>
          {adoptedVersion !== null && adoptedVersion !== undefined && (
            <p className={styles['team-group-meta']}>
              {t('teamGroup.adopted', {
                version: adoptedVersion,
                date: joinedAt ? formatLocaleDate(joinedAt, locale) : '—',
              })}
            </p>
          )}
          {adoptionIsBehind && (
            <p className={styles['team-group-drift']} role="status">
              {t('teamGroup.drift')}
            </p>
          )}

          {canDecide && (
            <>
              <div className={styles['team-group-actions']}>
                <Button variant="secondary" size="sm" onClick={() => setIsLeaving(true)}>
                  {t('teamGroup.leave')}
                </Button>
              </div>
              {/*
                The commitment belongs to the group, so changing it belongs on the group's own
                screen. This panel decides only whether the team complies.
              */}
              <p className={styles['team-group-discover']}>
                <Link
                  to={`/settings/team-groups?group=${group.id}`}
                  className={styles['team-group-link']}
                >
                  {t('teamGroup.manage')}
                </Link>
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <p className={styles['team-group-meta']}>{t('teamGroup.none')}</p>

          {/*
            A team that works alone is not necessarily alone on its product. The Guide's rule only
            bites when several teams share one, so the prompt names that condition rather than
            telling every team to go looking for a group.
          */}
          {canDecide && (
            <p className={styles['team-group-discover']}>
              {t('teamGroup.discover')}{' '}
              <Link to="/settings/team-groups" className={styles['team-group-link']}>
                {t('teamGroup.discoverAction')}
              </Link>
            </p>
          )}

          {canDecide && directory.length > 0 && (
            <div className={styles['team-group-actions']}>
              <label className={styles['team-group-field']}>
                <span className={styles['team-group-label']}>{t('teamGroup.choose')}</span>
                <select
                  className={styles['team-group-select']}
                  value={selectedGroupId}
                  onChange={(event) => {
                    setSelectedGroupId(event.target.value);
                    setReviewing(false);
                    setError(null);
                  }}
                >
                  <option value="">—</option>
                  {directory.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · v{candidate.dodVersion}
                    </option>
                  ))}
                </select>
              </label>

              {!reviewing && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!selectedGroupId}
                  onClick={() => setReviewing(true)}
                >
                  {t('teamGroup.review')}
                </Button>
              )}
            </div>
          )}

          {/*
            The commitment is read out in full before it is adopted: adopting a Definition of Done
            the team has not seen would make "mutually define" a claim about a document nobody read.
          */}
          {reviewing && sharedDoD && (
            <div className={styles['team-group-review']}>
              <ul className={styles['team-group-items']}>
                {activeItems.map((item) => (
                  <li key={item.id}>{item.description}</li>
                ))}
              </ul>

              <div className={styles['team-group-actions']}>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setReviewing(false)}
                  disabled={joinMutation.isPending}
                >
                  {t('common:cancel')}
                </Button>
                <Button
                  size="sm"
                  loading={joinMutation.isPending}
                  onClick={() =>
                    joinMutation.mutate({
                      groupId: selectedGroupId,
                      acknowledgedDodVersion: sharedDoD.version,
                    })
                  }
                >
                  {t('teamGroup.adopt', { version: sharedDoD.version })}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className={styles['team-group-error']} role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        isOpen={isLeaving}
        title={t('teamGroup.leaveTitle', { name: group?.name ?? '' })}
        message={t('teamGroup.leaveMessage')}
        variant="warning"
        showTrashIcon={false}
        isLoading={leaveMutation.isPending}
        onConfirm={() => leaveMutation.mutate()}
        onCancel={() => setIsLeaving(false)}
      />
    </section>
  );
};

export default TeamGroupPanel;
