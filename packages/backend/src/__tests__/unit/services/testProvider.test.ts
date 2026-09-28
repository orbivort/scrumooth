/**
 * Unit tests for the Test Email Provider
 *
 * These tests complement email.service.test.ts by exercising the branches that
 * are not reached there: logging every optional section to the console, saving
 * emails to files (with full text formatting) and the output-directory guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}));

import { TestProvider } from '../../../services/email/providers/TestProvider.js';
import { logger } from '../../../utils/logger.js';
import type { EmailMessage } from '../../../services/email/types/email.types.js';

/**
 * Build an email message that populates every optional field, used to reach all
 * conditional rendering paths.
 */
function buildFullEmail(): EmailMessage {
  return {
    from: { name: 'Sender', address: 'sender@example.com' },
    to: ['recipient@example.com'],
    cc: ['cc@example.com'],
    bcc: ['bcc@example.com'],
    replyTo: 'reply@example.com',
    subject: 'Full Email',
    text: 'Plain text body',
    html: `<p>${'x'.repeat(600)}</p>`,
    attachments: [
      { filename: 'a.txt', content: 'string content', contentType: 'text/plain' },
      { filename: 'b.bin', content: Buffer.from('binary') },
    ],
    headers: { 'X-Test': 'one', 'X-Two': 'two' },
    tags: ['tag1', 'tag2'],
    metadata: { key: 'value' },
  };
}

describe('TestProvider (dedicated)', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('logEmailToConsole', () => {
    it('logs cc, bcc, reply-to, attachments, headers, tags and metadata when present', async () => {
      // Arrange
      const provider = new TestProvider({ logToConsole: true, saveToFile: false });

      // Act
      const result = await provider.send(buildFullEmail());

      // Assert
      expect(result.success).toBe(true);
      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
      expect(output).toContain('CC:');
      expect(output).toContain('BCC:');
      expect(output).toContain('Reply-To:');
      expect(output).toContain('Attachments:');
      expect(output).toContain('text/plain');
      expect(output).toContain('Headers:');
      expect(output).toContain('X-Test');
      expect(output).toContain('Tags:');
      expect(output).toContain('tag1');
      expect(output).toContain('Metadata:');
      expect(output).toContain('value');
    });

    it('logs unknown attachment content type when it is missing', async () => {
      // Arrange
      const provider = new TestProvider({ logToConsole: true, saveToFile: false });
      const email = buildFullEmail();
      email.attachments = [{ filename: 'no-type.bin', content: Buffer.from('x') }];

      // Act
      await provider.send(email);

      // Assert
      const output = consoleLogSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
      expect(output).toContain('unknown');
    });
  });

  describe('saveEmailToFiles', () => {
    it('writes json, html and txt files when html is present', async () => {
      // Arrange
      const provider = new TestProvider({
        logToConsole: false,
        saveToFile: true,
        outputDir: 'out',
      });

      // Act
      const result = await provider.send(buildFullEmail());

      // Assert
      expect(result.success).toBe(true);
      expect(fs.promises.mkdir).toHaveBeenCalledTimes(1);
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(3);
    });

    it('writes only json and txt files when html is absent', async () => {
      // Arrange
      const provider = new TestProvider({
        logToConsole: false,
        saveToFile: true,
        outputDir: 'out',
      });
      const email = buildFullEmail();
      delete email.html;

      // Act
      await provider.send(email);

      // Assert
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(2);
    });

    it('formats a minimal email to text without optional sections', async () => {
      // Arrange
      const provider = new TestProvider({
        logToConsole: false,
        saveToFile: true,
        outputDir: 'out',
      });

      // Act
      await provider.send({
        from: 'sender@example.com',
        to: ['recipient@example.com'],
        subject: 'Minimal',
        html: '<p>x</p>',
      });

      // Assert
      const txtCall = vi
        .mocked(fs.promises.writeFile)
        .mock.calls.find((call) => String(call[0]).endsWith('email.txt'));
      const content = String(txtCall?.[1] ?? '');
      expect(content).not.toContain('CC:');
      expect(content).not.toContain('BCC:');
      expect(content).not.toContain('Reply-To:');
      expect(content).not.toContain('--- Plain Text Body ---');
      expect(content).not.toContain('--- Attachments ---');
      expect(content).not.toContain('--- Headers ---');
      expect(content).not.toContain('Tags:');
      expect(content).not.toContain('--- Metadata ---');
    });

    it('logs an error when saving to files fails with an Error', async () => {
      // Arrange
      vi.mocked(fs.promises.mkdir).mockRejectedValue(new Error('mkdir failed'));
      const provider = new TestProvider({
        logToConsole: false,
        saveToFile: true,
        outputDir: 'out',
      });

      // Act
      const result = await provider.send(buildFullEmail());

      // Assert
      // The send still succeeds even though persisting failed.
      expect(result.success).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save email to files',
        expect.objectContaining({ error: 'mkdir failed' })
      );
    });

    it('logs "Unknown error" when saving fails with a non-Error value', async () => {
      // Arrange
      vi.mocked(fs.promises.mkdir).mockRejectedValue('boom');
      const provider = new TestProvider({
        logToConsole: false,
        saveToFile: true,
        outputDir: 'out',
      });

      // Act
      await provider.send(buildFullEmail());

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to save email to files',
        expect.objectContaining({ error: 'Unknown error' })
      );
    });
  });

  describe('ensureOutputDirectory', () => {
    it('creates the output directory when it does not exist', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Act
      new TestProvider({ logToConsole: false, saveToFile: true, outputDir: 'fresh-dir' });

      // Assert
      expect(fs.mkdirSync).toHaveBeenCalledWith('fresh-dir', { recursive: true });
      expect(logger.debug).toHaveBeenCalledWith('Created test email output directory', {
        path: 'fresh-dir',
      });
    });

    it('does not create the output directory when it already exists', () => {
      // Arrange
      vi.mocked(fs.existsSync).mockReturnValue(true);

      // Act
      new TestProvider({ logToConsole: false, saveToFile: true, outputDir: 'existing-dir' });

      // Assert
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('address formatting', () => {
    it('omits reply-to and formats an address without a display name', async () => {
      // Arrange
      const provider = new TestProvider({ logToConsole: false, saveToFile: false });

      // Act
      await provider.send({
        from: 'sender@example.com',
        to: [{ address: 'no-name@example.com' }],
        subject: 'No Reply',
        html: '<p>x</p>',
      });

      // Assert
      const captured = provider.getCapturedEmails();
      expect(captured[0]?.replyTo).toBeUndefined();
      expect(captured[0]?.to).toEqual(['no-name@example.com']);
    });
  });
});
