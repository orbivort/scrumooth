/**
 * The Product Backlog's order of record.
 *
 * The 2020 Scrum Guide defines the Product Backlog as an *ordered* list, and ordering it is the
 * Product Owner's accountability. `rank` is that order: dense and 1-based within a team,
 * appended on create and rewritten 1..N by a reorder.
 *
 * MoSCoW priority is deliberately NOT part of this order — it is a categorisation rendered on
 * top of it (the conformance defect this module closes: "the Backlog is ordered by priority
 * band, so what is next cannot be expressed").
 *
 * `createdAt` and `id` are deterministic tiebreakers for the transient window in which two
 * concurrent creates compute the same rank. They keep a read stable instead of letting ties
 * resolve arbitrarily; the next reorder re-densifies the ranks.
 *
 * This lives in its own module rather than inside a service because more than one service reads
 * the backlog (the Product Backlog itself, and the pool of items eligible for a Sprint). A
 * single definition is what keeps "the order" the same everywhere it is shown.
 */
import type { Prisma } from '../generated/prisma/client';

export const PRODUCT_BACKLOG_ORDER: Prisma.ProductBacklogItemOrderByWithRelationInput[] = [
  { rank: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

export default PRODUCT_BACKLOG_ORDER;
