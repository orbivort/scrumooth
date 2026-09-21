// Daily Scrum Schedule Controller
import { type Request, type Response } from 'express';
import {
  dailyScrumScheduleService,
  type DailyScrumScheduleData,
  type NonWorkingDayRange,
} from '../services/dailyScrumSchedule.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';

/**
 * The team comes from the context middleware, never from the request body: a schedule is a
 * statement about a specific Scrum Team, and letting the caller name the team would let it
 * write another team's commitment.
 */
const requireTeamId = (req: Request): string => {
  const teamId = req.currentTeamId;
  if (!teamId) {
    throw new BadRequestError('Team context is required');
  }
  return teamId;
};

const requireUserId = (req: Request): string => {
  const userId = req.userId;
  if (!userId) {
    throw new BadRequestError('User not authenticated');
  }
  return userId;
};

export const getSchedule = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await dailyScrumScheduleService.getSchedule(requireTeamId(req));
  res.json(createSuccessResponse(schedule));
});

export const saveSchedule = asyncHandler(async (req: Request, res: Response) => {
  const schedule = await dailyScrumScheduleService.saveSchedule(
    requireUserId(req),
    requireTeamId(req),
    (req.validatedBody ?? {}) as DailyScrumScheduleData
  );
  res.json(createSuccessResponse(schedule));
});

export const listNonWorkingDays = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery ?? {};
  const exceptions = await dailyScrumScheduleService.listNonWorkingDays(requireTeamId(req), {
    from: query.from,
    to: query.to,
  } satisfies NonWorkingDayRange);
  res.json(createSuccessResponse(exceptions));
});

export const addNonWorkingDay = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.validatedBody ?? {}) as { date: string; name?: string | null };
  const exception = await dailyScrumScheduleService.addNonWorkingDay(
    requireUserId(req),
    requireTeamId(req),
    { date: body.date, name: body.name }
  );
  res.status(201).json(createSuccessResponse(exception));
});

export const deleteNonWorkingDay = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Non-working day ID is required');
  }
  await dailyScrumScheduleService.deleteNonWorkingDay(requireTeamId(req), id);
  res.json(createSuccessResponse(null));
});
