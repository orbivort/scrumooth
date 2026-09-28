# Contributing to Scrumooth

First of all, thank you for considering contributing to Scrumooth! Every contribution — code, documentation, bug reports, translations, or feedback — helps make this project better.

Scrumooth is a self-hosted, open-source Scrum Guide enforcement layer: it turns the rules of the **2020 Scrum Guide** into gates the backend enforces, and refuses to let a process violation pass silently. This guide will help you understand how to contribute effectively, whether you are fixing a typo or implementing a new feature.

Please read our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
- [Development Workflow](#development-workflow)
  - [Developing without a backend](#developing-without-a-backend)
  - [Branches](#branches)
  - [Commit Messages](#commit-messages)
- [Code Quality Standards](#code-quality-standards)
  - [TypeScript](#typescript)
  - [Linting & Formatting](#linting--formatting)
  - [Testing](#testing)
- [Internationalization (i18n)](#internationalization-i18n)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [License](#license)

---

## Code of Conduct

This project and everyone participating in it is governed by the [Scrumooth Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

---

## Ways to Contribute

You can contribute in many ways:

- **Report bugs** — file a clear, reproducible bug report.
- **Suggest features** — propose ideas that improve the Scrum workflow.
- **Fix bugs** — pick up an issue labeled `bug` or `good first issue`.
- **Implement features** — work on an issue labeled `enhancement`.
- **Improve documentation** — clarify, correct, or translate docs.
- **Translate** — help keep all five locales (English, German, Spanish, French, Italian) in sync.
- **Review pull requests** — provide constructive feedback.
- **Improve test coverage** — add tests for untested code paths.

---

## Getting Started

### Prerequisites

- **Node.js** `24.19.0` or higher (see the `engines` field in [`package.json`](./package.json))
- **pnpm** `11.21.0` or higher — the project enforces pnpm via a `preinstall` script; `npm`/`yarn` will fail
- **PostgreSQL** `18` or higher (required for backend integration and E2E tests)

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth

# 2. Install dependencies (pnpm only)
pnpm install

# 3. Configure the backend environment
cp packages/backend/.env.example packages/backend/.env

# 4. Configure the frontend environment
cp packages/frontend/.env.example packages/frontend/.env

# 5. Generate the Prisma client and create the database schema
pnpm run db:generate
pnpm run db:migrate

# 6. Start the development servers (backend + frontend)
pnpm run dev
```

> **Tip:** To run the frontend without a backend, set `VITE_USE_MOCK_API=true` in `packages/frontend/.env`, then `pnpm run dev:frontend`. See [Developing without a backend](#developing-without-a-backend) below.

---

## Development Workflow

### Developing without a backend

Mock mode is a self-contained demo environment: Mock Service Worker answers the
application's own HTTP requests, so every screen, guard and workflow runs as it does
against the real API — including the axios interceptors, the CSRF handshake and the
401 refresh flow. There is no second implementation of the product's rules in the
app bundle.

```bash
# The committed .env already enables it; start only the frontend
pnpm run dev:frontend

# Or, without touching your .env
VITE_USE_MOCK_API=true pnpm --filter=@scrumooth/frontend run dev
```

On the login page you can then pick one of the persona cards and sign in with one
click. Every card is a role in a team: the Product Owner of one team, that same
person as the Scrum Master of the other, and the Developers of both. Switching team
changes the role, and therefore the menus, gates and available actions.

**When you change the product, change the mock with it.** The mock layer answers the
endpoints the app calls, so an endpoint added to a domain service needs a handler:
four layers, one file each.

| Layer               | Where                   | Change it when                           |
| ------------------- | ----------------------- | ---------------------------------------- |
| Fictional seed      | `src/mocks/fixtures/`   | demo content changes                     |
| Working copy        | `src/mocks/store/db.ts` | a new collection must be read or written |
| Endpoint responders | `src/mocks/handlers/`   | an endpoint contract changes             |
| Shared plumbing     | `src/mocks/support/`    | envelope, latency, ids, gate refusals    |

Refusals must carry the gate contract: `gate(GATE_CODES.X, …)` reads the HTTP status
from `GATE_DEFINITIONS`, the same table the backend throws from, so the interface can
present the rule, the Guide clause and the recovery action. A gate the mock does not
model is a gate the real API does not have either — inventing one here would make the
demo refuse something the product allows.

The mock layer is opt-in, is dropped from normal production bundles and cannot be
enabled in a production-mode build (see the guard in `vite.config.ts`). A build with
mocks enabled is a **demo build**, produced only through `--mode demo` and the
committed `.env.demo`.

- Working guide: [`packages/frontend/src/mocks/README.md`](./packages/frontend/src/mocks/README.md)
- Architecture: [`docs/architecture/frontend-mock-architecture.md`](./docs/architecture/frontend-mock-architecture.md)
- Contract tests: `packages/frontend/src/__tests__/msw-contract.test.ts` — the suite
  that proves the handlers answer the shapes the application parses.

### Branches

- Create a branch from `develop` for all changes. Branch names are validated by CI and should follow the pattern `type/description`, e.g. `feat/add-gantt-view` or `fix/backlog-cache`.
- The CI pipeline validates branch names via `pnpm run branch:validate`.

### Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and enforces them with `commitlint`:

```
<type>(<scope>): <subject>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`.

Examples:

```
feat(sprint): add 1-week and 3-week sprint duration options
fix(backlog): resolve React Query cache conflict with sprint planning
docs(api): document the data export endpoints
```

---

## Code Quality Standards

### TypeScript

The project uses **strict mode** (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess`).

- Never use `any` without justification and never use `@ts-ignore` — fix the root cause instead.
- Prefer nullish coalescing (`??`) and optional chaining (`?.`).
- Use type-only imports: `import type { User } from '@scrumooth/shared';`.

### Linting & Formatting

Run the full quality suite before opening a pull request:

```bash
pnpm run typecheck      # TypeScript checks
pnpm run lint           # ESLint
pnpm run lint:css       # Stylelint (CSS/SCSS)
pnpm run format:check   # Prettier check
```

The CI pipeline runs all of the above plus the i18n validation. Make sure your changes pass locally first.

### Testing

The coverage target is **80%** across lines, functions, statements, and branches.

```bash
pnpm run test              # All tests
pnpm run test:unit         # Unit tests
pnpm run test:integration  # Backend integration tests
pnpm run test:e2e          # End-to-end tests
pnpm run test:coverage     # With coverage
```

- Write tests following the AAA (Arrange/Act/Assert) pattern.
- Mock external dependencies and clean up test data in `afterEach`.
- Add tests for new features and bug fixes.
- The frontend suite runs against the mock backend: `setupTests.ts` starts the same
  handler registry `pnpm dev` uses and resets the store, session and any armed
  failure scenario between tests, so no test leaks state. The mock layer's own
  fidelity is covered by `src/__tests__/msw-contract.test.ts`, which makes real
  requests over `fetch` rather than mocking a service.

---

## Internationalization (i18n)

Scrumooth supports five locales: **English, German, Spanish, French, and Italian**. All user-facing strings must use translation keys — never hardcode text.

- Backend translations live in `packages/backend/src/locales/`.
- Frontend translations live in `packages/frontend/public/locales/`.
- When you add or change a string, update **all five locales**.

Before submitting, run:

```bash
pnpm run i18n:check          # Validate locale key completeness
pnpm run i18n:completeness   # Generate a completeness report
```

---

## Documentation

Documentation lives in the [`docs/`](./docs) directory and in the root-level `*.md` files. When you change behavior, update the relevant documentation:

- **User guide** — `docs/user-guide/`
- **API reference** — `docs/api/`
- **Architecture** — `docs/architecture/`
- **Deployment** — `docs/deployment/`

The README is available in English, German, Spanish, French, and Italian. If you change `README.md`, keep the localized versions in sync or flag them for a maintainer.

---

## Pull Request Process

1. Ensure your branch is up to date with `develop`.
2. Run the full quality suite (`typecheck`, `lint`, `lint:css`, `format:check`, and relevant tests).
3. Use the pull request template to describe your changes, the type of change, and the list of changes made.
4. Link any related issue(s) using `Closes #<issue>` in the description.
5. Ensure all CI checks pass. The pipeline runs lint, typecheck, unit/integration/E2E tests, coverage, security audit, and CodeQL analysis.
6. Wait for review from a maintainer and address any feedback.

---

## Reporting Issues

- **Bugs** — use the **Bug Report** template and include steps to reproduce, expected vs. actual behavior, and environment details.
- **Features** — use the **Feature Request** template and include a problem statement, proposed solution, and acceptance criteria.
- **Security vulnerabilities** — do **not** open a public issue. Follow the responsible disclosure process in [SECURITY.md](./SECURITY.md).

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](./LICENSE).
