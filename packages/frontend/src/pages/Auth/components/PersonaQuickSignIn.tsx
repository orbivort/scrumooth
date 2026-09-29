import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './PersonaQuickSignIn.module.css';
import {
  cardFullName,
  cardInitials,
  fetchPersonaCatalogue,
  groupCardsByTeam,
  type PersonaCard,
  type PersonaCatalogue,
  type PersonaRole,
} from './personaCards';

import { LoaderIcon } from '@/components/common/Icons';
import { logger } from '@/utils/logger';

/**
 * One-click sign-in cards for the demo personas.
 *
 * Rendered only in mock mode (see `LoginPage`), so a real deployment never shows
 * it. The catalogue is fetched from the mock backend rather than imported, which
 * is what keeps persona names and the demo password out of a production build.
 *
 * The panel is presentational otherwise: it hands the chosen card back and lets
 * the login page run the ordinary sign-in, so the session and team wiring lives
 * in exactly one place.
 */

const CARD_ACCENT: Record<PersonaRole, string> = {
  PRODUCT_OWNER: styles['card-po'] ?? '',
  SCRUM_MASTER: styles['card-sm'] ?? '',
  DEVELOPERS: styles['card-dev'] ?? '',
};

const CHIP_ACCENT: Record<PersonaRole, string> = {
  PRODUCT_OWNER: styles['chip-po'] ?? '',
  SCRUM_MASTER: styles['chip-sm'] ?? '',
  DEVELOPERS: styles['chip-dev'] ?? '',
};

// `as const` keeps the keys as literals, which is what the typed `t()` needs.
const ROLE_LABEL_KEY = {
  PRODUCT_OWNER: 'personaPanel.role.productOwner',
  SCRUM_MASTER: 'personaPanel.role.scrumMaster',
  DEVELOPERS: 'personaPanel.role.developers',
} as const satisfies Record<PersonaRole, string>;

/**
 * The card's tooltip: one line, per role, on what that role owns.
 *
 * It is keyed by role because that is all it varies on — three lines describe
 * every card. Held as translations rather than as fixture text so it reads in the
 * visitor's language like the rest of the panel, and so the mock serves data and
 * nothing else.
 */
const ROLE_BLURB_KEY = {
  PRODUCT_OWNER: 'personaPanel.blurb.productOwner',
  SCRUM_MASTER: 'personaPanel.blurb.scrumMaster',
  DEVELOPERS: 'personaPanel.blurb.developers',
} as const satisfies Record<PersonaRole, string>;

export interface PersonaQuickSignInProps {
  /** Sign in as the given card's person, in the given card's team. */
  onSignIn: (card: PersonaCard, password: string) => void;
  /** The card mid sign-in, so only that card shows a pending state. */
  pendingKey: string | null;
  /** True while any sign-in is running, so the other cards cannot be clicked. */
  disabled?: boolean;
}

export const PersonaQuickSignIn: React.FC<PersonaQuickSignInProps> = ({
  onSignIn,
  pendingKey,
  disabled = false,
}) => {
  const { t } = useTranslation('auth');
  const [catalogue, setCatalogue] = useState<PersonaCatalogue | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPersonaCatalogue()
      .then((result) => {
        if (!cancelled) {
          setCatalogue(result);
        }
      })
      .catch((error: unknown) => {
        // No catalogue means no demo panel: the ordinary form below still works,
        // so this is a quiet degradation rather than an error worth showing.
        logger.warn('The demo persona catalogue could not be loaded', undefined, { error });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupCardsByTeam(catalogue?.cards ?? []), [catalogue]);

  if (!catalogue || groups.length === 0) {
    return null;
  }

  return (
    <section className={styles['panel']} aria-labelledby="persona-panel-heading">
      <div className={styles['divider']}>
        <span className={styles['divider-label']}>{t('personaPanel.divider')}</span>
      </div>

      <h2 className={styles['heading']} id="persona-panel-heading">
        {t('personaPanel.title')}
      </h2>
      <p className={styles['subheading']}>{t('personaPanel.subtitle')}</p>

      {groups.map((group) => (
        <div className={styles['group']} key={group.teamId}>
          <span className={styles['group-label']}>{group.teamName}</span>

          <div className={styles['grid']}>
            {group.cards.map((card) => {
              const name = cardFullName(card);
              const roleLabel = t(ROLE_LABEL_KEY[card.role]);
              const isPending = pendingKey === card.key;
              const isBusy = disabled || pendingKey !== null;

              return (
                <button
                  key={card.key}
                  type="button"
                  className={`${styles['card']} ${CARD_ACCENT[card.role]} ${
                    isPending ? styles['card-pending'] : ''
                  }`}
                  onClick={() => onSignIn(card, catalogue.password)}
                  disabled={isBusy}
                  aria-busy={isPending}
                  title={t(ROLE_BLURB_KEY[card.role]) as string}
                  aria-label={
                    t('personaPanel.signInAs', {
                      name,
                      role: roleLabel,
                      team: group.teamName,
                    }) as string
                  }
                >
                  {isPending ? (
                    <LoaderIcon className={styles['spinner']} aria-hidden="true" />
                  ) : (
                    <span className={styles['avatar']} aria-hidden="true">
                      {cardInitials(card)}
                    </span>
                  )}

                  <span className={styles['card-body']}>
                    <span className={styles['card-name']}>{name}</span>
                    <span className={styles['card-meta']}>
                      <span className={`${styles['chip']} ${CHIP_ACCENT[card.role]}`}>
                        {roleLabel}
                      </span>
                      <span className={styles['card-team']}>{group.teamName}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <p className={styles['footnote']}>{t('personaPanel.footnote')}</p>
    </section>
  );
};
