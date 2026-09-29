// Request shapes for the Scrum Master's facilitation record: the coaching log, the team's working
// agreements and the cross-functionality assessment.
import { z } from 'zod';

const coachingTopicSchema = z.enum(['SELF_MANAGEMENT', 'CROSS_FUNCTIONALITY', 'OTHER'], {
  error: 'Invalid topic. Must be one of: SELF_MANAGEMENT, CROSS_FUNCTIONALITY, OTHER',
});

const agreementStatusSchema = z.enum(['ACTIVE', 'RETIRED'], {
  error: 'Invalid status. Must be one of: ACTIVE, RETIRED',
});

const skillCoverageSchema = z.enum(['NONE', 'PARTIAL', 'COVERED'], {
  error: 'Invalid coverage. Must be one of: NONE, PARTIAL, COVERED',
});

/** A date is an ISO date (`YYYY-MM-DD`) or an ISO timestamp; an empty value clears it. */
const dateSchema = z
  .string()
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(value)),
    'Invalid date: expected an ISO date'
  )
  .nullish();

export const coachingEntryIdSchema = z.object({
  id: z.string().uuid('Invalid coaching entry ID'),
});

export const agreementIdSchema = z.object({
  id: z.string().uuid('Invalid working agreement ID'),
});

export const assessmentIdSchema = z.object({
  id: z.string().uuid('Invalid assessment ID'),
});

/** The team a request acts in. Read from the query on reads and the body on writes. */
export const teamQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export const createCoachingEntrySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  topic: coachingTopicSchema,
  note: z.string().min(1, 'Note is required').max(4000, 'Note must be 4000 characters or less'),
  sprintId: z.string().uuid('Invalid sprint ID').nullish(),
  followUpDate: dateSchema,
});

export const updateCoachingEntrySchema = z.object({
  topic: coachingTopicSchema.optional(),
  note: z.string().min(1, 'Note cannot be empty').max(4000).optional(),
  sprintId: z.string().uuid('Invalid sprint ID').nullish(),
  followUpDate: dateSchema,
});

export const createWorkingAgreementSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description must be 2000 characters or less'),
});

export const updateWorkingAgreementSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200).optional(),
  description: z.string().min(1, 'Description cannot be empty').max(2000).optional(),
  status: agreementStatusSchema.optional(),
});

export const createAssessmentSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  assessedAt: dateSchema,
  summary: z.string().max(2000, 'Summary must be 2000 characters or less').nullish(),
  skills: z
    .array(
      z.object({
        name: z.string().min(1, 'Skill name is required').max(120),
        coverage: skillCoverageSchema,
        note: z.string().max(500, 'Note must be 500 characters or less').nullish(),
      })
    )
    .min(1, 'At least one skill is required')
    .max(50, 'An assessment holds at most 50 skills'),
});
