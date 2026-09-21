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
