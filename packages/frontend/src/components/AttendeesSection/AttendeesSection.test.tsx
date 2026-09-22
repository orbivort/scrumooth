import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { screen, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import userEvent from '@testing-library/user-event';

import {
  AttendeesSection,
  type Attendee,
  type TeamMember,
  type AttendeesSectionProps,
} from './AttendeesSection';

// Mock CSS modules
vi.mock('./AttendeesSection.module.css', () => ({
  default: {
    'attendees-section': 'attendees-section',
    'section-header': 'section-header',
    'header-left': 'header-left',
    'section-title': 'section-title',
    'section-icon': 'section-icon',
    'attendance-count': 'attendance-count',
    'add-attendee-button': 'add-attendee-button',
    'add-attendee-button-icon': 'add-attendee-button-icon',
    'filter-tabs': 'filter-tabs',
    'filter-tab': 'filter-tab',
    active: 'active',
    'unmarked-section': 'unmarked-section',
    'unmarked-header': 'unmarked-header',
    'unmarked-icon': 'unmarked-icon',
    'unmarked-title': 'unmarked-title',
    'unmarked-list': 'unmarked-list',
    'unmarked-item': 'unmarked-item',
    'member-info': 'member-info',
    'member-avatar': 'member-avatar',
    'member-details': 'member-details',
    'member-name': 'member-name',
    'member-role': 'member-role',
    'quick-actions': 'quick-actions',
    'quick-btn': 'quick-btn',
    attended: 'attended',
    absent: 'absent',
    'quick-btn-icon': 'quick-btn-icon',
    'attendees-list': 'attendees-list',
    'attendee-card': 'attendee-card',
    'attendee-info': 'attendee-info',
    'attendee-avatar': 'attendee-avatar',
    'attendee-details': 'attendee-details',
    'attendee-name': 'attendee-name',
    'attendee-role': 'attendee-role',
    'linked-user-badge': 'linked-user-badge',
    'linked-user-badge-icon': 'linked-user-badge-icon',
    'field-hint': 'field-hint',
    'attendance-controls': 'attendance-controls',
    'status-btn': 'status-btn',
    selected: 'selected',
    'status-btn-icon': 'status-btn-icon',
    'edit-btn': 'edit-btn',
    'read-only': 'read-only',
    'edit-btn-icon': 'edit-btn-icon',
    'delete-btn': 'delete-btn',
    danger: 'danger',
    'delete-btn-icon': 'delete-btn-icon',
    'empty-state': 'empty-state',
    'empty-icon': 'empty-icon',
    'empty-hint': 'empty-hint',
    'modal-overlay': 'modal-overlay',
    'modal-content': 'modal-content',
    'modal-header': 'modal-header',
    'modal-header-content': 'modal-header-content',
    'modal-icon-wrapper': 'modal-icon-wrapper',
    'modal-subtitle': 'modal-subtitle',
    'close-button': 'close-button',
    'form-group': 'form-group',
    required: 'required',
    'error-message': 'error-message',
    checkbox: 'checkbox',
    'api-error': 'api-error',
    'form-actions': 'form-actions',
    button: 'button',
    'button-primary': 'button-primary',
    'button-secondary': 'button-secondary',
  },
}));

// Mock ConfirmDialog
vi.mock('../ConfirmDialog/ConfirmDialog', () => ({
  ConfirmDialog: ({
    isOpen,
    title,
    name,
    onConfirm,
    onCancel,
    isLoading,
  }: {
    isOpen: boolean;
    title: string;
    name?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading?: boolean;
  }) =>
    isOpen ? (
      <div role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <p>Remove {name}?</p>
        <button onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Removing...' : 'Remove'}
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const defaultProps: AttendeesSectionProps = {
  entityId: 'entity-1',
  sprintId: 'sprint-1',
  attendees: [],
  teamMembers: [],
  isCompleted: false,
  apiConfig: {
    addAttendee: vi.fn().mockResolvedValue({}),
    updateAttendee: vi.fn().mockResolvedValue({}),
    deleteAttendee: vi.fn().mockResolvedValue({}),
  },
  queryKey: ['attendees', 'entity-1'],
  defaultRole: 'stakeholder',
  onToggleAttendance: vi.fn(),
  onAddTeamMember: vi.fn(),
  isAdding: false,
  isUpdating: false,
};

const mockAttendees: Attendee[] = [
  {
    id: 'attendee-1',
    userId: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'developers',
    attended: true,
  },
  {
    id: 'attendee-2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'product_owner',
    attended: false,
  },
  {
    id: 'attendee-3',
    name: 'Bob Wilson',
    role: 'stakeholder',
    attended: true,
  },
];

const mockTeamMembers: TeamMember[] = [
  {
    id: 'team-1',
    userId: 'user-1',
    user: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
    role: 'Developers',
  },
  {
    id: 'team-2',
    userId: 'user-2',
    user: {
      id: 'user-2',
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice@example.com',
    },
    role: 'Scrum Master',
  },
  {
    id: 'team-3',
    user: {
      id: 'user-3',
      firstName: 'Charlie',
      lastName: 'Brown',
    },
    role: 'Product Owner',
  },
];

describe('AttendeesSection Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering Tests', () => {
    it('renders with default props', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      expect(screen.getByText('Attendees')).toBeInTheDocument();
    });

    it('renders attendance count', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      // 2 attended out of 3 total
      expect(screen.getByText('2 / 3 attended')).toBeInTheDocument();
    });

    it('renders "Add Attendees" button', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      expect(screen.getByRole('button', { name: /add attendees/i })).toBeInTheDocument();
    });

    it('renders filter tabs', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      expect(screen.getByRole('radiogroup', { name: /filter attendees/i })).toBeInTheDocument();
    });

    it('renders empty state when no attendees', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      expect(screen.getByText('No attendees recorded yet.')).toBeInTheDocument();
    });
  });

  describe('Filter Tabs Tests', () => {
    it('renders all three filter tabs', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      expect(screen.getByRole('radio', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /team/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /guests/i })).toBeInTheDocument();
    });

    it('shows correct counts on filter tabs', () => {
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={mockAttendees}
          teamMembers={mockTeamMembers}
        />
      );

      expect(screen.getByText('All (3)')).toBeInTheDocument();
    });

    it('changes active filter when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      const guestsTab = screen.getByRole('radio', { name: /guests/i });
      await user.click(guestsTab);

      expect(guestsTab).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Unmarked Team Members Tests', () => {
    it('renders unmarked section when there are unmarked team members', () => {
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[0]]} // Only John is marked
          teamMembers={mockTeamMembers}
        />
      );

      expect(screen.getByText(/team members not yet marked/i)).toBeInTheDocument();
    });

    it('does not render unmarked section when all team members are marked', () => {
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[
            { ...mockAttendees[0], name: 'John Doe' },
            { ...mockAttendees[1], name: 'Alice Johnson' },
            { ...mockAttendees[2], name: 'Charlie Brown' },
          ]}
          teamMembers={mockTeamMembers}
        />
      );

      expect(screen.queryByText(/team members not yet marked/i)).not.toBeInTheDocument();
    });

    it('does not render unmarked section when completed', () => {
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[0]]}
          teamMembers={mockTeamMembers}
          isCompleted={true}
        />
      );

      expect(screen.queryByText(/team members not yet marked/i)).not.toBeInTheDocument();
    });

    it('calls onAddTeamMember when marking as attended', async () => {
      const user = userEvent.setup();
      const onAddTeamMember = vi.fn();

      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[0]]}
          teamMembers={mockTeamMembers}
          onAddTeamMember={onAddTeamMember}
        />
      );

      // Find the first attended button in the unmarked section
      const attendedButtons = screen.getAllByTitle('Mark as attended');
      await user.click(attendedButtons[0]);

      expect(onAddTeamMember).toHaveBeenCalledWith(expect.objectContaining({ id: 'team-2' }), true);
    });

    it('calls onAddTeamMember when marking as absent', async () => {
      const user = userEvent.setup();
      const onAddTeamMember = vi.fn();

      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[0]]}
          teamMembers={mockTeamMembers}
          onAddTeamMember={onAddTeamMember}
        />
      );

      // Find the first absent button in the unmarked section
      const absentButtons = screen.getAllByTitle('Mark as absent');
      await user.click(absentButtons[0]);

      expect(onAddTeamMember).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'team-2' }),
        false
      );
    });
  });

  describe('Attendee Card Tests', () => {
    it('renders attendee cards for each attendee', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('renders attendee initials in avatar', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      // John Doe -> JD
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders formatted role name', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      expect(screen.getByText('product owner')).toBeInTheDocument();
    });

    it('shows attended status button as selected for attended attendees', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[0]]} />);

      const attendedButtons = screen.getAllByRole('button', { name: /mark as attended/i });
      expect(attendedButtons[0]).toHaveClass('selected');
    });

    it('shows absent status button as selected for absent attendees', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[1]]} />);

      const absentButtons = screen.getAllByRole('button', { name: /mark as absent/i });
      expect(absentButtons[0]).toHaveClass('selected');
    });

    it('calls onToggleAttendance when attendance status is changed', async () => {
      const user = userEvent.setup();
      const onToggleAttendance = vi.fn();

      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[1]]}
          onToggleAttendance={onToggleAttendance}
        />
      );

      const attendedButton = screen.getByRole('button', { name: /mark as attended/i });
      await user.click(attendedButton);

      expect(onToggleAttendance).toHaveBeenCalledWith('attendee-2', true);
    });
  });

  describe('Edit and Delete Tests', () => {
    it('renders edit button for non-team-member attendees', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[1]]} />);

      expect(screen.getByRole('button', { name: /edit attendee/i })).toBeInTheDocument();
    });

    it('renders delete button for each attendee', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[0]]} />);

      expect(screen.getByRole('button', { name: /remove attendee/i })).toBeInTheDocument();
    });

    it('disables edit button for team members', () => {
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[0]]}
          teamMembers={mockTeamMembers}
        />
      );

      const editButton = screen.getByRole('button', { name: /team members cannot be edited/i });
      expect(editButton).toBeDisabled();
    });

    it('opens delete confirmation dialog when delete is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[0]]} />);

      const deleteButton = screen.getByRole('button', { name: /remove attendee/i });
      await user.click(deleteButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Remove Attendee')).toBeInTheDocument();
    });
  });

  describe('Completed State Tests', () => {
    it('disables "Add Attendees" button when completed', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} isCompleted={true} />);

      const addButton = screen.getByRole('button', { name: /add attendees/i });
      expect(addButton).toBeDisabled();
    });

    it('does not render edit/delete buttons when completed', () => {
      renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={mockAttendees} isCompleted={true} />
      );

      expect(screen.queryByRole('button', { name: /edit attendee/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remove attendee/i })).not.toBeInTheDocument();
    });

    it('disables attendance toggle buttons when completed', () => {
      renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={[mockAttendees[0]]} isCompleted={true} />
      );

      const attendedButton = screen.getByRole('button', { name: /mark as attended/i });
      expect(attendedButton).toBeDisabled();
    });
  });

  describe('Modal Tests', () => {
    it('opens add attendee modal when "Add Attendees" is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Use heading role to find the modal title specifically
      expect(screen.getByRole('heading', { name: 'Add Attendee' })).toBeInTheDocument();
    });

    it('closes modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      // Open modal
      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('opens edit modal with attendee data when edit is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[1]]} />);

      const editButton = screen.getByRole('button', { name: /edit attendee/i });
      await user.click(editButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Edit Attendee')).toBeInTheDocument();
    });
  });

  describe('Form Validation Tests', () => {
    it('shows error when submitting empty name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      // Open modal
      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      // Clear name and submit
      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);

      // Use the submit button in the modal form (type="submit")
      const submitButton = screen.getByRole('button', { name: /^add attendee$/i });
      await user.click(submitButton);

      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('shows error for invalid email', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      // Open modal
      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      // Enter invalid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');

      // Use the submit button in the modal form (type="submit")
      const submitButton = screen.getByRole('button', { name: /^add attendee$/i });
      await user.click(submitButton);

      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('accepts valid email', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      // Open modal
      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      // Enter valid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'valid@example.com');

      // Use the submit button in the modal form (type="submit")
      const submitButton = screen.getByRole('button', { name: /^add attendee$/i });
      await user.click(submitButton);

      // Should not show email error
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });
  });

  describe('Loading States Tests', () => {
    it('disables add button when isCompleted is true', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} isCompleted={true} />);

      const addButton = screen.getByRole('button', { name: /add attendees/i });
      expect(addButton).toBeDisabled();
      expect(addButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables attendance buttons when isUpdating is true', () => {
      renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={mockAttendees} isUpdating={true} />
      );

      const attendedButtons = screen.getAllByRole('button', { name: /mark as attended/i });
      attendedButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('disables quick action buttons when isAdding is true', () => {
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={[mockAttendees[0]]}
          teamMembers={mockTeamMembers}
          isAdding={true}
        />
      );

      // Quick action buttons in unmarked section should be disabled
      const attendedButtons = screen.getAllByTitle('Mark as attended');
      expect(attendedButtons[0]).toBeDisabled();
    });
  });

  describe('Accessibility Tests', () => {
    it('has correct heading structure', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      const heading = screen.getByRole('heading', { name: /attendees/i });
      expect(heading).toBeInTheDocument();
    });

    it('filter tabs have correct ARIA attributes', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={mockAttendees} />);

      const filterGroup = screen.getByRole('radiogroup', { name: /filter attendees/i });
      expect(filterGroup).toBeInTheDocument();

      const allTab = screen.getByRole('radio', { name: /all/i });
      expect(allTab).toHaveAttribute('aria-checked');
    });

    it('attendance buttons have aria-pressed attribute', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[0]]} />);

      const attendedButton = screen.getByRole('button', { name: /mark as attended/i });
      expect(attendedButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('modal has correct ARIA attributes when open', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('form inputs have correct labels', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AttendeesSection {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add attendees/i });
      await user.click(addButton);

      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles attendee with no email', () => {
      const attendeeWithoutEmail = { ...mockAttendees[2] };
      renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={[attendeeWithoutEmail]} />
      );

      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('handles attendee with no userId', () => {
      const attendeeWithoutUserId = { ...mockAttendees[1], userId: undefined };
      renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={[attendeeWithoutUserId]} />
      );

      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('handles team member with no user data', () => {
      const teamMemberWithoutUser = {
        id: 'team-4',
        role: 'Unknown Role',
      } as TeamMember;

      renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={[]} teamMembers={[teamMemberWithoutUser]} />
      );

      // Should not crash
      expect(screen.getByText('Attendees')).toBeInTheDocument();
    });

    it('handles single name (no space) for initials', () => {
      const singleNameAttendee = { ...mockAttendees[0], name: 'Madonna' };
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[singleNameAttendee]} />);

      // Should show 'M' (first letter of single name, sliced to max 2 chars)
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('handles empty name for initials', () => {
      const emptyNameAttendee = { ...mockAttendees[0], name: '' };
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[emptyNameAttendee]} />);

      expect(screen.getByText('??')).toBeInTheDocument();
    });
  });

  describe('Custom ClassName Tests', () => {
    it('applies custom className to section', () => {
      const { container } = renderWithProviders(
        <AttendeesSection {...defaultProps} className="custom-section" />
      );

      const section = container.querySelector('.attendees-section');
      expect(section).toHaveClass('custom-section');
    });
  });

  describe('Integration Tests', () => {
    it('filters attendees correctly when switching tabs', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          attendees={mockAttendees}
          teamMembers={mockTeamMembers}
        />
      );

      // Click on Guests tab
      const guestsTab = screen.getByRole('radio', { name: /guests/i });
      await user.click(guestsTab);

      // Should show only non-team attendees
      expect(guestsTab).toHaveAttribute('aria-checked', 'true');
    });

    it('maintains state when props change', () => {
      const { rerender } = renderWithProviders(
        <AttendeesSection {...defaultProps} attendees={mockAttendees} />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();

      const newAttendees = [
        ...mockAttendees,
        { ...mockAttendees[0], id: 'attendee-4', name: 'New Person' },
      ];
      rerender(<AttendeesSection {...defaultProps} attendees={newAttendees} />);

      expect(screen.getByText('New Person')).toBeInTheDocument();
    });
  });

  describe('Registered User Link Tests', () => {
    it('marks an attendee linked to a registered user with a badge', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[0]!]} />);

      expect(screen.getByText('Registered user')).toBeInTheDocument();
    });

    it('does not badge an external stakeholder', () => {
      renderWithProviders(<AttendeesSection {...defaultProps} attendees={[mockAttendees[2]!]} />);

      expect(screen.queryByText('Registered user')).not.toBeInTheDocument();
    });

    it('links an attendee to a registered user and sends the user id', async () => {
      const user = userEvent.setup();
      const addAttendee = vi.fn().mockResolvedValue({});
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          apiConfig={{ ...defaultProps.apiConfig, addAttendee }}
          teamMembers={mockTeamMembers}
        />
      );

      await user.click(screen.getByRole('button', { name: /add attendees/i }));

      await user.selectOptions(screen.getByLabelText(/registered user/i), 'user-2');

      // The linked account supplies the display fields, so they are no longer free text.
      expect(screen.getByLabelText(/name/i)).toHaveValue('Alice Johnson');
      expect(screen.getByLabelText(/name/i)).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /^add attendee$/i }));

      await waitFor(() => {
        expect(addAttendee).toHaveBeenCalled();
      });
      // React Query passes the mutation context as a second argument, so assert the payload.
      expect(addAttendee.mock.calls[0]![0]).toEqual(
        expect.objectContaining({ userId: 'user-2', name: 'Alice Johnson' })
      );
    });

    it('keeps the free-text path for an external stakeholder', async () => {
      const user = userEvent.setup();
      const addAttendee = vi.fn().mockResolvedValue({});
      renderWithProviders(
        <AttendeesSection
          {...defaultProps}
          apiConfig={{ ...defaultProps.apiConfig, addAttendee }}
          teamMembers={mockTeamMembers}
        />
      );

      await user.click(screen.getByRole('button', { name: /add attendees/i }));

      const nameInput = screen.getByLabelText(/name/i);
      expect(nameInput).not.toBeDisabled();
      await user.type(nameInput, 'External Person');
      await user.click(screen.getByRole('button', { name: /^add attendee$/i }));

      await waitFor(() => {
        expect(addAttendee).toHaveBeenCalled();
      });
      expect(addAttendee.mock.calls[0]![0]).toEqual(
        expect.objectContaining({ userId: null, name: 'External Person' })
      );
    });
  });
});
