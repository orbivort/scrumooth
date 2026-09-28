/**
 * The Definition of Ready section.
 *
 * The readiness agreement is a complementary practice that its published contract assigns to the
 * team's Scrum Master, so the affordance follows the role rather than offering an action the service
 * would refuse. The compliance explanation is a disclosure rather than a paragraph, so the criteria
 * stay the content of the section.
 */
import React from 'react';
import {
  screen,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
} from '../../../../test-utils';
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
  DefinitionEditor: ({
    onSave,
    onCancel,
  }: {
    onSave: (items: unknown[]) => Promise<void>;
    onCancel: () => void;
  }) => (
    <div data-testid="definition-editor">
      Definition Editor
      <button
        type="button"
        onClick={() =>
          // The refusal is surfaced through the section's own mutation `onError`; swallowing the
          // rejected promise here only stops the stand-in from leaking an unhandled rejection.
          void onSave([
            {
              id: 'item-1',
              description: 'Saved criterion',
              category: 'clarity',
              isActive: true,
              order: 0,
            },
          ]).catch(() => undefined)
        }
      >
        save-editor
      </button>
      <button type="button" onClick={onCancel}>
        cancel-editor
      </button>
    </div>
  ),
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

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    expect(screen.getByText(/Loading Definition of Ready.../)).toBeInTheDocument();
  });

  it('should render error state when API fails', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockRejectedValue(new Error('Failed'));

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    expect(await screen.findByText('Failed to load Definition of Ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('should render empty state when no items', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: null,
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

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

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    expect(await screen.findByText('Test item 1')).toBeInTheDocument();
    expect(screen.getByText('Test item 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit DoR' })).toBeInTheDocument();
    // The readiness agreement keeps its versions too, so its badge opens them like the DoD's.
    expect(screen.getByTestId('version-history')).toHaveTextContent('v1');
  });

  // The save writes the team's sentence; the list has to show it. Resolving the built-in key instead
  // made a reworded criterion read as the seeded one, so a successful edit looked like a save that had
  // not happened -- the failure this surface was reported for.
  it('should show a seeded criterion the team reworded as the team wrote it', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [
          {
            id: 'item-1',
            description: 'Titel und Beschreibung mit dem Product Owner abgestimmt',
            category: 'acceptance',
            isActive: true,
            order: 0,
            defaultKey: 'clearTitle',
          },
        ],
      }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    expect(
      await screen.findByText('Titel und Beschreibung mit dem Product Owner abgestimmt')
    ).toBeInTheDocument();
    expect(screen.queryByText('Clear title and description provided')).not.toBeInTheDocument();
  });

  it('should show a seeded criterion the team left alone in the seeded wording', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({
        items: [
          {
            id: 'item-1',
            description: 'Clear title and description provided',
            category: 'acceptance',
            isActive: true,
            order: 0,
            defaultKey: 'clearTitle',
          },
        ],
      }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

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

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit DoR' }));

    expect(screen.getByTestId('definition-editor')).toBeInTheDocument();
  });

  it('should render an empty state, not seeded criteria, when the team has not configured readiness', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({ items: [] }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

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

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

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

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    expect(await screen.findByText('Test item')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit DoR' })).not.toBeInTheDocument();
    // Matched exactly, so this asserts the note that stands in for the affordance rather than the
    // longer explanation behind the disclosure.
    expect(
      screen.getByText("The team's Scrum Master maintains this agreement.")
    ).toBeInTheDocument();
  });
});

describe('DefinitionOfReadySection - save and recovery flows', () => {
  let useTeamStoreMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    initTestI18n();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    useTeamStoreMock = (await import('../../../../store')).default;
    useTeamStoreMock.mockReturnValue({ userRoleInCurrentTeam: 'SCRUM_MASTER' });
  });

  it('saves the readiness agreement and closes the editor on success', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });
    (definitionService.updateDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit DoR' }));
    fireEvent.click(screen.getByText('save-editor'));

    await waitFor(() => {
      expect(definitionService.updateDefinitionOfReady).toHaveBeenCalledWith(
        TEAM_ID,
        expect.any(Array)
      );
    });
  });

  it('leaves the editor without saving when the edit is cancelled', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit DoR' }));
    fireEvent.click(screen.getByText('cancel-editor'));

    await waitFor(() => {
      expect(screen.queryByTestId('definition-editor')).not.toBeInTheDocument();
    });
    expect(definitionService.updateDefinitionOfReady).not.toHaveBeenCalled();
  });

  it('retries a read that failed', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockRejectedValue(new Error('Failed'));

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    const retry = await screen.findByRole('button', { name: 'Retry' });
    fireEvent.click(retry);

    await waitFor(() => {
      expect(definitionService.getDefinitionOfReady).toHaveBeenCalledTimes(2);
    });
  });

  it('opens the editor from an unconfigured agreement', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems({ items: [] }),
    });

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Configure DoR' }));

    expect(screen.getByTestId('definition-editor')).toBeInTheDocument();
  });

  it('renders a save refusal in place and lets it be dismissed', async () => {
    (definitionService.getDefinitionOfReady as vi.Mock).mockResolvedValue({
      success: true,
      data: withItems(),
    });
    (definitionService.updateDefinitionOfReady as vi.Mock).mockRejectedValue(
      new Error('Only the Scrum Master may change this.')
    );

    renderWithProviders(<DefinitionOfReadySection teamId={TEAM_ID} isActive />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit DoR' }));
    fireEvent.click(screen.getByText('save-editor'));

    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismiss);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    });
  });
});
