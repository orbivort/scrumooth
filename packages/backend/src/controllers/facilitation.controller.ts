// Facilitation controller: the Scrum Master's coaching log, the team's working agreements and the
// cross-functionality assessment.
//
// One controller rather than three, because the three services are small and share a single shape:
// a team-scoped read plus a write whose role rule lives in the service.
import { type Request, type Response } from 'express';
import { coachingEntryService } from '../services/coachingEntry.service';
import { workingAgreementService } from '../services/workingAgreement.service';
import { crossFunctionalityService } from '../services/crossFunctionality.service';
import { asyncHandler, createSuccessResponse, BadRequestError } from '../utils/errors';
import { getParamValue } from '../utils/validation';

/** The team the request is acting in: the route guard's context, or the body/query. */
const resolveTeamId = (req: Request): string | undefined =>
  (req.currentTeamId as string | undefined) ??
  (typeof req.query.teamId === 'string' ? req.query.teamId : undefined) ??
  (typeof req.body?.teamId === 'string' ? req.body.teamId : undefined);

const requireTeamId = (req: Request): string => {
  const teamId = resolveTeamId(req);

  if (!teamId) {
    throw new BadRequestError('teamId is required');
  }

  return teamId;
};

const requireUserId = (req: Request): string => {
  if (!req.userId) {
    throw new BadRequestError('User not authenticated');
  }

  return req.userId;
};

/** Read a paging bound, falling back when it is absent or unusable. */
const parseBound = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

// --- Coaching log (the Scrum Master's own record) ---

export const getCoachingEntries = asyncHandler(async (req: Request, res: Response) => {
  const page = await coachingEntryService.getCoachingEntries(requireTeamId(req), req.userId, {
    limit: parseBound(req.query.limit, 50),
    offset: parseBound(req.query.offset, 0),
  });

  return res.json(createSuccessResponse(page));
});

export const createCoachingEntry = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const entry = await coachingEntryService.createCoachingEntry(userId, req.body);

  return res.status(201).json(createSuccessResponse(entry));
});

export const updateCoachingEntry = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Coaching entry ID is required');
  }

  const entry = await coachingEntryService.updateCoachingEntry(id, req.userId, req.body);

  return res.json(createSuccessResponse(entry));
});

export const deleteCoachingEntry = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Coaching entry ID is required');
  }

  await coachingEntryService.deleteCoachingEntry(id, req.userId);

  return res.json(createSuccessResponse({ message: 'Coaching entry deleted' }));
});

// --- Working agreements (the team's own) ---

export const getWorkingAgreements = asyncHandler(async (req: Request, res: Response) => {
  const agreements = await workingAgreementService.getWorkingAgreements(
    requireTeamId(req),
    req.userId
  );

  return res.json(createSuccessResponse(agreements));
});

export const createWorkingAgreement = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const agreement = await workingAgreementService.createWorkingAgreement(userId, req.body);

  return res.status(201).json(createSuccessResponse(agreement));
});

export const updateWorkingAgreement = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Working agreement ID is required');
  }

  const agreement = await workingAgreementService.updateWorkingAgreement(id, req.userId, req.body);

  return res.json(createSuccessResponse(agreement));
});

// --- Cross-functionality (recorded by the Scrum Master, read by the team) ---

export const getCrossFunctionality = asyncHandler(async (req: Request, res: Response) => {
  const record = await crossFunctionalityService.getCrossFunctionality(
    requireTeamId(req),
    req.userId
  );

  return res.json(createSuccessResponse(record));
});

export const getCrossFunctionalityAssessment = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new BadRequestError('Assessment ID is required');
  }

  const assessment = await crossFunctionalityService.getAssessmentById(id, req.userId);

  return res.json(createSuccessResponse(assessment));
});

export const createCrossFunctionalityAssessment = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const assessment = await crossFunctionalityService.createAssessment(userId, req.body);

    return res.status(201).json(createSuccessResponse(assessment));
  }
);
