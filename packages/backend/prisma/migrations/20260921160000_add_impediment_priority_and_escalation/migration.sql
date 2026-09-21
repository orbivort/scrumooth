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
