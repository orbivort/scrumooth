// Team Routes
import { Router, type Router as RouterType } from 'express';
import * as teamController from '../controllers/team.controller';
import * as dodController from '../controllers/dod.controller';
import * as dorController from '../controllers/dor.controller';
import * as healthCheckController from '../controllers/teamHealthCheck.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { createRequireTeamContext } from '../middleware/teamContext.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { GATE_CODES, UserRole } from '@scrumooth/shared';
import { z } from 'zod';

const router: RouterType = Router();

// All routes require authentication
router.use(authenticate);

// The Definition of Done is "created by the Scrum Team" for its own product, so it belongs to the
// team that owns it: reading or changing one requires membership. The refusal carries the module's
// own gate code so an integrator can branch on it without parsing the message.
const requireDoDTeamContext = createRequireTeamContext({
  messageKey: 'errors:dodTeamMembersOnly',
  gateCode: GATE_CODES.DOD_TEAM_MEMBERS_ONLY,
});

// Validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
});

const addMemberSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS']),
});

const updateMemberSchema = z.object({
  role: z.enum(['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS']),
});

const teamIdSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
});

const memberIdSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  memberId: z.string().uuid('Invalid member ID'),
});

const updateDoDSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      description: z.string().min(1, 'Description is required'),
      category: z.string().optional(),
      isActive: z.boolean(),
      order: z.number(),
    })
  ),
});

const updateDoRSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      description: z.string().min(1, 'Description is required'),
      category: z.string().optional(),
      isActive: z.boolean(),
      order: z.number(),
    })
  ),
});

/**
 * @route   GET /api/v1/teams
 * @desc    Get all teams for current user
 * @access  Private
 */
router.get('/', teamController.getUserTeams);

/**
 * @route   GET /api/v1/teams/my-teams
 * @desc    Get current user's teams with roles
 * @access  Private
 */
router.get('/my-teams', teamController.getMyTeams);

/**
 * @route   POST /api/v1/teams
 * @desc    Create a new team
 * @access  Private
 */
router.post('/', validateBody(createTeamSchema), teamController.createTeam);

/**
 * @route   GET /api/v1/teams/:teamId
 * @desc    Get team by ID
 * @access  Private
 */
router.get('/:teamId', validateParams(teamIdSchema), teamController.getTeamById);

/**
 * @route   PUT /api/v1/teams/:teamId
 * @desc    Update team
 * @access  Private (Administrator)
 */
router.put(
  '/:teamId',
  validateParams(teamIdSchema),
  validateBody(createTeamSchema.partial()),
  teamController.updateTeam
);

/**
 * @route   DELETE /api/v1/teams/:teamId
 * @desc    Delete team
 * @access  Private (Administrator)
 */
router.delete('/:teamId', validateParams(teamIdSchema), teamController.deleteTeam);

/**
 * @route   POST /api/v1/teams/:teamId/members
 * @desc    Add member to team
 * @access  Private (Scrum Master)
 */
router.post(
  '/:teamId/members',
  validateParams(teamIdSchema),
  validateBody(addMemberSchema),
  teamController.addMember
);

/**
 * @route   DELETE /api/v1/teams/:teamId/members/:memberId
 * @desc    Remove member from team
 * @access  Private (Scrum Master)
 */
router.delete(
  '/:teamId/members/:memberId',
  validateParams(memberIdSchema),
  teamController.removeMember
);

/**
 * @route   PUT /api/v1/teams/:teamId/members/:memberId
 * @desc    Update member role
 * @access  Private (Scrum Master)
 */
router.put(
  '/:teamId/members/:memberId',
  validateParams(memberIdSchema),
  validateBody(updateMemberSchema),
  teamController.updateMemberRole
);

/**
 * @route   GET /api/v1/teams/:teamId/my-role
 * @desc    Get user's role in a specific team
 * @access  Private
 */
router.get('/:teamId/my-role', validateParams(teamIdSchema), teamController.getMyRoleInTeam);

/**
 * @route   POST /api/v1/teams/select-team
 * @desc    Select team (for session management)
 * @access  Private
 */
router.post('/select-team', teamController.selectTeam);

/**
 * @route   GET /api/v1/teams/:teamId/definition-of-done
 * @desc    Get Definition of Done for a team
 * @access  Private (team members)
 */
router.get(
  '/:teamId/definition-of-done',
  validateParams(teamIdSchema),
  requireDoDTeamContext,
  dodController.getDefinitionOfDone
);

/**
 * @route   PUT /api/v1/teams/:teamId/definition-of-done
 * @desc    Replace the Definition of Done with a new version. Refused when the new version would
 *          hold no active item, and every superseded version is preserved in the history.
 * @access  Private (team members) — the Definition of Done is the Scrum Team's own agreement
 *          about what "Done" means, not a role's private setting.
 */
router.put(
  '/:teamId/definition-of-done',
  validateParams(teamIdSchema),
  requireDoDTeamContext,
  validateBody(updateDoDSchema),
  dodController.updateDefinitionOfDone
);

/**
 * @route   GET /api/v1/teams/:teamId/definition-of-done/history
 * @desc    Get the append-only Definition of Done version history for a team, newest first
 * @access  Private (team members)
 */
router.get(
  '/:teamId/definition-of-done/history',
  validateParams(teamIdSchema),
  requireDoDTeamContext,
  dodController.getDoDHistory
);

/**
 * @route   GET /api/v1/teams/:teamId/definition-of-ready
 * @desc    Get Definition of Ready for a team
 * @access  Private
 */
router.get(
  '/:teamId/definition-of-ready',
  validateParams(teamIdSchema),
  dorController.getDefinitionOfReady
);

/**
 * @route   PUT /api/v1/teams/:teamId/definition-of-ready
 * @desc    Update Definition of Ready for a team
 * @access  Private (Scrum Master)
 */
router.put(
  '/:teamId/definition-of-ready',
  validateParams(teamIdSchema),
  validateBody(updateDoRSchema),
  dorController.updateDefinitionOfReady
);

/**
 * @route   GET /api/v1/teams/:teamId/definition-of-ready/history
 * @desc    Get Definition of Ready history for a team
 * @access  Private
 */
router.get(
  '/:teamId/definition-of-ready/history',
  validateParams(teamIdSchema),
  dorController.getDoRHistory
);

/**
 * @route   POST /api/v1/teams/:teamId/health-checks
 * @desc    Create a new Scrum Values health check for a team
 * @access  Private (Scrum Master)
 */
router.post(
  '/:teamId/health-checks',
  validateParams(teamIdSchema),
  requireRoles(UserRole.SCRUM_MASTER),
  validateBody(z.object({ sprintId: z.string().uuid().optional().nullable() })),
  healthCheckController.createHealthCheck
);

/**
 * @route   GET /api/v1/teams/:teamId/health-checks/latest
 * @desc    Get the latest Scrum Values health check status for a team
 * @access  Private (all team members) - used to discover an open survey
 */
router.get(
  '/:teamId/health-checks/latest',
  validateParams(teamIdSchema),
  healthCheckController.getLatestStatus
);

/**
 * @route   GET /api/v1/teams/:teamId/health-check-trend
 * @desc    Get Scrum Values health check trend for a team
 * @access  Private (Scrum Master)
 */
router.get(
  '/:teamId/health-check-trend',
  validateParams(teamIdSchema),
  requireRoles(UserRole.SCRUM_MASTER),
  healthCheckController.getTrend
);

export default router;
