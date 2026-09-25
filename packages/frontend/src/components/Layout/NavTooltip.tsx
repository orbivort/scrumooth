// Nav Tooltip Component

import React from 'react';
import { createPortal } from 'react-dom';

import styles from './NavTooltip.module.css';

/**
 * The geometry of the row the tooltip describes, in viewport coordinates. Only the numbers travel:
 * the anchor element may be re-rendered or unmounted while the tooltip is open, so holding a live
 * reference would let the card point at a row that no longer exists.
 */
export interface NavTooltipAnchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface NavTooltipProps {
  /** The destination's own name, read from the same key the row would have drawn. */
  label: string;
  /** The section the destination sits in, when it sits in one. */
  sectionLabel?: string;
  anchor: NavTooltipAnchor;
}

/**
 * The label a collapsed rail cannot draw.
 *
 * It renders through a portal rather than as a child of the row because the navigation container
 * scrolls (`overflow: hidden auto`), which would clip a nested card horizontally -- and because a
 * `title` attribute, the cheaper alternative, is mouse-only, delayed and unstyled, so it cannot
 * serve the keyboard path that makes the collapsed rail usable at all.
 *
 * The card is decoration: the row keeps its own `aria-label`, so the destination is already named
 * for assistive technology and the section beneath it is orientation for the eye.
 */
export const NavTooltip: React.FC<NavTooltipProps> = ({ label, sectionLabel, anchor }) => {
  // Centred on the row's midline and clear of its right edge. These two numbers are the only
  // dynamic values allowed onto the element; every static one lives in the CSS Module.
  const top = anchor.top + anchor.height / 2;
  const left = anchor.left + anchor.width;

  return createPortal(
    <div
      role="tooltip"
      className={styles.tooltip}
      style={{ top: `${top}px`, left: `${left}px` }}
      data-testid="nav-tooltip"
    >
      <span className={styles.label}>{label}</span>
      {sectionLabel && <span className={styles.section}>{sectionLabel}</span>}
    </div>,
    document.body
  );
};
