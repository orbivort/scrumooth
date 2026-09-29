// A block that stays closed until it is asked for: a trigger that reports its own state, and a body
// that is removed from the accessibility tree while it is shut.
//
// It exists because the Definition tab answers the same shape in three places -- a quiet summary row
// that opens onto detail the reader rarely needs -- and the pattern had already been written by hand
// twice. The body is rendered but `hidden` while closed, so a shut disclosure contributes nothing to the
// accessibility tree and nothing to the tab order, which is the difference between hiding detail and
// merely not showing it.
//
// Controlled and uncontrolled use are both supported. A caller that has to open the block for its own
// reason -- a drift notice the team has to see -- supplies `open` and owns the state.
import React, { useCallback, useId, useState } from 'react';

import { ChevronDownIcon } from '../Icons';

import styles from './Disclosure.module.css';

/** The trigger's shape: a full-width summary row, or a quiet pill. */
export type DisclosureVariant = 'row' | 'pill';

/** The row's colour family, which says what the detail is about. */
export type DisclosureTone = 'neutral' | 'primary' | 'warning';

export interface DisclosureProps {
  /**
   * The trigger's content.
   *
   * The trigger is a button, so interactive content -- a link, a nested control -- does not belong
   * here: it would be a control inside a control. Detail that has to be actionable goes in `children`.
   */
  label: React.ReactNode;
  /** The detail. Rendered while open, and hidden from assistive technology while closed. */
  children: React.ReactNode;
  variant?: DisclosureVariant;
  tone?: DisclosureTone;
  /** An optional leading icon, shown before the label on the row variant. */
  icon?: React.ReactNode;
  /** Starts open. Ignored once `open` is supplied. */
  defaultOpen?: boolean;
  /** Open state, when the caller owns it. */
  open?: boolean;
  /** Called with the next state on every activation, in both modes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * The body's id, when something outside has to name it.
   *
   * A test or an existing `aria-controls` reference may already depend on the id, so it can be pinned
   * rather than generated.
   */
  bodyId?: string;
  className?: string;
  /** The body's own classes, for chrome the primitive should not decide. */
  bodyClassName?: string;
}

export function Disclosure({
  label,
  children,
  variant = 'row',
  tone = 'neutral',
  icon,
  defaultOpen = false,
  open,
  onOpenChange,
  bodyId,
  className,
  bodyClassName,
}: DisclosureProps): React.ReactElement {
  const generatedId = useId();
  const resolvedBodyId = bodyId ?? `disclosure-${generatedId}`;

  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = isControlled ? open : uncontrolledOpen;

  const handleToggle = useCallback(() => {
    const next = !isOpen;

    if (!isControlled) {
      setUncontrolledOpen(next);
    }

    onOpenChange?.(next);
  }, [isControlled, isOpen, onOpenChange]);

  const rootClassName = [styles.disclosure, className].filter(Boolean).join(' ');
  const bodyClassNames = [styles.body, bodyClassName].filter(Boolean).join(' ');

  return (
    <div className={rootClassName} data-variant={variant} data-tone={tone}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-controls={resolvedBodyId}
        onClick={handleToggle}
      >
        {variant === 'pill' && (
          <span className={styles['chevron-lead']} aria-hidden="true">
            <ChevronDownIcon size={14} />
          </span>
        )}

        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}

        <span className={styles.label}>{label}</span>

        {variant === 'row' && (
          <span className={styles['chevron-trail']} aria-hidden="true">
            <ChevronDownIcon size={16} />
          </span>
        )}
      </button>

      <div id={resolvedBodyId} className={bodyClassNames} hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
}

export default Disclosure;
