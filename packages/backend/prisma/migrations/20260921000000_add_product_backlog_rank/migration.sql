-- Give the Product Backlog a persisted order of record.
--
-- The 2020 Scrum Guide defines the Product Backlog as an *ordered* list, and ordering it is
-- the Product Owner's accountability. Until now the only "order" was the categorical MoSCoW
-- band plus creation time (`priority asc, createdAt desc`), which cannot express what is
-- next. `rank` is the order of record: dense and 1-based within a team, appended on create,
-- rewritten 1..N by a reorder. MoSCoW remains a categorisation rendered on top of it.
--
-- `DEFAULT 0` keeps the ADD COLUMN a metadata-only operation on an existing table and acts
-- as a safety net for any legacy write path; application code always computes an explicit
-- rank. Every existing row is then backfilled so a live backlog keeps a deterministic,
-- human-meaningful order instead of collapsing into ties on a single default value.

ALTER TABLE "product_backlog_items" ADD COLUMN "rank" INTEGER NOT NULL DEFAULT 0;

-- Backfill: dense, 1-based rank per team, following the legacy display order. The CASE
-- mirrors the old `priority ASC` ordering (MoSCoWPriority is declared MUST_HAVE, SHOULD_HAVE,
-- COULD_HAVE, WONT_HAVE), and `createdAt DESC` mirrors the old secondary sort. `id ASC` is the
-- final tiebreaker so the result is reproducible on rows created in the same millisecond.
WITH ordered AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "teamId"
            ORDER BY
                CASE "priority"
                    WHEN 'MUST_HAVE' THEN 0
                    WHEN 'SHOULD_HAVE' THEN 1
                    WHEN 'COULD_HAVE' THEN 2
                    ELSE 3
                END ASC,
                "createdAt" DESC,
                "id" ASC
        ) AS "computedRank"
    FROM "product_backlog_items"
)
UPDATE "product_backlog_items" AS pbi
SET "rank" = ordered."computedRank"
FROM ordered
WHERE pbi."id" = ordered."id";

-- Supports the backlog read path (`WHERE teamId = ? ORDER BY rank`) and the reorder read
-- that resolves a team's current order.
CREATE INDEX "product_backlog_items_teamId_rank_idx" ON "product_backlog_items"("teamId", "rank");
