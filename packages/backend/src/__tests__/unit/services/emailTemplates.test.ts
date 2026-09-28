/**
 * Unit tests for the email templates
 *
 * Focuses on the fallback / conditional branches that are not exercised by
 * email.service.test.ts (missing recipient name, partial device information)
 * and the template name accessor of the welcome template.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { PasswordResetTemplate } from '../../../services/email/templates/PasswordResetTemplate.js';
import { PasswordChangeTemplate } from '../../../services/email/templates/PasswordChangeTemplate.js';
import { WelcomeEmailTemplate } from '../../../services/email/templates/WelcomeEmailTemplate.js';

describe('PasswordResetTemplate branches', () => {
  it('renders the fallback greeting when no recipient name is available', () => {
    // Arrange
    const template = new PasswordResetTemplate();

    // Act
    const result = template.render({
      subject: 'Reset',
      firstName: undefined as unknown as string,
      email: 'user@example.com',
      resetUrl: 'https://example.com/reset',
      expiresIn: '1 hour',
      appName: 'Scrumooth',
      appUrl: 'https://example.com',
      locale: 'en' as const,
      currentYear: 2024,
    });

    // Assert
    expect(result.html).toBeDefined();
    expect(result.text).toBeDefined();
    // Without a name the greeting has no "<name>," suffix.
    expect(result.text).toContain('Hello,');
    expect(result.html).toContain('Hello,');
  });
});

describe('PasswordChangeTemplate branches', () => {
  it('defaults the device to N/A when only the IP address is provided', () => {
    // Arrange
    const template = new PasswordChangeTemplate();

    // Act
    const result = template.render({
      subject: 'Password Changed',
      firstName: 'Alex',
      email: 'alex@example.com',
      changedAt: '2024-01-01 00:00:00 UTC',
      ipAddress: '192.168.0.1',
      appName: 'Scrumooth',
      appUrl: 'https://example.com',
      currentYear: 2024,
    });

    // Assert
    expect(result.text).toContain('IP Address: 192.168.0.1');
    expect(result.text).toContain('Device: N/A');
  });

  it('defaults the IP address to N/A when only the user agent is provided', () => {
    // Arrange
    const template = new PasswordChangeTemplate();

    // Act
    const result = template.render({
      subject: 'Password Changed',
      firstName: 'Alex',
      email: 'alex@example.com',
      changedAt: '2024-01-01 00:00:00 UTC',
      userAgent: 'Mozilla/5.0 Test Browser',
      appName: 'Scrumooth',
      appUrl: 'https://example.com',
      currentYear: 2024,
    });

    // Assert
    expect(result.text).toContain('IP Address: N/A');
    expect(result.text).toContain('Device: Mozilla/5.0 Test Browser');
  });

  it('omits the device section when neither IP address nor user agent is provided', () => {
    // Arrange
    const template = new PasswordChangeTemplate();

    // Act
    const result = template.render({
      subject: 'Password Changed',
      firstName: 'Alex',
      email: 'alex@example.com',
      changedAt: '2024-01-01 00:00:00 UTC',
      appName: 'Scrumooth',
      appUrl: 'https://example.com',
      currentYear: 2024,
    });

    // Assert
    expect(result.text).not.toContain('IP Address:');
    expect(result.text).not.toContain('Device:');
  });
});

describe('WelcomeEmailTemplate branches', () => {
  it('exposes the template name', () => {
    // Arrange
    const template = new WelcomeEmailTemplate();

    // Assert
    expect(template.getTemplateName()).toBe('welcome-email');
  });

  it('renders without a support section when supportEmail is missing', () => {
    // Arrange
    const template = new WelcomeEmailTemplate();

    // Act
    const result = template.render({
      subject: 'Welcome!',
      firstName: 'Sam',
      email: 'sam@example.com',
      appName: 'Scrumooth',
      appUrl: 'https://example.com',
      locale: 'en' as const,
      currentYear: 2024,
    });

    // Assert
    expect(result.html).not.toContain('mailto:');
    expect(result.text).not.toContain('Need help?');
  });

  it('renders a support section when supportEmail is present', () => {
    // Arrange
    const template = new WelcomeEmailTemplate();

    // Act
    const result = template.render({
      subject: 'Welcome!',
      firstName: 'Sam',
      email: 'sam@example.com',
      appName: 'Scrumooth',
      appUrl: 'https://example.com',
      supportEmail: 'help@example.com',
      locale: 'en' as const,
      currentYear: 2024,
    });

    // Assert
    expect(result.html).toContain('mailto:help@example.com');
    expect(result.text).toContain('help@example.com');
  });
});
