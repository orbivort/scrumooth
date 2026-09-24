# Component Design

This document provides a detailed overview of the Scrumooth component architecture, including frontend component hierarchy, state management patterns, data flow, styling conventions, and backend service layer design.

## Table of Contents

- [Overview](#overview)
- [Frontend Component Architecture](#frontend-component-architecture)
- [Component Categories](#component-categories)
- [State Management Architecture](#state-management-architecture)
- [Data Flow Patterns](#data-flow-patterns)
- [Routing Architecture](#routing-architecture)
- [Styling Architecture](#styling-architecture)
- [Custom Hooks Architecture](#custom-hooks-architecture)
- [Error Handling Patterns](#error-handling-patterns)
- [Loading State Patterns](#loading-state-patterns)
- [Form Handling Patterns](#form-handling-patterns)
- [Backend Service Layer Design](#backend-service-layer-design)
- [Shared Package Architecture](#shared-package-architecture)

---

## Overview

Scrumooth follows a component-based architecture built on React 19 with TypeScript in strict mode. The design philosophy centers on four principles:

1. **Separation of Concerns** - Each component has a single, well-defined responsibility. Business logic is extracted into hooks and services; presentation logic stays in components.
2. **Composition over Inheritance** - Components are composed from smaller, reusable pieces rather than extended through class hierarchies. Shared behavior is achieved through custom hooks and shared utilities.
3. **Type Safety** - All components, hooks, and services use strict TypeScript with no `any` types. Props interfaces are explicitly defined and exported alongside each component.
4. **Progressive Enhancement** - The UI degrades gracefully. Error boundaries isolate failures. Loading states provide feedback at every level. Lazy loading keeps the initial bundle small.

The architecture enforces a strict unidirectional data flow from API services through TanStack Query into components, with Zustand managing only client-side UI state. This separation ensures that server state and client state remain independent and predictable.

---

## Frontend Component Architecture

The component hierarchy follows a top-down structure from the application root through layout, pages, and reusable primitives:

```
┌─────────────────────────────────────────────────────┐
│                       App                           │
│  ┌───────────────────────────────────────────────┐  │
│  │            ErrorBoundary (Global)             │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │       QueryClientProvider               │  │  │
│  │  │  ┌───────────────────────────────────┐  │  │  │
│  │  │  │       AnnouncerProvider           │  │  │  │
│  │  │  │  ┌─────────────────────────────┐  │  │  │  │
│  │  │  │  │         Router              │  │  │  │  │
│  │  │  │  │  ┌───────────────────────┐  │  │  │  │  │
│  │  │  │  │  │   AuthInitializer     │  │  │  │  │  │
│  │  │  │  │  │  ┌─────────────────┐  │  │  │  │  │  │
│  │  │  │  │  │  │ SessionWarning  │  │  │  │  │  │  │
│  │  │  │  │  │  │  ┌───────────┐  │  │  │  │  │  │  │
│  │  │  │  │  │  │  │TeamProvider│ │  │  │  │  │  │  │
│  │  │  │  │  │  │  │ ┌───────┐ │  │  │  │  │  │  │  │
│  │  │  │  │  │  │  │ │ Routes│ │  │  │  │  │  │  │  │
│  │  │  │  │  │  │  │ └───────┘ │  │  │  │  │  │  │  │
│  │  │  │  │  │  │  └───────────┘  │  │  │  │  │  │  │
│  │  │  │  │  │  └─────────────────┘  │  │  │  │  │  │
│  │  │  │  │  └───────────────────────┘  │  │  │  │  │
│  │  │  │  └─────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App
├── ErrorBoundary (Global)
├── GlobalToastContainer
├── QueryClientProvider
│   └── AnnouncerProvider
│       └── Router
│           ├── AuthInitializer
│           └── SessionWarningWrapper
│               └── TeamProvider
│                   └── TeamInitializer
│                       └── Routes
│                           ├── Public Routes
│                           │   ├── LoginPage
│                           │   ├── ForgotPasswordPage
│                           │   └── ResetPasswordPage
│                           └── Protected Routes
│                               └── ProtectedRoute
│                                   └── Layout
│                                       ├── Sidebar
│                                       ├── Header
│                                       └── Main Content (Page)
│                                           ├── Dashboard
│                                           ├── Backlog
│                                           ├── SprintBoard
│                                           ├── SprintPlanning
│                                           ├── DailyScrum
│                                           ├── Impediments
│                                           ├── Team
│                                           ├── ProductGoals
│                                           ├── IncrementList
│                                           ├── SprintReview
│                                           ├── Retrospective
│                                           ├── Reports
│                                           ├── Notifications
│                                           └── Settings
└── SessionWarningModal
```

**Key Design Decisions**:

- The `ErrorBoundary` wraps the entire application to catch unhandled errors at the top level.
- `QueryClientProvider` is placed inside the error boundary so that query failures can be caught.
- `TeamProvider` is nested inside `AuthInitializer` because team data is only available after authentication.
- `ProtectedRoute` enforces authentication and wraps each route with the `Layout` component.
- Each protected route is wrapped in `ChunkErrorBoundary` and `Suspense` via the `LazyRoute` component.

---

## Component Categories

### Common Components

Common components are reusable UI primitives located in `packages/frontend/src/components/common/`. They have no domain-specific logic and accept configuration through props.

```
components/common/
├── Button/
│   ├── Button.tsx              # Primary, secondary, link, danger, warning variants
│   ├── Button.module.css       # Variant and size styles
│   └── index.ts                # Public export
├── Disclosure/
│   ├── Disclosure.tsx          # A summary row or a quiet pill that opens onto its detail
│   ├── Disclosure.module.css   # Both trigger shapes, one body
│   └── index.ts                # Public export
├── Form/
│   ├── CharacterCounter.tsx     # Textarea character count display
│   ├── ChunkErrorBoundary.tsx   # Catches lazy-load chunk failures
│   ├── DraftRestorePrompt.tsx   # Restores saved form drafts
│   ├── HelpPanel.tsx           # Contextual form help
│   └── UnsavedChangesModal.tsx # Prevents navigation with unsaved data
├── Icons/
│   ├── *.tsx                   # 100+ individual icon components
│   ├── types.ts                # IconProps interface
│   └── index.ts                # Barrel export for all icons
├── Loading/
│   ├── LoadingState.tsx        # Unified loading with variant support
│   ├── SkeletonCard.tsx        # Card skeleton placeholder
│   ├── SkeletonChart.tsx       # Chart skeleton placeholder
│   ├── SkeletonList.tsx        # List skeleton placeholder
│   ├── SkeletonText.tsx        # Text skeleton placeholder
│   └── index.ts
├── Page/
│   ├── LoadingSpinner.tsx      # Spinner component
│   ├── PageHeader.tsx          # Page title and action bar
│   ├── PageLoader.tsx          # Full-page loading state
│   ├── ProgressBar.tsx         # Determinate progress indicator
│   └── SkipLink.tsx            # Accessibility skip navigation
└── ToastContainer/
    ├── GlobalToastContainer.tsx # App-level toast provider
    ├── ToastContainer.tsx       # Toast rendering and auto-dismiss
    └── index.ts
```

**Button Component**:

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'link' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}
```

The Button component supports five visual variants, three sizes, and a loading state that disables interaction and displays a spinner. It uses `forwardRef` for ref forwarding.

**Icon System**:

All icons follow a consistent pattern. Each icon is a separate component file that accepts `IconProps` with `size`, `color`, and `className` properties. Icons are exported from a barrel `index.ts` file for clean imports:

```typescript
import { SprintIcon, TeamIcon, BellIcon } from '@/components/common/Icons';
```

Inline SVGs are prohibited outside the Icons directory. The ESLint rule `icon-rules/no-inline-svg` enforces this convention.

### Feature Components

Feature components are domain-specific and located in `packages/frontend/src/components/` (cross-cutting features) and `packages/frontend/src/pages/` (page-scoped features). Each page directory contains its own sub-components, hooks, modals, and utilities.

```
components/                          # Cross-cutting feature components
├── AccountDeletion/                 # Account deletion workflow
│   ├── ConfirmationInput.tsx
│   ├── DangerZone.tsx
│   ├── DeleteAccountModal.tsx
│   ├── DeletionRightsNotice.tsx
│   ├── ForceDeleteWarning.tsx
│   ├── GracePeriodProgress.tsx
│   └── TeamImpactWarning.tsx
├── AttendeesSection/                # Meeting attendees UI
├── ConfirmDialog/                   # Reusable confirmation dialog
├── DragDropIndicator/               # Drag-and-drop visual feedback
├── EmptyState/                      # Empty data state display
├── ErrorBoundary/                   # Error boundary variants
├── ErrorMessage/                    # Error message display
├── Layout/                          # Main application layout
├── LiveAnnouncer/                   # Accessible live region
├── MarkdownRenderer/                # Markdown content rendering
├── Notifications/                   # Notification badge and panel
├── Profile/                         # User profile modals
├── SessionWarning/                  # Session timeout warning
├── StatusHistorySection/            # Status change timeline
├── StatusSelector/                  # Status dropdown selector
├── TeamMemberSelect/                # Team member picker
├── TeamSelection/                   # Team selection modal
└── TeamSwitcher/                    # Active team switcher
```

```
pages/                               # Page-scoped feature components
├── Backlog/
│   ├── components/                  # MoscowCard, BacklogFilterBar, etc.
│   ├── modals/                      # CreateItemModal, EditItemModal, etc.
│   ├── hooks/                       # useBacklogData, useDragAndDrop, etc.
│   ├── context/                     # BacklogContext
│   ├── views/                       # BoardView, ListView
│   ├── config/                      # Moscow and status configurations
│   ├── types/                       # Backlog-specific types
│   └── utils/                       # Validation, label, status utilities
├── Sprint/
│   ├── components/
│   │   ├── modals/                  # TaskCreateModal, TaskDetailModal, etc.
│   │   ├── KanbanColumn.tsx
│   │   ├── TaskCard.tsx
│   │   ├── SwimlanesBoard.tsx
│   │   ├── SprintBoardHeader.tsx
│   │   └── BurndownChart.tsx
│   └── utils/                       # Form validation and change detection
├── SprintPlanning/
│   └── components/                  # AddTaskModal, StartSprintModal, etc.
├── SprintReview/
│   └── AddFeedbackModal, CreateSprintReviewModal, etc.
├── Dashboard/
│   └── components/                  # BurndownChart, TaskList, ImpedimentList
├── Settings/
│   ├── TeamManagement/              # Team CRUD components
│   ├── TeamGroups/                  # Group administration: create, rename, delete, roster
│   ├── SprintConfiguration/         # Sprint config settings
│   └── PrivacyData/                 # Data export and privacy controls
├── ProductGoals/                    # Product goal modals
├── Increment/                       # Increment list, detail, create
├── Retrospective/                   # Retrospective and action items
├── DailyScrum/                      # Daily scrum updates
├── Impediments/                     # Impediment tracking
├── Reports/                         # Velocity chart
├── Notifications/                   # Notification page
├── Team/                            # The team module: overview, members, Definition tab, health
└── Auth/                            # Login, forgot/reset password
```

**Feature Component Conventions**:

- Each page directory is self-contained with its own `components/`, `hooks/`, `modals/`, and `utils/` subdirectories.
- Page-level components export a default or named component that serves as the route target.
- Sub-components are imported only by their parent page, not shared across pages.
- Cross-cutting feature components (e.g., `Notifications/`, `TeamSwitcher/`) live in the top-level `components/` directory.

### The Unified Definition Surface

`pages/Team/Definition/` is one surface over one commitment, in whichever scope governs the team. It
is worth reading as a unit because its shape is the answer to a defect rather than a preference: the
Definition of Done used to be reachable in three places — a Settings page that could not write it for
a grouped team, a group admin screen that could, and a governance panel under Scrum Health — and none
of them was visible to the Developers the Guide says must conform to it.

| Component                  | Owns                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DefinitionPanel`          | The order of the sections, the in-page navigation, the anchors a link can name, the namespace fallback |
| `SectionNav`               | One anchor per agreement, the count beside it, and which section is current                            |
| `useSectionDeepLink`       | The fragment a link named, the section being read, and the measured sticky offset                      |
| `DefinitionOfDoneSection`  | The read, and the write **routed by the resolved scope**                                               |
| `DefinitionScopeSwitch`    | The scope statement, and the decisions behind it: review, adopt/leave, drift, who may act              |
| `DefinitionOfReadySection` | The readiness practice, its own history, and its pill                                                  |
| `VersionHistoryPopover`    | One badge's history, fetched only when it is opened                                                    |
| `DefinitionEditor`         | Add, reword, reorder, deactivate, remove — shared by every scope and both agreements                   |
| `criterionLabel`           | One criterion's wording: the seed translated from its `defaultKey`, or the team's own sentence         |

The three agreements are reached by an in-page navigation rather than by tabs, and that is a decision
rather than an omission: the anchors are the identity the deep links already publish, the three are read
in the order the Guide implies rather than as parallel views, and the module keeps one tab rail instead
of nesting a second one under it.

Three invariants hold this together:

- **The write follows the scope, not the screen.** A team-scoped write is never issued while the team
  is grouped, so `GATE_DOD_GROUP_GOVERNED` stays unreachable from the interface while the API keeps
  enforcing it. Offering a control whose only possible answer is "no" is the failure mode this avoids.
- **The editor cannot send a `defaultKey`.** Its payload type is narrower than the criterion it was
  loaded from, so a client cannot label a sentence it wrote itself with the product's built-in wording.
  The service owns that column.
- **The offset a deep link has to clear is measured, never assumed.** The fragment targets a section
  heading, so the heading carries the `scroll-margin-top` — an offset on the wrapping `<section>` would
  be a silent no-op. Its two parts come from the running shell (the topbar is sized by its contents, and
  below 768px it becomes `fixed` while the shell pads the content instead), so `useSectionDeepLink`
  measures both and publishes them as custom properties that the heading and the sticky navigation
  consume. A constant would be wrong on one of the two breakpoints, and a heading would open underneath
  the chrome it is meant to clear.

### Gate Refusals

`components/common/GateRefusal/` is the one place a Scrum rule refusal is explained. Given an error,
`useGateRefusal` resolves its `code` through `GATE_DEFINITIONS` to the copy under the `gate` i18n
namespace and reports the rule, the 2020 Scrum Guide clause where one exists, and the remedy. The
caller supplies the control that performs the remedy, because only the caller knows the context —
re-reviewing a version that changed under the reader's feet is a different act from asking a Scrum
Master for an edit.

The namespace is deliberately partial: the gates the commitment surfaces can provoke have copy, and any
other code falls back to the server's already-localized message rather than explaining nothing.
Extending it is additive content, with no code change.

### Layout Components

Layout components define the application shell and are located in `packages/frontend/src/components/Layout/`.

```
┌──────────────────────────────────────────────────────────────┐
│                         Layout                               │
│  ┌────────────┐  ┌──────────────────────────────────────────┐│
│  │            │  │  Header (user menu, notifications,       ││
│  │            │  │  team switcher)                          ││
│  │            │  ├──────────────────────────────────────────┤│
│  │  Sidebar   │  │                                          ││
│  │            │  │          Main Content Area               ││
│  │  - Nav     │  │          (Route Children)                ││
│  │  - Teams   │  │                                          ││
│  │  - Settings│  │                                          ││
│  │            │  │                                          ││
│  │            │  │                                          ││
│  └────────────┘  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Layout Component**:

The `Layout` component (`Layout.tsx`) is the primary shell for authenticated pages. It integrates:

- **Sidebar** - Collapsible navigation with team switcher, nav items, and settings groups. Uses `useUIStore` for collapsed state, `useTeamContext` for team data, and `useResponsive` for mobile detection.
- **Header** - User menu dropdown, notification badge and panel, and team context display.
- **Main Content** - Renders route children with proper scrolling and responsive behavior.

**ErrorBoundary Variants**:

Three error boundary variants provide scoped error handling:

| Component             | Scope  | Behavior                                         |
| --------------------- | ------ | ------------------------------------------------ |
| `ErrorBoundary`       | Global | Catches all unhandled errors, shows retry UI     |
| `PageErrorBoundary`   | Page   | Isolates errors to a single page                 |
| `WidgetErrorBoundary` | Widget | Isolates errors to a dashboard widget or section |

---

## State Management Architecture

Scrumooth uses a dual state management strategy: TanStack Query for server state and Zustand for client state. This separation ensures that each tool handles what it is designed for.

### Server State (TanStack Query)

TanStack Query manages all data fetched from the backend API. It provides caching, background refetching, optimistic updates, and automatic cache invalidation.

```
┌─────────────────────────────────────────────────────┐
│                 TanStack Query                      │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Query     │  │   Query     │  │   Query     │  │
│  │   Cache     │  │   Cache     │  │   Cache     │  │
│  │  (Sprint)   │  │  (Team)     │  │  (Backlog)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │         │
│  ┌──────┴────────────────┴────────────────┴──────┐  │
│  │              Query Key Factory                │  │
│  │  queryKeys.sprint.active(teamId)              │  │
│  │  queryKeys.team.list({ search, page })        │  │
│  │  queryKeys.task.bySprint(sprintId)            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Configuration:                                     │
│  - staleTime: 5 minutes                             │
│  - retry: 2 (excluding 401/403)                     │
│  - refetchOnWindowFocus: false                      │
└─────────────────────────────────────────────────────┘
```

**Query Key Factory**:

Query keys follow a hierarchical factory pattern for type-safe cache management:

```typescript
export const queryKeys = {
  sprint: {
    all: ['sprints'] as const,
    lists: () => [...queryKeys.sprint.all, 'list'] as const,
    list: (filters) => [...queryKeys.sprint.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.sprint.details(), id] as const,
    active: (teamId: string) => [...queryKeys.sprint.all, 'active', teamId] as const,
    stats: (sprintId: string) => [...queryKeys.sprint.detail(sprintId), 'stats'] as const,
  },
  team: {
    all: ['teams'] as const,
    list: (filters) => [...queryKeys.team.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.team.details(), id] as const,
    members: (teamId: string) => [...queryKeys.team.detail(teamId), 'members'] as const,
  },
  task: {
    all: ['tasks'] as const,
    detail: (id: string) => [...queryKeys.task.details(), id] as const,
    bySprint: (sprintId: string) => [...queryKeys.task.lists(), { sprintId }] as const,
  },
  // ... additional domains: burndown, definitionOfDone, myTeams, notification, etc.
};
```

**One question, one family**: a query key belongs to the _subject_, never to the screen reading it. The
Definition of Done is the clearest case: a team and its group read the same commitment row, and the
same row is read by the team's Definition tab, its Sprint boundary hint and the group's own screen.
They all live in `queryKeys.definitionOfDone`:

```typescript
definitionOfDone: {
  all: ['definition-of-done'] as const,
  byTeam: (teamId) => [...all, 'team', teamId] as const,   // the commitment as a team works to it
  byGroup: (groupId) => [...all, 'group', groupId] as const, // the same row as the group owns it
  history: (teamId) => [...all, 'history', teamId] as const,
},
```

Every Definition of Done write invalidates `definitionOfDone.all`, so both views and the history
refresh from one write. Two families for one row is what let a surface keep showing a superseded
version while another showed the current one.

`queryKeys.team.byId` is declared under `team.details()` for the same reason: as its own `['team', id]`
root it was invisible to `invalidateQueries({ queryKey: team.all })`, so a write that changed a team's
group membership left the team's own read stale.

**Cache Invalidation Pattern**:

Mutations invalidate related query keys on success to ensure data consistency:

```typescript
export const useCreateTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTeamInput) => apiService.createTeam(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTeams.all });
    },
  });
};
```

### Client State (Zustand)

Zustand manages client-side UI state that does not originate from the server. The store is located in `packages/frontend/src/store/index.ts`.

```
┌─────────────────────────────────────────────────────┐
│                   Zustand Store                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │              Auth Store (persisted)          │   │
│  │  - user: User | null                         │   │
│  │  - isAuthenticated: boolean                  │   │
│  │  - isLoading: boolean                        │   │
│  │  - error: string | null                      │   │
│  │  - isDeletingAccount: boolean                │   │
│  │  - deletionEligibility: DeletionEligibility  │   │
│  │  - isUpdatingProfile: boolean                │   │
│  │  - isChangingPassword: boolean               │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │            Session Store                     │   │
│  │  - sessionConfig: SessionConfig | null       │   │
│  │  - showWarningModal: boolean                 │   │
│  │  - timeRemaining: number                     │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │              UI Store                        │   │
│  │  - sidebarCollapsed: boolean                 │   │
│  │  - toggleSidebar: () => void                 │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Store Design Principles**:

- The `AuthStore` uses `persist` middleware to survive page refreshes. It stores authentication state in `localStorage` under the key `auth-storage`.
- The `SessionStore` manages session timeout warnings and idle/absolute timeout behavior. It delegates timer management to the `sessionManager` service.
- The `UIStore` manages transient UI preferences like sidebar collapsed state.
- Server data (teams, sprints, backlog items) is never duplicated in Zustand. It lives exclusively in TanStack Query cache.

### State Flow Diagram

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────┐
│  User    │     │  Component   │     │  Custom Hook  │     │  API     │
│  Action  │────>│  (React)     │────>│  (useQuery /  │────>│  Service │
│          │     │              │     │  useMutation) │     │  Layer   │
└──────────┘     └──────┬───────┘     └───────┬───────┘     └────┬─────┘
                        │                     │                   │
                        │                     │                   │
                        ▼                     ▼                   ▼
                 ┌──────────────┐     ┌───────────────┐     ┌──────────┐
                 │  Zustand     │     │  TanStack     │     │  Backend │
                 │  (UI State)  │     │  Query Cache  │     │  API     │
                 │              │     │ (Server State)│     │          │
                 └──────────────┘     └───────────────┘     └──────────┘
                        │                     │
                        │                     │
                        └──────────┬──────────┘
                                   │
                                   ▼
                          ┌───────────────┐
                          │  Component    │
                          │  Re-render    │
                          └───────────────┘
```

**State Flow Rules**:

1. User actions trigger component event handlers.
2. Event handlers call mutation functions from custom hooks.
3. Mutations call API service methods, which communicate with the backend.
4. On mutation success, TanStack Query invalidates related cache keys.
5. Invalidated queries trigger background refetches.
6. Components re-render with fresh data from the cache.
7. UI state changes (sidebar toggle, modal open) go directly to Zustand.

---

## Data Flow Patterns

The data flow follows a strict layered pattern from API services through TanStack Query into components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Flow Layers                         │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Layer 1: Core API Infrastructure (api.core.ts)            │ │
│  │  - Axios instance with interceptors                        │ │
│  │  - CSRF token management                                   │ │
│  │  - Team context header injection (X-Team-Id)               │ │
│  │  - Request/response logging                                │ │
│  │  - Auth error handling (401 auto-logout)                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Layer 2: Domain Services (services/domain/*.service.ts)   │ │
│  │  - authService, teamService, sprintService, etc.           │ │
│  │  - Each service encapsulates a domain's API calls          │ │
│  │  - Type-safe request/response interfaces                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Layer 3: API Facade (services/api.ts)                     │ │
│  │  - Backward-compatible ApiService class                    │ │
│  │  - Delegates to domain services                            │ │
│  │  - Re-exports all domain services                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Layer 4: Custom Hooks (hooks/*.ts)                        │ │
│  │  - useSprintBoard, useTeamManagement, useNotifications     │ │
│  │  - Wrap TanStack Query useQuery/useMutation                │ │
│  │  - Define query keys, stale times, cache invalidation      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Layer 5: Components (components/, pages/)                 │ │
│  │  - Consume hooks for data and actions                      │ │
│  │  - Handle loading, error, and empty states                 │ │
│  │  - Render UI based on hook return values                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Domain Services**:

| Service                 | Domain            | Key Operations                           |
| ----------------------- | ----------------- | ---------------------------------------- |
| `authService`           | Authentication    | Login, logout, session management        |
| `teamService`           | Teams             | CRUD, member management, role assignment |
| `sprintService`         | Sprints           | Create, start, complete, cancel          |
| `sprintBacklogService`  | Sprint Backlog    | Add/remove PBIs, track changes           |
| `productBacklogService` | Product Backlog   | CRUD, prioritization, MoSCoW             |
| `productGoalsService`   | Product Goals     | CRUD, status transitions                 |
| `dailyScrumService`     | Daily Scrum       | Create, inspect & adapt the Daily Scrum  |
| `impedimentsService`    | Impediments       | Create, resolve, assign                  |
| `reportsService`        | Reports           | Velocity, burndown, sprint metrics       |
| `definitionService`     | Definitions       | DoD/DoR checklist management             |
| `sprintConfigService`   | Sprint Config     | Sprint duration and settings             |
| `incrementService`      | Increments        | Create, deliver, track increments        |
| `sprintReviewService`   | Sprint Reviews    | Create reviews, add feedback             |
| `retrospectiveService`  | Retrospectives    | Create, add action items                 |
| `systemParamsService`   | System Parameters | Global configuration                     |
| `dataExportService`     | Data Export       | GDPR data export                         |

---

## Routing Architecture

Scrumooth uses React Router v6 with lazy-loaded route components and protected route wrappers.

### Route Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Route Hierarchy                        │
│                                                             │
│  Public Routes (no authentication required)                 │
│  ├── /login                    → LoginPage                  │
│  ├── /register                 → LoginPage (register mode)  │
│  ├── /forgot-password          → ForgotPasswordPage         │
│  └── /reset-password/:token    → ResetPasswordPage          │
│                                                             │
│  Protected Routes (authentication required)                 │
│  ├── /dashboard                → Dashboard                  │
│  ├── /backlog                  → ProductBacklog             │
│  ├── /product-goals            → ProductGoalsPage           │
│  ├── /sprint-planning          → SprintPlanning             │
│  ├── /sprint                   → SprintBoard                │
│  ├── /daily-scrum              → DailyScrum                 │
│  ├── /impediments              → Impediments                │
│  ├── /team                     → Team (Overview|Members|Definition|Health)│
│  ├── /reports                  → Reports                    │
│  ├── /increments               → IncrementList              │
│  ├── /increment/:id            → IncrementDetail            │
│  ├── /increment/create         → IncrementCreate            │
│  ├── /sprint-review            → SprintReviewList           │
│  ├── /sprint-review/:id        → SprintReview               │
│  ├── /retrospectives           → RetrospectiveList          │
│  ├── /retrospectives/:id       → SprintRetrospective        │
│  ├── /notifications            → Notifications              │
│  └── /settings/*               → Settings sub-routes        │
│      ├── /settings/team-management    → TeamManagement      │
│      ├── /settings/team-groups        → TeamGroups          │
│      ├── /settings/sprint-configuration → SprintConfiguration│
│      ├── /settings/privacy-data       → PrivacyData         │
│      ├── /settings/team-definitions   → Redirect to /team?tab=definition│
│      └── /settings/definition-of-done → Redirect to /team?tab=definition│
└─────────────────────────────────────────────────────────────┘
```

### Lazy Loading Pattern

All page components are lazy-loaded using React's `lazy()` function with a consistent `.then()` pattern:

```typescript
export const LazyDashboard = lazy(() =>
  import('../pages/Dashboard/Dashboard').then((module) => ({
    default: module.default,
  }))
);
```

Each lazy component is wrapped in `ChunkErrorBoundary` and `Suspense` via the `LazyRoute` wrapper:

```typescript
const LazyRoute: React.FC<{
  children: React.ReactNode;
  fallbackMessage?: string;
}> = ({ children, fallbackMessage = 'Loading page...' }) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<PageLoader message={fallbackMessage} />}>
      {children}
    </Suspense>
  </ChunkErrorBoundary>
);
```

### Protected Route Pattern

The `ProtectedRoute` component enforces authentication:

```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  // Loading timeout protection (5 seconds)
  // Redirects to /login if not authenticated
  // Renders Layout with children if authenticated
};
```

**Key Features**:

- A 5-second timeout prevents infinite loading if the auth check hangs.
- Authenticated routes render inside the `Layout` component which provides the sidebar, header, and team context.
- Individual routes can add `PageErrorBoundary` for page-level error isolation.

---

## Styling Architecture

Scrumooth uses CSS Modules combined with a design token system for consistent, maintainable styling.

### Design Token System

Design tokens are defined in two places for dual consumption:

1. **CSS Custom Properties** (`tokens.css`) - Used directly in CSS Module files.
2. **TypeScript Constants** (`tokens.ts`) - Used for programmatic access in JavaScript.

```
┌─────────────────────────────────────────────────────────────┐
│                    Design Token Layers                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Primitive Tokens (tokens.ts / tokens.css)            │  │
│  │  - color.primary.50-900                               │  │
│  │  - color.success.50-900                               │  │
│  │  - color.warning.50-900                               │  │
│  │  - color.error.50-900                                 │  │
│  │  - color.gray.50-900                                  │  │
│  │  - color.accentPurple.50-900                          │  │
│  │  - color.accentIndigo.500-600                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Semantic Tokens (tokens.ts / tokens.css)             │  │
│  │  - semanticColor.text.primary / secondary / disabled  │  │
│  │  - semanticColor.background.page / card / elevated    │  │
│  │  - semanticColor.border.default / hover / focus       │  │
│  │  - semanticColor.interactive.primary / hover / active │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Component Tokens (CSS Module files)                  │  │
│  │  - .button-primary { background: var(--color-primary) }│ │
│  │  - .card { border: var(--border-default) }            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Token Categories in `tokens.ts`**:

| Category        | Purpose                                 | Example                        |
| --------------- | --------------------------------------- | ------------------------------ |
| `color`         | Primitive color palette (50-900 scales) | `color.primary[600]`           |
| `semanticColor` | Semantic aliases for primitive colors   | `semanticColor.text.primary`   |
| `spacing`       | Spacing scale                           | Used via CSS custom properties |
| `typography`    | Font sizes, weights, line heights       | Used via CSS custom properties |
| `borderRadius`  | Border radius values                    | Used via CSS custom properties |
| `shadow`        | Box shadow values                       | Used via CSS custom properties |
| `transition`    | Transition durations and easings        | Used via CSS custom properties |

### CSS Module Conventions

Each component has a co-located `.module.css` file:

```
Button/
├── Button.tsx
├── Button.module.css      # Scoped styles
├── Button.test.tsx
└── index.ts
```

**Naming Conventions**:

- Class names use kebab-case: `.button-primary`, `.loading-spinner`, `.card-header`.
- Variant classes follow the pattern: `.button-{variant}` (e.g., `.button-primary`, `.button-danger`).
- Size classes follow the pattern: `.button-{size}` (e.g., `.button-sm`, `.button-lg`).
- State classes use descriptive names: `.button-loading`, `.sidebar-collapsed`.

**Stylelint Enforcement**:

CSS files are validated with Stylelint. The configuration in `.stylelintrc.json` enforces consistent naming, property ordering, and prohibits inline styles.

---

## Custom Hooks Architecture

Custom hooks encapsulate reusable logic and serve as the bridge between API services and React components. They are located in `packages/frontend/src/hooks/`.

### Hook Categories

```
┌─────────────────────────────────────────────────────────────┐
│                     Custom Hook Categories                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Data Fetching Hooks (TanStack Query)               │    │
│  │  - useSprintBoard     Sprint data and actions       │    │
│  │  - useTeamManagement  Team CRUD operations          │    │
│  │  - useNotifications   Notification polling          │    │
│  │  - useSprintsData     Sprint list queries           │    │
│  │  - useTeamState       Team context and switching    │    │
│  │  - useTaskMutations   Task create/update/delete     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  UI Interaction Hooks                               │    │
│  │  - useModal           Modal focus trap and escape   │    │
│  │  - useResponsive      Viewport breakpoint detection │    │
│  │  - useClickOutside    Click-outside detection       │    │
│  │  - useEscapeKey       Escape key handler            │    │
│  │  - useDebounce        Value debouncing              │    │
│  │  - useVirtualScroll   Virtualized list scrolling    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Form Management Hooks                              │    │
│  │  - useFormDraft       Auto-save form drafts         │    │
│  │  - useUnsavedChanges  Unsaved changes detection     │    │
│  │  - useBeforeUnload    Browser close protection      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Error Handling Hooks                               │    │
│  │  - useApiError            API error normalization   │    │
│  │  - useMutationErrorHandler Mutation error handling  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Utility Hooks                                      │    │
│  │  - useLogger           Component-scoped logging     │    │
│  │  - useTimeout          Timeout management           │    │
│  │  - useToast            Toast notification dispatch  │    │
│  │  - useScrollbarDetection Scrollbar presence detect  │    │
│  │  - useAccountDeletion  Account deletion workflow    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Key Hook Designs

**useSprintBoard** - Encapsulates sprint data, statistics, and actions:

```typescript
interface UseSprintBoardReturn {
  sprint: Sprint | null;
  sprintItems: ProductBacklogItem[];
  sprintStats: SprintStats;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  completeSprint: () => void;
  isCompleting: boolean;
}
```

**useTeamManagement** - Provides TanStack Query hooks for team CRUD:

```typescript
export const useTeams = (query?: TeamQuery) => useQuery({ ... });
export const useTeam = (id: string) => useQuery({ ... });
export const useCreateTeam = () => useMutation({ ... });
export const useUpdateTeam = () => useMutation({ ... });
export const useDeleteTeam = () => useMutation({ ... });
```

**useNotifications** - Manages notification polling with visibility-aware refetching:

```typescript
export const useNotifications = (filters?: NotificationFilters) => useQuery({ ... });
export const useUnreadCount = () => useQuery({
  refetchInterval: isVisible ? pollingInterval : false,
  staleTime: Math.max(pollingInterval - 1000, 0),
});
export const useMarkAsRead = () => useMutation({ ... });
```

**useModal** - Handles focus trapping, escape key, and body scroll lock:

```typescript
export const useModal = ({ isOpen, onClose }: UseModalProps) => {
  // Saves previous active element
  // Traps focus within modal when open
  // Handles Escape key to close
  // Locks body scroll when open
  // Restores focus on close
};
```

**useResponsive** - Viewport breakpoint detection:

```typescript
export function useResponsive(breakpoint: number = 768): boolean {
  // Returns true if viewport width <= breakpoint
  // Listens to resize events
  // SSR-safe with typeof window check
}
```

**useLogger** - Component-scoped structured logging:

```typescript
export function useLogger({ componentName, context }: UseLoggerOptions): UseLoggerReturn {
  // Returns logger with component name automatically included
  // Provides logAction() for action-context logging
  // Memoized to prevent unnecessary re-renders
}
```

---

## Error Handling Patterns

Scrumooth implements a multi-layered error handling strategy that isolates failures and provides user-friendly feedback at every level.

### Error Boundary Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                  Error Boundary Hierarchy                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ErrorBoundary (Global)                               │  │
│  │  - Wraps entire App                                   │  │
│  │  - Catches all unhandled errors                       │  │
│  │  - Classifies errors: NETWORK, AUTH, VALIDATION,      │  │
│  │    NOT_FOUND, RUNTIME                                 │  │
│  │  - Reports to error tracking service                  │  │
│  │  - Provides retry mechanism with maxRetries           │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ PageError   │  │ WidgetError │  │ ChunkError  │          │
│  │ Boundary    │  │ Boundary    │  │ Boundary    │          │
│  │             │  │             │  │             │          │
│  │ Isolates    │  │ Isolates    │  │ Catches     │          │
│  │ page-level  │  │ dashboard   │  │ lazy-load   │          │
│  │ errors      │  │ widget      │  │ failures    │          │
│  │             │  │ errors      │  │             │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Component-Level Error States                         │  │
│  │  - isError from TanStack Query hooks                  │  │
│  │  - ErrorMessage component for inline error display    │  │
│  │  - useApiError hook for normalized error messages     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Error Classification

The `ErrorBoundary` component classifies errors into five types:

| Error Type   | Description                   | User Action                |
| ------------ | ----------------------------- | -------------------------- |
| `NETWORK`    | Connection failures           | Retry button               |
| `AUTH`       | Authentication failures       | Redirect to login          |
| `VALIDATION` | Invalid data submissions      | Display validation errors  |
| `NOT_FOUND`  | Resource not found            | Navigate back              |
| `RUNTIME`    | Unexpected application errors | Retry with error reporting |

### Chunk Error Handling

The `ChunkErrorBoundary` specifically catches lazy-loading failures:

```typescript
static getDerivedStateFromError(error: Error): State {
  const isChunkError =
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.name === 'ChunkLoadError';

  return { hasError: isChunkError, error: isChunkError ? error : null };
}
```

When a chunk fails to load, the boundary displays a retry UI that reloads the entire page. This handles scenarios where a new deployment invalidates cached chunks.

### API Error Handling

API errors are handled at two levels:

1. **Core API Layer** (`api.core.ts`) - Axios interceptors catch 401 errors and trigger automatic logout. All other errors are propagated with structured error data.
2. **Hook Level** (`useApiError`, `useMutationErrorHandler`) - Normalize API error responses into user-friendly messages and optionally display toast notifications.

---

## Loading State Patterns

Scrumooth provides a comprehensive loading state system with multiple visual variants for different contexts.

### Loading Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Loading State System                      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LoadingState (Unified Component)                     │  │
│  │                                                       │  │
│  │  Variants:                                            │  │
│  │  ├── spinner          Simple spinning indicator       │  │
│  │  ├── skeleton-text    Text content placeholder        │  │
│  │  ├── skeleton-card    Card content placeholder        │  │
│  │  ├── skeleton-list    List items placeholder          │  │
│  │  ├── skeleton-chart   Chart area placeholder          │  │
│  │  └── page             Full-page loading               │  │
│  │                                                       │  │
│  │  Sizes: sm (24px), md (48px), lg (64px)               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Page-Level Loaders                                   │  │
│  │  - PageLoader       Full-page loading with message    │  │
│  │  - LoadingSpinner   Standalone spinner component      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Skeleton Components                                  │  │
│  │  - SkeletonCard     Card variants: default, list, stats│ │
│  │  - SkeletonChart    Chart area with axes              │  │
│  │  - SkeletonList     List of skeleton items            │  │
│  │  - SkeletonText     Lines of text with variable width │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Loading State Usage Pattern

Components handle loading states consistently using TanStack Query's `isLoading` flag:

```typescript
function SprintBoard() {
  const { sprint, isLoading, isError } = useSprintBoard({ teamId });

  if (isLoading) {
    return <LoadingState variant="skeleton-card" itemCount={4} />;
  }

  if (isError) {
    return <ErrorMessage message="Failed to load sprint data" />;
  }

  return <SprintContent sprint={sprint} />;
}
```

**Loading State Selection Guide**:

| Context               | Variant          | Rationale                         |
| --------------------- | ---------------- | --------------------------------- |
| Page navigation       | `page`           | Full-page takeover with message   |
| Card grid             | `skeleton-card`  | Matches card layout dimensions    |
| Data table / list     | `skeleton-list`  | Matches row height and count      |
| Text content          | `skeleton-text`  | Matches text line count and width |
| Chart / visualization | `skeleton-chart` | Matches chart area dimensions     |
| Inline action         | `spinner`        | Minimal, non-blocking indicator   |

---

## Form Handling Patterns

Scrumooth uses a combination of controlled components, form draft persistence, and unsaved changes protection.

### Form Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Form Handling System                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Form State Management                                │  │
│  │  - React state for controlled inputs                  │  │
│  │  - useFormDraft hook for auto-save to sessionStorage  │  │
│  │  - DraftRestorePrompt for draft recovery              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Validation                                           │  │
│  │  - Client-side validation in page utils/              │  │
│  │  - CharacterCounter for textarea limits               │  │
│  │  - Server-side validation via API responses           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Unsaved Changes Protection                           │  │
│  │  - useUnsavedChanges hook for dirty detection         │  │
│  │  - useBeforeUnload hook for browser close protection  │  │
│  │  - UnsavedChangesModal for navigation confirmation    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Help and Guidance                                    │  │
│  │  - HelpPanel for contextual form help                 │  │
│  │  - Validation messages inline with fields             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Unsaved Changes Flow

```
┌──────────┐     ┌───────────────────┐     ┌───────────────────┐
│  User    │     │  useUnsavedChanges│     │  UnsavedChanges   │
│  Edits   │────>│  Hook             │────>│  Modal            │
│  Form    │     │  - isDirty: true  │     │  - Confirm discard│
│          │     │  - hasChanges     │     │  - Cancel edit    │
└──────────┘     └───────────────────┘     └───────────────────┘
                                                  │
                        ┌─────────────────────────┼──────────┐
                        ▼                         ▼          │
                 ┌─────────────┐          ┌──────────────┐   │
                 │  Discard    │          │  Continue    │   │
                 │  Changes    │          │  Editing     │   │
                 │  - Navigate │          │  - Close     │   │
                 │  - Reset    │          │    modal     │   │
                 └─────────────┘          └──────────────┘   │
                                                             │
                        ┌────────────────────────────────────┘
                        ▼
                 ┌──────────────┐
                 │  Browser     │
                 │ Close/Refresh│
                 │  - useBefore │
                 │    Unload    │
                 │  - Native    │
                 │    dialog    │
                 └──────────────┘
```

### Form Draft Persistence

The `useFormDraft` hook automatically saves form state to `sessionStorage` at a debounced interval. When a user returns to a form, the `DraftRestorePrompt` component offers to restore the previous draft:

```typescript
// Auto-save pattern
const { saveDraft, restoreDraft, clearDraft, hasDraft } = useFormDraft({
  key: 'sprint-goal-edit',
  debounceMs: 1000,
});
```

---

## Backend Service Layer Design

The backend follows a layered architecture where controllers handle HTTP concerns and services encapsulate business logic.

### Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Backend Service Layer                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Routes (routes/*.routes.ts)                          │  │
│  │  - Define HTTP endpoints                              │  │
│  │  - Apply middleware (auth, validation, rate limiting)  │ │
│  │  - Delegate to controllers                            │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Controllers (controllers/*.controller.ts)            │  │
│  │  - Parse and validate request body/params             │  │
│  │  - Call service methods                               │  │
│  │  - Format and send HTTP responses                     │  │
│  │  - Handle and translate errors to HTTP status codes   │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Services (services/*.service.ts)                     │  │
│  │  - Business logic and domain rules                    │  │
│  │  - Transaction management                             │  │
│  │  - Audit logging                                      │  │
│  │  - Error handling with custom error classes           │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Prisma ORM (Data Access)                             │  │
│  │  - Type-safe database queries                         │  │
│  │  - Transaction support (prisma.$transaction)          │  │
│  │  - Migration management                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Backend Services

| Service                          | Domain              | Key Responsibilities                 |
| -------------------------------- | ------------------- | ------------------------------------ |
| `auth.service.ts`                | Authentication      | Login, registration, JWT, sessions   |
| `team.service.ts`                | Teams               | CRUD, membership, role management    |
| `sprint.service.ts`              | Sprints             | Lifecycle, planning, completion      |
| `backlog.service.ts`             | Product Backlog     | CRUD, prioritization, MoSCoW         |
| `goals.service.ts`               | Product Goals       | CRUD, status transitions             |
| `dailyScrum.service.ts`          | Daily Scrum         | Inspect & adapt, participation       |
| `impediment.service.ts`          | Impediments         | Create, resolve, assign              |
| `reports.service.ts`             | Reports             | Velocity, burndown calculations      |
| `dod.service.ts`                 | Definition of Done  | DoD checklist management             |
| `dor.service.ts`                 | Definition of Ready | DoR checklist management             |
| `sprintConfiguration.service.ts` | Sprint Config       | Sprint duration and settings         |
| `increment.service.ts`           | Increments          | Increment delivery tracking          |
| `sprintReview.service.ts`        | Sprint Reviews      | Review creation and feedback         |
| `retrospective.service.ts`       | Retrospectives      | Retro creation and action items      |
| `notification.service.ts`        | Notifications       | Notification dispatch and management |
| `workflow.service.ts`            | Workflow Engine     | State transitions, role-based rules  |
| `workflow-lock.service.ts`       | Workflow Locks      | Concurrent edit prevention           |
| `consent.service.ts`             | Consent             | Terms and marketing consent          |
| `dataExport.service.ts`          | Data Export         | GDPR-compliant data export           |
| `EmailService`                   | Email               | Transactional email with templates   |

### Custom Error Classes

The service layer uses a hierarchy of custom error classes that map to HTTP status codes:

```
AppError (base)
├── BadRequestError          → 400
├── UnauthorizedError        → 401
├── ForbiddenError           → 403
├── NotFoundError            → 404
├── ConflictError            → 409
├── SessionIdleTimeoutError  → 440
└── SessionAbsoluteTimeoutError → 440
```

### Transaction Pattern

Services use Prisma transactions for operations that modify multiple records:

```typescript
async createTeamWithOwner(data: CreateTeamDto, ownerId: string) {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.create({ data: teamData });
    await tx.teamMember.create({
      data: { teamId: team.id, userId: ownerId, role: 'ADMIN' },
    });
    return team;
  });
}
```

---

## Shared Package Architecture

The `@scrumooth/shared` package provides types, constants, and utilities shared between frontend and backend, ensuring type consistency across the monorepo.

### Package Structure

```
packages/shared/
└── src/
    ├── types/
    │   └── index.ts          # Shared TypeScript interfaces and enums
    ├── constants/
    │   ├── index.ts          # Shared constants (workflows, notifications, errors)
    │   ├── time.ts           # Time-related constants
    │   └── validation.ts     # Validation constants and rules
    ├── utils/
    │   └── index.ts          # Shared utility functions
    └── index.ts              # Barrel export
```

### Shared Types

Core domain types defined in `packages/shared/src/types/index.ts`:

| Type                | Purpose                                       |
| ------------------- | --------------------------------------------- |
| `User`              | User entity with role and profile data        |
| `UserRole`          | Enum: PRODUCT_OWNER, SCRUM_MASTER, DEVELOPERS |
| `UserSession`       | Session data with userId, email, role         |
| `Team`              | Team entity with name and description         |
| `Sprint`            | Sprint entity with dates and status           |
| `SprintStatus`      | Enum: PLANNED, ACTIVE, COMPLETED, CANCELLED   |
| `BacklogItem`       | Backlog item with priority and story points   |
| `BacklogItemStatus` | Enum: NEW, REFINED, READY, IN_PROGRESS, DONE  |
| `Task`              | Task entity linked to backlog item            |

### Shared Constants

Constants defined in `packages/shared/src/constants/index.ts`:

| Constant             | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `WORKFLOW_STATES`    | State machine definitions for PBI, Task, Sprint |
| `NOTIFICATION_TYPES` | Notification event type constants               |
| `ERROR_CODES`        | Standardized error code constants               |

### Shared Utilities

Utility functions defined in `packages/shared/src/utils/index.ts`:

| Function         | Purpose                               |
| ---------------- | ------------------------------------- |
| `formatDate`     | Format date to ISO date string        |
| `formatDateTime` | Format date to ISO datetime string    |
| `isValidEmail`   | Email format validation               |
| `generateId`     | Generate UUID using crypto.randomUUID |
| `sleep`          | Async delay utility                   |

### Import Convention

Shared package imports use the `@scrumooth/shared` alias with type-only imports preferred:

```typescript
import type { User, Team, Sprint } from '@scrumooth/shared';
import { WORKFLOW_STATES, NOTIFICATION_TYPES } from '@scrumooth/shared';
```

---

**Last Updated**: 2026-05-10

**Related Documentation**:

- [System Architecture](system-architecture.md)
- [Data Model](data-model.md)
- [API Specifications](api-specifications.md)
