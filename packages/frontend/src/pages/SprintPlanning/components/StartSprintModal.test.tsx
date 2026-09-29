import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

import { renderWithProviders, initTestI18n, i18nT } from '../../../test-utils';

import { StartSprintModal, type SprintStats } from './StartSprintModal';

// Initialize i18n before all tests
beforeAll(async () => {
  await initTestI18n();
});

// Mock CSS modules
vi.mock('./StartSprintModal.module.css', () => ({
  default: {
    overlay: 'overlay',
    modal: 'modal',
    'gradient-orb': 'gradient-orb',
    header: 'header',
    'header-content': 'header-content',
    'icon-wrapper': 'icon-wrapper',
    title: 'title',
    subtitle: 'subtitle',
    'sprint-highlight': 'sprint-highlight',
    'close-button': 'close-button',
    'progress-bar': 'progress-bar',
    'progress-fill': 'progress-fill',
    body: 'body',
    'error-banner': 'error-banner',
    'error-icon': 'error-icon',
    'error-content': 'error-content',
    'error-title': 'error-title',
    'error-text': 'error-text',
    'summary-card': 'summary-card',
    'summary-header': 'summary-header',
    'summary-title': 'summary-title',
    'summary-badge': 'summary-badge',
    'summary-grid': 'summary-grid',
    'summary-item': 'summary-item',
    'summary-icon': 'summary-icon',
    'summary-content': 'summary-content',
    'summary-label': 'summary-label',
    'summary-value': 'summary-value',
    'capacity-section': 'capacity-section',
    'capacity-header': 'capacity-header',
    'capacity-label': 'capacity-label',
    'capacity-value': 'capacity-value',
    'capacity-danger': 'capacity-danger',
    'capacity-warning': 'capacity-warning',
    'capacity-success': 'capacity-success',
    'capacity-bar': 'capacity-bar',
    'capacity-fill': 'capacity-fill',
    'capacity-fill-danger': 'capacity-fill-danger',
    'capacity-fill-warning': 'capacity-fill-warning',
    'capacity-fill-success': 'capacity-fill-success',
    'capacity-warning-message': 'capacity-warning-message',
    'goal-section': 'goal-section',
    'goal-header': 'goal-header',
    'goal-icon': 'goal-icon',
    'goal-title': 'goal-title',
    'goal-text': 'goal-text',
    'notice-box': 'notice-box',
    'notice-icon': 'notice-icon',
    'notice-text': 'notice-text',
    footer: 'footer',
    'button-secondary': 'button-secondary',
    'button-primary': 'button-primary',
    'button-spinner': 'button-spinner',
    'button-icon': 'button-icon',
  },
}));

const defaultStats: SprintStats = {
  totalItems: 5,
  totalPoints: 23,
  totalTasks: 12,
  estimatedHours: 96,
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  sprintName: 'Sprint 1',
  sprintGoal: 'Complete user authentication feature',
  sprintDuration: 10,
  stats: defaultStats,
  teamCapacity: 120,
  capacityPercentage: 80,
  error: null,
  isLoading: false,
  hasSprintGoal: true,
  hasSavedBacklog: true,
};

describe('StartSprintModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render modal when isOpen is true', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: i18nT('sprint:sprintPlanning.startSprintModal.title') })
      ).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should display sprint name in subtitle', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} sprintName="My Sprint" />);

      expect(screen.getByText(/My Sprint/)).toBeInTheDocument();
    });

    it('should display all sprint statistics', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(screen.getByText('5')).toBeInTheDocument(); // Items
      expect(screen.getByText('23')).toBeInTheDocument(); // Story Points
      expect(screen.getByText('12')).toBeInTheDocument(); // Tasks
      expect(screen.getByText('96h')).toBeInTheDocument(); // Est. Hours
      expect(
        screen.getByText(
          new RegExp(
            `${defaultProps.sprintDuration} ${i18nT('sprint:sprintPlanning.startSprintModal.workingDays')}`
          )
        )
      ).toBeInTheDocument(); // Duration
      expect(screen.getByText('120h')).toBeInTheDocument(); // Team Capacity
    });

    it('should display sprint goal when provided', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(screen.getByText(/Complete user authentication feature/i)).toBeInTheDocument();
    });

    it('should not display sprint goal section when goal is empty', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} sprintGoal="" />);

      expect(
        screen.queryByText(i18nT('sprint:sprintPlanning.startSprintModal.sprintGoal'))
      ).not.toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      // Use getAllByRole and filter for footer buttons (not the close button)
      const cancelButtons = screen.getAllByRole('button', {
        name: i18nT('sprint:sprintPlanning.startSprintModal.cancel'),
      });
      // There should be at least one Cancel button in the footer
      expect(cancelButtons.length).toBeGreaterThan(0);
      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).toBeInTheDocument();
    });
  });

  describe('Capacity Display', () => {
    it('should display capacity percentage', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={75} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should show success status for capacity under 80%', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={75} />);

      const capacityValue = screen.getByText('75%');
      expect(capacityValue).toHaveClass('capacity-success');
    });

    it('should show warning status for capacity between 80% and 100%', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={85} />);

      const capacityValue = screen.getByText('85%');
      expect(capacityValue).toHaveClass('capacity-warning');
    });

    it('should show danger status for capacity beyond the tolerance', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={115} />);

      const capacityValue = screen.getByText('115%');
      expect(capacityValue).toHaveClass('capacity-danger');
    });

    it('should stay in the warning state when slightly over capacity but within tolerance', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={105} />);

      const capacityValue = screen.getByText('105%');
      expect(capacityValue).toHaveClass('capacity-warning');
    });

    it('should show warning message when capacity is in warning range', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={85} />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.nearCapacityWarning'))
        )
      ).toBeInTheDocument();
    });

    it('should show danger message when capacity is beyond the tolerance', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={115} />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.overCapacityWarning'))
        )
      ).toBeInTheDocument();
    });

    it('should explain the tolerance band when the plan is slightly over capacity', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={105} />);

      expect(
        screen.getByText(
          i18nT('sprint:sprintPlanning.startSprintModal.withinToleranceWarning', {
            tolerance: 10,
          })
        )
      ).toBeInTheDocument();
    });

    it('should not show warning when capacity is normal', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={75} />);

      expect(
        screen.queryByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.nearCapacityWarning'))
        )
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.overCapacityWarning'))
        )
      ).not.toBeInTheDocument();
    });

    it('should cap capacity bar at 100% visually', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={150} />);

      // The bar width should be capped at 100%
      const capacityBar = document.querySelector('.capacity-fill');
      if (capacityBar) {
        expect(capacityBar).toHaveStyle({ width: '100%' });
      }
    });
  });

  describe('Error Display', () => {
    it('should not show error banner when no error', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error={null} />);

      expect(
        screen.queryByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.unableToStart'))
        )
      ).not.toBeInTheDocument();
    });

    it('should show error banner when error is provided', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Something went wrong" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.unableToStart'))
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('should show friendly error message for active sprint conflict', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} error="Another sprint is already active" />
      );

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.activeSprintExists'))
        )
      ).toBeInTheDocument();
      // Check for the error text specifically by using a more specific matcher
      expect(screen.getByText(/Another sprint is already active/i)).toBeInTheDocument();
    });

    it('should show friendly error message for assignee error', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} error="Invalid assignee specified" />
      );

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.invalidTaskAssignment'))
        )
      ).toBeInTheDocument();
    });

    it('should show friendly error message for missing sprint goal', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Sprint goal is required" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.sprintGoalRequired'))
        )
      ).toBeInTheDocument();
    });

    it('should show friendly error message for 401 error', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="401 Unauthorized" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.sessionExpired'))
        )
      ).toBeInTheDocument();
    });

    it('should show friendly error message for 403 error', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="403 Forbidden" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.unauthorized'))
        )
      ).toBeInTheDocument();
    });

    it('should show friendly error message for network error', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Network error occurred" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.networkError'))
        )
      ).toBeInTheDocument();
    });

    it('should show original error for unknown errors', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Custom unknown error" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.unableToStart'))
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/Custom unknown error/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when isLoading is true', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      // Check that the button shows "Starting..." (specific to button, not notice text)
      const startButton = screen.getByRole('button', {
        name: new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.starting')),
      });
      expect(startButton).toBeInTheDocument();
    });

    it('should disable buttons when loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      // Get all cancel buttons (close button + footer cancel button)
      const cancelButtons = screen.getAllByRole('button', {
        name: i18nT('sprint:sprintPlanning.startSprintModal.cancel'),
      });
      // All cancel buttons should be disabled when loading
      cancelButtons.forEach((btn) => expect(btn).toBeDisabled());
      expect(
        screen.getByRole('button', {
          name: new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.starting')),
        })
      ).toBeDisabled();
    });

    it('should disable start button when capacity is beyond the tolerance', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={115} />);

      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).toBeDisabled();
    });

    it('should keep start button enabled when over capacity but within tolerance', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={105} />);

      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).not.toBeDisabled();
    });

    it('should disable start button and explain when planning participation is incomplete', () => {
      renderWithProviders(
        <StartSprintModal
          {...defaultProps}
          participationReady={false}
          participationHasProductOwner={false}
          participationDeveloperCount={0}
        />
      );

      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).toBeDisabled();
      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.participationMissingBoth'))
        )
      ).toBeInTheDocument();
    });

    it('should enable start button when capacity is under 100%', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={95} />);

      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).not.toBeDisabled();
    });

    it('should have aria-busy attribute when loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      const startButton = screen.getByRole('button', {
        name: new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.starting')),
      });
      expect(startButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('User Actions', () => {
    it('should call onConfirm when clicking start sprint button', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      const startButton = screen.getByRole('button', {
        name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
      });
      fireEvent.click(startButton);

      expect(defaultProps.onConfirm).toHaveBeenCalled();
    });

    it('should call onClose when clicking cancel button', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      // Get the footer cancel button (should be the first match)
      const cancelButtons = screen.getAllByRole('button', {
        name: i18nT('sprint:sprintPlanning.startSprintModal.cancel'),
      });
      // Click the footer cancel button (not the close button)
      fireEvent.click(cancelButtons[0]);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking overlay', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not close when clicking overlay while loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should not close when clicking modal content', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      fireEvent.click(modal);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes on dialog', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'start-sprint-title');
    });

    it('should have alert role on error banner', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Test error" />);

      const alerts = screen.queryAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should have aria-label on close button', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      const closeButton = screen.getByLabelText(
        i18nT('sprint:sprintPlanning.startSprintModal.cancel')
      );
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero capacity percentage', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={0} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should handle very high capacity percentage', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={200} />);

      expect(screen.getByText('200%')).toBeInTheDocument();
    });

    it('should handle empty stats', () => {
      renderWithProviders(
        <StartSprintModal
          {...defaultProps}
          stats={{
            totalItems: 0,
            totalPoints: 0,
            totalTasks: 0,
            estimatedHours: 0,
          }}
        />
      );

      const zeroValues = screen.getAllByText('0');
      expect(zeroValues.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle pre-formatted error messages', () => {
      const longError =
        'This is a very long error message that has been pre-formatted with periods and spaces. It should be displayed directly without being transformed.';
      renderWithProviders(<StartSprintModal {...defaultProps} error={longError} />);

      expect(screen.getByText(longError)).toBeInTheDocument();
    });
  });

  describe('Readiness Warning', () => {
    it('should show readiness warning when the Sprint Backlog has not been saved', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} hasSavedBacklog={false} />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.notReadyToStart'))
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.saveBacklogFirstMessage'))
        )
      ).toBeInTheDocument();
    });

    it('should show readiness warning when there is no Sprint Goal', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} hasSprintGoal={false} />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.notReadyToStart'))
        )
      ).toBeInTheDocument();
    });

    it('should disable start button when the Sprint Backlog has not been saved', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} hasSavedBacklog={false} />);

      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).toBeDisabled();
    });

    it('should show tooltip hint when start button is disabled due to missing saved backlog', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} hasSavedBacklog={false} />);

      const startButton = screen.getByRole('button', {
        name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
      });
      expect(startButton).toHaveAttribute(
        'title',
        i18nT('sprint:sprintPlanning.startSprintModal.saveBacklogFirstHint')
      );
    });

    it('should not show readiness warning when Sprint Goal and saved backlog are present', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(
        screen.queryByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.notReadyToStart'))
        )
      ).not.toBeInTheDocument();
    });

    it('should allow start button when ready and capacity is normal', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={80} />);

      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).not.toBeDisabled();
    });
  });

  describe('Commitment Warnings', () => {
    it('should explain a missing Definition of Done and block the start', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} hasDefinitionOfDone={false} />);

      expect(
        screen.getByText(
          new RegExp(
            i18nT('sprint:sprintPlanning.startSprintModal.commitment.definitionOfDoneMissing')
          )
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).toBeDisabled();
    });

    it('should offer a way to the definitions when the Definition of Done is missing', () => {
      const onOpenDefinitions = vi.fn();
      renderWithProviders(
        <StartSprintModal
          {...defaultProps}
          hasDefinitionOfDone={false}
          onOpenDefinitions={onOpenDefinitions}
        />
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: new RegExp(
            i18nT('sprint:sprintPlanning.startSprintModal.commitment.openDefinitions')
          ),
        })
      );

      expect(onOpenDefinitions).toHaveBeenCalled();
    });

    it('should name how many items have not met the Definition of Ready and block the start', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} unreadyReadinessItemCount={3} />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.commitment.readinessIncomplete'))
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: new RegExp(`^${i18nT('sprint:sprintPlanning.startSprintModal.start')}$`),
        })
      ).toBeDisabled();
    });

    it('should not warn about the readiness agreement when every item has met it', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} unreadyReadinessItemCount={0} />);

      expect(
        screen.queryByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.commitment.readinessIncomplete'))
        )
      ).not.toBeInTheDocument();
    });

    it('should explain a Definition of Done refusal from its gate code', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} error="Refused" errorCode="GATE_DOD_REQUIRED" />
      );

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.definitionOfDoneRequired'))
        )
      ).toBeInTheDocument();
    });

    it('should explain a readiness refusal from its gate code', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} error="Refused" errorCode="GATE_DOR_NOT_VERIFIED" />
      );

      expect(
        screen.getByText(
          new RegExp(
            i18nT('sprint:sprintPlanning.startSprintModal.error.definitionOfReadyNotVerified')
          )
        )
      ).toBeInTheDocument();
    });
  });

  describe('Capacity Boundary Values', () => {
    it('should display capacity percentage value', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={80} />);

      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('should display capacity percentage below threshold', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={79} />);

      expect(screen.getByText('79%')).toBeInTheDocument();
    });

    it('should display capacity at 100%', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={100} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should display capacity above 100%', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={101} />);

      expect(screen.getByText('101%')).toBeInTheDocument();
    });

    it('should display zero capacity', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={0} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should display high capacity', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} capacityPercentage={200} />);

      expect(screen.getByText('200%')).toBeInTheDocument();
    });
  });

  describe('Error Message Formatting', () => {
    it('should display error message when provided', () => {
      const preFormattedError = 'This is a pre-formatted error. It should be displayed as-is.';
      renderWithProviders(<StartSprintModal {...defaultProps} error={preFormattedError} />);

      expect(screen.getByText(/This is a pre-formatted error/i)).toBeInTheDocument();
    });

    it('should treat short error without periods as non-pre-formatted', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Simple error" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.unableToStart'))
        )
      ).toBeInTheDocument();
      expect(screen.getByText(/Simple error/i)).toBeInTheDocument();
    });

    it('should format 404 error correctly', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="404 Not Found" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.sprintNotFound'))
        )
      ).toBeInTheDocument();
    });

    it('should format 409 conflict error correctly', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="409 Conflict" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.sprintConflict'))
        )
      ).toBeInTheDocument();
    });

    it('should format 400 bad request error correctly', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="400 Bad Request" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.invalidRequest'))
        )
      ).toBeInTheDocument();
    });

    it('should format timeout error correctly', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="Request timeout" />);

      expect(
        screen.getByText(new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.timeout')))
      ).toBeInTheDocument();
    });

    it('should show error banner even when readiness warning is shown', () => {
      renderWithProviders(
        <StartSprintModal
          {...defaultProps}
          hasSavedBacklog={false}
          error="Another sprint is already active"
        />
      );

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.notReadyToStart'))
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.activeSprintExists'))
        )
      ).toBeInTheDocument();
    });
  });

  describe('Footer Button States', () => {
    it('should disable cancel button when loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      // Get all cancel buttons and check they are disabled
      const cancelButtons = screen.getAllByRole('button', {
        name: i18nT('sprint:sprintPlanning.startSprintModal.cancel'),
      });
      cancelButtons.forEach((btn) => expect(btn).toBeDisabled());
    });

    it('should disable close button when loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      const closeButton = screen.getByLabelText(
        i18nT('sprint:sprintPlanning.startSprintModal.cancel')
      );
      expect(closeButton).toBeDisabled();
    });

    it('should not close on overlay click when loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should show loading text in start button when loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading={true} />);

      const startButton = screen.getByRole('button', {
        name: new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.starting')),
      });
      expect(startButton).toBeInTheDocument();
    });
  });

  describe('Sprint Goal Display', () => {
    it('should display sprint goal text when provided', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} sprintGoal="Complete the authentication module" />
      );

      expect(screen.getByText(/Complete the authentication module/i)).toBeInTheDocument();
    });

    it('should show sprint goal section when sprintGoal is empty string', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} sprintGoal="" />);

      expect(
        screen.queryByText(i18nT('sprint:sprintPlanning.startSprintModal.sprintGoal'))
      ).not.toBeInTheDocument();
    });

    it('should show sprint goal section when sprintGoal is undefined', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} sprintGoal={undefined} />);

      expect(
        screen.queryByText(i18nT('sprint:sprintPlanning.startSprintModal.sprintGoal'))
      ).not.toBeInTheDocument();
    });

    it('should display sprint name in the ready to launch message', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} sprintName="Sprint 42" />);

      // Check the subtitle contains the expected text
      const subtitle = screen.getByText(/Ready to launch/i);
      expect(subtitle).toBeInTheDocument();
      expect(screen.getByText(/Sprint 42/i)).toBeInTheDocument();
      // The "?" is part of the subtitle text, not a separate element
    });
  });

  describe('Ready to Start Badge', () => {
    it('should show Ready to Start badge in summary card', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(
        screen.getByText(new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.readyToStart')))
      ).toBeInTheDocument();
    });
  });

  describe('Confirmation Notice', () => {
    it('should display confirmation notice about redirecting to Sprint Board', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(
        screen.getByText(new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.startingNotice')))
      ).toBeInTheDocument();
    });

    it('should display notice about planning items properly', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(screen.getByText(/Make sure all items are properly planned/i)).toBeInTheDocument();
    });
  });

  describe('Summary Card Details', () => {
    it('should display all summary items with correct icons', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.startSprintModal.duration'))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.startSprintModal.items'))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.startSprintModal.storyPoints'))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.startSprintModal.tasks'))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.startSprintModal.estimatedHours'))
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.startSprintModal.teamCapacity'))
      ).toBeInTheDocument();
    });

    it('should format duration with days suffix', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} sprintDuration={14} />);

      expect(
        screen.getByText(
          new RegExp(`14 ${i18nT('sprint:sprintPlanning.startSprintModal.workingDays')}`)
        )
      ).toBeInTheDocument();
    });

    it('should format estimated hours with h suffix', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} stats={{ ...defaultStats, estimatedHours: 40 }} />
      );

      expect(screen.getByText('40h')).toBeInTheDocument();
    });

    it('should format team capacity with h suffix', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} teamCapacity={160} />);

      expect(screen.getByText('160h')).toBeInTheDocument();
    });
  });

  describe('Gate codes and keyboard handling', () => {
    it('should explain a team-members-only refusal from its gate code', () => {
      renderWithProviders(
        <StartSprintModal
          {...defaultProps}
          error="Refused"
          errorCode="GATE_SPRINT_TEAM_MEMBERS_ONLY"
        />
      );

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.teamMembersOnly'))
        )
      ).toBeInTheDocument();
    });

    it('should explain a Definition of Ready refusal from its gate code', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} error="Refused" errorCode="GATE_DOR_REQUIRED" />
      );

      expect(
        screen.getByText(
          new RegExp(
            i18nT('sprint:sprintPlanning.startSprintModal.error.definitionOfReadyRequired')
          )
        )
      ).toBeInTheDocument();
    });

    it('should fall back to the message matcher for an unrecognised gate code', () => {
      renderWithProviders(
        <StartSprintModal {...defaultProps} error="400 Bad Request" errorCode="GATE_UNKNOWN_CODE" />
      );

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.invalidRequest'))
        )
      ).toBeInTheDocument();
    });

    it('should show a friendly message when the Sprint Backlog has no items', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} error="No items in the backlog" />);

      expect(
        screen.getByText(
          new RegExp(i18nT('sprint:sprintPlanning.startSprintModal.error.invalidSprintBacklog'))
        )
      ).toBeInTheDocument();
    });

    it('should close on the Escape key', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not close on Escape while loading', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} isLoading />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should trap Tab focus within the dialog', () => {
      renderWithProviders(<StartSprintModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      last.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(first);

      first.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(last);
    });
  });
});
