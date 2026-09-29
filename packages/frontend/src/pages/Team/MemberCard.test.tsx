import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll } from 'vitest';

import { MemberCard } from './MemberCard';

// Mock SendMessageModal. It renders a close control (when open) so the card's own
// open/close handlers can be exercised without depending on the real modal's internals.
vi.mock('./SendMessageModal', () => ({
  SendMessageModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <button onClick={onClose}>close-message-modal</button> : null,
}));

// Mock useModalFocus
vi.mock('../../hooks/useModalFocus', () => ({
  useModalFocus: vi.fn(() => ({ modalRef: { current: null } })),
}));

const mockMember = {
  id: 'member-1',
  teamId: 'team-1',
  userId: 'user-1',
  role: 'developers',
  joinedAt: '2024-01-01T00:00:00Z',
  user: {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

const defaultProps = {
  member: mockMember,
  canRemove: true,
  onDelete: vi.fn(),
  isDeleting: false,
  viewMode: 'card' as const,
};

const setup = (overrides = {}) => {
  const props = { ...defaultProps, ...overrides };
  return {
    render: () => renderWithProviders(<MemberCard {...props} />),
    props,
  };
};

describe('MemberCard', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render member information in card view', () => {
      const { render } = setup();
      render();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Developers')).toBeInTheDocument();
    });

    test('should render member information in list view', () => {
      const { render } = setup({ viewMode: 'list' });
      render();

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    test('should display initials in avatar', () => {
      const { render } = setup();
      render();

      const avatar = screen.getByText('JD');
      expect(avatar).toBeInTheDocument();
    });

    test('should handle user without first or last name', () => {
      const { render } = setup({
        member: {
          ...mockMember,
          user: {
            ...mockMember.user,
            firstName: undefined,
            lastName: undefined,
          },
        },
      });
      render();

      expect(screen.getAllByText('john@example.com')).toHaveLength(2);
    });

    test('should display correct role badge for product owner', () => {
      const { render } = setup({
        member: { ...mockMember, role: 'product_owner' },
      });
      render();

      expect(screen.getByText('Product Owner')).toBeInTheDocument();
    });

    test('should display correct role badge for scrum master', () => {
      const { render } = setup({
        member: { ...mockMember, role: 'scrum_master' },
      });
      render();

      expect(screen.getByText('Scrum Master')).toBeInTheDocument();
    });

    test('should not display delete button when canRemove is false', () => {
      const { render } = setup({ canRemove: false });
      render();

      expect(screen.queryByLabelText(/remove/i)).not.toBeInTheDocument();
    });

    test('should display delete button when canRemove is true', () => {
      const { render } = setup({ canRemove: true });
      render();

      const deleteButton = screen.getByLabelText(/remove/i);
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    test('should call onDelete when delete button is clicked', () => {
      const onDelete = vi.fn();
      const { render } = setup({ onDelete });
      render();

      const deleteButton = screen.getByLabelText(/remove/i);
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith(mockMember);
    });

    test('should disable delete button when isDeleting is true', () => {
      const { render } = setup({ isDeleting: true });
      render();

      const deleteButton = screen.getByLabelText(/remove/i);
      expect(deleteButton).toBeDisabled();
    });

    test('opens the send-message modal and closes it again from the card view', () => {
      const { render } = setup();
      render();

      fireEvent.click(screen.getByLabelText(/send message/i));
      const modal = screen.getByText('close-message-modal');
      expect(modal).toBeInTheDocument();

      fireEvent.click(modal);
      expect(screen.queryByText('close-message-modal')).not.toBeInTheDocument();
    });

    test('opens the send-message modal and closes it again from the list view', () => {
      const { render } = setup({ viewMode: 'list' });
      render();

      fireEvent.click(screen.getByLabelText(/send message/i));
      const modal = screen.getByText('close-message-modal');
      expect(modal).toBeInTheDocument();

      fireEvent.click(modal);
      expect(screen.queryByText('close-message-modal')).not.toBeInTheDocument();
    });
  });
});
