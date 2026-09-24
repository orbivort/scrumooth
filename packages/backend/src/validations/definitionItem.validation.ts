// The write shape shared by every agreement made of criteria.
//
// The team's Definition of Done, its Definition of Ready and the Definition of Done a group shares
// are three agreements but one payload: a list of criteria, each naming the row it already is (or
// naming none, meaning "this is new"). They were validated by two near-identical schemas that had
// drifted apart -- one unbounded in every dimension, the other capped -- so the same criterion could
// be accepted on one surface and refused on the other, and nothing explained which rule applied
// where. One schema is the honest expression of that: the rules are a property of a criterion, not
// of the screen it was typed on.
//
// The cap is not arbitrary. Both write services renumber criteria densely by shifting survivors out
// of the way first (`ORDER_SHIFT = 10_000`), and that offset is only guaranteed to clear the final
// range because the number of criteria is bounded. The bound is declared here so the services'
// assumption has a single source.
import { z } from 'zod';

/** The largest agreement the API accepts, and therefore the bound `ORDER_SHIFT` relies on. */
export const DEFINITION_ITEM_MAX_ITEMS = 50;

const DESCRIPTION_MAX_LENGTH = 500;
const CATEGORY_MAX_LENGTH = 100;

/**
 * One criterion of an agreement.
 *
 * `id` is the identity of a criterion that already exists: naming one updates that row in place, so
 * the verifications recorded against it survive the edit. It must be a UUID, because an id that
 * cannot name a row would otherwise be silently treated as a new criterion.
 *
 * `order` is accepted for payload compatibility and deliberately ignored by the services, which
 * order criteria by their position in the list. It is still validated, because a payload that
 * carries a value the contract does not describe is a client bug worth reporting rather than a
 * silently discarded field.
 *
 * `defaultKey` is deliberately absent. It names the built-in criterion a row descends from, and a
 * client able to set it could label its own sentence with the product's built-in wording; the
 * services therefore keep the column to themselves.
 */
export const definitionItemSchema = z.object({
  id: z.string().uuid('Invalid item ID').optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Description must be ${DESCRIPTION_MAX_LENGTH} characters or less`
    ),
  category: z
    .string()
    .max(CATEGORY_MAX_LENGTH, `Category must be ${CATEGORY_MAX_LENGTH} characters or less`)
    .optional(),
  isActive: z.boolean(),
  order: z.number().int('Order must be a whole number').min(0, 'Order cannot be negative'),
});

/**
 * The body of a write that replaces an agreement with a new version.
 *
 * @param maxItems the largest agreement this caller accepts. Defaults to the API-wide bound; a
 * caller with a narrower limit passes its own rather than restating the item rules.
 */
export const definitionItemsSchema = (maxItems: number = DEFINITION_ITEM_MAX_ITEMS) =>
  z.object({
    items: z
      .array(definitionItemSchema)
      .max(maxItems, `An agreement holds at most ${maxItems} criteria`),
  });
