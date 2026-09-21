import { Router, type Router as RouterType } from 'express';
import * as dailyScrumController from '../controllers/dailyScrum.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { z } from 'zod';
import { DAILY_SCRUM_FOCUS_MODES } from '@scrumooth/shared';

const router: RouterType = Router();

router.use(authenticate);

const sprintIdParamSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID'),
});

const dailyScrumIdParamSchema = z.object({
  id: z.string().uuid('Invalid Daily Scrum ID'),
});

const dateQuerySchema = z.object({
  date: z.string().optional(),
});

const backlogAdjustmentSchema = z.object({
  sprintBacklogItemId: z.string().uuid('Invalid Sprint Backlog item ID'),
  action: z.string().min(1, 'Action is required').max(500),
});

// The Daily Scrum must produce an actionable plan for the next day (Scrum Guide).
// Progress and adaptations stay optional so the Developers can choose their structure,
// but a plan is the required output of the event.
const requirePlan = (data: { planForNextDay?: string }, ctx: z.RefinementCtx) => {
  if (!data.planForNextDay?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['planForNextDay'],
      message: 'validation:dailyScrum.planRequired',
    });
  }
};

// The Developers choose the structure of the Daily Scrum (Scrum Guide). The
// focus mode is persisted on the shared record so the whole team can see it,
// but it must be one of the known modes.
const focusModeSchema = z.enum(DAILY_SCRUM_FOCUS_MODES).nullable().optional().default(null);

// The Inspect & Adapt record is authored per date. `scrumDate` is optional so a
// create without it defaults to today; when provided it must be a YYYY-MM-DD date.
const createDailyScrumSchema = z
  .object({
    scrumDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD')
      .optional(),
    progressNotes: z.string().max(2000).optional(),
    adaptationsNotes: z.string().max(2000).optional(),
    planForNextDay: z.string().max(2000).optional(),
    focusMode: focusModeSchema,
    backlogAdjustments: z.array(backlogAdjustmentSchema).max(50).optional(),
  })
  .superRefine(requirePlan);

const updateDailyScrumSchema = z
  .object({
    progressNotes: z.string().max(2000).optional(),
    adaptationsNotes: z.string().max(2000).optional(),
    planForNextDay: z.string().max(2000).optional(),
    focusMode: focusModeSchema,
    backlogAdjustments: z.array(backlogAdjustmentSchema).max(50).optional(),
  })
  .superRefine(requirePlan);

const promoteImpedimentSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  ownerId: z.string().uuid().optional(),
  // Team is derived server-side from the Daily Scrum record; sprint is optional
  // and defaults to the Daily Scrum's sprint when omitted.
  sprintId: z.string().uuid().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  targetDate: z
    .string()
    .refine(
      (value) => value === '' || !Number.isNaN(Date.parse(value)),
      'Invalid target date: expected an ISO date'
    )
    .nullish(),
});

/**
 * @route   GET /api/v1/daily-scrums/:sprintId/today
 * @desc    Get the team-level Daily Scrum for a sprint (default today)
 * @access  Private
 */
router.get(
  '/:sprintId/today',
  validateParams(sprintIdParamSchema),
  validateQuery(dateQuerySchema),
  dailyScrumController.getDailyScrum
);

/**
 * @route   GET /api/v1/daily-scrums/:sprintId
 * @desc    Get all Daily Scrums for a sprint
 * @access  Private
 */
router.get(
  '/:sprintId',
  validateParams(sprintIdParamSchema),
  validateQuery(dateQuerySchema),
  dailyScrumController.getDailyScrums
);

/**
 * @route   GET /api/v1/daily-scrums/:sprintId/participation
 * @desc    Get Daily Scrum participation for a sprint on a date
 * @access  Private
 */
router.get(
  '/:sprintId/participation',
  validateParams(sprintIdParamSchema),
  validateQuery(dateQuerySchema),
  dailyScrumController.getParticipation
);

/**
 * @route   POST /api/v1/daily-scrums/:sprintId
 * @desc    Create the team-level Daily Scrum for a sprint
 * @access  Private
 */
router.post(
  '/:sprintId',
  validateParams(sprintIdParamSchema),
  validateBody(createDailyScrumSchema),
  dailyScrumController.createDailyScrum
);

/**
 * @route   GET /api/v1/daily-scrums/record/:id
 * @desc    Get a Daily Scrum by ID
 * @access  Private
 */
router.get(
  '/record/:id',
  validateParams(dailyScrumIdParamSchema),
  dailyScrumController.getDailyScrumById
);

/**
 * @route   PUT /api/v1/daily-scrums/record/:id
 * @desc    Update the team-level Daily Scrum by ID
 * @access  Private
 */
router.put(
  '/record/:id',
  validateParams(dailyScrumIdParamSchema),
  validateBody(updateDailyScrumSchema),
  dailyScrumController.updateDailyScrum
);

/**
 * @route   POST /api/v1/daily-scrums/record/:id/participate
 * @desc    Record the current user as a participant of the Daily Scrum
 * @access  Private
 */
router.post(
  '/record/:id/participate',
  validateParams(dailyScrumIdParamSchema),
  dailyScrumController.recordParticipation
);

/**
 * @route   POST /api/v1/daily-scrums/:id/promote-impediment
 * @desc    Promote an impediment raised in a Daily Scrum to a formal record
 * @access  Private
 */
router.post(
  '/:id/promote-impediment',
  validateParams(dailyScrumIdParamSchema),
  validateBody(promoteImpedimentSchema),
  dailyScrumController.promoteToImpediment
);

/**
 * @route   POST /api/v1/daily-scrums/:sprintId/team-signal
 * @desc    Send a neutral team-wide Daily Scrum signal to the team
 * @access  Private
 */
router.post(
  '/:sprintId/team-signal',
  validateParams(sprintIdParamSchema),
  dailyScrumController.sendTeamSignal
);

export default router;
