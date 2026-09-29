import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import type { TeamMember } from '../../types';
import { MailIcon, TrashIcon } from '../../components/common/Icons';

import { SendMessageModal } from './SendMessageModal';
import styles from './Team.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

const ROLE_BADGE_CLASSES: Record<string, string> = {
  scrum_master: 'role-scrum-master',
  product_owner: 'role-product-owner',
  developers: 'role-developer',
};

const getRoleBadgeClass = (role: string): string => {
  const normalizedRole = role.toLowerCase();
  const className = ROLE_BADGE_CLASSES[normalizedRole] ?? 'role-default';
  return styles[className] ?? '';
};

interface MemberCardProps {
  member: TeamMember;
  canRemove: boolean;
  onDelete: (member: TeamMember) => void;
  isDeleting: boolean;
  viewMode?: 'card' | 'list';
}

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  canRemove,
  onDelete,
  isDeleting,
  viewMode = 'card',
}) => {
  const { t } = useTranslation('team');
  const { locale } = useI18nStore();
  const [showMessageModal, setShowMessageModal] = useState(false);

  const user = member.user;
  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.email ||
      t('memberCard.unknownUser')
    : t('memberCard.unknownUser');
  const email = user?.email ?? '';
  const role = member.role;
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- runtime data may differ from User type */
  const initials = user
    ? ((`${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
        user.email[0]?.toUpperCase()) ??
      '?')
    : '?';
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  const formatRoleName = (roleKey: string): string => {
    const normalizedRole = roleKey.toLowerCase();
    const roleKeyMap: Record<string, string> = {
      scrum_master: 'scrumMaster',
      product_owner: 'productOwner',
      developers: 'developers',
    };
    const i18nKey = roleKeyMap[normalizedRole];
    if (i18nKey) {
      return t(`memberCard.roleNames.${i18nKey}` as never);
    }
    return roleKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const memberSince = member.joinedAt
    ? formatLocaleDate(member.joinedAt, locale)
    : t('memberCard.unknownDate');

  const handleSendMessage = () => {
    setShowMessageModal(true);
  };

  const handleCloseMessageModal = () => {
    setShowMessageModal(false);
  };

  const handleDelete = () => {
    onDelete(member);
  };

  if (viewMode === 'list') {
    return (
      <>
        <article
          className={styles['member-row']}
          role="listitem"
          aria-label={t('memberCard.ariaLabels.teamMember', { name: displayName })}
        >
          <div className={styles['member-row-avatar']} aria-hidden="true">
            {initials}
          </div>
          <div className={styles['member-row-info']}>
            <span className={styles['member-row-name']}>{displayName}</span>
            <span className={styles['member-row-email']}>{email}</span>
          </div>
          <span
            className={`${styles['role-badge']} ${styles['role-badge-compact']} ${getRoleBadgeClass(role)}`}
          >
            {formatRoleName(role)}
          </span>
          <span className={styles['member-row-joined']}>{memberSince}</span>
          <div className={styles['member-row-actions']}>
            <button
              type="button"
              className={styles['action-button']}
              onClick={handleSendMessage}
              aria-label={t('memberCard.ariaLabels.sendMessageTo', { name: displayName })}
              title={t('memberCard.titles.sendMessage')}
            >
              <MailIcon />
            </button>
            {canRemove && (
              <button
                type="button"
                className={`${styles['action-button']} ${styles.delete}`}
                onClick={handleDelete}
                disabled={isDeleting}
                aria-label={t('memberCard.ariaLabels.removeNameFromTeam', { name: displayName })}
                title={t('memberCard.titles.removeFromTeam')}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        </article>

        {showMessageModal && user && (
          <SendMessageModal
            isOpen={showMessageModal}
            onClose={handleCloseMessageModal}
            recipientId={user.id}
            recipientName={displayName}
            recipientEmail={email}
          />
        )}
      </>
    );
  }

  return (
    <>
      <article
        className={styles['member-card']}
        role="listitem"
        aria-label={t('memberCard.ariaLabels.teamMember', { name: displayName })}
      >
        <div className={styles['member-avatar']} aria-hidden="true">
          {initials}
        </div>
        <div className={styles['member-info']}>
          <div className={styles['member-name']}>{displayName}</div>
          <div className={styles['member-email']}>{email}</div>
          <div className={styles['member-meta']}>
            <span className={`${styles['role-badge']} ${getRoleBadgeClass(role)}`}>
              {formatRoleName(role)}
            </span>
            <span className={styles['member-since']}>
              {t('memberCard.memberSince')} {memberSince}
            </span>
          </div>
        </div>
        <div className={styles['member-actions']}>
          <button
            type="button"
            className={styles['action-button']}
            onClick={handleSendMessage}
            aria-label={t('memberCard.ariaLabels.sendMessageTo', { name: displayName })}
            title={t('memberCard.titles.sendMessage')}
          >
            <MailIcon />
          </button>
          {canRemove && (
            <button
              type="button"
              className={`${styles['action-button']} ${styles.delete}`}
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={t('memberCard.ariaLabels.removeNameFromTeam', { name: displayName })}
              title={t('memberCard.titles.removeFromTeam')}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </article>

      {showMessageModal && user && (
        <SendMessageModal
          isOpen={showMessageModal}
          onClose={handleCloseMessageModal}
          recipientId={user.id}
          recipientName={displayName}
          recipientEmail={email}
        />
      )}
    </>
  );
};
