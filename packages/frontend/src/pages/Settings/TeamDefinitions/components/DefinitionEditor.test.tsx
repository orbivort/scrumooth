import React from 'react';
import { waitFor } from '@testing-library/react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { vi } from 'vitest';

import { DefinitionEditor } from './DefinitionEditor';
import { DOR_CATEGORIES, DOD_CATEGORIES } from './categories';

const mockItems = [
  { id: 'item-1', description: 'Test item 1', category: 'clarity', isActive: true, order: 0 },
  { id: 'item-2', description: 'Test item 2', category: 'acceptance', isActive: false, order: 1 },
];

const mockCategories = DOR_CATEGORIES;

describe('DefinitionEditor', () => {
  let onSaveMock: ReturnType<typeof vi.fn>;
  let onCancelMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    initTestI18n();
  });

  beforeEach(() => {
    onSaveMock = vi.fn();
    onCancelMock = vi.fn();
  });

  it('should render with initial items', () => {
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );
    expect(screen.getByDisplayValue('Test item 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test item 2')).toBeInTheDocument();
  });

  it('should add a new item', () => {
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: [], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const input = screen.getByPlaceholderText('Enter new DoR criterion...');
    fireEvent.change(input, { target: { value: 'New test item' } });

    const addButton = screen.getByRole('button', { name: 'Add new item' });
    fireEvent.click(addButton);

    expect(screen.getByDisplayValue('New test item')).toBeInTheDocument();
  });

  it('should remove an item', () => {
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: 'Remove item' });
    fireEvent.click(removeButtons[0]!);

    expect(screen.queryByDisplayValue('Test item 1')).not.toBeInTheDocument();
  });

  it('should toggle item active state', () => {
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: [mockItems[0]!], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const toggleButton = screen.getByRole('button', { name: 'Deactivate item' });
    fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: 'Activate item' })).toBeInTheDocument();
  });

  it('should call onSave when save button clicked', async () => {
    onSaveMock.mockResolvedValue(undefined);
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    // Make a change to enable save button
    const input = screen.getByDisplayValue('Test item 1');
    fireEvent.change(input, { target: { value: 'Updated test item' } });

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(saveButton);

    expect(onSaveMock).toHaveBeenCalled();
  });

  it('should send a surviving criterion with its id and a newly added one without', async () => {
    onSaveMock.mockResolvedValue(undefined);
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const input = screen.getByPlaceholderText('Enter new DoR criterion...');
    fireEvent.change(input, { target: { value: 'Brand new criterion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add new item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(onSaveMock).toHaveBeenCalled());

    const payload = onSaveMock.mock.calls[0]![0];
    // An existing criterion keeps its identity, which is what makes the service update that row in
    // place and leave the verifications recorded against it alone.
    expect(payload[0]).toMatchObject({ id: 'item-1', description: 'Test item 1' });
    // The one just added has no server identity yet: sending an id would make the service look for a
    // row that does not exist.
    expect(payload[2]).not.toHaveProperty('id');
    expect(payload[2]).toMatchObject({ description: 'Brand new criterion', isActive: true });
  });

  it('should call onCancel when cancel button clicked and no changes', () => {
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalled();
  });

  it('should show cancel dialog when cancel button clicked with changes', () => {
    renderWithProviders(
      <DefinitionEditor
        definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
        definitionType="DoR"
        categories={mockCategories}
        onSave={onSaveMock}
        onCancel={onCancelMock}
      />
    );

    // Make a change
    const input = screen.getByDisplayValue('Test item 1');
    fireEvent.change(input, { target: { value: 'Updated test item' } });

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    expect(screen.getByText('Discard Changes?')).toBeInTheDocument();
  });

  describe('Definition Type', () => {
    it('should render "Definition of Done" for DoD type', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoD"
          categories={DOD_CATEGORIES}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByRole('heading', { name: /edit definition of done/i })).toBeInTheDocument();
    });

    it('should render correct info text for DoD type', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoD"
          categories={DOD_CATEGORIES}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByText(/Definition of Done is a formal description/)).toBeInTheDocument();
    });

    it('should render correct placeholder for DoD type', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: [], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoD"
          categories={DOD_CATEGORIES}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByPlaceholderText(/Enter new DoD criterion/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when no items', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: [], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByText(/No DoR items yet/)).toBeInTheDocument();
    });

    it('should set items from definition when definition has items', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByDisplayValue('Test item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test item 2')).toBeInTheDocument();
    });
  });

  describe('Add Item', () => {
    it('should not add item when text is empty', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: [], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const addButton = screen.getByRole('button', { name: 'Add new item' });
      expect(addButton).toBeDisabled();
    });

    it('should add item on Enter key press', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: [], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const input = screen.getByPlaceholderText('Enter new DoR criterion...');
      fireEvent.change(input, { target: { value: 'New criterion' } });
      fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

      expect(screen.getByDisplayValue('New criterion')).toBeInTheDocument();
    });
  });

  describe('Move Items', () => {
    it('should disable move up button for first item', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const moveUpButtons = screen.getAllByRole('button', { name: 'Move item up' });
      expect(moveUpButtons[0]).toBeDisabled();
    });

    it('should disable move down button for last item', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const moveDownButtons = screen.getAllByRole('button', { name: 'Move item down' });
      expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
    });

    it('should move item down and update order', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const moveDownButtons = screen.getAllByRole('button', { name: 'Move item down' });
      fireEvent.click(moveDownButtons[0]);

      // Verify items still rendered (order changed internally)
      expect(screen.getByDisplayValue('Test item 1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test item 2')).toBeInTheDocument();
    });

    it('should move item up from middle position', () => {
      const threeItems = [
        {
          id: 'item-1',
          description: 'First item',
          category: 'clarity',
          isActive: true,
          order: 0,
        },
        {
          id: 'item-2',
          description: 'Second item',
          category: 'estimation',
          isActive: true,
          order: 1,
        },
        {
          id: 'item-3',
          description: 'Third item',
          category: 'acceptance',
          isActive: false,
          order: 2,
        },
      ];
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: threeItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const moveUpButtons = screen.getAllByRole('button', { name: 'Move item up' });
      fireEvent.click(moveUpButtons[1]);

      const moveUpButtonsAfter = screen.getAllByRole('button', { name: 'Move item up' });
      expect(moveUpButtonsAfter[0]).toBeDisabled();
    });

    it('should move item down from middle position', () => {
      const threeItems = [
        {
          id: 'item-1',
          description: 'First item',
          category: 'clarity',
          isActive: true,
          order: 0,
        },
        {
          id: 'item-2',
          description: 'Second item',
          category: 'estimation',
          isActive: true,
          order: 1,
        },
        {
          id: 'item-3',
          description: 'Third item',
          category: 'acceptance',
          isActive: false,
          order: 2,
        },
      ];
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: threeItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const moveDownButtons = screen.getAllByRole('button', { name: 'Move item down' });
      fireEvent.click(moveDownButtons[1]);

      const moveDownButtonsAfter = screen.getAllByRole('button', { name: 'Move item down' });
      expect(moveDownButtonsAfter[moveDownButtonsAfter.length - 1]).toBeDisabled();
    });
  });

  describe('Category Change', () => {
    it('should change item category', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: [mockItems[0]], version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const categorySelects = screen.getAllByRole('combobox');
      fireEvent.change(categorySelects[0], { target: { value: 'acceptance' } });

      expect(categorySelects[0]).toHaveValue('acceptance');
    });

    it('should only change category of the target item', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const categorySelects = screen.getAllByRole('combobox');
      fireEvent.change(categorySelects[0], { target: { value: 'estimation' } });

      expect(categorySelects[0]).toHaveValue('estimation');
      expect(categorySelects[1]).toHaveValue(mockCategories[0].value);
    });
  });

  describe('Save and Cancel Flows', () => {
    it('should disable save button when there are no changes', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      expect(saveButton).toBeDisabled();
    });

    it('should show "Saving..." when isLoading is true', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
          isLoading={true}
        />
      );

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show unsaved warning banner after making changes', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      const input = screen.getByDisplayValue('Test item 1');
      fireEvent.change(input, { target: { value: 'Updated' } });

      expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
    });

    it('should dismiss cancel dialog when clicking "Keep Editing"', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      // Make a change
      const input = screen.getByDisplayValue('Test item 1');
      fireEvent.change(input, { target: { value: 'Updated' } });

      // Click cancel to open dialog
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(screen.getByText('Discard Changes?')).toBeInTheDocument();

      // Click "Keep Editing" to dismiss
      const keepEditingButton = screen.getByRole('button', { name: 'Keep Editing' });
      fireEvent.click(keepEditingButton);

      expect(screen.queryByText('Discard Changes?')).not.toBeInTheDocument();
    });

    it('should call onCancel when confirming discard in cancel dialog', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      // Make a change
      const input = screen.getByDisplayValue('Test item 1');
      fireEvent.change(input, { target: { value: 'Updated' } });

      // Click cancel to open dialog
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      // Click "Discard Changes" to confirm
      const discardButton = screen.getByRole('button', { name: 'Discard Changes' });
      fireEvent.click(discardButton);

      expect(onCancelMock).toHaveBeenCalled();
    });
  });

  describe('Summary Counts', () => {
    it('should display active and inactive item counts', () => {
      renderWithProviders(
        <DefinitionEditor
          definition={{ items: mockItems, version: 1, updatedAt: '2024-01-01T00:00:00Z' }}
          definitionType="DoR"
          categories={mockCategories}
          onSave={onSaveMock}
          onCancel={onCancelMock}
        />
      );

      expect(screen.getByText('1 active item')).toBeInTheDocument();
      expect(screen.getByText('1 inactive')).toBeInTheDocument();
    });
  });
});
