/**
 * Focused coverage tests for the Daily Scrum page. They target the handlers the existing suites do
 * not reach: the draft-restore banner, the promote-impediment unsaved guard and error branches, the
 * backlog-adjustment editor, date changes, the team-signal errors, the record-view reflection chips
 * and the "time since draft saved" formatting.
 *
 * react-i18next is mocked so every `t()` returns its key, which keeps the queries stable regardless
 * of the locale files.
 */
import React from 'react';
import { screen, fireEvent, waitFor, renderWithProviders } from '../../test-utils';
import { useNavigate } from 'react-router';
import { vi, beforeEach, describe, it, expect, type Mock } from 'vitest';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';
import { ImpedimentStatus, UserRole } from '../../types';

import { DailyScrum } from './DailyScrum';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getSprintTasks: vi.fn(),
    getDailyScrum: vi.fn(),
    getDailyScrumCadence: vi.fn(),
    getDailyScrumParticipation: vi.fn(),
    createDailyScrum: vi.fn(),
    updateDailyScrum: vi.fn(),
    promoteImpedimentFromDailyScrum: vi.fn(),
    sendDailyScrumTeamSignal: vi.fn(),
    getProductGoals: vi.fn(),
    getImpediments: vi.fn(),
  },
}));

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string, _params?: Record<string, unknown>) => key }),
  };
});

vi.mock('../../components/TeamMemberSelect/TeamMemberSelect', () => ({
  TeamMemberSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select aria-label="Assign to" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Unassigned</option>
      <option value="user-2">Jane Smith</option>
    </select>
  ),
}));

vi.mock('../../components/common/EventTimebox/EventTimebox', () => ({
  EventTimebox: () => <div data-testid="event-timebox" />,
}));

vi.mock('../../components/common/ScrumValuesBanner', () => ({
  ScrumValuesBanner: () => <div data-testid="scrum-values" />,
}));

const dh = vi.hoisted(() => ({
  state: {
    draft: null as unknown,
    hasDraft: false,
    showRestorePrompt: false,
    lastSavedAt: null as Date | null,
  },
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
  setShowRestorePrompt: vi.fn(),
}));

vi.mock('../../hooks/useFormDraft', () => ({
  useFormDraft: () => ({
    draft: dh.state.draft,
    hasDraft: dh.state.hasDraft,
    saveDraft: dh.saveDraft,
    clearDraft: dh.clearDraft,
    showRestorePrompt: dh.state.showRestorePrompt,
    setShowRestorePrompt: dh.setShowRestorePrompt,
    lastSavedAt: dh.state.lastSavedAt,
  }),
}));

const mockNavigate = vi.fn();

const today = (() => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

const mockTeam = {
  id: 'team-1',
  name: 'Team Alpha',
  members: [
    {
      id: 'tm-1',
      teamId: 'team-1',
      userId: 'user-1',
      role: UserRole.DEVELOPERS,
      user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
    },
  ],
};

const mockSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-08-17',
  endDate: '2026-08-28',
  sprintGoal: 'Deliver the module',
  status: 'ACTIVE',
  tasks: [] as unknown[],
  sprintBacklogItems: [
    { id: 'bi-1', title: 'Item One' },
    { id: 'bi-2', pbi: { title: 'Item Two' } },
  ],
};

const savedRecord = {
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: today,
  sprintGoal: 'Deliver the module',
  focusMode: 'goal',
  progressNotes: 'progress',
  adaptationsNotes: 'adapt',
  planForNextDay: 'plan',
  noAdaptationNeeded: false,
  participants: [
    { id: 'p-1', userId: 'user-1', user: { id: 'user-1', firstName: 'John', lastName: 'Doe' } },
  ],
  backlogAdjustments: [
    {
      id: 'ba-1',
      sprintBacklogItemId: 'bi-1',
      action: 'reassigned',
      actionType: 'REFINED',
      reflection: 'REFLECTED',
    },
    {
      id: 'ba-2',
      sprintBacklogItemId: null,
      action: 'removed',
      actionType: null,
      pbiTitleAtAdjustment: 'Old item',
    },
  ],
  impediments: [],
};

const mockImpediments = [
  {
    id: 'imp-1',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'A blocker',
    description: 'desc',
    reportedById: 'user-1',
    status: ImpedimentStatus.IN_PROGRESS,
  },
];

type Setup = {
  role?: string;
  currentTeam?: unknown;
  sprint?: unknown;
  record?: unknown;
  participation?: unknown;
  impediments?: unknown[];
};

function setup(overrides: Setup = {}) {
  const role = overrides.role ?? 'developers';
  (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    currentTeam: overrides.currentTeam === undefined ? mockTeam : overrides.currentTeam,
    userRoleInCurrentTeam: role,
  });
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ user: { id: 'user-1' } });
  (useNavigate as Mock).mockReturnValue(mockNavigate);

  vi.mocked(apiService.getActiveSprint).mockResolvedValue({
    data: overrides.sprint === undefined ? mockSprint : overrides.sprint,
  } as never);
  vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: [] } as never);
  vi.mocked(apiService.getDailyScrum).mockResolvedValue({
    data: overrides.record ?? null,
  } as never);
  vi.mocked(apiService.getDailyScrumCadence).mockResolvedValue({
    data: {
      schedule: null,
      calendar: { workingDays: [1, 2, 3, 4, 5], nonWorkingDays: [] },
      date: today,
      isWorkingDay: true,
      nonWorkingDayName: null,
      sprintProgress: { dayNumber: 3, totalDays: 10 },
      held: overrides.record ? 1 : 0,
      expected: 10,
      missedDates: [],
    },
  } as never);
  vi.mocked(apiService.getDailyScrumParticipation).mockResolvedValue({
    data: overrides.participation ?? { participants: [], nonParticipants: [] },
  } as never);
  vi.mocked(apiService.getImpediments).mockResolvedValue({
    data: overrides.impediments ?? [],
  } as never);
  vi.mocked(apiService.getProductGoals).mockResolvedValue({ data: [] } as never);

  return renderWithProviders(<DailyScrum />);
}

const waitForForm = async () =>
  waitFor(() => {
    expect(screen.getByPlaceholderText('form.planPlaceholder')).toBeInTheDocument();
  });

const fillValidForm = () => {
  fireEvent.change(screen.getByPlaceholderText('form.planPlaceholder'), {
    target: { value: 'Plan for tomorrow' },
  });
  fireEvent.click(screen.getByLabelText('form.evidenceNoAdaptation'));
};

const submitForm = () => fireEvent.click(screen.getByText('submitScrum'));

describe('DailyScrum coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    dh.state = { draft: null, hasDraft: false, showRestorePrompt: false, lastSavedAt: null };
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  it('renders the no-team and no-sprint empty states', async () => {
    const { unmount } = setup({ currentTeam: null });
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
    unmount();

    setup({ sprint: null });
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('restores and discards a draft, edits notes and cancels the form', async () => {
    dh.state = {
      draft: {
        progressNotes: 'd',
        adaptationsNotes: 'a',
        planForNextDay: 'p',
        focusMode: 'goal',
        noAdaptationNeeded: false,
      },
      hasDraft: true,
      showRestorePrompt: true,
      lastSavedAt: new Date(),
    };
    setup();
    await waitForForm();

    fireEvent.click(screen.getByText('draftRestore.discard'));
    fireEvent.click(screen.getByText('draftRestore.restoreDraft'));
    expect(dh.clearDraft).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('form.adaptationsPlaceholder'), {
      target: { value: 'some adaptations' },
    });
    fireEvent.click(screen.getByLabelText('form.evidenceAdapted'));

    fireEvent.click(screen.getByText('form.cancel'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('form.planPlaceholder')).not.toBeInTheDocument();
    });
  });

  it('closes the form from its header close control', async () => {
    setup();
    await waitForForm();

    fireEvent.click(screen.getByLabelText('aria.closeForm'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('form.planPlaceholder')).not.toBeInTheDocument();
    });
  });

  it('adds and removes a Sprint Backlog adjustment, then changes the date', async () => {
    setup();
    await waitForForm();

    fireEvent.change(screen.getByLabelText('form.backlogItemSelect'), {
      target: { value: 'bi-1' },
    });
    fireEvent.change(screen.getByLabelText('form.backlogActionTypeLabel'), {
      target: { value: 'REMOVED' },
    });
    fireEvent.change(screen.getByLabelText('form.backlogActionLabel'), {
      target: { value: 'reassigned to Jane' },
    });
    fireEvent.click(screen.getByText('form.addAdjustment'));

    fireEvent.click(screen.getByLabelText('form.removeAdjustment'));

    fireEvent.click(screen.getByText('quickDates.yesterday'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('form.planPlaceholder')).not.toBeInTheDocument();
    });

    const startButtons = await screen.findAllByText('startDailyScrum');
    fireEvent.click(startButtons[0] as HTMLElement);
    fireEvent.click(startButtons[startButtons.length - 1] as HTMLElement);
  });

  it('navigates to the Sprint board from the progress card', async () => {
    setup();
    await waitForForm();

    fireEvent.click(screen.getByText('sprintProgress.viewSprintBoard'));
    expect(mockNavigate).toHaveBeenCalledWith('/sprint');
  });

  it('covers the create error message branches', async () => {
    const shapes: Array<{ online?: boolean; err: unknown }> = [
      { online: false, err: new Error('x') },
      { err: new Error('Failed to fetch') },
      { err: { response: { status: 400, data: { error: { message: 'Bad request detail' } } } } },
      { err: { response: { status: 401 } } },
      { err: { response: { status: 403 } } },
      { err: { response: { status: 404 } } },
      { err: { response: { status: 500 } } },
      { err: 'not-an-error' },
    ];

    for (const shape of shapes) {
      const { unmount } = setup();
      await waitForForm();
      fillValidForm();
      // Flip offline only for the mutation: an offline query manager would pause the initial fetch.
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: shape.online === undefined ? true : shape.online,
      });
      vi.mocked(apiService.createDailyScrum).mockRejectedValue(shape.err as never);
      submitForm();
      await waitFor(() => expect(apiService.createDailyScrum).toHaveBeenCalled());
      unmount();
    }
  });

  it('submits an empty form through the form element (no request)', async () => {
    setup();
    await waitForForm();

    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    expect(apiService.createDailyScrum).not.toHaveBeenCalled();
  });

  it('dismisses the retry banner after a failed submission', async () => {
    setup();
    await waitForForm();
    fillValidForm();
    vi.mocked(apiService.createDailyScrum).mockRejectedValue(new Error('Network error') as never);
    submitForm();

    await screen.findByText('retryPrompt.title');
    fireEvent.click(screen.getByText('retryPrompt.dismiss'));

    await waitFor(() => {
      expect(screen.queryByText('retryPrompt.title')).not.toBeInTheDocument();
    });
  });

  it('drives the promote-impediment modal: validation, unsaved guard and server errors', async () => {
    setup({ record: savedRecord });
    await screen.findByText('createImpediment');

    // Empty close path resets the form.
    fireEvent.click(screen.getByText('createImpediment'));
    await screen.findByText('promoteModal.title');
    fireEvent.click(document.querySelector('[role="dialog"]') as HTMLElement);

    // Reopen and exercise validation errors, then clear them by typing.
    fireEvent.click(screen.getByText('createImpediment'));
    await screen.findByText('promoteModal.title');
    fireEvent.change(screen.getByPlaceholderText('promoteModal.titlePlaceholder'), {
      target: { value: 'ab' },
    });
    fireEvent.change(screen.getByPlaceholderText('promoteModal.descriptionPlaceholder'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByText('promoteModal.createImpediment'));
    await screen.findByText('validation.titleTooShort');

    fireEvent.change(screen.getByPlaceholderText('promoteModal.titlePlaceholder'), {
      target: { value: 'A valid blocker title' },
    });
    fireEvent.change(screen.getByPlaceholderText('promoteModal.descriptionPlaceholder'), {
      target: { value: 'A sufficiently long description' },
    });

    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'user-2' } });
    const prioritySelect = screen
      .getAllByRole('combobox')
      .find((el) =>
        Array.from(el.querySelectorAll('option')).some(
          (o) => o.textContent === 'promoteModal.priorityHigh'
        )
      ) as HTMLSelectElement;
    fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });

    // Server validation errors (per-field details) are mapped onto the form.
    vi.mocked(apiService.promoteImpedimentFromDailyScrum).mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: { message: 'invalid', details: [{ field: 'title', message: 'title taken' }] },
        },
      },
    } as never);
    fireEvent.click(screen.getByText('promoteModal.createImpediment'));
    await waitFor(() => expect(apiService.promoteImpedimentFromDailyScrum).toHaveBeenCalled());

    // Unsaved guard: closing with a dirty form opens the confirm dialog; discard it.
    fireEvent.click(document.querySelector('[role="dialog"]') as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'unsavedChanges.discardChanges' }));

    // Reopen, dirtied again, and dismiss the guard with "go back".
    fireEvent.click(screen.getByText('createImpediment'));
    await screen.findByText('promoteModal.title');
    fireEvent.change(screen.getByPlaceholderText('promoteModal.titlePlaceholder'), {
      target: { value: 'Dirty again' },
    });
    fireEvent.click(document.querySelector('[role="dialog"]') as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'unsavedChanges.goBack' }));
  });

  it('covers the promote error fallbacks for auth and server failures', async () => {
    const errors: unknown[] = [
      { response: { status: 401 } },
      { response: { status: 403 } },
      { response: { status: 500 } },
      { response: { status: 400 } },
      new Error('network error'),
    ];

    for (const err of errors) {
      const { unmount } = setup({ record: savedRecord });
      await screen.findByText('createImpediment');
      fireEvent.click(screen.getByText('createImpediment'));
      await screen.findByText('promoteModal.title');
      fireEvent.change(screen.getByPlaceholderText('promoteModal.titlePlaceholder'), {
        target: { value: 'A valid blocker title' },
      });
      fireEvent.change(screen.getByPlaceholderText('promoteModal.descriptionPlaceholder'), {
        target: { value: 'A sufficiently long description' },
      });
      vi.mocked(apiService.promoteImpedimentFromDailyScrum).mockRejectedValue(err as never);
      fireEvent.click(screen.getByText('promoteModal.createImpediment'));
      await waitFor(() => expect(apiService.promoteImpedimentFromDailyScrum).toHaveBeenCalled());
      unmount();
    }
  });

  it('covers the team-signal error branches', async () => {
    const errors: unknown[] = [
      { response: { status: 401 } },
      { response: { status: 403 } },
      { response: { status: 500 } },
      { response: { status: 400 } },
      new Error('network error'),
      'not-an-error',
    ];

    for (const err of errors) {
      const { unmount } = setup({
        record: savedRecord,
        participation: {
          participants: [],
          nonParticipants: [{ userId: 'user-2', userName: 'Jane' }],
        },
      });
      const signal = await screen.findByText('participation.sendTeamSignal');
      vi.mocked(apiService.sendDailyScrumTeamSignal).mockRejectedValue(err as never);
      fireEvent.click(signal);
      await waitFor(() => expect(apiService.sendDailyScrumTeamSignal).toHaveBeenCalled());
      unmount();
    }
  });

  it('renders the record view with reflection chips, edits adjustments and follows an impediment link', async () => {
    setup({ record: savedRecord, impediments: mockImpediments });

    // Reflection chip is rendered for the adjustment that declares a reflection.
    expect(await screen.findByText('reflection.reflected')).toBeInTheDocument();

    // Edit re-stages only the adjustments that still have a Sprint Backlog item.
    fireEvent.click(screen.getByText('editScrum'));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('form.planPlaceholder')).toBeInTheDocument();
    });

    // Navigate from an impediment in the record.
    fireEvent.click(await screen.findByTitle('updateCard.viewImpedimentDetails'));
    expect(mockNavigate).toHaveBeenCalledWith('/impediments?id=imp-1');
  });

  it('covers the update mutation error path', async () => {
    setup({ record: savedRecord });
    await screen.findByText('editScrum');
    fireEvent.click(screen.getByText('editScrum'));
    await screen.findByPlaceholderText('form.planPlaceholder');
    fillValidForm();
    vi.mocked(apiService.updateDailyScrum).mockRejectedValue(new Error('boom') as never);
    fireEvent.click(screen.getByText('saveScrum'));
    await waitFor(() => expect(apiService.updateDailyScrum).toHaveBeenCalled());
  });

  it('formats the "time since draft saved" across its ranges', async () => {
    const ages = [
      new Date(),
      new Date(Date.now() - 5 * 60 * 1000),
      new Date(Date.now() - 3 * 60 * 60 * 1000),
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    ];

    for (const lastSavedAt of ages) {
      dh.state = { draft: null, hasDraft: false, showRestorePrompt: false, lastSavedAt };
      const { unmount } = setup();
      // The draft indicator renders once the form (auto-opened for a developer today) mounts.
      await waitFor(() => {
        expect(screen.getByText('draftSaved')).toBeInTheDocument();
      });
      unmount();
    }
  });
});
