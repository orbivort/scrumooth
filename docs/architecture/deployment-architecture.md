# Deployment Architecture

This document provides a comprehensive overview of the Scrumooth deployment architecture, including container orchestration, CI/CD pipelines, environment configuration, scaling strategy, monitoring, backup procedures, and the differences between development and production setups.

## Table of Contents

- [Container Architecture](#container-architecture)
- [Docker Compose Services](#docker-compose-services)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
- [Scaling Strategy](#scaling-strategy)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Development vs Production Setup](#development-vs-production-setup)

## Container Architecture

Scrumooth uses Docker multi-stage builds to produce optimized, secure, and minimal production images for both the frontend and backend services.

### Backend Docker Image

The backend is built using a two-stage Dockerfile at `packages/backend/Dockerfile`:

```
┌──────────────────────────────────────────────────┐
│                  BUILD STAGE                     │
│  Base: node:24-alpine                            │
│                                                  │
│  1. Install pnpm via corepack                    │
│  2. Copy workspace config + package.json files   │
│  3. pnpm install --frozen-lockfile               │
│  4. Install TypeScript & Prisma globally         │
│  5. Copy shared + backend source                 │
│  6. Generate Prisma client                       │
│  7. Build shared (tsc), then backend (tsc)       │
│  8. Fix ESM import extensions                    │
└──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────┐
│                PRODUCTION STAGE                  │
│  Base: node:24-alpine                            │
│                                                  │
│  1. Create non-root user (scrumooth:nodejs)      │
│  2. Create /app/logs directory                   │
│  3. Copy dist/, prisma/, node_modules/           │
│  4. Copy shared package to node_modules          │
│  5. Generate Prisma client at runtime            │
│  6. Switch to non-root user                      │
│  7. EXPOSE 5000 + HEALTHCHECK                    │
│  8. CMD: node dist/index.js                      │
└──────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Non-root user**: The container runs as the `scrumooth` user (UID 1001), not root, following the principle of least privilege.
- **Frozen lockfile**: `pnpm install --frozen-lockfile` ensures reproducible builds across environments.
- **Prisma generation at runtime**: Allows the Prisma client to be generated against the actual production database schema after deployment.
- **Shared package co-location**: The shared package is placed inside `node_modules/@scrumooth/shared/` so Node.js module resolution works correctly.
- **Import extension fixing**: A post-build script adds `.js` extensions to ESM imports since TypeScript does not emit them automatically.

### Frontend Docker Image

The frontend is built using a two-stage Dockerfile at `packages/frontend/Dockerfile`:

```
┌──────────────────────────────────────────────────┐
│                  BUILD STAGE                     │
│  Base: node:24-alpine                            │
│                                                  │
│  1. Install pnpm via corepack                    │
│  2. Copy workspace config + package.json files   │
│  3. pnpm install --frozen-lockfile               │
│  4. Install TypeScript globally                  │
│  5. Copy shared + frontend source                │
│  6. Build shared (tsc)                           │
│  7. Type-check frontend (tsc --noEmit)           │
│  8. Build frontend (vite build)                  │
└──────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────┐
│                PRODUCTION STAGE                  │
│  Base: nginx:alpine                              │
│                                                  │
│  1. Copy built assets to /usr/share/nginx/html   │
│  2. Copy nginx.conf                              │
│  3. Set permissions for nginx user               │
│  4. Switch to nginx user (non-root)              │
│  5. EXPOSE 80 + HEALTHCHECK                      │
└──────────────────────────────────────────────────┘
```

**Key design decisions:**

- **nginx for static serving**: Lightweight, battle-tested HTTP server with built-in gzip compression, caching headers, and SPA routing support.
- **TypeScript validation before Vite build**: `tsc --noEmit` runs strict type checking separately before Vite's transpile-only build, catching type errors that Vite would ignore.
- **Static asset caching**: nginx configuration sets `Cache-Control: public, immutable` with a 1-year expiry for hashed static assets (`*.js`, `*.css`, fonts, images).
- **SPA routing**: `try_files $uri $uri/ /index.html` ensures client-side routes are handled by the React application.
- **API proxy**: The nginx configuration includes a reverse proxy for `/api` requests to the backend service.

### Development Docker Images

Development images at `packages/backend/Dockerfile.dev` and `packages/frontend/Dockerfile.dev` use a single-stage design with hot reload support:

- **Backend dev**: Mounts `src/` and `prisma/` as volumes for hot reload; exposes port 5000.
- **Frontend dev**: Mounts `src/` and `public/` as volumes; exposes Vite dev server on port 5173.
- Both use `node:24-alpine` base and install dependencies with `npm install` for simplicity.

## Docker Compose Services

The production deployment is orchestrated via `docker-compose.yml` with six services:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRUMOOTH DOCKER COMPOSE                     │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │  Caddy   │◄──►│ Frontend │◄──►│ Backend  │◄──►│PgBouncer │   │
│  │  :80/443 │    │   :80    │    │  :5000   │    │  :6432   │   │
│  └──────────┘    └──────────┘    └──────────┘    └────┬─────┘   │
│       │                                                │        │
│       │                  ┌──────────┐                  │        │
│       │                  │PostgreSQL│◄─────────────────┘        │
│       │                  │  :5432   │                           │
│       │                  └────┬─────┘                           │
│       │                       │                                 │
│       │         ┌─────────────┼─────────────┐                   │
│       │         │             │             │                   │
│       │    ┌────┴────┐  ┌─────┴──────┐                          │
│       │    │ Backup  │  │Vol-Backup │                           │
│       │    │ (SQL)  │  │(Volume)   │                            │
│       │    └─────────┘  └───────────┘                           │
│       │                                                         │
│  ┌────┴─────────────────────────────────────┐                   │
│  │         Volumes                           │                  │
│  │  - scrumooth_postgres_data               │                   │
│  │  - caddy_data / caddy_config             │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                 │
│  Network: scrumooth-network (bridge driver)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Service Details

#### 1. Caddy (Reverse Proxy)

| Attribute       | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| Image           | `caddy:2-alpine`                                                  |
| Purpose         | TLS termination, automatic HTTPS, reverse proxy, security headers |
| Ports           | 80 (HTTP), 443 (HTTPS)                                            |
| Health Check    | `caddy validate --config /etc/caddy/Caddyfile`                    |
| Resource Limits | 0.5 CPU / 128 MB memory                                           |

The Caddyfile configures:

- **Automatic HTTPS** via Let's Encrypt (production) or plain HTTP (development via `http://localhost`).
- **Reverse proxy** routing: `/api/*` and `/health` proxy to backend, all other traffic to frontend.
- **Security headers**: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Content-Security-Policy.
- **HTTP-to-HTTPS redirect** for non-health-check traffic.

#### 2. Backend (Express API)

| Attribute       | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| Build Context   | Root directory, `packages/backend/Dockerfile`, target: `production` |
| Expose          | 5000                                                                |
| Health Check    | HTTP GET `localhost:5000/health` returning 200                      |
| Dependencies    | PostgreSQL (healthy)                                                |
| Resource Limits | 1.0 CPU / 512 MB memory                                             |
| Env File        | `./packages/backend/.env.production`                                |

#### 3. Frontend (nginx + React SPA)

| Attribute       | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Build Context   | Root directory, `packages/frontend/Dockerfile`, target: `production` |
| Expose          | 80                                                                   |
| Health Check    | `wget --spider http://127.0.0.1/`                                    |
| Dependencies    | Backend (healthy)                                                    |
| Resource Limits | 0.5 CPU / 128 MB memory                                              |

#### 4. PostgreSQL (Database)

| Attribute       | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| Image           | `postgres:18-alpine`                                              |
| Environment     | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from env file |
| Volume          | `scrumooth_postgres_data:/var/lib/postgresql/data`                |
| Health Check    | `pg_isready -U postgres -d scrumooth`                             |
| Resource Limits | 1.0 CPU / 512 MB memory                                           |

PostgreSQL is configured with comprehensive query logging:

- `log_statement=mod` (log all DDL and data-modifying statements)
- `log_connections=on`, `log_disconnections=on`
- `log_checkpoints=on`, `log_lock_waits=on`
- `log_min_duration_statement=1000` (log queries taking over 1 second)
- Log output written to `/var/log/postgresql/` on a mounted volume.

#### 5. PgBouncer (Connection Pooling)

| Attribute       | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Image           | `pgbouncer/pgbouncer:1.22.1`                                             |
| Port            | 6432                                                                     |
| Pool Mode       | `transaction` (connections released after each transaction)              |
| Pool Config     | 20 default pool, 5 min, 5 reserve, 100 max client, 50 max DB connections |
| TLS             | Client TLS with cert/key from `./certs/pgbouncer/`                       |
| Resource Limits | 0.5 CPU / 128 MB memory                                                  |

#### 6. Backup Services

**SQL Backup (`backup`)**:

- Uses `postgres:18-alpine` image with `cron` to run `db-backup.sh` daily at 2 AM.
- Creates SQL dumps in `./backups/` directory.
- Outputs to `./backups/backup.log`.

**Volume Backup (`volume-backup`)**:

- Uses `docker:cli` image with `cron` to run `db-volume-backup.sh` weekly on Sundays at 3 AM.
- Creates file-level backups of the PostgreSQL data volume.
- Requires read-only access to the Docker socket for volume inspection.

### Network Architecture

All services communicate over a single Docker bridge network (`scrumooth-network`). The backend port (5000) and frontend port (80) are only exposed internally; only Caddy's ports (80/443) and PgBouncer's port (6432) are published to the host, ensuring that all external traffic passes through the reverse proxy.

## CI/CD Pipeline

Scrumooth uses GitHub Actions for continuous integration and delivery. Two primary workflows manage the lifecycle: **CI** (quality gate) and **Release** (deployment artifact publishing).

### CI Workflow (`ci.yml`)

```
┌────────────────────────────────────────────────────────────────────┐
│                        CI WORKFLOW                                 │
│  Triggers: push/PR to main/develop, workflow_dispatch              │
│  Concurrency: cancel-in-progress per ref                           │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │    detect-changes       │
                    │  (dorny/paths-filter)   │
                    │  Outputs: backend,      │
                    │  frontend, shared       │
                    └────────────┬────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                     ▼
  ┌──────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │ lint-and-        │  │ dependency-     │  │ codeql          │
  │ typecheck        │  │ review          │  │ (security-and-  │
  │ (ESLint, Prettier│  │ (PR only)       │  │  quality)       │
  │  Stylelint, tsc) │  └─────────────────┘  └─────────────────┘
  └────────┬─────────┘
           │
    ┌──────┼──────────────────────────┐
    ▼      ▼              ▼           ▼
  ┌────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
  │test│ │test    │ │test-     │ │security- │
  │FE  │ │FE-E2E  │ │backend   │ │audit     │
  │unit│ │(sharded│ │+integrat.│ │(pnpm)    │
  │    │ │+smoke) │ │+e2e      │ │          │
  └──┬─┘ └───┬────┘ └────┬─────┘ └──────────┘
     │       │            │
     └───────┴────────────┘
              │
              ▼
    ┌──────────────────────┐
    │       build          │
    │  (pnpm run build)    │
    │  Upload artifacts    │
    │  (7-day retention)   │
    └──────────┬───────────┘
               │
      ┌────────┴────────┐
      ▼                  ▼
  ┌──────────┐    ┌───────────┐
  │bundle-   │    │performance│
  │size      │    │benchmarks │
  │analysis  │    │(vitest)   │
  └──────────┘    └───────────┘
```

**Job details:**

| Job                        | Runtime | Conditions                                              |
| -------------------------- | ------- | ------------------------------------------------------- |
| `detect-changes`           | ubuntu  | Always                                                  |
| `lint-and-typecheck`       | ubuntu  | On detected changes                                     |
| `dependency-review`        | ubuntu  | PR only (on detected changes)                           |
| `test-frontend`            | ubuntu  | On frontend/shared changes                              |
| `test-frontend-e2e`        | ubuntu  | On frontend/shared changes, main/develop only (sharded) |
| `test-frontend-e2e-smoke`  | ubuntu  | On frontend/shared changes, PR only (chromium, @smoke)  |
| `test-backend`             | ubuntu  | On backend/shared changes                               |
| `test-backend-integration` | ubuntu  | On backend/shared changes (PostgreSQL service)          |
| `test-backend-e2e`         | ubuntu  | On backend/shared changes (PostgreSQL service)          |
| `security-audit`           | ubuntu  | On detected changes (`pnpm audit --audit-level=high`)   |
| `codeql`                   | ubuntu  | On detected changes (TypeScript, security-and-quality)  |
| `build`                    | ubuntu  | After all tests pass (including skipped)                |
| `bundle-size`              | ubuntu  | After build, on frontend/shared changes                 |
| `performance`              | ubuntu  | After build, on backend/shared changes                  |

**Environment**: Node.js 24.19.0, pnpm 11.21.0. E2E tests use Playwright across Chromium, Firefox, and WebKit (full suite) or Chromium-only (smoke tests).

### Release Workflow (`release.yml`)

```
┌──────────────────────────────────────────────────────────────────┐
│                     RELEASE WORKFLOW                             │
│  Triggers: push tag v*, workflow_dispatch (version input)        │
│  Concurrency: per ref, no cancel-in-progress                     │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │      validate          │
                    │  - Verify semver tag   │
                    │  - Poll CI workflow    │
                    │    for success state   │
                    │    (12 attempts, 30s)  │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │    bump-version        │
                    │  - Generate changelog  │
                    │    from conv. commits  │
                    │  - Bump package.json   │
                    │    versions (4 files)  │
                    │  - Commit + push main  │
                    └───────────┬────────────┘
                                │
               ┌────────────────┼────────────────┐
               ▼                                 ▼
  ┌──────────────────────┐        ┌──────────────────────┐
  │ build-and-push-      │        │ build-and-push-      │
  │ backend              │        │ frontend             │
  │  - Login to GHCR     │        │  - Login to GHCR     │
  │  - Docker metadata:  │        │  - Docker metadata:  │
  │    * semver tag      │        │    * semver tag      │
  │    * major.minor tag │        │    * major.minor tag │
  │    * SHA tag         │        │    * SHA tag         │
  │    * latest tag      │        │    * latest tag      │
  │  - Buildx build/push │        │  - Buildx build/push │
  │  - GHA cache         │        │  - GHA cache         │
  └──────────┬───────────┘        └───────────┬──────────┘
             │                                │
             └───────────────┬────────────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │      smoke-test        │
                 │  - Pull images from    │
                 │    GHCR                │
                 │  - docker compose up   │
                 │    (postgres, backend, │
                 │     frontend)          │
                 │  - Health checks       │
                 │  - Migration test      │
                 │  - Cleanup             │
                 └───────────┬────────────┘
                             │
                             ▼
                 ┌────────────────────────┐
                 │    github-release      │
                 │  - Extract changelog   │
                 │  - Build release body  │
                 │    with docker pull    │
                 │    instructions        │
                 │  - Create GH Release   │
                 └────────────────────────┘
```

**Image tags published to GHCR**:

| Tag Pattern       | Example       | Purpose                     |
| ----------------- | ------------- | --------------------------- |
| `{version}`       | `1.2.0`       | Exact version pinning       |
| `{major}.{minor}` | `1.2`         | Minor version tracking      |
| `sha-{hash}`      | `sha-a1b2c3d` | Commit-level traceability   |
| `latest`          | `latest`      | Rolling latest for dev/test |

**Safety gates**:

- The release workflow polls for CI success on the tagged commit (up to 6 minutes) before proceeding.
- Version bump commits are pushed back to `main` with `[bot]` authorship.
- Smoke tests validate the entire stack (PostgreSQL, backend, frontend) end-to-end before creating the GitHub Release.

## Environment Configuration

### Configuration File Hierarchy

```
packages/backend/
├── .env.example             # Development template (port 5001, test mode on)
├── .env                     # Local development (gitignored)
├── .env.production.example  # Production template with security guidance
└── .env.production          # Production values (gitignored, used by docker-compose)

packages/frontend/
├── .env.example             # Development template (localhost:5001)
├── .env                     # Local development (gitignored)
├── .env.production.example  # Production template
└── .env.production          # Production values (gitignored)
```

### Backend Environment Variables by Category

#### Server Configuration

| Variable     | Type    | Default (dev) | Default (prod) | Description         |
| ------------ | ------- | ------------- | -------------- | ------------------- |
| `PORT`       | integer | 5001          | 5000           | HTTP listen port    |
| `NODE_ENV`   | string  | development   | production     | Node.js environment |
| `API_PREFIX` | string  | `/api`        | `/api`         | API route prefix    |

#### Database Configuration

| Variable       | Type   | Required | Format                                        |
| -------------- | ------ | -------- | --------------------------------------------- |
| `DATABASE_URL` | url    | Yes      | `postgresql://user:pass@host:port/database`   |
| `DB_USER`      | string | Optional | PostgreSQL username (Docker deployments)      |
| `DB_PASSWORD`  | string | Optional | PostgreSQL password (Docker deployments)      |
| `DB_NAME`      | string | Optional | PostgreSQL database name (Docker deployments) |

#### JWT & Session Configuration

| Variable                       | Type    | Default        | Description                         |
| ------------------------------ | ------- | -------------- | ----------------------------------- |
| `JWT_SECRET`                   | string  | auto-generated | JWT signing key (min 64 chars prod) |
| `JWT_EXPIRES_IN`               | string  | 15m            | Access token TTL                    |
| `JWT_REFRESH_EXPIRES_IN`       | string  | 7d             | Refresh token TTL                   |
| `SESSION_IDLE_TIMEOUT_MS`      | integer | 1800000 (30m)  | Idle session timeout                |
| `SESSION_ABSOLUTE_TIMEOUT_MS`  | integer | 86400000 (24h) | Absolute session limit              |
| `SESSION_WARNING_THRESHOLD_MS` | integer | 120000 (2m)    | Warning before timeout              |
| `SESSION_CLEANUP_INTERVAL_MS`  | integer | 3600000 (1h)   | Expired session cleanup interval    |
| `MAX_CONCURRENT_SESSIONS`      | integer | 5              | Max sessions per user               |

#### Security Configuration

| Variable               | Type    | Default | Description             |
| ---------------------- | ------- | ------- | ----------------------- |
| `BCRYPT_SALT_ROUNDS`   | integer | 12      | Password hashing rounds |
| `TOKEN_HASH_ALGORITHM` | string  | sha256  | Refresh token hash algo |

#### Rate Limiting

| Variable                         | Type    | Default      | Description                    |
| -------------------------------- | ------- | ------------ | ------------------------------ |
| `RATE_LIMIT_WINDOW_MS`           | integer | 900000 (15m) | General rate limit window      |
| `RATE_LIMIT_MAX_REQUESTS`        | integer | 100          | Max requests per window        |
| `AUTH_RATE_LIMIT_MAX`            | integer | 5            | Auth endpoint limit            |
| `LOGIN_RATE_LIMIT_MAX`           | integer | 10           | Login endpoint limit           |
| `FORGOT_PASSWORD_RATE_LIMIT_MAX` | integer | 3            | Password reset request limit   |
| `RESET_PASSWORD_RATE_LIMIT_MAX`  | integer | 5            | Password reset execution limit |

#### CORS Configuration

| Variable      | Type | Default (dev)                     | Description          |
| ------------- | ---- | --------------------------------- | -------------------- |
| `CORS_ORIGIN` | csv  | `http://localhost:5173,5174,5175` | Allowed CORS origins |

#### Logging Configuration

| Variable        | Type   | Default      | Description          |
| --------------- | ------ | ------------ | -------------------- |
| `LOG_LEVEL`     | string | debug / info | Winston log level    |
| `LOG_DIR`       | string | logs         | Log output directory |
| `LOG_MAX_FILES` | string | 14d          | Max log file age     |
| `LOG_MAX_SIZE`  | string | 20m          | Max log file size    |
| `LOG_FORMAT`    | string | json         | Log output format    |

#### Email Configuration

| Variable             | Type    | Default                   | Description                   |
| -------------------- | ------- | ------------------------- | ----------------------------- |
| `EMAIL_PROVIDER`     | string  | smtp                      | Provider: smtp, sendgrid, ses |
| `EMAIL_TEST_MODE`    | boolean | true (dev) / false (prod) | Disable actual email sending  |
| `EMAIL_FROM_ADDRESS` | string  | noreply@scrumooth.local   | Sender address                |
| `FRONTEND_URL`       | url     | http://localhost:5173     | URL for email links           |
| `SMTP_HOST`          | string  | -                         | SMTP server host              |
| `SMTP_PORT`          | integer | 587                       | SMTP port                     |
| `SMTP_USER`          | string  | -                         | SMTP username                 |
| `SMTP_PASS`          | string  | -                         | SMTP password                 |

### Frontend Environment Variables

| Variable                  | Type    | Default                        | Description                                                     |
| ------------------------- | ------- | ------------------------------ | --------------------------------------------------------------- |
| `VITE_API_URL`            | url     | `http://localhost:5001/api/v1` | Backend API URL                                                 |
| `VITE_API_TIMEOUT`        | integer | 30000                          | API request timeout (ms)                                        |
| `VITE_USE_MOCK_API`       | boolean | unset (off)                    | `'true'` answers HTTP from the mock backend instead of a server |
| `VITE_MOCK_LATENCY_MS`    | integer | 60                             | Latency added to every mocked response; `0` disables it         |
| `VITE_DEV_PORT`           | integer | 5173                           | Vite dev server port                                            |
| `VITE_BACKLOG_ITEM_LIMIT` | integer | 200                            | Max backlog items per request                                   |
| `VITE_LOG_LEVEL`          | string  | debug (dev) / info (prod)      | Frontend log level                                              |
| `VITE_SENTRY_DSN`         | string  | -                              | Sentry error reporting DSN                                      |
| `VITE_AVATAR_SERVICE_URL` | url     | - (disabled)                   | Avatar generation service (self-hosted only)                    |

Mock mode is an explicit opt-in and a production-mode build refuses it: `vite.config.ts`
fails the build when `VITE_USE_MOCK_API=true` and `mode === 'production'`. A build with
mocks enabled — a **demo build** — is produced only through `--mode demo`, backed by
the committed `packages/frontend/.env.demo`. See
[Frontend Mock Architecture](./frontend-mock-architecture.md).

### Production Deployment Checklist

Before deploying to production, the following must be configured in `packages/backend/.env.production`:

1. `NODE_ENV=production`
2. `DATABASE_URL` with a strong password (min 32 characters)
3. `JWT_SECRET` generated via `openssl rand -hex 64`
4. `CORS_ORIGIN` set to production HTTPS domains only
5. `EMAIL_TEST_MODE=false`
6. `FRONTEND_URL` set to the production frontend URL (HTTPS)
7. Valid SMTP/SendGrid/SES email credentials
8. `LOG_LEVEL` set to `info` or `warn`

## Scaling Strategy

### Stateless Backend Design

The backend is designed to scale horizontally:

```
                     ┌──────────────┐
                     │   Caddy LB   │
                     │  (reverse    │
                     │   proxy)     │
                     └──────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
            ▼               ▼               ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ Backend-1  │ │ Backend-2  │ │ Backend-N  │
     │ (Express)  │ │ (Express)  │ │ (Express)  │
     └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
            │               │               │
            └───────────────┼───────────────┘
                            │
                     ┌──────┴───────┐
                     │  PgBouncer   │
                     │  (connection │
                     │   pooling)   │
                     └──────┬───────┘
                            │
                     ┌──────┴───────┐
                     │ PostgreSQL   │
                     │  (primary)   │
                     └──────────────┘
```

**Key properties enabling horizontal scaling:**

- **No server-side sessions**: Authentication state is stored in JWT tokens and database-backed sessions, not in server memory. Any backend instance can handle any request.
- **Stateless service layer**: Business logic has no reliance on local instance state.
- **Externalized logging**: Winston writes to files on mounted volumes, not buffered in memory.

### Connection Pooling with PgBouncer

PgBouncer sits between the backend and PostgreSQL to manage database connections efficiently:

| Setting                | Value       | Rationale                                    |
| ---------------------- | ----------- | -------------------------------------------- |
| Pool Mode              | transaction | Releases connection after each transaction   |
| Default Pool Size      | 20          | Sufficient for typical load                  |
| Min Pool Size          | 5           | Always-ready connections to avoid cold start |
| Reserve Pool Size      | 5           | Handle traffic bursts                        |
| Max Client Connections | 100         | Upper bound for concurrent backend processes |
| Max DB Connections     | 50          | PostgreSQL connection limit buffer           |
| Server Idle Timeout    | 600s        | Reclaim idle connections                     |
| Server Lifetime        | 3600s       | Force connection rotation                    |

This setup supports multiple backend instances sharing a bounded pool of PostgreSQL connections, preventing connection exhaustion.

### Future Scaling Considerations

- **Read replicas**: PostgreSQL streaming replication for read-heavy workloads. Backend services would route writes to the primary and reads to replicas.
- **Redis caching layer**: Reduce database load for frequently accessed data (user profiles, team configurations, workflow definitions).
- **CDN integration**: Serve static frontend assets via a CDN for global distribution.
- **Kubernetes migration**: Replace docker-compose with Kubernetes for multi-node orchestration, auto-scaling, and rolling updates.

## Monitoring and Logging

### Winston Structured Logging

The backend uses Winston for structured, JSON-formatted logging:

```
┌───────────────────────────────────────────┐
│            WINSTON LOGGING                │
│                                           │
│  ┌─────────────┐    ┌─────────────────┐   │
│  │ Console     │    │ File Transports │   │
│  │ Transport   │    │                 │   │
│  │ - Colored   │    │ - Combined logs │   │
│  │   output    │    │   (14d retention)│  │
│  │ - Dev only  │    │ - Error logs    │   │
│  └─────────────┘    │   (30d retention)│  │
│                     │ - Audit logs    │   │
│                     │   (30d retention)│  │
│                     │ - Max 20MB each │   │
│                     └─────────────────┘   │
│                                           │
│  Log Levels: debug < info < warn < error  │
│  Format: JSON (structured, machine-       │
│          readable with timestamp, level,  │
│          message, request ID)             │
└───────────────────────────────────────────┘
```

**Log retention policies:**

| Log Type | Retention | Rationale                            |
| -------- | --------- | ------------------------------------ |
| Combined | 14 days   | General application logs             |
| Error    | 30 days   | Extended retention for debugging     |
| Audit    | 30 days   | Security and compliance requirements |

### Health Check Endpoint

The `/health` endpoint provides a comprehensive status assessment:

```
GET /health

Response:
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2026-05-10T...",
  "uptime": 12345.678,
  "database": {
    "status": "connected" | "disconnected" | "timeout",
    "responseTime": 12
  },
  "eventLoop": {
    "max": 45,
    "avg": 12,
    "min": 3
  },
  "version": "1.0.0",
  "nodeVersion": "v24.19.0"
}
```

**Status determination logic:**

| Condition                                              | Status      |
| ------------------------------------------------------ | ----------- |
| Database connected AND event loop max < warn threshold | `healthy`   |
| Event loop max > warn threshold but < critical         | `degraded`  |
| Database disconnected/timeout OR event loop > critical | `unhealthy` |

Docker health checks use this endpoint with a Node.js one-liner that exits with code 0 on HTTP 200.

### Docker Container Health Checks

Each service has a health check defined in `docker-compose.yml`:

| Service    | Health Check Command                             | Interval | Timeout | Retries | Start Period |
| ---------- | ------------------------------------------------ | -------- | ------- | ------- | ------------ |
| Caddy      | `caddy validate --config /etc/caddy/Caddyfile`   | 30s      | 10s     | 3       | 10s          |
| Backend    | `node -e "http.get('/health')"` (HTTP 200 check) | 30s      | 10s     | 3       | 30s          |
| Frontend   | `wget --spider http://127.0.0.1/`                | 30s      | 10s     | 3       | 10s          |
| PostgreSQL | `pg_isready -U postgres -d scrumooth`            | 10s      | 5s      | 5       | 30s          |
| PgBouncer  | `pg_isready -h localhost -p 6432`                | 10s      | 5s      | 5       | 10s          |

### Event Loop Monitoring

The backend runs an event loop monitor (`eventLoopMonitor`) that tracks Node.js event loop latency:

- **Resolution**: 10 ms sampling interval
- **Warning threshold**: 100 ms (triggers `degraded` health status)
- **Critical threshold**: 500 ms (triggers `unhealthy` health status)
- **Metrics exposed**: min, max, average event loop delay via the `/health` endpoint

### Request Tracing

Every request is assigned a unique request ID via the `requestId` middleware. This ID is:

- Included in all log entries for that request.
- Returned in the `X-Request-ID` response header.
- Stored in `AsyncLocalStorage` context for access throughout the request lifecycle.

### Container Logging

All Docker services use the `json-file` logging driver with log rotation:

- `max-size: 10m` per log file
- `max-file: 5` (frontend, backend, postgres, pgbouncer) or `max-file: 3` (backup services)

## Backup and Recovery

### SQL Dump Backups

The `backup` service runs automated SQL dumps:

```
Schedule: Daily at 2:00 AM
Location: ./backups/ (host-mounted volume)
Script:   scripts/maintenance/database/db-backup.sh
Format:   pg_dump (plain SQL)
Logging:  ./backups/backup.log
```

**Backup approach:**

- Uses `pg_dump` against the PostgreSQL container via the `PGHOST=postgres` network connection.
- Outputs plain SQL files that can be restored with `psql`.
- The backup directory should be synchronized to off-site storage for disaster recovery.

### Volume Backups

The `volume-backup` service handles file-level volume backups:

```
Schedule: Weekly on Sunday at 3:00 AM
Location: ./backups/volumes/ (host-mounted volume)
Script:   scripts/maintenance/database/db-volume-backup.sh
Source:   scrumooth_postgres_data volume (read-only mount)
Logging:  ./backups/volumes/volume-backup.log
```

**Backup approach:**

- Copies PostgreSQL data files from the Docker volume directly.
- Provides point-in-time file-level recovery capability.
- Requires Docker socket access (read-only) for volume inspection.

### Restoration Procedure

```
┌─────────────────────────────────────────────────────┐
│               RESTORATION WORKFLOW                  │
│                                                     │
│  1. Stop application services                       │
│     docker compose stop backend frontend            │
│                                                     │
│  2. Restore SQL dump                                │
│     docker compose exec -T postgres \               │
│       psql -U postgres -d scrumooth \               │
│       < backups/scrumooth_YYYYMMDD_HHMMSS.sql       │
│                                                     │
│  3. (Alternative) Restore volume backup             │
│     - Stop all services                             │
│     - Restore volume data from backup archive       │
│     - Start services                                │
│                                                     │
│  4. Run migrations (if schema drift)                │
│     docker compose exec backend \                   │
│       npx prisma migrate deploy                     │
│                                                     │
│  5. Start application services                      │
│     docker compose up -d backend frontend           │
│                                                     │
│  6. Verify with health checks                       │
│     curl http://localhost:5000/health               │
└─────────────────────────────────────────────────────┘
```

## Development vs Production Setup

### Comparison Matrix

| Aspect                 | Development                                    | Production                                  |
| ---------------------- | ---------------------------------------------- | ------------------------------------------- |
| **Compose file**       | `docker-compose.dev.yml`                       | `docker-compose.yml`                        |
| **Backend image**      | `Dockerfile.dev` (single-stage, hot reload)    | `Dockerfile` (multi-stage, optimized)       |
| **Frontend image**     | `Dockerfile.dev` (Vite dev server, hot reload) | `Dockerfile` (nginx static serving)         |
| **Reverse proxy**      | None (direct port access)                      | Caddy (TLS termination, security headers)   |
| **PgBouncer**          | Not used                                       | Enabled (connection pooling)                |
| **Backup services**    | Not used                                       | SQL daily + volume weekly                   |
| **PostgreSQL**         | `scrumooth_dev` database                       | `scrumooth` database                        |
| **PostgreSQL ports**   | 5432 exposed to host                           | 5432 internal only                          |
| **Backend ports**      | 5000 exposed to host                           | 5000 internal only                          |
| **Frontend ports**     | 5173 exposed to host                           | 80 internal only                            |
| **Volumes**            | `scrumooth_postgres_dev_data`                  | Production data + caddy_data + caddy_config |
| **Env file**           | `packages/backend/.env`                        | `packages/backend/.env.production`          |
| **NODE_ENV**           | `development`                                  | `production`                                |
| **Email test mode**    | `true` (emails saved to files)                 | `false` (emails actually sent)              |
| **Log level**          | `debug`                                        | `info` or `warn`                            |
| **CORS origin**        | `http://localhost:5173,5174,5175`              | Production HTTPS domain(s)                  |
| **Rate limiting**      | Enabled (standard limits)                      | Enabled (stricter auth limits)              |
| **Source volumes**     | Mounted for hot reload                         | Not mounted (built-in assets only)          |
| **PostgreSQL logging** | Minimal                                        | Full (connections, statements, checkpoints) |
| **Resource limits**    | Not enforced                                   | CPU/Memory limits per service               |

### Development Workflow

**Starting development environment:**

```bash
docker compose -f docker-compose.dev.yml up -d
```

This launches three services:

1. **postgres** (`scrumooth-postgres-dev`): PostgreSQL 18 on port 5432 with `scrumooth_dev` database.
2. **backend** (`scrumooth-backend-dev`): Express with hot reload, port 5000, mounts `src/`, `prisma/`, and `shared/src/`.
3. **frontend** (`scrumooth-frontend-dev`): Vite dev server with HMR, port 5173, mounts `src/`, `public/`, and `shared/src/`.

Source code changes on the host are immediately reflected inside the containers via bind mounts, enabling rapid iteration without rebuilding images.

**Key differences from production:**

- No Caddy reverse proxy; services accessed directly on their exposed ports.
- No PgBouncer; backend connects directly to PostgreSQL.
- No backup services running.
- Email test mode saves emails to `logs/emails/` instead of sending them.

### Production Deployment Workflow

**First-time deployment:**

```bash
# 1. Clone repository at specific version
git clone --depth 1 --branch v1.0.0 https://github.com/orbivort/scrumooth.git
cd scrumooth

# 2. Configure environment
cp packages/backend/.env.production.example packages/backend/.env.production
# Edit .env.production with your settings (see checklist above)

# 3. Start all services
docker compose up -d

# 4. Verify deployment
curl http://localhost:5000/health
```

**Updating to a new version:**

```bash
# 1. Pull latest images
docker compose pull

# 2. Recreate containers with new images
docker compose up -d --remove-orphans

# 3. Run migrations (if needed)
docker compose exec backend npx prisma migrate deploy
```

---

**Last Updated**: 2026-05-10

**Related Documentation**:

- [System Architecture](./system-architecture.md)
- [Security Architecture](./security-architecture.md)
- [Data Model](./data-model.md)
- [API Specifications](./api-specifications.md)
