// Express Application Setup
import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import config from './config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import teamRoutes from './routes/team.routes';
import backlogRoutes from './routes/backlog.routes';
import sprintRoutes from './routes/sprint.routes';
import goalsRoutes from './routes/goals.routes';
import workflowRoutes from './routes/workflow.routes';
import sprintConfigurationRoutes from './routes/sprintConfiguration.routes';
import dailyScrumRoutes from './routes/dailyScrum.routes';
import dailyScrumScheduleRoutes from './routes/dailyScrumSchedule.routes';
import incrementRoutes from './routes/increment.routes';
import sprintReviewRoutes from './routes/sprintReview.routes';
import retrospectiveRoutes from './routes/retrospective.routes';
import impedimentRoutes from './routes/impediment.routes';
import healthCheckRoutes from './routes/healthCheck.routes';
import smDashboardRoutes from './routes/smDashboard.routes';
import reportsRoutes from './routes/reports.routes';
import notificationRoutes from './routes/notification.routes';
import configRoutes from './routes/config.routes';
import dataExportRoutes from './routes/dataExport.routes';
import consentRoutes from './routes/consent.routes';
import timeboxRoutes from './routes/timebox.routes';
import { requestLogger } from './middleware/requestLogger.middleware';
import { requestId } from './middleware/requestId.middleware';
import { localeResolver } from './middleware/locale.middleware.js';
import { contextMiddleware } from './middleware/context.middleware';
import { csrfProtectionMiddleware, ensureCsrfToken } from './middleware/csrf.middleware';
import { versionMiddleware } from './middleware/version.middleware';
import { eventLoopMonitor } from './utils/eventLoopMonitor';
import { checkHealth } from './utils/prisma';
import { i18nInstance } from './i18n/config.js';

const app: Application = express();

// Trust proxy - required when behind reverse proxy (Caddy/nginx)
// This allows express-rate-limit to correctly identify client IP from X-Forwarded-For header
app.set('trust proxy', true);

if (config.eventLoop.enabled) {
  eventLoopMonitor.start();
}

app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser for httpOnly cookies
app.use(cookieParser());

app.use(compression());

app.use(requestId);

// Initialize request context for AsyncLocalStorage
// This must come after requestId middleware
app.use(contextMiddleware);

// API version detection and validation
app.use(versionMiddleware);

// Rate limiting (disabled in test environment)
// Security: Applied to API routes to prevent brute force attacks, DoS attacks,
// and resource exhaustion from API abuse.
// Excludes /health endpoint to ensure monitoring systems can always check service health
// without being rate-limited, preventing false-positive health check failures.
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Apply only to API routes, not health checks or other non-API endpoints
  app.use('/api/', limiter);
}

// Security: CSRF middleware applied after rate limiting for performance optimization.
// Rate limiting rejects abusive requests early before expensive HMAC operations
// used in CSRF token validation, reducing computational overhead.
// Ensure CSRF token cookie is set for all requests
app.use(ensureCsrfToken);

// Enforce CSRF protection for state-changing requests (POST, PUT, DELETE, PATCH)
// This must come after cookie parser and before routes
app.use(csrfProtectionMiddleware);

// Request logging
app.use(requestLogger);

// Locale resolution (must be after contextMiddleware and authenticate)
app.use(localeResolver);

// Health check endpoint
app.get('/health', async (_req, res) => {
  const eventLoopMetrics = eventLoopMonitor.getMetrics(true);

  let databaseHealth: {
    status: 'connected' | 'disconnected' | 'timeout';
    responseTime?: number;
    error?: string;
  };
  try {
    databaseHealth = await checkHealth(config.healthCheck.databaseTimeout);
  } catch (error) {
    databaseHealth = {
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  let status: 'healthy' | 'degraded' | 'unhealthy';

  if (databaseHealth.status === 'disconnected' || databaseHealth.status === 'timeout') {
    status = 'unhealthy';
  } else if (!i18nInstance.isInitialized) {
    status = 'unhealthy';
  } else if (eventLoopMetrics.max > config.eventLoop.criticalThreshold) {
    status = 'unhealthy';
  } else if (eventLoopMetrics.max > config.eventLoop.warnThreshold) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  res.status(httpStatus).json({
    success: status !== 'unhealthy',
    data: {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      eventLoop: eventLoopMetrics,
      database: databaseHealth,
      i18n: { initialized: i18nInstance.isInitialized },
    },
  });
});

// API routes - Version 1
const v1Router = express.Router();

// Auth routes
v1Router.use('/auth', authRoutes);

// Team routes
v1Router.use('/teams', teamRoutes);

// Product Backlog routes
v1Router.use('/product-backlog', backlogRoutes);

// Product Goals routes
v1Router.use('/product-goals', goalsRoutes);

// Workflow management routes
v1Router.use('/workflows', workflowRoutes);

// Sprint routes (includes sprint-backlog)
v1Router.use('/sprints', sprintRoutes);
v1Router.use('/sprint-backlog', sprintRoutes);

// Sprint Configuration routes
v1Router.use('/sprint-configuration', sprintConfigurationRoutes);

// Daily Scrum routes
v1Router.use('/daily-scrums', dailyScrumRoutes);

// Daily Scrum standing commitment (time, place, working-day calendar)
v1Router.use('/daily-scrum-schedule', dailyScrumScheduleRoutes);

// Increment routes
v1Router.use('/increments', incrementRoutes);

// Scrum Master facilitation dashboard routes
v1Router.use('/dashboard', smDashboardRoutes);

// Scrum Values health check routes
v1Router.use('/health-checks', healthCheckRoutes);

// Sprint Review routes
v1Router.use('/sprint-reviews', sprintReviewRoutes);
v1Router.use('/retrospectives', retrospectiveRoutes);
v1Router.use('/impediments', impedimentRoutes);
v1Router.use('/reports', reportsRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/config', configRoutes);

// Data Export routes (GDPR Article 20 - Right to Data Portability)
v1Router.use('/user', dataExportRoutes);

// Consent routes (GDPR Article 7 - Consent Management)
v1Router.use('/consent', consentRoutes);

// Scrum event timebox routes
v1Router.use('/timeboxes', timeboxRoutes);

// Mount versioned API routers
app.use('/api/v1', v1Router);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
