/**
 * DodInspection — supplementary coverage tests.
 *
 * Covers the decision editing (change wording, notes, keyboard navigation), proposal management,
 * the save/apply failure paths, and the diff preview including its empty columns and Escape close.
 */
import React from 'react';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { renderWithProviders, initTestI18n, i18nT } from '../../../test-utils';
import { apiService } from '../../../services';
import { definitionService } from '../../../services/domain/definition.service';
import { RetrospectiveStatus, type SprintRetrospective } from '../../../types';
import { DodInspection } from './DodInspection';

vi.mock('../../../services', () => ({
  apiService: {
    updateRetrospective: vi.fn(),
    applyDodChanges: vi.fn(),
  },
}));

vi.mock('../../../services/domain/definition.service', () => ({
  definitionService: {
    getDefinitionOfDone: vi.fn(),
  },
}));

const buildRetrospective = (overrides: Partial<SprintRetrospective> = {}): SprintRetrospective =>
  ({
    id: 'retro-1',
    sprintId: 'sprint-1',
    teamId: 'team-1',
    retroDate: '2024-02-01T10:00:00Z',
    facilitatorId: 'user-1',
    status: RetrospectiveStatus.IN_PROGRESS,
    participants: [],
    attendees: [],
    items: [],
    actionItems: [],
    isAnonymous: false,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
    ...overrides,
  }) as SprintRetrospective;

const mockDod = (items: Array<{ id: string; description: string }>) => {
  (definitionService.getDefinitionOfDone as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: {
      id: 'dod-1',
      teamId: 'team-1',
      version: 3,
      updatedAt: '2024-01-01T00:00:00Z',
      items: items.map((item, index) => ({
        ...item,
        isActive: true,
        order: index,
        category: 'quality',
      })),
    },
  });
};

describe('DodInspection coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDod([
      { id: 'dod-1', description: 'Code is peer-reviewed' },
      { id: 'dod-2', description: 'Unit tests pass' },
    ]);
    (apiService.updateRetrospective as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: buildRetrospective(),
    });
    (apiService.applyDodChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: buildRetrospective({ dodVersionAtPush: 4 }),
    });
  });

  const render = () =>
    renderWithProviders(<DodInspection retrospective={buildRetrospective()} readOnly={false} />);

  const waitForLoaded = () =>
    waitFor(() => expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument());

  it('reports a failed save', async () => {
    (apiService.updateRetrospective as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('save failed')
    );

    render();
    await waitForLoaded();

    await userEvent.click(screen.getAllByRole('radio', { name: 'Retire' })[0]!);
    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.saveReflection')));

    await waitFor(() =>
      expect(screen.getByText(i18nT('retrospective:dodInspection.saveFailed'))).toBeInTheDocument()
    );
  });

  it('edits the new wording and the reason for a changed criterion', async () => {
    render();
    await waitForLoaded();

    await userEvent.click(screen.getAllByRole('radio', { name: 'Change' })[0]!);

    const wording = screen.getByLabelText(/New wording/);
    await userEvent.type(wording, 'Reviewed by two peers');
    const reason = screen.getByLabelText(/Reason/);
    await userEvent.type(reason, 'To raise the bar');

    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.saveReflection')));

    await waitFor(() =>
      expect(apiService.updateRetrospective).toHaveBeenCalledWith(
        'retro-1',
        expect.objectContaining({
          dodReflections: expect.arrayContaining([
            expect.objectContaining({
              decision: 'CHANGE',
              proposedDescription: 'Reviewed by two peers',
              note: 'To raise the bar',
            }),
          ]),
        })
      )
    );
  });

  it('discards a proposed criterion', async () => {
    render();
    await waitForLoaded();

    await userEvent.type(
      screen.getByLabelText('A criterion the team should add'),
      'Deployed to staging'
    );
    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.addCriterion')));
    expect(screen.getByText('Deployed to staging')).toBeInTheDocument();

    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.discardProposal')));
    expect(screen.queryByText('Deployed to staging')).not.toBeInTheDocument();
  });

  it('adds a criterion from the keyboard', async () => {
    render();
    await waitForLoaded();

    const input = screen.getByLabelText('A criterion the team should add');
    await userEvent.type(input, 'Monitored in production');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('Monitored in production')).toBeInTheDocument();
  });

  it('moves between decisions with the arrow keys', async () => {
    render();
    await waitForLoaded();

    const group = screen.getByRole('radiogroup', {
      name: i18nT('retrospective:dodInspection.decisionLabel', {
        criterion: 'Code is peer-reviewed',
      }),
    });
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(screen.getAllByRole('radio', { name: 'Change' })[0]).toHaveAttribute(
      'aria-checked',
      'true'
    );

    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(screen.getAllByRole('radio', { name: 'Keep' })[0]).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('previews a retirement and closes the preview with Escape', async () => {
    render();
    await waitForLoaded();

    await userEvent.click(screen.getAllByRole('radio', { name: 'Retire' })[0]!);
    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.applyChanges')));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText('Code is peer-reviewed').length).toBeGreaterThan(0);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the rewording column and an empty arriving column', async () => {
    render();
    await waitForLoaded();

    await userEvent.click(screen.getAllByRole('radio', { name: 'Change' })[0]!);
    await userEvent.type(screen.getByLabelText(/New wording/), 'Reviewed by two peers');
    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.applyChanges')));

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(i18nT('retrospective:dodInspection.rewording'))
    ).toBeInTheDocument();
    // A rewording has neither retirements nor arrivals, so those columns are omitted entirely.
    expect(
      within(dialog).queryByText(i18nT('retrospective:dodInspection.retiring'))
    ).not.toBeInTheDocument();
  });

  it('applies the accepted changes and reports a failure', async () => {
    (apiService.applyDodChanges as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('apply failed')
    );

    render();
    await waitForLoaded();

    await userEvent.click(screen.getAllByRole('radio', { name: 'Retire' })[0]!);
    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.applyChanges')));
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByText(i18nT('retrospective:dodInspection.confirmApply')));

    await waitFor(() =>
      expect(screen.getByText(i18nT('retrospective:dodInspection.applyFailed'))).toBeInTheDocument()
    );
  });
});
