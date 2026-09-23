/**
 * Coaching Log Tests
 *
 * Test Coverage:
 * - Rendering of the composer (topic, Sprint, follow-up date, note) and the hint
 * - Rendering of the log itself, including entries with and without a follow-up date
 * - Empty state when the log carries no entries
 * - Reading the log for the given team, and skipping the read without a team
 * - Client-side note validation (too short / whitespace only)
 * - The exact payload sent when adding an entry (trimming, null Sprint, null follow-up)
 * - Cache invalidation and form reset after a successful save
 * - Surfacing a failed save, and clearing the error once the note is edited
 * - Deleting an entry and invalidating the coaching queries
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { CoachingTopic, type CoachingEntry } from '@scrumooth/shared';
import {
  fireEvent,
  screen,
  waitFor,
  within,
  createTestQueryClient,
  i18nT,
  initTestI18n,
  renderWithProviders,
} from '../../../test-utils';

import { queryKeys } from '../../../hooks/queryKeys';

import { CoachingLog } from './CoachingLog';

const mocks = vi.hoisted(() => ({
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
  getSprints: vi.fn(),
}));

vi.mock('../../../services', () => ({
  apiService: {
    getSprints: mocks.getSprints,
  },
  coachingService: {
    getEntries: mocks.getEntries,
    createEntry: mocks.createEntry,
    deleteEntry: mocks.deleteEntry,
  },
}));

/** Resolves a translation key inside the namespaces the component loads. */
const t = (key: string, options?: Record<string, unknown>) =>
  i18nT(`scrum-master-dashboard:${key}`, options);

const buildEntry = (overrides: Partial<CoachingEntry> = {}): CoachingEntry => ({
  id: 'entry-1',
  teamId: 'team-1',
  topic: CoachingTopic.SELF_MANAGEMENT,
  note: 'The team split the release work without being asked.',
  sprintId: 'sprint-1',
  sprintName: 'Sprint 7',
  followUpDate: '2026-10-01',
  authorId: 'user-1',
  authorName: 'Sam Scrum',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  ...overrides,
});

const entryPage = (entries: CoachingEntry[]) => ({
  success: true as const,
  data: { entries, total: entries.length, limit: 20, offset: 0 },
});

const sprints = [
  { id: 'sprint-1', name: 'Sprint 7' },
  { id: 'sprint-2', name: 'Sprint 8' },
];

/**
 * The composer wraps every control in a `<label>`, so the control is located through the label's
 * own text rather than through the label as a whole -- the wrapped `<select>` also contains the
 * option text, which would otherwise be folded into the queried name.
 */
const controlFor = (
  labelText: string
): HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement => {
  const label = screen.getByText(labelText).closest('label');
  const control = label?.querySelector('select, input, textarea');

  if (!control) {
    throw new Error(`No form control found inside the "${labelText}" label`);
  }

  return control as HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement;
};

const renderLog = (teamId = 'team-1') => {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    invalidateSpy,
    ...renderWithProviders(<CoachingLog teamId={teamId} />, { queryClient }),
  };
};

const addButton = () => screen.getByRole('button', { name: t('coaching.add') });

/**
 * The log row an entry is rendered in, located through its note. The topic label alone would be
 * ambiguous -- the composer's topic `<select>` renders the very same labels.
 */
const entryRowFor = async (note: RegExp): Promise<HTMLElement> => {
  const noteElement = await screen.findByText(note);
  const row = noteElement.closest('li');

  if (!row) {
    throw new Error(`The entry matching ${String(note)} is not rendered inside a log row`);
  }

  return row as HTMLElement;
};

describe('CoachingLog', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEntries.mockResolvedValue(entryPage([]));
    mocks.getSprints.mockResolvedValue({ success: true, data: sprints });
    mocks.createEntry.mockResolvedValue({ success: true });
    mocks.deleteEntry.mockResolvedValue({ success: true });
  });

  describe('Rendering the composer', () => {
    it('renders the coaching log with its title and hint', () => {
      renderLog();

      expect(screen.getByTestId('coaching-log')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: t('coaching.title') })).toBeInTheDocument();
      expect(screen.getByText(t('coaching.hint'))).toBeInTheDocument();
    });

    it('offers every coaching topic, defaulting to self-management', () => {
      renderLog();

      const topicSelect = controlFor(t('coaching.topic'));

      expect(topicSelect).toHaveValue(CoachingTopic.SELF_MANAGEMENT);
      expect(screen.getByRole('option', { name: t('coaching.topicSelfManagement') })).toHaveValue(
        CoachingTopic.SELF_MANAGEMENT
      );
      expect(
        screen.getByRole('option', { name: t('coaching.topicCrossFunctionality') })
      ).toHaveValue(CoachingTopic.CROSS_FUNCTIONALITY);
      expect(screen.getByRole('option', { name: t('coaching.topicOther') })).toHaveValue(
        CoachingTopic.OTHER
      );
    });

    it('offers the team Sprints alongside an untied option', async () => {
      renderLog();

      expect(await screen.findByRole('option', { name: 'Sprint 7' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Sprint 8' })).toBeInTheDocument();
      expect(controlFor(t('coaching.sprint'))).toHaveValue('');
      expect(screen.getByRole('option', { name: t('coaching.noSprint') })).toBeInTheDocument();
    });

    it('renders an optional follow-up date and the note field', () => {
      renderLog();

      expect(controlFor(t('coaching.followUpDate'))).toHaveAttribute('type', 'date');
      expect(screen.getByPlaceholderText(t('coaching.notePlaceholder'))).toHaveValue('');
    });
  });

  describe('Rendering the log', () => {
    it('reads the log for the team it was handed', async () => {
      renderLog('team-42');

      await waitFor(() => {
        expect(mocks.getEntries).toHaveBeenCalledWith('team-42');
      });
      expect(mocks.getSprints).toHaveBeenCalledWith('team-42');
    });

    it('reads nothing when there is no team', () => {
      renderLog('');

      expect(mocks.getEntries).not.toHaveBeenCalled();
      expect(mocks.getSprints).not.toHaveBeenCalled();
    });

    it('shows the empty state when the log has no entries', async () => {
      renderLog();

      expect(await screen.findByText(t('coaching.empty'))).toBeInTheDocument();
    });

    it('lists each entry with its topic and note', async () => {
      mocks.getEntries.mockResolvedValue(
        entryPage([
          buildEntry(),
          buildEntry({
            id: 'entry-2',
            topic: CoachingTopic.CROSS_FUNCTIONALITY,
            note: 'Only one member can run the release pipeline.',
            sprintId: null,
            followUpDate: null,
          }),
        ])
      );

      renderLog();

      const selfManagementEntry = await entryRowFor(
        /The team split the release work without being asked\./
      );
      const crossFunctionalityEntry = await entryRowFor(
        /Only one member can run the release pipeline\./
      );

      expect(
        within(selfManagementEntry).getByText(t('coaching.topicSelfManagement'))
      ).toBeInTheDocument();
      expect(
        within(crossFunctionalityEntry).getByText(t('coaching.topicCrossFunctionality'))
      ).toBeInTheDocument();
      expect(screen.queryByText(t('coaching.empty'))).not.toBeInTheDocument();
    });

    it('states the follow-up date only for entries that carry one', async () => {
      mocks.getEntries.mockResolvedValue(
        entryPage([
          buildEntry({ id: 'entry-1', followUpDate: '2026-10-01T00:00:00.000Z' }),
          buildEntry({ id: 'entry-2', followUpDate: null, note: 'No follow-up needed.' }),
        ])
      );

      renderLog();

      const withFollowUp = await entryRowFor(
        /The team split the release work without being asked\./
      );
      const withoutFollowUp = await entryRowFor(/No follow-up needed\./);

      expect(withFollowUp).toHaveTextContent(`${t('coaching.followUpOn')} 2026-10-01`);
      expect(withFollowUp).not.toHaveTextContent('2026-10-01T00:00:00');
      expect(withoutFollowUp).not.toHaveTextContent(t('coaching.followUpOn'));
      expect(withoutFollowUp).not.toHaveTextContent('2026-10-01');
    });

    it('renders a delete control for every entry', async () => {
      mocks.getEntries.mockResolvedValue(
        entryPage([buildEntry({ id: 'entry-1' }), buildEntry({ id: 'entry-2' })])
      );

      renderLog();

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: t('coaching.delete') })).toHaveLength(2);
      });
    });
  });

  describe('Adding an entry', () => {
    it('refuses a note shorter than three characters without calling the service', async () => {
      renderLog();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: 'ab' },
      });
      fireEvent.click(addButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(t('coaching.saveError'));
      expect(mocks.createEntry).not.toHaveBeenCalled();
    });

    it('refuses a whitespace-only note', async () => {
      renderLog();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: '     ' },
      });
      fireEvent.click(addButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(t('coaching.saveError'));
      expect(mocks.createEntry).not.toHaveBeenCalled();
    });

    it('trims the note and sends null for an untied Sprint and follow-up date', async () => {
      renderLog();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: '  The team now runs its own retro.  ' },
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(mocks.createEntry).toHaveBeenCalledWith({
          teamId: 'team-1',
          topic: CoachingTopic.SELF_MANAGEMENT,
          note: 'The team now runs its own retro.',
          sprintId: null,
          followUpDate: null,
        });
      });
    });

    it('sends the chosen topic, Sprint and follow-up date', async () => {
      renderLog();

      fireEvent.change(controlFor(t('coaching.topic')), {
        target: { value: CoachingTopic.CROSS_FUNCTIONALITY },
      });
      // The Sprint options arrive with the query, so the select cannot take the value before then.
      await screen.findByRole('option', { name: 'Sprint 8' });
      fireEvent.change(controlFor(t('coaching.sprint')), { target: { value: 'sprint-2' } });
      fireEvent.change(controlFor(t('coaching.followUpDate')), {
        target: { value: '2026-11-05' },
      });
      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: 'One person still owns the release pipeline.' },
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(mocks.createEntry).toHaveBeenCalledWith({
          teamId: 'team-1',
          topic: CoachingTopic.CROSS_FUNCTIONALITY,
          note: 'One person still owns the release pipeline.',
          sprintId: 'sprint-2',
          followUpDate: '2026-11-05',
        });
      });
    });

    it('clears the note and the follow-up date once the entry is saved', async () => {
      renderLog();

      const noteField = screen.getByPlaceholderText(t('coaching.notePlaceholder'));
      const followUpField = controlFor(t('coaching.followUpDate'));

      fireEvent.change(noteField, { target: { value: 'Coached the team on sizing.' } });
      fireEvent.change(followUpField, { target: { value: '2026-11-05' } });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(noteField).toHaveValue('');
      });
      expect(followUpField).toHaveValue('');
    });

    it('invalidates the coaching queries after a successful save', async () => {
      const { invalidateSpy } = renderLog();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: 'Coached the team on sizing.' },
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.coaching.all });
      });
    });

    it('reports a failed save and leaves the queries untouched', async () => {
      mocks.createEntry.mockRejectedValue(new Error('Forbidden'));
      const { invalidateSpy } = renderLog();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: 'Coached the team on sizing.' },
      });
      fireEvent.click(addButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(t('coaching.saveError'));
      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: queryKeys.coaching.all });
    });

    it('clears the validation error as soon as the note is edited', async () => {
      renderLog();

      fireEvent.click(addButton());
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: 'Something observed.' },
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('holds the add button busy while the save is in flight', async () => {
      let resolveCreate!: (value: unknown) => void;
      mocks.createEntry.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      renderLog();

      fireEvent.change(screen.getByPlaceholderText(t('coaching.notePlaceholder')), {
        target: { value: 'Coached the team on sizing.' },
      });
      fireEvent.click(addButton());

      await waitFor(() => {
        expect(addButton()).toHaveAttribute('aria-busy', 'true');
      });

      resolveCreate({ success: true });

      await waitFor(() => {
        expect(addButton()).toHaveAttribute('aria-busy', 'false');
      });
    });
  });

  describe('Deleting an entry', () => {
    it('deletes the entry the Scrum Master picked and invalidates the log', async () => {
      mocks.getEntries.mockResolvedValue(
        entryPage([buildEntry({ id: 'entry-1' }), buildEntry({ id: 'entry-2' })])
      );
      const { invalidateSpy } = renderLog();

      const deleteButtons = await screen.findAllByRole('button', { name: t('coaching.delete') });
      fireEvent.click(deleteButtons[1]);

      await waitFor(() => {
        expect(mocks.deleteEntry).toHaveBeenCalledWith('entry-2');
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.coaching.all });
    });
  });
});
