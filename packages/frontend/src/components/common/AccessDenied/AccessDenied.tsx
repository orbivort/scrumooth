// A page the reader's role may not reach.
//
// Rendered by the route guard in place of the page it guards, and inside the app shell: hiding a
// destination from the sidebar is not the same as making it unreachable, and a stale bookmark should
// not look like a broken link. So the reader keeps the navigation and is told, in one sentence, who
// the page belongs to and where they can act instead -- a silent redirect would take both away.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import styles from './AccessDenied.module.css';

import { LockIcon } from '@/components/common/Icons';

export const AccessDenied: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <section
      className={styles.page}
      aria-labelledby="access-denied-title"
      data-testid="access-denied"
    >
      <div className={styles.panel}>
        <span className={styles.icon} aria-hidden="true">
          <LockIcon size={26} />
        </span>
        <h1 id="access-denied-title" className={styles.title}>
          {t('accessDenied.title')}
        </h1>
        {/* Announced when it appears rather than only when read, so a keyboard or screen-reader
            reader learns the page was refused instead of waiting for content that never arrives. */}
        <p className={styles.description} role="status">
          {t('accessDenied.description')}
        </p>
        <Link to="/team" className={styles.action}>
          {t('accessDenied.action')}
        </Link>
      </div>
    </section>
  );
};

export default AccessDenied;
