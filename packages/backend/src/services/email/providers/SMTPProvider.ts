/**
 * SMTP Email Provider
 *
 * Implements the IEmailProvider interface using nodemailer for SMTP communication.
 * Supports connection pooling for better performance and proper error handling.
 */

import nodemailer from 'nodemailer';
import type {
  SendMailOptions,
  SMTPTransportOptions,
  SMTPSentMessageInfo,
  Transporter,
} from 'nodemailer';
import type tls from 'node:tls';
import type {
  IEmailProvider,
  EmailMessage,
  EmailResult,
  EmailError,
  EmailAddress,
} from '../types/email.types.js';
import { logger } from '../../../utils/logger.js';

/**
 * SMTP authentication configuration
 */
export interface SMTPAuthConfig {
  /** Username for SMTP authentication */
  user: string;
  /** Password for SMTP authentication */
  pass: string;
}

/**
 * SMTP provider configuration
 */
export interface SMTPConfig {
  /** SMTP server hostname */
  host: string;
  /** SMTP server port */
  port: number;
  /** Use TLS (true for port 465, false for other ports) */
  secure: boolean;
  /** Authentication credentials */
  auth: SMTPAuthConfig;
  /** Enable connection pooling (default: true) */
  pool?: boolean;
  /** Maximum number of simultaneous connections (default: 5) */
  maxConnections?: number;
  /** Maximum number of messages per connection (default: 100) */
  maxMessages?: number;
  /** Rate limit for sending emails (messages per minute, optional) */
  rateLimit?: number;
  /** Connection timeout in milliseconds (default: 30000) */
  connectionTimeout?: number;
  /** Socket timeout in milliseconds (default: 300000) */
  socketTimeout?: number;
  /** TLS options (optional) */
  tls?: tls.ConnectionOptions;
  /** Default sender email address */
  defaultFrom?: EmailAddress | string;
}

/**
 * SMTP Provider implementation
 *
 * Provides email sending capabilities via SMTP protocol with support for:
 * - Connection pooling for better performance
 * - Proper error handling and conversion
 * - Health checks via transporter verification
 * - Batch email sending
 */
export class SMTPProvider implements IEmailProvider {
  readonly name = 'smtp';
  private transporter: Transporter<SMTPSentMessageInfo, SMTPTransportOptions>;
  private config: SMTPConfig;

  /**
   * Create a new SMTP Provider instance
   * @param config - SMTP configuration options
   */
  constructor(config: SMTPConfig) {
    this.config = config;

    // Build transport options with pooling support
    // Note: pool, maxConnections, maxMessages, rateLimit are valid nodemailer options
    // but not included in SMTPTransport.Options type
    const transportOptions: SMTPTransportOptions & {
      pool?: boolean;
      maxConnections?: number;
      maxMessages?: number;
      rateLimit?: number;
    } = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
      // Connection pooling configuration
      pool: config.pool ?? true,
      maxConnections: config.maxConnections ?? 5,
      maxMessages: config.maxMessages ?? 100,
      // Rate limiting
      rateLimit: config.rateLimit,
      // Timeouts
      connectionTimeout: config.connectionTimeout ?? 30000,
      socketTimeout: config.socketTimeout ?? 300000,
      // TLS options
      tls: config.tls ?? { rejectUnauthorized: true },
    };

    this.transporter = nodemailer.createTransport(transportOptions);

    logger.info('SMTP Provider initialized', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      pool: transportOptions.pool,
      maxConnections: transportOptions.maxConnections,
    });
  }

  /**
   * Send a single email
   * @param email - The email message to send
   * @returns Promise resolving to the send result
   */
  async send(email: EmailMessage): Promise<EmailResult> {
    try {
      const mailOptions = this.prepareMailOptions(email);

      logger.debug('Sending email via SMTP', {
        to: this.formatAddressesForLog(email.to),
        subject: email.subject,
        from: this.formatAddressForLog(email.from),
      });

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully via SMTP', {
        messageId: info.messageId,
        response: info.response,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const emailError = this.handleError(error);
      logger.error('Failed to send email via SMTP', {
        error: emailError.message,
        code: emailError.code,
        to: this.formatAddressesForLog(email.to),
        subject: email.subject,
      });

      return {
        success: false,
        error: emailError,
      };
    }
  }

  /**
   * Send multiple emails in a batch
   * @param emails - Array of email messages to send
   * @returns Promise resolving to an array of send results
   */
  async sendBatch(emails: EmailMessage[]): Promise<EmailResult[]> {
    logger.debug('Sending batch emails via SMTP', { count: emails.length });

    // Send emails in parallel using Promise.all
    const results = await Promise.all(emails.map((email) => this.send(email)));

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    logger.info('Batch email send completed', {
      total: emails.length,
      success: successCount,
      failed: failureCount,
    });

    return results;
  }

  /**
   * Check if the email provider is healthy and ready to send emails
   * @returns Promise resolving to true if healthy, false otherwise
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.debug('SMTP health check passed', { host: this.config.host });
      return true;
    } catch (error) {
      logger.error('SMTP health check error', {
        host: this.config.host,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Handle webhook events from the email provider
   * Not applicable for SMTP - always returns success
   * @param _payload - The webhook payload (ignored)
   * @param _headers - The webhook headers (ignored)
   * @returns Promise resolving to success status
   */
  async handleWebhook(
    _payload: unknown,
    _headers?: Record<string, string>
  ): Promise<{ success: boolean }> {
    logger.debug('SMTP provider does not support webhooks');
    return { success: true };
  }

  /**
   * Prepare mail options for nodemailer
   * @param email - The email message
   * @returns Nodemailer mail options object
   */
  private prepareMailOptions(email: EmailMessage): SendMailOptions {
    return {
      from: this.formatAddress(email.from),
      to: this.formatAddresses(email.to),
      cc: email.cc ? this.formatAddresses(email.cc) : undefined,
      bcc: email.bcc ? this.formatAddresses(email.bcc) : undefined,
      replyTo: email.replyTo ? this.formatAddress(email.replyTo) : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        encoding: att.encoding,
      })),
      headers: email.headers,
    };
  }

  /**
   * Format a single email address to "name <address>" format
   * @param address - The email address (string or EmailAddress object)
   * @returns Formatted email address string
   */
  private formatAddress(address: EmailAddress | string): string {
    if (typeof address === 'string') {
      return address;
    }

    if (address.name) {
      return `"${address.name}" <${address.address}>`;
    }

    return address.address;
  }

  /**
   * Format multiple email addresses
   * @param addresses - Array of email addresses
   * @returns Comma-separated formatted email addresses
   */
  private formatAddresses(addresses: EmailAddress[] | string[]): string {
    return addresses.map((addr) => this.formatAddress(addr)).join(', ');
  }

  /**
   * Format a single email address for logging (masks sensitive parts)
   * @param address - The email address
   * @returns Formatted string for logging
   */
  private formatAddressForLog(address: EmailAddress | string): string {
    if (typeof address === 'string') {
      return address;
    }
    return address.name ? `${address.name} <${address.address}>` : address.address;
  }

  /**
   * Format multiple email addresses for logging
   * @param addresses - Array of email addresses
   * @returns Comma-separated formatted string for logging
   */
  private formatAddressesForLog(addresses: EmailAddress[] | string[]): string {
    return addresses.map((addr) => this.formatAddressForLog(addr)).join(', ');
  }

  /**
   * Handle and convert nodemailer errors to appropriate EmailError types
   * @param error - The error from nodemailer
   * @returns EmailError object with appropriate code and message
   */
  private handleError(error: unknown): EmailError {
    // Handle known nodemailer error codes
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      const errorCode = nodeError.code;

      // Connection refused
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorCode === 'ETIMEDOUT') {
        return {
          code: 'EMAIL_CONNECTION_ERROR',
          message: `Failed to connect to SMTP server at ${this.config.host}:${this.config.port}`,
          details: {
            originalError: error.message,
            host: this.config.host,
            port: this.config.port,
          },
        };
      }

      // Authentication failed
      if (errorCode === 'EAUTH' || error.message.includes('Invalid login')) {
        return {
          code: 'EMAIL_AUTH_ERROR',
          message: 'SMTP authentication failed. Please check your credentials.',
          details: {
            originalError: error.message,
          },
        };
      }

      // Rate limit exceeded
      if (
        errorCode === 'ERATELIMIT' ||
        error.message.includes('rate limit') ||
        error.message.includes('too many')
      ) {
        return {
          code: 'EMAIL_RATE_LIMIT',
          message: 'SMTP rate limit exceeded. Please try again later.',
          details: {
            originalError: error.message,
            retryAfter: 60,
          },
        };
      }

      // SSL/TLS errors
      if (
        errorCode === 'ESSL' ||
        error.message.includes('SSL') ||
        error.message.includes('TLS') ||
        error.message.includes('certificate')
      ) {
        return {
          code: 'EMAIL_CONNECTION_ERROR',
          message: 'SSL/TLS connection error with SMTP server',
          details: {
            originalError: error.message,
            host: this.config.host,
          },
        };
      }

      // Connection timeout
      if (errorCode === 'ECONNECTION' || error.message.includes('timeout')) {
        return {
          code: 'EMAIL_CONNECTION_ERROR',
          message: 'Connection to SMTP server timed out',
          details: {
            originalError: error.message,
            host: this.config.host,
          },
        };
      }

      // Generic provider error
      return {
        code: 'EMAIL_PROVIDER_ERROR',
        message: error.message || 'Unknown SMTP error occurred',
        details: {
          originalError: error.message,
          code: errorCode,
        },
      };
    }

    // Unknown error type
    return {
      code: 'EMAIL_PROVIDER_ERROR',
      message: 'An unexpected error occurred while sending email',
      details: {
        error: String(error),
      },
    };
  }

  /**
   * Close the transporter and release resources
   * Call this when shutting down the application
   */
  close(): void {
    try {
      this.transporter.close();
      logger.info('SMTP transporter closed', { host: this.config.host });
    } catch (error) {
      logger.error('Error closing SMTP transporter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default SMTPProvider;
