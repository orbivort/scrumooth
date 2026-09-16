# Security Architecture

This document provides a comprehensive overview of the Scrumooth security architecture, covering authentication, authorization, data protection, network security, session management, audit logging, account security, and compliance considerations.

## Table of Contents

- [Authentication Mechanisms](#authentication-mechanisms)
- [Authorization Model](#authorization-model)
- [Data Protection](#data-protection)
- [Network Security](#network-security)
- [Session Security](#session-security)
- [Audit Logging and Monitoring](#audit-logging-and-monitoring)
- [Account Security](#account-security)
- [Security Best Practices and Compliance](#security-best-practices-and-compliance)

## Authentication Mechanisms

### JWT-Based Authentication Flow

Scrumooth uses JSON Web Tokens (JWT) with HTTP-only cookies for stateless authentication, coupled with database-backed refresh tokens for secure token rotation.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION ARCHITECTURE                        │
│                                                                          │
│  ┌──────────┐         ┌──────────────────┐         ┌──────────────┐      │
│  │ Browser  │         │   Express API    │         │  PostgreSQL  │      │
│  │          │         │                  │         │              │      │
│  │  Cookie  │◄────────│  Auth Middleware │────────►│  sessions    │      │
│  │  Jar     │         │                  │         │  users       │      │
│  │          │         │  - JWT Verify    │         │  refresh_    │      │
│  │  access  │────────►│  - Session Check │         │  tokens      │      │
│  │  Token   │         │  - Role Extract  │         │              │      │
│  │  refresh │         │                  │         │              │      │
│  │  Token   │         │  Auth Controller │         │              │      │
│  │          │◄────────│  - Login         │         │              │      │
│  │          │────────►│  - Register      │         │              │      │
│  │          │         │  - Refresh       │         │              │      │
│  │          │         │  - Logout        │         │              │      │
│  └──────────┘         └──────────────────┘         └──────────────┘      │
│                                                                          │
│  Token Storage:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐         │
│  │ accessToken:  HTTP-only cookie, Secure, SameSite=Strict     │         │
│  │ refreshToken: HTTP-only cookie, Secure, SameSite=Strict,    │         │
│  │               path=/api/v1/auth                             │         │
│  │ csrfToken:    Readable cookie, SameSite=Strict              │         │
│  └─────────────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Token lifecycle:**

```
  User Login
      │
      ▼
  POST /api/v1/auth/login
  (email + password)
      │
      ▼
  Validate credentials (bcrypt compare)
      │
      ▼
  Generate Access Token (JWT, 15 min TTL)
  Generate Refresh Token (SHA-256 hashed, 7 day TTL, stored in DB)
      │
      ▼
  Set HTTP-only cookies:
    - accessToken (15 min)
    - refreshToken (7 day)
      │
      ▼
  ┌──────────────────────────────────────────┐
  │           Authenticated Session          │
  │                                          │
  │  Every API request:                      │
  │    accessToken ──► JWT verify ──► OK     │
  │                                          │
  │  When accessToken expires (401):         │
  │    refreshToken ──► POST /auth/refresh   │
  │    ──► new accessToken + new refreshToken│
  │                                          │
  │  When refreshToken expires:              │
  │    ──► Redirect to login                 │
  └──────────────────────────────────────────┘
```

### Token Architecture

#### Access Token (JWT)

| Property | Value                                          |
| -------- | ---------------------------------------------- |
| Format   | JWT (HS256)                                    |
| Payload  | `{ sub: userId, role: userRole, iat, exp }`    |
| TTL      | 15 minutes (configurable via `JWT_EXPIRES_IN`) |
| Storage  | HTTP-only cookie (`accessToken`)               |
| Delivery | Set by server on login/refresh                 |

#### Refresh Token

| Property | Value                                                                |
| -------- | -------------------------------------------------------------------- |
| Format   | Random token, SHA-256 hashed before storage                          |
| TTL      | 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`)                   |
| Storage  | Database (`refresh_tokens` table, hashed)                            |
| Delivery | HTTP-only cookie (`refreshToken`), path-restricted to `/api/v1/auth` |
| Rotation | New refresh token issued on each refresh                             |

**Refresh token rotation** prevents token reuse attacks: each time a refresh token is used, it is invalidated and a new one is issued. If a stolen refresh token is used after the legitimate user has already refreshed, the system detects the replay and invalidates all sessions for that user.

### Password Hashing

Passwords are hashed using **bcrypt** before storage:

| Property     | Value                                         |
| ------------ | --------------------------------------------- |
| Algorithm    | bcrypt                                        |
| Salt Rounds  | 12 (configurable via `BCRYPT_SALT_ROUNDS`)    |
| Recommended  | 12-14 rounds for production                   |
| Verification | `bcrypt.compare()` (constant-time comparison) |

The password is never stored in plaintext or logged. All password comparisons use constant-time algorithms to prevent timing attacks.

### Authentication Endpoints

| Endpoint                       | Method | Rate Limit | Purpose                         |
| ------------------------------ | ------ | ---------- | ------------------------------- |
| `/api/v1/auth/register`        | POST   | 5/15min    | Create new user account         |
| `/api/v1/auth/login`           | POST   | 10/15min   | Authenticate and receive tokens |
| `/api/v1/auth/refresh`         | POST   | Standard   | Rotate access + refresh tokens  |
| `/api/v1/auth/logout`          | POST   | Standard   | Invalidate current session      |
| `/api/v1/auth/forgot-password` | POST   | 3/15min    | Request password reset email    |
| `/api/v1/auth/reset-password`  | POST   | 5/15min    | Execute password reset          |

## Authorization Model

### Role-Based Access Control (RBAC)

Scrumooth implements a three-role RBAC model with hierarchical permissions:

```
┌──────────────────────────────────────────────────────────────────────┐
│                       RBAC HIERARCHY                                 │
│                                                                      │
│                    ┌──────────────────────┐                          │
│                    │    PRODUCT OWNER     │                          │
│                    │  - Backlog management│                          │
│                    │  - Sprint planning   │                          │
│                    │  - Goal setting      │                          │
│                    │  - Report viewing    │                          │
│                    │  - All below roles   │                          │
│                    └──────────┬───────────┘                          │
│                               │ inherits                             │
│                    ┌──────────▼───────────┐                          │
│                    │    SCRUM MASTER      │                          │
│                    │  - Sprint execution  │                          │
│                    │  - Impediment mgmt   │                          │
│                    │  - Retrospectives    │                          │
│                    │  - Daily scrums      │                          │
│                    │  - All below roles   │                          │
│                    └──────────┬───────────┘                          │
│                               │ inherits                             │
│                    ┌──────────▼───────────┐                          │
│                    │     DEVELOPERS       │                          │
│                    │  - Task updates      │                          │
│                    │  - View boards       │                          │
│                    │  - Personal profile  │                          │
│                    └──────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Role Permission Matrix

| Permission                         | Product Owner | Scrum Master | Developers |
| ---------------------------------- | :-----------: | :----------: | :--------: |
| Manage users/teams                 |      Yes      |      No      |     No     |
| Configure system settings          |      Yes      |      No      |     No     |
| Create/edit product goals          |      Yes      |      No      |     No     |
| Create/edit backlog items          |      Yes      |     Yes      |    Yes     |
| Size backlog items (story points)  |      No       |      No      |    Yes     |
| Prioritize backlog (MoSCoW)        |      Yes      |      No      |     No     |
| Plan sprints / save Sprint Backlog |      No       |      No      |    Yes     |
| Start/complete sprint              |      Yes      |     Yes      |    Yes     |
| Cancel sprint (ACTIVE only)        |      Yes      |      No      |     No     |
| Manage sprint board / task status  |      No       |      No      |    Yes     |
| Log impediments                    |      Yes      |     Yes      |    Yes     |
| Resolve impediments                |      Yes      |     Yes      |    Yes     |
| Conduct retrospectives             |      Yes      |     Yes      |    Yes     |
| Author the Daily Scrum record      |     No \*     |    No \*     |    Yes     |
| View dashboards/reports            |      Yes      |     Yes      |    Yes     |
| Export data                        |      Yes      |      No      |     No     |
| Delete data                        |      Yes      |      No      |     No     |

> \* The Product Owner and Scrum Master may attend and observe the Daily Scrum, but only the Developers can author or edit the shared team record (Scrum Guide 2020).
>
> **Note:** This matrix reflects the roles enforced in the backend service layer, which is the authoritative source. The Scrum Guide rules that Scrumooth gates — sizing, saving the Sprint Backlog, authoring the Daily Scrum, cancelling a Sprint, and the Sprint-closure gates — are enforced there, so neither the interface nor a direct API call can bypass them. Where a row and the service layer disagree, the service layer wins.

### Authorization Enforcement

Authorization is enforced through a middleware chain in the Express backend:

```
Request
    │
    ▼
┌──────────────────┐
│  authenticate     │  Verify JWT, attach user context (req.user)
│  Middleware       │  Fails with 401 Unauthorized if token invalid
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  authorize(role) │  Check user.role against required role(s)
│  Middleware       │  Fails with 403 Forbidden if insufficient
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Controller      │  Business logic (may include additional
│                  │  resource-level ownership checks)
└──────────────────┘
```

**Usage pattern:**

```typescript
// Route definition with authorization
router.post(
  '/sprints',
  authenticate, // Must be logged in
  authorize('Product Owner'), // Must be PO or higher
  validate(sprintSchema), // Validate request body
  sprintController.create
);
```

**Role inheritance** is implicit: a Product Owner inherits all Scrum Master and Developers permissions, and a Scrum Master inherits all Developers permissions. The `authorize` middleware checks if the user's role is at or above the required role in the hierarchy. Note that the Scrum Guide gates are _not_ inherited away — they are role-specific: only the **Developers** may size work, save the Sprint Backlog, author the Daily Scrum, or move board tasks, and only the **Product Owner** may cancel a Sprint.

## Data Protection

### Encryption at Rest

| Data Type             | Protection Method                                     |
| --------------------- | ----------------------------------------------------- |
| Passwords             | bcrypt (12+ salt rounds), one-way hash                |
| Refresh tokens (DB)   | SHA-256 hashed before storage                         |
| Password reset tokens | SHA-256 hashed before storage                         |
| PostgreSQL data       | Filesystem-level encryption (recommended for prod)    |
| Backup files          | Should be encrypted at rest (operator responsibility) |

### Encryption in Transit

| Pathway                   | Protocol                |
| ------------------------- | ----------------------- |
| Browser to Caddy          | HTTPS (TLS 1.2+)        |
| Caddy to Frontend (nginx) | HTTP (internal network) |
| Caddy to Backend          | HTTP (internal network) |
| Backend to PostgreSQL     | TLS (via PgBouncer)     |
| Backend to PgBouncer      | TLS (client cert)       |

In production, all external traffic is encrypted via HTTPS (Caddy with automatic Let's Encrypt certificates). Internal service-to-service communication within the Docker bridge network uses plain HTTP because it does not traverse a public network.

### Input Validation with Zod

All API inputs are validated using **Zod schemas** before reaching business logic:

```
Request Body
      │
      ▼
┌──────────────────────┐
│  Zod Schema Parse    │
│  (validate.middleware)│
│                      │
│  On success:         │
│    req.body = parsed │
│    Pass to controller│
│                      │
│  On failure:         │
│    400 Bad Request   │
│    + detailed errors │
└──────────────────────┘
```

**Validation coverage:**

- Request body (JSON)
- Route parameters (URL params)
- Query strings
- Headers (where applicable)

**Example schema:**

```typescript
const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be at most 100 characters'),
  description: z.string().max(500, 'Description must be at most 500 characters').optional(),
});
```

In addition to request-body schema validation, business-rule limits are enforced in the service layer. For example, `TeamService.addMember()` validates that a team has not reached its configured maximum size (default `10`, configurable via `TEAM_MAX_SIZE`) before creating a membership, returning `409 TEAM_SIZE_LIMIT_REACHED` when the team is at capacity. This prevents arbitrarily large Scrum Teams and aligns with the Scrum Guide recommendation.

### SQL Injection Prevention

SQL injection is prevented through Prisma ORM's parameterized queries. All database access goes through Prisma, which:

- Uses `$1`, `$2` parameter placeholders (never string interpolation).
- Escapes all user-provided values automatically.
- Provides type-safe query building that structurally prevents injection.

```typescript
// Safe: Prisma parameterized query
const user = await prisma.user.findUnique({
  where: { email: userInput }, // userInput is automatically parameterized
});

// The equivalent SQL generated is:
// SELECT * FROM users WHERE email = $1
```

**There is no raw SQL execution** in the codebase. All database queries use the Prisma client with its type-safe query builder.

### XSS Prevention

Cross-site scripting is prevented through multiple layers:

1. **React's automatic escaping**: JSX expressions are automatically escaped. `<div>{userInput}</div>` is safe by default.
2. **Helmet CSP headers**: The Content-Security-Policy header restricts script sources to `'self'` and trusted origins.
3. **Markdown sanitization**: Rich text inputs are sanitized using `sanitize-html` before rendering.
4. **No `dangerouslySetInnerHTML`**: The codebase avoids this escape hatch; where needed, content is pre-sanitized.

### CSRF Protection

Scrumooth implements a **double-submit cookie pattern** with HMAC-signed tokens:

```
┌──────────────────────────────────────────────────────────────┐
│                    CSRF PROTECTION FLOW                      │
│                                                              │
│  1. Server sets csrfToken cookie (readable, SameSite=Strict) │
│     Value: HMAC-signed random token                          │
│                                                              │
│  2. Frontend reads csrfToken cookie                          │
│     Sends as X-CSRF-Token header with state-changing reqs    │
│                                                              │
│  3. Server middleware (csrfProtectionMiddleware):            │
│     - Extracts X-CSRF-Token header                           │
│     - Verifies HMAC signature against csrfToken cookie       │
│     - Rejects with 403 if invalid or missing                 │
│                                                              │
│  Applied to: POST, PUT, PATCH, DELETE requests               │
│  Exempt:     GET, HEAD, OPTIONS (safe methods)               │
└──────────────────────────────────────────────────────────────┘
```

**Key properties:**

- Tokens are HMAC-signed to prevent token injection.
- The `ensureCsrfToken` middleware runs before CSRF validation to guarantee a token cookie is always present.
- The frontend automatically attaches the CSRF header to all state-changing API requests.

## Network Security

### Helmet Security Headers

The backend applies Helmet middleware globally, which sets the following security headers:

| Header                    | Value                                          | Purpose                         |
| ------------------------- | ---------------------------------------------- | ------------------------------- |
| Content-Security-Policy   | `default-src 'self'; script-src 'self' ...`    | Prevent XSS, data injection     |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | Enforce HTTPS (HSTS)            |
| X-Frame-Options           | `SAMEORIGIN`                                   | Prevent clickjacking            |
| X-Content-Type-Options    | `nosniff`                                      | Prevent MIME-type sniffing      |
| X-XSS-Protection          | `1; mode=block`                                | Legacy XSS filter (for old IE)  |
| Referrer-Policy           | `strict-origin-when-cross-origin`              | Control referrer information    |
| Permissions-Policy        | Disabled all (camera, mic, geo, etc.)          | Restrict browser feature access |
| Server                    | (removed)                                      | Hide server software identity   |

The Caddyfile also applies these headers at the reverse proxy level, providing defense in depth.

### CORS Configuration

Cross-Origin Resource Sharing is strictly controlled:

```typescript
app.use(
  cors({
    origin: config.cors.origin, // Explicit whitelist (no wildcard)
    credentials: true, // Allow cookies with cross-origin requests
  })
);
```

| Environment | `CORS_ORIGIN` Value                                                 |
| ----------- | ------------------------------------------------------------------- |
| Development | `http://localhost:5173,http://localhost:5174,http://localhost:5175` |
| Production  | `https://app.example.com` (explicit HTTPS origins only)             |

**Production requirements:**

- No `localhost` or `127.0.0.1` origins allowed.
- HTTPS-only origins.
- Multiple domains supported via comma-separated list.

### Rate Limiting

Rate limiting is applied globally to API routes using `express-rate-limit`:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RATE LIMITING STRATEGY                       │
│                                                                 │
│  All /api/* routes (except /health):                            │
│    Window: 15 minutes (RATE_LIMIT_WINDOW_MS)                    │
│    Max:    100 requests (RATE_LIMIT_MAX_REQUESTS)               │
│                                                                 │
│  Special endpoints (stricter limits):                           │
│  ┌────────────────────────┬──────────────┬───────────────────┐  │
│  │ Endpoint               │ Limit         │ Purpose          │  │
│  ├────────────────────────┼──────────────┼───────────────────┤  │
│  │ /auth/register         │ 5 req/15min  │ Brute force prev. │  │
│  │ /auth/login            │ 10 req/15min │ Credential stuffing│ │
│  │ /auth/forgot-password  │ 3 req/15min  │ Email abuse prev. │  │
│  │ /auth/reset-password   │ 5 req/15min  │ Token brute force │  │
│  └────────────────────────┴──────────────┴───────────────────┘  │
│                                                                 │
│  Response on limit hit: 429 Too Many Requests                   │
│  {                                                              │
│    "success": false,                                            │
│    "error": {                                                   │
│      "code": "RATE_LIMIT_EXCEEDED",                             │
│      "message": "Too many requests, please try again later"     │
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
```

The `/health` endpoint is excluded from rate limiting to ensure monitoring systems can always check service health.

### API Security Headers (nginx)

The frontend nginx configuration adds additional security headers for static assets:

| Header                 | Value                              |
| ---------------------- | ---------------------------------- |
| X-Frame-Options        | `SAMEORIGIN`                       |
| X-Content-Type-Options | `nosniff`                          |
| X-XSS-Protection       | `1; mode=block`                    |
| Referrer-Policy        | `strict-origin-when-cross-origin`  |
| Permissions-Policy     | All disabled (camera, mic, geo...) |

### Network Isolation

In the Docker Compose deployment, services communicate on an internal bridge network (`scrumooth-network`). Only Caddy (ports 80/443) and PgBouncer (port 6432) are published to the host. Backend, frontend, and PostgreSQL are not directly accessible from outside the Docker network.

## Session Security

### Session Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SESSION LIFECYCLE                                │
│                                                                          │
│  LOGIN ───────────────────────────────────────────────────────────────►  │
│    │                                                                     │
│    │  Session Created                                                    │
│    │  - accessToken JWT (15 min exp)                                     │
│    │  - refreshToken (7 day exp, hashed in DB)                           │
│    │  - Session record in DB (idle timer starts)                         │
│    │                                                                     │
│    ▼                                                                     │
│  ACTIVE SESSION                                                          │
│    │                                                                     │
│    │  ┌──────────────────────────────────────────────┐                   │
│    │  │         IDLE TIMEOUT (30 minutes)            │                   │
│    │  │  If no activity for SESSION_IDLE_TIMEOUT_MS: │                   │
│    │  │  ➤ Session invalidated                      │                   │
│    │  │  ➤ User redirected to login                 │                   │
│    │  │  ➤ Frontend shows warning at 28 min         │                   │
│    │  └──────────────────────────────────────────────┘                   │
│    │                                                                     │
│    │  ┌──────────────────────────────────────────────┐                   │
│    │  │      ABSOLUTE TIMEOUT (24 hours)             │                   │
│    │  │  Regardless of activity, after               │                   │
│    │  │  SESSION_ABSOLUTE_TIMEOUT_MS:                │                   │
│    │  │  ➤ Session invalidated                      │                   │
│    │  │  ➤ User must re-login                       │                   │
│    │  └──────────────────────────────────────────────┘                   │
│    │                                                                     │
│    ▼                                                                     │
│  SESSION EXPIRY                                                          │
│    │                                                                     │
│    │  Cleanup job runs every SESSION_CLEANUP_INTERVAL_MS (1 hour)        │
│    │  - Removes expired sessions from database                           │
│    │  - Frees up concurrent session slots                                │
│    │                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Session Configuration

| Parameter                      | Default       | Description                                  |
| ------------------------------ | ------------- | -------------------------------------------- |
| `SESSION_IDLE_TIMEOUT_MS`      | 1,800,000 ms  | Idle timeout (30 minutes)                    |
| `SESSION_ABSOLUTE_TIMEOUT_MS`  | 86,400,000 ms | Absolute maximum session duration (24 hours) |
| `SESSION_WARNING_THRESHOLD_MS` | 120,000 ms    | Warning dialog before timeout (2 minutes)    |
| `SESSION_CLEANUP_INTERVAL_MS`  | 3,600,000 ms  | Expired session cleanup interval (1 hour)    |
| `MAX_CONCURRENT_SESSIONS`      | 5             | Maximum active sessions per user             |

### Concurrent Session Management

Users are limited to **5 concurrent sessions**. When a 6th session is created:

1. The oldest session is automatically invalidated.
2. The new session is created normally.
3. This prevents session token proliferation and limits the attack surface.

### Session Timeout Warnings

The frontend displays a warning dialog **2 minutes** before session expiry, giving users time to extend their session by interacting with the application (which resets the idle timer).

### Token Security Properties

| Property         | accessToken                       | refreshToken                      |
| ---------------- | --------------------------------- | --------------------------------- |
| Storage (Client) | HTTP-only cookie                  | HTTP-only cookie, path-restricted |
| Storage (Server) | None (stateless JWT)              | SHA-256 hash in database          |
| Transmitted      | Every API request                 | Only to /api/v1/auth/refresh      |
| Replayable       | Yes (within TTL)                  | No (one-time use, rotation)       |
| Revocable        | No (TTL-bound)                    | Yes (delete from database)        |
| Cookie flags     | HttpOnly, Secure, SameSite=Strict | HttpOnly, Secure, SameSite=Strict |

### Logout Behavior

On logout:

1. The refresh token is deleted from the database.
2. The session record is marked as invalidated.
3. Both `accessToken` and `refreshToken` cookies are cleared from the browser.
4. All subsequent API requests fail with 401 until re-login.

## Audit Logging and Monitoring

### Audit Log Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIT LOGGING SYSTEM                         │
│                                                                 │
│  Application Events ──► Audit Logger ──► audit-YYYY-MM-DD.log   │
│                                                                 │
│  Events captured:                                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Authentication Events                                      │ │
│  │  - Login success/failure                                   │ │
│  │  - Logout                                                  │ │
│  │  - Token refresh                                           │ │
│  │  - Password change/reset                                   │ │
│  │  - Registration                                            │ │
│  │                                                            │ │
│  │ Authorization Events                                       │ │
│  │  - Permission denied (403)                                 │ │
│  │  - Role changes                                            │ │
│  │                                                            │ │
│  │ Data Modification Events                                   │ │
│  │  - Create/Update/Delete operations on all entities         │ │
│  │  - Sprint start/end                                        │ │
│  │  - Backlog reordering                                      │ │
│  │                                                            │ │
│  │ Administrative Events                                      │ │
│  │  - User creation/deletion                                  │ │
│  │  - Team configuration changes                              │ │
│  │  - System setting modifications                            │ │
│  │  - Data export                                             │ │
│  │  - Account deletion requests                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Each audit entry includes:                                     │
│  - Timestamp (ISO 8601)                                         │
│  - Request ID (for cross-reference)                             │
│  - User ID                                                      │
│  - Action                                                       │
│  - Resource type and ID                                         │
│  - Metadata (contextual details)                                │
│  - IP address                                                   │
│  - User agent                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Log Retention and Rotation

| Log Type      | Retention | Rotation          | Format               |
| ------------- | --------- | ----------------- | -------------------- |
| Audit logs    | 30 days   | Daily             | JSON, separate files |
| Combined logs | 14 days   | Size-based (20MB) | JSON                 |
| Error logs    | 30 days   | Size-based (20MB) | JSON                 |
| Docker logs   | 5 files   | Size-based (10MB) | JSON-file            |

### Security Event Monitoring

The following security-relevant events are specifically monitored and logged:

1. **Multiple failed login attempts** (per user, per IP) -- potential brute force.
2. **Concurrent session limit exceeded** -- potential credential sharing or token theft.
3. **Refresh token reuse** -- potential token theft (triggers session invalidation).
4. **Permission denied (403) spikes** -- potential privilege escalation attempts.
5. **Rate limit hits** -- potential DoS or brute force.
6. **Account deletion requests** -- GDPR compliance audit trail.

### Request Tracing

Every request is assigned a unique **request ID** that:

- Is included in all log entries associated with that request.
- Is returned in the `X-Request-ID` response header.
- Is propagated through the `AsyncLocalStorage` context across middleware, controllers, and services.

This enables end-to-end traceability from an HTTP response back through all related log entries.

## Account Security

### Password Requirements

User passwords must meet the following criteria:

| Requirement        | Value                                            |
| ------------------ | ------------------------------------------------ |
| Minimum length     | 8 characters (12 recommended)                    |
| Complexity         | Strong (mixed case, numbers, symbols encouraged) |
| Hashing            | bcrypt, 12+ salt rounds                          |
| Storage            | Hash only (never plaintext)                      |
| Reset token TTL    | 1 hour                                           |
| Reset notification | Email sent on password change                    |

### Password Reset Flow

```
┌───────────────────────────────────────────────────────────────┐
│                 PASSWORD RESET FLOW                           │
│                                                               │
│  1. User requests reset                                       │
│     POST /api/v1/auth/forgot-password                         │
│     { email: "user@example.com" }                             │
│     ➤ Rate limited: 3 requests per 15 minutes                │
│                                                               │
│  2. Server generates reset token                              │
│     - Random token, SHA-256 hashed                            │
│     - 1-hour expiration                                       │
│     - Stored in password_reset_tokens table                   │
│                                                               │
│  3. Email sent to user                                        │
│     - Contains reset link: FRONTEND_URL/reset-password?token= │
│     - Link expires after 1 hour                               │
│     - Email notifies user if they did not request reset       │
│                                                               │
│  4. User resets password                                      │
│     POST /api/v1/auth/reset-password                          │
│     { token, newPassword }                                    │
│     ➤ Token verified (hash comparison)                       │
│     ➤ Token not expired                                      │
│     ➤ New password meets requirements                        │
│     ➤ All existing sessions invalidated                      │
│     ➤ Confirmation email sent                                │
└───────────────────────────────────────────────────────────────┘
```

### Registration Domain Restriction

Scrumooth supports an **opt-in email domain restriction** that limits new-account registration to one or more configured email domains, suitable for single-organization self-hosted deployments.

- **Configuration:** set `REGISTRATION_ALLOWED_EMAIL_DOMAINS` (comma-separated, e.g., `example.com,example.eu`). Leave empty or unset for open registration (default). The list is lowercased and deduplicated at startup.
- **Enforcement (server-side, authoritative):** the domain allowlist is enforced in `auth.service.ts` during registration. A registration whose email domain is not in the allowlist is rejected with **`403 Forbidden`** and a localized message. The client is never the security boundary; direct API calls are equally subject to the check.
- **Scope:** applies to **new registrations only**. Login, password reset, and existing accounts are unaffected by the allowlist.
- **Matching:** exact, case-insensitive match on the email domain. Subdomains are **not** implicitly allowed (e.g., allowing `example.com` does **not** allow `sub.example.com`).
- **Policy endpoint:** `GET /api/v1/auth/registration-policy` returns `{ restricted, allowedDomains }` (unauthenticated) so the frontend can surface guidance; it does not weaken enforcement.
- **Startup validation:** malformed domains cause the process to fail fast with a descriptive error.
- **Documented limits:** this is a **tenant-control gate, not an email-verification or identity-proof mechanism**. It does not replace rate limiting, consent handling, or other abuse controls.

### Account Deletion

Account deletion follows a **14-day grace period** model for GDPR compliance:

```
User requests deletion
        │
        ▼
  Account marked as "pending_deletion"
  - Account locked (cannot log in)
  - 14-day grace period begins
  - Notification email sent
        │
        │ (14 days)
        ▼
  Account permanently deleted
  - User record removed
  - Personal data purged
  - Team contributions anonymized
  - Refresh tokens deleted
  - Sessions invalidated
  - Audit log of deletion created
```

**Cancellation**: During the grace period, the user can contact an administrator to cancel the deletion. After the grace period expires, deletion is irreversible.

### Privacy Controls

| Feature          | Implementation                                       |
| ---------------- | ---------------------------------------------------- |
| Marketing opt-in | Explicit consent toggle, tracked with timestamp      |
| Terms acceptance | Versioned terms, acceptance logged with date         |
| Data export      | GDPR-compliant export endpoint with consent tracking |
| Consent tracking | All consent actions logged in audit trail            |

## Security Best Practices and Compliance

### Secure Development Practices

#### Dependency Management

- Dependencies locked via `pnpm-lock.yaml` for reproducible builds.
- `pnpm audit --audit-level=high` runs on every CI push/PR.
- GitHub Dependabot configured for automated security updates.
- Dependency Review action runs on every PR to catch newly introduced vulnerabilities.

#### Code Quality Gates

Every change passes through automated security checks before merge:

| Gate               | Tool                          | Enforcement        |
| ------------------ | ----------------------------- | ------------------ |
| Type safety        | TypeScript strict mode        | Build failure      |
| Static analysis    | ESLint (security plugins)     | CI failure         |
| Code scanning      | CodeQL (security-and-quality) | SARIF upload       |
| Dependency audit   | pnpm audit                    | CI failure (high+) |
| Format consistency | Prettier                      | CI failure         |
| CSS linting        | Stylelint                     | CI failure         |

#### Secure Coding Standards

- **No `any` types**: TypeScript strict mode enforced; `any` usage generates warnings.
- **No raw SQL**: All database access through Prisma ORM parameterized queries.
- **No secrets in code**: All credentials via environment variables; `.env` files in `.gitignore`.
- **No `eval()` or `new Function()`**: Blocked by ESLint rules.
- **No console.log in production**: Winston structured logging used exclusively.
- **Error messages**: Do not expose internal details to clients (custom error classes).

### Operational Security

#### Secret Management

| Secret                   | Management Approach                                        |
| ------------------------ | ---------------------------------------------------------- |
| `JWT_SECRET`             | Environment variable, generated via `openssl rand -hex 64` |
| `DATABASE_URL`           | Environment variable, strong password (min 32 chars)       |
| SMTP credentials         | Environment variable                                       |
| API keys (SendGrid, AWS) | Environment variable                                       |
| Docker secrets           | Not committed; injected at deploy time                     |

**Secret rotation recommendations:**

- JWT secret: Every 90 days (requires all users to re-login).
- Database password: Every 90 days (requires coordinated service restart).
- SMTP credentials: Annually or when compromised.
- API keys: Per provider recommendations.

#### Production Deployment Checklist

Before deploying to production:

1. Set `NODE_ENV=production`
2. Configure `JWT_SECRET` (min 64 chars, generated via `openssl rand -hex 64`)
3. Set `CORS_ORIGIN` to production HTTPS domains only
4. Enable `EMAIL_TEST_MODE=false`
5. Configure valid SMTP/SendGrid/SES credentials
6. Set `LOG_LEVEL=info` (not debug)
7. Use strong `DATABASE_URL` password (min 32 chars)
8. Enable PostgreSQL filesystem encryption
9. Configure Caddy with valid domain for automatic HTTPS
10. Restrict host firewall to ports 80/443 only

### Compliance Considerations

#### GDPR Compliance Features

| Requirement         | Implementation                                          |
| ------------------- | ------------------------------------------------------- |
| Right to access     | Data export endpoint (`/api/v1/data-export`)            |
| Right to erasure    | Account deletion with 14-day grace period               |
| Consent management  | Marketing opt-in, terms acceptance tracking             |
| Data minimization   | Only necessary fields collected; configurable retention |
| Breach notification | Security incident response process in SECURITY.md       |
| Data portability    | JSON export of all user-associated data                 |
| Audit trail         | Comprehensive audit logging for all data operations     |

#### OWASP Top 10 Coverage

| OWASP Risk                  | Mitigation                                            |
| --------------------------- | ----------------------------------------------------- |
| Broken Access Control       | RBAC middleware, role hierarchy enforcement           |
| Cryptographic Failures      | bcrypt, SHA-256 hashing, HTTPS/TLS enforcement        |
| Injection                   | Prisma parameterized queries, Zod input validation    |
| Insecure Design             | Layered architecture, security reviews                |
| Security Misconfiguration   | Helmet headers, CORS whitelist, CSP                   |
| Vulnerable Components       | Automated dependency auditing, Dependabot             |
| Auth Failures               | JWT + refresh rotation, session limits, rate limiting |
| Software/Data Integrity     | Frozen lockfile, CodeQL, artifact integrity           |
| Logging/Monitoring Failures | Winston structured logging, audit trail, request IDs  |
| SSRF                        | No external URL fetching in application logic         |

### Vulnerability Reporting

Security vulnerabilities can be reported via GitHub Security Advisories. See [SECURITY.md](../../SECURITY.md) for the complete vulnerability disclosure policy, including:

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Resolution targets**: 7 days (critical), 14 days (high), 30 days (medium/low)
- **Safe harbor**: Protection for responsible security researchers

### Supported Versions

| Version | Supported | Status                 |
| ------- | --------- | ---------------------- |
| 1.0.x   | Yes       | Current stable release |

Only the latest stable release receives security updates. Users should upgrade promptly when new versions are released.

---

**Last Updated**: 2026-05-10

**Related Documentation**:

- [System Architecture](./system-architecture.md)
- [Deployment Architecture](./deployment-architecture.md)
- [Data Model](./data-model.md)
- [API Specifications](./api-specifications.md)
- [SECURITY.md](../../SECURITY.md)
