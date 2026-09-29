// Organizational barrier controller.
//
// Thin handlers: the register's rules (team membership for reads, the team's Scrum Master for
// writes, one barrier per impediment, a written resolution to close) live in the service, so a
// route cannot be added that bypasses them.
import { type Request, type Response } from 'express';
import { organizationalBarrierService } from '../services/organizationalBarrier.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import type { BarrierPriority, BarrierStatus } from '@scrumooth/shared';

/** The team the request is acting in: the route guard's context, or the body/query. */
const resolveTeamId = (req: Request): string | undefined =>
  (req.currentTeamId as string | undefined) ??
  (typeof req.query.teamId === 'string' ? req.query.teamId : undefined) ??
  (typeof req.body?.teamId === 'string' ? req.body.teamId : undefined);

const requireUserId = (req: Request): string => {
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }

  return req.userId;
};

export const getBarriers = asyncHandler(async (req: Request, res: Response) => {
  const teamId = resolveTeamId(req);
  if (!teamId) {
    throw new BadRequestError('teamId is required');
  }

  const barriers = await organizationalBarrierService.getBarriers(teamId, req.userId, {
    status: req.query.status as BarrierStatus | undefined,
    priority: req.query.priority as BarrierPriority | undefined,
  });

  return res.json(createSuccessResponse(barriers));
});

export const getBarrierStats = asyncHandler(async (req: Request, res: Response) => {
  const teamId = resolveTeamId(req);
  if (!teamId) {
    throw new BadRequestError('teamId is required');
  }

  const stats = await organizationalBarrierService.getBarrierStats(teamId, req.userId);

  return res.json(createSuccessResponse(stats));
});

/**
 * Impediments a team has not yet escalated, so the escalation dialog can offer them.
 *
 * Declared before `/:id` in the router so the literal path is matched first.
 */
export const getEscalatableImpediments = asyncHandler(async (req: Request, res: Response) => {
  const teamId = resolveTeamId(req);
  if (!teamId) {
    throw new BadRequestError('teamId is required');
  }

  const impediments = await organizationalBarrierService.getEscalatableImpediments(
    teamId,
    req.userId
  );

  return res.json(createSuccessResponse(impediments));
});

export const getBarrierById = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Barrier ID is required');
  }

  const barrier = await organizationalBarrierService.getBarrierById(id, req.userId);

  return res.json(createSuccessResponse(barrier));
});

export const createBarrier = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { teamId, title, description, priority, ownerId, targetDate } = req.body;

  const barrier = await organizationalBarrierService.createBarrier(userId, {
    teamId,
    title,
    description,
    priority,
    ownerId,
    targetDate,
  });

  return res.status(201).json(createSuccessResponse(barrier));
});

export const escalateImpediment = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { teamId, impedimentId, title, description, priority, ownerId, targetDate } = req.body;

  const barrier = await organizationalBarrierService.escalateImpediment(userId, {
    teamId,
    impedimentId,
    title,
    description,
    priority,
    ownerId,
    targetDate,
  });

  return res.status(201).json(createSuccessResponse(barrier));
});

export const updateBarrier = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Barrier ID is required');
  }

  const barrier = await organizationalBarrierService.updateBarrier(id, req.userId, req.body);

  return res.json(createSuccessResponse(barrier));
});

export const deleteBarrier = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Barrier ID is required');
  }

  await organizationalBarrierService.deleteBarrier(id, req.userId);

  return res.json(createSuccessResponse({ message: 'Organizational barrier deleted' }));
});

export const addStakeholderAction = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Barrier ID is required');
  }

  const action = await organizationalBarrierService.addAction(id, req.userId, req.body);

  return res.status(201).json(createSuccessResponse(action));
});

export const updateStakeholderAction = asyncHandler(async (req: Request, res: Response) => {
  const actionId = getParamValue(req.params.actionId);
  if (!actionId) {
    throw new BadRequestError('Stakeholder action ID is required');
  }

  const action = await organizationalBarrierService.updateAction(actionId, req.userId, req.body);

  return res.json(createSuccessResponse(action));
});

export const deleteStakeholderAction = asyncHandler(async (req: Request, res: Response) => {
  const actionId = getParamValue(req.params.actionId);
  if (!actionId) {
    throw new BadRequestError('Stakeholder action ID is required');
  }

  await organizationalBarrierService.deleteAction(actionId, req.userId);

  return res.json(createSuccessResponse({ message: 'Stakeholder action deleted' }));
});
