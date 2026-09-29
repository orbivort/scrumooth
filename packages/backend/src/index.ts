// Main Entry Point
import net from 'node:net';

import app from './app';
import config, { validateConfig } from './config';
import prisma, { disconnectPrisma } from './utils/prisma';
import { logger } from './utils/logger';
import { startNotificationCleanup } from './jobs/notificationCleanup';
import { startDeletionGracePeriodJob } from './jobs/deletionGracePeriodJob';
import { startImpedimentEscalationJob } from './jobs/impedimentEscalationJob';
import { authService } from './services/auth.service';
import { eventLoopMonitor } from './utils/eventLoopMonitor';
import { i18nInitPromise } from './i18n/config.js';

// Validate configuration
validateConfig();

// Start scheduled jobs
startNotificationCleanup();
startDeletionGracePeriodJob();
startImpedimentEscalationJob();

// Initialize auth service (starts cleanup job)
authService.initialize();

// Add prisma to request
app.use((req, _res, next) => {
  req.prisma = prisma;
  next();
});

// Check if port is already in use
const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      })
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
};

// Start server
const startServer = async () => {
  // Ensure i18n is initialized before accepting requests
  await i18nInitPromise;
  logger.info('i18n initialized');

  // Check port availability first
  const isAvailable = await checkPortAvailable(config.port);
  if (!isAvailable) {
    logger.error(
      `Port ${config.port} is already in use. ` +
        `Please check if another instance of the server is running or if another service (like Docker/WSL) is using this port. ` +
        `You can change the port by setting the PORT environment variable in your .env file.`
    );
    process.exit(1);
  }

  const server = app.listen(config.port, async () => {
    try {
      // Test database connection
      await prisma.$connect();
      logger.info('Connected to database');

      logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
      logger.info(`API available at http://localhost:${config.port}${config.apiPrefix}/v1`);
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      process.exit(1);
    }
  });

  return server;
};

// Start server and store reference
let server: ReturnType<typeof app.listen> | null = null;

const serverPromise = startServer().then((s) => {
  server = s;
  return s;
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  eventLoopMonitor.stop();

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectPrisma();
      process.exit(0);
    });
  } else {
    await disconnectPrisma();
    process.exit(0);
  }

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

export default serverPromise;
