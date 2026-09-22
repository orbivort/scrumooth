import { Router, type Router as RouterType } from 'express';
import * as reportsController from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { REPORTS_TEAM_REFUSAL } from '../services/reportsAccess';

const router: RouterType = Router();

router.use(authenticate);

// A report reads one team's own observed history, so the team is resolved once, here, and a caller
// who is not a member of it is answered with the Reports module's own stable refusal rather than
// the generic 403. The service re-asserts the same rule, so this is the first of two gates rather
// than the only one.
router.use(
  createRequireTeamContext({
    messageKey: REPORTS_TEAM_REFUSAL.messageKey,
    gateCode: REPORTS_TEAM_REFUSAL.gateCode,
  })
);

router.get('/velocity', reportsController.getVelocityData);

router.get('/sprint-history', reportsController.getSprintHistory);

router.get('/metrics', reportsController.getTeamMetrics);

router.get('/insights', reportsController.getInsights);

export default router;
