import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { apiService } from '../../services';
import { IncrementStatus, DeliveryMethod, type DoDChecklistVerification } from '../../types';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../hooks/queryKeys';
import { LoadingState } from '../../components/common/Loading';
import { ToastContainer } from '../../components/common/ToastContainer';

import { IncrementIntegrityPanel } from './IncrementIntegrityPanel';
import { IncrementUsabilityPanel } from './IncrementUsabilityPanel';
import styles from './IncrementDetail.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  RocketIcon,
  CheckIcon,
  FileTextIcon,
  ClipboardIcon,
  CalendarIcon,
  ZapIcon,
  CloseIcon,
  PackageIcon,
} from '@/components/common/Icons';

// CSS-based loading spinner (not an SVG icon)
const LoadingSpinnerIcon = () => <div className={styles['loading-spinner']} />;

export const IncrementDetail: React.FC = () => {
  const { t } = useTranslation('increments');
  const { locale } = useI18nStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toasts, success, error: showError, removeToast } = useToast();
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    DeliveryMethod.SPRINT_REVIEW
  );
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [confirmDelivery, setConfirmDelivery] = useState(false);

  const { modalRef } = useModalFocus({
    isOpen: showDeliverModal,
    onClose: () => setShowDeliverModal(false),
  });

  const {
    data: incrementData,
    isLoading: isLoadingIncrement,
    isError: isIncrementError,
    error: incrementError,
  } = useQuery({
    queryKey: ['increment', id],
    queryFn: () => apiService.getIncrement(id ?? ''),
    enabled: !!id,
  });

  const increment = incrementData?.data;

  const { data: eligiblePBIsData } = useQuery({
    queryKey: ['eligible-pbis', increment?.sprintId],
    queryFn: () => apiService.getEligiblePBIsForIncrement(increment?.sprintId ?? ''),
    enabled: !!increment?.sprintId,
  });

  const deliverMutation = useMutation({
    mutationFn: () => apiService.deliverIncrement(id ?? '', deliveryMethod, deliveryNotes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.increment.detail(id ?? '') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.increment.all });
      setShowDeliverModal(false);
      success(t('detail.toast.deliveredSuccess'));
    },
    onError: () => {
      showError(t('detail.toast.deliverFailed'));
    },
  });

  const getStatusColor = (status: IncrementStatus) => {
    const colors: Record<IncrementStatus, { bg: string; text: string }> = {
      [IncrementStatus.DRAFT]: { bg: '#F3F4F6', text: '#6B7280' },
      [IncrementStatus.VERIFIED]: { bg: '#DBEAFE', text: '#1E40AF' },
      [IncrementStatus.DELIVERED]: { bg: '#D1FAE5', text: '#065F46' },
      [IncrementStatus.ARCHIVED]: { bg: '#F9FAFB', text: '#9CA3AF' },
    };
    return colors[status];
  };

  const handleDeliver = () => {
    deliverMutation.mutate();
  };

  const handleBack = () => {
    void navigate('/increments');
  };

  const includedPBIs = useMemo(() => {
    if (!increment?.includedPBIs || !eligiblePBIsData?.data) return [];
    return eligiblePBIsData.data.filter((pbi) => increment.includedPBIs.includes(pbi.id));
  }, [increment, eligiblePBIsData]);

  const verificationStats = useMemo(() => {
    if (!increment?.dodVerifications)
      return { total: 0, verified: 0, percentage: 0, byCategory: {}, byPbi: {} };
    const verifications = increment.dodVerifications as DoDChecklistVerification[];
    const total = verifications.length;
    const verified = verifications.filter((v) => v.isVerified).length;
    const percentage = total > 0 ? Math.round((verified / total) * 100) : 0;

    const byCategory: Record<string, { total: number; verified: number }> = {};
    const byPbi: Record<string, { total: number; verified: number; pbiTitle: string }> = {};

    verifications.forEach((v) => {
      const category = v.dodItemCategory ?? 'general';
      byCategory[category] ??= { total: 0, verified: 0 };
      byCategory[category].total++;
      if (v.isVerified) {
        byCategory[category].verified++;
      }

      const pbiId = v.pbiId;
      if (!byPbi[pbiId]) {
        const pbi = includedPBIs.find((p) => p.id === pbiId);
        byPbi[pbiId] = { total: 0, verified: 0, pbiTitle: pbi?.title ?? 'Unknown PBI' };
      }
      byPbi[pbiId].total++;
      if (v.isVerified) {
        byPbi[pbiId].verified++;
      }
    });

    return { total, verified, percentage, byCategory, byPbi };
  }, [increment, includedPBIs]);

  if (isLoadingIncrement) {
    return (
      <div className={styles['increment-loading']}>
        <LoadingSpinnerIcon />
        <p>{t('detail.loading')}</p>
      </div>
    );
  }

  if (isIncrementError || !increment) {
    return (
      <div className={styles['increment-loading']}>
        <AlertCircleIcon className={styles['error-icon']} />
        <p>{t('detail.error.title')}</p>
        <p className={styles['error-details']}>
          {incrementError instanceof Error ? incrementError.message : 'Unknown error'}
        </p>
        <button
          className={`${styles.button} ${styles['button-primary']}`}
          onClick={() => navigate('/increments')}
          style={{ marginTop: '16px' }}
        >
          {t('detail.error.backToIncrements')}
        </button>
      </div>
    );
  }

  const statusColor = getStatusColor(increment.status);
  // Delivery is offered for DRAFT and VERIFIED increments, and requires two things the backend
  // enforces: integration with every prior Increment must have passed, and the Increment's usable
  // condition must be attested in writing. The button is shown disabled with the specific reason
  // until both hold, so the deliver action states why it is unavailable instead of failing.
  const canDeliver =
    increment.status === IncrementStatus.VERIFIED || increment.status === IncrementStatus.DRAFT;
  const deliverBlockedReason = !increment.integrationVerified
    ? 'detail.deliverRequiresIntegration'
    : !increment.usabilityVerified
      ? 'detail.deliverRequiresUsability'
      : undefined;

  return (
    <div className={styles['increment-detail-page']} data-testid="increment-detail">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className={styles['detail-header']}>
        <button className={styles['back-button']} onClick={handleBack}>
          <ArrowLeftIcon />
          <span>{t('backToIncrements')}</span>
        </button>
        <div className={styles['header-content']}>
          <div className={styles['header-left']}>
            <h1 className={styles['page-title']}>
              <span className={styles['page-title-icon']}>
                <PackageIcon size={28} aria-hidden="true" />
              </span>
              {increment.name}
            </h1>
            <span
              className={styles['status-badge']}
              style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
            >
              {increment.status}
            </span>
          </div>
          {canDeliver && (
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={() => setShowDeliverModal(true)}
              disabled={deliverBlockedReason !== undefined}
              data-disabled-reason={deliverBlockedReason}
              title={deliverBlockedReason ? t(deliverBlockedReason) : undefined}
            >
              <RocketIcon size={16} />
              <span>{t('detail.deliverIncrement')}</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles['detail-grid']}>
        <div className={styles['left-column']}>
          <div className={styles['detail-card']}>
            <h3>{t('detail.overview.title')}</h3>
            <div className={styles['info-grid']}>
              <div className={styles['info-item']}>
                <span className={styles.label}>{t('detail.overview.description')}</span>
                <span className={styles.value}>
                  {increment.description ?? t('detail.overview.noDescription')}
                </span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles.label}>{t('detail.overview.sprint')}</span>
                <span className={styles.value}>{increment.sprint?.name ?? increment.sprintId}</span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles.label}>{t('detail.overview.created')}</span>
                <span className={styles.value}>
                  {formatLocaleDate(increment.createdAt, locale, 'PPPP')}
                </span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles.label}>{t('detail.overview.storyPoints')}</span>
                <span className={styles.value}>{increment.totalStoryPoints || 0}</span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles.label}>{t('detail.overview.pbisIncluded')}</span>
                <span className={styles.value}>{increment.includedPBIs.length || 0}</span>
              </div>
              {increment.deliveredAt && (
                <div className={styles['info-item']}>
                  <span className={styles.label}>{t('detail.overview.delivered')}</span>
                  <span className={styles.value}>
                    {formatLocaleDate(increment.deliveredAt, locale, 'PPPP')}
                  </span>
                </div>
              )}
              {increment.deliveryMethod && (
                <div className={styles['info-item']}>
                  <span className={styles.label}>{t('detail.overview.deliveryMethod')}</span>
                  <span className={styles.value}>
                    {increment.deliveryMethod.toLowerCase() ===
                    DeliveryMethod.SPRINT_REVIEW.toLowerCase()
                      ? t('deliveryMethod.sprintReview')
                      : t('deliveryMethod.earlyRelease')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles['detail-card']}>
            <h3>{t('detail.pbis.title')}</h3>
            {includedPBIs.length === 0 ? (
              <p className={styles['empty-message']}>{t('detail.pbis.empty')}</p>
            ) : (
              <div className={styles['pbi-list']}>
                {includedPBIs.map((pbi) => (
                  <div key={pbi.id} className={styles['pbi-item']}>
                    <div className={styles['pbi-header']}>
                      <span className={styles['pbi-title']}>{pbi.title}</span>
                      <span className={styles['pbi-points']}>
                        {pbi.storyPoints ?? 0} {t('pts')}
                      </span>
                    </div>
                    {pbi.labels.length > 0 && (
                      <div className={styles['pbi-labels']}>
                        {pbi.labels.map((label) => (
                          <span key={label} className={styles['label-tag']}>
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles['right-column']}>
          <div className={styles['detail-card']}>
            <h3>{t('detail.dodVerification.title')}</h3>
            <div className={styles['verification-summary']}>
              <div className={styles['progress-circle']}>
                {/* eslint-disable-next-line icon-rules/no-inline-svg -- Progress ring visualization, not an icon */}
                <svg viewBox="0 0 36 36">
                  <path
                    className={styles['circle-bg']}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={styles['circle-progress']}
                    strokeDasharray={`${verificationStats.percentage}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className={styles['progress-text']}>{verificationStats.percentage}%</span>
              </div>
              <div className={styles['verification-stats']}>
                <div className={styles['stat-row']}>
                  <span className={styles['stat-label']}>
                    {t('detail.dodVerification.totalVerifications')}
                  </span>
                  <span className={styles['stat-value']}>{verificationStats.total}</span>
                </div>
                <div className={styles['stat-row']}>
                  <span className={styles['stat-label']}>
                    {t('detail.dodVerification.verified')}
                  </span>
                  <span className={`${styles['stat-value']} ${styles.verified}`}>
                    {verificationStats.verified}
                  </span>
                </div>
              </div>
            </div>

            {verificationStats.total > 0 && (
              <>
                <div className={styles['verification-breakdown']}>
                  <h4>{t('detail.dodVerification.byCategory')}</h4>
                  <div className={styles['category-breakdown']}>
                    {Object.entries(verificationStats.byCategory).map(([category, stats]) => (
                      <div key={category} className={styles['category-item']}>
                        <div className={styles['category-header']}>
                          <span className={styles['category-name']}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </span>
                          <span className={styles['category-count']}>
                            {stats.verified}/{stats.total}
                          </span>
                        </div>
                        <div className={styles['category-progress']}>
                          <div
                            className={styles['category-progress-fill']}
                            style={{
                              width: `${stats.total > 0 ? (stats.verified / stats.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles['verification-breakdown']}>
                  <h4>{t('detail.dodVerification.byPbi')}</h4>
                  <div className={styles['pbi-breakdown']}>
                    {Object.entries(verificationStats.byPbi).map(([pbiId, stats]) => (
                      <div key={pbiId} className={styles['pbi-verification-item']}>
                        <div className={styles['pbi-verification-header']}>
                          <span className={styles['pbi-verification-title']}>{stats.pbiTitle}</span>
                          <span className={styles['pbi-verification-count']}>
                            {stats.verified}/{stats.total}
                          </span>
                        </div>
                        <div className={styles['pbi-verification-progress']}>
                          <div
                            className={styles['pbi-verification-progress-fill']}
                            style={{
                              width: `${stats.total > 0 ? (stats.verified / stats.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {verificationStats.total === 0 && (
              <div className={styles['no-verifications']}>
                <span className={styles['no-verification-icon']}>
                  <ClipboardIcon size={48} strokeWidth={1.5} />
                </span>
                <p>{t('detail.dodVerification.noVerifications')}</p>
                <p className={styles['no-verification-hint']}>
                  {t('detail.dodVerification.noVerificationsHint')}
                </p>
              </div>
            )}
          </div>

          <div className={styles['detail-card']}>
            <h3>{t('detail.timeline.title')}</h3>
            <div className={styles.timeline}>
              <div className={styles['timeline-item']}>
                <div className={`${styles['timeline-icon']} ${styles.created}`}>
                  <FileTextIcon size={20} />
                </div>
                <div className={styles['timeline-content']}>
                  <span className={styles['timeline-label']}>
                    {t('detail.timeline.incrementCreated')}
                  </span>
                  <span className={styles['timeline-date']}>
                    {formatLocaleDate(increment.createdAt, locale, 'PPPP')}
                  </span>
                </div>
              </div>
              {increment.deliveredAt && (
                <div className={styles['timeline-item']}>
                  <div className={`${styles['timeline-icon']} ${styles.delivered}`}>
                    <RocketIcon size={20} />
                  </div>
                  <div className={styles['timeline-content']}>
                    <span className={styles['timeline-label']}>
                      {increment.deliveryMethod?.toLowerCase() ===
                      DeliveryMethod.SPRINT_REVIEW.toLowerCase()
                        ? t('detail.timeline.deliveredViaSprintReview')
                        : t('detail.timeline.deliveredViaEarlyRelease')}
                    </span>
                    <span className={styles['timeline-date']}>
                      {formatLocaleDate(increment.deliveredAt, locale, 'PPPP')}
                    </span>
                    {increment.deliverer && (
                      <span className={styles['timeline-date']}>
                        {t('detail.timeline.deliveredBy', {
                          name: `${increment.deliverer.firstName} ${increment.deliverer.lastName}`,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <IncrementUsabilityPanel
            incrementId={increment.id}
            usabilityVerified={increment.usabilityVerified}
            usabilityEvidence={increment.usabilityEvidence}
            usabilityVerifiedAt={increment.usabilityVerifiedAt}
            usabilityVerifierName={
              increment.usabilityVerifier
                ? `${increment.usabilityVerifier.firstName} ${increment.usabilityVerifier.lastName}`
                : null
            }
            status={increment.status}
          />

          <IncrementIntegrityPanel
            incrementId={increment.id}
            integrationVerified={increment.integrationVerified}
            integrationVerificationBasis={increment.integrationVerificationBasis}
            integrationVerifiedPriorCount={increment.integrationVerifiedPriorCount}
            status={increment.status}
          />
        </div>
      </div>

      {showDeliverModal && (
        <div
          className={styles['modal-overlay']}
          onClick={() => setShowDeliverModal(false)}
          role="presentation"
        >
          <div
            ref={modalRef}
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deliver-modal-title"
            aria-describedby="deliver-modal-description"
          >
            <div className={styles['modal-header']}>
              <h3 id="deliver-modal-title">
                <RocketIcon size={20} />
                <span>{t('detail.deliverModal.title')}</span>
              </h3>
              <button
                className={styles['close-button']}
                onClick={() => setShowDeliverModal(false)}
                aria-label={t('detail.deliverModal.closeDialog')}
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className={styles['modal-content']}>
              <p id="deliver-modal-description" className={styles['modal-description']}>
                {t('detail.deliverModal.modalDescription')}
              </p>

              <div className={styles['form-group']}>
                <label>{t('detail.deliverModal.deliveryMethodLabel')}</label>
                <div className={styles['delivery-options']}>
                  <label
                    className={`${styles['radio-option']} ${deliveryMethod === DeliveryMethod.SPRINT_REVIEW ? styles.selected : ''}`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value={DeliveryMethod.SPRINT_REVIEW}
                      checked={deliveryMethod === DeliveryMethod.SPRINT_REVIEW}
                      onChange={() => setDeliveryMethod(DeliveryMethod.SPRINT_REVIEW)}
                    />
                    <div className={styles['option-content']}>
                      <span className={styles['option-icon']}>
                        <CalendarIcon size={24} />
                      </span>
                      <span className={styles['option-label']}>
                        {t('detail.deliverModal.sprintReviewOption')}
                      </span>
                      <span className={styles['option-desc']}>
                        {t('detail.deliverModal.sprintReviewDescription')}
                      </span>
                    </div>
                  </label>
                  <label
                    className={`${styles['radio-option']} ${deliveryMethod === DeliveryMethod.EARLY_RELEASE ? styles.selected : ''}`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value={DeliveryMethod.EARLY_RELEASE}
                      checked={deliveryMethod === DeliveryMethod.EARLY_RELEASE}
                      onChange={() => setDeliveryMethod(DeliveryMethod.EARLY_RELEASE)}
                    />
                    <div className={styles['option-content']}>
                      <span className={styles['option-icon']}>
                        <ZapIcon size={24} />
                      </span>
                      <span className={styles['option-label']}>
                        {t('detail.deliverModal.earlyReleaseOption')}
                      </span>
                      <span className={styles['option-desc']}>
                        {t('detail.deliverModal.earlyReleaseDescription')}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles['form-group']}>
                <label>{t('detail.deliverModal.notesLabel')}</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder={t('detail.deliverModal.notesPlaceholder')}
                  rows={3}
                />
              </div>

              <div className={styles['form-group']}>
                <label className={styles['checkbox-label']}>
                  <input
                    type="checkbox"
                    checked={confirmDelivery}
                    onChange={(e) => setConfirmDelivery(e.target.checked)}
                    aria-label={t('detail.deliverModal.confirmDeliveryAriaLabel')}
                  />
                  <span className={styles['checkbox-text']}>
                    {t('detail.deliverModal.checkboxText')}
                  </span>
                </label>
              </div>
            </div>
            <div className={styles['modal-actions']}>
              <button
                className={`${styles.button} ${styles['button-secondary']}`}
                onClick={() => {
                  setShowDeliverModal(false);
                  setConfirmDelivery(false);
                }}
              >
                {t('detail.deliverModal.cancel')}
              </button>
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={handleDeliver}
                disabled={deliverMutation.isPending || !confirmDelivery}
                data-disabled-reason={
                  !confirmDelivery ? 'Please confirm the delivery checkbox' : undefined
                }
              >
                {deliverMutation.isPending ? (
                  <>
                    <LoadingState
                      variant="spinner"
                      size="sm"
                      label={t('detail.deliverModal.delivering')}
                    />
                    <span>{t('detail.deliverModal.delivering')}</span>
                  </>
                ) : (
                  <>
                    <CheckIcon size={16} />
                    <span>{t('detail.deliverModal.confirm')}</span>
                  </>
                )}
              </button>
            </div>
            {deliverMutation.isError && (
              <div className={styles['modal-error']}>{t('detail.toast.deliverFailed')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
