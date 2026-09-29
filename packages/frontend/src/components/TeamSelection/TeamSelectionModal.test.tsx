import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  screen,
  fireEvent,
  waitFor,
  act,
  renderWithProviders,
  initTestI18n,
} from '../../test-utils';
import userEvent from '@testing-library/user-event';

import { TeamSelectionModal } from './TeamSelectionModal';
import { useTeamContext } from '../../contexts/TeamContext';

vi.mock('../../contexts/TeamContext', () => ({
  useTeamContext: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('./TeamSelectionModal.module.css', () => ({
  default: {
    'team-selection-overlay': 'team-selection-overlay',
    'team-selection-modal': 'team-selection-modal',
    'team-selection-header': 'team-selection-header',
    'close-button': 'close-button',
    'team-selection-content': 'team-selection-content',
    'loading-state': 'loading-state',
    spinner: 'spinner',
    'empty-state': 'empty-state',
    'team-list': 'team-list',
    'team-card': 'team-card',
    'team-card-switching': 'team-card-switching',
    'team-card-content': 'team-card-content',
    'team-info': 'team-info',
    'team-name': 'team-name',
    'team-description': 'team-description',
    'role-badge': 'role-badge',
    'badge-po': 'badge-po',
    'badge-sm': 'badge-sm',
    'badge-dev': 'badge-dev',
    'badge-default': 'badge-default',
    'switching-indicator': 'switching-indicator',
    'spinner-small': 'spinner-small',
  },
}));

const mockTeamContext = {
  currentTeam: null,
  userRole: null,
  userTeams: [],
  isLoading: false,
  error: null,
  switchTeam: vi.fn(),
  refreshTeams: vi.fn(),
  hasMultipleTeams: false,
};

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'Test team description',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
  userRole: 'DEVELOPERS',
};

const mockTeam2 = {
  id: 'team-2',
  name: 'Second Team',
  description: 'Second team description',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
  userRole: 'PRODUCT_OWNER',
};

const mockTeam3 = {
  id: 'team-3',
  name: 'Third Team',
  description: 'Third team description',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
  userRole: 'SCRUM_MASTER',
};

describe('TeamSelectionModal Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTeamContext).mockReturnValue(mockTeamContext);
  });

  describe('Component Rendering Tests', () => {
    it('renders nothing when isOpen is false', () => {
      renderWithProviders(<TeamSelectionModal isOpen={false} onClose={vi.fn()} />);

      expect(screen.queryByText('Select a Team')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Select a Team')).toBeInTheDocument();
    });

    it('renders close button', () => {
      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('renders modal overlay', () => {
      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.team-selection-overlay')).toBeInTheDocument();
    });

    it('renders modal container', () => {
      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.team-selection-modal')).toBeInTheDocument();
    });

    it('renders header section', () => {
      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.team-selection-header')).toBeInTheDocument();
    });

    it('renders content section', () => {
      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.team-selection-content')).toBeInTheDocument();
    });
  });

  describe('Loading State Tests', () => {
    it('renders loading state when isLoading is true', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: true,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Loading teams...')).toBeInTheDocument();
    });

    it('renders spinner when loading', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: true,
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });

    it('does not render team list when loading', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: true,
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.team-list')).not.toBeInTheDocument();
    });
  });

  describe('Empty State Tests', () => {
    it('renders empty state when no teams available', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText("You don't have any teams yet.")).toBeInTheDocument();
    });

    it('renders "Go to Team Page" button when no teams', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Go to Team Page')).toBeInTheDocument();
    });

    it('calls onClose when "Go to Team Page" button is clicked', async () => {
      const onClose = vi.fn();
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={onClose} />);

      const button = screen.getByText('Go to Team Page');
      await userEvent.click(button);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Team List Rendering Tests', () => {
    it('renders team list when teams are available', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      expect(container.querySelector('.team-list')).toBeInTheDocument();
    });

    it('renders all teams in the list', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2, mockTeam3],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Test Team')).toBeInTheDocument();
      expect(screen.getByText('Second Team')).toBeInTheDocument();
      expect(screen.getByText('Third Team')).toBeInTheDocument();
    });

    it('renders team names correctly', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    it('renders team descriptions when available', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Test team description')).toBeInTheDocument();
    });

    it('does not render description when not available', () => {
      const teamWithoutDescription = { ...mockTeam, description: undefined };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithoutDescription],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.queryByText('Test team description')).not.toBeInTheDocument();
    });

    it('renders team cards for each team', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2],
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const teamCards = container.querySelectorAll('.team-card');
      expect(teamCards).toHaveLength(2);
    });
  });

  describe('Role Badge Rendering Tests', () => {
    it('renders DEVELOPERS role badge correctly', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Developers')).toBeInTheDocument();
    });

    it('renders PRODUCT_OWNER role badge correctly', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam2],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Product Owner')).toBeInTheDocument();
    });

    it('renders SCRUM_MASTER role badge correctly', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam3],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Scrum Master')).toBeInTheDocument();
    });

    it('renders default role badge for unknown roles', () => {
      const teamWithUnknownRole = { ...mockTeam, userRole: 'UNKNOWN_ROLE' };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithUnknownRole],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('UNKNOWN_ROLE')).toBeInTheDocument();
    });

    it('applies correct badge class for DEVELOPERS role', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const badge = container.querySelector('.badge-dev');
      expect(badge).toBeInTheDocument();
    });

    it('applies correct badge class for PRODUCT_OWNER role', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam2],
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const badge = container.querySelector('.badge-po');
      expect(badge).toBeInTheDocument();
    });

    it('applies correct badge class for SCRUM_MASTER role', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam3],
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const badge = container.querySelector('.badge-sm');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('User Interaction Tests', () => {
    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close');
      await userEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls switchTeam when team card is clicked', async () => {
      const switchTeam = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
        switchTeam,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        expect(switchTeam).toHaveBeenCalledWith('team-1');
      });
    });

    it('disables all team cards while switching', async () => {
      // Use a manually-resolved deferred so the intermediate "switching" state is
      // deterministic and does not depend on real timer timing (which was flaky).
      let resolveSwitch = () => {};
      const switchTeam = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSwitch = resolve;
          })
      );
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2],
        switchTeam,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        buttons.forEach((button) => {
          if (button.textContent?.includes('Team')) {
            expect(button).toBeDisabled();
          }
        });
      });

      // Let the pending switch settle so the component's state is cleaned up.
      await act(async () => {
        resolveSwitch();
      });
    });

    it('shows switching indicator on selected team', async () => {
      // Use a manually-resolved deferred so the intermediate "switching" state is
      // deterministic and does not depend on real timer timing (which was flaky).
      let resolveSwitch = () => {};
      const switchTeam = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSwitch = resolve;
          })
      );
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2],
        switchTeam,
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        expect(screen.getByText('Switching...')).toBeInTheDocument();
        expect(container.querySelector('.switching-indicator')).toBeInTheDocument();
      });

      // Let the pending switch settle so the component's state is cleaned up.
      await act(async () => {
        resolveSwitch();
      });
    });

    it('applies switching class to selected team card', async () => {
      // Use a manually-resolved deferred so the intermediate "switching" state is
      // deterministic and does not depend on real timer timing (which was flaky).
      let resolveSwitch = () => {};
      const switchTeam = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSwitch = resolve;
          })
      );
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2],
        switchTeam,
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        const switchingCard = container.querySelector('.team-card-switching');
        expect(switchingCard).toBeInTheDocument();
      });

      // Let the pending switch settle so the component's state is cleaned up.
      await act(async () => {
        resolveSwitch();
      });
    });
  });

  describe('Async Operations Tests', () => {
    it('handles successful team switch', async () => {
      const onClose = vi.fn();
      const switchTeam = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
        switchTeam,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={onClose} />);

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        expect(switchTeam).toHaveBeenCalledWith('team-1');
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('handles failed team switch', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const switchTeam = vi.fn().mockRejectedValue(new Error('Switch failed'));
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
        switchTeam,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('clears switching state after successful switch', async () => {
      const switchTeam = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
        switchTeam,
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        expect(container.querySelector('.team-card-switching')).not.toBeInTheDocument();
      });
    });

    it('clears switching state after failed switch', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const switchTeam = vi.fn().mockRejectedValue(new Error('Switch failed'));
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
        switchTeam,
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const teamCard = screen.getByText('Test Team').closest('button');
      if (teamCard) {
        await userEvent.click(teamCard);
      }

      await waitFor(() => {
        expect(container.querySelector('.team-card-switching')).not.toBeInTheDocument();
      });

      consoleError.mockRestore();
    });
  });

  describe('Accessibility Tests', () => {
    it('has accessible close button', () => {
      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const closeButton = screen.getByLabelText('Close');
      expect(closeButton).toBeInTheDocument();
    });

    it('team cards are keyboard accessible', async () => {
      const user = userEvent.setup();
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const teamCard = screen.getByRole('button', { name: /test team/i });
      teamCard.focus();
      expect(teamCard).toHaveFocus();

      await user.keyboard('{Enter}');
    });

    it('can navigate between team cards with Tab', async () => {
      const user = userEvent.setup();
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      await user.tab();
      expect(screen.getByLabelText('Close')).toHaveFocus();

      await user.tab();
      const firstTeamCard = screen.getByRole('button', { name: /test team/i });
      expect(firstTeamCard).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles team without description', () => {
      const teamWithoutDescription = { ...mockTeam, description: undefined };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithoutDescription],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    it('handles empty team name', () => {
      const teamWithEmptyName = { ...mockTeam, name: '' };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithEmptyName],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const teamCard = screen.queryByRole('button', { name: /developer/i });
      expect(teamCard).toBeInTheDocument();
    });

    it('handles very long team name', () => {
      const longName = 'A'.repeat(200);
      const teamWithLongName = { ...mockTeam, name: longName };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithLongName],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(longName)).toBeInTheDocument();
    });

    it('handles very long team description', () => {
      const longDescription = 'A'.repeat(500);
      const teamWithLongDescription = { ...mockTeam, description: longDescription };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithLongDescription],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it('handles special characters in team name', () => {
      const specialName = 'Team <script>alert("test")</script> & "quotes"';
      const teamWithSpecialChars = { ...mockTeam, name: specialName };
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [teamWithSpecialChars],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(specialName)).toBeInTheDocument();
    });

    it('handles single team', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      const { container } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      const teamCards = container.querySelectorAll('.team-card');
      expect(teamCards).toHaveLength(1);
    });

    it('handles many teams', () => {
      const manyTeams = Array.from({ length: 20 }, (_, i) => ({
        ...mockTeam,
        id: `team-${i}`,
        name: `Team ${i}`,
      }));

      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: manyTeams,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      manyTeams.forEach((team) => {
        expect(screen.getByText(team.name)).toBeInTheDocument();
      });
    });

    it('handles rapid team switching attempts', async () => {
      // Use a manually-resolved deferred so the in-flight state is deterministic and
      // does not depend on real timer timing (which was flaky).
      let resolveSwitch = () => {};
      const switchTeam = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveSwitch = resolve;
          })
      );
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam, mockTeam2],
        switchTeam,
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      const firstTeamCard = screen.getByText('Test Team').closest('button')!;
      const secondTeamCard = screen.getByText('Second Team').closest('button')!;

      const user = userEvent.setup();
      await user.click(firstTeamCard);

      await waitFor(() => {
        expect(firstTeamCard).toBeDisabled();
      });

      // A click on another team while the first switch is still in flight must be ignored.
      fireEvent.click(secondTeamCard);

      expect(switchTeam).toHaveBeenCalledTimes(1);
      expect(switchTeam).toHaveBeenCalledWith('team-1');

      // Let the pending switch settle so the component's state is cleaned up.
      await act(async () => {
        resolveSwitch();
      });

      await waitFor(() => {
        expect(secondTeamCard).toBeEnabled();
      });
    });
  });

  describe('Integration Tests', () => {
    it('integrates with TeamContext correctly', () => {
      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      renderWithProviders(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(useTeamContext).toHaveBeenCalled();
    });

    it('updates when team context changes', () => {
      const { rerender } = renderWithProviders(
        <TeamSelectionModal isOpen={true} onClose={vi.fn()} />
      );

      vi.mocked(useTeamContext).mockReturnValue({
        ...mockTeamContext,
        isLoading: false,
        userTeams: [mockTeam],
      });

      rerender(<TeamSelectionModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });
  });
});
