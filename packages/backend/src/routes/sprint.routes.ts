// Sprint Routes
import { Router, type Router as RouterType } from 'express';
import * as sprintController from '../controllers/sprint.controller';
import * as smDashboardController from '../controllers/smDashboard.controller';
import { incrementSprintService } from '../services/sprint.service';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { asyncHandler, createSuccessResponse } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import { z } from 'zod';

const router: RouterType = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const sprintIdSchema = z.object({
  id: z.string().uuid('Invalid sprint ID'),
});

const sprintIdParamSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID'),
});

const taskIdSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID'),
  taskId: z.string().uuid('Invalid task ID'),
});

const createSprintSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  name: z.string().min(1, 'Name is required').max(100),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  sprintGoal: z.string().max(500).optional(),
  goalId: z.string().uuid().optional().nullable(),
});

const updateSprintSchema = createSprintSchema.partial().omit({ teamId: true });

const cancelSprintSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

const createTaskSchema = z.object({
  pbiId: z.string().uuid('Invalid PBI ID'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  estimatedHours: z.number().min(0).optional(),
  remainingHours: z.number().min(0).optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  estimatedHours: z.number().positive().optional(),
  remainingHours: z.number().min(0).optional(),
});

// The start transition no longer accepts a backlog/task payload: readiness is validated
// server-side against the backlog persisted via `saveSprintBacklog`. Any supplied body is
// intentionally ignored, so the schema stays minimal.
const startSprintSchema = z.object({}).strict();

const saveSprintBacklogSchema = z.object({
  items: z
    .array(
      z.object({
        pbiId: z.string().uuid('Invalid PBI ID'),
      })
    )
    .optional(),
  tasks: z
    .array(
      z.object({
        pbiId: z.string().uuid('Invalid PBI ID'),
        title: z.string().min(1, 'Task title is required').max(200),
        description: z.string().max(2000).optional(),
        assigneeId: z.string().uuid().optional().nullable(),
        estimatedHours: z.number().positive().optional(),
        remainingHours: z.number().min(0).optional(),
      })
    )
    .optional(),
});

// Sprint Planning attendance (Developers-only writes). Roles mirror the Sprint Review /
// Retrospective attendee contract so all three events record participation identically.
const planningAttendeeRoleSchema = z.enum(
  ['product_owner', 'scrum_master', 'developers', 'stakeholder'],
  { error: 'Invalid role selected' }
);

const planningAttendeeInputSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
  role: planningAttendeeRoleSchema,
  attended: z.boolean().default(true),
});

const updatePlanningAttendeeSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
    email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
    role: planningAttendeeRoleSchema.optional(),
    attended: z.boolean().optional(),
  })
  .strict();

const planningAttendeeIdSchema = z.object({
  id: z.string().uuid('Invalid sprint ID'),
  attendeeId: z.string().uuid('Invalid attendee ID'),
});

// Incremental Sprint Planning draft payload (selected PBIs, decomposed tasks, working
// Sprint Goal, recorded capacity, and an optional attendance snapshot). `strict()` rejects
// unknown fields so a stale client cannot drift the persisted state.
const saveSprintPlanningDraftSchema = z
  .object({
    items: z
      .array(
        z.object({
          pbiId: z.string().uuid('Invalid PBI ID'),
        })
      )
      .optional(),
    tasks: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          pbiId: z.string().uuid('Invalid PBI ID'),
          title: z.string().min(1, 'Task title is required').max(200),
          description: z.string().max(2000).optional(),
          assigneeId: z.string().uuid().optional().nullable(),
          estimatedHours: z.number().min(0).optional(),
          remainingHours: z.number().min(0).optional(),
        })
      )
      .optional(),
    sprintGoal: z.string().max(500).optional(),
    capacity: z
      .array(
        z.object({
          memberId: z.string().uuid().optional().nullable(),
          userId: z.string().uuid('Invalid user ID'),
          availableHours: z.number().min(0),
        })
      )
      .optional(),
    attendees: z.array(planningAttendeeInputSchema).optional(),
  })
  .strict();

const addPBIToSprintSchema = z.object({
  pbiId: z.string().uuid('Invalid PBI ID'),
  reason: z.string().max(500).optional(),
});

const removePBIFromSprintSchema = z.object({
  taskAction: z.enum(['delete', 'return_to_backlog', 'keep_in_sprint']),
  reason: z.string().max(500).optional(),
});

const pbiIdSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID'),
  pbiId: z.string().uuid('Invalid PBI ID'),
});

const teamQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
});

/**
 * @route   GET /api/v1/sprints
 * @desc    Get all sprints for a team
 * @access  Private
 */
router.get('/', validateQuery(teamQuerySchema), sprintController.getSprints);

/**
 * @route   GET /api/v1/sprints/active
 * @desc    Get active sprint for a team
 * @access  Private
 */
router.get('/active', validateQuery(teamQuerySchema), sprintController.getActiveSprint);

/**
 * @route   GET /api/v1/sprints/available-pbis
 * @desc    Get available PBIs for sprint (READY status, not in active sprint)
 * @access  Private
 */
router.get('/available-pbis', validateQuery(teamQuerySchema), sprintController.getAvailablePBIs);

/**
 * @route   POST /api/v1/sprints
 * @desc    Create a new sprint
 * @access  Private
 */
router.post('/', validateBody(createSprintSchema), sprintController.createSprint);

/**
 * @route   GET /api/v1/sprints/:id
 * @desc    Get sprint by ID
 * @access  Private
 */
router.get('/:id', validateParams(sprintIdSchema), sprintController.getSprintById);

/**
 * @route   PUT /api/v1/sprints/:id
 * @desc    Update sprint
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(sprintIdSchema),
  validateBody(updateSprintSchema),
  sprintController.getSprintById // TODO: implement updateSprint
);

/**
 * @route   POST /api/v1/sprints/:id/start
 * @desc    Start sprint
 * @access  Private
 */
router.post(
  '/:id/start',
  validateParams(sprintIdSchema),
  validateBody(startSprintSchema),
  sprintController.startSprint
);

/**
 * @route   POST /api/v1/sprints/:id/backlog
 * @desc    Save the Sprint Backlog draft for a PLANNED sprint (Developers-only)
 * @access  Private
 */
router.post(
  '/:id/backlog',
  validateParams(sprintIdSchema),
  validateBody(saveSprintBacklogSchema),
  sprintController.saveSprintBacklog
);

/**
 * @route   PUT /api/v1/sprints/:id/backlog/draft
 * @desc    Save the Sprint Planning draft incrementally (Developers-only)
 * @access  Private (Developers)
 */
router.put(
  '/:id/backlog/draft',
  validateParams(sprintIdSchema),
  validateBody(saveSprintPlanningDraftSchema),
  sprintController.saveSprintPlanningDraft
);

/**
 * @route   GET /api/v1/sprints/:id/planning-draft
 * @desc    Load the Sprint Planning draft for resume (read-only)
 * @access  Private (any authenticated team member)
 */
router.get(
  '/:id/planning-draft',
  validateParams(sprintIdSchema),
  sprintController.getSprintPlanningDraft
);

/**
 * @route   GET /api/v1/sprints/:id/planning-attendees
 * @desc    Read the recorded Sprint Planning participation (read-only)
 * @access  Private (any authenticated team member)
 */
router.get(
  '/:id/planning-attendees',
  validateParams(sprintIdSchema),
  sprintController.getPlanningParticipation
);

/**
 * @route   POST /api/v1/sprints/:id/planning-attendees
 * @desc    Record a Sprint Planning attendee (Developers-only)
 * @access  Private (Developers)
 */
router.post(
  '/:id/planning-attendees',
  validateParams(sprintIdSchema),
  validateBody(planningAttendeeInputSchema),
  sprintController.addPlanningAttendee
);

/**
 * @route   PUT /api/v1/sprints/:id/planning-attendees/:attendeeId
 * @desc    Update a recorded Sprint Planning attendee (Developers-only)
 * @access  Private (Developers)
 */
router.put(
  '/:id/planning-attendees/:attendeeId',
  validateParams(planningAttendeeIdSchema),
  validateBody(updatePlanningAttendeeSchema),
  sprintController.updatePlanningAttendee
);

/**
 * @route   DELETE /api/v1/sprints/:id/planning-attendees/:attendeeId
 * @desc    Remove a recorded Sprint Planning attendee (Developers-only)
 * @access  Private (Developers)
 */
router.delete(
  '/:id/planning-attendees/:attendeeId',
  validateParams(planningAttendeeIdSchema),
  sprintController.deletePlanningAttendee
);

/**
 * @route   POST /api/v1/sprints/:id/rollback
 * @desc    Rollback sprint start operation
 * @access  Private
 */
router.post('/:id/rollback', validateParams(sprintIdSchema), sprintController.rollbackSprintStart);

/**
 * @route   POST /api/v1/sprints/:id/complete
 * @desc    Complete sprint
 * @access  Private
 */
router.post('/:id/complete', validateParams(sprintIdSchema), sprintController.completeSprint);

/**
 * @route   POST /api/v1/sprints/:id/cancel
 * @desc    Cancel sprint
 * @access  Private
 */
router.post(
  '/:id/cancel',
  validateParams(sprintIdSchema),
  validateBody(cancelSprintSchema),
  sprintController.cancelSprint
);

/**
 * @route   GET /api/v1/sprints/:sprintId/burndown
 * @desc    Get burndown data
 * @access  Private
 */
router.get(
  '/:sprintId/burndown',
  validateParams(sprintIdParamSchema),
  sprintController.getBurndownData
);

// ==================== Sprint Tasks ====================

/**
 * @route   GET /api/v1/sprint-backlog/:sprintId/tasks
 * @desc    Get sprint tasks
 * @access  Private
 */
router.get(
  '/:sprintId/tasks',
  validateParams(sprintIdParamSchema),
  sprintController.getSprintTasks
);

/**
 * @route   POST /api/v1/sprint-backlog/:sprintId/tasks
 * @desc    Create task
 * @access  Private
 */
router.post(
  '/:sprintId/tasks',
  validateParams(sprintIdParamSchema),
  validateBody(createTaskSchema),
  sprintController.createTask
);

/**
 * @route   PUT /api/v1/sprint-backlog/:sprintId/tasks/:taskId
 * @desc    Update task
 * @access  Private
 */
router.put(
  '/:sprintId/tasks/:taskId',
  validateParams(taskIdSchema),
  validateBody(updateTaskSchema),
  sprintController.updateTask
);

/**
 * @route   DELETE /api/v1/sprint-backlog/:sprintId/tasks/:taskId
 * @desc    Delete task
 * @access  Private
 */
router.delete(
  '/:sprintId/tasks/:taskId',
  validateParams(taskIdSchema),
  sprintController.deleteTask
);

router.get(
  '/:sprintId/eligible-pbis',
  validateParams(sprintIdParamSchema),
  asyncHandler(async (req, res) => {
    const sprintId = getParamValue(req.params.sprintId);
    if (!sprintId) {
      throw new Error('Sprint ID is required');
    }
    const pbis = await incrementSprintService.getEligiblePBIsForIncrement(sprintId);
    res.json(createSuccessResponse(pbis));
  })
);

router.get(
  '/:sprintId/backlog-pbis',
  validateParams(sprintIdParamSchema),
  asyncHandler(async (req, res) => {
    const sprintId = getParamValue(req.params.sprintId);
    if (!sprintId) {
      throw new Error('Sprint ID is required');
    }
    const pbis = await incrementSprintService.getSprintBacklogPBIs(sprintId);
    res.json(createSuccessResponse(pbis));
  })
);

router.post(
  '/:sprintId/backlog-items',
  validateParams(sprintIdParamSchema),
  validateBody(addPBIToSprintSchema),
  sprintController.addPBIToSprint
);

router.delete(
  '/:sprintId/backlog-items/:pbiId',
  validateParams(pbiIdSchema),
  validateBody(removePBIFromSprintSchema),
  sprintController.removePBIFromSprint
);

router.get(
  '/:sprintId/backlog-changes',
  validateParams(sprintIdParamSchema),
  sprintController.getSprintBacklogChanges
);

/**
 * @route   GET /api/v1/sprints/:sprintId/dod-compliance
 * @desc    Get DoD compliance report for sprint
 * @access  Private
 */
router.get(
  '/:sprintId/dod-compliance',
  validateParams(sprintIdParamSchema),
  sprintController.getDoDComplianceReport
);

router.patch(
  '/:id/sm-notes',
  validateParams(sprintIdSchema),
  validateBody(z.object({ smNotes: z.string().max(5000).optional().default('') })),
  smDashboardController.updateSprintSmNotes
);

export default router;
