import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

import { renderHook, waitFor, initTestI18n, AllProviders } from '../test-utils';

import { useDefinitionOfDoneHistory, useDefinitionOfReadyHistory } from './useDefinitionHistory';
import { definitionService } from '../services';

vi.mock('../services', () => ({
  definitionService: {
    getDoDHistory: vi.fn(),
    getDoRHistory: vi.fn(),
  },
}));

describe('useDefinitionHistory', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useDefinitionOfDoneHistory', () => {
    it('does not fetch when teamId is undefined (empty-key fallback branch)', () => {
      renderHook(() => useDefinitionOfDoneHistory(undefined, true), { wrapper: AllProviders });

      expect(definitionService.getDoDHistory).not.toHaveBeenCalled();
    });

    it('does not fetch when disabled even with a teamId', () => {
      renderHook(() => useDefinitionOfDoneHistory('team-1', false), { wrapper: AllProviders });

      expect(definitionService.getDoDHistory).not.toHaveBeenCalled();
    });

    it('fetches the DoD history when a teamId is provided and enabled', async () => {
      vi.mocked(definitionService.getDoDHistory).mockResolvedValue({
        success: true,
        data: [],
      } as never);

      const { result } = renderHook(() => useDefinitionOfDoneHistory('team-1', true), {
        wrapper: AllProviders,
      });

      await waitFor(() => expect(definitionService.getDoDHistory).toHaveBeenCalledWith('team-1'));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('useDefinitionOfReadyHistory', () => {
    it('does not fetch when teamId is undefined (empty-key fallback branch)', () => {
      renderHook(() => useDefinitionOfReadyHistory(undefined, true), { wrapper: AllProviders });

      expect(definitionService.getDoRHistory).not.toHaveBeenCalled();
    });

    it('does not fetch when disabled even with a teamId', () => {
      renderHook(() => useDefinitionOfReadyHistory('team-1', false), { wrapper: AllProviders });

      expect(definitionService.getDoRHistory).not.toHaveBeenCalled();
    });

    it('fetches the DoR history when a teamId is provided and enabled', async () => {
      vi.mocked(definitionService.getDoRHistory).mockResolvedValue({
        success: true,
        data: [],
      } as never);

      const { result } = renderHook(() => useDefinitionOfReadyHistory('team-1', true), {
        wrapper: AllProviders,
      });

      await waitFor(() => expect(definitionService.getDoRHistory).toHaveBeenCalledWith('team-1'));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
