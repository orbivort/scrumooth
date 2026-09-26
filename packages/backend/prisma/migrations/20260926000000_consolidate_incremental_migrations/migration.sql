-- =============================================================================
-- Consolidated incremental migrations
-- =============================================================================
--
-- Every incremental migration that followed `00000000000000_init` is collapsed into this one file.
-- A database created by applying `00000000000000_init` and then this file is identical to one
-- created by applying `00000000000000_init` and then every migration listed below, in order. That
-- equivalence is the contract of this file, and it is what the consolidated migration is verified
-- against.
--
-- Why one file: the incremental history had grown to sixteen migrations whose net effect is a
-- single, already-shipped schema. Reading that net effect meant replaying sixteen deltas in your
-- head, and several of the deltas exist only to correct an earlier one (see "Collapsed history"
-- below). The reasoning each migration recorded is kept in the section that carries its statements
-- -- those comments are the durable part, not the file boundaries.
--
-- Sources, in chronological order
-- -------------------------------
--   1. 20260921000000_add_product_backlog_rank
--   2. 20260921120000_add_sprint_planning_attendance_and_capacity
--   3. 20260921140000_add_sprint_backlog_change_goal_audit
--   4. 20260921160000_add_impediment_priority_and_escalation
--   5. 20260921180000_add_daily_scrum_schedule_and_adaptation_evidence
--   6. 20260922120000_add_increment_usability_and_dod_versions
--   7. 20260922140000_add_sprint_review_attendee_links_and_adjustment_traceability
--   8. 20260922160000_add_retrospective_dod_reflections_and_action_item_link
--   9. 20260922180000_add_reports_completion_snapshots_and_goal_verdict
--  10. 20260923120000_add_sm_notes_revisions_barriers_and_coaching
--  11. 20260924120000_add_team_groups_and_shared_dod                          (collapsed)
--      20260924130000_relax_team_group_membership_check                        (collapsed)
--      20260924140000_restrict_group_deletion_and_restore_membership_check     (collapsed)
--  12. 20260924150000_backfill_default_definition_of_ready
--  13. 20260924160000_add_sprint_backlog_change_pending_notification
--  14. 20260924170000_add_default_definition_keys_and_dor_snapshots
--
-- Collapsed history
-- -----------------
-- Exactly two groups of statements are not reproduced in their original shape, because reproducing
-- them would recreate churn that was never a state anyone wanted to keep:
--
--  * The team-group membership invariant was attempted three times (sources 11a, 11b and 11c). The
--    intermediate shapes -- a biconditional paired with `ON DELETE SET NULL`, then a pair of
--    one-directional implications -- contradict each other for reasons explained in full in that
--    section. Only the shape the three migrations converged on (the biconditional with
--    `ON DELETE RESTRICT`) is created, and it is created once.
--  * `dod_version_snapshots.team_id` was created `NOT NULL` and widened to nullable by a later
--    migration. On a database this file creates there is no moment at which the `NOT NULL` shape is
--    observable, so the column is simply created nullable.
--
-- Nothing else is reordered, merged or reworded: every other statement appears in its original
-- chronological position with its original text.
--
-- Data statements are preserved exactly as written, including the best-effort backfills (Product
-- Backlog rank, Increment integration-verification basis, default Definition of Ready seeding, and
-- default criterion keys). On a fresh database they are the same no-ops they were before; on an
-- upgrade they do the same work they did before, in the same order, with the init migration's
-- tables as their input.
--
-- One consequence of running as a single file
-- -------------------------------------------
-- The three `ALTER TYPE "NotificationType" ADD VALUE` statements now execute inside one transaction,
-- where each previously had its own. PostgreSQL 12 and later permit that. None of the added values is
-- used later in this file, which is the condition that would otherwise make it unsafe.
--
-- Prerequisites and environment
-- -----------------------------
-- `gen_random_uuid()` is used by the init migration and by the Definition of Ready backfill. It is
-- built in from PostgreSQL 13, and this project targets PostgreSQL 18, so no extension is required.
--
-- Applying this file to a database that already ran the original migrations
-- ------------------------------------------------------------------------
-- Do not. Prisma records migrations by name, and such a database has no row for this one, so
-- `prisma migrate deploy` would try to run it and every `CREATE` would collide with an object that
-- already exists. Mark it as already applied instead:
--
--   npx prisma migrate resolve --applied 20260926000000_consolidate_incremental_migrations
--
-- Until that is done, `prisma migrate status` also reports the sixteen removed migrations as
-- "applied to the database but missing from the local migrations directory". That is expected, and
-- the command above is what resolves it.
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Source migration: 20260921000000_add_product_backlog_rank
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Source migration: 20260921120000_add_sprint_planning_attendance_and_capacity
-- ---------------------------------------------------------------------------

-- Make Sprint Planning's collaboration and capacity inspectable, persisted facts.
--
-- The 2020 Scrum Guide states the Sprint Backlog is "created by the collaborative work of
-- the entire Scrum Team" (Sprint Planning). Until now planning recorded neither attendance
-- nor the capacity the team agreed on: the capacity collected in the interface was discarded
-- on save, so a Sprint could be started over-committed through the API with no server-side
-- refusal. These two tables make both facts durable:
--
--  * `sprint_planning_attendees` mirrors `review_attendees` / `retro_attendees`, so attendance
--    is recorded identically across the three events that gather the Scrum Team.
--  * `sprint_capacity` stores per-member available hours with a `(sprintId, userId)` unique
--    key, so a draft save is a safe upsert/diff rather than a blind replace that could wipe
--    another member's row.
--
-- Both tables cascade with their Sprint; both writes are bounded by team size (<= 10).

CREATE TABLE "sprint_planning_attendees" (
    "id" UUID NOT NULL,
    "sprintId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "sprint_planning_attendees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sprint_capacity" (
    "id" UUID NOT NULL,
    "sprintId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "memberId" UUID,
    "availableHours" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "sprint_capacity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sprint_planning_attendees_sprintId_idx" ON "sprint_planning_attendees"("sprintId");
CREATE UNIQUE INDEX "sprint_capacity_sprintId_userId_key" ON "sprint_capacity"("sprintId", "userId");
CREATE INDEX "sprint_capacity_sprintId_idx" ON "sprint_capacity"("sprintId");
CREATE INDEX "sprint_capacity_userId_idx" ON "sprint_capacity"("userId");

ALTER TABLE "sprint_planning_attendees" ADD CONSTRAINT "sprint_planning_attendees_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprint_capacity" ADD CONSTRAINT "sprint_capacity_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprint_capacity" ADD CONSTRAINT "sprint_capacity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Capacity can never be negative, mirroring the existing `chk_tasks_hours` guard.
ALTER TABLE "sprint_capacity" ADD CONSTRAINT "chk_sprint_capacity_hours" CHECK ("availableHours" >= 0);

-- ---------------------------------------------------------------------------
-- Source migration: 20260921140000_add_sprint_backlog_change_goal_audit
-- ---------------------------------------------------------------------------

-- Make a mid-Sprint Sprint Backlog change traceable, and make a goal-endangering change subject
-- to the Product Owner's acknowledgement.
--
-- The 2020 Scrum Guide holds that "no changes are made that would endanger the Sprint Goal".
-- Until now a change to an ACTIVE Sprint applied immediately, recorded an optional free-text
-- reason, and stored nothing about the commitment it affected: the Sprint Goal could be
-- endangered -- or silently rewritten through another endpoint -- with no evidence and no
-- Product Owner involvement.
--
-- Four facts become durable. Every statement is additive and either nullable or defaulted, so
-- existing rows stay valid and no table rewrite is required:
--
--  * `sprintGoalAtChange` snapshots the Sprint Goal that was in force when the change was
--    requested, so a later goal edit cannot retroactively rewrite what was inspected.
--  * `goalImpact` records the caller's declaration (`SUPPORTS_GOAL` | `ENDANGERS_GOAL`).
--  * `approvalStatus` separates an applied change from one recorded as `PENDING` because it
--    endangers the goal; the Sprint Backlog is left untouched until the Product Owner
--    acknowledges it.
--  * `acknowledgedBy` / `acknowledgedAt` / `acknowledgementNote` make the Product Owner's
--    approve-or-reject decision accountable and explainable.
--
-- `approvalStatus` / `goalImpact` stay plain TEXT, mirroring the existing `changeType` and
-- `taskAction` columns, with CHECK constraints for integrity.

ALTER TABLE "sprint_backlog_changes" ADD COLUMN "sprintGoalAtChange" TEXT;
ALTER TABLE "sprint_backlog_changes" ADD COLUMN "goalImpact" TEXT;
ALTER TABLE "sprint_backlog_changes" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPLIED';
ALTER TABLE "sprint_backlog_changes" ADD COLUMN "acknowledgedBy" UUID;
ALTER TABLE "sprint_backlog_changes" ADD COLUMN "acknowledgedAt" TIMESTAMPTZ(3);
ALTER TABLE "sprint_backlog_changes" ADD COLUMN "acknowledgementNote" TEXT;

-- Pending changes are read per Sprint (the acknowledgement path and the duplicate-pending
-- guard), so index the pair instead of scanning a Sprint's whole change history.
CREATE INDEX "sprint_backlog_changes_sprintId_approvalStatus_idx" ON "sprint_backlog_changes"("sprintId", "approvalStatus");

-- The Product Owner's decision points at an accountable person, not a bare identifier.
CREATE INDEX "sprint_backlog_changes_acknowledgedBy_idx" ON "sprint_backlog_changes"("acknowledgedBy");
ALTER TABLE "sprint_backlog_changes" ADD CONSTRAINT "sprint_backlog_changes_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A recorded change is applied, awaiting the Product Owner, or rejected outright.
ALTER TABLE "sprint_backlog_changes" ADD CONSTRAINT "chk_sprint_backlog_changes_approval_status" CHECK ("approvalStatus" IN ('APPLIED', 'PENDING', 'REJECTED'));

-- A change either supports the Sprint Goal or endangers it; NULL means it was recorded before
-- the impact declaration existed.
ALTER TABLE "sprint_backlog_changes" ADD CONSTRAINT "chk_sprint_backlog_changes_goal_impact" CHECK ("goalImpact" IS NULL OR "goalImpact" IN ('SUPPORTS_GOAL', 'ENDANGERS_GOAL'));

-- ---------------------------------------------------------------------------
-- Source migration: 20260921160000_add_impediment_priority_and_escalation
-- ---------------------------------------------------------------------------

-- Give an impediment an impact order and make the Scrum Master's escalation a durable fact.
--
-- The 2020 Scrum Guide holds the Scrum Master "accountable for... causing the removal of
-- impediments to the Scrum Team's progress". Until now an impediment carried no priority, no
-- target date and no record of escalation, so the two questions that accountability turns on --
-- which impediment matters most, and who has been asked to remove it -- could not be answered
-- from the data. The Scrum Master dashboard could only observe aging.
--
-- Everything here is additive and either nullable or defaulted, so existing rows stay valid
-- and no table rewrite is required:
--
--  * `priority` orders impediments by impact rather than by age. `ImpedimentPriority` is
--    declared most-critical-first deliberately: PostgreSQL compares enum values by declaration
--    order, so `ORDER BY "priority" ASC` means CRITICAL -> LOW. Reordering the type is a
--    migration, not a code change.
--  * `targetDate` records when the team intends the impediment to be removed.
--  * `escalatedAt` / `escalationCount` record that the Scrum Master was asked to act, so the
--    escalation job can be idempotent instead of notifying on every run.
--
-- `IMPEDIMENT_ESCALATION` is added to `NotificationType` for the same reason: an escalation is
-- something the Scrum Master can see, not merely a log line.

CREATE TYPE "ImpedimentPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

ALTER TABLE "impediments" ADD COLUMN "priority" "ImpedimentPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "impediments" ADD COLUMN "targetDate" DATE;
ALTER TABLE "impediments" ADD COLUMN "escalatedAt" TIMESTAMPTZ(3);
ALTER TABLE "impediments" ADD COLUMN "escalationCount" INTEGER NOT NULL DEFAULT 0;

-- Impact-first reads per team (the Impediments page and the Scrum Master dashboard) and the
-- escalation job's scan of unresolved work both use this index rather than sorting in memory.
CREATE INDEX "impediments_teamId_priority_createdAt_idx" ON "impediments"("teamId", "priority", "createdAt");

-- A negative escalation count is not a meaningful state.
ALTER TABLE "impediments" ADD CONSTRAINT "chk_impediments_escalation_count" CHECK ("escalationCount" >= 0);

ALTER TYPE "NotificationType" ADD VALUE 'IMPEDIMENT_ESCALATION';

-- ---------------------------------------------------------------------------
-- Source migration: 20260921180000_add_daily_scrum_schedule_and_adaptation_evidence
-- ---------------------------------------------------------------------------

-- Give the Daily Scrum's three standing commitments a home: the cadence the team agreed to,
-- the Sprint Goal the event actually inspected, and evidence that the Sprint Backlog moved.
--
-- The 2020 Scrum Guide attaches three facts to the Daily Scrum that the record could not answer
-- before this migration:
--
--  * It is held "at the same time and place every working day". There was no scheduled time, no
--    meeting place and no working-day calendar: weekends were assumed and holidays did not
--    exist, so the Scrum Master dashboard's expected count ("Sprint weeks x 5") misstated
--    reality on any week containing a holiday.
--  * Its purpose is to "inspect progress toward the Sprint Goal". The record did not store the
--    goal it inspected; it read the Sprint's live goal instead, so a later renegotiation
--    retroactively rewrote what a past Daily Scrum appeared to have examined.
--  * Its purpose is to "adapt the Sprint Backlog". Adaptations were free text, linking them to
--    Sprint Backlog items was optional, and nothing verified the backlog actually changed.
--
-- Everything here is additive and either nullable or defaulted, so existing rows stay valid and
-- no data backfill is required. One deliberate integrity change is made, and it is explained at
-- its statement below: a declaration of removal must survive the removal it declares.

-- ---------------------------------------------------------------------------
-- 1. The team's standing Daily Scrum commitment.
-- ---------------------------------------------------------------------------

-- One row per team. The Guide describes a single standing arrangement, so a second row would be
-- an ambiguous answer to "when is the Daily Scrum?".
--
-- No duration is stored. The Daily Scrum is a fixed 15-minute timebox (`timeboxFor` in
-- `@scrumooth/shared`), so only the start of the event is configurable.
CREATE TABLE "daily_scrum_schedules" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    -- IANA time zone the wall-clock `startMinute` is expressed in, e.g. "Europe/Berlin".
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    -- Start of the event as minutes after local midnight (0-1439).
    "startMinute" INTEGER NOT NULL,
    -- The "same place": a room, or a link. Either may be omitted, but not both.
    "location" TEXT,
    "locationUrl" TEXT,
    -- ISO-8601 weekday numbers (1 = Monday .. 7 = Sunday). Defaults to Mon-Fri.
    "workingDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "daily_scrum_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_scrum_schedules_teamId_key" ON "daily_scrum_schedules"("teamId");

ALTER TABLE "daily_scrum_schedules" ADD CONSTRAINT "daily_scrum_schedules_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The start is an offset into a day and nothing else, so an out-of-range value is not a
-- meaningful state. `normalizeCalendar` and `isKnownTimeZone` in `@scrumooth/shared` cover the
-- rest at the API boundary; this is the last line of defence.
ALTER TABLE "daily_scrum_schedules" ADD CONSTRAINT "chk_daily_scrum_schedules_start_minute" CHECK ("startMinute" >= 0 AND "startMinute" < 1440);

-- A scalar list is not covered by a column-width CHECK, so guard its contents here. `cardinality`
-- is used deliberately instead of `array_length`: PostgreSQL returns NULL for `array_length` of
-- an empty array (`{}`), which would let an empty working week slip through.
ALTER TABLE "daily_scrum_schedules" ADD CONSTRAINT "chk_daily_scrum_schedules_working_days" CHECK (
    "workingDays" IS NULL
    OR (cardinality("workingDays") >= 1 AND "workingDays" <@ ARRAY[1, 2, 3, 4, 5, 6, 7])
);

-- ---------------------------------------------------------------------------
-- 2. Dated exceptions to the weekly pattern.
-- ---------------------------------------------------------------------------

-- Only exceptions are stored; the weekly pattern above remains the default. Keeping the two
-- separate means a public holiday is one row rather than a rewrite of the pattern.
CREATE TABLE "team_non_working_days" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "team_non_working_days_pkey" PRIMARY KEY ("id")
);

-- The unique index is the lookup path too: calendar reads are always "for this team, over this
-- date range", so a separate index on ("teamId", "date") would duplicate it.
CREATE UNIQUE INDEX "team_non_working_days_teamId_date_key" ON "team_non_working_days"("teamId", "date");

ALTER TABLE "team_non_working_days" ADD CONSTRAINT "team_non_working_days_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. The Sprint Goal the event inspected.
-- ---------------------------------------------------------------------------

-- Snapshotted from the Sprint when the record is created and never written again, so the
-- inspected baseline is immutable and a later Product Owner renegotiation of the Sprint Goal
-- cannot rewrite what a past Daily Scrum examined.
ALTER TABLE "daily_scrums" ADD COLUMN "sprintGoal" TEXT;

-- Explicit acknowledgement that the event concluded no adaptation was needed. A record must
-- carry either this or at least one `daily_scrum_backlog_items` row, so the Guide's stated
-- purpose for the event is evidenced rather than implied. Enforced in the service layer (the
-- rule is "the record must carry evidence", which spans two tables and cannot be a CHECK).
ALTER TABLE "daily_scrums" ADD COLUMN "noAdaptationNeeded" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 4. Structured, verifiable adaptations.
-- ---------------------------------------------------------------------------

-- Declared before use: PostgreSQL requires the type to exist before a column can reference it.
-- Values are ordered as the actions read in the Guide's own language, and the type is a real
-- enum rather than free text so an unknown action cannot be recorded.
CREATE TYPE "DailyScrumAdjustmentAction" AS ENUM ('ADDED', 'REMOVED', 'REPRIORITIZED', 'REFINED', 'SPLIT');

-- The typed adaptation, alongside the Developers' free-text note (`action`). NULL only on rows
-- recorded before the typed action existed; the API requires it for every new declaration.
ALTER TABLE "daily_scrum_backlog_items" ADD COLUMN "actionType" "DailyScrumAdjustmentAction";

-- Denormalised identity of the affected Product Backlog Item. `action` and `pbiTitleAtAdjustment`
-- keep the declaration readable after the Sprint Backlog item (or the PBI itself) is gone.
ALTER TABLE "daily_scrum_backlog_items" ADD COLUMN "pbiId" UUID;
ALTER TABLE "daily_scrum_backlog_items" ADD COLUMN "pbiTitleAtAdjustment" TEXT;

-- State snapshot taken when the declaration was recorded: the PBI's status and the row versions
-- of the item and its PBI. Comparing these with current state at read time is what lets the
-- store tell "declared" from "actually reflected in the Sprint Backlog", without taking the
-- declaration's word for it and without trusting anything the client sent.
ALTER TABLE "daily_scrum_backlog_items" ADD COLUMN "pbiStatusAtAdjustment" "ItemStatus";
ALTER TABLE "daily_scrum_backlog_items" ADD COLUMN "itemUpdatedAtAtAdjustment" TIMESTAMPTZ(3);
ALTER TABLE "daily_scrum_backlog_items" ADD COLUMN "pbiUpdatedAtAtAdjustment" TIMESTAMPTZ(3);

CREATE INDEX "daily_scrum_backlog_items_pbiId_idx" ON "daily_scrum_backlog_items"("pbiId");

-- DELIBERATE CHANGE: this foreign key previously cascaded.
--
-- Removing a Product Backlog Item from the Sprint Backlog is implemented as a DELETE of the
-- `sprint_backlog_items` row. That is also exactly how a `REMOVED` declaration is fulfilled -- so
-- under `ON DELETE CASCADE` the very act of adapting the Sprint Backlog destroyed the record of
-- having declared the adaptation, and with it any chance of ever confirming the change. Widening
-- the column and relaxing the action to SET NULL keeps the declaration (its `pbiId`,
-- `pbiTitleAtAdjustment` and state snapshot) after the item it describes has gone. A declaration
-- whose item is absent is then how the store recognises a fulfilled removal.
ALTER TABLE "daily_scrum_backlog_items" ALTER COLUMN "sprintBacklogItemId" DROP NOT NULL;
ALTER TABLE "daily_scrum_backlog_items" DROP CONSTRAINT "daily_scrum_backlog_items_sprintBacklogItemId_fkey";
ALTER TABLE "daily_scrum_backlog_items" ADD CONSTRAINT "daily_scrum_backlog_items_sprintBacklogItemId_fkey" FOREIGN KEY ("sprintBacklogItemId") REFERENCES "sprint_backlog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "daily_scrum_backlog_items" ADD CONSTRAINT "daily_scrum_backlog_items_pbiId_fkey" FOREIGN KEY ("pbiId") REFERENCES "product_backlog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A declaration must name something: either the Sprint Backlog item it was raised against, or
-- the Product Backlog Item it concerns. Both NULL would be an unverifiable assertion.
ALTER TABLE "daily_scrum_backlog_items" ADD CONSTRAINT "chk_daily_scrum_backlog_items_target" CHECK ("sprintBacklogItemId" IS NOT NULL OR "pbiId" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Source migration: 20260922120000_add_increment_usability_and_dod_versions
-- ---------------------------------------------------------------------------

-- Close the four Increment gaps a Scrum Guide conformance evaluation recorded, and make the
-- Definition of Done the auditable commitment it claims to be.
--
--  1. "the Increment must be in usable condition". The Increment carried a name, points, a status
--     and a delivery method -- but nothing asserted usability. `deliveryMethod` was a label, not
--     evidence. The Increment now carries an explicit usability attestation: written evidence plus
--     who attested and when, required before the Increment can be verified or delivered.
--  2. The Increment belongs to its Scrum Team. Nothing recorded who delivered an Increment, so
--     "delivered" named no one. `deliveredBy` is added alongside the existing `deliveredAt` and
--     `deliveryMethod`.
--  3. `integrationVerified` meant two different things: a real pass against prior Increments, and
--     the first-Increment exemption where there was nothing to test against. One green badge
--     covered both. The basis and the number of prior Increments it covered are now persisted.
--  4. The Definition of Done -- the Increment's commitment -- was unversioned: updating it deleted
--     every item and recreated them, so the version it replaced left no trace. `dod_version_snapshots`
--     is an append-only record of each superseded version.
--
-- Everything except the new table and enum is additive and either nullable or defaulted, so
-- existing rows stay valid. `integrationVerificationBasis` is backfilled below so existing verified
-- Increments answer the new question honestly instead of reporting an unknown basis.

-- ---------------------------------------------------------------------------
-- 1. What "integration verified" rests on.
-- ---------------------------------------------------------------------------

-- Declared before use: PostgreSQL requires the type to exist before a column can reference it.
-- Two values only, because there are only two honest answers: the team's first Increment had
-- nothing to test against, or the Increment was tested against every prior one.
CREATE TYPE "IntegrationVerificationBasis" AS ENUM ('FIRST_INCREMENT_EXEMPT', 'PRIOR_INCREMENTS');

-- NULL while the Increment is not verified, so a cleared verification cannot leave a stale basis
-- behind claiming it rests on something.
ALTER TABLE "increments" ADD COLUMN "integrationVerificationBasis" "IntegrationVerificationBasis";

-- How many prior Increments the verification actually covered. 0 for the first-Increment
-- exemption, which is exactly the number that makes the exemption visible in the interface.
ALTER TABLE "increments" ADD COLUMN "integrationVerifiedPriorCount" INTEGER NOT NULL DEFAULT 0;

-- BEST-EFFORT BACKFILL: existing verified Increments predate the two-value distinction, so the
-- only recoverable answer is "was this the team's earliest Increment?". The earliest is recorded as
-- exempt, the rest as verified against priors; `integrationVerifiedPriorCount` stays 0 for all of
-- them because the historic test count was never stored and inventing one would be worse than
-- reporting none.
UPDATE "increments" i
SET "integrationVerificationBasis" = CASE
      WHEN EXISTS (
        SELECT 1
        FROM "increments" p
        WHERE p."teamId" = i."teamId"
          AND p."id" <> i."id"
          AND p."createdAt" < i."createdAt"
      ) THEN 'PRIOR_INCREMENTS'::"IntegrationVerificationBasis"
      ELSE 'FIRST_INCREMENT_EXEMPT'::"IntegrationVerificationBasis"
    END
WHERE i."integrationVerified" = true;

-- ---------------------------------------------------------------------------
-- 2. "the Increment must be in usable condition".
-- ---------------------------------------------------------------------------

-- The attestation itself. Defaulted to false and left false on existing rows on purpose: no
-- evidence was captured for them, and backfilling `true` would fabricate the very evidence the
-- gate exists to require. The interface reports those rows as "not recorded".
ALTER TABLE "increments" ADD COLUMN "usabilityVerified" BOOLEAN NOT NULL DEFAULT false;

-- The written evidence. Free text, like the delivery `notes` it sits beside, but required by the
-- service layer whenever `usabilityVerified` is set.
ALTER TABLE "increments" ADD COLUMN "usabilityEvidence" TEXT;

ALTER TABLE "increments" ADD COLUMN "usabilityVerifiedAt" TIMESTAMPTZ(3);
ALTER TABLE "increments" ADD COLUMN "usabilityVerifiedBy" UUID;

CREATE INDEX "increments_usabilityVerifiedBy_idx" ON "increments"("usabilityVerifiedBy");

-- ---------------------------------------------------------------------------
-- 3. Who delivered the Increment.
-- ---------------------------------------------------------------------------

ALTER TABLE "increments" ADD COLUMN "deliveredBy" UUID;

CREATE INDEX "increments_deliveredBy_idx" ON "increments"("deliveredBy");

-- Either account may be deleted without destroying the Increment: the record of *that* someone
-- delivered and attested it survives, only the name resolution is lost.
ALTER TABLE "increments" ADD CONSTRAINT "increments_deliveredBy_fkey" FOREIGN KEY ("deliveredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "increments" ADD CONSTRAINT "increments_usabilityVerifiedBy_fkey" FOREIGN KEY ("usabilityVerifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. The Definition of Done becomes auditable.
-- ---------------------------------------------------------------------------

-- One row per superseded version. `items` is JSONB rather than a child table on purpose: a
-- snapshot must be immutable, and rows that never change cannot drift with the live items they
-- were copied from.
CREATE TABLE "dod_version_snapshots" (
    "id" UUID NOT NULL,
    "dodId" UUID NOT NULL,
    -- Nullable from the start: a snapshot belongs to whichever owner holds the Definition of
    -- Done it was copied from, and the group scope added later makes `team_id` optional. The
    -- XOR that pairs this column with `group_id` is added with the group scope itself.
    -- (Collapsed history: this column was originally NOT NULL and widened by a later migration,
    -- which is not a state any database this file creates ever has.)
    "teamId" UUID,
    "version" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "dod_version_snapshots_pkey" PRIMARY KEY ("id")
);

-- A Definition of Done has exactly one snapshot per version, so a replayed update cannot create a
-- second row claiming the same history.
CREATE UNIQUE INDEX "dod_version_snapshots_dodId_version_key" ON "dod_version_snapshots"("dodId", "version");

CREATE INDEX "dod_version_snapshots_teamId_idx" ON "dod_version_snapshots"("teamId");
CREATE INDEX "dod_version_snapshots_createdBy_idx" ON "dod_version_snapshots"("createdBy");

ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "dod_version_snapshots_dodId_fkey" FOREIGN KEY ("dodId") REFERENCES "definition_of_done"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "dod_version_snapshots_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "dod_version_snapshots_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Source migration: 20260922140000_add_sprint_review_attendee_links_and_adjustment_traceability
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Source migration: 20260922160000_add_retrospective_dod_reflections_and_action_item_link
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Source migration: 20260922180000_add_reports_completion_snapshots_and_goal_verdict
-- ---------------------------------------------------------------------------

-- Close the two Scrum Guide conformance gaps a Reports-module evaluation recorded that need a
-- place to live in the store. (The other two -- the missing team-membership check on the report
-- endpoints, and velocity being policed as a target through the insights engine -- are code-only
-- and need no schema change.)
--
--  1. Historical velocity was retro-fitted to the present. A closed Sprint's "completed points"
--     were read from the live Product Backlog items, so changing an item's status months later
--     silently rewrote what that Sprint had delivered. Velocity is an observation, and an
--     observation that can be rewritten is not one. `sprint_completion_snapshots` freezes what a
--     Sprint committed to and completed at the moment it closed.
--  2. Sprint Goal attainment was inferred. The Scrum Master dashboard derived an
--     achieved / partial / not-achieved rate from the *current* status of the Sprint's backlog
--     items and published it as goal attainment. A Sprint can meet its Goal without completing
--     every item, and complete every item without meeting its Goal, so the figure measured
--     something else under a name that claimed otherwise. `sprint_reviews` now carries the Scrum
--     Team's own recorded verdict, and a Sprint whose Goal was never assessed is reported as
--     unassessed.
--
-- Both additions are nullable or defaulted, so existing rows stay valid. Nothing here is
-- backfilled: a Sprint that closed before the snapshot existed has no recorded observation, and
-- is reported as having none rather than reconstructed into a figure it never had.

-- ---------------------------------------------------------------------------
-- 1. The observed completion of a Sprint, frozen at close.
-- ---------------------------------------------------------------------------

CREATE TABLE "sprint_completion_snapshots" (
    "id" UUID NOT NULL,
    "sprintId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    -- Sum of the story points the Sprint Backlog carried at close.
    "plannedPoints" INTEGER NOT NULL DEFAULT 0,
    -- Sum of the story points whose item was DONE at close, and only those.
    "completedPoints" INTEGER NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "completedItemCount" INTEGER NOT NULL DEFAULT 0,
    -- `{ pbiId, storyPoints, completed }[]` as it stood at close. Kept whole, as JSON, for the
    -- same reason a Definition of Done version snapshot keeps its items as JSON: a snapshot must
    -- never change when the live rows do, and the per-item detail is what makes the aggregate
    -- re-auditable if it is ever doubted. It is never queried by field, so a child table would add
    -- a join to every read for no read benefit.
    "items" JSONB NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedBy" UUID,

    CONSTRAINT "sprint_completion_snapshots_pkey" PRIMARY KEY ("id")
);

-- One snapshot per Sprint. A Sprint closes once, so it has exactly one closing observation; a
-- second row would be an ambiguous answer to "what did this Sprint deliver?".
CREATE UNIQUE INDEX "sprint_completion_snapshots_sprintId_key" ON "sprint_completion_snapshots"("sprintId");
CREATE INDEX "sprint_completion_snapshots_teamId_idx" ON "sprint_completion_snapshots"("teamId");
CREATE INDEX "sprint_completion_snapshots_capturedBy_idx" ON "sprint_completion_snapshots"("capturedBy");
-- Report reads are always "this team's Sprints, newest first", which is the lookup path too.
CREATE INDEX "sprint_completion_snapshots_teamId_capturedAt_idx" ON "sprint_completion_snapshots"("teamId", "capturedAt");

ALTER TABLE "sprint_completion_snapshots" ADD CONSTRAINT "sprint_completion_snapshots_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprint_completion_snapshots" ADD CONSTRAINT "sprint_completion_snapshots_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- The snapshot outlives the person who closed the Sprint: deleting an account must not erase what
-- a Sprint delivered.
ALTER TABLE "sprint_completion_snapshots" ADD CONSTRAINT "sprint_completion_snapshots_capturedBy_fkey" FOREIGN KEY ("capturedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A negative sum is not a state the store can be in: every contributor is non-negative by
-- construction, so a negative total means the snapshot was written wrong.
ALTER TABLE "sprint_completion_snapshots" ADD CONSTRAINT "chk_sprint_completion_snapshots_non_negative" CHECK ("plannedPoints" >= 0 AND "completedPoints" >= 0 AND "itemCount" >= 0 AND "completedItemCount" >= 0);
-- Completed items are a subset of the Sprint Backlog the same snapshot recorded, so this can never
-- be violated by a correct write; it exists to catch one that is not.
ALTER TABLE "sprint_completion_snapshots" ADD CONSTRAINT "chk_sprint_completion_snapshots_completed_subset" CHECK ("completedItemCount" <= "itemCount");
-- The per-item record is what the aggregate is audited against, so it must be a list.
ALTER TABLE "sprint_completion_snapshots" ADD CONSTRAINT "chk_sprint_completion_snapshots_items_array" CHECK (jsonb_typeof("items") = 'array');

-- ---------------------------------------------------------------------------
-- 2. The Scrum Team's recorded verdict on its Sprint Goal.
-- ---------------------------------------------------------------------------

-- Attainment is a judgement the team records at the Sprint Review, not a figure the tool derives.
-- A closed, aggregated value rather than free text: the dashboard counts these, so an unrecognised
-- value must be impossible rather than merely unlikely.
CREATE TYPE "SprintGoalOutcome" AS ENUM ('ACHIEVED', 'PARTIALLY_ACHIEVED', 'NOT_ACHIEVED');

ALTER TABLE "sprint_reviews"
ADD COLUMN "sprintGoal" TEXT,
ADD COLUMN "sprintGoalOutcome" "SprintGoalOutcome",
ADD COLUMN "sprintGoalNote" TEXT;

-- A verdict must name the Goal it judged. An outcome with no Goal would be a judgement about
-- nothing, and the Review's own copy of the Goal text is what keeps the verdict re-readable after
-- a later renegotiation of the Sprint Goal. NULL outcome is the honest state for a Sprint whose
-- Goal was never assessed, and is reported as unassessed rather than as unmet.
ALTER TABLE "sprint_reviews" ADD CONSTRAINT "chk_sprint_reviews_goal_outcome_requires_goal" CHECK ("sprintGoalOutcome" IS NULL OR "sprintGoal" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Source migration: 20260923120000_add_sm_notes_revisions_barriers_and_coaching
-- ---------------------------------------------------------------------------

-- Close the four Major gaps a Scrum Guide conformance evaluation recorded for the Scrum Master
-- dashboard (module 3.12). The 2020 Scrum Guide holds the Scrum Master accountable for the Scrum
-- Team's effectiveness, for *causing the removal of impediments*, for *serving the organization
-- ... removing barriers between stakeholders and Scrum Teams*, and for coaching the team in
-- self-management and cross-functionality. Until now the tool could observe all four and act on
-- none of them:
--
--  1. Scrum Master notes were a shared, mutable column with no history, so a coaching observation
--     could be overwritten without a trace. `sm_notes_revisions` is an append-only trail of every
--     version of the notes on a Sprint, a Sprint Review and a Sprint Retrospective.
--  2. Impediments could age or be "escalated" into a notification, but nothing recorded a barrier
--     that lies outside the team's authority. `organizational_barriers` is that register, and
--     `barrier_stakeholder_actions` records the conversations and decisions with the people
--     outside the team who have to act. The unique index on `sourceImpedimentId` makes escalating
--     the same impediment twice impossible at the database level rather than by convention.
--  3. The Scrum Master's coaching work left no trace. `coaching_entries` records it (readable only
--     by the team's Scrum Master), `working_agreements` records the agreements the team makes with
--     itself, and `cross_functionality_assessments` / `cross_functionality_skills` record the
--     team-level judgement of whether it collectively holds the skills it needs.
--
-- Everything here is additive: new tables, new types, and one new enum value. No existing column is
-- altered, so no backfill is required and existing rows stay valid.

-- ---------------------------------------------------------------------------
-- 1. New types.
-- ---------------------------------------------------------------------------

CREATE TYPE "SmNotesEntityType" AS ENUM ('SPRINT', 'SPRINT_REVIEW', 'SPRINT_RETROSPECTIVE');
CREATE TYPE "BarrierStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "StakeholderActionStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');
CREATE TYPE "CoachingTopic" AS ENUM ('SELF_MANAGEMENT', 'CROSS_FUNCTIONALITY', 'OTHER');
CREATE TYPE "WorkingAgreementStatus" AS ENUM ('ACTIVE', 'RETIRED');
CREATE TYPE "SkillCoverage" AS ENUM ('NONE', 'PARTIAL', 'COVERED');

-- A barrier raised by the Scrum Master is something the owner can see, not merely a log line.
ALTER TYPE "NotificationType" ADD VALUE 'ORGANIZATIONAL_BARRIER';

-- ---------------------------------------------------------------------------
-- 2. The Scrum Master's notes gain a revision history.
-- ---------------------------------------------------------------------------

-- The notes column on each event keeps the current text; this table keeps every version of it.
-- `revision` is dense and per entity, so the history of an event reads as 1..N without gaps, and
-- `(entityType, entityId, revision)` is the pair that makes a revision number unique inside its
-- event -- which is also the index the history read walks.
CREATE TABLE "sm_notes_revisions" (
    "id" UUID NOT NULL,
    "entityType" "SmNotesEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sm_notes_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sm_notes_revisions_entityType_entityId_revision_key" ON "sm_notes_revisions"("entityType", "entityId", "revision");
CREATE INDEX "sm_notes_revisions_createdBy_idx" ON "sm_notes_revisions"("createdBy");
CREATE INDEX "sm_notes_revisions_teamId_idx" ON "sm_notes_revisions"("teamId");

-- A revision number starts at 1; zero or a negative revision is not a version of anything.
ALTER TABLE "sm_notes_revisions" ADD CONSTRAINT "chk_sm_notes_revisions_revision" CHECK ("revision" >= 1);

-- The trail outlives neither the team nor its author: the author row is restricted (an audit trail
-- must not lose the name of who wrote an observation), and the team cascades like every other
-- team-owned record.
ALTER TABLE "sm_notes_revisions" ADD CONSTRAINT "sm_notes_revisions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sm_notes_revisions" ADD CONSTRAINT "sm_notes_revisions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. The organizational barrier register.
-- ---------------------------------------------------------------------------

-- Impact ordering deliberately reuses `ImpedimentPriority`: a barrier and an impediment are ranked
-- on the same scale, so the same enum keeps `ORDER BY "priority" ASC` meaning CRITICAL -> LOW in
-- both registers instead of two orderings that can drift apart.
CREATE TABLE "organizational_barriers" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "sourceImpedimentId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "ImpedimentPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BarrierStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" UUID,
    "raisedById" UUID NOT NULL,
    "targetDate" DATE,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "organizational_barriers_pkey" PRIMARY KEY ("id")
);

-- One barrier per impediment: escalating the same impediment twice is refused by the database, so
-- two people pressing the button at the same time cannot produce two registers of the same barrier.
CREATE UNIQUE INDEX "organizational_barriers_sourceImpedimentId_key" ON "organizational_barriers"("sourceImpedimentId");
CREATE INDEX "organizational_barriers_teamId_idx" ON "organizational_barriers"("teamId");
CREATE INDEX "organizational_barriers_status_idx" ON "organizational_barriers"("status");
CREATE INDEX "organizational_barriers_ownerId_idx" ON "organizational_barriers"("ownerId");
CREATE INDEX "organizational_barriers_raisedById_idx" ON "organizational_barriers"("raisedById");
CREATE INDEX "organizational_barriers_priority_idx" ON "organizational_barriers"("priority");
CREATE INDEX "organizational_barriers_teamId_status_createdAt_idx" ON "organizational_barriers"("teamId", "status", "createdAt");
CREATE INDEX "organizational_barriers_teamId_priority_createdAt_idx" ON "organizational_barriers"("teamId", "priority", "createdAt");

-- A barrier survives the deletion of the impediment it was escalated from (the barrier is now the
-- organization's problem, not the team's record), and it survives its owner leaving the team: the
-- register must not lose the barrier because the person changed role.
ALTER TABLE "organizational_barriers" ADD CONSTRAINT "organizational_barriers_sourceImpedimentId_fkey" FOREIGN KEY ("sourceImpedimentId") REFERENCES "impediments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organizational_barriers" ADD CONSTRAINT "organizational_barriers_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organizational_barriers" ADD CONSTRAINT "organizational_barriers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organizational_barriers" ADD CONSTRAINT "organizational_barriers_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Actions taken with stakeholders to remove a barrier.
-- ---------------------------------------------------------------------------

CREATE TABLE "barrier_stakeholder_actions" (
    "id" UUID NOT NULL,
    "barrierId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "ownerId" UUID,
    "dueDate" DATE,
    "status" "StakeholderActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "barrier_stakeholder_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "barrier_stakeholder_actions_barrierId_idx" ON "barrier_stakeholder_actions"("barrierId");
CREATE INDEX "barrier_stakeholder_actions_ownerId_idx" ON "barrier_stakeholder_actions"("ownerId");
CREATE INDEX "barrier_stakeholder_actions_barrierId_status_idx" ON "barrier_stakeholder_actions"("barrierId", "status");

-- An action exists only inside its barrier, so it cascades with it.
ALTER TABLE "barrier_stakeholder_actions" ADD CONSTRAINT "barrier_stakeholder_actions_barrierId_fkey" FOREIGN KEY ("barrierId") REFERENCES "organizational_barriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "barrier_stakeholder_actions" ADD CONSTRAINT "barrier_stakeholder_actions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. The Scrum Master's coaching log.
-- ---------------------------------------------------------------------------

CREATE TABLE "coaching_entries" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "topic" "CoachingTopic" NOT NULL,
    "note" TEXT NOT NULL,
    "sprintId" UUID,
    "followUpDate" DATE,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "coaching_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coaching_entries_teamId_idx" ON "coaching_entries"("teamId");
CREATE INDEX "coaching_entries_sprintId_idx" ON "coaching_entries"("sprintId");
CREATE INDEX "coaching_entries_authorId_idx" ON "coaching_entries"("authorId");
CREATE INDEX "coaching_entries_teamId_createdAt_idx" ON "coaching_entries"("teamId", "createdAt");

ALTER TABLE "coaching_entries" ADD CONSTRAINT "coaching_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coaching_entries" ADD CONSTRAINT "coaching_entries_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coaching_entries" ADD CONSTRAINT "coaching_entries_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. The team's working agreements.
-- ---------------------------------------------------------------------------

-- Agreements are retired, never deleted: a working agreement that silently disappears hides the
-- fact that the team changed its mind, which is itself something the team should be able to see.
CREATE TABLE "working_agreements" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkingAgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "agreedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "working_agreements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "working_agreements_teamId_idx" ON "working_agreements"("teamId");
CREATE INDEX "working_agreements_status_idx" ON "working_agreements"("status");
CREATE INDEX "working_agreements_teamId_status_idx" ON "working_agreements"("teamId", "status");

ALTER TABLE "working_agreements" ADD CONSTRAINT "working_agreements_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. The team-level cross-functionality assessment.
-- ---------------------------------------------------------------------------

-- A snapshot with one row per needed skill: the assessment is a judgement made at a moment, so it
-- is never mutated into a different judgement -- a new assessment is recorded instead, which is
-- what makes "the signal" inspectable over time.
CREATE TABLE "cross_functionality_assessments" (
    "id" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "assessedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "cross_functionality_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cross_functionality_assessments_teamId_idx" ON "cross_functionality_assessments"("teamId");
CREATE INDEX "cross_functionality_assessments_teamId_assessedAt_idx" ON "cross_functionality_assessments"("teamId", "assessedAt");

ALTER TABLE "cross_functionality_assessments" ADD CONSTRAINT "cross_functionality_assessments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cross_functionality_skills" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "coverage" "SkillCoverage" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cross_functionality_skills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cross_functionality_skills_assessmentId_idx" ON "cross_functionality_skills"("assessmentId");

-- A skill row exists only inside its assessment.
ALTER TABLE "cross_functionality_skills" ADD CONSTRAINT "cross_functionality_skills_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "cross_functionality_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Source migrations: 20260924120000_add_team_groups_and_shared_dod
--                    20260924130000_relax_team_group_membership_check   (collapsed)
--                    20260924140000_restrict_group_deletion_and_restore_membership_check   (collapsed)
-- ---------------------------------------------------------------------------

-- Close the last of the four Major gaps a Scrum Guide conformance evaluation recorded for the Team
-- module (module 3.13), and give the Definition of Done the multi-team rule the Guide states:
--
--   *"If there are multiple Scrum Teams working together on a product, they must mutually define
--   and comply with the same Definition of Done."*
--
-- Scrumooth modelled a team and a team-owned Definition of Done, so two teams on one product could
-- hold two different DoDs and nothing could express the rule. A `team_groups` row is one product
-- collaboration: the group owns the *only* Definition of Done its teams read, and joining it
-- records which version of that DoD the team adopted.
--
-- The Definition of Done therefore becomes scope-polymorphic -- `teamId` XOR `groupId` -- held by a
-- CHECK constraint rather than by convention, so no write path anywhere (service, script, or SQL
-- console) can leave a DoD owned by nobody or by two owners at once. A group is a product
-- collaboration and not a team decomposition: nothing inside a Scrum Team changes, so the Guide's
-- *"no sub-teams or hierarchies"* is not infringed.
--
-- Everything is additive or a nullability widening: `team_id` keeps every existing value, existing
-- DoD rows and snapshots satisfy the new CHECK as written (team scope set, group scope null), so no
-- backfill is required and no history is touched.
--
-- Deliberately NOT here: a unique index or constraint enforcing "one Product Owner and one Scrum
-- Master per team". That guarantee was implemented with a serializable transaction instead (see
-- `utils/serializableTransaction.ts`), so this migration adds no index for it.
--
-- COLLAPSED HISTORY: the membership invariant below took three migrations to get right, and only
-- the answer they converged on is recorded here. The first attempt asserted the biconditional "the
-- three membership columns travel together" *and* declared `teams.groupId` `ON DELETE SET NULL`.
-- Those two choices contradict each other: the foreign-key action nulls `groupId` *alone*, so a
-- constraint relating the join date or the adopted version to `groupId` fails the moment a group is
-- deleted -- a group with teams pointing at it became undeletable, and the failure surfaced as a
-- CHECK violation from a foreign-key action rather than from anything the application did. The
-- second attempt relaxed the constraints to one-directional implications, which does not help for
-- exactly the same reason.
--
-- The contradiction is between detaching on delete and constraining the columns, so one of the two
-- has to go, and detaching is the one that is wrong for this rule: *"they must mutually define and
-- comply with the same Definition of Done"* means a team whose group vanished would be left
-- complying with a Definition of Done nobody owns. The API already refuses to remove a group that
-- still has teams (`GATE_TEAM_GROUP_NOT_EMPTY`); this makes the database refuse it too, which is
-- what the module promises everywhere else -- a rule the tool can hold structurally is held
-- structurally.
--
-- So: deletion is restricted, and the invariant is the whole biconditional. The two intermediate
-- constraint shapes never existed on a database this file created.

-- ---------------------------------------------------------------------------
-- 1. The group: a set of Scrum Teams working together on one product.
-- ---------------------------------------------------------------------------

CREATE TABLE "team_groups" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "team_groups_pkey" PRIMARY KEY ("id")
);

-- A group is named once: two groups with the same name would let a person join a different
-- collaboration than the one they think they joined.
CREATE UNIQUE INDEX "team_groups_name_key" ON "team_groups"("name");
CREATE INDEX "team_groups_createdBy_idx" ON "team_groups"("createdBy");

-- Deleting the creator leaves the group standing: the collaboration outlives the account that
-- opened it.
ALTER TABLE "team_groups" ADD CONSTRAINT "team_groups_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Team membership of a group, and the version the team adopted.
-- ---------------------------------------------------------------------------

ALTER TABLE "teams" ADD COLUMN "groupId" UUID;
ALTER TABLE "teams" ADD COLUMN "groupJoinedAt" TIMESTAMPTZ(3);

-- The version of the group's Definition of Done the team explicitly adopted when it joined. It is
-- the record of the mutual agreement the Guide requires; a later change to the shared DoD leaves
-- this number behind, which is what makes the drift visible to the team that has not re-adopted.
ALTER TABLE "teams" ADD COLUMN "groupDodVersionAtJoin" INTEGER;

CREATE INDEX "teams_groupId_idx" ON "teams"("groupId");

-- The version marker is a version number: only a real version of a real DoD can be adopted.
ALTER TABLE "teams" ADD CONSTRAINT "chk_teams_group_dod_version_at_join" CHECK ("groupDodVersionAtJoin" IS NULL OR "groupDodVersionAtJoin" >= 1);

-- The three columns are written together or not at all. Both directions hold: a join date with no
-- group would be a membership nothing can resolve, and a group with no join date would be a
-- membership nothing recorded. Column order is fixed by `definition_of_done.version`, not by the
-- write path, so the three travel together.
ALTER TABLE "teams" ADD CONSTRAINT "chk_teams_group_membership_complete" CHECK (("groupId" IS NULL) = ("groupJoinedAt" IS NULL) AND ("groupId" IS NULL) = ("groupDodVersionAtJoin" IS NULL));

-- A group's Definition of Done is the commitment of its teams, so the group cannot be removed out
-- from under them: deletion is RESTRICTED rather than detaching the team. Teams must leave (or
-- move) first, which the application also enforces with a documented gate code. Detaching would
-- leave a team complying with a Definition of Done nobody owns, and it is also what made the
-- membership constraint above impossible to satisfy.
ALTER TABLE "teams" ADD CONSTRAINT "teams_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "team_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. The Definition of Done gains a second possible owner: the group.
-- ---------------------------------------------------------------------------

-- Widening only: every existing row keeps its team, and a NULL `team_id` is a row a group owns.
ALTER TABLE "definition_of_done" ALTER COLUMN "teamId" DROP NOT NULL;
ALTER TABLE "definition_of_done" ADD COLUMN "groupId" UUID;

-- One Definition of Done per group, exactly as there is one per team. This is the constraint that
-- makes *"the same Definition of Done"* true by construction: a group cannot end up with two.
CREATE UNIQUE INDEX "definition_of_done_groupId_key" ON "definition_of_done"("groupId");

-- Exactly one owner: a DoD with no owner would be unreachable and would leave its team(s) with no
-- commitment; a DoD with two owners would be two Definitions of Done wearing one row.
ALTER TABLE "definition_of_done" ADD CONSTRAINT "chk_definition_of_done_scope" CHECK (("teamId" IS NULL) <> ("groupId" IS NULL));

-- A group's Definition of Done exists only for its group, so it goes when the group goes.
ALTER TABLE "definition_of_done" ADD CONSTRAINT "definition_of_done_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "team_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Version history mirrors the scope of the Definition of Done it belongs to.
-- ---------------------------------------------------------------------------

-- Snapshots are the audit trail of a commitment, so they must stay attached to the owner that made
-- the commitment. The columns mirror `definition_of_done` exactly, which is what keeps a version's
-- history correct when a team joins or leaves a group (the group's history stays with the group).
-- `dod_version_snapshots.team_id` was already created nullable above, so only the group column has
-- to be added here.
ALTER TABLE "dod_version_snapshots" ADD COLUMN "groupId" UUID;

CREATE INDEX "dod_version_snapshots_groupId_idx" ON "dod_version_snapshots"("groupId");

-- The same XOR as the live rows, so no snapshot can exist outside the two scopes.
ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "chk_dod_version_snapshots_scope" CHECK (("teamId" IS NULL) <> ("groupId" IS NULL));

ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "dod_version_snapshots_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "team_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Source migration: 20260924150000_backfill_default_definition_of_ready
-- ---------------------------------------------------------------------------

-- Backfill the default Definition of Ready for teams that have none.
--
-- Module 3.15 of the Scrum Guide conformance evaluation recorded that the Definition of Ready sat
-- beside the Definition of Done with unequal enforcement: the DoD was backend-gated, the readiness
-- agreement was not enforced at all. The remediation makes the readiness agreement a real rule --
-- committing a Sprint Backlog or opening a Sprint is refused while a selected item still has an
-- unverified active readiness criterion -- and refuses a Sprint boundary when the team has no
-- active criterion at all, so that an emptied checklist cannot make the rule pass vacuously.
--
-- The default criteria were already created lazily on read (`dor.controller.ts`), which means a team
-- that had never opened Team Definitions has no `definition_of_ready` row. Without this backfill
-- those teams would meet the new gate with nothing to satisfy it and no explanation of what to do,
-- which would be a hostile change rather than an enforced one. Seeding the same six defaults the
-- lazy path seeds gives every existing installation the same starting point a new team gets.
--
-- Idempotent by construction: the LEFT JOIN restricts the insert to teams with no readiness
-- agreement, so re-running the statement (or running it on a database where every team already has
-- one) inserts nothing. It touches no existing row and no verification: a team that has customised
-- its readiness agreement is left exactly as it is.

WITH missing AS (
    SELECT t."id" AS "teamId", gen_random_uuid() AS "dorId"
    FROM "teams" t
    LEFT JOIN "definition_of_ready" d ON d."teamId" = t."id"
    WHERE d."id" IS NULL
),
created AS (
    INSERT INTO "definition_of_ready" ("id", "teamId", "version", "createdAt", "updatedAt")
    SELECT m."dorId", m."teamId", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    FROM missing m
    RETURNING "id", "teamId"
)
INSERT INTO "dor_items" ("id", "dorId", "description", "category", "isActive", "order", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    c."id",
    v."description",
    v."category",
    true,
    v."order",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM created c
CROSS JOIN (
    VALUES
        ('Clear title and description provided', 'acceptance', 0),
        ('Acceptance criteria defined and agreed', 'acceptance', 1),
        ('Story points estimated by the team', 'estimation', 2),
        ('Business value assigned', 'estimation', 3),
        ('Dependencies identified and documented', 'dependencies', 4),
        ('No blockers or impediments', 'dependencies', 5)
) AS v ("description", "category", "order");

-- ---------------------------------------------------------------------------
-- Source migration: 20260924160000_add_sprint_backlog_change_pending_notification
-- ---------------------------------------------------------------------------

-- A Sprint Backlog change declared as endangering the Sprint Goal is recorded as PENDING and
-- needs the Product Owner's acknowledgement. The Product Owner is notified so the gate is
-- something they are told about, rather than something they have to go looking for.
ALTER TYPE "NotificationType" ADD VALUE 'SPRINT_BACKLOG_CHANGE_PENDING';

-- ---------------------------------------------------------------------------
-- Source migration: 20260924170000_add_default_definition_keys_and_dor_snapshots
-- ---------------------------------------------------------------------------

-- Give a seeded criterion a stable identity, and give the Definition of Ready a real history.
--
--  1. A built-in criterion was translated by matching its English sentence: the interface held a map
--     from "Code is properly documented" to a translation key, so polishing that sentence -- or
--     re-seeding the list -- silently dropped the translation in all five languages, with nothing
--     to notice it by. `defaultKey` names which built-in criterion a row descends from, so the
--     wording and the identity can move independently. It is nullable because a criterion a team
--     wrote itself has no built-in ancestor.
--  2. The Definition of Ready kept a version counter but no superseded versions, so a version badge
--     on it could only ever show the version in force while the Definition of Done's could show its
--     history. The readiness agreement is enforced at the Sprint boundary, and an enforced
--     agreement whose earlier versions vanish is one a team cannot inspect. `dor_version_snapshots`
--     is the same append-only record the Definition of Done has kept since Increment usability.
--
-- Additive and backfill-safe: both columns are nullable, the backfill only fills rows that still
-- carry a seeded sentence verbatim, and the new table touches no existing row. Safe to deploy
-- before the application code that reads it.

-- ---------------------------------------------------------------------------
-- 1. Which built-in criterion a row descends from.
-- ---------------------------------------------------------------------------

ALTER TABLE "dod_items" ADD COLUMN "defaultKey" TEXT;
ALTER TABLE "dor_items" ADD COLUMN "defaultKey" TEXT;

-- BEST-EFFORT BACKFILL: an existing row is matched to its built-in ancestor only when its
-- description still equals the seeded sentence exactly. A criterion the team reworded is left
-- NULL on purpose -- there is no way to tell "this started as `documentation`" from "this is the
-- team's own criterion that happens to read similarly", and guessing would attach a translation
-- to wording the team did not choose. The interface falls back to the same sentence match at read
-- time, so those rows render exactly as they do today.
--
-- The keys and sentences below MUST stay in step with `DOD_DEFAULTS` / `DOR_DEFAULTS` in
-- `packages/shared/src/constants/definitionDefaults.ts`. A migration is immutable once applied, so
-- a later change to the seed list is a new migration, not an edit to this one.
UPDATE "dod_items"
SET "defaultKey" = v."key"
FROM (
    VALUES
        ('Code is peer-reviewed and approved', 'codeReviewed'),
        ('Unit tests written and passing (minimum 80% coverage)', 'unitTests'),
        ('Integration tests passing', 'integrationTests'),
        ('Code is properly documented', 'documentation'),
        ('No critical or high-severity bugs', 'noCriticalBugs')
) AS v ("description", "key")
WHERE "dod_items"."description" = v."description"
  AND "dod_items"."defaultKey" IS NULL;

UPDATE "dor_items"
SET "defaultKey" = v."key"
FROM (
    VALUES
        ('Clear title and description provided', 'clearTitle'),
        ('Acceptance criteria defined and agreed', 'acceptanceCriteria'),
        ('Story points estimated by the team', 'storyPointsEstimated'),
        ('Business value assigned', 'businessValue'),
        ('Dependencies identified and documented', 'dependencies'),
        ('No blockers or impediments', 'noBlockers')
) AS v ("description", "key")
WHERE "dor_items"."description" = v."description"
  AND "dor_items"."defaultKey" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. The Definition of Ready becomes inspectable.
-- ---------------------------------------------------------------------------

-- One row per superseded version. `items` is JSONB for the same reason as the Definition of Done's
-- snapshots: a snapshot must be immutable, and rows that never change cannot drift with the live
-- items they were copied from.
CREATE TABLE "dor_version_snapshots" (
    "id" UUID NOT NULL,
    "dorId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "dor_version_snapshots_pkey" PRIMARY KEY ("id")
);

-- A readiness agreement has exactly one snapshot per version, so a replayed update cannot create a
-- second row claiming the same history.
CREATE UNIQUE INDEX "dor_version_snapshots_dorId_version_key" ON "dor_version_snapshots"("dorId", "version");

CREATE INDEX "dor_version_snapshots_teamId_idx" ON "dor_version_snapshots"("teamId");
CREATE INDEX "dor_version_snapshots_createdBy_idx" ON "dor_version_snapshots"("createdBy");

ALTER TABLE "dor_version_snapshots" ADD CONSTRAINT "dor_version_snapshots_dorId_fkey" FOREIGN KEY ("dorId") REFERENCES "definition_of_ready"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dor_version_snapshots" ADD CONSTRAINT "dor_version_snapshots_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dor_version_snapshots" ADD CONSTRAINT "dor_version_snapshots_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
