// IncrementUsabilityPanel
// Records and displays the written attestation that an Increment is "in usable condition" —
// the evidence a "usable" label cannot carry by itself. Required before the Increment can be
// verified or delivered, so it is the team's record of what they checked and when.
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { apiService } from '../../services';
import { IncrementStatus } from '../../types';

import styles from './IncrementUsabilityPanel.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

interface IncrementUsabilityPanelProps {
  incrementId: string;
  usabilityVerified?: boolean;
  usabilityEvidence?: string | null;
  usabilityVerifiedAt?: string | null;
  usabilityVerifierName?: string | null;
  /** The Increment status, used to lock attestation once delivered/archived. */
  status?: IncrementStatus;
}

export const IncrementUsabilityPanel: React.FC<IncrementUsabilityPanelProps> = ({
  incrementId,
  usabilityVerified = false,
  usabilityEvidence,
  usabilityVerifiedAt,
  usabilityVerifierName,
  status,
}) => {
  const { t } = useTranslation(['increments', 'common']);
  const { locale } = useI18nStore();
  const queryClient = useQueryClient();
  const [evidence, setEvidence] = useState('');

  // A delivered or archived Increment is immutable: its attestation is part of the record and
  // cannot be added or rewritten after the fact.
  const locked = status === IncrementStatus.DELIVERED || status === IncrementStatus.ARCHIVED;

  const attestMutation = useMutation({
    mutationFn: () => apiService.verifyUsability(incrementId, evidence.trim()),
    onSuccess: () => {
      setEvidence('');
      void queryClient.invalidateQueries({ queryKey: ['increment', incrementId] });
      void queryClient.invalidateQueries({ queryKey: ['increments'] });
    },
  });

  const attestedByLabel =
    usabilityVerified && usabilityVerifiedAt
      ? t('incrementUsability.attestedBy', {
          name: usabilityVerifierName ?? t('incrementUsability.unknownMember'),
          date: formatLocaleDate(usabilityVerifiedAt, locale, 'PPPP'),
        })
      : null;

  return (
    <section className={styles.panel} data-testid="increment-usability-panel">
      <header className={styles.header}>
        <h3 className={styles.title}>{t('incrementUsability.title')}</h3>
        <span
          className={`${styles.badge} ${
            usabilityVerified ? styles.verified : locked ? styles.notRecorded : styles.unverified
          }`}
        >
          {usabilityVerified
            ? t('incrementUsability.attested')
            : locked
              ? t('incrementUsability.notRecorded')
              : t('incrementUsability.notAttested')}
        </span>
      </header>

      <p className={styles.hint}>{t('incrementUsability.rule')}</p>

      {usabilityVerified ? (
        <div className={styles.section}>
          <h4 className={styles['section-title']}>{t('incrementUsability.evidence')}</h4>
          <p className={styles['evidence-text']}>
            {usabilityEvidence ?? t('incrementUsability.noEvidenceText')}
          </p>
          {attestedByLabel && <p className={styles.attribution}>{attestedByLabel}</p>}
        </div>
      ) : locked ? (
        // Delivered before the attestation existed: reported as not recorded rather than as a
        // failure, because inventing evidence for a past delivery would be worse than admitting
        // there is none.
        <p className={styles.empty}>{t('incrementUsability.notRecordedHint')}</p>
      ) : (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (evidence.trim()) {
              attestMutation.mutate();
            }
          }}
        >
          <label className={styles['form-label']} htmlFor="usability-evidence">
            {t('incrementUsability.formLabel')}
          </label>
          <textarea
            id="usability-evidence"
            className={styles.textarea}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder={t('incrementUsability.evidencePlaceholder')}
            maxLength={2000}
            rows={3}
            required
          />
          <button
            type="submit"
            className={styles.submit}
            disabled={attestMutation.isPending || evidence.trim().length === 0}
          >
            {t('incrementUsability.attest')}
          </button>
          {attestMutation.isError && (
            <p className={styles.error} role="alert">
              {t('incrementUsability.attestFailed')}
            </p>
          )}
        </form>
      )}

      {locked && <p className={styles['locked-hint']}>{t('incrementUsability.lockedHint')}</p>}
    </section>
  );
};

export default IncrementUsabilityPanel;
