// Request shapes for team groups and their shared Definition of Done.
//
// The schemas validate the *shape* of what is supplied, so a malformed identifier or a non-numeric
// version becomes a structured refusal here instead of a Prisma error surfacing as a 500. The
// cluster rules -- who may act, which version may be adopted, whether a group still has teams --
// are gates and live in the service, where the answer is known.
import { z } from 'zod';

import { definitionItemsSchema } from './definitionItem.validation';

export const groupIdSchema = z.object({
  groupId: z.string().uuid('Invalid group ID'),
});

export const groupTeamIdSchema = z.object({
  teamId: z.string().uuid('Invalid team ID'),
});

export const createTeamGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').nullish(),
});

export const updateTeamGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  description: z.string().max(500, 'Description must be 500 characters or less').nullish(),
});

/**
 * The shared Definition of Done, replaced wholesale like the team's own: the items are the version.
 *
 * An inactive item is kept rather than dropped, because a Definition of Done that loses its history
 * of criteria would hide what the teams changed their minds about.
 *
 * Validated by the same schema as the team's own agreements. This one used to carry its own, stricter
 * copy, so a criterion that the team's editor accepted could be refused the moment the same
 * commitment was edited as the group's.
 */
export const updateSharedDoDSchema = definitionItemsSchema();

/**
 * Joining a group: which group, and which version of its shared Definition of Done is being adopted.
 *
 * The version is optional here on purpose. A missing or stale version is refused by
 * `GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED`, which carries the version in force in its copy --
 * a 400 from the schema would say "invalid" where the recoverable answer is "the current version is
 * N", and the gate is the contract an integrator branches on.
 */
export const joinTeamGroupSchema = z.object({
  groupId: z.string().uuid('Invalid group ID'),
  acknowledgedDodVersion: z
    .number()
    .int('The acknowledged version must be a whole number')
    .positive('The acknowledged version must be 1 or greater')
    .optional(),
});
