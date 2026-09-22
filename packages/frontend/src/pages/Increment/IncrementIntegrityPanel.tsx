// IncrementIntegrityPanel
// Displays the Increment integration verification status, the list of
// integration tests, a form to add a new test, and the dependency chain.
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { incrementService } from '../../services';
import { IntegrationTestResult, IntegrationVerificationBasis, IncrementStatus } from '../../types';

type TestResultInput = IntegrationTestResult.PASSED | IntegrationTestResult.FAILED;
import styles from './IncrementIntegrityPanel.module.css';

interface IncrementIntegrityPanelProps {
  incrementId: string;
  integrationVerified?: boolean;
  /** What the verification rests on: the first-Increment exemption, or a pass against priors. */
  integrationVerificationBasis?: IntegrationVerificationBasis | null;
  /** How many prior Increments the verification covered. */
  integrationVerifiedPriorCount?: number;
  /** The Increment status, used to lock editing once delivered/archived. */
  status?: IncrementStatus;
}

export const IncrementIntegrityPanel: React.FC<IncrementIntegrityPanelProps> = ({
  incrementId,
  integrationVerified = false,
  integrationVerificationBasis,
  integrationVerifiedPriorCount,
  status,
}) => {
  // Delivered/archived Increments are immutable: integration tests and
  // verification cannot be modified after the Increment is finalized.
  const locked = status === IncrementStatus.DELIVERED || status === IncrementStatus.ARCHIVED;
  const { t } = useTranslation(['increments', 'common']);
  const queryClient = useQueryClient();

  /**
   * Name what a verification actually rests on. "Verified" covers two different facts — the team's
   * first Increment had nothing to test against, and a later one passed against every prior
   * Increment. One identical green badge for both hides that, so the exemption says so and a real
   * verification states how many prior Increments it covered.
   */
  const describeVerification = (
    verified: boolean,
    basis: IntegrationVerificationBasis | null | undefined,
    priorCount: number | undefined
  ): string => {
    if (!verified) {
      return t('incrementIntegrity.notVerified');
    }

    if (basis === IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT) {
      return t('incrementIntegrity.firstIncrementExempt');
    }

    return t('incrementIntegrity.verifiedAgainst', { count: priorCount ?? 0 });
  };

  const [priorIncrementId, setPriorIncrementId] = useState('');
  const [testResult, setTestResult] = useState<TestResultInput>(IntegrationTestResult.PASSED);
  const [notes, setNotes] = useState('');

  const { data: testsData } = useQuery({
    queryKey: ['increment-integration-tests', incrementId],
    queryFn: () => incrementService.getIntegrationTests(incrementId),
    enabled: !!incrementId,
  });

  const { data: chainData } = useQuery({
    queryKey: ['increment-chain', incrementId],
    queryFn: () => incrementService.getIncrementChain(incrementId),
    enabled: !!incrementId,
  });

  const tests = testsData?.data ?? [];

  const chain = useMemo(() => chainData?.data ?? [], [chainData]);

  const priorOptions = useMemo(
    () => chain.filter((c) => c.id !== incrementId && c.status !== 'DRAFT'),
    [chain, incrementId]
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['increment-integration-tests', incrementId] });
    void queryClient.invalidateQueries({ queryKey: ['increment-chain', incrementId] });
    void queryClient.invalidateQueries({ queryKey: ['increment', incrementId] });
  };

  const addTestMutation = useMutation({
    mutationFn: () =>
      incrementService.createIntegrationTest(incrementId, {
        priorIncrementId,
        testResult,
        notes,
      }),
    onSuccess: () => {
      setNotes('');
      setPriorIncrementId('');
      invalidate();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => incrementService.verifyIntegration(incrementId),
    onSuccess: () => invalidate(),
  });

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h3 className={styles.title}>{t('incrementIntegrity.title')}</h3>
        <span
          className={`${styles.badge} ${integrationVerified ? styles.verified : styles.unverified}`}
        >
          {describeVerification(
            integrationVerified,
            integrationVerificationBasis,
            integrationVerifiedPriorCount
          )}
        </span>
      </header>

      {/* Integration tests */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('incrementIntegrity.integrationTests')}</h4>
        {tests.length === 0 ? (
          <p className={styles.empty}>{t('common:noData')}</p>
        ) : (
          <ul className={styles['test-list']}>
            {tests.map((test) => (
              <li key={test.id} className={styles['test-item']}>
                <span
                  className={`${styles['result-tag']} ${
                    test.testResult === 'PASSED'
                      ? styles.pass
                      : test.testResult === 'FAILED'
                        ? styles.fail
                        : styles.pending
                  }`}
                >
                  {test.testResult === 'PASSED'
                    ? t('incrementIntegrity.pass')
                    : test.testResult === 'FAILED'
                      ? t('incrementIntegrity.fail')
                      : t('incrementIntegrity.pending')}
                </span>
                <span className={styles['test-label']}>
                  {t('incrementIntegrity.priorIncrement')}: {test.priorIncrementName ?? '—'}
                </span>
                {test.notes && <span className={styles['test-notes']}>{test.notes}</span>}
              </li>
            ))}
          </ul>
        )}

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (priorIncrementId) addTestMutation.mutate();
          }}
        >
          <select
            value={priorIncrementId}
            onChange={(e) => setPriorIncrementId(e.target.value)}
            required
            disabled={locked}
            aria-label={t('incrementIntegrity.priorIncrement')}
          >
            <option value="">{t('incrementIntegrity.priorIncrement')}...</option>
            {priorOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={testResult}
            onChange={(e) => setTestResult(e.target.value as TestResultInput)}
            disabled={locked}
            aria-label={t('incrementIntegrity.testResult')}
          >
            <option value={IntegrationTestResult.PASSED}>{t('incrementIntegrity.pass')}</option>
            <option value={IntegrationTestResult.FAILED}>{t('incrementIntegrity.fail')}</option>
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('incrementIntegrity.notes')}
            disabled={locked}
            aria-label={t('incrementIntegrity.notes')}
          />
          <button
            type="submit"
            className={styles.submit}
            disabled={locked || !priorIncrementId || addTestMutation.isPending}
          >
            {t('incrementIntegrity.addTest')}
          </button>
        </form>

        {priorOptions.length === 0 && (
          <p className={styles.hint}>{t('incrementIntegrity.firstIncrement')}</p>
        )}

        <button
          type="button"
          className={styles['verify-button']}
          onClick={() => verifyMutation.mutate()}
          disabled={locked || verifyMutation.isPending}
        >
          {t('incrementIntegrity.verifyNow')}
        </button>
        {locked ? (
          <p className={styles['verify-hint']}>{t('incrementIntegrity.lockedHint')}</p>
        ) : (
          <p className={styles['verify-hint']}>{t('incrementIntegrity.verifyHint')}</p>
        )}
      </div>

      {/* Dependency chain */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>{t('incrementIntegrity.chain')}</h4>
        {chain.length === 0 ? (
          <p className={styles.empty}>{t('common:noData')}</p>
        ) : (
          <ol className={styles.chain}>
            {chain.map((node) => (
              <li
                key={node.id}
                className={`${styles['chain-node']} ${node.isCurrent ? styles.current : ''}`}
              >
                <span className={styles['chain-name']}>{node.name}</span>
                <span
                  className={`${styles['chain-status']} ${
                    node.integrationVerified ? styles.pass : styles.fail
                  }`}
                >
                  {describeVerification(
                    node.integrationVerified,
                    node.integrationVerificationBasis,
                    node.integrationVerifiedPriorCount
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export default IncrementIntegrityPanel;
