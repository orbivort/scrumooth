-- Close two Sprint Review transparency gaps a Scrum Guide conformance evaluation recorded.
--
--  1. Key stakeholders were not modelled as people. `review_attendees` stored free-text
--     name/email/role, so attendance at the Review -- the event where "the Scrum Team presents
--     the results of their work to key stakeholders" -- could not be attributed to a registered
--     user. `userId` links an attendee to an account when one exists; the free-text fields
--     remain for genuinely external stakeholders.
--  2. Backlog adjustments had no traceable path into the Product Backlog. `createdPbiId` records
--     the item an adjustment actually produced, so "the Product Backlog may also be adjusted" is
--     provable rather than asserted through a manual `implemented` flag. The existing `pbiId`
--     is untouched: it names the item an adjustment *refers to*, not the item it *produced*.
--
-- Both additions are nullable, so existing rows stay valid and no backfill is fabricated.

-- ---------------------------------------------------------------------------
-- 1. A Review attendee may be a registered user.
-- ---------------------------------------------------------------------------

ALTER TABLE "review_attendees" ADD COLUMN "userId" UUID;

CREATE INDEX "review_attendees_userId_idx" ON "review_attendees"("userId");

-- A deleted account must not destroy the attendance record: the fact that *someone* attended
-- survives; only the name resolution is lost (the free-text name/email also remain).
ALTER TABLE "review_attendees" ADD CONSTRAINT "review_attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. A backlog adjustment records the item it produced.
-- ---------------------------------------------------------------------------

ALTER TABLE "backlog_adjustments" ADD COLUMN "createdPbiId" UUID;

CREATE INDEX "backlog_adjustments_createdPbiId_idx" ON "backlog_adjustments"("createdPbiId");

-- The adjustment survives the deletion of the item it produced, for the same reason an
-- adjustment survives its owning Review's item: the record of the decision is the point.
ALTER TABLE "backlog_adjustments" ADD CONSTRAINT "backlog_adjustments_createdPbiId_fkey" FOREIGN KEY ("createdPbiId") REFERENCES "product_backlog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
