import { type Request, type Response } from 'express';
import { incrementIntegrationService } from '../services/incrementIntegration.service';
import {
  asyncHandler,
  createSuccessResponse,
  BadRequestError,
  UnauthorizedError,
} from '../utils/errors';
import { getParamValue } from '../utils/validation';

/**
 * The authenticated caller. Integration tests and the verification they feed are authorized against
 * the team that owns the Increment, so the service needs the actor.
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

export const createIntegrationTest = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const test = await incrementIntegrationService.createTest(requireUserId(req), {
    currentIncrementId: id,
    priorIncrementId: req.body.priorIncrementId,
    testResult: req.body.testResult,
    notes: req.body.notes,
  });
  res.status(201).json(createSuccessResponse(test));
});

export const getIntegrationTests = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const tests = await incrementIntegrationService.getTestsForIncrement(id, requireUserId(req));
  res.json(createSuccessResponse(tests));
});

export const verifyIntegration = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const result = await incrementIntegrationService.verifyIntegration(requireUserId(req), id);
  res.json(createSuccessResponse(result));
});

export const getIncrementChain = asyncHandler(async (req: Request, res: Response) => {
  const id = requireIncrementId(req);
  const chain = await incrementIntegrationService.getIncrementChain(id, requireUserId(req));
  res.json(createSuccessResponse(chain));
});
