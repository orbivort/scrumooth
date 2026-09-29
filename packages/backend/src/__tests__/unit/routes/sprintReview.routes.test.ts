// Unit tests for the Sprint Review router.
// Controllers and auth are mocked; the real validation middleware runs so the review-date
// transform and the product-goal-assessment refinement are exercised.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../middleware/auth.middleware', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../controllers/sprintReview.controller', () => {
  const ok = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ success: true });
  return {
    getSprintReviews: ok,
    getPendingAdjustments: ok,
    markAdjustmentImplemented: ok,
    materializeAdjustment: ok,
    linkAdjustmentToPbi: ok,
    getPendingFeedback: ok,
    markFeedbackAddressed: ok,
    getSprintReviewById: ok,
    createSprintReview: ok,
    updateSprintReview: ok,
    addStakeholderFeedback: ok,
    addAttendee: ok,
    updateAttendee: ok,
    deleteAttendee: ok,
    deleteSprintReview: ok,
  };
});

vi.mock('../../../controllers/smDashboard.controller', () => {
  const ok = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ success: true });
  return {
    updateSprintReviewSmNotes: ok,
    getSprintReviewSmNotesRevisions: ok,
  };
});

vi.mock('../../../controllers/productGoalSnapshot.controller', () => {
  const ok = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ success: true });
  return {
    getProductGoalForReview: ok,
    submitProductGoalAssessment: ok,
  };
});

import sprintReviewRouter from '../../../routes/sprintReview.routes';

const app = express();
app.use(express.json());
app.use('/sprint-reviews', sprintReviewRouter);

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('sprintReview.routes', () => {
  describe('PUT /sprint-reviews/:id (reviewDate transform)', () => {
    it('accepts and transforms a reviewDate string', async () => {
      // Act
      const res = await request(app)
        .put(`/sprint-reviews/${VALID_UUID}`)
        .send({ reviewDate: '2024-01-15' });

      // Assert
      expect(res.status).toBe(200);
    });

    it('accepts an update without a reviewDate', async () => {
      // Act
      const res = await request(app)
        .put(`/sprint-reviews/${VALID_UUID}`)
        .send({ summary: 'A review summary' });

      // Assert
      expect(res.status).toBe(200);
    });
  });

  describe('POST /sprint-reviews/:id/product-goal-assessment (evidence refinement)', () => {
    it('accepts a non-empty assessment', async () => {
      // Act
      const res = await request(app)
        .post(`/sprint-reviews/${VALID_UUID}/product-goal-assessment`)
        .send({ assessment: 'We validated the goal with three customers' });

      // Assert
      expect(res.status).toBe(200);
    });

    it('accepts a blank assessment when measured values are present', async () => {
      // Act
      const res = await request(app)
        .post(`/sprint-reviews/${VALID_UUID}/product-goal-assessment`)
        .send({ assessment: '   ', successMetricValues: { retention: 42 } });

      // Assert
      expect(res.status).toBe(200);
    });

    it('accepts measured values even without an assessment field', async () => {
      // Act
      const res = await request(app)
        .post(`/sprint-reviews/${VALID_UUID}/product-goal-assessment`)
        .send({ successMetricValues: { retention: 42 } });

      // Assert
      expect(res.status).toBe(200);
    });

    it('rejects an empty assessment without measured values', async () => {
      // Act
      const res = await request(app)
        .post(`/sprint-reviews/${VALID_UUID}/product-goal-assessment`)
        .send({ assessment: '' });

      // Assert
      expect(res.status).toBe(422);
    });
  });

  describe('POST /sprint-reviews (reviewDate transform on create)', () => {
    it('accepts a create payload with a reviewDate', async () => {
      // Act
      const res = await request(app)
        .post('/sprint-reviews')
        .send({ sprintId: VALID_UUID, teamId: VALID_UUID, reviewDate: '2024-01-15' });

      // Assert
      expect(res.status).toBe(200);
    });
  });
});
