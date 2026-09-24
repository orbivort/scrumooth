// The one Definition of Done every team in the group complies with.
//
// Editing it reuses the team's own `DefinitionEditor` unchanged, so "mutually define" is the
// editing the teams already know rather than a second, parallel editor to learn. The only friction
// in the reuse is typing: the API models "no category" as `null` while the editor types the field
// as optional. That conversion lives here -- next to the only code that has to know about it -- so
// the editor's team-scoped callers are left exactly as they were.
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';
import type {
  SharedDefinitionOfDone,
  SharedDoDItem,
  UpdateSharedDoDInput,
} from '@scrumooth/shared';

import { Button } from '../../../../components/common/Button/Button';
import { DefinitionEditor } from '../../TeamDefinitions/components/DefinitionEditor';
import { DOD_CATEGORIES, getCategoryColor } from '../../TeamDefinitions/components/categories';
import type { DefinitionItemPayload } from '../../../../types';

import styles from './SharedDoDPanel.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { EditIcon } from '@/components/common/Icons';

/**
 * The editor's view of a shared criterion: `category` is optional there and nullable here.
 *
 * The mapping is exactly what the write contract wants too -- `UpdateSharedDoDInput.items[].category`
 * is optional -- so going through this shape is a conversion rather than a workaround.
 */
type EditableSharedItem = Omit<SharedDoDItem, 'category'> & { category?: string };

interface SharedDoDPanelProps {
  sharedDoD: SharedDefinitionOfDone;
  /** Whether the caller leads a team in the group, and may therefore replace the commitment. */
  canManage: boolean;
  isSaving: boolean;
  onSave: (input: UpdateSharedDoDInput) => Promise<void>;
}

export const SharedDoDPanel: React.FC<SharedDoDPanelProps> = ({
  sharedDoD,
  canManage,
  isSaving,
  onSave,
}) => {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  const [isEditing, setIsEditing] = useState(false);

  const activeItems = useMemo(
    () => sharedDoD.items.filter((item) => item.isActive),
    [sharedDoD.items]
  );
  const inactiveCount = sharedDoD.items.length - activeItems.length;

  const editableItems = useMemo<EditableSharedItem[]>(
    () =>
      sharedDoD.items.map((item) => ({
        id: item.id,
        description: item.description,
        category: item.category ?? undefined,
        isActive: item.isActive,
        order: item.order,
      })),
    [sharedDoD.items]
  );

  const editorDefinition = useMemo(
    () => ({ items: editableItems, version: sharedDoD.version, updatedAt: sharedDoD.updatedAt }),
    [editableItems, sharedDoD.version, sharedDoD.updatedAt]
  );

  const handleSave = useCallback(
    async (items: DefinitionItemPayload<EditableSharedItem>[]) => {
      await onSave({ items });
      // Only reached when the write succeeded: a refusal has to leave the criteria on screen so
      // they can be corrected rather than discarded.
      setIsEditing(false);
    },
    [onSave]
  );

  const handleCancel = useCallback(() => setIsEditing(false), []);

  return (
    <section className={styles.container} aria-labelledby="shared-dod-title">
      <header className={styles.header}>
        <div className={styles['header-left']}>
          <h3 id="shared-dod-title" className={styles['header-title']}>
            {t('teamGroups.sharedDoD.title')}
          </h3>
          <span className={styles['version-badge']}>
            {t('teamGroups.versionShort', { version: sharedDoD.version })}
          </span>
        </div>

        <div className={styles['header-right']}>
          <span className={styles['updated-info']}>
            {t('teamGroups.sharedDoD.updated', {
              date: formatLocaleDate(sharedDoD.updatedAt, locale),
            })}
          </span>

          {canManage && !isEditing && (
            <Button variant="primary" size="sm" onClick={() => setIsEditing(true)}>
              <EditIcon size={16} />
              {t('teamGroups.sharedDoD.edit')}
            </Button>
          )}
        </div>
      </header>

      {isEditing ? (
        <>
          {/*
            The consequence is stated before the editor rather than after the save: this is the one
            write in the product that changes several teams' commitment at once.
          */}
          <p className={styles.banner}>{t('teamGroups.sharedDoD.banner')}</p>

          <DefinitionEditor
            definition={editorDefinition}
            definitionType="DoD"
            categories={DOD_CATEGORIES}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={isSaving}
          />
        </>
      ) : (
        <>
          {!canManage && (
            <p className={styles['read-only']} role="status">
              {t('teamGroups.sharedDoD.readOnly')}
            </p>
          )}

          {activeItems.length === 0 ? (
            <p className={styles.empty}>{t('teamGroups.sharedDoD.empty')}</p>
          ) : (
            <div className={styles.list}>
              {activeItems.map((item, index) => {
                const category = DOD_CATEGORIES.find(
                  (candidate) => candidate.value === item.category
                );

                return (
                  <div key={item.id} className={styles.item}>
                    <div className={styles['item-number']}>{index + 1}</div>
                    <div
                      className={styles['item-category']}
                      style={getCategoryColor(item.category ?? '', DOD_CATEGORIES)}
                      title={
                        category
                          ? t(`definitionEditor.dodCategories.${category.value}` as never)
                          : t('dodPanel.uncategorized')
                      }
                    >
                      {category?.icon ?? '📌'}
                    </div>
                    <div className={styles['item-text']}>{item.description}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.footer}>
            <div className={styles.counts}>
              <span className={styles['active-count']}>
                {t('teamGroups.sharedDoD.activeCount', { count: activeItems.length })}
              </span>
              {inactiveCount > 0 && (
                <span className={styles['inactive-count']}>
                  {t('teamGroups.sharedDoD.inactiveCount', { count: inactiveCount })}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default SharedDoDPanel;
