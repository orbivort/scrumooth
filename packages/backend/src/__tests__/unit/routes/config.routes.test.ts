// Unit tests for the public configuration router.
// These exercise the inline `/locales` handler (no database required).
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SUPPORTED_LOCALES, LOCALE_LABELS } from '@scrumooth/shared';

vi.mock('../../../controllers/config.controller', () => ({
  ConfigController: class {
    getNotificationConfig = vi.fn((_req: unknown, res: { json: (b: unknown) => void }) => {
      res.json({ success: true, data: {} });
    });
  },
}));

import configRouter from '../../../routes/config.routes';

const app = express();
app.use(express.json());
app.use('/config', configRouter);

describe('config.routes', () => {
  describe('GET /config/locales', () => {
    it('returns the supported locales and their labels', async () => {
      // Act
      const res = await request(app).get('/config/locales');

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locales).toEqual(SUPPORTED_LOCALES);
      expect(res.body.data.labels).toEqual(LOCALE_LABELS);
    });
  });
});
