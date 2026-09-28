import React from 'react';
import { screen, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

import { PbiPreviewModal, type PbiPreviewModalProps } from './PbiPreviewModal';
import { ItemStatus, MoSCoWPriority, TaskStatus, type ProductBacklogItem } from '../../../../types';
import { apiService, definitionService } from '../../../../services';

beforeAll(async () => {
  await initTestI18n();
});

// By default the previewed PBI has one DONE child task so the "ready to done" state is active.
beforeEach(() => {
  vi.mocked(apiService.getTasksByPbiId).mockResolvedValue({
    data: [{ id: 'task-1', title: 'Task 1', status: TaskStatus.DONE }],
  } as never);
});

vi.mock('../../../../services', () => ({
  apiService: {
    getTasksByPbiId: vi.fn(),
    updateProductBacklogItem: vi.fn(),
  },
  definitionService: {
    getDefinitionOfDone: vi.fn(),
    verifyDoDForPBI: vi.fn(),
  },
}));

const createMockPBI = (overrides: Partial<ProductBacklogItem> = {}): ProductBacklogItem => ({
  id: 'pbi-1',
  teamId: 'team-1',
  title: 'User Authentication',
  priority: MoSCoWPriority.MUST_HAVE,
  storyPoints: 5,
  businessValue: 13,
  status: ItemStatus.READY,
  labels: ['auth'],
  description: 'Users can log in securely.',
  acceptanceCriteria: 'Password reset works.',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  ...overrides,
});

const defaultProps: PbiPreviewModalProps = {
  item: createMockPBI(),
  canMutate: true,
  teamId: 'team-1',
  onClose: vi.fn(),
  onMarkedDone: vi.fn(),
};

describe('PbiPreviewModal', () => {
  it('should render the PBI details', () => {
    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    expect(screen.getByText('User Authentication')).toBeInTheDocument();
    expect(screen.getByText('Users can log in securely.')).toBeInTheDocument();
    expect(screen.getByText('Password reset works.')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
  });

  it('should render the translated status label (not a raw i18n key)', () => {
    renderWithProviders(
      <PbiPreviewModal {...defaultProps} item={createMockPBI({ status: ItemStatus.IN_PROGRESS })} />
    );

    // "In Progress" is the backlog-namespace translation for status.inProgress.
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.queryByText('status.inProgress')).not.toBeInTheDocument();
  });

  it('should not render anything when item is null', () => {
    renderWithProviders(<PbiPreviewModal {...defaultProps} item={null} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render a "done" notice for an already-done PBI', () => {
    renderWithProviders(
      <PbiPreviewModal {...defaultProps} item={createMockPBI({ status: ItemStatus.DONE })} />
    );

    expect(screen.getByText(/already been marked as done/i)).toBeInTheDocument();
    // No mark-done action for a done PBI.
    expect(screen.queryByRole('button', { name: /Mark PBI as done/i })).not.toBeInTheDocument();
  });

  it('should not render the mark-done action when canMutate is false', () => {
    renderWithProviders(<PbiPreviewModal {...defaultProps} canMutate={false} />);

    expect(screen.queryByRole('button', { name: /Mark PBI as done/i })).not.toBeInTheDocument();
  });

  it('should not render the mark-done action for a PBI that is not ready to be done', () => {
    renderWithProviders(
      <PbiPreviewModal {...defaultProps} item={createMockPBI({ status: ItemStatus.NEW })} />
    );

    expect(screen.queryByRole('button', { name: /Mark PBI as done/i })).not.toBeInTheDocument();
  });

  it('should not offer to mark the PBI as done while child tasks are incomplete', async () => {
    vi.mocked(apiService.getTasksByPbiId).mockResolvedValue({
      data: [{ id: 'task-1', title: 'Task 1', status: TaskStatus.IN_PROGRESS }],
    } as never);

    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Not all child tasks are done yet/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /Open the Definition of Done check/i })
    ).not.toBeInTheDocument();
  });

  it('should show the DoD checklist and mark the PBI done on confirm', async () => {
    vi.mocked(apiService.getTasksByPbiId).mockResolvedValue({
      data: [{ id: 'task-1', title: 'Task 1', status: TaskStatus.DONE }],
    } as never);
    vi.mocked(definitionService.getDefinitionOfDone).mockResolvedValue({
      success: true,
      data: {
        id: 'dod-1',
        teamId: 'team-1',
        items: [
          {
            id: 'dod-item-1',
            description: 'Code is peer-reviewed and approved',
            category: 'quality',
            isActive: true,
            order: 1,
          },
          {
            id: 'dod-item-2',
            description: 'Tests passing',
            category: 'testing',
            isActive: true,
            order: 2,
          },
        ],
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
      },
    } as never);
    vi.mocked(definitionService.verifyDoDForPBI).mockResolvedValue({
      success: true,
      data: [],
    } as never);
    vi.mocked(apiService.updateProductBacklogItem).mockResolvedValue({
      success: true,
      data: createMockPBI({ status: ItemStatus.DONE }),
    } as never);
    const onClose = vi.fn();
    const onMarkedDone = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PbiPreviewModal {...defaultProps} onClose={onClose} onMarkedDone={onMarkedDone} />
    );

    // The mark-done action appears once the child-task check completes.
    const markDoneButton = await screen.findByRole('button', {
      name: /Open the Definition of Done check/i,
    });
    await user.click(markDoneButton);

    // DoD checklist appears.
    expect(screen.getByText('Code is peer-reviewed and approved')).toBeInTheDocument();
    expect(screen.getByText('Tests passing')).toBeInTheDocument();

    // Check both criteria.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);

    await user.click(screen.getByRole('button', { name: /Confirm/i }));

    expect(definitionService.verifyDoDForPBI).toHaveBeenCalledWith('pbi-1', [
      { dodItemId: 'dod-item-1', isVerified: true },
      { dodItemId: 'dod-item-2', isVerified: true },
    ]);
    expect(apiService.updateProductBacklogItem).toHaveBeenCalledWith('pbi-1', {
      status: ItemStatus.DONE,
    });
    expect(onMarkedDone).toHaveBeenCalledWith('pbi-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('should scroll the modal body to the DoD section after opening the checklist', async () => {
    vi.mocked(apiService.getTasksByPbiId).mockResolvedValue({
      data: [{ id: 'task-1', title: 'Task 1', status: TaskStatus.DONE }],
    } as never);
    vi.mocked(definitionService.getDefinitionOfDone).mockResolvedValue({
      success: true,
      data: {
        id: 'dod-1',
        teamId: 'team-1',
        items: [
          {
            id: 'dod-item-1',
            description: 'Code is peer-reviewed and approved',
            category: 'quality',
            isActive: true,
            order: 1,
          },
        ],
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
      },
    } as never);
    const user = userEvent.setup();

    // jsdom does not implement element.scrollTo, so provide a stub then spy on it.
    HTMLElement.prototype.scrollTo = vi.fn();
    const scrollToSpy = vi.spyOn(HTMLElement.prototype, 'scrollTo');

    try {
      renderWithProviders(<PbiPreviewModal {...defaultProps} />);

      const markDoneButton = await screen.findByRole('button', {
        name: /Open the Definition of Done check/i,
      });
      await user.click(markDoneButton);

      // The modal body is scrolled to reveal the DoD checklist.
      await waitFor(() => {
        expect(scrollToSpy).toHaveBeenCalled();
      });
      const call = scrollToSpy.mock.calls[0]![0] as ScrollToOptions;
      expect(call.behavior).toBe('smooth');
      expect(typeof call.top).toBe('number');
    } finally {
      scrollToSpy.mockRestore();
      delete (HTMLElement.prototype as unknown as { scrollTo?: unknown }).scrollTo;
    }
  });
});

describe('PbiPreviewModal - mark-as-done edge cases', () => {
  const doneTasks = { data: [{ id: 'task-1', title: 'Task 1', status: TaskStatus.DONE }] } as never;
  const dodResponse = {
    success: true,
    data: {
      id: 'dod-1',
      teamId: 'team-1',
      items: [
        {
          id: 'dod-item-1',
          description: 'Tests passing',
          category: 'testing',
          isActive: true,
          order: 1,
        },
      ],
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
    },
  } as never;

  it('treats a failed child-task check as not-all-done', async () => {
    vi.mocked(apiService.getTasksByPbiId).mockRejectedValue(new Error('offline'));

    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Not all child tasks are done yet/i)).toBeInTheDocument();
    });
  });

  it('closes when the overlay itself is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<PbiPreviewModal {...defaultProps} onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog.parentElement as HTMLElement);

    expect(onClose).toHaveBeenCalled();
  });

  it('refuses to open the checklist while child tasks remain, naming them', async () => {
    vi.mocked(apiService.getTasksByPbiId)
      .mockResolvedValueOnce(doneTasks)
      .mockResolvedValueOnce({
        data: [
          { id: 't1', title: 'A', status: TaskStatus.IN_PROGRESS },
          { id: 't2', title: 'B', status: TaskStatus.TODO },
          { id: 't3', title: 'C', status: TaskStatus.TODO },
          { id: 't4', title: 'D', status: TaskStatus.TODO },
        ],
      } as never);
    const user = userEvent.setup();

    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    const markDone = await screen.findByRole('button', {
      name: /Open the Definition of Done check/i,
    });
    await user.click(markDone);

    await waitFor(() => {
      expect(screen.getByText(/Cannot mark as done/i)).toBeInTheDocument();
    });
  });

  it('reports a failure to re-check the child tasks', async () => {
    vi.mocked(apiService.getTasksByPbiId)
      .mockResolvedValueOnce(doneTasks)
      .mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();

    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    const markDone = await screen.findByRole('button', {
      name: /Open the Definition of Done check/i,
    });
    await user.click(markDone);

    await waitFor(() => {
      expect(screen.getByText(/Failed to check child tasks/i)).toBeInTheDocument();
    });
  });

  it('cannot load the Definition of Done without an active team', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PbiPreviewModal {...defaultProps} teamId={undefined} />);

    const markDone = await screen.findByRole('button', {
      name: /Open the Definition of Done check/i,
    });
    await user.click(markDone);

    await waitFor(() => {
      expect(screen.getByText(/No active team is available/i)).toBeInTheDocument();
    });
  });

  it('reports a failure to load the Definition of Done', async () => {
    vi.mocked(apiService.getTasksByPbiId).mockResolvedValue(doneTasks);
    vi.mocked(definitionService.getDefinitionOfDone).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    const markDone = await screen.findByRole('button', {
      name: /Open the Definition of Done check/i,
    });
    await user.click(markDone);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load the Definition of Done/i)).toBeInTheDocument();
    });
  });

  it('reports a failed mark-done, then dismisses the error banner', async () => {
    vi.mocked(apiService.getTasksByPbiId).mockResolvedValue(doneTasks);
    vi.mocked(definitionService.getDefinitionOfDone).mockResolvedValue(dodResponse);
    vi.mocked(definitionService.verifyDoDForPBI).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();

    renderWithProviders(<PbiPreviewModal {...defaultProps} />);

    await user.click(
      await screen.findByRole('button', { name: /Open the Definition of Done check/i })
    );

    const checkbox = await screen.findByRole('checkbox');
    await user.click(checkbox);

    await user.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to mark the PBI as done/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Dismiss error' }));

    await waitFor(() => {
      expect(screen.queryByText(/Failed to mark the PBI as done/i)).not.toBeInTheDocument();
    });
  });
});
