# Docker Image Deployment Guide

This document provides a comprehensive guide for deploying Scrumooth using pre-built Docker images from GitHub Container Registry (GHCR). It covers pulling images, configuring environments, running containers, and verifying successful deployment.

## Table of Contents

- [Overview](#overview)
- [Container Registry Information](#container-registry-information)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Image Details](#image-details)
- [Deployment Methods](#deployment-methods)
  - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Method 2: Individual Container Deployment](#method-2-individual-container-deployment)
  - [Method 3: Kubernetes Deployment](#method-3-kubernetes-deployment)
- [Environment Configuration](#environment-configuration)
- [Port Mapping](#port-mapping)
- [Volume Mounting](#volume-mounting)
- [PgBouncer and Backup Services](#pgbouncer-and-backup-services)
- [Database Setup](#database-setup)
- [Verification Steps](#verification-steps)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Troubleshooting](#troubleshooting)
- [Upgrading](#upgrading)

---

## Overview

Scrumooth Docker images are automatically built and published to GitHub Container Registry (GHCR) when a release tag is created. The release workflow:

1. Validates the version tag format (e.g., `v1.2.0`)
2. Verifies CI has passed on the tagged commit
3. Builds multi-stage Docker images for backend and frontend
4. Pushes images to GHCR with multiple tags
5. Runs smoke tests against the published images
6. Creates a GitHub Release with deployment instructions

### Image Tags

Each release produces the following tags for both backend and frontend images:

| Tag Pattern       | Example       | Purpose                                            |
| ----------------- | ------------- | -------------------------------------------------- |
| `{version}`       | `1.2.0`       | Exact version pinning (recommended for production) |
| `{major}.{minor}` | `1.2`         | Minor version tracking (receives patch updates)    |
| `sha-{hash}`      | `sha-a1b2c3d` | Commit-level traceability                          |
| `latest`          | `latest`      | Rolling latest (use with caution in production)    |

---

## Container Registry Information

- **Registry**: `ghcr.io`
- **Repository**: `ghcr.io/{owner}/scrumooth`
- **Images**:
  - Backend: `ghcr.io/{owner}/scrumooth/backend`
  - Frontend: `ghcr.io/{owner}/scrumooth/frontend`

> **Note**: Replace `{owner}` with the actual GitHub repository owner (e.g., `orbivort`).

---

## Prerequisites

Before deploying Scrumooth Docker images, ensure you have:

### Required Software

| Software       | Minimum Version | Purpose                       |
| -------------- | --------------- | ----------------------------- |
| Docker         | 24.0+           | Container runtime             |
| Docker Compose | 2.20+           | Multi-container orchestration |
| PostgreSQL     | 18+             | Database (or use Docker)      |

> **Note for Windows Users**: The commands in this document use bash syntax. Run them in **WSL (Windows Subsystem for Linux)**, **Git Bash**, or use PowerShell equivalents. For PowerShell:
>
> - Use `$env:VARIABLE` instead of `$VARIABLE`
> - Use `Set-Content -Path .env -Value "content"` instead of `cat > .env << 'EOF'`
> - Use `Invoke-WebRequest` or `curl` (PowerShell alias) instead of bash `curl`

### System Requirements

| Component | Minimum | Recommended | Production             |
| --------- | ------- | ----------- | ---------------------- |
| CPU       | 2 cores | 4 cores     | 8+ cores               |
| RAM       | 4 GB    | 8 GB        | 16+ GB                 |
| Disk      | 20 GB   | 50 GB       | 100+ GB (with backups) |

### Network Requirements

- Port 80 (HTTP) - for initial connection and Let's Encrypt challenges
- Port 443 (HTTPS) - for secure access
- Port 5432 (PostgreSQL) - if exposing database externally (optional)

---

## Quick Start

### Option A: One-Command Deployment (Recommended)

For the fastest deployment experience, use the provided deployment script:

```bash
# Clone the repository (or download just the script)
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth

# Run the deployment script
./scripts/deployment/deploy.sh                    # Deploy latest to localhost
./scripts/deployment/deploy.sh 1.0.0              # Deploy version 1.0.0 to localhost
./scripts/deployment/deploy.sh 1.0.0 example.com  # Deploy version 1.0.0 to example.com
```

The script will:

1. Pull Docker images from GHCR
2. Generate secure configuration (JWT secrets, database passwords)
3. Validate configuration before deployment
4. Create Docker Compose file and Caddyfile
5. Deploy and verify all services
6. Display access URL and next steps

> **Note**: The script is designed for Linux/macOS. Windows users should run it in WSL or Git Bash. See [scripts/deployment/README.md](../../scripts/deployment/README.md) for the full reference (including its handling of build-time Vite variables).

> **Important**: Because the script pulls pre-built images and creates its own `.env.production` and `docker-compose.prod.yml`, it is the recommended path for a **checkout-free, image-only** deployment. It also configures the automated backup services, so you do not need the repository source tree at runtime.

### Option B: Manual Deployment

### 1. Authenticate with GHCR

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Or for public repositories, images can be pulled without authentication:

```bash
docker pull ghcr.io/orbivort/scrumooth/backend:latest
docker pull ghcr.io/orbivort/scrumooth/frontend:latest
```

### 2. Create Environment File

```bash
mkdir -p scrumooth-deployment
cd scrumooth-deployment

# Generate JWT secret first (run this command separately)
JWT_SECRET=$(openssl rand -hex 64)
echo "Generated JWT_SECRET: $JWT_SECRET"

cat > .env << 'EOF'
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password-here
DB_NAME=scrumooth

# Backend
# IMPORTANT: Replace with output from: openssl rand -hex 64
JWT_SECRET=PASTE_YOUR_GENERATED_JWT_SECRET_HERE
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
FRONTEND_URL=https://your-domain.com

# Email
EMAIL_PROVIDER=smtp
EMAIL_TEST_MODE=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM_ADDRESS=noreply@your-domain.com

# Domain (for Caddy)
DOMAIN=your-domain.com
EOF
```

> **Security Warning**: The `EMAIL_TEST_MODE=false` setting is **required** for production. If set to `true`, emails will be saved to files instead of being sent.

### 3. Create Docker Compose File

```bash
cat > docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    image: ghcr.io/orbivort/scrumooth/backend:1.0.0
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: ${NODE_ENV}
      CORS_ORIGIN: ${CORS_ORIGIN}
      FRONTEND_URL: ${FRONTEND_URL}
      EMAIL_PROVIDER: ${EMAIL_PROVIDER}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
    depends_on:
      postgres:
        condition: service_healthy
    expose:
      - "5010"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5010/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped

  frontend:
    image: ghcr.io/orbivort/scrumooth/frontend:1.0.0
    depends_on:
      backend:
        condition: service_healthy
    expose:
      - "80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1/"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
EOF
```

### 4. Deploy

```bash
docker compose up -d
```

### 5. Verify

```bash
curl http://localhost:5010/health
```

---

## Image Details

### Backend Image

| Attribute    | Value                             |
| ------------ | --------------------------------- |
| Base Image   | `node:24.14.1-slim` (Debian slim) |
| Architecture | `linux/amd64` (see note below)    |
| Exposed Port | `5010`                            |
| User         | `node` (non-root)                 |
| Health Check | HTTP GET `/health` endpoint       |

> **Note on architecture**: The published images are currently built for the runner's default platform (`linux/amd64`) only. `linux/arm64` images are not published yet. If you need ARM64, either build the images from source on an ARM host, or track the release workflow to add a `platforms` matrix.

**Image Contents**:

- `/app/dist/` - Compiled JavaScript
- `/app/prisma/` - Prisma schema and migrations
- `/app/node_modules/` - Production dependencies
- `/app/logs/` - Application logs directory

**Environment Variables Required**:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 64 characters)
- `NODE_ENV` - Set to `production`
- `CORS_ORIGIN` - Allowed CORS origins
- `FRONTEND_URL` - Frontend URL for email links

### Frontend Image

| Attribute    | Value                          |
| ------------ | ------------------------------ |
| Base Image   | `nginx:1.30-alpine`            |
| Architecture | `linux/amd64` (see note below) |
| Exposed Port | `80`                           |
| User         | `nginx` (non-root)             |
| Health Check | wget spider check on `/`       |

> **Note on architecture**: As with the backend image, the published frontend image is currently built for `linux/amd64` only. `linux/arm64` is not published yet.

**Image Contents**:

- `/usr/share/nginx/html/` - Static React application
- `/etc/nginx/nginx.conf` - nginx configuration

**nginx Configuration Features**:

- SPA routing support (`try_files`)
- API reverse proxy (`/api` → backend:5010)
- Gzip compression
- Static asset caching (1 year expiry)
- Security headers

### Build-Time vs. Runtime Configuration

Understanding which settings you can change after pulling an image is essential:

**Runtime configuration (fully overridable via env / `.env` / Kubernetes secrets):**

- `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `CORS_ORIGIN`, `FRONTEND_URL`
- All email settings (`EMAIL_*`, `SMTP_*`)
- `PORT`, `LOG_LEVEL`, session and rate-limit variables

These are read by the backend at startup (and validated by the entrypoint), so you can point a pulled image at **your own database** without rebuilding.

**Build-time configuration (baked into the published image, NOT overridable at runtime):**

The frontend's Vite environment variables are compiled into the JavaScript bundle during the Docker build and are fixed in the images published to GHCR:

| Variable                          | Value baked into published images |
| --------------------------------- | --------------------------------- |
| `VITE_BASE_PATH`                  | `/scrumooth/`                     |
| `VITE_API_URL`                    | `/api/v1`                         |
| `VITE_USE_MOCK_API`               | `false`                           |
| `VITE_BACKLOG_ITEM_LIMIT`         | `100`                             |
| `VITE_BACKLOG_MAX_ITEMS_PER_GOAL` | `200`                             |
| `VITE_LOG_LEVEL`                  | `info`                            |

These defaults assume the standard nginx `/api` → backend proxy and a `/scrumooth/` base path. To use different values, you must **build the frontend image locally** from source (e.g. via the repo's `docker-compose.yml`) rather than pulling a pre-built image. See the [deployment script notes](../../scripts/deployment/README.md) for a worked example.

---

## Deployment Methods

### Method 1: Docker Compose (Recommended)

Docker Compose provides the simplest way to deploy the full Scrumooth stack with proper networking, health checks, and service dependencies.

#### Step 1: Pull Images

```bash
# Pull specific version
docker pull ghcr.io/orbivort/scrumooth/backend:1.0.0
docker pull ghcr.io/orbivort/scrumooth/frontend:1.0.0

# Or pull latest
docker pull ghcr.io/orbivort/scrumooth/backend:latest
docker pull ghcr.io/orbivort/scrumooth/frontend:latest
```

#### Step 2: Create Configuration Files

Create the following directory structure:

```
scrumooth/
├── docker-compose.yml
├── .env
├── Caddyfile
└── backups/
```

#### Step 3: Configure Environment

Create `.env` file with your configuration:

```bash
# ===========================================
# Database Configuration
# ===========================================
DB_USER=postgres
DB_PASSWORD=your-secure-password-min-32-chars
DB_NAME=scrumooth

# ===========================================
# Backend Configuration
# ===========================================
# Generate with: openssl rand -hex 64
JWT_SECRET=your-jwt-secret-minimum-64-characters-long-for-production-security

NODE_ENV=production
PORT=5010

# CORS - comma-separated list of allowed origins
CORS_ORIGIN=https://scrumooth.yourdomain.com

# Frontend URL for email links
FRONTEND_URL=https://scrumooth.yourdomain.com

# ===========================================
# Email Configuration
# ===========================================
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Scrumooth"

# ===========================================
# Domain Configuration
# ===========================================
DOMAIN=scrumooth.yourdomain.com
```

#### Step 4: Create Caddyfile

```caddyfile
{$DOMAIN:localhost} {
    tls internal

    log {
        output stdout
        format console
    }

    handle /api/* {
        reverse_proxy backend:5010 {
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up Host {host}
        }
    }

    handle /health {
        reverse_proxy backend:5010
    }

    handle {
        reverse_proxy frontend:80
    }

    header {
        Strict-Transport-Security "max-age=31536000; include-subdomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}

:80 {
    handle /health {
        reverse_proxy backend:5010
    }
}
```

#### Step 5: Deploy

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

#### Step 6: Initialize Database

```bash
# Run Prisma migrations
docker compose exec backend npx prisma migrate deploy
```

### Method 2: Individual Container Deployment

For environments where Docker Compose is not available, you can run containers individually.

#### Step 1: Create Docker Network

```bash
docker network create scrumooth-network
```

#### Step 2: Start PostgreSQL

```bash
docker run -d \
  --name scrumooth-postgres \
  --network scrumooth-network \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your-secure-password \
  -e POSTGRES_DB=scrumooth \
  -v scrumooth_postgres_data:/var/lib/postgresql/data \
  --health-cmd="pg_isready -U postgres -d scrumooth" \
  --health-interval=10s \
  --health-timeout=5s \
  --health-retries=5 \
  postgres:18-alpine
```

#### Step 3: Start Backend

```bash
docker run -d \
  --name scrumooth-backend \
  --network scrumooth-network \
  -e DATABASE_URL="postgresql://postgres:your-secure-password@scrumooth-postgres:5432/scrumooth" \
  -e JWT_SECRET="your-jwt-secret-minimum-64-characters" \
  -e NODE_ENV=production \
  -e CORS_ORIGIN="https://your-domain.com" \
  -e FRONTEND_URL="https://your-domain.com" \
  -e EMAIL_PROVIDER=smtp \
  -e SMTP_HOST=smtp.example.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=your-smtp-user \
  -e SMTP_PASS=your-smtp-password \
  -e EMAIL_FROM_ADDRESS=noreply@example.com \
  --health-cmd='node -e "require(\"http\").get(\"http://localhost:5010/health\", (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"' \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  --health-start-period=30s \
  ghcr.io/orbivort/scrumooth/backend:1.0.0
```

#### Step 4: Start Frontend

```bash
docker run -d \
  --name scrumooth-frontend \
  --network scrumooth-network \
  --health-cmd="wget --no-verbose --tries=1 --spider http://127.0.0.1/" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  ghcr.io/orbivort/scrumooth/frontend:1.0.0
```

#### Step 5: Start Reverse Proxy (Optional)

```bash
docker run -d \
  --name scrumooth-caddy \
  --network scrumooth-network \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data \
  -v caddy_config:/config \
  caddy:2-alpine
```

### Method 3: Kubernetes Deployment

For production Kubernetes deployments, use the following manifests as a starting point.

#### Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: scrumooth
```

#### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: scrumooth-config
  namespace: scrumooth
data:
  NODE_ENV: 'production'
  CORS_ORIGIN: 'https://scrumooth.yourdomain.com'
  FRONTEND_URL: 'https://scrumooth.yourdomain.com'
  EMAIL_PROVIDER: 'smtp'
  SMTP_HOST: 'smtp.yourdomain.com'
  SMTP_PORT: '587'
```

#### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: scrumooth-secrets
  namespace: scrumooth
type: Opaque
stringData:
  DATABASE_URL: 'postgresql://postgres:password@postgres:5432/scrumooth'
  JWT_SECRET: 'your-jwt-secret-minimum-64-characters'
  SMTP_USER: 'your-smtp-user'
  SMTP_PASS: 'your-smtp-password'
  EMAIL_FROM_ADDRESS: 'noreply@yourdomain.com'
```

#### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: scrumooth
spec:
  replicas: 2
  selector:
    matchLabels:
      app: scrumooth-backend
  template:
    metadata:
      labels:
        app: scrumooth-backend
    spec:
      containers:
        - name: backend
          image: ghcr.io/orbivort/scrumooth/backend:1.0.0
          ports:
            - containerPort: 5010
          envFrom:
            - configMapRef:
                name: scrumooth-config
            - secretRef:
                name: scrumooth-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: 5010
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 5010
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          resources:
            requests:
              cpu: '250m'
              memory: '256Mi'
            limits:
              cpu: '1000m'
              memory: '512Mi'
```

#### Frontend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: scrumooth
spec:
  replicas: 2
  selector:
    matchLabels:
      app: scrumooth-frontend
  template:
    metadata:
      labels:
        app: scrumooth-frontend
    spec:
      containers:
        - name: frontend
          image: ghcr.io/orbivort/scrumooth/frontend:1.0.0
          ports:
            - containerPort: 80
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          resources:
            requests:
              cpu: '100m'
              memory: '64Mi'
            limits:
              cpu: '500m'
              memory: '128Mi'
```

---

## Environment Configuration

### Required Environment Variables

| Variable       | Description                    | Example                               |
| -------------- | ------------------------------ | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string   | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET`   | JWT signing key (min 64 chars) | Generate with `openssl rand -hex 64`  |
| `NODE_ENV`     | Environment mode               | `production`                          |
| `CORS_ORIGIN`  | Allowed CORS origins           | `https://app.example.com`             |
| `FRONTEND_URL` | Frontend URL for email links   | `https://app.example.com`             |

### Database Configuration

| Variable      | Description                              | Required |
| ------------- | ---------------------------------------- | -------- |
| `DB_USER`     | PostgreSQL username (for docker-compose) | Yes      |
| `DB_PASSWORD` | PostgreSQL password (min 32 chars)       | Yes      |
| `DB_NAME`     | PostgreSQL database name                 | Yes      |

### Email Configuration

| Variable             | Description                                | Required  |
| -------------------- | ------------------------------------------ | --------- |
| `EMAIL_PROVIDER`     | Email provider (`smtp`, `sendgrid`, `ses`) | Yes       |
| `EMAIL_TEST_MODE`    | Set to `false` in production               | Yes       |
| `SMTP_HOST`          | SMTP server host                           | If `smtp` |
| `SMTP_PORT`          | SMTP server port                           | If `smtp` |
| `SMTP_USER`          | SMTP username                              | If `smtp` |
| `SMTP_PASS`          | SMTP password                              | If `smtp` |
| `EMAIL_FROM_ADDRESS` | Sender email address                       | Yes       |
| `EMAIL_FROM_NAME`    | Sender display name                        | No        |

### Session Configuration

| Variable                       | Default            | Description                           |
| ------------------------------ | ------------------ | ------------------------------------- |
| `SESSION_IDLE_TIMEOUT_MS`      | `1800000` (30 min) | Idle session timeout                  |
| `SESSION_ABSOLUTE_TIMEOUT_MS`  | `86400000` (24 hr) | Maximum session duration              |
| `SESSION_WARNING_THRESHOLD_MS` | `120000` (2 min)   | Warning before timeout                |
| `SESSION_CLEANUP_INTERVAL_MS`  | `3600000` (1 hr)   | Cleanup interval for expired sessions |
| `MAX_CONCURRENT_SESSIONS`      | `5`                | Maximum sessions per user             |

### Rate Limiting Configuration

| Variable                         | Default           | Description                    |
| -------------------------------- | ----------------- | ------------------------------ |
| `RATE_LIMIT_WINDOW_MS`           | `900000` (15 min) | Rate limit window              |
| `RATE_LIMIT_MAX_REQUESTS`        | `100`             | Max requests per window        |
| `AUTH_RATE_LIMIT_MAX`            | `5`               | Auth endpoint limit            |
| `LOGIN_RATE_LIMIT_MAX`           | `10`              | Login endpoint limit           |
| `FORGOT_PASSWORD_RATE_LIMIT_MAX` | `3`               | Password reset request limit   |
| `RESET_PASSWORD_RATE_LIMIT_MAX`  | `5`               | Password reset execution limit |

### Optional Environment Variables

| Variable                     | Default | Description                                      |
| ---------------------------- | ------- | ------------------------------------------------ |
| `PORT`                       | `5010`  | Backend server port                              |
| `JWT_EXPIRES_IN`             | `15m`   | Access token expiration                          |
| `JWT_REFRESH_EXPIRES_IN`     | `7d`    | Refresh token expiration                         |
| `LOG_LEVEL`                  | `info`  | Logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_DIR`                    | `logs`  | Log output directory                             |
| `BACKLOG_MAX_ITEMS_PER_GOAL` | `200`   | Max backlog items per product goal               |

---

## Port Mapping

### Default Port Configuration

| Service           | Internal Port | External Port   | Protocol   |
| ----------------- | ------------- | --------------- | ---------- |
| Frontend (nginx)  | 80            | - (via proxy)   | HTTP       |
| Backend (Express) | 5010          | - (via proxy)   | HTTP       |
| PostgreSQL        | 5432          | - (internal)    | TCP        |
| Caddy             | 80/443        | 80/443          | HTTP/HTTPS |
| PgBouncer         | 6432          | 6432 (optional) | TCP        |

### Exposing Ports for Development

```yaml
services:
  backend:
    ports:
      - '5010:5010' # Expose backend directly

  frontend:
    ports:
      - '8080:80' # Expose frontend on port 8080

  postgres:
    ports:
      - '5432:5432' # Expose database (use with caution)
```

### Port Mapping for Different Scenarios

#### Local Development (No Reverse Proxy)

```bash
# Backend
docker run -p 5010:5010 ghcr.io/orbivort/scrumooth/backend:1.0.0

# Frontend (requires backend at localhost:5010)
docker run -p 80:80 ghcr.io/orbivort/scrumooth/frontend:1.0.0
```

#### Production (With Caddy)

```yaml
caddy:
  ports:
    - '80:80' # HTTP (for redirects and ACME)
    - '443:443' # HTTPS
```

---

## Volume Mounting

### Essential Volumes

| Volume                    | Container Path             | Purpose                      |
| ------------------------- | -------------------------- | ---------------------------- |
| `scrumooth_postgres_data` | `/var/lib/postgresql/data` | PostgreSQL data persistence  |
| `caddy_data`              | `/data`                    | Caddy certificates and state |
| `caddy_config`            | `/config`                  | Caddy configuration cache    |

### Optional Volumes

| Volume      | Container Path | Purpose                    |
| ----------- | -------------- | -------------------------- |
| `./backups` | `/backups`     | Database backup storage    |
| `./logs`    | `/app/logs`    | Application logs (backend) |

### Docker Compose Volume Configuration

```yaml
volumes:
  # Persistent data
  scrumooth_postgres_data:
    driver: local
  caddy_data:
    driver: local
  caddy_config:
    driver: local

services:
  postgres:
    volumes:
      - scrumooth_postgres_data:/var/lib/postgresql/data
      - ./logs/postgres:/var/log/postgresql

  backend:
    volumes:
      - ./logs/backend:/app/logs
      - ./backups:/backups
```

### Backup Volume Strategy

```yaml
services:
  backup:
    image: postgres:18-alpine
    volumes:
      - ./backups:/backups
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - PGHOST=postgres
    command: >
      sh -c "
        apk add --no-cache bash &&
        echo '0 2 * * * pg_dump -U $$POSTGRES_USER -d scrumooth > /backups/scrumooth_$$(date +\%Y\%m\%d_\%H\%M\%S).sql' | crontab - &&
        crond -f -l 2
      "
    depends_on:
      - postgres
```

---

## PgBouncer and Backup Services

### PgBouncer Connection Pooling

PgBouncer provides connection pooling for improved database performance under load. When enabled, configure TLS certificates for secure connections.

#### PgBouncer TLS Certificate Setup

```bash
# Create certificates directory
mkdir -p certs/pgbouncer

# Generate self-signed certificate (for internal communication)
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/pgbouncer/server.key \
  -out certs/pgbouncer/server.crt \
  -days 365 -nodes \
  -subj "/CN=scrumooth-pgbouncer"

# Set proper permissions
chmod 600 certs/pgbouncer/server.key
chmod 644 certs/pgbouncer/server.crt
```

#### PgBouncer Docker Compose Configuration

```yaml
pgbouncer:
  image: pgbouncer/pgbouncer:1.22.1
  container_name: scrumooth-pgbouncer
  environment:
    DATABASES_HOST: postgres
    DATABASES_PORT: 5432
    DATABASES_DATABASE: ${DB_NAME:-scrumooth}
    DATABASES_USER: ${DB_USER:-postgres}
    DATABASES_PASSWORD: ${DB_PASSWORD}
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 100
    DEFAULT_POOL_SIZE: 20
    MIN_POOL_SIZE: 5
    RESERVE_POOL_SIZE: 5
    MAX_DB_CONNECTIONS: 50
    CLIENT_TLS_SSLMODE: require
    CLIENT_TLS_KEYFILE: /etc/pgbouncer/tls/server.key
    CLIENT_TLS_CERTFILE: /etc/pgbouncer/tls/server.crt
  volumes:
    - ./certs/pgbouncer:/etc/pgbouncer/tls:ro
  ports:
    - '6432:6432'
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

### Automated Backup Services

> **Note on backup images**: The release workflow also builds and publishes a pre-built backup service image (`ghcr.io/{owner}/scrumooth/backup`). However, the backup scripts below mount `./scripts/maintenance/database` from a **repository checkout**. If you deploy purely from pulled images (no source checkout), you have two options: (a) rely on the bundled scripts that ship inside the pre-built backup image, or (b) provide the scripts via a checkout. For a checkout-free deployment, prefer the `deploy.sh` script, which configures the backup services automatically.

#### SQL Backup Service (Daily)

Creates SQL dumps of the database daily at 2:00 AM.

```yaml
backup:
  image: ghcr.io/{owner}/scrumooth/backup:1.0.0
  container_name: scrumooth-backup
  volumes:
    - ./backups:/backups
    - ./scripts/maintenance/database:/scripts:ro
  environment:
    - POSTGRES_USER=${DB_USER:-postgres}
    - POSTGRES_PASSWORD=${DB_PASSWORD}
    - DB_NAME=${DB_NAME:-scrumooth}
    - PGHOST=postgres
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

> **Note**: The example above mounts the backup scripts from a source checkout. If you only pull images (no checkout), the scripts are already bundled inside the `scrumooth/backup` image and you can omit the `./scripts/maintenance/database` volume mount.

#### Volume Backup Service (Weekly)

Creates file-level backups of the PostgreSQL data volume weekly on Sundays at 3:00 AM.

```yaml
volume-backup:
  image: docker:cli
  container_name: scrumooth-volume-backup
  volumes:
    - scrumooth_postgres_data:/data:ro
    - ./backups/volumes:/backups
    - ./scripts/maintenance/database:/scripts:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
  command: >
    sh -c "
      apk add --no-cache bash &&
      echo '0 3 * * 0 cd /scripts && ./db-volume-backup.sh /backups >> /backups/volume-backup.log 2>&1' | crontab - &&
      crond -f -l 2
    "
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

### Backup Verification

```bash
# List SQL backups
ls -la backups/*.sql

# List volume backups
ls -la backups/volumes/

# Check backup logs
cat backups/backup.log
cat backups/volumes/volume-backup.log
```

---

## Database Setup

### Initial Setup

After starting the containers, initialize the database schema:

```bash
# Run Prisma migrations
docker compose exec backend npx prisma migrate deploy

# Verify migrations
docker compose exec backend npx prisma migrate status
```

### Database Connection Options

#### Direct Connection

```bash
DATABASE_URL=postgresql://user:password@postgres:5432/scrumooth
```

#### With PgBouncer (Connection Pooling)

```bash
# Point backend to PgBouncer instead of PostgreSQL directly
DATABASE_URL=postgresql://user:password@pgbouncer:6432/scrumooth
```

### Database Migrations During Upgrades

```bash
# Before upgrading
docker compose exec backend npx prisma migrate status

# After pulling new images
docker compose pull
docker compose up -d

# Run new migrations
docker compose exec backend npx prisma migrate deploy
```

> **One-time step: the consolidated migration.** The incremental migrations that followed
> `00000000000000_init` were collapsed into `20260926000000_consolidate_incremental_migrations`. On an
> installation that already ran the originals, record the consolidated file as applied **once, before**
> running `migrate deploy`:
>
> ```bash
> docker compose exec backend npx prisma migrate resolve \
>   --applied 20260926000000_consolidate_incremental_migrations
> ```
>
> Without it, `migrate deploy` tries to run the consolidated file and every `CREATE` collides with an
> object that already exists. Fresh installations need nothing: `migrate deploy` applies
> `00000000000000_init` and then the consolidated file. `prisma migrate status` reporting the sixteen
> removed migrations as "applied to the database but missing from the local migrations directory" is
> expected until the `resolve` above is recorded.

---

## Verification Steps

> **Note**: The verification commands below use `jq` for JSON parsing. Install it with:
>
> - **Ubuntu/Debian**: `sudo apt-get install jq`
> - **macOS**: `brew install jq`
> - **Windows (WSL)**: `sudo apt-get install jq`
> - **Windows (PowerShell)**: Use `ConvertFrom-Json` instead, e.g., `curl -s http://localhost:5010/health | ConvertFrom-Json`

### 1. Container Health Checks

```bash
# Check all containers are running
docker compose ps

# Expected output:
# NAME                 STATUS
# scrumooth-backend    Up (healthy)
# scrumooth-frontend   Up (healthy)
# scrumooth-postgres   Up (healthy)
# scrumooth-caddy      Up (healthy)
```

### 2. Backend Health Endpoint

```bash
curl -s http://localhost:5010/health | jq
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-05-25T10:30:00.000Z",
  "uptime": 3600.5,
  "database": {
    "status": "connected",
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

### 3. Frontend Accessibility

```bash
# Check frontend returns HTML
curl -s http://localhost/ | head -20

# Should return HTML with React app
```

### 4. API Connectivity

```bash
# Test API endpoint through frontend proxy
curl -s http://localhost/api/v1/health

# Should return same as backend health check
```

### 5. Database Connectivity

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d scrumooth -c "SELECT 1"

# Expected output:
#  ?column?
# ----------
#         1
# (1 row)
```

### 6. Log Inspection

```bash
# Backend logs
docker compose logs backend --tail=100

# Frontend logs
docker compose logs frontend --tail=100

# PostgreSQL logs
docker compose logs postgres --tail=100
```

### 7. TLS Certificate Verification

```bash
# Check TLS certificate validity (for HTTPS deployments)
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Expected output:
# notBefore=May 25 00:00:00 2026 GMT
# notAfter=Aug 23 00:00:00 2026 GMT

# Verify certificate chain
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -issuer

# For Caddy internal certificates (local development)
curl -k https://localhost/health
```

### 8. Email Delivery Verification

```bash
# Check email configuration
docker compose exec backend env | grep -E 'EMAIL_|SMTP_'

# Verify EMAIL_TEST_MODE is false in production
docker compose exec backend env | grep EMAIL_TEST_MODE
# Expected: EMAIL_TEST_MODE=false

# Check email logs (if available)
docker compose logs backend | grep -i email
```

### 9. Complete Verification Script

```bash
#!/bin/bash
set -e

echo "=== Scrumooth Deployment Verification ==="

echo -e "\n1. Checking container status..."
docker compose ps

echo -e "\n2. Checking backend health..."
HEALTH=$(curl -s http://localhost:5010/health)
echo "$HEALTH" | jq -r '.status' | grep -q "healthy" && echo "✅ Backend healthy" || echo "❌ Backend unhealthy"

echo -e "\n3. Checking database connection..."
echo "$HEALTH" | jq -r '.database.status' | grep -q "connected" && echo "✅ Database connected" || echo "❌ Database disconnected"

echo -e "\n4. Checking frontend..."
curl -s -o /dev/null -w "%{http_code}" http://localhost/ | grep -q "200" && echo "✅ Frontend accessible" || echo "❌ Frontend not accessible"

echo -e "\n5. Checking API proxy..."
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health | grep -q "200" && echo "✅ API proxy working" || echo "❌ API proxy failed"

echo -e "\n=== Verification Complete ==="
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] **Version Pinning**: Use specific version tag (e.g., `1.0.0`), not `latest`
- [ ] **JWT Secret**: Generated with `openssl rand -hex 64` (min 64 characters)
- [ ] **Database Password**: Strong password (min 32 characters)
- [ ] **CORS Origins**: Only production HTTPS domains
- [ ] **Email Configuration**: Valid SMTP credentials
- [ ] **EMAIL_TEST_MODE**: Set to `false` (CRITICAL - prevents email spoofing)
- [ ] **Domain Configuration**: Valid domain for TLS certificates

### Security Configuration

- [ ] **NODE_ENV**: Set to `production`
- [ ] **LOG_LEVEL**: Set to `info` or `warn`
- [ ] **HTTPS**: Enabled via Caddy with valid certificates
- [ ] **Security Headers**: Configured in Caddyfile
- [ ] **Rate Limiting**: Default limits appropriate for production
- [ ] **PgBouncer TLS**: Certificates generated and placed in `./certs/pgbouncer/` (if using connection pooling)

### Infrastructure

- [ ] **Backups**: Automated backup service configured
- [ ] **Backup Storage**: Off-site backup synchronization configured
- [ ] **Monitoring**: Health checks configured for all services
- [ ] **Resource Limits**: CPU and memory limits set
- [ ] **Log Rotation**: Configured for all services
- [ ] **Log Directories**: Created with proper permissions (`./logs/backend`, `./logs/postgres`)

### Post-Deployment

- [ ] **Health Check**: All services report healthy status
- [ ] **Database Migration**: `prisma migrate deploy` completed successfully
- [ ] **User Registration**: Test user can be created
- [ ] **Email Delivery**: Test email sent successfully
- [ ] **HTTPS**: Certificate valid and auto-renewal working

---

## Troubleshooting

### Common Issues

#### 1. Image Pull Fails

**Symptoms**: `Error: pull access denied`

**Solution**:

```bash
# Authenticate with GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# For public repos, ensure correct image name
docker pull ghcr.io/orbivort/scrumooth/backend:1.0.0
```

#### 2. Backend Health Check Fails

**Symptoms**: Container exits or health check fails

**Diagnosis**:

```bash
# Check logs
docker compose logs backend

# Common causes:
# - DATABASE_URL incorrect
# - Database not ready
# - Missing required environment variables
```

**Solution**:

```bash
# Verify database is running
docker compose ps postgres

# Check database connection
docker compose exec postgres pg_isready

# Verify environment variables
docker compose exec backend env | grep -E 'DATABASE_URL|JWT_SECRET|NODE_ENV'
```

#### 3. Database Connection Fails

**Symptoms**: `Error: Can't reach database server`

**Solution**:

```bash
# Verify DATABASE_URL format
# Correct: postgresql://user:password@postgres:5432/dbname
# Note: Use service name 'postgres', not 'localhost'

# Check network connectivity
docker compose exec backend ping postgres

# Verify PostgreSQL is accepting connections
docker compose exec postgres psql -U postgres -c "SELECT 1"
```

#### 4. Frontend Shows Blank Page

**Symptoms**: Frontend loads but shows blank page

**Diagnosis**:

```bash
# Check browser console for errors
# Check API proxy configuration

# Verify backend is accessible from frontend
docker compose exec frontend wget -q -O- http://backend:5010/health
```

**Solution**:

```bash
# Ensure nginx.conf has correct proxy configuration
# The frontend image has built-in proxy to 'backend:5010'
# Ensure backend service is named 'backend' in compose
```

#### 5. CORS Errors

**Symptoms**: Browser shows CORS errors in console

**Solution**:

```bash
# Update CORS_ORIGIN to include your domain
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com

# Restart backend
docker compose restart backend
```

#### 6. JWT Token Errors

**Symptoms**: "Invalid token" or "jwt malformed"

**Solution**:

```bash
# Ensure JWT_SECRET is consistent across restarts
# JWT_SECRET must be at least 64 characters

# Generate new secret
openssl rand -hex 64

# Update and restart
docker compose up -d --force-recreate backend
```

#### 7. PgBouncer Connection Failures

**Symptoms**: "connection refused" or TLS errors when connecting through PgBouncer

**Diagnosis**:

```bash
# Check PgBouncer logs
docker compose logs pgbouncer

# Verify TLS certificates exist
ls -la certs/pgbouncer/

# Check PgBouncer is running
docker compose ps pgbouncer
```

**Solution**:

```bash
# Generate TLS certificates if missing
mkdir -p certs/pgbouncer
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/pgbouncer/server.key \
  -out certs/pgbouncer/server.crt \
  -days 365 -nodes \
  -subj "/CN=scrumooth-pgbouncer"
chmod 600 certs/pgbouncer/server.key

# Restart PgBouncer
docker compose restart pgbouncer
```

#### 8. Email Delivery Failures

**Symptoms**: Emails not being sent or received

**Diagnosis**:

```bash
# Check email configuration
docker compose exec backend env | grep -E 'EMAIL_|SMTP_'

# Check if test mode is enabled (should be false in production)
docker compose exec backend env | grep EMAIL_TEST_MODE

# Check backend logs for email errors
docker compose logs backend | grep -i "email\|smtp"
```

**Solution**:

```bash
# Ensure EMAIL_TEST_MODE=false in production
# Update .env file
EMAIL_TEST_MODE=false

# Verify SMTP credentials
# Test SMTP connection manually
docker compose exec backend sh -c "nc -zv \$SMTP_HOST \$SMTP_PORT"

# Restart backend
docker compose up -d --force-recreate backend
```

#### 9. Caddy/TLS Certificate Issues

**Symptoms**: "certificate verify failed" or HTTPS not working

**Diagnosis**:

```bash
# Check Caddy logs
docker compose logs caddy

# Verify Caddyfile syntax
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile

# Check certificate status
docker compose exec caddy caddy list-certificates
```

**Solution**:

```bash
# For production with real domain, ensure DNS is configured
dig your-domain.com

# For local development, use internal TLS
# In Caddyfile, use: tls internal

# Restart Caddy
docker compose restart caddy
```

#### 10. Backup Service Failures

**Symptoms**: No backup files created or cron job failures

**Diagnosis**:

```bash
# Check backup service logs
docker compose logs backup
docker compose logs volume-backup

# Verify backup directory exists and is writable
ls -la backups/

# Check cron is running
docker compose exec backup ps aux | grep cron
```

**Solution**:

```bash
# Create backup directory with proper permissions
mkdir -p backups volumes
chmod 755 backups

# Check disk space
df -h backups/

# Manually trigger backup for testing
docker compose exec backup pg_dump -U postgres scrumooth > test_backup.sql
```

### Debugging Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Execute command in container
docker compose exec backend sh

# Check container resource usage
docker stats

# Inspect container configuration
docker inspect scrumooth-backend

# Check network connectivity
docker compose exec backend ping postgres

# View environment variables
docker compose exec backend env
```

### Performance Issues

#### High Memory Usage

```bash
# Check container memory usage
docker stats --no-stream

# Adjust memory limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 512M
```

#### Slow Database Queries

```bash
# Check PostgreSQL slow query log
docker compose exec postgres cat /var/log/postgresql/*.log

# Enable query timing
docker compose exec postgres psql -c "SET log_min_duration_statement = 100;"
```

---

## Upgrading

### Upgrade Process

#### 1. Backup Before Upgrade

```bash
# Create database backup
docker compose exec postgres pg_dump -U postgres scrumooth > backup_$(date +%Y%m%d).sql

# Or use the backup service
ls -la backups/
```

#### 2. Pull New Images

```bash
# Pull specific version
docker pull ghcr.io/orbivort/scrumooth/backend:1.1.0
docker pull ghcr.io/orbivort/scrumooth/frontend:1.1.0

# Or update docker-compose.yml and pull
docker compose pull
```

#### 3. Stop Services

```bash
docker compose stop backend frontend
```

#### 4. Run Migrations (if needed)

```bash
# Check for pending migrations
docker compose run --rm backend npx prisma migrate status

# Apply migrations
docker compose run --rm backend npx prisma migrate deploy
```

> If this installation predates the consolidated migration
> (`20260926000000_consolidate_incremental_migrations`) and still has not recorded it, run the
> one-time `prisma migrate resolve --applied` step described under
> [Database Migrations During Upgrades](#database-migrations-during-upgrades) first.

#### 5. Start New Version

```bash
docker compose up -d backend frontend
```

#### 6. Verify Upgrade

```bash
# Check health
curl http://localhost:5010/health

# Check version
docker compose exec backend node -p "require('./package.json').version"
```

### Rollback Process

If upgrade fails, rollback to previous version:

```bash
# Stop failed containers
docker compose stop backend frontend

# Restore database backup
docker compose exec -T postgres psql -U postgres -d scrumooth < backup_20260525.sql

# Update image tags to previous version
# Edit docker-compose.yml: image: ghcr.io/orbivort/scrumooth/backend:1.0.0

# Start previous version
docker compose up -d backend frontend

# Verify
curl http://localhost:5010/health
```

---

## Appendix: Complete docker-compose.yml Example

```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: scrumooth-postgres
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-scrumooth}
      POSTGRES_INITDB_ARGS: --encoding=UTF-8 --locale=en_US.UTF-8
    volumes:
      - scrumooth_postgres_data:/var/lib/postgresql/data
      - ./logs/postgres:/var/log/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-scrumooth}']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped
    networks:
      - scrumooth-network
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '5'

  backend:
    image: ghcr.io/orbivort/scrumooth/backend:${VERSION:-1.0.0}
    container_name: scrumooth-backend
    environment:
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-scrumooth}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      PORT: '5010'
      CORS_ORIGIN: ${CORS_ORIGIN}
      FRONTEND_URL: ${FRONTEND_URL}
      EMAIL_PROVIDER: ${EMAIL_PROVIDER:-smtp}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME:-Scrumooth}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
    expose:
      - '5010'
    volumes:
      - ./logs/backend:/app/logs
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "require('http').get('http://localhost:5010/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    networks:
      - scrumooth-network
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '5'
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M

  frontend:
    image: ghcr.io/orbivort/scrumooth/frontend:${VERSION:-1.0.0}
    container_name: scrumooth-frontend
    depends_on:
      backend:
        condition: service_healthy
    expose:
      - '80'
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://127.0.0.1/']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    networks:
      - scrumooth-network
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '5'
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M
        reservations:
          cpus: '0.1'
          memory: 32M

  caddy:
    image: caddy:2-alpine
    container_name: scrumooth-caddy
    ports:
      - '80:80'
      - '443:443'
    environment:
      DOMAIN: ${DOMAIN:-localhost}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend
    healthcheck:
      test: ['CMD', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
    networks:
      - scrumooth-network
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '5'

volumes:
  scrumooth_postgres_data:
    driver: local
  caddy_data:
    driver: local
  caddy_config:
    driver: local

networks:
  scrumooth-network:
    driver: bridge
```

---

## Rolling Back to a Previous Version

If a deployment fails or introduces issues, you can quickly rollback to a previous version.

### Immediate Rollback

1. **Stop current deployment**:

```bash
docker compose down
```

2. **Pull previous version images**:

```bash
# Replace 1.0.0 with the version you want to rollback to
docker pull ghcr.io/orbivort/scrumooth/backend:1.0.0
docker pull ghcr.io/orbivort/scrumooth/frontend:1.0.0
```

3. **Update docker-compose.yml with previous version**:

```yaml
services:
  backend:
    image: ghcr.io/orbivort/scrumooth/backend:1.0.0
    # ... rest of config

  frontend:
    image: ghcr.io/orbivort/scrumooth/frontend:1.0.0
    # ... rest of config
```

4. **Start services**:

```bash
docker compose up -d
```

5. **Verify rollback**:

```bash
curl https://your-domain.com/health
docker compose logs backend
```

### Database Migration Rollback

If the deployment included database migrations that need to be rolled back:

1. **Check migration status**:

```bash
docker compose exec backend npx prisma migrate status
```

2. **Rollback specific migration**:

```bash
# List applied migrations
docker compose exec backend npx prisma migrate status

# Mark migration as rolled back (manual intervention required)
docker compose exec backend npx prisma migrate resolve --rolled-back <migration_name>
```

3. **Restore from backup** (if needed):

```bash
# List available backups
ls -la backups/

# Restore from backup
docker compose exec -T postgres psql -U scrumooth -d scrumooth < backups/scrumooth-20260525.sql
```

### Rollback Best Practices

- **Always backup before upgrading**: Create a database backup before applying new migrations
- **Test rollback procedure**: Practice rollback in staging before production
- **Monitor after rollback**: Verify all services are healthy and users can access the application
- **Document issues**: Record what went wrong to prevent future occurrences
- **Version pinning**: Always use specific version tags (e.g., `1.0.0`) instead of `latest` for easier rollback

---

## Upgrading Between Versions

### Minor/Patch Updates (e.g., 1.0.0 → 1.0.1)

Minor and patch updates typically include bug fixes and small improvements without breaking changes.

1. **Review changelog**:

```bash
# Check CHANGELOG.md for changes
curl -s https://raw.githubusercontent.com/orbivort/scrumooth/main/CHANGELOG.md | grep -A 20 "## \[1.0.1\]"
```

2. **Pull new images**:

```bash
docker pull ghcr.io/orbivort/scrumooth/backend:1.0.1
docker pull ghcr.io/orbivort/scrumooth/frontend:1.0.1
```

3. **Update docker-compose.yml**:

```yaml
services:
  backend:
    image: ghcr.io/orbivort/scrumooth/backend:1.0.1
  frontend:
    image: ghcr.io/orbivort/scrumooth/frontend:1.0.1
```

4. **Deploy with zero downtime**:

```bash
# Backend
docker compose up -d --no-deps backend

# Wait for backend to be healthy
sleep 30

# Frontend
docker compose up -d --no-deps frontend
```

5. **Verify**:

```bash
curl https://your-domain.com/health
docker compose logs -f backend
```

### Major Updates (e.g., 1.x.x → 2.0.0)

Major updates may include breaking changes. **Always test in staging first**.

1. **Read migration guide**:
   - Check CHANGELOG.md for breaking changes
   - Review migration notes in the release documentation
   - Check for deprecated features

2. **Backup everything**:

```bash
# Database backup
docker exec scrumooth-postgres pg_dump -U scrumooth scrumooth > backup-before-v2.sql

# Volume backup
docker run --rm -v scrumooth_postgres_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz /data
```

3. **Update environment variables** (if required):

```bash
# Check .env.production.example for new required variables
curl -s https://raw.githubusercontent.com/orbivort/scrumooth/v2.0.0/packages/backend/.env.production.example > .env.production.example.new

# Compare and merge changes
diff .env.production.example .env.production.example.new
```

4. **Test in staging**:
   - Deploy to staging environment first
   - Run full test suite
   - Verify all features work correctly
   - Check performance metrics

5. **Schedule production upgrade**:
   - Choose low-traffic time window
   - Notify users of planned maintenance
   - Have rollback plan ready

6. **Execute upgrade**:

```bash
# Pull new images
docker pull ghcr.io/orbivort/scrumooth/backend:2.0.0
docker pull ghcr.io/orbivort/scrumooth/frontend:2.0.0

# Stop services
docker compose down

# Start with new version
docker compose up -d

# Monitor logs
docker compose logs -f
```

7. **Post-upgrade verification**:
   - Verify health checks pass
   - Test critical user flows
   - Check error rates in logs
   - Monitor performance metrics

### Database Migration Handling

When upgrading, database migrations are applied automatically by the entrypoint script. However, you may need to:

1. **Check pending migrations**:

```bash
docker compose exec backend npx prisma migrate status
```

2. **Preview migration SQL**:

```bash
# View migration SQL without applying
docker compose exec backend npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

3. **Manual migration** (if automatic fails):

```bash
docker compose exec backend npx prisma migrate deploy
```

---

## Network Security Best Practices

### Docker Network Isolation

For enhanced security, isolate services using separate Docker networks:

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true # No external access
  database:
    driver: bridge
    internal: true # No external access

services:
  caddy:
    networks:
      - frontend

  frontend:
    networks:
      - frontend
      - backend

  backend:
    networks:
      - backend
      - database

  postgres:
    networks:
      - database
```

This ensures:

- Frontend can only communicate with backend
- Backend can only communicate with database
- Database has no external network access

### Kubernetes Network Policies

If deploying to Kubernetes, use NetworkPolicies for fine-grained control:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-network-policy
  namespace: scrumooth
spec:
  podSelector:
    matchLabels:
      app: scrumooth-backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from frontend only
    - from:
        - podSelector:
            matchLabels:
              app: scrumooth-frontend
      ports:
        - port: 5010
          protocol: TCP
  egress:
    # Allow traffic to database only
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
          protocol: TCP
    # Allow DNS resolution
    - to:
        - namespaceSelector: {}
      ports:
        - port: 53
          protocol: UDP
```

### Firewall Rules

For production deployments, configure firewall rules:

```bash
# Allow only HTTP/HTTPS from external
ufw allow 80/tcp
ufw allow 443/tcp

# Block direct database access
ufw deny 5432/tcp

# Enable firewall
ufw enable
```

### Security Checklist

- [ ] Use internal networks for database and backend
- [ ] Block direct database access from external IPs
- [ ] Enable TLS/SSL for all external communication
- [ ] Use secrets management (Docker secrets, Kubernetes Secrets)
- [ ] Regularly update base images for security patches
- [ ] Scan images for vulnerabilities (Trivy, Snyk)
- [ ] Enable audit logging for database access
- [ ] Use read-only root filesystem where possible

---

## Secrets Rotation

Regularly rotating secrets is critical for security. Follow this schedule:

| Secret                  | Rotation Frequency           | Impact                     | Rotation Procedure                            |
| ----------------------- | ---------------------------- | -------------------------- | --------------------------------------------- |
| `JWT_SECRET`            | Every 90 days                | All users must re-login    | Generate new, update env, restart backend     |
| `DATABASE_URL` password | Every 90 days                | Brief downtime             | Update in PostgreSQL, update env, restart     |
| `SMTP_PASS`             | When compromised or annually | Email delivery interrupted | Update in SMTP provider, update env, restart  |
| `SENDGRID_API_KEY`      | When compromised or annually | Email delivery interrupted | Generate new in SendGrid, update env, restart |

### JWT Secret Rotation

1. **Generate new secret**:

```bash
NEW_JWT_SECRET=$(openssl rand -hex 64)
echo "New JWT_SECRET: $NEW_JWT_SECRET"
```

2. **Update environment file**:

```bash
# Backup current config
cp .env.production .env.production.backup

# Update JWT_SECRET
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT_SECRET|" .env.production
```

3. **Restart backend**:

```bash
docker compose restart backend
```

4. **Verify**:

```bash
# Check backend is healthy
docker compose ps backend

# Test authentication (all users will need to re-login)
curl -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

5. **Notify users**:
   - Send notification that all users need to re-login
   - Update documentation with rotation date

### Database Password Rotation

1. **Generate new password**:

```bash
NEW_DB_PASSWORD=$(openssl rand -hex 32)
echo "New DB Password: $NEW_DB_PASSWORD"
```

2. **Update PostgreSQL**:

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres

# Update password
ALTER USER scrumooth WITH PASSWORD 'new_password';
\q
```

3. **Update environment**:

```bash
# Update DATABASE_URL
sed -i "s|postgresql://scrumooth:.*@|postgresql://scrumooth:$NEW_DB_PASSWORD@|" .env.production
```

4. **Restart services**:

```bash
docker compose restart backend
```

5. **Verify**:

```bash
# Test database connection
docker compose exec backend npx prisma db execute --stdin <<< "SELECT 1"
```

### SMTP Credentials Rotation

1. **Generate new credentials** in your SMTP provider (e.g., SendGrid, Mailgun)

2. **Update environment**:

```bash
# Update SMTP credentials
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=new_smtp_password|" .env.production
```

3. **Restart backend**:

```bash
docker compose restart backend
```

4. **Test email sending**:

```bash
# Trigger a test email (e.g., password reset)
curl -X POST https://your-domain.com/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Rotation Automation

For automated rotation, consider using:

- **HashiCorp Vault**: Secret management with automatic rotation
- **AWS Secrets Manager**: Automatic rotation for AWS services
- **Kubernetes External Secrets Operator**: Sync secrets from external sources

Example with HashiCorp Vault:

```yaml
# docker-compose.yml with Vault
services:
  backend:
    environment:
      JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: ${DATABASE_URL}
    # ... rest of config

  # Vault agent sidecar for secret injection
  vault-agent:
    image: vault:1.13
    command: agent -config=/vault/config/agent.hcl
    volumes:
      - ./vault/config:/vault/config
      - vault-secrets:/secrets
```

---

## Configuration Validation

Before deploying, validate your configuration to catch errors early.

### Using the Validation Script

The backend image includes a configuration validation script:

```bash
# Validate configuration before deployment
docker run --rm --env-file .env.production \
  ghcr.io/orbivort/scrumooth/backend:latest \
  node dist/scripts/validate-config.js
```

### What It Validates

- ✅ Required environment variables are set
- ✅ JWT_SECRET is at least 64 characters
- ✅ DATABASE_URL is a valid PostgreSQL connection string
- ✅ CORS_ORIGIN contains valid URLs
- ✅ Email configuration is complete
- ✅ Production-specific security checks

### Example Output

```
🔍 Validating configuration...

══════════════════════════════════════════════════════════════

❌ ERRORS:

  1. JWT_SECRET is too short (32 characters). Must be at least 64 characters for production security. Generate with: openssl rand -hex 64
  2. EMAIL_TEST_MODE is set to "true" in production. Emails will NOT be sent. Set EMAIL_TEST_MODE=false for production.

⚠️  WARNINGS:

  1. DATABASE_URL uses localhost in production. Ensure this is correct for your deployment.

❌ Configuration validation failed!

Please fix the errors above before deploying.

══════════════════════════════════════════════════════════════
```

---

**Last Updated**: 2026-06-09

**Related Documentation**:

- [Deployment Architecture](../architecture/deployment-architecture.md)
- [Security Architecture](../architecture/security-architecture.md)
- [System Architecture](../architecture/system-architecture.md)
