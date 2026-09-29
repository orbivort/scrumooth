import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { apiService } from '../../services';
import { IncrementStatus } from '../../types';
import { useTeamContext } from '../../contexts/TeamContext';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';

import styles from './IncrementList.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import {
  ArchiveIcon,
  CalendarIcon,
  CheckCircleIcon,
  CheckIcon,
  FileTextIcon,
  PackageIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  SprintIcon,
  ZapIcon,
} from '@/components/common/Icons';

// Icons imported from shared library

export const IncrementList: React.FC = () => {
  const { t } = useTranslation('increments');
  const navigate = useNavigate();
  const { currentTeam } = useTeamContext();
  const { locale } = useI18nStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: incrementsData, isLoading: isLoadingIncrements } = useQuery({
    queryKey: ['increments', currentTeam?.id],
    queryFn: () => {
      if (!currentTeam?.id) throw new Error('Team ID is required');
      return apiService.getIncrements(currentTeam.id);
    },
    enabled: !!currentTeam?.id,
  });

  const increments = incrementsData?.data ?? [];

  const filteredIncrements = increments.filter((increment) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' &&
        (increment.status === IncrementStatus.DRAFT ||
          increment.status === IncrementStatus.VERIFIED)) ||
      (filter === 'delivered' && increment.status === IncrementStatus.DELIVERED) ||
      (filter === 'archived' && increment.status === IncrementStatus.ARCHIVED);

    const matchesSearch =
      !searchQuery ||
      increment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      increment.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: increments.length,
    active: increments.filter(
      (i) => i.status === IncrementStatus.DRAFT || i.status === IncrementStatus.VERIFIED
    ).length,
    delivered: increments.filter((i) => i.status === IncrementStatus.DELIVERED).length,
    storyPoints: increments.reduce((sum, i) => sum + (i.totalStoryPoints || 0), 0),
  };

  const getStatusIcon = (status: IncrementStatus) => {
    switch (status) {
      case IncrementStatus.DELIVERED:
        return <CheckIcon size={12} strokeWidth={3} />;
      case IncrementStatus.ARCHIVED:
        return <ArchiveIcon size={12} />;
      default:
        return <FileTextIcon size={12} />;
    }
  };

  const getStatusLabel = (status: IncrementStatus) => {
    switch (status) {
      case IncrementStatus.DRAFT:
        return t('status.draft');
      case IncrementStatus.VERIFIED:
        return t('status.verified');
      case IncrementStatus.DELIVERED:
        return t('status.delivered');
      case IncrementStatus.ARCHIVED:
        return t('status.archived');
      default:
        return status;
    }
  };

  const getDeliveryMethodLabel = (method?: string) => {
    if (!method) return null;
    return method.toLowerCase() === 'sprint_review'
      ? t('deliveryMethod.sprintReview')
      : t('deliveryMethod.earlyRelease');
  };

  const getDeliveryMethodIcon = (method?: string) => {
    if (!method) return null;
    return method.toLowerCase() === 'sprint_review' ? (
      <CheckCircleIcon size={12} />
    ) : (
      <ZapIcon size={12} />
    );
  };

  if (!currentTeam?.id) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (isLoadingIncrements) {
    return (
      <div className={styles['increment-list-page']}>
        <LoadingState variant="page" label={t('loading')} />
      </div>
    );
  }

  return (
    <div className={styles['increment-list-page']}>
      <div className={styles['page-header']}>
        <div className={styles['header-left']}>
          <h1 className={styles['page-title']}>
            <span className={styles['page-title-icon']}>
              <PackageIcon size={28} aria-hidden="true" />
            </span>
            {t('title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('subtitle')}</p>
        </div>
        <div className={styles['header-actions']}>
          <button
            className={`${styles.btn} ${styles['btn-primary']}`}
            onClick={() => navigate('/increment/create')}
          >
            <PlusIcon size={16} />
            {t('createIncrement')}
          </button>
        </div>
      </div>

      <div className={styles['stats-grid']}>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']}>
            <PackageIcon size={48} strokeWidth={1.5} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats.total}</div>
            <div className={styles['stat-label']}>{t('list.stats.total')}</div>
          </div>
        </div>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']}>
            <RocketIcon size={16} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats.active}</div>
            <div className={styles['stat-label']}>{t('list.stats.active')}</div>
          </div>
        </div>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']}>
            <CheckIcon size={16} strokeWidth={3} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats.delivered}</div>
            <div className={styles['stat-label']}>{t('list.stats.delivered')}</div>
          </div>
        </div>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']}>
            <ZapIcon size={16} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{stats.storyPoints}</div>
            <div className={styles['stat-label']}>{t('list.stats.storyPoints')}</div>
          </div>
        </div>
      </div>

      <div className={styles['filters-bar']}>
        <div className={styles['search-box']}>
          <SearchIcon size={16} />
          <input
            type="text"
            className={styles['search-input']}
            placeholder={t('list.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('list.ariaLabelSearch')}
          />
          {searchQuery && (
            <button
              className={styles['clear-search']}
              onClick={() => setSearchQuery('')}
              aria-label={t('list.clearSearch')}
              title={t('list.clearSearch')}
            >
              ×
            </button>
          )}
        </div>
        <div className={styles['filter-tabs']}>
          <button
            className={`${styles['filter-tab']} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('list.filters.all')}
          </button>
          <button
            className={`${styles['filter-tab']} ${filter === 'active' ? styles.active : ''}`}
            onClick={() => setFilter('active')}
          >
            {t('list.filters.active')}
          </button>
          <button
            className={`${styles['filter-tab']} ${filter === 'delivered' ? styles.active : ''}`}
            onClick={() => setFilter('delivered')}
          >
            {t('list.filters.delivered')}
          </button>
          <button
            className={`${styles['filter-tab']} ${filter === 'archived' ? styles.active : ''}`}
            onClick={() => setFilter('archived')}
          >
            {t('list.filters.archived')}
          </button>
        </div>
      </div>

      <div className={styles['increments-grid']}>
        {filteredIncrements.length === 0 ? (
          <div className={styles['empty-state']}>
            <div className={styles['empty-illustration']}>
              <PackageIcon size={48} strokeWidth={1.5} />
            </div>
            <h3>{t('list.empty.title')}</h3>
            <p className={styles['empty-description']}>
              {searchQuery ? t('list.empty.noSearchResults') : t('list.empty.noIncrements')}
            </p>
            <div className={styles['empty-actions']}>
              <button
                className={`${styles.btn} ${styles['btn-primary']}`}
                onClick={() => navigate('/increment/create')}
              >
                <PlusIcon size={16} />
                {t('createIncrement')}
              </button>
            </div>
          </div>
        ) : (
          filteredIncrements.map((increment) => (
            <div
              key={increment.id}
              className={styles['increment-card']}
              onClick={() => void navigate(`/increment/${increment.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  void navigate(`/increment/${increment.id}`);
                }
              }}
            >
              <div className={styles['card-sprint-indicator']} />
              <div className={styles['card-sprint-header']}>
                <span className={styles['sprint-badge']}>
                  <span className={styles['sprint-badge-icon']}>
                    <SprintIcon size={14} />
                  </span>
                  <span className={styles['sprint-badge-name']}>
                    {increment.sprint?.name ??
                      t('sprintPrefix' as never, { sprintId: increment.sprintId })}
                  </span>
                </span>
              </div>
              <div className={styles['card-header']}>
                <h3 className={styles['increment-name']}>{increment.name}</h3>
                <div className={styles['card-header-badges']}>
                  {increment.usabilityVerified && (
                    <span className={styles['integration-verified-badge']}>
                      <CheckCircleIcon size={12} />
                      <span>{t('card.usable')}</span>
                    </span>
                  )}
                  {increment.integrationVerified && (
                    <span className={styles['integration-verified-badge']}>
                      <CheckCircleIcon size={12} />
                      <span>{t('card.integrationVerified')}</span>
                    </span>
                  )}
                  <span
                    className={styles['status-badge']}
                    data-status={increment.status.toLowerCase()}
                  >
                    <span>{getStatusIcon(increment.status)}</span>
                    <span>{getStatusLabel(increment.status)}</span>
                  </span>
                </div>
              </div>
              <p className={styles['increment-description']}>
                {increment.description ?? t('noDescription')}
              </p>
              <div className={styles['card-stats']}>
                <div className={styles.stat}>
                  <span className={styles['stat-label']}>{t('list.cardStats.pbis')}</span>
                  <span className={styles['stat-value']}>{increment.includedPBIs.length || 0}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles['stat-label']}>{t('list.cardStats.points')}</span>
                  <span className={styles['stat-value']}>{increment.totalStoryPoints || 0}</span>
                </div>
              </div>
              <div className={styles['card-footer']}>
                <div className={styles.dates}>
                  <span>
                    <CalendarIcon size={12} />
                    {t('dates.created')} {formatLocaleDate(increment.createdAt, locale)}
                  </span>
                  {increment.deliveredAt && (
                    <span>
                      <CheckIcon size={12} strokeWidth={3} />
                      {t('dates.delivered')} {formatLocaleDate(increment.deliveredAt, locale)}
                    </span>
                  )}
                </div>
                {increment.deliveryMethod && (
                  <span className={styles['delivery-method']}>
                    {getDeliveryMethodIcon(increment.deliveryMethod)}
                    {getDeliveryMethodLabel(increment.deliveryMethod)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
