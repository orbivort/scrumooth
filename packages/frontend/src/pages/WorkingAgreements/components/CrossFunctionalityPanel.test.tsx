/**
 * Cross-functionality panel tests.
 *
 * The panel reads the team's coverage signal for everyone and offers the recording to the Scrum
 * Master alone. What it must not do is let an empty assessment through: a row without a skill name
 * is not a skill the team covers, so it is dropped or refused rather than saved.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SkillCoverage } from '@scrumooth/shared';

import { renderWithProviders, initTestI18n, screen, waitFor } from '../../../test-utils';
import { mockCrossFunctionality } from '../../../__mocks__/facilitationData';

import { CrossFunctionalityPanel } from './CrossFunctionalityPanel';

vi.mock('../WorkingAgreements.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const SUMMARY_LABEL = 'What the team concluded';
const SKILL_LABEL = 'Skill';
const COVERAGE_LABEL = 'Coverage';
const NOTE_LABEL = 'Note';

const openRecording = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Record an assessment' }));
};

describe('CrossFunctionalityPanel', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('summarises the coverage the team reported', () => {
    renderWithProviders(
      <CrossFunctionalityPanel
        record={mockCrossFunctionality}
        canRecord={false}
        onRecord={vi.fn()}
      />
    );

    expect(screen.getByText('1 covered · 1 partial · 1 not covered')).toBeInTheDocument();
    expect(screen.getByText('Database migrations')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The team can build and test the frontend, but the migration tooling depends on one person.'
      )
    ).toBeInTheDocument();
  });

  it('reports honestly when nothing has been assessed yet', () => {
    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={vi.fn()} />);

    expect(screen.getByText('No cross-functionality assessment recorded yet.')).toBeInTheDocument();
    expect(screen.getByText(/records the assessment/)).toBeInTheDocument();
  });

  it('does not offer the recording to a team member who is not the Scrum Master', () => {
    renderWithProviders(
      <CrossFunctionalityPanel record={null} canRecord={false} onRecord={vi.fn()} />
    );

    expect(screen.queryByRole('button', { name: 'Record an assessment' })).not.toBeInTheDocument();
    expect(screen.queryByText(/records the assessment/)).not.toBeInTheDocument();
  });

  it('offers the recording to the Scrum Master', () => {
    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Record an assessment' })).toBeInTheDocument();
  });

  it('opens the assessment form when the Scrum Master records', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={vi.fn()} />);
    await openRecording(user);

    expect(screen.getByText('Cross-functionality assessment')).toBeInTheDocument();
    expect(screen.getByLabelText(SUMMARY_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(SKILL_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(COVERAGE_LABEL)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save assessment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record an assessment' })).not.toBeInTheDocument();
  });

  it('lists the three coverage levels the team can choose from', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={vi.fn()} />);
    await openRecording(user);

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Not covered',
      'Partially covered',
      'Covered',
    ]);
  });

  it('refuses an assessment with no skill named', async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={onRecord} />);
    await openRecording(user);

    await user.type(screen.getByLabelText(SUMMARY_LABEL), 'We think we are fine.');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Record at least one skill.');
    expect(onRecord).not.toHaveBeenCalled();
    expect(screen.getByText('Cross-functionality assessment')).toBeInTheDocument();
  });

  it('refuses an assessment whose only skill is whitespace', async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={onRecord} />);
    await openRecording(user);

    await user.type(screen.getByLabelText(SKILL_LABEL), '     ');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Record at least one skill.');
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('adds and removes skill rows', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={vi.fn()} />);
    await openRecording(user);

    expect(screen.queryByRole('button', { name: 'Remove skill' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add skill' }));

    expect(screen.getAllByLabelText(SKILL_LABEL)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Remove skill' })).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Remove skill' })[0]!);

    expect(screen.getAllByLabelText(SKILL_LABEL)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Remove skill' })).not.toBeInTheDocument();
  });

  it('records the trimmed assessment and closes the form', async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={onRecord} />);
    await openRecording(user);

    await user.type(screen.getByLabelText(SUMMARY_LABEL), '  The frontend is covered.  ');
    await user.type(screen.getByLabelText(SKILL_LABEL), '  Accessibility testing  ');
    await user.selectOptions(screen.getByLabelText(COVERAGE_LABEL), SkillCoverage.PARTIAL);
    await user.type(screen.getByLabelText(NOTE_LABEL), '  One person, recently trained.  ');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    await waitFor(() =>
      expect(onRecord).toHaveBeenCalledWith({
        summary: 'The frontend is covered.',
        skills: [
          {
            name: 'Accessibility testing',
            coverage: SkillCoverage.PARTIAL,
            note: 'One person, recently trained.',
          },
        ],
      })
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Save assessment' })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Record an assessment' })).toBeInTheDocument();
  });

  it('sends a null note when the note is left empty', async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={onRecord} />);
    await openRecording(user);

    await user.type(screen.getByLabelText(SKILL_LABEL), 'React');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    await waitFor(() =>
      expect(onRecord).toHaveBeenCalledWith({
        summary: '',
        skills: [{ name: 'React', coverage: SkillCoverage.NONE, note: null }],
      })
    );
  });

  it('drops a blank row instead of recording it as a covered skill', async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={onRecord} />);
    await openRecording(user);

    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.type(screen.getAllByLabelText(SKILL_LABEL)[0]!, 'React');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    await waitFor(() =>
      expect(onRecord).toHaveBeenCalledWith({
        summary: '',
        skills: [{ name: 'React', coverage: SkillCoverage.NONE, note: null }],
      })
    );
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it('clears the refusal as soon as a skill name is typed', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={vi.fn()} />);
    await openRecording(user);

    await user.click(screen.getByRole('button', { name: 'Save assessment' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText(SKILL_LABEL), 'R');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('abandons the recording without sending anything', async () => {
    const user = userEvent.setup();
    const onRecord = vi.fn();

    renderWithProviders(<CrossFunctionalityPanel record={null} canRecord onRecord={onRecord} />);
    await openRecording(user);

    await user.type(screen.getByLabelText(SKILL_LABEL), 'React');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRecord).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save assessment' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record an assessment' })).toBeInTheDocument();
  });

  it('locks the recording while it is being submitted', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <CrossFunctionalityPanel record={null} canRecord submitting onRecord={vi.fn()} />
    );
    await openRecording(user);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save assessment' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});
