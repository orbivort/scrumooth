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
