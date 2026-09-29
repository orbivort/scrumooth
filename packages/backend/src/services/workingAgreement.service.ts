// The team's working agreements.
//
// Self-management means the Scrum Team decides internally how it works, so the agreements it makes
// with itself belong to the team: every member can read them and any member can amend them, and who
// wrote them is recorded. An agreement is *retired* rather than deleted -- a working agreement that
// silently disappears hides the fact that the team changed its mind, which is itself something the
// team should be able to see.
import prisma from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { WorkingAgreementStatus } from '../generated/prisma/client';
import { GATE_CODES } from '@scrumooth/shared';
import {
  AuditEventTypes,
  AuditActions,
  AuditResults,
  auditResourceEvent,
} from '../utils/auditLogger';
import { assertTeamMembership, type TeamRoleRefusal } from './teamRoleAccess';

/** Working agreements describe how one specific team works, so they belong to that team. */
const AGREEMENT_TEAM_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:facilitation.teamMembersOnly',
  gateCode: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY,
};

interface AgreementRow {
  id: string;
  teamId: string;
  title: string;
  description: string;
  status: WorkingAgreementStatus;
  agreedAt: Date;
  retiredAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateAgreementInput {
  teamId: string;
  title: string;
  description: string;
}

interface UpdateAgreementInput {
  title?: string;
  description?: string;
  status?: WorkingAgreementStatus;
}

class WorkingAgreementService {
  /**
   * The names behind the authorship columns, in one query per page rather than one per row.
   */
  private async buildNameMap(rows: AgreementRow[]): Promise<Map<string, string>> {
    const authorIds = [
      ...new Set(
        rows.flatMap((row) => [row.createdBy, row.updatedBy]).filter((id): id is string => !!id)
      ),
    ];

    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    return new Map(
      authors.map((author) => [author.id, `${author.firstName} ${author.lastName}`.trim()])
    );
  }

  /** Serialize one agreement against an already-resolved name map. */
  private formatRow(row: AgreementRow, nameById: Map<string, string>) {
    return {
      id: row.id,
      teamId: row.teamId,
      title: row.title,
      description: row.description,
      status: row.status,
      agreedAt: row.agreedAt.toISOString(),
      retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
      createdBy: row.createdBy,
      createdByName: row.createdBy ? (nameById.get(row.createdBy) ?? null) : null,
      updatedBy: row.updatedBy,
      updatedByName: row.updatedBy ? (nameById.get(row.updatedBy) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Serialize a page of agreements, naming who wrote each one. */
  private async formatAgreements(rows: AgreementRow[]) {
    const nameById = await this.buildNameMap(rows);

    return rows.map((row) => this.formatRow(row, nameById));
  }

  /** Serialize the one agreement a write returned. */
  private async formatOne(row: AgreementRow) {
    const nameById = await this.buildNameMap([row]);

    return this.formatRow(row, nameById);
  }

  /** Every agreement of a team, active first and newest first within a state. */
  async getWorkingAgreements(teamId: string, actorUserId: string | undefined) {
    await assertTeamMembership(teamId, actorUserId, AGREEMENT_TEAM_REFUSAL);

    const agreements = await prisma.workingAgreement.findMany({
      where: { teamId },
      orderBy: [{ status: 'asc' }, { agreedAt: 'desc' }],
    });

    return this.formatAgreements(agreements);
  }

  /** Record an agreement the team made with itself. */
  async createWorkingAgreement(userId: string, data: CreateAgreementInput) {
    await assertTeamMembership(data.teamId, userId, AGREEMENT_TEAM_REFUSAL);

    const agreement = await prisma.workingAgreement.create({
      data: {
        id: generateUUIDv7(),
        teamId: data.teamId,
        title: data.title,
        description: data.description,
        status: WorkingAgreementStatus.ACTIVE,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.CREATE,
      AuditResults.SUCCESS,
      { type: 'WORKING_AGREEMENT', id: agreement.id, name: agreement.title },
      { teamId: agreement.teamId }
    );

    return this.formatOne(agreement);
  }

  /**
   * Amend an agreement, or retire it.
   *
   * Retirement is a state with a timestamp, not a deletion: the team's change of mind is part of
   * its record. Reactivating clears the retirement timestamp for the same reason.
   */
  async updateWorkingAgreement(id: string, userId: string | undefined, data: UpdateAgreementInput) {
    const existing = await prisma.workingAgreement.findUnique({
      where: { id },
      select: { id: true, teamId: true, status: true, retiredAt: true },
    });

    if (!existing) {
      throw new NotFoundError('Working Agreement');
    }

    await assertTeamMembership(existing.teamId, userId, AGREEMENT_TEAM_REFUSAL);

    const retiredAt =
      data.status === WorkingAgreementStatus.RETIRED
        ? (existing.retiredAt ?? new Date())
        : data.status
          ? null
          : undefined;

    const agreement = await prisma.workingAgreement.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(retiredAt !== undefined ? { retiredAt } : {}),
        updatedBy: userId,
      },
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'WORKING_AGREEMENT', id: agreement.id, name: agreement.title },
      { teamId: agreement.teamId, status: agreement.status }
    );

    return this.formatOne(agreement);
  }
}

export const workingAgreementService = new WorkingAgreementService();
