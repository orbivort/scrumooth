// The team-level cross-functionality signal, as a read-only summary.
//
// The 2020 Scrum Guide defines the Scrum Team as cross-functional -- *"collectively they have all
// the skills necessary to create value each Sprint"* -- so whether a team can actually produce an
// Increment has to be inspectable, not asserted. This component is that inspection, and it is one
// component rather than two on purpose: the composition signal shown beside the member list on the
// Team page and the one on the facilitation page are the same signal, and two renderings of it
// would eventually disagree about what the team covers.
//
// It is deliberately read-only. Recording is the Scrum Master's act and lives where the assessment
// is written; this component points there instead of offering a second editor.
//
// It renders in the `agreements` namespace because that is the feature the copy belongs to
// (cross-functionality is a facilitation record), and it is the namespace that already carries the
// translated strings for it.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type {
  SkillCoverage,
  CrossFunctionalityAssessment,
  SkillCoverageSummary,
} from '@scrumooth/shared';

import type { CrossFunctionalityRecord } from '../../services/domain/crossFunctionality.service';

import styles from './CrossFunctionalitySummary.module.css';

/** How one coverage level is toned, so "not covered" never reads like "covered". */
const COVERAGE_CLASS: Record<SkillCoverage, string> = {
  NONE: 'coverage-none',
  PARTIAL: 'coverage-partial',
  COVERED: 'coverage-covered',
};

const COVERAGE_LABEL_KEY = {
  NONE: 'crossFunctionality.none',
  PARTIAL: 'crossFunctionality.partial',
  COVERED: 'crossFunctionality.covered',
} as const satisfies Record<SkillCoverage, string>;

const EMPTY_COVERAGE: SkillCoverageSummary = { total: 0, covered: 0, partial: 0, gaps: 0 };

interface CrossFunctionalitySummaryProps {
  /** The team's assessments, newest first, or null while they are still being read. */
  record: CrossFunctionalityRecord | null;
  /**
   * Where the assessment is recorded, when the surface showing the summary is not that place.
   * Omitted, the summary simply reports what is known.
   */
  recordHref?: string;
  /**
   * Whether the summary supplies its own heading. The facilitation page already titles the panel,
   * so it does not; a surface that shows the signal on its own does.
   */
  showHeading?: boolean;
  className?: string;
}

export const CrossFunctionalitySummary: React.FC<CrossFunctionalitySummaryProps> = ({
  record,
  recordHref,
  showHeading = false,
  className,
}) => {
  const { t } = useTranslation('agreements');

  const assessment: CrossFunctionalityAssessment | null = record?.latest ?? null;
  const coverage: SkillCoverageSummary = assessment?.coverage ?? EMPTY_COVERAGE;

  return (
    <div className={className ? `${styles.summary} ${className}` : styles.summary}>
      {showHeading && <h3 className={styles['heading']}>{t('crossFunctionality.title')}</h3>}

      {assessment ? (
        <>
          <p className={styles['coverage-summary']}>
            {t('crossFunctionality.summary', {
              covered: coverage.covered,
              partial: coverage.partial,
              gaps: coverage.gaps,
            })}
          </p>
          <p className={styles.muted}>
            {t('crossFunctionality.assessedAt')}: {assessment.assessedAt.slice(0, 10)} ·{' '}
            {t('crossFunctionality.assessedBy')}: {assessment.createdByName ?? '—'}
          </p>
          {assessment.summary && <p className={styles.muted}>{assessment.summary}</p>}

          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('crossFunctionality.need')}</th>
                <th scope="col">{t('crossFunctionality.coverage')}</th>
                <th scope="col">{t('crossFunctionality.note')}</th>
              </tr>
            </thead>
            <tbody>
              {assessment.skills.map((skill) => (
                <tr key={skill.id}>
                  <td>{skill.name}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[COVERAGE_CLASS[skill.coverage]]}`}>
                      {t(COVERAGE_LABEL_KEY[skill.coverage])}
                    </span>
                  </td>
                  <td>{skill.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {record && record.history.length > 0 && (
            <>
              <h3 className={styles['section-title']}>{t('crossFunctionality.history')}</h3>
              <ul className={styles['history-list']}>
                {record.history.map((entry) => (
                  <li key={entry.id} className={styles['history-item']}>
                    <span>{entry.assessedAt.slice(0, 10)}</span>
                    <span>
                      {t('crossFunctionality.summary', {
                        covered: entry.coverage.covered,
                        partial: entry.coverage.partial,
                        gaps: entry.coverage.gaps,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className={styles.muted}>{t('crossFunctionality.empty')}</p>
      )}

      {recordHref && (
        <p className={styles.muted}>
          <Link to={recordHref} className={styles.link}>
            {t('crossFunctionality.openFacilitation')}
          </Link>
        </p>
      )}
    </div>
  );
};

export default CrossFunctionalitySummary;
