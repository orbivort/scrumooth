import { type Request, type Response } from 'express';
import { smDashboardService } from '../services/smDashboard.service';
import { smNotesService } from '../services/smNotes.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import { SmNotesEntityType } from '@scrumooth/shared';

/**
 * Read a pagination bound from the query string, falling back when it is absent or unusable.
 *
 * The value only narrows a page of history, so an unparseable bound is treated as "not given"
 * rather than as a validation failure: a malformed `?limit=` must not turn a history read into a
 * 422 while a well-formed one is a convenience.
 */
const parseBound = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getSmDashboard = asyncHandler(async (req: Request, res: Response) => {
  const teamId = req.currentTeamId as string;
  const sprintCount = req.query.sprintCount ? parseInt(req.query.sprintCount as string, 10) : 5;
  const dashboard = await smDashboardService.getDashboard(teamId, sprintCount, req.user?.id);
  res.json(createSuccessResponse(dashboard));
});

export const getEventSchedule = asyncHandler(async (req: Request, res: Response) => {
  const teamId = req.currentTeamId as string;
  const schedule = await smDashboardService.getEventSchedule(teamId);
  res.json(createSuccessResponse(schedule));
});

export const updateSprintSmNotes = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Sprint ID is required');
  }
  const updated = await smNotesService.updateSprintNotes(id, req.body.smNotes, req.user?.id);
  res.json(createSuccessResponse(updated));
});

export const updateSprintReviewSmNotes = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Review ID is required');
  }
  const updated = await smNotesService.updateSprintReviewNotes(id, req.body.smNotes, req.user?.id);
  res.json(createSuccessResponse(updated));
});

export const updateRetrospectiveSmNotes = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Retrospective ID is required');
  }
  const updated = await smNotesService.updateRetrospectiveNotes(id, req.body.smNotes, req.user?.id);
  res.json(createSuccessResponse(updated));
});

/**
 * Build the history handler for one event.
 *
 * The three histories differ only in which event they read, so they share one implementation: a
 * per-event copy is how the rules on the three sets of notes drifted apart in the first place.
 */
const revisionsHandler = (entityType: SmNotesEntityType) => async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('ID is required');
  }

  const page = await smNotesService.getRevisions(entityType, id, req.user?.id, {
    limit: parseBound(req.query.limit, 20),
    offset: parseBound(req.query.offset, 0),
  });

  res.json(createSuccessResponse(page));
};

export const getSprintSmNotesRevisions = asyncHandler(revisionsHandler(SmNotesEntityType.SPRINT));
export const getSprintReviewSmNotesRevisions = asyncHandler(
  revisionsHandler(SmNotesEntityType.SPRINT_REVIEW)
);
export const getRetrospectiveSmNotesRevisions = asyncHandler(
  revisionsHandler(SmNotesEntityType.SPRINT_RETROSPECTIVE)
);
