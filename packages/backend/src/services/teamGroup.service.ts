// The team group: the Scrum Teams working together on one product, and the one Definition of Done
// they all comply with.
//
// The 2020 Scrum Guide: *"If there are multiple Scrum Teams working together on a product, they
// must mutually define and comply with the same Definition of Done."* Scrumooth modelled a team
// and a team-owned Definition of Done, so two teams on one product could hold two DoDs and nothing
// could express the rule. Here the rule is structural:
//
//  * The group owns the only Definition of Done row its teams read (`dodScope.ts` resolves it), so
//    the teams cannot diverge by construction rather than by agreement.
//  * Joining records *which version* the team adopted (`Team.groupDodVersionAtJoin`), so "mutually
//    define and comply" is an act the database remembers. A later change to the shared DoD leaves
//    that number behind, which is what makes the drift visible.
//  * A grouped team cannot edit its own Definition of Done (`GATE_DOD_GROUP_GOVERNED`): a team that
//    could would not be complying with the same one, and the change would be invisible to the teams
//    that share it.
//
// A group is a product-collaboration device, not a team decomposition: nothing inside a Scrum Team
// changes, so *"no sub-teams or hierarchies"* is not infringed.
import prisma from '../utils/prisma';
import { ConflictError, NotFoundError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { GATE_CODES } from '@scrumooth/shared';
import type { SharedDefinitionOfDone, TeamGroupDetail, TeamGroupSummary } from '@scrumooth/shared';
import { UserRole } from '../generated/prisma/client';
import { logger } from '../utils/logger';
import {
  AuditActions,
  AuditEventTypes,
  AuditResults,
  auditResourceEvent,
} from '../utils/auditLogger';
import { assertTeamMembership, type TeamRoleRefusal } from './teamRoleAccess';
import { definitionOfDoneService, type DoDItemInput } from './dod.service';

/** Reading a group's roster asks for membership of one of the teams in it. */
const GROUP_MEMBERSHIP_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:teamGroup.membersOnly',
  gateCode: GATE_CODES.TEAM_GROUP_MEMBERS_ONLY,
};

/**
 * Changing a group -- and deciding a team's membership of one -- belongs to the leadership of the
 * team(s) involved: the Definition of Done a team is held to is not set by whoever happens to ask.
 */
const GROUP_LEADERSHIP_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:teamGroup.leadershipOnly',
  gateCode: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
};

/** The roles that may act for a team. The Guide gives the Product Owner and the Scrum Master these. */
const LEADERSHIP_ROLES: readonly UserRole[] = [UserRole.PRODUCT_OWNER, UserRole.SCRUM_MASTER];

/** The columns a group summary is built from, so every read resolves it the same way. */
const GROUP_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  definitionOfDone: { select: { version: true } },
  _count: { select: { teams: true } },
} as const;

type GroupSummaryRow = {
  id: string;
  name: string;
  description: string | null;
  definitionOfDone: { version: number } | null;
  _count: { teams: number };
};

type GroupMemberRow = {
  id: string;
  name: string;
  groupJoinedAt: Date | null;
  groupDodVersionAtJoin: number | null;
  members: Array<{ userId: string; role: UserRole }>;
};

/** A group as every access decision and every detail read needs it. */
type LoadedGroup = GroupSummaryRow & { createdBy: string | null; teams: GroupMemberRow[] };

interface CreateGroupInput {
  name: string;
  description?: string | null;
}

interface UpdateGroupInput {
  name?: string;
  description?: string | null;
}

interface JoinGroupInput {
  groupId: string;
  acknowledgedDodVersion?: number;
}

class TeamGroupService {
  /** Serialize a row into the summary every group surface starts from. */
  private formatSummary(row: GroupSummaryRow): TeamGroupSummary {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      teamCount: row._count.teams,
      dodVersion: row.definitionOfDone?.version ?? 0,
    };
  }

  /**
   * The group directory.
   *
   * Open to any authenticated caller by necessity, not by indifference: a team cannot join a
   * collaboration it cannot find, and it cannot adopt a Definition of Done it is not allowed to
   * read. What is listed is deliberately thin -- the group's name, what it is for, how many teams
   * are in it, and which shared Definition of Done version is in force -- and the roster itself is
   * still the group's own business (`GATE_TEAM_GROUP_MEMBERS_ONLY`).
   */
  async listGroups(): Promise<TeamGroupSummary[]> {
    const groups = await prisma.teamGroup.findMany({
      select: GROUP_SUMMARY_SELECT,
      orderBy: { name: 'asc' },
    });

    return groups.map((group) => this.formatSummary(group));
  }

  /**
   * One group, with its teams and the shared Definition of Done they comply with.
   *
   * @throws AppError (403, `GATE_TEAM_GROUP_MEMBERS_ONLY`) when the caller belongs to none of the
   * group's teams.
   */
  async getGroup(groupId: string, actorUserId: string | undefined): Promise<TeamGroupDetail> {
    const group = await this.loadGroupTeams(groupId);

    this.assertMayRead(group, actorUserId);

    return this.formatDetail(group, await this.readSharedDefinitionOfDone(groupId));
  }

  /**
   * The shared Definition of Done a group owns, as the join preview and the group's editor read it.
   *
   * Readable without being a member, because this is the commitment a team would be adopting: the
   * Guide's rule is that the teams *mutually define* it, and a definition nobody may read before
   * agreeing to it is not a mutual one.
   *
   * @throws AppError (404) when the group does not exist.
   */
  async getSharedDefinitionOfDone(groupId: string): Promise<SharedDefinitionOfDone> {
    const group = await prisma.teamGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!group) {
      throw new NotFoundError('Team group');
    }

    return this.readSharedDefinitionOfDone(groupId);
  }

  /**
   * Create a group, together with the shared Definition of Done it will own.
   *
   * Any authenticated caller may create one, exactly as any authenticated caller may create a team
   * today: what makes a group real is the teams that adopt its Definition of Done, and each of them
   * does that by its own leadership's decision. The group is created *with* a Definition of Done so
   * that "adopt the shared Definition of Done" is never a promise about nothing.
   */
  async createGroup(userId: string, data: CreateGroupInput): Promise<TeamGroupDetail> {
    const name = data.name.trim();

    const existing = await prisma.teamGroup.findUnique({ where: { name }, select: { id: true } });
    if (existing) {
      throw new ConflictError('A team group with this name already exists');
    }

    const groupId = generateUUIDv7();

    try {
      await prisma.teamGroup.create({
        data: {
          id: groupId,
          name,
          description: data.description ?? null,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    } catch (error) {
      // The unique index is what actually holds the rule; the check above only gives the ordinary
      // race a nicer answer than a database error.
      if (this.isUniqueViolation(error)) {
        throw new ConflictError('A team group with this name already exists');
      }
      throw error;
    }

    await definitionOfDoneService.createDefaultSharedDefinitionOfDone(groupId, userId);

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.CREATE,
      AuditResults.SUCCESS,
      { type: 'TEAM_GROUP', id: groupId, name },
      { createdBy: userId }
    );

    return this.readGroupDetail(groupId);
  }

  /**
   * Rename or describe a group.
   *
   * @throws AppError (403, `GATE_TEAM_GROUP_LEADERSHIP_ONLY`) unless the caller is the Product Owner
   * or Scrum Master of one of the group's teams.
   */
  async updateGroup(
    groupId: string,
    userId: string,
    data: UpdateGroupInput
  ): Promise<TeamGroupDetail> {
    await this.assertGroupLeadership(groupId, userId);

    if (data.name !== undefined) {
      const name = data.name.trim();

      const existing = await prisma.teamGroup.findUnique({ where: { name }, select: { id: true } });
      if (existing && existing.id !== groupId) {
        throw new ConflictError('A team group with this name already exists');
      }
    }

    await prisma.teamGroup.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updatedBy: userId,
      },
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'TEAM_GROUP', id: groupId },
      { updatedBy: userId }
    );

    return this.getGroup(groupId, userId);
  }

  /**
   * Remove a group.
   *
   * @throws AppError (409, `GATE_TEAM_GROUP_NOT_EMPTY`) while teams still comply with its Definition
   * of Done: removing it would take the commitment away from them rather than move them to another.
   */
  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.loadGroupTeams(groupId);
    this.assertMayLead(group, userId);

    if (group.teams.length > 0) {
      throw localizedError('errors:teamGroup.notEmpty', {}, 409, GATE_CODES.TEAM_GROUP_NOT_EMPTY);
    }

    try {
      await prisma.teamGroup.delete({ where: { id: groupId } });
    } catch (error) {
      // A team joined between the read above and this delete, and `teams.groupId` is
      // `ON DELETE RESTRICT`, so the database refused it. That is the not-empty rule holding under
      // concurrency rather than a failure: the caller gets the same refusal a team that was already
      // there would have produced.
      if (this.isForeignKeyViolation(error)) {
        throw localizedError('errors:teamGroup.notEmpty', {}, 409, GATE_CODES.TEAM_GROUP_NOT_EMPTY);
      }
      throw error;
    }

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.DELETE,
      AuditResults.SUCCESS,
      { type: 'TEAM_GROUP', id: groupId, name: group.name },
      { deletedBy: userId }
    );
  }

  /**
   * Replace the Definition of Done every team in the group complies with.
   *
   * This is the write the Guide's *"mutually define"* points at: one change, made where every team
   * that shares the commitment can see it, instead of each team editing its own copy. It belongs to
   * the Product Owner or Scrum Master of any member team, because the commitment is jointly owned.
   *
   * @throws AppError (403, `GATE_TEAM_GROUP_LEADERSHIP_ONLY`) for anyone else.
   * @throws AppError (400, `GATE_DOD_REQUIRED`) when the new version would hold no active item.
   */
  async updateSharedDefinitionOfDone(
    groupId: string,
    userId: string,
    items: DoDItemInput[]
  ): Promise<SharedDefinitionOfDone> {
    await this.assertGroupLeadership(groupId, userId);

    const updated = await definitionOfDoneService.updateSharedDefinitionOfDone(
      groupId,
      items,
      userId
    );

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'TEAM_GROUP_DEFINITION_OF_DONE', id: groupId },
      { version: updated.version, itemCount: items.length, updatedBy: userId }
    );

    return this.readSharedDefinitionOfDone(groupId);
  }

  /**
   * A team adopts a group's shared Definition of Done.
   *
   * The adoption is explicit: the caller names the version it is adopting, and a version that is
   * not the one in force is refused. Otherwise a team could be recorded as complying with a
   * Definition of Done it never saw -- and "mutually define" would be a claim rather than an act.
   *
   * @throws AppError (403, `GATE_TEAM_GROUP_LEADERSHIP_ONLY`) unless the caller is the team's
   * Product Owner or Scrum Master.
   * @throws AppError (409, `GATE_TEAM_GROUP_ALREADY_MEMBER`) when the team is already in a group.
   * @throws AppError (400, `GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED`) when the named version is
   * missing or is not the version in force.
   */
  async joinGroup(
    teamId: string,
    userId: string,
    input: JoinGroupInput
  ): Promise<TeamGroupSummary> {
    await this.assertTeamLeadership(teamId, userId);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, groupId: true },
    });

    if (!team) {
      throw new NotFoundError('Team');
    }

    if (team.groupId) {
      throw localizedError(
        'errors:teamGroup.alreadyMember',
        {},
        409,
        GATE_CODES.TEAM_GROUP_ALREADY_MEMBER
      );
    }

    const group = await prisma.teamGroup.findUnique({
      where: { id: input.groupId },
      select: GROUP_SUMMARY_SELECT,
    });

    if (!group) {
      throw new NotFoundError('Team group');
    }

    // A group always has a Definition of Done from creation; recreating it here keeps a join from
    // adopting a version that does not exist, which would make `groupDodVersionAtJoin` a fiction.
    const dodVersion =
      group.definitionOfDone?.version ??
      (await definitionOfDoneService.createDefaultSharedDefinitionOfDone(input.groupId, userId))
        .version;

    if (input.acknowledgedDodVersion !== dodVersion) {
      throw localizedError(
        'errors:teamGroup.dodAcknowledgementRequired',
        { version: dodVersion },
        400,
        GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED
      );
    }

    try {
      await prisma.team.update({
        where: { id: teamId },
        data: {
          groupId: input.groupId,
          groupJoinedAt: new Date(),
          groupDodVersionAtJoin: dodVersion,
          updatedBy: userId,
        },
      });
    } catch (error) {
      // The group was removed between the read above and this write. Reporting "not found" is the
      // honest answer, and the foreign key is what noticed rather than a stale read.
      if (this.isForeignKeyViolation(error)) {
        throw new NotFoundError('Team group');
      }
      throw error;
    }

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'TEAM_GROUP_MEMBERSHIP', id: teamId },
      { groupId: group.id, groupName: group.name, adoptedDodVersion: dodVersion, joinedBy: userId }
    );

    return this.formatSummary({
      ...group,
      _count: { teams: group._count.teams + 1 },
    });
  }

  /**
   * A team leaves its group, taking the shared Definition of Done with it.
   *
   * The team's own row is rewritten with the items it has been complying with, so leaving never
   * drops a team to a stale or empty commitment: it keeps the one it has been held to, and can then
   * change it like any other team. The membership is cleared only after that write succeeds, so a
   * failure leaves the team exactly as it was.
   *
   * @throws AppError (403, `GATE_TEAM_GROUP_LEADERSHIP_ONLY`) unless the caller is the team's
   * Product Owner or Scrum Master.
   * @throws AppError (409) when the team does not belong to a group.
   */
  async leaveGroup(teamId: string, userId: string): Promise<void> {
    await this.assertTeamLeadership(teamId, userId);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, groupId: true },
    });

    if (!team) {
      throw new NotFoundError('Team');
    }

    if (!team.groupId) {
      throw new ConflictError('This team does not work in a group, so there is nothing to leave');
    }

    const shared = await this.readSharedDefinitionOfDone(team.groupId);

    await definitionOfDoneService.adoptDefinitionOfDoneAsOwn(
      teamId,
      shared.items.map((item) => ({
        description: item.description,
        category: item.category ?? undefined,
        isActive: item.isActive,
        order: item.order,
      })),
      userId
    );

    await prisma.team.update({
      where: { id: teamId },
      data: {
        groupId: null,
        groupJoinedAt: null,
        groupDodVersionAtJoin: null,
        updatedBy: userId,
      },
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'TEAM_GROUP_MEMBERSHIP', id: teamId },
      { leftGroupId: team.groupId, adoptedDodVersion: shared.version, leftBy: userId }
    );
  }

  // -------------------------------------------------------------------------
  // Reads and assertions
  // -------------------------------------------------------------------------

  /** The group's shared Definition of Done, serialized for the API. */
  private async readSharedDefinitionOfDone(groupId: string): Promise<SharedDefinitionOfDone> {
    const dod = await prisma.definitionOfDone.findUnique({
      where: { groupId },
      select: {
        version: true,
        updatedAt: true,
        items: {
          select: { id: true, description: true, category: true, isActive: true, order: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!dod) {
      // Only reachable if the group was created outside this service; the join path repairs it.
      logger.warn('Team group is missing its shared Definition of Done', { groupId });

      return { groupId, version: 0, items: [], updatedAt: new Date(0).toISOString() };
    }

    return {
      groupId,
      version: dod.version,
      updatedAt: dod.updatedAt.toISOString(),
      items: dod.items,
    };
  }

  /** Serialize a loaded group, its teams and its shared Definition of Done. */
  private formatDetail(group: LoadedGroup, shared: SharedDefinitionOfDone): TeamGroupDetail {
    return {
      ...this.formatSummary(group),
      teams: group.teams.map((team) => ({
        id: team.id,
        name: team.name,
        joinedAt: team.groupJoinedAt ? team.groupJoinedAt.toISOString() : null,
        adoptedDodVersion: team.groupDodVersionAtJoin,
      })),
      definitionOfDone: shared,
    };
  }

  /** Read a group in full, without asserting anything about the caller. */
  private async readGroupDetail(groupId: string): Promise<TeamGroupDetail> {
    return this.formatDetail(
      await this.loadGroupTeams(groupId),
      await this.readSharedDefinitionOfDone(groupId)
    );
  }

  /**
   * Load the group's teams and their memberships, or refuse when the group does not exist.
   *
   * Every group operation needs this shape: the roster decides who may read the group, the
   * memberships decide who leads it, and `createdBy` decides who may act on a group no team has
   * joined yet -- so all three are resolved from one read rather than three.
   */
  private async loadGroupTeams(groupId: string): Promise<LoadedGroup> {
    const group = await prisma.teamGroup.findUnique({
      where: { id: groupId },
      select: {
        ...GROUP_SUMMARY_SELECT,
        createdBy: true,
        teams: {
          select: {
            id: true,
            name: true,
            groupJoinedAt: true,
            groupDodVersionAtJoin: true,
            members: { select: { userId: true, role: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundError('Team group');
    }

    return group;
  }

  /** The membership the caller holds in one of the group's teams, if any. */
  private membershipOf(group: LoadedGroup, userId: string | undefined) {
    return userId
      ? group.teams.flatMap((team) => team.members).find((member) => member.userId === userId)
      : undefined;
  }

  /**
   * Assert the caller may read the group.
   *
   * Membership of one of its teams, or having created it: a group is invisible to everyone else,
   * and its creator retains sight of what they opened even before a team joins.
   */
  private assertMayRead(group: LoadedGroup, userId: string | undefined): void {
    if (userId && group.createdBy === userId) {
      return;
    }

    if (!this.membershipOf(group, userId)) {
      throw localizedError(
        GROUP_MEMBERSHIP_REFUSAL.messageKey,
        {},
        403,
        GROUP_MEMBERSHIP_REFUSAL.gateCode
      );
    }
  }

  /**
   * Assert the caller may change the group or its shared Definition of Done.
   *
   * The leadership of one of its teams, or -- while no team has joined -- the account that created
   * it: before there are teams there is no team leadership to consult, and after there are, the
   * creator's say-so would be a say-so over other teams' Definition of Done.
   */
  private assertMayLead(group: LoadedGroup, userId: string | undefined): void {
    const membership = this.membershipOf(group, userId);

    if (membership && LEADERSHIP_ROLES.includes(membership.role)) {
      return;
    }

    if (group.teams.length === 0 && userId && group.createdBy === userId) {
      return;
    }

    throw localizedError(
      GROUP_LEADERSHIP_REFUSAL.messageKey,
      {},
      403,
      GROUP_LEADERSHIP_REFUSAL.gateCode
    );
  }

  /**
   * Assert the caller may change the group, returning the group it loaded.
   *
   * Returning it keeps every caller from loading the same roster twice: the assertion and the work
   * that follows need the same rows.
   */
  private async assertGroupLeadership(groupId: string, userId: string): Promise<LoadedGroup> {
    const group = await this.loadGroupTeams(groupId);
    this.assertMayLead(group, userId);

    return group;
  }

  /** Assert the caller is the Product Owner or Scrum Master of this team. */
  private async assertTeamLeadership(teamId: string, userId: string): Promise<void> {
    const role = await assertTeamMembership(teamId, userId, GROUP_LEADERSHIP_REFUSAL);

    if (!LEADERSHIP_ROLES.includes(role)) {
      throw localizedError(
        GROUP_LEADERSHIP_REFUSAL.messageKey,
        {},
        403,
        GROUP_LEADERSHIP_REFUSAL.gateCode
      );
    }
  }

  /** Whether a thrown Prisma error is the unique-constraint violation the schema declares. */
  private isUniqueViolation(error: unknown): boolean {
    return this.prismaErrorCode(error) === 'P2002';
  }

  /** Whether a thrown Prisma error is a foreign-key violation. */
  private isForeignKeyViolation(error: unknown): boolean {
    return this.prismaErrorCode(error) === 'P2003';
  }

  private prismaErrorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;
  }
}

export const teamGroupService = new TeamGroupService();
