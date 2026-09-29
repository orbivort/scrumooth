import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: { teamMember: { findUnique: vi.fn() } },
}));

vi.mock('../../../i18n/requestT.js', () => ({
  t: vi.fn((key: string) => key),
}));

import prisma from '../../../utils/prisma';
import { GATE_CODES } from '@scrumooth/shared';
import { assertReportsTeamMember, REPORTS_TEAM_REFUSAL } from '../../../services/reportsAccess';

describe('assertReportsTeamMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a member of the team whose reports are read', async () => {
    (prisma.teamMember.findUnique as any).mockResolvedValue({ id: 'membership-1' });

    await expect(assertReportsTeamMember('user-1', 'team-1')).resolves.toBeUndefined();

    expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
      where: { teamId_userId: { teamId: 'team-1', userId: 'user-1' } },
      select: { id: true },
    });
  });

  it('refuses a caller who is not a member, with the module gate code', async () => {
    (prisma.teamMember.findUnique as any).mockResolvedValue(null);

    await expect(assertReportsTeamMember('outsider', 'team-1')).rejects.toMatchObject({
      statusCode: 403,
      code: GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY,
    });
  });

  it('refuses a missing caller rather than treating it as exempt', async () => {
    await expect(assertReportsTeamMember(undefined, 'team-1')).rejects.toMatchObject({
      statusCode: 403,
      code: GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY,
    });

    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it('names the refusal in the module vocabulary the interface answers with', () => {
    expect(REPORTS_TEAM_REFUSAL.messageKey).toBe('errors:reports.teamMembersOnly');
    expect(REPORTS_TEAM_REFUSAL.gateCode).toBe(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY);
  });
});
