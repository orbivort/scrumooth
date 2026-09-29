/**
 * IncrementDetail — supplementary coverage tests.
 *
 * Exercises the delivery dialog controls (close, overlay, Escape, method selection, notes) and the
 * presentation of an Increment that lacks optional detail. Uses the real focus hook so the
 * Escape-to-close wiring is covered.
 */
import React from 'react';
import {
  screen,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, beforeAll } from 'vitest';

import { IncrementDetail } from './IncrementDetail';
import { apiService } from '../../services';
import { useToast } from '../../hooks/useToast';
import { IncrementStatus, DeliveryMethod } from '../../types';

vi.mock('../../services');
vi.mock('../../hooks/useToast');

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

describe('IncrementDetail coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  const baseIncrement = {
    id: 'inc-1',
    name: 'Test Increment',
    description: 'Test description',
    status: IncrementStatus.VERIFIED,
    teamId: 'team-1',
    sprintId: 'sprint-1',
    sprint: { id: 'sprint-1', name: 'Sprint 1' },
    totalStoryPoints: 21,
    includedPBIs: ['pbi-1'],
    integrationVerified: true,
    usabilityVerified: true,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      toasts: [],
      success: vi.fn(),
      error: vi.fn(),
      removeToast: vi.fn(),
    });
    mockUseParams.mockReturnValue({ id: 'inc-1' });
    (apiService.getIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: baseIncrement,
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI One', labels: [] }],
    });
    (apiService.deliverIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  const renderComponent = () =>
    renderWithProviders(<IncrementDetail />, { initialRoute: '/increment/inc-1' });

  const openDeliverModal = async () => {
    const deliverButton = await screen.findByRole('button', {
      name: i18nT('increments:detail.deliverIncrement'),
    });
    fireEvent.click(deliverButton);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  };

  it('closes the delivery dialog with the close control, the overlay and Escape', async () => {
    renderComponent();
    await openDeliverModal();

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('increments:detail.deliverModal.closeDialog') })
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await openDeliverModal();
    fireEvent.click(screen.getByRole('presentation'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await openDeliverModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('records the delivery method and the delivery notes', async () => {
    renderComponent();
    await openDeliverModal();

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    fireEvent.click(radios[1]);
    fireEvent.change(
      screen.getByPlaceholderText(i18nT('increments:detail.deliverModal.notesPlaceholder')),
      { target: { value: 'Shipped early' } }
    );

    fireEvent.click(screen.getByLabelText(/I understand this action/i));
    fireEvent.click(
      screen.getByRole('button', { name: i18nT('increments:detail.deliverModal.confirm') })
    );

    await waitFor(() =>
      expect(apiService.deliverIncrement).toHaveBeenCalledWith(
        'inc-1',
        DeliveryMethod.EARLY_RELEASE,
        'Shipped early'
      )
    );
  });

  it('renders an increment that lacks optional detail', async () => {
    (apiService.getIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        id: 'inc-1',
        name: 'Sparse Increment',
        status: IncrementStatus.DRAFT,
        teamId: 'team-1',
        sprintId: 'sprint-1',
        includedPBIs: [],
        integrationVerified: true,
        usabilityVerified: true,
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'user-1',
      },
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText('Sparse Increment')).toBeInTheDocument());
    expect(screen.getByText(i18nT('increments:detail.overview.noDescription'))).toBeInTheDocument();
    expect(
      screen.getByText(i18nT('increments:detail.dodVerification.noVerifications'))
    ).toBeInTheDocument();
  });

  it('presents an early-released increment with its deliverables', async () => {
    (apiService.getIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        ...baseIncrement,
        status: IncrementStatus.DELIVERED,
        deliveryMethod: DeliveryMethod.EARLY_RELEASE,
        deliveredAt: '2026-01-15T00:00:00Z',
        deliverer: { id: 'user-2', firstName: 'Ada', lastName: 'Lovelace' },
        usabilityVerifier: { id: 'user-3', firstName: 'Grace', lastName: 'Hopper' },
      },
    });
    (apiService.getEligiblePBIsForIncrement as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'pbi-1', title: 'PBI One', labels: [] }],
    });

    renderComponent();

    await waitFor(() =>
      expect(
        screen.getByText(i18nT('increments:detail.timeline.deliveredViaEarlyRelease'))
      ).toBeInTheDocument()
    );
  });
});
