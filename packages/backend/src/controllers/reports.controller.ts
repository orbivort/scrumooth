import { type Request, type Response } from 'express';
import { reportsService } from '../services/reports.service';
import { asyncHandler, createSuccessResponse } from '../utils/errors';

/**
 * The team this request was authorized for.
 *
 * The team-membership gate resolves and validates `teamId` before any handler runs, and this reads
 * that resolution rather than the raw query alone -- so the team that was authorized is exactly the
 * team that is read, and a mismatched `x-team-id` header cannot authorize one team while another's
 * history is returned. The fallback to the query keeps a direct handler-level call (a unit test,
 * say) working; the service's own membership assertion still refuses it if the caller is not a
 * member.
 */
const teamIdOf = (req: Request): string | undefined => {
  const { teamId } = req.query;

  return req.currentTeamId ?? (typeof teamId === 'string' ? teamId : undefined);
};

/**
 * Read one team report and return it.
 *
 * All four reports have the same shape -- resolve the team the gate authorized, read it with the
 * caller attached, return it -- so the resolution and the missing-team guard live in one place
 * rather than being repeated four times and drifting apart. The caller is passed through because
 * the service re-asserts membership before touching its cache.
 */
const readTeamReport = async <T>(
  req: Request,
  res: Response,
  read: (teamId: string, userId: string | undefined) => Promise<T>
): Promise<void> => {
  const teamId = teamIdOf(req);

  if (!teamId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Team ID is required',
      },
    });
    return;
  }

  const data = await read(teamId, req.userId);
  res.json(createSuccessResponse(data));
};

export const getVelocityData = asyncHandler(async (req: Request, res: Response) => {
  await readTeamReport(req, res, (teamId, userId) =>
    reportsService.getVelocityData(teamId, userId)
  );
});

export const getSprintHistory = asyncHandler(async (req: Request, res: Response) => {
  await readTeamReport(req, res, (teamId, userId) =>
    reportsService.getSprintHistory(teamId, userId)
  );
});

export const getTeamMetrics = asyncHandler(async (req: Request, res: Response) => {
  await readTeamReport(req, res, (teamId, userId) => reportsService.getTeamMetrics(teamId, userId));
});

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  await readTeamReport(req, res, (teamId, userId) => reportsService.getInsights(teamId, userId));
});
