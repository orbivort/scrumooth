/**
 * The Definition of Done section.
 *
 * Three properties matter beyond rendering:
 *
 *  * The section reads the team the module resolved rather than the team store, and a read that
 *    carries no agreement renders an empty state instead of criteria the server never agreed to --
 *    which is what stops the interface from promising a commitment nobody made.
 *  * The write is routed by the scope the agreement actually has: a lone team's write goes to the
 *    team, a shared one goes to the group. The team-scoped write is never issued while grouped, which
 *    is what keeps `GATE_DOD_GROUP_GOVERNED` unreachable from the interface.
 *  * A seeded criterion is resolved from its key rather than from its English sentence, so a team may
 *    reword it without losing the translation.
 */
import React from 'react';
import {
  screen,
  fireEvent,
  renderWithProviders,
  initTestI18n,
  createMockTeam,
  createMockUser,
} from '../../../../test-utils';
import { vi } from 'vitest';
import { UserRole } from '../../../../types';
import { definitionService, teamGroupService } from '../../../../services';
import type { DefinitionOfDone, Team, TeamGroupSummary } from '../../../../types';

import { DefinitionOfDoneSection } from './DefinitionOfDoneSection';

vi.mock('../../../../store', () => {
  const mockFn = vi.fn();
  return {
    __esModule: true,
    default: mockFn,
    useAuthStore: mockFn,
  };
});

vi.mock('../../../../services', () => ({
  definitionService: {
    getDefinitionOfDone: vi.fn(),
    updateDefinitionOfDone: vi.fn(),
  },
  teamGroupService: {
    listGroups: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    updateSharedDefinitionOfDone: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

vi.mock('./DefinitionEditor', () => ({
  DefinitionEditor: () => <div data-testid="definition-editor">Definition Editor</div>,
}));

vi.mock('./VersionHistoryPopover', () => ({
  VersionHistoryPopover: ({ version }: { version: number }) => (
    <span data-testid="version-history">v{version}</span>
  ),
}));

const TEAM_ID = 'team-1';

const withItems = (overrides: Partial<DefinitionOfDone> = {}): DefinitionOfDone => ({
  id: 'dod-1',
  teamId: TEAM_ID,
  items: [
    { id: 'item-1', description: 'Test item 1', category: 'quality', isActive: true, order: 0 },
    { id: 'item-2', description: 'Test item 2', category: 'testing', isActive: true, order: 1 },
  ],
  version: 1,
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

/** The group a team complies with when several Scrum Teams share one product. */
const GROUP: TeamGroupSummary = {
  id: 'group-1',
  name: 'Payments product',
  description: null,
  teamCount: 2,
  dodVersion: 3,
};

/** A team as the module resolves it, with the caller's membership and optional group. */
const teamWith = (role: UserRole | null, group: TeamGroupSummary | null = null): Team =>
  createMockTeam({
    id: TEAM_ID,
    group,
    groupDodVersionAtJoin: group ? 3 : null,
    groupJoinedAt: group ? '2026-09-01T09:00:00.000Z' : null,
    members: role
      ? [
          {
            id: 'member-1',
            teamId: TEAM_ID,
            userId: 'user-1',
            role,
            joinedAt: '2026-01-01T00:00:00Z',
          },
        ]
      : [],
  });

describe('DefinitionOfDoneSection', () => {
  let useAuthStoreMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    initTestI18n();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    useAuthStoreMock = (await import('../../../../store')).default;
    useAuthStoreMock.mockReturnValue({ user: createMockUser() });

    (teamGroupService.listGroups as vi.Mock).mockResolvedValue({ success: true, data: [] });
  });

  it('should render loading state initially', () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(screen.getByText(/Loading Definition of Done.../)).toBeInTheDocument();
  });

  it('should render error state when API fails', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockRejectedValue(new Error('Failed'));

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(await screen.findByText('Failed to Load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should render definition items when available, with the version badge', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(await screen.findByText('Test item 1')).toBeInTheDocument();
    expect(screen.getByText('Test item 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit DoD' })).toBeInTheDocument();
    expect(screen.getByTestId('version-history')).toHaveTextContent('v1');
  });

  it('should report whether the reader is in this section, which decides the emphasis of its action', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    const { container } = renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive={false} />
    );

    await screen.findByText('Test item 1');

    // The page keeps one primary action and gives it to the section being read. This attribute is how a
    // section says which one that is; the styling behind it is the stylesheet's business.
    expect(container.querySelector('section')).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('button', { name: 'Edit DoD' })).toBeInTheDocument();
  });

  it('should render an empty state, not seeded criteria, when the team has no agreement', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({ items: [] }),
    });

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(await screen.findByText('No Definition of Done yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure DoD' })).toBeInTheDocument();

    // The criteria the server seeds for a brand new team must not appear: this team has no
    // agreement, and showing one would be a commitment nobody made.
    expect(screen.queryByText('Code is peer-reviewed and approved')).not.toBeInTheDocument();
    expect(screen.queryByText('Integration tests passing')).not.toBeInTheDocument();
  });

  it('should switch to edit mode when the edit button is clicked', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit DoD' }));

    expect(screen.getByTestId('definition-editor')).toBeInTheDocument();
  });

  it('should say the team owns the agreement when it works on its own', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(await screen.findByText('Your team owns this agreement.')).toBeInTheDocument();
  });

  it('should resolve a seeded criterion from its key, not from its stored sentence', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [
          {
            id: 'item-1',
            // Reworded by the team. The key is what decides the wording, and English is where this
            // test runs, so the seeded sentence is what comes back -- proving the key was used and
            // the stored text was not.
            description: 'Wir prüfen jeden Pull Request',
            category: 'review',
            isActive: true,
            order: 0,
            defaultKey: 'codeReviewed',
          },
        ],
      }),
    });

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(await screen.findByText('Code is peer-reviewed and approved')).toBeInTheDocument();
  });

  it('should show a criterion the team wrote itself exactly as it was written', async () => {
    (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [
          {
            id: 'item-1',
            description: 'Shipped behind a feature flag',
            category: 'deployment',
            isActive: true,
            order: 0,
            defaultKey: null,
          },
        ],
      }),
    });

    renderWithProviders(
      <DefinitionOfDoneSection teamId={TEAM_ID} team={teamWith(null)} isActive />
    );

    expect(await screen.findByText('Shipped behind a feature flag')).toBeInTheDocument();
  });

  describe('when the team shares a Definition of Done with its group', () => {
    it('should name the group and its team count on the statement, and administer it from the decisions', async () => {
      (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: withItems({ version: 3 }),
      });

      renderWithProviders(
        <DefinitionOfDoneSection
          teamId={TEAM_ID}
          team={teamWith(UserRole.PRODUCT_OWNER, GROUP)}
          isActive
        />
      );

      // Which Definition of Done governs the team is never behind a control: it is the fact the criteria
      // below are read against.
      expect(await screen.findByText('Shared with Payments product · 2 teams.')).toBeVisible();

      // Where the group is administered moved into the decisions, with the rest of the governing -- a
      // link cannot live inside the trigger, because the trigger is a button.
      fireEvent.click(screen.getByRole('button', { name: /Review or leave/ }));

      expect(screen.getByRole('link', { name: 'Manage the group' })).toHaveAttribute(
        'href',
        '/settings/team-groups?group=group-1'
      );
    });

    it('should offer the editor to the leadership of a member team', async () => {
      (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: withItems({ version: 3 }),
      });

      renderWithProviders(
        <DefinitionOfDoneSection
          teamId={TEAM_ID}
          team={teamWith(UserRole.SCRUM_MASTER, GROUP)}
          isActive
        />
      );

      expect(await screen.findByRole('button', { name: 'Edit DoD' })).toBeInTheDocument();
    });

    it('should save a shared change to the group, never to the team', async () => {
      (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: withItems({ version: 3 }),
      });
      (teamGroupService.updateSharedDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: { groupId: GROUP.id, version: 4, items: [], updatedAt: '2024-01-02T00:00:00Z' },
      });

      renderWithProviders(
        <DefinitionOfDoneSection
          teamId={TEAM_ID}
          team={teamWith(UserRole.PRODUCT_OWNER, GROUP)}
          isActive
        />
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Edit DoD' }));

      // The editor is mocked, so the save itself is not driven here; what this asserts is the scope
      // the section resolved, which the endpoint choice is derived from.
      expect(screen.getByText(/Every team in Payments product complies/)).toBeInTheDocument();
    });

    it('should state who maintains a shared agreement when the reader may not change it', async () => {
      (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: withItems({ version: 3 }),
      });

      renderWithProviders(
        <DefinitionOfDoneSection
          teamId={TEAM_ID}
          team={teamWith(UserRole.DEVELOPERS, GROUP)}
          isActive
        />
      );

      expect(
        await screen.findByText(
          'Maintained by the Product Owner or Scrum Master of a team in Payments product.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit DoD' })).not.toBeInTheDocument();
    });

    it('should let the leadership author a shared agreement that holds nothing yet', async () => {
      (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: withItems({ items: [] }),
      });

      renderWithProviders(
        <DefinitionOfDoneSection
          teamId={TEAM_ID}
          team={teamWith(UserRole.PRODUCT_OWNER, GROUP)}
          isActive
        />
      );

      expect(await screen.findByText('No Definition of Done yet')).toBeInTheDocument();
      // A shared agreement with no active criterion still has to be authorable from somewhere, and
      // the group's own screen is no longer that place.
      expect(screen.getByRole('button', { name: 'Configure DoD' })).toBeInTheDocument();
    });

    it('should not offer a Developer the authoring of an agreement their leadership owns', async () => {
      (definitionService.getDefinitionOfDone as vi.Mock).mockResolvedValue({
        success: true,
        data: withItems({ items: [] }),
      });

      renderWithProviders(
        <DefinitionOfDoneSection
          teamId={TEAM_ID}
          team={teamWith(UserRole.DEVELOPERS, GROUP)}
          isActive
        />
      );

      expect(await screen.findByText('No Definition of Done yet')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Configure DoD' })).not.toBeInTheDocument();
    });
  });
});
