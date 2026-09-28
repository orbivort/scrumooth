// Facilitation Validation Tests
// Focus: the shared dateSchema refinement (`value === '' || is a parseable date`)
// used by the coaching-entry / assessment request shapes.
import { describe, it, expect } from 'vitest';
import {
  createCoachingEntrySchema,
  updateCoachingEntrySchema,
  createWorkingAgreementSchema,
  updateWorkingAgreementSchema,
  createAssessmentSchema,
  teamQuerySchema,
} from '../../../validations/facilitation.validation';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('Facilitation Validation', () => {
  describe('dateSchema refinement (via createCoachingEntrySchema.followUpDate)', () => {
    it('accepts an empty string (clears the date)', () => {
      // Arrange
      const data = { teamId: VALID_UUID, topic: 'OTHER', note: 'a note', followUpDate: '' };

      // Act
      const result = createCoachingEntrySchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('accepts a parseable ISO date', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        topic: 'SELF_MANAGEMENT',
        note: 'a note',
        followUpDate: '2024-01-15',
      };

      // Act
      const result = createCoachingEntrySchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('accepts a parseable ISO timestamp', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        topic: 'CROSS_FUNCTIONALITY',
        note: 'a note',
        followUpDate: '2024-01-15T10:30:00.000Z',
      };

      // Act
      const result = createCoachingEntrySchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('rejects an unparseable date string', () => {
      // Arrange
      const data = {
        teamId: VALID_UUID,
        topic: 'OTHER',
        note: 'a note',
        followUpDate: 'definitely-not-a-date',
      };

      // Act
      const result = createCoachingEntrySchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('followUpDate');
      }
    });

    it('accepts a nullish followUpDate (field omitted)', () => {
      // Arrange
      const data = { teamId: VALID_UUID, topic: 'OTHER', note: 'a note' };

      // Act
      const result = createCoachingEntrySchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('createCoachingEntrySchema structure', () => {
    it('rejects an unknown topic', () => {
      const result = createCoachingEntrySchema.safeParse({
        teamId: VALID_UUID,
        topic: 'NOT_A_TOPIC',
        note: 'a note',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty note', () => {
      const result = createCoachingEntrySchema.safeParse({
        teamId: VALID_UUID,
        topic: 'OTHER',
        note: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a non-uuid teamId', () => {
      const result = createCoachingEntrySchema.safeParse({
        teamId: 'not-a-uuid',
        topic: 'OTHER',
        note: 'a note',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateCoachingEntrySchema', () => {
    it('accepts a partial update with a valid followUpDate', () => {
      const result = updateCoachingEntrySchema.safeParse({ followUpDate: '2024-02-01' });
      expect(result.success).toBe(true);
    });

    it('rejects an unparseable followUpDate on update', () => {
      const result = updateCoachingEntrySchema.safeParse({ followUpDate: 'nope' });
      expect(result.success).toBe(false);
    });
  });

  describe('working agreement schemas', () => {
    it('accepts a valid create payload', () => {
      const result = createWorkingAgreementSchema.safeParse({
        teamId: VALID_UUID,
        title: 'Working agreement',
        description: 'We agree to talk daily.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty title on create', () => {
      const result = createWorkingAgreementSchema.safeParse({
        teamId: VALID_UUID,
        title: '',
        description: 'We agree to talk daily.',
      });
      expect(result.success).toBe(false);
    });

    it('accepts a status transition on update', () => {
      const result = updateWorkingAgreementSchema.safeParse({ status: 'RETIRED' });
      expect(result.success).toBe(true);
    });

    it('rejects an unknown status on update', () => {
      const result = updateWorkingAgreementSchema.safeParse({ status: 'ARCHIVED' });
      expect(result.success).toBe(false);
    });
  });

  describe('createAssessmentSchema', () => {
    it('accepts a valid single-skill assessment', () => {
      const result = createAssessmentSchema.safeParse({
        teamId: VALID_UUID,
        assessedAt: '',
        summary: null,
        skills: [{ name: 'Testing', coverage: 'COVERED', note: null }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty skills array', () => {
      const result = createAssessmentSchema.safeParse({
        teamId: VALID_UUID,
        assessedAt: '2024-03-01',
        skills: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown coverage value', () => {
      const result = createAssessmentSchema.safeParse({
        teamId: VALID_UUID,
        assessedAt: '2024-03-01',
        skills: [{ name: 'Testing', coverage: 'MAYBE' }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('teamQuerySchema', () => {
    it('accepts a teamId with optional pagination', () => {
      const result = teamQuerySchema.safeParse({ teamId: VALID_UUID, limit: '10', offset: '0' });
      expect(result.success).toBe(true);
    });

    it('rejects a non-uuid teamId', () => {
      const result = teamQuerySchema.safeParse({ teamId: 'xxx' });
      expect(result.success).toBe(false);
    });
  });
});
