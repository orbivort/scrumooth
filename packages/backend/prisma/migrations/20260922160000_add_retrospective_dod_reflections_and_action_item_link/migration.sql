-- Close two Sprint Retrospective gaps a Scrum Guide conformance evaluation recorded.
--
--  1. The Retrospective did not inspect the Definition of Done. The Guide names it as one of the
--     things the event inspects ("individuals, interactions, processes, tools, and their
--     Definition of Done"), but the event could only produce a free-text summary. `dodReflections`
--     records the per-criterion decision (keep / change / retire) the team reached, and
--     `dodVersionAtPush` records the Definition of Done version the Retrospective produced when
--     its accepted changes were applied -- the evidence that the adaptation loop closed.
--  2. Improvements were not verifiably "addressed as soon as possible". `addedToSprintBacklog`
--     was a manual flag with nothing behind it. `productBacklogItemId` records the item an action
--     item actually produced (or the existing one it was linked to), so follow-through is
--     provable rather than asserted.
--
-- Both additions are nullable, so existing rows stay valid and no backfill is fabricated.

-- ---------------------------------------------------------------------------
-- 1. The Retrospective inspects its Definition of Done.
-- ---------------------------------------------------------------------------

-- JSONB rather than a child table: the reflection is a snapshot of intent that is never queried
-- by field, so a relation would add a join to every read for no read benefit.
ALTER TABLE "sprint_retrospectives" ADD COLUMN "dodReflections" JSONB,
ADD COLUMN "dodVersionAtPush" INTEGER;

-- ---------------------------------------------------------------------------
-- 2. A Retrospective action item records the backlog item it produced.
-- ---------------------------------------------------------------------------

ALTER TABLE "retro_action_items" ADD COLUMN "productBacklogItemId" UUID;

CREATE INDEX "retro_action_items_productBacklogItemId_idx" ON "retro_action_items"("productBacklogItemId");

-- The improvement survives the deletion of the item it produced, for the same reason a Review
-- adjustment survives its produced item: the record of the commitment is the point.
ALTER TABLE "retro_action_items" ADD CONSTRAINT "retro_action_items_productBacklogItemId_fkey" FOREIGN KEY ("productBacklogItemId") REFERENCES "product_backlog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
