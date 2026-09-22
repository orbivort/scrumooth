import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { vi } from 'vitest';

import { definitionService } from '../../../../services';
import { DefinitionOfReadyPanel } from './DefinitionOfReadyPanel';

vi.mock('../../../../store', () => {
  const mockFn = vi.fn();
  return {
    __esModule: true,
    default: mockFn,
    useTeamStore: mockFn,
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

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
};

describe('DefinitionOfReadyPanel', () => {
  let useTeamStoreMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    initTestI18n();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    useTeamStoreMock = (await import('../../../../store')).default;
    useTeamStoreMock.mockReturnValue({
      currentTeam: mockTeam,
      // The readiness agreement is the team's Scrum Master's to maintain, which is what its
      // published contract promises and what the service enforces.
      userRoleInCurrentTeam: 'SCRUM_MASTER',
    });
  });

  it('should render loading state initially', () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    renderWithProviders(<DefinitionOfReadyPanel />);
    expect(screen.getByText(/Loading Definition of Ready.../)).toBeInTheDocument();
  });

  it('should render error state when API fails', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockRejectedValue(new Error('Failed'));
    renderWithProviders(<DefinitionOfReadyPanel />);
    expect(await screen.findByText('Failed to load Definition of Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should render empty state when no items', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
    renderWithProviders(<DefinitionOfReadyPanel />);
    expect(
      await screen.findByText('No Definition of Ready configured for this team yet.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure DoR' })).toBeInTheDocument();
  });

  it('should render definition items when available', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'dor-1',
        teamId: 'team-1',
        items: [
          {
            id: 'item-1',
            description: 'Test item 1',
            category: 'clarity',
            isActive: true,
            order: 0,
          },
          {
            id: 'item-2',
            description: 'Test item 2',
            category: 'acceptance',
            isActive: true,
            order: 1,
          },
        ],
        version: 1,
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });
    renderWithProviders(<DefinitionOfReadyPanel />);
    expect(await screen.findByText('Test item 1')).toBeInTheDocument();
    expect(screen.getByText('Test item 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit DoR' })).toBeInTheDocument();
  });

  it('should switch to edit mode when edit button clicked', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'dor-1',
        teamId: 'team-1',
        items: [
          {
            id: 'item-1',
            description: 'Test item',
            category: 'clarity',
            isActive: true,
            order: 0,
          },
        ],
        version: 1,
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });
    renderWithProviders(<DefinitionOfReadyPanel />);
    const editButton = await screen.findByRole('button', { name: 'Edit DoR' });
    fireEvent.click(editButton);
    expect(screen.getByTestId('definition-editor')).toBeInTheDocument();
  });

  it('should show "No Team Selected" when no team', async () => {
    useTeamStoreMock.mockReturnValue({ currentTeam: null });
    renderWithProviders(<DefinitionOfReadyPanel />);
    expect(
      await screen.findByText('Please select a team to view Definition of Ready.')
    ).toBeInTheDocument();
  });

  it('should label the agreement as a complementary practice rather than a Guide artifact', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'dor-1',
        teamId: 'team-1',
        items: [{ id: 'item-1', description: 'Test item', isActive: true, order: 0 }],
        version: 1,
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });

    renderWithProviders(<DefinitionOfReadyPanel />);

    // A team has to be able to tell the Guide's commitments from this product's own: the readiness
    // agreement is enforced, but it is not one of the three artifacts of the 2020 Scrum Guide.
    expect(
      await screen.findByText(/Complementary practice, not a Guide artifact/i)
    ).toBeInTheDocument();
  });

  it('should keep the edit affordance from a member who is not the Scrum Master', async () => {
    useTeamStoreMock.mockReturnValue({
      currentTeam: mockTeam,
      userRoleInCurrentTeam: 'DEVELOPERS',
    });
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'dor-1',
        teamId: 'team-1',
        items: [{ id: 'item-1', description: 'Test item', isActive: true, order: 0 }],
        version: 1,
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });

    renderWithProviders(<DefinitionOfReadyPanel />);

    expect(await screen.findByText('Test item')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit DoR' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/The team's Scrum Master maintains this agreement/i)
    ).toBeInTheDocument();
  });
});
