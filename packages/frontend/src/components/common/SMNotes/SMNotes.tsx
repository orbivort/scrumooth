// SMNotes
// Editable text area for Scrum Master observations and coaching notes on
// Scrum events (Sprint, Sprint Review, Retrospective).
//
// Provides two distinct modes:
//  - View mode: read-only, formatted display of the saved notes with an "Edit" action.
//  - Edit mode: editable textarea with validation, dirty-state tracking and save/cancel.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, normalizeLocale, type SmNotesRevision } from '@scrumooth/shared';

import { Button } from '../Button';
import { ClipboardIcon, ClockIcon, SaveIcon } from '../Icons';

import styles from './SMNotes.module.css';

/** Maximum length for Scrum Master notes. Mirrors the shared DESCRIPTION_MAX limit. */
export const SM_NOTES_MAX_LENGTH = 2000;

interface SMNotesProps {
  /** Current note value. */
  value?: string | null;
  /** Called when the user saves notes. */
  onSave: (notes: string) => Promise<unknown> | void;
  /** Optional placeholder text. Defaults to the scrum-master-dashboard placeholder. */
  placeholder?: string;
  /** Show the editable form even when notes are empty. Defaults to true. */
  alwaysShow?: boolean;
  /** Disable editing and saving. Useful when the surrounding event is finalized. */
  disabled?: boolean;
  /**
   * Loads the notes' revision history, newest first.
   *
   * When provided, a History disclosure appears under the notes; the loader is only called when it
   * is opened (and again after a save), so the trail costs nothing on a page that never asks for it.
   * The endpoint refuses anyone but the team's Scrum Master, which is what makes the history safe
   * to offer from an event page.
   */
  loadHistory?: () => Promise<SmNotesRevision[]>;
}

/** One revision of the notes: who wrote it, when, and what it said. */
const RevisionTimeline: React.FC<{ revisions: SmNotesRevision[] }> = ({ revisions }) => {
  const { t, i18n } = useTranslation(['scrum-master-dashboard', 'common']);
  const locale = normalizeLocale(i18n.language);

  return (
    <ol className={styles['history-list']}>
      {revisions.map((revision) => (
        <li key={revision.id} className={styles['history-item']}>
          <div className={styles['history-meta']}>
            <span className={styles['history-revision']}>
              {t('smNotes.historyRevision', { revision: revision.revision })}
            </span>
            <span className={styles['history-author']}>
              {revision.authorName ?? t('smNotes.historyUnknownAuthor')}
            </span>
            <time className={styles['history-time']} dateTime={revision.createdAt}>
              {formatDateTime(revision.createdAt, locale)}
            </time>
          </div>
          <p className={styles['history-content']}>{revision.content}</p>
        </li>
      ))}
    </ol>
  );
};

export const SMNotes: React.FC<SMNotesProps> = ({
  value = '',
  onSave,
  placeholder,
  alwaysShow = true,
  disabled = false,
  loadHistory,
}) => {
  const { t } = useTranslation(['scrum-master-dashboard', 'common']);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Default to view mode when disabled (e.g. a completed event), otherwise respect alwaysShow.
  const [editing, setEditing] = useState(disabled ? false : alwaysShow);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SmNotesRevision[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // Tracks whether the user has ever saved or explicitly started editing. This prevents the
  // `alwaysShow && !value` auto-show from re-opening the form after a save when the parent has
  // not yet refetched the updated value (e.g. the Retrospective page does not invalidate the
  // query on note save), which would otherwise keep the textarea editable.
  const [hasInteracted, setHasInteracted] = useState(false);

  // Sync the draft whenever the persisted value changes externally (e.g. after a refetch).
  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  /** True when the current draft differs from the persisted value (i.e. unsaved edits). */
  const isDirty = useMemo(() => draft !== (value ?? ''), [draft, value]);

  const validate = useCallback(
    (notes: string): string | null => {
      const trimmed = notes.trim();
      if (!trimmed) {
        return t('smNotes.emptyError');
      }
      if (trimmed.length > SM_NOTES_MAX_LENGTH) {
        return t('smNotes.maxLengthError');
      }
      const htmlTagPattern = /<[^>]*>/g;
      if (htmlTagPattern.test(trimmed)) {
        return t('smNotes.noHtmlTags');
      }
      return null;
    },
    [t]
  );

  const handleChange = useCallback((next: string) => {
    setDraft(next);
    setError(null);
    setSaved(false);
  }, []);

  /** Read the trail, lazily: nothing is fetched until the disclosure is opened. */
  const loadRevisionHistory = useCallback(async () => {
    if (!loadHistory) {
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      setHistory(await loadHistory());
    } catch {
      setHistoryError(t('smNotes.historyLoadError'));
    } finally {
      setHistoryLoading(false);
    }
  }, [loadHistory, t]);

  const toggleHistory = useCallback(() => {
    const next = !historyOpen;
    setHistoryOpen(next);

    if (next) {
      void loadRevisionHistory();
    }
  }, [historyOpen, loadRevisionHistory]);

  const handleSave = useCallback(async () => {
    if (disabled) {
      return;
    }

    const validationError = validate(draft);
    if (validationError) {
      setError(validationError);
      setSaved(false);
      return;
    }

    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setError(null);
      setHasInteracted(true);
      setEditing(false);
      // The save appended a revision, so an open history would otherwise show the version before
      // the one the reader just wrote.
      if (historyOpen) {
        await loadRevisionHistory();
      }
    } catch {
      setSaved(false);
      setError(t('smNotes.saveError'));
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, validate, t, disabled, historyOpen, loadRevisionHistory]);

  const startEditing = useCallback(() => {
    setError(null);
    setSaved(false);
    setHasInteracted(true);
    setEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setDraft(value ?? '');
    setError(null);
    setSaved(false);
    setEditing(false);
  }, [value]);

  // Disabled (e.g. completed event) forces read-only view mode: never show the editable form.
  const showForm = !disabled && (editing || (alwaysShow && !value && !hasInteracted));
  const hasError = Boolean(error);
  const saveDisabled = disabled || saving || !isDirty || hasError;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles['title-group']}>
          <h3 className={styles.title}>
            <ClipboardIcon className={styles.icon} />
            {t('smNotes.title')}
          </h3>
          <span
            className={`${styles['mode-badge']} ${showForm ? styles['mode-badge-editing'] : styles['mode-badge-viewing']}`}
            role="status"
            aria-label={showForm ? t('smNotes.modeEditing') : t('smNotes.modeViewing')}
          >
            {showForm ? t('smNotes.modeEditing') : t('smNotes.modeViewing')}
          </span>
        </div>
        {!showForm && !disabled && (
          <Button variant="secondary" size="sm" onClick={startEditing}>
            {t('common:edit')}
          </Button>
        )}
      </div>

      {showForm ? (
        <>
          <textarea
            className={`${styles.textarea} ${hasError ? styles['textarea-error'] : ''}`}
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder ?? t('smNotes.placeholder')}
            rows={4}
            maxLength={SM_NOTES_MAX_LENGTH}
            disabled={disabled}
            readOnly={disabled}
            aria-label={t('smNotes.title')}
            aria-invalid={hasError}
            aria-describedby={hasError ? 'sm-notes-error' : undefined}
          />
          {hasError && (
            <p id="sm-notes-error" className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.footer}>
            <span
              className={`${styles['char-counter']} ${draft.length > SM_NOTES_MAX_LENGTH - 200 ? styles['char-counter-warning'] : ''}`}
              aria-live="polite"
            >
              {t('smNotes.charCounter', { count: draft.length })}
            </span>
            <div className={styles.actions}>
              {!alwaysShow && (
                <Button variant="link" size="sm" onClick={cancelEditing} disabled={saving}>
                  {t('common:cancel')}
                </Button>
              )}
              <Button onClick={() => void handleSave()} loading={saving} disabled={saveDisabled}>
                {!saving && <SaveIcon size={16} className={styles['save-icon']} />}
                {t('common:save')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.view}>
          {saved && (
            <div className={styles.confirmation} role="status" aria-live="polite">
              {t('smNotes.saved')}
            </div>
          )}
          {draft ? (
            <p className={styles.notes}>{draft}</p>
          ) : (
            <p className={styles.empty}>{t('common:noData')}</p>
          )}
        </div>
      )}

      {loadHistory && (
        <div className={styles.history}>
          <Button
            variant="link"
            size="sm"
            onClick={toggleHistory}
            aria-expanded={historyOpen}
            aria-controls="sm-notes-history"
          >
            <ClockIcon size={16} className={styles['history-icon']} />
            {historyOpen ? t('smNotes.historyHide') : t('smNotes.historyShow')}
          </Button>

          {historyOpen && (
            <div id="sm-notes-history" className={styles['history-panel']}>
              {historyLoading && <p className={styles['history-status']}>{t('common:loading')}</p>}
              {historyError && (
                <p className={styles.error} role="alert">
                  {historyError}
                </p>
              )}
              {!historyLoading && !historyError && history?.length === 0 && (
                <p className={styles.empty}>{t('smNotes.historyEmpty')}</p>
              )}
              {history && history.length > 0 && <RevisionTimeline revisions={history} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SMNotes;
