import { Router, type Router as RouterType } from 'express';
import * as healthCheckController from '../controllers/teamHealthCheck.controller';
import authenticate from '../middleware/auth.middleware';
import { validateParams, validateBody } from '../middleware/validation.middleware';
import { z } from 'zod';

const router: RouterType = Router();

router.use(authenticate);

const idSchema = z.object({ id: z.string().uuid('Invalid ID') });

const submitResponsesSchema = z.object({
  responses: z
    .array(
      z.object({
        scrumValue: z.enum(['COMMITMENT', 'FOCUS', 'OPENNESS', 'RESPECT', 'COURAGE']),
        score: z.number().int().min(1).max(5),
        anonymous: z.boolean().default(false),
      })
    )
    .min(1)
    .max(5),
});

router.post(
  '/:id/responses',
  validateParams(idSchema),
  validateBody(submitResponsesSchema),
  healthCheckController.submitResponses
);

/**
 * Health check results are scoped to the team the survey belongs to, and that team is only known
 * once the row is loaded -- the route has no `teamId` in its path.
 *
 * A role guard here would therefore be actively misleading: `requireRoles` falls back to "holds
 * this role in *any* team" when it cannot see a team, which let a Scrum Master of team A read team
 * B's values survey. The rule lives in the service, which resolves the health check's own team and
 * asserts the caller's role there (`GATE_HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY`).
 */
router.get('/:id/results', validateParams(idSchema), healthCheckController.getResults);

export default router;
