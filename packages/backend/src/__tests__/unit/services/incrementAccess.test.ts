import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    teamMember: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    definitionOfDone: {
      findUnique: vi.fn(),
    },
    definitionOfReady: {
      findUnique: vi.fn(),
    },
    doDChecklistVerification: {
      findMany: vi.fn(),
    },
    doRChecklistVerification: {
      findMany: vi.fn(),
    },
  },
}));

import {
  assertTeamMember,
  assertIncrementTeamMember,
  assertDoDTeamMember,
  assertDoRTeamMember,
  assertDoRScrumMaster,
  getActiveDoDItemIds,
  checkDoDEligibility,
  getFullyDoDVerifiedPbiIds,
  isFullyDoDVerified,
  checkDoREligibility,
  getDoRShortfall,
} from '../../../services/incrementAccess';
import prisma from '../../../utils/prisma';
import { GATE_CODES } from '@scrumooth/shared';

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

const REFUSAL = {
  messageKey: 'errors:increment.teamMembersOnly',
  gateCode: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
};

/** The caller is a member of the team; tests override the return when they are not. */
const callerIsMember = () => asMock(prisma.teamMember.findUnique).mockResolvedValue({ id: 'm-1' });
const callerIsNotAMember = () => asMock(prisma.teamMember.findUnique).mockResolvedValue(null);

/** The team is team-scoped (not grouped) unless a test says otherwise. */
const teamHasNoGroup = () => asMock(prisma.team.findUnique).mockResolvedValue({ groupId: null });

describe('incrementAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callerIsMember();
    teamHasNoGroup();
    asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({ items: [] });
    asMock(prisma.definitionOfReady.findUnique).mockResolvedValue({ items: [] });
    asMock(prisma.doDChecklistVerification.findMany).mockResolvedValue([]);
    asMock(prisma.doRChecklistVerification.findMany).mockResolvedValue([]);
  });

  describe('assertTeamMember', () => {
    it('should resolve when the caller belongs to the team', async () => {
      await expect(assertTeamMember('user-1', 'team-1', REFUSAL)).resolves.toBeUndefined();
      expect(prisma.teamMember.findUnique).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: 'team-1', userId: 'user-1' } },
        select: { id: true },
      });
    });

    it('should refuse a caller who does not belong to the team', async () => {
      callerIsNotAMember();

      await expect(assertTeamMember('outsider', 'team-1', REFUSAL)).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });
    });
  });

  describe('team-scoped assertions', () => {
    it('should accept an Increment team member', async () => {
      await expect(assertIncrementTeamMember('user-1', 'team-1')).resolves.toBeUndefined();
    });

    it('should refuse an Increment outsider with its own gate code', async () => {
      callerIsNotAMember();

      await expect(assertIncrementTeamMember('outsider', 'team-1')).rejects.toMatchObject({
        code: GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY,
      });
    });

    it('should refuse a Definition of Done outsider with its own gate code', async () => {
      callerIsNotAMember();

      await expect(assertDoDTeamMember('outsider', 'team-1')).rejects.toMatchObject({
        code: GATE_CODES.DOD_TEAM_MEMBERS_ONLY,
      });
    });

    it('should refuse a Definition of Ready outsider with its own gate code', async () => {
      callerIsNotAMember();

      await expect(assertDoRTeamMember('outsider', 'team-1')).rejects.toMatchObject({
        code: GATE_CODES.DOR_TEAM_MEMBERS_ONLY,
      });
    });

    it('should accept the team Scrum Master', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'SCRUM_MASTER' });

      await expect(assertDoRScrumMaster('sm-1', 'team-1')).resolves.toBeUndefined();
    });

    it('should refuse a readiness editor who is not the Scrum Master', async () => {
      asMock(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(assertDoRScrumMaster('user-1', 'team-1')).rejects.toMatchObject({
        code: GATE_CODES.DOR_SCRUM_MASTER_ONLY,
      });
    });
  });

  describe('getActiveDoDItemIds', () => {
    it('should return an empty list when the team does not exist', async () => {
      asMock(prisma.team.findUnique).mockResolvedValue(null);

      await expect(getActiveDoDItemIds('team-1')).resolves.toEqual([]);
      expect(prisma.definitionOfDone.findUnique).not.toHaveBeenCalled();
    });

    it('should return the active criteria of a team-scoped Definition of Done', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'd-1' }, { id: 'd-2' }],
      });

      await expect(getActiveDoDItemIds('team-1')).resolves.toEqual(['d-1', 'd-2']);
      expect(prisma.definitionOfDone.findUnique).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        select: { items: { where: { isActive: true }, select: { id: true } } },
      });
    });

    it('should resolve the group’s shared Definition of Done for a grouped team', async () => {
      asMock(prisma.team.findUnique).mockResolvedValue({ groupId: 'group-1' });
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({ items: [{ id: 'd-9' }] });

      await expect(getActiveDoDItemIds('team-1')).resolves.toEqual(['d-9']);
      expect(prisma.definitionOfDone.findUnique).toHaveBeenCalledWith({
        where: { groupId: 'group-1' },
        select: { items: { where: { isActive: true }, select: { id: true } } },
      });
    });

    it('should return an empty list when the scope owns no Definition of Done', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue(null);

      await expect(getActiveDoDItemIds('team-1')).resolves.toEqual([]);
    });
  });

  describe('checkDoDEligibility', () => {
    it('should report NO_DOD when the team holds no active criterion', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({ items: [] });

      await expect(checkDoDEligibility('pbi-1', 'team-1')).resolves.toEqual({
        eligible: false,
        reason: 'NO_DOD',
        unverifiedCount: 0,
      });
    });

    it('should report eligible when every active criterion is verified', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'd-1' }, { id: 'd-2' }],
      });
      asMock(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { dodItemId: 'd-1' },
        { dodItemId: 'd-2' },
      ]);

      await expect(checkDoDEligibility('pbi-1', 'team-1')).resolves.toEqual({ eligible: true });
    });

    it('should report UNVERIFIED with the count of criteria still to verify', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'd-1' }, { id: 'd-2' }, { id: 'd-3' }],
      });
      asMock(prisma.doDChecklistVerification.findMany).mockResolvedValue([{ dodItemId: 'd-1' }]);

      await expect(checkDoDEligibility('pbi-1', 'team-1')).resolves.toEqual({
        eligible: false,
        reason: 'UNVERIFIED',
        unverifiedCount: 2,
      });
    });
  });

  describe('getFullyDoDVerifiedPbiIds / isFullyDoDVerified', () => {
    it('should resolve nothing for an empty set of items', async () => {
      await expect(getFullyDoDVerifiedPbiIds([], 'team-1')).resolves.toEqual(new Set());
      expect(prisma.definitionOfDone.findUnique).not.toHaveBeenCalled();
    });

    it('should resolve nothing when the team holds no active criterion', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({ items: [] });

      await expect(getFullyDoDVerifiedPbiIds(['pbi-1'], 'team-1')).resolves.toEqual(new Set());
      expect(prisma.doDChecklistVerification.findMany).not.toHaveBeenCalled();
    });

    it('should keep only the items that satisfy every active criterion', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'd-1' }, { id: 'd-2' }],
      });
      asMock(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { pbiId: 'pbi-1', dodItemId: 'd-1' },
        { pbiId: 'pbi-1', dodItemId: 'd-2' },
        { pbiId: 'pbi-2', dodItemId: 'd-1' },
      ]);

      const result = await getFullyDoDVerifiedPbiIds(['pbi-1', 'pbi-2'], 'team-1');

      expect(result).toEqual(new Set(['pbi-1']));
    });

    it('should return true only for an item that fully satisfies the Definition of Done', async () => {
      asMock(prisma.definitionOfDone.findUnique).mockResolvedValue({ items: [{ id: 'd-1' }] });
      asMock(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { pbiId: 'pbi-1', dodItemId: 'd-1' },
      ]);

      await expect(isFullyDoDVerified('pbi-1', 'team-1')).resolves.toBe(true);
      await expect(isFullyDoDVerified('pbi-2', 'team-1')).resolves.toBe(false);
    });
  });

  describe('checkDoREligibility', () => {
    it('should report NO_DOR when the team holds no active criterion', async () => {
      asMock(prisma.definitionOfReady.findUnique).mockResolvedValue(null);

      await expect(checkDoREligibility('pbi-1', 'team-1')).resolves.toEqual({
        eligible: false,
        reason: 'NO_DOR',
        unverifiedCount: 0,
      });
      expect(prisma.doRChecklistVerification.findMany).not.toHaveBeenCalled();
    });

    it('should report eligible when every active criterion is verified', async () => {
      asMock(prisma.definitionOfReady.findUnique).mockResolvedValue({
        items: [{ id: 'r-1' }, { id: 'r-2' }],
      });
      asMock(prisma.doRChecklistVerification.findMany).mockResolvedValue([
        { dorItemId: 'r-1' },
        { dorItemId: 'r-2' },
      ]);

      await expect(checkDoREligibility('pbi-1', 'team-1')).resolves.toEqual({ eligible: true });
    });

    it('should report UNVERIFIED with the count of criteria still to verify', async () => {
      asMock(prisma.definitionOfReady.findUnique).mockResolvedValue({
        items: [{ id: 'r-1' }, { id: 'r-2' }, { id: 'r-3' }],
      });
      asMock(prisma.doRChecklistVerification.findMany).mockResolvedValue([{ dorItemId: 'r-3' }]);

      await expect(checkDoREligibility('pbi-1', 'team-1')).resolves.toEqual({
        eligible: false,
        reason: 'UNVERIFIED',
        unverifiedCount: 2,
      });
    });
  });

  describe('getDoRShortfall', () => {
    it('should report an empty agreement as an empty shortfall', async () => {
      asMock(prisma.definitionOfReady.findUnique).mockResolvedValue({ items: [] });

      await expect(getDoRShortfall('team-1', ['pbi-1'])).resolves.toEqual({
        activeItemCount: 0,
        incompletePbiIds: [],
      });
      expect(prisma.doRChecklistVerification.findMany).not.toHaveBeenCalled();
    });

    it('should return the criterion count even when no items are asked about', async () => {
      asMock(prisma.definitionOfReady.findUnique).mockResolvedValue({
        items: [{ id: 'r-1' }, { id: 'r-2' }],
      });

      await expect(getDoRShortfall('team-1', [])).resolves.toEqual({
        activeItemCount: 2,
        incompletePbiIds: [],
      });
    });

    it('should name the items that still have an unverified active criterion', async () => {
      asMock(prisma.definitionOfReady.findUnique).mockResolvedValue({
        items: [{ id: 'r-1' }, { id: 'r-2' }],
      });
      asMock(prisma.doRChecklistVerification.findMany).mockResolvedValue([
        { pbiId: 'pbi-1', dorItemId: 'r-1' },
        { pbiId: 'pbi-1', dorItemId: 'r-2' },
      ]);

      await expect(getDoRShortfall('team-1', ['pbi-1', 'pbi-2'])).resolves.toEqual({
        activeItemCount: 2,
        incompletePbiIds: ['pbi-2'],
      });
    });
  });
});
