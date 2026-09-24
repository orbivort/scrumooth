/**
 * The Definition of Ready section.
 *
 * The readiness agreement is a complementary practice that its published contract assigns to the
 * team's Scrum Master, so the affordance follows the role rather than offering an action the service
 * would refuse. The compliance explanation is a disclosure rather than a paragraph, so the criteria
 * stay the content of the section.
 */
import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { vi } from 'vitest';

import { definitionService } from '../../../../services';
import type { DefinitionOfReady } from '../../../../types';

import { DefinitionOfReadySection } from './DefinitionOfReadySection';

// `useAuthStore` is part of this mock because the gate renderer reads a refusal through
// `useApiError`, which is where the session's error and logout live. Mocking only the store the
// section reads directly would make the shared renderer's dependency invisible.
vi.mock('../../../../store', () => {
  const mockFn = vi.fn();
  return {
    __esModule: true,
    default: mockFn,
    useTeamStore: mockFn,
    useAuthStore: () => ({ error: null, setError: vi.fn(), logout: vi.fn() }),
  };
});

vi.mock('../../../../services', () => ({
  definitionService: {
    getDefinitionOfReady: vi.fn(),
    updateDefinitionOfReady: vi.fn(),
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

const withItems = (overrides: Partial<DefinitionOfReady> = {}): DefinitionOfReady => ({
  id: 'dor-1',
  teamId: TEAM_ID,
  items: [
    { id: 'item-1', description: 'Test item 1', category: 'clarity', isActive: true, order: 0 },
    { id: 'item-2', description: 'Test item 2', category: 'acceptance', isActive: true, order: 1 },
  ],
  version: 1,
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('DefinitionOfReadySection', () => {
  let useTeamStoreMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    initTestI18n();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    useTeamStoreMock = (await import('../../../../store')).default;
    useTeamStoreMock.mockReturnValue({
      // The readiness agreement is the team's Scrum Master's to maintain, which is what its
      // published contract promises and what the service enforces.
      userRoleInCurrentTeam: 'SCRUM_MASTER',
    });
  });

  it('should render loading state initially', () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(screen.getByText(/Loading Definition of Ready.../)).toBeInTheDocument();
  });

  it('should render error state when API fails', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockRejectedValue(new Error('Failed'));

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(await screen.findByText('Failed to load Definition of Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should render empty state when no items', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: null,
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(
      await screen.findByText('No Definition of Ready configured for this team yet.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure DoR' })).toBeInTheDocument();
  });

  it('should render definition items when available', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(await screen.findByText('Test item 1')).toBeInTheDocument();
    expect(screen.getByText('Test item 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit DoR' })).toBeInTheDocument();
    // The readiness agreement keeps its versions too, so its badge opens them like the DoD's.
    expect(screen.getByTestId('version-history')).toHaveTextContent('v1');
  });

  it('should resolve a seeded readiness criterion from its key, not from its stored sentence', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [
          {
            id: 'item-1',
            description: 'Titel und Beschreibung sind klar',
            category: 'acceptance',
            isActive: true,
            order: 0,
            defaultKey: 'clearTitle',
          },
        ],
      }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(await screen.findByText('Clear title and description provided')).toBeInTheDocument();
  });

  it('should switch to edit mode when the edit button is clicked', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [
          { id: 'item-1', description: 'Test item', category: 'clarity', isActive: true, order: 0 },
        ],
      }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit DoR' }));

    expect(screen.getByTestId('definition-editor')).toBeInTheDocument();
  });

  it('should render an empty state, not seeded criteria, when the team has not configured readiness', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({ items: [] }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(
      await screen.findByText('No Definition of Ready configured for this team yet.')
    ).toBeInTheDocument();
    // The seeded readiness criteria must not stand in for an agreement this team never declared.
    expect(screen.queryByText('User story clearly written')).not.toBeInTheDocument();
  });

  // A team has to be able to tell the Guide's commitments from this product's own: the readiness
  // agreement is enforced, but it is not one of the three artifacts of the 2020 Scrum Guide.
  it('should label the agreement as a complementary practice, collapsed until it is asked for', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [{ id: 'item-1', description: 'Test item', isActive: true, order: 0 }],
      }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    const toggle = await screen.findByRole('button', {
      name: /Complementary practice, not a Guide artifact/i,
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('dor-practice-detail')).toHaveAttribute('hidden');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('dor-practice-detail')).not.toHaveAttribute('hidden');
  });

  it('should keep the edit affordance from a member who is not the Scrum Master', async () => {
    useTeamStoreMock.mockReturnValue({ userRoleInCurrentTeam: 'DEVELOPERS' });
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [{ id: 'item-1', description: 'Test item', isActive: true, order: 0 }],
      }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} />);

    expect(await screen.findByText('Test item')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit DoR' })).not.toBeInTheDocument();
    // Matched exactly, so this asserts the note that stands in for the affordance rather than the
    // longer explanation behind the disclosure.
    expect(
      screen.getByText("The team's Scrum Master maintains this agreement.")
    ).toBeInTheDocument();
  });
});
