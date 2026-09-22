import { type Request, type Response } from 'express';
import { retrospectiveService } from '../services/retrospective.service';
import { AppError } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import { logger } from '../utils/logger';

/**
 * Respond to a failed Retrospective request.
 *
 * Gate refusals, not-found and conflict errors are `AppError`s that already carry their own status
 * and stable `error.code`. Flattening them into a generic 500 hides *why* the action was refused,
 * which is the entire point of a gate; so they are propagated verbatim and only genuine faults fall
 * through to the 500 branch.
 */
const respondWithError = (res: Response, error: unknown, fallbackMessage: string): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  logger.error(fallbackMessage, {
    error: error instanceof Error ? error.message : 'Unknown error',
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: fallbackMessage,
    },
  });
};

const missingParam = (res: Response, message: string): void => {
  res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
    },
  });
};

export const getRetrospectives = async (req: Request, res: Response) => {
  try {
    const teamId = getParamValue(req.params.teamId);
    if (!teamId) {
      throw new Error('Team ID is required');
    }
    const retrospectives = await retrospectiveService.getRetrospectivesByTeam(teamId, req.userId);
    res.json({
      success: true,
      data: retrospectives,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch retrospectives');
  }
};

export const getRetrospectiveById = async (req: Request, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    if (!id) {
      missingParam(res, 'Retrospective ID is required');
      return;
    }
    const retrospective = await retrospectiveService.getRetrospectiveById(id, req.userId);
    res.json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch retrospective');
  }
};

export const getRetrospectiveBySprintId = async (req: Request, res: Response) => {
  try {
    const sprintId = getParamValue(req.params.sprintId);
    if (!sprintId) {
      missingParam(res, 'Sprint ID is required');
      return;
    }
    const retrospective = await retrospectiveService.getRetrospectiveBySprintId(
      sprintId,
      req.userId
    );

    res.json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch retrospective');
  }
};

export const createRetrospective = async (req: Request, res: Response) => {
  try {
    const retrospective = await retrospectiveService.createRetrospective(req.body, req.userId);
    res.status(201).json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('A retrospective already exists')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'RETROSPECTIVE_ALREADY_EXISTS',
          message: error.message,
        },
      });
      return;
    }

    respondWithError(res, error, 'Failed to create retrospective');
  }
};

export const addItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    if (!retroId) {
      missingParam(res, 'Retrospective ID is required');
      return;
    }
    const item = await retrospectiveService.addItem(retroId, req.body, req.userId);
    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to add item');
  }
};

export const voteItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const itemId = getParamValue(req.params.itemId);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    if (!retroId || !itemId) {
      missingParam(res, 'Retrospective ID and Item ID are required');
      return;
    }
    const item = await retrospectiveService.voteItem(retroId, itemId, userId);
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to vote for item');
  }
};

export const unvoteItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const itemId = getParamValue(req.params.itemId);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        },
      });
      return;
    }
    if (!retroId || !itemId) {
      missingParam(res, 'Retrospective ID and Item ID are required');
      return;
    }
    const item = await retrospectiveService.unvoteItem(retroId, itemId, userId);
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to remove vote for item');
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const itemId = getParamValue(req.params.itemId);
    if (!retroId || !itemId) {
      missingParam(res, 'Retrospective ID and Item ID are required');
      return;
    }
    const item = await retrospectiveService.updateItem(retroId, itemId, req.body, req.userId);
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to update item');
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const itemId = getParamValue(req.params.itemId);
    if (!retroId || !itemId) {
      missingParam(res, 'Retrospective ID and Item ID are required');
      return;
    }
    await retrospectiveService.deleteItem(retroId, itemId, req.userId);
    res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to delete item');
  }
};

export const addActionItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    if (!retroId) {
      missingParam(res, 'Retrospective ID is required');
      return;
    }
    const actionItem = await retrospectiveService.addActionItem(retroId, req.body, req.userId);
    res.status(201).json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to add action item');
  }
};

export const updateActionItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const actionItemId = getParamValue(req.params.actionItemId);
    if (!retroId || !actionItemId) {
      missingParam(res, 'Retrospective ID and Action Item ID are required');
      return;
    }
    const actionItem = await retrospectiveService.updateActionItem(
      retroId,
      actionItemId,
      req.body,
      req.userId
    );
    res.json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to update action item');
  }
};

export const deleteActionItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const actionItemId = getParamValue(req.params.actionItemId);
    if (!retroId || !actionItemId) {
      missingParam(res, 'Retrospective ID and Action Item ID are required');
      return;
    }
    await retrospectiveService.deleteActionItem(retroId, actionItemId, req.userId);
    res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to delete action item');
  }
};

export const updateRetrospective = async (req: Request, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    if (!id) {
      missingParam(res, 'Retrospective ID is required');
      return;
    }
    const updated = await retrospectiveService.updateRetrospective(id, req.body, req.userId);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to update retrospective');
  }
};

export const getPendingActionItems = async (req: Request, res: Response) => {
  try {
    const teamId = getParamValue(req.params.teamId);

    if (!teamId) {
      missingParam(res, 'Team ID is required');
      return;
    }

    const actionItems = await retrospectiveService.getPendingActionItemsByTeam(teamId, req.userId);
    res.json({
      success: true,
      data: actionItems,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to fetch pending action items');
  }
};

export const addRetroAttendee = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const { name, email, role, attended } = req.body;

    if (!retroId) {
      missingParam(res, 'Retrospective ID is required');
      return;
    }

    const attendee = await retrospectiveService.addAttendee(
      retroId,
      {
        name: name.trim(),
        email: email?.trim() ? email.trim() : undefined,
        role,
        attended: attended ?? true,
      },
      req.userId
    );

    res.status(201).json({
      success: true,
      data: attendee,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to add participant');
  }
};

export const updateRetroAttendee = async (req: Request, res: Response) => {
  try {
    const attendeeId = getParamValue(req.params.attendeeId);
    const { name, email, role, attended } = req.body;

    if (!attendeeId) {
      missingParam(res, 'Attendee ID is required');
      return;
    }

    const attendee = await retrospectiveService.updateAttendee(
      attendeeId,
      {
        name: name?.trim(),
        email: email?.trim() ? email.trim() : undefined,
        role,
        attended,
      },
      req.userId
    );

    res.json({
      success: true,
      data: attendee,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to update participant');
  }
};

export const deleteRetroAttendee = async (req: Request, res: Response) => {
  try {
    const attendeeId = getParamValue(req.params.attendeeId);
    if (!attendeeId) {
      missingParam(res, 'Attendee ID is required');
      return;
    }
    await retrospectiveService.deleteAttendee(attendeeId, req.userId);
    res.json({
      success: true,
      data: { message: 'Participant removed successfully' },
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to delete participant');
  }
};

export const applyDodChanges = async (req: Request, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    if (!id) {
      missingParam(res, 'Retrospective ID is required');
      return;
    }
    const retrospective = await retrospectiveService.applyDodChanges(id, req.userId);
    res.json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to apply Definition of Done changes');
  }
};

export const materializeActionItem = async (req: Request, res: Response) => {
  try {
    const actionItemId = getParamValue(req.params.actionItemId);
    if (!actionItemId) {
      missingParam(res, 'Action Item ID is required');
      return;
    }
    const actionItem = await retrospectiveService.materializeActionItem(actionItemId, req.userId);
    res.status(201).json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to create a backlog item from the action item');
  }
};

export const linkActionItemToPbi = async (req: Request, res: Response) => {
  try {
    const actionItemId = getParamValue(req.params.actionItemId);
    if (!actionItemId) {
      missingParam(res, 'Action Item ID is required');
      return;
    }
    const actionItem = await retrospectiveService.linkActionItemToPbi(
      actionItemId,
      req.body.pbiId,
      req.userId
    );
    res.json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    respondWithError(res, error, 'Failed to link the action item to a backlog item');
  }
};
