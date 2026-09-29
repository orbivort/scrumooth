/**
 * EscalateImpedimentDialog tests.
 *
 * The dialog is the "act" behind the Scrum Master dashboard: it turns a team impediment the team
 * cannot remove by itself into an organizational barrier. These tests pin the prefill from the
 * impediment, the payload the server is asked to record, the link between the two records, the
 * refusal of a second escalation, and the busy/error states around the submit.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { axe } from 'vi-axe';
import {
  screen,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';

import { EscalateImpedimentDialog, type EscalationSource } from './EscalateImpedimentDialog';
import { organizationalBarriersService } from '../../services';
import { useTeamStore } from '../../store';

// The dialog owns no data fetching of its own; the store supplies the team and the service the
// write. Both are mocked so the tests describe the dialog, not the API layer.
vi.mock('../../services', () => ({
  organizationalBarriersService: { escalateImpediment: vi.fn() },
}));

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('./EscalateImpedimentDialog.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const escalateMock = vi.mocked(organizationalBarriersService.escalateImpediment);
const mockedUseTeamStore = useTeamStore as unknown as ReturnType<typeof vi.fn>;

type EscalationApiResult = Awaited<
  ReturnType<typeof organizationalBarriersService.escalateImpediment>
>;

// --- Fixtures -------------------------------------------------------------------------------

const mockTeam = {
  id: 'team-1',
  name: 'Platform Team',
  members: [
    {
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-1',
      role: 'DEVELOPERS',
      joinedAt: '2026-01-01T00:00:00Z',
      user: { id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' },
    },
    {
      id: 'member-2',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'PRODUCT_OWNER',
      joinedAt: '2026-01-01T00:00:00Z',
      user: { id: 'user-2', firstName: 'Grace', lastName: 'Hopper' },
    },
    // A membership without a hydrated user record still has to be ownable: the dialog falls back
    // to the raw user id rather than rendering an empty option.
    {
      id: 'member-3',
      teamId: 'team-1',
      userId: 'user-without-profile',
      role: 'DEVELOPERS',
      joinedAt: '2026-01-01T00:00:00Z',
    },
  ],
};

const makeSource = (overrides: Partial<EscalationSource> = {}): EscalationSource => ({
  id: 'imp-1',
  title: 'Legacy build server blocks the release',
  description: 'The build server has failed for two sprints.',
  priority: 'HIGH',
  ...overrides,
});

const setCurrentTeam = (team: unknown): void => {
  mockedUseTeamStore.mockReturnValue({ currentTeam: team });
};

const onClose = vi.fn();
const onEscalated = vi.fn();

interface DialogProps {
  open?: boolean;
  source?: EscalationSource | null;
}

const dialogElement = ({ open = true, source = makeSource() }: DialogProps = {}) => (
  <EscalateImpedimentDialog
    open={open}
    source={source}
    onClose={onClose}
    onEscalated={onEscalated}
  />
);

const renderDialog = (props: DialogProps = {}) => renderWithProviders(dialogElement(props));

/**
 * The dialog is controlled: it only closes because the page that owns it flips `open` on
 * `onClose`. Cancellation has to be exercised against that contract, not against a dialog the
 * test keeps mounted.
 */
const ClosableDialog: React.FC<{ source: EscalationSource }> = ({ source }) => {
  const [open, setOpen] = React.useState(true);
  const handleClose = React.useCallback(() => {
    setOpen(false);
    onClose();
  }, []);

  return (
    <EscalateImpedimentDialog
      open={open}
      source={source}
      onClose={handleClose}
      onEscalated={onEscalated}
    />
  );
};

// --- Queries --------------------------------------------------------------------------------

const dialog = (): HTMLElement => screen.getByRole('dialog');
const form = (): HTMLFormElement => dialog().querySelector('form') as HTMLFormElement;

const titleInput = (): HTMLInputElement =>
  screen.getByLabelText(i18nT('barriers:escalate.titleLabel')) as HTMLInputElement;
const descriptionInput = (): HTMLTextAreaElement =>
  screen.getByLabelText(i18nT('barriers:escalate.descriptionLabel')) as HTMLTextAreaElement;
const prioritySelect = (): HTMLSelectElement =>
  screen.getByLabelText(i18nT('barriers:escalate.priority')) as HTMLSelectElement;
const ownerSelect = (): HTMLSelectElement =>
  screen.getByLabelText(i18nT('barriers:escalate.owner')) as HTMLSelectElement;
const targetDateInput = (): HTMLInputElement =>
  screen.getByLabelText(i18nT('barriers:escalate.targetDate')) as HTMLInputElement;

const confirmButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:escalate.confirm') });
const cancelButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:escalate.cancel') });

const submitForm = (): void => fireEvent.submit(form());

const optionTexts = (select: HTMLSelectElement): (string | null)[] =>
  Array.from(select.options).map((option) => option.textContent);

/** A promise the test resolves by hand, to observe the in-flight state. */
const deferred = () => {
  let resolve!: (value: EscalationApiResult | PromiseLike<EscalationApiResult>) => void;
  const promise = new Promise<EscalationApiResult>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

// --- Setup ----------------------------------------------------------------------------------

beforeAll(async () => {
  await initTestI18n();
});

beforeEach(() => {
  vi.clearAllMocks();
  setCurrentTeam(mockTeam);
  escalateMock.mockResolvedValue({ success: true });
});

// --- Tests ----------------------------------------------------------------------------------

describe('EscalateImpedimentDialog', () => {
  describe('visibility', () => {
    it('renders nothing while closed', () => {
      renderDialog({ open: false });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders nothing without an impediment to escalate', () => {
      renderDialog({ source: null });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders a modal dialog labelled with its title', () => {
      renderDialog();

      expect(dialog()).toHaveAttribute('aria-modal', 'true');
      expect(dialog()).toHaveAttribute('aria-label', i18nT('barriers:escalate.title'));
      expect(screen.getByText(i18nT('barriers:escalate.intro'))).toBeInTheDocument();
    });
  });

  describe('prefill from the impediment', () => {
    it('carries the impediment title and description into the barrier', () => {
      renderDialog();

      expect(titleInput().value).toBe('Legacy build server blocks the release');
      expect(descriptionInput().value).toBe('The build server has failed for two sprints.');
    });

    it('leaves the description empty when the impediment has none', () => {
      renderDialog({ source: makeSource({ description: null }) });

      expect(descriptionInput().value).toBe('');
    });

    it('names the source impediment so the link is visible', () => {
      renderDialog();

      // The dialog states which impediment is being escalated before the barrier fields.
      expect(screen.getByText(`${i18nT('barriers:escalate.impediment')}:`)).toBeInTheDocument();
      expect(
        screen.getByText('Legacy build server blocks the release', { selector: 'strong' })
      ).toBeInTheDocument();
    });

    it('carries the impediment impact into the barrier priority', () => {
      renderDialog({ source: makeSource({ priority: 'CRITICAL' }) });

      expect(prioritySelect().value).toBe('CRITICAL');
    });

    it('defaults the priority to Medium when the impediment declares no impact', () => {
      renderDialog({ source: makeSource({ priority: undefined }) });

      expect(prioritySelect().value).toBe('MEDIUM');
    });

    it('starts with no owner and no target date', () => {
      renderDialog();

      expect(ownerSelect().value).toBe('');
      expect(targetDateInput().value).toBe('');
    });

    it('resets every field when reopened for a different impediment', async () => {
      const { rerender } = renderDialog({ source: makeSource({ priority: 'HIGH' }) });

      fireEvent.change(titleInput(), { target: { value: 'Half-written barrier' } });
      fireEvent.change(descriptionInput(), { target: { value: 'Half-written description' } });
      fireEvent.change(prioritySelect(), { target: { value: 'LOW' } });
      fireEvent.change(ownerSelect(), { target: { value: 'user-1' } });
      fireEvent.change(targetDateInput(), { target: { value: '2026-12-31' } });

      rerender(
        dialogElement({
          source: makeSource({
            id: 'imp-2',
            title: 'Vendor licence expired',
            description: null,
            priority: 'LOW',
          }),
        })
      );

      await waitFor(() => {
        expect(titleInput().value).toBe('Vendor licence expired');
      });
      expect(descriptionInput().value).toBe('');
      expect(prioritySelect().value).toBe('LOW');
      expect(ownerSelect().value).toBe('');
      expect(targetDateInput().value).toBe('');
    });
  });

  describe('barrier controls', () => {
    it('offers the impact scale most critical first', () => {
      renderDialog();

      expect(Array.from(prioritySelect().options).map((option) => option.value)).toEqual([
        'CRITICAL',
        'HIGH',
        'MEDIUM',
        'LOW',
      ]);
      expect(optionTexts(prioritySelect())).toEqual([
        i18nT('barriers:priority.critical'),
        i18nT('barriers:priority.high'),
        i18nT('barriers:priority.medium'),
        i18nT('barriers:priority.low'),
      ]);
    });

    it('offers the team members as owners, plus an unassigned choice', () => {
      renderDialog();

      expect(Array.from(ownerSelect().options).map((option) => option.value)).toEqual([
        '',
        'user-1',
        'user-2',
        'user-without-profile',
      ]);
      expect(optionTexts(ownerSelect())).toEqual([
        i18nT('barriers:list.unassigned'),
        'Ada Lovelace',
        'Grace Hopper',
        'user-without-profile',
      ]);
    });

    it('offers no owner but the unassigned choice when there is no current team', () => {
      setCurrentTeam(null);

      renderDialog();

      expect(Array.from(ownerSelect().options).map((option) => option.value)).toEqual(['']);
    });

    it('lets the Scrum Master rewrite the barrier title and description', () => {
      renderDialog();

      fireEvent.change(titleInput(), { target: { value: 'Raise it with procurement' } });
      fireEvent.change(descriptionInput(), {
        target: { value: 'Legal review stalls the contract.' },
      });

      expect(titleInput().value).toBe('Raise it with procurement');
      expect(descriptionInput().value).toBe('Legal review stalls the contract.');
    });

    it('lets the Scrum Master choose an owner and a target date', () => {
      renderDialog();

      fireEvent.change(ownerSelect(), { target: { value: 'user-2' } });
      fireEvent.change(targetDateInput(), { target: { value: '2027-01-15' } });

      expect(ownerSelect().value).toBe('user-2');
      expect(targetDateInput().value).toBe('2027-01-15');
    });
  });

  describe('an already escalated impediment', () => {
    it('names the barrier the impediment already points at', () => {
      renderDialog({ source: makeSource({ alreadyEscalatedTo: 'Platform board' }) });

      expect(screen.getByRole('alert')).toHaveTextContent(
        i18nT('barriers:escalate.alreadyEscalated', { title: 'Platform board' })
      );
    });

    it('refuses a second escalation by disabling the confirm button', () => {
      renderDialog({ source: makeSource({ alreadyEscalatedTo: 'Platform board' }) });

      expect(confirmButton()).toBeDisabled();
    });

    it('stays silent and actionable when the impediment has not been escalated', () => {
      renderDialog();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(confirmButton()).not.toBeDisabled();
    });
  });

  describe('submission', () => {
    it('records the barrier against the impediment and the current team', async () => {
      renderDialog({ source: makeSource({ id: 'imp-42' }) });

      fireEvent.change(titleInput(), { target: { value: 'Procurement backlog' } });
      fireEvent.change(descriptionInput(), {
        target: { value: 'Legal review stalls the contract.' },
      });
      fireEvent.change(prioritySelect(), { target: { value: 'CRITICAL' } });
      fireEvent.change(ownerSelect(), { target: { value: 'user-2' } });
      fireEvent.change(targetDateInput(), { target: { value: '2026-12-31' } });

      submitForm();

      await waitFor(() => {
        expect(escalateMock).toHaveBeenCalledWith({
          teamId: 'team-1',
          impedimentId: 'imp-42',
          title: 'Procurement backlog',
          description: 'Legal review stalls the contract.',
          priority: 'CRITICAL',
          ownerId: 'user-2',
          targetDate: '2026-12-31',
        });
      });
    });

    it('trims the barrier text it sends', async () => {
      renderDialog();

      fireEvent.change(titleInput(), { target: { value: '   Procurement backlog   ' } });
      fireEvent.change(descriptionInput(), { target: { value: '   Legal review stalls.   ' } });

      submitForm();

      await waitFor(() => {
        expect(escalateMock).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Procurement backlog',
            description: 'Legal review stalls.',
          })
        );
      });
    });

    it('sends blanks as absent, and an unassigned owner and target date as null', async () => {
      renderDialog();

      fireEvent.change(titleInput(), { target: { value: '   ' } });
      fireEvent.change(descriptionInput(), { target: { value: '' } });

      submitForm();

      await waitFor(() => {
        expect(escalateMock).toHaveBeenCalledWith({
          teamId: 'team-1',
          impedimentId: 'imp-1',
          title: undefined,
          description: undefined,
          priority: 'HIGH',
          ownerId: null,
          targetDate: null,
        });
      });
    });

    it('closes the dialog and reports the escalation once the barrier exists', async () => {
      renderDialog();

      submitForm();

      await waitFor(() => {
        expect(onEscalated).toHaveBeenCalledTimes(1);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('marks the submit busy and locks the cancel while the escalation is in flight', async () => {
      const pending = deferred();
      escalateMock.mockReturnValueOnce(pending.promise);

      renderDialog();
      submitForm();

      await waitFor(() => {
        expect(confirmButton()).toHaveAttribute('aria-busy', 'true');
      });
      expect(cancelButton()).toBeDisabled();

      pending.resolve({ success: true });

      await waitFor(() => {
        expect(confirmButton()).toHaveAttribute('aria-busy', 'false');
      });
    });

    it('does nothing when there is no current team to escalate against', () => {
      setCurrentTeam(null);

      renderDialog();
      submitForm();

      expect(escalateMock).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('a refused escalation', () => {
    it('shows the server refusal as it stands', async () => {
      escalateMock.mockRejectedValue({
        response: {
          data: {
            error: { message: 'This impediment was already escalated to “Platform board”.' },
          },
        },
      });

      renderDialog();
      submitForm();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'This impediment was already escalated to “Platform board”.'
      );
    });

    it('falls back to the localized message when the server sends no message', async () => {
      escalateMock.mockRejectedValue(new Error('network down'));

      renderDialog();
      submitForm();

      expect(await screen.findByRole('alert')).toHaveTextContent(i18nT('barriers:escalate.error'));
    });

    it('stops being busy and leaves the dialog open so the refusal can be read', async () => {
      escalateMock.mockRejectedValue(new Error('network down'));

      renderDialog();
      submitForm();

      await screen.findByRole('alert');
      expect(confirmButton()).toHaveAttribute('aria-busy', 'false');
      expect(cancelButton()).not.toBeDisabled();
      expect(onClose).not.toHaveBeenCalled();
      expect(onEscalated).not.toHaveBeenCalled();
    });

    it('clears a previous refusal when reopened for a different impediment', async () => {
      escalateMock.mockRejectedValue(new Error('network down'));

      const { rerender } = renderDialog();
      submitForm();

      expect(await screen.findByRole('alert')).toBeInTheDocument();

      rerender(dialogElement({ source: makeSource({ id: 'imp-2' }) }));

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('cancellation', () => {
    it('closes the dialog when cancelled', () => {
      // The cancel affordance is a plain button inside the form, so the environment also runs the
      // form's submit path on the click; a never-settling escalation keeps this test about the
      // close itself rather than about that ordering.
      escalateMock.mockReturnValue(new Promise<EscalationApiResult>(() => {}));

      renderWithProviders(<ClosableDialog source={makeSource()} />);

      fireEvent.click(cancelButton());

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderDialog();

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });

    it('has no accessibility violations when the impediment is already escalated', async () => {
      const { container } = renderDialog({
        source: makeSource({ alreadyEscalatedTo: 'Platform board' }),
      });

      const results = await axe(container);

      expect(results).toHaveNoViolations();
    });
  });
});
