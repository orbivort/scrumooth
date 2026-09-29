import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BacklogProvider, useBacklogContext } from '../context/BacklogContext';
import { renderWithProviders, createMockBacklogItem } from '../../../test-utils';
import { ItemStatus, MoSCoWPriority } from '../../../types';

import { ValidationModal } from './ValidationModal';

// Mock services - required because useDefinitionOfReadyDone imports definitionService
vi.mock('../../../services', () => ({
  definitionService: {
    getDefinitionOfReady: vi.fn(),
    getDefinitionOfDone: vi.fn(),
    verifyDoRForPBI: vi.fn(),
    verifyDoDForPBI: vi.fn(),
  },
}));

// Mock react-i18next to provide translations for tests
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'validation.dorShort': 'Definition of Ready',
        'validation.dodShort': 'Definition of Done',
        'validation.verifyAllCriteria': 'Verify all criteria before marking as {{status}}',
        'validation.criteriaMet': '{{met}} of {{total}} criteria met',
        'validation.allMustBeVerified': 'All criteria must be verified before proceeding',
        'validation.cancel': 'Cancel',
        'validation.confirmStatusChange': 'Confirm Status Change',
        'validation.updating': 'Updating...',
        'status.ready': 'Ready',
        'status.done': 'Done',
      };
      let result = translations[key] || key;
      if (options) {
        Object.entries(options).forEach(([k, v]) => {
          result = result.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        });
      }
      return result;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

const mockItem = createMockBacklogItem({
  id: 'pbi-1',
  title: 'Test Feature',
  status: ItemStatus.REFINED,
  priority: MoSCoWPriority.MUST_HAVE,
});

const SetSelectedItem: React.FC = () => {
  const { setSelectedItem } = useBacklogContext();
  React.useEffect(() => {
    setSelectedItem(mockItem);
  }, [setSelectedItem]);
  return null;
};

const mockDorItems = [
  { id: 'dor-1', label: 'Has description', description: 'Item has a clear description' },
  {
    id: 'dor-2',
    label: 'Has acceptance criteria',
    description: 'Item has defined acceptance criteria',
  },
];

const mockDodItems = [
  { id: 'dod-1', label: 'Code reviewed', description: 'Code has been reviewed' },
  { id: 'dod-2', label: 'Tests passed', description: 'All tests pass' },
];

const renderValidationModal = (props = {}) => {
  return renderWithProviders(
    <BacklogProvider>
      <SetSelectedItem />
      <ValidationModal
        isOpen={true}
        validationType="ready"
        dorItems={mockDorItems}
        dodItems={mockDodItems}
        validationChecks={{}}
        onCheckChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isUpdating={false}
        {...props}
      />
    </BacklogProvider>
  );
};

describe('ValidationModal', () => {
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', async () => {
      renderValidationModal({ isOpen: false });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should not render when validationType is null', async () => {
      renderValidationModal({ validationType: null });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should render Definition of Ready modal', async () => {
      renderValidationModal({ validationType: 'ready' });

      await waitFor(() => {
        expect(screen.getByText('Definition of Ready')).toBeInTheDocument();
      });
    });

    it('should render Definition of Done modal', async () => {
      renderValidationModal({ validationType: 'done' });

      await waitFor(() => {
        expect(screen.getByText('Definition of Done')).toBeInTheDocument();
      });
    });
  });

  describe('Checklist', () => {
    it('should display all checklist items', async () => {
      renderValidationModal({
        validationType: 'ready',
        dorItems: mockDorItems,
      });

      await waitFor(() => {
        expect(screen.getByText('Has description')).toBeInTheDocument();
        expect(screen.getByText('Has acceptance criteria')).toBeInTheDocument();
      });
    });

    it('should display progress indicator', async () => {
      renderValidationModal({
        validationType: 'ready',
        dorItems: mockDorItems,
        validationChecks: { 'dor-1': true },
      });

      await waitFor(() => {
        expect(screen.getByText(/criteria met/i)).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should call onCancel when clicking cancel button', async () => {
      renderValidationModal({ onCancel: mockOnCancel });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('should disable confirm button when not all checks are complete', async () => {
      renderValidationModal({
        validationType: 'ready',
        dorItems: mockDorItems,
        validationChecks: {},
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm status change/i });
        expect(confirmButton).toBeDisabled();
      });
    });

    it('should enable confirm button when all checks are complete', async () => {
      renderValidationModal({
        validationType: 'ready',
        dorItems: mockDorItems,
        validationChecks: { 'dor-1': true, 'dor-2': true },
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm status change/i });
        expect(confirmButton).not.toBeDisabled();
      });
    });

    it('should show updating state', async () => {
      renderValidationModal({ isUpdating: true });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /updating/i });
        expect(confirmButton).toBeDisabled();
      });
    });
  });

  describe('Warning Messages', () => {
    it('should show warning when not all criteria are met', async () => {
      renderValidationModal({
        validationType: 'ready',
        dorItems: mockDorItems,
        validationChecks: { 'dor-1': true },
      });

      await waitFor(() => {
        expect(screen.getByText(/criteria must be verified/i)).toBeInTheDocument();
      });
    });
  });

  describe('Translated labels, error banner and check changes', () => {
    const SetWorkflowError: React.FC = () => {
      const { setWorkflowError } = useBacklogContext();
      React.useEffect(() => {
        setWorkflowError('DoR failed');
      }, [setWorkflowError]);
      return null;
    };

    it('should map known labels/categories, let the user dismiss the error and toggle a check', async () => {
      const onCheckChange = vi.fn();

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem />
          <SetWorkflowError />
          <ValidationModal
            isOpen={true}
            validationType="ready"
            dorItems={[
              {
                id: 'dor-known',
                label: 'Clear title and description provided',
                description: 'documentation',
              },
            ]}
            dodItems={mockDodItems}
            validationChecks={{}}
            onCheckChange={onCheckChange}
            onConfirm={vi.fn()}
            onCancel={vi.fn()}
            isUpdating={false}
          />
        </BacklogProvider>
      );

      // Error banner (workflowError truthy branch) + dismissal via the close button.
      expect(await screen.findByText('DoR failed')).toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('validation.closeError'));
      await waitFor(() => {
        expect(screen.queryByText('DoR failed')).not.toBeInTheDocument();
      });

      // Known label/category resolve through the translation maps.
      expect(screen.getByText('validation.dorItems.clearTitleAndDescription')).toBeInTheDocument();
      expect(screen.getByText('validation.categories.documentation')).toBeInTheDocument();

      // Checkbox change is forwarded.
      await userEvent.click(screen.getByRole('checkbox'));
      expect(onCheckChange).toHaveBeenCalledWith('dor-known', true);
    });
  });
});
