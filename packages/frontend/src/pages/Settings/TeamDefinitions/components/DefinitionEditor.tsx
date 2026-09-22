import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { DefinitionItemPayload } from '../../../../types';

import { getCategoryColor, type CategoryConfig } from './categories';
import styles from './DefinitionEditor.module.css';

import {
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  CircleIcon,
  TrashIcon,
  AlertTriangleIcon,
  SaveIcon,
} from '@/components/common/Icons';

/**
 * The id of a criterion the user has just added and that the server has never seen. It exists only so
 * React has a stable key and the row can be edited before it is saved; it is stripped from the
 * payload, because "no id" is what tells the service to insert a new criterion.
 */
const LOCAL_ITEM_ID_PREFIX = 'local-';

interface DefinitionEditorProps<T extends { id: string }> {
  definition: { items: T[]; version: number; updatedAt: string };
  definitionType: 'DoD' | 'DoR';
  categories: CategoryConfig[];
  onSave: (items: DefinitionItemPayload<T>[]) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DefinitionEditor<
  T extends {
    id: string;
    description: string;
    category?: string;
    isActive: boolean;
    order: number;
  },
>({
  definition,
  definitionType,
  categories,
  onSave,
  onCancel,
  isLoading = false,
}: DefinitionEditorProps<T>): React.ReactElement {
  const { t } = useTranslation('settings');
  const [items, setItems] = useState<T[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<string>(categories[0]?.value ?? '');
  const [hasChanges, setHasChanges] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  // Only ever used to key criteria the user has not saved yet, so a monotonic counter is enough.
  const localItemSeq = useRef(0);

  const definitionLabel = definitionType === 'DoD' ? t('dodPanel.title') : t('dorPanel.title');
  const shortLabel = definitionType === 'DoD' ? t('dodPanel.shortLabel') : t('dorPanel.shortLabel');

  useEffect(() => {
    if (definition.items.length > 0) {
      setItems(definition.items);
    } else {
      setItems([]);
    }
  }, [definition]);

  const handleAddItem = () => {
    if (!newItemText.trim()) return;

    // A criterion carries its identity to the server: an `id` that names an existing criterion is
    // updated in place, so the verifications recorded against it survive the edit. This one has no
    // server identity yet, so it is marked local and sent without an id -- which is the payload
    // contract for "insert this as a new criterion". The marker is local-only on purpose: it must
    // never look like a row id the service would try to match.
    localItemSeq.current += 1;
    const newItem = {
      id: `${LOCAL_ITEM_ID_PREFIX}${localItemSeq.current}`,
      description: newItemText.trim(),
      category: newItemCategory,
      isActive: true,
      order: items.length,
    } as T;

    setItems([...items, newItem]);
    setNewItemText('');
    setHasChanges(true);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    setHasChanges(true);
  };

  const handleEditItem = (id: string, description: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, description } : item)));
    setHasChanges(true);
  };

  const handleToggleItem = (id: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, isActive: !item.isActive } : item)));
    setHasChanges(true);
  };

  const handleCategoryChange = (id: string, category: string) => {
    setItems(items.map((item) => (item.id === id ? { ...item, category } : item)));
    setHasChanges(true);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index - 1];
    const current = newItems[index];
    if (temp && current) {
      newItems[index - 1] = current;
      newItems[index] = temp;
    }
    setItems(newItems.map((item, i) => ({ ...item, order: i })));
    setHasChanges(true);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index + 1];
    const current = newItems[index];
    if (temp && current) {
      newItems[index + 1] = current;
      newItems[index] = temp;
    }
    setItems(newItems.map((item, i) => ({ ...item, order: i })));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave(
      items.map((item): DefinitionItemPayload<T> => {
        // A criterion the server already knows keeps its id; one the user just added is sent
        // without one, so the service inserts it rather than trying to update a row that is not
        // there.
        if (!item.id.startsWith(LOCAL_ITEM_ID_PREFIX)) {
          return item;
        }

        const { id: _localOnlyId, ...newItem } = item;
        return newItem;
      })
    );
    setHasChanges(false);
  };

  const handleCancelClick = () => {
    if (hasChanges) {
      setShowCancelDialog(true);
    } else {
      onCancel();
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    onCancel();
  };

  const handleDismissDialog = () => {
    setShowCancelDialog(false);
  };

  const infoText =
    definitionType === 'DoD' ? t('definitionEditor.dodInfo') : t('definitionEditor.dorInfo');

  return (
    <div className={styles['definition-editor']}>
      <div className={styles['definition-editor-header']}>
        <h3>{t('definitionEditor.editTitle', { label: definitionLabel })}</h3>
        <span className={styles['version-badge']}>v{definition.version}</span>
      </div>

      <div className={styles['definition-editor-info']}>
        <p>{infoText}</p>
      </div>

      <div className={styles['definition-add-item']}>
        <div className={styles['add-item-inputs']}>
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            className={styles['category-select']}
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.icon}{' '}
                {definitionType === 'DoD'
                  ? t(`definitionEditor.dodCategories.${cat.value}` as never)
                  : t(`definitionEditor.dorCategories.${cat.value}` as never)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={t('definitionEditor.newItemPlaceholder', { shortLabel })}
            className={styles['item-input']}
            onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
          />
        </div>
        <button
          className={`${styles.button} ${styles['button-primary']}`}
          onClick={handleAddItem}
          disabled={!newItemText.trim()}
          type="button"
          aria-label={t('definitionEditor.ariaLabels.addNewItem')}
        >
          <PlusIcon size={14} />
          {t('definitionEditor.addItem')}
        </button>
      </div>

      <div className={styles['definition-items-list']}>
        {items.length === 0 ? (
          <div className={styles['empty-state']}>
            <p>{t('definitionEditor.empty', { shortLabel })}</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`${styles['definition-item-row']} ${!item.isActive ? styles['definition-item-row-inactive'] : ''}`}
            >
              <div className={styles['item-order']}>
                <button
                  className={styles['order-button']}
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  title={t('definitionEditor.ariaLabels.moveUp')}
                  type="button"
                  aria-label={t('definitionEditor.ariaLabels.moveItemUp')}
                >
                  <ArrowUpIcon size={12} />
                </button>
                <span className={styles['order-number']}>{index + 1}</span>
                <button
                  className={styles['order-button']}
                  onClick={() => handleMoveDown(index)}
                  disabled={index === items.length - 1}
                  title={t('definitionEditor.ariaLabels.moveDown')}
                  type="button"
                  aria-label={t('definitionEditor.ariaLabels.moveItemDown')}
                >
                  <ArrowDownIcon size={12} />
                </button>
              </div>

              <select
                value={item.category ?? categories[0]?.value ?? ''}
                onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                className={styles['item-category']}
                style={getCategoryColor(item.category ?? categories[0]?.value ?? '', categories)}
              >
                {!categories.find((c) => c.value === item.category) && item.category && (
                  <option value={item.category}>
                    {definitionType === 'DoD'
                      ? t('dodPanel.uncategorized')
                      : t('dorPanel.uncategorized')}
                  </option>
                )}
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon}{' '}
                    {definitionType === 'DoD'
                      ? t(`definitionEditor.dodCategories.${cat.value}` as never)
                      : t(`definitionEditor.dorCategories.${cat.value}` as never)}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={item.description}
                onChange={(e) => handleEditItem(item.id, e.target.value)}
                className={styles['item-description']}
                aria-label={t('definitionEditor.ariaLabels.itemDescription')}
              />

              <div className={styles['item-actions']}>
                <button
                  className={`${styles['toggle-button']} ${item.isActive ? styles['toggle-button-active'] : ''}`}
                  onClick={() => handleToggleItem(item.id)}
                  title={
                    item.isActive
                      ? t('definitionEditor.ariaLabels.deactivate')
                      : t('definitionEditor.ariaLabels.activate')
                  }
                  type="button"
                  aria-label={
                    item.isActive
                      ? t('definitionEditor.ariaLabels.deactivateItem')
                      : t('definitionEditor.ariaLabels.activateItem')
                  }
                  aria-pressed={item.isActive}
                >
                  {item.isActive ? <CheckIcon size={16} /> : <CircleIcon size={16} />}
                </button>
                <button
                  className={styles['remove-button']}
                  onClick={() => handleRemoveItem(item.id)}
                  title={t('definitionEditor.ariaLabels.remove')}
                  type="button"
                  aria-label={t('definitionEditor.ariaLabels.removeItem')}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles['definition-summary']}>
        <span className={styles['active-count-summary']}>
          {t('definitionEditor.activeItems', { count: items.filter((i) => i.isActive).length })}
        </span>
        <span className={styles['inactive-count-summary']}>
          {t('definitionEditor.inactive', { count: items.filter((i) => !i.isActive).length })}
        </span>
      </div>

      <div className={styles['definition-editor-actions']}>
        <button
          className={`${styles.button} ${styles['button-secondary']}`}
          onClick={handleCancelClick}
          disabled={isLoading}
          type="button"
        >
          {t('definitionEditor.cancel')}
        </button>
        <button
          className={`${styles.button} ${styles['button-primary']}`}
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          type="button"
        >
          {isLoading ? (
            t('definitionEditor.saving')
          ) : (
            <>
              <SaveIcon size={16} />
              {t('definitionEditor.saveChanges')}
            </>
          )}
        </button>
      </div>

      {hasChanges && (
        <div className={styles['unsaved-warning']} role="alert">
          <AlertTriangleIcon size={16} />
          {t('definitionEditor.unsavedWarning')}
        </div>
      )}

      {showCancelDialog && (
        <div
          className={styles['dialog-overlay']}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-dialog-title"
        >
          <div className={styles.dialog}>
            <h4 id="cancel-dialog-title">{t('definitionEditor.discardDialog.title')}</h4>
            <p>{t('definitionEditor.discardDialog.message')}</p>
            <div className={styles['dialog-actions']}>
              <button
                className={`${styles.button} ${styles['button-secondary']}`}
                onClick={handleDismissDialog}
                type="button"
              >
                {t('definitionEditor.discardDialog.keepEditing')}
              </button>
              <button
                className={`${styles.button} ${styles['button-danger']}`}
                onClick={handleConfirmCancel}
                type="button"
              >
                {t('definitionEditor.discardDialog.discardChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
