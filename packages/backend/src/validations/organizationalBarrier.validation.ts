// Request shapes for the organizational barrier register.
//
// The schemas validate the *shape* of what is supplied: required-ness that the API documents as a
// 400 is left to the controllers, but a malformed status, priority or identifier becomes a
// structured refusal here instead of a Prisma error surfacing as a 500.
import { z } from 'zod';

const barrierPrioritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], {
  error: 'Invalid priority. Must be one of: CRITICAL, HIGH, MEDIUM, LOW',
});

const barrierStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], {
  error: 'Invalid status. Must be one of: OPEN, IN_PROGRESS, RESOLVED, CLOSED',
});

const stakeholderActionStatusSchema = z.enum(['OPEN', 'DONE', 'CANCELLED'], {
  error: 'Invalid status. Must be one of: OPEN, DONE, CANCELLED',
});

/** A date is an ISO date (`YYYY-MM-DD`) or an ISO timestamp; an empty value clears it. */
const dateSchema = z
  .string()
  .refine(
    (value) => value === '' || !Number.isNaN(Date.parse(value)),
    'Invalid date: expected an ISO date'
  )
  .nullish();

export const barrierIdSchema = z.object({
  id: z.string().uuid('Invalid barrier ID'),
});

export const actionIdSchema = z.object({
  actionId: z.string().uuid('Invalid stakeholder action ID'),
});

export const barrierListQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  status: barrierStatusSchema.optional(),
  priority: barrierPrioritySchema.optional(),
});

const barrierIdQuerySchema = z.object({
  teamId: z.string().uuid('Invalid team ID').optional(),
});

export const createBarrierSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(4000, 'Description must be 4000 characters or less'),
  priority: barrierPrioritySchema.optional(),
  // A barrier is owned by whoever can remove it, which may be someone outside the Scrum Team,
  // so an owner is any user of the installation rather than a team member.
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  targetDate: dateSchema,
});

export const updateBarrierSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200).optional(),
  description: z.string().min(1, 'Description cannot be empty').max(4000).optional(),
  status: barrierStatusSchema.optional(),
  resolution: z.string().max(4000, 'Resolution must be 4000 characters or less').optional(),
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  priority: barrierPrioritySchema.optional(),
  targetDate: dateSchema,
});

export const escalateImpedimentSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
  impedimentId: z.string().uuid('Invalid impediment ID'),
  // The escalation may restate the problem for an organizational reader; anything omitted is
  // carried over from the impediment itself.
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(4000).optional(),
  priority: barrierPrioritySchema.optional(),
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  targetDate: dateSchema,
});

export const createActionSchema = z.object({
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description must be 500 characters or less'),
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  dueDate: dateSchema,
});

export const updateActionSchema = z.object({
  description: z.string().min(1, 'Description cannot be empty').max(500).optional(),
  status: stakeholderActionStatusSchema.optional(),
  ownerId: z.string().uuid('Invalid owner ID').nullish(),
  dueDate: dateSchema,
});

export { barrierIdQuerySchema };
