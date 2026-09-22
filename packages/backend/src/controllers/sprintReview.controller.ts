import { type Request, type Response } from 'express';
import { sprintReviewService } from '../services/sprintReview.service';
import { asyncHandler, createSuccessResponse } from '../utils/errors';
import { getParamValue } from '../utils/validation';
import { logger } from '../utils/logger';

export const getSprintReviews = asyncHandler(async (req: Request, res: Response) => {
  const { teamId, sprintId } = req.query;
  const reviews = await sprintReviewService.getSprintReviews(
    teamId as string,
    sprintId as string | undefined,
    req.user?.id
  );
  res.json(createSuccessResponse(reviews));
});

export const getSprintReviewById = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Review ID is required');
  }
  const review = await sprintReviewService.getSprintReviewById(id, req.user?.id);
  res.json(createSuccessResponse(review));
});

export const createSprintReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new Error('User not authenticated');
  }
  // Use the validated body so the Zod `reviewDate` transform (string → Date) is
  // applied. Reading the raw `req.body` would pass a date-only string straight to
  // Prisma, which rejects it with a PrismaClientValidationError (HTTP 400).
  const review = await sprintReviewService.createSprintReview(
    userId,
    req.validatedBody as Parameters<typeof sprintReviewService.createSprintReview>[1]
  );
  res.status(201).json(createSuccessResponse(review));
});

export const updateSprintReview = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Review ID is required');
  }
  const userId = req.user?.id;
  logger.debug('updateSprintReview called', {
    id,
    userId,
    body: req.body,
  });
  // Use the validated body so the Zod `reviewDate` transform (string → Date) is
  // applied; the raw body could otherwise carry a date-only string that Prisma rejects.
  const review = await sprintReviewService.updateSprintReview(
    id,
    userId,
    req.validatedBody as Parameters<typeof sprintReviewService.updateSprintReview>[2]
  );
  logger.debug('updateSprintReview success', { reviewId: review.id });
  res.json(createSuccessResponse(review));
});

export const addStakeholderFeedback = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Review ID is required');
  }
  const userId = req.user?.id;
  const feedback = await sprintReviewService.addStakeholderFeedback(id, userId, req.body);
  res.status(201).json(createSuccessResponse(feedback));
});

export const deleteSprintReview = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Review ID is required');
  }
  const userId = req.user?.id;
  await sprintReviewService.deleteSprintReview(id, userId);
  res.json(createSuccessResponse({ message: 'Sprint review deleted successfully' }));
});

export const getPendingAdjustments = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query;
  if (!teamId) {
    throw new Error('Team ID is required');
  }
  const adjustments = await sprintReviewService.getPendingAdjustments(teamId as string);
  res.json(createSuccessResponse(adjustments));
});

export const markAdjustmentImplemented = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Adjustment ID is required');
  }
  const userId = req.user?.id;
  const adjustment = await sprintReviewService.markAdjustmentImplemented(id, userId);
  res.json(createSuccessResponse(adjustment));
});

export const materializeAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Adjustment ID is required');
  }
  const userId = req.user?.id;
  const result = await sprintReviewService.materializeAdjustment(
    id,
    userId,
    req.validatedBody as Parameters<typeof sprintReviewService.materializeAdjustment>[2]
  );
  res.status(201).json(createSuccessResponse(result));
});

export const linkAdjustmentToPbi = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Adjustment ID is required');
  }
  const userId = req.user?.id;
  const { pbiId } = req.validatedBody as { pbiId: string };
  const adjustment = await sprintReviewService.linkAdjustmentToPbi(id, pbiId, userId);
  res.json(createSuccessResponse(adjustment));
});

export const getPendingFeedback = asyncHandler(async (req: Request, res: Response) => {
  const { teamId } = req.query;
  if (!teamId) {
    throw new Error('Team ID is required');
  }
  const feedback = await sprintReviewService.getPendingFeedback(teamId as string);
  res.json(createSuccessResponse(feedback));
});

export const markFeedbackAddressed = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Feedback ID is required');
  }
  const userId = req.user?.id;
  const feedback = await sprintReviewService.markFeedbackAddressed(id, userId);
  res.json(createSuccessResponse(feedback));
});

export const addAttendee = asyncHandler(async (req: Request, res: Response) => {
  const reviewId = getParamValue(req.params.reviewId);
  if (!reviewId) {
    throw new Error('Review ID is required');
  }
  const userId = req.user?.id;
  const attendee = await sprintReviewService.addAttendee(reviewId, userId, req.body);
  res.status(201).json(createSuccessResponse(attendee));
});

export const updateAttendee = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Attendee ID is required');
  }
  const userId = req.user?.id;
  const attendee = await sprintReviewService.updateAttendee(id, userId, req.body);
  res.json(createSuccessResponse(attendee));
});

export const deleteAttendee = asyncHandler(async (req: Request, res: Response) => {
  const id = getParamValue(req.params.id);
  if (!id) {
    throw new Error('Attendee ID is required');
  }
  const userId = req.user?.id;
  await sprintReviewService.deleteAttendee(id, userId);
  res.json(createSuccessResponse({ message: 'Attendee deleted successfully' }));
});
