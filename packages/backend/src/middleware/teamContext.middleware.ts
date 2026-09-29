// Team Context Middleware
import { type Request, type Response, type NextFunction } from 'express';
import { BadRequestError, ForbiddenError, localizedError } from '../utils/errors';
import { isValidUUID } from '../utils/validation';
import prisma from '../utils/prisma';
import { updateRequestContext } from '../utils/requestContext';
import { type GateCode } from '@scrumooth/shared';

/** Resolve the team the request is acting in, wherever the client put it. */
const resolveTeamId = (req: Request): string | undefined =>
  (req.headers['x-team-id'] as string | undefined) ??
  req.body?.teamId ??
  req.query.teamId ??
  req.params.teamId;

/**
 * Team Context Middleware factory.
 *
 * Validates that a team context is provided and that the caller is a member of it, then attaches
 * the caller's role. A module whose refusals are part of its public contract can pass
 * `messageKey` + `gateCode` so a non-member is answered with that module's stable code instead of
 * the generic 403 — the Impediments module does this, because "the impediment belongs to its
 * Scrum Team" is a documented rule with a documented refusal.
 */
export const createRequireTeamContext = (options?: {
  messageKey?: string;
  gateCode?: GateCode;
}): ((req: Request, _res: Response, next: NextFunction) => Promise<void>) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const teamId = resolveTeamId(req);

      if (!teamId) {
        throw new BadRequestError('Team context is required');
      }

      if (!isValidUUID(teamId)) {
        throw new BadRequestError('Invalid team ID format');
      }

      if (!req.userId) {
        throw new ForbiddenError('Authentication required');
      }

      const teamMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: req.userId,
          },
        },
      });

      if (!teamMember) {
        if (options?.messageKey) {
          throw localizedError(options.messageKey, {}, 403, options.gateCode);
        }
        throw new ForbiddenError('You are not a member of this team');
      }

      req.currentTeamId = teamId;
      req.userRoleInTeam = teamMember.role;

      // Update request context with teamId for logging
      updateRequestContext({ teamId });

      next();
    } catch (error) {
      next(error);
    }
  };
};

/** Default team-context guard: a generic 403 when the caller is not a member of the team. */
export const requireTeamContext = createRequireTeamContext();

/**
 * Optional team context middleware
 * Attaches team context if provided, but doesn't require it
 */
export const optionalTeamContext = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const teamId =
      (req.headers['x-team-id'] as string | undefined) ??
      req.body?.teamId ??
      req.query.teamId ??
      req.params.teamId;

    if (teamId && req.userId) {
      const teamMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: req.userId,
          },
        },
      });

      if (teamMember) {
        req.currentTeamId = teamId;
        req.userRoleInTeam = teamMember.role;
        // Update request context with teamId for logging
        updateRequestContext({ teamId });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization within team context
 */
export const requireTeamRoles = (...roles: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.currentTeamId) {
        throw new BadRequestError('Team context is required');
      }

      if (!req.userRoleInTeam) {
        throw new ForbiddenError('User role in team not found');
      }

      if (!roles.includes(req.userRoleInTeam)) {
        throw new ForbiddenError(`Insufficient permissions. Required roles: ${roles.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
