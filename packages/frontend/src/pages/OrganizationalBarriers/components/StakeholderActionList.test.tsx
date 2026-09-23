/**
 * StakeholderActionList tests.
 *
 * Removing a barrier is a sequence of agreements with people outside the team, so each one is
 * recorded with its own owner and due date. These tests pin what the list shows (owner, due date,
 * status, the overdue marker), who is offered the write affordances, the payload the add form
 * hands back, and the refusal of an action described in fewer than three characters.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  screen,
  within,
  fireEvent,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../../test-utils';
import { StakeholderActionStatus, type BarrierStakeholderAction } from '@scrumooth/shared';

import { StakeholderActionList } from './StakeholderActionList';

// The component only reads class names off the stylesheet, so a proxy keeps the module import
// cheap without pulling the real CSS in.
vi.mock('../OrganizationalBarriers.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

type StakeholderActionListProps = React.ComponentProps<typeof StakeholderActionList>;

// --- Fixtures -------------------------------------------------------------------------------

const MEMBERS = [
  { userId: 'user-1', name: 'Ada Lovelace' },
  { userId: 'user-2', name: 'Grace Hopper' },
];

const makeAction = (
  overrides: Partial<BarrierStakeholderAction> = {}
): BarrierStakeholderAction => ({
  id: 'action-1',
  barrierId: 'barrier-1',
  description: 'Meet the platform group to agree a standing staging slot',
  ownerId: 'user-1',
  ownerName: 'Ada Lovelace',
  dueDate: '2026-10-01T00:00:00.000Z',
  status: StakeholderActionStatus.OPEN,
  completedAt: null,
  daysUntilDue: 5,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

// --- Queries --------------------------------------------------------------------------------

const addButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:action.add') });
const cancelButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('common:cancel') });
const completeButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:action.complete') });
const deleteButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:action.delete') });

const descriptionInput = (): HTMLInputElement =>
  screen.getByLabelText(i18nT('barriers:action.description')) as HTMLInputElement;
const ownerSelect = (): HTMLSelectElement =>
  screen.getByLabelText(i18nT('barriers:action.owner')) as HTMLSelectElement;
const dueDateInput = (): HTMLInputElement =>
  screen.getByLabelText(i18nT('barriers:action.dueDate')) as HTMLInputElement;

const items = (): HTMLElement[] => screen.getAllByRole('listitem');
const alert = (): HTMLElement => screen.getByRole('alert');

const optionTexts = (select: HTMLSelectElement): (string | null)[] =>
  Array.from(select.options).map((option) => option.textContent);

// --- Interactions ---------------------------------------------------------------------------

const typeDescription = (value: string): void =>
  fireEvent.change(descriptionInput(), { target: { value } });
const chooseOwner = (value: string): void => fireEvent.change(ownerSelect(), { target: { value } });
const chooseDueDate = (value: string): void =>
  fireEvent.change(dueDateInput(), { target: { value } });

const openForm = (): void => fireEvent.click(addButton());

// --- Setup ----------------------------------------------------------------------------------

const renderList = (props: Partial<StakeholderActionListProps> = {}) => {
  const onAdd = vi.fn();
  const onComplete = vi.fn();
  const onDelete = vi.fn();

  renderWithProviders(
    <StakeholderActionList
      actions={[]}
      canWrite
      members={MEMBERS}
      onAdd={onAdd}
      onComplete={onComplete}
      onDelete={onDelete}
      {...props}
    />
  );

  return { onAdd, onComplete, onDelete };
};

describe('StakeholderActionList', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  describe('what the list shows', () => {
    it('names the section for what it is', () => {
      renderList();

      expect(
        screen.getByRole('heading', { name: i18nT('barriers:detail.stakeholderActions') })
      ).toBeInTheDocument();
    });

    it('records each action with its description, owner, due date and status', () => {
      renderList({
        actions: [
          makeAction(),
          makeAction({
            id: 'action-2',
            description: 'Agree the shared budget',
            ownerId: 'user-2',
            ownerName: 'Grace Hopper',
            dueDate: '2026-11-20T00:00:00.000Z',
            status: StakeholderActionStatus.DONE,
            daysUntilDue: 50,
          }),
        ],
      });

      expect(items()).toHaveLength(2);

      const [first, second] = items() as [HTMLElement, HTMLElement];
      expect(
        within(first).getByText('Meet the platform group to agree a standing staging slot')
      ).toBeInTheDocument();
      expect(within(first).getByText('Ada Lovelace')).toBeInTheDocument();
      expect(within(first).getByText(i18nT('barriers:actionStatus.open'))).toBeInTheDocument();
      expect(first).toHaveTextContent(`${i18nT('barriers:action.dueDate')}: 2026-10-01`);

      expect(within(second).getByText('Agree the shared budget')).toBeInTheDocument();
      expect(within(second).getByText('Grace Hopper')).toBeInTheDocument();
      expect(within(second).getByText(i18nT('barriers:actionStatus.done'))).toBeInTheDocument();
      expect(second).toHaveTextContent(`${i18nT('barriers:action.dueDate')}: 2026-11-20`);
    });

    it('says when no action has been recorded yet', () => {
      renderList({ actions: [] });

      expect(screen.getByText(i18nT('barriers:detail.noActions'))).toBeInTheDocument();
    });

    it('falls back to unassigned when no owner is named', () => {
      renderList({ actions: [makeAction({ ownerId: null, ownerName: null })] });

      expect(items()[0]).toHaveTextContent(i18nT('barriers:list.unassigned'));
    });

    it('falls back to no due date when the action has none', () => {
      renderList({
        actions: [
          makeAction({ dueDate: null, daysUntilDue: null }),
          makeAction({
            id: 'action-2',
            dueDate: '2026-10-01T00:00:00.000Z',
            daysUntilDue: undefined,
          }),
        ],
      });

      const [withoutDueDate, withoutCount] = items() as [HTMLElement, HTMLElement];
      expect(withoutDueDate).toHaveTextContent(i18nT('barriers:action.noDueDate'));
      expect(withoutCount).toHaveTextContent(`${i18nT('barriers:action.dueDate')}: 2026-10-01`);
      expect(withoutCount).not.toHaveTextContent(i18nT('barriers:action.overdue'));
    });

    it('marks a completed action as done', () => {
      renderList({
        actions: [
          makeAction({ status: StakeholderActionStatus.DONE }),
          makeAction({ id: 'action-2' }),
        ],
      });

      const [done, open] = items() as [HTMLElement, HTMLElement];
      expect(done).toHaveClass('action-item-done');
      expect(open).not.toHaveClass('action-item-done');
    });
  });

  describe('the overdue marker', () => {
    it('flags an open action whose due date has passed', () => {
      renderList({ actions: [makeAction({ daysUntilDue: -3 })] });

      expect(items()[0]).toHaveTextContent(
        `${i18nT('barriers:action.dueDate')}: 2026-10-01 · ${i18nT('barriers:action.overdue')}`
      );
    });

    it('does not flag an action whose due date is still ahead', () => {
      renderList({ actions: [makeAction({ daysUntilDue: 4 })] });

      expect(items()[0]).not.toHaveTextContent(i18nT('barriers:action.overdue'));
    });

    it('stops calling an action overdue once it is done', () => {
      renderList({
        actions: [makeAction({ status: StakeholderActionStatus.DONE, daysUntilDue: -3 })],
      });

      expect(items()[0]).not.toHaveTextContent(i18nT('barriers:action.overdue'));
    });

    it('does not call an action overdue without a due date', () => {
      renderList({ actions: [makeAction({ dueDate: null, daysUntilDue: null })] });

      expect(items()[0]).not.toHaveTextContent(i18nT('barriers:action.overdue'));
    });
  });

  describe('recording an action', () => {
    it('keeps the form out of the way until it is asked for', () => {
      renderList({ actions: [] });

      expect(screen.queryByLabelText(i18nT('barriers:action.description'))).not.toBeInTheDocument();

      openForm();

      expect(screen.getByLabelText(i18nT('barriers:action.description'))).toBeInTheDocument();
      // The affordance that opened the form gives way to the form's own confirm button.
      expect(screen.getAllByRole('button', { name: i18nT('barriers:action.add') })).toHaveLength(1);
      expect(screen.queryByText(i18nT('barriers:detail.noActions'))).not.toBeInTheDocument();
    });

    it('offers the team members as owners and caps the description', () => {
      renderList();
      openForm();

      expect(optionTexts(ownerSelect())).toEqual([
        i18nT('barriers:list.unassigned'),
        'Ada Lovelace',
        'Grace Hopper',
      ]);
      expect(descriptionInput()).toHaveAttribute('maxlength', '500');
      expect(descriptionInput().value).toBe('');
      expect(ownerSelect().value).toBe('');
      expect(dueDateInput().value).toBe('');
    });

    it('hands back the trimmed description with the chosen owner and due date', () => {
      const { onAdd } = renderList();
      openForm();

      typeDescription('  Meet the platform group  ');
      chooseOwner('user-1');
      chooseDueDate('2026-10-15');
      fireEvent.click(addButton());

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith({
        description: 'Meet the platform group',
        ownerId: 'user-1',
        dueDate: '2026-10-15',
      });
    });

    it('hands back an unassigned action without a due date when none are chosen', () => {
      const { onAdd } = renderList();
      openForm();

      typeDescription('Raise it with the platform group');
      fireEvent.click(addButton());

      expect(onAdd).toHaveBeenCalledWith({
        description: 'Raise it with the platform group',
        ownerId: null,
        dueDate: '',
      });
    });

    it('closes and empties the form once the action is recorded', () => {
      renderList();
      openForm();

      typeDescription('Meet the platform group');
      chooseOwner('user-1');
      chooseDueDate('2026-10-15');
      fireEvent.click(addButton());

      expect(screen.queryByLabelText(i18nT('barriers:action.description'))).not.toBeInTheDocument();
      // With no action recorded against the barrier yet, the list's own empty note comes back.
      expect(screen.getByText(i18nT('barriers:detail.noActions'))).toBeInTheDocument();

      openForm();

      expect(descriptionInput().value).toBe('');
      expect(ownerSelect().value).toBe('');
      expect(dueDateInput().value).toBe('');
    });

    it('refuses an action described in fewer than three characters', () => {
      const { onAdd } = renderList();
      openForm();

      typeDescription('ab');
      fireEvent.click(addButton());

      expect(alert()).toHaveTextContent(i18nT('barriers:action.required'));
      expect(onAdd).not.toHaveBeenCalled();
      expect(screen.getByLabelText(i18nT('barriers:action.description'))).toBeInTheDocument();
    });

    it('refuses an action described only in whitespace', () => {
      const { onAdd } = renderList();
      openForm();

      typeDescription('    ');
      fireEvent.click(addButton());

      expect(alert()).toHaveTextContent(i18nT('barriers:action.required'));
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('clears the refusal as soon as the description is corrected', () => {
      renderList();
      openForm();

      typeDescription('ab');
      fireEvent.click(addButton());
      expect(alert()).toHaveTextContent(i18nT('barriers:action.required'));

      typeDescription('Meet the platform group');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('closes the form without recording anything when it is cancelled', () => {
      const { onAdd } = renderList();
      openForm();

      typeDescription('Meet the platform group');
      fireEvent.click(cancelButton());

      expect(onAdd).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(i18nT('barriers:action.description'))).not.toBeInTheDocument();
      expect(addButton()).toBeInTheDocument();
    });
  });

  describe('completing and deleting', () => {
    it('reports completion and deletion through the callbacks it was handed', () => {
      const { onComplete, onDelete } = renderList({ actions: [makeAction()] });

      fireEvent.click(completeButton());
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith('action-1');

      fireEvent.click(deleteButton());
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onDelete).toHaveBeenCalledWith('action-1');
    });

    it('offers completion only while an action is still open', () => {
      renderList({ actions: [makeAction({ status: StakeholderActionStatus.DONE })] });

      expect(
        screen.queryByRole('button', { name: i18nT('barriers:action.complete') })
      ).not.toBeInTheDocument();
      expect(deleteButton()).toBeInTheDocument();
    });

    it('blocks both writes while an action write is in flight', () => {
      renderList({ actions: [makeAction()], busy: true });

      expect(completeButton()).toBeDisabled();
      expect(deleteButton()).toBeDisabled();
    });

    it('leaves both writes enabled while nothing is in flight', () => {
      renderList({ actions: [makeAction()] });

      expect(completeButton()).not.toBeDisabled();
      expect(deleteButton()).not.toBeDisabled();
    });
  });

  describe('when the caller may not write', () => {
    it('records nothing and offers no action affordance', () => {
      renderList({ canWrite: false, actions: [makeAction()] });

      expect(
        screen.queryByRole('button', { name: i18nT('barriers:action.add') })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18nT('barriers:action.complete') })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18nT('barriers:action.delete') })
      ).not.toBeInTheDocument();
      // The agreements already recorded stay readable.
      expect(
        screen.getByText('Meet the platform group to agree a standing staging slot')
      ).toBeInTheDocument();
      expect(items()).toHaveLength(1);
    });
  });
});
