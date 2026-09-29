/**
 * BarrierForm tests.
 *
 * The form is the register's write path: it raises a barrier, amends one, and enforces the single
 * rule the API also refuses -- a barrier cannot reach RESOLVED or CLOSED without a written
 * resolution. These tests pin the create/edit shapes, the prefill and its date truncation, the
 * three validation gates, the payload handed to the caller, and the busy/cancel affordances.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, renderWithProviders, initTestI18n, i18nT } from '../../../test-utils';
import { BarrierStatus, type BarrierPriority } from '@scrumooth/shared';

import { BarrierForm, type BarrierFormValues } from './BarrierForm';

// The component only reads class names off the stylesheet, so a proxy keeps the module import
// cheap without pulling the real CSS in.
vi.mock('../OrganizationalBarriers.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

type BarrierFormProps = React.ComponentProps<typeof BarrierForm>;

// --- Fixtures -------------------------------------------------------------------------------

const MEMBERS = [
  { userId: 'user-1', name: 'Ada Lovelace' },
  { userId: 'user-2', name: 'Grace Hopper' },
];

const makeInitial = (overrides: Partial<BarrierFormValues> = {}): Partial<BarrierFormValues> => ({
  title: 'Staging environment is not shared',
  description: 'The platform group controls the only staging slot.',
  priority: 'HIGH',
  ownerId: 'user-2',
  targetDate: '2026-03-15T09:30:00.000Z',
  status: BarrierStatus.IN_PROGRESS,
  resolution: '',
  ...overrides,
});

// --- Queries --------------------------------------------------------------------------------

const titleInput = (): HTMLInputElement =>
  screen.getByLabelText(i18nT('barriers:form.title')) as HTMLInputElement;
const descriptionInput = (): HTMLTextAreaElement =>
  screen.getByLabelText(i18nT('barriers:form.description')) as HTMLTextAreaElement;
const prioritySelect = (): HTMLSelectElement =>
  screen.getByLabelText(i18nT('barriers:form.priority')) as HTMLSelectElement;
const ownerSelect = (): HTMLSelectElement =>
  screen.getByLabelText(i18nT('barriers:form.owner')) as HTMLSelectElement;
const targetDateInput = (): HTMLInputElement =>
  screen.getByLabelText(i18nT('barriers:form.targetDate')) as HTMLInputElement;
const statusSelect = (): HTMLSelectElement =>
  screen.getByLabelText(i18nT('barriers:form.status')) as HTMLSelectElement;
const resolutionInput = (): HTMLTextAreaElement =>
  screen.getByLabelText(i18nT('barriers:form.resolution')) as HTMLTextAreaElement;

const saveButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:actions.save') });
const cancelButton = (): HTMLElement =>
  screen.getByRole('button', { name: i18nT('barriers:actions.cancel') });
const alert = (): HTMLElement => screen.getByRole('alert');

const form = (): HTMLFormElement => document.querySelector('form') as HTMLFormElement;
const submitForm = (): void => fireEvent.submit(form());

// --- Interactions ---------------------------------------------------------------------------

const typeTitle = (value: string): void => fireEvent.change(titleInput(), { target: { value } });
const typeDescription = (value: string): void =>
  fireEvent.change(descriptionInput(), { target: { value } });
const typeResolution = (value: string): void =>
  fireEvent.change(resolutionInput(), { target: { value } });

const choosePriority = (value: BarrierPriority): void =>
  fireEvent.change(prioritySelect(), { target: { value } });
const chooseStatus = (value: BarrierStatus): void =>
  fireEvent.change(statusSelect(), { target: { value } });
const chooseOwner = (value: string): void => fireEvent.change(ownerSelect(), { target: { value } });

const optionTexts = (select: HTMLSelectElement): (string | null)[] =>
  Array.from(select.options).map((option) => option.textContent);

// --- Setup ----------------------------------------------------------------------------------

const renderForm = (props: Partial<BarrierFormProps> = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  renderWithProviders(
    <BarrierForm
      isEdit={false}
      members={MEMBERS}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...props}
    />
  );

  return { onSubmit, onCancel };
};

describe('BarrierForm', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  describe('raising a new barrier', () => {
    it('shows the create title and hides the lifecycle fields', () => {
      renderForm();

      expect(
        screen.getByRole('heading', { name: i18nT('barriers:form.createTitle') })
      ).toBeInTheDocument();
      // A barrier that does not exist yet has no lifecycle to edit and nothing to resolve.
      expect(screen.queryByLabelText(i18nT('barriers:form.status'))).not.toBeInTheDocument();
      expect(screen.queryByLabelText(i18nT('barriers:form.resolution'))).not.toBeInTheDocument();
    });

    it('starts empty, at medium impact and open', () => {
      renderForm();

      expect(titleInput().value).toBe('');
      expect(descriptionInput().value).toBe('');
      expect(prioritySelect().value).toBe('MEDIUM');
      expect(ownerSelect().value).toBe('');
      expect(targetDateInput().value).toBe('');
    });

    it('offers every team member and an unassigned choice as owners', () => {
      renderForm();

      expect(optionTexts(ownerSelect())).toEqual([
        i18nT('barriers:list.unassigned'),
        'Ada Lovelace',
        'Grace Hopper',
      ]);
    });

    it('lists the impact scale from critical to low', () => {
      renderForm();

      expect(optionTexts(prioritySelect())).toEqual([
        i18nT('barriers:priority.critical'),
        i18nT('barriers:priority.high'),
        i18nT('barriers:priority.medium'),
        i18nT('barriers:priority.low'),
      ]);
    });
  });

  describe('amending an existing barrier', () => {
    it('shows the edit title and prefills the barrier that was handed in', () => {
      renderForm({ isEdit: true, initial: makeInitial() });

      expect(
        screen.getByRole('heading', { name: i18nT('barriers:form.editTitle') })
      ).toBeInTheDocument();
      expect(titleInput().value).toBe('Staging environment is not shared');
      expect(descriptionInput().value).toBe('The platform group controls the only staging slot.');
      expect(prioritySelect().value).toBe('HIGH');
      expect(ownerSelect().value).toBe('user-2');
      expect(statusSelect().value).toBe(BarrierStatus.IN_PROGRESS);
      expect(resolutionInput().value).toBe('');
    });

    it('truncates a timestamp to the day the date input expects', () => {
      renderForm({ isEdit: true, initial: makeInitial() });

      expect(targetDateInput().value).toBe('2026-03-15');
    });

    it('lists the lifecycle states in the register vocabulary', () => {
      renderForm({ isEdit: true, initial: makeInitial() });

      expect(optionTexts(statusSelect())).toEqual([
        i18nT('barriers:stats.open'),
        i18nT('barriers:stats.inProgress'),
        i18nT('barriers:stats.resolved'),
        i18nT('barriers:stats.closed'),
      ]);
    });

    it('shows the placeholder that asks what changed and who agreed', () => {
      renderForm({ isEdit: true, initial: makeInitial() });

      expect(resolutionInput()).toHaveAttribute(
        'placeholder',
        i18nT('barriers:form.resolutionPlaceholder')
      );
    });

    it('caps the text a barrier and its resolution can carry', () => {
      renderForm({ isEdit: true, initial: makeInitial() });

      expect(titleInput()).toHaveAttribute('maxlength', '200');
      expect(titleInput()).toBeRequired();
      expect(descriptionInput()).toHaveAttribute('maxlength', '4000');
      expect(descriptionInput()).toBeRequired();
      expect(resolutionInput()).toHaveAttribute('maxlength', '4000');
    });
  });

  describe('the rules the form refuses to break', () => {
    it('refuses a title shorter than three characters', () => {
      const { onSubmit } = renderForm();

      typeTitle('ab');
      typeDescription('The platform group must agree a standing slot.');
      submitForm();

      expect(alert()).toHaveTextContent(i18nT('barriers:form.titleRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('refuses a title that is only whitespace', () => {
      const { onSubmit } = renderForm();

      typeTitle('     ');
      typeDescription('The platform group must agree a standing slot.');
      submitForm();

      expect(alert()).toHaveTextContent(i18nT('barriers:form.titleRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('refuses a description shorter than ten characters', () => {
      const { onSubmit } = renderForm();

      typeTitle('Shared staging slot');
      typeDescription('Too brief');
      submitForm();

      expect(alert()).toHaveTextContent(i18nT('barriers:form.descriptionRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('refuses a description that is only whitespace', () => {
      const { onSubmit } = renderForm();

      typeTitle('Shared staging slot');
      typeDescription('                    ');
      submitForm();

      expect(alert()).toHaveTextContent(i18nT('barriers:form.descriptionRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('refuses to resolve a barrier without a written resolution', () => {
      const { onSubmit } = renderForm({ isEdit: true, initial: makeInitial() });

      chooseStatus(BarrierStatus.RESOLVED);
      submitForm();

      expect(alert()).toHaveTextContent(i18nT('barriers:form.resolutionRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('refuses to close a barrier on a resolution that is only whitespace', () => {
      const { onSubmit } = renderForm({
        isEdit: true,
        initial: makeInitial({ status: BarrierStatus.CLOSED, resolution: '    ' }),
      });

      submitForm();

      expect(alert()).toHaveTextContent(i18nT('barriers:form.resolutionRequired'));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('lets a barrier stay in progress without a resolution', () => {
      const { onSubmit } = renderForm({ isEdit: true, initial: makeInitial() });

      submitForm();

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ status: BarrierStatus.IN_PROGRESS, resolution: '' })
      );
    });

    it('clears the refusal as soon as a field is corrected', () => {
      renderForm();

      submitForm();
      expect(alert()).toHaveTextContent(i18nT('barriers:form.titleRequired'));

      typeTitle('Shared staging slot');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      typeDescription('Too brief');
      submitForm();
      expect(alert()).toHaveTextContent(i18nT('barriers:form.descriptionRequired'));

      typeDescription('The platform group must agree a standing slot.');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('what the form hands to the register', () => {
    it('submits the trimmed values and the chosen impact, owner and dates', () => {
      const { onSubmit } = renderForm({ isEdit: true, initial: makeInitial() });

      typeTitle('  Shared staging slot  ');
      typeDescription('  The platform group must agree a standing slot.  ');
      choosePriority('CRITICAL');
      chooseOwner('user-1');
      fireEvent.change(targetDateInput(), { target: { value: '2026-04-01' } });
      chooseStatus(BarrierStatus.IN_PROGRESS);
      submitForm();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Shared staging slot',
        description: 'The platform group must agree a standing slot.',
        priority: 'CRITICAL',
        ownerId: 'user-1',
        targetDate: '2026-04-01',
        status: BarrierStatus.IN_PROGRESS,
        resolution: '',
      });
    });

    it('submits a resolution trimmed of its surrounding whitespace', () => {
      const { onSubmit } = renderForm({
        isEdit: true,
        initial: makeInitial({ status: BarrierStatus.RESOLVED }),
      });

      typeResolution('  The platform group agreed to a shared slot.  ');
      submitForm();

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BarrierStatus.RESOLVED,
          resolution: 'The platform group agreed to a shared slot.',
        })
      );
    });

    it('records no owner when the unassigned choice is kept', () => {
      const { onSubmit } = renderForm({ isEdit: true, initial: makeInitial() });

      chooseOwner('');
      submitForm();

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ownerId: null }));
    });
  });

  describe('the actions around the form', () => {
    it('cancels without asking the register for anything', () => {
      const { onSubmit, onCancel } = renderForm();

      fireEvent.click(cancelButton());

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('leaves both actions enabled while nothing is in flight', () => {
      renderForm();

      expect(cancelButton()).not.toBeDisabled();
      expect(saveButton()).not.toBeDisabled();
      expect(saveButton()).toHaveAttribute('aria-busy', 'false');
    });

    it('blocks both actions while the write is in flight', () => {
      renderForm({ submitting: true });

      expect(cancelButton()).toBeDisabled();
      expect(saveButton()).toBeDisabled();
      expect(saveButton()).toHaveAttribute('aria-busy', 'true');
    });
  });
});
