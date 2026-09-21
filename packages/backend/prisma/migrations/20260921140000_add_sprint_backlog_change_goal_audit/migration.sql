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
