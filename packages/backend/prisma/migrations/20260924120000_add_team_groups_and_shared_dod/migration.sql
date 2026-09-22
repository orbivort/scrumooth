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

-- Membership is recorded whole or not at all: a team that left a group records no join date and no
-- adopted version, so a stale version can never be read as the team's current agreement. Column
-- order is fixed by `definition_of_done.version`, not by the write path, so the three travel together.
ALTER TABLE "teams" ADD CONSTRAINT "chk_teams_group_membership_complete" CHECK (("groupId" IS NULL) = ("groupJoinedAt" IS NULL) AND ("groupId" IS NULL) = ("groupDodVersionAtJoin" IS NULL));

-- Leaving a group must not delete the team, and must not silently detach it from a group that has
-- been removed: the team reverts to owning its own Definition of Done.
ALTER TABLE "teams" ADD CONSTRAINT "teams_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "team_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "dod_version_snapshots" ALTER COLUMN "teamId" DROP NOT NULL;
ALTER TABLE "dod_version_snapshots" ADD COLUMN "groupId" UUID;

CREATE INDEX "dod_version_snapshots_groupId_idx" ON "dod_version_snapshots"("groupId");

-- The same XOR as the live rows, so no snapshot can exist outside the two scopes.
ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "chk_dod_version_snapshots_scope" CHECK (("teamId" IS NULL) <> ("groupId" IS NULL));

ALTER TABLE "dod_version_snapshots" ADD CONSTRAINT "dod_version_snapshots_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "team_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
