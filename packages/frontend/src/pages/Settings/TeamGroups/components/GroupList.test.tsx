import React from 'react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TeamGroupSummary } from '@scrumooth/shared';

import { initTestI18n, renderWithProviders, screen } from '../../../../test-utils';

import { GroupList } from './GroupList';

const groups: TeamGroupSummary[] = [
  {
    id: 'group-1',
    name: 'Payments product',
    description: 'Two teams, one product.',
    teamCount: 2,
    dodVersion: 3,
  },
  { id: 'group-2', name: 'Onboarding product', description: null, teamCount: 0, dodVersion: 1 },
];

describe('GroupList', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('lists each group with its description and marks the selected one', () => {
    renderWithProviders(<GroupList groups={groups} selectedGroupId="group-1" onSelect={vi.fn()} />);

    expect(screen.getByText('Payments product')).toBeInTheDocument();
    expect(screen.getByText('Two teams, one product.')).toBeInTheDocument();
    expect(screen.getByText('Onboarding product')).toBeInTheDocument();

    const selected = screen.getByRole('button', { name: /payments product/i });
    expect(selected).toHaveAttribute('aria-current', 'true');

    const unselected = screen.getByRole('button', { name: /onboarding product/i });
    expect(unselected).not.toHaveAttribute('aria-current');
  });

  it('reports the group a reader chooses', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderWithProviders(<GroupList groups={groups} selectedGroupId={null} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /onboarding product/i }));

    expect(onSelect).toHaveBeenCalledWith('group-2');
  });
});
