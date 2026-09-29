import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { renderWithProviders, initTestI18n } from '../../../test-utils';
import { apiService } from '../../../services';
import { definitionService } from '../../../services/domain/definition.service';
import { RetrospectiveStatus, type SprintRetrospective } from '../../../types';
import { DodInspection } from './DodInspection';

vi.mock('../../../services', () => ({
  apiService: {
    updateRetrospective: vi.fn(),
    applyDodChanges: vi.fn(),
  },
}));

vi.mock('../../../services/domain/definition.service', () => ({
  definitionService: {
    getDefinitionOfDone: vi.fn(),
  },
}));

const buildRetrospective = (overrides: Partial<SprintRetrospective> = {}): SprintRetrospective =>
  ({
    id: 'retro-1',
    sprintId: 'sprint-1',
    teamId: 'team-1',
    retroDate: '2024-02-01T10:00:00Z',
    facilitatorId: 'user-1',
    status: RetrospectiveStatus.IN_PROGRESS,
    participants: [],
    attendees: [],
    items: [],
    actionItems: [],
    isAnonymous: false,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
    ...overrides,
  }) as SprintRetrospective;

const mockDod = (items: Array<{ id: string; description: string }>) => {
  (definitionService.getDefinitionOfDone as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: {
      id: 'dod-1',
      teamId: 'team-1',
      version: 3,
      updatedAt: '2024-01-01T00:00:00Z',
      items: items.map((item, index) => ({
        ...item,
        isActive: true,
        order: index,
        category: 'quality',
      })),
    },
  });
};

describe('DodInspection', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDod([
      { id: 'dod-1', description: 'Code is peer-reviewed' },
      { id: 'dod-2', description: 'Unit tests pass' },
    ]);
    (apiService.updateRetrospective as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: buildRetrospective(),
    });
    (apiService.applyDodChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: buildRetrospective({ dodVersionAtPush: 4 }),
    });
  });

  describe('Inspection', () => {
    it("should put the team's Definition of Done criteria in the room, kept by default", async () => {
      renderWithProviders(<DodInspection retrospective={buildRetrospective()} readOnly={false} />);

      await waitFor(() => {
        expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();
      });

      expect(screen.getByText('Unit tests pass')).toBeInTheDocument();
      expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(2);
      expect(screen.getByText('Definition of Done v3')).toBeInTheDocument();
    });

    it('should ask for the new wording when a criterion is changed', async () => {
      renderWithProviders(<DodInspection retrospective={buildRetrospective()} readOnly={false} />);

      await waitFor(() => {
        expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByRole('radio', { name: 'Change' })[0]!);

      expect(screen.getByLabelText(/New wording/)).toBeInTheDocument();
      // Applying an incomplete change would record a decision that cannot be carried out.
      expect(screen.getByText('Apply to Definition of Done').closest('button')).toBeDisabled();
    });

    it('should let the team propose a criterion it does not have yet', async () => {
      renderWithProviders(<DodInspection retrospective={buildRetrospective()} readOnly={false} />);

      await waitFor(() => {
        expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();
      });

      await userEvent.type(
        screen.getByLabelText('A criterion the team should add'),
        'Deployed to staging'
      );
      await userEvent.click(screen.getByText('Add criterion'));

      expect(screen.getByText('Deployed to staging')).toBeInTheDocument();
    });
  });

  describe('Saving the reflection', () => {
    it('should persist the decisions and the narrative', async () => {
      renderWithProviders(<DodInspection retrospective={buildRetrospective()} readOnly={false} />);

      await waitFor(() => {
        expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByRole('radio', { name: 'Retire' })[0]!);
      await userEvent.type(
        screen.getByLabelText(/What the team concluded/),
        'Manual sign-off no longer catches anything'
      );
      await userEvent.click(screen.getByText('Save reflection'));

      await waitFor(() => {
        expect(apiService.updateRetrospective).toHaveBeenCalledWith(
          'retro-1',
          expect.objectContaining({
            dodEvolutionNotes: 'Manual sign-off no longer catches anything',
            dodReflections: [
              expect.objectContaining({ dodItemId: 'dod-1', decision: 'RETIRE' }),
              expect.objectContaining({ dodItemId: 'dod-2', decision: 'KEEP' }),
            ],
          })
        );
      });
    });
  });

  describe('Applying the accepted changes', () => {
    it('should preview the diff, then persist the reflection before applying it', async () => {
      renderWithProviders(<DodInspection retrospective={buildRetrospective()} readOnly={false} />);

      await waitFor(() => {
        expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByRole('radio', { name: 'Retire' })[0]!);
      await userEvent.click(screen.getByText('Apply to Definition of Done'));

      // The diff is shown before anything is written: the retired criterion now appears twice, in
      // the list and in the preview.
      expect(apiService.updateRetrospective).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getAllByText('Code is peer-reviewed')).toHaveLength(2);

      await userEvent.click(screen.getByText('Apply changes'));

      await waitFor(() => {
        expect(apiService.updateRetrospective).toHaveBeenCalled();
        expect(apiService.applyDodChanges).toHaveBeenCalledWith('retro-1');
      });
    });
  });

  describe('A completed Retrospective', () => {
    it('should show what was decided without offering to change it', async () => {
      renderWithProviders(
        <DodInspection
          retrospective={buildRetrospective({
            status: RetrospectiveStatus.COMPLETED,
            dodReflections: [
              {
                dodItemId: 'dod-1',
                description: 'Code is peer-reviewed',
                decision: 'RETIRE',
              },
            ],
            dodVersionAtPush: 4,
          })}
          readOnly
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();
      });

      expect(screen.getByText('Adopted v4')).toBeInTheDocument();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.queryByText('Apply to Definition of Done')).not.toBeInTheDocument();
    });
  });
});
