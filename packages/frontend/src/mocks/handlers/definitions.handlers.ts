import { http, type RequestHandler } from 'msw';
import { GATE_CODES } from '@scrumooth/shared';
import type { DoDVersionSnapshot, DoRVersionSnapshot } from '@scrumooth/shared';

import {
  type DefinitionOfDone,
  type DefinitionOfReady,
  type DoDChecklistVerification,
  type DoDComplianceReport,
  type DoDItem,
  type DoRChecklistVerification,
  type DoRItem,
  type PBIComplianceDetail,
  type ProductBacklogItem,
} from '../../types';
import { accepted, gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, displayNameOf, isMemberOf, roleOf, teamOf } from '../store';

/**
 * The two standing agreements: the Definition of Done, which is a Guide artifact,
 * and the Definition of Ready, which is the team's own quality bar at the Sprint
 * boundary.
 *
 * A team that works with other Scrum Teams on one product complies with the
 * group's single Definition of Done, so a read of the team's own definition is
 * answered with the group's, and a team-scoped write is refused with
 * `GATE_DOD_GROUP_GOVERNED` — the interface routes that write to the group
 * instead of offering a control whose only answer would be no.
 *
 * Every version change appends a snapshot of the version it replaced, so the
 * commitment a past Sprint was held to is still readable.
 */

type AnyDefinition = DefinitionOfDone | DefinitionOfReady;
type AnyItem = DoDItem | DoRItem;

/** The criteria a write payload asks for, with an id when it edits an existing one. */
interface ItemWrite {
  id?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
  order?: number;
  defaultKey?: string | null;
}

/** The group whose Definition of Done governs a team, if the team is in one. */
function groupOfTeam(teamId: string): { id: string; version: number; updatedAt: string } | null {
  const group = database().teamGroups.find((candidate) =>
    candidate.teams.some((team) => team.id === teamId && team.adoptedDodVersion !== null)
  );
  if (!group) {
    return null;
  }
  return {
    id: group.id,
    version: group.definitionOfDone.version,
    updatedAt: group.definitionOfDone.updatedAt,
  };
}

/** The Definition of Done a team is actually held to: its group's, when it has one. */
function effectiveDod(teamId: string): DefinitionOfDone | undefined {
  const group = groupOfTeam(teamId);
  if (group) {
    const shared = database().teamGroups.find((candidate) => candidate.id === group.id);
    if (shared) {
      return {
        id: shared.id,
        teamId,
        items: shared.definitionOfDone.items.map((item) => ({
          id: item.id,
          description: item.description,
          category: item.category ?? undefined,
          isActive: item.isActive,
          order: item.order,
          defaultKey: item.defaultKey,
        })),
        version: shared.definitionOfDone.version,
        updatedBy: undefined,
        updatedAt: shared.definitionOfDone.updatedAt,
      };
    }
  }
  return database().definitionsOfDone.find((definition) => definition.teamId === teamId);
}

function readyOf(teamId: string): DefinitionOfReady | undefined {
  return database().definitionsOfReady.find((definition) => definition.teamId === teamId);
}

function pbiOf(pbiId: string): ProductBacklogItem | undefined {
  return database().backlogItems.find((item) => item.id === pbiId);
}

/**
 * Applies a criteria payload to a definition in place.
 *
 * An entry naming an existing criterion updates that row, so the verifications
 * recorded against it survive the edit; an entry without an id inserts a new one.
 * The final order follows the position in the list.
 */
function applyItems<T extends AnyItem>(existing: T[], writes: readonly ItemWrite[]): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]));

  return writes.map((write, index) => {
    const current = write.id ? byId.get(write.id) : undefined;
    const base: AnyItem = current ?? {
      id: crypto.randomUUID(),
      description: '',
      isActive: true,
      order: index,
      defaultKey: null,
    };

    return {
      id: base.id,
      description: (write.description ?? base.description).trim(),
      category: write.category ?? base.category,
      isActive: write.isActive ?? base.isActive,
      order: index,
      defaultKey: write.defaultKey ?? base.defaultKey,
    } as T;
  });
}

/** A version snapshot of the definition a change is about to replace. */
function snapshotOf(definition: AnyDefinition, ownerId: string): DoDVersionSnapshot {
  return {
    id: crypto.randomUUID(),
    teamId: ownerId,
    version: definition.version,
    items: definition.items.map((item) => ({
      description: item.description,
      category: item.category ?? null,
      isActive: item.isActive,
      order: item.order,
      defaultKey: item.defaultKey ?? null,
    })),
    createdAt: definition.updatedAt,
    createdBy: definition.updatedBy ?? null,
    createdByName: displayNameOf(definition.updatedBy),
    isCurrent: false,
  };
}

function versionHistoryOf(
  definition: AnyDefinition,
  ownerId: string
): (DoDVersionSnapshot | DoRVersionSnapshot)[] {
  const superseded = database()
    .dodVersionSnapshots.filter((snapshot) => snapshot.teamId === ownerId)
    .sort((left, right) => right.version - left.version);

  const current: DoDVersionSnapshot = {
    id: `current:${ownerId}`,
    teamId: ownerId,
    version: definition.version,
    items: definition.items.map((item) => ({
      description: item.description,
      category: item.category ?? null,
      isActive: item.isActive,
      order: item.order,
      defaultKey: item.defaultKey ?? null,
    })),
    createdAt: definition.updatedAt,
    createdBy: definition.updatedBy ?? null,
    createdByName: displayNameOf(definition.updatedBy),
    isCurrent: true,
  };

  return [current, ...superseded];
}

/**
 * The Definition of Done compliance of one Sprint.
 *
 * "Done" means every active criterion of the team's Definition of Done is
 * verified for the item, so the report counts exactly that — no more, and no
 * inferred passes.
 */
function complianceOf(sprintId: string): DoDComplianceReport | undefined {
  const sprint = database().sprints.find((candidate) => candidate.id === sprintId);
  if (!sprint) {
    return undefined;
  }

  const definition = effectiveDod(sprint.teamId);
  const activeItems = (definition?.items ?? []).filter((item) => item.isActive);
  const items = database()
    .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
    .map((entry) => pbiOf(entry.pbiId))
    .filter((item): item is ProductBacklogItem => Boolean(item));

  const details: PBIComplianceDetail[] = items.map((item) => {
    const verifications = database().dodVerifications.filter(
      (verification) => verification.pbiId === item.id && verification.isVerified
    );
    const verifiedItemIds = new Set(verifications.map((verification) => verification.dodItemId));
    const met = activeItems.filter((criterion) => verifiedItemIds.has(criterion.id)).length;
    const percentage = activeItems.length === 0 ? 0 : Math.round((met / activeItems.length) * 100);

    return {
      pbiId: item.id,
      pbiTitle: item.title,
      status: item.status,
      dodItemsTotal: activeItems.length,
      dodItemsVerified: met,
      compliancePercentage: percentage,
      verifications,
    };
  });

  const compliant = details.filter((detail) => detail.compliancePercentage === 100).length;
  const pending = details.filter((detail) => detail.dodItemsVerified < detail.dodItemsTotal).length;

  return {
    sprintId,
    totalPBIs: details.length,
    dodCompliantPBIs: compliant,
    pendingVerification: pending,
    failedCompliance: 0,
    complianceRate: details.length === 0 ? 0 : Math.round((compliant / details.length) * 100),
    pbiDetails: details,
  };
}

export const definitionHandlers: RequestHandler[] = [
  // --- Definition of Done ---------------------------------------------------

  http.get(apiUrl('/teams/:teamId/definition-of-done/history'), async ({ params }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.DOD_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const definition = effectiveDod(teamId);
    if (!definition) {
      return ok([]);
    }
    return ok(versionHistoryOf(definition, groupOfTeam(teamId)?.id ?? teamId));
  }),

  http.get(apiUrl('/teams/:teamId/definition-of-done'), async ({ params }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.DOD_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const definition = effectiveDod(teamId);
    if (!definition) {
      return problems.notFound('Definition of Done');
    }
    return ok(definition);
  }),

  http.put(apiUrl('/teams/:teamId/definition-of-done'), async ({ request, params }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.DOD_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    // A grouped team is held to the group's agreement: changing it is done at the
    // group, so a team-scoped write here would silently change nothing.
    if (groupOfTeam(teamId)) {
      return gate(
        GATE_CODES.DOD_GROUP_GOVERNED,
        'This team complies with its group’s shared Definition of Done. Change it at the group.'
      );
    }

    const definition = database().definitionsOfDone.find((entry) => entry.teamId === teamId);
    if (!definition) {
      return problems.notFound('Definition of Done');
    }

    const body = await bodyOf<{ items: ItemWrite[] }>(request);
    const writes = body.items ?? [];
    if (writes.some((write) => !(write.description ?? '').trim() && !write.id)) {
      return problems.validation('A new criterion needs a description', 'description');
    }

    const items = applyItems(definition.items, writes);
    // An agreement with no active criterion is not a commitment: the standup
    // could then be satisfied vacuously.
    if (items.filter((item) => item.isActive).length === 0) {
      return gate(
        GATE_CODES.DOD_REQUIRED,
        'A Definition of Done needs at least one active criterion'
      );
    }

    database().dodVersionSnapshots.push(snapshotOf(definition, teamId));
    definition.items = items;
    definition.version += 1;
    definition.updatedBy = user.id;
    definition.updatedAt = new Date().toISOString();

    return accepted(definition);
  }),

  // --- Definition of Ready --------------------------------------------------

  http.get(apiUrl('/teams/:teamId/definition-of-ready/history'), async ({ params }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.DOR_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const definition = readyOf(teamId);
    if (!definition) {
      return ok([]);
    }

    const superseded: DoRVersionSnapshot[] = database()
      .dorVersionSnapshots.filter((snapshot) => snapshot.teamId === teamId)
      .sort((left, right) => right.version - left.version);

    const current: DoRVersionSnapshot = {
      id: `current:${teamId}`,
      teamId,
      version: definition.version,
      items: definition.items.map((item) => ({
        description: item.description,
        category: item.category ?? null,
        isActive: item.isActive,
        order: item.order,
        defaultKey: item.defaultKey ?? null,
      })),
      createdAt: definition.updatedAt,
      createdBy: definition.updatedBy ?? null,
      createdByName: displayNameOf(definition.updatedBy),
      isCurrent: true,
    };

    return ok([current, ...superseded]);
  }),

  http.get(apiUrl('/teams/:teamId/definition-of-ready'), async ({ params }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.DOR_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const definition = readyOf(teamId);
    if (!definition) {
      return problems.notFound('Definition of Ready');
    }
    return ok(definition);
  }),

  http.put(apiUrl('/teams/:teamId/definition-of-ready'), async ({ request, params }) => {
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
    // The readiness bar is the Scrum Master's to maintain: a bar any member could
    // lower is not a bar.
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return gate(
        GATE_CODES.DOR_SCRUM_MASTER_ONLY,
        'Only the Scrum Master maintains the Definition of Ready'
      );
    }

    const definition = readyOf(teamId);
    if (!definition) {
      return problems.notFound('Definition of Ready');
    }

    const body = await bodyOf<{ items: ItemWrite[] }>(request);
    const writes = body.items ?? [];
    const items = applyItems(definition.items, writes);
    if (items.filter((item) => item.isActive).length === 0) {
      return gate(
        GATE_CODES.DOR_REQUIRED,
        'A Definition of Ready needs at least one active criterion'
      );
    }

    database().dorVersionSnapshots.push({
      id: crypto.randomUUID(),
      teamId,
      version: definition.version,
      items: definition.items.map((item) => ({
        description: item.description,
        category: item.category ?? null,
        isActive: item.isActive,
        order: item.order,
        defaultKey: item.defaultKey ?? null,
      })),
      createdAt: definition.updatedAt,
      createdBy: definition.updatedBy ?? null,
      createdByName: displayNameOf(definition.updatedBy),
      isCurrent: false,
    });

    definition.items = items;
    definition.version += 1;
    definition.updatedBy = user.id;
    definition.updatedAt = new Date().toISOString();

    return accepted(definition);
  }),

  // --- Verifications --------------------------------------------------------

  http.post(apiUrl('/product-backlog/:pbiId/verify-dod'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const pbi = pbiOf(String(params.pbiId ?? ''));
    if (!pbi) {
      return problems.notFound('Backlog item');
    }
    if (!isMemberOf(user.id, pbi.teamId)) {
      return gate(GATE_CODES.DOD_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{
      verifications: Array<{ dodItemId: string; isVerified: boolean; notes?: string }>;
    }>(request);
    const definition = effectiveDod(pbi.teamId);
    const criteria = new Map((definition?.items ?? []).map((item) => [item.id, item]));
    const now = new Date().toISOString();

    for (const entry of body.verifications ?? []) {
      if (!criteria.has(entry.dodItemId)) {
        return problems.validation('Unknown Definition of Done criterion', 'dodItemId');
      }

      const existing = database().dodVerifications.find(
        (verification) =>
          verification.pbiId === pbi.id && verification.dodItemId === entry.dodItemId
      );
      if (existing) {
        existing.isVerified = entry.isVerified;
        existing.notes = entry.notes;
        existing.verifiedBy = user.id;
        existing.verifiedAt = now;
        continue;
      }

      const criterion = criteria.get(entry.dodItemId);
      database().dodVerifications.push({
        id: crypto.randomUUID(),
        pbiId: pbi.id,
        dodItemId: entry.dodItemId,
        isVerified: entry.isVerified,
        verifiedBy: user.id,
        verifiedAt: now,
        notes: entry.notes,
        dodItemDescription: criterion?.description,
        dodItemCategory: criterion?.category,
        verifierName: displayNameOf(user.id),
      });
    }

    return ok(database().dodVerifications.filter((verification) => verification.pbiId === pbi.id));
  }),

  http.get(apiUrl('/product-backlog/:pbiId/dod-verifications'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const pbi = pbiOf(String(params.pbiId ?? ''));
    if (!pbi) {
      return problems.notFound('Backlog item');
    }
    if (!isMemberOf(user.id, pbi.teamId)) {
      return gate(GATE_CODES.DOD_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const verifications: DoDChecklistVerification[] = database()
      .dodVerifications.filter((verification) => verification.pbiId === pbi.id)
      .map((verification) => ({
        ...verification,
        verifierName: displayNameOf(verification.verifiedBy),
      }));

    return ok(verifications);
  }),

  http.post(apiUrl('/product-backlog/:pbiId/verify-dor'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const pbi = pbiOf(String(params.pbiId ?? ''));
    if (!pbi) {
      return problems.notFound('Backlog item');
    }
    if (!isMemberOf(user.id, pbi.teamId)) {
      return gate(GATE_CODES.DOR_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{
      verifications: Array<{ dorItemId: string; isVerified: boolean; notes?: string }>;
    }>(request);
    const definition = readyOf(pbi.teamId);
    const criteria = new Map((definition?.items ?? []).map((item) => [item.id, item]));
    const now = new Date().toISOString();

    for (const entry of body.verifications ?? []) {
      if (!criteria.has(entry.dorItemId)) {
        return problems.validation('Unknown Definition of Ready criterion', 'dorItemId');
      }

      const existing = database().dorVerifications.find(
        (verification) =>
          verification.pbiId === pbi.id && verification.dorItemId === entry.dorItemId
      );
      const criterion = criteria.get(entry.dorItemId);

      if (existing) {
        existing.isVerified = entry.isVerified;
        existing.notes = entry.notes;
        existing.verifiedBy = user.id;
        existing.verifiedAt = now;
        continue;
      }

      database().dorVerifications.push({
        id: crypto.randomUUID(),
        pbiId: pbi.id,
        dorItemId: entry.dorItemId,
        isVerified: entry.isVerified,
        verifiedBy: user.id,
        verifiedAt: now,
        notes: entry.notes,
        dorItemDescription: criterion?.description,
      });
    }

    return ok(database().dorVerifications.filter((verification) => verification.pbiId === pbi.id));
  }),

  http.get(apiUrl('/product-backlog/:pbiId/dor-verifications'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const pbi = pbiOf(String(params.pbiId ?? ''));
    if (!pbi) {
      return problems.notFound('Backlog item');
    }
    if (!isMemberOf(user.id, pbi.teamId)) {
      return gate(GATE_CODES.DOR_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const verifications: DoRChecklistVerification[] = database().dorVerifications.filter(
      (verification) => verification.pbiId === pbi.id
    );

    return ok(verifications);
  }),

  // --- Compliance -----------------------------------------------------------

  http.get(apiUrl('/sprints/:sprintId/dod-compliance'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const sprint = database().sprints.find((candidate) => candidate.id === sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!isMemberOf(user.id, sprint.teamId)) {
      return gate(GATE_CODES.DOD_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const report = complianceOf(sprintId);
    if (!report) {
      return problems.notFound('Sprint');
    }
    return ok(report);
  }),
];
