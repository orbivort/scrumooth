// The cross-functionality signal.
//
// The Guide defines the Scrum Team as cross-functional -- *"collectively they have all the skills
// necessary to create value each Sprint"* -- and makes the Scrum Master accountable for coaching it.
// Until now the tool could not express the difference between a team that can produce an Increment
// and one that depends on a single person, so this panel is that signal: the skills the team needs,
// how far the team covers each one, and the gaps the Scrum Master coaches toward.
//
// It is a team-level assessment, never a per-person inventory: recording who can do what would turn
// a composition signal into an appraisal of individuals.
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SKILL_COVERAGES,
  SkillCoverage,
  type CrossFunctionalityAssessment,
  type SkillCoverageSummary,
} from '@scrumooth/shared';

import { Button } from '../../../components/common/Button';
import type { CrossFunctionalityRecord } from '../../../services/domain/crossFunctionality.service';
import type { CrossFunctionalityAssessmentValues } from '../WorkingAgreements';
import styles from '../WorkingAgreements.module.css';

interface CrossFunctionalityPanelProps {
  record: CrossFunctionalityRecord | null;
  /** Whether the caller may record an assessment: the team's Scrum Master. */
  canRecord: boolean;
  submitting?: boolean;
  onRecord: (values: CrossFunctionalityAssessmentValues) => void;
}

interface SkillDraft {
  name: string;
  coverage: SkillCoverage;
  note: string;
}

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

export const CrossFunctionalityPanel: React.FC<CrossFunctionalityPanelProps> = ({
  record,
  canRecord,
  submitting = false,
  onRecord,
}) => {
  const { t } = useTranslation(['agreements']);
  const [recording, setRecording] = useState(false);
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState<SkillDraft[]>([
    { name: '', coverage: SkillCoverage.NONE, note: '' },
  ]);
  const [error, setError] = useState<string | null>(null);

  const assessment: CrossFunctionalityAssessment | null = record?.latest ?? null;
  const coverage: SkillCoverageSummary = assessment?.coverage ?? {
    total: 0,
    covered: 0,
    partial: 0,
    gaps: 0,
  };

  const updateSkill = useCallback((index: number, patch: Partial<SkillDraft>) => {
    setSkills((previous) =>
      previous.map((skill, position) => (position === index ? { ...skill, ...patch } : skill))
    );
    setError(null);
  }, []);

  const handleRecord = useCallback(() => {
    const prepared = skills
      .map((skill) => ({ ...skill, name: skill.name.trim(), note: skill.note.trim() }))
      .filter((skill) => skill.name.length > 0);

    if (prepared.length === 0) {
      setError(t('assessmentForm.atLeastOneSkill'));
      return;
    }

    onRecord({
      summary: summary.trim(),
      skills: prepared.map((skill) => ({
        name: skill.name,
        coverage: skill.coverage,
        note: skill.note || null,
      })),
    });
    setRecording(false);
    setSummary('');
    setSkills([{ name: '', coverage: SkillCoverage.NONE, note: '' }]);
  }, [onRecord, skills, summary, t]);

  return (
    <section className={styles.panel} aria-label={t('crossFunctionality.title')}>
      <div className={styles['panel-header']}>
        <h2 className={styles['panel-title']}>{t('crossFunctionality.title')}</h2>
        {canRecord && !recording && (
          <Button variant="secondary" size="sm" onClick={() => setRecording(true)}>
            {t('crossFunctionality.record')}
          </Button>
        )}
      </div>
      <p className={styles.muted}>{t('crossFunctionality.hint')}</p>

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

      {canRecord && !assessment && !recording && (
        <p className={styles.muted}>{t('crossFunctionality.onlyScrumMaster')}</p>
      )}

      {recording && (
        <div className={styles.form}>
          <h3 className={styles['form-title']}>{t('assessmentForm.title')}</h3>

          <label className={styles.field}>
            <span className={styles.label}>{t('assessmentForm.summary')}</span>
            <textarea
              className={styles.textarea}
              value={summary}
              rows={2}
              maxLength={2000}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>

          <ul className={styles.list}>
            {skills.map((skill, index) => (
              <li key={`skill-${index}`} className={styles['skill-row']}>
                <label className={styles.field}>
                  <span className={styles.label}>{t('assessmentForm.skillName')}</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={skill.name}
                    maxLength={120}
                    onChange={(event) => updateSkill(index, { name: event.target.value })}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{t('assessmentForm.skillCoverage')}</span>
                  <select
                    className={styles.select}
                    value={skill.coverage}
                    onChange={(event) =>
                      updateSkill(index, { coverage: event.target.value as SkillCoverage })
                    }
                  >
                    {SKILL_COVERAGES.map((option) => (
                      <option key={option} value={option}>
                        {t(COVERAGE_LABEL_KEY[option])}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{t('assessmentForm.skillNote')}</span>
                  <input
                    className={styles.input}
                    type="text"
                    value={skill.note}
                    maxLength={500}
                    onChange={(event) => updateSkill(index, { note: event.target.value })}
                  />
                </label>
                {skills.length > 1 && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() =>
                      setSkills((previous) => previous.filter((_, position) => position !== index))
                    }
                  >
                    {t('assessmentForm.removeSkill')}
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className={styles['form-actions']}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setSkills((previous) => [
                  ...previous,
                  { name: '', coverage: SkillCoverage.NONE, note: '' },
                ])
              }
            >
              {t('assessmentForm.addSkill')}
            </Button>
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles['form-actions']}>
            <Button variant="link" onClick={() => setRecording(false)} disabled={submitting}>
              {t('assessmentForm.cancel')}
            </Button>
            <Button onClick={handleRecord} loading={submitting}>
              {t('assessmentForm.save')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

export default CrossFunctionalityPanel;
