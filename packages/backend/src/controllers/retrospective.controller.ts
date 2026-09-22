import { type Request, type Response } from 'express';
import { retrospectiveService } from '../services/retrospective.service';
import { AppError, NotFoundError, ConflictError } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import { logger } from '../utils/logger';

export const getRetrospectives = async (req: Request, res: Response) => {
  try {
    const teamId = getParamValue(req.params.teamId);
    if (!teamId) {
      throw new Error('Team ID is required');
    }
    const retrospectives = await retrospectiveService.getRetrospectivesByTeam(teamId);
    res.json({
      success: true,
      data: retrospectives,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch retrospectives',
      },
    });
  }
};

export const getRetrospectiveById = async (req: Request, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID is required',
        },
      });
      return;
    }
    const retrospective = await retrospectiveService.getRetrospectiveById(id);
    res.json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Retrospective not found',
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch retrospective',
        },
      });
    }
  }
};

export const getRetrospectiveBySprintId = async (req: Request, res: Response) => {
  try {
    const sprintId = getParamValue(req.params.sprintId);
    if (!sprintId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Sprint ID is required',
        },
      });
      return;
    }
    const retrospective = await retrospectiveService.getRetrospectiveBySprintId(sprintId);

    res.json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    logger.error('Error fetching retrospective by sprint ID', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch retrospective',
      },
    });
  }
};

export const createRetrospective = async (req: Request, res: Response) => {
  try {
    logger.debug('Creating retrospective', { body: req.body });

    const retrospective = await retrospectiveService.createRetrospective(req.body);
    res.status(201).json({
      success: true,
      data: retrospective,
    });
  } catch (error) {
    logger.error('Error creating retrospective', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create retrospective',
      },
    });
  }
};

export const addItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    if (!retroId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID is required',
        },
      });
      return;
    }
    const item = await retrospectiveService.addItem(retroId, req.body);
    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add item',
      },
    });
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
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID and Item ID are required',
        },
      });
      return;
    }
    const item = await retrospectiveService.voteItem(retroId, itemId, userId);
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    if (error instanceof ConflictError) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
      });
      return;
    }
    logger.error('Failed to vote for item', undefined, { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to vote for item',
      },
    });
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
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID and Item ID are required',
        },
      });
      return;
    }
    const item = await retrospectiveService.unvoteItem(retroId, itemId, userId);
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    logger.error('Failed to remove vote for item', undefined, { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to remove vote for item',
      },
    });
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const itemId = getParamValue(req.params.itemId);
    if (!retroId || !itemId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID and Item ID are required',
        },
      });
      return;
    }
    const item = await retrospectiveService.updateItem(retroId, itemId, req.body);
    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update item',
      },
    });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const itemId = getParamValue(req.params.itemId);
    if (!retroId || !itemId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID and Item ID are required',
        },
      });
      return;
    }
    await retrospectiveService.deleteItem(retroId, itemId);
    res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete item',
      },
    });
  }
};

export const addActionItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    if (!retroId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID is required',
        },
      });
      return;
    }
    const actionItem = await retrospectiveService.addActionItem(retroId, req.body);
    res.status(201).json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add action item',
      },
    });
  }
};

export const updateActionItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const actionItemId = getParamValue(req.params.actionItemId);
    if (!retroId || !actionItemId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID and Action Item ID are required',
        },
      });
      return;
    }
    const actionItem = await retrospectiveService.updateActionItem(retroId, actionItemId, req.body);
    res.json({
      success: true,
      data: actionItem,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update action item',
      },
    });
  }
};

export const deleteActionItem = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const actionItemId = getParamValue(req.params.actionItemId);
    if (!retroId || !actionItemId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID and Action Item ID are required',
        },
      });
      return;
    }
    await retrospectiveService.deleteActionItem(retroId, actionItemId);
    res.json({
      success: true,
      data: null,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete action item',
      },
    });
  }
};

export const updateRetrospective = async (req: Request, res: Response) => {
  try {
    const id = getParamValue(req.params.id);
    if (!id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID is required',
        },
      });
      return;
    }
    const updated = await retrospectiveService.updateRetrospective(id, req.body);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    // A Guide gate (completing the Retrospective before its Sprint Review, or before the Sprint
    // has ended) must reach the client with its 400 status and stable gate code, not be flattened
    // into a 500 that hides why the action was refused.
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
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update retrospective',
      },
    });
  }
};

export const getPendingActionItems = async (req: Request, res: Response) => {
  try {
    const teamId = getParamValue(req.params.teamId);

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

    const actionItems = await retrospectiveService.getPendingActionItemsByTeam(teamId);
    res.json({
      success: true,
      data: actionItems,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch pending action items',
      },
    });
  }
};

export const addRetroAttendee = async (req: Request, res: Response) => {
  try {
    const retroId = getParamValue(req.params.retroId);
    const { name, email, role, attended } = req.body;

    if (!retroId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Retrospective ID is required',
        },
      });
      return;
    }

    const attendee = await retrospectiveService.addAttendee(retroId, {
      name: name.trim(),
      email: email?.trim() ? email.trim() : undefined,
      role,
      attended: attended ?? true,
    });

    res.status(201).json({
      success: true,
      data: attendee,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    logger.error('Failed to add participant', undefined, { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add participant',
      },
    });
  }
};

export const updateRetroAttendee = async (req: Request, res: Response) => {
  try {
    const attendeeId = getParamValue(req.params.attendeeId);
    const { name, email, role, attended } = req.body;

    if (!attendeeId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Attendee ID is required',
        },
      });
      return;
    }

    const attendee = await retrospectiveService.updateAttendee(attendeeId, {
      name: name?.trim(),
      email: email?.trim() ? email.trim() : undefined,
      role,
      attended,
    });

    res.json({
      success: true,
      data: attendee,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update participant',
      },
    });
  }
};

export const deleteRetroAttendee = async (req: Request, res: Response) => {
  try {
    const attendeeId = getParamValue(req.params.attendeeId);
    if (!attendeeId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Attendee ID is required',
        },
      });
      return;
    }
    await retrospectiveService.deleteAttendee(attendeeId);
    res.json({
      success: true,
      data: { message: 'Participant removed successfully' },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete participant',
      },
    });
  }
};
