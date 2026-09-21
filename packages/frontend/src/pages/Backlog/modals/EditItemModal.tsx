import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { MoSCoWPriority } from '../../../types';
import { useBacklogContext } from '../context/BacklogContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { MOSCOW_CONFIG } from '../config/moscow.config';
import { handleMoscowKeyDown } from '../utils/formHandlers';
import { useTeamContext } from '../../../contexts/TeamContext';
import { canOrderBacklog } from '../../../utils/roleUtils';
import { UnsavedChangesModal } from '../../../components/common/Form/UnsavedChangesModal';

import styles from './EditItemModal.module.css';

import {
  EditIcon,
  XIcon,
  AlertIcon,
  XCircleIcon,
  PathIcon,
  CheckIcon,
  SaveIcon,
} from '@/components/common/Icons';

export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const { t } = useTranslation('backlog');

  // Only Developers are responsible for sizing; PO/SM cannot set story points.
  const { userRole } = useTeamContext();
  const isDeveloper = userRole === 'DEVELOPERS';

  // Reclassifying an item reorders the backlog, which is the Product Owner's call (Scrum Guide);
  // the backend refuses it with GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER, so it is not offered here.
  const isProductOwner = canOrderBacklog(userRole);

  const {
    selectedItem,
    formData,
    formErrors,
    workflowError,
    setWorkflowError,
    labelTags,
    labelInputValue,
    hasUnsavedChanges,
    handleFormChange,
    handlePriorityChange,
    handleLabelInputChange,
    handleLabelKeyDown,
    removeLabelTag,
  } = useBacklogContext();

  useFocusTrap(isOpen, modalRef);

  // Define all callbacks before any early returns to follow React Hooks rules
  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleUnsavedConfirm = useCallback(() => {
    setShowUnsavedModal(false);
    onClose();
  }, [onClose]);

  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedModal(false);
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the overlay itself, not the modal content
      if (e.target === e.currentTarget) {
        handleCloseAttempt();
      }
    },
    [handleCloseAttempt]
  );

  // Handle escape key for unsaved changes
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseAttempt();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCloseAttempt]);

  if (!isOpen || !selectedItem) return null;

  const handleMoscowKeyDownWrapper = (e: React.KeyboardEvent, currentIndex: number) => {
    handleMoscowKeyDown(e, currentIndex, handlePriorityChange);
  };

  return (
    <>
      <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
        <div
          ref={modalRef}
          className={`${styles.modal} ${styles['modal-large']}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          <div className={styles['modal-header']}>
            <div className={styles['header-content']}>
              <div className={styles['icon-wrapper']} aria-hidden="true">
                <EditIcon width="28" height="28" />
              </div>
              <h2 id="edit-modal-title" className={styles['modal-title']}>
                {t('editItem.editBacklogItem', { id: selectedItem.id.slice(-4) }) as string}
              </h2>
            </div>
            <button
              className={styles['close-button']}
              onClick={handleCloseAttempt}
              data-modal-close
              aria-label={t('editItem.closeModal') as string}
            >
              <XIcon width="20" height="20" />
            </button>
          </div>
          <div className={styles['modal-body']}>
            {workflowError && (
              <div className={styles['error-banner']}>
                <div className={styles['error-content']}>
                  <span className={styles['error-icon']}>
                    <AlertIcon width="16" height="16" />
                  </span>
                  <span className={styles['error-text']}>{workflowError}</span>
                  <button
                    className={styles['error-close']}
                    onClick={() => setWorkflowError(null)}
                    aria-label={t('editItem.closeError') as string}
                  >
                    <XCircleIcon width="14" height="14" />
                  </button>
                </div>
              </div>
            )}
            <form className={styles['item-form']}>
              <div className={styles['form-legend']}>
                <span className={styles['required-indicator']}>*</span>
                <span className={styles['legend-text']}>
                  <strong>{t('editItem.allFieldsRequired') as string}</strong> -{' '}
                  {t('editItem.allFieldsRequiredDesc') as string}
                </span>
              </div>

              <div className={styles['form-section']}>
                <h3 className={styles['section-title']}>{t('editItem.basicInfo') as string}</h3>

                <div className={styles['form-group']}>
                  <label htmlFor="edit-item-title">
                    {t('editItem.titleLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <input
                    id="edit-item-title"
                    type="text"
                    placeholder={t('editItem.titlePlaceholder') as string}
                    value={formData.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className={formErrors.title ? styles['input-error'] : ''}
                    aria-describedby="edit-title-help edit-title-error"
                    aria-required="true"
                    maxLength={200}
                  />
                  <span id="edit-title-help" className={styles['field-help']}>
                    {t('editItem.titleHelp') as string}
                  </span>
                  {formErrors.title && (
                    <span id="edit-title-error" className={styles['error-message']} role="alert">
                      {formErrors.title}
                    </span>
                  )}
                </div>

                <div className={styles['form-group']}>
                  <label htmlFor="edit-item-description">
                    {t('editItem.descriptionLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <textarea
                    id="edit-item-description"
                    rows={4}
                    placeholder={t('editItem.descriptionPlaceholder') as string}
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    className={formErrors.description ? styles['input-error'] : ''}
                    aria-describedby="edit-description-help edit-description-error"
                    aria-required="true"
                  />
                  <span id="edit-description-help" className={styles['field-help']}>
                    {t('editItem.descriptionHelp') as string}
                  </span>
                  {formErrors.description && (
                    <span
                      id="edit-description-error"
                      className={styles['error-message']}
                      role="alert"
                    >
                      {formErrors.description}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles['form-section']}>
                <h3 className={styles['section-title']}>
                  {t('editItem.priorityAndValue') as string}
                </h3>

                <div className={styles['form-group']}>
                  <label>
                    {t('editItem.moscowLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <div
                    className={styles['moscow-selector']}
                    role="radiogroup"
                    aria-label={t('editItem.selectMoscowPriority') as string}
                    aria-required="true"
                  >
                    {Object.values(MoSCoWPriority).map((priority, index) => {
                      const config = MOSCOW_CONFIG[priority];
                      const isSelected = formData.moscowPriority === priority;
                      return (
                        <button
                          key={priority}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isSelected ? 0 : -1}
                          className={`${styles['moscow-option']} ${isSelected ? styles.selected : ''} ${styles[`priority-${priority.toLowerCase().replace('_', '-')}`]}`}
                          onClick={() => handlePriorityChange(priority)}
                          onKeyDown={(e) => handleMoscowKeyDownWrapper(e, index)}
                          disabled={!isProductOwner}
                          aria-disabled={!isProductOwner}
                          style={
                            {
                              '--option-color': config.color,
                              '--option-bg': config.bgColor,
                              '--option-border': config.borderColor,
                            } as React.CSSProperties
                          }
                        >
                          <span className={styles['moscow-icon']} aria-hidden="true">
                            <PathIcon path={config.icon} size={20} />
                          </span>
                          <span className={styles['moscow-content']}>
                            <span className={styles['moscow-label']}>
                              {t(`moscowLabels.${priority}` as const)}
                            </span>
                            <span className={styles['moscow-desc']}>
                              {t(`moscowDescriptions.${priority}` as const)}
                            </span>
                          </span>
                          {isSelected && (
                            <span className={styles['moscow-check']} aria-hidden="true">
                              <CheckIcon width="16" height="16" strokeWidth="3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span className={styles['field-help']}>{t('editItem.moscowHelp') as string}</span>
                  {!isProductOwner && (
                    <span className={styles['field-help-warning']}>
                      {t('order.priorityProductOwnerOnly') as string}
                    </span>
                  )}
                  {formErrors.moscowPriority && (
                    <span className={styles['error-message']} role="alert">
                      {formErrors.moscowPriority}
                    </span>
                  )}
                </div>

                <div className={styles['form-group']}>
                  <label htmlFor="edit-business-value">
                    {t('editItem.businessValueLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <select
                    id="edit-business-value"
                    value={formData.businessValue ?? ''}
                    onChange={(e) =>
                      handleFormChange(
                        'businessValue',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    className={formErrors.businessValue ? styles['input-error'] : ''}
                    aria-describedby="edit-business-value-help edit-business-value-error"
                    aria-required="true"
                  >
                    <option value="">{t('editItem.businessValuePlaceholder') as string}</option>
                    <option value={1}>{t('editItem.businessValue1') as string}</option>
                    <option value={2}>{t('editItem.businessValue2') as string}</option>
                    <option value={3}>{t('editItem.businessValue3') as string}</option>
                    <option value={5}>{t('editItem.businessValue5') as string}</option>
                    <option value={8}>{t('editItem.businessValue8') as string}</option>
                    <option value={13}>{t('editItem.businessValue13') as string}</option>
                  </select>
                  <span id="edit-business-value-help" className={styles['field-help']}>
                    {t('editItem.businessValueHelp') as string}
                  </span>
                  {formErrors.businessValue && (
                    <span
                      id="edit-business-value-error"
                      className={styles['error-message']}
                      role="alert"
                    >
                      {formErrors.businessValue}
                    </span>
                  )}
                </div>

                <div className={styles['form-group']}>
                  <label htmlFor="edit-estimate">
                    {t('editItem.storyPointsLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <select
                    id="edit-estimate"
                    value={formData.estimate ?? ''}
                    onChange={(e) =>
                      handleFormChange(
                        'estimate',
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    disabled={!isDeveloper}
                    className={formErrors.estimate ? styles['input-error'] : ''}
                    aria-describedby={`edit-estimate-help edit-estimate-error${!isDeveloper ? ' edit-estimate-hint' : ''}`}
                    aria-required="true"
                  >
                    <option value="">{t('editItem.storyPointsPlaceholder') as string}</option>
                    <option value={1}>{t('editItem.effort1') as string}</option>
                    <option value={2}>{t('editItem.effort2') as string}</option>
                    <option value={3}>{t('editItem.effort3') as string}</option>
                    <option value={5}>{t('editItem.effort5') as string}</option>
                    <option value={8}>{t('editItem.effort8') as string}</option>
                    <option value={13}>{t('editItem.effort13') as string}</option>
                  </select>
                  <span id="edit-estimate-help" className={styles['field-help']}>
                    {t('editItem.storyPointsHelp') as string}
                  </span>
                  {!isDeveloper && (
                    <span id="edit-estimate-hint" className={styles['field-help-warning']}>
                      {t('editItem.storyPointsDeveloperOnly') as string}
                    </span>
                  )}
                  {formErrors.estimate && (
                    <span id="edit-estimate-error" className={styles['error-message']} role="alert">
                      {formErrors.estimate}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles['form-section']}>
                <h3 className={styles['section-title']}>
                  {t('editItem.moreInformation') as string}
                </h3>

                <div className={styles['form-group']}>
                  <label htmlFor="edit-item-labels">
                    {t('editItem.labelsLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <div
                    className={`${styles['tag-input-container']} ${formErrors.labels ? styles['input-error'] : ''}`}
                    onClick={() => document.getElementById('edit-item-labels')?.focus()}
                  >
                    {labelTags.map((tag, index) => (
                      <span key={`${tag}-${index}`} className={styles['tag-item']}>
                        {tag}
                        <button
                          type="button"
                          className={styles['tag-remove']}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLabelTag(tag);
                          }}
                          aria-label={t('editItem.removeLabel', { label: tag }) as string}
                        >
                          <XIcon width="12" height="12" />
                        </button>
                      </span>
                    ))}
                    <input
                      id="edit-item-labels"
                      type="text"
                      placeholder={
                        labelTags.length === 0
                          ? (t('editItem.labelsPlaceholderEmpty') as string)
                          : (t('editItem.labelsPlaceholderMore') as string)
                      }
                      value={labelInputValue}
                      onChange={(e) => handleLabelInputChange(e.target.value)}
                      onKeyDown={handleLabelKeyDown}
                      aria-describedby="edit-labels-help edit-labels-error"
                      disabled={labelTags.length >= 10}
                      className={styles['tag-input']}
                    />
                  </div>
                  {labelTags.length >= 10 && (
                    <span className={`${styles['field-help']} ${styles['field-help-warning']}`}>
                      {t('editItem.labelsMaxReached') as string}
                    </span>
                  )}
                  {formErrors.labels && (
                    <span id="edit-labels-error" className={styles['error-message']} role="alert">
                      {formErrors.labels}
                    </span>
                  )}
                  <span id="edit-labels-help" className={styles['field-help']}>
                    {t('editItem.labelsHelp') as string}
                  </span>
                </div>

                <div className={styles['form-group']}>
                  <label htmlFor="edit-acceptance-criteria">
                    {t('editItem.acceptanceCriteriaLabel') as string}{' '}
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <textarea
                    id="edit-acceptance-criteria"
                    rows={4}
                    placeholder={t('editItem.acceptanceCriteriaPlaceholder') as string}
                    value={formData.acceptanceCriteria}
                    onChange={(e) => handleFormChange('acceptanceCriteria', e.target.value)}
                    className={formErrors.acceptanceCriteria ? styles['input-error'] : ''}
                    aria-describedby="edit-criteria-help edit-criteria-error"
                    aria-required="true"
                  />
                  <span id="edit-criteria-help" className={styles['field-help']}>
                    {t('editItem.acceptanceCriteriaHelp') as string}
                  </span>
                  {formErrors.acceptanceCriteria && (
                    <span id="edit-criteria-error" className={styles['error-message']} role="alert">
                      {formErrors.acceptanceCriteria}
                    </span>
                  )}
                </div>
              </div>
            </form>
          </div>
          <div className={styles['modal-footer']}>
            <button
              className={`${styles.button} ${styles['button-secondary']}`}
              onClick={handleCloseAttempt}
              disabled={isSubmitting}
            >
              {t('editItem.cancel') as string}
            </button>
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className={styles['button-spinner']} />
                  {t('editItem.saving') as string}
                </>
              ) : (
                <>
                  <SaveIcon width="18" height="18" aria-hidden="true" />
                  {t('editItem.saveChanges') as string}
                </>
              )}
            </button>
          </div>
        </div>

        {isSubmitting && (
          <div className={styles['loading-overlay']}>
            <div className={styles['loading-content']}>
              <div className={styles['spinner-ring']} />
              <p>{t('editItem.savingChanges') as string}</p>
            </div>
          </div>
        )}
      </div>

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
        title={t('editItem.unsavedTitle') as string}
        message={t('editItem.unsavedMessage') as string}
      />
    </>
  );
};
