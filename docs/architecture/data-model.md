# Data Model

This document provides a comprehensive overview of the Scrumooth data model, including entity-relationship diagrams, database schema, data flows, and migration strategy.

## Table of Contents

- [Database Overview](#database-overview)
- [Entity-Relationship Diagram](#entity-relationship-diagram)
- [Core Entities](#core-entities)
- [Relationships](#relationships)
- [Indexes and Performance](#indexes-and-performance)
- [Data Integrity](#data-integrity)
- [Migration Strategy](#migration-strategy)

## Database Overview

### Technology Stack

- **Database**: PostgreSQL 18+
- **ORM**: Prisma 7.x
- **Connection Pooling**: Prisma built-in pooling
- **Migration Tool**: Prisma Migrate

### Database Statistics

- **Total Tables**: 30+
- **Core Tables**: 15
- **Relationship Tables**: 10
- **Configuration Tables**: 5

### Schema Organization

The database schema is organized into logical groups:

1. **User Management**: Users, sessions, tokens
2. **Team Management**: Teams, members, roles
3. **Product Management**: Goals, backlog items
4. **Sprint Management**: Sprints, tasks, impediments
5. **Review & Retrospective**: Reviews, retrospectives, increments
6. **Workflow & Configuration**: Workflows, states, transitions
7. **System**: Notifications, audit logs

## Entity-Relationship Diagram

### High-Level ER Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ 1:N
       ▼
┌─────────────┐       ┌─────────────┐
│    Team     │◄──────│Team Member  │
└──────┬──────┘       └─────────────┘
       │
       │ 1:N
       ├─────────────────┬─────────────────┬─────────────────┐
       ▼                 ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│Product Goal │   │   Sprint    │   │ Impediment  │   │    DoD/DoR  │
└──────┬──────┘   └──────┬──────┘   └─────────────┘   └─────────────┘
       │                 │
       │ 1:N            │ 1:N
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  Backlog    │   │    Task     │
│    Item     │   └─────────────┘
└──────┬──────┘
       │
       │ N:M
       ▼
┌─────────────┐
│  Increment  │
└─────────────┘
```

### Detailed ER Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USER MANAGEMENT                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐  │
│  │     User     │         │ RefreshToken │         │Notification  │  │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤  │
│  │ id (PK)      │◄────────│ userId (FK)  │         │ userId (FK)  │  │
│  │ email        │    1:N  │ token        │         │ type         │  │
│  │ password     │         │ expiresAt    │         │ title        │  │
│  │ firstName    │         └──────────────┘         │ message      │  │
│  │ lastName     │                                  │ isRead       │  │
│  │ avatarUrl    │         ┌──────────────┐         └──────────────┘  │
│  │ createdAt    │         │ScheduledDeletion│                        │
│  │ updatedAt    │         ├──────────────┤                           │
│  └──────────────┘         │ userId (FK)  │                           │
│                           │ scheduledAt  │                           │
│                           │ status       │                           │
│                           └──────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          TEAM MANAGEMENT                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐                           │
│  │     Team     │◄────────│ TeamMember   │                           │
│  ├──────────────┤    1:N  ├──────────────┤                           │
│  │ id (PK)      │         │ id (PK)      │                           │
│  │ name         │         │ teamId (FK)  │                           │
│  │ description  │         │ userId (FK)  │                           │
│  │ createdAt    │         │ role         │                           │
│  │ createdBy    │         │ joinedAt     │                           │
│  └──────────────┘         └──────────────┘                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        PRODUCT MANAGEMENT                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐                           │
│  │ ProductGoal  │◄────────│ BacklogItem  │                           │
│  ├──────────────┤    1:N  ├──────────────┤                           │
│  │ id (PK)      │         │ id (PK)      │                           │
│  │ teamId (FK)  │         │ teamId (FK)  │                           │
│  │ title        │         │ goalId (FK)  │                           │
│  │ description  │         │ title        │                           │
│  │ status       │         │ description  │                           │
│  │ targetDate   │         │ priority     │                           │
│  │ successMet.  │         │ storyPoints  │                           │
│  └──────────────┘         │ status       │                           │
│                           │ labels       │                           │
│                           └──────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         SPRINT MANAGEMENT                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐                           │
│  │    Sprint    │◄────────│     Task     │                           │
│  ├──────────────┤    1:N  ├──────────────┤                           │
│  │ id (PK)      │         │ id (PK)      │                           │
│  │ teamId (FK)  │         │ sprintId (FK)│                           │
│  │ goalId (FK)  │         │ pbiId (FK)   │                           │
│  │ name         │         │ title        │                           │
│  │ startDate    │         │ assigneeId   │                           │
│  │ endDate      │         │ status       │                           │
│  │ sprintGoal   │         │ estimatedHrs │                           │
│  │ status       │         │ remainingHrs │                           │
│  └──────────────┘         └──────────────┘                           │
│                                                                      │
│  ┌──────────────┐         ┌──────────────┐                           │
│  │  Impediment  │         │BurndownData  │                           │
│  ├──────────────┤         ├──────────────┤                           │
│  │ id (PK)      │         │ id (PK)      │                           │
│  │ teamId (FK)  │         │ sprintId (FK)│                           │
│  │ sprintId (FK)│         │ date         │                           │
│  │ title        │         │ idealRemain  │                           │
│  │ description  │         │ actualRemain │                           │
│  │ status       │         └──────────────┘                           │
│  └──────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

## Core Entities

### 1. User

**Purpose**: Store user account information and profile data.

**Fields**:

| Field           | Type      | Constraints      | Description              |
| --------------- | --------- | ---------------- | ------------------------ |
| id              | UUID      | PK               | Unique identifier        |
| email           | String    | Unique, Required | User email address       |
| password        | String    | Required         | Hashed password (bcrypt) |
| firstName       | String    | Required         | User first name          |
| lastName        | String    | Required         | User last name           |
| avatarUrl       | String    | Optional         | Avatar URL               |
| createdAt       | Timestamp | Auto             | Creation timestamp       |
| updatedAt       | Timestamp | Auto             | Update timestamp         |
| marketingOptIn  | Boolean   | Default: false   | Marketing consent        |
| termsAcceptedAt | Timestamp | Optional         | Terms acceptance date    |

**Indexes**:

- Primary key on `id`
- Unique index on `email`

**Relationships**:

- Has many `TeamMember` records
- Has many `RefreshToken` records
- Has many `Notification` records
- Has many `Task` assignments

### 2. Team

**Purpose**: Define teams and their settings.

**Fields**:

| Field       | Type      | Constraints      | Description        |
| ----------- | --------- | ---------------- | ------------------ |
| id          | UUID      | PK               | Unique identifier  |
| name        | String    | Unique, Required | Team name          |
| description | String    | Optional         | Team description   |
| createdAt   | Timestamp | Auto             | Creation timestamp |
| createdBy   | UUID      | FK (User)        | Creator user ID    |
| updatedAt   | Timestamp | Auto             | Update timestamp   |

**Indexes**:

- Primary key on `id`
- Unique index on `name`
- Index on `createdBy`

**Relationships**:

- Has many `TeamMember` records
- Has many `ProductGoal` records
- Has many `Sprint` records
- Has one `DefinitionOfDone`
- Has one `DefinitionOfReady`

### 3. TeamMember

**Purpose**: Manage team membership and roles.

**Fields**:

| Field    | Type      | Constraints | Description       |
| -------- | --------- | ----------- | ----------------- |
| id       | UUID      | PK          | Unique identifier |
| teamId   | UUID      | FK (Team)   | Team reference    |
| userId   | UUID      | FK (User)   | User reference    |
| role     | Enum      | Required    | User role         |
| joinedAt | Timestamp | Auto        | Join timestamp    |

**Roles**:

- `PRODUCT_OWNER`: Product backlog management
- `SCRUM_MASTER`: Sprint and team management
- `DEVELOPERS`: Task execution

**Indexes**:

- Primary key on `id`
- Unique index on `(teamId, userId)`
- Index on `userId`

**Relationships**:

- Belongs to `Team`
- Belongs to `User`

### 4. ProductGoal

**Purpose**: Define strategic product goals.

**Fields**:

| Field              | Type      | Constraints | Description            |
| ------------------ | --------- | ----------- | ---------------------- |
| id                 | UUID      | PK          | Unique identifier      |
| teamId             | UUID      | FK (Team)   | Team reference         |
| title              | String    | Required    | Goal title             |
| description        | String    | Optional    | Goal description       |
| status             | Enum      | Required    | Goal status            |
| targetDate         | Timestamp | Optional    | Target completion date |
| successMetrics     | String    | Optional    | Success criteria       |
| strategicAlignment | String    | Optional    | Strategic context      |

**Statuses**:

- `NEW`: Newly created
- `ACTIVE`: Currently being worked on
- `COMPLETED`: Successfully completed
- `ABANDONED`: No longer pursued

**Indexes**:

- Primary key on `id`
- Index on `teamId`
- Index on `status`
- Index on `(teamId, status)`

### 5. ProductBacklogItem

**Purpose**: Manage product backlog items.

**Fields**:

| Field              | Type     | Constraints      | Description          |
| ------------------ | -------- | ---------------- | -------------------- |
| id                 | UUID     | PK               | Unique identifier    |
| teamId             | UUID     | FK (Team)        | Team reference       |
| goalId             | UUID     | FK (ProductGoal) | Goal reference       |
| title              | String   | Required         | Item title           |
| description        | String   | Optional         | Item description     |
| priority           | Enum     | Required         | MoSCoW priority      |
| businessValue      | Int      | Optional         | Business value score |
| storyPoints        | Int      | Optional         | Story point estimate |
| status             | Enum     | Required         | Item status          |
| labels             | String[] | Optional         | Item labels          |
| acceptanceCriteria | String   | Optional         | Acceptance criteria  |

**Priorities (MoSCoW)**:

- `MUST_HAVE`: Critical for delivery
- `SHOULD_HAVE`: Important but not critical
- `COULD_HAVE`: Desirable if time permits
- `WONT_HAVE`: Not in current scope

**Statuses**:

- `NEW`: Newly created
- `REFINED`: Refined and estimated
- `READY`: Ready for sprint
- `IN_PROGRESS`: Currently in sprint
- `DONE`: Completed

**Indexes**:

- Primary key on `id`
- Index on `teamId`
- Index on `status`
- Index on `priority`
- Index on `(teamId, status)`
- Index on `(teamId, status, priority)`

### 6. Sprint

**Purpose**: Define and manage sprints.

**Fields**:

| Field              | Type      | Constraints      | Description         |
| ------------------ | --------- | ---------------- | ------------------- |
| id                 | UUID      | PK               | Unique identifier   |
| teamId             | UUID      | FK (Team)        | Team reference      |
| goalId             | UUID      | FK (ProductGoal) | Goal reference      |
| name               | String    | Required         | Sprint name         |
| startDate          | Timestamp | Required         | Sprint start date   |
| endDate            | Timestamp | Required         | Sprint end date     |
| sprintGoal         | String    | Optional         | Sprint goal         |
| status             | Enum      | Required         | Sprint status       |
| cancellationReason | String    | Optional         | Cancellation reason |

**Statuses**:

- `PLANNED`: Planned but not started
- `ACTIVE`: Currently running
- `COMPLETED`: Successfully completed
- `CANCELLED`: Cancelled

**Indexes**:

- Primary key on `id`
- Index on `teamId`
- Index on `status`
- Index on `startDate`
- Index on `(teamId, status)`
- Index on `(teamId, startDate)`

### 7. Task

**Purpose**: Manage sprint tasks.

**Fields**:

| Field          | Type   | Constraints             | Description            |
| -------------- | ------ | ----------------------- | ---------------------- |
| id             | UUID   | PK                      | Unique identifier      |
| sprintId       | UUID   | FK (Sprint)             | Sprint reference       |
| pbiId          | UUID   | FK (ProductBacklogItem) | Backlog item reference |
| title          | String | Required                | Task title             |
| description    | String | Optional                | Task description       |
| assigneeId     | UUID   | FK (User)               | Assignee reference     |
| status         | Enum   | Required                | Task status            |
| estimatedHours | Float  | Optional                | Estimated hours        |
| remainingHours | Float  | Optional                | Remaining hours        |

**Statuses**:

- `TODO`: Not started
- `IN_PROGRESS`: Currently being worked on
- `DONE`: Completed

**Indexes**:

- Primary key on `id`
- Index on `sprintId`
- Index on `pbiId`
- Index on `assigneeId`
- Index on `status`
- Index on `(sprintId, status)`

### 8. DefinitionOfDone / DefinitionOfReady

**Purpose**: Hold the two agreements a team works to. The Definition of Done is the Increment's
commitment and is owned by a team or by the team group that shares a product; the Definition of Ready
is the team's own readiness practice, maintained by its Scrum Master. See
[Scrum Guide Conformance](./scrum-guide-conformance.md) for why the two differ in authority and why
the Definition of Done has no organization scope.

**Fields (DoD/DoR)**:

| Field     | Type      | Constraints                      | Description                                 |
| --------- | --------- | -------------------------------- | ------------------------------------------- |
| id        | UUID      | PK                               | Unique identifier                           |
| teamId    | UUID      | FK (Team), Unique, nullable      | Team reference — the only owner for the DoR |
| groupId   | UUID      | FK (TeamGroup), Unique, nullable | Group reference — DoD only                  |
| version   | Int       | Default: 1                       | Version in force                            |
| createdAt | Timestamp | Auto                             | Creation timestamp                          |
| updatedAt | Timestamp | Auto                             | Update timestamp                            |

A Definition of Done is owned by exactly one scope — a team **or** a group, never both and never
neither. The invariant is a database `CHECK` (`CHECK ((team_id IS NULL) <> (group_id IS NULL))`), not
an application rule: Prisma cannot express it, so it lives in SQL. While a team belongs to a group its
own row is retained but inert, and a re-scoping write on leave materializes the group's criteria back
into it.

**Fields (DoDItem/DoRItem)**:

| Field       | Type    | Constraints   | Description                                              |
| ----------- | ------- | ------------- | -------------------------------------------------------- |
| id          | UUID    | PK            | Unique identifier                                        |
| dodId/dorId | UUID    | FK            | DoD/DoR reference                                        |
| description | String  | Required      | Item wording, seeded in English and editable by the team |
| category    | String  | Optional      | Item category, free-form                                 |
| defaultKey  | String  | Optional      | The built-in criterion it descends from, or `null`       |
| isActive    | Boolean | Default: true | Active status                                            |
| order       | Int     | Required      | Display order, unique within the agreement               |

`defaultKey` is what keeps a built-in criterion translatable. The canonical seeds and their keys are
declared once in `packages/shared/src/constants/definitionDefaults.ts`, which the seeding service, the
migration that backfilled existing rows, and the interface all read. The column is owned by the
service: a write payload never carries it, an edit preserves whatever the row holds, and only the
internal "carry the group's criteria onto a leaving team" path sets it on an insert.

The key decides the wording only while the stored `description` still equals the seed's canonical
sentence. Once a team rewords a criterion, that sentence is the agreement: the interface shows it as
written, in every locale, and the key survives only as the record of which seed the row descends from.
Reading the key first regardless — which is what `criterionLabel` used to do — made a saved reword
render as the seeded wording, so a successful edit looked like one that never landed.

**Version snapshots**:

| Table                   | What it preserves                                            |
| ----------------------- | ------------------------------------------------------------ |
| `dod_version_snapshots` | One row per superseded Definition of Done version, as JSONB  |
| `dor_version_snapshots` | One row per superseded Definition of Ready version, as JSONB |

Both carry `@@unique([dodId|dorId, version])`, which is at once the append-only guard (a replayed
update cannot create a second row claiming the same version) and the read path (history is always "for
this agreement, in version order"). `items` is JSONB rather than a child table on purpose: a snapshot
must be immutable, and rows that never change cannot drift with the live items they were copied from.
The snapshot JSON carries `defaultKey` for the same reason the live row does, so a superseded version
stays readable in the reader's language.

## Daily Scrum Module

The Daily Scrum module persists three things the 2020 Scrum Guide attaches to the event: the **standing commitment**, the **inspected baseline**, and the **adaptation evidence**.

### 9. DailyScrum

The team-level record of one Daily Scrum: one row per Sprint per date, jointly owned by the Developers.

| Field              | Type    | Constraints           | Description                                                       |
| ------------------ | ------- | --------------------- | ----------------------------------------------------------------- |
| id                 | UUID    | PK                    | Unique identifier                                                 |
| sprintId           | UUID    | FK → Sprint, required | Sprint the record belongs to                                      |
| scrumDate          | Date    | Required              | The day the event was held                                        |
| progressNotes      | String  | Optional              | Progress toward the Sprint Goal                                   |
| adaptationsNotes   | String  | Optional              | Free-text adaptations note                                        |
| planForNextDay     | String  | Optional              | The actionable plan for the next day                              |
| focusMode          | String  | Optional              | The structure the Developers chose; validated at the API boundary |
| sprintGoal         | String  | Optional              | **Snapshot** of the Sprint Goal at creation; never rewritten      |
| noAdaptationNeeded | Boolean | Default: false        | Explicit acknowledgement that no adaptation was needed            |

`sprintGoal` is the inspected baseline: it is written from the Sprint row when the record is created and is never touched by an update, so a later goal renegotiation cannot make a past Daily Scrum appear to have inspected a goal it never saw.

`noAdaptationNeeded` and `backlogAdjustments` are two halves of one requirement — a record must carry at least one of them. See §9.1.

- Unique constraint: `(sprintId, scrumDate)`
- Indexes: `(sprintId, scrumDate)`, `(scrumDate)`

### 9.1 DailyScrumBacklogItem

A Sprint Backlog adaptation declared at a Daily Scrum.

| Field                     | Type   | Constraints      | Description                                                           |
| ------------------------- | ------ | ---------------- | --------------------------------------------------------------------- |
| id                        | UUID   | PK               | Unique identifier                                                     |
| dailyScrumId              | UUID   | FK → DailyScrum  | Owning record                                                         |
| sprintBacklogItemId       | UUID   | FK, **nullable** | The declared target; `NULL` once the item has left the Sprint Backlog |
| pbiId                     | UUID   | FK, nullable     | Denormalised target, so the declaration survives the item             |
| pbiTitleAtAdjustment      | String | Optional         | The target's title at declaration time                                |
| actionType                | Enum   | Optional         | `ADDED` / `REMOVED` / `REPRIORITIZED` / `REFINED` / `SPLIT`           |
| action                    | String | Required         | The Developers' note explaining the adaptation                        |
| pbiStatusAtAdjustment     | Enum   | Optional         | The target PBI's status at declaration time                           |
| itemUpdatedAtAtAdjustment | Ts     | Optional         | The target item's `updatedAt` at declaration time                     |
| pbiUpdatedAtAtAdjustment  | Ts     | Optional         | The target PBI's `updatedAt` at declaration time                      |

Two properties carry the design:

- **The FK is nullable with `ON DELETE SET NULL`.** Removing the item from the Sprint Backlog is exactly how a `REMOVED` declaration is fulfilled, so a cascading delete would destroy the evidence at the moment it came true. `pbiId` and `pbiTitleAtAdjustment` keep the declaration readable once the item is gone.
- **The four snapshot columns are written by the server**, read from the affected item at declaration time. A client never supplies them, so a declaration cannot describe its own baseline.

The **reflection verdict** ("reflected" / "declared, not yet reflected") is _computed on read_ by comparing the snapshot with the item's current state — it is deliberately not a column, because a stored verdict would be a snapshot of a moving thing and would go stale the first time someone acted on the adaptation.

- Unique constraint: `(dailyScrumId, sprintBacklogItemId)`
- Indexes: `(dailyScrumId)`, `(sprintBacklogItemId)`, `(pbiId)`

### 9.2 DailyScrumSchedule

The team's standing commitment: the Daily Scrum is held "at the same time and place every working day".

| Field       | Type   | Constraints            | Description                                        |
| ----------- | ------ | ---------------------- | -------------------------------------------------- |
| id          | UUID   | PK                     | Unique identifier                                  |
| teamId      | UUID   | FK → Team, **unique**  | One commitment per team                            |
| timezone    | String | Default: `UTC`         | IANA zone `startMinute` is expressed in            |
| startMinute | Int    | Required, 0-1439       | Start of the event as minutes after local midnight |
| location    | String | Optional, max 200      | A room or other plain-text place                   |
| locationUrl | String | Optional               | A meeting link (`http`/`https` allowlist)          |
| workingDays | Int[]  | Default: `[1,2,3,4,5]` | ISO weekday numbers (1 = Monday) the team works    |

**No duration is stored.** The Daily Scrum is a fixed 15-minute timebox that does not scale with Sprint length; only the start is configurable. At least one of `location` / `locationUrl` is required.

### 9.3 TeamNonWorkingDay

A dated exception to the weekly working pattern.

| Field  | Type   | Constraints         | Description           |
| ------ | ------ | ------------------- | --------------------- |
| id     | UUID   | PK                  | Unique identifier     |
| teamId | UUID   | FK → Team, required | Owning team           |
| date   | Date   | Required            | The exception date    |
| name   | String | Optional, max 120   | e.g. a public holiday |

Only exceptions are stored; the weekly pattern on `DailyScrumSchedule` remains the default.

- Unique constraint: `(teamId, date)` — the arbiter for two Scrum Masters recording the same holiday concurrently

### Why the calendar lives in the shared package

The working-day rules (`countWorkingDays`, `listWorkingDays`, `sprintWorkingDayProgress`, `isWorkingDay`) are pure functions in `@scrumooth/shared` rather than SQL or service code. Both the Daily Scrum page's "Sprint day X of Y" and the Scrum Master dashboard's expected-count are computed with the _same_ functions, so the number the Developers see cannot drift apart from the number their Scrum Master is shown. The calendar is also non-coercive by construction: it is read to explain, count and evidence, and it never gates a write.

## Relationships

### One-to-Many Relationships

```
User (1) ──► (N) RefreshToken
User (1) ──► (N) Notification
Team (1) ──► (N) TeamMember
Team (1) ──► (N) ProductGoal
Team (1) ──► (N) Sprint
Team (1) ──► (N) TeamNonWorkingDay
ProductGoal (1) ──► (N) ProductBacklogItem
Sprint (1) ──► (N) Task
Sprint (1) ──► (N) DailyScrum
DailyScrum (1) ──► (N) DailyScrumParticipant
DailyScrum (1) ──► (N) DailyScrumBacklogItem
```

### Many-to-Many Relationships

```
ProductBacklogItem (N) ◄──► (N) Increment
  └─ Through: IncrementPBI (junction table)

Sprint (N) ◄──► (N) ProductBacklogItem
  └─ Through: SprintBacklogItem (junction table)
```

### One-to-One Relationships

```
Team (1) ──► (1) DefinitionOfDone
Team (1) ──► (1) DefinitionOfReady
Team (1) ──► (1) DailyScrumSchedule
Sprint (1) ──► (1) SprintRetrospective
Sprint (1) ──► (1) SprintReview
```

## Indexes and Performance

### Primary Indexes

All tables have primary key indexes on their `id` field (UUID).

### Foreign Key Indexes

All foreign key fields are indexed for efficient joins:

- `userId` in all related tables
- `teamId` in all team-related tables
- `sprintId` in all sprint-related tables

### Composite Indexes

Strategic composite indexes for common queries:

```sql
-- Team-based queries
CREATE INDEX idx_backlog_team_status ON product_backlog_items(teamId, status);
CREATE INDEX idx_sprint_team_status ON sprints(teamId, status);
CREATE INDEX idx_tasks_sprint_status ON tasks(sprintId, status);

-- User-based queries
CREATE INDEX idx_notifications_user_read ON notifications(userId, isRead);
CREATE INDEX idx_sessions_user_activity ON refresh_tokens(userId, lastActivityAt);

-- Date-based queries
CREATE INDEX idx_sprint_dates ON sprints(startDate, endDate);
```

### Query Optimization Examples

**Efficient Team Backlog Query**:

```typescript
const backlog = await prisma.productBacklogItem.findMany({
  where: {
    teamId,
    status: { in: ['NEW', 'REFINED', 'READY'] },
  },
  include: {
    goal: { select: { id: true, title: true } },
  },
  orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
});
```

**Efficient Sprint Board Query**:

```typescript
const sprintBoard = await prisma.sprint.findUnique({
  where: { id: sprintId },
  include: {
    tasks: {
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        pbi: { select: { id: true, title: true } },
      },
      orderBy: { status: 'asc' },
    },
  },
});
```

## Data Integrity

### Constraints

**Foreign Key Constraints**:

```sql
-- Cascade on delete for dependent records
ALTER TABLE team_members
  ADD CONSTRAINT fk_team_members_team
  FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE;

-- Set null on delete for optional references
ALTER TABLE product_backlog_items
  ADD CONSTRAINT fk_backlog_goal
  FOREIGN KEY (goalId) REFERENCES product_goals(id) ON DELETE SET NULL;
```

**Unique Constraints**:

```sql
-- Ensure unique team membership
ALTER TABLE team_members
  ADD CONSTRAINT unique_team_member UNIQUE (teamId, userId);

-- Ensure unique email
ALTER TABLE users
  ADD CONSTRAINT unique_user_email UNIQUE (email);
```

**Check Constraints**:

```sql
-- Validate sprint dates
ALTER TABLE sprints
  ADD CONSTRAINT chk_sprint_dates
  CHECK (endDate > startDate);

-- Validate story points (Fibonacci)
ALTER TABLE product_backlog_items
  ADD CONSTRAINT chk_story_points
  CHECK (storyPoints IN (1, 2, 3, 5, 8, 13, 21, 34, 55, 89) OR storyPoints IS NULL);
```

### Data Validation

**Application-Level Validation**:

```typescript
// Using Zod for validation
const createSprintSchema = z
  .object({
    name: z.string().min(1).max(100),
    startDate: z.date(),
    endDate: z.date(),
    sprintGoal: z.string().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
  });
```

## Migration Strategy

### Prisma Migrations

**Development Workflow**:

```bash
# Create migration
pnpm run db:migrate

# Apply to test database
pnpm run db:migrate:test

# Deploy to production
pnpm run db:migrate:prod
```

**Migration Files**:

```
prisma/
├── migrations/
│   ├── 20260415000000_initial/
│   │   └── migration.sql
│   ├── 20260416000000_add_notifications/
│   │   └── migration.sql
│   └── migration_lock.toml
└── schema.prisma
```

### Migration Best Practices

1. **Atomic Migrations**: Each migration should be atomic and reversible
2. **Data Preservation**: Always preserve existing data
3. **Index Creation**: Create indexes concurrently in production
4. **Testing**: Test migrations on staging before production
5. **Backup**: Always backup before production migrations
6. **Enum before column**: `CREATE TYPE "X" AS ENUM (...)` must precede any `ALTER TABLE ... ADD COLUMN` that uses it, and the values must appear in the same order as the Prisma enum so the generated SQL stays drift-free. Verify with `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma`.
7. **Widening an existing constraint is a drop-and-recreate**: changing a foreign key to `ON DELETE SET NULL` — or making a `NOT NULL` column nullable — requires `ALTER TABLE ... DROP CONSTRAINT` followed by `ALTER TABLE ... ADD CONSTRAINT`, plus `ALTER COLUMN ... DROP NOT NULL`. Do both in one migration so the schema and the database never disagree mid-deploy.
8. **Say why a constraint is what it is**: a constraint that looks like an oversight (a nullable FK where a NOT NULL one "should" be, a `SET NULL` where the rest of the table cascades) is a decision. Comment it in the migration, or the next reader will "fix" it back.

### Example Migration

```sql
-- Add notification retention configuration
-- Migration: 20260420000000_add_notification_config

-- Add new columns
ALTER TABLE "users" ADD COLUMN "notificationRetentionDays" INTEGER DEFAULT 30;

-- Add new table
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pk_notification_preferences" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "notification_preferences"
ADD CONSTRAINT "fk_notification_preferences_user"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create index
CREATE INDEX "idx_notification_preferences_user" ON "notification_preferences"("userId");
```

---

**Last Updated**: 2026-09-21

**Related Documentation**:

- [System Architecture](./system-architecture.md)
- [Component Design](./component-design.md)
- [API Specifications](./api-specifications.md)
