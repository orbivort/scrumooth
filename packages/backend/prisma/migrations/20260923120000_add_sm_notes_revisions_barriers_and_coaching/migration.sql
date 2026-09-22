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
