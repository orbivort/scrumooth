import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import {
  getImpediments,
  getImpedimentById,
  createImpediment,
  updateImpediment,
  deleteImpediment,
  getImpedimentStats,
} from '../controllers/impediment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { GATE_CODES } from '@scrumooth/shared';

const router: RouterType = Router();

// An impediment records why a Scrum Team was blocked, so it belongs to the team that raised it.
// The team context guard resolves the team from the header/body/query, refuses a non-member with
// the module's own gate code, and attaches the caller's role — before any controller runs. The
// services re-assert the same membership and key every write on `{ id, teamId }`, so the rule
// also holds when a service is driven directly (as the Daily Scrum promotion path does).
router.use(authenticate);
router.use(
  createRequireTeamContext({
    messageKey: 'errors:impediment.teamMembersOnly',
    gateCode: GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY,
  })
);

const impedimentStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const impedimentPrioritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

/** A target date is an ISO date (`YYYY-MM-DD`) or an ISO timestamp; an empty value clears it. */
const targetDateSchema = z
  .string()
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(value)),
    'Invalid target date: expected an ISO date'
  )
  .nullish();

// Required-ness is left to `requireTeamContext` and the controllers, which answer 400 as the API
// documents; these schemas validate the *shape* of what is supplied, so a malformed status or
// identifier becomes a structured refusal instead of a Prisma error surfacing as a 500.
const teamQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  sprintId: z.string().uuid('Invalid sprint ID').optional(),
});

const impedimentIdSchema = z.object({
  id: z.string().uuid('Invalid impediment ID'),
});

const createImpedimentBodySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  sprintId: z.string().uuid('Invalid sprint ID').nullish(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  priority: impedimentPrioritySchema.optional(),
  targetDate: targetDateSchema,
});

const updateImpedimentBodySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  status: impedimentStatusSchema.optional(),
  resolution: z.string().optional(),
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  priority: impedimentPrioritySchema.optional(),
  targetDate: targetDateSchema,
});

router.get('/', validateQuery(teamQuerySchema), getImpediments);
router.get('/stats', validateQuery(teamQuerySchema), getImpedimentStats);
router.get(
  '/:id',
  validateParams(impedimentIdSchema),
  validateQuery(teamQuerySchema),
  getImpedimentById
);
router.post('/', validateBody(createImpedimentBodySchema), createImpediment);
router.put(
  '/:id',
  validateParams(impedimentIdSchema),
  validateBody(updateImpedimentBodySchema),
  updateImpediment
);
router.delete(
  '/:id',
  validateParams(impedimentIdSchema),
  validateQuery(teamQuerySchema),
  deleteImpediment
);

export default router;
