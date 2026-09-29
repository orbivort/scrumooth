import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    team: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    teamHealthCheck: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    teamHealthCheckResponse: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

import { teamHealthCheckService } from '../../../services/teamHealthCheck.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { ScrumValue } from '../../../generated/prisma/client';
import { GATE_CODES } from '@scrumooth/shared';

/** The caller is the Scrum Master of whichever team the resource belongs to. */
const callerIsScrumMaster = () =>
  vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' } as any);

/** The caller is a member of the team, but not its Scrum Master. */
const callerIsDeveloper = () =>
  vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' } as any);

/** The caller is a Scrum Master -- of some other team. */
const callerIsNotAMember = () =>
  vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null as any);

describe('TeamHealthCheckService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsScrumMaster();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createHealthCheck', () => {
    it('should create a health check for a team', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamHealthCheck.create).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        status: 'OPEN',
        responses: [],
      } as any);

      const result = await teamHealthCheckService.createHealthCheck('team-1', undefined, 'user-1');

      expect(result.id).toBe('hc-1');
      expect(prisma.teamHealthCheck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ teamId: 'team-1' }),
        include: { responses: true },
      });
    });

    it('should pass sprintId and createdBy to the health check creation', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamHealthCheck.create).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        sprintId: 'sprint-1',
        status: 'OPEN',
        responses: [],
      } as any);

      const result = await teamHealthCheckService.createHealthCheck('team-1', 'sprint-1', 'user-1');

      expect(prisma.teamHealthCheck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'test-uuid',
          teamId: 'team-1',
          sprintId: 'sprint-1',
          createdBy: 'user-1',
          updatedBy: 'user-1',
        }),
        include: { responses: true },
      });
      expect(result.sprintId).toBe('sprint-1');
    });

    it('should throw NotFoundError when team is missing', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null as any);

      await expect(
        teamHealthCheckService.createHealthCheck('missing', undefined, 'user-1')
      ).rejects.toThrow(NotFoundError);
      expect(prisma.teamHealthCheck.create).not.toHaveBeenCalled();
    });

    it('should refuse to open a survey for a team the caller does not lead', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      callerIsDeveloper();

      await expect(
        teamHealthCheckService.createHealthCheck('team-1', undefined, 'user-2')
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY });
      expect(prisma.teamHealthCheck.create).not.toHaveBeenCalled();
    });

    it('should refuse a caller with no identity', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);

      await expect(
        teamHealthCheckService.createHealthCheck('team-1', undefined, undefined)
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY });
    });

    it('should propagate database errors', async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamHealthCheck.create).mockRejectedValue(new Error('db failure'));

      await expect(
        teamHealthCheckService.createHealthCheck('team-1', undefined, 'user-1')
      ).rejects.toThrow('db failure');
    });
  });

  describe('submitResponses', () => {
    beforeEach(() => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        status: 'OPEN',
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
      } as any);
    });

    it('should throw NotFoundError when health check does not exist', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue(null as any);

      await expect(
        teamHealthCheckService.submitResponses('user-1', 'hc-1', {
          responses: [{ scrumValue: 'COMMITMENT', score: 3, anonymous: false }],
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should refuse a ballot from someone outside the surveyed team', async () => {
      callerIsNotAMember();

      await expect(
        teamHealthCheckService.submitResponses('outsider', 'hc-1', {
          responses: [{ scrumValue: 'COMMITMENT', score: 3, anonymous: false }],
        })
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY });
      expect(prisma.teamHealthCheckResponse.create).not.toHaveBeenCalled();
    });

    it('should reject more than five responses', async () => {
      const responses: Array<{ scrumValue: ScrumValue; score: number; anonymous: boolean }> = [
        { scrumValue: ScrumValue.COMMITMENT, score: 3, anonymous: false },
        { scrumValue: ScrumValue.FOCUS, score: 3, anonymous: false },
        { scrumValue: ScrumValue.OPENNESS, score: 3, anonymous: false },
        { scrumValue: ScrumValue.RESPECT, score: 3, anonymous: false },
        { scrumValue: ScrumValue.COURAGE, score: 3, anonymous: false },
        { scrumValue: ScrumValue.COMMITMENT, score: 4, anonymous: false },
      ];

      await expect(
        teamHealthCheckService.submitResponses('user-1', 'hc-1', { responses })
      ).rejects.toThrow(BadRequestError);
      expect(prisma.teamHealthCheckResponse.create).not.toHaveBeenCalled();
    });

    it('should reject scores above 5', async () => {
      await expect(
        teamHealthCheckService.submitResponses('user-1', 'hc-1', {
          responses: [{ scrumValue: 'COMMITMENT', score: 6, anonymous: false }],
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject scores below 1', async () => {
      await expect(
        teamHealthCheckService.submitResponses('user-1', 'hc-1', {
          responses: [{ scrumValue: 'COMMITMENT', score: 0, anonymous: false }],
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject an invalid Scrum value', async () => {
      await expect(
        teamHealthCheckService.submitResponses('user-1', 'hc-1', {
          responses: [{ scrumValue: 'SOMETHING' as ScrumValue, score: 3, anonymous: false }],
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should save responses for each Scrum value', async () => {
      vi.mocked(prisma.teamHealthCheckResponse.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.teamHealthCheckResponse.create).mockResolvedValue({
        id: 'r-1',
        scrumValue: 'COMMITMENT',
        score: 4,
      } as any);

      const result = await teamHealthCheckService.submitResponses('user-1', 'hc-1', {
        responses: [{ scrumValue: 'COMMITMENT', score: 4, anonymous: true }],
      });

      expect(result.saved).toHaveLength(1);
      expect(result.saved[0]).toEqual({ scrumValue: 'COMMITMENT', score: 4 });
    });

    it('should create responses with the correct data payload', async () => {
      vi.mocked(prisma.teamHealthCheckResponse.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.teamHealthCheckResponse.create).mockResolvedValue({
        id: 'r-1',
        scrumValue: 'RESPECT',
        score: 2,
      } as any);

      const result = await teamHealthCheckService.submitResponses('user-1', 'hc-1', {
        responses: [{ scrumValue: 'RESPECT', score: 2, anonymous: false }],
      });

      expect(prisma.teamHealthCheckResponse.create).toHaveBeenCalledWith({
        data: {
          id: 'test-uuid',
          healthCheckId: 'hc-1',
          userId: 'user-1',
          scrumValue: 'RESPECT',
          score: 2,
          anonymous: false,
          createdBy: 'user-1',
          updatedBy: 'user-1',
        },
      });
      expect(result.saved).toEqual([{ scrumValue: 'RESPECT', score: 2 }]);
    });

    it('should update an existing response instead of creating a duplicate', async () => {
      vi.mocked(prisma.teamHealthCheckResponse.findUnique).mockResolvedValue({
        id: 'existing-1',
        scrumValue: 'COMMITMENT',
        score: 3,
      } as any);
      vi.mocked(prisma.teamHealthCheckResponse.update).mockResolvedValue({
        id: 'existing-1',
        scrumValue: 'COMMITMENT',
        score: 5,
      } as any);

      const result = await teamHealthCheckService.submitResponses('user-1', 'hc-1', {
        responses: [{ scrumValue: 'COMMITMENT', score: 5, anonymous: true }],
      });

      expect(prisma.teamHealthCheckResponse.update).toHaveBeenCalledWith({
        where: { id: 'existing-1' },
        data: { score: 5, anonymous: true, updatedBy: 'user-1' },
      });
      expect(prisma.teamHealthCheckResponse.create).not.toHaveBeenCalled();
      expect(result.saved).toEqual([{ scrumValue: 'COMMITMENT', score: 5 }]);
    });

    it('should propagate errors from response creation', async () => {
      vi.mocked(prisma.teamHealthCheckResponse.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.teamHealthCheckResponse.create).mockRejectedValue(new Error('db failure'));

      await expect(
        teamHealthCheckService.submitResponses('user-1', 'hc-1', {
          responses: [{ scrumValue: 'COMMITMENT', score: 3, anonymous: false }],
        })
      ).rejects.toThrow('db failure');
    });
  });

  describe('getResults', () => {
    it('should throw NotFoundError when health check is missing', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue(null as any);

      await expect(teamHealthCheckService.getResults('missing', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should refuse a Scrum Master of a different team', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-2',
        status: 'OPEN',
        createdAt: new Date(),
      } as any);
      callerIsNotAMember();

      await expect(
        teamHealthCheckService.getResults('hc-1', 'other-team-sm')
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY });
      expect(prisma.teamHealthCheckResponse.findMany).not.toHaveBeenCalled();
    });

    it('should refuse a team member who is not the Scrum Master', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        status: 'OPEN',
        createdAt: new Date(),
      } as any);
      callerIsDeveloper();

      await expect(teamHealthCheckService.getResults('hc-1', 'user-1')).rejects.toMatchObject({
        code: GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY,
      });
    });

    it('should resolve the role against the health check own team', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-9',
        status: 'OPEN',
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
      } as any);
      vi.mocked(prisma.teamHealthCheckResponse.findMany).mockResolvedValue([] as any);

      await teamHealthCheckService.getResults('hc-1', 'user-1');

      expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-9', userId: 'user-1' },
        select: { role: true },
      });
    });

    it('should compute average scores per Scrum value', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        status: 'OPEN',
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.teamHealthCheckResponse.findMany).mockResolvedValue([
        { scrumValue: 'COMMITMENT', score: 4 },
        { scrumValue: 'COMMITMENT', score: 5 },
        { scrumValue: 'FOCUS', score: 3 },
      ] as any);

      const result = await teamHealthCheckService.getResults('hc-1', 'user-1');

      const commitment = result.results.find((r) => r.scrumValue === 'COMMITMENT');
      expect(commitment?.averageScore).toBe(4.5);
      expect(commitment?.responseCount).toBe(2);
      expect(result.results).toHaveLength(5);
    });

    it('should return zero averages when there are no responses', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        status: 'OPEN',
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
      } as any);
      vi.mocked(prisma.teamHealthCheckResponse.findMany).mockResolvedValue([] as any);

      const result = await teamHealthCheckService.getResults('hc-1', 'user-1');

      expect(result.results).toHaveLength(5);
      for (const r of result.results) {
        expect(r.averageScore).toBe(0);
        expect(r.responseCount).toBe(0);
      }
      expect(result.overallAverage).toBe(0);
    });

    it('should compute the overall average across all Scrum values', async () => {
      vi.mocked(prisma.teamHealthCheck.findUnique).mockResolvedValue({
        id: 'hc-1',
        teamId: 'team-1',
        status: 'CLOSED',
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
      } as any);
      vi.mocked(prisma.teamHealthCheckResponse.findMany).mockResolvedValue([
        { scrumValue: 'COMMITMENT', score: 4 },
        { scrumValue: 'COMMITMENT', score: 5 },
        { scrumValue: 'FOCUS', score: 3 },
      ] as any);

      const result = await teamHealthCheckService.getResults('hc-1', 'user-1');

      expect(result.healthCheckId).toBe('hc-1');
      expect(result.status).toBe('CLOSED');
      expect(result.createdAt).toBe('2024-01-15T10:00:00.000Z');
      // Averages per value: 4.5, 3, 0, 0, 0 -> (4.5 + 3) / 5 = 1.5
      expect(result.overallAverage).toBe(1.5);
    });
  });

  describe('getTrend', () => {
    it('should refuse the trend for anyone but the team Scrum Master', async () => {
      callerIsNotAMember();

      await expect(
        teamHealthCheckService.getTrend('team-1', 'other-team-sm')
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY });
      expect(prisma.teamHealthCheck.findMany).not.toHaveBeenCalled();
    });

    it('should return an empty array when the team has no health checks', async () => {
      vi.mocked(prisma.teamHealthCheck.findMany).mockResolvedValue([] as any);

      const result = await teamHealthCheckService.getTrend('team-1', 'user-1');

      expect(result).toEqual([]);
      expect(prisma.teamHealthCheck.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        include: { responses: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should compute per-value and overall averages with rounding', async () => {
      vi.mocked(prisma.teamHealthCheck.findMany).mockResolvedValue([
        {
          id: 'hc-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          responses: [
            { scrumValue: 'COMMITMENT', score: 4 },
            { scrumValue: 'COMMITMENT', score: 5 },
            { scrumValue: 'FOCUS', score: 3 },
          ],
        },
        {
          id: 'hc-2',
          createdAt: new Date('2024-02-01T00:00:00.000Z'),
          responses: [{ scrumValue: 'COURAGE', score: 5 }],
        },
      ] as any);

      const result = await teamHealthCheckService.getTrend('team-1', 'user-1');

      expect(result).toHaveLength(2);

      const hc1 = result.find((r) => r.healthCheckId === 'hc-1');
      expect(hc1?.createdAt).toBe('2024-01-01T00:00:00.000Z');
      // byValue = [4.5, 3, 0, 0, 0] -> overall = 7.5 / 2 = 3.75 -> rounded to 3.8
      expect(hc1?.overallAverage).toBe(3.8);
      expect(hc1?.values.find((v) => v.scrumValue === 'COMMITMENT')?.averageScore).toBe(4.5);
      expect(hc1?.values.find((v) => v.scrumValue === 'FOCUS')?.averageScore).toBe(3);

      const hc2 = result.find((r) => r.healthCheckId === 'hc-2');
      expect(hc2?.createdAt).toBe('2024-02-01T00:00:00.000Z');
      // byValue = [0, 0, 0, 0, 5] -> overall = 5 / 1 = 5
      expect(hc2?.overallAverage).toBe(5);
      expect(hc2?.values.find((v) => v.scrumValue === 'COURAGE')?.averageScore).toBe(5);
      expect(hc2?.values.find((v) => v.scrumValue === 'COMMITMENT')?.averageScore).toBe(0);
    });

    it('should return a zero overall average for a health check without responses', async () => {
      vi.mocked(prisma.teamHealthCheck.findMany).mockResolvedValue([
        {
          id: 'hc-empty',
          createdAt: new Date('2024-03-01T00:00:00.000Z'),
          responses: [],
        },
      ] as any);

      const result = await teamHealthCheckService.getTrend('team-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.healthCheckId).toBe('hc-empty');
      expect(result[0]?.overallAverage).toBe(0);
      expect(result[0]?.values.every((v) => v.averageScore === 0)).toBe(true);
    });
  });

  describe('getLatestForTeam', () => {
    it('should refuse the latest results for anyone but the team Scrum Master', async () => {
      callerIsDeveloper();

      await expect(
        teamHealthCheckService.getLatestForTeam('team-1', 'user-1')
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY });
      expect(prisma.teamHealthCheck.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when the team has no health checks', async () => {
      vi.mocked(prisma.teamHealthCheck.findFirst).mockResolvedValue(null as any);

      const result = await teamHealthCheckService.getLatestForTeam('team-1', 'user-1');

      expect(result).toBeNull();
      expect(prisma.teamHealthCheck.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        include: { responses: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return the aggregated results of the latest health check', async () => {
      vi.mocked(prisma.teamHealthCheck.findFirst).mockResolvedValue({
        id: 'hc-latest',
        teamId: 'team-1',
        status: 'CLOSED',
        createdAt: new Date('2024-02-01T10:00:00.000Z'),
        responses: [{ scrumValue: 'COMMITMENT', score: 4 }],
      } as any);

      const result = await teamHealthCheckService.getLatestForTeam('team-1', 'user-1');

      expect(result).toMatchObject({
        healthCheckId: 'hc-latest',
        status: 'CLOSED',
        overallAverage: 0.8,
      });
    });
  });

  describe('getLatestStatusForTeam', () => {
    it('should refuse the status for someone outside the team', async () => {
      callerIsNotAMember();

      await expect(
        teamHealthCheckService.getLatestStatusForTeam('team-1', 'outsider')
      ).rejects.toMatchObject({ code: GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY });
      expect(prisma.teamHealthCheck.findFirst).not.toHaveBeenCalled();
    });

    it('should return null when the team has no health checks', async () => {
      vi.mocked(prisma.teamHealthCheck.findFirst).mockResolvedValue(null as any);

      const result = await teamHealthCheckService.getLatestStatusForTeam('team-1', 'user-1');

      expect(result).toBeNull();
      expect(prisma.teamHealthCheck.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return the latest health check identity and status only', async () => {
      vi.mocked(prisma.teamHealthCheck.findFirst).mockResolvedValue({
        id: 'hc-latest',
        status: 'OPEN',
        createdAt: new Date('2024-02-01T10:00:00.000Z'),
      } as any);

      const result = await teamHealthCheckService.getLatestStatusForTeam('team-1', 'user-1');

      expect(result).toEqual({
        healthCheckId: 'hc-latest',
        status: 'OPEN',
        createdAt: '2024-02-01T10:00:00.000Z',
      });
    });
  });
});
