// The selected group: who it is, which teams comply with its Definition of Done, and where that
// commitment is read and changed.
//
// The roster is where the Scrum Guide rule becomes observable rather than asserted. A team whose
// adopted version is behind the version in force is not merely listed, it is marked: "they must
// mutually define and comply with the same Definition of Done" has stopped holding for that team,
// and the point of recording the adopted version on joining was to be able to say so.
//
// The commitment itself is stated and then delegated. This screen is where a *group* is administered
// -- created, renamed, deleted, its roster read -- and the Definition of Done is not an
// administrative object: it is the Increment's commitment, authored by the Scrum Team, in the place
// where the criteria and the Sprint they gate are both on screen. Keeping a second editor here is
// what made "where do I change our Definition of Done?" answerable only by a page about groups.
import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatLocaleDate } from '@scrumooth/shared';
import type { SharedDefinitionOfDone, TeamGroupMember, TeamGroupSummary } from '@scrumooth/shared';

import { Button } from '../../../../components/common/Button/Button';
import styles from '../TeamGroups.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { EditIcon, TrashIcon } from '@/components/common/Icons';

interface GroupDetailPanelProps {
  group: TeamGroupSummary;
  /** The group's teams, or `null` when the caller may not read the roster. */
  teams: TeamGroupMember[] | null;
  /** The commitment every team in the group complies with. */
  sharedDoD: SharedDefinitionOfDone;
  /** Whether the caller leads a team in the group, and may therefore act on it. */
  canManage: boolean;
  /** Whether the roster read was refused, so only the commitment could be shown. */
  isRosterRestricted: boolean;
  onRename: () => void;
  onDelete: () => void;
}

export const GroupDetailPanel: React.FC<GroupDetailPanelProps> = ({
  group,
  teams,
  sharedDoD,
  canManage,
  isRosterRestricted,
  onRename,
  onDelete,
}) => {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  // Generated rather than spelled: `aria-labelledby` with a fixed id names whichever element the
  // browser found first, and this panel is rendered beside other labelled sections.
  const commitmentTitleId = useId();

  // A group is only removable once no team complies with its Definition of Done: removing it while
  // teams remain would take their commitment away rather than move them to another one. The API
  // refuses it too (`GATE_TEAM_GROUP_NOT_EMPTY`); disabling the control explains the refusal before
  // it is provoked.
  const canDelete = group.teamCount === 0;

  /**
   * How one team stands against the version in force.
   *
   * A null adopted version is a record that predates the adoption record, so it is reported as not
   * recorded rather than presented as agreement the tool cannot vouch for.
   */
  const renderAdoptionStatus = (adoptedVersion: number | null): React.ReactElement => {
    if (adoptedVersion === null) {
      return <span className={styles['roster-version']}>{t('teamGroups.roster.notRecorded')}</span>;
    }

    if (adoptedVersion < group.dodVersion) {
      return (
        <span className={styles['roster-drift']} role="status">
          {t('teamGroups.roster.drift', {
            adopted: adoptedVersion,
            current: group.dodVersion,
          })}
        </span>
      );
    }

    return <span className={styles['roster-in-step']}>{t('teamGroups.roster.inStep')}</span>;
  };

  return (
    <div className={styles.detail}>
      <div className={styles['detail-card']}>
        <div className={styles['detail-header']}>
          <div className={styles['detail-heading']}>
            <h2 className={styles['detail-title']}>{group.name}</h2>
            {group.description && (
              <p className={styles['detail-description']}>{group.description}</p>
            )}
          </div>

          {canManage && (
            <div className={styles['detail-actions']}>
              <div className={styles['detail-actions-row']}>
                <Button variant="secondary" size="sm" onClick={onRename}>
                  <EditIcon size={16} />
                  {t('teamGroups.detail.rename')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onDelete}
                  disabled={!canDelete}
                  aria-describedby={canDelete ? undefined : 'group-delete-blocked'}
                >
                  <TrashIcon size={16} />
                  {t('teamGroups.detail.delete')}
                </Button>
              </div>

              {!canDelete && (
                <p id="group-delete-blocked" className={styles['action-hint']}>
                  {t('teamGroups.detail.deleteBlocked')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className={styles['detail-meta']}>
          <div className={styles['meta-item']}>
            <span className={styles['meta-label']}>{t('teamGroups.meta.teams')}</span>
            <span className={styles['meta-value']}>{group.teamCount}</span>
          </div>
          <div className={styles['meta-item']}>
            <span className={styles['meta-label']}>{t('teamGroups.meta.sharedVersion')}</span>
            <span className={styles['meta-value']}>
              {t('teamGroups.versionShort', { version: group.dodVersion })}
            </span>
          </div>
        </div>

        {isRosterRestricted && (
          <p className={styles['read-only-notice']} role="status">
            {t('teamGroups.detail.readOnlyNotice')}
          </p>
        )}

        {teams && (
          <div className={styles.roster}>
            <h3 className={styles['roster-title']}>{t('teamGroups.roster.title')}</h3>

            {teams.length === 0 ? (
              <p className={styles['roster-empty']}>{t('teamGroups.roster.empty')}</p>
            ) : (
              <table className={styles['roster-table']}>
                <caption>{t('teamGroups.roster.caption', { name: group.name })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('teamGroups.roster.team')}</th>
                    <th scope="col">{t('teamGroups.roster.joined')}</th>
                    <th scope="col">{t('teamGroups.roster.adopted')}</th>
                    <th scope="col">{t('teamGroups.roster.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <td className={styles['roster-team']}>{team.name}</td>
                      <td>
                        {team.joinedAt
                          ? formatLocaleDate(team.joinedAt, locale)
                          : t('teamGroups.roster.unknown')}
                      </td>
                      <td>
                        {team.adoptedDodVersion === null
                          ? t('teamGroups.roster.unknown')
                          : t('teamGroups.versionShort', { version: team.adoptedDodVersion })}
                      </td>
                      <td>{renderAdoptionStatus(team.adoptedDodVersion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* The commitment is stated, not edited. Its criteria are readable in full on the Definition
          tab of any team in the group, which is where the change belongs and where the Sprint the
          agreement gates is also in view. */}
      <section className={styles.commitment} aria-labelledby={commitmentTitleId}>
        <div className={styles['commitment-head']}>
          <h3 id={commitmentTitleId} className={styles['commitment-title']}>
            {t('teamGroups.sharedDoD.title')}
          </h3>
          <span className={styles['roster-version']}>
            {t('teamGroups.versionShort', { version: sharedDoD.version })}
          </span>
          <span className={styles['commitment-updated']}>
            {t('teamGroups.sharedDoD.updated', {
              date: formatLocaleDate(sharedDoD.updatedAt, locale),
            })}
          </span>
        </div>

        <p className={styles['commitment-body']}>{t('teamGroups.sharedDoD.delegated')}</p>

        <p className={styles['commitment-action']}>
          <Link to="/team?tab=definition#definition-of-done" className={styles['commitment-link']}>
            {t('teamGroups.sharedDoD.openAction')}
          </Link>
        </p>
      </section>
    </div>
  );
};

export default GroupDetailPanel;
