import { type Request, type Response } from 'express';
import { definitionOfDoneService } from '../services/dod.service';
import { asyncHandler, createSuccessResponse } from '../utils/errors';
import { getParamValue } from '../utils/validation';

export const getDefinitionOfDone = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }

  let dod = await definitionOfDoneService.getDefinitionOfDone(teamId);

  if (!dod) {
    const userId = req.user?.id;
    dod = await definitionOfDoneService.createDefaultDefinitionOfDone(teamId, userId);
  }

  return res.json(createSuccessResponse(dod));
});

export const updateDefinitionOfDone = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);
  const { items } = req.body;
  const userId = req.user?.id;

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }

  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, error: { message: 'Items must be an array' } });
  }

  for (const item of items) {
    if (!item.description || typeof item.description !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Each item must have a description' },
      });
    }
  }

  const dod = await definitionOfDoneService.updateDefinitionOfDone(teamId, items, userId);
  return res.json(createSuccessResponse(dod));
});

export const getDoDHistory = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }

  // The Definition of Done is append-only: every superseded version is preserved as a snapshot,
  // and the live row is reported as the current version of the same list.
  const versions = await definitionOfDoneService.getDoDVersionSnapshots(teamId);
  return res.json(createSuccessResponse(versions));
});

export const verifyDoDForPBI = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  const { verifications } = req.body;
  const userId = req.userId;

  if (!id) {
    return res.status(400).json({ success: false, error: { message: 'PBI ID is required' } });
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
  }

  if (!Array.isArray(verifications)) {
    return res.status(400).json({
      success: false,
      error: { message: 'Verifications must be an array' },
    });
  }

  for (const v of verifications) {
    if (!v.dodItemId || typeof v.isVerified !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Each verification must have dodItemId and isVerified',
        },
      });
    }
  }

  const results = await definitionOfDoneService.verifyDoDForPBI(id, userId, verifications);
  return res.json(createSuccessResponse(results));
});

export const getDoDVerificationsForPBI = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  const userId = req.userId;

  if (!id) {
    return res.status(400).json({ success: false, error: { message: 'PBI ID is required' } });
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
  }

  const verifications = await definitionOfDoneService.getDoDVerificationsForPBI(id, userId);
  return res.json(createSuccessResponse(verifications));
});
