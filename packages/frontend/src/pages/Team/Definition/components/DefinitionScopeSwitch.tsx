// Which Definition of Done governs this team, and what the reader may do about it.
//
// The 2020 Scrum Guide: *"If there are multiple Scrum Teams working together on a product, they must
// mutually define and comply with the same Definition of Done."* Two decisions follow from that, and
// they belong together because they are the same question asked from two sides:
//
//  * Reviewing and changing the commitment that is in force -- including the shared one, which is
//    authored here rather than in an administration screen. Whoever leads a team in the group may
//    change it; you cannot lead the group itself, because there is no such thing.
//  * Adopting a shared commitment, or leaving the one the team has. Joining is an explicit act: the
//    agreement is read in full and the version being adopted is named, so "mutually define" is
//    something the teams did rather than something the tool asserts about them.
//
// Absorbed from two places that each held half of it: the ribbon that linked out to the group's
// admin screen (where the commitment could not be changed anyway), and the panel under Scrum Health
// (where a governance decision sat beside a values survey). Neither is where a Definition of Done
// belongs; the section that shows the criteria is.
//
// It reads nothing itself except the two things only it needs -- the directory it may adopt from and
// the shared agreement it reviews -- and reports every refusal through the shared gate renderer, so a
// refusal arrives with its rule and its remedy rather than as a sentence to interpret.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatLocaleDate, GATE_CODES } from '@scrumooth/shared';
import type { SharedDefinitionOfDone, TeamGroupSummary } from '@scrumooth/shared';

import { Button } from '../../../../components/common/Button';
import { Disclosure } from '../../../../components/common/Disclosure';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { GateRefusal, useGateRefusal } from '../../../../components/common/GateRefusal';
import {
  useJoinTeamGroup,
  useLeaveTeamGroup,
  useTeamGroupSharedDoD,
  useTeamGroups,
} from '../../../../hooks';

import { criterionLabel } from './criterionLabel';
import styles from './DefinitionScopeSwitch.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { CheckCircleIcon, UsersIcon } from '@/components/common/Icons';

export interface DefinitionScopeSwitchProps {
  teamId: string;
  /** The group the team complies with, or null when it works on its own. */
  group: TeamGroupSummary | null;
  /**
   * The version adopted at join, or null on a record that predates the adoption record.
   *
   * Compared against the version in force to surface drift: a shared Definition of Done that changed
   * after a team agreed to it is no longer one the teams defined together, and saying so is the point
   * of having recorded the version at all.
   */
  adoptedVersion: number | null;
  /** When the team joined, when that is known. */
  joinedAt: string | null;
  /** Whether the caller leads this team, and may therefore decide for it. */
  canDecide: boolean;
}

export const DefinitionScopeSwitch: React.FC<DefinitionScopeSwitchProps> = ({
  teamId,
  group,
  adoptedVersion,
  joinedAt,
  canDecide,
}) => {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();

  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);

  /**
   * Whether the scope statement has been opened onto the decisions it holds.
   *
   * The statement itself stays visible in every state -- it is what tells the reader which Definition of
   * Done governs this team. What sits behind the disclosure is the governing, not the fact: the adopt
   * flow, the review, leaving the group, and the record of what was adopted. Those are decisions a team
   * takes occasionally, and they were the tallest thing on the page for everyone who never takes them.
   */
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);

  // The directory is what makes adopting possible at all: a team cannot adopt a collaboration it
  // cannot find. Read only for a reader who could act on it -- a team that already belongs to a group
  // has nothing to choose, and a member who does not lead one cannot choose.
  const directoryQuery = useTeamGroups(canDecide && !group);

  const directory: TeamGroupSummary[] =
    directoryQuery.data?.success && directoryQuery.data.data ? directoryQuery.data.data : [];

  /**
   * The agreement being reviewed: the one the team complies with, or the one it would adopt.
   *
   * One of the two, never both -- a team in a group has nothing to adopt, and a team on its own has
   * nothing to review until it picks a group. Keeping them in one variable is what lets the review
   * below be one block rather than two that say the same thing.
   */
  const reviewGroupId = group ? group.id : selectedGroupId;

  // What governs the team, or what it would adopt: read in full before it is agreed to.
  const sharedDoDQuery = useTeamGroupSharedDoD(reviewGroupId, !!reviewGroupId && isReviewing);
  const sharedDoD: SharedDefinitionOfDone | null =
    sharedDoDQuery.data?.success && sharedDoDQuery.data.data ? sharedDoDQuery.data.data : null;

  const joinMutation = useJoinTeamGroup(teamId);
  const leaveMutation = useLeaveTeamGroup(teamId);

  const joinRefusal = useGateRefusal(joinMutation.error);
  const leaveRefusal = useGateRefusal(leaveMutation.error);

  /**
   * The acknowledgement the team is about to record, captured at review time.
   *
   * It is submitted as read rather than re-read at submit: a version that moved in between is refused
   * by the API, which is the correct outcome -- adopting the newer one silently would record agreement
   * to a Definition of Done that was never reviewed.
   */
  const reviewedVersion = sharedDoD?.version ?? null;

  const handleReview = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    setIsReviewing(true);
  }, []);

  const handleCancelReview = useCallback(() => {
    setIsReviewing(false);
    setSelectedGroupId('');
  }, []);

  /**
   * The act itself. `mutate`, not `mutateAsync`: a refusal is rendered in place by the gate renderer
   * below -- its rule, why it exists and the act that resolves it -- so there is nothing here to await,
   * and awaiting it left the rejection unhandled. The two sibling handlers on this component already
   * take the same form.
   */
  const handleAdopt = useCallback(
    (groupId: string, acknowledgedDodVersion: number) => {
      joinMutation.mutate({ groupId, acknowledgedDodVersion });
    },
    [joinMutation]
  );

  /**
   * The remedy for a stale acknowledgement: read the version now in force again, then adopt that.
   *
   * Without it the reader is told the version moved and left to guess that re-opening the review
   * fixes it -- which is exactly the dead end this renderer exists to remove.
   */
  const handleAdoptRefreshed = useCallback(async () => {
    const refreshed = await sharedDoDQuery.refetch();
    const version =
      refreshed.data?.success && refreshed.data.data ? refreshed.data.data.version : null;

    if (version === null || !selectedGroupId) {
      return;
    }

    joinMutation.mutate({ groupId: selectedGroupId, acknowledgedDodVersion: version });
  }, [joinMutation, selectedGroupId, sharedDoDQuery]);

  const handleLeave = useCallback(() => {
    leaveMutation.mutate(undefined, { onSettled: () => setIsLeaving(false) });
  }, [leaveMutation]);

  const isStaleAcknowledgement =
    joinRefusal?.code === GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED;

  /** A change made after adoption is drift the team has to see, not a silent mismatch. */
  const adoptionIsBehind =
    group !== null && adoptedVersion !== null && adoptedVersion < group.dodVersion;

  /**
   * Drift opens the block on its own.
   *
   * Leaving it behind a control the reader has to think to open would be the one thing this collapse
   * must not do: drift says the agreement this team agreed to has moved, and it comes with a remedy.
   * Closing it again stays the reader's choice -- this opens it, it does not pin it open.
   */
  useEffect(() => {
    if (adoptionIsBehind) {
      setIsGovernanceOpen(true);
    }
  }, [adoptionIsBehind]);

  const activeItems = useMemo(
    () =>
      (sharedDoD?.items ?? []).filter((item) => item.isActive).sort((a, b) => a.order - b.order),
    [sharedDoD]
  );

  /**
   * The agreement read out in full, with the reason a version is acknowledged.
   *
   * Shown both before adopting and when reviewing what governs the team, because "mutually define" is
   * a claim about the teams having read the same thing -- and this is where they read it.
   */
  const renderAgreement = (): React.ReactElement => (
    <div className={styles.review}>
      <p className={styles['review-label']}>
        {t('definitionScope.reviewLabel', {
          name:
            group?.name ??
            directory.find((candidate) => candidate.id === reviewGroupId)?.name ??
            '',
        })}
      </p>

      <ol className={styles['review-list']}>
        {activeItems.map((item, index) => (
          <li key={item.id} className={styles['review-item']}>
            <span className={styles['review-number']}>{index + 1}</span>
            <span>{criterionLabel(t, 'DOD', item)}</span>
          </li>
        ))}
      </ol>

      <div className={styles.mutual} role="note">
        <strong className={styles['mutual-title']}>{t('definitionScope.mutualTitle')}</strong>{' '}
        {t('definitionScope.mutualBody')}
      </div>
    </div>
  );

  const renderAdoptFlow = (): React.ReactElement => (
    <div className={styles.adopt}>
      <h3 className={styles['adopt-title']}>{t('definitionScope.adoptTitle')}</h3>
      <p className={styles['adopt-hint']}>{t('definitionScope.adoptHint')}</p>

      {!isReviewing && (
        <div className={styles['adopt-controls']}>
          <label className={styles.field}>
            <span className={styles['field-label']}>{t('definitionScope.chooseLabel')}</span>
            <select
              className={styles.select}
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
            >
              <option value="">—</option>
              {directory.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ·{' '}
                  {t('definitionHistory.versionLabel', { version: candidate.dodVersion })}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="secondary"
            size="sm"
            disabled={!selectedGroupId}
            onClick={() => handleReview(selectedGroupId)}
          >
            {t('definitionScope.reviewAction')}
          </Button>
        </div>
      )}

      {isReviewing && (
        <>
          {renderAgreement()}

          <div className={styles.actions}>
            <Button variant="link" size="sm" onClick={handleCancelReview}>
              {t('definitionScope.hideReviewLink')}
            </Button>
            {reviewedVersion !== null && selectedGroupId && (
              <Button
                size="sm"
                loading={joinMutation.isPending}
                onClick={() => handleAdopt(selectedGroupId, reviewedVersion)}
              >
                {t('definitionScope.adoptAction', { version: reviewedVersion })}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );

  /**
   * The scope statement: which Definition of Done governs this team, and why.
   *
   * It never collapses. It is the fact the rest of the block is a decision about, and a reader who
   * cannot see it cannot tell whether the criteria below are their own team's or one they share.
   */
  const renderScopeStatement = (): React.ReactElement =>
    group ? (
      <>
        <strong>
          {t('definitionScope.groupTitle', { name: group.name, count: group.teamCount })}
        </strong>{' '}
        {t('definitionScope.groupHint', { name: group.name })}
      </>
    ) : (
      <>
        <strong>{t('definitionScope.teamTitle')}</strong> {t('definitionScope.teamHint')}
      </>
    );

  /** The statement as a plain note, for the one case where there is nothing behind it to open. */
  const renderScopeNote = (): React.ReactElement => (
    <p className={styles.ribbon} data-scope="team" role="note">
      <span className={styles.icon} aria-hidden="true">
        <CheckCircleIcon size={14} />
      </span>
      <span className={styles.text}>{renderScopeStatement()}</span>
    </p>
  );

  /**
   * Everything the statement is a decision about, revealed on demand.
   *
   * Typed as a node rather than an element because the one reader with nothing to decide -- a team on its
   * own, read by someone who does not lead it -- falls through both branches. That same condition is what
   * the caller checks before offering the disclosure at all, so the empty case is never the visible one;
   * the type just has to say so.
   */
  const renderGovernanceDecisions = (): React.ReactNode =>
    group ? (
      <>
        {adoptedVersion !== null && (
          <p className={styles.meta}>
            {t('definitionScope.adoptedAt', {
              version: adoptedVersion,
              date: joinedAt ? formatLocaleDate(joinedAt, locale) : '—',
            })}
          </p>
        )}

        {adoptionIsBehind && (
          <p className={styles.drift} role="status">
            {t('definitionScope.drift', { adopted: adoptedVersion, current: group.dodVersion })}
          </p>
        )}

        {!canDecide && (
          <p className={styles['read-only']}>
            {t('definitionScope.readOnlyNote', { name: group.name })}
          </p>
        )}

        {/* Reading the shared agreement in full and leaving it are the two things a team in a group can
            do about it, and the group's own screen is where it is administered rather than here. */}
        <div className={styles.actions}>
          <Button variant="link" size="sm" onClick={() => setIsReviewing((open) => !open)}>
            {isReviewing ? t('definitionScope.hideReviewLink') : t('definitionScope.reviewLink')}
          </Button>

          <Link to={`/settings/team-groups?group=${group.id}`} className={styles.link}>
            {t('definitionScope.manageLink')}
          </Link>

          {canDecide && (
            <Button variant="warning" size="sm" onClick={() => setIsLeaving(true)}>
              {t('definitionScope.leave')}
            </Button>
          )}
        </div>

        {isReviewing && renderAgreement()}
      </>
    ) : (
      canDecide && renderAdoptFlow()
    );

  /**
   * Whether there is a decision here at all.
   *
   * A team that works on its own, read by someone who does not lead it, has none: the adopt flow is not
   * offered to them and there is nothing else behind the statement. A disclosure that opens onto nothing
   * is worse than the statement alone, so in that one case the statement stays a plain note.
   */
  const hasGovernanceDecisions = group !== null || canDecide;

  return (
    <div className={styles.switch}>
      {hasGovernanceDecisions ? (
        <Disclosure
          tone={group ? 'primary' : 'neutral'}
          icon={group ? <UsersIcon size={14} /> : <CheckCircleIcon size={14} />}
          open={isGovernanceOpen}
          onOpenChange={setIsGovernanceOpen}
          label={
            <>
              {renderScopeStatement()}{' '}
              <span className={styles['disclosure-hint']}>
                {group
                  ? t('definitionScope.manageDisclosure')
                  : t('definitionScope.adoptDisclosure')}
              </span>
            </>
          }
        >
          {renderGovernanceDecisions()}
        </Disclosure>
      ) : (
        renderScopeNote()
      )}

      {/* One renderer for both directions: adopting a group and leaving one are the same kind of
          decision, and a stale acknowledgement is a third state of the same flow. Both refusals stay
          outside the disclosure -- a gate is the process working, and its reason must never sit behind a
          control the reader has to think to open. */}
      <GateRefusal
        view={joinRefusal}
        onDismiss={() => joinMutation.reset()}
        action={
          isStaleAcknowledgement ? (
            <Button
              variant="secondary"
              size="sm"
              loading={joinMutation.isPending}
              onClick={() => void handleAdoptRefreshed()}
            >
              {t('definitionScope.reviewCurrentAction')}
            </Button>
          ) : undefined
        }
      />

      <GateRefusal view={leaveRefusal} onDismiss={() => leaveMutation.reset()} />

      <ConfirmDialog
        isOpen={isLeaving}
        title={t('definitionScope.leaveTitle', { name: group?.name ?? '' })}
        message={t('definitionScope.leaveMessage')}
        variant="warning"
        showTrashIcon={false}
        isLoading={leaveMutation.isPending}
        onConfirm={handleLeave}
        onCancel={() => setIsLeaving(false)}
      />
    </div>
  );
};

export default DefinitionScopeSwitch;
