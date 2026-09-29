import type enCommon from '../../public/locales/en/common.json';
import type enAuth from '../../public/locales/en/auth.json';
import type enDashboard from '../../public/locales/en/dashboard.json';
import type enBacklog from '../../public/locales/en/backlog.json';
import type enSprint from '../../public/locales/en/sprint.json';
import type enDailyScrum from '../../public/locales/en/daily-scrum.json';
import type enImpediments from '../../public/locales/en/impediments.json';
import type enIncrements from '../../public/locales/en/increments.json';
import type enSprintReview from '../../public/locales/en/sprint-review.json';
import type enRetrospective from '../../public/locales/en/retrospective.json';
import type enReports from '../../public/locales/en/reports.json';
import type enTeam from '../../public/locales/en/team.json';
import type enSettings from '../../public/locales/en/settings.json';
import type enNotifications from '../../public/locales/en/notifications.json';
import type enErrors from '../../public/locales/en/errors.json';
import type enValidation from '../../public/locales/en/validation.json';
import type enScrumMasterDashboard from '../../public/locales/en/scrum-master-dashboard.json';
import type enTimebox from '../../public/locales/en/timebox.json';
import type enBarriers from '../../public/locales/en/barriers.json';
import type enAgreements from '../../public/locales/en/agreements.json';
import type enGate from '../../public/locales/en/gate.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      auth: typeof enAuth;
      dashboard: typeof enDashboard;
      backlog: typeof enBacklog;
      sprint: typeof enSprint;
      'daily-scrum': typeof enDailyScrum;
      impediments: typeof enImpediments;
      increments: typeof enIncrements;
      'sprint-review': typeof enSprintReview;
      retrospective: typeof enRetrospective;
      reports: typeof enReports;
      team: typeof enTeam;
      settings: typeof enSettings;
      notifications: typeof enNotifications;
      errors: typeof enErrors;
      validation: typeof enValidation;
      'scrum-master-dashboard': typeof enScrumMasterDashboard;
      timebox: typeof enTimebox;
      barriers: typeof enBarriers;
      agreements: typeof enAgreements;
      // The Scrum Guide rule behind each gate refusal, keyed by `GATE_DEFINITIONS[*].i18nKey`.
      gate: typeof enGate;
    };
  }
}
