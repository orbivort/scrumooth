// Organizational barrier routes.
//
// Reads require membership of the team the register belongs to; writes require that team's Scrum
// Master. Routes that carry a `teamId` (list, stats, create, escalate) assert the team context
// before the handler runs; routes addressed by a barrier id cannot, because the barrier's team is
// only known once the row is loaded -- the service resolves it there and asserts the same rules, so
// the absence of a route guard is not an absence of the rule.
import { Router, type Router as RouterType } from 'express';
import {
  getBarriers,
  getBarrierStats,
  getBarrierById,
  createBarrier,
  escalateImpediment,
  updateBarrier,
  deleteBarrier,
  addStakeholderAction,
  updateStakeholderAction,
  deleteStakeholderAction,
  getEscalatableImpediments,
} from '../controllers/organizationalBarrier.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { GATE_CODES } from '@scrumooth/shared';
import {
  actionIdSchema,
  barrierIdSchema,
  barrierListQuerySchema,
  createActionSchema,
  createBarrierSchema,
  escalateImpedimentSchema,
  updateActionSchema,
  updateBarrierSchema,
} from '../validations/organizationalBarrier.validation';

const router: RouterType = Router();

const requireBarrierTeamContext = createRequireTeamContext({
  messageKey: 'errors:organizationalBarrier.teamMembersOnly',
  gateCode: GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
});

router.use(authenticate);

router.get('/', requireBarrierTeamContext, validateQuery(barrierListQuerySchema), getBarriers);

router.get(
  '/stats',
  requireBarrierTeamContext,
  validateQuery(barrierListQuerySchema),
  getBarrierStats
);

// The escalation dialog's source list. Declared before `/:id` so the literal path matches first.
router.get(
  '/escalatable-impediments',
  requireBarrierTeamContext,
  validateQuery(barrierListQuerySchema),
  getEscalatableImpediments
);

router.post('/', requireBarrierTeamContext, validateBody(createBarrierSchema), createBarrier);

router.post(
  '/escalate',
  requireBarrierTeamContext,
  validateBody(escalateImpedimentSchema),
  escalateImpediment
);

// An action is addressed by its own id, so these come before the `/:id` routes: otherwise
// `PUT /actions/:actionId` would be matched as `PUT /:id` with `id = "actions"`.
router.put(
  '/actions/:actionId',
  validateParams(actionIdSchema),
  validateBody(updateActionSchema),
  updateStakeholderAction
);

router.delete('/actions/:actionId', validateParams(actionIdSchema), deleteStakeholderAction);

router.get('/:id', validateParams(barrierIdSchema), getBarrierById);

router.put(
  '/:id',
  validateParams(barrierIdSchema),
  validateBody(updateBarrierSchema),
  updateBarrier
);

router.delete('/:id', validateParams(barrierIdSchema), deleteBarrier);

// An action is created inside its barrier, so the barrier id is the path and the rest is the body.
router.post(
  '/:id/actions',
  validateParams(barrierIdSchema),
  validateBody(createActionSchema),
  addStakeholderAction
);

export default router;
