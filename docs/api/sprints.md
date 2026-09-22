# Sprints API

Complete Sprints API reference for sprint lifecycle management, task operations, backlog management, and burndown tracking.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Sprint States](#sprint-states)
- [Endpoints](#endpoints)
  - [Get Sprints](#get-sprints)
  - [Get Active Sprint](#get-active-sprint)
  - [Get Available PBIs](#get-available-pbis)
  - [Create Sprint](#create-sprint)
  - [Get Sprint by ID](#get-sprint-by-id)
  - [Update Sprint](#update-sprint)
  - [Start Sprint](#start-sprint)
  - [Rollback Sprint Start](#rollback-sprint-start)
  - [Complete Sprint](#complete-sprint)
  - [Cancel Sprint](#cancel-sprint)
  - [Get Burndown Data](#get-burndown-data)
  - [Get Sprint Tasks](#get-sprint-tasks)
  - [Create Task](#create-task)
  - [Update Task](#update-task)
  - [Delete Task](#delete-task)
  - [Get Eligible PBIs](#get-eligible-pbis)
  - [Get Sprint Backlog PBIs](#get-sprint-backlog-pbis)
  - [Add PBI to Sprint](#add-pbi-to-sprint)
  - [Remove PBI from Sprint](#remove-pbi-from-sprint)
  - [Get Backlog Changes](#get-backlog-changes)
  - [Get DoD Compliance](#get-dod-compliance)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Sprints API provides comprehensive sprint lifecycle management capabilities including:

- Sprint creation, planning, and configuration
- Sprint state transitions (start, complete, cancel, rollback)
- Task CRUD operations within sprints
- Sprint backlog management (add/remove PBIs)
- Burndown chart data retrieval
- Definition of Done compliance reporting
- Backlog change history tracking

> **Increments and Sprints.** A Sprint's Increment is composed automatically as its items reach `DONE`, and the outcome of that composition is reported back on the item update. If a composition was skipped or failed, `POST /api/v1/increments/reconcile` recomposes the Sprint's open Increment from its Done items — see the [Increments API](./increments.md#reconcile-sprint-increment).

## Authentication

All sprint endpoints require authentication. Include the access token in your request:

**Using Cookies (Recommended)**

```http
GET /api/v1/sprints
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/sprints
Authorization: Bearer eyJhbGc...
```

## Sprint States

Sprints follow a defined state machine with specific transition rules:

| State         | Description                              | Allowed Transitions             |
| ------------- | ---------------------------------------- | ------------------------------- |
| **PLANNING**  | Sprint is being planned, not yet started | ACTIVE (start)                  |
| **ACTIVE**    | Sprint is in progress                    | COMPLETED (complete), CANCELLED |
| **COMPLETED** | Sprint has been completed                | None (terminal state)           |
| **CANCELLED** | Sprint has been cancelled                | None (terminal state)           |

### State Transition Diagram

```
PLANNING ──start──> ACTIVE ──complete──> COMPLETED
                      �?                      └──cancel──> CANCELLED

ACTIVE ──rollback──> PLANNING
```

## Endpoints

### Get Sprints

Get all sprints for a specific team.

**Endpoint**

```
GET /api/v1/sprints
```

**Authentication**

- Required

**Query Parameters**

- `teamId` (string, required): Team UUID to filter sprints

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprints": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "name": "Sprint 1",
        "teamId": "550e8400-e29b-41d4-a716-446655440000",
        "status": "ACTIVE",
        "startDate": "2026-05-01T00:00:00.000Z",
        "endDate": "2026-05-14T23:59:59.000Z",
        "sprintGoal": "Deliver user authentication module",
        "goalId": "770e8400-e29b-41d4-a716-446655440000",
        "createdAt": "2026-04-28T10:00:00.000Z",
        "updatedAt": "2026-05-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**

**400 Bad Request - Missing teamId**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "teamId is required",
    "details": [
      {
        "field": "teamId",
        "message": "Team ID is required"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.scrumooth.dev/api/v1/sprints?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Get Active Sprint

Get the currently active sprint for a specific team.

**Endpoint**

```
GET /api/v1/sprints/active
```

**Authentication**

- Required

**Query Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "ACTIVE",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z",
      "sprintGoal": "Deliver user authentication module",
      "goalId": "770e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-04-28T10:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found - No Active Sprint**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No active sprint found for this team"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.scrumooth.dev/api/v1/sprints/active?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Get Available PBIs

Get product backlog items available for inclusion in a sprint.

**Endpoint**

```
GET /api/v1/sprints/available-pbis
```

**Authentication**

- Required

**Query Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "backlogItems": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "title": "User login page",
        "description": "Implement the user login page with email and password",
        "priority": "MUST",
        "storyPoints": 5,
        "status": "APPROVED"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.scrumooth.dev/api/v1/sprints/available-pbis?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Create Sprint

Create a new sprint for a team. The caller must be a member of that team.

The Sprint container rule is enforced here, not only in the interface: the Sprint may span at
most one month (`SPRINT_MAX_DURATION_DAYS`, 28 days), it may not overlap another Sprint or an
unmaterialized generated Sprint of the same team, and it must start immediately after the
previous Sprint concludes (at most the intervening weekend may separate them). The generated
Sprint calendar produced by `POST /sprint-configuration/generate` already satisfies these rules
and is unaffected.

**Endpoint**

```
POST /api/v1/sprints
```

**Authentication**

- Required
- Team member of the supplied `teamId` (`GATE_SPRINT_TEAM_MEMBERS_ONLY`)

**Request Body**

```json
{
  "teamId": "string (required, UUID)",
  "name": "string (required, 1-100 chars)",
  "startDate": "string (required, ISO 8601 datetime)",
  "endDate": "string (required, ISO 8601 datetime)",
  "sprintGoal": "string (optional, max 500 chars)",
  "goalId": "string (optional, UUID of a product goal)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "PLANNING",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z",
      "sprintGoal": "Deliver user authentication module",
      "goalId": "770e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-04-28T10:00:00.000Z",
      "updatedAt": "2026-04-28T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

**400 Bad Request - Sprint Longer Than One Month**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_DURATION_LIMIT",
    "message": "The Sprint cannot be created: its span of 35 days exceeds the one-month maximum of 28 days. Shorten the Sprint to one month or less."
  }
}
```

The same code is returned when the end date is not after the start date.

**400 Bad Request - Sprint-Less Time Between Sprints**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_NOT_CONTIGUOUS",
    "message": "A new Sprint must start immediately after the previous one concludes: the gap to \"Sprint 1\" is larger than the 3 days allowed for the intervening weekend. Adjust the dates so no Sprint-less time is left between them."
  }
}
```

**409 Conflict - Overlapping Sprint**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_DATES_OVERLAP",
    "message": "The Sprint dates overlap an existing Sprint (Sprint 1). A team cannot run two Sprints at the same time."
  }
}
```

**403 Forbidden - Not a Team Member**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_TEAM_MEMBERS_ONLY",
    "message": "The Sprint belongs to its Scrum Team: only a member of that team can create, start, or replan it."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "teamId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sprint 1",
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-05-14T23:59:59.000Z",
    "sprintGoal": "Deliver user authentication module",
    "goalId": "770e8400-e29b-41d4-a716-446655440000"
  }'
```

---

### Get Sprint by ID

Get detailed information about a specific sprint.

**Endpoint**

```
GET /api/v1/sprints/:id
```

**Authentication**

- Required
- User must be a team member

**Path Parameters**

- `id` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "ACTIVE",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z",
      "sprintGoal": "Deliver user authentication module",
      "goalId": "770e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-04-28T10:00:00.000Z",
      "updatedAt": "2026-05-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Update Sprint

Update sprint information (name, dates, Sprint Goal, linked Product Goal). The caller must be a
member of the Sprint's team, and only a Sprint that is still being planned (`DRAFT` or
`PLANNED`) can be updated: once a Sprint is running, its Goal and dates are the commitment the
team inspects, and the sanctioned way to revise the Goal is the Product Owner's acknowledgement
of a goal-endangering Sprint Backlog change (see _Acknowledge Sprint Backlog Change_).

The container rules are re-applied to the resulting dates, so an update cannot introduce a
Sprint the create path would refuse. When the dates change, the linked `GeneratedSprint` is
updated in the same transaction so the planning calendar stays in sync.

**Endpoint**

```
PUT /api/v1/sprints/:id
```

**Authentication**

- Required
- Team member of the Sprint's team (`GATE_SPRINT_TEAM_MEMBERS_ONLY`)

**Path Parameters**

- `id` (string, required): Sprint UUID

**Request Body**

```json
{
  "name": "string (optional, 1-100 chars)",
  "startDate": "string (optional, ISO 8601 datetime)",
  "endDate": "string (optional, ISO 8601 datetime)",
  "sprintGoal": "string (optional, max 500 chars)",
  "goalId": "string (optional, UUID of a product goal)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1 - Updated",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "PLANNING",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z",
      "sprintGoal": "Updated sprint goal",
      "goalId": "770e8400-e29b-41d4-a716-446655440000",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Sprint Already Started**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_GOAL_LOCKED",
    "message": "Only a Sprint that is still being planned (DRAFT or PLANNED) can be updated. This Sprint is in status ACTIVE."
  }
}
```

**400 Bad Request - Container Rule Violation**

The same refusals as _Create Sprint_ apply to the resulting dates:
`GATE_SPRINT_DURATION_LIMIT`, `GATE_SPRINT_NOT_CONTIGUOUS`, and `GATE_SPRINT_DATES_OVERLAP`.

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_TEAM_MEMBERS_ONLY",
    "message": "The Sprint belongs to its Scrum Team: only a member of that team can create, start, or replan it."
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Sprint 1 - Updated",
    "sprintGoal": "Updated sprint goal"
  }'
```

---

### Start Sprint

Start a sprint, transitioning it from `DRAFT`/`PLANNED` to `ACTIVE`. The transition is a
**readiness** check against what was already recorded during Sprint Planning; any request body
is ignored (the payload shape below is accepted for backward compatibility but not applied).
Starting is not role-gated — any member of the Sprint's team may start it
(`GATE_SPRINT_TEAM_MEMBERS_ONLY` refuses a non-member) — but the following must all hold:

- a committed Sprint Goal,
- a linked Product Goal,
- a non-empty saved Sprint Backlog with every item refined to `READY`,
- recorded planning participation that includes the Product Owner and at least one Developer,
- no other `ACTIVE` Sprint for the team,
- no selected item already committed to another non-draft Sprint,
- and, when capacity was recorded during planning, planned hours within the recorded total
  plus `SPRINT_CAPACITY_TOLERANCE_PCT` (default 10%). When no capacity was recorded the check
  is skipped.

**Endpoint**

```
POST /api/v1/sprints/:id/start
```

**Authentication**

- Required
- Scrum Master role required

**Path Parameters**

- `id` (string, required): Sprint UUID

**Request Body**

```json
{
  "backlogItems": [
    {
      "pbiId": "string (required, UUID of a product backlog item)"
    }
  ],
  "tasks": [
    {
      "pbiId": "string (required, UUID of the parent PBI)",
      "title": "string (required, 1-200 chars)",
      "description": "string (optional, max 2000 chars)",
      "assigneeId": "string (optional, UUID of team member)",
      "estimatedHours": "number (optional, positive value)",
      "remainingHours": "number (optional, min 0)"
    }
  ]
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "status": "ACTIVE",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z"
    },
    "addedBacklogItems": 3,
    "createdTasks": 5
  }
}
```

**Error Responses**

**400 Bad Request - Sprint Not in Planning State**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Sprint must be in PLANNING state to start"
  }
}
```

**400 Bad Request - Sprint Has No Product Goal**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_GOAL_REQUIRED",
    "message": "The Sprint cannot be started without a linked Product Goal. Link the Sprint to the team's Product Goal first."
  }
}
```

> If the Sprint has no linked Product Goal, the start first adopts the team's active Product
> Goal. The refusal is returned only when the team has no active Product Goal to adopt, because
> the Product Backlog's commitment is the Product Goal (Scrum Guide, 2020).

**400 Bad Request - Planning Participation Missing**

The 2020 Scrum Guide states the Sprint Backlog is "created by the collaborative work of the
entire Scrum Team". A Sprint cannot open on evidence that only one person planned.

```json
{
  "success": false,
  "error": {
    "code": "GATE_PLANNING_PARTICIPATION_REQUIRED",
    "message": "The Sprint cannot be started without recorded planning participation. Record attendance that includes the Product Owner and at least one Developer."
  }
}
```

**400 Bad Request - Plan Exceeds Recorded Capacity**

Returned only when capacity was recorded during planning **and** the planned task hours exceed
the recorded total by more than `SPRINT_CAPACITY_TOLERANCE_PCT` (default 10%).

```json
{
  "success": false,
  "error": {
    "code": "GATE_CAPACITY_EXCEEDED",
    "message": "The Sprint cannot be started: the planned work (120h) exceeds the recorded capacity (80h) by more than the allowed tolerance of 10%."
  }
}
```

> Capacity is only enforced against a _recorded_ capacity. A Sprint whose planning never
> recorded capacity starts on the remaining gates alone, so existing plans are not stranded.

**400 Bad Request - No Definition of Done**

A Sprint cannot open while the team's Definition of Done holds no active item — including a team
that has never created one. A Sprint opened against no commitment is a Sprint whose Increment could
never satisfy one, so the boundary asks the same question the Done transition asks, one event
earlier.

```json
{
  "success": false,
  "error": {
    "code": "GATE_DOD_REQUIRED",
    "message": "Nothing is Done until the team has defined what Done means: a Definition of Done must keep at least one active item, and a Sprint cannot be committed or started without one. An empty checklist would let every item be marked Done unchecked."
  }
}
```

**400 Bad Request - Definition of Ready Not Met**

Scrumooth also enforces the team's **Definition of Ready** — a complementary practice, not a 2020
Scrum Guide artifact (see the [Definition of Ready API](./definition-of-ready.md)). A Sprint cannot
open while a selected item still has an unverified active readiness criterion; the refusal names the
items that are not ready. A team with no active readiness criterion at all is refused with
`GATE_DOR_REQUIRED` instead, so the agreement cannot be emptied to make the rule pass.

```json
{
  "success": false,
  "error": {
    "code": "GATE_DOR_NOT_VERIFIED",
    "message": "This Sprint cannot be committed or started until every selected item meets the team's Definition of Ready. 1 item(s) still have unverified readiness criteria: \"Checkout - retry\"."
  }
}
```

> The Definition of Ready is **not** applied to `PUT /sprints/:id/backlog/draft`. A draft is
> explicitly revisable before the container opens, and refusing every intermediate save would make
> planning unusable; the agreement bites when the plan becomes the Sprint Backlog and when the
> Sprint starts.

**409 Conflict - Team Already Has Active Sprint**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Team already has an active sprint"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/start \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "backlogItems": [
      { "pbiId": "880e8400-e29b-41d4-a716-446655440001" },
      { "pbiId": "880e8400-e29b-41d4-a716-446655440002" }
    ],
    "tasks": [
      {
        "pbiId": "880e8400-e29b-41d4-a716-446655440001",
        "title": "Implement login API endpoint",
        "estimatedHours": 8,
        "remainingHours": 8
      }
    ]
  }'
```

---

### Sprint Planning records (capacity and attendance)

Sprint Planning persists two facts beyond the selected backlog and its tasks. Both are read
back with the planning draft and are enforced when the Sprint opens.

**Recorded capacity** — `PUT /api/v1/sprints/:id/backlog/draft` accepts a `capacity` array
(one entry per Developer) and persists it:

```json
{
  "items": [{ "pbiId": "880e8400-e29b-41d4-a716-446655440001" }],
  "tasks": [],
  "sprintGoal": "Deliver the auth module",
  "capacity": [
    {
      "memberId": "990e8400-e29b-41d4-a716-446655440001",
      "userId": "user-1",
      "availableHours": 40
    },
    { "userId": "user-2", "availableHours": 32 }
  ]
}
```

- Every `userId` must be a `DEVELOPERS`-role member of the Sprint's team.
- The write is a diff keyed by `(sprintId, userId)`: entries not present are removed, existing
  entries are updated, new ones are created. Omitting `capacity` entirely leaves the recorded
  capacity untouched.
- `GET /api/v1/sprints/:id/planning-draft` returns the recorded `capacity` array (readable by
  any authenticated team member).

**Recorded participation** — the planning draft also accepts an `attendees` array, and the
following endpoints manage attendance incrementally:

| Method   | Endpoint                                             | Access                        |
| -------- | ---------------------------------------------------- | ----------------------------- |
| `GET`    | `/api/v1/sprints/:id/planning-attendees`             | Any authenticated team member |
| `POST`   | `/api/v1/sprints/:id/planning-attendees`             | Developers only (`403`)       |
| `PUT`    | `/api/v1/sprints/:id/planning-attendees/:attendeeId` | Developers only (`403`)       |
| `DELETE` | `/api/v1/sprints/:id/planning-attendees/:attendeeId` | Developers only (`403`)       |

Attendee body: `{ "name": string, "email"?: string, "role": "product_owner" | "scrum_master" |
"developers" | "stakeholder", "attended": boolean }`.

The `GET` response carries the derived readiness used by the start gate:

```json
{
  "success": true,
  "data": {
    "attendees": [
      {
        "id": "…",
        "name": "Ada Lovelace",
        "email": null,
        "role": "product_owner",
        "attended": true
      },
      { "id": "…", "name": "Grace Hopper", "email": null, "role": "developers", "attended": true }
    ],
    "hasProductOwner": true,
    "developerCount": 1,
    "isReadyToStart": true
  }
}
```

Writes are refused once the Sprint is no longer being planned (`DRAFT`/`PLANNED`), and with
`GATE_DEVELOPER_ONLY_SPRINT_BACKLOG` (`403`) for non-Developers.

---

### Rollback Sprint Start

Rollback a sprint that was just started, returning it to PLANNING state. Requires Scrum Master role.

**Endpoint**

```
POST /api/v1/sprints/:id/rollback
```

**Authentication**

- Required
- Scrum Master role required

**Path Parameters**

- `id` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "status": "PLANNING",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z"
    },
    "message": "Sprint start rolled back successfully"
  }
}
```

**Error Responses**

**400 Bad Request - Sprint Not in Active State**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Only an ACTIVE sprint can be rolled back"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/rollback \
  -b cookies.txt
```

---

### Complete Sprint

Complete a sprint, transitioning it from ACTIVE to COMPLETED. Requires Scrum Master role.

**Endpoint**

```
POST /api/v1/sprints/:id/complete
```

**Authentication**

- Required
- Scrum Master role required

**Path Parameters**

- `id` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "status": "COMPLETED",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z"
    },
    "message": "Sprint completed successfully"
  }
}
```

**Error Responses**

**400 Bad Request - Sprint Not in Active State**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Only an ACTIVE sprint can be completed"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/complete \
  -b cookies.txt
```

---

### Cancel Sprint

Cancel a sprint, transitioning it from ACTIVE to CANCELLED. Requires Scrum Master role.

**Endpoint**

```
POST /api/v1/sprints/:id/cancel
```

**Authentication**

- Required
- Scrum Master role required

**Path Parameters**

- `id` (string, required): Sprint UUID

**Request Body**

```json
{
  "reason": "string (required, min 1 char)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 1",
      "status": "CANCELLED",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z"
    },
    "message": "Sprint cancelled successfully"
  }
}
```

**Error Responses**

**400 Bad Request - Missing Reason**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "reason",
        "message": "Reason is required"
      }
    ]
  }
}
```

**400 Bad Request - Sprint Not in Active State**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Only an ACTIVE sprint can be cancelled"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/cancel \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "reason": "Team member unavailability requires sprint cancellation"
  }'
```

---

### Get Burndown Data

Get burndown chart data for a sprint.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/burndown
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "burndown": {
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "sprintName": "Sprint 1",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z",
      "totalHours": 80,
      "dataPoints": [
        {
          "date": "2026-05-01",
          "remainingHours": 80,
          "idealRemaining": 80
        },
        {
          "date": "2026-05-02",
          "remainingHours": 72,
          "idealRemaining": 74.29
        }
      ]
    }
  }
}
```

**Error Responses**

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/burndown \
  -b cookies.txt
```

---

### Get Sprint Tasks

Get all tasks for a sprint.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/tasks
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "990e8400-e29b-41d4-a716-446655440001",
        "sprintId": "660e8400-e29b-41d4-a716-446655440000",
        "pbiId": "880e8400-e29b-41d4-a716-446655440001",
        "title": "Implement login API endpoint",
        "description": "Create the POST /api/v1/auth/login endpoint",
        "status": "IN_PROGRESS",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
        "estimatedHours": 8,
        "remainingHours": 4,
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-03T10:00:00.000Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks \
  -b cookies.txt
```

---

### Create Task

Create a new task within a sprint. Requires team membership.

**Endpoint**

```
POST /api/v1/sprints/:sprintId/tasks
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Request Body**

```json
{
  "pbiId": "string (required, UUID of the parent PBI)",
  "title": "string (required, 1-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "assigneeId": "string (optional, UUID of team member)",
  "estimatedHours": "number (optional, positive value)",
  "remainingHours": "number (optional, min 0)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "task": {
      "id": "990e8400-e29b-41d4-a716-446655440002",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440001",
      "title": "Write unit tests for login",
      "description": "Cover all edge cases for the login endpoint",
      "status": "TODO",
      "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
      "estimatedHours": 4,
      "remainingHours": 4,
      "createdAt": "2026-05-02T08:00:00.000Z",
      "updatedAt": "2026-05-02T08:00:00.000Z"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required"
      }
    ]
  }
}
```

**404 Not Found - PBI Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product backlog item not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pbiId": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Write unit tests for login",
    "description": "Cover all edge cases for the login endpoint",
    "estimatedHours": 4,
    "remainingHours": 4
  }'
```

---

### Update Task

Update a task within a sprint. Requires team membership.

**Endpoint**

```
PUT /api/v1/sprints/:sprintId/tasks/:taskId
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `taskId` (string, required): Task UUID

**Request Body**

```json
{
  "title": "string (optional, 1-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "assigneeId": "string (optional, UUID of team member)",
  "status": "string (optional, one of: TODO, IN_PROGRESS, DONE)",
  "estimatedHours": "number (optional, positive value)",
  "remainingHours": "number (optional, min 0)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "task": {
      "id": "990e8400-e29b-41d4-a716-446655440001",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440001",
      "title": "Implement login API endpoint",
      "description": "Create the POST /api/v1/auth/login endpoint",
      "status": "DONE",
      "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
      "estimatedHours": 8,
      "remainingHours": 0,
      "updatedAt": "2026-05-05T14:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found - Task Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found"
  }
}
```

**400 Bad Request - Invalid Status**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task status. Must be one of: TODO, IN_PROGRESS, DONE"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "DONE",
    "remainingHours": 0
  }'
```

---

### Delete Task

Delete a task from a sprint. Requires Scrum Master role.

**Endpoint**

```
DELETE /api/v1/sprints/:sprintId/tasks/:taskId
```

**Authentication**

- Required
- Scrum Master role required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `taskId` (string, required): Task UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Task deleted successfully"
  }
}
```

**Error Responses**

**404 Not Found - Task Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found"
  }
}
```

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Scrum Master role required"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### Get Eligible PBIs

Get product backlog items eligible for inclusion in the sprint increment.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/eligible-pbis
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "eligiblePbis": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "title": "User login page",
        "status": "DONE",
        "storyPoints": 5,
        "allTasksDone": true,
        "dodCompliant": true
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/eligible-pbis \
  -b cookies.txt
```

---

### Get Sprint Backlog PBIs

Get all product backlog items currently in the sprint backlog.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/backlog-pbis
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "backlogPbis": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "title": "User login page",
        "description": "Implement the user login page with email and password",
        "priority": "MUST",
        "storyPoints": 5,
        "status": "IN_PROGRESS",
        "addedAt": "2026-05-01T00:00:00.000Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-pbis \
  -b cookies.txt
```

---

### Add PBI to Sprint

Add a product backlog item to an `ACTIVE` Sprint's Sprint Backlog. Developers-only: the Sprint
Backlog is owned by the Developers who do the work.

The change must state **why** it is being made and whether it **endangers the Sprint Goal**:

- `goalImpact: "SUPPORTS_GOAL"` — the change is applied immediately and recorded as `APPLIED`.
- `goalImpact: "ENDANGERS_GOAL"` — nothing is applied. The request is recorded as `PENDING`, the
  Sprint Backlog is left untouched, and the response carries `pending: true`. The Product Owner
  must then acknowledge it (see _Acknowledge Sprint Backlog Change_).

Every recorded change stores the Sprint Goal that was in force when it was requested
(`sprintGoalAtChange`), so the audit trail cannot be rewritten by a later goal edit.

**Endpoint**

```
POST /api/v1/sprints/:sprintId/backlog-items
```

**Authentication**

- Required
- Developer role on the Sprint's team

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Request Body**

```json
{
  "pbiId": "string (required, UUID of the product backlog item)",
  "reason": "string (required, 1-500 chars)",
  "goalImpact": "string (required, one of: SUPPORTS_GOAL, ENDANGERS_GOAL)"
}
```

**Success Response — applied**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "pending": false,
    "sprintBacklogItem": {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440003"
    },
    "change": {
      "id": "bb0e8400-e29b-41d4-a716-446655440002",
      "changeType": "ADDED",
      "reason": "Critical bug fix needed for release",
      "goalImpact": "SUPPORTS_GOAL",
      "approvalStatus": "APPLIED",
      "sprintGoalAtChange": "Deliver user authentication module",
      "changedBy": "550e8400-e29b-41d4-a716-446655440001",
      "changedByName": "Dana Developer",
      "createdAt": "2026-05-05T10:00:00.000Z"
    }
  }
}
```

**Success Response — awaiting the Product Owner**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "pending": true,
    "sprintBacklogItem": null,
    "change": {
      "id": "bb0e8400-e29b-41d4-a716-446655440003",
      "changeType": "ADDED",
      "reason": "Legal requirement arrived mid-Sprint",
      "goalImpact": "ENDANGERS_GOAL",
      "approvalStatus": "PENDING",
      "sprintGoalAtChange": "Deliver user authentication module",
      "createdAt": "2026-05-05T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Missing Reason or Goal Impact**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "reason",
        "message": "Reason is required"
      }
    ]
  }
}
```

**400 Bad Request - Item Not Refined**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PBI_NOT_READY",
    "message": "Only Product Backlog items refined to READY can enter a Sprint. 1 selected item(s) are not READY yet: \"Checkout - retry\"."
  }
}
```

**400 Bad Request - No Definition of Done**

The commitment the Sprint Backlog is written against has to exist before the backlog is committed,
not only before an item is marked Done. A team with no active Definition of Done item — including
one that has never created a Definition of Done at all — is refused here.

```json
{
  "success": false,
  "error": {
    "code": "GATE_DOD_REQUIRED",
    "message": "Nothing is Done until the team has defined what Done means: a Definition of Done must keep at least one active item, and a Sprint cannot be committed or started without one. An empty checklist would let every item be marked Done unchecked."
  }
}
```

**400 Bad Request - Definition of Ready Not Met**

The team's **Definition of Ready** — a complementary practice rather than a Guide artifact — is
applied at the moment the plan becomes the Sprint Backlog: every selected item must have verified
every active readiness criterion. The refusal names the items that are not ready, and a team with no
active criterion at all is refused with `GATE_DOR_REQUIRED`.

```json
{
  "success": false,
  "error": {
    "code": "GATE_DOR_NOT_VERIFIED",
    "message": "This Sprint cannot be committed or started until every selected item meets the team's Definition of Ready. 2 item(s) still have unverified readiness criteria: \"Checkout - retry, Bulk export\"."
  }
}
```

**409 Conflict - Goal-Endangering Change Already Pending**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_SCOPE_CHANGE_ALREADY_PENDING",
    "message": "A change to this item that endangers the Sprint Goal is already awaiting the Product Owner's acknowledgement. Resolve it before requesting another."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pbiId": "880e8400-e29b-41d4-a716-446655440003",
    "reason": "Critical bug fix needed for release",
    "goalImpact": "SUPPORTS_GOAL"
  }'
```

---

### Remove PBI from Sprint

Remove a product backlog item from an `ACTIVE` Sprint's Sprint Backlog. Developers-only. The
same two-phase contract as _Add PBI to Sprint_ applies: a change declared as endangering the
Sprint Goal is recorded as `PENDING` and the Sprint Backlog is left unchanged until the Product
Owner acknowledges it.

`taskAction` decides what happens to the item's tasks once the change is applied:

- `delete` — the tasks are deleted,
- `return_to_backlog` — the item returns to `READY` and its tasks are deleted,
- `keep_in_sprint` — the tasks remain.

**Endpoint**

```
DELETE /api/v1/sprints/:sprintId/backlog-items/:pbiId
```

**Authentication**

- Required
- Developer role on the Sprint's team

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `pbiId` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "taskAction": "string (required, one of: delete, return_to_backlog, keep_in_sprint)",
  "reason": "string (required, 1-500 chars)",
  "goalImpact": "string (required, one of: SUPPORTS_GOAL, ENDANGERS_GOAL)"
}
```

**Success Response — applied**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "pending": false,
    "sprintBacklogItem": null,
    "change": {
      "id": "bb0e8400-e29b-41d4-a716-446655440004",
      "changeType": "REMOVED",
      "reason": "Scope reduced for this sprint",
      "goalImpact": "SUPPORTS_GOAL",
      "approvalStatus": "APPLIED",
      "taskAction": "return_to_backlog",
      "sprintGoalAtChange": "Deliver user authentication module",
      "createdAt": "2026-05-06T09:00:00.000Z"
    }
  }
}
```

**Success Response — awaiting the Product Owner**

```json
{
  "success": true,
  "data": {
    "pending": true,
    "sprintBacklogItem": null,
    "change": {
      "id": "bb0e8400-e29b-41d4-a716-446655440005",
      "changeType": "REMOVED",
      "goalImpact": "ENDANGERS_GOAL",
      "approvalStatus": "PENDING",
      "taskAction": "keep_in_sprint"
    }
  }
}
```

**Error Responses**

**404 Not Found - PBI Not in Sprint**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint Backlog Item not found"
  }
}
```

**400 Bad Request - Invalid Task Action**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "taskAction",
        "message": "Invalid option"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-items/880e8400-e29b-41d4-a716-446655440003 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "taskAction": "return_to_backlog",
    "reason": "Scope reduced for this sprint",
    "goalImpact": "SUPPORTS_GOAL"
  }'
```

---

### Acknowledge Sprint Backlog Change

Acknowledge (approve) or reject a Sprint Backlog change that was recorded as `PENDING` because
it endangers the Sprint Goal. Product-Owner-only: "no changes are made that would endanger the
Sprint Goal", so the acknowledgement is the Product Owner's decision to conclude.

- `APPROVE` re-validates the deferred change (an addition still requires the item to be `READY`
  and absent; a removal still requires the item to be present), applies it in one transaction,
  and requires `sprintGoal`: the renegotiated Sprint Goal, which replaces the commitment and is
  mirrored onto the linked `GeneratedSprint`. The goal that was in force _before_ the change
  stays recorded on the change row (`sprintGoalAtChange`).
- `REJECT` clears the pending state without touching the Sprint Backlog, so a pending change can
  never become un-clearable.

**Endpoint**

```
POST /api/v1/sprints/:sprintId/backlog-changes/:changeId/acknowledge
```

**Authentication**

- Required
- Product Owner of the Sprint's team (`GATE_SPRINT_SCOPE_CHANGE_NEEDS_PO`)

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `changeId` (string, required): Sprint Backlog change UUID

**Request Body**

```json
{
  "decision": "string (required, one of: APPROVE, REJECT)",
  "sprintGoal": "string (required when approving, 1-500 chars)",
  "note": "string (optional, max 1000 chars)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "applied": true,
    "sprint": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "sprintGoal": "Deliver checkout and authentication"
    },
    "change": {
      "id": "bb0e8400-e29b-41d4-a716-446655440003",
      "changeType": "ADDED",
      "approvalStatus": "APPLIED",
      "sprintGoalAtChange": "Deliver user authentication module",
      "acknowledgedBy": "770e8400-e29b-41d4-a716-446655440009",
      "acknowledgedByName": "Pat Owner",
      "acknowledgedAt": "2026-05-06T08:00:00.000Z",
      "acknowledgementNote": "Agreed with the team"
    }
  }
}
```

**Error Responses**

**403 Forbidden - Not the Product Owner**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_SCOPE_CHANGE_NEEDS_PO",
    "message": "Only the Product Owner can acknowledge a Sprint Backlog change that endangers the Sprint Goal."
  }
}
```

**400 Bad Request - Not Pending**

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "This Sprint Backlog change is not awaiting acknowledgement (status: APPLIED)."
  }
}
```

**400 Bad Request - Renegotiated Goal Missing**

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Approving a change that endangers the Sprint Goal requires the renegotiated Sprint Goal, so the team knows what it is now working toward."
  }
}
```

**400 Bad Request - Stale Approval**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PBI_NOT_READY",
    "message": "Only Product Backlog items refined to READY can enter a Sprint. 1 selected item(s) are not READY yet: \"Checkout - retry\"."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-changes/bb0e8400-e29b-41d4-a716-446655440003/acknowledge \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "decision": "APPROVE",
    "sprintGoal": "Deliver checkout and authentication",
    "note": "Agreed with the team"
  }'
```

---

### Get Backlog Changes

Get the history of backlog item changes for a sprint.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/backlog-changes
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "changes": [
      {
        "id": "bb0e8400-e29b-41d4-a716-446655440001",
        "sprintId": "660e8400-e29b-41d4-a716-446655440000",
        "pbiId": "880e8400-e29b-41d4-a716-446655440003",
        "action": "ADDED",
        "changedBy": "550e8400-e29b-41d4-a716-446655440001",
        "reason": "Critical bug fix needed for release",
        "changedAt": "2026-05-05T10:00:00.000Z"
      },
      {
        "id": "bb0e8400-e29b-41d4-a716-446655440002",
        "sprintId": "660e8400-e29b-41d4-a716-446655440000",
        "pbiId": "880e8400-e29b-41d4-a716-446655440004",
        "action": "REMOVED",
        "changedBy": "550e8400-e29b-41d4-a716-446655440001",
        "reason": "Scope reduced for this sprint",
        "changedAt": "2026-05-06T14:00:00.000Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-changes \
  -b cookies.txt
```

---

### Get DoD Compliance

Get the Definition of Done compliance report for a sprint.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/dod-compliance
```

**Authentication**

- Required
- The caller must be a member of the team that owns the Sprint: the report describes the team's own commitment, and the verifications it lists are the team's (`403 GATE_DOD_TEAM_MEMBERS_ONLY`).

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "compliance": {
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "overallCompliant": true,
      "compliancePercentage": 85.7,
      "items": [
        {
          "pbiId": "880e8400-e29b-41d4-a716-446655440001",
          "pbiTitle": "User login page",
          "compliant": true,
          "checks": [
            {
              "criterion": "All unit tests pass",
              "passed": true
            },
            {
              "criterion": "Code review completed",
              "passed": true
            },
            {
              "criterion": "Documentation updated",
              "passed": false
            }
          ]
        }
      ]
    }
  }
}
```

**Error Responses**

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/dod-compliance \
  -b cookies.txt
```

---

## Error Codes

| Code                   | HTTP Status | Description                                                        |
| ---------------------- | ----------- | ------------------------------------------------------------------ |
| `VALIDATION_ERROR`     | 400         | Request validation failed or invalid state transition              |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                            |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions for the requested operation               |
| `NOT_FOUND`            | 404         | Sprint, task, or PBI not found                                     |
| `CONFLICT`             | 409         | Resource conflict (e.g., overlapping sprint, active sprint exists) |

## Best Practices

### Sprint Planning

1. **Duration Consistency**: Maintain consistent sprint durations across the team (typically 2 weeks)
2. **Goal Clarity**: Always define a clear sprint goal that aligns with product objectives
3. **Capacity Planning**: Consider team capacity and availability when planning sprint scope
4. **PBI Readiness**: Ensure PBIs meet the Definition of Ready before including them in a sprint

### Sprint Execution

1. **Scope Management**: Minimize backlog changes during an active sprint
2. **Task Granularity**: Break work into tasks that can be completed within 1-2 days
3. **Daily Updates**: Update task remaining hours daily for accurate burndown tracking
4. **Impediment Tracking**: Raise and resolve impediments promptly

### Sprint Completion

1. **DoD Compliance**: Verify all items meet the Definition of Done before marking complete
2. **Increment Validation**: Ensure the sprint increment is potentially shippable
3. **Retrospective**: Always conduct a retrospective after sprint completion
4. **Documentation**: Keep sprint outcomes and decisions documented

### Security

1. **Access Control**: Verify user permissions before sprint operations
2. **Audit Trail**: All sprint changes are logged for compliance
3. **State Integrity**: Enforce state transition rules to prevent invalid operations
4. **Reason Tracking**: Require reasons for significant changes (cancellation, PBI removal)

---

**Last Updated**: 2026-05-10

## Scrum Master notes and their revision history

A Sprint carries the Scrum Master's coaching notes (`smNotes`), which are readable and writable only
by the team's Scrum Master:

- **Read:** `smNotes` is omitted from the Sprint list, the active Sprint and the Sprint detail for
  every other caller.
- **Write:** `PATCH /sprints/:id/sm-notes` with `{ "smNotes": "..." }` refuses anyone else with
  `GATE_SPRINT_SM_NOTES_SM_ONLY`.
- **History:** `GET /sprints/:id/sm-notes/revisions?limit=20&offset=0` returns the trail, newest
  first. Each real edit appends a revision in the same transaction as the update; a write whose text
  is unchanged appends nothing, so the trail answers "what did the notes say before" without noise.

**Related Documentation**

- [Authentication API](./authentication.md)
- [Teams API](./teams.md)
- [Product Backlog API](./product-backlog.md)
- [Sprint Board API](./sprint-board.md)
