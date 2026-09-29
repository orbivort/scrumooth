// A refusal the reader can act on.
//
// The callout says three things and stops: what was enforced, which Scrum Guide clause it comes from
// when there is one, and what to do next. The remedy control is supplied by the caller, because only
// the caller knows the context -- re-reviewing a version that changed under the reader's feet is a
// different act from asking a Scrum Master for an edit.
//
// It renders in the section that provoked the refusal rather than in a toast, so the reason stays
// next to what it is about and does not vanish before it has been read.
import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { GateRefusalView } from './useGateRefusal';
import styles from './GateRefusal.module.css';

import { AlertTriangleIcon, CloseIcon } from '@/components/common/Icons';

export interface GateRefusalProps {
  /** The refusal, already resolved by `useGateRefusal`; nothing renders when it is null. */
  view: GateRefusalView | null;
  /** The control that performs the remedy, when the caller has one to offer. */
  action?: React.ReactNode;
  /** Renders a dismiss control when provided. */
  onDismiss?: () => void;
  className?: string;
}

export const GateRefusal: React.FC<GateRefusalProps> = ({
  view,
  action,
  onDismiss,
  className,
}): React.ReactElement | null => {
  const { t } = useTranslation('common');
  // Generated rather than spelled: this callout can appear more than once on a page, and a fixed id
  // would make `aria-labelledby` name whichever one the browser found first.
  const titleId = useId();

  if (!view) {
    return null;
  }

  return (
    <div
      className={`${styles.callout} ${className ?? ''}`}
      role="alert"
      aria-labelledby={titleId}
      data-gate={view.code ?? 'unknown'}
    >
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <AlertTriangleIcon size={18} />
        </span>

        <p id={titleId} className={styles.rule}>
          {view.rule}
        </p>

        {onDismiss && (
          <button
            type="button"
            className={styles.dismiss}
            onClick={onDismiss}
            aria-label={t('gateRefusal.dismiss')}
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      {view.guideClause && (
        <blockquote className={styles.clause}>
          <p className={styles['clause-text']}>{view.guideClause}</p>
          <cite className={styles['clause-source']}>{t('gateRefusal.guideClauseLabel')}</cite>
        </blockquote>
      )}

      {view.recovery && <p className={styles.recovery}>{view.recovery}</p>}

      {action && <div className={styles.actions}>{action}</div>}
    </div>
  );
};

export default GateRefusal;
