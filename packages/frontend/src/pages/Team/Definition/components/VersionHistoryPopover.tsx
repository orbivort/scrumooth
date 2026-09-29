// The history behind a version number.
//
// The Definition of Done keeps every superseded version, and the Definition of Ready keeps them too,
// but the interface showed only the number in force: a badge claiming "v3" with no way to see what v1
// and v2 said. An append-only history nobody can read is indistinguishable from no history at all.
//
// The trigger is a real disclosure rather than a tooltip: it reports `aria-expanded`, Escape closes
// it, opening it moves focus into the panel and closing it puts focus back on the trigger. It is not
// modal and does not trap focus -- a reader may want to compare a version against the criteria on the
// page behind it.
//
// Nothing is fetched until the panel is opened, so no page load pays for a history nobody asked for.
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';
import type { DefinitionType } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import { useDefinitionOfDoneHistory, useDefinitionOfReadyHistory } from '../../../../hooks';

import { criterionLabel } from './criterionLabel';
import styles from './VersionHistoryPopover.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { ChevronDownIcon, RefreshCwIcon } from '@/components/common/Icons';

/** One criterion as a version recorded it. Both agreements report the same shape. */
interface VersionedCriterion {
  description: string;
  category: string | null;
  isActive: boolean;
  order: number;
  defaultKey: string | null;
}

/** One version, as either history endpoint reports it. */
interface VersionEntry {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string | null;
  createdByName?: string | null;
  isCurrent: boolean;
  items: VersionedCriterion[];
}

export interface VersionHistoryPopoverProps {
  /** The team whose effective agreement the history belongs to. */
  teamId: string;
  /** Which agreement, so a built-in criterion resolves to the right translation. */
  scope: DefinitionType;
  /** The version in force, shown on the trigger before the history is read. */
  version: number;
}

export const VersionHistoryPopover: React.FC<VersionHistoryPopoverProps> = ({
  teamId,
  scope,
  version,
}) => {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Generated: two badges (Definition of Done and Definition of Ready) live on one page, and a fixed
  // id would make `aria-controls` name whichever the browser found first.
  const panelId = useId();

  const doDHistory = useDefinitionOfDoneHistory(teamId, isOpen && scope === 'DOD');
  const doRHistory = useDefinitionOfReadyHistory(teamId, isOpen && scope === 'DOR');
  const query = scope === 'DOD' ? doDHistory : doRHistory;

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);

    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // Escape closes and hands focus back. Bound to the document rather than to the panel, because the
  // reader may have tabbed out of the panel while it stayed open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
      }
    };

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null;

      if (target && !panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, close]);

  const handleToggle = (): void => {
    if (isOpen) {
      close(true);
      return;
    }

    setIsOpen(true);
  };

  // The panel takes focus on open so the history is announced rather than left for the reader to
  // discover, and so the next Tab continues inside it.
  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen]);

  const versions: VersionEntry[] = query.data?.success && query.data.data ? query.data.data : [];

  const renderBody = (): React.ReactElement => {
    if (query.isLoading) {
      return <LoadingState variant="spinner" size="sm" label={t('definitionHistory.loading')} />;
    }

    if (query.isError || (query.isFetched && !query.data?.success)) {
      return (
        <div className={styles.error}>
          <p className={styles['error-text']}>{t('definitionHistory.error')}</p>
          <button
            type="button"
            className={styles['error-retry']}
            onClick={() => void query.refetch()}
          >
            <RefreshCwIcon size={14} />
            {t('definitionHistory.retry')}
          </button>
        </div>
      );
    }

    if (versions.length === 0) {
      return <p className={styles.empty}>{t('definitionHistory.empty')}</p>;
    }

    return (
      <ol className={styles.list}>
        {versions.map((entry) => {
          const activeItems = entry.items
            .filter((item) => item.isActive)
            .sort((a, b) => a.order - b.order);

          return (
            <li key={entry.id} className={styles.entry} data-current={entry.isCurrent || undefined}>
              <div className={styles['entry-head']}>
                <span className={styles['entry-version']}>
                  {t('definitionHistory.versionLabel', { version: entry.version })}
                </span>
                {entry.isCurrent ? (
                  <span className={styles['entry-current']}>{t('definitionHistory.current')}</span>
                ) : null}
                <span className={styles['entry-date']}>
                  {formatLocaleDate(entry.createdAt, locale)}
                </span>
              </div>

              <p className={styles['entry-author']}>
                {entry.createdByName
                  ? t('definitionHistory.changedBy', { name: entry.createdByName })
                  : t('definitionHistory.authorUnknown')}
              </p>

              {activeItems.length === 0 ? (
                <p className={styles['entry-empty']}>{t('definitionHistory.noActiveCriteria')}</p>
              ) : (
                <ol className={styles['entry-criteria']}>
                  {activeItems.map((item, index) => (
                    // The snapshot's criteria carry no ids: a version is a record, not a set of rows,
                    // so the position within the version is the only identity that exists.
                    <li key={`${entry.id}-${index}`} className={styles['entry-criterion']}>
                      <span className={styles['criterion-number']}>{index + 1}</span>
                      <span>{criterionLabel(t, scope, item)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    );
  };

  return (
    <span className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={handleToggle}
        data-open={isOpen || undefined}
      >
        {t('definitionHistory.versionLabel', { version })}
        <span className={styles['trigger-chevron']} aria-hidden="true">
          <ChevronDownIcon size={12} />
        </span>
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t('definitionHistory.title')}
          tabIndex={-1}
          className={styles.panel}
        >
          <div className={styles['panel-head']}>
            <h3 className={styles['panel-title']}>{t('definitionHistory.title')}</h3>
            <button type="button" className={styles['panel-close']} onClick={() => close(true)}>
              {t('definitionHistory.close')}
            </button>
          </div>
          {renderBody()}
        </div>
      )}
    </span>
  );
};

export default VersionHistoryPopover;
