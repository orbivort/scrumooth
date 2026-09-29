// Retrospective Validation Tests - Comprehensive Test Suite
import { describe, it, expect } from 'vitest';
import {
  createRetrospectiveSchema,
  updateRetrospectiveSchema,
  addItemSchema,
  updateItemSchema,
  addActionItemSchema,
  updateActionItemSchema,
  addAttendeeSchema,
  updateAttendeeSchema,
  dodReflectionSchema,
  linkActionItemSchema,
} from '../../../validations/retrospective.validation';

describe('Retrospective Validation', () => {
  describe('createRetrospectiveSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid create retrospective data with required fields', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: 'user-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid create retrospective data with optional retroDate', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: 'user-123',
          retroDate: '2024-01-15',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate with ISO date format', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: 'user-123',
          retroDate: '2024-01-15T10:30:00.000Z',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate with various date formats', () => {
        const validDates = [
          '2024-01-15',
          '2024-12-31',
          '2024-01-15T10:30:00Z',
          '2024-01-15T10:30:00.000Z',
        ];

        validDates.forEach((retroDate) => {
          const result = createRetrospectiveSchema.safeParse({
            sprintId: 'sprint-123',
            teamId: 'team-123',
            facilitatorId: 'user-123',
            retroDate,
          });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('sprintId validation', () => {
      it('should fail when sprintId is missing', () => {
        const data = {
          teamId: 'team-123',
          facilitatorId: 'user-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toContain('sprintId');
        }
      });

      it('should fail when sprintId is empty', () => {
        const data = {
          sprintId: '',
          teamId: 'team-123',
          facilitatorId: 'user-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should accept sprintId with special characters', () => {
        const data = {
          sprintId: 'sprint_123-abc.ABC',
          teamId: 'team-123',
          facilitatorId: 'user-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('teamId validation', () => {
      it('should fail when teamId is missing', () => {
        const data = {
          sprintId: 'sprint-123',
          facilitatorId: 'user-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toContain('teamId');
        }
      });

      it('should fail when teamId is empty', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: '',
          facilitatorId: 'user-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('facilitatorId validation', () => {
      it('should fail when facilitatorId is missing', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.path).toContain('facilitatorId');
        }
      });

      it('should fail when facilitatorId is empty', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: '',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('retroDate validation', () => {
      it('should fail with invalid date format', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: 'user-123',
          retroDate: 'invalid-date',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Invalid date format');
        }
      });

      it('should fail with empty date string', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: 'user-123',
          retroDate: '',
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail with numeric date', () => {
        const data = {
          sprintId: 'sprint-123',
          teamId: 'team-123',
          facilitatorId: 'user-123',
          retroDate: 1705315200000,
        };

        const result = createRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('updateRetrospectiveSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid update retrospective data with summary', () => {
        const data = {
          summary: 'Team had a great retrospective session with key insights.',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update retrospective data with status', () => {
        const data = {
          status: 'IN_PROGRESS',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update retrospective data with dodEvolutionNotes', () => {
        const data = {
          dodEvolutionNotes: 'We decided to add more stringent code review requirements.',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate status field with all valid values', () => {
        const validStatuses = ['DRAFT', 'IN_PROGRESS', 'COMPLETED'];

        validStatuses.forEach((status) => {
          const result = updateRetrospectiveSchema.safeParse({ status });
          expect(result.success).toBe(true);
        });
      });

      it('should validate with multiple fields', () => {
        const data = {
          summary: 'Team had a great retrospective session with key insights.',
          status: 'COMPLETED',
          dodEvolutionNotes: 'We decided to add more stringent code review requirements.',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept summary at minimum length (10 characters)', () => {
        const data = {
          summary: 'a'.repeat(10),
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept summary at maximum length (1000 characters)', () => {
        const data = {
          summary: 'a'.repeat(1000),
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept empty dodEvolutionNotes', () => {
        const data = {
          summary: 'Team had a great retrospective session with key insights.',
          dodEvolutionNotes: '',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept dodEvolutionNotes at minimum length when provided (10 characters)', () => {
        const data = {
          dodEvolutionNotes: 'a'.repeat(10),
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept dodEvolutionNotes at maximum length (2000 characters)', () => {
        const data = {
          dodEvolutionNotes: 'a'.repeat(2000),
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('summary validation', () => {
      it('should fail when summary is too short (less than 10 characters)', () => {
        const data = {
          summary: 'Too short',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('10 characters');
        }
      });

      it('should fail when summary is too long (more than 1000 characters)', () => {
        const data = {
          summary: 'a'.repeat(1001),
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('1000 characters');
        }
      });

      it('should reject HTML tags in summary', () => {
        const data = {
          summary: '<script>alert(1)</script>Team retrospective',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('HTML tags');
        }
      });

      it('should reject various HTML tags in summary', () => {
        const htmlTags = [
          '<div>content</div>',
          '<p>paragraph</p>',
          '<span>span</span>',
          '<b>bold</b>',
          '<i>italic</i>',
        ];

        htmlTags.forEach((summary) => {
          const result = updateRetrospectiveSchema.safeParse({ summary });
          expect(result.success).toBe(false);
        });
      });
    });

    describe('dodEvolutionNotes validation', () => {
      it('should fail when dodEvolutionNotes is too short (less than 10 characters when provided)', () => {
        const data = {
          dodEvolutionNotes: 'Too short',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('at least 10 characters');
        }
      });

      it('should fail when dodEvolutionNotes is too long (more than 2000 characters)', () => {
        const data = {
          dodEvolutionNotes: 'a'.repeat(2001),
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('2000 characters');
        }
      });

      it('should reject HTML tags in dodEvolutionNotes', () => {
        const data = {
          dodEvolutionNotes: '<script>alert(1)</script>DoD evolution notes here',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('HTML tags');
        }
      });
    });

    describe('status validation', () => {
      it('should fail with invalid status value', () => {
        const data = {
          status: 'INVALID_STATUS',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('DRAFT, IN_PROGRESS, COMPLETED');
        }
      });

      it('should fail with wrong case status', () => {
        const data = {
          status: 'in_progress',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail with empty status', () => {
        const data = {
          status: '',
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('at least one field requirement', () => {
      it('should fail when no fields provided', () => {
        const data = {};

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('At least one field');
        }
      });

      it('should fail when all fields are undefined', () => {
        const data = {
          summary: undefined,
          status: undefined,
          dodEvolutionNotes: undefined,
        };

        const result = updateRetrospectiveSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('addItemSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid item data', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'Daily standups were effective',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate all valid categories', () => {
        const validCategories = ['WENT_WELL', 'DIDNT_GO_WELL', 'IMPROVEMENT'];

        validCategories.forEach((category) => {
          const result = addItemSchema.safeParse({ category, content: 'Test content' });
          expect(result.success).toBe(true);
        });
      });

      it('should accept content at maximum length (500 characters)', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'a'.repeat(500),
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept optional authorId and authorName', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'Good collaboration',
          authorId: 'user-123',
          authorName: 'John Doe',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept only authorId', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'Good collaboration',
          authorId: 'user-123',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept only authorName', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'Good collaboration',
          authorName: 'John Doe',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('category validation', () => {
      it('should fail with invalid category', () => {
        const data = {
          category: 'INVALID_CATEGORY',
          content: 'Test content',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain(
            'WENT_WELL, DIDNT_GO_WELL, IMPROVEMENT'
          );
        }
      });

      it('should fail with wrong case category', () => {
        const data = {
          category: 'went_well',
          content: 'Test content',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail with empty category', () => {
        const data = {
          category: '',
          content: 'Test content',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when category is missing', () => {
        const data = {
          content: 'Test content',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('content validation', () => {
      it('should fail when content is missing', () => {
        const data = {
          category: 'WENT_WELL',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when content is empty', () => {
        const data = {
          category: 'WENT_WELL',
          content: '',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when content is too long (more than 500 characters)', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'a'.repeat(501),
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('500 characters');
        }
      });

      it('should accept content at exactly 500 characters', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'a'.repeat(500),
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept content at exactly 1 character', () => {
        const data = {
          category: 'WENT_WELL',
          content: 'a',
        };

        const result = addItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('updateItemSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid update item data', () => {
        const data = {
          content: 'Updated content for the retrospective item',
        };

        const result = updateItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept content at maximum length (500 characters)', () => {
        const data = {
          content: 'a'.repeat(500),
        };

        const result = updateItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept content at minimum length (1 character)', () => {
        const data = {
          content: 'a',
        };

        const result = updateItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('content validation', () => {
      it('should fail when content is empty', () => {
        const data = {
          content: '',
        };

        const result = updateItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Content cannot be empty');
        }
      });

      it('should fail when content is too long (more than 500 characters)', () => {
        const data = {
          content: 'a'.repeat(501),
        };

        const result = updateItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('500 characters');
        }
      });
    });

    describe('empty object validation', () => {
      it('should accept empty object (partial update)', () => {
        const data = {};

        const result = updateItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('addActionItemSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid action item data', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          dueDate: '2024-02-01',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate with only required fields', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept all valid statuses', () => {
        const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

        validStatuses.forEach((status) => {
          const result = addActionItemSchema.safeParse({
            title: 'Test action item',
            ownerId: 'user-123',
            status,
          });
          expect(result.success).toBe(true);
        });
      });

      it('should accept optional dueDate', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept optional description', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          description: 'Update API docs with new endpoints',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept optional status', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          status: 'PENDING',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept title at maximum length (200 characters)', () => {
        const data = {
          title: 'a'.repeat(200),
          ownerId: 'user-123',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept description at maximum length (1000 characters)', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          description: 'a'.repeat(1000),
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept various date formats', () => {
        const validDates = [
          '2024-02-01',
          '2024-12-31',
          '2024-02-01T10:30:00Z',
          '2024-02-01T10:30:00.000Z',
        ];

        validDates.forEach((dueDate) => {
          const result = addActionItemSchema.safeParse({
            title: 'Test action item',
            ownerId: 'user-123',
            dueDate,
          });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('title validation', () => {
      it('should fail when title is missing', () => {
        const data = {
          ownerId: 'user-123',
          dueDate: '2024-02-01',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when title is empty', () => {
        const data = {
          title: '',
          ownerId: 'user-123',
          dueDate: '2024-02-01',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when title is too long (more than 200 characters)', () => {
        const data = {
          title: 'a'.repeat(201),
          ownerId: 'user-123',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('200 characters');
        }
      });
    });

    describe('ownerId validation', () => {
      it('should fail when ownerId is missing', () => {
        const data = {
          title: 'Improve documentation',
          dueDate: '2024-02-01',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when ownerId is empty', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: '',
          dueDate: '2024-02-01',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('description validation', () => {
      it('should fail when description is too long (more than 1000 characters)', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          description: 'a'.repeat(1001),
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('1000 characters');
        }
      });
    });

    describe('status validation', () => {
      it('should fail with invalid status', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          status: 'INVALID_STATUS',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain(
            'PENDING, IN_PROGRESS, COMPLETED, CANCELLED'
          );
        }
      });

      it('should fail with wrong case status', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          status: 'in_progress',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('dueDate validation', () => {
      it('should fail with invalid date format', () => {
        const data = {
          title: 'Improve documentation',
          ownerId: 'user-123',
          dueDate: 'invalid-date',
        };

        const result = addActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Invalid date format');
        }
      });
    });
  });

  describe('updateActionItemSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid update with title', () => {
        const data = {
          title: 'Updated title',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with description', () => {
        const data = {
          description: 'Updated description',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with status', () => {
        const data = {
          status: 'COMPLETED',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with dueDate', () => {
        const data = {
          dueDate: '2024-03-01',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with null dueDate', () => {
        const data = {
          dueDate: null,
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with addedToSprintBacklog', () => {
        const data = {
          addedToSprintBacklog: true,
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should strip relatedSprintId, which only the link actions may set', () => {
        const data = {
          relatedSprintId: '550e8400-e29b-41d4-a716-446655440000',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('relatedSprintId');
      });

      it('should validate valid update with multiple fields', () => {
        const data = {
          title: 'Updated title',
          description: 'Updated description',
          status: 'IN_PROGRESS',
          dueDate: '2024-03-01',
          addedToSprintBacklog: true,
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept empty object (partial update)', () => {
        const data = {};

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('title validation', () => {
      it('should fail when title is empty', () => {
        const data = {
          title: '',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Title cannot be empty');
        }
      });

      it('should fail when title is too long (more than 200 characters)', () => {
        const data = {
          title: 'a'.repeat(201),
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('200 characters');
        }
      });
    });

    describe('description validation', () => {
      it('should fail when description is too long (more than 1000 characters)', () => {
        const data = {
          description: 'a'.repeat(1001),
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('1000 characters');
        }
      });
    });

    describe('status validation', () => {
      it('should fail with invalid status', () => {
        const data = {
          status: 'INVALID_STATUS',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should accept all valid statuses', () => {
        const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

        validStatuses.forEach((status) => {
          const result = updateActionItemSchema.safeParse({ status });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('dueDate validation', () => {
      it('should fail with invalid date format', () => {
        const data = {
          dueDate: 'invalid-date',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe('Invalid date format');
        }
      });

      it('should accept valid date string', () => {
        const data = {
          dueDate: '2024-03-01',
        };

        const result = updateActionItemSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('relatedSprintId is not client-settable', () => {
      // The Sprint an improvement was taken into is evidence, not an input: only materializing or
      // linking a backlog item establishes it, so the field is absent from the schema entirely.
      it('should drop a well-formed value', () => {
        const result = updateActionItemSchema.safeParse({
          relatedSprintId: '550e8400-e29b-41d4-a716-446655440000',
        });

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('relatedSprintId');
      });

      it('should drop a malformed value rather than reject the request', () => {
        const result = updateActionItemSchema.safeParse({
          relatedSprintId: 'invalid-uuid',
        });

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('relatedSprintId');
      });
    });
  });

  describe('addAttendeeSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid attendee data', () => {
        const data = {
          name: 'John Doe',
          role: 'developers',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate all valid roles', () => {
        const validRoles = ['product_owner', 'scrum_master', 'developers', 'stakeholder'];

        validRoles.forEach((role) => {
          const result = addAttendeeSchema.safeParse({ name: 'John Doe', role });
          expect(result.success).toBe(true);
        });
      });

      it('should accept optional email', () => {
        const data = {
          name: 'John Doe',
          role: 'developers',
          email: 'john@example.com',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should default attended to true', () => {
        const data = {
          name: 'John Doe',
          role: 'developers',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.attended).toBe(true);
        }
      });

      it('should accept attended as false', () => {
        const data = {
          name: 'John Doe',
          role: 'developers',
          attended: false,
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.attended).toBe(false);
        }
      });

      it('should accept name at maximum length (100 characters)', () => {
        const data = {
          name: 'a'.repeat(100),
          role: 'developers',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('name validation', () => {
      it('should fail when name is missing', () => {
        const data = {
          role: 'developers',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when name is empty', () => {
        const data = {
          name: '',
          role: 'developers',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when name is too long (more than 100 characters)', () => {
        const data = {
          name: 'a'.repeat(101),
          role: 'developers',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('100 characters');
        }
      });
    });

    describe('role validation', () => {
      it('should fail with invalid role', () => {
        const data = {
          name: 'John Doe',
          role: 'INVALID_ROLE',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain(
            'product_owner, scrum_master, developers, stakeholder'
          );
        }
      });

      it('should fail with wrong case role', () => {
        const data = {
          name: 'John Doe',
          role: 'Developer',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should fail when role is missing', () => {
        const data = {
          name: 'John Doe',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('email validation', () => {
      it('should fail with invalid email format', () => {
        const data = {
          name: 'John Doe',
          role: 'developers',
          email: 'invalid-email',
        };

        const result = addAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('valid email address');
        }
      });

      it('should accept valid email formats', () => {
        const validEmails = [
          'john@example.com',
          'john.doe@example.co.uk',
          'john+tag@example.com',
          'john_doe@example-domain.com',
        ];

        validEmails.forEach((email) => {
          const result = addAttendeeSchema.safeParse({
            name: 'John Doe',
            role: 'developers',
            email,
          });
          expect(result.success).toBe(true);
        });
      });
    });
  });

  describe('updateAttendeeSchema', () => {
    describe('valid inputs', () => {
      it('should validate valid update with name', () => {
        const data = {
          name: 'Updated Name',
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with email', () => {
        const data = {
          email: 'updated@example.com',
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with null email', () => {
        const data = {
          email: null,
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with role', () => {
        const data = {
          role: 'scrum_master',
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with attended', () => {
        const data = {
          attended: false,
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should validate valid update with multiple fields', () => {
        const data = {
          name: 'Updated Name',
          email: 'updated@example.com',
          role: 'product_owner',
          attended: true,
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });

      it('should accept empty object (partial update)', () => {
        const data = {};

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('name validation', () => {
      it('should fail when name is empty', () => {
        const data = {
          name: '',
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Name cannot be empty');
        }
      });

      it('should fail when name is too long (more than 100 characters)', () => {
        const data = {
          name: 'a'.repeat(101),
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('100 characters');
        }
      });
    });

    describe('email validation', () => {
      it('should fail with invalid email format', () => {
        const data = {
          email: 'invalid-email',
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('valid email address');
        }
      });

      it('should accept null email', () => {
        const data = {
          email: null,
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(true);
      });
    });

    describe('role validation', () => {
      it('should fail with invalid role', () => {
        const data = {
          role: 'INVALID_ROLE',
        };

        const result = updateAttendeeSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should accept all valid roles', () => {
        const validRoles = ['product_owner', 'scrum_master', 'developers', 'stakeholder'];

        validRoles.forEach((role) => {
          const result = updateAttendeeSchema.safeParse({ role });
          expect(result.success).toBe(true);
        });
      });
    });
  });

  describe('authorship is not client-supplied', () => {
    it('should strip authorId and authorName from an added item', () => {
      const result = addItemSchema.safeParse({
        category: 'WENT_WELL',
        content: 'Great teamwork',
        authorId: 'someone-else',
        authorName: 'Someone Else',
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('authorId');
      expect(result.data).not.toHaveProperty('authorName');
    });
  });

  describe('anonymity is chosen at creation', () => {
    it('should default to a named Retrospective', () => {
      const result = createRetrospectiveSchema.safeParse({
        sprintId: 'sprint-1',
        teamId: 'team-1',
        facilitatorId: 'user-1',
      });

      expect(result.success).toBe(true);
      expect(result.data?.isAnonymous).toBe(false);
    });

    it('should accept an anonymous Retrospective', () => {
      const result = createRetrospectiveSchema.safeParse({
        sprintId: 'sprint-1',
        teamId: 'team-1',
        facilitatorId: 'user-1',
        isAnonymous: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.isAnonymous).toBe(true);
    });

    it('should not be updatable after creation', () => {
      const result = updateRetrospectiveSchema.safeParse({
        summary: 'A long enough summary',
        isAnonymous: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('isAnonymous');
    });
  });

  describe('dodReflectionSchema', () => {
    it('should accept a keep decision without a replacement', () => {
      const result = dodReflectionSchema.safeParse({
        dodItemId: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Peer reviewed',
        decision: 'KEEP',
      });

      expect(result.success).toBe(true);
    });

    it('should accept a proposed criterion with no existing item', () => {
      const result = dodReflectionSchema.safeParse({
        dodItemId: null,
        description: 'Deployed to staging',
        decision: 'KEEP',
      });

      expect(result.success).toBe(true);
    });

    it('should require the new text for a change', () => {
      const result = dodReflectionSchema.safeParse({
        dodItemId: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Unit tests pass',
        decision: 'CHANGE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['proposedDescription']);
      }
    });

    it('should accept a change that states its new text', () => {
      const result = dodReflectionSchema.safeParse({
        dodItemId: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Unit tests pass',
        decision: 'CHANGE',
        proposedDescription: 'Unit tests pass with 80% coverage',
      });

      expect(result.success).toBe(true);
    });

    it('should reject an unknown decision', () => {
      const result = dodReflectionSchema.safeParse({
        dodItemId: null,
        description: 'Something',
        decision: 'MAYBE',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('the Definition of Done reflection on an update', () => {
    it('should accept a bounded reflection and count as an update on its own', () => {
      const result = updateRetrospectiveSchema.safeParse({
        dodReflections: [
          { dodItemId: null, description: 'Deployed to staging', decision: 'KEEP' },
          {
            dodItemId: '550e8400-e29b-41d4-a716-446655440000',
            description: 'Manual sign-off',
            decision: 'RETIRE',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.dodReflections).toHaveLength(2);
    });

    it('should reject more criteria than a Retrospective can inspect', () => {
      const result = updateRetrospectiveSchema.safeParse({
        dodReflections: Array.from({ length: 101 }, (_, index) => ({
          dodItemId: null,
          description: `Criterion ${index}`,
          decision: 'KEEP',
        })),
      });

      expect(result.success).toBe(false);
    });
  });

  describe('linkActionItemSchema', () => {
    it('should require a Product Backlog item id', () => {
      expect(linkActionItemSchema.safeParse({}).success).toBe(false);
      expect(
        linkActionItemSchema.safeParse({ pbiId: '550e8400-e29b-41d4-a716-446655440000' }).success
      ).toBe(true);
    });
  });
});
