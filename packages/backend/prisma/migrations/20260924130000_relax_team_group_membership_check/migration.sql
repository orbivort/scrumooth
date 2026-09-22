-- Correct the team-group membership invariant introduced by
-- `20260924120000_add_team_groups_and_shared_dod`.
--
-- That migration asserted the biconditional `(groupId IS NULL) = (groupJoinedAt IS NULL)` (and the
-- same for the adopted version). It reads well and it is wrong, because the database itself is
-- allowed to null one of the three columns without the others: `teams.groupId` is declared
-- `ON DELETE SET NULL`, so deleting a group sets `groupId` to NULL and leaves the join date and the
-- adopted version behind. Under the biconditional that update -- a legitimate one, performed by
-- PostgreSQL on a foreign-key action -- fails with a CHECK violation, and a group that has teams
-- pointing at it becomes undeletable at the database level.
--
-- The useful half of the invariant is the implication, and only in one direction: a recorded join
-- or a recorded adoption *requires* that the team belongs to a group. The converse is not needed,
-- because a team the database has just detached is exactly the case being allowed, and every read
-- resolves "is this team grouped?" from `groupId` alone (`dodScope.ts`) -- a lingering join date
-- with no `groupId` is inert, never read as membership.
--
-- Nothing is dropped beyond the two over-strict constraints; no data changes, and no row that
-- satisfied the old constraints fails the new ones (the old constraints were strictly stronger).
ALTER TABLE "teams" DROP CONSTRAINT "chk_teams_group_membership_complete";

-- A team that records when it joined records that it joined.
ALTER TABLE "teams" ADD CONSTRAINT "chk_teams_group_joined_at_requires_group" CHECK ("groupJoinedAt" IS NULL OR "groupId" IS NOT NULL);

-- A team that records the version it adopted records that it adopted one.
ALTER TABLE "teams" ADD CONSTRAINT "chk_teams_group_dod_version_requires_group" CHECK ("groupDodVersionAtJoin" IS NULL OR "groupId" IS NOT NULL);
