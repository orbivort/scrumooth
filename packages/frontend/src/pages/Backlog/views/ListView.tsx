/**
 * ListView Component
 *
 * A table-based list view for displaying product backlog items.
 * Provides a compact, scannable view of all items with key attributes, in the team's backlog
 * order of record (the persisted `rank`), so the list reads top-to-bottom as "what is next".
 * A Product Owner can move an item one position with the controls in the position cell.
 * Uses virtual scrolling for performance with large lists (>50 items).
 *
 * @module pages/Backlog/views/ListView
 */

import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { type ProductBacklogItem } from '../../../types';
import { MoscowBadge } from '../components/MoscowBadge';
import { useVirtualScroll, shouldEnableVirtualization } from '../../../hooks/useVirtualScroll';

import styles from './ListView.module.css';

import { ChevronDownIcon, ChevronUpIcon } from '@/components/common/Icons';

/**
 * Props for the ListView component
 */
export interface ListViewProps {
  /** Array of product backlog items to display, in backlog order */
  items: ProductBacklogItem[];
  /** Callback when an item row is clicked */
  onItemClick: (item: ProductBacklogItem) => void;
  /**
   * Callback to move an item one position within the backlog. Ordering is the Product Owner's
   * accountability (Scrum Guide); the caller decides whether to offer it.
   */
  onMove?: (itemId: string, direction: 'up' | 'down') => void;
  /** Whether the viewer may order the backlog (Product Owner only) */
  canOrder?: boolean;
}

/**
 * Estimated height of each table row in pixels
 */
const ROW_ESTIMATE_HEIGHT = 64;

/**
 * Number of items to render outside the visible area for smoother scrolling
 */
const OVERSCAN_COUNT = 5;

/**
 * Threshold for enabling virtual scrolling
 */
const VIRTUALIZATION_THRESHOLD = 50;

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
 * Props for the position cell: the item's place in the backlog plus, for a Product Owner, the
 * one-step move controls.
 */
interface PositionCellProps {
  position: number;
  itemTitle: string;
  isFirst: boolean;
  isLast: boolean;
  canOrder: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * PositionCell Component
 *
 * Shows the item's position and — when the viewer may order the backlog — two controls that move
 * the item one place. Ordering is exposed here as well as on the board so it does not depend on
 * pointer drag alone.
 */
const PositionCell: React.FC<PositionCellProps> = ({
  position,
  itemTitle,
  isFirst,
  isLast,
  canOrder,
  onMoveUp,
  onMoveDown,
}) => {
  const { t } = useTranslation('backlog');

  return (
    <div className={styles['position-cell']}>
      <span
        className={styles['position-value']}
        aria-label={t('order.positionLabel', { position })}
      >
        {position}
      </span>
      {canOrder && (
        <span className={styles['position-actions']}>
          <button
            type="button"
            className={styles['position-button']}
            disabled={isFirst}
            onClick={(e) => {
              // The row itself opens the item, so a move must not also trigger that.
              e.stopPropagation();
              onMoveUp();
            }}
            title={t('order.moveUpLabel')}
            aria-label={t('order.moveUpAria', { title: itemTitle })}
          >
            <ChevronUpIcon size={14} />
          </button>
          <button
            type="button"
            className={styles['position-button']}
            disabled={isLast}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            title={t('order.moveDownLabel')}
            aria-label={t('order.moveDownAria', { title: itemTitle })}
          >
            <ChevronDownIcon size={14} />
          </button>
        </span>
      )}
    </div>
  );
};

/**
 * TableRow Component
 *
 * Renders a single table row for a backlog item (non-virtualized mode).
 */
interface TableRowProps {
  item: ProductBacklogItem;
  index: number;
  total: number;
  canOrder: boolean;
  onItemClick: (item: ProductBacklogItem) => void;
  onMove?: (itemId: string, direction: 'up' | 'down') => void;
}

const TableRow: React.FC<TableRowProps> = ({
  item,
  index,
  total,
  canOrder,
  onItemClick,
  onMove,
}) => {
  const { t } = useTranslation('backlog');
  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [item, onItemClick]);

  const position = index + 1;

  return (
    <tr onClick={handleClick}>
      <td>
        <PositionCell
          position={position}
          itemTitle={item.title}
          isFirst={index === 0}
          isLast={index === total - 1}
          canOrder={canOrder}
          onMoveUp={() => onMove?.(item.id, 'up')}
          onMoveDown={() => onMove?.(item.id, 'down')}
        />
      </td>
      <td>#{item.id.slice(-4)}</td>
      <td className={styles['title-cell']}>{item.title}</td>
      <td>
        <MoscowBadge priority={item.priority} />
      </td>
      <td>
        <span className={`${styles['status-badge']} ${styles[item.status]}`}>
          {getStatusLabel(item.status, t as (key: string) => string)}
        </span>
      </td>
      <td>{item.businessValue ? `${item.businessValue} pts` : '-'}</td>
      <td>{item.storyPoints ? `${item.storyPoints} pts` : '-'}</td>
      <td>
        <div className={styles['label-tags']}>
          {item.labels.slice(0, 2).map((label) => (
            <span key={label} className={styles['label-tag']}>
              {label}
            </span>
          ))}
          {item.labels.length > 2 && (
            <span className={`${styles['label-tag']} ${styles.more}`}>
              +{item.labels.length - 2}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

/**
 * VirtualizedRow Component
 *
 * Renders a single row for a backlog item using CSS Grid (virtualized mode).
 * Uses div-based layout to avoid table + absolute positioning issues.
 */
interface VirtualizedRowProps {
  item: ProductBacklogItem;
  index: number;
  total: number;
  canOrder: boolean;
  onItemClick: (item: ProductBacklogItem) => void;
  onMove?: (itemId: string, direction: 'up' | 'down') => void;
  style: React.CSSProperties;
  measureRef?: (element: HTMLElement | null) => void;
}

const VirtualizedRow: React.FC<VirtualizedRowProps> = ({
  item,
  index,
  total,
  canOrder,
  onItemClick,
  onMove,
  style,
  measureRef,
}) => {
  const { t } = useTranslation('backlog');
  const handleClick = useCallback(() => {
    onItemClick(item);
  }, [item, onItemClick]);

  const position = index + 1;

  return (
    <div
      ref={measureRef}
      className={styles['virtualized-row']}
      onClick={handleClick}
      style={style}
      role="row"
      data-index={index}
    >
      <div className={styles['virtualized-cell']} role="cell">
        <PositionCell
          position={position}
          itemTitle={item.title}
          isFirst={index === 0}
          isLast={index === total - 1}
          canOrder={canOrder}
          onMoveUp={() => onMove?.(item.id, 'up')}
          onMoveDown={() => onMove?.(item.id, 'down')}
        />
      </div>
      <div className={styles['virtualized-cell']} role="cell">
        #{item.id.slice(-4)}
      </div>
      <div className={`${styles['virtualized-cell']} ${styles['title-cell']}`} role="cell">
        {item.title}
      </div>
      <div className={styles['virtualized-cell']} role="cell">
        <MoscowBadge priority={item.priority} />
      </div>
      <div className={styles['virtualized-cell']} role="cell">
        <span className={`${styles['status-badge']} ${styles[item.status]}`}>
          {getStatusLabel(item.status, t as (key: string) => string)}
        </span>
      </div>
      <div className={styles['virtualized-cell']} role="cell">
        {item.businessValue ? `${item.businessValue} pts` : '-'}
      </div>
      <div className={styles['virtualized-cell']} role="cell">
        {item.storyPoints ? `${item.storyPoints} pts` : '-'}
      </div>
      <div className={styles['virtualized-cell']} role="cell">
        <div className={styles['label-tags']}>
          {item.labels.slice(0, 2).map((label) => (
            <span key={label} className={styles['label-tag']}>
              {label}
            </span>
          ))}
          {item.labels.length > 2 && (
            <span className={`${styles['label-tag']} ${styles.more}`}>
              +{item.labels.length - 2}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ListView Component
 *
 * Renders a table with columns for:
 * - Position (the item's place in the backlog order, plus move controls for a Product Owner)
 * - ID (last 4 characters)
 * - Title
 * - MoSCoW Priority (badge)
 * - Status (badge)
 * - Business Value (points)
 * - Estimate (story points)
 * - Labels (up to 2 visible, with overflow indicator)
 *
 * Each row is clickable to open item details.
 *
 * Virtual scrolling is automatically enabled for lists with more than 50 items
 * to maintain smooth performance.
 *
 * @param props - Component props
 * @returns The rendered ListView component
 *
 * @example
 * ```tsx
 * <ListView
 *   items={filteredItems}
 *   onItemClick={(item) => openDetailModal(item)}
 *   onMove={(id, direction) => moveItem(id, direction)}
 *   canOrder={isProductOwner}
 * />
 * ```
 */
export const ListView = memo<ListViewProps>(({ items, onItemClick, onMove, canOrder = false }) => {
  const { t } = useTranslation('backlog');
  const enableVirtualization = shouldEnableVirtualization(items.length, VIRTUALIZATION_THRESHOLD);
  const headerRef = useRef<HTMLDivElement>(null);

  const { virtualItems, totalSize, containerRef, measureElement } = useVirtualScroll(
    items,
    ROW_ESTIMATE_HEIGHT,
    OVERSCAN_COUNT,
    { enabled: enableVirtualization }
  );

  return (
    <div className={`${styles['list-view']} ${enableVirtualization ? styles['virtualized'] : ''}`}>
      {/* Header - only virtualized mode needs a detached header. In table mode the header lives
          inside the same table as the rows, so both share one column layout and cannot drift. */}
      {enableVirtualization && (
        <div ref={headerRef} className={styles['virtualized-header']} role="row">
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.position') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.id') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.title') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.moscow') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.status') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.businessValue') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.estimate') as string}
          </div>
          <div className={styles['virtualized-header-cell']} role="columnheader">
            {t('listView.labels') as string}
          </div>
        </div>
      )}

      {/* Body */}
      <div
        ref={containerRef}
        className={styles['table-body-container']}
        role={enableVirtualization ? 'rowgroup' : undefined}
      >
        {enableVirtualization ? (
          <div
            className={styles['virtualized-body']}
            style={{ height: totalSize, position: 'relative' }}
            role="rowgroup"
          >
            {virtualItems.map(({ item, key, start, index }) => (
              <VirtualizedRow
                key={key}
                item={item}
                index={index}
                total={items.length}
                canOrder={canOrder}
                onItemClick={onItemClick}
                onMove={onMove}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${start}px)`,
                  width: '100%',
                }}
                measureRef={measureElement}
              />
            ))}
          </div>
        ) : (
          <table className={styles['backlog-table']}>
            <colgroup>
              <col style={{ width: '104px' }} />
              <col style={{ width: '80px' }} />
              <col />
              {/* MoSCoW: fits the longest full badge label ("Dovrebbe avere") plus cell padding. */}
              <col style={{ width: '168px' }} />
              <col style={{ width: '140px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '200px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>{t('listView.position') as string}</th>
                <th>{t('listView.id') as string}</th>
                <th>{t('listView.title') as string}</th>
                <th>{t('listView.moscow') as string}</th>
                <th>{t('listView.status') as string}</th>
                <th>{t('listView.businessValue') as string}</th>
                <th>{t('listView.estimate') as string}</th>
                <th>{t('listView.labels') as string}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <TableRow
                  key={item.id}
                  item={item}
                  index={index}
                  total={items.length}
                  canOrder={canOrder}
                  onItemClick={onItemClick}
                  onMove={onMove}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
});

ListView.displayName = 'ListView';

export default ListView;
