import React from 'react';
import {
  screen,
  renderWithProviders,
  waitFor,
  fireEvent,
  i18nT,
  initTestI18n,
} from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';

import { BulkUploadModal } from './BulkUploadModal';
import { apiService } from '../../../services';
import { BacklogProvider } from '../context/BacklogContext';
import * as teamContextModule from '../../../contexts/TeamContext';

const utils = vi.hoisted(() => ({
  parseCSV: vi.fn(),
  validateItems: vi.fn(),
  getValidItems: vi.fn(),
  getInvalidItems: vi.fn(),
  isValidFileType: vi.fn((file: File) => file.name.endsWith('.csv')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} Bytes`),
  generateCSVTemplate: vi.fn(() => 'title\nx'),
  downloadTemplate: vi.fn(),
}));

const capacity = vi.hoisted(() => ({
  validateBulkImport: vi.fn(),
}));

vi.mock('../../../services', () => ({
  apiService: {
    bulkCreateProductBacklogItems: vi.fn(),
    getProductBacklog: vi.fn(),
  },
}));

vi.mock('./bulkUploadUtils', () => ({
  parseCSV: utils.parseCSV,
  validateItems: utils.validateItems,
  getValidItems: utils.getValidItems,
  getInvalidItems: utils.getInvalidItems,
  isValidFileType: utils.isValidFileType,
  formatFileSize: utils.formatFileSize,
  generateCSVTemplate: utils.generateCSVTemplate,
  downloadTemplate: utils.downloadTemplate,
}));

vi.mock('../hooks/useBacklogCapacityValidation', () => ({
  useBacklogCapacityValidation: () => ({
    validateBulkImport: capacity.validateBulkImport,
    validateCapacity: vi.fn(),
    isLimitEnabled: false,
    maxItemsPerGoal: 200,
  }),
}));

const bulkCreate = apiService.bulkCreateProductBacklogItems as ReturnType<typeof vi.fn>;

const createMockFile = (name: string, content: string, type = 'text/csv'): File => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
};

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ _rowNumber: i + 1, title: `Item ${i}`, _isValid: true }));

const renderModal = (props = {}) =>
  renderWithProviders(
    <BacklogProvider>
      <BulkUploadModal
        isOpen={true}
        onClose={vi.fn()}
        onUploadComplete={vi.fn()}
        teamId="team-1"
        goalId="goal-1"
        existingItems={[]}
        {...props}
      />
    </BacklogProvider>
  );

const goToPreview = async (user: ReturnType<typeof userEvent.setup>, count = 2) => {
  const items = makeItems(count);
  utils.parseCSV.mockReturnValue({ items, errors: [], totalRows: count });
  utils.validateItems.mockReturnValue(items);
  utils.getValidItems.mockReturnValue(items);

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, createMockFile('items.csv', 'title\nx'));

  await screen.findByRole('button', { name: /^Import \d+ Item/ });
};

describe('BulkUploadModal import flow', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
      userRole: 'DEVELOPERS',
      currentTeam: null,
      userTeams: [],
      isLoading: false,
      error: null,
      switchTeam: vi.fn(),
      refreshTeams: vi.fn(),
      hasMultipleTeams: false,
    } as never);
    utils.isValidFileType.mockImplementation((file: File) => file.name.endsWith('.csv'));
    utils.parseCSV.mockReturnValue({ items: [], errors: [], totalRows: 0 });
    utils.validateItems.mockReturnValue([]);
    utils.getValidItems.mockReturnValue([]);
    utils.getInvalidItems.mockReturnValue([]);
    capacity.validateBulkImport.mockResolvedValue({ isValid: true });
    bulkCreate.mockResolvedValue({ success: true, data: { successful: 2, failed: 0, errors: [] } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should import successfully, notify and view the imported items', async () => {
    const user = userEvent.setup();
    const onUploadComplete = vi.fn();
    const onClose = vi.fn();
    renderModal({ onUploadComplete, onClose });

    bulkCreate.mockResolvedValue({
      success: true,
      data: { successful: 2, failed: 0, errors: [], createdItems: [{ id: 'a' }, { id: 'b' }] },
    });

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    // Summary step
    expect(
      await screen.findByText(i18nT('backlog:bulkUpload.summary.importComplete'))
    ).toBeInTheDocument();
    expect(bulkCreate).toHaveBeenCalled();
    await waitFor(() => expect(onUploadComplete).toHaveBeenCalled());

    await user.click(
      screen.getByRole('button', { name: i18nT('backlog:bulkUpload.summary.viewImportedItems') })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('should show the failure summary when the response reports success:false with a message', async () => {
    const user = userEvent.setup();
    renderModal();

    bulkCreate.mockResolvedValue({ success: false, error: { message: 'Server boom' } });

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(
      await screen.findByText(i18nT('backlog:bulkUpload.summary.importFailed'))
    ).toBeInTheDocument();
    expect(await screen.findByText(/Server boom/)).toBeInTheDocument();
  });

  it('should fall back to a default message when success is false without an error', async () => {
    const user = userEvent.setup();
    renderModal();

    bulkCreate.mockResolvedValue({ success: true });

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(await screen.findByText(/Bulk upload failed/)).toBeInTheDocument();
  });

  it('should join field validation details from a thrown API error', async () => {
    const user = userEvent.setup();
    renderModal();

    bulkCreate.mockRejectedValue({
      response: { data: { error: { details: [{ message: 'm1' }, { message: 'm2' }] } } },
    });

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(await screen.findByText(/m1; m2/)).toBeInTheDocument();
  });

  it('should use the thrown error message when it is a plain Error', async () => {
    const user = userEvent.setup();
    renderModal();

    bulkCreate.mockRejectedValue(new Error('plain failure'));

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(await screen.findByText(/plain failure/)).toBeInTheDocument();
  });

  it('should fall back to "Unknown error" for a non-Error rejection', async () => {
    const user = userEvent.setup();
    renderModal();

    bulkCreate.mockRejectedValue('oops');

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(await screen.findByText(/Unknown error/)).toBeInTheDocument();
  });

  it('should cancel an in-flight import and keep the modal open against overlay clicks', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ onClose });

    bulkCreate.mockImplementation(
      (_items: unknown, _team: string, _goal: string, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );

    await goToPreview(user, 3);
    await user.click(screen.getByRole('button', { name: /^Import 3 Items/ }));

    // Progress step is shown.
    await screen.findByText(i18nT('backlog:bulkUpload.progress.importingBacklogItems'));

    // Clicking the overlay while uploading must not close the modal.
    fireEvent.click(document.querySelector('[class*="modal-overlay"]')!);
    expect(onClose).not.toHaveBeenCalled();

    // Cancel aborts the request -> cancellation summary.
    await user.click(screen.getByText(i18nT('backlog:bulkUpload.progress.cancelImport')));

    expect(await screen.findByText(/Upload cancelled by user/)).toBeInTheDocument();
  });

  it('should surface a capacity error with an explicit message', async () => {
    const user = userEvent.setup();
    renderModal();

    capacity.validateBulkImport.mockResolvedValue({ isValid: false, error: 'Capacity exceeded' });

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(
      await screen.findByText(i18nT('backlog:bulkUpload.summary.importFailed'))
    ).toBeInTheDocument();
    expect(await screen.findByText(/Capacity exceeded/)).toBeInTheDocument();
  });

  it('should surface a capacity error with the default message', async () => {
    const user = userEvent.setup();
    renderModal();

    capacity.validateBulkImport.mockResolvedValue({ isValid: false });

    await goToPreview(user);
    await user.click(screen.getByRole('button', { name: /^Import 2 Items/ }));

    expect(await screen.findByText(/Capacity limit exceeded/)).toBeInTheDocument();
  });

  it('should go back from preview to the upload step', async () => {
    const user = userEvent.setup();
    renderModal();

    await goToPreview(user);

    await user.click(screen.getByRole('button', { name: i18nT('backlog:bulkUpload.back') }));

    // Back returns to the upload step; the previously chosen file is still shown.
    expect(
      await screen.findByText(i18nT('backlog:bulkUpload.dropzone.fileReady'))
    ).toBeInTheDocument();
  });

  it('should show the generic parse error when the parse error has no message', async () => {
    const user = userEvent.setup();
    renderModal();

    utils.parseCSV.mockReturnValue({ items: [], errors: [{ message: undefined }], totalRows: 1 });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, createMockFile('items.csv', 'title\nx'));

    expect(await screen.findByText('Unknown parse error')).toBeInTheDocument();
  });
});
