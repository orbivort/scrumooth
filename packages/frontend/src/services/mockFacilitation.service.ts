// Mock implementations of the facilitation services, used when VITE_USE_MOCK_API !== 'false'.
//
// The classes implement the exact interfaces of the real services, so the pages are agnostic to
// which one they get; the substitution happens once, in `services/index.ts`. A write returns a
// template row with the caller's values applied, because a demo has no database to write to.
import {
  BarrierStatus,
  CoachingTopic,
  type SkillCoverage,
  StakeholderActionStatus,
  WorkingAgreementStatus,
  summarizeSkillCoverage,
  type BarrierStakeholderAction,
  type CoachingEntry,
  type CrossFunctionalityAssessment,
  type OrganizationalBarrier,
  type StakeholderActionStatus as StakeholderActionStatusType,
  type WorkingAgreement,
} from '@scrumooth/shared';

import type { ApiResponse } from '../types';

import { mockDelay } from './mockResponseUtils';
import {
  mockBarrierStats,
  mockBarriers,
  mockCoachingEntries,
  mockCrossFunctionality,
  mockEscalatableImpediments,
  mockWorkingAgreements,
} from './mockFacilitationData';
import type {
  BarrierFilters,
  CreateBarrierPayload,
  EscalateImpedimentPayload,
  EscalatableImpediment,
  StakeholderActionPayload,
  UpdateBarrierPayload,
  UpdateStakeholderActionPayload,
} from './domain/organizationalBarriers.service';
import type { CoachingEntryPage, CoachingEntryPayload } from './domain/coaching.service';
import type { WorkingAgreementPayload } from './domain/workingAgreements.service';
import type {
  AssessmentPayload,
  CrossFunctionalityRecord,
} from './domain/crossFunctionality.service';

/** A barrier as a write would return it, before the caller's values are applied. */
const barrierTemplate = (): OrganizationalBarrier => ({
  id: 'barrier-new',
  teamId: 'team-3',
  sourceImpedimentId: null,
  sourceImpedimentTitle: null,
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: BarrierStatus.OPEN,
  ownerId: null,
  ownerName: null,
  raisedById: 'user-sm-1',
  raisedByName: 'Grace Hopper',
  targetDate: null,
  resolution: null,
  resolvedAt: null,
  ageDays: 0,
  isOverdue: false,
  actions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const actionTemplate = (): BarrierStakeholderAction => ({
  id: 'action-new',
  barrierId: 'barrier-new',
  description: '',
  ownerId: null,
  ownerName: null,
  dueDate: null,
  status: StakeholderActionStatus.OPEN,
  completedAt: null,
  daysUntilDue: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const coachingTemplate = (): CoachingEntry => ({
  id: 'coaching-new',
  teamId: 'team-3',
  topic: CoachingTopic.OTHER,
  note: '',
  sprintId: null,
  sprintName: null,
  followUpDate: null,
  authorId: 'user-sm-1',
  authorName: 'Grace Hopper',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const agreementTemplate = (): WorkingAgreement => ({
  id: 'agreement-new',
  teamId: 'team-3',
  title: '',
  description: '',
  status: WorkingAgreementStatus.ACTIVE,
  agreedAt: new Date().toISOString(),
  retiredAt: null,
  createdBy: 'user-1',
  createdByName: 'Ada Lovelace',
  updatedBy: 'user-1',
  updatedByName: 'Ada Lovelace',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const assessmentTemplate = (): CrossFunctionalityAssessment => ({
  id: 'assessment-new',
  teamId: 'team-3',
  assessedAt: new Date().toISOString(),
  summary: null,
  skills: [],
  coverage: { total: 0, covered: 0, partial: 0, gaps: 0 },
  createdBy: 'user-sm-1',
  createdByName: 'Grace Hopper',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export class MockOrganizationalBarriersService {
  async getBarriers(_filters: BarrierFilters): Promise<ApiResponse<OrganizationalBarrier[]>> {
    await mockDelay(250);
    return { success: true, data: mockBarriers };
  }

  async getStats(_teamId: string): Promise<ApiResponse<typeof mockBarrierStats>> {
    await mockDelay(150);
    return { success: true, data: mockBarrierStats };
  }

  async getEscalatableImpediments(_teamId: string): Promise<ApiResponse<EscalatableImpediment[]>> {
    await mockDelay(150);
    return { success: true, data: mockEscalatableImpediments };
  }

  async getBarrier(id: string): Promise<ApiResponse<OrganizationalBarrier>> {
    await mockDelay(150);
    const barrier = mockBarriers.find((candidate) => candidate.id === id);

    return { success: true, data: barrier ?? { ...barrierTemplate(), id } };
  }

  async createBarrier(payload: CreateBarrierPayload): Promise<ApiResponse<OrganizationalBarrier>> {
    await mockDelay(250);
    return { success: true, data: { ...barrierTemplate(), ...payload } };
  }

  async escalateImpediment(
    payload: EscalateImpedimentPayload
  ): Promise<ApiResponse<OrganizationalBarrier>> {
    await mockDelay(250);
    return {
      success: true,
      data: {
        ...barrierTemplate(),
        id: 'barrier-escalated',
        sourceImpedimentId: payload.impedimentId,
        title: payload.title ?? 'Escalated impediment',
      },
    };
  }

  async updateBarrier(
    id: string,
    payload: UpdateBarrierPayload
  ): Promise<ApiResponse<OrganizationalBarrier>> {
    await mockDelay(250);
    return { success: true, data: { ...barrierTemplate(), id, ...payload } };
  }

  async deleteBarrier(_id: string): Promise<ApiResponse<{ message: string }>> {
    await mockDelay(200);
    return { success: true, data: { message: 'Organizational barrier deleted' } };
  }

  async addStakeholderAction(
    barrierId: string,
    payload: StakeholderActionPayload
  ): Promise<ApiResponse<BarrierStakeholderAction>> {
    await mockDelay(200);
    return {
      success: true,
      data: {
        ...actionTemplate(),
        barrierId,
        description: payload.description,
        ownerId: payload.ownerId ?? null,
        dueDate: payload.dueDate ?? null,
      },
    };
  }

  async updateStakeholderAction(
    actionId: string,
    payload: UpdateStakeholderActionPayload
  ): Promise<ApiResponse<BarrierStakeholderAction>> {
    await mockDelay(200);
    return {
      success: true,
      data: {
        ...actionTemplate(),
        id: actionId,
        status: (payload.status ?? StakeholderActionStatus.OPEN) as StakeholderActionStatusType,
      },
    };
  }

  async deleteStakeholderAction(_actionId: string): Promise<ApiResponse<{ message: string }>> {
    await mockDelay(200);
    return { success: true, data: { message: 'Stakeholder action deleted' } };
  }
}

export class MockCoachingService {
  async getEntries(_teamId: string): Promise<ApiResponse<CoachingEntryPage>> {
    await mockDelay(200);
    return {
      success: true,
      data: {
        entries: mockCoachingEntries,
        total: mockCoachingEntries.length,
        limit: 50,
        offset: 0,
      },
    };
  }

  async createEntry(payload: CoachingEntryPayload): Promise<ApiResponse<CoachingEntry>> {
    await mockDelay(250);
    return { success: true, data: { ...coachingTemplate(), ...payload } };
  }

  async updateEntry(
    id: string,
    payload: Partial<CoachingEntryPayload>
  ): Promise<ApiResponse<CoachingEntry>> {
    await mockDelay(250);
    return { success: true, data: { ...coachingTemplate(), id, ...payload } };
  }

  async deleteEntry(_id: string): Promise<ApiResponse<{ message: string }>> {
    await mockDelay(200);
    return { success: true, data: { message: 'Coaching entry deleted' } };
  }
}

export class MockWorkingAgreementsService {
  async getAgreements(_teamId: string): Promise<ApiResponse<WorkingAgreement[]>> {
    await mockDelay(200);
    return { success: true, data: mockWorkingAgreements };
  }

  async createAgreement(payload: WorkingAgreementPayload): Promise<ApiResponse<WorkingAgreement>> {
    await mockDelay(250);
    return { success: true, data: { ...agreementTemplate(), ...payload } };
  }

  async updateAgreement(
    id: string,
    payload: WorkingAgreementPayload
  ): Promise<ApiResponse<WorkingAgreement>> {
    await mockDelay(250);
    return { success: true, data: { ...agreementTemplate(), id, ...payload } };
  }
}

export class MockCrossFunctionalityService {
  async getRecord(_teamId: string): Promise<ApiResponse<CrossFunctionalityRecord>> {
    await mockDelay(200);
    return { success: true, data: mockCrossFunctionality };
  }

  async getAssessment(id: string): Promise<ApiResponse<CrossFunctionalityAssessment>> {
    await mockDelay(200);
    const latest = mockCrossFunctionality.latest;

    return { success: true, data: { ...(latest ?? assessmentTemplate()), id } };
  }

  async createAssessment(
    payload: AssessmentPayload
  ): Promise<ApiResponse<CrossFunctionalityAssessment>> {
    await mockDelay(250);
    const skills = payload.skills.map((skill, index) => ({
      id: `skill-${index}`,
      name: skill.name,
      coverage: skill.coverage as SkillCoverage,
      note: skill.note ?? null,
    }));

    return {
      success: true,
      data: {
        ...assessmentTemplate(),
        summary: payload.summary ?? null,
        skills,
        coverage: summarizeSkillCoverage(skills),
      },
    };
  }
}

export const mockOrganizationalBarriersService = new MockOrganizationalBarriersService();
export const mockCoachingService = new MockCoachingService();
export const mockWorkingAgreementsService = new MockWorkingAgreementsService();
export const mockCrossFunctionalityService = new MockCrossFunctionalityService();
