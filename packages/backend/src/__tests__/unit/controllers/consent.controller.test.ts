import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordConsent,
  getConsentHistory,
  getLatestConsent,
  withdrawConsent,
  getAnonymousConsent,
} from '../../../controllers/consent.controller';
import { consentService } from '../../../services/consent.service';
import { BadRequestError, UnauthorizedError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/consent.service', () => ({
  consentService: {
    recordConsent: vi.fn(),
    getConsentHistory: vi.fn(),
    getLatestConsent: vi.fn(),
    withdrawConsent: vi.fn(),
    getConsentById: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Consent Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('recordConsent', () => {
    it('should record consent successfully', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = {
        consentType: 'COOKIES',
        action: 'ACCEPT',
        preferences: { analytics: true },
        version: '1.0',
      };
      mockReq.ip = '192.168.1.1';
      mockReq.headers = { 'user-agent': 'Test Agent' };

      const mockRecord = {
        id: 'consent-123',
        consentType: 'COOKIES',
        action: 'ACCEPT',
        createdAt: new Date('2024-01-01'),
      };

      (consentService.recordConsent as any).mockResolvedValue(mockRecord);

      recordConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(consentService.recordConsent).toHaveBeenCalledWith({
        userId: 'user-123',
        consentType: 'COOKIES',
        action: 'ACCEPT',
        preferences: { analytics: true },
        version: '1.0',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
      });
      expect(mockRes._status).toBe(201);
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.message).toBe('Consent recorded successfully');
    });

    it('should handle anonymous users', async () => {
      mockReq.userId = undefined;
      mockReq.body = {
        consentType: 'COOKIES',
        action: 'ACCEPT',
      };

      const mockRecord = {
        id: 'consent-123',
        consentType: 'COOKIES',
        action: 'ACCEPT',
        createdAt: new Date(),
      };

      (consentService.recordConsent as any).mockResolvedValue(mockRecord);

      recordConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consentService.recordConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
        })
      );
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = { consentType: 'COOKIES', action: 'ACCEPT' };
      const error = new Error('Database error');

      (consentService.recordConsent as any).mockRejectedValue(error);

      recordConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should fall back to the socket remote address when req.ip is missing', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = { consentType: 'COOKIES', action: 'ACCEPT' };
      mockReq.ip = undefined;
      mockReq.socket = { remoteAddress: '10.0.0.9' };

      (consentService.recordConsent as any).mockResolvedValue({
        id: 'consent-123',
        consentType: 'COOKIES',
        action: 'ACCEPT',
        createdAt: new Date(),
      });

      recordConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consentService.recordConsent).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '10.0.0.9' })
      );
    });
  });

  describe('getConsentHistory', () => {
    it('should return consent history with pagination', async () => {
      mockReq.userId = 'user-123';
      mockReq.query = { limit: '20', offset: '10' };

      const mockHistory = [
        {
          id: 'consent-1',
          consentType: 'COOKIES',
          action: 'ACCEPT',
          version: '1.0',
          ipAddress: '192.168.1.1',
          createdAt: new Date('2024-01-01'),
        },
      ];

      (consentService.getConsentHistory as any).mockResolvedValue(mockHistory);

      getConsentHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(consentService.getConsentHistory).toHaveBeenCalledWith('user-123', 20, 10);
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.pagination).toEqual({
        limit: 20,
        offset: 10,
        total: 1,
      });
    });

    it('should use default pagination values', async () => {
      mockReq.userId = 'user-123';
      mockReq.query = {};

      (consentService.getConsentHistory as any).mockResolvedValue([]);

      getConsentHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consentService.getConsentHistory).toHaveBeenCalledWith('user-123', 10, 0);
    });

    it('should cap limit at 50', async () => {
      mockReq.userId = 'user-123';
      mockReq.query = { limit: '100' };

      (consentService.getConsentHistory as any).mockResolvedValue([]);

      getConsentHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consentService.getConsentHistory).toHaveBeenCalledWith('user-123', 50, 0);
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      const error = new Error('Database error');

      (consentService.getConsentHistory as any).mockRejectedValue(error);

      getConsentHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should reject an unauthenticated history request', async () => {
      mockReq.userId = undefined;

      getConsentHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(consentService.getConsentHistory).not.toHaveBeenCalled();
    });
  });

  describe('getLatestConsent', () => {
    it('should return latest consent', async () => {
      mockReq.userId = 'user-123';
      const mockConsent = {
        id: 'consent-123',
        consentType: 'COOKIES',
        action: 'ACCEPT',
        version: '1.0',
        createdAt: new Date('2024-01-01'),
      };

      (consentService.getLatestConsent as any).mockResolvedValue(mockConsent);

      getLatestConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(consentService.getLatestConsent).toHaveBeenCalledWith('user-123');
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.consent).toBeDefined();
    });

    it('should return null when no consent found', async () => {
      mockReq.userId = 'user-123';

      (consentService.getLatestConsent as any).mockResolvedValue(null);

      getLatestConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._json).toEqual({
        success: true,
        data: {
          consent: null,
          message: 'No consent record found',
        },
      });
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      const error = new Error('Database error');

      (consentService.getLatestConsent as any).mockRejectedValue(error);

      getLatestConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should reject an unauthenticated latest-consent request', async () => {
      mockReq.userId = undefined;

      getLatestConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(consentService.getLatestConsent).not.toHaveBeenCalled();
    });
  });

  describe('withdrawConsent', () => {
    it('should withdraw consent successfully', async () => {
      mockReq.userId = 'user-123';
      mockReq.ip = '192.168.1.1';
      mockReq.headers = { 'user-agent': 'Test Agent' };

      const mockRecord = {
        id: 'consent-123',
        action: 'WITHDRAW',
        createdAt: new Date('2024-01-01'),
      };

      (consentService.withdrawConsent as any).mockResolvedValue(mockRecord);

      withdrawConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(consentService.withdrawConsent).toHaveBeenCalledWith(
        'user-123',
        '192.168.1.1',
        'Test Agent'
      );
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.message).toBe('Consent withdrawn successfully');
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      const error = new Error('Database error');

      (consentService.withdrawConsent as any).mockRejectedValue(error);

      withdrawConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should reject an unauthenticated withdrawal', async () => {
      mockReq.userId = undefined;

      withdrawConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(consentService.withdrawConsent).not.toHaveBeenCalled();
    });

    it('should fall back to the socket remote address when req.ip is missing', async () => {
      mockReq.userId = 'user-123';
      mockReq.ip = undefined;
      mockReq.socket = { remoteAddress: '10.0.0.9' };

      (consentService.withdrawConsent as any).mockResolvedValue({
        id: 'consent-123',
        action: 'WITHDRAW',
        createdAt: new Date(),
      });

      withdrawConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consentService.withdrawConsent).toHaveBeenCalledWith(
        'user-123',
        '10.0.0.9',
        undefined
      );
    });
  });

  describe('getAnonymousConsent', () => {
    it('should return anonymous consent by ID', async () => {
      mockReq.params = { consentId: 'consent-123' };
      const mockConsent = {
        id: 'consent-123',
        consentType: 'COOKIES',
        action: 'ACCEPT',
        version: '1.0',
        createdAt: new Date('2024-01-01'),
      };

      (consentService.getConsentById as any).mockResolvedValue(mockConsent);

      getAnonymousConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(consentService.getConsentById).toHaveBeenCalledWith('consent-123');
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.consent).toBeDefined();
    });

    it('should throw BadRequestError when consentId is missing', async () => {
      mockReq.params = {};

      getAnonymousConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Consent ID is required');
    });

    it('should return null when consent not found', async () => {
      mockReq.params = { consentId: 'consent-123' };

      (consentService.getConsentById as any).mockResolvedValue(null);

      getAnonymousConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._json).toEqual({
        success: true,
        data: {
          consent: null,
          message: 'No consent record found',
        },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { consentId: 'consent-123' };
      const error = new Error('Database error');

      (consentService.getConsentById as any).mockRejectedValue(error);

      getAnonymousConsent(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
