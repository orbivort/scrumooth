// Application Configuration
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Deferred logging utility for early initialization messages
// These messages will be logged when the logger becomes available
const deferredLogs: Array<{ level: 'info' | 'warn'; message: string }> = [];

const logDeferred = (level: 'info' | 'warn', message: string): void => {
  // Store for later replay
  deferredLogs.push({ level, message });
  // Also output to console immediately for early visibility
  if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
};

/**
 * Replay deferred logs to the logger once it's available
 * Should be called after logger is initialized
 */
export const replayDeferredLogs = (): void => {
  // Dynamic import to avoid circular dependency
  import('../utils/logger.js')
    .then(({ logger }) => {
      for (const { level, message } of deferredLogs) {
        logger.log(level, message);
      }
    })
    .catch(() => {
      // Ignore errors during replay
    });
};

const loadEnvironmentConfig = (): void => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const envDir = path.resolve(__dirname, '../../');

  const envFiles: string[] = [];

  if (nodeEnv === 'test') {
    envFiles.push('.env.test');
  } else if (nodeEnv === 'production') {
    envFiles.push('.env.production');
  } else {
    envFiles.push('.env.development');
  }

  envFiles.push('.env');

  for (const envFile of envFiles) {
    const envPath = path.join(envDir, envFile);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      logDeferred('info', `Loaded environment from: ${envFile}`);
      return;
    }
  }

  logDeferred('warn', 'No .env file found, using system environment variables');
};

loadEnvironmentConfig();

const WEAK_SECRETS = [
  'your-super-secret-jwt-key',
  'secret',
  'password',
  'jwt-secret',
  'changeme',
  '123456',
  'dev-secret-key-not-for-production',
  'test-secret-key-for-integration-tests-only-not-for-production',
];

const WEAK_PASSWORDS = ['password', 'postgres', 'admin', 'root', '123456', 'changeme', 'test'];

const generateSecret = (): string => {
  const secret = crypto.randomBytes(64).toString('hex');
  logDeferred(
    'warn',
    'WARNING: Using auto-generated JWT secret. Set JWT_SECRET environment variable for production.'
  );
  return secret;
};

const EMAIL_DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Parses the REGISTRATION_ALLOWED_EMAIL_DOMAINS CSV into a normalized,
 * deduplicated list of lowercase domains. Emits a deferred warning when
 * duplicate entries are present (benign, not fatal). Returns an empty array
 * when the variable is unset/empty (restriction disabled).
 */
const buildAllowedEmailDomains = (): string[] => {
  const raw = process.env.REGISTRATION_ALLOWED_EMAIL_DOMAINS;
  if (!raw) return [];

  const parsed = raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const unique = [...new Set(parsed)];
  if (unique.length !== parsed.length) {
    logDeferred(
      'warn',
      'REGISTRATION_ALLOWED_EMAIL_DOMAINS contains duplicate entries. They will be deduplicated.'
    );
  }

  return unique;
};

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '5000', 10),
  apiPrefix: process.env.API_PREFIX ?? '/api',

  // Database
  databaseUrl: process.env.DATABASE_URL ?? '',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET ?? generateSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  // Session Management
  session: {
    idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS ?? '1800000', 10),
    absoluteTimeoutMs: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MS ?? '86400000', 10),
    warningThresholdMs: parseInt(process.env.SESSION_WARNING_THRESHOLD_MS ?? '120000', 10),
    cleanupIntervalMs: parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS ?? '3600000', 10),
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '5', 10),
  },

  // Bcrypt
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },

  // Token Hashing
  tokenHash: {
    algorithm: process.env.TOKEN_HASH_ALGORITHM ?? 'sha256',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:5173'],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    directory: process.env.LOG_DIR ?? 'logs',
    maxFiles: process.env.LOG_MAX_FILES ?? '14d',
    maxSize: process.env.LOG_MAX_SIZE ?? '20m',
    format: process.env.LOG_FORMAT ?? 'json',
  },

  // Notification System Configuration
  notification: {
    pollingIntervalMs: Math.max(
      1000, // Minimum 1 second
      parseInt(process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS ?? '5', 10) * 1000
    ),
    retentionDays: Math.max(
      0, // 0 means no cleanup (not recommended)
      parseInt(process.env.NOTIFICATION_RETENTION_DAYS ?? '30', 10)
    ),
    cleanupCron: process.env.NOTIFICATION_CLEANUP_CRON ?? '0 2 * * *',
    maxPageSize: Math.min(
      100, // Maximum 100 per page
      Math.max(10, parseInt(process.env.NOTIFICATION_MAX_PAGE_SIZE ?? '50', 10))
    ),
  },

  // Event Loop Monitoring
  eventLoop: {
    enabled:
      process.env.EVENT_LOOP_MONITORING_ENABLED !== undefined
        ? process.env.EVENT_LOOP_MONITORING_ENABLED === 'true'
        : (process.env.NODE_ENV ?? 'development') === 'production',
    resolution: parseInt(process.env.EVENT_LOOP_RESOLUTION ?? '10', 10),
    warnThreshold: parseInt(process.env.EVENT_LOOP_WARN_THRESHOLD ?? '100', 10),
    criticalThreshold: parseInt(process.env.EVENT_LOOP_CRITICAL_THRESHOLD ?? '500', 10),
  },

  // Health Check
  healthCheck: {
    databaseTimeout: parseInt(process.env.HEALTH_CHECK_DATABASE_TIMEOUT ?? '5000', 10),
  },

  // Account Deletion
  deletion: {
    scheduleConfirmationPhrase: 'SCHEDULE DELETION',
    gracePeriodDays: parseInt(process.env.ACCOUNT_DELETION_GRACE_PERIOD_DAYS ?? '14', 10),
  },

  // Registration Configuration (opt-in email domain restriction)
  registration: {
    // Comma-separated list of allowed email domains, e.g. "acme.com,acme.eu".
    // Empty string or unset => restriction disabled (open registration).
    allowedEmailDomains: buildAllowedEmailDomains(),
    // Derived convenience flag: true when the restriction is active.
    isRestricted: buildAllowedEmailDomains().length > 0,
  },

  // Team Configuration (Scrum Guide compliance)
  team: {
    // Maximum number of members allowed per Scrum Team (Scrum Guide: "typically 10 or fewer").
    // Configurable so self-hosted deployments can adjust the limit.
    maxSize: parseInt(process.env.TEAM_MAX_SIZE ?? '10', 10),
  },

  // Sprint Configuration (Scrum Guide compliance)
  sprint: {
    // Over-commitment tolerance, as a percentage, allowed when comparing the plan's summed
    // task hours against the capacity the team recorded during Sprint Planning. Estimation is
    // inherently approximate, so a plan may exceed recorded capacity by up to this amount
    // before `startSprint` refuses it. `0` disables the tolerance (strict > 100% refusal).
    capacityTolerancePct: parseFloat(process.env.SPRINT_CAPACITY_TOLERANCE_PCT ?? '10'),
  },

  // Database Transaction Configuration
  database: {
    transaction: {
      startSprint: {
        maxWait: parseInt(process.env.DB_TRANSACTION_START_SPRINT_MAX_WAIT ?? '5000', 10),
        timeout: parseInt(process.env.DB_TRANSACTION_START_SPRINT_TIMEOUT ?? '15000', 10),
        retries: parseInt(process.env.DB_TRANSACTION_START_SPRINT_RETRIES ?? '2', 10),
      },
      default: {
        maxWait: parseInt(process.env.DB_TRANSACTION_MAX_WAIT ?? '5000', 10),
        timeout: parseInt(process.env.DB_TRANSACTION_TIMEOUT ?? '10000', 10),
        retries: parseInt(process.env.DB_TRANSACTION_RETRIES ?? '2', 10),
      },
    },
    circuitBreaker: {
      failureThreshold: parseInt(process.env.DB_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? '5', 10),
      resetTimeoutMs: parseInt(process.env.DB_CIRCUIT_BREAKER_RESET_TIMEOUT_MS ?? '60000', 10),
    },
  },

  // i18n
  i18n: {
    defaultLocale: process.env.DEFAULT_LOCALE ?? 'en',
    supportedLocales: process.env.SUPPORTED_LOCALES?.split(',') ?? ['en', 'de', 'fr', 'it', 'es'],
  },

  // Email Configuration
  email: {
    provider: (process.env.EMAIL_PROVIDER ?? 'smtp') as 'smtp' | 'sendgrid' | 'ses',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

    // Test mode configuration
    testMode: {
      enabled: process.env.EMAIL_TEST_MODE === 'true',
      outputDirectory: process.env.EMAIL_TEST_OUTPUT_DIR ?? 'logs/test-emails',
      logToConsole: process.env.EMAIL_TEST_LOG_CONSOLE !== 'false',
      saveToFile: process.env.EMAIL_TEST_SAVE_FILE !== 'false',
    },

    // SMTP configuration
    smtp: {
      host: process.env.SMTP_HOST ?? 'localhost',
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
      },
      pool: process.env.SMTP_POOL !== 'false',
      maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS ?? '5', 10),
      rateLimit: {
        enabled: process.env.SMTP_RATE_LIMIT_ENABLED === 'true',
        maxMessages: parseInt(process.env.SMTP_RATE_LIMIT_MAX_MESSAGES ?? '100', 10),
        windowMs: parseInt(process.env.SMTP_RATE_LIMIT_WINDOW_MS ?? '60000', 10),
      },
    },

    // SendGrid configuration
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY ?? '',
    },

    // SES configuration
    ses: {
      region: process.env.SES_REGION ?? 'us-east-1',
      accessKeyId: process.env.SES_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY ?? '',
    },

    // Default email settings
    defaults: {
      fromName: process.env.EMAIL_FROM_NAME ?? 'Scrumooth',
      fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'noreply@scrumooth.local',
      replyTo: process.env.EMAIL_REPLY_TO ?? '',
    },

    // Feature flags
    features: {
      tracking: process.env.EMAIL_TRACKING !== 'false',
      openTracking: process.env.EMAIL_OPEN_TRACKING === 'true',
      clickTracking: process.env.EMAIL_CLICK_TRACKING === 'true',
      queue: process.env.EMAIL_QUEUE !== 'false',
    },

    // Retry configuration
    retry: {
      maxAttempts: parseInt(process.env.EMAIL_RETRY_MAX_ATTEMPTS ?? '3', 10),
      backoffMs: parseInt(process.env.EMAIL_RETRY_BACKOFF_MS ?? '1000', 10),
      maxBackoffMs: parseInt(process.env.EMAIL_RETRY_MAX_BACKOFF_MS ?? '30000', 10),
    },

    // Retention configuration (GDPR compliance)
    retention: {
      successfulDays: parseInt(process.env.EMAIL_RETENTION_SUCCESSFUL_DAYS ?? '30', 10),
      failedDays: parseInt(process.env.EMAIL_RETENTION_FAILED_DAYS ?? '90', 10),
      bouncedDays: parseInt(process.env.EMAIL_RETENTION_BOUNCED_DAYS ?? '365', 10),
    },

    // Circuit breaker configuration
    circuitBreaker: {
      failureThreshold: parseInt(process.env.EMAIL_CIRCUIT_BREAKER_FAILURE_THRESHOLD ?? '5', 10),
      resetTimeoutMs: parseInt(process.env.EMAIL_CIRCUIT_BREAKER_RESET_TIMEOUT_MS ?? '60000', 10),
    },
  },
} as const;

// Validate required environment variables
export const validateConfig = (): void => {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate registration email domain restriction
  for (const domain of config.registration.allowedEmailDomains) {
    if (!EMAIL_DOMAIN_PATTERN.test(domain)) {
      throw new Error(
        `REGISTRATION_ALLOWED_EMAIL_DOMAINS contains an invalid domain: "${domain}". ` +
          'Domains must be lowercase labels (e.g. "acme.com"), each with a valid TLD.'
      );
    }
  }

  if (config.nodeEnv === 'production') {
    if (WEAK_SECRETS.includes(config.jwt.secret)) {
      throw new Error('JWT_SECRET must be changed from default value in production');
    }

    if (config.jwt.secret.length < 64) {
      throw new Error('JWT_SECRET must be at least 64 characters in production');
    }

    const dbUrlLower = config.databaseUrl.toLowerCase();
    for (const weakPassword of WEAK_PASSWORDS) {
      if (dbUrlLower.includes(`:${weakPassword}@`)) {
        throw new Error(
          `DATABASE_URL contains a weak password '${weakPassword}'. Use a strong password in production.`
        );
      }
    }

    for (const origin of config.cors.origin) {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        throw new Error(
          `CORS_ORIGIN contains localhost/127.0.0.1 (${origin}). Use production domains in production.`
        );
      }
    }
  }

  // Validate notification configuration
  if (config.notification.pollingIntervalMs < 1000) {
    throw new Error('NOTIFICATION_POLLING_INTERVAL_SECONDS must be at least 1 second (1000ms)');
  }

  // Import logger lazily to avoid circular dependency
  // Using dynamic import for validateConfig since it's called after logger is initialized
  import('../utils/logger.js')
    .then(({ logger }) => {
      if (config.notification.pollingIntervalMs > 60000) {
        logger.warn(
          'NOTIFICATION_POLLING_INTERVAL_SECONDS is set to more than 60 seconds. ' +
            'This may result in poor real-time user experience.'
        );
      }

      if (config.notification.retentionDays === 0) {
        logger.warn(
          'NOTIFICATION_RETENTION_DAYS is set to 0. ' +
            'Automatic notification cleanup is disabled. This may result in unlimited database growth.'
        );
      }

      if (config.notification.retentionDays > 365) {
        logger.warn(
          'NOTIFICATION_RETENTION_DAYS is set to more than 1 year. ' +
            'Consider a shorter retention period to manage database storage.'
        );
      }
    })
    .catch(() => {
      // Fallback to deferred logging if logger is not available
      if (config.notification.pollingIntervalMs > 60000) {
        logDeferred(
          'warn',
          'NOTIFICATION_POLLING_INTERVAL_SECONDS is set to more than 60 seconds. ' +
            'This may result in poor real-time user experience.'
        );
      }

      if (config.notification.retentionDays === 0) {
        logDeferred(
          'warn',
          'NOTIFICATION_RETENTION_DAYS is set to 0. ' +
            'Automatic notification cleanup is disabled. This may result in unlimited database growth.'
        );
      }

      if (config.notification.retentionDays > 365) {
        logDeferred(
          'warn',
          'NOTIFICATION_RETENTION_DAYS is set to more than 1 year. ' +
            'Consider a shorter retention period to manage database storage.'
        );
      }
    });

  if (config.notification.retentionDays < 0) {
    throw new Error('NOTIFICATION_RETENTION_DAYS must be a non-negative integer');
  }

  if (config.notification.maxPageSize < 10 || config.notification.maxPageSize > 100) {
    throw new Error('NOTIFICATION_MAX_PAGE_SIZE must be between 10 and 100');
  }

  // Validate team configuration
  if (config.team.maxSize < 1) {
    throw new Error('TEAM_MAX_SIZE must be a positive integer');
  }

  // Validate sprint configuration
  if (Number.isNaN(config.sprint.capacityTolerancePct) || config.sprint.capacityTolerancePct < 0) {
    throw new Error('SPRINT_CAPACITY_TOLERANCE_PCT must be a non-negative number');
  }

  // Validate event loop monitoring configuration
  if (config.eventLoop.resolution <= 0) {
    throw new Error('EVENT_LOOP_RESOLUTION must be a positive integer');
  }

  if (config.eventLoop.warnThreshold <= 0) {
    throw new Error('EVENT_LOOP_WARN_THRESHOLD must be a positive integer');
  }

  if (config.eventLoop.criticalThreshold <= 0) {
    throw new Error('EVENT_LOOP_CRITICAL_THRESHOLD must be a positive integer');
  }

  if (config.eventLoop.warnThreshold >= config.eventLoop.criticalThreshold) {
    throw new Error('EVENT_LOOP_WARN_THRESHOLD must be less than EVENT_LOOP_CRITICAL_THRESHOLD');
  }

  // Validate health check configuration
  if (config.healthCheck.databaseTimeout <= 0) {
    throw new Error('HEALTH_CHECK_DATABASE_TIMEOUT must be a positive integer');
  }

  // Validate email configuration
  if (config.email.testMode.enabled && config.nodeEnv === 'production') {
    throw new Error('EMAIL_TEST_MODE cannot be enabled in production environment');
  }

  if (config.nodeEnv === 'production') {
    if (!process.env.EMAIL_PROVIDER) {
      throw new Error('EMAIL_PROVIDER must be set in production environment');
    }

    const validProviders = ['smtp', 'sendgrid', 'ses'];
    if (!validProviders.includes(config.email.provider)) {
      throw new Error(
        `EMAIL_PROVIDER must be one of: ${validProviders.join(', ')}. Got: ${config.email.provider}`
      );
    }

    // Validate SMTP configuration when provider is smtp
    if (config.email.provider === 'smtp') {
      if (!config.email.smtp.host) {
        throw new Error('SMTP_HOST must be set when EMAIL_PROVIDER is smtp');
      }
      if (config.email.smtp.port <= 0 || config.email.smtp.port > 65535) {
        throw new Error('SMTP_PORT must be a valid port number (1-65535)');
      }
      if (!config.email.smtp.auth.user) {
        throw new Error('SMTP_USER must be set when EMAIL_PROVIDER is smtp');
      }
      if (!config.email.smtp.auth.pass) {
        throw new Error('SMTP_PASS must be set when EMAIL_PROVIDER is smtp');
      }
    }

    // Validate SendGrid configuration when provider is sendgrid
    if (config.email.provider === 'sendgrid') {
      if (!config.email.sendgrid.apiKey) {
        throw new Error('SENDGRID_API_KEY must be set when EMAIL_PROVIDER is sendgrid');
      }
      if (!config.email.sendgrid.apiKey.startsWith('SG.')) {
        throw new Error('SENDGRID_API_KEY must start with "SG." prefix');
      }
    }

    // Validate SES configuration when provider is ses
    if (config.email.provider === 'ses') {
      if (!config.email.ses.accessKeyId) {
        throw new Error('SES_ACCESS_KEY_ID must be set when EMAIL_PROVIDER is ses');
      }
      if (!config.email.ses.secretAccessKey) {
        throw new Error('SES_SECRET_ACCESS_KEY must be set when EMAIL_PROVIDER is ses');
      }
    }

    // Validate default email settings
    if (!process.env.EMAIL_FROM_ADDRESS) {
      throw new Error('EMAIL_FROM_ADDRESS must be set in production environment');
    }

    // Validate FRONTEND_URL for email links
    if (!process.env.FRONTEND_URL) {
      throw new Error('FRONTEND_URL must be set in production for email links');
    }

    // Caveat: registration domain restriction is a coarse tenant gate, not
    // email verification. Warn (non-fatal) when enabled in production.
    if (config.registration.isRestricted) {
      logDeferred(
        'warn',
        'REGISTRATION_ALLOWED_EMAIL_DOMAINS is set. Note this is a tenant-control gate, ' +
          'not an email-verification or identity-proof mechanism.'
      );
    }
  }

  // Validate email retry configuration
  if (config.email.retry.maxAttempts < 1 || config.email.retry.maxAttempts > 10) {
    throw new Error('EMAIL_RETRY_MAX_ATTEMPTS must be between 1 and 10');
  }

  if (config.email.retry.backoffMs < 100) {
    throw new Error('EMAIL_RETRY_BACKOFF_MS must be at least 100ms');
  }

  if (config.email.retry.maxBackoffMs < config.email.retry.backoffMs) {
    throw new Error(
      'EMAIL_RETRY_MAX_BACKOFF_MS must be greater than or equal to EMAIL_RETRY_BACKOFF_MS'
    );
  }

  // Validate email retention configuration
  if (config.email.retention.successfulDays < 0) {
    throw new Error('EMAIL_RETENTION_SUCCESSFUL_DAYS must be a non-negative integer');
  }

  if (config.email.retention.failedDays < 0) {
    throw new Error('EMAIL_RETENTION_FAILED_DAYS must be a non-negative integer');
  }

  if (config.email.retention.bouncedDays < 0) {
    throw new Error('EMAIL_RETENTION_BOUNCED_DAYS must be a non-negative integer');
  }

  // Validate email circuit breaker configuration
  if (config.email.circuitBreaker.failureThreshold <= 0) {
    throw new Error('EMAIL_CIRCUIT_BREAKER_FAILURE_THRESHOLD must be a positive integer');
  }

  if (config.email.circuitBreaker.resetTimeoutMs < 1000) {
    throw new Error('EMAIL_CIRCUIT_BREAKER_RESET_TIMEOUT_MS must be at least 1000ms');
  }

  // Validate SMTP rate limit configuration
  if (config.email.smtp.rateLimit.enabled) {
    if (config.email.smtp.rateLimit.maxMessages <= 0) {
      throw new Error(
        'SMTP_RATE_LIMIT_MAX_MESSAGES must be a positive integer when rate limiting is enabled'
      );
    }
    if (config.email.smtp.rateLimit.windowMs < 1000) {
      throw new Error(
        'SMTP_RATE_LIMIT_WINDOW_MS must be at least 1000ms when rate limiting is enabled'
      );
    }
  }
};

export { BACKLOG_CONFIG, isBacklogLimitEnabled } from './backlog.config.js';

export default config;
