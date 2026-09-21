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
