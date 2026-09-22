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
