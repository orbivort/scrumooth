// The group directory: what a team can join, and which shared Definition of Done version it would
// adopt.
//
// It is deliberately thin. The roster and the commitment belong to the group that is selected, so
// this stays a list of choices rather than a second, competing detail view -- the same reason the
// API's directory read returns neither.
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TeamGroupSummary } from '@scrumooth/shared';

import styles from '../TeamGroups.module.css';

interface GroupListProps {
  groups: TeamGroupSummary[];
  selectedGroupId: string | null;
  onSelect: (groupId: string) => void;
}

export const GroupList: React.FC<GroupListProps> = ({ groups, selectedGroupId, onSelect }) => {
  const { t } = useTranslation('settings');

  return (
    <ul className={styles['group-list']} aria-label={t('teamGroups.listAriaLabel')}>
      {groups.map((group) => {
        const isSelected = group.id === selectedGroupId;
        const buttonClasses = [
          styles['group-list-button'],
          isSelected ? styles['group-list-button-active'] : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li key={group.id}>
            <button
              type="button"
              className={buttonClasses}
              // The selected group is what the detail pane is about, so the selection is stated
              // programmatically rather than only tinted.
              aria-current={isSelected ? 'true' : undefined}
              onClick={() => onSelect(group.id)}
            >
              <span className={styles['group-list-name']}>{group.name}</span>

              {group.description && (
                <span className={styles['group-list-description']}>{group.description}</span>
              )}

              <span className={styles['group-list-meta']}>
                <span>{t('teamGroups.teamCount', { count: group.teamCount })}</span>
                <span className={styles['group-list-version']}>
                  {t('teamGroups.versionShort', { version: group.dodVersion })}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default GroupList;
