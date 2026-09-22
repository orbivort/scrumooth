import { describe, it, expect, vi, beforeEach } from 'vitest';
import { teamGroupService } from '../../../services/teamGroup.service';
import { definitionOfDoneService } from '../../../services/dod.service';
import prisma from '../../../utils/prisma';
import { GATE_CODES } from '@scrumooth/shared';

vi.mock('../../../utils/prisma', () => ({
  default: {
    teamGroup: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    definitionOfDone: {
      findUnique: vi.fn(),
    },
  },
}));

// The Definition of Done itself is tested where it lives; here the group's use of it is.
vi.mock('../../../services/dod.service', () => ({
  definitionOfDoneService: {
    createDefaultSharedDefinitionOfDone: vi.fn(),
    updateSharedDefinitionOfDone: vi.fn(),
    adoptDefinitionOfDoneAsOwn: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/auditLogger', () => ({
  AuditEventTypes: { TEAM: 'TEAM' },
  AuditActions: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  AuditResults: { SUCCESS: 'SUCCESS' },
  auditResourceEvent: vi.fn(),
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('new-group-id'),
}));

const GROUP_ID = 'group-1';
const TEAM_ID = 'team-1';
const PO_ID = 'po-1';
const DEV_ID = 'dev-1';

/** A group with two teams: one led by the Product Owner under test, one by another team's SM. */
const groupWithTeams = () => ({
  id: GROUP_ID,
  name: 'Payments product',
  description: 'Two teams, one product.',
  createdBy: PO_ID,
  definitionOfDone: { version: 3 },
  _count: { teams: 2 },
  teams: [
    {
      id: TEAM_ID,
      name: 'Team A',
      groupJoinedAt: new Date('2026-09-01T09:00:00.000Z'),
      groupDodVersionAtJoin: 2,
      members: [
        { userId: PO_ID, role: 'PRODUCT_OWNER' },
        { userId: DEV_ID, role: 'DEVELOPERS' },
      ],
    },
    {
      id: 'team-2',
      name: 'Team B',
      groupJoinedAt: null,
      groupDodVersionAtJoin: null,
      members: [{ userId: 'sm-2', role: 'SCRUM_MASTER' }],
    },
  ],
});

/** The shared Definition of Done as the database holds it. */
const sharedDoDRow = () => ({
  version: 3,
  updatedAt: new Date('2026-09-10T10:00:00.000Z'),
  items: [
    { id: 'item-1', description: 'Reviewed', category: 'review', isActive: true, order: 0 },
    { id: 'item-2', description: 'Tested', category: 'testing', isActive: true, order: 1 },
  ],
});

describe('TeamGroupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.teamGroup.findUnique).mockResolvedValue(groupWithTeams() as never);
    vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue(sharedDoDRow() as never);
    vi.mocked(prisma.teamGroup.update).mockResolvedValue({} as never);
    vi.mocked(prisma.teamGroup.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.team.update).mockResolvedValue({} as never);
    vi.mocked(definitionOfDoneService.createDefaultSharedDefinitionOfDone).mockResolvedValue({
      version: 1,
    } as never);
    vi.mocked(definitionOfDoneService.updateSharedDefinitionOfDone).mockResolvedValue({
      version: 4,
    } as never);
  });

  describe('listGroups', () => {
    it('lists every group with its team count and the shared DoD version in force', async () => {
      vi.mocked(prisma.teamGroup.findMany).mockResolvedValue([groupWithTeams()] as never);

      const groups = await teamGroupService.listGroups();

      expect(groups).toEqual([
        {
          id: GROUP_ID,
          name: 'Payments product',
          description: 'Two teams, one product.',
          teamCount: 2,
          dodVersion: 3,
        },
      ]);
    });
  });

  describe('getGroup', () => {
    it('shows the roster and the shared Definition of Done to a member of one of its teams', async () => {
      const group = await teamGroupService.getGroup(GROUP_ID, DEV_ID);

      expect(group.teamCount).toBe(2);
      expect(group.dodVersion).toBe(3);
      expect(group.teams).toEqual([
        {
          id: TEAM_ID,
          name: 'Team A',
          joinedAt: '2026-09-01T09:00:00.000Z',
          adoptedDodVersion: 2,
        },
        { id: 'team-2', name: 'Team B', joinedAt: null, adoptedDodVersion: null },
      ]);
      expect(group.definitionOfDone.items).toHaveLength(2);
    });

    it('refuses a caller from outside the group', async () => {
      await expect(teamGroupService.getGroup(GROUP_ID, 'outsider')).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_MEMBERS_ONLY,
      });
    });
  });

  describe('getSharedDefinitionOfDone', () => {
    it('reads the commitment a team would adopt, without requiring membership', async () => {
      const shared = await teamGroupService.getSharedDefinitionOfDone(GROUP_ID);

      expect(shared).toEqual({
        groupId: GROUP_ID,
        version: 3,
        updatedAt: '2026-09-10T10:00:00.000Z',
        items: [
          { id: 'item-1', description: 'Reviewed', category: 'review', isActive: true, order: 0 },
          { id: 'item-2', description: 'Tested', category: 'testing', isActive: true, order: 1 },
        ],
      });
    });

    it('refuses an unknown group', async () => {
      vi.mocked(prisma.teamGroup.findUnique).mockResolvedValue(null as never);

      await expect(teamGroupService.getSharedDefinitionOfDone('missing')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('createGroup', () => {
    it('creates the group together with the Definition of Done it will own', async () => {
      vi.mocked(prisma.teamGroup.findUnique)
        .mockResolvedValueOnce(null as never)
        .mockResolvedValue(groupWithTeams() as never);
      vi.mocked(prisma.teamGroup.create).mockResolvedValue({} as never);

      const group = await teamGroupService.createGroup(PO_ID, {
        name: 'Payments product',
        description: 'Two teams, one product.',
      });

      expect(prisma.teamGroup.create).toHaveBeenCalledWith({
        data: {
          id: 'new-group-id',
          name: 'Payments product',
          description: 'Two teams, one product.',
          createdBy: PO_ID,
          updatedBy: PO_ID,
        },
      });
      expect(definitionOfDoneService.createDefaultSharedDefinitionOfDone).toHaveBeenCalledWith(
        'new-group-id',
        PO_ID
      );
      expect(group.id).toBe(GROUP_ID);
    });

    it('refuses a name that is already taken', async () => {
      vi.mocked(prisma.teamGroup.findUnique).mockResolvedValue({ id: GROUP_ID } as never);

      await expect(
        teamGroupService.createGroup(PO_ID, { name: 'Payments product' })
      ).rejects.toThrow('already exists');
      expect(prisma.teamGroup.create).not.toHaveBeenCalled();
    });
  });

  describe('updateGroup', () => {
    it("refuses a member who does not lead one of the group's teams", async () => {
      await expect(
        teamGroupService.updateGroup(GROUP_ID, DEV_ID, { name: 'Renamed' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
      expect(prisma.teamGroup.update).not.toHaveBeenCalled();
    });

    it('lets the Product Owner of a member team rename it', async () => {
      await teamGroupService.updateGroup(GROUP_ID, PO_ID, { name: 'Renamed' });

      expect(prisma.teamGroup.update).toHaveBeenCalledWith({
        where: { id: GROUP_ID },
        data: { name: 'Renamed', updatedBy: PO_ID },
      });
    });
  });

  describe('deleteGroup', () => {
    it('refuses to remove a group that still has teams complying with its Definition of Done', async () => {
      await expect(teamGroupService.deleteGroup(GROUP_ID, PO_ID)).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.TEAM_GROUP_NOT_EMPTY,
      });
      expect(prisma.teamGroup.delete).not.toHaveBeenCalled();
    });

    it('removes an empty group, whose only possible authority is the account that created it', async () => {
      vi.mocked(prisma.teamGroup.findUnique).mockResolvedValue({
        ...groupWithTeams(),
        _count: { teams: 0 },
        teams: [],
      } as never);

      await teamGroupService.deleteGroup(GROUP_ID, PO_ID);

      expect(prisma.teamGroup.delete).toHaveBeenCalledWith({ where: { id: GROUP_ID } });
    });

    it('refuses to remove an empty group on behalf of someone who neither created it nor leads a team in it', async () => {
      vi.mocked(prisma.teamGroup.findUnique).mockResolvedValue({
        ...groupWithTeams(),
        _count: { teams: 0 },
        teams: [],
      } as never);

      await expect(teamGroupService.deleteGroup(GROUP_ID, 'outsider')).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
      expect(prisma.teamGroup.delete).not.toHaveBeenCalled();
    });

    it('refuses the creator once teams comply with the shared Definition of Done', async () => {
      // The founder is not a member of any of the group's teams any more, so the commitment is no
      // longer theirs to remove.
      vi.mocked(prisma.teamGroup.findUnique).mockResolvedValue({
        ...groupWithTeams(),
      } as never);

      await expect(teamGroupService.deleteGroup(GROUP_ID, 'outsider')).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
    });
  });

  describe('updateSharedDefinitionOfDone', () => {
    it("refuses a Developer, because the shared commitment is the leadership's to change", async () => {
      await expect(
        teamGroupService.updateSharedDefinitionOfDone(GROUP_ID, DEV_ID, [
          { description: 'Reviewed', isActive: true, order: 0 },
        ])
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
      expect(definitionOfDoneService.updateSharedDefinitionOfDone).not.toHaveBeenCalled();
    });

    it('writes one change that every team in the group sees', async () => {
      await teamGroupService.updateSharedDefinitionOfDone(GROUP_ID, PO_ID, [
        { description: 'Reviewed', isActive: true, order: 0 },
      ]);

      expect(definitionOfDoneService.updateSharedDefinitionOfDone).toHaveBeenCalledWith(
        GROUP_ID,
        [{ description: 'Reviewed', isActive: true, order: 0 }],
        PO_ID
      );
    });
  });

  describe('joinGroup', () => {
    it('refuses a caller who does not lead the team', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'DEVELOPERS' } as never);

      await expect(
        teamGroupService.joinGroup(TEAM_ID, DEV_ID, {
          groupId: GROUP_ID,
          acknowledgedDodVersion: 3,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.TEAM_GROUP_LEADERSHIP_ONLY,
      });
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("refuses a team that already complies with a group's Definition of Done", async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'PRODUCT_OWNER' } as never);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: TEAM_ID,
        groupId: 'group-9',
      } as never);

      await expect(
        teamGroupService.joinGroup(TEAM_ID, PO_ID, { groupId: GROUP_ID, acknowledgedDodVersion: 3 })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.TEAM_GROUP_ALREADY_MEMBER,
      });
    });

    it('refuses an adoption whose named version is not the one in force', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'PRODUCT_OWNER' } as never);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: TEAM_ID, groupId: null } as never);

      await expect(
        teamGroupService.joinGroup(TEAM_ID, PO_ID, { groupId: GROUP_ID, acknowledgedDodVersion: 2 })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED,
      });
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it('refuses an adoption that names no version at all', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'PRODUCT_OWNER' } as never);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: TEAM_ID, groupId: null } as never);

      await expect(
        teamGroupService.joinGroup(TEAM_ID, PO_ID, { groupId: GROUP_ID })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED,
      });
    });

    it('records the version the team adopted, so compliance is an act and not a claim', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'PRODUCT_OWNER' } as never);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: TEAM_ID, groupId: null } as never);

      const summary = await teamGroupService.joinGroup(TEAM_ID, PO_ID, {
        groupId: GROUP_ID,
        acknowledgedDodVersion: 3,
      });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: TEAM_ID },
        data: {
          groupId: GROUP_ID,
          groupJoinedAt: expect.any(Date),
          groupDodVersionAtJoin: 3,
          updatedBy: PO_ID,
        },
      });
      // The group now has one more team complying with the same Definition of Done.
      expect(summary.teamCount).toBe(3);
    });
  });

  describe('leaveGroup', () => {
    it('keeps the Definition of Done the team complied with, then clears the membership', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'PRODUCT_OWNER' } as never);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: TEAM_ID,
        name: 'Team A',
        groupId: GROUP_ID,
      } as never);

      await teamGroupService.leaveGroup(TEAM_ID, PO_ID);

      expect(definitionOfDoneService.adoptDefinitionOfDoneAsOwn).toHaveBeenCalledWith(
        TEAM_ID,
        [
          { description: 'Reviewed', category: 'review', isActive: true, order: 0 },
          { description: 'Tested', category: 'testing', isActive: true, order: 1 },
        ],
        PO_ID
      );
      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: TEAM_ID },
        data: {
          groupId: null,
          groupJoinedAt: null,
          groupDodVersionAtJoin: null,
          updatedBy: PO_ID,
        },
      });
    });

    it('refuses a team that is not in a group', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ role: 'PRODUCT_OWNER' } as never);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: TEAM_ID,
        name: 'Team A',
        groupId: null,
      } as never);

      await expect(teamGroupService.leaveGroup(TEAM_ID, PO_ID)).rejects.toThrow(
        'does not work in a group'
      );
      expect(definitionOfDoneService.adoptDefinitionOfDoneAsOwn).not.toHaveBeenCalled();
    });
  });
});
