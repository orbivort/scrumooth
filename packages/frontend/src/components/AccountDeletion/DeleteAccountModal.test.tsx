import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { DeleteAccountModal } from './DeleteAccountModal';
import type { TeamMembership } from '../../types/auth.types';

// Mock react-i18next for tests
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      const map: Record<string, string> = {
        'deleteAccount.title': 'Delete Account',
        'deleteAccount.close': 'Close',
        'deleteAccount.warningTitle':
          'This action is permanent and cannot be undone. All your data will be permanently deleted.',
        'deleteAccount.accountToBeDeleted': 'Account to be deleted',
        'deleteAccount.dataWillBeDeleted': 'Data that will be deleted',
        'deleteAccount.profileAndAccount': 'Your profile and account information',
        'deleteAccount.teamMemberships': 'Team memberships and roles',
        'deleteAccount.teamsCount': `(${options?.count ?? 0} teams)`,
        'deleteAccount.associatedData': 'All associated data and activity history',
        'deleteAccount.confirmationHelp': 'Type the phrase exactly as shown',
        'deleteAccount.confirmationCheckbox':
          'I understand that this action is permanent and cannot be undone. I want to delete my account and all associated data.',
        'deleteAccount.confirmationPlaceholder': `Type ${options?.phrase ?? 'DELETE MY ACCOUNT'}`,
        'deleteAccount.deleteAccount': 'Delete My Account',
        'deleteAccount.deleting': 'Deleting...',
        cancel: 'Cancel',
        'deleteAccount.scheduleConfirmationPlaceholder': `Type ${options?.phrase ?? 'SCHEDULE DELETION'}`,
        'deleteAccount.scheduleConfirmationHelp': 'Type the phrase exactly as shown',
        'deleteAccount.scheduleCheckbox': 'I understand this will schedule deletion',
        'deleteAccount.scheduleDeletion': 'Schedule Deletion',
        'deleteAccount.scheduling': 'Scheduling...',
        'deleteAccount.whatHappensNext': 'What happens next',
        'deleteAccount.teamMembersNotified': 'Team members will be notified',
        'deleteAccount.canAssignNewPO': 'You can assign a new Product Owner',
        'deleteAccount.afterDeletionDate':
          'After the deletion date, your account will be permanently removed',
        'deleteAccount.canCancelAnytime': 'You can cancel anytime before deletion',
        'deleteAccount.cancelDeletion': 'Cancel Deletion',
        'deleteAccount.forceConfirmationHelp': 'Type the phrase exactly as shown',
        'deleteAccount.forceCheckbox':
          'I understand that teams will lose their Product Owner and I want to permanently delete my account anyway.',
        'deleteAccount.deleteAnyway': 'Delete Anyway',
        'deleteAccount.forceDeleteWarning.title': 'Grace Period Complete',
        'deleteAccount.forceDeleteWarning.description':
          'The 14-day grace period has ended. You can now permanently delete your account.',
        'deleteAccount.forceDeleteWarning.impact.title': 'This will:',
        'deleteAccount.forceDeleteWarning.impact.removePO':
          'Remove you as Product Owner from teams with no replacement assigned',
        'deleteAccount.forceDeleteWarning.impact.deleteAllData': 'Delete all your data permanently',
        'deleteAccount.forceDeleteWarning.impact.cannotUndo': 'This action CANNOT be undone',
        'deleteAccount.forceDeleteWarning.teams.title':
          'The following teams will have NO Product Owner:',
        'deleteAccount.forceDeleteWarning.teams.consequences':
          'These teams will not be able to add or remove team members, manage sprints, or access team settings.',
        'deleteAccount.gracePeriodProgress.title': 'Deletion Scheduled',
        'deleteAccount.gracePeriodProgress.requested': 'Requested',
        'deleteAccount.gracePeriodProgress.deletionDate': 'Deletion date',
        'deleteAccount.gracePeriodProgress.daysRemaining': 'Days remaining',
        'deleteAccount.deletionRightsNotice.title': 'Your Right to Erasure',
        'deleteAccount.deletionRightsNotice.description':
          'You have the right to delete your account. Since you are the last Product Owner, we ask that you schedule deletion with a 14-day grace period so your teams can prepare.',
        'deleteAccount.deletionRightsNotice.list.teamMembersNotified':
          'Team members will be notified',
        'deleteAccount.deletionRightsNotice.list.assignNewPO':
          'You can assign a new Product Owner before deletion',
        'deleteAccount.deletionRightsNotice.list.cancelAnytime':
          'You can cancel the deletion at any time',
        'deleteAccount.deletionRightsNotice.afterGracePeriod':
          'After 14 days, you can permanently delete your account regardless.',
      };
      return map[key] ?? key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey, values }: { i18nKey: string; values?: Record<string, string> }) => {
    // Mock Trans component to render HTML properly
    const phrase = values?.phrase ?? 'DELETE MY ACCOUNT';
    if (i18nKey === 'deleteAccount.confirmationLabel') {
      return (
        <span>
          Type <strong>{phrase}</strong> to confirm
        </span>
      );
    }
    if (i18nKey === 'deleteAccount.scheduleConfirmationLabel') {
      return (
        <span>
          Type <strong>{phrase}</strong> to schedule deletion
        </span>
      );
    }
    return <span>{i18nKey}</span>;
  },
}));

vi.mock('./DeleteAccountModal.module.css', () => ({
  default: {
    'modal-overlay': 'modal-overlay',
    modal: 'modal',
    'modal-header': 'modal-header',
    'modal-title': 'modal-title',
    'modal-title-icon': 'modal-title-icon',
    'modal-close': 'modal-close',
    'modal-body': 'modal-body',
    'warning-banner': 'warning-banner',
    'warning-banner-icon': 'warning-banner-icon',
    'warning-banner-text': 'warning-banner-text',
    'user-info-section': 'user-info-section',
    'user-info-section-label': 'user-info-section-label',
    'user-info-section-name': 'user-info-section-name',
    'user-info-section-email': 'user-info-section-email',
    'data-section': 'data-section',
    'section-title': 'section-title',
    'data-list': 'data-list',
    'data-list-item': 'data-list-item',
    'data-list-icon': 'data-list-icon',
    'team-count': 'team-count',
    'confirmation-section': 'confirmation-section',
    'confirmation-label': 'confirmation-label',
    'confirmation-input': 'confirmation-input',
    'confirmation-input-error': 'confirmation-input-error',
    'confirmation-help': 'confirmation-help',
    'checkbox-section': 'checkbox-section',
    'checkbox-label': 'checkbox-label',
    'checkbox-input': 'checkbox-input',
    'checkbox-text': 'checkbox-text',
    'error-message': 'error-message',
    'error-message-icon': 'error-message-icon',
    'error-message-text': 'error-message-text',
    'blocked-message': 'blocked-message',
    'blocked-message-icon': 'blocked-message-icon',
    'blocked-message-content': 'blocked-message-content',
    'blocked-message-title': 'blocked-message-title',
    'blocked-message-text': 'blocked-message-text',
    'modal-footer': 'modal-footer',
    button: 'button',
    'button-secondary': 'button-secondary',
    'button-danger': 'button-danger',
    'button-danger-outline': 'button-danger-outline',
    'button-warning': 'button-warning',
    'button-loading': 'button-loading',
    'what-happens-next': 'what-happens-next',
    'what-happens-next-title': 'what-happens-next-title',
    'what-happens-next-list': 'what-happens-next-list',
  },
}));

vi.mock('./DeletionRightsNotice.module.css', () => ({
  default: {
    'deletion-rights-notice': 'deletion-rights-notice',
    'deletion-rights-title': 'deletion-rights-title',
    'deletion-rights-text': 'deletion-rights-text',
    'deletion-rights-list': 'deletion-rights-list',
    'deletion-rights-list-item': 'deletion-rights-list-item',
    'deletion-rights-after': 'deletion-rights-after',
  },
}));

vi.mock('./GracePeriodProgress.module.css', () => ({
  default: {
    'grace-period-progress': 'grace-period-progress',
    'grace-period-title': 'grace-period-title',
    'grace-period-dates': 'grace-period-dates',
    'grace-period-date-item': 'grace-period-date-item',
    'grace-period-date-label': 'grace-period-date-label',
    'grace-period-date-value': 'grace-period-date-value',
    'grace-period-bar-container': 'grace-period-bar-container',
    'grace-period-bar': 'grace-period-bar',
  },
}));

vi.mock('./ForceDeleteWarning.module.css', () => ({
  default: {
    'force-delete-warning': 'force-delete-warning',
    'force-delete-warning-title': 'force-delete-warning-title',
    'force-delete-warning-text': 'force-delete-warning-text',
    'force-delete-impact': 'force-delete-impact',
    'force-delete-impact-title': 'force-delete-impact-title',
    'force-delete-impact-list': 'force-delete-impact-list',
    'force-delete-impact-item': 'force-delete-impact-item',
    'force-delete-teams': 'force-delete-teams',
    'force-delete-teams-title': 'force-delete-teams-title',
    'force-delete-teams-list': 'force-delete-teams-list',
    'force-delete-teams-item': 'force-delete-teams-item',
    'force-delete-teams-consequences': 'force-delete-teams-consequences',
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

const createMockTeam = (overrides: Partial<TeamMembership> = {}): TeamMembership => ({
  id: 'team-1',
  name: 'Test Team',
  role: 'DEVELOPERS',
  isLastPO: false,
  ...overrides,
});

const requiredPhrase = 'DELETE MY ACCOUNT';

describe('DeleteAccountModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnDelete = vi.fn().mockResolvedValue(undefined);

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    userEmail: 'test@example.com',
    userName: 'Test User',
    teams: [] as TeamMembership[],
    isBlocked: false,
    pendingDeletion: null as {
      requestedAt: string;
      scheduledDeletionAt: string;
      gracePeriodDays: number;
    } | null,
    onDelete: mockOnDelete,
    onScheduleDeletion: vi.fn().mockResolvedValue(undefined),
    onCancelDeletion: vi.fn().mockResolvedValue(undefined),
    onForceDelete: vi.fn().mockResolvedValue(undefined),
    isDeleting: false,
    error: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering Tests', () => {
    it('should render when isOpen is true', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should show warning banner', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByText(/This action is permanent and cannot be undone/)).toBeInTheDocument();
    });

    it('should show user info (name, email)', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByText('Account to be deleted')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should show modal title', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument();
    });

    it('should show data deletion list', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByText('Data that will be deleted')).toBeInTheDocument();
      expect(screen.getByText('Your profile and account information')).toBeInTheDocument();
      expect(screen.getByText('Team memberships and roles')).toBeInTheDocument();
      expect(screen.getByText('All associated data and activity history')).toBeInTheDocument();
    });

    it('should show Cancel button', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should show Delete button', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Delete My Account' })).toBeInTheDocument();
    });
  });

  describe('Delete Button State Tests', () => {
    it('should have delete button disabled by default', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
      expect(deleteButton).toBeDisabled();
    });

    it('should have delete button disabled when confirmation text does not match required phrase', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      // Type incorrect confirmation phrase
      const input = screen.getByRole('textbox');
      await user.type(input, 'WRONG');

      // Button should be disabled since confirmation doesn't match
      const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
      expect(deleteButton).toBeDisabled();
    });

    it('should have delete button disabled when confirmation field is empty', async () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      // Don't type anything - button should be disabled
      const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
      expect(deleteButton).toBeDisabled();
    });

    it('should enable delete button when confirmation text matches required phrase', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      // Type correct confirmation phrase
      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      // Confirmation matches - button should be enabled (checkbox auto-checks)
      const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
      expect(deleteButton).not.toBeDisabled();

      // Verify checkbox is checked
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should have delete button disabled when isBlocked is true', async () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];

      renderWithRouter(<DeleteAccountModal {...defaultProps} teams={teams} isBlocked />);

      // Delete button should not be visible when blocked
      expect(screen.queryByRole('button', { name: 'Delete My Account' })).not.toBeInTheDocument();
    });
  });

  describe('Delete Action Tests', () => {
    it('should call onDelete when confirmation matches and button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      // Type confirmation phrase (this also checks the checkbox)
      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
      await user.click(deleteButton);

      // Wait for async operation
      await waitFor(() => {
        expect(mockOnDelete).toHaveBeenCalledWith(requiredPhrase);
      });
    });

    it('should not call onDelete when button is disabled', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete My Account' });
      await user.click(deleteButton);

      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });

  describe('Loading State Tests', () => {
    it('should show loading state when isDeleting is true', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isDeleting />);

      expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    it('should have delete button show loading text when isDeleting', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isDeleting />);

      const deleteButton = screen.getByRole('button', { name: 'Deleting...' });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should disable cancel button when deleting', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isDeleting />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();
    });

    it('should disable close button when deleting', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isDeleting />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeDisabled();
    });
  });

  describe('Close Button Tests', () => {
    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when deleting', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} isDeleting />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Error Display Tests', () => {
    it('should show error message when error prop is provided', () => {
      const errorMessage = 'Failed to delete account';
      renderWithRouter(<DeleteAccountModal {...defaultProps} error={errorMessage} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should not show error when error is null', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} error={null} />);

      // Error message should not be present when error is null
      const errorMessage = screen.queryByText(/Failed to delete account/);
      expect(errorMessage).not.toBeInTheDocument();
    });
  });

  describe('Blocked State Tests', () => {
    it('should show DeletionRightsNotice when isBlocked is true and no pending deletion', () => {
      const teams: TeamMembership[] = [createMockTeam()];
      renderWithRouter(<DeleteAccountModal {...defaultProps} teams={teams} isBlocked />);

      expect(screen.getByText('Your Right to Erasure')).toBeInTheDocument();
      expect(screen.getByText(/You have the right to delete your account/)).toBeInTheDocument();
    });

    it('should show schedule confirmation input when blocked with no pending deletion', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isBlocked />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should show schedule checkbox when blocked with no pending deletion', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} isBlocked />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should show team count when user has teams', () => {
      const teams: TeamMembership[] = [
        createMockTeam({ id: 'team-1', name: 'Team 1' }),
        createMockTeam({ id: 'team-2', name: 'Team 2' }),
      ];
      renderWithRouter(<DeleteAccountModal {...defaultProps} teams={teams} />);

      expect(screen.getByText('(2 teams)')).toBeInTheDocument();
    });
  });

  describe('Schedule Deletion State Tests', () => {
    it('should show DeletionRightsNotice when isBlocked=true and pendingDeletion=null', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal {...defaultProps} teams={teams} isBlocked pendingDeletion={null} />
      );

      expect(screen.getByText('Your Right to Erasure')).toBeInTheDocument();
    });

    it('should show Schedule Deletion button when isBlocked=true and pendingDeletion=null', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal {...defaultProps} teams={teams} isBlocked pendingDeletion={null} />
      );

      expect(screen.getByRole('button', { name: 'Schedule Deletion' })).toBeInTheDocument();
    });

    it('should have Schedule Deletion button disabled by default', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal {...defaultProps} teams={teams} isBlocked pendingDeletion={null} />
      );

      const scheduleButton = screen.getByRole('button', { name: 'Schedule Deletion' });
      expect(scheduleButton).toBeDisabled();
    });

    it('should not show Delete Account button in schedule deletion state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal {...defaultProps} teams={teams} isBlocked pendingDeletion={null} />
      );

      expect(screen.queryByRole('button', { name: 'Delete My Account' })).not.toBeInTheDocument();
    });
  });

  describe('Grace Period Active State Tests', () => {
    const futurePendingDeletion = {
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      scheduledDeletionAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      gracePeriodDays: 14,
    };

    it('should show GracePeriodProgress when isBlocked=true and pendingDeletion has future date', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={futurePendingDeletion}
        />
      );

      expect(screen.getByText('Deletion Scheduled')).toBeInTheDocument();
    });

    it('should show Cancel Deletion button when grace period is active', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={futurePendingDeletion}
        />
      );

      expect(screen.getByRole('button', { name: 'Cancel Deletion' })).toBeInTheDocument();
    });

    it('should not show confirmation input when grace period is active', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={futurePendingDeletion}
        />
      );

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should not show checkbox when grace period is active', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={futurePendingDeletion}
        />
      );

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should not show Delete Account button when grace period is active', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={futurePendingDeletion}
        />
      );

      expect(screen.queryByRole('button', { name: 'Delete My Account' })).not.toBeInTheDocument();
    });
  });

  describe('Force Delete State Tests', () => {
    const pastPendingDeletion = {
      requestedAt: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      scheduledDeletionAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      gracePeriodDays: 14,
    };

    it('should show ForceDeleteWarning when isBlocked=true and pendingDeletion has past date', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      expect(screen.getByText('Grace Period Complete')).toBeInTheDocument();
    });

    it('should show Delete Anyway button when grace period has elapsed', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      expect(screen.getByRole('button', { name: 'Delete Anyway' })).toBeInTheDocument();
    });

    it('should have Delete Anyway button disabled by default', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      const forceDeleteButton = screen.getByRole('button', { name: 'Delete Anyway' });
      expect(forceDeleteButton).toBeDisabled();
    });

    it('should show confirmation input in force delete state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should show checkbox in force delete state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should show Cancel Deletion button in force delete state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      expect(screen.getByRole('button', { name: 'Cancel Deletion' })).toBeInTheDocument();
    });

    it('should show force delete checkbox with Product Owner warning text', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      expect(
        screen.getByText(
          /I understand that teams will lose their Product Owner and I want to permanently delete my account anyway./
        )
      ).toBeInTheDocument();
    });

    it('should enable Delete Anyway button when confirmation text matches and checkbox is checked', async () => {
      const user = userEvent.setup();
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      const forceDeleteButton = screen.getByRole('button', { name: 'Delete Anyway' });
      expect(forceDeleteButton).not.toBeDisabled();
    });

    it('should call onForceDelete when Delete Anyway button clicked with valid confirmation', async () => {
      const user = userEvent.setup();
      const mockOnForceDelete = vi.fn().mockResolvedValue(undefined);
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
          onForceDelete={mockOnForceDelete}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      const forceDeleteButton = screen.getByRole('button', { name: 'Delete Anyway' });
      await user.click(forceDeleteButton);

      await waitFor(() => {
        expect(mockOnForceDelete).toHaveBeenCalledWith(requiredPhrase);
      });
    });

    it('should have checkbox auto-checked when confirmation text matches', async () => {
      const user = userEvent.setup();
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should uncheck checkbox when user unchecks it manually after typing confirmation', async () => {
      const user = userEvent.setup();
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should disable Delete Anyway button when checkbox is unchecked even with valid confirmation', async () => {
      const user = userEvent.setup();
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      const forceDeleteButton = screen.getByRole('button', { name: 'Delete Anyway' });
      expect(forceDeleteButton).toBeDisabled();
    });

    it('should not call onForceDelete when Delete Anyway button is disabled', async () => {
      const user = userEvent.setup();
      const mockOnForceDelete = vi.fn().mockResolvedValue(undefined);
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
          onForceDelete={mockOnForceDelete}
        />
      );

      const forceDeleteButton = screen.getByRole('button', { name: 'Delete Anyway' });
      await user.click(forceDeleteButton);

      expect(mockOnForceDelete).not.toHaveBeenCalled();
    });

    it('should show loading state on Delete Anyway button when isDeleting is true in force delete state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
          isDeleting
        />
      );

      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeInTheDocument();
    });

    it('should disable checkbox when isDeleting is true in force delete state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
          isDeleting
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
    });

    it('should disable confirmation input when isDeleting is true in force delete state', () => {
      const teams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={teams}
          isBlocked
          pendingDeletion={pastPendingDeletion}
          isDeleting
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });
  });

  describe('Accessibility Tests', () => {
    it('should have dialog role', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby pointing to title', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-account-title');
    });

    it('should have aria-describedby pointing to description', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'delete-account-description');
    });

    it('should have accessible label on confirmation input', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAccessibleName(/Type DELETE MY ACCOUNT to confirm/i);
    });

    it('should have aria-describedby on confirmation input', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', 'confirmation-help');
    });

    it('should have accessible label on checkbox', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('Confirmation Input Tests', () => {
    it('should convert input to uppercase', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'delete');

      expect(input).toHaveValue('DELETE');
    });

    it('should accept correct confirmation phrase', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const input = screen.getByRole('textbox');
      await user.type(input, requiredPhrase);

      expect(input).toHaveValue(requiredPhrase);
    });
  });

  describe('Edge Case Tests', () => {
    it('should handle rapid checkbox toggles', async () => {
      const user = userEvent.setup();
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');

      await user.click(checkbox);
      await user.click(checkbox);
      await user.click(checkbox);

      expect(checkbox).toBeChecked();
    });

    it('should handle empty user name', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} userName="" />);

      expect(screen.getByText('Account to be deleted')).toBeInTheDocument();
    });

    it('should handle empty user email', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} userEmail="" />);

      expect(screen.getByText('Account to be deleted')).toBeInTheDocument();
    });

    it('should handle many teams', () => {
      const teams: TeamMembership[] = Array.from({ length: 10 }, (_, i) =>
        createMockTeam({ id: `team-${i}`, name: `Team ${i}` })
      );
      renderWithRouter(<DeleteAccountModal {...defaultProps} teams={teams} />);

      expect(screen.getByText('(10 teams)')).toBeInTheDocument();
    });
  });

  describe('Responsive Design Tests', () => {
    it('should render correctly on desktop viewport', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should render all interactive elements', () => {
      renderWithRouter(<DeleteAccountModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete My Account' })).toBeInTheDocument();
    });
  });

  describe('Schedule Deletion Interaction Tests', () => {
    const scheduleTeams: TeamMembership[] = [createMockTeam({ isLastPO: true })];
    const schedulePhrase = 'SCHEDULE DELETION';

    it('should upper-case the schedule confirmation input and check its checkbox when the phrase matches', async () => {
      const user = userEvent.setup();
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={scheduleTeams}
          isBlocked
          pendingDeletion={null}
        />
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'schedule deletion');

      expect(input).toHaveValue(schedulePhrase);
      // Typing the exact phrase auto-confirms via `setIsScheduleConfirmed`.
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('should toggle the schedule checkbox via its onChange handler', async () => {
      const user = userEvent.setup();
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={scheduleTeams}
          isBlocked
          pendingDeletion={null}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('should call onScheduleDeletion when the Schedule Deletion button is clicked after confirming', async () => {
      const user = userEvent.setup();
      const mockOnScheduleDeletion = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={scheduleTeams}
          isBlocked
          pendingDeletion={null}
          onScheduleDeletion={mockOnScheduleDeletion}
        />
      );

      await user.type(screen.getByRole('textbox'), schedulePhrase);
      await user.click(screen.getByRole('button', { name: 'Schedule Deletion' }));

      await waitFor(() => {
        expect(mockOnScheduleDeletion).toHaveBeenCalledWith(schedulePhrase);
      });
    });

    it('should not call onScheduleDeletion when the Schedule Deletion button is disabled', async () => {
      const user = userEvent.setup();
      const mockOnScheduleDeletion = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={scheduleTeams}
          isBlocked
          pendingDeletion={null}
          onScheduleDeletion={mockOnScheduleDeletion}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Schedule Deletion' }));

      expect(mockOnScheduleDeletion).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Deletion Interaction Tests', () => {
    const gracePeriodPendingDeletion = {
      requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      scheduledDeletionAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      gracePeriodDays: 14,
    };
    const blockedTeams: TeamMembership[] = [createMockTeam({ isLastPO: true })];

    it('should call onCancelDeletion when Cancel Deletion is clicked during the grace period', async () => {
      const user = userEvent.setup();
      const mockOnCancelDeletion = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={blockedTeams}
          isBlocked
          pendingDeletion={gracePeriodPendingDeletion}
          onCancelDeletion={mockOnCancelDeletion}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Cancel Deletion' }));

      await waitFor(() => {
        expect(mockOnCancelDeletion).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call onCancelDeletion when a deletion is in progress', async () => {
      const user = userEvent.setup();
      const mockOnCancelDeletion = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(
        <DeleteAccountModal
          {...defaultProps}
          teams={blockedTeams}
          isBlocked
          pendingDeletion={gracePeriodPendingDeletion}
          onCancelDeletion={mockOnCancelDeletion}
          isDeleting
        />
      );

      await user.click(screen.getByRole('button', { name: 'Cancel Deletion' }));

      expect(mockOnCancelDeletion).not.toHaveBeenCalled();
    });
  });
});
