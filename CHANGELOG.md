# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.2] - 2026-09-13

### Security

- Remediate **high**- and **moderate**-severity dependency vulnerabilities
  (8 findings: 2 high, 6 moderate):
  - `nodemailer` 9.0.1 → 9.1.1 — **direct production dependency**. Fixes a quadratic (O(n²)) time
    complexity in `addressparser` that allows a remote denial of service via a crafted address list
    ([GHSA-2x7j-588g-ccc2](https://github.com/advisories/GHSA-2x7j-588g-ccc2)), a bypass of
    `disableFileAccess`/`disableUrlAccess` when `resolveContent()` is called on a `MailMessage` with
    the legacy signature ([GHSA-8m3c-c648-2xjj](https://github.com/advisories/GHSA-8m3c-c648-2xjj)),
    an IDN/Punycode domain allow-list bypass that delivers mail to an attacker-controlled domain
    ([GHSA-wmmp-3585-3rmp](https://github.com/advisories/GHSA-wmmp-3585-3rmp)), and a
    recipient-domain validation bypass via RFC 5322 comment mis-parsing
    ([GHSA-cc9r-2j5m-2m83](https://github.com/advisories/GHSA-cc9r-2j5m-2m83))
  - `js-yaml` 4.3.1 → 4.3.2 — fixes `maxTotalMergeKeys` not limiting CPU use for empty merge sources
    ([GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh)), on top of the
    previously pinned `!!omap` quadratic CPU consumption fix (GHSA-52cp-r559-cp3m). It is pulled by
    `cosmiconfig` through the commitlint and stylelint toolchains
  - `colord` 2.9.3 → 2.10.0 — fixes slow rejection of oversized malformed color strings
    ([GHSA-2wm5-q62r-hmrv](https://github.com/advisories/GHSA-2wm5-q62r-hmrv)). It is pulled by
    `stylelint`
  - `vitest` and `@vitest/mocker` 4.1.10 → 4.1.11 — fixes path traversal / arbitrary file read via
    the `@vitest/mocker` redirect mock
    ([GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)). `@vitest/coverage-v8`
    and `@vitest/ui` are bumped alongside to keep the Vitest family aligned

## [3.0.1] - 2026-09-05

### Security

- Remediate **high**- and **moderate**-severity transitive dependency vulnerabilities:
  - `browserslist` → 4.28.8 — fixes unbounded memory growth (no cache eviction) from
    distinct query results leading to eventual OOM
    ([GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx)) and an
    uncaught crash / prototype write via untrusted `browserslist-stats.json` custom stats
    ([GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g)). It is pulled
    by `@babel/helper-compilation-targets`, `core-js-compat`, `doiuse`, and
    `stylelint-no-unsupported-browser-features`
  - `mysql2` 3.15.3 → 3.24.3 — fixes an auth-plugin downgrade to `mysql_clear_password`
    that leaks plaintext credentials
    ([GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr)) and an
    unbounded zlib-inflate decompression-bomb DoS in the compressed protocol handler
    ([GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3)). It is pulled
    by the Prisma CLI, which pins the vulnerable version exactly
  - `fast-uri` 3.1.5 → 3.1.7 — fixes SSRF / host confusion via malformed IPv6,
    percent-decoding, and IDN normalization
    ([GHSA-5jgf-p345-68v8](https://github.com/advisories/GHSA-5jgf-p345-68v8),
    [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc),
    [GHSA-fph4-wmhf-6fwf](https://github.com/advisories/GHSA-fph4-wmhf-6fwf),
    [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp)). It is pulled by
    `ajv` through the commitlint and stylelint toolchains
  - `qs` 6.15.3 → 6.16.0 — fixes an array-limit bypass via bracket-key comma parsing
    ([GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)) and a DoS via
    an attacker-controlled `isBuffer`
    ([GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)). It is pulled
    by Express, body-parser, and superagent

## [3.0.0] - 2026-08-25

### Breaking Changes

- **Daily Scrum redesigned to goal-focused inspection**: the Daily Scrum flow now revolves around the Sprint Goal. The legacy "daily update" model is removed, so clients must adopt the new Daily Scrum API and Sprint Backlog linkage model.
- **Sprint closure gates**: Sprint Review and Retrospective must be completed before a Sprint can be closed. Automation or clients that closed Sprints directly must update their flows to complete these events first.
- **`REVIEW` task state added**: the task workflow now includes a `REVIEW` state between the previous active states and `DONE`. Consumers of task states should account for the new transition.
- **Role `DEVELOPER` renamed to `DEVELOPERS`**: the role identifier has changed across API payloads, permissions and UI. Clients must use `DEVELOPERS` instead of `DEVELOPER`.
- **Data model**: consolidate and simplify the Prisma schema, merging initial migrations

### Added

#### Scrum Guide Compliance Enforcement

- **Maximum Scrum Team size**: enforce a maximum team size (default 10) in line with the Scrum Guide's recommended team size
- **Single Product Owner / Scrum Master**: enforce a single PO and a single SM per Scrum Team
- **Developers-only sizing**: enforce that only DEVELOPERS may assign story points to PBIs
- **Developers-only assignments**: enforce that tasks can only be assigned to DEVELOPERS, and only DEVELOPERS may be assigned as task assignees
- **Developers self-management**: enforce DEVELOPERS self-management protection for task handling
- **Task state transitions**: restrict task status changes to DEVELOPERS only
- **Sprint Goal & DoD verification**: enforce the Sprint Goal check and Definition of Done verification during sprint execution
- **Role permissions on active Sprint**: enforce role-based permissions for active Sprint operations
- **Sprint cancellation**: add a Sprint cancellation feature for Product Owner

#### Daily Scrum - Goal-Focused Inspection

- **Sprint Backlog linkage**: add adaptation linkage items to the Sprint Backlog within the Daily Scrum

#### Sprint Review & Retrospective Enhancements

- **Sprint Review enhancements**: improve Sprint Review features, including Active Sprints listing and mulitple Increments inclusion
- **Retrospective enhancements**: improve Retrospective features, including Active Sprints listing

#### Event Timeboxes

- **Event timeboxing**: add event timeboxes for Sprint Planning, Daily Scrum, Sprint Review and Retrospective, with timebox configuration and tracking

#### Sprint Planning & Execution

- **Save and resume Sprint Planning**: support saving and resuming an in-progress Sprint Planning session
- **Quick PBI marking**: add quick marking of PBIs as done directly on the Sprint Board, with the DoD Verification gate
- **Sprint Configuration**: simplify sprint generation feature

#### Dashboard & Reports

- **Dashboard and reports enhancement**: enhance dashboards and reports

#### Notification & i18n

- **i18n for notifications**: add the required i18n support to notifications

### Removed

- **Legacy Daily Scrum updates**: remove the legacy daily update funtionality
- **Bulk DoD checks**: remove bulk DoD checks from the Sprint completion flow

## [2.3.1] - 2026-08-18

### Security

- **deepmerge-ts**: fix high stack exhaustion (DoS) vulnerability - override to ^8.0.0
  - GHSA-ggr8-5vv4-36mx / CVE-2026-40345: unbounded recursion in `deepmerge()`/`deepmergeInto()` when merging recursive object graphs can crash the process with `RangeError: Maximum call stack size exceeded` (availability only; plain JSON is not affected)

## [2.3.0] - 2026-08-17

### Added

- **login**: add email domain restriction to account registration

### Security

- **node**: bump Node.js from `24.14.1` to `24.19.0`
- **pnpm**: bump pnpm from `11.5.0` to `11.21.0`
- **nginx**: bump the production nginx image from `1.27` to `1.30`
- **build**: refresh dev/transitive dependencies with the latest stable versions
- **docker**: pin the Node base image to Debian `trixie` (Debian 13)
- **docker**: enhance docker build

## [2.2.0] - 2026-08-13

### Added

#### Increment Integrity

- **Cross-Increment integration verification**: add integration test tracking and a verification gate to ensure each new Increment is additive and compatible with prior Increments, per the Scrum Guide's requirement that "all Increments work together"

#### Scrum Master Facilitation Dashboard

- **Scrum Master dashboard**: add a dedicated SM facilitation dashboard (role-gated to SCRUM_MASTER)
  - Event compliance tracking for the last 5 Sprints (completed/missed events, timebox adherence)
  - Impediment metrics: status distribution, average resolution time, and aging report
  - Team DoD compliance trend (compliance percentage per Sprint)
  - Sprint Goal achievement rate (achieved / partially / not achieved across completed Sprints)
  - Retrospective action item completion (total, completed, pending, overdue counts)
  - Scrum values health check aligned with the five Scrum Values
- **Scrum Master notes**: add SM Notes section on Sprint Review and Retrospective (visible to SCRUM_MASTER)

#### Sprint Review Product Goal Visibility

- **Product Goal visibility**: display the linked Product Goal prominently on the Sprint Review page
- **Product Goal progress snapshots**: add a Product Goal Snapshot model capturing success metric values, completed PBI count, completed story points, and stakeholder assessment summary at each Sprint Review

#### Scrum Values Integration

- **Scrum Values banner**: add a subtle, collapsible banner rotating through the five Scrum Values (Commitment, Focus, Openness, Respect, Courage) to Sprint Planning, Daily Scrum, Sprint Review and Retrospective
- **Scrum Values reflection**: add value-based reflection prompts section to the Sprint Retrospective (collapsible and opt-in)
- **Scrum values health check survey**: add Scrum values health check survey to Team

## [2.1.2] - 2026-08-11

### Security

- **js-yaml**: fix high quadratic CPU consumption vulnerability - override to ^4.3.1
  - CVE-2026-59870 / GHSA-5p4m-2wfm-xmqj: quadratic CPU consumption in `!!omap` resolution, not backported to the 4.x line patched by GHSA-52cp-r559-cp3m
- **nanoid**: fix high DoS vulnerability - override to ^3.3.17
  - GHSA-2v37-7h3g-55p8: custom generators can loop indefinitely when size is zero

## [2.1.1] - 2026-08-04

### Security

- **sanitize-html**: fix moderate URI scheme validation vulnerability - upgrade to 2.17.6
  - GHSA-vccv-cmxp-4j9h: incomplete URI scheme validation allows javascript: URIs through action, formaction, data, poster, and background attributes
- **ip-address**: fix 3 vulnerabilities (1 high, 2 moderate) - override to ^10.3.1
  - GHSA-mwp4-54f8-5fhr (high): leading-zero octets decoded as decimal instead of octal, allowing SSRF and trust-boundary bypass
  - GHSA-4xrf-jv44-h6hh (moderate): CIDR suffix suppresses special-use classification and can bypass SSRF and trust-boundary checks
  - GHSA-22jq-vg5j-6vgg (moderate): misclassification of IPv4-mapped/NAT64 IPv6 addresses can bypass SSRF and trust-boundary checks
- **undici**: fix 5 vulnerabilities (1 high, 4 moderate) - override to ^7.29.0
  - GHSA-4cwx-7wf7-3272 (high): cross-user information disclosure and parse-time crash via degenerate private cache directives
  - GHSA-8xcm-r25x-g524 (moderate): downstream response desynchronization via retry interceptor
  - GHSA-m8rv-5g2x-5cg5 (moderate): CRLF Injection via blob-like body 'type' property
  - GHSA-jr45-8vmc-qm54 (moderate): cross-user information disclosure via whitespace around equals in Cache-Control directives
  - GHSA-v3r7-h72x-cjcm (moderate): cookie attribute injection via unsanitized domain and unparsed setCookie fields
- **fast-uri**: fix high host confusion vulnerability - override to ^3.1.5
  - GHSA-7p8r-x3mc-p8w7: host confusion via backslash authority introducer
- **brace-expansion**: fix high DoS vulnerability - override to ^5.0.9
  - GHSA-rgw5-rvv9-x895: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation
- **hono**: fix moderate ReDoS vulnerability - override to ^4.12.34
  - GHSA-8j4g-w8fx-2239: ReDoS in CORS middleware via Access-Control-Request-Headers

## [2.1.0] - 2026-07-30

### Added

- **i18n**: add i18n multi language support
- **i18n**: support English, Deutsch, Español, Français, Italiano

## [2.0.5] - 2026-07-29

### Security

- **react-router**: fix high CSRF bypass vulnerability - migrate from react-router-dom to react-router v8.3.0
  - GHSA-qwww-vcr4-c8h2: RSC Mode CSRF Bypass allows action execution before 400 response
- **postcss**: fix high path traversal vulnerability - override to ^8.5.18
  - GHSA-r28c-9q8g-f849: Path traversal in source map auto-loading (sourceMappingURL) leads to arbitrary .map file disclosure
- **valibot**: fix moderate record() issue vulnerability - override to ^1.4.2
  - GHSA-5qjj-4xww-7phc: record() issue paths can make flatten() throw for inherited Object property names

## [2.0.4] - 2026-07-24

### Security

- **axios**: fix 9 vulnerabilities (5 high, 4 moderate) - upgrade to 1.18.0
  - GHSA-gcfj-64vw-6mp9 (high): Axios Node HTTP adapter can use an inherited proxy after interceptor config cloning
  - GHSA-42h9-826w-cgv3 (high): Prototype pollution auth subfields can inject Basic auth
  - GHSA-pmv8-rq9r-6j72 (high): Prototype pollution gadgets can alter axios request construction
  - GHSA-jqh4-m9w3-8hp9 (high): Excessive recursion in formDataToJSON can cause denial of service
  - GHSA-mmx7-hfxf-jppx (high): Deep formToJSON Key Recursion Can Cause Denial of Service
  - GHSA-f4gw-2p7v-4548 (moderate): Fetch adapter ReadableStream uploads bypass maxBodyLength
  - GHSA-hcpx-6fm6-wx23 (moderate): Axios can be tricked into using prototype-polluted headers
  - GHSA-7q8q-rj6j-mhjq (moderate): Axios fetch adapter never calls request interceptor
  - GHSA-mwf2-3pr3-8698 (moderate): Axios may leak proxy credentials to a third-party site
- **react-router**: fix 3 vulnerabilities (1 high, 2 moderate) - upgrade to 7.18.0
  - GHSA-wrjc-x8rr-h8h6 (moderate): open redirect vulnerability in redirect handling
  - GHSA-h8fp-f39c-q6mh (moderate): XSS vulnerability in error boundaries
  - GHSA-337j-9hxr-rhxg (high): constructor injection vulnerability
- **brace-expansion**: fix high DoS vulnerability - override to 5.0.7
  - GHSA-3jxr-9vmj-r5cp: DoS via exponential-time expansion of consecutive non-expanding {} groups
- **js-yaml**: fix high CPU consumption vulnerability - override to 4.3.0
  - GHSA-52cp-r559-cp3m: YAML merge-key chains can force quadratic CPU consumption
- **shell-quote**: fix high DoS vulnerability - override to 1.8.5
  - GHSA-395f-4hp3-45gv: Quadratic-complexity Denial of Service in parse()
- **fast-uri**: fix 2 high host confusion vulnerabilities - override to 3.1.4
  - GHSA-v2hh-gcrm-f6hx: host confusion via literal backslash authority delimiter
  - GHSA-4c8g-83qw-93j6: host confusion via failed IDN canonicalization
- **hono**: fix 3 moderate vulnerabilities - override to 4.12.27
  - GHSA-xgm2-5f3f-mvvc: API Gateway header dropping via Host header manipulation
  - GHSA-hvrm-45r6-mjfj: JSX context isolation bypass
  - GHSA-w62v-xxxg-mg59: XSS vulnerability in cx() utility
- **@hono/node-server**: fix moderate path traversal vulnerability - override to 2.0.5
  - GHSA-frvp-7c67-39w9: path traversal in serve-static on Windows via encoded backslash
- **body-parser**: fix low DoS vulnerability - override to 2.3.0
  - GHSA-v422-hmwv-36x6: DoS when invalid limit value silently disables size enforcement

## [2.0.3] - 2026-06-19

### Security

- **nodemailer**: fix high vulnerability - arbitrary file read and SSRF via message-level raw option bypassing disableFileAccess/disableUrlAccess - GHSA-p6gq-j5cr-w38f (upgrade to 9.0.1)
- **undici**: fix high vulnerability - TLS certificate validation bypass via dropped requestTls in SOCKS5 ProxyAgent - CVE-2026-9697 / GHSA-vmh5-mc38-953g (override to 7.28.0)
- **hono**: fix high vulnerability - CORS middleware reflects any Origin with credentials when `origin` defaults to the wildcard - CVE-2026-54290 / GHSA-88fw-hqm2-52qc (override to 4.12.25)

- **undici**: fix moderate vulnerability - cross-user information disclosure via shared cache whitespace bypass - CVE-2026-9678 / GHSA-pr7r-676h-xcf6 (override to 7.28.0)
- **hono**: fix 4 moderate vulnerabilities in Prisma dev tools transitive dependency (override to 4.12.25)
  - CVE-2026-54286 / GHSA-wwfh-h76j-fc44 - path traversal in serve-static on Windows via encoded backslash
  - CVE-2026-54287 / GHSA-j6c9-x7qj-28xf - AWS Lambda adapter merges multiple Set-Cookie headers incorrectly
  - CVE-2026-54288 / GHSA-rv63-4mwf-qqc2 - Body Limit Middleware bypass on AWS Lambda
  - CVE-2026-54289 / GHSA-wgpf-jwqj-8h8p - Lambda@Edge adapter drops repeated request headers

## [2.0.2] - 2026-06-16

### Security

- **form-data**: fix CRLF injection vulnerability in form-data via unescaped multipart field names and filenames - CVE-2026-12143

## [2.0.1] - 2026-06-13

### Security

- **esbuild**: fix high RCE vulnerability via NPM_CONFIG_REGISTRY due to missing binary integrity verification in Deno module - GHSA-gv7w-rqvm-qjhr

## [2.0.0] - 2026-06-09

### Changed

- **BREAKING**: rename repository from scrsphere to scrumooth
  - change repository url from github.com/orbivort/scrsphere to github.com/orbivort/scrumooth
  - change package names from @scrsphere/_ to @scrumooth/_
  - change docker container names from scrsphere-_ to scrumooth-_
  - change database names from scrsphere to scrumooth
  - update all import statements from @scrsphere/shared to @scrumooth/shared
  - update all documentation files with new product name
  - update environment configuration templates
  - update docker compose configurations
  - update github actions workflows
  - update all scripts and utilities
  - update brand assets
- **pnpm**: upgrade to 11.5.0 and migrate configuration to pnpm-workspace.yaml
- **docker**: update development and production configurations
- **prisma**: remove old migrations and update initial migration
- **dependencies**: update various frontend and backend dependencies
- **dependencies**: remove unused dependencies

### Security

- **pnpm**: enable supply chain protection to prevent zero-day supply chain attacks
- **dependencies**: fix 2 high transitive vulnerabilities
  - CVE-2020-7788 (ini prototype pollution) - fixed by upgrading ini to 4.1.3
  - CVE-2025-64756 (glob command injection) - fixed by upgrading glob to 11.1.0

## [1.5.1] - 2026-06-05

### Security

- **react-router**: fix high DoS vulnerability - CVE-2026-42342
- **hono**: fix 4 moderate vulnerabilities - CVE-2026-47673, CVE-2026-47674, CVE-2026-47675, CVE-2026-47676

## [1.5.0] - 2026-05-29

### Added

- **frontend**: add base path support for flexible deployment configurations
- **frontend**: add GitHub Pages support for live demo deployment
- **docs**: add user guide and core feature documentation

### Changed

- **auth**: remove unused administrator role, streamline role-based access control

### Fixed

- **product backlog**: resolve React Query cache conflict between Sprint Planning and Product Backlog views

### Security

- **axios**: fix 4 vulnerabilities (2 high, 1 moderate, 1 low) - CVE-2026-44492, CVE-2026-44494, CVE-2026-44490, CVE-2026-44489

## [1.4.1] - 2026-05-23

### Security

- **qs**: fix moderate DoS vulnerability - CVE-2026-8723

## [1.4.0] - 2026-05-22

### Added

- **product backlog**: add configurable maximum backlog size control

### Changed

- **sprint configuration**: adjust sprint end date to previous Friday if it falls on a weekend

## [1.3.0] - 2026-05-15

### Added

- **sprint configuration**: add 1-week and 3-week sprint duration options

### Changed

- **frontend**: enhance mock data flow for running frontend without backend server

### Security

- **sanitize-html**: fix critical XSS vulnerability - CVE-2026-44990

## [1.2.0] - 2026-05-10

### Added

- **configuration**: add production environment templates
- **docs**: add comprehensive API and architecture documentation

### Changed

- **frontend**: improve end-to-end test reliability and mock state management

### Fixed

- **frontend**: resolve 3 CodeQL warnings for useless conditionals and unreachable code
- **frontend**: resolve 1232 ESLint warnings for type safety and code quality
- **backend**: resolve 351 ESLint warnings for type safety and code quality

## [1.1.0] - 2026-05-06

### Changed

- **auth**: improve rate limiting configuration for API abuse prevention
- **security**: add CSRF protection for all state-changing operations
- **logging**: fix log injection vulnerability in audit logs

### Security

- **api**: add rate limiting on all endpoints to prevent brute force attacks
- **csrf**: implement CSRF middleware for state-changing operations
- **logging**: resolve log injection vulnerability (CodeQL alert no. 5)

## [1.0.0] - 2026-05-04

### Added

#### Core Infrastructure

- **Monorepo Architecture**: Project structure with pnpm workspaces
  - Backend package with Express.js and TypeScript
  - Frontend package with React 19 and Vite
  - Shared package for common types and utilities
- **Backend Foundation**: Core backend infrastructure
  - Express.js server with TypeScript strict mode
  - Prisma ORM 7.x integration with PostgreSQL 18+
  - Database connection pooling and configuration
  - Middleware stack (CORS, Helmet, compression, rate limiting)
  - Request ID tracking with AsyncLocalStorage
  - Custom error handling with specialized error classes
  - Structured logging with Winston and log rotation
  - Service layer architecture pattern
- **Frontend Foundation**: Core frontend infrastructure
  - React 19 application with Vite build system
  - TypeScript strict mode configuration
  - React Router for client-side routing
  - TanStack Query (React Query) for server state management
  - Zustand for client state management
  - CSS modules with design tokens
  - Axios-based API client with interceptors
  - Error boundaries for graceful error handling
- **Development Tools**: Essential development tooling
  - ESLint configuration with TypeScript support
  - Prettier for code formatting
  - Stylelint for CSS linting
  - Git hooks with Husky and lint-staged
  - EditorConfig for consistent editor settings
  - TypeScript configurations for all packages
- **Docker Support**: Containerization for development and production
  - Multi-stage Dockerfiles for backend and frontend
  - Docker Compose configurations
  - Development and production container setups
- **CI/CD Pipeline**: Automated testing and deployment
  - GitHub Actions workflows for CI/CD
  - Automated testing on pull requests
  - Release automation workflow
  - Parallel test execution

#### Authentication and Authorization

- **Authentication System**: Complete authentication implementation
  - User registration with email validation
  - Login with secure JWT tokens
  - Password hashing with bcrypt (configurable work factors)
  - Refresh token mechanism with rotation
  - Secure HTTP-only cookie storage
  - Logout functionality with token revocation
  - Session management with activity tracking
- **Authorization**: Role-based access control (RBAC)
  - User roles: Product Owner, Scrum Master, Developer
  - Route protection middleware
  - Permission-based feature access
  - Role-based UI rendering
  - Team-specific permissions
- **Session Security**: Enhanced session management
  - Idle timeout (30 minutes configurable)
  - Absolute timeout (24 hours configurable)
  - Concurrent session management (max 5 sessions)
  - Session warning modal with timeout countdown
  - Session cleanup job for expired sessions
- **User Management**: Basic user features
  - User profile creation and editing
  - Avatar management with DiceBear integration
  - Email validation and verification
  - Password strength requirements
  - Password change functionality
  - Profile validation with detailed error messages

#### Team Management

- **Team Creation and Configuration**: Comprehensive team management
  - Team creation with name and description
  - Team settings and configuration
  - Team-specific workflows and processes
  - Team context management across application
- **Team Member Management**: Member administration
  - Team member role assignment (Product Owner, Scrum Master, Developer)
  - Team member invitations via email
  - Member removal with permission checks
  - Role updates and transfers
  - Team member listing and search
- **Team Navigation**: Enhanced team switching
  - Team switcher component in navigation
  - Team selection modal for multi-team users
  - Team context persistence across sessions
  - Quick team switching functionality

#### Product Management

- **Product Goals**: Strategic goal management
  - Product goal creation with title and description
  - Goal status tracking (New, Active, Completed, Abandoned)
  - Target date setting with calendar picker
  - Success metrics definition and tracking
  - Strategic alignment documentation
  - Goal progress visualization
  - Backlog item association with goals
  - Goal filtering and search
- **Product Backlog**: Comprehensive backlog management
  - Product backlog item (PBI) creation and management
  - MoSCoW prioritization (Must Have, Should Have, Could Have, Won't Have)
  - Business value assignment and tracking
  - Story point estimation with Fibonacci sequence
  - Acceptance criteria documentation with markdown support
  - Label management and filtering
  - Backlog item status tracking (New, Refined, Ready, In Progress, Done)
  - Product goal association
  - Backlog item ordering with drag-and-drop
  - Bulk editing capabilities
  - Advanced filtering and search
  - Backlog item templates
  - Import/export functionality

#### Sprint Management

- **Sprint Planning**: Complete sprint planning functionality
  - Sprint creation with configurable duration (2 or 4 weeks)
  - Sprint goal definition and tracking
  - Product backlog item selection for sprint
  - Story point capacity planning
  - Sprint backlog management
  - Sprint naming with auto-generation
  - Sprint date range selection
- **Sprint Configuration**: Automated sprint generation
  - Yearly sprint calendar generation
  - Configurable sprint start day (Monday default)
  - Sprint naming conventions (Sprint 1, Sprint 2, etc.)
  - Sprint template management
  - Sprint number auto-assignment
- **Sprint Board**: Interactive Kanban board
  - Drag-and-drop task management
  - Status columns (To Do, In Progress, Done)
  - Task filtering and search
  - Quick task creation and editing
  - Real-time board updates
  - Virtual scrolling for performance
  - Task assignment visualization
- **Sprint Execution**: Enhanced sprint execution features
  - Task management within sprint backlog items
  - Task assignment to team members
  - Task status tracking (To Do, In Progress, Done)
  - Estimated and remaining hours tracking
  - Sprint backlog change tracking with history
  - Sprint cancellation with reason documentation
  - Sprint completion workflow
- **Daily Scrum**: Daily standup tracking and management
  - Daily update submission (yesterday, today, impediments)
  - Update history viewing and editing
  - Impediment auto-creation from daily updates
  - Daily update reminders and notifications
  - Update analytics and trends
- **Impediment Tracking**: Comprehensive impediment management
  - Impediment creation with detailed description
  - Impediment assignment to team members
  - Status tracking (Open, In Progress, Resolved, Closed)
  - Resolution documentation
  - Sprint and team association
  - Impediment aging and reporting
  - Impediment metrics and trends

#### Sprint Reviews and Retrospectives

- **Sprint Reviews**: Complete sprint review functionality
  - Review meeting scheduling and management
  - Stakeholder feedback collection and categorization
  - Backlog adjustment tracking and implementation
  - Increment delivery documentation
  - Attendee management with roles
  - Review summary and notes
  - Action item tracking from feedback
- **Sprint Retrospectives**: Full retrospective support
  - Three-column retrospective format (Went Well, Didn't Go Well, Improvements)
  - Anonymous feedback option for team members
  - Dot voting system for prioritization
  - Action item tracking with due dates and owners
  - DoD evolution notes and improvements
  - Facilitator assignment and management
  - Retrospective status tracking (Draft, In Progress, Completed)
  - Retrospective history and trends
- **Increment Management**: Product increment tracking
  - Increment creation and management
  - PBI association with increments
  - Story point tracking and totals
  - Delivery method tracking (Sprint Review, Early Release)
  - Increment verification workflow
  - Increment status tracking (Draft, Verified, Delivered, Archived)
  - Increment history and documentation

#### Definition of Done/Ready

- **Definition of Done (DoD)**: Customizable completion checklists
  - Team-specific DoD definitions
  - Checklist item management with categories
  - Verification tracking per PBI
  - Category organization and ordering
  - Version history for DoD changes
  - DoD item activation/deactivation
- **Definition of Ready (DoR)**: Customizable readiness checklists
  - Team-specific DoR definitions
  - Checklist item management with categories
  - Verification tracking per PBI
  - Category organization and ordering
  - Version history for DoR changes
  - DoR item activation/deactivation

#### Workflow Engine

- **Workflow Management**: Customizable state transitions
  - Entity-specific workflows (Sprint, PBI, Task, Impediment)
  - State definition with display names and colors
  - Transition configuration between states
  - Role-based transition permissions
  - User-specific transition restrictions
  - Transition conditions and validation
  - Workflow activation and deactivation
- **Status Change History**: Complete audit trail
  - Status change tracking for all entities
  - Change reason documentation
  - Change notes and metadata
  - Historical status view
  - Status change analytics

#### Notifications and Communication

- **Notification System**: Real-time notifications
  - Team activity notifications
  - Task assignment notifications
  - Impediment assignment alerts
  - Daily update reminders
  - Team invitation notifications
  - Account management notifications
  - Notification badge with unread count
  - Notification panel with filtering
  - Mark as read/unread functionality
  - Notification polling (configurable interval)
  - Notification retention and cleanup
- **Direct Messaging**: Team communication
  - Direct messages between team members
  - Message history and threading
  - Message notifications

#### Reporting and Analytics

- **Reporting Dashboard**: Comprehensive metrics and visualizations
  - Sprint velocity charts with trends
  - Burndown and burnup charts
  - Team performance metrics
  - Product goal progress tracking
  - Sprint completion rate analytics
  - Impediment resolution metrics
  - Team capacity utilization
  - Story point distribution
- **Charts and Visualizations**: Interactive data presentation
  - Chart.js integration for visualizations
  - Responsive chart components
  - Export chart data functionality
  - Custom date range filtering
  - Team comparison views

#### Email Service

- **Email Infrastructure**: Production-ready email service
  - Provider abstraction layer (SMTP, SendGrid, SES, Test)
  - SMTP provider with connection pooling and authentication
  - Test provider for development and testing environments
  - Database logging for all email operations
  - Batch email sending capability
  - Health check endpoints for provider status
  - Input validation and error handling
  - Configurable default sender and reply-to addresses
- **Email Templates**: Professional email templates
  - Welcome email template with getting started guide
  - Password reset email template with secure links
  - Password change notification template
  - Template engine with HTML and text versions
  - Responsive email design with mobile support
  - Outlook and Microsoft Office compatibility
  - Brand-consistent styling and formatting
- **Email Types**: Support for multiple email types
  - Welcome emails for new user registration
  - Password reset and recovery emails
  - Password change notifications
  - Email verification messages
  - Team invitation emails
  - Account deletion notifications
  - General notification emails

#### Load Testing and Performance

- **K6 Load Testing Framework**: Comprehensive performance testing
  - Normal load testing scenario
  - Sprint planning peak load simulation
  - Stress breaking point testing
  - Workday endurance testing (8+ hours)
  - Multi-team concurrent usage scenarios
  - Daily scrum rush hour simulation
  - Authentication flood testing
  - Database stress testing
  - Memory leak detection scenarios
  - Sprint review peak load testing
  - Test data generation utilities
  - Results analysis and optimization tools
  - Comprehensive testing guide documentation
- **Performance Monitoring**: Real-time performance tracking
  - Event loop monitoring utility
  - Request latency tracking
  - Database query performance metrics
  - Memory usage monitoring
  - CPU utilization tracking

#### Monitoring and Observability

- **Monitoring Stack**: Production monitoring infrastructure
  - Prometheus metrics collection
  - Grafana visualization dashboards
  - Docker Compose monitoring setup
  - Pre-configured datasources
  - Custom dashboard templates
  - Metrics retention configuration
  - Alerting rule definitions
- **Application Metrics**: Comprehensive metrics collection
  - HTTP request metrics
  - Database connection pool metrics
  - Authentication success/failure rates
  - API endpoint response times
  - Error rate tracking
  - Session management metrics

#### Workflow Enhancements

- **Workflow Lock Service**: Cross-instance coordination
  - PostgreSQL advisory locks for workflow initialization
  - Race condition prevention across multiple instances
  - Session-level locks with automatic release
  - Timeout-based lock acquisition with retry logic
  - Lock key management for different entity types
  - Comprehensive logging for lock operations

#### Data Management and Privacy

- **Consent Management**: GDPR Article 7 compliance system
  - Consent recording and tracking
  - Consent history with full audit trail
  - Consent withdrawal functionality
  - Consent statistics and reporting
  - Cookie consent management
  - Privacy preference management
  - IP address and user agent tracking
  - Version-controlled consent records
- **Data Export**: Data export functionality
  - User data export in JSON and CSV formats
  - Complete audit trail export
  - Export request tracking
  - Secure download links
- **Account Deletion**: Secure account deletion with grace period
  - 14-day grace period with cancellation option
  - Team impact warnings and analysis
  - Force delete capability for team owners
  - Scheduled deletion job with automatic cleanup
  - Deletion confirmation with safety phrase
  - Deletion status tracking

#### Security Features

- **Authentication Security**: Production-grade authentication
  - Rate limiting on all API endpoints (configurable)
  - CSRF protection for state-changing operations
  - Input validation and sanitization on all inputs
  - SQL injection prevention with Prisma parameterized queries
  - XSS prevention with React's built-in escaping
  - Secure markdown rendering with sanitization
- **Session Security**: Enhanced session protection
  - Secure cookie configuration (HttpOnly, Secure, SameSite)
  - Session activity tracking
  - Concurrent session limits
  - Automatic session cleanup
- **Audit Logging**: Comprehensive action logging
  - User action tracking across all operations
  - Data modification history
  - Security event logging
  - Structured log format with rotation
  - Log retention policies (14 days default)
  - Audit log search and filtering
- **HTTP Security Headers**: Secure HTTP configuration
  - Content Security Policy (CSP) headers
  - HTTP Strict Transport Security (HSTS)
  - X-Frame-Options, X-Content-Type-Options
  - Referrer-Policy headers
  - Helmet middleware integration
- **Rate Limiting**: API abuse prevention
  - Configurable rate limits per endpoint
  - IP-based and user-based limiting
  - Graceful degradation with retry headers

#### Performance Optimizations

- **Database Performance**: Query optimization
  - Proper indexing on all frequently queried fields
  - Composite indexes for complex queries
  - Query optimization with Prisma select/include
  - Database connection pooling
  - Transaction support for data integrity
  - 50% improvement in query performance
- **Frontend Performance**: Bundle and rendering optimization
  - Code splitting by route
  - Tree shaking for unused code elimination
  - Lazy loading for routes and components
  - React.memo and useMemo for expensive renders
  - Virtual scrolling for large lists (TanStack Virtual)
  - 40% reduction in bundle size
- **Caching Strategy**: Efficient data caching
  - TanStack Query for server state caching
  - Configurable stale times and cache times
  - Query deduplication
  - Optimistic updates
  - Background refetching
- **Asset Optimization**: Resource loading optimization
  - Image lazy loading
  - Image compression
  - CSS optimization with design tokens
  - Efficient pagination for large datasets
  - Bundle analysis tools integration

#### Accessibility and UX

- **Accessibility Compliance**: WCAG 2.2 AA compliance
  - Keyboard navigation support
  - Screen reader compatibility
  - ARIA labels and roles
  - Focus management
  - Color contrast compliance
  - Accessible forms and validation
- **User Experience**: Enhanced UX features
  - Loading states with skeleton components
  - Error boundaries for graceful error handling
  - Toast notifications for user feedback
  - Confirmation dialogs for destructive actions
  - Unsaved changes warnings
  - Draft auto-save and restore
  - Help panels and tooltips
  - Responsive design for all screen sizes
  - Mobile-friendly interfaces

#### Documentation

- **API Documentation**: Complete API reference
  - REST API documentation
  - Request/response examples
  - Authentication guide
  - Error code reference
- **Architecture Documentation**: System design guides
  - Architecture overview
  - Database schema documentation
  - Component structure guide
  - State management patterns
- **User Documentation**: End-user guides
  - Getting started guide
  - Feature walkthroughs
  - Best practices
  - FAQ section
- **Developer Documentation**: Development guides
  - Development setup guide
  - Contributing guidelines
  - Code style guide
  - Testing guide
  - Deployment guide

### Security

- **Critical**: Implemented rate limiting on all API endpoints to prevent brute force attacks
- **Critical**: Added CSRF protection for all state-changing operations
- **Critical**: Implemented secure session management with idle and absolute timeouts
- **Critical**: Added comprehensive input validation and sanitization on all user inputs
- **Critical**: Implemented audit logging for all sensitive operations
- **Critical**: SQL injection prevention through Prisma parameterized queries
- **Critical**: XSS prevention with React's built-in escaping and markdown sanitization
- **High**: Enhanced password hashing with bcrypt and configurable work factors
- **High**: Implemented secure cookie configuration with HttpOnly, Secure, and SameSite flags
- **High**: Added Content Security Policy headers
- **High**: Implemented secure HTTP headers with Helmet middleware
- **High**: JWT token authentication with secure refresh mechanism
- **High**: Email service security with provider authentication and encryption
- **High**: Secure email template rendering with input sanitization
- **Medium**: Added request ID tracking for security audit trails
- **Medium**: Implemented secure data export with user consent tracking
- **Medium**: Added account deletion with grace period and team impact warnings
- **Medium**: Implemented CORS configuration with explicit origin whitelisting
- **Medium**: Email logging with comprehensive audit trail
- **Medium**: Workflow lock service for preventing race conditions

### Performance

- **Major**: Optimized database queries with proper indexing (50% improvement in query performance)
- **Major**: Implemented query result caching with TanStack Query
- **Major**: Optimized frontend bundle size with code splitting and tree shaking (40% reduction)
- **Major**: Implemented lazy loading for routes and components
- **Major**: Added database connection pooling with Prisma
- **Major**: Implemented virtual scrolling for large lists and boards
- **Major**: Comprehensive K6 load testing framework with 10+ test scenarios
- **Major**: Event loop monitoring for real-time performance tracking
- **Major**: Memory leak detection and prevention mechanisms
- **Medium**: Optimized image loading with lazy loading and compression
- **Medium**: Implemented efficient pagination for large datasets
- **Medium**: Optimized React rendering with React.memo and useMemo
- **Medium**: Added bundle analysis and optimization tools
- **Medium**: Prometheus and Grafana monitoring stack for production
- **Medium**: Real-time application metrics collection
- **Medium**: Database performance monitoring and optimization
- **Minor**: Optimized CSS with design tokens and CSS modules
- **Minor**: Reduced unnecessary API calls with proper caching strategies
- **Minor**: Implemented query deduplication and background refetching

---

## Support

For questions, issues, or security concerns:

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/orbivort/scrumooth/issues)
- **Security**: See [SECURITY.md](SECURITY.md) for security policy

---

**Copyright 2026 Orbivort**

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
