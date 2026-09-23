import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiService } from '../../../services';
import { definitionService } from '../../../services/domain/definition.service';
import { queryKeys } from '../../../hooks/queryKeys';
import type { DodReflection, DodReflectionDecision, SprintRetrospective } from '../../../types';
import {
  AlertTriangleIcon,
  CheckIcon,
  FileCheckIcon,
  InfoIcon,
  PlusIcon,
  RefreshIcon,
  RemoveIcon,
} from '../../../components/common/Icons';

import styles from './DodInspection.module.css';

interface ReflectionRow {
  /** The Definition of Done item, or null when the team proposes a new criterion. */
  dodItemId: string | null;
  description: string;
  decision: DodReflectionDecision;
  proposedDescription: string;
  note: string;
}

interface DodInspectionProps {
  retrospective: SprintRetrospective;
  /** A completed Retrospective's record is not rewritten: the event is over. */
  readOnly: boolean;
}

const DECISIONS: DodReflectionDecision[] = ['KEEP', 'CHANGE', 'RETIRE'];

const DECISION_ICON: Record<DodReflectionDecision, React.ReactNode> = {
  KEEP: <CheckIcon size={14} />,
  CHANGE: <RefreshIcon size={14} />,
  RETIRE: <RemoveIcon size={14} />,
};

const toRows = (reflections: DodReflection[] | null | undefined): ReflectionRow[] =>
  (reflections ?? []).map((reflection) => ({
    dodItemId: reflection.dodItemId,
    description: reflection.description,
    decision: reflection.decision,
    proposedDescription: reflection.proposedDescription ?? '',
    note: reflection.note ?? '',
  }));

const toPayload = (rows: ReflectionRow[]): DodReflection[] =>
  rows.map((row, index) => ({
    dodItemId: row.dodItemId,
    description: row.description.trim(),
    decision: row.decision,
    proposedDescription: row.proposedDescription.trim() ? row.proposedDescription.trim() : null,
    note: row.note.trim() ? row.note.trim() : null,
    order: index,
  }));

/**
 * The Definition of Done inspection.
 *
 * "The Scrum Team inspects ... individuals, interactions, processes, tools, and their Definition of
 * Done." The DoD is the one thing the Guide names that a free-text Retrospective column cannot
 * carry: it has to be *read*, decided on criterion by criterion, and then it has to be able to
 * change. The reflection is recorded even when the team changes nothing, so "we inspected our
 * Definition of Done and kept it" is as visible as "we retired a criterion".
 */
export const DodInspection: React.FC<DodInspectionProps> = ({ retrospective, readOnly }) => {
  const { t } = useTranslation('retrospective');
  const queryClient = useQueryClient();
  const teamId = retrospective.teamId;

  const { data: dodData, isLoading: isLoadingDod } = useQuery({
    queryKey: queryKeys.definitionOfDone.byTeam(teamId),
    queryFn: () => definitionService.getDefinitionOfDone(teamId),
    enabled: !!teamId,
  });

  const dodItems = useMemo(
    () => (dodData?.data?.items ?? []).filter((item) => item.isActive),
    [dodData]
  );
  const dodVersion = dodData?.data?.version ?? null;

  const [rows, setRows] = useState<ReflectionRow[]>(() => toRows(retrospective.dodReflections));
  const [notes, setNotes] = useState(retrospective.dodEvolutionNotes ?? '');
  const [newCriterion, setNewCriterion] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Until the team records its own reflection, the inspection starts from the Definition of Done
  // as it stands: the first thing the event does is put the criteria in front of the team.
  useEffect(() => {
    if (retrospective.dodReflections && retrospective.dodReflections.length > 0) {
      setRows(toRows(retrospective.dodReflections));
      return;
    }
    setRows(
      dodItems.map((item) => ({
        dodItemId: item.id,
        description: item.description,
        decision: 'KEEP' as DodReflectionDecision,
        proposedDescription: '',
        note: '',
      }))
    );
    // Re-seeding on every DoD refetch would discard decisions the team has not saved yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retrospective.id, retrospective.dodReflections, dodItems.length]);

  useEffect(() => {
    setNotes(retrospective.dodEvolutionNotes ?? '');
  }, [retrospective.id, retrospective.dodEvolutionNotes]);

  const persisted = useMemo(
    () => JSON.stringify(toPayload(toRows(retrospective.dodReflections))),
    [retrospective.dodReflections]
  );
  const current = useMemo(() => JSON.stringify(toPayload(rows)), [rows]);

  const isDirty =
    current !== persisted || notes.trim() !== (retrospective.dodEvolutionNotes ?? '').trim();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.retrospective.bySprint(retrospective.sprintId),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfDone.byTeam(teamId) });
  }, [queryClient, retrospective.sprintId, teamId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiService.updateRetrospective(retrospective.id, {
        dodReflections: toPayload(rows),
        dodEvolutionNotes: notes.trim(),
      }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => {
      setActionError(t('dodInspection.saveFailed') as string);
    },
  });

  // Applying is one act from the team's point of view, but two writes underneath: the reflection
  // must be persisted before it can be applied, and the apply endpoint deliberately takes no body
  // so a client cannot substitute a different change set for the one the team agreed.
  const applyMutation = useMutation({
    mutationFn: async () => {
      await apiService.updateRetrospective(retrospective.id, {
        dodReflections: toPayload(rows),
        dodEvolutionNotes: notes.trim(),
      });
      return apiService.applyDodChanges(retrospective.id);
    },
    onSuccess: () => {
      setActionError(null);
      setShowDiff(false);
      invalidate();
    },
    onError: () => {
      setShowDiff(false);
      setActionError(t('dodInspection.applyFailed') as string);
    },
  });

  const setDecision = useCallback((index: number, decision: DodReflectionDecision) => {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, decision } : row))
    );
  }, []);

  const setRowField = useCallback(
    (index: number, field: 'proposedDescription' | 'note', value: string) => {
      setRows((prev) =>
        prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
      );
    },
    []
  );

  const handleAddCriterion = useCallback(() => {
    const description = newCriterion.trim();
    if (!description) {
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        dodItemId: null,
        description,
        decision: 'KEEP',
        proposedDescription: '',
        note: '',
      },
    ]);
    setNewCriterion('');
  }, [newCriterion]);

  const handleRemoveRow = useCallback((index: number) => {
    setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }, []);

  const retired = rows.filter((row) => row.decision === 'RETIRE' && row.dodItemId);
  const changed = rows.filter((row) => row.decision === 'CHANGE');
  const added = rows.filter((row) => row.dodItemId === null);
  const kept = rows.filter((row) => row.decision === 'KEEP');
  const hasDecisions = rows.length > 0;
  const changeIsIncomplete = changed.some((row) => !row.proposedDescription.trim());

  // The tally is the team's running answer to "what are we about to do to our Definition of Done?"
  // It reads off the decisions already made, so the shape of the change is visible without
  // scrolling the list back.
  const tally = [
    { key: 'keep', label: t('dodInspection.decisions.KEEP') as string, count: kept.length },
    { key: 'change', label: t('dodInspection.decisions.CHANGE') as string, count: changed.length },
    { key: 'retire', label: t('dodInspection.decisions.RETIRE') as string, count: retired.length },
    { key: 'new', label: t('dodInspection.arriving') as string, count: added.length },
  ];

  if (isLoadingDod) {
    return (
      <section className={styles.section} aria-label={t('dodInspection.title') as string}>
        <p className={styles['loading-text']}>{t('dodInspection.loading') as string}</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-label={t('dodInspection.title') as string}>
      <header className={styles['section-header']}>
        <div className={styles['title-wrap']}>
          <span className={styles['section-icon']} aria-hidden="true">
            <FileCheckIcon size={20} />
          </span>
          <div className={styles['title-text']}>
            <h3 className={styles['section-title']}>{t('dodInspection.title') as string}</h3>
            <p className={styles['section-subtitle']}>{t('dodInspection.subtitle') as string}</p>
          </div>
        </div>
        <div className={styles['header-chips']}>
          {dodVersion !== null && (
            <span className={styles['version-chip']}>
              {t('dodInspection.currentVersion', { version: dodVersion }) as string}
            </span>
          )}
          {retrospective.dodVersionAtPush != null && (
            <span className={styles['evidence-chip']} role="status" aria-live="polite">
              <CheckIcon size={12} aria-hidden="true" />
              {
                t('dodInspection.adoptedVersion', {
                  version: retrospective.dodVersionAtPush,
                }) as string
              }
            </span>
          )}
        </div>
      </header>

      {hasDecisions && (
        <ul className={styles.tally}>
          {tally.map((item) => (
            <li
              key={item.key}
              className={styles['tally-item']}
              data-tally={item.key}
              data-empty={item.count === 0}
            >
              <span className={styles['tally-count']}>{item.count}</span>
              <span className={styles['tally-label']}>{item.label}</span>
            </li>
          ))}
        </ul>
      )}

      {!hasDecisions && (
        <div className={styles['empty-state']}>
          <InfoIcon size={16} aria-hidden="true" />
          <span>{t('dodInspection.noCriteria') as string}</span>
        </div>
      )}

      <ul className={styles['criteria-list']}>
        {rows.map((row, index) => (
          <li
            key={`${row.dodItemId ?? 'new'}-${index}`}
            className={`${styles['criterion-row']} ${
              row.decision === 'RETIRE' ? styles['criterion-row-retired'] : ''
            }`}
            data-decision={row.decision}
          >
            <div className={styles['criterion-row-main']}>
              <p className={styles['criterion-text']}>{row.description}</p>

              {!readOnly && (
                <div
                  className={styles['decision-group']}
                  role="radiogroup"
                  aria-label={
                    t('dodInspection.decisionLabel', { criterion: row.description }) as string
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                      return;
                    }
                    event.preventDefault();
                    const currentIndex = DECISIONS.indexOf(row.decision);
                    const offset = event.key === 'ArrowRight' ? 1 : -1;
                    const nextIndex = (currentIndex + offset + DECISIONS.length) % DECISIONS.length;
                    const next = DECISIONS[nextIndex];
                    if (next) {
                      setDecision(index, next);
                    }
                  }}
                >
                  {DECISIONS.map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      role="radio"
                      aria-checked={row.decision === decision}
                      tabIndex={row.decision === decision ? 0 : -1}
                      className={`${styles['decision-option']} ${
                        row.decision === decision
                          ? (styles[`decision-${decision.toLowerCase()}`] ?? '')
                          : ''
                      }`}
                      onClick={() => setDecision(index, decision)}
                    >
                      {DECISION_ICON[decision]}
                      {t(`dodInspection.decisions.${decision}`) as string}
                    </button>
                  ))}
                </div>
              )}

              {readOnly && (
                <span className={styles['readonly-decision']}>
                  {t(`dodInspection.decisions.${row.decision}`) as string}
                </span>
              )}
            </div>

            {(row.decision === 'CHANGE' || row.decision === 'RETIRE') && !readOnly && (
              <div className={styles['decision-detail']}>
                {row.decision === 'CHANGE' && (
                  <label className={styles['field']}>
                    <span className={styles['field-label']}>
                      {t('dodInspection.proposedLabel') as string} <span aria-hidden="true">*</span>
                    </span>
                    <input
                      className={styles['text-input']}
                      value={row.proposedDescription}
                      onChange={(event) =>
                        setRowField(index, 'proposedDescription', event.target.value)
                      }
                      maxLength={500}
                      aria-required="true"
                      aria-invalid={!row.proposedDescription.trim()}
                      placeholder={t('dodInspection.proposedPlaceholder') as string}
                    />
                  </label>
                )}
                <label className={styles['field']}>
                  <span className={styles['field-label']}>
                    {t('dodInspection.noteLabel') as string}
                  </span>
                  <input
                    className={styles['text-input']}
                    value={row.note}
                    onChange={(event) => setRowField(index, 'note', event.target.value)}
                    maxLength={1000}
                    placeholder={t('dodInspection.notePlaceholder') as string}
                  />
                </label>
              </div>
            )}

            {!readOnly && row.dodItemId === null && (
              <button
                type="button"
                className={styles['remove-row-button']}
                onClick={() => handleRemoveRow(index)}
              >
                {t('dodInspection.discardProposal') as string}
              </button>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className={styles['ghost-row']}>
          <input
            className={styles['text-input']}
            value={newCriterion}
            onChange={(event) => setNewCriterion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddCriterion();
              }
            }}
            maxLength={500}
            placeholder={t('dodInspection.addCriterionPlaceholder') as string}
            aria-label={t('dodInspection.addCriterionPlaceholder') as string}
          />
          <button
            type="button"
            className={styles['add-criterion-button']}
            onClick={handleAddCriterion}
            disabled={!newCriterion.trim()}
          >
            <PlusIcon size={14} /> {t('dodInspection.addCriterion') as string}
          </button>
        </div>
      )}

      <footer className={styles['section-footer']}>
        <label className={styles['field']}>
          <span className={styles['field-label']}>{t('dodInspection.notesLabel') as string}</span>
          <textarea
            className={styles['notes-textarea']}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={3}
            disabled={readOnly}
            placeholder={t('dodInspection.notesPlaceholder') as string}
          />
        </label>

        {actionError && (
          <div className={styles['action-error']} role="alert">
            <AlertTriangleIcon size={14} aria-hidden="true" />
            {actionError}
          </div>
        )}

        {!readOnly && (
          <div className={styles['footer-actions']}>
            <button
              type="button"
              className={styles['save-button']}
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending || applyMutation.isPending}
            >
              {saveMutation.isPending
                ? (t('dodInspection.saving') as string)
                : (t('dodInspection.saveReflection') as string)}
            </button>
            <button
              type="button"
              className={styles['apply-button']}
              onClick={() => setShowDiff(true)}
              disabled={
                !hasDecisions ||
                changeIsIncomplete ||
                applyMutation.isPending ||
                saveMutation.isPending
              }
              title={
                changeIsIncomplete ? (t('dodInspection.changeIncomplete') as string) : undefined
              }
            >
              {applyMutation.isPending
                ? (t('dodInspection.applying') as string)
                : (t('dodInspection.applyChanges') as string)}
            </button>
          </div>
        )}
      </footer>

      {showDiff && (
        <div
          className={styles['modal-overlay']}
          role="dialog"
          aria-modal="true"
          aria-label={t('dodInspection.confirmTitle') as string}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setShowDiff(false);
            }
          }}
        >
          <div className={styles.modal}>
            <h3 className={styles['modal-title']}>{t('dodInspection.confirmTitle') as string}</h3>
            <p className={styles['modal-subtitle']}>
              {
                t('dodInspection.confirmSubtitle', {
                  from: dodVersion ?? 0,
                  to: (dodVersion ?? 0) + 1,
                }) as string
              }
            </p>

            <div className={styles['diff-grid']}>
              {(retired.length > 0 || added.length > 0) && (
                <div className={styles['diff-columns']}>
                  <div className={styles['diff-column']}>
                    <span className={styles['diff-column-title']}>
                      {t('dodInspection.retiring') as string}
                    </span>
                    {retired.length === 0 ? (
                      <span className={styles['diff-none']}>
                        {t('dodInspection.none') as string}
                      </span>
                    ) : (
                      retired.map((row) => (
                        <span
                          key={`retire-${row.dodItemId}`}
                          className={`${styles['diff-row']} ${styles['diff-row-retired']}`}
                        >
                          {row.description}
                        </span>
                      ))
                    )}
                  </div>
                  <div className={styles['diff-column']}>
                    <span className={styles['diff-column-title']}>
                      {t('dodInspection.arriving') as string}
                    </span>
                    {added.length === 0 ? (
                      <span className={styles['diff-none']}>
                        {t('dodInspection.none') as string}
                      </span>
                    ) : (
                      added.map((row) => (
                        <span
                          key={`add-${row.description}`}
                          className={`${styles['diff-row']} ${styles['diff-row-added']}`}
                        >
                          {row.description}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {changed.length > 0 && (
                <div className={styles['diff-changes']}>
                  <span className={styles['diff-column-title']}>
                    {t('dodInspection.rewording') as string}
                  </span>
                  {changed.map((row) => (
                    <div key={`change-${row.dodItemId}`} className={styles['diff-change']}>
                      <span className={styles['diff-row-retired']}>{row.description}</span>
                      <span aria-hidden="true">→</span>
                      <span className={styles['diff-row-added']}>{row.proposedDescription}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles['modal-actions']}>
              <button
                type="button"
                className={styles['apply-button']}
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending
                  ? (t('dodInspection.applying') as string)
                  : (t('dodInspection.confirmApply') as string)}
              </button>
              <button
                type="button"
                className={styles['save-button']}
                onClick={() => setShowDiff(false)}
                disabled={applyMutation.isPending}
              >
                {t('dodInspection.cancel') as string}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default DodInspection;
