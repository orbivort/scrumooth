// The actions taken with stakeholders against one barrier.
//
// Barrier removal is a sequence of conversations and decisions with people outside the team, so each
// is recorded as its own entry with an owner and a due date. That is what makes "removing barriers
// between stakeholders and Scrum Teams" inspectable instead of asserted: the register shows who
// agreed to do what, and whether it was done.
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StakeholderActionStatus, type BarrierStakeholderAction } from '@scrumooth/shared';

import { Button } from '../../../components/common/Button';
import styles from '../OrganizationalBarriers.module.css';

/** Typed label keys for the action lifecycle, so `t()` accepts them. */
const ACTION_STATUS_LABEL_KEYS = {
  [StakeholderActionStatus.OPEN]: 'actionStatus.open',
  [StakeholderActionStatus.DONE]: 'actionStatus.done',
  [StakeholderActionStatus.CANCELLED]: 'actionStatus.cancelled',
} as const satisfies Record<StakeholderActionStatus, string>;

interface StakeholderActionListProps {
  actions: BarrierStakeholderAction[];
  /** Whether the caller may record actions: the team's Scrum Master. */
  canWrite: boolean;
  members: Array<{ userId: string; name: string }>;
  busy?: boolean;
  onAdd: (values: { description: string; ownerId: string | null; dueDate: string }) => void;
  onComplete: (actionId: string) => void;
  onDelete: (actionId: string) => void;
}

export const StakeholderActionList: React.FC<StakeholderActionListProps> = ({
  actions,
  canWrite,
  members,
  busy = false,
  onAdd,
  onComplete,
  onDelete,
}) => {
  const { t } = useTranslation(['barriers', 'common']);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const trimmed = description.trim();

    if (trimmed.length < 3) {
      setError(t('action.required'));
      return;
    }

    onAdd({ description: trimmed, ownerId: ownerId || null, dueDate });
    setAdding(false);
    setDescription('');
    setOwnerId('');
    setDueDate('');
    setError(null);
  }, [description, dueDate, onAdd, ownerId, t]);

  return (
    <div className={styles['action-section']}>
      <div className={styles['action-header']}>
        <h4 className={styles['section-title']}>{t('detail.stakeholderActions')}</h4>
        {canWrite && !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            {t('action.add')}
          </Button>
        )}
      </div>

      {actions.length === 0 && !adding && <p className={styles.muted}>{t('detail.noActions')}</p>}

      <ol className={styles['action-list']}>
        {actions.map((action) => (
          <li
            key={action.id}
            className={`${styles['action-item']} ${action.status === StakeholderActionStatus.DONE ? styles['action-item-done'] : ''}`}
          >
            <div className={styles['action-body']}>
              <p className={styles['action-description']}>{action.description}</p>
              <div className={styles['action-meta']}>
                <span>{action.ownerName ?? t('list.unassigned')}</span>
                <span>
                  {action.dueDate
                    ? `${t('action.dueDate')}: ${action.dueDate.slice(0, 10)}${
                        action.daysUntilDue !== null &&
                        action.daysUntilDue !== undefined &&
                        action.daysUntilDue < 0 &&
                        action.status === StakeholderActionStatus.OPEN
                          ? ` · ${t('action.overdue')}`
                          : ''
                      }`
                    : t('action.noDueDate')}
                </span>
                <span>{t(ACTION_STATUS_LABEL_KEYS[action.status])}</span>
              </div>
            </div>

            {canWrite && (
              <div className={styles['action-buttons']}>
                {action.status === StakeholderActionStatus.OPEN && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => onComplete(action.id)}
                  >
                    {t('action.complete')}
                  </Button>
                )}
                <Button
                  variant="link"
                  size="sm"
                  disabled={busy}
                  onClick={() => onDelete(action.id)}
                >
                  {t('action.delete')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>

      {adding && (
        <div className={styles['action-form']}>
          <label className={styles.field}>
            <span className={styles.label}>{t('action.description')}</span>
            <input
              className={styles.input}
              type="text"
              value={description}
              maxLength={500}
              onChange={(event) => {
                setDescription(event.target.value);
                setError(null);
              }}
            />
          </label>
          <div className={styles['field-row']}>
            <label className={styles.field}>
              <span className={styles.label}>{t('action.owner')}</span>
              <select
                className={styles.select}
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                <option value="">{t('list.unassigned')}</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{t('action.dueDate')}</span>
              <input
                className={styles.input}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles['form-actions']}>
            <Button variant="link" onClick={() => setAdding(false)}>
              {t('common:cancel')}
            </Button>
            <Button onClick={handleAdd}>{t('action.add')}</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StakeholderActionList;
