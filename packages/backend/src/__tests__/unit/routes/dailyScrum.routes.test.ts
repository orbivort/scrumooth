// Unit tests for the Daily Scrum router.
// The controllers and auth middleware are mocked; the real validation middleware runs so the
// request schemas (including the promote-impediment target-date refinement) are exercised.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../middleware/auth.middleware', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../controllers/dailyScrum.controller', () => {
  const ok = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ success: true });
  return {
    getDailyScrum: ok,
    getDailyScrums: ok,
    getParticipation: ok,
    getCadence: ok,
    createDailyScrum: ok,
    getDailyScrumById: ok,
    updateDailyScrum: ok,
    recordParticipation: ok,
    promoteToImpediment: ok,
    sendTeamSignal: ok,
  };
});

import dailyScrumRouter from '../../../routes/dailyScrum.routes';

const app = express();
app.use(express.json());
app.use('/daily-scrums', dailyScrumRouter);

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('dailyScrum.routes', () => {
  describe('POST /daily-scrums/:id/promote-impediment (targetDate refinement)', () => {
    const validBase = {
      title: 'Valid impediment title',
      description: 'A description that is long enough to pass validation',
    };

    it('accepts an empty targetDate (clears the date)', async () => {
      // Act
      const res = await request(app)
        .post(`/daily-scrums/${VALID_UUID}/promote-impediment`)
        .send({ ...validBase, targetDate: '' });

      // Assert
      expect(res.status).toBe(200);
    });

    it('accepts a parseable ISO targetDate', async () => {
      // Act
      const res = await request(app)
        .post(`/daily-scrums/${VALID_UUID}/promote-impediment`)
        .send({ ...validBase, targetDate: '2024-01-15' });

      // Assert
      expect(res.status).toBe(200);
    });

    it('rejects an unparseable targetDate', async () => {
      // Act
      const res = await request(app)
        .post(`/daily-scrums/${VALID_UUID}/promote-impediment`)
        .send({ ...validBase, targetDate: 'not-a-real-date' });

      // Assert
      expect(res.status).toBe(422);
    });
  });

  describe('POST /daily-scrums/:sprintId (plan-for-next-day refinement)', () => {
    it('accepts a Daily Scrum that records a plan for the next day', async () => {
      // Act
      const res = await request(app)
        .post(`/daily-scrums/${VALID_UUID}`)
        .send({ planForNextDay: 'Refine the acceptance criteria' });

      // Assert
      expect(res.status).toBe(200);
    });

    it('rejects a Daily Scrum without a plan for the next day', async () => {
      // Act
      const res = await request(app).post(`/daily-scrums/${VALID_UUID}`).send({});

      // Assert
      expect(res.status).toBe(422);
    });
  });
});
