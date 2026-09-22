// Team group controller: HTTP only, like every other controller in this codebase.
import { type Request, type Response } from 'express';
import { teamGroupService } from '../services/teamGroup.service';
import { asyncHandler, createSuccessResponse, UnauthorizedError } from '../utils/errors';
import { getParamValue } from '../utils/validation';

/**
 * The group directory.
 *
 * Returns the groups a team can join, without their rosters: joining is a decision the team has to
 * be able to make, and it cannot make it about a collaboration it cannot find.
 */
export const listTeamGroups = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const groups = await teamGroupService.listGroups();
  return res.json(createSuccessResponse(groups));
});

/**
 * One group, with its teams and the shared Definition of Done they comply with.
 */
export const getTeamGroup = asyncHandler(async (req: Request, res: Response) => {
  const groupId = getParamValue(req.params.groupId);
  const userId = req.userId;

  if (!groupId) {
    return res.status(400).json({ success: false, error: { message: 'Group ID is required' } });
  }

  const group = await teamGroupService.getGroup(groupId, userId);
  return res.json(createSuccessResponse(group));
});

/**
 * Create a group. The group is created together with the shared Definition of Done it will own.
 */
export const createTeamGroup = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const group = await teamGroupService.createGroup(userId, req.body);
  return res.status(201).json(createSuccessResponse(group));
});

/**
 * Rename or describe a group.
 */
export const updateTeamGroup = asyncHandler(async (req: Request, res: Response) => {
  const groupId = getParamValue(req.params.groupId);
  const userId = req.userId;

  if (!groupId) {
    return res.status(400).json({ success: false, error: { message: 'Group ID is required' } });
  }
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const group = await teamGroupService.updateGroup(groupId, userId, req.body);
  return res.json(createSuccessResponse(group));
});

/**
 * Remove a group. Refused while any team still complies with its Definition of Done.
 */
export const deleteTeamGroup = asyncHandler(async (req: Request, res: Response) => {
  const groupId = getParamValue(req.params.groupId);
  const userId = req.userId;

  if (!groupId) {
    return res.status(400).json({ success: false, error: { message: 'Group ID is required' } });
  }
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  await teamGroupService.deleteGroup(groupId, userId);
  return res.json(createSuccessResponse({ message: 'Team group removed successfully' }));
});

/**
 * The shared Definition of Done of a group, readable before joining it.
 *
 * This is the commitment a team would be adopting, so it cannot be behind the membership gate: a
 * Definition of Done a team may not read before agreeing to it is not one it "mutually defined".
 */
export const getSharedDefinitionOfDone = asyncHandler(async (req: Request, res: Response) => {
  const groupId = getParamValue(req.params.groupId);

  if (!groupId) {
    return res.status(400).json({ success: false, error: { message: 'Group ID is required' } });
  }

  const dod = await teamGroupService.getSharedDefinitionOfDone(groupId);
  return res.json(createSuccessResponse(dod));
});

/**
 * Replace the shared Definition of Done of a group.
 */
export const updateSharedDefinitionOfDone = asyncHandler(async (req: Request, res: Response) => {
  const groupId = getParamValue(req.params.groupId);
  const userId = req.userId;
  const { items } = req.body;

  if (!groupId) {
    return res.status(400).json({ success: false, error: { message: 'Group ID is required' } });
  }
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, error: { message: 'Items must be an array' } });
  }

  for (const item of items) {
    if (!item || typeof item.description !== 'string' || !item.description.trim()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Each item must have a description' },
      });
    }
  }

  const dod = await teamGroupService.updateSharedDefinitionOfDone(groupId, userId, items);
  return res.json(createSuccessResponse(dod));
});

/**
 * A team adopts a group's shared Definition of Done.
 */
export const joinTeamGroup = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);
  const userId = req.userId;
  const { groupId, acknowledgedDodVersion } = req.body;

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const group = await teamGroupService.joinGroup(teamId, userId, {
    groupId,
    acknowledgedDodVersion,
  });
  return res.json(createSuccessResponse(group));
});

/**
 * A team leaves its group, keeping the Definition of Done it has been complying with.
 */
export const leaveTeamGroup = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);
  const userId = req.userId;

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  await teamGroupService.leaveGroup(teamId, userId);
  return res.json(createSuccessResponse({ message: 'Team left the group successfully' }));
});
