// Working agreement form: controlled state with manual validation, as the rest of the app does.
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../components/common/Button';
import styles from '../WorkingAgreements.module.css';

export interface WorkingAgreementFormValues {
  title: string;
  description: string;
}

interface WorkingAgreementFormProps {
  /** Editing an existing agreement, rather than adding a new one. */
  isEdit: boolean;
  initial?: WorkingAgreementFormValues | null;
  submitting?: boolean;
  onSubmit: (values: WorkingAgreementFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export const WorkingAgreementForm: React.FC<WorkingAgreementFormProps> = ({
  isEdit,
  initial,
  submitting = false,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation(['agreements', 'common']);
  const [values, setValues] = useState<WorkingAgreementFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
  });
  const [error, setError] = useState<string | null>(null);

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

    void onSubmit({ title, description });
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
          onChange={(event) => {
            setValues((previous) => ({ ...previous, title: event.target.value }));
            setError(null);
          }}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('form.description')}</span>
        <textarea
          className={styles.textarea}
          value={values.description}
          rows={3}
          maxLength={2000}
          onChange={(event) => {
            setValues((previous) => ({ ...previous, description: event.target.value }));
            setError(null);
          }}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles['form-actions']}>
        <Button variant="link" onClick={onCancel} disabled={submitting}>
          {t('agreements.cancel')}
        </Button>
        <Button type="submit" loading={submitting}>
          {t('agreements.save')}
        </Button>
      </div>
    </form>
  );
};

export default WorkingAgreementForm;
