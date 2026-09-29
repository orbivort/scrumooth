// Product Goals Routes
import { Router, type Router as RouterType } from 'express';
import * as goalsController from '../controllers/goals.controller';
import * as productGoalSnapshotController from '../controllers/productGoalSnapshot.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { z } from 'zod';

const router: RouterType = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createGoalSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  targetDate: z.string().datetime().optional().nullable(),
  // Scrum Guide: the Product Goal is a future state the team must be able to recognise as
  // reached, so its success metrics are required rather than optional.
  successMetrics: z
    .string({ error: 'errors:productGoal.successMetricsRequired' })
    .trim()
    .min(1, 'errors:productGoal.successMetricsRequired')
    .max(1000, 'Success metrics must be at most 1000 characters'),
  strategicAlignment: z.string().max(100).optional(),
  status: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.enum(['NEW', 'ACTIVE', 'COMPLETED', 'ABANDONED']))
    .optional(),
});

const updateGoalSchema = createGoalSchema
  .partial()
  .omit({ teamId: true })
  .extend({
    status: z
      .string()
      .transform((val) => val.toUpperCase())
      .pipe(z.enum(['NEW', 'ACTIVE', 'COMPLETED', 'ABANDONED']))
      .optional(),
    // Rationale for the status change. The service requires it when the target status is
    // ABANDONED; it is persisted in the status history rather than in a dedicated column.
    reason: z.string().max(5000).optional(),
  });

const goalIdSchema = z.object({
  id: z.string().min(1, 'Goal ID is required'),
});

const querySchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
});

/**
 * @route   GET /api/v1/product-goals
 * @desc    Get product goals for a team
 * @access  Private
 */
router.get('/', validateQuery(querySchema), goalsController.getProductGoals);

/**
 * @route   GET /api/v1/product-goals/active
 * @desc    Get active product goal for a team
 * @access  Private
 */
router.get('/active', validateQuery(querySchema), goalsController.getActiveProductGoal);

/**
 * @route   POST /api/v1/product-goals
 * @desc    Create a new product goal
 * @access  Private
 */
router.post('/', validateBody(createGoalSchema), goalsController.createProductGoal);

/**
 * @route   GET /api/v1/product-goals/:id
 * @desc    Get product goal by ID
 * @access  Private
 */
router.get('/:id', validateParams(goalIdSchema), goalsController.getProductGoalById);

/**
 * @route   PUT /api/v1/product-goals/:id
 * @desc    Update a product goal
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(goalIdSchema),
  validateBody(updateGoalSchema),
  goalsController.updateProductGoal
);

/**
 * @route   DELETE /api/v1/product-goals/:id
 * @desc    Delete a product goal
 * @access  Private
 */
router.delete('/:id', validateParams(goalIdSchema), goalsController.deleteProductGoal);

/**
 * @route   GET /api/v1/product-goals/:id/status-history
 * @desc    Get status change history for a product goal
 * @access  Private
 */
router.get(
  '/:id/status-history',
  validateParams(goalIdSchema),
  goalsController.getProductGoalStatusHistory
);

/**
 * @route   GET /api/v1/product-goals/:id/snapshots
 * @desc    Get Product Goal progress snapshots across Sprint Reviews
 * @access  Private
 */
router.get(
  '/:id/snapshots',
  validateParams(goalIdSchema),
  productGoalSnapshotController.getGoalSnapshots
);

export default router;
