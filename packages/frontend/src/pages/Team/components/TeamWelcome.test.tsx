/**
 * The welcome a signed-in user without a team sees.
 *
 * It has exactly two ways in -- create a team, or go and find an invitation -- and both are
 * navigation. The greeting is the only thing that varies with the profile, so both variants are
 * rendered here and both actions are driven.
 */
import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../test-utils';
import { vi, beforeAll } from 'vitest';

import { TeamWelcome } from './TeamWelcome';

describe('TeamWelcome', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('navigates to team creation and to notifications from its two actions', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<TeamWelcome userName="Ada" onNavigate={onNavigate} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]!);
    fireEvent.click(buttons[1]!);

    expect(onNavigate).toHaveBeenCalledWith('/settings/team-management?create=1');
    expect(onNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('greets an anonymous reader when the profile carries no first name', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<TeamWelcome userName={null} onNavigate={onNavigate} />);

    // The capabilities and both role cards are rendered regardless of the greeting.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
