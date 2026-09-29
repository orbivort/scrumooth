import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dotenv', () => ({
  default: {
    config: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
  },
}));

vi.mock('node:crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'a'.repeat(128)),
    })),
  },
}));

// The logger is imported dynamically inside config/index.ts; mocking it lets us control both the
// success and the failure (`.catch`) replay paths.
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
}));

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('config object', () => {
    it('should have default server configuration', async () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.API_PREFIX;

      const { config } = await import('../../../config');

      expect(config.nodeEnv).toBe('development');
      expect(config.port).toBe(5000);
      expect(config.apiPrefix).toBe('/api');
    });

    it('should use environment variables for server config', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.API_PREFIX = '/api/v2';

      const { config } = await import('../../../config');

      expect(config.nodeEnv).toBe('production');
      expect(config.port).toBe(3000);
      expect(config.apiPrefix).toBe('/api/v2');
    });

    it('should have default JWT configuration', async () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRES_IN;
      delete process.env.JWT_REFRESH_EXPIRES_IN;

      const { config } = await import('../../../config');

      expect(config.jwt.secret).toBeDefined();
      expect(config.jwt.secret.length).toBeGreaterThanOrEqual(64);
      expect(config.jwt.expiresIn).toBe('15m');
      expect(config.jwt.refreshExpiresIn).toBe('7d');
    });

    it('should use custom JWT configuration from env', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.JWT_EXPIRES_IN = '30m';
      process.env.JWT_REFRESH_EXPIRES_IN = '14d';

      const { config } = await import('../../../config');

      expect(config.jwt.secret).toBe('a'.repeat(64));
      expect(config.jwt.expiresIn).toBe('30m');
      expect(config.jwt.refreshExpiresIn).toBe('14d');
    });

    it('should have default session configuration', async () => {
      delete process.env.SESSION_IDLE_TIMEOUT_MS;
      delete process.env.SESSION_ABSOLUTE_TIMEOUT_MS;
      delete process.env.SESSION_WARNING_THRESHOLD_MS;
      delete process.env.SESSION_CLEANUP_INTERVAL_MS;
      delete process.env.MAX_CONCURRENT_SESSIONS;

      const { config } = await import('../../../config');

      expect(config.session.idleTimeoutMs).toBe(1800000);
      expect(config.session.absoluteTimeoutMs).toBe(86400000);
      expect(config.session.warningThresholdMs).toBe(120000);
      expect(config.session.cleanupIntervalMs).toBe(3600000);
      expect(config.session.maxConcurrentSessions).toBe(5);
    });

    it('should have default bcrypt configuration', async () => {
      delete process.env.BCRYPT_SALT_ROUNDS;

      const { config } = await import('../../../config');

      expect(config.bcrypt.saltRounds).toBe(12);
    });

    it('should have default token hash configuration', async () => {
      delete process.env.TOKEN_HASH_ALGORITHM;

      const { config } = await import('../../../config');

      expect(config.tokenHash.algorithm).toBe('sha256');
    });

    it('should have default rate limiting configuration', async () => {
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;

      const { config } = await import('../../../config');

      expect(config.rateLimit.windowMs).toBe(900000);
      expect(config.rateLimit.max).toBe(100);
    });

    it('should have default CORS configuration', async () => {
      delete process.env.CORS_ORIGIN;

      const { config } = await import('../../../config');

      expect(config.cors.origin).toEqual(['http://localhost:5173']);
    });

    it('should parse CORS_ORIGIN as comma-separated list', async () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000, http://example.com,https://api.example.com';

      const { config } = await import('../../../config');

      expect(config.cors.origin).toEqual([
        'http://localhost:3000',
        'http://example.com',
        'https://api.example.com',
      ]);
    });

    it('should have default logging configuration', async () => {
      delete process.env.LOG_LEVEL;
      delete process.env.LOG_DIR;
      delete process.env.LOG_MAX_FILES;
      delete process.env.LOG_MAX_SIZE;
      delete process.env.LOG_FORMAT;
      delete process.env.NODE_ENV;

      const { config } = await import('../../../config');

      expect(config.logging.level).toBe('debug');
      expect(config.logging.directory).toBe('logs');
      expect(config.logging.maxFiles).toBe('14d');
      expect(config.logging.maxSize).toBe('20m');
      expect(config.logging.format).toBe('json');
    });

    it('should use info log level in production by default', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;

      const { config } = await import('../../../config');

      expect(config.logging.level).toBe('info');
    });

    it('should have default notification configuration', async () => {
      delete process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS;
      delete process.env.NOTIFICATION_RETENTION_DAYS;
      delete process.env.NOTIFICATION_CLEANUP_CRON;
      delete process.env.NOTIFICATION_MAX_PAGE_SIZE;

      const { config } = await import('../../../config');

      expect(config.notification.pollingIntervalMs).toBe(5000);
      expect(config.notification.retentionDays).toBe(30);
      expect(config.notification.cleanupCron).toBe('0 2 * * *');
      expect(config.notification.maxPageSize).toBe(50);
    });

    it('should enforce minimum notification polling interval of 1 second', async () => {
      process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS = '0';

      const { config } = await import('../../../config');

      expect(config.notification.pollingIntervalMs).toBe(1000);
    });

    it('should enforce minimum notification max page size of 10', async () => {
      process.env.NOTIFICATION_MAX_PAGE_SIZE = '5';

      const { config } = await import('../../../config');

      expect(config.notification.maxPageSize).toBe(10);
    });

    it('should enforce maximum notification max page size of 100', async () => {
      process.env.NOTIFICATION_MAX_PAGE_SIZE = '200';

      const { config } = await import('../../../config');

      expect(config.notification.maxPageSize).toBe(100);
    });

    it('should have default team configuration', async () => {
      delete process.env.TEAM_MAX_SIZE;

      const { config } = await import('../../../config');

      expect(config.team.maxSize).toBe(10);
    });

    it('should use TEAM_MAX_SIZE env var for team config', async () => {
      process.env.TEAM_MAX_SIZE = '8';

      const { config } = await import('../../../config');

      expect(config.team.maxSize).toBe(8);
    });

    it('should have default event loop monitoring configuration', async () => {
      delete process.env.EVENT_LOOP_MONITORING_ENABLED;
      delete process.env.EVENT_LOOP_RESOLUTION;
      delete process.env.EVENT_LOOP_WARN_THRESHOLD;
      delete process.env.EVENT_LOOP_CRITICAL_THRESHOLD;

      const { config } = await import('../../../config');

      expect(config.eventLoop.resolution).toBe(10);
      expect(config.eventLoop.warnThreshold).toBe(100);
      expect(config.eventLoop.criticalThreshold).toBe(500);
    });

    it('should enable event loop monitoring by default in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.EVENT_LOOP_MONITORING_ENABLED;

      const { config } = await import('../../../config');

      expect(config.eventLoop.enabled).toBe(true);
    });

    it('should disable event loop monitoring by default in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.EVENT_LOOP_MONITORING_ENABLED;

      const { config } = await import('../../../config');

      expect(config.eventLoop.enabled).toBe(false);
    });

    it('should respect EVENT_LOOP_MONITORING_ENABLED env var', async () => {
      process.env.EVENT_LOOP_MONITORING_ENABLED = 'false';
      process.env.NODE_ENV = 'production';

      const { config } = await import('../../../config');

      expect(config.eventLoop.enabled).toBe(false);
    });

    it('should have default health check configuration', async () => {
      delete process.env.HEALTH_CHECK_DATABASE_TIMEOUT;

      const { config } = await import('../../../config');

      expect(config.healthCheck.databaseTimeout).toBe(5000);
    });

    it('should have default deletion configuration', async () => {
      const { config } = await import('../../../config');

      expect(config.deletion.scheduleConfirmationPhrase).toBe('SCHEDULE DELETION');
      expect(config.deletion.gracePeriodDays).toBe(14);
    });

    it('should have default database transaction configuration', async () => {
      delete process.env.DB_TRANSACTION_START_SPRINT_MAX_WAIT;
      delete process.env.DB_TRANSACTION_START_SPRINT_TIMEOUT;
      delete process.env.DB_TRANSACTION_START_SPRINT_RETRIES;
      delete process.env.DB_TRANSACTION_MAX_WAIT;
      delete process.env.DB_TRANSACTION_TIMEOUT;
      delete process.env.DB_TRANSACTION_RETRIES;
      delete process.env.DB_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
      delete process.env.DB_CIRCUIT_BREAKER_RESET_TIMEOUT_MS;

      const { config } = await import('../../../config');

      expect(config.database.transaction.startSprint.maxWait).toBe(5000);
      expect(config.database.transaction.startSprint.timeout).toBe(15000);
      expect(config.database.transaction.startSprint.retries).toBe(2);
      expect(config.database.transaction.default.maxWait).toBe(5000);
      expect(config.database.transaction.default.timeout).toBe(10000);
      expect(config.database.transaction.default.retries).toBe(2);
      expect(config.database.circuitBreaker.failureThreshold).toBe(5);
      expect(config.database.circuitBreaker.resetTimeoutMs).toBe(60000);
    });
  });

  describe('validateConfig', () => {
    it('should throw error when DATABASE_URL is missing', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'Missing required environment variables: DATABASE_URL, JWT_SECRET'
      );
    });

    it('should throw error when JWT_SECRET is missing', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      delete process.env.JWT_SECRET;

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow('Missing required environment variables: JWT_SECRET');
    });

    it('should not throw when all required env vars are set', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(64);

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw error when TEAM_MAX_SIZE is less than 1', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.TEAM_MAX_SIZE = '0';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow('TEAM_MAX_SIZE must be a positive integer');
    });
  });

  describe('production validations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:strongpassword@localhost:5432/db';
      process.env.CORS_ORIGIN = 'https://example.com';
    });

    const weakSecrets = [
      'your-super-secret-jwt-key',
      'secret',
      'password',
      'jwt-secret',
      'changeme',
      '123456',
      'dev-secret-key-not-for-production',
      'test-secret-key-for-integration-tests-only-not-for-production',
    ];

    weakSecrets.forEach((weakSecret) => {
      it(`should throw error for weak JWT_SECRET: "${weakSecret}"`, async () => {
        process.env.JWT_SECRET = weakSecret;

        const { validateConfig } = await import('../../../config');

        expect(() => validateConfig()).toThrow(
          'JWT_SECRET must be changed from default value in production'
        );
      });
    });

    it('should throw error when JWT_SECRET is less than 64 characters in production', async () => {
      process.env.JWT_SECRET = 'a'.repeat(63);

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'JWT_SECRET must be at least 64 characters in production'
      );
    });

    it('should accept JWT_SECRET with 64 or more characters in production', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';
      process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';
      process.env.FRONTEND_URL = 'https://example.com';
      process.env.EMAIL_TEST_MODE = 'false';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });

    const weakPasswords = ['password', 'postgres', 'admin', 'root', '123456', 'changeme', 'test'];

    weakPasswords.forEach((weakPassword) => {
      it(`should throw error for weak password in DATABASE_URL: "${weakPassword}"`, async () => {
        process.env.JWT_SECRET = 'a'.repeat(64);
        process.env.DATABASE_URL = `postgresql://user:${weakPassword}@localhost:5432/db`;

        const { validateConfig } = await import('../../../config');

        expect(() => validateConfig()).toThrow(
          `DATABASE_URL contains a weak password '${weakPassword}'`
        );
      });
    });

    it('should throw error when CORS_ORIGIN contains localhost in production', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.CORS_ORIGIN = 'http://localhost:3000';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'CORS_ORIGIN contains localhost/127.0.0.1 (http://localhost:3000)'
      );
    });

    it('should throw error when CORS_ORIGIN contains 127.0.0.1 in production', async () => {
      process.env.JWT_SECRET = 'a'.repeat(64);
      process.env.CORS_ORIGIN = 'http://127.0.0.1:3000';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'CORS_ORIGIN contains localhost/127.0.0.1 (http://127.0.0.1:3000)'
      );
    });

    it('should not apply production validations in development mode', async () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'secret';
      process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/db';
      process.env.CORS_ORIGIN = 'http://localhost:3000';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('notification configuration validation', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(64);
    });

    it('should accept zero retention days (disables cleanup)', async () => {
      process.env.NOTIFICATION_RETENTION_DAYS = '0';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });

    it('should accept valid notification max page size', async () => {
      process.env.NOTIFICATION_MAX_PAGE_SIZE = '25';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('event loop monitoring configuration validation', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(64);
    });

    it('should throw error when event loop resolution is not positive', async () => {
      process.env.EVENT_LOOP_RESOLUTION = '0';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow('EVENT_LOOP_RESOLUTION must be a positive integer');
    });

    it('should throw error when event loop resolution is negative', async () => {
      process.env.EVENT_LOOP_RESOLUTION = '-10';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow('EVENT_LOOP_RESOLUTION must be a positive integer');
    });

    it('should throw error when event loop warn threshold is not positive', async () => {
      process.env.EVENT_LOOP_WARN_THRESHOLD = '0';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'EVENT_LOOP_WARN_THRESHOLD must be a positive integer'
      );
    });

    it('should throw error when event loop critical threshold is not positive', async () => {
      process.env.EVENT_LOOP_CRITICAL_THRESHOLD = '0';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'EVENT_LOOP_CRITICAL_THRESHOLD must be a positive integer'
      );
    });

    it('should throw error when warn threshold >= critical threshold', async () => {
      process.env.EVENT_LOOP_WARN_THRESHOLD = '500';
      process.env.EVENT_LOOP_CRITICAL_THRESHOLD = '500';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'EVENT_LOOP_WARN_THRESHOLD must be less than EVENT_LOOP_CRITICAL_THRESHOLD'
      );
    });

    it('should throw error when warn threshold > critical threshold', async () => {
      process.env.EVENT_LOOP_WARN_THRESHOLD = '600';
      process.env.EVENT_LOOP_CRITICAL_THRESHOLD = '500';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'EVENT_LOOP_WARN_THRESHOLD must be less than EVENT_LOOP_CRITICAL_THRESHOLD'
      );
    });

    it('should accept valid event loop configuration', async () => {
      process.env.EVENT_LOOP_RESOLUTION = '10';
      process.env.EVENT_LOOP_WARN_THRESHOLD = '100';
      process.env.EVENT_LOOP_CRITICAL_THRESHOLD = '500';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('health check configuration validation', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.JWT_SECRET = 'a'.repeat(64);
    });

    it('should throw error when health check database timeout is not positive', async () => {
      process.env.HEALTH_CHECK_DATABASE_TIMEOUT = '0';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'HEALTH_CHECK_DATABASE_TIMEOUT must be a positive integer'
      );
    });

    it('should throw error when health check database timeout is negative', async () => {
      process.env.HEALTH_CHECK_DATABASE_TIMEOUT = '-1000';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).toThrow(
        'HEALTH_CHECK_DATABASE_TIMEOUT must be a positive integer'
      );
    });

    it('should accept valid health check configuration', async () => {
      process.env.HEALTH_CHECK_DATABASE_TIMEOUT = '5000';

      const { validateConfig } = await import('../../../config');

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('replayDeferredLogs', () => {
    it('should export replayDeferredLogs function', async () => {
      const { replayDeferredLogs } = await import('../../../config');

      expect(replayDeferredLogs).toBeDefined();
      expect(typeof replayDeferredLogs).toBe('function');
    });

    it('should not throw when called', async () => {
      const { replayDeferredLogs } = await import('../../../config');

      expect(() => replayDeferredLogs()).not.toThrow();
    });
  });

  describe('extended coverage', () => {
    const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

    const setRequiredEnv = (): void => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/app';
      process.env.JWT_SECRET = 'a'.repeat(64);
      delete process.env.NODE_ENV;
    };

    const setValidProductionEnv = (): void => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:StrongP@ssw0rd!@db.example.com:5432/app';
      process.env.JWT_SECRET = 'a'.repeat(80);
      process.env.CORS_ORIGIN = 'https://app.example.com';
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'mailer@example.com';
      process.env.SMTP_PASS = 'smtp-secret';
      process.env.EMAIL_FROM_ADDRESS = 'noreply@example.com';
      process.env.FRONTEND_URL = 'https://app.example.com';
      process.env.EMAIL_TEST_MODE = 'false';
    };

    describe('registration allowed email domains', () => {
      it('returns an empty list when the env var is unset', async () => {
        // Arrange
        setRequiredEnv();
        delete process.env.REGISTRATION_ALLOWED_EMAIL_DOMAINS;

        // Act
        const { config } = await import('../../../config');

        // Assert
        expect(config.registration.allowedEmailDomains).toEqual([]);
        expect(config.registration.isRestricted).toBe(false);
      });

      it('deduplicates and warns on duplicate domains', async () => {
        // Arrange
        setRequiredEnv();
        process.env.REGISTRATION_ALLOWED_EMAIL_DOMAINS = 'acme.com, ACME.com ,acme.eu';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        // Act
        const { config } = await import('../../../config');

        // Assert
        expect(config.registration.allowedEmailDomains).toEqual(['acme.com', 'acme.eu']);
        expect(config.registration.isRestricted).toBe(true);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate entries'));
        warnSpy.mockRestore();
      });

      it('throws for an invalid registration domain', async () => {
        // Arrange
        setRequiredEnv();
        process.env.REGISTRATION_ALLOWED_EMAIL_DOMAINS = 'Invalid_Domain';

        // Act
        const { validateConfig } = await import('../../../config');

        // Assert
        expect(() => validateConfig()).toThrow('contains an invalid domain');
      });
    });

    describe('replayDeferredLogs', () => {
      it('replays queued messages through logger.log', async () => {
        // Arrange
        setRequiredEnv();
        delete process.env.JWT_SECRET;
        const { logger } = await import('../../../utils/logger.js');
        const logMock = logger.log as unknown as ReturnType<typeof vi.fn>;
        const { replayDeferredLogs } = await import('../../../config');

        // Act
        replayDeferredLogs();
        await flush();

        // Assert
        expect(logMock).toHaveBeenCalled();
      });

      it('swallows errors raised while replaying', async () => {
        // Arrange
        setRequiredEnv();
        delete process.env.JWT_SECRET;
        const { logger } = await import('../../../utils/logger.js');
        const logMock = logger.log as unknown as ReturnType<typeof vi.fn>;
        logMock.mockImplementation(() => {
          throw new Error('logger exploded');
        });
        const { replayDeferredLogs } = await import('../../../config');

        // Act & Assert
        expect(() => replayDeferredLogs()).not.toThrow();
        await flush();
        logMock.mockReset();
      });
    });

    describe('backlog config', () => {
      it('defaults the max items per goal when the env var is unset', async () => {
        // Arrange
        delete process.env.BACKLOG_MAX_ITEMS_PER_GOAL;

        // Act
        const { BACKLOG_CONFIG, isBacklogLimitEnabled } =
          await import('../../../config/backlog.config');

        // Assert
        expect(BACKLOG_CONFIG.MAX_ITEMS_PER_GOAL).toBe(200);
        expect(isBacklogLimitEnabled()).toBe(true);
      });

      it('uses the configured max items per goal and disables the limit at zero', async () => {
        // Arrange
        process.env.BACKLOG_MAX_ITEMS_PER_GOAL = '0';

        // Act
        const { BACKLOG_CONFIG, isBacklogLimitEnabled } =
          await import('../../../config/backlog.config');

        // Assert
        expect(BACKLOG_CONFIG.MAX_ITEMS_PER_GOAL).toBe(0);
        expect(isBacklogLimitEnabled()).toBe(false);
      });
    });

    describe('email default fallbacks', () => {
      it('uses defaults when the email env vars are unset', async () => {
        // Arrange
        setRequiredEnv();
        for (const key of [
          'EMAIL_PROVIDER',
          'FRONTEND_URL',
          'EMAIL_TEST_OUTPUT_DIR',
          'SMTP_HOST',
          'SMTP_PORT',
          'SMTP_USER',
          'SMTP_PASS',
          'SMTP_MAX_CONNECTIONS',
          'SMTP_RATE_LIMIT_MAX_MESSAGES',
          'SMTP_RATE_LIMIT_WINDOW_MS',
          'EMAIL_FROM_NAME',
          'EMAIL_FROM_ADDRESS',
        ]) {
          delete process.env[key];
        }

        // Act
        const { config } = await import('../../../config');

        // Assert
        expect(config.email.provider).toBe('smtp');
        expect(config.email.frontendUrl).toBe('http://localhost:5173');
        expect(config.email.testMode.outputDirectory).toBe('logs/test-emails');
        expect(config.email.smtp.host).toBe('localhost');
        expect(config.email.smtp.port).toBe(587);
        expect(config.email.smtp.auth.user).toBe('');
        expect(config.email.smtp.auth.pass).toBe('');
        expect(config.email.smtp.maxConnections).toBe(5);
        expect(config.email.smtp.rateLimit.maxMessages).toBe(100);
        expect(config.email.smtp.rateLimit.windowMs).toBe(60000);
        expect(config.email.defaults.fromName).toBe('Scrumooth');
        expect(config.email.defaults.fromAddress).toBe('noreply@scrumooth.local');
      });
    });

    describe('notification warnings with the logger available', () => {
      it('warns for a long polling interval and zero retention', async () => {
        // Arrange
        setRequiredEnv();
        process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS = '120';
        process.env.NOTIFICATION_RETENTION_DAYS = '0';
        const { logger } = await import('../../../utils/logger.js');
        const warnMock = logger.warn as unknown as ReturnType<typeof vi.fn>;
        const { validateConfig } = await import('../../../config');

        // Act
        validateConfig();
        await flush();

        // Assert
        expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('more than 60 seconds'));
        expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('is set to 0'));
      });

      it('warns for a retention longer than a year', async () => {
        // Arrange
        setRequiredEnv();
        process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS = '5';
        process.env.NOTIFICATION_RETENTION_DAYS = '400';
        const { logger } = await import('../../../utils/logger.js');
        const warnMock = logger.warn as unknown as ReturnType<typeof vi.fn>;
        const { validateConfig } = await import('../../../config');

        // Act
        validateConfig();
        await flush();

        // Assert
        expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('more than 1 year'));
      });
    });

    describe('notification warnings with the logger unavailable', () => {
      it('falls back to deferred logging for a long interval and zero retention', async () => {
        // Arrange
        setRequiredEnv();
        process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS = '120';
        process.env.NOTIFICATION_RETENTION_DAYS = '0';
        const { logger } = await import('../../../utils/logger.js');
        const warnMock = logger.warn as unknown as ReturnType<typeof vi.fn>;
        warnMock.mockImplementation(() => {
          throw new Error('logger unavailable');
        });
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { validateConfig } = await import('../../../config');

        // Act
        validateConfig();
        await flush();

        // Assert
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('more than 60 seconds')
        );
        consoleWarnSpy.mockRestore();
        warnMock.mockReset();
      });

      it('falls back to deferred logging for a retention longer than a year', async () => {
        // Arrange
        setRequiredEnv();
        process.env.NOTIFICATION_POLLING_INTERVAL_SECONDS = '5';
        process.env.NOTIFICATION_RETENTION_DAYS = '400';
        const { logger } = await import('../../../utils/logger.js');
        const warnMock = logger.warn as unknown as ReturnType<typeof vi.fn>;
        warnMock.mockImplementation(() => {
          throw new Error('logger unavailable');
        });
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { validateConfig } = await import('../../../config');

        // Act
        validateConfig();
        await flush();

        // Assert
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('more than 1 year'));
        consoleWarnSpy.mockRestore();
        warnMock.mockReset();
      });
    });

    describe('non-production guard clauses', () => {
      it('rejects a non-numeric impediment escalation threshold', async () => {
        setRequiredEnv();
        process.env.IMPEDIMENT_ESCALATION_THRESHOLD_DAYS = 'abc';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'IMPEDIMENT_ESCALATION_THRESHOLD_DAYS must be a positive integer'
        );
      });

      it('rejects a non-numeric sprint capacity tolerance', async () => {
        setRequiredEnv();
        process.env.SPRINT_CAPACITY_TOLERANCE_PCT = 'abc';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'SPRINT_CAPACITY_TOLERANCE_PCT must be a non-negative number'
        );
      });

      it('rejects an out-of-range email retry attempt count', async () => {
        setRequiredEnv();
        process.env.EMAIL_RETRY_MAX_ATTEMPTS = '0';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('EMAIL_RETRY_MAX_ATTEMPTS must be between 1 and 10');
      });

      it('rejects an email retry backoff under 100ms', async () => {
        setRequiredEnv();
        process.env.EMAIL_RETRY_BACKOFF_MS = '50';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('EMAIL_RETRY_BACKOFF_MS must be at least 100ms');
      });

      it('rejects a max backoff smaller than the backoff', async () => {
        setRequiredEnv();
        process.env.EMAIL_RETRY_BACKOFF_MS = '1000';
        process.env.EMAIL_RETRY_MAX_BACKOFF_MS = '500';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'EMAIL_RETRY_MAX_BACKOFF_MS must be greater than or equal to EMAIL_RETRY_BACKOFF_MS'
        );
      });

      it('rejects negative successful-email retention days', async () => {
        setRequiredEnv();
        process.env.EMAIL_RETENTION_SUCCESSFUL_DAYS = '-1';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'EMAIL_RETENTION_SUCCESSFUL_DAYS must be a non-negative integer'
        );
      });

      it('rejects negative failed-email retention days', async () => {
        setRequiredEnv();
        process.env.EMAIL_RETENTION_FAILED_DAYS = '-1';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'EMAIL_RETENTION_FAILED_DAYS must be a non-negative integer'
        );
      });

      it('rejects negative bounced-email retention days', async () => {
        setRequiredEnv();
        process.env.EMAIL_RETENTION_BOUNCED_DAYS = '-1';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'EMAIL_RETENTION_BOUNCED_DAYS must be a non-negative integer'
        );
      });

      it('rejects a non-positive email circuit breaker failure threshold', async () => {
        setRequiredEnv();
        process.env.EMAIL_CIRCUIT_BREAKER_FAILURE_THRESHOLD = '0';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'EMAIL_CIRCUIT_BREAKER_FAILURE_THRESHOLD must be a positive integer'
        );
      });

      it('rejects an email circuit breaker reset timeout under 1000ms', async () => {
        setRequiredEnv();
        process.env.EMAIL_CIRCUIT_BREAKER_RESET_TIMEOUT_MS = '500';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'EMAIL_CIRCUIT_BREAKER_RESET_TIMEOUT_MS must be at least 1000ms'
        );
      });

      it('rejects a non-positive SMTP rate limit when enabled', async () => {
        setRequiredEnv();
        process.env.SMTP_RATE_LIMIT_ENABLED = 'true';
        process.env.SMTP_RATE_LIMIT_MAX_MESSAGES = '0';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'SMTP_RATE_LIMIT_MAX_MESSAGES must be a positive integer when rate limiting is enabled'
        );
      });

      it('rejects a SMTP rate limit window under 1000ms when enabled', async () => {
        setRequiredEnv();
        process.env.SMTP_RATE_LIMIT_ENABLED = 'true';
        process.env.SMTP_RATE_LIMIT_MAX_MESSAGES = '100';
        process.env.SMTP_RATE_LIMIT_WINDOW_MS = '500';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow(
          'SMTP_RATE_LIMIT_WINDOW_MS must be at least 1000ms when rate limiting is enabled'
        );
      });

      it('accepts a valid SMTP rate limit configuration when enabled', async () => {
        setRequiredEnv();
        process.env.SMTP_RATE_LIMIT_ENABLED = 'true';
        process.env.SMTP_RATE_LIMIT_MAX_MESSAGES = '100';
        process.env.SMTP_RATE_LIMIT_WINDOW_MS = '60000';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).not.toThrow();
      });
    });

    describe('production email validation', () => {
      it('rejects email test mode in production', async () => {
        setValidProductionEnv();
        process.env.EMAIL_TEST_MODE = 'true';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('EMAIL_TEST_MODE cannot be enabled in production');
      });

      it('requires EMAIL_PROVIDER in production', async () => {
        setValidProductionEnv();
        delete process.env.EMAIL_PROVIDER;
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('EMAIL_PROVIDER must be set in production');
      });

      it('rejects an unknown EMAIL_PROVIDER in production', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'carrier-pigeon';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('EMAIL_PROVIDER must be one of');
      });

      it('requires SMTP_HOST when the provider is smtp', async () => {
        setValidProductionEnv();
        process.env.SMTP_HOST = '';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SMTP_HOST must be set');
      });

      it('rejects an invalid SMTP port', async () => {
        setValidProductionEnv();
        process.env.SMTP_PORT = '70000';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SMTP_PORT must be a valid port number');
      });

      it('requires SMTP_USER when the provider is smtp', async () => {
        setValidProductionEnv();
        process.env.SMTP_USER = '';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SMTP_USER must be set');
      });

      it('requires SMTP_PASS when the provider is smtp', async () => {
        setValidProductionEnv();
        process.env.SMTP_PASS = '';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SMTP_PASS must be set');
      });

      it('accepts a valid sendgrid configuration', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'sendgrid';
        process.env.SENDGRID_API_KEY = 'SG.abc123';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).not.toThrow();
      });

      it('requires SENDGRID_API_KEY when the provider is sendgrid', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'sendgrid';
        delete process.env.SENDGRID_API_KEY;
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SENDGRID_API_KEY must be set');
      });

      it('requires the SG. prefix on SENDGRID_API_KEY', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'sendgrid';
        process.env.SENDGRID_API_KEY = 'not-sg';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SENDGRID_API_KEY must start with');
      });

      it('accepts a valid SES configuration', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'ses';
        process.env.SES_ACCESS_KEY_ID = 'AKIAEXAMPLE';
        process.env.SES_SECRET_ACCESS_KEY = 'secret';
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).not.toThrow();
      });

      it('requires SES_ACCESS_KEY_ID when the provider is ses', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'ses';
        delete process.env.SES_ACCESS_KEY_ID;
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SES_ACCESS_KEY_ID must be set');
      });

      it('requires SES_SECRET_ACCESS_KEY when the provider is ses', async () => {
        setValidProductionEnv();
        process.env.EMAIL_PROVIDER = 'ses';
        process.env.SES_ACCESS_KEY_ID = 'AKIAEXAMPLE';
        delete process.env.SES_SECRET_ACCESS_KEY;
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('SES_SECRET_ACCESS_KEY must be set');
      });

      it('requires EMAIL_FROM_ADDRESS in production', async () => {
        setValidProductionEnv();
        delete process.env.EMAIL_FROM_ADDRESS;
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('EMAIL_FROM_ADDRESS must be set in production');
      });

      it('requires FRONTEND_URL in production for email links', async () => {
        setValidProductionEnv();
        delete process.env.FRONTEND_URL;
        const { validateConfig } = await import('../../../config');
        expect(() => validateConfig()).toThrow('FRONTEND_URL must be set in production');
      });
    });
  });
});
