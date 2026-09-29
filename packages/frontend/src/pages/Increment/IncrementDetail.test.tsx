/**
 * IncrementDetail Component Tests
 *
 * Test Coverage:
 * - Loading states
 * - Error states
 * - Increment detail display
 * - Delivery modal functionality
 * - Navigation (back button)
 * - DoD verification display
 * - PBI list display
 * - Timeline display
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

// Mocks
vi.mock('../../services');
vi.mock('../../hooks/useToast');
vi.mock('../../hooks/useModalFocus', () => ({
  useModalFocus: vi.fn(() => ({
    modalRef: { current: null },
    handleKeyDown: vi.fn(),
  })),
}));

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

describe('IncrementDetail', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  const mockIncrement = {
    id: 'inc-1',
    name: 'Test Increment',
    description: 'Test description',
    status: IncrementStatus.VERIFIED,
    teamId: 'team-1',
    sprintId: 'sprint-1',
    sprint: { id: 'sprint-1', name: 'Sprint 1' },
    totalStoryPoints: 21,
    includedPBIs: ['pbi-1', 'pbi-2', 'pbi-3'],
    // An Increment that has walked both gates: additive to prior Increments, and attested usable.
    integrationVerified: true,
    usabilityVerified: true,
    usabilityEvidence: 'Exercised by the Product Owner in staging',
    usabilityVerifiedAt: '2026-01-09T00:00:00Z',
    usabilityVerifier: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
    dodVerifications: [
      {
        id: 'ver-1',
        pbiId: 'pbi-1',
        dodItemId: 'dod-1',
        isVerified: true,
        verifiedBy: 'user-1',
        verifiedAt: '2026-01-10T00:00:00Z',
        dodItemDescription: 'Code reviewed',
        dodItemCategory: 'quality',
      },
      {
        id: 'ver-2',
        pbiId: 'pbi-1',
        dodItemId: 'dod-2',
        isVerified: true,
        verifiedBy: 'user-1',
        verifiedAt: '2026-01-10T00:00:00Z',
        dodItemDescription: 'Tests passed',
        dodItemCategory: 'testing',
      },
      {
        id: 'ver-3',
        pbiId: 'pbi-2',
        dodItemId: 'dod-1',
        isVerified: false,
        verifiedBy: 'user-1',
        verifiedAt: '2026-01-10T00:00:00Z',
        dodItemDescription: 'Code reviewed',
        dodItemCategory: 'quality',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
  };

  const mockEligiblePBIs = [
    {
      id: 'pbi-1',
      title: 'PBI One',
      storyPoints: 8,
      labels: ['frontend', 'urgent'],
    },
    {
      id: 'pbi-2',
      title: 'PBI Two',
      storyPoints: 5,
      labels: ['backend'],
    },
    {
      id: 'pbi-3',
      title: 'PBI Three',
      storyPoints: 8,
      labels: [],
    },
  ];

  const mockToast = {
    toasts: [],
    success: vi.fn(),
    error: vi.fn(),
    removeToast: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as vi.Mock).mockReturnValue(mockToast);
    mockUseParams.mockReturnValue({ id: 'inc-1' });
  });

  const renderComponent = (initialEntries = ['/increment/inc-1']) => {
    return renderWithProviders(<IncrementDetail />, { initialRoute: initialEntries[0] });
  };

  describe('Loading States', () => {
    it('should show loading state while fetching increment', () => {
      (apiService.getIncrement as vi.Mock).mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByText(i18nT('increments:detail.loading'))).toBeInTheDocument();
    });

    it('should show loading spinner', () => {
      (apiService.getIncrement as vi.Mock).mockImplementation(() => new Promise(() => {}));

      const { container } = renderComponent();

      expect(container.querySelector('[class*="loading-spinner"]')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should show error state when increment fetch fails', async () => {
      (apiService.getIncrement as vi.Mock).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.error.title'))).toBeInTheDocument();
      });
    });

    it('should show error details when available', async () => {
      (apiService.getIncrement as vi.Mock).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('should have back button in error state', async () => {
      (apiService.getIncrement as vi.Mock).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('increments:detail.error.backToIncrements'))
        ).toBeInTheDocument();
      });
    });

    it('should navigate back on error state button click', async () => {
      (apiService.getIncrement as vi.Mock).mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('increments:detail.error.backToIncrements'))
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.error.backToIncrements')));

      expect(mockNavigate).toHaveBeenCalledWith('/increments');
    });
  });

  describe('Increment Detail Display', () => {
    beforeEach(() => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: mockIncrement,
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });
    });

    it('should display increment name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Increment')).toBeInTheDocument();
      });
    });

    it('should display increment status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('VERIFIED')).toBeInTheDocument();
      });
    });

    it('should display increment description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test description')).toBeInTheDocument();
      });
    });

    it('should display sprint name', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });
    });

    it('should display story points', async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Increment')).toBeInTheDocument();
      });

      const detailGrid = container.querySelector('[class*="detail-grid"]');
      expect(detailGrid?.textContent).toContain('21');
    });

    it('should display PBIs count', async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Increment')).toBeInTheDocument();
      });

      const detailGrid = container.querySelector('[class*="detail-grid"]');
      expect(detailGrid?.textContent).toContain('3');
    });

    it('should display created date', async () => {
      const { container } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Increment')).toBeInTheDocument();
      });

      // Check for Created label in the info grid
      expect(container.textContent).toContain('Created');
    });
  });

  describe('Back Button Navigation', () => {
    beforeEach(() => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: mockIncrement,
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });
    });

    it('should show back button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:backToIncrements'))).toBeInTheDocument();
      });
    });

    it('should navigate back to increments list', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:backToIncrements'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:backToIncrements')));

      expect(mockNavigate).toHaveBeenCalledWith('/increments');
    });
  });

  describe('Deliver Button', () => {
    it('should show deliver button for VERIFIED status', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: { ...mockIncrement, status: IncrementStatus.VERIFIED },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });
    });

    it('should show deliver button for DRAFT status when integration is verified', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: { ...mockIncrement, status: IncrementStatus.DRAFT, integrationVerified: true },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });

      renderComponent();

      const deliverButton = await screen.findByRole('button', {
        name: i18nT('increments:detail.deliverIncrement'),
      });
      expect(deliverButton).toBeEnabled();
    });

    it('should disable deliver with an explanation when the usable condition is not attested', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: {
          ...mockIncrement,
          status: IncrementStatus.DRAFT,
          integrationVerified: true,
          usabilityVerified: false,
        },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });

      renderComponent();

      const deliverButton = await screen.findByRole('button', {
        name: i18nT('increments:detail.deliverIncrement'),
      });

      expect(deliverButton).toBeDisabled();
      expect(deliverButton).toHaveAttribute(
        'data-disabled-reason',
        'detail.deliverRequiresUsability'
      );
    });

    it('should disable deliver button for DRAFT status when integration is not verified', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: { ...mockIncrement, status: IncrementStatus.DRAFT, integrationVerified: false },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });

      renderComponent();

      const deliverButton = await screen.findByRole('button', {
        name: i18nT('increments:detail.deliverIncrement'),
      });

      expect(deliverButton).toBeInTheDocument();
      expect(deliverButton).toBeDisabled();
      expect(deliverButton).toHaveAttribute(
        'data-disabled-reason',
        'detail.deliverRequiresIntegration'
      );
    });

    it('should not show deliver button for DELIVERED status', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: {
          ...mockIncrement,
          status: IncrementStatus.DELIVERED,
          deliveredAt: '2026-01-15T00:00:00Z',
        },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Increment')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18nT('increments:detail.deliverIncrement'))
      ).not.toBeInTheDocument();
    });

    it('should not show deliver button for ARCHIVED status', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: { ...mockIncrement, status: IncrementStatus.ARCHIVED },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test Increment')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18nT('increments:detail.deliverIncrement'))
      ).not.toBeInTheDocument();
    });
  });

  describe('Delivery Modal', () => {
    beforeEach(() => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: { ...mockIncrement, status: IncrementStatus.VERIFIED },
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });
      (apiService.deliverIncrement as vi.Mock).mockResolvedValue({});
    });

    it('should open delivery modal on deliver button click', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(
        screen.getByText(i18nT('increments:detail.deliverModal.modalDescription'))
      ).toBeInTheDocument();
    });

    it('should show delivery method options', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(screen.getByText(i18nT('increments:deliveryMethod.sprintReview'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('increments:deliveryMethod.earlyRelease'))).toBeInTheDocument();
    });

    it('should have notes textarea', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Check for textarea in the modal
      const dialog = screen.getByRole('dialog');
      expect(dialog.querySelector('textarea')).toBeInTheDocument();
    });

    it('should have confirmation checkbox', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText(
          new RegExp(i18nT('increments:detail.deliverModal.checkboxText').substring(0, 20))
        )
      ).toBeInTheDocument();
    });

    it('should disable confirm button without checkbox checked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', {
        name: i18nT('increments:detail.deliverModal.confirm'),
      });
      expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when checkbox is checked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(
        new RegExp(i18nT('increments:detail.deliverModal.checkboxText').substring(0, 20))
      );
      fireEvent.click(checkbox);

      const confirmButton = screen.getByRole('button', {
        name: i18nT('increments:detail.deliverModal.confirm'),
      });
      expect(confirmButton).not.toBeDisabled();
    });

    it('should call deliver mutation on confirm', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(
        new RegExp(i18nT('increments:detail.deliverModal.checkboxText').substring(0, 20))
      );
      fireEvent.click(checkbox);

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('increments:detail.deliverModal.confirm') })
      );

      await waitFor(() => {
        expect(apiService.deliverIncrement).toHaveBeenCalledWith(
          'inc-1',
          DeliveryMethod.SPRINT_REVIEW,
          ''
        );
      });
    });

    it('should close modal on cancel', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('increments:detail.deliverModal.cancel') })
      );

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should show success toast on successful delivery', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(
        new RegExp(i18nT('increments:detail.deliverModal.checkboxText').substring(0, 20))
      );
      fireEvent.click(checkbox);

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('increments:detail.deliverModal.confirm') })
      );

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          i18nT('increments:detail.toast.deliveredSuccess')
        );
      });
    });

    it('should show error toast on delivery failure', async () => {
      (apiService.deliverIncrement as vi.Mock).mockRejectedValue(new Error('Delivery failed'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('increments:detail.deliverIncrement'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('increments:detail.deliverIncrement')));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(
        new RegExp(i18nT('increments:detail.deliverModal.checkboxText').substring(0, 20))
      );
      fireEvent.click(checkbox);

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('increments:detail.deliverModal.confirm') })
      );

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          i18nT('increments:detail.toast.deliverFailed')
        );
      });
    });
  });

  describe('Timeline', () => {
    beforeEach(() => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: mockIncrement,
      });
      (apiService.getEligiblePBIsForIncrement as vi.Mock).mockResolvedValue({
        data: mockEligiblePBIs,
      });
    });

    it('should display created timeline item', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('increments:detail.timeline.incrementCreated'))
        ).toBeInTheDocument();
      });
    });

    it('should display delivered timeline item for delivered increments', async () => {
      (apiService.getIncrement as vi.Mock).mockResolvedValue({
        data: {
          ...mockIncrement,
          status: IncrementStatus.DELIVERED,
          deliveredAt: '2026-01-15T00:00:00Z',
          deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('increments:detail.timeline.deliveredViaSprintReview'))
        ).toBeInTheDocument();
      });
    });
  });
});
