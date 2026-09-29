import { type Request, type Response } from 'express';
import { impedimentService } from '../services/impediment.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import { IMPEDIMENT_PRIORITIES, type ImpedimentPriority } from '@scrumooth/shared';

/** Read a priority from an untrusted body, refusing anything outside the known set. */
const parsePriority = (value: unknown): ImpedimentPriority | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string' && (IMPEDIMENT_PRIORITIES as readonly string[]).includes(value)) {
    return value as ImpedimentPriority;
  }
  throw new BadRequestError('Invalid priority');
};

/** Normalize an optional date: an empty string clears the target date rather than storing one. */
const parseTargetDate = (value: unknown): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'string' || value instanceof Date) {
    return value instanceof Date ? value.toISOString() : value;
  }
  throw new BadRequestError('Invalid target date');
};

export const getImpediments = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, sprintId } = req.query;
  if (!teamId || typeof teamId !== 'string') {
    throw new BadRequestError('teamId is required');
  }
  const impediments = await impedimentService.getImpedimentsByTeam(
    teamId,
    typeof sprintId === 'string' && sprintId ? sprintId : undefined
  );
  return res.json(createSuccessResponse(impediments));
});

export const getImpedimentById = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Impediment ID is required');
  }
  const { teamId } = req.query;
  if (!teamId || typeof teamId !== 'string') {
    throw new BadRequestError('teamId is required');
  }
  const impediment = await impedimentService.getImpedimentById(id, teamId);
  if (!impediment) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Impediment not found',
      },
    });
  }
  return res.json(createSuccessResponse(impediment));
});

export const createImpediment = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, sprintId, title, description, ownerId } = req.body;

  if (!teamId || !title || !description) {
    throw new BadRequestError('teamId, title, and description are required');
  }

  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }

  const impediment = await impedimentService.createImpediment(req.userId, {
    teamId,
    sprintId,
    title,
    description,
    ownerId,
    priority: parsePriority(req.body.priority),
    targetDate: parseTargetDate(req.body.targetDate),
  });

  return res.status(201).json(createSuccessResponse(impediment));
});

export const updateImpediment = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Impediment ID is required');
  }
  const { teamId, status, resolution, ownerId } = req.body;

  if (!teamId) {
    throw new BadRequestError('teamId is required');
  }

  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }

  const impediment = await impedimentService.updateImpediment(id, teamId, req.userId, {
    status,
    resolution,
    ownerId,
    priority: parsePriority(req.body.priority),
    targetDate: parseTargetDate(req.body.targetDate),
  });

  return res.json(createSuccessResponse(impediment));
});

export const deleteImpediment = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Impediment ID is required');
  }
  const { teamId } = req.query;

  if (!teamId || typeof teamId !== 'string') {
    throw new BadRequestError('teamId is required');
  }

  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }

  await impedimentService.deleteImpediment(id, teamId, req.userId);
  return res.json(createSuccessResponse({ message: 'Impediment deleted successfully' }));
});

export const getImpedimentStats = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query;
  if (!teamId || typeof teamId !== 'string') {
    throw new BadRequestError('teamId is required');
  }
  const stats = await impedimentService.getImpedimentStats(teamId);
  return res.json(createSuccessResponse(stats));
});
