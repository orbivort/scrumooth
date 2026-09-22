import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    crossFunctionalityAssessment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('assessment-uuid'),
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  AuditEventTypes: { TEAM: 'TEAM' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

import { crossFunctionalityService } from '../../../services/crossFunctionality.service';
import prisma from '../../../utils/prisma';
import { auditResourceEvent } from '../../../utils/auditLogger';
import { NotFoundError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const callerIsScrumMaster = () =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' });
const callerIsDeveloper = () =>
  asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' });
const callerIsNotAMember = () => asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

const assessment = {
  id: 'assessment-1',
  teamId: 'team-1',
  assessedAt: new Date('2026-09-20T09:00:00.000Z'),
  summary: 'We can ship the frontend but not the migration.',
  createdBy: 'sm-1',
  createdAt: new Date('2026-09-20T09:00:00.000Z'),
  updatedAt: new Date('2026-09-20T09:00:00.000Z'),
  skills: [
    { id: 'skill-1', name: 'Database migrations', coverage: 'NONE', note: 'Nobody has run one.' },
    { id: 'skill-2', name: 'React', coverage: 'COVERED', note: null },
    { id: 'skill-3', name: 'Accessibility testing', coverage: 'PARTIAL', note: 'One person.' },
  ],
  creator: { id: 'sm-1', firstName: 'Grace', lastName: 'Hopper' },
};

describe('CrossFunctionalityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsScrumMaster();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCrossFunctionality', () => {
    it('should refuse the assessment to someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        crossFunctionalityService.getCrossFunctionality('team-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY });
      expect(prisma.crossFunctionalityAssessment.findMany).not.toHaveBeenCalled();
    });

    it('should return the latest assessment with its coverage summary and the history', async () => {
      asMock(prisma.crossFunctionalityAssessment.findMany).mockResolvedValue([
        assessment,
        { ...assessment, id: 'assessment-0', assessedAt: new Date('2026-08-01T00:00:00.000Z') },
      ]);

      const result = await crossFunctionalityService.getCrossFunctionality('team-1', 'dev-1');

      expect(result.latest?.coverage).toEqual({ total: 3, covered: 1, partial: 1, gaps: 1 });
      expect(result.latest?.createdByName).toBe('Grace Hopper');
      expect(result.history).toHaveLength(1);
      expect(result.history[0]).toMatchObject({ id: 'assessment-0' });
    });

    it('should report no assessment as null rather than as an empty one', async () => {
      asMock(prisma.crossFunctionalityAssessment.findMany).mockResolvedValue([]);

      const result = await crossFunctionalityService.getCrossFunctionality('team-1', 'dev-1');

      expect(result).toEqual({ latest: null, history: [] });
    });
  });

  describe('getAssessmentById', () => {
    it('should throw NotFoundError when the assessment does not exist', async () => {
      asMock(prisma.crossFunctionalityAssessment.findUnique).mockResolvedValue(null);

      await expect(crossFunctionalityService.getAssessmentById('missing', 'dev-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should refuse an assessment of a team the caller is not in', async () => {
      asMock(prisma.crossFunctionalityAssessment.findUnique).mockResolvedValue({
        ...assessment,
        teamId: 'team-9',
      });
      callerIsNotAMember();

      await expect(
        crossFunctionalityService.getAssessmentById('assessment-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY });
    });

    it('should return one assessment with its skills', async () => {
      asMock(prisma.crossFunctionalityAssessment.findUnique).mockResolvedValue(assessment);

      const result = await crossFunctionalityService.getAssessmentById('assessment-1', 'dev-1');

      expect(result.skills).toHaveLength(3);
      expect(result.coverage.gaps).toBe(1);
    });
  });

  describe('createAssessment', () => {
    const input = {
      teamId: 'team-1',
      summary: assessment.summary,
      skills: [
        { name: 'Database migrations', coverage: 'NONE' as const, note: 'Nobody has run one.' },
        { name: 'React', coverage: 'COVERED' as const },
      ],
    };

    it('should refuse a member who is not the Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        crossFunctionalityService.createAssessment('dev-1', input)
      ).rejects.toMatchObject({ code: GATE_CODES.CROSS_FUNCTIONALITY_SM_ONLY });
      expect(prisma.crossFunctionalityAssessment.create).not.toHaveBeenCalled();
    });

    it('should refuse a caller outside the team', async () => {
      callerIsNotAMember();

      await expect(
        crossFunctionalityService.createAssessment('outsider', input)
      ).rejects.toMatchObject({ code: GATE_CODES.CROSS_FUNCTIONALITY_SM_ONLY });
    });

    it('should record the assessment with its skills', async () => {
      asMock(prisma.crossFunctionalityAssessment.create).mockResolvedValue(assessment);

      const result = await crossFunctionalityService.createAssessment('sm-1', input);

      expect(prisma.crossFunctionalityAssessment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'assessment-uuid',
            teamId: 'team-1',
            createdBy: 'sm-1',
            skills: {
              create: [
                expect.objectContaining({
                  name: 'Database migrations',
                  coverage: 'NONE',
                  note: 'Nobody has run one.',
                }),
                expect.objectContaining({ name: 'React', coverage: 'COVERED', note: null }),
              ],
            },
          }),
        })
      );
      expect(result.id).toBe('assessment-1');
    });

    it('should audit the counts rather than the skill names', async () => {
      asMock(prisma.crossFunctionalityAssessment.create).mockResolvedValue(assessment);

      await crossFunctionalityService.createAssessment('sm-1', input);

      expect(auditResourceEvent).toHaveBeenCalledWith(
        'TEAM',
        'CREATE',
        'SUCCESS',
        expect.objectContaining({ type: 'CROSS_FUNCTIONALITY_ASSESSMENT' }),
        expect.objectContaining({ teamId: 'team-1', skillCount: 3, gapCount: 1 })
      );
    });
  });
});
