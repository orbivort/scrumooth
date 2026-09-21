import React, { memo, useCallback, useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_IMPEDIMENT_PRIORITY, IMPEDIMENT_PRIORITIES } from '@scrumooth/shared';

import type { Impediment, ImpedimentPriority } from '../../../types';

import styles from './ImpedimentList.module.css';

/** Payloads predating the priority field default to Medium, matching the backend default. */
const normalizePriority = (priority: ImpedimentPriority | undefined): ImpedimentPriority =>
  priority && (IMPEDIMENT_PRIORITIES as readonly string[]).includes(priority)
    ? priority
    : DEFAULT_IMPEDIMENT_PRIORITY;

interface ImpedimentListProps {
  impediments: Impediment[];
  emptyMessage: string;
  onImpedimentClick?: (impedimentId: string) => void;
}

const ImpedimentList: React.FC<ImpedimentListProps> = memo(
  ({ impediments, emptyMessage, onImpedimentClick }) => {
    const { t } = useTranslation('dashboard');
    const [focusedIndex, setFocusedIndex] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent, impedimentId: string, index: number) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onImpedimentClick?.(impedimentId);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = index < impediments.length - 1 ? index + 1 : 0;
          setFocusedIndex(nextIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = index > 0 ? index - 1 : impediments.length - 1;
          setFocusedIndex(prevIndex);
        } else if (e.key === 'Home') {
          e.preventDefault();
          setFocusedIndex(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          setFocusedIndex(impediments.length - 1);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (listRef.current) {
            listRef.current.blur();
          }
        }
      },
      [onImpedimentClick, impediments.length]
    );

    useEffect(() => {
      if (listRef.current && onImpedimentClick) {
        const items = listRef.current.querySelectorAll('[role="button"]');
        if (items[focusedIndex]) {
          (items[focusedIndex] as HTMLElement).focus({ preventScroll: true });
        }
      }
    }, [focusedIndex, onImpedimentClick, impediments]);

    if (impediments.length === 0) {
      return (
        <div className={styles['empty-list']} role="status">
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <ul
        ref={listRef}
        className={styles['impediment-list']}
        role="list"
        aria-label={t('impedimentList.ariaLabel')}
        aria-activedescendant={onImpedimentClick ? `impediment-item-${focusedIndex}` : undefined}
      >
        {impediments.map((impediment, index) => (
          <li
            key={impediment.id}
            id={`impediment-item-${index}`}
            className={`${styles['impediment-item']} ${onImpedimentClick ? styles.clickable : ''}`}
            tabIndex={onImpedimentClick && index === focusedIndex ? 0 : -1}
            role={onImpedimentClick ? 'button' : undefined}
            onClick={onImpedimentClick ? () => onImpedimentClick(impediment.id) : undefined}
            onKeyDown={
              onImpedimentClick ? (e) => handleKeyDown(e, impediment.id, index) : undefined
            }
            aria-label={
              onImpedimentClick
                ? t('impedimentList.impedimentAriaLabel', {
                    title: impediment.title,
                    status: t(`impedimentStatus.${impediment.status}`),
                    priority: t(`impedimentPriority.${normalizePriority(impediment.priority)}`),
                  })
                : undefined
            }
          >
            <span className={styles['impediment-status-dot']} aria-hidden="true" />
            <div className={styles['impediment-content']}>
              <span className={styles['impediment-title']}>{impediment.title}</span>
              <span
                className={`${styles['impediment-priority-badge']} ${styles[`priority-${normalizePriority(impediment.priority).toLowerCase()}`] ?? ''}`}
                aria-hidden={onImpedimentClick ? true : undefined}
              >
                {t(`impedimentPriority.${normalizePriority(impediment.priority)}`)}
              </span>
              <span
                className={`${styles['impediment-status-badge']} ${styles[impediment.status.toLowerCase()]}`}
                aria-hidden={onImpedimentClick ? true : undefined}
              >
                {t(`impedimentStatus.${impediment.status}`)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }
);

ImpedimentList.displayName = 'ImpedimentList';

export { ImpedimentList };
export type { ImpedimentListProps };
