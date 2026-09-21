// Product Backlog Controller
import { type Request, type Response } from 'express';
import { productBacklogService } from '../services/backlog.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import type { ItemStatus } from '../generated/prisma/client';

/**
 * Get product backlog for a team
 */
export const getProductBacklog = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query;
  const { status, labels, page, limit } = req.query;

  if (!teamId || typeof teamId !== 'string') {
    throw new BadRequestError('teamId is required');
  }

  const result = await productBacklogService.getProductBacklog(teamId, {
    status: status as ItemStatus | undefined,
    labels: labels as string | undefined,
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });

  res.json(result);
});

/**
 * Get PBI by ID
 */
export const getPBIById = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('PBI ID is required');
  }
  const pbi = await productBacklogService.getPBIById(id);
  res.json(createSuccessResponse(pbi));
});

/**
 * Create a new PBI
 */
export const createPBI = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }
  // Goal capacity is validated by the service once the Product Goal anchor is resolved,
  // so auto-linked items are counted against the goal they actually serve.
  const pbi = await productBacklogService.createPBI(req.userId, req.body);
  res.status(201).json(createSuccessResponse(pbi));
});

/**
 * Update a PBI
 */
export const updatePBI = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('PBI ID is required');
  }
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }
  const pbi = await productBacklogService.updatePBI(id, req.userId, req.body);
  res.json(createSuccessResponse(pbi));
});

/**
 * Update PBI priority
 */
export const updatePriority = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('PBI ID is required');
  }
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }
  const { priority } = req.body;
  // Reclassifying an item is a Product Owner ordering decision, enforced in the service.
  const pbi = await productBacklogService.updatePriority(id, req.userId, priority);
  res.json(createSuccessResponse(pbi));
});

/**
 * Delete a PBI
 */
export const deletePBI = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('PBI ID is required');
  }
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }
  await productBacklogService.deletePBI(id, req.userId);
  res.json(createSuccessResponse({ message: 'Item deleted successfully' }));
});

/**
 * Reorder PBIs
 *
 * The service persists the new order and returns it, so the client reconciles against what
 * was actually written rather than an unverified success message.
 */
export const reorderPBIs = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }
  const items = await productBacklogService.reorderPBIs(req.userId, req.body);
  res.json(createSuccessResponse({ items }));
});

/**
 * Bulk create PBIs
 */
export const createPBIBulk = asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }
  // Goal capacity is validated by the service once the Product Goal anchor is resolved,
  // so auto-linked rows are counted against the goal they actually serve.
  const result = await productBacklogService.createPBIBulk(req.userId, req.body);
  res.status(201).json(createSuccessResponse(result));
});

/**
 * Get count of backlog items for a goal
 * @route GET /api/v1/product-backlog/count
 */
export const getBacklogItemCount = asyncHandler(async (req: Request, res: Response) => {
  const { goalId } = req.query;

  if (!goalId || typeof goalId !== 'string') {
    throw new BadRequestError('goalId is required');
  }

  const count = await productBacklogService.countItemsByGoal(goalId);
  res.json({ count });
});
