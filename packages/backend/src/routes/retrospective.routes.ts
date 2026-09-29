import express, { type Router as RouterType } from 'express';
import authenticate from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  updateRetrospectiveSmNotes,
  getRetrospectiveSmNotesRevisions,
} from '../controllers/smDashboard.controller';
import { GATE_CODES } from '@scrumooth/shared';
import { z } from 'zod';
import {
  getRetrospectives,
  getRetrospectiveById,
  getRetrospectiveBySprintId,
  createRetrospective,
  addItem,
  voteItem,
  unvoteItem,
  updateItem,
  deleteItem,
  updateRetrospective,
  addActionItem,
  updateActionItem,
  deleteActionItem,
  getPendingActionItems,
  addRetroAttendee,
  updateRetroAttendee,
  deleteRetroAttendee,
  applyDodChanges,
  materializeActionItem,
  linkActionItemToPbi,
} from '../controllers/retrospective.controller';
import {
  createRetrospectiveSchema,
  addItemSchema,
  updateItemSchema,
  addActionItemSchema,
  updateActionItemSchema,
  updateRetrospectiveSchema,
  addAttendeeSchema,
  updateAttendeeSchema,
  linkActionItemSchema,
} from '../validations/retrospective.validation';

const router: RouterType = express.Router();

/**
 * The Retrospective belongs to the Scrum Team whose Sprint it concludes, so a route that names its
 * team can refuse a non-member before the handler runs. Routes that identify the Retrospective by
 * its own id cannot: the owning team is only known once the row is loaded, so those rely on the
 * service-layer assertion (which every handler performs as well, so neither layer is the only gate).
 */
const requireRetrospectiveTeamContext = createRequireTeamContext({
  messageKey: 'errors:retrospective.teamMembersOnly',
  gateCode: GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY,
});

router.get('/team/:teamId', authenticate, requireRetrospectiveTeamContext, getRetrospectives);
router.get(
  '/team/:teamId/pending-action-items',
  authenticate,
  requireRetrospectiveTeamContext,
  getPendingActionItems
);
router.get('/:id', authenticate, getRetrospectiveById);
router.get('/sprint/:sprintId', authenticate, getRetrospectiveBySprintId);
router.post('/', authenticate, validateBody(createRetrospectiveSchema), createRetrospective);

// Registered before the parameterised action-item routes below: `/:retroId/action-items/:id` also
// matches `/action-items/<pbi>/link`, and the action item id would silently be read as a
// Retrospective id.
router.post('/action-items/:actionItemId/materialize', authenticate, materializeActionItem);
router.put(
  '/action-items/:actionItemId/link',
  authenticate,
  validateBody(linkActionItemSchema),
  linkActionItemToPbi
);

router.post('/:retroId/items', authenticate, validateBody(addItemSchema), addItem);
router.post('/:retroId/items/:itemId/vote', authenticate, voteItem);
router.delete('/:retroId/items/:itemId/vote', authenticate, unvoteItem);
router.put('/:retroId/items/:itemId', authenticate, validateBody(updateItemSchema), updateItem);
router.delete('/:retroId/items/:itemId', authenticate, deleteItem);

router.put('/:id', authenticate, validateBody(updateRetrospectiveSchema), updateRetrospective);

// Applying the Definition of Done changes takes no body: the accepted change set is the reflection
// the Retrospective already recorded, so a client cannot substitute a different set for it.
router.post('/:id/apply-dod-changes', authenticate, applyDodChanges);

router.post(
  '/:retroId/action-items',
  authenticate,
  validateBody(addActionItemSchema),
  addActionItem
);
router.put(
  '/:retroId/action-items/:actionItemId',
  authenticate,
  validateBody(updateActionItemSchema),
  updateActionItem
);
router.delete('/:retroId/action-items/:actionItemId', authenticate, deleteActionItem);

router.post('/:retroId/attendees', authenticate, validateBody(addAttendeeSchema), addRetroAttendee);
router.put(
  '/attendees/:attendeeId',
  authenticate,
  validateBody(updateAttendeeSchema),
  updateRetroAttendee
);
router.delete('/attendees/:attendeeId', authenticate, deleteRetroAttendee);

router.patch(
  '/:id/sm-notes',
  authenticate,
  validateBody(z.object({ smNotes: z.string().max(5000).optional().default('') })),
  updateRetrospectiveSmNotes
);

/**
 * @route   GET /api/v1/retrospectives/:id/sm-notes/revisions
 * @desc    The Scrum Master's notes history for a Sprint Retrospective, newest first
 * @access  Private (the team's Scrum Master)
 */
router.get('/:id/sm-notes/revisions', authenticate, getRetrospectiveSmNotesRevisions);

export default router;
