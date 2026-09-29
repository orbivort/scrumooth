import { http, type RequestHandler } from 'msw';
import { DOD_DEFAULTS, GATE_CODES } from '@scrumooth/shared';
import type { SharedDefinitionOfDone, SharedDoDItem, TeamGroupSummary } from '@scrumooth/shared';

import { accepted, created, gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, isMemberOf, roleOf, teamOf } from '../store';

/**
 * Team groups and the Definition of Done they own.
 *
 * The Guide: *"If there are multiple Scrum Teams working together on a product,
 * they must mutually define and comply with the same Definition of Done."* The
 * group is that rule made structural — it owns one agreement, each team records
 * the version it adopted, and joining is a decision its leadership takes and
 * names a version for, because "mutually define" is an act rather than an
 * assumption.
 *
 * The directory is readable by anyone signed in (a team has to see what it could
 * join) and the shared agreement is readable before joining, deliberately: a team
 * cannot agree to a commitment it is not allowed to read.
 */

/** The commitments a brand-new group starts from: the product's built-in criteria. */
function defaultSharedItems(): SharedDoDItem[] {
  return DOD_DEFAULTS.map((item, index) => ({
    id: crypto.randomUUID(),
    description: item.description,
    category: item.category ?? null,
    isActive: true,
    order: index,
    defaultKey: item.key,
  }));
}

function groupOf(groupId: string) {
  return database().teamGroups.find((group) => group.id === groupId);
}

/** Whether the acting person may decide for a team: its Product Owner or Scrum Master. */
function leads(teamId: string, userId: string): boolean {
  const role = roleOf(userId, teamId);
  return role === 'PRODUCT_OWNER' || role === 'SCRUM_MASTER';
}

/** Whether the acting person works in any team of the group. */
function inGroup(groupId: string, userId: string): boolean {
  const group = groupOf(groupId);
  return Boolean(group?.teams.some((team) => team.id && isMemberOf(userId, team.id)));
}

export const teamGroupHandlers: RequestHandler[] = [
  // --- Joining and leaving --------------------------------------------------

  http.post(apiUrl('/teams/:teamId/group'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    const team = teamOf(teamId);
    if (!team) {
      return problems.notFound('Team');
    }
    if (!leads(teamId, user.id)) {
      return gate(
        GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
        'Only the team’s Product Owner or Scrum Master can join a group for it'
      );
    }
    if (database().teamGroups.some((group) => group.teams.some((member) => member.id === teamId))) {
      return gate(GATE_CODES.TEAM_GROUP_ALREADY_MEMBER, 'This team is already in a group');
    }

    const body = await bodyOf<{ groupId: string; acknowledgedDodVersion?: number }>(request);
    const group = groupOf(body.groupId ?? '');
    if (!group) {
      return problems.notFound('Team group');
    }
    // Naming the version is what makes compliance verifiable: a join that
    // recorded nothing would let a later change pass as agreed to.
    if (body.acknowledgedDodVersion !== group.definitionOfDone.version) {
      return gate(
        GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED,
        `Adopting this group’s Definition of Done requires acknowledging version ${group.definitionOfDone.version}`
      );
    }

    const now = new Date().toISOString();
    group.teams.push({
      id: teamId,
      name: team.name,
      joinedAt: now,
      adoptedDodVersion: group.definitionOfDone.version,
    });
    group.teamCount = group.teams.length;

    const summary: TeamGroupSummary = {
      id: group.id,
      name: group.name,
      description: group.description,
      teamCount: group.teamCount,
      dodVersion: group.dodVersion,
    };
    return created(summary);
  }),

  http.delete(apiUrl('/teams/:teamId/group'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!leads(teamId, user.id)) {
      return gate(
        GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
        'Only the team’s Product Owner or Scrum Master can leave a group for it'
      );
    }

    const group = database().teamGroups.find((candidate) =>
      candidate.teams.some((member) => member.id === teamId)
    );
    if (!group) {
      return problems.notFound('Team group membership');
    }

    // Leaving keeps the Definition of Done the team has been complying with: the
    // group's criteria are copied onto the team's own agreement so the team's
    // commitment does not change as a side effect of the move.
    const own = database().definitionsOfDone.find((definition) => definition.teamId === teamId);
    if (own) {
      own.items = group.definitionOfDone.items.map((item, index) => ({
        id: crypto.randomUUID(),
        description: item.description,
        category: item.category ?? undefined,
        isActive: item.isActive,
        order: index,
        defaultKey: item.defaultKey,
      }));
      own.version += 1;
      own.updatedBy = user.id;
      own.updatedAt = new Date().toISOString();
    }

    group.teams = group.teams.filter((member) => member.id !== teamId);
    group.teamCount = group.teams.length;

    return ok({ message: 'The team left the group and kept its Definition of Done' });
  }),

  // --- Shared Definition of Done --------------------------------------------

  http.get(apiUrl('/team-groups/:groupId/shared-definition-of-done'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const group = groupOf(String(params.groupId ?? ''));
    if (!group) {
      return problems.notFound('Team group');
    }
    // Readable before joining on purpose: a team cannot mutually define a
    // commitment it is not allowed to read.
    return ok(group.definitionOfDone);
  }),

  http.put(
    apiUrl('/team-groups/:groupId/shared-definition-of-done'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const group = groupOf(String(params.groupId ?? ''));
      if (!group) {
        return problems.notFound('Team group');
      }
      // The agreement is the commitment of every team in the group, so the change
      // is leadership's to make -- the same rule as joining.
      const leadingTeams = group.teams.filter((team) => team.id && leads(team.id, user.id));
      if (leadingTeams.length === 0) {
        return gate(
          GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
          'Only a Product Owner or Scrum Master of a team in the group can change the shared Definition of Done'
        );
      }

      const body = await bodyOf<{
        items: Array<{
          id?: string;
          description: string;
          category?: string;
          isActive: boolean;
          order: number;
        }>;
      }>(request);

      const existing = new Map(group.definitionOfDone.items.map((item) => [item.id, item]));
      const items: SharedDoDItem[] = (body.items ?? []).map((write, index) => {
        const current = write.id ? existing.get(write.id) : undefined;
        return {
          id: current?.id ?? crypto.randomUUID(),
          description: write.description.trim(),
          category: write.category ?? current?.category ?? null,
          isActive: write.isActive,
          order: index,
          defaultKey: current?.defaultKey ?? null,
        };
      });

      if (items.filter((item) => item.isActive).length === 0) {
        return gate(
          GATE_CODES.DOD_REQUIRED,
          'A shared Definition of Done needs at least one active criterion'
        );
      }

      const updated: SharedDefinitionOfDone = {
        groupId: group.id,
        version: group.definitionOfDone.version + 1,
        items,
        updatedAt: new Date().toISOString(),
      };

      // The group's current version and the numbered agreement move together: the
      // directory would otherwise advertise a version the agreement is not on.
      group.definitionOfDone = updated;
      group.dodVersion = updated.version;

      return accepted(updated);
    }
  ),

  // --- The directory --------------------------------------------------------

  http.get(apiUrl('/team-groups'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const summaries: TeamGroupSummary[] = database().teamGroups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      teamCount: group.teamCount,
      dodVersion: group.dodVersion,
    }));
    return ok(summaries);
  }),

  http.post(apiUrl('/team-groups'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ name: string; description?: string | null }>(request);
    const name = (body.name ?? '').trim();
    if (name === '') {
      return problems.validation('A group needs a name', 'name');
    }

    const items = defaultSharedItems();
    const group = {
      id: crypto.randomUUID(),
      name,
      description: body.description ?? null,
      teamCount: 0,
      dodVersion: 1,
      teams: [],
      definitionOfDone: {
        groupId: '',
        version: 1,
        items,
        updatedAt: new Date().toISOString(),
      },
    };
    group.definitionOfDone.groupId = group.id;

    database().teamGroups.push(group);
    return created(group);
  }),

  http.get(apiUrl('/team-groups/:groupId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const group = groupOf(String(params.groupId ?? ''));
    if (!group) {
      return problems.notFound('Team group');
    }
    if (!inGroup(group.id, user.id)) {
      return gate(
        GATE_CODES.TEAM_GROUP_MEMBERS_ONLY,
        'Only a team in the group can read what it is'
      );
    }

    return ok(group);
  }),

  http.put(apiUrl('/team-groups/:groupId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const group = groupOf(String(params.groupId ?? ''));
    if (!group) {
      return problems.notFound('Team group');
    }
    if (!group.teams.some((team) => team.id && leads(team.id, user.id))) {
      return gate(
        GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
        'Only a Product Owner or Scrum Master of a team in the group can change it'
      );
    }

    const body = await bodyOf<{ name?: string; description?: string | null }>(request);
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (name === '') {
        return problems.validation('A group needs a name', 'name');
      }
      group.name = name;
    }
    if (body.description !== undefined) {
      group.description = body.description;
    }

    return accepted(group);
  }),

  http.delete(apiUrl('/team-groups/:groupId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const group = groupOf(String(params.groupId ?? ''));
    if (!group) {
      return problems.notFound('Team group');
    }
    if (!group.teams.some((team) => team.id && leads(team.id, user.id))) {
      return gate(
        GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
        'Only a Product Owner or Scrum Master of a team in the group can dissolve it'
      );
    }
    // Removing the group would take away the Definition of Done its teams are
    // complying with rather than moving them to another one.
    if (group.teams.length > 0) {
      return gate(
        GATE_CODES.TEAM_GROUP_NOT_EMPTY,
        'A group that still has teams cannot be dissolved'
      );
    }

    const db = database();
    db.teamGroups = db.teamGroups.filter((candidate) => candidate.id !== group.id);
    return ok({ message: 'Group dissolved' });
  }),
];
