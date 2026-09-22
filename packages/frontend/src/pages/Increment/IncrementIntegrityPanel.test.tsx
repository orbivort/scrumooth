import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, initTestI18n, i18nT } from '@/test-utils';
import {
  IntegrationTestResult,
  type IntegrationTestRecord,
  type IncrementChainNode,
} from '@scrumooth/shared';

import { IntegrationVerificationBasis, IncrementStatus } from '../../types';
import { incrementService } from '@/services';
import { IncrementIntegrityPanel } from './IncrementIntegrityPanel';

// Mock the services barrel so domain logic is not exercised.
vi.mock('@/services', () => ({
  incrementService: {
    getIncrements: vi.fn(),
    getIncrement: vi.fn(),
    createIncrement: vi.fn(),
    updateIncrement: vi.fn(),
    deliverIncrement: vi.fn(),
    getIncrementMetrics: vi.fn(),
    getIntegrationTests: vi.fn(),
    createIntegrationTest: vi.fn(),
    verifyIntegration: vi.fn(),
    getIncrementChain: vi.fn(),
  },
}));

const mockedIncrementService = vi.mocked(incrementService);

// --- Test fixtures ---

const makeTestRecord = (overrides: Partial<IntegrationTestRecord> = {}): IntegrationTestRecord => ({
  id: 'test-1',
  currentIncrementId: 'inc-1',
  priorIncrementId: 'inc-0',
  testResult: IntegrationTestResult.PASSED,
  testedById: 'user-1',
  testedAt: '2026-08-01T10:00:00.000Z',
  notes: 'All good',
  priorIncrementName: 'Increment 0',
  testerName: 'Alice',
  ...overrides,
});

const makeChainNode = (overrides: Partial<IncrementChainNode> = {}): IncrementChainNode => ({
  id: 'inc-0',
  name: 'Increment 0',
  status: 'DELIVERED',
  integrationVerified: true,
  deliveredAt: '2026-07-31T10:00:00.000Z',
  hasTests: true,
  isCurrent: false,
  sprintName: 'Sprint 1',
  ...overrides,
});

// --- Setup ---

beforeAll(async () => {
  await initTestI18n();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedIncrementService.getIntegrationTests.mockResolvedValue({ data: [] });
  mockedIncrementService.getIncrementChain.mockResolvedValue({ data: [] });
  mockedIncrementService.createIntegrationTest.mockResolvedValue(undefined);
  mockedIncrementService.verifyIntegration.mockResolvedValue(undefined);
});

// --- Helpers ---

const renderPanel = (props: Partial<React.ComponentProps<typeof IncrementIntegrityPanel>> = {}) => {
  const mergedProps: React.ComponentProps<typeof IncrementIntegrityPanel> = {
    incrementId: 'inc-1',
    ...props,
  };
  return renderWithProviders(<IncrementIntegrityPanel {...mergedProps} />);
};

describe('IncrementIntegrityPanel', () => {
  it('renders the panel title', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(i18nT('increments:incrementIntegrity.title'))).toBeInTheDocument();
    });
  });

  it('shows the unverified badge by default', async () => {
    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText(i18nT('increments:incrementIntegrity.notVerified'))
      ).toBeInTheDocument();
    });
  });

  it('states how many prior Increments a real verification covered', async () => {
    renderPanel({
      integrationVerified: true,
      integrationVerificationBasis: IntegrationVerificationBasis.PRIOR_INCREMENTS,
      integrationVerifiedPriorCount: 3,
    });

    await waitFor(() => {
      expect(
        screen.getByText(i18nT('increments:incrementIntegrity.verifiedAgainst', { count: 3 }))
      ).toBeInTheDocument();
    });
  });

  it('names the first-Increment exemption instead of claiming a verification', async () => {
    renderPanel({
      integrationVerified: true,
      integrationVerificationBasis: IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT,
      integrationVerifiedPriorCount: 0,
    });

    await waitFor(() => {
      expect(
        screen.getByText(i18nT('increments:incrementIntegrity.firstIncrementExempt'))
      ).toBeInTheDocument();
    });
    // The generic "verified" label would hide that nothing was tested against.
    expect(
      screen.queryByText(i18nT('increments:incrementIntegrity.verifiedAgainst', { count: 0 }))
    ).not.toBeInTheDocument();
  });

  it('shows "no data" placeholders for empty test/chain sections', async () => {
    renderPanel();

    await waitFor(() => {
      // Two empty sections (tests + chain) each render a "No data available" node.
      expect(screen.getAllByText(i18nT('common:noData')).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('displays the first-increment hint when no prior increments exist', async () => {
    mockedIncrementService.getIncrementChain.mockResolvedValue({ data: [] });

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText(i18nT('increments:incrementIntegrity.firstIncrement'))
      ).toBeInTheDocument();
    });
  });

  it('renders integration tests grouped by prior increment with pass/pending/fail labels', async () => {
    mockedIncrementService.getIntegrationTests.mockResolvedValue({
      data: [
        makeTestRecord({
          id: 't1',
          testResult: IntegrationTestResult.PASSED,
          priorIncrementName: 'Inc A',
        }),
        makeTestRecord({
          id: 't2',
          testResult: IntegrationTestResult.PENDING,
          priorIncrementName: 'Inc B',
          notes: null,
        }),
        makeTestRecord({
          id: 't3',
          testResult: IntegrationTestResult.FAILED,
          priorIncrementName: 'Inc C',
        }),
      ],
    });
    // Use a distinct chain node name so "Inc A" only matches the test-list label.
    mockedIncrementService.getIncrementChain.mockResolvedValue({
      data: [makeChainNode({ id: 'inc-0', name: 'Chain Node Alpha' })],
    });

    renderPanel();

    // The async queries must have been invoked.
    await waitFor(() => {
      expect(mockedIncrementService.getIntegrationTests).toHaveBeenCalled();
    });

    // The result labels (Passed/Pending/Failed) also appear as <option> text in
    // the form's Test Result select, so use getAllByText to avoid the
    // "multiple elements" error.
    const labelPrefix = i18nT('increments:incrementIntegrity.priorIncrement');
    await waitFor(() => {
      expect(
        screen.getAllByText(i18nT('increments:incrementIntegrity.pass')).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(i18nT('increments:incrementIntegrity.pending')).length
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(i18nT('increments:incrementIntegrity.fail')).length
      ).toBeGreaterThan(0);
      // Prior increment names are unique to the test list.
      expect(screen.getByText(`${labelPrefix}: Inc A`)).toBeInTheDocument();
      expect(screen.getByText(`${labelPrefix}: Inc B`)).toBeInTheDocument();
      expect(screen.getByText(`${labelPrefix}: Inc C`)).toBeInTheDocument();
    });
  });

  it('renders the increment chain with what each node’s verification rests on', async () => {
    mockedIncrementService.getIncrementChain.mockResolvedValue({
      data: [
        makeChainNode({
          name: 'Inc A',
          integrationVerified: true,
          integrationVerificationBasis: IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT,
          integrationVerifiedPriorCount: 0,
        }),
        makeChainNode({ id: 'inc-2', name: 'Inc B', integrationVerified: false }),
      ],
    });

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText(i18nT('increments:incrementIntegrity.firstIncrementExempt'))
      ).toBeInTheDocument();
    });
    // The panel badge (this Increment is not verified) and the chain node share the same wording.
    expect(screen.getAllByText(i18nT('increments:incrementIntegrity.notVerified'))).toHaveLength(2);
  });

  it('calls verifyIntegration with the increment id when verify button is clicked', async () => {
    mockedIncrementService.getIncrementChain.mockResolvedValue({
      data: [makeChainNode({ integrationVerified: true })],
    });

    renderPanel();

    const verifyButton = await screen.findByRole('button', {
      name: i18nT('increments:incrementIntegrity.verifyNow'),
    });
    expect(verifyButton).toBeEnabled();

    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockedIncrementService.verifyIntegration).toHaveBeenCalledWith('inc-1');
    });
  });

  it.each([IncrementStatus.DELIVERED, IncrementStatus.ARCHIVED])(
    'disables the integration form and verify button when status is %s (locked)',
    async (status) => {
      mockedIncrementService.getIncrementChain.mockResolvedValue({
        data: [makeChainNode({ id: 'inc-0', integrationVerified: false })],
      });

      renderPanel({ status });

      const priorSelect = await screen.findByLabelText(
        i18nT('increments:incrementIntegrity.priorIncrement')
      );
      const resultSelect = screen.getByLabelText(i18nT('increments:incrementIntegrity.testResult'));
      const notesInput = screen.getByLabelText(i18nT('increments:incrementIntegrity.notes'));
      const addButton = screen.getByRole('button', {
        name: i18nT('increments:incrementIntegrity.addTest'),
      });
      const verifyButton = screen.getByRole('button', {
        name: i18nT('increments:incrementIntegrity.verifyNow'),
      });

      expect(priorSelect).toBeDisabled();
      expect(resultSelect).toBeDisabled();
      expect(notesInput).toBeDisabled();
      expect(addButton).toBeDisabled();
      expect(verifyButton).toBeDisabled();
      expect(
        screen.getByText(i18nT('increments:incrementIntegrity.lockedHint'))
      ).toBeInTheDocument();
    }
  );

  it('keeps the integration form enabled for a non-locked status (DRAFT/VERIFIED)', async () => {
    mockedIncrementService.getIncrementChain.mockResolvedValue({
      data: [makeChainNode({ id: 'inc-0', integrationVerified: false })],
    });

    renderPanel({ status: IncrementStatus.VERIFIED });

    const priorSelect = await screen.findByLabelText(
      i18nT('increments:incrementIntegrity.priorIncrement')
    );
    expect(priorSelect).toBeEnabled();
    expect(screen.queryByText(i18nT('increments:incrementIntegrity.lockedHint'))).toBeNull();
  });

  it('adds an integration test via the form', async () => {
    // Provide a prior increment so it appears as a selectable option
    // (priorOptions filters out DRAFT status and the current increment id).
    mockedIncrementService.getIncrementChain.mockResolvedValue({
      data: [makeChainNode({ id: 'inc-0', name: 'Increment 0', integrationVerified: false })],
    });

    renderPanel();

    const priorSelect = await screen.findByLabelText(
      i18nT('increments:incrementIntegrity.priorIncrement')
    );
    const resultSelect = screen.getByLabelText(i18nT('increments:incrementIntegrity.testResult'));
    const notesInput = screen.getByLabelText(i18nT('increments:incrementIntegrity.notes'));
    const addButton = screen.getByRole('button', {
      name: i18nT('increments:incrementIntegrity.addTest'),
    });
    const form = addButton.closest('form') as HTMLFormElement;

    // Wait until the chain data has loaded and the prior-increment option exists.
    await waitFor(() => {
      expect(priorSelect.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    fireEvent.change(priorSelect, { target: { value: 'inc-0' } });
    fireEvent.change(resultSelect, { target: { value: IntegrationTestResult.FAILED } });
    fireEvent.change(notesInput, { target: { value: 'Regression found' } });
    // Submitting the form (not just clicking) reliably triggers onSubmit.
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockedIncrementService.createIntegrationTest).toHaveBeenCalledWith('inc-1', {
        priorIncrementId: 'inc-0',
        testResult: IntegrationTestResult.FAILED,
        notes: 'Regression found',
      });
    });
  });

  it('does not submit the add-test form when no prior increment is selected', async () => {
    renderPanel();

    const addButton = await screen.findByRole('button', {
      name: i18nT('increments:incrementIntegrity.addTest'),
    });

    // Submit button is disabled until a prior increment is chosen.
    expect(addButton).toBeDisabled();

    fireEvent.click(addButton);

    expect(mockedIncrementService.createIntegrationTest).not.toHaveBeenCalled();
  });

  it('handles a service failure for integration tests without crashing', async () => {
    mockedIncrementService.getIntegrationTests.mockRejectedValue(new Error('network'));
    mockedIncrementService.getIncrementChain.mockResolvedValue({ data: [] });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(i18nT('increments:incrementIntegrity.title'))).toBeInTheDocument();
    });
  });
});
