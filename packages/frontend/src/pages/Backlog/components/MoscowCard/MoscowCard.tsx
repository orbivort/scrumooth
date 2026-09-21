/**
 * MoscowCard Component
 *
 * A draggable card component for displaying product backlog items in the MoSCoW board view.
 * Shows item details including ID, title, status, story points, business value, and labels.
 * Supports both mouse drag-and-drop and keyboard-based priority changes.
 *
 * @module pages/Backlog/components/MoscowCard
 */

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { type ProductBacklogItem, MoSCoWPriority } from '../../../../types';
import { STATUS_CONFIG } from '../../config/status.config';
import { useAnnounce } from '../../../../components/LiveAnnouncer';

import styles from './MoscowCard.module.css';

import { CheckCircleIcon, StoryPointsIcon } from '@/components/common/Icons';

/**
 * Props for the MoscowCard component
 */
export interface MoscowCardProps {
  /** The product backlog item to display */
  item: ProductBacklogItem;
  /** Handler for drag start event */
  onDragStart: (e: React.DragEvent) => void;
  /** Handler for drag end event */
  onDragEnd: () => void;
  /** Handler for card click event */
  onClick: () => void;
  /** Whether this card is currently being dragged */
  isDragging: boolean;
  /** Handler for keyboard-based priority change */
  onMovePriority?: (itemId: string, newPriority: MoSCoWPriority) => void;
  /** Total items count per priority column for announcements */
  itemsCountByPriority?: Record<MoSCoWPriority, number>;
  /**
   * Whether the viewer may order the backlog. Only the Product Owner orders Product Backlog
   * items (Scrum Guide), so for anyone else the move affordances are disabled and explained
   * rather than offered and refused.
   */
  canOrder?: boolean;
  /** The item's position in the backlog order, shown so "what is next" is readable. */
  position?: number;
}

/**
 * Priority order for keyboard navigation
 */
const PRIORITY_ORDER: MoSCoWPriority[] = [
  MoSCoWPriority.MUST_HAVE,
  MoSCoWPriority.SHOULD_HAVE,
  MoSCoWPriority.COULD_HAVE,
  MoSCoWPriority.WONT_HAVE,
];

/**
 * Helper function to get translated status label
 */
const getStatusLabel = (status: string, t: (key: string) => string): string => {
  const statusMap: Record<string, string> = {
    NEW: 'status.new',
    REFINED: 'status.refined',
    READY: 'status.ready',
    IN_PROGRESS: 'status.inProgress',
    DONE: 'status.done',
  };
  return t(statusMap[status] ?? status);
};

/**
 * Helper function to get translated priority label
 */
const getPriorityLabel = (priority: MoSCoWPriority, t: (key: string) => string): string => {
  const priorityMap: Record<MoSCoWPriority, string> = {
    [MoSCoWPriority.MUST_HAVE]: 'moscow.mustHave',
    [MoSCoWPriority.SHOULD_HAVE]: 'moscow.shouldHave',
    [MoSCoWPriority.COULD_HAVE]: 'moscow.couldHave',
    [MoSCoWPriority.WONT_HAVE]: 'moscow.wontHave',
  };
  return t(priorityMap[priority]);
};

/**
 * MoscowCard Component
 *
 * Renders a draggable card displaying a product backlog item with:
 * - Item ID (last 4 characters)
 * - Status badge with color coding
 * - Title (truncated to 2 lines)
 * - Story points estimate
 * - Business value and effort indicators
 * - Labels (up to 2 visible, with overflow indicator)
 * - Keyboard-accessible drag and drop for priority changes
 *
 * @param props - Component props
 * @returns The rendered MoscowCard component
 *
 * @example
 * ```tsx
 * <MoscowCard
 *   item={backlogItem}
 *   onDragStart={(e) => handleDragStart(e, backlogItem)}
 *   onDragEnd={handleDragEnd}
 *   onClick={() => openDetailModal(backlogItem)}
 *   isDragging={draggedItem?.id === backlogItem.id}
 *   onMovePriority={(id, priority) => updatePriority(id, priority)}
 *   itemsCountByPriority={itemsCountByPriority}
 * />
 * ```
 */
export const MoscowCard = memo<MoscowCardProps>(
  ({
    item,
    onDragStart,
    onDragEnd,
    onClick,
    isDragging,
    onMovePriority,
    itemsCountByPriority,
    canOrder = true,
    position,
  }) => {
    const { t } = useTranslation('backlog');
    const statusConfig = STATUS_CONFIG[item.status];
    const announce = useAnnounce();

    // Keyboard drag state
    const [isGrabbed, setIsGrabbed] = useState(false);
    const [targetPriority, setTargetPriority] = useState<MoSCoWPriority | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // Track original priority for cancel functionality
    const originalPriorityRef = useRef<MoSCoWPriority>(item.priority);

    /**
     * Announce message to screen readers
     */
    const announceMessage = useCallback(
      (message: string) => {
        announce(message, 'assertive');
      },
      [announce]
    );

    /**
     * Get current target priority index
     */
    const getCurrentPriorityIndex = useCallback(() => {
      const priority = targetPriority ?? item.priority;
      return PRIORITY_ORDER.indexOf(priority);
    }, [targetPriority, item.priority]);

    /**
     * Handle keyboard grab start
     */
    const handleGrabStart = useCallback(() => {
      if (!canOrder || !onMovePriority) return;

      originalPriorityRef.current = item.priority;
      setIsGrabbed(true);
      setTargetPriority(item.priority);

      const currentPriorityLabel = getPriorityLabel(item.priority, t as (key: string) => string);
      const itemCount = itemsCountByPriority?.[item.priority] ?? 0;

      announceMessage(
        `Backlog item ${item.title} grabbed. Current priority: ${currentPriorityLabel}. ${itemCount} items currently in this column. Use ArrowLeft or ArrowRight to change priority. Escape to cancel, Enter to drop.`
      );
    }, [
      canOrder,
      item.priority,
      item.title,
      itemsCountByPriority,
      onMovePriority,
      announceMessage,
      t,
    ]);

    /**
     * Handle keyboard navigation between priorities
     */
    const handlePriorityChange = useCallback(
      (direction: 'left' | 'right') => {
        if (!isGrabbed || !canOrder || !onMovePriority) return;

        const currentIndex = getCurrentPriorityIndex();
        const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

        // Check bounds
        if (newIndex < 0 || newIndex >= PRIORITY_ORDER.length) {
          return;
        }

        const newPriority = PRIORITY_ORDER[newIndex];
        if (!newPriority) return;
        setTargetPriority(newPriority);

        const newPriorityLabel = getPriorityLabel(newPriority, t as (key: string) => string);
        const itemCount = itemsCountByPriority?.[newPriority] ?? 0;

        announceMessage(
          `Target priority: ${newPriorityLabel}. ${itemCount} items currently in this column.`
        );
      },
      [
        canOrder,
        isGrabbed,
        onMovePriority,
        getCurrentPriorityIndex,
        itemsCountByPriority,
        announceMessage,
        t,
      ]
    );

    /**
     * Handle keyboard drop
     */
    const handleDrop = useCallback(() => {
      if (!isGrabbed || !canOrder || !onMovePriority || !targetPriority) return;

      // If dropping on same priority, just cancel
      if (targetPriority === originalPriorityRef.current) {
        setIsGrabbed(false);
        setTargetPriority(null);
        announceMessage(
          `Drag cancelled. Item remains in ${getPriorityLabel(item.priority, t as (key: string) => string)} priority.`
        );
        return;
      }

      // Execute the priority change
      onMovePriority(item.id, targetPriority);

      const newPriorityLabel = getPriorityLabel(targetPriority, t as (key: string) => string);
      announceMessage(`Item ${item.title} moved to ${newPriorityLabel} priority.`);

      setIsGrabbed(false);
      setTargetPriority(null);
    }, [
      canOrder,
      isGrabbed,
      onMovePriority,
      targetPriority,
      item.id,
      item.title,
      item.priority,
      announceMessage,
      t,
    ]);

    /**
     * Handle keyboard cancel
     */
    const handleCancel = useCallback(() => {
      if (!isGrabbed) return;

      const originalPriorityLabel = getPriorityLabel(
        originalPriorityRef.current,
        t as (key: string) => string
      );
      announceMessage(`Drag cancelled. Item remains in ${originalPriorityLabel} priority.`);

      setIsGrabbed(false);
      setTargetPriority(null);
    }, [isGrabbed, announceMessage, t]);

    /**
     * Handle keydown events
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        switch (e.key) {
          case ' ':
          case 'Enter': {
            e.preventDefault();
            if (isGrabbed) {
              handleDrop();
            } else {
              handleGrabStart();
            }
            break;
          }

          case 'ArrowLeft': {
            e.preventDefault();
            if (isGrabbed) {
              handlePriorityChange('left');
            }
            break;
          }

          case 'ArrowRight': {
            e.preventDefault();
            if (isGrabbed) {
              handlePriorityChange('right');
            }
            break;
          }

          case 'Escape': {
            e.preventDefault();
            if (isGrabbed) {
              handleCancel();
            }
            break;
          }

          default:
            break;
        }
      },
      [isGrabbed, handleDrop, handleGrabStart, handlePriorityChange, handleCancel]
    );

    /**
     * Focus the card when grabbed for visual feedback
     */
    useEffect(() => {
      if (isGrabbed && cardRef.current) {
        cardRef.current.focus();
      }
    }, [isGrabbed]);

    /**
     * Build the aria-label with priority information
     */
    const buildAriaLabel = (): string => {
      const priorityLabel = getPriorityLabel(item.priority, t as (key: string) => string);

      if (isGrabbed && targetPriority) {
        const targetLabel = getPriorityLabel(targetPriority, t as (key: string) => string);
        return t('aria.draggingItem', {
          title: item.title,
          current: priorityLabel,
          target: targetLabel,
        });
      }

      return t('aria.backlogItem', {
        title: item.title,
        priority: priorityLabel,
      });
    };

    /**
     * Build CSS classes for the card
     */
    const buildCardClasses = (): string => {
      const classes = [styles['moscow-card']];

      if (isDragging) {
        classes.push(styles.dragging);
      }

      if (isGrabbed) {
        classes.push(styles.grabbed);
      }

      if (isGrabbed && targetPriority && targetPriority !== item.priority) {
        classes.push(styles['moving-to-target']);
      }

      return classes.join(' ');
    };

    return (
      <div
        ref={cardRef}
        className={buildCardClasses()}
        draggable={canOrder}
        onDragStart={canOrder ? onDragStart : undefined}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listitem"
        aria-grabbed={isGrabbed ? 'true' : 'false'}
        aria-roledescription={canOrder ? 'draggable backlog item' : 'backlog item'}
        aria-label={buildAriaLabel()}
        title={canOrder ? undefined : (t('order.productOwnerOnlyHint') as string)}
        data-priority={item.priority}
        data-target-priority={isGrabbed ? targetPriority : undefined}
        data-order-locked={canOrder ? undefined : 'true'}
      >
        {isGrabbed && (
          <div className={styles['grab-indicator']} aria-hidden="true">
            <CheckCircleIcon width="16" height="16" />
            <span className={styles['grab-indicator-text']}>
              {targetPriority && targetPriority !== item.priority
                ? `Moving to ${getPriorityLabel(targetPriority, t as (key: string) => string)}`
                : 'Use Arrow keys to change priority'}
            </span>
          </div>
        )}

        <div className={styles['moscow-card-header']}>
          <div className={styles['moscow-card-header-left']}>
            {typeof position === 'number' && (
              <span
                className={styles['moscow-card-position']}
                title={t('order.positionLabel', { position })}
                aria-label={t('order.positionLabel', { position })}
              >
                {position}
              </span>
            )}
            <span className={styles['moscow-card-id']}>#{item.id.slice(-4)}</span>
          </div>
          <span
            className={styles['moscow-card-status']}
            style={{
              backgroundColor: statusConfig.bgColor,
              color: statusConfig.color,
            }}
          >
            {getStatusLabel(item.status, t as (key: string) => string)}
          </span>
        </div>

        <h4 className={styles['moscow-card-title']}>{item.title}</h4>

        <div className={styles['moscow-card-meta']}>
          {item.storyPoints && (
            <span className={styles['moscow-card-estimate']}>
              <StoryPointsIcon size={12} storyPoints={item.storyPoints} />
              {item.storyPoints} {t('pts' as never)}
            </span>
          )}
          <div className={styles['moscow-card-ve']}>
            <span className={styles['ve-mini']} title={t('businessValue')}>
              V{item.businessValue ?? 0}
            </span>
            <span className={styles['ve-mini']} title={t('effortStoryPoints')}>
              E{item.storyPoints ?? 0}
            </span>
          </div>
        </div>

        {item.labels.length > 0 && (
          <div className={styles['moscow-card-labels']}>
            {item.labels.slice(0, 2).map((label) => (
              <span key={label} className={styles['moscow-label-tag']}>
                {label}
              </span>
            ))}
            {item.labels.length > 2 && (
              <span className={`${styles['moscow-label-tag']} ${styles.more}`}>
                +{item.labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

MoscowCard.displayName = 'MoscowCard';

export default MoscowCard;
