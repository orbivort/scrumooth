import { Router, type Router as RouterType } from 'express';
import * as sprintReviewController from '../controllers/sprintReview.controller';
import * as smDashboardController from '../controllers/smDashboard.controller';
import * as productGoalSnapshotController from '../controllers/productGoalSnapshot.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { z } from 'zod';

const router: RouterType = Router();

router.use(authenticate);

const reviewIdSchema = z.object({
  id: z.string().uuid('Invalid review ID'),
});

const teamQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  sprintId: z.string().uuid('Invalid sprint ID').optional(),
});

const createReviewSchema = z.object({
  sprintId: z.string().uuid('Invalid sprint ID'),
  teamId: z.string().uuid('Invalid team ID'),
  incrementId: z.string().uuid('Invalid increment ID').optional(),
  reviewDate: z.string().transform((val) => new Date(val)),
  summary: z.string().max(2000).optional(),
});

const updateReviewSchema = z.object({
  summary: z.string().max(2000).optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
  reviewDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  attendees: z
    .array(
      z.object({
        name: z.string(),
        email: z.string().email().optional(),
        role: z.string(),
        attended: z.boolean(),
      })
    )
    .optional(),
  feedback: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        authorName: z.string(),
        content: z.string(),
        productGoalAssessment: z.string().max(2000).optional(),
        category: z.enum(['positive', 'negative', 'suggestion', 'question']),
        relatedPbiId: z.string().uuid().nullable().optional(),
        actionRequired: z.boolean().optional(),
        actionTaken: z.boolean().optional(),
        ownerId: z.string().uuid().nullable().optional(),
      })
    )
    .optional(),
  backlogAdjustments: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        action: z.enum(['add', 'modify', 'remove', 'reorder', 'split']),
        description: z.string(),
        reason: z.string(),
        pbiId: z.string().uuid().nullable().optional(),
        implemented: z.boolean().optional(),
        ownerId: z.string().uuid().nullable().optional(),
      })
    )
    .optional(),
});

const addFeedbackSchema = z.object({
  authorName: z.string().min(1, 'Author name is required'),
  content: z.string().min(1, 'Feedback content is required'),
  productGoalAssessment: z.string().max(2000).optional(),
  category: z.enum(['positive', 'negative', 'suggestion', 'question']).default('positive'),
  relatedPbiId: z.string().uuid().nullable().optional(),
  actionRequired: z.boolean().default(false),
  ownerId: z.string().uuid().nullable().optional(),
});

const attendeeRoleSchema = z.enum(['product_owner', 'scrum_master', 'developers', 'stakeholder'], {
  error: 'Invalid role selected',
});

const addAttendeeSchema = z.object({
  // Linking an attendee to a registered user is optional: a genuinely external stakeholder is
  // recorded with free-text name/email instead.
  userId: z.string().uuid('Invalid user ID').nullable().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
  role: attendeeRoleSchema,
  attended: z.boolean().default(true),
});

const updateAttendeeSchema = z.object({
  userId: z.string().uuid('Invalid user ID').nullable().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  email: z.string().email('Invalid email format').max(255).optional().or(z.literal('')),
  role: attendeeRoleSchema.optional(),
  attended: z.boolean().optional(),
});

const materializeAdjustmentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  storyPoints: z.number().int().positive().optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
});

const linkAdjustmentSchema = z.object({
  pbiId: z.string().uuid('Invalid product backlog item ID'),
});

router.get('/', validateQuery(teamQuerySchema), sprintReviewController.getSprintReviews);

router.get(
  '/adjustments/pending',
  validateQuery(z.object({ teamId: z.string().uuid('Invalid team ID') })),
  sprintReviewController.getPendingAdjustments
);

router.put(
  '/adjustments/:id/implement',
  validateParams(z.object({ id: z.string().uuid('Invalid adjustment ID') })),
  sprintReviewController.markAdjustmentImplemented
);

router.post(
  '/adjustments/:id/materialize',
  validateParams(z.object({ id: z.string().uuid('Invalid adjustment ID') })),
  validateBody(materializeAdjustmentSchema),
  sprintReviewController.materializeAdjustment
);

router.put(
  '/adjustments/:id/link',
  validateParams(z.object({ id: z.string().uuid('Invalid adjustment ID') })),
  validateBody(linkAdjustmentSchema),
  sprintReviewController.linkAdjustmentToPbi
);

router.get(
  '/feedback/pending',
  validateQuery(z.object({ teamId: z.string().uuid('Invalid team ID') })),
  sprintReviewController.getPendingFeedback
);

router.put(
  '/feedback/:id/address',
  validateParams(z.object({ id: z.string().uuid('Invalid feedback ID') })),
  sprintReviewController.markFeedbackAddressed
);

router.get('/:id', validateParams(reviewIdSchema), sprintReviewController.getSprintReviewById);

router.post('/', validateBody(createReviewSchema), sprintReviewController.createSprintReview);

router.put(
  '/:id',
  validateParams(reviewIdSchema),
  validateBody(updateReviewSchema),
  sprintReviewController.updateSprintReview
);

router.post(
  '/:id/feedback',
  validateParams(reviewIdSchema),
  validateBody(addFeedbackSchema),
  sprintReviewController.addStakeholderFeedback
);

router.post(
  '/:reviewId/attendees',
  validateParams(z.object({ reviewId: z.string().uuid('Invalid review ID') })),
  validateBody(addAttendeeSchema),
  sprintReviewController.addAttendee
);

router.put(
  '/attendees/:id',
  validateParams(z.object({ id: z.string().uuid('Invalid attendee ID') })),
  validateBody(updateAttendeeSchema),
  sprintReviewController.updateAttendee
);

router.delete(
  '/attendees/:id',
  validateParams(z.object({ id: z.string().uuid('Invalid attendee ID') })),
  sprintReviewController.deleteAttendee
);

router.patch(
  '/:id/sm-notes',
  validateParams(reviewIdSchema),
  validateBody(z.object({ smNotes: z.string().max(5000).optional().default('') })),
  smDashboardController.updateSprintReviewSmNotes
);

// Product Goal integration at Sprint Review
router.get(
  '/:id/product-goal',
  validateParams(reviewIdSchema),
  productGoalSnapshotController.getProductGoalForReview
);

router.post(
  '/:id/product-goal-assessment',
  validateParams(reviewIdSchema),
  validateBody(
    z
      .object({
        assessment: z.string().max(5000).optional(),
        successMetricValues: z.record(z.string(), z.any()).optional(),
      })
      // A snapshot is the evidence a Product Goal is judged against, so an empty payload is
      // not a valid snapshot: it must carry an assessment or at least one measured value.
      .refine(
        (value) =>
          (value.assessment?.trim().length ?? 0) > 0 ||
          Object.keys(value.successMetricValues ?? {}).length > 0,
        { message: 'errors:productGoal.snapshotEvidenceRequired' }
      )
  ),
  productGoalSnapshotController.submitProductGoalAssessment
);

router.delete('/:id', validateParams(reviewIdSchema), sprintReviewController.deleteSprintReview);

export default router;
