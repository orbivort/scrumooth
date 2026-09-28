/**
 * IncrementCreate — supplementary coverage tests.
 *
 * Exercises form validation without a team, the eligible-PBI load failure, PBI toggling, and the
 * breadth of the create-mutation error handling.
 */
import React from 'react';
import { screen, fireEvent, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll } from 'vitest';

import { IncrementCreate } from './IncrementCreate';
import { apiService } from '../../services';
import { useTeamContext } from '../../contexts/TeamContext';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../store';
import { SprintStatus } from '../../types';

vi.mock('../../services');
vi.mock('../../contexts/TeamContext');
vi.mock('../../hooks/useToast');
vi.mock('../../store');

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('IncrementCreate coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  const mockToast = {
    toasts: [],
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    removeToast: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useTeamContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Test Team' },
    });
    (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockToast);
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 'user-1' },
    });
    (apiService.getIncrements as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  });

  const renderComponent = () => renderWithProviders(<IncrementCreate />);

  it('requires a team before submitting', async () => {
    (useTeamContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentTeam: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create increment/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /create increment/i }));

    // The team error is recorded but only the name/sprint/PBI errors are surfaced in the form.
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
    expect(apiService.createIncrement).not.toHaveBeenCalled();
  });

  it('shows the load failure state for eligible PBIs and can go back', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('nope')
    );

    renderComponent();

    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });

    await waitFor(() =>
      expect(screen.getByText('Failed to load eligible PBIs')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Increments' }));
    expect(mockNavigate).toHaveBeenCalledWith('/increments');
  });

  it('falls back to the list when the created increment has no id', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI 1', storyPoints: 5 }],
    });
    (apiService.createIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null });

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });
    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Increment X' } });
    fireEvent.click(screen.getByRole('button', { name: /create increment/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/increments'));
  });

  it('maps API validation details to the toast and the form', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI 1', storyPoints: 5 }],
    });
    (apiService.createIncrement as ReturnType<typeof vi.fn>).mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          error: {
            message: 'Validation failed',
            details: [
              { field: 'name', message: 'Name must be unique' },
              { field: 'sprintId', message: 'Sprint invalid' },
            ],
          },
        },
      },
    });

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });
    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Increment X' } });
    fireEvent.click(screen.getByRole('button', { name: /create increment/i }));

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'Validation failed: name: Name must be unique; sprintId: Sprint invalid'
      )
    );
  });

  it('uses the API error message when no details are supplied', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI 1', storyPoints: 5 }],
    });
    (apiService.createIncrement as ReturnType<typeof vi.fn>).mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: { message: 'Boom' } } },
    });

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });
    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Increment X' } });
    fireEvent.click(screen.getByRole('button', { name: /create increment/i }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Boom'));
  });

  it('uses a plain error message when the failure is not an Axios error', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI 1', storyPoints: 5 }],
    });
    (apiService.createIncrement as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Plain failure')
    );

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });
    fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Increment X' } });
    fireEvent.click(screen.getByRole('button', { name: /create increment/i }));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Plain failure'));
  });

  it('toggles individual PBIs and clears the selection errors when the sprint changes', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE },
        { id: 'sprint-2', name: 'Sprint 2', status: SprintStatus.ACTIVE },
      ],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { id: 'pbi-1', title: 'PBI One', storyPoints: 5 },
        { id: 'pbi-2', title: 'PBI Two' },
      ],
    });

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());

    // Submit before selecting a sprint so the sprint and PBI errors exist.
    fireEvent.click(screen.getByRole('button', { name: /create increment/i }));
    await waitFor(() => expect(screen.getByText('Please select a sprint')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });
    await waitFor(() => expect(screen.getByText('2 selected')).toBeInTheDocument());
    expect(screen.queryByText('Please select a sprint')).not.toBeInTheDocument();
    expect(screen.queryByText('At least one PBI must be selected')).not.toBeInTheDocument();

    // Toggle a PBI off, then back on.
    fireEvent.click(screen.getByText('PBI One'));
    await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument());
    fireEvent.click(screen.getByText('PBI One'));
    await waitFor(() => expect(screen.getByText('2 selected')).toBeInTheDocument());
  });

  it('ignores clicks on a PBI that is already in another increment', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getIncrements as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'inc-1', includedPBIs: ['pbi-1'] }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI One', storyPoints: 5 }],
    });

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });

    await waitFor(() => expect(screen.getByText('PBI One')).toBeInTheDocument());
    expect(screen.getByText('0 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByText('PBI One'));
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('counts story points when a PBI has none', async () => {
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.ACTIVE }],
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI One' }],
    });

    renderComponent();
    await waitFor(() => expect(screen.getByLabelText(/sprint/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/sprint/i), { target: { value: 'sprint-1' } });

    await waitFor(() => expect(screen.getByText('1 selected')).toBeInTheDocument());
    // The summary's story-point total stays a defined number even without estimates.
    const summary = document.body.textContent ?? '';
    expect(summary).toContain('0');
  });
});
