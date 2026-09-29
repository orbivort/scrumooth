/**
 * Unit tests for Email Service
 *
 * Tests cover:
 * - EmailService provider selection
 * - TestProvider functionality
 * - Email validation
 * - Email templates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock config before importing any services - must be defined inside the mock factory
vi.mock('../../../config/index.js', () => ({
  config: {
    email: {
      provider: 'smtp' as const,
      testMode: {
        enabled: false,
        outputDirectory: 'logs/test-emails',
        logToConsole: true,
        saveToFile: false,
      },
      smtp: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
        pool: true,
        maxConnections: 5,
      },
      defaults: {
        fromName: 'Scrumooth',
        fromAddress: 'noreply@scrumooth.local',
        replyTo: '',
      },
    },
  },
}));

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock prisma
vi.mock('../../../utils/prisma.js', () => ({
  default: {
    emailLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-id' }),
    },
  },
}));

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({ messageId: '<test-id@smtp.local>' }),
      verify: vi.fn().mockResolvedValue(true),
      close: vi.fn(),
    }),
  },
}));

// Now import the services
import { EmailService } from '../../../services/email/EmailService.js';
import {
  TestProvider,
  type TestProviderConfig,
} from '../../../services/email/providers/TestProvider.js';
import { SMTPProvider, type SMTPConfig } from '../../../services/email/providers/SMTPProvider.js';
import { PasswordResetTemplate } from '../../../services/email/templates/PasswordResetTemplate.js';
import { PasswordChangeTemplate } from '../../../services/email/templates/PasswordChangeTemplate.js';
import { WelcomeEmailTemplate } from '../../../services/email/templates/WelcomeEmailTemplate.js';
import type {
  SendEmailInput,
  EmailMessage,
  EmailResult,
} from '../../../services/email/types/email.types.js';
import { config } from '../../../config/index.js';
import nodemailer from 'nodemailer';
import prisma from '../../../utils/prisma.js';
import { logger } from '../../../utils/logger.js';

describe('EmailService', () => {
  describe('Provider Selection', () => {
    it('should select TestProvider when testMode is enabled', () => {
      // Override config for this test
      (config.email.testMode as { enabled: boolean }).enabled = true;

      const service = new EmailService();
      const provider = service.getProvider();

      expect(provider.name).toBe('test');
      expect(provider).toBeInstanceOf(TestProvider);

      // Reset
      (config.email.testMode as { enabled: boolean }).enabled = false;
    });

    it('should select SMTPProvider when provider is smtp and testMode is disabled', () => {
      (config.email.testMode as { enabled: boolean }).enabled = false;
      (config.email as { provider: string }).provider = 'smtp';

      const service = new EmailService();
      const provider = service.getProvider();

      expect(provider.name).toBe('smtp');
      expect(provider).toBeInstanceOf(SMTPProvider);
    });

    it('should throw error for unsupported provider (sendgrid)', () => {
      (config.email.testMode as { enabled: boolean }).enabled = false;
      (config.email as { provider: string }).provider = 'sendgrid';

      expect(() => new EmailService()).toThrow('SendGrid provider is not yet implemented');

      // Reset
      (config.email as { provider: string }).provider = 'smtp';
    });

    it('should throw error for unsupported provider (ses)', () => {
      (config.email.testMode as { enabled: boolean }).enabled = false;
      (config.email as { provider: string }).provider = 'ses';

      expect(() => new EmailService()).toThrow('SES provider is not yet implemented');

      // Reset
      (config.email as { provider: string }).provider = 'smtp';
    });

    it('should throw error for unknown provider', () => {
      (config.email.testMode as { enabled: boolean }).enabled = false;
      (config.email as { provider: string }).provider = 'unknown';

      expect(() => new EmailService()).toThrow('Unknown email provider: unknown');

      // Reset
      (config.email as { provider: string }).provider = 'smtp';
    });
  });
});

describe('TestProvider', () => {
  let provider: TestProvider;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      provider = new TestProvider();
      expect(provider.name).toBe('test');
    });

    it('should initialize with custom config', () => {
      const testConfig: TestProviderConfig = {
        outputDir: 'custom-output',
        logToConsole: false,
        saveToFile: false,
      };
      provider = new TestProvider(testConfig);
      expect(provider.name).toBe('test');
    });
  });

  describe('send', () => {
    it('should capture email correctly', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const email: EmailMessage = {
        from: { name: 'Sender', address: 'sender@example.com' },
        to: [{ name: 'Recipient', address: 'recipient@example.com' }],
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      };

      const result = await provider.send(email);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/<.*@test-provider\.local>/);

      const capturedEmails = provider.getCapturedEmails();
      expect(capturedEmails).toHaveLength(1);
      expect(capturedEmails[0]?.subject).toBe('Test Subject');
      expect(capturedEmails[0]?.to).toContain('Recipient <recipient@example.com>');
    });

    it('should capture email with string addresses', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const email: EmailMessage = {
        from: 'sender@example.com',
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      };

      const result = await provider.send(email);

      expect(result.success).toBe(true);

      const capturedEmails = provider.getCapturedEmails();
      expect(capturedEmails).toHaveLength(1);
      expect(capturedEmails[0]?.to).toEqual(['recipient1@example.com', 'recipient2@example.com']);
    });

    it('should capture CC and BCC recipients', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const email: EmailMessage = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      };

      await provider.send(email);

      const capturedEmails = provider.getCapturedEmails();
      expect(capturedEmails[0]?.cc).toEqual(['cc1@example.com', 'cc2@example.com']);
      expect(capturedEmails[0]?.bcc).toEqual(['bcc@example.com']);
    });

    it('should capture attachments metadata', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const email: EmailMessage = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        attachments: [
          {
            filename: 'document.pdf',
            content: Buffer.from('test content'),
            contentType: 'application/pdf',
          },
        ],
      };

      await provider.send(email);

      const capturedEmails = provider.getCapturedEmails();
      expect(capturedEmails[0]?.attachments).toHaveLength(1);
      expect(capturedEmails[0]?.attachments[0]?.filename).toBe('document.pdf');
      expect(capturedEmails[0]?.attachments[0]?.contentType).toBe('application/pdf');
    });
  });

  describe('sendBatch', () => {
    it('should capture multiple emails', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const emails: EmailMessage[] = [
        {
          from: 'sender@example.com',
          to: ['recipient1@example.com'],
          subject: 'Email 1',
          html: '<p>Content 1</p>',
        },
        {
          from: 'sender@example.com',
          to: ['recipient2@example.com'],
          subject: 'Email 2',
          html: '<p>Content 2</p>',
        },
        {
          from: 'sender@example.com',
          to: ['recipient3@example.com'],
          subject: 'Email 3',
          html: '<p>Content 3</p>',
        },
      ];

      const results = await provider.sendBatch(emails);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      const capturedEmails = provider.getCapturedEmails();
      expect(capturedEmails).toHaveLength(3);
      expect(capturedEmails.map((e) => e.subject)).toEqual(['Email 1', 'Email 2', 'Email 3']);
    });
  });

  describe('isHealthy', () => {
    it('should return true', async () => {
      provider = new TestProvider();
      const result = await provider.isHealthy();
      expect(result).toBe(true);
    });
  });

  describe('logToConsole', () => {
    it('should log email content to console when logToConsole is true', async () => {
      provider = new TestProvider({ logToConsole: true, saveToFile: false });

      const email: EmailMessage = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Console Log Test',
        html: '<p>HTML content</p>',
        text: 'Text content',
      };

      await provider.send(email);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: unknown[]) => call.join(' '));
      const logOutput = logCalls.join('\n');

      expect(logOutput).toContain('TEST EMAIL CAPTURED');
      expect(logOutput).toContain('Console Log Test');
      expect(logOutput).toContain('recipient@example.com');
    });

    it('should not log to console when logToConsole is false', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const email: EmailMessage = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'No Console Log',
        html: '<p>Content</p>',
      };

      await provider.send(email);

      // Should not have any console.log calls for email content
      // (logger.debug calls are mocked separately)
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCapturedEmails', () => {
    it('should return all captured emails', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      await provider.send({
        from: 'sender@example.com',
        to: ['recipient1@example.com'],
        subject: 'Email 1',
        html: '<p>Content</p>',
      });

      await provider.send({
        from: 'sender@example.com',
        to: ['recipient2@example.com'],
        subject: 'Email 2',
        html: '<p>Content</p>',
      });

      const emails = provider.getCapturedEmails();
      expect(emails).toHaveLength(2);
    });

    it('should return empty array when no emails captured', () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });
      const emails = provider.getCapturedEmails();
      expect(emails).toEqual([]);
    });
  });

  describe('getCapturedEmail', () => {
    it('should return specific email by ID', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      const result = await provider.send({
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Email',
        html: '<p>Content</p>',
      });

      const emailId = result.messageId?.replace(/[<>]/g, '').split('@')[0];
      if (!emailId) {
        throw new Error('No email ID returned');
      }

      const captured = provider.getCapturedEmail(emailId);
      expect(captured).toBeDefined();
      expect(captured?.subject).toBe('Test Email');
    });

    it('should return undefined for non-existent ID', () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });
      const captured = provider.getCapturedEmail('non-existent-id');
      expect(captured).toBeUndefined();
    });
  });

  describe('clearCapturedEmails', () => {
    it('should clear all captured emails', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      await provider.send({
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        html: '<p>Content</p>',
      });

      expect(provider.getCapturedEmails()).toHaveLength(1);

      provider.clearCapturedEmails();

      expect(provider.getCapturedEmails()).toHaveLength(0);
    });
  });

  describe('getCapturedEmailCount', () => {
    it('should return correct count of captured emails', async () => {
      provider = new TestProvider({ logToConsole: false, saveToFile: false });

      expect(provider.getCapturedEmailCount()).toBe(0);

      await provider.send({
        from: 'sender@example.com',
        to: ['recipient1@example.com'],
        subject: 'Email 1',
        html: '<p>Content</p>',
      });

      expect(provider.getCapturedEmailCount()).toBe(1);

      await provider.send({
        from: 'sender@example.com',
        to: ['recipient2@example.com'],
        subject: 'Email 2',
        html: '<p>Content</p>',
      });

      expect(provider.getCapturedEmailCount()).toBe(2);
    });
  });

  describe('handleWebhook', () => {
    it('should return success for webhook handling', async () => {
      provider = new TestProvider();
      const result = await provider.handleWebhook({ test: 'payload' });
      expect(result.success).toBe(true);
    });
  });
});

describe('Email Validation', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    (config.email.testMode as { enabled: boolean }).enabled = true;
  });

  describe('send validation', () => {
    it('should return failed result when "to" is empty', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: [],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Email recipient (to) is required');
    });

    it('should return failed result when "subject" is empty', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['recipient@example.com'],
        subject: '',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Email subject is required');
    });

    it('should return failed result when "subject" is only whitespace', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['recipient@example.com'],
        subject: '   ',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Email subject is required');
    });

    it('should return failed result when both "html" and "text" are empty', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['recipient@example.com'],
        subject: 'Test Subject',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Email content (html or text) is required');
    });

    it('should accept email with only html content', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        html: '<p>HTML content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(true);
    });

    it('should accept email with only text content', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        text: 'Text content',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(true);
    });

    it('should return failed result for invalid email format', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['invalid-email'],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid email address: invalid-email');
    });

    it('should return failed result for email without @ symbol', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['noatsymbol.com'],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid email address: noatsymbol.com');
    });

    it('should return failed result for email without domain', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['missing@domain'],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid email address: missing@domain');
    });

    it('should accept valid email addresses', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: ['valid@example.com', 'another.valid@subdomain.example.org'],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(true);
    });

    it('should return failed result for invalid EmailAddress format', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: [{ name: 'Test User', address: 'invalid-address' }],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid email address: invalid-address');
    });

    it('should accept valid EmailAddress format', async () => {
      emailService = new EmailService();

      const input: SendEmailInput = {
        to: [{ name: 'Test User', address: 'valid@example.com' }],
        subject: 'Test Subject',
        html: '<p>Content</p>',
      };

      const result = await emailService.send(input);
      expect(result.success).toBe(true);
    });
  });
});

describe('Email Templates', () => {
  describe('PasswordResetTemplate', () => {
    let template: PasswordResetTemplate;

    beforeEach(() => {
      template = new PasswordResetTemplate();
    });

    it('should return correct template name', () => {
      expect(template.getTemplateName()).toBe('password-reset');
    });

    it('should render correctly with all required data', () => {
      const data = {
        subject: 'Reset Your Password',
        firstName: 'John',
        email: 'john@example.com',
        resetUrl: 'https://example.com/reset?token=abc123',
        expiresIn: '1 hour',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        supportEmail: 'support@example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.html).toContain('Hi John');
      expect(result.html).toContain('John');
      expect(result.html).toContain('john@example.com');
      expect(result.html).toContain('https://example.com/reset?token=abc123');
      expect(result.html).toContain('1 hour');
      expect(result.html).toContain('Scrumooth');
    });

    it('should render text version correctly', () => {
      const data = {
        subject: 'Reset Your Password',
        firstName: 'Jane',
        email: 'jane@example.com',
        resetUrl: 'https://example.com/reset?token=xyz789',
        expiresIn: '30 minutes',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.text).toContain('HI JANE');
      expect(result.text).toContain('jane@example.com');
      expect(result.text).toContain('https://example.com/reset?token=xyz789');
      expect(result.text).toContain('30 minutes');
    });

    it('should include ignore notice in both versions', () => {
      const data = {
        subject: 'Reset Your Password',
        firstName: 'User',
        email: 'user@example.com',
        resetUrl: 'https://example.com/reset',
        expiresIn: '1 hour',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      // HTML escapes apostrophes as &#x27;
      expect(result.html).toContain('didn&#x27;t request this');
      // Text version is uppercase (no HTML escaping)
      expect(result.text).toContain("DIDN'T REQUEST THIS");
    });

    it('should handle template variable substitution', () => {
      const data = {
        subject: 'Password Reset Request',
        firstName: 'Alice',
        email: 'alice@test.com',
        resetUrl: 'https://app.test.com/reset/token123',
        expiresIn: '2 hours',
        appName: 'TestApp',
        appUrl: 'https://app.test.com',
        supportEmail: 'help@test.com',
        locale: 'en' as const,
        currentYear: 2025,
      };

      const result = template.render(data);

      // Check that all variables are substituted
      expect(result.html).not.toContain('{{firstName}}');
      expect(result.html).not.toContain('{{email}}');
      expect(result.html).not.toContain('{{resetUrl}}');
      expect(result.html).toContain('Alice');
      expect(result.html).toContain('alice@test.com');
      expect(result.html).toContain('TestApp');
      expect(result.html).toContain('2025');
    });
  });

  describe('PasswordChangeTemplate', () => {
    let template: PasswordChangeTemplate;

    beforeEach(() => {
      template = new PasswordChangeTemplate();
    });

    it('should return correct template name', () => {
      expect(template.getTemplateName()).toBe('password-change-confirmation');
    });

    it('should render correctly with all required data', () => {
      const data = {
        subject: 'Password Changed',
        firstName: 'John',
        email: 'john@example.com',
        changedAt: '2024-01-15 10:30:00 UTC',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        supportEmail: 'support@example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.html).toContain('Password Changed Successfully');
      expect(result.html).toContain('John');
      expect(result.html).toContain('john@example.com');
      expect(result.html).toContain('2024-01-15 10:30:00 UTC');
    });

    it('should render text version correctly', () => {
      const data = {
        subject: 'Password Changed',
        firstName: 'Jane',
        email: 'jane@example.com',
        changedAt: '2024-02-20 14:45:00 UTC',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.text).toContain('Hello Jane');
      expect(result.text).toContain('jane@example.com');
      expect(result.text).toContain('2024-02-20 14:45:00 UTC');
      expect(result.text.toLowerCase()).toContain('password');
      expect(result.text.toLowerCase()).toContain('successfully changed');
    });

    it('should include IP address and user agent when provided', () => {
      const data = {
        subject: 'Password Changed',
        firstName: 'User',
        email: 'user@example.com',
        changedAt: '2024-03-01 09:00:00 UTC',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toContain('192.168.1.100');
      expect(result.html).toContain('Mozilla/5.0');
      expect(result.text).toContain('192.168.1.100');
      expect(result.text).toContain('Mozilla/5.0');
    });

    it('should include security notice', () => {
      const data = {
        subject: 'Password Changed',
        firstName: 'User',
        email: 'user@example.com',
        changedAt: '2024-01-01 00:00:00 UTC',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toContain('Security Notice');
      expect(result.text).toContain('SECURITY NOTICE');
    });

    it('should handle template variable substitution', () => {
      const data = {
        subject: 'Your Password Was Changed',
        firstName: 'Bob',
        email: 'bob@example.org',
        changedAt: '2024-06-15 12:00:00 UTC',
        appName: 'SecureApp',
        appUrl: 'https://secure.app.org',
        supportEmail: 'help@secure.app.org',
        locale: 'en' as const,
        currentYear: 2025,
      };

      const result = template.render(data);

      // Check that all variables are substituted
      expect(result.html).not.toContain('{{firstName}}');
      expect(result.html).not.toContain('{{email}}');
      expect(result.html).not.toContain('{{changedAt}}');
      expect(result.html).toContain('Bob');
      expect(result.html).toContain('bob@example.org');
      expect(result.html).toContain('SecureApp');
      expect(result.html).toContain('2025');
    });
  });

  describe('WelcomeEmailTemplate', () => {
    let template: WelcomeEmailTemplate;

    beforeEach(() => {
      template = new WelcomeEmailTemplate();
    });

    it('should render correctly with all required data', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'John',
        email: 'john@example.com',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        supportEmail: 'support@example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.html).toContain('Welcome, John!');
      expect(result.html).toContain('John');
      expect(result.html).toContain('john@example.com');
    });

    it('should render text version correctly', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'Jane',
        email: 'jane@example.com',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.text).toContain('Hello Jane');
      expect(result.text).toContain('jane@example.com');
      expect(result.text.toLowerCase()).toContain('welcome');
    });

    it('should include getting started section', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'User',
        email: 'user@example.com',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toContain('Your Agile Journey Starts Here');
      expect(result.html).toContain('For Scrum Masters and Product Owners');
      expect(result.html).toContain('Create your team workspace');
      expect(result.html).toContain('Invite team members to collaborate');
      expect(result.html).toContain('For Developers');
      expect(result.html).toContain('Check your notifications for team invitations');
    });

    it('should include platform capabilities section', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'User',
        email: 'user@example.com',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toContain('Platform Capabilities');
      expect(result.html).toContain('Team Collaboration');
      expect(result.html).toContain('Sprint Planning');
      expect(result.html).toContain('Progress Tracking');
      expect(result.html).toContain('Agile Ceremonies');
    });

    it('should include security notice with email', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'User',
        email: 'user@example.com',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toContain('Account Security');
      expect(result.html).toContain('user@example.com');
    });

    it('should handle template variable substitution', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'Bob',
        email: 'bob@example.org',
        appName: 'SecureApp',
        appUrl: 'https://secure.app.org',
        supportEmail: 'help@secure.app.org',
        locale: 'en' as const,
        currentYear: 2025,
      };

      const result = template.render(data);

      // Check that all variables are substituted
      expect(result.html).not.toContain('{{firstName}}');
      expect(result.html).not.toContain('{{email}}');
      expect(result.html).not.toContain('{{appName}}');
      expect(result.html).toContain('Bob');
      expect(result.html).toContain('bob@example.org');
      expect(result.html).toContain('SecureApp');
      expect(result.html).toContain('2025');
    });

    it('should include call to action button', () => {
      const data = {
        subject: 'Welcome!',
        firstName: 'User',
        email: 'user@example.com',
        appName: 'Scrumooth',
        appUrl: 'https://example.com',
        locale: 'en' as const,
        currentYear: 2024,
      };

      const result = template.render(data);

      expect(result.html).toContain('Get started');
      expect(result.html).toContain('https://example.com');
    });
  });
});

describe('SMTPProvider', () => {
  describe('constructor', () => {
    it('should initialize with valid config', () => {
      const smtpConfig: SMTPConfig = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
      };

      const provider = new SMTPProvider(smtpConfig);
      expect(provider.name).toBe('smtp');
    });

    it('should use default values for optional config', () => {
      const smtpConfig: SMTPConfig = {
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
      };

      const provider = new SMTPProvider(smtpConfig);
      expect(provider.name).toBe('smtp');
    });
  });

  describe('isHealthy', () => {
    it('should return true when connection is valid', async () => {
      const smtpConfig: SMTPConfig = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
      };

      const provider = new SMTPProvider(smtpConfig);
      const result = await provider.isHealthy();
      expect(result).toBe(true);
    });
  });

  describe('send', () => {
    it('should send email and return success result', async () => {
      const smtpConfig: SMTPConfig = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
      };

      const provider = new SMTPProvider(smtpConfig);

      const email: EmailMessage = {
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      };

      const result = await provider.send(email);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('sendBatch', () => {
    it('should send multiple emails', async () => {
      const smtpConfig: SMTPConfig = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
      };

      const provider = new SMTPProvider(smtpConfig);

      const emails: EmailMessage[] = [
        {
          from: 'sender@example.com',
          to: ['recipient1@example.com'],
          subject: 'Email 1',
          html: '<p>Content 1</p>',
        },
        {
          from: 'sender@example.com',
          to: ['recipient2@example.com'],
          subject: 'Email 2',
          html: '<p>Content 2</p>',
        },
      ];

      const results = await provider.sendBatch(emails);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    it('should return success (SMTP does not support webhooks)', async () => {
      const smtpConfig: SMTPConfig = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass',
        },
      };

      const provider = new SMTPProvider(smtpConfig);
      const result = await provider.handleWebhook({});

      expect(result.success).toBe(true);
    });
  });
});

describe('EmailService branch coverage', () => {
  afterEach(() => {
    // Restore the default configuration mutated by these tests.
    (config.email.testMode as { enabled: boolean }).enabled = false;
    (config.email as { provider: string }).provider = 'smtp';
    (config.email.defaults as { replyTo: string }).replyTo = '';
  });

  it('should configure a default reply-to when one is set', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    (config.email.defaults as { replyTo: string }).replyTo = 'reply@scrumooth.local';
    const service = new EmailService();

    // Act
    const result = await service.send({
      to: ['recipient@example.com'],
      subject: 'Reply To',
      html: '<p>Content</p>',
    });

    // Assert
    expect(result.success).toBe(true);
    const provider = service.getProvider() as TestProvider;
    expect(provider.getCapturedEmails()[0]?.replyTo).toBe('reply@scrumooth.local');
  });

  it('should send a batch of emails and report mixed results', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();
    const inputs: SendEmailInput[] = [
      { to: ['ok@example.com'], subject: 'OK', html: '<p>ok</p>' },
      { to: [], subject: 'Invalid', html: '<p>bad</p>' },
    ];

    // Act
    const results = await service.sendBatch(inputs);

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
  });

  it('should report healthy when the provider health check succeeds', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();

    // Act & Assert
    await expect(service.isHealthy()).resolves.toBe(true);
  });

  it('should report unhealthy when the provider health check throws', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();
    vi.spyOn(service.getProvider(), 'isHealthy').mockRejectedValue(new Error('down'));

    // Act & Assert
    await expect(service.isHealthy()).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Email provider health check failed',
      expect.anything()
    );
  });

  it('should return a failed result when the provider reports failure without throwing', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = false;
    (config.email as { provider: string }).provider = 'smtp';
    const transporter = {
      sendMail: vi.fn().mockRejectedValue(new Error('smtp down')),
      verify: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(nodemailer.createTransport).mockReturnValueOnce(transporter as never);
    const service = new EmailService();

    // Act
    const result = await service.send({
      to: ['recipient@example.com'],
      subject: 'Failure',
      html: '<p>Content</p>',
    });

    // Assert
    expect(result.success).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith('Email send failed', expect.anything());
  });

  it('should handle a non-Error thrown by the provider', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();
    vi.spyOn(service.getProvider(), 'send').mockRejectedValue('boom');

    // Act
    const result = await service.send({
      to: ['recipient@example.com'],
      subject: 'Non Error',
      html: '<p>Content</p>',
    });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Unknown error');
  });

  it('should log and swallow a database logging failure with an Error', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();
    vi.mocked(prisma.emailLog.create).mockRejectedValueOnce(new Error('db down'));

    // Act
    const result = await service.send({
      to: ['recipient@example.com'],
      subject: 'DB Error',
      html: '<p>Content</p>',
    });

    // Assert
    expect(result.success).toBe(true);
    expect(logger.error).toHaveBeenCalledWith('Failed to log email to database', expect.anything());
  });

  it('should log and swallow a database logging failure with a non-Error', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();
    vi.mocked(prisma.emailLog.create).mockRejectedValueOnce('db down');

    // Act
    const result = await service.send({
      to: ['recipient@example.com'],
      subject: 'DB Error',
      html: '<p>Content</p>',
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it('should not propagate an error raised while logging a failed send', async () => {
    // Arrange
    (config.email.testMode as { enabled: boolean }).enabled = true;
    const service = new EmailService();
    vi.spyOn(service.getProvider(), 'send').mockRejectedValue(new Error('provider down'));
    const internals = service as unknown as {
      logEmailToDatabase: (
        input: SendEmailInput,
        result: EmailResult,
        providerName: string
      ) => Promise<void>;
    };
    internals.logEmailToDatabase = vi.fn().mockRejectedValue(new Error('logging down'));

    // Act
    const result = await service.send({
      to: ['recipient@example.com'],
      subject: 'Double Failure',
      html: '<p>Content</p>',
    });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('provider down');
    expect(logger.error).toHaveBeenCalledWith('Failed to log email to database', expect.anything());
  });
});
