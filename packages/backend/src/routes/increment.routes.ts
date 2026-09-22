import { Router, type Router as RouterType } from 'express';
import * as incrementController from '../controllers/increment.controller';
import * as incrementIntegrationController from '../controllers/incrementIntegration.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { GATE_CODES } from '@scrumooth/shared';
import { z } from 'zod';

const router: RouterType = Router();

router.use(authenticate);

// The Increment belongs to its Scrum Team, so the collection routes carry a team context guard
// that refuses a non-member with the module's own gate code. The `/:id` routes below cannot use it
// (there is no team id in the path, and resolving one would require loading the Increment twice):
// they are guarded inside the services instead, so the rule also holds when a service is driven
// directly rather than through a route.
const requireIncrementTeamContext = createRequireTeamContext({
  messageKey: 'errors:increment.teamMembersOnly',
  gateCode: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
});

const incrementIdSchema = z.object({
  id: z.string().uuid('Invalid increment ID'),
});

const teamQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  sprintId: z.string().uuid('Invalid sprint ID').optional(),
});

const createIncrementSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  sprintId: z.string().uuid('Invalid sprint ID'),
  teamId: z.string().uuid('Invalid team ID'),
  includedPBIs: z.array(z.string().uuid()).default([]),
  // Accepted for compatibility but derived server-side from the items the Increment contains.
  totalStoryPoints: z.number().int().min(0).optional(),
  // An Increment is always created as a draft: the gates on the way to VERIFIED and DELIVERED are
  // walked, not declared. A caller asking for a later status is refused rather than silently
  // downgraded.
  status: z.literal('DRAFT').default('DRAFT'),
  createdBy: z.string().uuid().optional(),
});

// `DELIVERED` stays in the enum on purpose: the request reaches the service, which refuses it with
// the documented gate code and points at the deliver action. Rejecting it here instead would answer
// a 422 that says nothing about how to deliver an Increment.
const updateIncrementSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  includedPBIs: z.array(z.string().uuid()).optional(),
  totalStoryPoints: z.number().int().min(0).optional(),
  status: z.enum(['DRAFT', 'VERIFIED', 'DELIVERED', 'ARCHIVED']).optional(),
});

const deliverIncrementSchema = z.object({
  deliveryMethod: z.enum(['sprint_review', 'early_release']),
  notes: z.string().max(2000).optional(),
});

// A usability attestation is evidence, so it must say something. An empty string would satisfy the
// gate without carrying a fact.
const attestUsabilitySchema = z.object({
  evidence: z.string().trim().min(1, 'Evidence is required').max(2000),
});

const reconcileIncrementSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  sprintId: z.string().uuid('Invalid sprint ID'),
});

router.get(
  '/',
  validateQuery(teamQuerySchema),
  requireIncrementTeamContext,
  incrementController.getIncrements
);

router.get(
  '/metrics',
  validateQuery(z.object({ teamId: z.string().uuid('Invalid team ID') })),
  requireIncrementTeamContext,
  incrementController.getIncrementMetrics
);

/**
 * Recompose a Sprint's open Increment from its Done items. The repair path for a composition that
 * was skipped or failed when an item was marked Done.
 */
router.post(
  '/reconcile',
  validateBody(reconcileIncrementSchema),
  requireIncrementTeamContext,
  incrementController.reconcileSprintIncrement
);

router.get('/:id', validateParams(incrementIdSchema), incrementController.getIncrementById);

router.post(
  '/',
  validateBody(createIncrementSchema),
  requireIncrementTeamContext,
  incrementController.createIncrement
);

router.put(
  '/:id',
  validateParams(incrementIdSchema),
  validateBody(updateIncrementSchema),
  incrementController.updateIncrement
);

router.post(
  '/:id/deliver',
  validateParams(incrementIdSchema),
  validateBody(deliverIncrementSchema),
  incrementController.deliverIncrement
);

/**
 * Record the written evidence that the Increment is "in usable condition", required before it can
 * be verified or delivered.
 */
router.post(
  '/:id/verify-usability',
  validateParams(incrementIdSchema),
  validateBody(attestUsabilitySchema),
  incrementController.attestUsability
);

// --- Increment integration verification ---
const createIntegrationTestSchema = z.object({
  priorIncrementId: z.string().uuid('Invalid prior increment ID'),
  testResult: z.enum(['PASSED', 'FAILED'], 'Invalid test result'),
  notes: z.string().max(2000).optional(),
});

router.post(
  '/:id/integration-tests',
  validateParams(incrementIdSchema),
  validateBody(createIntegrationTestSchema),
  incrementIntegrationController.createIntegrationTest
);

router.get(
  '/:id/integration-tests',
  validateParams(incrementIdSchema),
  incrementIntegrationController.getIntegrationTests
);

router.post(
  '/:id/verify-integration',
  validateParams(incrementIdSchema),
  incrementIntegrationController.verifyIntegration
);

router.get(
  '/:id/chain',
  validateParams(incrementIdSchema),
  incrementIntegrationController.getIncrementChain
);

export default router;
