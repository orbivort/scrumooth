import { type Request, type Response } from 'express';
import { definitionOfReadyService } from '../services/dor.service';
import { asyncHandler, createSuccessResponse } from '../utils/errors';
import { getParamValue } from '../utils/validation';

export const getDefinitionOfReady = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }

  let dor = await definitionOfReadyService.getDefinitionOfReady(teamId);

  if (!dor) {
    const userId = req.user?.id;
    dor = await definitionOfReadyService.createDefaultDefinitionOfReady(teamId, userId);
  }

  return res.json(createSuccessResponse(dor));
});

export const updateDefinitionOfReady = asyncHandler(async (req: Request, res: Response) => {
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

  const dor = await definitionOfReadyService.updateDefinitionOfReady(teamId, items, userId);
  return res.json(createSuccessResponse(dor));
});

export const getDoRHistory = asyncHandler(async (req: Request, res: Response) => {
  const teamId = getParamValue(req.params.teamId);

  if (!teamId) {
    return res.status(400).json({ success: false, error: { message: 'Team ID is required' } });
  }

  // The Definition of Ready keeps its version number but no superseded snapshots: unlike the
  // Definition of Done it is a complementary team agreement, not the Increment's commitment, so
  // there is no version to preserve for an audit. The history is therefore the version in force,
  // reported in the same array shape an integrator already handles.
  const dor = await definitionOfReadyService.getDefinitionOfReady(teamId);
  return res.json(createSuccessResponse(dor ? [dor] : []));
});

export const verifyDoRForPBI = asyncHandler(async (req: Request, res: Response) => {
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
    if (!v.dorItemId || typeof v.isVerified !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Each verification must have dorItemId and isVerified',
        },
      });
    }
  }

  const results = await definitionOfReadyService.verifyDoRForPBI(id, userId, verifications);
  return res.json(createSuccessResponse(results));
});

export const getDoRVerificationsForPBI = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  const userId = req.userId;

  if (!id) {
    return res.status(400).json({ success: false, error: { message: 'PBI ID is required' } });
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: { message: 'User not authenticated' } });
  }

  // The item's own team is not in the path, so membership is asserted in the service, where the
  // team the item belongs to is known.
  const verifications = await definitionOfReadyService.getDoRVerificationsForPBI(id, userId);
  return res.json(createSuccessResponse(verifications));
});
