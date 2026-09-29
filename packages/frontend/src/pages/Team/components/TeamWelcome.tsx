// What a signed-in user without a team sees on the Team destination.
//
// It is a starting point, not an error: the two ways into a team (create one, or be invited to one)
// are the only actions, and the capabilities below explain what the team surface will hold once one
// exists. It lives apart from the module shell because it shares none of the module's data or tabs.
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router';

import {
  ArrowRightIcon,
  BriefcaseIcon,
  ChartIcon,
  CodeIcon,
  CrownIcon,
  LightbulbIcon,
  MailIcon,
  RocketIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  ZapIcon,
} from '../../../components/common/Icons';
import styles from '../Team.module.css';

interface TeamWelcomeProps {
  /** The signed-in user's first name, when the profile carries one. */
  userName: string | null;
  onNavigate: NavigateFunction;
}

export const TeamWelcome: React.FC<TeamWelcomeProps> = ({ userName, onNavigate }) => {
  const { t } = useTranslation('team');

  return (
    <div className={styles['welcome-container']}>
      <div className={styles['welcome-hero']}>
        <div className={styles['welcome-icon']}>
          <SparklesIcon size={80} />
        </div>
        <h1 className={styles['welcome-title']}>
          {userName ? t('welcome.title', { name: userName }) : t('welcome.titleAnonymous')}
        </h1>
        <p className={styles['welcome-subtitle']}>{t('welcome.subtitle')}</p>
      </div>

      <div className={styles['role-selection-section']}>
        <h2 className={styles['role-section-title']}>{t('welcome.selectRole')}</h2>

        <div className={styles['role-card-leadership']}>
          <div className={styles['role-card-header']}>
            <div className={styles['role-icon-leadership']}>
              <CrownIcon size={24} />
            </div>
            <div className={styles['role-badge-leadership']}>{t('leadership.badge')}</div>
          </div>
          <h3 className={styles['role-title']}>{t('leadership.title')}</h3>
          <p className={styles['role-description']}>{t('leadership.description')}</p>
          <div className={styles['role-actions']}>
            <button
              className={styles['cta-button-primary']}
              onClick={() => onNavigate('/settings/team-management?create=1')}
              type="button"
            >
              <BriefcaseIcon size={24} />
              <span>{t('leadership.createTeam')}</span>
              <ArrowRightIcon size={20} />
            </button>
          </div>
          <div className={styles['role-steps']}>
            <h4>{t('leadership.quickStartTitle')}</h4>
            <div className={styles['steps-indicator']}>
              <div className={styles['step-item']}>
                <span className={styles['step-number']}>1</span>
                <span>{t('leadership.quickStart.step1')}</span>
              </div>
              <div className={styles['step-arrow']} aria-hidden="true" />
              <div className={styles['step-item']}>
                <span className={styles['step-number']}>2</span>
                <span>{t('leadership.quickStart.step2')}</span>
              </div>
              <div className={styles['step-arrow']} aria-hidden="true" />
              <div className={styles['step-item']}>
                <span className={styles['step-number']}>3</span>
                <span>{t('leadership.quickStart.step3')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles['role-card-developer']}>
          <div className={styles['role-card-header']}>
            <div className={styles['role-icon-developer']}>
              <CodeIcon size={24} />
            </div>
            <div className={styles['role-badge-developer']}>{t('developers.badge')}</div>
          </div>
          <h3 className={styles['role-title']}>{t('developers.title')}</h3>
          <p className={styles['role-description']}>{t('developers.description')}</p>
          <div className={styles['developer-info-box']}>
            <div className={styles['info-box-header']}>
              <ShieldIcon size={24} />
              <h4>{t('developers.howToJoin.title')}</h4>
            </div>
            <ul className={styles['info-box-list']}>
              <li>
                <strong>{t('developers.howToJoin.invitationsSentBy')}</strong>
              </li>
              <li>
                <strong>{t('developers.howToJoin.checkNotifications')}</strong>
              </li>
              <li>
                <strong>{t('developers.howToJoin.contactLeadership')}</strong>
              </li>
            </ul>
            <button
              className={styles['cta-button-secondary']}
              onClick={() => onNavigate('/notifications')}
              type="button"
            >
              <MailIcon size={20} />
              <span>{t('developers.checkInvitations')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles['features-section']}>
        <h3 className={styles['features-title']}>{t('capabilities.title')}</h3>
        <div className={styles['welcome-features']}>
          <div className={styles['feature-card']}>
            <div className={styles['feature-icon']}>
              <UsersIcon size={24} />
            </div>
            <h4>{t('capabilities.teamCollaboration')}</h4>
            <p>{t('capabilities.teamCollaborationDesc')}</p>
          </div>
          <div className={styles['feature-card']}>
            <div className={styles['feature-icon']}>
              <ZapIcon size={24} />
            </div>
            <h4>{t('capabilities.sprintPlanning')}</h4>
            <p>{t('capabilities.sprintPlanningDesc')}</p>
          </div>
          <div className={styles['feature-card']}>
            <div className={styles['feature-icon']}>
              <ChartIcon size={24} />
            </div>
            <h4>{t('capabilities.progressTracking')}</h4>
            <p>{t('capabilities.progressTrackingDesc')}</p>
          </div>
          <div className={styles['feature-card']}>
            <div className={styles['feature-icon']}>
              <RocketIcon size={24} />
            </div>
            <h4>{t('capabilities.agileCeremonies')}</h4>
            <p>{t('capabilities.agileCeremoniesDesc')}</p>
          </div>
        </div>
      </div>

      <div className={styles['help-section']}>
        <div className={styles['help-icon']}>
          <LightbulbIcon size={20} />
        </div>
        <div className={styles['help-content']}>
          <h4>{t('help.title')}</h4>
          <p>{t('help.description')}</p>
        </div>
      </div>
    </div>
  );
};

export default TeamWelcome;
