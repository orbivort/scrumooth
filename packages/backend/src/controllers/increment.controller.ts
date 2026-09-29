import { type Request, type Response } from 'express';
import { incrementService } from '../services/increment.service';
import {
  asyncHandler,
  createSuccessResponse,
  BadRequestError,
  UnauthorizedError,
} from '../utils/errors';
import { getParamValue } from '../utils/validation';

/**
 * The authenticated caller. Every Increment operation is authorized against the team that owns the
 * artifact, so the service needs the actor, not just the payload.
 */
function requireUserId(req: Request): string {
  const userId = req.userId ?? req.user?.id;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  return userId;
}

function requireIncrementId(req: Request): string {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Increment ID is required');
  }
  return id;
}

export const getIncrements = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, sprintId } = req.query;
  const increments = await incrementService.getIncrements(
    teamId as string,
    sprintId as string | undefined,
    requireUserId(req)
  );
  res.json(createSuccessResponse(increments));
});

export const getIncrementById = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const increment = await incrementService.getIncrementById(id, requireUserId(req));
  res.json(createSuccessResponse(increment));
});

export const createIncrement = asyncHandler(async (req: Request, res: Response) => {
  const increment = await incrementService.createIncrement(requireUserId(req), req.body);
  res.status(201).json(createSuccessResponse(increment));
});

export const updateIncrement = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const increment = await incrementService.updateIncrement(id, requireUserId(req), req.body);
  res.json(createSuccessResponse(increment));
});

export const deliverIncrement = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const { deliveryMethod, notes } = req.body;
  const increment = await incrementService.deliverIncrement(
    id,
    requireUserId(req),
    deliveryMethod,
    notes
  );
  res.json(createSuccessResponse(increment));
});

/**
 * Record the written attestation that the Increment is in usable condition — the evidence a
 * `"usable"` label cannot carry by itself.
 */
export const attestUsability = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const { evidence } = req.body;
  const increment = await incrementService.attestUsability(id, requireUserId(req), evidence);
  res.json(createSuccessResponse(increment));
});

/**
 * Recompose a Sprint's open Increment from its Done items, repairing a composition that was
 * skipped or failed when an item was marked Done.
 */
export const reconcileSprintIncrement = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, sprintId } = req.body;
  const result = await incrementService.reconcileSprintIncrement(
    teamId,
    sprintId,
    requireUserId(req)
  );
  res.json(createSuccessResponse(result));
});

export const getIncrementMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query;
  const metrics = await incrementService.getIncrementMetrics(teamId as string, requireUserId(req));
  res.json(createSuccessResponse(metrics));
});
