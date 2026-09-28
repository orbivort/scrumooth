import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { vi } from 'vitest';

import { DeleteTeamModal } from './DeleteTeamModal';
import type { Team } from '@/types/teamManagement.types';

const mockTeam: Team = {
  id: 'team-1',
  name: 'Team Alpha',
  description: 'Team description',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  memberCount: 5,
  userRole: 'PRODUCT_OWNER',
  creator: {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  },
};

describe('DeleteTeamModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true and team is provided', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });

    it('should NOT render modal when isOpen is false', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={false}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should NOT render modal when team is null', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={null}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display team name in modal', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByLabelText(/type.*team alpha.*to confirm/i)).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete team/i })).toBeInTheDocument();
    });
  });

  describe('Confirmation input', () => {
    it('should have confirmation input field', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByLabelText(/type.*team alpha.*to confirm/i)).toBeInTheDocument();
    });

    it('should show awaiting confirmation status initially', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument();
    });

    it('should show match confirmed when correct team name is typed', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team Alpha' } });

      expect(screen.getByText(/match confirmed/i)).toBeInTheDocument();
    });

    it('should enable delete button when correct team name is typed', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team Alpha' } });

      const deleteButton = screen.getByRole('button', { name: /delete team/i });
      expect(deleteButton).not.toBeDisabled();
    });

    it('should disable delete button when incorrect team name is typed', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Wrong Name' } });

      const deleteButton = screen.getByRole('button', { name: /delete team/i });
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Paste prevention', () => {
    it('should show paste warning when attempting to paste', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.paste(input);

      expect(screen.getByText(/manual typing required for security/i)).toBeInTheDocument();
    });
  });

  describe('Input states and styling', () => {
    it('should show success styling when confirmation matches', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team Alpha' } });

      expect(input).toBeInTheDocument();
    });

    it('should show warning styling when paste warning is active', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.paste(input);

      expect(input).toBeInTheDocument();
    });
  });

  describe('Error handling with product goals', () => {
    it('should not show confirmation input when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      expect(screen.queryByLabelText(/type.*team alpha.*to confirm/i)).not.toBeInTheDocument();
    });

    it('should not submit when Enter is pressed and hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      fireEvent.keyDown(document.body, { key: 'Enter' });
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should show delete error when deleteError is provided and hasProductGoals is false', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          deleteError="Something went wrong"
        />
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it('should not show delete error when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
          deleteError="This error should not show"
        />
      );

      expect(screen.queryByText(/this error should not show/i)).not.toBeInTheDocument();
    });
  });

  describe('Delete action', () => {
    it('should call onConfirm with team id when confirmed', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team Alpha' } });

      const deleteButton = screen.getByRole('button', { name: /delete team/i });
      fireEvent.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledWith('team-1');
    });

    it('should show loading state when deleting', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      expect(screen.getByText(/deleting/i)).toBeInTheDocument();
    });

    it('should disable buttons when deleting', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const deleteButton = screen.getByRole('button', { name: /deleting/i });

      expect(cancelButton).toBeDisabled();
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Cancel action', () => {
    it('should call onClose when cancel button is clicked', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when close button is clicked', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Product goals blocking', () => {
    it('should show blocked message when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      expect(screen.getByText(/deletion blocked/i)).toBeInTheDocument();
      // The text is split across elements, so check for partial match - use getAllByText since multiple elements contain this
      expect(
        screen.getAllByText((content) => content.includes('product goals')).length
      ).toBeGreaterThan(0);
    });

    it('should hide confirmation input when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      expect(screen.queryByLabelText(/type.*team alpha.*to confirm/i)).not.toBeInTheDocument();
    });

    it('should show cannot delete button when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      const button = screen.getByRole('button', { name: /cannot delete/i });
      expect(button).toBeDisabled();
    });

    it('should show required actions list when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      expect(screen.getByText(/required actions/i)).toBeInTheDocument();
      expect(screen.getByText(/navigate to the product goals section/i)).toBeInTheDocument();
    });
  });

  describe('Delete error display', () => {
    it('should display error message when deleteError is provided', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          deleteError="Failed to delete team"
        />
      );

      expect(screen.getByText(/failed to delete team/i)).toBeInTheDocument();
    });

    it('should not display error when deleteError is undefined', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Member count display', () => {
    it('should show member impact alert when team has members', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      // Translation: "{{count}} member(s) will be removed from this team"
      expect(screen.getByText(/5 member\(s\) will be removed from this team/i)).toBeInTheDocument();
      expect(screen.getByText(/will be removed from this team/i)).toBeInTheDocument();
    });

    it('should use singular form when team has 1 member', () => {
      const singleMemberTeam = { ...mockTeam, memberCount: 1 };

      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={singleMemberTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      // Translation: "{{count}} member(s) will be removed from this team"
      expect(screen.getByText('1 member will be removed from this team')).toBeInTheDocument();
    });
  });

  describe('Progress bar', () => {
    it('should show progress based on confirmation text length', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team' } });

      const progressFill = document.querySelector('[class*="progress-fill"]');
      expect(progressFill).toBeInTheDocument();
    });

    it('should show complete progress when full team name is typed', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team Alpha' } });

      const progressFill = document.querySelector('[class*="progress-complete"]');
      expect(progressFill).toBeInTheDocument();
    });
  });

  describe('Keyboard interactions', () => {
    it('should submit on Enter when confirmation is complete', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);
      fireEvent.change(input, { target: { value: 'Team Alpha' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnConfirm).toHaveBeenCalledWith('team-1');
    });

    it('should not submit on Enter when hasProductGoals is true', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
          hasProductGoals={true}
        />
      );

      const input = screen.queryByLabelText(/type.*team alpha.*to confirm/i);
      expect(input).not.toBeInTheDocument();
    });
  });

  describe('Paste prevention events', () => {
    it('blocks Ctrl+V, the context menu, drop and drag over on the confirmation input', () => {
      renderWithProviders(
        <DeleteTeamModal
          isOpen={true}
          team={mockTeam}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          isDeleting={false}
        />
      );

      const input = screen.getByLabelText(/type.*team alpha.*to confirm/i);

      // A Ctrl+V keystroke is intercepted (handleKeyDown paste-prevention branch).
      fireEvent.keyDown(input, { key: 'v', ctrlKey: true });
      expect(screen.getByText(/manual typing required for security/i)).toBeInTheDocument();

      // Right-click, drop and drag-over each stop the browser default (paste/insert) route.
      fireEvent.contextMenu(input);
      fireEvent.drop(input);
      fireEvent.dragOver(input);

      expect(input).toBeInTheDocument();
    });
  });
});
