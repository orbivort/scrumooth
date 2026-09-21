import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { type ApiResponse, type ProductBacklogItem, type TeamMember } from '../../types';
import { useModalFocus } from '../../hooks/useModalFocus';
import { UnsavedChangesModal } from '../../components/common/Form/UnsavedChangesModal';
import {
  XIcon,
  PlusIcon,
  MessageSquareIcon,
  AlertTriangleIcon,
  InfoIcon,
} from '../../components/common/Icons';

import styles from './AddFeedbackModal.module.css';

type FeedbackCategory = 'positive' | 'negative' | 'suggestion' | 'question';

interface FeedbackFormData {
  authorName: string;
  content: string;
  category: FeedbackCategory;
  actionRequired: boolean;
  relatedPbiId?: string;
  ownerId?: string;
  productGoalAssessment?: string;
}

interface AddFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  teamMembers?: TeamMember[];
  sprintBacklogItems?: ApiResponse<ProductBacklogItem[]>;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  feedbackForm: FeedbackFormData;
  setFeedbackForm: React.Dispatch<React.SetStateAction<FeedbackFormData>>;
  isPending: boolean;
}

export const AddFeedbackModal: React.FC<AddFeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  teamMembers,
  sprintBacklogItems,
  formErrors,
  setFormErrors,
  feedbackForm,
  setFeedbackForm,
  isPending,
}) => {
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const { t } = useTranslation('sprint-review');

  const hasUnsavedChanges = useCallback(() => {
    return (
      feedbackForm.authorName.trim() !== '' ||
      feedbackForm.content.trim() !== '' ||
      !!(feedbackForm.relatedPbiId && feedbackForm.relatedPbiId.trim() !== '') ||
      feedbackForm.actionRequired ||
      !!(feedbackForm.ownerId && feedbackForm.ownerId.trim() !== '') ||
      feedbackForm.category !== 'positive'
    );
  }, [feedbackForm]);

  const handleCloseAttempt = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowUnsavedChangesModal(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedChangesModal(false);
    onClose();
  }, [onClose]);

  const handleCancelDiscard = useCallback(() => {
    setShowUnsavedChangesModal(false);
  }, []);

  const modalFocus = useModalFocus({
    isOpen,
    onClose: handleCloseAttempt,
  });

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={modalFocus.modalRef}
        className={styles['feedback-form-overlay']}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-form-title"
        onClick={handleCloseAttempt}
      >
        <div className={styles['feedback-form']} onClick={(e) => e.stopPropagation()}>
          <header className={styles['feedback-form-header']}>
            <div className={styles['feedback-form-header-content']}>
              <div className={styles['feedback-form-icon-wrapper']} aria-hidden="true">
                <MessageSquareIcon size={24} />
              </div>
              <h2 id="feedback-form-title" className={styles['feedback-form-title']}>
                {t('addFeedbackModal.title')}
              </h2>
              <p className={styles['feedback-form-subtitle']}>{t('addFeedbackModal.subtitle')}</p>
            </div>
            <button
              className={styles['feedback-form-close']}
              onClick={() => {
                handleCloseAttempt();
                setFormErrors({});
              }}
              aria-label={t('addFeedbackModal.cancel')}
              type="button"
            >
              <XIcon size={24} />
            </button>
          </header>

          <div className={styles['feedback-form-body']}>
            <div className={styles['feedback-form-legend']}>
              <InfoIcon size={14} />
              <span>{t('addFeedbackModal.requiredFieldsNote')}</span>
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="feedback-author">
                {t('addFeedbackModal.authorName')}{' '}
                <span className={styles['required-asterisk']}>*</span>
              </label>
              <div className={styles['input-with-counter']}>
                <input
                  id="feedback-author"
                  type="text"
                  value={feedbackForm.authorName}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, authorName: e.target.value })}
                  placeholder={t('addFeedbackModal.authorNamePlaceholder')}
                  className={formErrors.authorName ? styles.error : ''}
                  aria-required="true"
                  aria-invalid={!!formErrors.authorName}
                  aria-describedby={formErrors.authorName ? 'feedback-author-error' : undefined}
                  maxLength={100}
                />
                <span
                  className={`${styles['char-counter']} ${
                    feedbackForm.authorName.length > 80 ? styles['char-counter-warning'] : ''
                  }`}
                >
                  {feedbackForm.authorName.length}/100
                </span>
              </div>
              {formErrors.authorName && (
                <span id="feedback-author-error" className={styles['error-message']} role="alert">
                  {formErrors.authorName}
                </span>
              )}
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="feedback-category">{t('addFeedbackModal.category')}</label>
              <div className={styles['category-select-wrapper']}>
                <span
                  className={`${styles['category-indicator']} ${styles[feedbackForm.category]}`}
                  aria-hidden="true"
                />
                <select
                  id="feedback-category"
                  value={feedbackForm.category}
                  onChange={(e) =>
                    setFeedbackForm({
                      ...feedbackForm,
                      category: e.target.value as FeedbackCategory,
                    })
                  }
                  className={styles['category-select']}
                >
                  <option value="positive">{t('addFeedbackModal.categoryOptions.positive')}</option>
                  <option value="negative">{t('addFeedbackModal.categoryOptions.negative')}</option>
                  <option value="suggestion">
                    {t('addFeedbackModal.categoryOptions.suggestion')}
                  </option>
                  <option value="question">{t('addFeedbackModal.categoryOptions.question')}</option>
                </select>
              </div>
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="feedback-content">
                {t('addFeedbackModal.feedback')}{' '}
                <span className={styles['required-asterisk']}>*</span>
              </label>
              <div className={styles['input-with-counter']}>
                <textarea
                  id="feedback-content"
                  value={feedbackForm.content}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, content: e.target.value })}
                  placeholder={t('addFeedbackModal.feedbackPlaceholder')}
                  rows={4}
                  className={formErrors.content ? styles.error : ''}
                  aria-required="true"
                  aria-invalid={!!formErrors.content}
                  aria-describedby={formErrors.content ? 'feedback-content-error' : undefined}
                  maxLength={1000}
                />
                <span
                  className={`${styles['char-counter']} ${
                    feedbackForm.content.length > 800 ? styles['char-counter-warning'] : ''
                  } ${feedbackForm.content.length > 950 ? styles['char-counter-error'] : ''}`}
                >
                  {feedbackForm.content.length}/1000
                </span>
              </div>
              {formErrors.content && (
                <span id="feedback-content-error" className={styles['error-message']} role="alert">
                  {formErrors.content}
                </span>
              )}
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="feedback-pbi">{t('addFeedbackModal.relatedPbi')}</label>
              <select
                id="feedback-pbi"
                value={feedbackForm.relatedPbiId ?? ''}
                onChange={(e) =>
                  setFeedbackForm({
                    ...feedbackForm,
                    relatedPbiId: e.target.value,
                  })
                }
              >
                <option value="">{t('addFeedbackModal.none')}</option>
                {sprintBacklogItems?.data?.map((pbi: ProductBacklogItem) => (
                  <option key={pbi.id} value={pbi.id}>
                    {pbi.title}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles['form-group']}>
              <label htmlFor="feedback-product-goal-assessment">
                {t('addFeedbackModal.productGoalAssessment')}
              </label>
              <textarea
                id="feedback-product-goal-assessment"
                value={feedbackForm.productGoalAssessment ?? ''}
                onChange={(e) =>
                  setFeedbackForm({
                    ...feedbackForm,
                    productGoalAssessment: e.target.value,
                  })
                }
                placeholder={t('addFeedbackModal.productGoalAssessmentPlaceholder')}
                rows={3}
                maxLength={2000}
                className={formErrors.productGoalAssessment ? styles.error : ''}
                aria-invalid={!!formErrors.productGoalAssessment}
                aria-describedby={
                  formErrors.productGoalAssessment ? 'feedback-product-goal-error' : undefined
                }
              />
              {formErrors.productGoalAssessment && (
                <span
                  id="feedback-product-goal-error"
                  className={styles['error-message']}
                  role="alert"
                >
                  {formErrors.productGoalAssessment}
                </span>
              )}
            </div>

            <div className={styles['form-group']}>
              <div
                className={`${styles['action-required-toggle']} ${
                  feedbackForm.actionRequired ? styles.active : ''
                }`}
                onClick={() =>
                  setFeedbackForm({
                    ...feedbackForm,
                    actionRequired: !feedbackForm.actionRequired,
                    ownerId: feedbackForm.actionRequired ? undefined : feedbackForm.ownerId,
                  })
                }
                role="checkbox"
                aria-checked={feedbackForm.actionRequired}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setFeedbackForm({
                      ...feedbackForm,
                      actionRequired: !feedbackForm.actionRequired,
                      ownerId: feedbackForm.actionRequired ? undefined : feedbackForm.ownerId,
                    });
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={feedbackForm.actionRequired}
                  onChange={(e) =>
                    setFeedbackForm({ ...feedbackForm, actionRequired: e.target.checked })
                  }
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <span className={styles['action-required-label']}>
                  <AlertTriangleIcon size={24} className={styles['action-required-icon']} />
                  {t('addFeedbackModal.actionRequired')}
                </span>
              </div>
            </div>

            {feedbackForm.actionRequired && (
              <div className={styles['form-group']}>
                <label htmlFor="feedback-owner" className={styles['required-label']}>
                  {t('addFeedbackModal.owner')}{' '}
                  <span className={styles['required-asterisk']}>*</span>
                </label>
                <select
                  id="feedback-owner"
                  value={feedbackForm.ownerId ?? ''}
                  onChange={(e) =>
                    setFeedbackForm({
                      ...feedbackForm,
                      ownerId: e.target.value,
                    })
                  }
                  className={formErrors.ownerId ? styles.error : ''}
                  aria-required="true"
                  aria-invalid={!!formErrors.ownerId}
                  aria-describedby={formErrors.ownerId ? 'feedback-owner-error' : undefined}
                >
                  <option value="">{t('addFeedbackModal.ownerPlaceholder')}</option>
                  {teamMembers?.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user
                        ? `${member.user.firstName} ${member.user.lastName}`
                        : member.userId}
                    </option>
                  ))}
                </select>
                {formErrors.ownerId && (
                  <span id="feedback-owner-error" className={styles['error-message']} role="alert">
                    {formErrors.ownerId}
                  </span>
                )}
              </div>
            )}
          </div>

          <footer className={styles['feedback-form-footer']}>
            <button
              className={`${styles.button} ${styles['button-secondary']}`}
              onClick={() => {
                handleCloseAttempt();
                setFormErrors({});
              }}
              type="button"
            >
              {t('addFeedbackModal.cancel')}
            </button>
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={onSubmit}
              disabled={isPending}
              type="button"
            >
              {isPending ? (
                t('addFeedbackModal.adding')
              ) : (
                <>
                  <PlusIcon size={24} /> {t('addFeedbackModal.addFeedback')}
                </>
              )}
            </button>
          </footer>
        </div>
      </div>

      <UnsavedChangesModal
        isOpen={showUnsavedChangesModal}
        onConfirm={handleDiscardChanges}
        onCancel={handleCancelDiscard}
        title={t('addFeedbackModal.unsavedTitle')}
        message={t('addFeedbackModal.unsavedMessage')}
      />
    </>
  );
};
