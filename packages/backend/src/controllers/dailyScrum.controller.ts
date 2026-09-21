import { type Request, type Response } from 'express';
import { dailyScrumService } from '../services/dailyScrum.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';

export const getDailyScrum = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = getParamValue(req.params.sprintId);
  if (!sprintId) {
    throw new BadRequestError('Sprint ID is required');
  }
  const { date } = req.query;

  const dailyScrum = await dailyScrumService.getDailyScrum(sprintId, date as string | undefined);
  res.json(createSuccessResponse(dailyScrum));
});

export const getDailyScrums = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = getParamValue(req.params.sprintId);
  if (!sprintId) {
    throw new BadRequestError('Sprint ID is required');
  }
  const { date } = req.query;

  const dailyScrums = await dailyScrumService.getDailyScrums(sprintId, date as string | undefined);
  res.json(createSuccessResponse(dailyScrums));
});

export const getDailyScrumById = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Daily Scrum ID is required');
  }
  const dailyScrum = await dailyScrumService.getDailyScrumById(id);

  if (!dailyScrum) {
    res.json(createSuccessResponse(null));
    return;
  }

  res.json(createSuccessResponse(dailyScrum));
});

export const createDailyScrum = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }

  const sprintId = getParamValue(req.params.sprintId);
  if (!sprintId) {
    throw new BadRequestError('Sprint ID is required');
  }
  const {
    progressNotes,
    adaptationsNotes,
    planForNextDay,
    focusMode,
    backlogAdjustments,
    scrumDate,
  } = req.body;

  const dailyScrum = await dailyScrumService.createDailyScrum(userId, {
    sprintId,
    scrumDate,
    progressNotes,
    adaptationsNotes,
    planForNextDay,
    focusMode,
    backlogAdjustments,
  });

  res.status(201).json(createSuccessResponse(dailyScrum));
});

export const updateDailyScrum = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }

  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Daily Scrum ID is required');
  }
  const { progressNotes, adaptationsNotes, planForNextDay, focusMode, backlogAdjustments } =
    req.body;

  const dailyScrum = await dailyScrumService.updateDailyScrum(id, userId, {
    progressNotes,
    adaptationsNotes,
    planForNextDay,
    focusMode,
    backlogAdjustments,
  });

  res.json(createSuccessResponse(dailyScrum));
});

export const recordParticipation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }

  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Daily Scrum ID is required');
  }

  const dailyScrum = await dailyScrumService.recordParticipation(id, userId);
  res.json(createSuccessResponse(dailyScrum));
});

export const getParticipation = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = getParamValue(req.params.sprintId);
  if (!sprintId) {
    throw new BadRequestError('Sprint ID is required');
  }
  const { date } = req.query;

  if (!date) {
    res.json(createSuccessResponse({ dailyScrum: null, participants: [], nonParticipants: [] }));
    return;
  }

  const result = await dailyScrumService.getParticipation(sprintId, date as string);
  res.json(createSuccessResponse(result));
});

export const promoteToImpediment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }

  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Daily Scrum ID is required');
  }
  const { title, description, ownerId, sprintId, priority, targetDate } = req.body;

  const result = await dailyScrumService.promoteToImpediment(id, userId, {
    title,
    description,
    ownerId,
    sprintId,
    priority,
    targetDate,
  });

  res.status(201).json(createSuccessResponse(result));
});

export const sendTeamSignal = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }

  const sprintId = getParamValue(req.params.sprintId);
  if (!sprintId) {
    throw new BadRequestError('Sprint ID is required');
  }

  const result = await dailyScrumService.sendTeamSignal(sprintId, userId);
  res.json(createSuccessResponse(result));
});
