// Barrier form: raise a barrier, amend it, or resolve it.
//
// Controlled local state with manual validation, matching how forms are built in this codebase
// (there is no react-hook-form/zod on the frontend). The one rule the form mirrors from the API is
// the one the API refuses: a barrier cannot reach RESOLVED or CLOSED without a written resolution.
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BARRIER_PRIORITIES,
  BARRIER_STATUSES,
  BarrierStatus,
  type BarrierPriority,
} from '@scrumooth/shared';

import { Button } from '../../../components/common/Button';
import styles from '../OrganizationalBarriers.module.css';

export interface BarrierFormValues {
  title: string;
  description: string;
  priority: BarrierPriority;
  ownerId: string | null;
  targetDate: string;
  status: BarrierStatus;
  resolution: string;
}

interface BarrierFormProps {
  /** Editing an existing barrier, rather than raising a new one. */
  isEdit: boolean;
  initial?: Partial<BarrierFormValues> | null;
  /** The team's members, so an owner can be chosen without typing an identifier. */
  members: Array<{ userId: string; name: string }>;
  submitting?: boolean;
  onSubmit: (values: BarrierFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const TERMINAL: string[] = [BarrierStatus.RESOLVED, BarrierStatus.CLOSED];

/** Label keys for the register's vocabulary, so the form and the list say the same words. */
const STATUS_LABEL_KEYS = {
  [BarrierStatus.OPEN]: 'stats.open',
  [BarrierStatus.IN_PROGRESS]: 'stats.inProgress',
  [BarrierStatus.RESOLVED]: 'stats.resolved',
  [BarrierStatus.CLOSED]: 'stats.closed',
} as const satisfies Record<BarrierStatus, string>;

const PRIORITY_LABEL_KEYS = {
  CRITICAL: 'priority.critical',
  HIGH: 'priority.high',
  MEDIUM: 'priority.medium',
  LOW: 'priority.low',
} as const satisfies Record<BarrierPriority, string>;

export const BarrierForm: React.FC<BarrierFormProps> = ({
  isEdit,
  initial,
  members,
  submitting = false,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation(['barriers', 'common']);
  const [values, setValues] = useState<BarrierFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    priority: initial?.priority ?? 'MEDIUM',
    ownerId: initial?.ownerId ?? null,
    targetDate: initial?.targetDate ? initial.targetDate.slice(0, 10) : '',
    status: initial?.status ?? BarrierStatus.OPEN,
    resolution: initial?.resolution ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    <K extends keyof BarrierFormValues>(key: K, value: BarrierFormValues[K]) => {
      setValues((previous) => ({ ...previous, [key]: value }));
      setError(null);
    },
    []
  );

  const handleSubmit = useCallback(() => {
    const title = values.title.trim();
    const description = values.description.trim();

    if (title.length < 3) {
      setError(t('form.titleRequired'));
      return;
    }

    if (description.length < 10) {
      setError(t('form.descriptionRequired'));
      return;
    }

    if (TERMINAL.includes(values.status) && values.resolution.trim().length === 0) {
      setError(t('form.resolutionRequired'));
      return;
    }

    void onSubmit({
      ...values,
      title,
      description,
      resolution: values.resolution.trim(),
    });
  }, [onSubmit, t, values]);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <h3 className={styles['form-title']}>
        {isEdit ? t('form.editTitle') : t('form.createTitle')}
      </h3>

      <label className={styles.field}>
        <span className={styles.label}>{t('form.title')}</span>
        <input
          className={styles.input}
          type="text"
          value={values.title}
          maxLength={200}
          onChange={(event) => update('title', event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('form.description')}</span>
        <textarea
          className={styles.textarea}
          value={values.description}
          rows={4}
          maxLength={4000}
          onChange={(event) => update('description', event.target.value)}
          required
        />
      </label>

      <div className={styles['field-row']}>
        <label className={styles.field}>
          <span className={styles.label}>{t('form.priority')}</span>
          <select
            className={styles.select}
            value={values.priority}
            onChange={(event) => update('priority', event.target.value as BarrierPriority)}
          >
            {BARRIER_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(PRIORITY_LABEL_KEYS[priority])}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t('form.owner')}</span>
          <select
            className={styles.select}
            value={values.ownerId ?? ''}
            onChange={(event) => update('ownerId', event.target.value || null)}
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
          <span className={styles.label}>{t('form.targetDate')}</span>
          <input
            className={styles.input}
            type="date"
            value={values.targetDate}
            onChange={(event) => update('targetDate', event.target.value)}
          />
        </label>
      </div>

      {isEdit && (
        <>
          <label className={styles.field}>
            <span className={styles.label}>{t('form.status')}</span>
            <select
              className={styles.select}
              value={values.status}
              onChange={(event) => update('status', event.target.value as BarrierStatus)}
            >
              {BARRIER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(STATUS_LABEL_KEYS[status])}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('form.resolution')}</span>
            <textarea
              className={styles.textarea}
              value={values.resolution}
              placeholder={t('form.resolutionPlaceholder')}
              rows={3}
              maxLength={4000}
              onChange={(event) => update('resolution', event.target.value)}
            />
          </label>
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles['form-actions']}>
        <Button variant="link" onClick={onCancel} disabled={submitting}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {t('actions.save')}
        </Button>
      </div>
    </form>
  );
};

export default BarrierForm;
