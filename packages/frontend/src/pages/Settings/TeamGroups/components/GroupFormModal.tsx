// One modal for creating and for renaming, because both carry the same two fields: what the group is
// called and what it is for. A second, near-identical dialog would be two places to change the day a
// group grows a third field.
//
// The length limits mirror `createTeamGroupSchema` / `updateTeamGroupSchema` (name 1-100,
// description up to 500), so a name the server would refuse is refused here first, in the user's own
// language, before the request is made.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../../../../components/common/Button/Button';
import { UnsavedChangesModal } from '../../../../components/common/Form/UnsavedChangesModal';
import type { GroupFormInput } from '../../../../hooks';

import styles from './GroupFormModal.module.css';

import { useModalFocus } from '@/hooks/useModalFocus';
import { useBeforeUnload } from '@/hooks/useBeforeUnload';
import { AlertTriangleIcon, SaveIcon, UsersIcon, XIcon } from '@/components/common/Icons';

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

/**
 * How close a field is to the limit the server enforces, so the cap is visible before it is hit.
 * Hoisted rather than declared in the component: it is invariant, and re-creating it per render
 * would only be noise.
 */
const counterClassFor = (length: number, maxLength: number): string => {
  if (length >= maxLength) {
    return styles['char-counter-error'] ?? '';
  }

  if (length >= maxLength * 0.8) {
    return styles['char-counter-warning'] ?? '';
  }

  return '';
};

interface GroupFormModalProps {
  isOpen: boolean;
  /** `create` adds a group; `edit` renames the one whose values are seeded below. */
  mode: 'create' | 'edit';
  initialName?: string;
  initialDescription?: string | null;
  isSubmitting: boolean;
  /** The reason a write was refused, shown inline so the group is corrected rather than abandoned. */
  errorMessage?: string | null;
  onSubmit: (input: GroupFormInput) => void;
  onClose: () => void;
}

export const GroupFormModal: React.FC<GroupFormModalProps> = ({
  isOpen,
  mode,
  initialName = '',
  initialDescription = null,
  isSubmitting,
  errorMessage = null,
  onSubmit,
  onClose,
}) => {
  const { t } = useTranslation('settings');
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Seeding on open rather than on mount: the same modal is reused for a different group, so the
  // fields have to be re-read each time it is shown.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(initialName);
    setDescription(initialDescription ?? '');
    setErrors({});
    setIsDirty(false);
  }, [isOpen, initialName, initialDescription]);

  useBeforeUnload(isDirty, t('teamGroups.form.beforeUnload'));

  const { modalRef } = useModalFocus({
    isOpen,
    onClose,
    initialFocusRef: nameInputRef,
  });

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedChanges(true);
      return;
    }

    onClose();
  }, [isDirty, onClose]);

  const handleConfirmDiscard = useCallback(() => {
    setShowUnsavedChanges(false);
    setIsDirty(false);
    onClose();
  }, [onClose]);

  const handleCancelDiscard = useCallback(() => setShowUnsavedChanges(false), []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: { name?: string; description?: string } = {};
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      nextErrors.name = t('teamGroups.form.nameRequired');
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      nextErrors.name = t('teamGroups.form.nameMaxLength');
    }

    if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) {
      nextErrors.description = t('teamGroups.form.descriptionMaxLength');
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // Announcing an error is not the same as reaching it: the field to correct keeps the focus.
      if (nextErrors.name) {
        nameInputRef.current?.focus();
      }

      return;
    }

    setIsDirty(false);
    onSubmit({
      name: trimmedName,
      // An emptied description is sent as null, which is how the API records "no description"
      // rather than the empty string it would otherwise store.
      description: trimmedDescription ? trimmedDescription : null,
    });
  };

  const nameCounterClass = counterClassFor(name.length, NAME_MAX_LENGTH);
  const descriptionCounterClass = counterClassFor(description.length, DESCRIPTION_MAX_LENGTH);

  if (!isOpen) {
    return null;
  }

  const isEdit = mode === 'edit';
  const title = isEdit
    ? t('teamGroups.form.editTitle', { name: initialName })
    : t('teamGroups.form.createTitle');

  return (
    <>
      <div className={styles.overlay} onClick={handleClose}>
        <div
          ref={modalRef}
          className={styles.modal}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-form-title"
        >
          <div className={styles.header}>
            <div className={styles['header-content']}>
              <div className={styles['icon-wrapper']}>
                <UsersIcon size={24} />
              </div>
              <h2 id="group-form-title" className={styles.title}>
                {title}
              </h2>
              <p className={styles.subtitle}>{t('teamGroups.form.subtitle')}</p>
            </div>
            <button
              className={styles['close-button']}
              onClick={handleClose}
              aria-label={t('teamGroups.form.close')}
              type="button"
            >
              <XIcon size={18} />
            </button>
          </div>

          <form className={styles.body} onSubmit={handleSubmit} noValidate>
            <div className={styles['form-group']}>
              <label htmlFor="group-name" className={styles['form-label']}>
                {t('teamGroups.form.name')}
                <span className={styles.required}>*</span>
              </label>
              <div className={styles['input-wrapper']}>
                <input
                  ref={nameInputRef}
                  id="group-name"
                  name="groupName"
                  type="text"
                  className={styles['form-input']}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setIsDirty(true);
                    if (errors.name && event.target.value.trim()) {
                      setErrors((previous) => ({ ...previous, name: undefined }));
                    }
                  }}
                  placeholder={t('teamGroups.form.namePlaceholder')}
                  aria-invalid={!!errors.name}
                  aria-describedby={
                    errors.name ? 'group-name-error group-name-counter' : 'group-name-counter'
                  }
                  disabled={isSubmitting}
                  autoComplete="off"
                  maxLength={NAME_MAX_LENGTH}
                />
                <span
                  id="group-name-counter"
                  className={`${styles['char-counter']} ${nameCounterClass}`}
                  aria-live="polite"
                >
                  {name.length} / {NAME_MAX_LENGTH}
                </span>
              </div>
              {errors.name && (
                <span id="group-name-error" className={styles['form-error']} role="alert">
                  {errors.name}
                </span>
              )}
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="group-description" className={styles['form-label']}>
                {t('teamGroups.form.description')}
                <span className={styles['optional-badge']}>{t('teamGroups.form.optional')}</span>
              </label>
              <div className={styles['input-wrapper']}>
                <textarea
                  id="group-description"
                  name="groupDescription"
                  className={styles['form-textarea']}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setIsDirty(true);
                    if (errors.description) {
                      setErrors((previous) => ({ ...previous, description: undefined }));
                    }
                  }}
                  placeholder={t('teamGroups.form.descriptionPlaceholder')}
                  rows={3}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  aria-invalid={!!errors.description}
                  aria-describedby={
                    errors.description
                      ? 'group-description-error group-description-counter'
                      : 'group-description-counter'
                  }
                  disabled={isSubmitting}
                />
                <span
                  id="group-description-counter"
                  className={`${styles['char-counter']} ${descriptionCounterClass}`}
                  aria-live="polite"
                >
                  {description.length} / {DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              {errors.description && (
                <span id="group-description-error" className={styles['form-error']} role="alert">
                  {errors.description}
                </span>
              )}
            </div>

            {errorMessage && (
              <p className={styles['form-server-error']} role="alert">
                <AlertTriangleIcon size={16} />
                {errorMessage}
              </p>
            )}

            <div className={styles.footer}>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t('teamGroups.form.cancel')}
              </Button>
              {/*
                Kept enabled until the request starts rather than disabled while the name is empty:
                an empty name then gets the reason inline, where the field is, instead of a button
                that silently refuses to do anything.
              */}
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {/* The icon marks the write, and steps aside while the Spinner in `Button` shows the
                    write is in flight, so the button never carries two icons at once. */}
                {isEdit && !isSubmitting && (
                  <SaveIcon size={16} className={styles['save-icon']} aria-hidden="true" />
                )}
                {isEdit ? t('teamGroups.form.save') : t('teamGroups.form.create')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <UnsavedChangesModal
        isOpen={showUnsavedChanges}
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />
    </>
  );
};

export default GroupFormModal;
