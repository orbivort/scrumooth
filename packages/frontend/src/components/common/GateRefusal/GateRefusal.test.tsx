/**
 * The gate-refusal renderer.
 *
 * A refusal is only useful if it says the three things a reader needs: what was enforced, where the
 * rule comes from, and what to do about it. It resolves all three from the gate *code*, never from
 * the message text -- a reworded server message must not be able to detach a refusal from its rule --
 * and it falls back to the server's own message when a gate has no copy of its own.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { initTestI18n, i18nT } from '../../../test-utils';
import { vi, beforeAll, describe, expect, it } from 'vitest';
import { GATE_CODES } from '@scrumooth/shared';

import { GateRefusal } from './GateRefusal';
import { useGateRefusal } from './useGateRefusal';

vi.mock('../../../store', () => ({
  useAuthStore: () => ({ error: null, setError: vi.fn(), logout: vi.fn() }),
}));

/** An axios-shaped refusal, as the interceptor delivers it. */
const refusal = (code: string, message = 'Refused.', status = 409) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { success: false, error: { code, message } } },
  });

/** Renders the callout for one error, through the hook the way a caller would. */
const Harness: React.FC<{ error: unknown }> = ({ error }) => (
  <GateRefusal view={useGateRefusal(error)} />
);

describe('GateRefusal', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('should say what was enforced, where it comes from and what to do', async () => {
    render(<Harness error={refusal(GATE_CODES.DOD_GROUP_GOVERNED)} />);

    expect(screen.getByText(i18nT('gate:dodGroupGoverned.rule'))).toBeInTheDocument();
    // The Guide's own words, quoted rather than paraphrased: the citation is the reason the rule
    // exists, and a paraphrase would be this product's opinion of it.
    expect(screen.getByText(i18nT('gate:dodGroupGoverned.guideClause'))).toBeInTheDocument();
    expect(screen.getByText(i18nT('common:gateRefusal.guideClauseLabel'))).toBeInTheDocument();
    expect(screen.getByText(i18nT('gate:dodGroupGoverned.recovery'))).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-gate', GATE_CODES.DOD_GROUP_GOVERNED);
  });

  it('should say nothing about a Guide clause for a rule the Guide does not contain', () => {
    // The readiness agreement is this product's own practice, so claiming a Guide citation for it
    // would be the over-claim the readiness copy exists to avoid.
    render(<Harness error={refusal(GATE_CODES.DOR_SCRUM_MASTER_ONLY, 'Refused.', 403)} />);

    expect(screen.getByText(i18nT('gate:dorScrumMasterOnly.rule'))).toBeInTheDocument();
    expect(
      screen.queryByText(i18nT('common:gateRefusal.guideClauseLabel'))
    ).not.toBeInTheDocument();
    expect(screen.getByText(i18nT('gate:dorScrumMasterOnly.recovery'))).toBeInTheDocument();
  });

  it('should fall back to the server message for a gate it has no copy for', () => {
    // A real gate code, deliberately absent from `gate.json`: the namespace is scoped to the
    // commitment surfaces, and a gate without copy must still say something true.
    render(
      <Harness error={refusal(GATE_CODES.SPRINT_EVENTS_MISSING, 'The Sprint Review is missing.')} />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('The Sprint Review is missing.');
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-gate',
      GATE_CODES.SPRINT_EVENTS_MISSING
    );
  });

  it('should render the server message for a failure that is not a gate at all', () => {
    render(<Harness error={refusal('SOMETHING_ELSE', 'Network down', 500)} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Network down');
    expect(screen.getByRole('alert')).toHaveAttribute('data-gate', 'unknown');
  });

  it('should render nothing when there is no refusal to explain', () => {
    const { container } = render(<Harness error={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
