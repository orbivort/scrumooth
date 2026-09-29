/**
 * Impediments module shell tests.
 *
 * The module holds two registers of what blocks the team behind one URL: the team's own impediment
 * list and the organizational barrier register. Coverage here is the shell itself -- the single
 * page title, the tab semantics and keyboard operation, the URL as the source of truth for the
 * selection, the register staying usable while the team has no active sprint, and the escalation
 * hand-off that reveals the register and moves focus into it.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import {
  screen,
  within,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { useSearchParams } from 'react-router';

import { useTeamStore } from '../../store';
import { apiService, organizationalBarriersService } from '../../services';
import { mockBarrierStats, mockBarriers } from '../../__mocks__/facilitationData';
import { ImpedimentStatus, SprintStatus } from '../../types';

import { Impediments } from './Impediments';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  // The panel reads the current user id to decide reporter/owner delete rights.
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}));

vi.mock('../../services');

// --- Fixtures ---------------------------------------------------------------------------------

const BARRIER = mockBarriers[0]!;

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'A test team',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [
    {
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-1',
      role: 'scrum_master',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    },
  ],
};

const mockActiveSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-14T23:59:59Z',
  sprintGoal: 'Complete authentication feature',
  status: SprintStatus.ACTIVE,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockImpediment = {
  id: 'imp-1',
  teamId: 'team-1',
  sprintId: 'sprint-1',
  title: 'API downtime',
  description: 'External API is experiencing intermittent downtime',
  reportedById: 'user-1',
  status: ImpedimentStatus.OPEN,
  createdAt: '2026-02-05T10:00:00Z',
  updatedAt: '2026-02-05T10:00:00Z',
  reportedBy: {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
};

// --- Queries ----------------------------------------------------------------------------------

/** Mirrors the module's own URL plumbing so the selection can be asserted as the user sees it. */
const SearchParamsCapture: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams] = useSearchParams();

  return (
    <>
      <span data-testid="search-params">{searchParams.toString()}</span>
      {children}
    </>
  );
};

const registerTab = (): HTMLElement =>
  screen.getByRole('tab', { name: i18nT('impediments:tabs.barriers') });

const listTab = (): HTMLElement =>
  screen.getByRole('tab', { name: i18nT('impediments:tabs.impediments') });

const activePanel = (): HTMLElement => screen.getByRole('tabpanel');

const searchParamsText = (): string => screen.getByTestId('search-params').textContent ?? '';

// --- Rendering --------------------------------------------------------------------------------

const renderModule = (initialRoute = '/impediments'): void => {
  renderWithProviders(
    <SearchParamsCapture>
      <Impediments />
    </SearchParamsCapture>,
    { initialRoute }
  );
};

describe('Impediments module', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: mockTeam,
      userRoleInCurrentTeam: 'SCRUM_MASTER',
    });

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      success: true,
      data: mockActiveSprint,
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({
      success: true,
      data: [mockImpediment],
    } as never);
    vi.mocked(organizationalBarriersService.getBarriers).mockResolvedValue({
      success: true,
      data: mockBarriers,
    } as never);
    vi.mocked(organizationalBarriersService.getStats).mockResolvedValue({
      success: true,
      data: mockBarrierStats,
    } as never);
  });

  describe('the module frame', () => {
    it('gives the page one title and one tab per register', async () => {
      renderModule();

      await screen.findByText(mockImpediment.title);

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
        i18nT('impediments:title')
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAccessibleName(i18nT('impediments:tabs.ariaLabel'));
      expect(within(tablist).getAllByRole('tab')).toHaveLength(2);
    });

    it('opens on the team impediment list without querying the register', async () => {
      renderModule();

      await screen.findByText(mockImpediment.title);

      expect(listTab()).toHaveAttribute('aria-selected', 'true');
      expect(registerTab()).toHaveAttribute('aria-selected', 'false');
      // Roving tabindex: the strip is a single tab stop, so only the selected tab is reachable.
      expect(listTab()).toHaveAttribute('tabindex', '0');
      expect(registerTab()).toHaveAttribute('tabindex', '-1');
      expect(activePanel()).toHaveAccessibleName(i18nT('impediments:tabs.impediments'));
      expect(apiService.getImpediments).toHaveBeenCalled();
      expect(organizationalBarriersService.getBarriers).not.toHaveBeenCalled();
    });

    it('refuses to render a register without a team', async () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: undefined,
      });

      renderModule();

      expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });

  describe('the URL as the selected register', () => {
    it('opens the register the address points at', async () => {
      renderModule('/impediments?tab=barriers');

      await screen.findByText(BARRIER.title);

      expect(registerTab()).toHaveAttribute('aria-selected', 'true');
      expect(activePanel()).toHaveAccessibleName(i18nT('impediments:tabs.barriers'));
      // The list is not fetched for a visit that never shows it.
      expect(apiService.getImpediments).not.toHaveBeenCalled();
    });

    it('records the chosen register and drops the parameter for the default one', async () => {
      const user = userEvent.setup();
      renderModule();

      await screen.findByText(mockImpediment.title);
      expect(searchParamsText()).toBe('');

      await user.click(registerTab());
      await waitFor(() => {
        expect(searchParamsText()).toContain('tab=barriers');
      });

      await user.click(listTab());
      await waitFor(() => {
        expect(searchParamsText()).toBe('');
      });
    });

    it('leaves the impediment the list had open behind when the register opens', async () => {
      const user = userEvent.setup();
      renderModule();

      await user.click(await screen.findByText(mockImpediment.title));
      await waitFor(() => {
        expect(searchParamsText()).toContain('id=imp-1');
      });

      await user.click(registerTab());

      // The address describes what is on screen: the register, and nothing the list had open.
      await waitFor(() => {
        expect(searchParamsText()).toBe('tab=barriers');
      });
    });
  });

  describe('keyboard operation', () => {
    it('moves the selection with the arrow keys and jumps with Home and End', async () => {
      renderModule();

      await screen.findByText(mockImpediment.title);

      fireEvent.keyDown(listTab(), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(registerTab()).toHaveAttribute('aria-selected', 'true');
      });
      expect(registerTab()).toHaveFocus();

      fireEvent.keyDown(registerTab(), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(listTab()).toHaveAttribute('aria-selected', 'true');
      });

      fireEvent.keyDown(listTab(), { key: 'End' });
      await waitFor(() => {
        expect(registerTab()).toHaveAttribute('aria-selected', 'true');
      });

      fireEvent.keyDown(registerTab(), { key: 'Home' });
      await waitFor(() => {
        expect(listTab()).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  describe('the register without an active sprint', () => {
    it('stays usable while the team has no sprint, which the list cannot be', async () => {
      vi.mocked(apiService.getActiveSprint).mockResolvedValue({
        success: true,
        data: null,
      } as never);

      renderModule('/impediments?tab=barriers');

      expect(await screen.findByText(BARRIER.title)).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();

      // Switching to the list keeps the module frame and reports the missing sprint inside it.
      await userEvent.setup().click(listTab());

      expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('escalation hand-off', () => {
    it('reveals the register and moves focus there once an impediment is carried over', async () => {
      const user = userEvent.setup();

      vi.mocked(organizationalBarriersService.escalateImpediment).mockResolvedValue({
        success: true,
        data: BARRIER,
      } as never);

      renderModule();

      await user.click(await screen.findByText(mockImpediment.title));
      await user.click(
        await screen.findByRole('button', { name: i18nT('barriers:escalate.action') })
      );
      await user.click(
        await screen.findByRole('button', { name: i18nT('barriers:escalate.confirm') })
      );

      await waitFor(() => {
        expect(registerTab()).toHaveAttribute('aria-selected', 'true');
      });
      // The new barrier is on screen and the keyboard user is standing in the register, not back
      // on the list they escalated from.
      expect(await screen.findByText(BARRIER.title)).toBeInTheDocument();
      expect(searchParamsText()).toBe('tab=barriers');
      await waitFor(() => {
        expect(activePanel()).toHaveFocus();
      });
    });
  });
});
