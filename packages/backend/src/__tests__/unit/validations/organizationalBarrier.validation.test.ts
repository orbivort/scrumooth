// Organizational Barrier Validation Tests
// Focus: the shared dateSchema refinement (`value === '' || is a parseable date`)
// used by the barrier / action / escalation request shapes.
import { describe, it, expect } from 'vitest';
import {
  createBarrierSchema,
  updateBarrierSchema,
  escalateImpedimentSchema,
  createActionSchema,
  updateActionSchema,
  barrierListQuerySchema,
  barrierIdQuerySchema,
} from '../../../validations/organizationalBarrier.validation';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('Organizational Barrier Validation', () => {
  describe('dateSchema refinement (via createBarrierSchema.targetDate)', () => {
    it('accepts an empty string (clears the target date)', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
        targetDate: '',
      };

      // Act
      const result = createBarrierSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('accepts a parseable ISO date', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
        targetDate: '2024-05-20',
      };

      // Act
      const result = createBarrierSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('accepts a parseable ISO timestamp', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
        targetDate: '2024-05-20T08:00:00.000Z',
      };

      // Act
      const result = createBarrierSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('rejects an unparseable target date string', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
        targetDate: 'nonsense-date',
      };

      // Act
      const result = createBarrierSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('targetDate');
      }
    });

    it('accepts a nullish targetDate (field omitted)', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
      };

      // Act
      const result = createBarrierSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('createBarrierSchema structure', () => {
    it('rejects an unknown priority', () => {
      const result = createBarrierSchema.safeParse({
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
        priority: 'URGENT',
      });
      expect(result.success).toBe(false);
    });

    it('accepts a valid priority and null ownerId', () => {
      const result = createBarrierSchema.safeParse({
        teamId: VALID_UUID,
        title: 'Barrier',
        description: 'A sufficiently long description',
        priority: 'HIGH',
        ownerId: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateBarrierSchema', () => {
    it('accepts a status update and a valid targetDate', () => {
      const result = updateBarrierSchema.safeParse({
        status: 'RESOLVED',
        targetDate: '2024-06-01',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an unparseable targetDate on update', () => {
      const result = updateBarrierSchema.safeParse({ targetDate: 'still-not-a-date' });
      expect(result.success).toBe(false);
    });
  });

  describe('action schemas (reuse dateSchema as dueDate)', () => {
    it('accepts an action with an empty dueDate', () => {
      const result = createActionSchema.safeParse({
        description: 'Bring up the topic with the sponsor',
        dueDate: '',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an action with an unparseable dueDate', () => {
      const result = createActionSchema.safeParse({
        description: 'Bring up the topic with the sponsor',
        dueDate: 'bad-date',
      });
      expect(result.success).toBe(false);
    });

    it('accepts an action status update', () => {
      const result = updateActionSchema.safeParse({ status: 'DONE' });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown action status', () => {
      const result = updateActionSchema.safeParse({ status: 'BLOCKED' });
      expect(result.success).toBe(false);
    });
  });

  describe('escalateImpedimentSchema', () => {
    it('accepts a minimal escalation with a valid targetDate', () => {
      const result = escalateImpedimentSchema.safeParse({
        teamId: VALID_UUID,
        impedimentId: VALID_UUID,
        targetDate: '2024-07-01',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an unparseable targetDate on escalation', () => {
      const result = escalateImpedimentSchema.safeParse({
        teamId: VALID_UUID,
        impedimentId: VALID_UUID,
        targetDate: 'not valid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('query schemas', () => {
    it('accepts a valid barrier list query', () => {
      const result = barrierListQuerySchema.safeParse({
        teamId: VALID_UUID,
        status: 'OPEN',
        priority: 'LOW',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown status in the list query', () => {
      const result = barrierListQuerySchema.safeParse({ teamId: VALID_UUID, status: 'PENDING' });
      expect(result.success).toBe(false);
    });

    it('accepts an optional teamId in the id query', () => {
      const result = barrierIdQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
