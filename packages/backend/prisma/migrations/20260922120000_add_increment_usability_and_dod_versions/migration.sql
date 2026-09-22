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
    "teamId" UUID NOT NULL,
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
