import type { ComponentProps } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { SmNotesEntityType, type SmNotesRevision } from '@scrumooth/shared';
import {
  act,
  screen,
  createTestQueryClient,
  i18nT,
  initTestI18n,
  renderWithProviders,
} from '../../../test-utils';

import { queryKeys } from '../../../hooks/queryKeys';

import { SprintSmNotes } from './SprintSmNotes';

// The child editor (`SMNotes`) is mocked so this suite exercises what `SprintSmNotes` itself owns:
// which service calls it makes, how it invalidates the Sprint queries, and how it resolves the
// revision history. The real editor has its own suite (components/common/SMNotes/SMNotes.test.tsx).
const mocks = vi.hoisted(() => ({
  updateSprintSmNotes: vi.fn(),
  getSprintSmNotesRevisions: vi.fn(),
  smNotesProps: vi.fn(),
}));

vi.mock('../../../services', () => ({
  smDashboardService: {
    updateSprintSmNotes: mocks.updateSprintSmNotes,
    getSprintSmNotesRevisions: mocks.getSprintSmNotesRevisions,
  },
}));

vi.mock('../../../components/common/SMNotes', () => ({
  SMNotes: (props: Record<string, unknown>) => {
    mocks.smNotesProps(props);

    return <div data-testid="sm-notes-stub" />;
  },
}));

vi.mock('./SprintSmNotes.module.css', () => ({
  default: { panel: 'panel', hint: 'hint' },
}));

/** The props passed down to the mocked editor on its most recent render. */
interface StubbedSmNotesProps {
  value?: string | null;
  onSave: (notes: string) => Promise<unknown>;
  loadHistory?: () => Promise<SmNotesRevision[]>;
}

const latestProps = (): StubbedSmNotesProps => {
  const lastCall = mocks.smNotesProps.mock.calls.at(-1);

  return (lastCall?.[0] ?? {}) as StubbedSmNotesProps;
};

const revisions: SmNotesRevision[] = [
  {
    id: 'rev-2',
    entityType: SmNotesEntityType.SPRINT,
    entityId: 'sprint-1',
    revision: 2,
    content: 'Second version of the notes',
    createdBy: 'user-1',
    authorName: 'Grace Hopper',
    createdAt: '2026-09-22T16:00:00.000Z',
  },
  {
    id: 'rev-1',
    entityType: SmNotesEntityType.SPRINT,
    entityId: 'sprint-1',
    revision: 1,
    content: 'First version of the notes',
    createdBy: 'user-1',
    authorName: 'Grace Hopper',
    createdAt: '2026-09-15T16:00:00.000Z',
  },
];

const revisionPage = (items: SmNotesRevision[] = revisions) => ({
  success: true as const,
  data: { revisions: items, total: items.length, limit: 20, offset: 0 },
});

const renderPanel = (props: Partial<ComponentProps<typeof SprintSmNotes>> = {}) => {
  const queryClient = createTestQueryClient();
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    invalidateSpy,
    ...renderWithProviders(
      <SprintSmNotes sprintId="sprint-1" smNotes="Existing notes" {...props} />,
      { queryClient }
    ),
  };
};

describe('SprintSmNotes', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSprintSmNotes.mockResolvedValue({ success: true });
    mocks.getSprintSmNotesRevisions.mockResolvedValue(revisionPage());
  });

  describe('Rendering', () => {
    it('renders the Sprint notes panel with the Scrum Master hint', () => {
      renderPanel();

      expect(screen.getByTestId('sprint-sm-notes')).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('scrum-master-dashboard:sprintNotes.hint'))
      ).toBeInTheDocument();
    });

    it('passes the Sprint notes down to the editor', () => {
      renderPanel({ smNotes: 'Observed the Daily Scrum drifting' });

      expect(mocks.smNotesProps).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'Observed the Daily Scrum drifting' })
      );
    });

    it('forwards a null value when the Sprint has no notes', () => {
      renderPanel({ smNotes: null });

      expect(latestProps().value).toBeNull();
    });

    it('wires both the save handler and the history loader into the editor', () => {
      renderPanel();

      expect(typeof latestProps().onSave).toBe('function');
      expect(typeof latestProps().loadHistory).toBe('function');
    });
  });

  describe('Saving notes', () => {
    it('writes the notes through the Sprint endpoint', async () => {
      renderPanel({ sprintId: 'sprint-42' });

      await act(async () => {
        await latestProps().onSave('Updated coaching notes');
      });

      expect(mocks.updateSprintSmNotes).toHaveBeenCalledWith('sprint-42', 'Updated coaching notes');
    });

    it('invalidates the Sprint queries so the board refetches the notes', async () => {
      const { invalidateSpy } = renderPanel();

      await act(async () => {
        await latestProps().onSave('Notes that need a refetch');
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.sprint.all });
    });

    it('invalidates the Sprint queries only after the write succeeds', async () => {
      let resolveWrite!: (value: unknown) => void;
      mocks.updateSprintSmNotes.mockReturnValue(
        new Promise((resolve) => {
          resolveWrite = resolve;
        })
      );

      const { invalidateSpy } = renderPanel();
      const savePromise = latestProps().onSave('Pending notes');

      expect(invalidateSpy).not.toHaveBeenCalled();

      await act(async () => {
        resolveWrite({ success: true });
        await savePromise;
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.sprint.all });
    });

    it('propagates a failed write without touching the cache', async () => {
      const { invalidateSpy } = renderPanel();
      mocks.updateSprintSmNotes.mockRejectedValue(new Error('write failed'));

      await expect(latestProps().onSave('Doomed notes')).rejects.toThrow('write failed');

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Loading the revision history', () => {
    it('reads the Sprint revisions and returns them newest first', async () => {
      renderPanel({ sprintId: 'sprint-42' });

      const history = await latestProps().loadHistory?.();

      expect(mocks.getSprintSmNotesRevisions).toHaveBeenCalledWith('sprint-42');
      expect(history).toEqual(revisions);
    });

    it('returns an empty trail when the response carries no data', async () => {
      mocks.getSprintSmNotesRevisions.mockResolvedValue({ success: true });
      renderPanel();

      await expect(latestProps().loadHistory?.()).resolves.toEqual([]);
    });

    it('returns an empty trail when the page carries no revisions', async () => {
      mocks.getSprintSmNotesRevisions.mockResolvedValue({
        success: true,
        data: { total: 0, limit: 20, offset: 0 },
      });
      renderPanel();

      await expect(latestProps().loadHistory?.()).resolves.toEqual([]);
    });

    it('propagates a refused history read so the editor can report it', async () => {
      mocks.getSprintSmNotesRevisions.mockRejectedValue(new Error('forbidden'));
      renderPanel();

      await expect(latestProps().loadHistory?.()).rejects.toThrow('forbidden');
    });
  });
});
