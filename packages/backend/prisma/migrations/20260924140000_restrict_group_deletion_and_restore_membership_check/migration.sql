-- Finish the team-group membership invariant.
--
-- The two migrations before this one show the mistake in order, and this one lands on the answer:
--
--  * `20260924120000` asserted the biconditional "the three membership columns travel together" and
--    declared `teams.groupId` `ON DELETE SET NULL`.
--  * Those two choices contradict each other. The foreign-key action nulls `groupId` *alone*, so any
--    constraint relating the join date or the adopted version to `groupId` fails the moment a group
--    is deleted: a group with teams pointing at it became undeletable, and the failure surfaced as a
--    CHECK violation from a foreign-key action rather than from anything the application did.
--  * `20260924130000` relaxed the two constraints to one-directional implications, which does not
--    help: `("groupDodVersionAtJoin" IS NULL OR "groupId" IS NOT NULL)` is violated in exactly the
--    same case, because the version is not nulled with the group.
--
-- The contradiction is between detaching on delete and constraining the columns, so one of the two
-- has to go, and detaching is the one that is wrong for this rule: *"they must mutually define and
-- comply with the same Definition of Done"* means a team whose group vanished would be left
-- complying with a Definition of Done nobody owns. The API already refuses to remove a group that
-- still has teams (`GATE_TEAM_GROUP_NOT_EMPTY`); this makes the database refuse it too, which is
-- what the module promises everywhere else -- a rule the tool can hold structurally is held
-- structurally.
--
-- So: deletion is restricted, and the invariant can be the whole biconditional again.
ALTER TABLE "teams" DROP CONSTRAINT "chk_teams_group_joined_at_requires_group";
ALTER TABLE "teams" DROP CONSTRAINT "chk_teams_group_dod_version_requires_group";

-- The three columns are written together or not at all. Both directions now hold: a join date with
-- no group would be a membership nothing can resolve, and a group with no join date would be a
-- membership nothing recorded.
ALTER TABLE "teams" ADD CONSTRAINT "chk_teams_group_membership_complete" CHECK (("groupId" IS NULL) = ("groupJoinedAt" IS NULL) AND ("groupId" IS NULL) = ("groupDodVersionAtJoin" IS NULL));

-- A group's Definition of Done is the commitment of its teams, so the group cannot be removed out
-- from under them. Teams must leave (or move) first, which the application also enforces with a
-- documented gate code.
ALTER TABLE "teams" DROP CONSTRAINT "teams_groupId_fkey";
ALTER TABLE "teams" ADD CONSTRAINT "teams_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "team_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
