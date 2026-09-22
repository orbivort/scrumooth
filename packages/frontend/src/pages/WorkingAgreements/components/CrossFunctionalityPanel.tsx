// The cross-functionality signal.
//
// The Guide defines the Scrum Team as cross-functional -- *"collectively they have all the skills
// necessary to create value each Sprint"* -- and makes the Scrum Master accountable for coaching it.
// Until now the tool could not express the difference between a team that can produce an Increment
// and one that depends on a single person, so this panel is that signal.
//
// The reading half is `CrossFunctionalitySummary`, shared with the Team page: the composition signal
// shown beside the member list and the one shown here are the same signal, and one component keeps
// them from disagreeing about what the team covers. What this panel adds is the recording, which is
// the Scrum Master's act and belongs where the assessment is written.
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SKILL_COVERAGES,
  SkillCoverage,
  type CrossFunctionalityAssessment,
} from '@scrumooth/shared';

import { Button } from '../../../components/common/Button';
import { CrossFunctionalitySummary } from '../../../components/CrossFunctionalitySummary/CrossFunctionalitySummary';
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

      <CrossFunctionalitySummary record={record} />

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
