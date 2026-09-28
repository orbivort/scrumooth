import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    teamMember: {
      findFirst: vi.fn(),
    },
  },
}));

import {
  assertTeamMembership,
  assertTeamScrumMaster,
  isTeamScrumMasterRole,
  type TeamRoleRefusal,
} from '../../../services/teamRoleAccess';
import prisma from '../../../utils/prisma';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:teamGroup.leadershipOnly',
  gateCode: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
};

describe('teamRoleAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertTeamMembership', () => {
    it('should fail closed when the caller id is missing', async () => {
      await expect(assertTeamMembership('team-1', undefined, REFUSAL)).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
      expect(prisma.teamMember.findFirst).not.toHaveBeenCalled();
    });

    it('should refuse a caller who is not a member of the team', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(assertTeamMembership('team-1', 'user-1', REFUSAL)).rejects.toMatchObject({
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
    });

    it('should return the role the caller holds in the team', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(assertTeamMembership('team-1', 'user-1', REFUSAL)).resolves.toBe('DEVELOPERS');
      expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', userId: 'user-1' },
        select: { role: true },
      });
    });
  });

  describe('assertTeamScrumMaster', () => {
    it('should fail closed when the caller id is missing', async () => {
      await expect(assertTeamScrumMaster('team-1', undefined, REFUSAL)).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
      expect(prisma.teamMember.findFirst).not.toHaveBeenCalled();
    });

    it('should refuse a member who is not the Scrum Master', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(assertTeamScrumMaster('team-1', 'user-1', REFUSAL)).rejects.toMatchObject({
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
    });

    it('should refuse someone who is not a member at all', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(assertTeamScrumMaster('team-1', 'outsider', REFUSAL)).rejects.toMatchObject({
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
    });

    it('should accept the team Scrum Master', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' });

      await expect(assertTeamScrumMaster('team-1', 'sm-1', REFUSAL)).resolves.toBeUndefined();
    });
  });

  describe('isTeamScrumMasterRole', () => {
    it('should recognise the Scrum Master role', () => {
      expect(isTeamScrumMasterRole('SCRUM_MASTER')).toBe(true);
    });

    it('should reject any other role and a missing role', () => {
      expect(isTeamScrumMasterRole('DEVELOPERS')).toBe(false);
      expect(isTeamScrumMasterRole(undefined)).toBe(false);
    });
  });
});
