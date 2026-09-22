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
