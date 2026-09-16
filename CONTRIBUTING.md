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

> **Tip:** To run the frontend without a backend, set `VITE_USE_MOCK_API=true` in `packages/frontend/.env`.

---

## Development Workflow

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
