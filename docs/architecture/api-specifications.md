# API Specifications

This document defines the comprehensive API specifications for Scrumooth, covering RESTful design principles, versioning strategy, request/response formats, authentication, error handling, rate limiting, pagination, the middleware pipeline, and validation patterns.

## Table of Contents

- [RESTful API Design](#restful-api-design)
- [API Versioning](#api-versioning)
- [Request/Response Format](#requestresponse-format)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [Middleware Pipeline](#middleware-pipeline)
- [Validation](#validation)
- [CSRF Protection](#csrf-protection)

---

## RESTful API Design

Scrumooth follows RESTful architectural principles with consistent resource-oriented URL patterns, standard HTTP methods, and uniform naming conventions.

### Resource-Oriented URLs

All API endpoints are structured around **nouns** (resources) rather than **verbs** (actions). Each resource maps to a distinct URL path.

```
/api/v1/{resource}
/api/v1/{resource}/{id}
/api/v1/{resource}/{id}/{sub-resource}
```

### HTTP Methods for CRUD Operations

| HTTP Method | Operation      | Idempotent | Safe | Use Case                         |
| ----------- | -------------- | ---------- | ---- | -------------------------------- |
| `GET`       | Retrieve       | Yes        | Yes  | Fetch resources (single or list) |
| `POST`      | Create         | No         | No   | Create new resources             |
| `PUT`       | Full Update    | Yes        | No   | Replace entire resource          |
| `PATCH`     | Partial Update | No         | No   | Modify specific fields           |
| `DELETE`    | Delete         | Yes        | No   | Remove a resource                |

### Naming Conventions

| Convention       | Rule                              | Example                                             |
| ---------------- | --------------------------------- | --------------------------------------------------- |
| Plural nouns     | Always use plural resource names  | `/api/v1/teams`, `/api/v1/sprints`                  |
| Kebab-case       | Hyphen-separated multi-word names | `/api/v1/product-backlog`, `/api/v1/sprint-reviews` |
| Lowercase        | All lowercase characters          | `/api/v1/product-goals`                             |
| Forward slashes  | Hierarchical relationship nesting | `/api/v1/teams/{id}/members`                        |
| UUID identifiers | Use UUIDv4 for resource IDs       | `/api/v1/teams/550e8400-e29b-...`                   |

### Registered API Routes

The following route table is registered in the application:

```javascript
// Mounted at /api/v1
Auth              → /auth/*
Teams             → /teams/*
Product Backlog   → /product-backlog/*
Product Goals     → /product-goals/*
Workflows         → /workflows/*
Sprints           → /sprints/*
Sprint Backlog    → /sprint-backlog/*      (shared with sprint routes)
Sprint Config     → /sprint-configuration/*
Daily Scrums      → /daily-scrums/*
Increments        → /increments/*
Sprint Reviews    → /sprint-reviews/*
Retrospectives    → /retrospectives/*
Impediments       → /impediments/*
Reports           → /reports/*
Notifications     → /notifications/*
Config            → /config/*
Data Export       → /user/*
Consent           → /consent/*
```

### Standard URL Patterns

```
Collection:   GET    /api/v1/{resources}
Detail:       GET    /api/v1/{resources}/{id}
Create:       POST   /api/v1/{resources}
Update:       PUT    /api/v1/{resources}/{id}
Partial:      PATCH  /api/v1/{resources}/{id}
Delete:       DELETE /api/v1/{resources}/{id}
Sub-collection: GET  /api/v1/{resources}/{id}/{sub-resources}
```

---

## API Versioning

Scrumooth uses **URL-based versioning** to manage API evolution. The version is embedded directly in the URL path, ensuring clear separation between different API versions.

### URL Structure

```
/api/v{version}/{resource}
```

The current version is `v1`:

```
Example:     https://api.example.com/api/v1/{resource}
Development: http://localhost:5001/api/v1/{resource}
```

`api.example.com` is a reserved placeholder domain. Replace it with the hostname of your
own deployment; Scrumooth is self-hosted, so there is no public API endpoint.

### Version Configuration

```typescript
// Defined in packages/backend/src/config/versions.ts
export const API_VERSIONS = {
  CURRENT: 1,
  MINIMUM_SUPPORTED: 1,
  SUPPORTED_VERSIONS: [1],
  DEPRECATED_VERSIONS: [],
  SUNSET_PERIOD_MONTHS: 6,
  SUPPORT_PERIOD_MONTHS: 12,
};
```

### Version Lifecycle

Each API version follows a structured lifecycle from release to retirement:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    API Version Lifecycle                                │
│                                                                         │
│  Current (v1)                                                           │
│    ├── Full support with all features                                   │
│    ├── Active development                                               │
│    └── No sunset date                                                   │
│                                                                         │
│  Supported (previous)                                                   │
│    ├── Bug fixes and security patches only                              │
│    ├── Supported for 12 months after new major release                  │
│    └── Sunset warning headers added                                     │
│                                                                         │
│  Deprecated                                                             │
│    ├── No longer actively supported                                     │
│    ├── 6-month sunset period begins                                     │
│    ├── Deprecation warning on every response                            │
│    └── Sunset header with deadline date                                 │
│                                                                         │
│  Retired                                                                │
│    ├── Endpoint returns 410 Gone                                        │
│    └── Migration guide provided                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Version Lifecycle Timeline

```
v1.0 released ──────────────────────────────────────────────────────────────►
                    │                        │                       │
              Minor releases           v2.0 released             v1 sunset
              (non-breaking)           v1 enters support          v1 retired
                                       period (12 months)         (410 Gone)
                                       Deprecation headers        Sunset period
                                       begin                      ends (6 mo)
```

### Version Headers

The `version.middleware.ts` sets the following response headers:

| Header          | Description                           | When Applied                  |
| --------------- | ------------------------------------- | ----------------------------- |
| `X-API-Version` | Current API version number            | All requests                  |
| `Deprecation`   | Signals deprecated version            | Deprecated versions only      |
| `Sunset`        | UTC date string of planned retirement | Deprecated versions only      |
| `Link`          | Points to successor version           | Deprecated versions only      |
| `Warning`       | Days-until-sunset advisory            | Within 90 days of sunset date |

### Breaking vs. Non-Breaking Changes

| Change Type  | Examples                                         | Version Bump |
| ------------ | ------------------------------------------------ | ------------ |
| Breaking     | Removed endpoints, changed request schemas,      | Major (v2)   |
|              | removed response fields, altered auth flow       |              |
| Non-breaking | New endpoints, optional fields, new query params | Minor        |
| Patch        | Bug fixes, performance improvements, docs        | Patch        |

### Version Detection Flow

```
Request arrives
     │
     ▼
┌────────────────────┐
│ Parse URL path     │  Match /api/v(\w+)/
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Is version valid?  │  Numeric, non-NaN
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
   Yes        No
    │         │
    ▼         ▼
┌────────┐  ┌──────────────┐
│ Check  │  │ BadRequest   │
│ sup-   │  │ (400) with   │
│ ported │  │ supported    │
│ list   │  │ versions     │
└───┬────┘  └──────────────┘
    │
    │   ┌──────────┐
    ├──►│ Depreca- │──► Set Deprecation, Sunset, Link, Warning headers
    │   │ ted?     │
    │   └──────────┘
    │
    ▼
Set X-API-Version header → next()
```

---

## Request/Response Format

All API communication uses JSON with a consistent envelope structure for both success and error responses.

### Request Format

Requests must include the following headers:

```http
Content-Type: application/json
Accept: application/json
```

Request bodies are plain JSON objects:

```json
{
  "name": "Development Team",
  "description": "Main development team"
}
```

### Response Envelope

Every response follows a standard JSON envelope containing up to four top-level keys.

#### Success Response

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  },
  "meta": {
    "timestamp": "2026-05-10T12:00:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-10T12:00:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

### Envelope Fields

| Field     | Type             | Success | Error   | Description                                      |
| --------- | ---------------- | ------- | ------- | ------------------------------------------------ |
| `success` | `boolean`        | `true`  | `false` | Indicates whether the request succeeded          |
| `data`    | `object \| null` | Present | `null`  | Response payload (resource or list of resources) |
| `error`   | `object \| null` | `null`  | Present | Error details with code, message, and details    |
| `meta`    | `object`         | Present | Present | Metadata including timestamp and requestId       |

### Error Object Shape

```typescript
interface ErrorObject {
  code: string; // Machine-readable error code (e.g., "VALIDATION_ERROR")
  message: string; // Human-readable error description
  details?: Array<{
    // Optional field-level error details
    field: string;
    message: string;
  }>;
}
```

### Meta Object Shape

```typescript
interface MetaObject {
  timestamp: string; // ISO 8601 UTC timestamp
  requestId: string; // UUIDv4 request identifier (matches X-Request-ID header)
}
```

### TypeScript Type Definitions

```typescript
// Defined in packages/backend/src/utils/errors.ts

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

### Helper Functions

```typescript
// Create a success response
export const createSuccessResponse = <T>(data: T): SuccessResponse<T> => ({
  success: true,
  data,
});

// Create an error response
export const createErrorResponse = (
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>
): ErrorResponse => ({
  success: false,
  error: { code, message, details },
});
```

---

## Authentication

Scrumooth uses **JWT (JSON Web Token)** based authentication with dual-mode support: HTTP-only cookies (primary, recommended for browsers) and Bearer token headers (alternative, for API clients).

### Authentication Architecture

```
┌──────────────┐          ┌───────────────────┐          ┌──────────────┐
│   Client     │          │   Backend API     │          │  Database    │
│              │          │                   │          │              │
│  Cookie jar  │  ◄──────►│  auth.middleware  │  ◄──────►│  users       │
│  (browser)   │  cookies │                   │  queries │  sessions    │
│              │  or      │  authenticate()   │          │              │
│  Memory      │  Bearer  │  optionalAuth()   │          │              │
│  (API client)│  header  │  requireRoles()   │          │              │
└──────────────┘          └───────────────────┘          └──────────────┘
```

### Token Types

| Token         | Lifespan   | Storage          | Purpose                   |
| ------------- | ---------- | ---------------- | ------------------------- |
| Access Token  | 15 minutes | HTTP-only cookie | Authenticate API requests |
| Refresh Token | 7 days     | HTTP-only cookie | Obtain new access tokens  |

### Cookie Configuration

```typescript
// Cookies are configured with:
HttpOnly: true        // Not accessible via JavaScript
Secure: true          // Only sent over HTTPS (production)
SameSite: Strict      // Prevents CSRF from cross-site requests
Path: /               // Available to all API routes
```

### Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │   API    │         │ Database │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  POST /auth/login  │                    │
     │  {email, password} │                    │
     │───────────────────►│                    │
     │                    │  Verify credentials│
     │                    │───────────────────►│
     │                    │  User data         │
     │                    │◄───────────────────│
     │                    │                    │
     │                    │  Generate JWT      │
     │                    │  Create session    │
     │                    │                    │
     │  200 OK            │                    │
     │  Set-Cookie:       │                    │
     │  accessToken       │                    │
     │  refreshToken      │                    │
     │◄───────────────────│                    │
     │                    │                    │
     │  GET /teams        │                    │
     │  Cookie: access... │                    │
     │───────────────────►│                    │
     │                    │  auth.middleware   │
     │                    │  verify token      │
     │                    │  get user          │
     │                    │  update activity   │
     │                    │                    │
     │  200 OK            │                    │
     │  {teams data}      │                    │
     │◄───────────────────│                    │
```

### Authentication Methods

#### Method 1: Cookie-Based (Recommended)

The preferred method for browser-based clients. Tokens are automatically sent with every request via HTTP-only cookies, eliminating the need for manual token management.

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response:
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict
Set-Cookie: refreshToken=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json

{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

#### Method 2: Bearer Token Header (Alternative)

For API clients, scripts, or environments where cookies are not available, use the `Authorization` header:

```
GET /api/v1/teams
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Response:
HTTP/1.1 200 OK
{
  "success": true,
  "data": { ... }
}
```

### Token Refresh

Access tokens are short-lived (15 minutes). When the access token expires, use the refresh token to obtain a new one without requiring the user to re-authenticate.

```
POST /api/v1/auth/refresh
Cookie: refreshToken=eyJhbGc...

Response:
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict
{
  "success": true,
  "data": {
    "message": "Token refreshed successfully"
  }
}
```

### Authentication Middleware

#### Required Authentication

```typescript
import { authenticate } from './middleware/auth.middleware';

// On a route
router.get('/teams', authenticate, teamController.list);
```

The `authenticate` middleware performs the following steps:

1. Extract token from HTTP-only cookie (priority 1)
2. Fallback to `Authorization: Bearer <token>` header (priority 2)
3. If no token found, throw `UnauthorizedError` (401)
4. Verify token signature and expiry via `authService.verifyAccessToken()`
5. Fetch user from database via `authService.getCurrentUser()`
6. Attach `req.user`, `req.userId`, `req.prisma` to the request
7. Update request context with `userId`
8. Update session activity timestamp (non-blocking)
9. Pass control to `next()`

#### Optional Authentication

For endpoints that behave differently based on authentication state but do not require it:

```typescript
import { optionalAuth } from './middleware/auth.middleware';

router.get('/public/profile', optionalAuth, profileController.get);
```

If a valid token is present, the user is attached; if not, the request proceeds without authentication.

### Role-Based Authorization

#### Global Role Check

```typescript
import { requireRoles } from './middleware/auth.middleware';

router.delete('/teams/:teamId', authenticate, requireRoles('PRODUCT_OWNER'), teamController.delete);
```

The `requireRoles(...roles)` middleware checks the user's role within the team context (extracted from `req.params.teamId` or `req.body.teamId`). If the user lacks any of the specified roles, a `ForbiddenError` (403) is thrown.

#### Team-Context Role Check

```typescript
import { requireTeamContext, requireTeamRoles } from './middleware/teamContext.middleware';

router.patch(
  '/teams/:teamId/settings',
  authenticate,
  requireTeamContext,
  requireTeamRoles('PRODUCT_OWNER', 'SCRUM_MASTER'),
  teamController.updateSettings
);
```

### Session Management

| Feature           | Configuration | Description                             |
| ----------------- | ------------- | --------------------------------------- |
| Idle Timeout      | 30 minutes    | Session expires after inactivity period |
| Absolute Timeout  | 24 hours      | Session expires regardless of activity  |
| Max Sessions      | 5 per user    | Limits concurrent active sessions       |
| Activity Tracking | Automatic     | Updated on every authenticated request  |

### Session Timeout Errors

| Error Type                    | HTTP Code | Error Code                 | Description                        |
| ----------------------------- | --------- | -------------------------- | ---------------------------------- |
| `SessionIdleTimeoutError`     | 401       | `SESSION_IDLE_TIMEOUT`     | Inactivity threshold exceeded      |
| `SessionAbsoluteTimeoutError` | 401       | `SESSION_ABSOLUTE_TIMEOUT` | Maximum session lifespan reached   |
| `SessionRevokedError`         | 401       | `SESSION_REVOKED`          | Session explicitly revoked by user |
| `SessionExpiredError`         | 401       | `SESSION_EXPIRED`          | Session has expired                |

---

## Error Handling

Scrumooth implements a robust error handling system based on a custom error class hierarchy, consistent error response formatting, and a centralized error handler middleware.

### Error Class Hierarchy

```
Error (native)
 └── AppError (base)
      ├── BadRequestError                (400)
      ├── UnauthorizedError              (401)
      │    ├── SessionIdleTimeoutError   (401)
      │    ├── SessionAbsoluteTimeoutError (401)
      │    ├── SessionRevokedError       (401)
      │    └── SessionExpiredError       (401)
      ├── ForbiddenError                 (403)
      │    └── AccountDeletionBlockedError (403)
      ├── NotFoundError                  (404)
      ├── ConflictError                  (409)
      ├── ValidationError                (422)
      ├── InternalServerError            (500)
      ├── EmailError                     (500)
      │    ├── EmailRateLimitError       (429)
      │    ├── EmailProviderError        (502)
      │    ├── EmailConnectionError      (503)
      │    ├── EmailAuthenticationError  (500)
      │    └── EmailTemplateError        (500)
      ├── EmailValidationError           (400)
      └── InvalidConfirmationError       (400)
```

### Error-to-HTTP Status Mapping

| Error Class                   | HTTP Status | Error Code                 |
| ----------------------------- | ----------- | -------------------------- |
| `BadRequestError`             | 400         | `BAD_REQUEST`              |
| `InvalidConfirmationError`    | 400         | `BAD_REQUEST`              |
| `EmailValidationError`        | 400         | `BAD_REQUEST`              |
| `UnauthorizedError`           | 401         | `UNAUTHORIZED`             |
| `SessionIdleTimeoutError`     | 401         | `SESSION_IDLE_TIMEOUT`     |
| `SessionAbsoluteTimeoutError` | 401         | `SESSION_ABSOLUTE_TIMEOUT` |
| `SessionRevokedError`         | 401         | `SESSION_REVOKED`          |
| `SessionExpiredError`         | 401         | `SESSION_EXPIRED`          |
| `ForbiddenError`              | 403         | `FORBIDDEN`                |
| `AccountDeletionBlockedError` | 403         | `FORBIDDEN`                |
| `NotFoundError`               | 404         | `NOT_FOUND`                |
| `ConflictError`               | 409         | `CONFLICT`                 |
| `ValidationError`             | 422         | `VALIDATION_ERROR`         |
| `EmailRateLimitError`         | 429         | `EMAIL_RATE_LIMIT`         |
| `InternalServerError`         | 500         | `INTERNAL_ERROR`           |
| `EmailProviderError`          | 502         | `EMAIL_PROVIDER_ERROR`     |
| `EmailConnectionError`        | 503         | `EMAIL_CONNECTION_ERROR`   |

### Error Response Format

All errors follow the consistent envelope structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-05-10T12:00:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

### Error Handler Middleware

The centralized `errorHandler` middleware (defined in [error.middleware.ts](../../packages/backend/src/middleware/error.middleware.ts)) processes errors in the following order:

```
Error enters middleware
     │
     ▼
┌────────────────────────────┐
│ Is it an AppError?         │──► Yes → Send response with error's
│ (Custom application error) │         statusCode, code, message, details
└────────────┬───────────────┘
             │ No
             ▼
┌────────────────────────────┐
│ Is it a Prisma.KnownError? │──► Yes → Map Prisma error codes:
│ (Database errors)          │         P2002 → 409 CONFLICT
└────────────┬───────────────┘         P2025 → 404 NOT_FOUND
             │ No                      P2003 → 400 INVALID_REFERENCE
             │                         P2014 → 400 RELATION_VIOLATION
             ▼                         Other → 500 DATABASE_ERROR
┌────────────────────────────┐
│ Is it a Prisma.Validation- │──► Yes → 400 VALIDATION_ERROR
│ Error?                     │
└────────────┬───────────────┘
             │ No
             ▼
┌────────────────────────────┐
│ Is it JsonWebTokenError?   │──► Yes → 401 INVALID_TOKEN
└────────────┬───────────────┘
             │ No
             ▼
┌────────────────────────────┐
│ Is it TokenExpiredError?   │──► Yes → 401 TOKEN_EXPIRED
└────────────┬───────────────┘
             │ No
             ▼
┌────────────────────────────┐
│ Is it SessionTimeout-,     │──► Yes → 401 with session-specific
│ Revoked-, or ExpiredError? │         error code and guidance
└────────────┬───────────────┘
             │ No
             ▼
┌────────────────────────────┐
│ Fallback                   │──► 500 INTERNAL_ERROR
│ (Unknown error)            │     (sanitized in production)
└────────────────────────────┘
```

### Error Fingerprinting

Every error is assigned a **SHA-256 fingerprint** for tracking and grouping. The fingerprint is generated from:

- `error.name`
- First line of `error.message`
- `req.path`
- `req.method`

The fingerprint is included in error logs for debugging and monitoring.

### Sensitive Data Redaction

Before logging request bodies, the error handler redacts sensitive fields:

- `password`, `passwordConfirm`, `currentPassword`, `newPassword`
- `refreshToken`, `accessToken`, `token`
- `secret`, `apiKey`, `api_key`
- `authorization`, `sessionId`

All sensitive values are replaced with `[REDACTED]`.

---

## Rate Limiting

Rate limiting protects the API from abuse and ensures fair resource allocation across all clients.

### Rate Limit Types

The application defines four distinct rate limiters (defined in [rateLimit.middleware.ts](../../packages/backend/src/middleware/rateLimit.middleware.ts)):

| Limiter         | Limit | Window | Scope       | Applied To               |
| --------------- | ----- | ------ | ----------- | ------------------------ |
| Global API      | 100   | 15 min | IP-based    | All `/api/` routes       |
| Auth            | 5     | 15 min | IP-based    | Auth endpoints           |
| Login           | 10    | 15 min | IP + email  | Login endpoint           |
| Forgot Password | 3     | 15 min | Email-based | Forgot password endpoint |
| Reset Password  | 5     | 15 min | IP-based    | Password reset endpoint  |
| Notifications   | 200   | 15 min | IP-based    | Notification endpoints   |

### Rate Limit Headers

All responses from rate-limited endpoints include standard rate limit headers:

```http
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1715347200
```

### Rate Limit Exceeded Response

When a rate limit is exceeded, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later"
  },
  "meta": {
    "timestamp": "2026-05-10T12:00:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

### Global Rate Limit Application

The global rate limiter is applied conditionally (disabled in test environment):

```typescript
// From app.ts - applied to /api/ routes only, excluding /health
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', limiter);
}
```

### Per-Endpoint Rate Limiters

Specific rate limiters are applied to individual routes:

```typescript
// Auth routes get stricter limits
router.post('/login', loginRateLimit, authController.login);
router.post('/forgot-password', forgotPasswordRateLimit, authController.forgotPassword);

// Notification routes have higher limits
router.get('/', notificationRateLimit, notificationController.list);
```

### Key Generators

Different rate limiters use different key generation strategies:

| Limiter         | Key Generator                                                |
| --------------- | ------------------------------------------------------------ |
| Global API      | IP address                                                   |
| Auth            | IP address                                                   |
| Login           | `{ip}:{email}` (combined to prevent distributed brute force) |
| Forgot Password | `forgot-password:{email}` (email-scoped)                     |
| Reset Password  | IP address                                                   |

### Test Environment

In test environments, rate limits are effectively disabled by setting extremely high maximum values (`1000000`) to prevent test failures.

---

## Pagination

List endpoints support pagination to efficiently handle large datasets. The pagination model uses cursor-based navigation with configurable page size.

### Request Parameters

| Parameter | Type    | Default     | Description                     |
| --------- | ------- | ----------- | ------------------------------- |
| `page`    | integer | 1           | Page number (1-indexed)         |
| `limit`   | integer | 20          | Items per page (max 100)        |
| `sort`    | string  | `createdAt` | Field to sort by                |
| `order`   | string  | `desc`      | Sort direction: `asc` or `desc` |

### Example Request

```http
GET /api/v1/teams?page=1&limit=20&sort=createdAt&order=desc
```

### Pagination Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Development Team",
        "createdAt": "2026-05-01T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "meta": {
    "timestamp": "2026-05-10T12:00:00.000Z",
    "requestId": "req_abc123def456"
  }
}
```

### Pagination Metadata Fields

| Field        | Type    | Description                              |
| ------------ | ------- | ---------------------------------------- |
| `page`       | integer | Current page number                      |
| `limit`      | integer | Number of items per page                 |
| `total`      | integer | Total number of items matching the query |
| `totalPages` | integer | Total number of pages                    |
| `hasNext`    | boolean | Whether a next page exists               |
| `hasPrev`    | boolean | Whether a previous page exists           |

### Filtering and Sorting

```http
GET /api/v1/product-backlog?status=IN_PROGRESS&priority=MUST_HAVE&sort=priority&order=desc
```

### Pagination Best Practices

- **Always paginate**: List endpoints must implement pagination to prevent large response payloads
- **Maximum limit**: Cap `limit` at 100 items per page
- **Default order**: Most resources default to `createdAt` descending (newest first)
- **Consistent sort**: Sort field values must match the database column names
- **Calculate totals**: Always return `total` and `totalPages` for UI navigation

---

## Middleware Pipeline

All API requests pass through a well-defined middleware pipeline before reaching the controller. Each middleware performs a specific function, and the order is critical for security, performance, and correctness.

### Complete Middleware Pipeline

```
Incoming Request
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 1. Helmet                                                    │
│    Apply security headers (X-Content-Type-Options,           │
│    X-Frame-Options, CSP, etc.)                               │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. CORS                                                      │
│    Cross-Origin Resource Sharing policy enforcement          │
│    Credentials: true for cookie support                      │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. Body Parsers                                              │
│    express.json({ limit: '10mb' })                           │
│    express.urlencoded({ extended: true })                    │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Cookie Parser                                             │
│    Parse cookies for auth tokens and CSRF token              │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. Compression                                               │
│    Compress response bodies (gzip/brotli)                    │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Request ID                                                │
│    Assign UUIDv4 to req.id                                   │
│    Set X-Request-ID response header                          │
│    Reuse x-request-id from incoming headers if present       │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Context Middleware                                        │
│    Initialize AsyncLocalStorage context                      │
│    Store requestId in context                                │
│    Provides per-request isolation for logging                │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. Version Middleware                                        │
│    Parse /api/v{version}/ from URL                           │
│    Validate version is supported                             │
│    Set X-API-Version response header                         │
│    Add deprecation/sunset headers if version is deprecated   │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. Global Rate Limiter                                       │
│    Applied to all /api/ routes                               │
│    100 requests per 15 minutes per IP                        │
│    Disabled in test environment                              │
│    X-RateLimit-* headers on response                         │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 10. CSRF Token Ensurer                                       │
│     Ensure csrfToken cookie exists (generate if missing)     │
│     Non-HTTP-only cookie (readable by JavaScript)            │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 11. CSRF Protection Middleware                               │
│     Skip for GET/HEAD/OPTIONS requests                       │
│     Verify CSRF cookie value matches CSRF header value       │
│     HMAC-based token verification                            │
│     Throws ForbiddenError (403) on mismatch/missing          │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 12. Request Logger                                           │
│     Log method, path, status code, duration, requestId       │
│     Attach to response 'finish' event                        │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 13. Authentication Middleware (per-route, optional)          │
│     Extract token (cookie or Bearer header)                  │
│     Verify JWT signature and expiry                          │
│     Fetch user from database                                 │
│     Attach req.user, req.userId                              │
│     Update session activity                                  │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 14. Team Context Middleware (per-route, optional)            │
│     Extract teamId from x-team-id header / params / body     │
│     Validate UUID format                                     │
│     Verify user membership in team                           │
│     Attach req.currentTeamId, req.userRoleInTeam             │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 15. Authorization Middleware (per-route, optional)           │
│     requireRoles('PRODUCT_OWNER')                            │
│     requireTeamRoles('SCRUM_MASTER')                         │
│     Check user role against required roles                   │
│     Throws UnauthorizedError/ForbiddenError on failure       │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 16. Validation Middleware (per-route, optional)              │
│     validateBody(schema) - Zod schema validation             │
│     validateParams(schema)                                   │
│     validateQuery(schema)                                    │
│     Store validated data in req.validatedBody/Params/Query   │
│     Throws ValidationError (422) on failure                  │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 17. Controller                                               │
│     Execute business logic                                   │
│     Call service layer                                       │
│     Format response                                          │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 18. Not Found Handler                                        │
│     (If no route matched)                                    │
│     Returns 404 NOT_FOUND                                    │
│     { success: false, error: { code: 'NOT_FOUND', ... } }    │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ 19. Error Handler                                            │
│     (If any middleware threw)                                │
│     Classify error type                                      │
│     Generate error fingerprint                               │
│     Redact sensitive data from logs                          │
│     Return consistent error respons
```
