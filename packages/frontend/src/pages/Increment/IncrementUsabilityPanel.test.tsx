import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, initTestI18n, i18nT } from '@/test-utils';

import { IncrementStatus } from '../../types';
import { apiService } from '@/services';
import { IncrementUsabilityPanel } from './IncrementUsabilityPanel';

// Mock the services barrel so no HTTP call is made and the mutation can be asserted.
vi.mock('@/services', () => ({
  apiService: {
    verifyUsability: vi.fn(),
  },
}));

const mockedApiService = vi.mocked(apiService);

/** The panel is translated from the `increments` namespace. */
const key = (name: string) => `increments:incrementUsability.${name}`;

beforeAll(async () => {
  await initTestI18n();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockedApiService.verifyUsability.mockResolvedValue({
    success: true,
    data: undefined,
  } as never);
});

const renderPanel = (props: Partial<React.ComponentProps<typeof IncrementUsabilityPanel>> = {}) => {
  const mergedProps: React.ComponentProps<typeof IncrementUsabilityPanel> = {
    incrementId: 'inc-1',
    ...props,
  };
  return renderWithProviders(<IncrementUsabilityPanel {...mergedProps} />);
};

describe('IncrementUsabilityPanel', () => {
  it('should ask for the evidence when the usable condition is not attested', () => {
    renderPanel({ usabilityVerified: false, status: IncrementStatus.DRAFT });

    expect(screen.getByText(i18nT(key('notAttested')))).toBeInTheDocument();
    expect(screen.getByLabelText(i18nT(key('formLabel')))).toBeInTheDocument();
  });

  it('should state the rule so the attestation is understood as evidence, not a checkbox', () => {
    renderPanel({ usabilityVerified: false, status: IncrementStatus.DRAFT });

    expect(screen.getByText(i18nT(key('rule')))).toBeInTheDocument();
  });

  it('should not allow submitting an attestation without evidence', () => {
    renderPanel({ usabilityVerified: false, status: IncrementStatus.DRAFT });

    const submit = screen.getByRole('button', { name: i18nT(key('attest')) });
    expect(submit).toBeDisabled();

    // Whitespace is not evidence.
    fireEvent.change(screen.getByLabelText(i18nT(key('formLabel'))), {
      target: { value: '   ' },
    });
    expect(submit).toBeDisabled();
    expect(mockedApiService.verifyUsability).not.toHaveBeenCalled();
  });

  it('should record the written evidence when submitted', async () => {
    renderPanel({ usabilityVerified: false, status: IncrementStatus.DRAFT });

    fireEvent.change(screen.getByLabelText(i18nT(key('formLabel'))), {
      target: { value: '  Deployed to staging and exercised end to end  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: i18nT(key('attest')) }));

    await waitFor(() => {
      expect(mockedApiService.verifyUsability).toHaveBeenCalledWith(
        'inc-1',
        'Deployed to staging and exercised end to end'
      );
    });
  });

  it('should show the recorded evidence and who attested it', () => {
    renderPanel({
      usabilityVerified: true,
      usabilityEvidence: 'Exercised by the Product Owner in staging',
      usabilityVerifiedAt: '2026-09-01T10:00:00.000Z',
      usabilityVerifierName: 'Ada Lovelace',
      status: IncrementStatus.VERIFIED,
    });

    expect(screen.getByText(i18nT(key('attested')))).toBeInTheDocument();
    expect(screen.getByText('Exercised by the Product Owner in staging')).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    // An attested Increment offers no form: the attestation is already the record.
    expect(screen.queryByRole('button', { name: i18nT(key('attest')) })).not.toBeInTheDocument();
  });

  it('should report a delivered Increment without an attestation as not recorded, not as failed', () => {
    renderPanel({ usabilityVerified: false, status: IncrementStatus.DELIVERED });

    // Delivered before the attestation was required: inventing evidence for it would be worse than
    // admitting there is none.
    expect(screen.getByText(i18nT(key('notRecorded')))).toBeInTheDocument();
    expect(screen.getByText(i18nT(key('notRecordedHint')))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18nT(key('attest')) })).not.toBeInTheDocument();
  });

  it('should lock the attestation once the Increment is archived', () => {
    renderPanel({ usabilityVerified: true, status: IncrementStatus.ARCHIVED });

    expect(screen.queryByRole('button', { name: i18nT(key('attest')) })).not.toBeInTheDocument();
    expect(screen.getByText(i18nT(key('lockedHint')))).toBeInTheDocument();
  });
});
