// Impediments module -- one module, two registers of what blocks the team.
//
// The team's own impediment list and the register of barriers the team cannot remove alone are two
// views of the same concern: the first is the team's to raise and resolve, the second is the Scrum
// Master's to carry to the people outside the team who have to act. They share one module, one
// header and one URL -- `?tab=barriers` opens the register so a link can point straight at it, and
// the old `/organizational-barriers` route redirects here.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { useTeamStore } from '../../store';
import { EmptyState } from '../../components/EmptyState';
import { AlertTriangleIcon, FlagIcon } from '../../components/common/Icons';
import { OrganizationalBarriers } from '../OrganizationalBarriers/OrganizationalBarriers';

import { ImpedimentsPanel } from './ImpedimentsPanel';
import styles from './Impediments.module.css';

/**
 * The tabs of the module. The impediment list is the default, so it is the tab the URL stays
 * silent about: `/impediments` is the list, `/impediments?tab=barriers` is the register.
 */
type ImpedimentsTab = 'impediments' | 'barriers';

const TAB_PARAM = 'tab';

/** The impediment the list panel has open, owned by that panel and meaningless on the register. */
const IMPEDIMENT_ID_PARAM = 'id';

const TAB_IDS: readonly ImpedimentsTab[] = ['impediments', 'barriers'];

const readTab = (params: URLSearchParams): ImpedimentsTab =>
  params.get(TAB_PARAM) === 'barriers' ? 'barriers' : 'impediments';

export const Impediments: React.FC = () => {
  const { t } = useTranslation(['impediments', 'common']);
  const { currentTeam } = useTeamStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the single source of truth: browser back/forward, shared links and the redirect
  // away from the old barrier route all resolve through it, with no second copy to keep in sync.
  const activeTab = readTab(searchParams);

  const panelRef = useRef<HTMLDivElement>(null);
  /** Set when the module moved the selection itself, so the revealed panel is focused once. */
  const focusPanelRef = useRef(false);

  const tabs = useMemo(
    () => [
      { id: 'impediments' as const, label: t('tabs.impediments'), Icon: AlertTriangleIcon },
      { id: 'barriers' as const, label: t('tabs.barriers'), Icon: FlagIcon },
    ],
    [t]
  );

  const selectTab = useCallback(
    (tab: ImpedimentsTab) => {
      // Only the module's own parameters are touched, so anything else the address carries (a
      // filter a panel keeps in the URL, say) survives the switch.
      const nextParams = new URLSearchParams(searchParams);

      // `?id=` addresses an impediment the list panel has open, so it must not outlive a move away
      // from that panel: the address should describe what is on screen.
      nextParams.delete(IMPEDIMENT_ID_PARAM);

      if (tab === 'impediments') {
        nextParams.delete(TAB_PARAM);
      } else {
        nextParams.set(TAB_PARAM, tab);
      }

      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  const showBarriers = useCallback(() => {
    focusPanelRef.current = true;
    selectTab('barriers');
  }, [selectTab]);

  // A selection the module made itself moves focus into the panel it revealed, otherwise the
  // escalation hand-off would leave a keyboard user behind on the list they escalated from. A
  // selection the browser made (back/forward, a shared link) leaves focus where the user put it.
  useEffect(() => {
    if (!focusPanelRef.current) {
      return;
    }

    focusPanelRef.current = false;
    panelRef.current?.focus();
  }, [activeTab]);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = TAB_IDS.indexOf(activeTab);
      let nextIndex: number;

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % TAB_IDS.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = TAB_IDS.length - 1;
          break;
        default:
          return;
      }

      const nextTab = TAB_IDS[nextIndex];

      if (!nextTab) {
        return;
      }

      event.preventDefault();
      selectTab(nextTab);
      // The strip is a single tab stop, so moving the selection has to carry focus with it.
      document.getElementById(`${nextTab}-tab`)?.focus();
    },
    [activeTab, selectTab]
  );

  // The module is meaningless without a team, and neither register can be read without one.
  if (!currentTeam) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  return (
    <div className={styles.impediments} data-testid="impediments-module">
      {/* Module Header -- one h1 for the whole module; the panels never repeat it. */}
      <header className={styles['page-header']}>
        <div className={styles['header-content']}>
          <h1 className={styles['page-title']}>
            <AlertTriangleIcon className={styles['page-title-icon']} />
            {t('title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('moduleSubtitle')}</p>
        </div>
      </header>

      {/* Tab strip -- one text button per register, sharing a single baseline rule. */}
      <div className={styles.tabs} role="tablist" aria-label={t('tabs.ariaLabel')}>
        {tabs.map(({ id, label, Icon }) => {
          const selected = activeTab === id;

          return (
            <button
              key={id}
              id={`${id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles['tab-active'] : ''}`}
              onClick={() => selectTab(id)}
              onKeyDown={handleTabKeyDown}
            >
              <Icon className={styles['tab-icon']} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Panel -- only the selected register mounts, so neither surface fetches for the other and
          the barriers tab stays usable while the team has no active sprint. `tabIndex={-1}` keeps
          the wrapper programmatically focusable for the escalation hand-off without adding a second
          tab stop: both panels carry their own controls. */}
      <div
        ref={panelRef}
        id={`${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
        tabIndex={-1}
        className={styles.panel}
      >
        {activeTab === 'barriers' ? (
          <OrganizationalBarriers />
        ) : (
          <ImpedimentsPanel onShowBarriers={showBarriers} />
        )}
      </div>
    </div>
  );
};

export default Impediments;
