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

Create a new sprint for a team. Requires Scrum Master role.

**Endpoint**

```
POST /api/v1/sprints
```

**Authentication**

- Required
- Scrum Master role required

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

**400 Bad Request - Invalid Date Range**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "End date must be after start date"
  }
}
```

**409 Conflict - Overlapping Sprint**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Sprint dates overlap with an existing sprint"
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

Update sprint information. Only allowed in PLANNING state. Requires Scrum Master role.

**Endpoint**

```
PUT /api/v1/sprints/:id
```

**Authentication**

- Required
- Scrum Master role required

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
    "code": "VALIDATION_ERROR",
    "message": "Cannot update a sprint that is not in PLANNING state"
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

Start a sprint, transitioning it from PLANNING to ACTIVE. Optionally include backlog items and tasks. Requires Scrum Master role.

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

Add a product backlog item to the sprint backlog. Requires Scrum Master or Product Owner role.

**Endpoint**

```
POST /api/v1/sprints/:sprintId/backlog-items
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Request Body**

```json
{
  "pbiId": "string (required, UUID of the product backlog item)",
  "reason": "string (optional, max 500 chars)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "backlogItem": {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440003",
      "addedAt": "2026-05-05T10:00:00.000Z",
      "addedBy": "550e8400-e29b-41d4-a716-446655440001",
      "reason": "Critical bug fix needed for release"
    },
    "message": "PBI added to sprint backlog successfully"
  }
}
```

**Error Responses**

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

**409 Conflict - PBI Already in Sprint**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "PBI is already in the sprint backlog"
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
    "reason": "Critical bug fix needed for release"
  }'
```

---

### Remove PBI from Sprint

Remove a product backlog item from the sprint backlog. Requires Scrum Master or Product Owner role.

**Endpoint**

```
DELETE /api/v1/sprints/:sprintId/backlog-items/:pbiId
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `pbiId` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "taskAction": "string (required, one of: delete, return_to_backlog, keep_in_sprint)",
  "reason": "string (optional, max 500 chars)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "PBI removed from sprint backlog successfully",
    "taskAction": "return_to_backlog"
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
    "message": "PBI is not in the sprint backlog"
  }
}
```

**400 Bad Request - Invalid Task Action**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task action. Must be one of: delete, return_to_backlog, keep_in_sprint"
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
    "reason": "Scope reduced for this sprint"
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

**Related Documentation**

- [Authentication API](./authentication.md)
- [Teams API](./teams.md)
- [Product Backlog API](./product-backlog.md)
- [Sprint Board API](./sprint-board.md)
