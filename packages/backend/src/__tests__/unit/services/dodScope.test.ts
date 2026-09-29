import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  doDScopeFields,
  doDScopeWhere,
  groupDoDScope,
  isGroupScope,
  resolveDoDScope,
} from '../../../services/dodScope';
import prisma from '../../../utils/prisma';

vi.mock('../../../utils/prisma', () => ({
  default: {
    team: {
      findUnique: vi.fn(),
    },
  },
}));

describe('DoD scope resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves an ungrouped team to its own Definition of Done', async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ groupId: null } as never);

    const scope = await resolveDoDScope('team-1');

    expect(scope).toEqual({ kind: 'TEAM', teamId: 'team-1' });
    expect(prisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      select: { groupId: true },
    });
  });

  it('resolves a grouped team to the single Definition of Done its group owns', async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ groupId: 'group-1' } as never);

    const scope = await resolveDoDScope('team-1');

    expect(scope).toEqual({ kind: 'GROUP', groupId: 'group-1' });
  });

  it('resolves an unknown team to nothing, so callers keep reporting "no Definition of Done"', async () => {
    vi.mocked(prisma.team.findUnique).mockResolvedValue(null as never);

    await expect(resolveDoDScope('missing-team')).resolves.toBeNull();
  });

  it('names the group scope of a group directly', () => {
    expect(groupDoDScope('group-1')).toEqual({ kind: 'GROUP', groupId: 'group-1' });
  });

  it('selects the row a scope owns', () => {
    expect(doDScopeWhere({ kind: 'TEAM', teamId: 'team-1' })).toEqual({ teamId: 'team-1' });
    expect(doDScopeWhere({ kind: 'GROUP', groupId: 'group-1' })).toEqual({ groupId: 'group-1' });
  });

  it('stamps a row with exactly one owner', () => {
    // Both columns are always written: the unused one explicitly to null, so the database's
    // exactly-one-owner CHECK cannot be satisfied by accident.
    expect(doDScopeFields({ kind: 'TEAM', teamId: 'team-1' })).toEqual({
      teamId: 'team-1',
      groupId: null,
    });
    expect(doDScopeFields({ kind: 'GROUP', groupId: 'group-1' })).toEqual({
      teamId: null,
      groupId: 'group-1',
    });
  });

  it("reports whether a scope is a group's shared Definition of Done", () => {
    expect(isGroupScope({ kind: 'GROUP', groupId: 'group-1' })).toBe(true);
    expect(isGroupScope({ kind: 'TEAM', teamId: 'team-1' })).toBe(false);
  });
});
