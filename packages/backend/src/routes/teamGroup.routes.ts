// Team group routes.
//
// A group is the Scrum Teams working together on one product, and the group owns the single
// Definition of Done they all comply with. Who may do what is decided by the service, which loads
// the group's roster and resolves the caller's role *in one of its teams* -- a role held elsewhere
// is not a role here, the same rule the health-check results follow.
//
// Two reads are deliberately open to any authenticated caller, and both are needed for the rule to
// be satisfiable at all:
//
//  * the directory, so a team can find the collaboration it shares a product with;
//  * a group's shared Definition of Done, because a commitment a team may not read before adopting
//    it is not one the teams "mutually defined".
//
// Everything else -- renaming, removing, changing the shared Definition of Done -- is the
// leadership of a member team, and reading the roster is the group's own business.
import { Router, type Router as RouterType } from 'express';
import {
  listTeamGroups,
  getTeamGroup,
  createTeamGroup,
  updateTeamGroup,
  deleteTeamGroup,
  getSharedDefinitionOfDone,
  updateSharedDefinitionOfDone,
} from '../controllers/teamGroup.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import {
  createTeamGroupSchema,
  groupIdSchema,
  updateSharedDoDSchema,
  updateTeamGroupSchema,
} from '../validations/teamGroup.validation';

const router: RouterType = Router();

// Every group route is authenticated; what each caller may then do is the service's decision.
router.use(authenticate);

router.get('/', listTeamGroups);

router.post('/', validateBody(createTeamGroupSchema), createTeamGroup);

// The shared Definition of Done is declared before `/:groupId` so the literal segment matches
// first, and is readable without membership (see the file header).
router.get(
  '/:groupId/shared-definition-of-done',
  validateParams(groupIdSchema),
  getSharedDefinitionOfDone
);

router.put(
  '/:groupId/shared-definition-of-done',
  validateParams(groupIdSchema),
  validateBody(updateSharedDoDSchema),
  updateSharedDefinitionOfDone
);

router.get('/:groupId', validateParams(groupIdSchema), getTeamGroup);

router.put(
  '/:groupId',
  validateParams(groupIdSchema),
  validateBody(updateTeamGroupSchema),
  updateTeamGroup
);

router.delete('/:groupId', validateParams(groupIdSchema), deleteTeamGroup);

export default router;
