// Product Backlog Routes
import { Router, type Router as RouterType } from 'express';
import * as backlogController from '../controllers/backlog.controller';
import * as dodController from '../controllers/dod.controller';
import * as dorController from '../controllers/dor.controller';
import * as sprintController from '../controllers/sprint.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { z } from 'zod';

const router: RouterType = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createPBISchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  // Optional by design: the service auto-links the item to the team's ACTIVE Product Goal
  // when omitted, and rejects the request when the team has no ACTIVE goal. A supplied goal
  // must belong to the team and be the ACTIVE one.
  goalId: z.string().uuid('Invalid goal ID').optional().nullable(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  storyPoints: z.number().int().min(1).max(100).optional().nullable(),
  priority: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'COULD_HAVE', 'WONT_HAVE']).optional(),
  businessValue: z.number().int().min(1).max(100).optional().nullable(),
  labels: z.array(z.string()).optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
  status: z.enum(['NEW', 'REFINED', 'READY', 'IN_PROGRESS', 'DONE']).optional(),
});

const updatePBISchema = createPBISchema.partial().omit({ teamId: true });

const prioritySchema = z.object({
  priority: z.enum(['MUST_HAVE', 'SHOULD_HAVE', 'COULD_HAVE', 'WONT_HAVE']),
});

const reorderSchema = z.object({
  pbiIds: z.array(z.string().uuid()),
});

const pbiIdSchema = z.object({
  id: z.string().uuid('Invalid PBI ID'),
});

const verifyDoDSchema = z.object({
  verifications: z.array(
    z.object({
      dodItemId: z.string().uuid('Invalid DoD item ID'),
      isVerified: z.boolean(),
      notes: z.string().optional(),
    })
  ),
});

const verifyDoRSchema = z.object({
  verifications: z.array(
    z.object({
      dorItemId: z.string().uuid('Invalid DoR item ID'),
      isVerified: z.boolean(),
      notes: z.string().optional(),
    })
  ),
});

const querySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  status: z.enum(['NEW', 'REFINED', 'READY', 'IN_PROGRESS', 'DONE']).optional(),
  labels: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const bulkCreateSchema = z
  .array(
    createPBISchema.extend({
      _rowNumber: z.number().int().positive(),
    })
  )
  .min(1, 'At least one item is required')
  .max(200, 'Maximum 200 items per bulk request');

/**
 * @route   GET /api/v1/product-backlog
 * @desc    Get product backlog for a team
 * @access  Private
 */
router.get('/', validateQuery(querySchema), backlogController.getProductBacklog);

/**
 * @route   POST /api/v1/product-backlog
 * @desc    Create a new PBI
 * @access  Private
 */
router.post('/', validateBody(createPBISchema), backlogController.createPBI);

/**
 * @route   POST /api/v1/product-backlog/bulk
 * @desc    Bulk create PBIs
 * @access  Private
 * @note    This route must be placed before GET /:id to avoid
 *          Express matching "bulk" as an :id parameter on GET requests.
 *          Since POST vs GET are method-specific, this is safe,
 *          but be aware of the ordering convention.
 */
router.post('/bulk', validateBody(bulkCreateSchema), backlogController.createPBIBulk);

/**
 * @route   GET /api/v1/product-backlog/count
 * @desc    Get count of backlog items for a goal
 * @access  Private
 */
router.get('/count', backlogController.getBacklogItemCount);

/**
 * @route   GET /api/v1/product-backlog/:id
 * @desc    Get PBI by ID
 * @access  Private
 */
router.get('/:id', validateParams(pbiIdSchema), backlogController.getPBIById);

/**
 * @route   PUT /api/v1/product-backlog/:id
 * @desc    Update a PBI
 * @access  Private
 */
router.put(
  '/:id',
  validateParams(pbiIdSchema),
  validateBody(updatePBISchema),
  backlogController.updatePBI
);

/**
 * @route   PUT /api/v1/product-backlog/:id/priority
 * @desc    Update PBI priority
 * @access  Private
 */
router.put(
  '/:id/priority',
  validateParams(pbiIdSchema),
  validateBody(prioritySchema),
  backlogController.updatePriority
);

/**
 * @route   DELETE /api/v1/product-backlog/:id
 * @desc    Delete a PBI
 * @access  Private
 */
router.delete('/:id', validateParams(pbiIdSchema), backlogController.deletePBI);

/**
 * @route   GET /api/v1/product-backlog/:id/tasks
 * @desc    Get tasks for a PBI
 * @access  Private
 */
router.get('/:id/tasks', validateParams(pbiIdSchema), sprintController.getTasksByPbiId);

/**
 * @route   POST /api/v1/product-backlog/:id/verify-dod
 * @desc    Verify DoD for a PBI
 * @access  Private
 */
router.post(
  '/:id/verify-dod',
  validateParams(pbiIdSchema),
  validateBody(verifyDoDSchema),
  dodController.verifyDoDForPBI
);

/**
 * @route   GET /api/v1/product-backlog/:id/dod-verifications
 * @desc    Get DoD verifications for a PBI
 * @access  Private
 */
router.get(
  '/:id/dod-verifications',
  validateParams(pbiIdSchema),
  dodController.getDoDVerificationsForPBI
);

/**
 * @route   POST /api/v1/product-backlog/:id/verify-dor
 * @desc    Verify DoR for a PBI
 * @access  Private
 */
router.post(
  '/:id/verify-dor',
  validateParams(pbiIdSchema),
  validateBody(verifyDoRSchema),
  dorController.verifyDoRForPBI
);

/**
 * @route   GET /api/v1/product-backlog/:id/dor-verifications
 * @desc    Get DoR verifications for a PBI
 * @access  Private
 */
router.get(
  '/:id/dor-verifications',
  validateParams(pbiIdSchema),
  dorController.getDoRVerificationsForPBI
);

/**
 * @route   POST /api/v1/product-backlog/reorder
 * @desc    Reorder PBIs
 * @access  Private
 */
router.post('/reorder', validateBody(reorderSchema), backlogController.reorderPBIs);

export default router;
