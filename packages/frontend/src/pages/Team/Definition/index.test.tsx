import { describe, expect, it } from 'vitest';

import { renderWithProviders, screen } from '../../../test-utils';

import { DefinitionPanel } from './index';

/**
 * The shell hands the panel the team it resolved, and resolution can fail: the
 * route is reachable while the team list is still loading or after a membership
 * was revoked. The panel must answer that case with the shared empty state
 * instead of rendering three sections that would each have to invent their own
 * refusal — the sections require a team and are given one here.
 */
describe('DefinitionPanel', () => {
  it('answers a shell that resolved no team with the shared empty state', () => {
    renderWithProviders(<DefinitionPanel teamId={undefined} team={null} />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('team-definition-tab')).not.toBeInTheDocument();
  });
});
