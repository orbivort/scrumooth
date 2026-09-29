import { z } from 'zod';

const emailValidator = z
  .union([z.string().email('Please enter a valid email address'), z.literal(''), z.undefined()])
  .optional();

const dateValidator = z
  .string()
  .refine((val) => !isNaN(new Date(val).getTime()), {
    message: 'Invalid date format',
  })
  .optional();

const retroItemCategoryEnum = z.enum(['WENT_WELL', 'DIDNT_GO_WELL', 'IMPROVEMENT'], {
  error: 'Invalid category. Must be one of: WENT_WELL, DIDNT_GO_WELL, IMPROVEMENT',
});

const actionItemStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
  error: 'Invalid status. Must be one of: PENDING, IN_PROGRESS, COMPLETED, CANCELLED',
});

const retrospectiveStatusEnum = z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED'], {
  error: 'Invalid status. Must be one of: DRAFT, IN_PROGRESS, COMPLETED',
});

const attendeeRoleEnum = z.enum(['product_owner', 'scrum_master', 'developers', 'stakeholder'], {
  error: 'Invalid role. Must be one of: product_owner, scrum_master, developers, stakeholder',
});

export const createRetrospectiveSchema = z.object({
  sprintId: z.string().min(1, 'sprintId is required'),
  teamId: z.string().min(1, 'teamId is required'),
  facilitatorId: z.string().min(1, 'facilitatorId is required'),
  retroDate: dateValidator,
  // Chosen once, at creation, and never updatable: a Retrospective flipped to anonymous after the
  // fact would still hold the authors it recorded, and one flipped back would expose contributions
  // that were made on the promise of anonymity.
  isAnonymous: z.boolean().optional().default(false),
});

// Authorship is deliberately absent. The author of a Retrospective item is the caller, taken from
// the session; accepting it from the request would let one member post in another's name and, in an
// anonymous Retrospective, would be a way to attach a name to an unnamed contribution.
export const addItemSchema = z.object({
  category: retroItemCategoryEnum,
  content: z
    .string()
    .min(1, 'Content is required and cannot be empty')
    .max(500, 'Content must be 500 characters or less'),
});

export const updateItemSchema = z.object({
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(500, 'Content must be 500 characters or less')
    .optional(),
});

export const addActionItemSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required and cannot be empty')
    .max(200, 'Title must be 200 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  ownerId: z.string().min(1, 'Owner ID is required'),
  dueDate: dateValidator,
  status: actionItemStatusEnum.optional(),
});

// `relatedSprintId` is deliberately absent: it records the Sprint an improvement was taken into,
// which only the materialize/link actions can establish. A client-settable value would let the
// record claim a follow-through that never happened.
export const updateActionItemSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  status: actionItemStatusEnum.optional(),
  dueDate: dateValidator.nullable(),
  addedToSprintBacklog: z.boolean().optional(),
});

const dodReflectionDecisionEnum = z.enum(['KEEP', 'CHANGE', 'RETIRE'], {
  error: 'Invalid decision. Must be one of: KEEP, CHANGE, RETIRE',
});

/**
 * One Definition of Done criterion as the team inspected it.
 *
 * A `CHANGE` decision without the replacement text would record that the team wanted something
 * different without saying what, so the refinement refuses it here rather than accepting a
 * reflection that cannot be applied.
 */
export const dodReflectionSchema = z
  .object({
    dodItemId: z.string().uuid('Invalid Definition of Done item ID').nullable(),
    description: z
      .string()
      .min(1, 'A criterion description is required')
      .max(500, 'A criterion description must be 500 characters or less'),
    decision: dodReflectionDecisionEnum,
    proposedDescription: z
      .string()
      .max(500, 'The changed criterion must be 500 characters or less')
      .nullable()
      .optional(),
    note: z.string().max(1000, 'A note must be 1000 characters or less').nullable().optional(),
    order: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'CHANGE' && !value.proposedDescription?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proposedDescription'],
        message: 'A changed criterion must state its new text',
      });
    }
  });

export const updateRetrospectiveSchema = z
  .object({
    summary: z
      .string()
      .min(10, 'Summary must be at least 10 characters')
      .max(1000, 'Summary must be 1000 characters or less')
      .refine((val: string) => !/<[^>]*>/g.test(val), {
        message: 'HTML tags are not allowed in summary',
      })
      .optional(),
    dodEvolutionNotes: z
      .string()
      .max(2000, 'DoD evolution notes must be 2000 characters or less')
      .refine((val: string) => val.length === 0 || val.length >= 10, {
        message: 'DoD evolution notes must be at least 10 characters if provided',
      })
      .refine((val: string) => !/<[^>]*>/g.test(val), {
        message: 'HTML tags are not allowed in DoD evolution notes',
      })
      .optional(),
    // The structured counterpart of `dodEvolutionNotes`: what the team decided about each
    // criterion. Bounded so a Retrospective cannot be turned into unbounded storage.
    dodReflections: z
      .array(dodReflectionSchema)
      .max(100, 'A Retrospective can inspect at most 100 criteria')
      .nullable()
      .optional(),
    status: retrospectiveStatusEnum.optional(),
  })
  .refine(
    (data) =>
      data.summary !== undefined ||
      data.dodEvolutionNotes !== undefined ||
      data.dodReflections !== undefined ||
      data.status !== undefined,
    {
      message:
        'At least one field (summary, dodEvolutionNotes, dodReflections, or status) is required',
    }
  );

// Applying the Definition of Done changes takes no body: the accepted change set lives in the
// Retrospective's own reflection, so the client cannot substitute a different change set for the one
// the team recorded.
export const linkActionItemSchema = z.object({
  pbiId: z.string().uuid('A Product Backlog item ID is required'),
});

export const addAttendeeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  email: emailValidator,
  role: attendeeRoleEnum,
  attended: z.boolean().optional().default(true),
});

export const updateAttendeeSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  email: emailValidator.nullable(),
  role: attendeeRoleEnum.optional(),
  attended: z.boolean().optional(),
});

export type CreateRetrospectiveInput = z.infer<typeof createRetrospectiveSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type AddActionItemInput = z.infer<typeof addActionItemSchema>;
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;
export type UpdateRetrospectiveInput = z.infer<typeof updateRetrospectiveSchema>;
export type DodReflectionInput = z.infer<typeof dodReflectionSchema>;
export type LinkActionItemInput = z.infer<typeof linkActionItemSchema>;
export type AddAttendeeInput = z.infer<typeof addAttendeeSchema>;
export type UpdateAttendeeInput = z.infer<typeof updateAttendeeSchema>;
