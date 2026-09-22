# Scrumooth — the Scrum Guide, enforced.

**Judge a Scrum tool by the rules it keeps, not by the boards it draws.**

**Scrumooth** is a self-hosted, open-source web application for teams that run Scrum. It is built for Scrum Masters, Product Owners, and the engineering-led teams that want the process to hold itself to the Guide. It turns the rules of the **2020 Scrum Guide** into gates the backend enforces wherever a tool can — and declares the places where it deliberately does not.

It is **not** a replacement for your issue tracker. As the Scrum Guide enforcement layer your tracker does not have, it owns the Sprint lifecycle, the roles, and the gates, and it refuses to let a process violation pass silently. Your tracker keeps your record; this keeps your rules. Every rule it enforces is listed in [What Scrumooth Enforces](#what-scrumooth-enforces) — and no rule outside that list is claimed.

Running a second tool is a real cost — something else to deploy, secure, back up, and keep fed. Scrumooth is deliberately the smallest system that can carry it: a single Compose stack — reverse proxy, backend, frontend, PostgreSQL, and scheduled backups — and one database to look after.

> **Languages:** [English](README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Italiano](README.it.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml/badge.svg)](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/orbivort/scrumooth/graph/badge.svg)](https://codecov.io/github/orbivort/scrumooth)
[![GitHub release](https://img.shields.io/github/v/release/orbivort/scrumooth?include_prereleases)](https://github.com/orbivort/scrumooth/releases)
[![GitHub issues](https://img.shields.io/github/issues/orbivort/scrumooth)](https://github.com/orbivort/scrumooth/issues)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791.svg)](https://www.postgresql.org/)

<p align="center">
  <img src="docs/screenshots/scrumooth.png" alt="Scrumooth" width="800" />
</p>

<a id="live-demo"></a>

## 🖥️ Live Demo

Try Scrumooth instantly in your browser — no installation required. The demo runs with mock data (no backend needed) so you can explore the full Scrum lifecycle right away.

<p align="center">
  <a href="https://orbivort.github.io/scrumooth/" target="_blank" rel="noopener noreferrer">
    <strong>👉 Launch the Live Demo on GitHub Pages</strong>
  </a>
</p>

> **Note:** The demo uses in‑memory mock data — any changes you make are local to your browser session and reset on refresh. For persistent data and multi‑user collaboration, follow the [Installation](#installation) guide to self‑host your own instance.

---

## Table of Contents

**Understand Scrumooth**

- [Live Demo](#live-demo)
- [The Manifesto](#the-manifesto)
- [What Scrumooth Enforces](#what-scrumooth-enforces)
- [Who It's For](#who-its-for)
- [Why You Can Trust It](#why-you-can-trust-it)
- [Features](#features)

**Self-host & develop**

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Common Development Commands](#development-commands)
- [Testing](#testing)
- [Load Testing (k6)](#load-testing-k6)
- [Code Quality](#code-quality)
- [Database Management](#database-management)
- [Docker Support](#docker-support)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

**Project**

- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

<a id="the-manifesto"></a>

## 📜 The Manifesto — Why Scrumooth exists

> Most project management tools are built to **record** what happened. They give you boards, they log your clicks, they draw accurate charts — after the Sprint is over. Recording is genuinely useful, and those tools do it well.
>
> But a record is a description, not a decision. The 2020 Scrum Guide is full of rules a tool could hold you to: a Sprint closes only after its Review and its Retrospective, only the Developers size the work, one Product Owner owns the Product Backlog, and "Done" means the Definition of Done has been met. When one of them slips — a Sprint closed before its Retrospective ran, a Product Owner sizing work on the Developers' behalf, an item marked Done with its criteria unverified — the slip is usually invisible until the Sprint is over. In most tools those rules are advisory: a shared understanding the team is trusted to remember.
>
> **Scrumooth treats them as rules.**
>
> Discipline is not the missing ingredient — if it were enough on its own, no team would ever have closed a Sprint without a Retrospective. The Guide tells a team what to do; it cannot notice when the team stops doing it. So we embed the **2020 Scrum Guide** as executable code and **enforce** it server-side, where neither the interface nor a direct API call can bypass it. We are a **gatekeeper, not a note-taker**.
>
> Fewer process debates. More time shipping working software.

<a id="what-scrumooth-enforces"></a>

## 🔒 What Scrumooth Enforces

These are gates, not warnings or hints. In every case below, the answer is no — and every answer holds in the backend service layer, so a frontend shortcut cannot get around it.

| A 2020 Scrum Guide rule, asked as a question                       | Scrumooth's answer                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can a Sprint be closed before its Review and Retrospective?        | Sprint completion is refused until both events are recorded ([sprints API](docs/api/sprints.md)).                                                                                                                                                                 |
| Can an item be called Done without its Definition of Done?         | Completing a Sprint never marks items Done — each item must pass its Definition of Done checklist ([Definition of Done API](docs/api/definition-of-done.md)).                                                                                                     |
| Can a team hold more than one Product Owner or Scrum Master?       | Adding a second holder of either role is refused ([teams API](docs/api/teams.md)).                                                                                                                                                                                |
| Can a team grow past Scrum Team size?                              | Team size is capped — `TEAM_MAX_SIZE`, default `10` ([teams API](docs/api/teams.md)).                                                                                                                                                                             |
| Can two teams on one product hold two Definitions of Done?         | No: a team group owns one Definition of Done its teams read, a grouped team cannot edit its own, and joining records the version adopted ([Team Groups API](docs/api/team-groups.md)).                                                                            |
| Can someone other than a Developer size the work?                  | Only Developers can size Product Backlog items — every other role receives `403 Forbidden` ([Product Backlog API](docs/api/product-backlog.md)).                                                                                                                  |
| Can the Product Owner or Scrum Master author the Daily Scrum?      | Only Developers can author or join the daily record; the Product Owner and Scrum Master observe ([Daily Scrum API](docs/api/daily-scrum.md)).                                                                                                                     |
| Can a Sprint be cancelled by anyone but the Product Owner?         | Cancellation is Product-Owner-only, and only while the Sprint is `ACTIVE` ([sprints API](docs/api/sprints.md)).                                                                                                                                                   |
| Can a delivered Increment be rewritten?                            | Delivered and archived Increments are terminal — neither can be rewritten, re-delivered, or revived ([increments API](docs/api/increments.md)).                                                                                                                   |
| Can the Definition of Done be emptied?                             | A Definition of Done must keep at least one active item; a Sprint Backlog cannot be committed, and a Sprint cannot start, while a team has none; and work cannot be marked Done while a team has none ([Definition of Done API](docs/api/definition-of-done.md)). |
| Can an Increment be marked usable, or delivered, without evidence? | An Increment must be attested usable in writing — with who attested and when — before it can be verified or delivered ([increments API](docs/api/increments.md)).                                                                                                 |
| Can someone outside the team read or deliver an Increment?         | An Increment belongs to its Scrum Team: reading, verifying, or delivering one requires membership ([increments API](docs/api/increments.md)).                                                                                                                     |
| Can an Increment silently omit work that reached Done?             | Composition reports its outcome (composed, skipped with a reason, or failed), and a Sprint's Increment can be reconciled from its Done items ([increments API](docs/api/increments.md)).                                                                          |

### Complementary practices Scrumooth also enforces

These are **not 2020 Scrum Guide rules** — the Guide's three artifacts are the Product Backlog, the Sprint Backlog and the Increment, and the Definition of Ready is none of them. They are the product's own additions, labelled as such in the interface, and they are listed here separately so the table above keeps meaning exactly what it says.

| A practice Scrumooth enforces, asked as a question        | Scrumooth's answer                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Can a team agree what "ready" means and then plan anyway? | No: the team's Definition of Ready is applied at the Sprint boundary. Committing a Sprint Backlog or starting a Sprint is refused while a selected item still has an unverified active readiness criterion — the refusal names the items — and refused while the team has no active criterion at all ([Definition of Ready API](docs/api/definition-of-ready.md)). |

Two consequences are worth stating plainly. Because it is a product rule rather than a Guide rule, a team that does not want a Definition of Ready still meets it: Scrumooth creates six sensible default criteria the first time the agreement is read, and the team's Scrum Master can shape or retire them. And because refusing a Sprint over a non-Guide artifact is a real trade-off, the checklist says what it is in its own words — a complementary practice, not a Guide artifact — rather than borrowing the Guide's authority.

**Where Scrumooth deliberately does not enforce anything:** the Retrospective Prime Directive is left to the facilitator, and event timeboxes are surfaced through a shared team timer rather than forcibly terminating an event. The Guide asks for self-management in exactly those places, so Scrumooth does not decide for the team.

**What a gate looks like in practice.** It is Friday, the Sprint is due to end, the increment is deployed — and the Retrospective was never scheduled. A recording tool closes the Sprint and the Retrospective slips to next week, which is the failure the Guide's final event exists to prevent; Scrumooth refuses the close until both events are recorded. The team then runs the Retrospective, or stops and discusses why not — the version of that decision the Guide expects a team to make consciously.

Why will the tools you already use not simply add this? In our view, because a gate you can switch off is a setting, not a rule, and configurability is their selling point rather than their oversight. Nor can a hosted service easily promise that your process data never leaves your infrastructure. Scrumooth is not a feature they are missing; it is a trade-off they have already made the other way.

The gates in the Guide table are the entire claim about the 2020 Scrum Guide: if a Guide rule is not in it, Scrumooth does not enforce that rule — and because a configuration that breaks the Guide is never offered, **the refusal is the product.** The complementary practices listed below it are the product's own additions, kept separate and labelled so the two can never be mistaken for each other.

<a id="who-its-for"></a>

## 🎯 Who It's For

**Scrumooth is built for one situation in particular:** engineering-led organisations that have to be able to show how a Sprint was actually run, and for whom process data cannot leave their own infrastructure — regulated industries, their suppliers, and public-sector teams.

**Scrumooth is for you if…**

- You are a **Scrum Master or Product Owner** whose team finds it hard to hold to the 2020 Scrum Guide, and you want the tool to refuse the drift instead of quietly allowing it.
- You lead an **engineering team** that wants to self-host its process data for privacy, compliance, or data-sovereignty reasons.
- You need a **defensible, auditable record** of how each Sprint was actually run — who changed what, when, and under which role.
- You want the Scrum Guide's boundaries encoded once, so new team members learn the process by using it.

**Scrumooth is not for you if…**

- You want a general-purpose issue tracker, roadmap planner, or Kanban board for non-Scrum work. Scrumooth refuses to be one.
- You want every rule to be configurable. Scrumooth refuses configurations that break the Scrum Guide.
- You want a fully managed SaaS. Scrumooth is self-hosted by design.
- You need deep portfolio management, resource planning, or financial tracking across many unrelated projects.
- You follow a scaled framework that adapts the Guide for a wider organisation, or Scrum is not yet how your team works. Scrumooth enforces the 2020 Scrum Guide as written, for a single Scrum Team.

<a id="why-you-can-trust-it"></a>

## 🛡 Why You Can Trust It

**Why not a hosted service**

- **Self-hosted by design.** Your process data never leaves your infrastructure.
- **Data sovereignty built in.** GDPR data export, a 14-day deletion grace period, and consent tracking ship with the product.
- **Auditable.** Every role change and state transition is written to a dedicated, compliance-separated audit log.
- **Bounded access.** Concurrent sessions are capped, and the oldest sessions are revoked automatically.

**Why not another self-hosted tool**

- **Open and inspectable.** Apache-2.0, public CI, published coverage — an **80% line/branch/function/statement gate** is enforced in the pipeline.
- **Tested under load, not just under unit tests.** 10 pre-built k6 scenarios, including a Sprint-planning peak. See [Load Testing](#load-testing-k6).
- **Strict by construction.** TypeScript strict mode across backend, frontend, and shared packages.
- **Localised where it matters.** The interface ships in English, German, Spanish, French, and Italian, with Scrum terminology sourced from the official Scrum Guide.

**For those who have to approve it internally.** Deployment guidance, the security architecture, and the vulnerability-reporting process are all documented in the repository: [Deployment](#deployment), [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md), and [`SECURITY.md`](SECURITY.md).

<a id="features"></a>

## ✨ Features

### The Scrum workflow

Everything needed to run the Sprint — the Guide's five events, three artifacts, and three commitments — with the rule it holds attached to each. Bold clauses repeat the gates in [What Scrumooth Enforces](#what-scrumooth-enforces); that table stays the only list of rules Scrumooth claims.

- **Product Goal** - Strategic alignment and goal tracking; the commitment the backlog serves
- **Product Backlog** - MoSCoW prioritisation (Must, Should, Could, Won't); **only Developers size the work**
- **Sprint Planning** - Configurable sprint durations and capacity planning; **only Developers save the Sprint Backlog**
- **Sprint Execution** - Interactive Kanban board with drag-and-drop; **only the Product Owner can cancel, and only while the Sprint is `ACTIVE`**
- **Daily Scrum** - Shared daily record, with impediment surfacing; **only Developers author it — the Product Owner and Scrum Master observe**
- **Impediment** - Blocker identification and resolution tracking with impact prioritisation (Critical/High/Medium/Low) and target dates; **a Sprint cannot close before its Impediments are resolved**, both terminal states require a written resolution, every write is scoped to the team that raised the impediment, and an unowned impediment falls to the Scrum Master — who is notified when one ages past the escalation threshold
- **Increment** - Product increment management; **The moment a Product Backlog item meets the Definition of Done, an Increment is born**
- **Sprint Review** - Review management, stakeholder feedback, and backlog adjustment; **a Sprint cannot close before its Review is recorded**
- **Sprint Retrospective** - Team reflection and tracked improvement; **a Sprint cannot close before its Retrospective is recorded**

### Governance and operations

- **Workflow Engine** - Role-based permissions and gated state transitions, **enforced server-side**
- **Definition of Done/Ready** - Customisable checklists; **nothing is Done until its checklist passes**
- **Increment integrity** - **Delivered work cannot be silently rewritten**

### Team and organisation

- **Team composition** - One Product Owner and one Scrum Master; **team size capped** (`TEAM_MAX_SIZE`, default `10`)
- **Audit Logging** - Dedicated, compliance-separated log; **every role change and state transition recorded**
- **Dashboard & Reporting** - Real-time metrics and visualisations
- **Team Communication** - Built-in notifications and messaging
- **Team Health Check** - Periodic check-in against the five Scrum values
- **Shared event timeboxes** - One clock for every participant; **timeboxes are surfaced, never force-closed**
- **Privacy controls** - Data export and erasure rights, plus consent tracking

<a id="tech-stack"></a>

## 🛠 Tech Stack

### Backend

- **Runtime:** Node.js 24+
- **Framework:** Express.js 5
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL 18+ with Prisma ORM 7
- **Authentication:** JWT with bcrypt
- **Validation:** Zod
- **Scheduled Jobs:** node-cron
- **Email:** Nodemailer (SMTP, SendGrid, AWS SES providers)
- **Logging:** Winston with rotating file transports

### Frontend

- **Framework:** React 19 with Vite
- **Language:** TypeScript (strict mode)
- **Routing:** React Router 8
- **State Management:** TanStack Query (React Query) + Zustand
- **Visualisation:** Chart.js
- **Styling:** CSS Modules with Design Tokens
- **Error Tracking:** Sentry (optional, via `VITE_SENTRY_DSN`)

### Shared

- TypeScript types and interfaces
- Constants and enumerations
- Utility functions

### Testing & Quality

- **Unit / Integration:** Vitest
- **End-to-End:** Playwright (frontend) + Vitest (backend)
- **Load Testing:** k6 (10 pre-built scenarios)
- **Linting:** ESLint + Stylelint
- **Formatting:** Prettier
- **Git Hooks:** Husky + lint-staged

<a id="project-structure"></a>

## 📁 Project Structure

```
scrumooth/
├── packages/
│   ├── backend/              # Express.js REST API
│   │   ├── src/
│   │   │   ├── controllers/  # API route handlers
│   │   │   ├── services/     # Business logic layer
│   │   │   ├── middleware/   # Express middleware
│   │   │   ├── routes/       # API route definitions
│   │   │   ├── utils/        # Utility functions
│   │   │   └── __tests__/    # Unit, integration, and e2e tests
│   │   ├── prisma/           # Database schema and migrations
│   │   ├── Dockerfile        # Production image
│   │   └── Dockerfile.dev    # Development image
│   ├── frontend/             # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── pages/        # Route-level pages
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── services/     # API client services
│   │   │   ├── stores/       # Zustand stores
│   │   │   └── styles/       # CSS and design tokens
│   │   ├── e2e/              # Playwright end-to-end tests
│   │   ├── Dockerfile        # Production image
│   │   └── Dockerfile.dev    # Development image
│   └── shared/               # Shared types, constants, utilities
├── docs/
│   ├── api/                  # REST API reference
│   ├── architecture/         # System design, data model, security
│   ├── deployment/           # Deployment guides
│   └── user-guide/           # User documentation and guides
├── k6/                       # Load testing scenarios (k6)
│   └── scripts/scenarios/    # pre-built load test scenarios
├── scripts/                  # Build and utility scripts
├── .github/workflows/        # CI, Release, and GitHub Pages deployment
├── docker-compose.yml        # Production Docker Compose
├── docker-compose.dev.yml    # Development Docker Compose
├── CHANGELOG.md              # Version history
├── SECURITY.md               # Security policy and reporting
├── CONTRIBUTING.md           # Contributing guidelines
├── CODE_OF_CONDUCT.md        # Community code of conduct
└── THIRD-PARTY-NOTICES.md    # Third-party License attributions
```

<a id="quick-start"></a>

## ⚡ Quick Start

The fastest way to run a local instance is with Docker Compose:

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
cp packages/backend/.env.production.example packages/backend/.env.production
docker compose up -d
```

This starts the Caddy reverse proxy, backend, frontend, and PostgreSQL. Once running, open <http://localhost> (HTTPS is enabled by default on port 443). For a full manual setup (without Docker), see [Installation](#installation).

> **Note:** The production compose stack requires `packages/backend/.env.production`. If you prefer a fully pre-configured, hot-reloading development environment, use `docker compose -f docker-compose.dev.yml up` instead.

<a id="prerequisites"></a>

## 📋 Prerequisites

- **Node.js** v24.19.0 or higher
- **pnpm** v11.21.0 or higher
- **PostgreSQL** v18 or higher
- **Docker** & **Docker Compose** (optional, for the Quick Start)

<a id="installation"></a>

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
```

### 2. Install Dependencies

This project uses pnpm as its package manager. The project enforces pnpm through preinstall scripts.

```bash
pnpm install
```

### 3. Environment Configuration

Copy the example environment files and configure your settings:

```bash
# Backend configuration
cp packages/backend/.env.example packages/backend/.env

# Frontend configuration
cp packages/frontend/.env.example packages/frontend/.env
```

Edit the environment files with your configuration:

**Backend** (`packages/backend/.env`):

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/scrumooth

# JWT Configuration (generate with: openssl rand -hex 64)
JWT_SECRET=your-64-character-secret-key-here

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Optional: restrict new-account registration to specific email domains.
# Leave empty/unset for open registration. Enforced server-side (HTTP 403 on
# disallowed domains). Tenant-control gate only, not email verification.
REGISTRATION_ALLOWED_EMAIL_DOMAINS=example.com,example.eu
```

**Frontend** (`packages/frontend/.env`):

```env
# Backend API URL
VITE_API_URL=http://localhost:5001/api/v1

# Use mock API (set to false for real backend)
VITE_USE_MOCK_API=false
```

### 4. Database Setup

Generate the Prisma client, then create your database schema. For local development you can use either approach:

```bash
# Generate Prisma client (always required)
pnpm run db:generate

# Option A: Push schema directly (fast iteration, no migration files)
pnpm run db:push

# Option B: Create and apply a migration (recommended for tracked changes)
pnpm run db:migrate
```

For production deployments use `pnpm run db:migrate:prod` to apply existing migrations without prompting.

### 5. Start Development Server

```bash
pnpm run dev
```

This will start both the backend and frontend servers concurrently. To run them independently:

```bash
pnpm run dev:backend    # Backend only (http://localhost:5001)
pnpm run dev:frontend   # Frontend only (http://localhost:5173)
```

<a id="development-commands"></a>

## 🛠 Common Development Commands

For developers, the closest analogy is a linter for your Scrum process — with the difference that matters built in: a linter reports a violation, a gate refuses it.

The most common commands for everyday development:

| Task                     | Command                 |
| ------------------------ | ----------------------- |
| Start backend + frontend | `pnpm run dev`          |
| Start backend only       | `pnpm run dev:backend`  |
| Start frontend only      | `pnpm run dev:frontend` |
| Build all packages       | `pnpm run build`        |

<a id="testing"></a>

## 🧪 Testing

```bash
pnpm run test              # All tests
pnpm run test:coverage     # With coverage report
pnpm run test:unit         # Unit tests only
pnpm run test:integration  # Backend integration tests
pnpm run test:e2e          # End-to-end (backend Vitest + frontend Playwright)
pnpm run test:watch        # Watch mode
```

Coverage thresholds enforced: **80% lines, functions, statements, branches**.

<a id="load-testing-k6"></a>

### Load Testing (k6)

Pre-built load test scenarios live under [`k6/scripts/scenarios/`](k6/scripts/scenarios). Copy [`k6/.env.k6.example`](k6/.env.k6.example) to `k6/.env.k6`, configure your target, then run a scenario such as:

```bash
pnpm run loadtest:normal    # Realistic everyday load
pnpm run loadtest:peak      # Sprint planning rush (worst-case concurrency)
pnpm run loadtest:stress    # Push the system until it breaks
```

> **Prerequisite:** Install [k6](https://k6.io/docs/get-started/installation/) and ensure your target backend is running. Ten scenarios live in [`k6/scripts/scenarios/`](k6/scripts/scenarios); the `loadtest:*` scripts in [`package.json`](package.json) expose eight of them, including endurance, multi-team, daily-scrum, auth, and database stress.

<a id="code-quality"></a>

## 🔍 Code Quality

| Task                 | Command              |
| -------------------- | -------------------- |
| Lint (ESLint)        | `pnpm run lint`      |
| Lint & auto-fix      | `pnpm run lint:fix`  |
| Lint CSS (Stylelint) | `pnpm run lint:css`  |
| Format (Prettier)    | `pnpm run format`    |
| Type check           | `pnpm run typecheck` |
| Security audit       | `pnpm run audit`     |

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full development workflow and quality gates.

<a id="database-management"></a>

## 🗄 Database Management

```bash
pnpm run db:generate     # Generate Prisma client (after schema changes)
pnpm run db:migrate      # Create and apply a migration (development)
pnpm run db:migrate:prod # Apply migrations in production (non-interactive)
pnpm run db:studio       # Open Prisma Studio (database GUI)
```

Additional database commands (`db:push`, `db:reset`, `db:validate`, `db:migrate:test`) are documented in [`CONTRIBUTING.md`](CONTRIBUTING.md).

<a id="docker-support"></a>

## 🐳 Docker Support

The project includes Docker configuration for both development and production deployment.

### Using Docker Compose

```bash
# Development environment (with hot reload)
docker compose -f docker-compose.dev.yml up

# Production environment (detached)
docker compose up -d

# Tear down
docker compose down
```

### Build Docker Images Manually

> **Note:** All Dockerfiles reference repository-root-relative paths (monorepo workspace files such as `package.json`, `pnpm-lock.yaml`, and `packages/shared/`). You must build them from the **repository root** and use `-f` to point at the Dockerfile — passing the package directory as the build context will fail.

```bash
# Development images (with dev dependencies and watch mode)
docker build -t scrumooth-backend:dev -f packages/backend/Dockerfile.dev .
docker build -t scrumooth-frontend:dev -f packages/frontend/Dockerfile.dev .

# Production images (build from the repo root)
docker build -t scrumooth-backend -f packages/backend/Dockerfile .
docker build -t scrumooth-frontend -f packages/frontend/Dockerfile .
```

<details>
<summary>Using a registry/apt mirror</summary>

If you are behind a network that requires an npm registry or apt mirror, you can set them as build arguments or environment variables:

```bash
# Docker Compose
$env:NPM_REGISTRY="https://your_mirror_url"
$env:APT_MIRROR="your_mirror_url"

# Manual build
docker build --build-arg NPM_REGISTRY=https://your_mirror_url --build-arg APT_MIRROR=your_mirror_url .
```

</details>

<a id="deployment"></a>

## ☁️ Deployment

### Self-Hosted Production

See [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md) for full production deployment guidance covering environment configuration, database migration, reverse-proxy setup, and operational best practices.

### Demo Deployment on GitHub Pages

The `main` branch is automatically deployed to GitHub Pages via the [`Deploy to GitHub Pages`](.github/workflows/deploy-github-pages.yml) workflow, using an in-memory **mock API** (no backend or database required). See the [Live Demo](#live-demo) above to try it.

<a id="documentation"></a>

## 📚 Documentation

| Area                    | Location                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **User guide**          | [`docs/user-guide/`](docs/user-guide) — getting started, core features, Scrum workflows                        |
| **REST API reference**  | [`docs/api/`](docs/api) — endpoint groups covering authentication, sprints, backlog, reports, and more         |
| **System architecture** | [`docs/architecture/`](docs/architecture) — system design, data model, component design, security architecture |
| **Deployment guide**    | [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)                                               |
| **Security policy**     | [`SECURITY.md`](SECURITY.md) — vulnerability reporting procedure                                               |
| **Contributing**        | [`CONTRIBUTING.md`](CONTRIBUTING.md) — guidelines and development workflow                                     |
| **Code of conduct**     | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — community standards                                               |
| **Release history**     | [`CHANGELOG.md`](CHANGELOG.md)                                                                                 |
| **Third-party notices** | [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)                                                             |

<a id="troubleshooting"></a>

## 🛟 Troubleshooting

### `Cannot find module @scrumooth/shared`

The shared package must be built before backend/frontend can resolve imports.

```bash
pnpm --filter=@scrumooth/shared run build
```

This is normally handled automatically by `pnpm install` and the dev scripts, but is required after a manual `pnpm run clean`.

### `pnpm install` fails with "Use pnpm instead"

The repository enforces pnpm via a `preinstall` script. Install pnpm globally:

```bash
npm install -g pnpm@11.21.0
```

### Database connection errors on startup

Verify your `DATABASE_URL` in `packages/backend/.env` points to a running PostgreSQL 18+ instance, and that the database exists. Run `pnpm run db:validate` to validate the Prisma schema against the connection.

### Port already in use (5001 or 5173)

Default ports can be overridden via environment variables:

- Backend: `PORT` in `packages/backend/.env`
- Frontend: `VITE_DEV_PORT` in `packages/frontend/.env`

### Frontend cannot reach the backend

Check that `VITE_API_URL` in `packages/frontend/.env` matches the actual backend address and that `CORS_ORIGIN` in `packages/backend/.env` allows the frontend origin.

### Want to develop without a backend?

Set `VITE_USE_MOCK_API=true` in `packages/frontend/.env` to use the same mock API that powers the live demo.

<a id="roadmap"></a>

## 🗺 Roadmap

Scrumooth is under active development. The priorities below deepen what Scrumooth enforces rather than widening it into a general-purpose tracker:

- [ ] **Scrum Guide conformance report** — a per-Sprint statement of which rules applied, and how each was met
- [ ] **Exportable Sprint evidence pack** — a shareable record for audits and compliance reviews
- [ ] **More enforceable rules** — expanding the covered surface of the 2020 Scrum Guide
- [ ] **Deeper Definition of Done / Definition of Ready automation**
- [ ] **Reporting that surfaces process drift**, not just delivery metrics
- [ ] **Integrations and webhooks**, so Scrumooth can sit alongside the tools you already use
- [ ] Performance and scalability hardening

The project status and latest changes are tracked in the [CHANGELOG](CHANGELOG.md). Feedback and feature requests are welcome via [GitHub Issues](https://github.com/orbivort/scrumooth/issues).

<a id="contributing"></a>

## 🤝 Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for development workflow, code standards, and the pull request process, and review the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before participating.

<a id="license"></a>

## 📝 License

This project is licensed under the [Apache License 2.0](LICENSE).

---

_Judge a Scrum tool by the rules it keeps, not by the boards it draws._
