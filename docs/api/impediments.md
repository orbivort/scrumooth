# Impediments API

Complete Impediments API reference for impediment tracking, status management, and team-level statistics.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Impediment Statuses](#impediment-statuses)
- [Endpoints](#endpoints)
  - [Get Impediments](#get-impediments)
  - [Get Impediment Statistics](#get-impediment-statistics)
  - [Get Impediment by ID](#get-impediment-by-id)
  - [Create Impediment](#create-impediment)
  - [Update Impediment](#update-impediment)
  - [Delete Impediment](#delete-impediment)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Impediments API provides comprehensive impediment management capabilities including:

- Impediment creation and tracking, scoped to the team that raised the impediment
- Status lifecycle management (Open, In Progress, Resolved, Closed), with written resolution required for **both** terminal states
- Impact prioritisation (Critical, High, Medium, Low) and an optional target date
- Team-level impediment statistics
- Owner assignment and notification, defaulting an unowned impediment to the team's Scrum Master
- Escalation of impediments that age past the configured threshold
- Resolution tracking with timestamps and a `createdBy`/`updatedBy` audit trail

All endpoints are scoped under `/api/v1/impediments`.

## Authentication

All impediment endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Authorization

An impediment records why a Scrum Team was blocked, so it belongs to the team that raised it.

| Action            | Who may perform it                                               |
| ----------------- | ---------------------------------------------------------------- |
| Read (`GET`)      | Any member of the team identified by `teamId`                    |
| Create (`POST`)   | Any member of the team in `teamId`                               |
| Update (`PUT`)    | Any member of the team that owns the impediment                  |
| Delete (`DELETE`) | The reporter, the impediment's owner, or the team's Scrum Master |

Every request must name the team — `teamId` in the query string for `GET`/`DELETE`, in the body for `POST`/`PUT`, or via the `X-Team-Id` header. A caller who is not a member of that team is refused with `403 GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY`. The update and delete paths additionally look the record up **within** that team, so an id belonging to another team is answered with `404` rather than being silently edited; a wrong-team `DELETE` is never a silent success.

The Guide assigns no single role the act of _reporting_ an impediment, so reporting and updating are open to the whole team. Deleting is narrower: erasing the record of what blocked the team destroys evidence, so it is limited to the people accountable for the record. The Scrum Master may always delete, because the Guide makes them accountable for causing the removal of impediments.

## Impediment Statuses

Impediments follow a defined status lifecycle:

| Status          | Description                                                                |
| --------------- | -------------------------------------------------------------------------- |
| **OPEN**        | Newly reported impediment, not yet being addressed                         |
| **IN_PROGRESS** | Someone is actively working on resolving the issue                         |
| **RESOLVED**    | The impediment has been resolved (requires resolution text)                |
| **CLOSED**      | The impediment is closed and no longer relevant (requires resolution text) |

`RESOLVED` and `CLOSED` are both terminal for the Sprint-close gate: a Sprint cannot be completed while any of its impediments is still `OPEN` or `IN_PROGRESS` — the refusal is `400 GATE_IMPEDIMENTS_UNRESOLVED`, raised by the [Sprints API](./sprints.md). Because a bare `CLOSED` would otherwise lift that gate while saying nothing about removal, **both terminal states require written resolution text**. A terminal transition without it is refused with `400 GATE_IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED`. Reopening an impediment (moving it back to `OPEN` or `IN_PROGRESS`) clears `resolvedAt` and makes the Sprint-close gate block again.

### Status Transitions

```
OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
  |                      |
  +----------------------+
       (can reopen by changing status)
```

## Endpoints

### Get Impediments

Get all impediments for a specific team, ordered by impact and then by age: `CRITICAL` first, then `HIGH`, `MEDIUM` and `LOW`, and within a priority band the longest-waiting impediment first. The priority enum is compared by declaration order, so `CRITICAL` sorts before `LOW` rather than alphabetically — impact, not recency, decides what the Scrum Master sees first.

**Endpoint**

```
GET /api/v1/impediments
```

**Authentication**

- Required

**Query Parameters**

- `teamId` (string, required): Team UUID to filter impediments by. The caller must be a member of this team
- `sprintId` (string, optional): Sprint UUID to narrow the result to one Sprint; must belong to the same team

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "teamId": "550e8400-e29b-41d4-a716-446655440099",
      "sprintId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "API dependency blocking dashboard work",
      "description": "The backend API endpoint for dashboard data is not yet available.",
      "reportedById": "550e8400-e29b-41d4-a716-446655440001",
      "ownerId": "550e8400-e29b-41d4-a716-446655440002",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "targetDate": "2026-05-15",
      "resolution": null,
      "resolvedAt": null,
      "escalatedAt": null,
      "escalationCount": 0,
      "createdAt": "2026-05-10T10:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "updatedAt": "2026-05-10T11:00:00.000Z",
      "updatedBy": "550e8400-e29b-41d4-a716-446655440002",
      "reportedBy": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "owner": {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "firstName": "Jane",
        "lastName": "Smith",
        "email": "jane@example.com"
      },
      "sprint": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Sprint 5"
      }
    }
  ]
}
```

**Error Responses**

**400 Bad Request - Missing teamId**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "teamId is required"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/impediments?teamId=550e8400-e29b-41d4-a716-446655440099" \
  -b cookies.txt
```

---

### Get Impediment Statistics

Get aggregated impediment statistics for a specific team, grouped by status.

**Endpoint**

```
GET /api/v1/impediments/stats
```

**Authentication**

- Required

**Query Parameters**

- `teamId` (string, required): Team UUID to get statistics for

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "open": 3,
    "inProgress": 2,
    "resolved": 5,
    "closed": 1
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
    "message": "teamId is required"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/impediments/stats?teamId=550e8400-e29b-41d4-a716-446655440099" \
  -b cookies.txt
```

---

### Get Impediment by ID

Get detailed information about a specific impediment.

**Endpoint**

```
GET /api/v1/impediments/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Impediment UUID

**Query Parameters**

- `teamId` (string, required): Team UUID to verify team access

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "teamId": "550e8400-e29b-41d4-a716-446655440099",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "API dependency blocking dashboard work",
    "description": "The backend API endpoint for dashboard data is not yet available, blocking frontend dashboard development.",
    "reportedById": "550e8400-e29b-41d4-a716-446655440001",
    "ownerId": "550e8400-e29b-41d4-a716-446655440002",
    "status": "IN_PROGRESS",
    "resolution": null,
    "resolvedAt": null,
    "createdAt": "2026-05-10T10:00:00.000Z",
    "createdBy": "550e8400-e29b-41d4-a716-446655440001",
    "updatedAt": "2026-05-10T11:00:00.000Z",
    "updatedBy": null,
    "reportedBy": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "owner": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com"
    },
    "sprint": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5"
    }
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
    "message": "teamId is required"
  }
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Impediment not found"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/impediments/550e8400-e29b-41d4-a716-446655440020?teamId=550e8400-e29b-41d4-a716-446655440099" \
  -b cookies.txt
```

---

### Create Impediment

Create a new impediment for a team the caller belongs to. The authenticated user is automatically set as the reporter (and is recorded in `createdBy`/`updatedBy`).

When an `ownerId` is supplied it must be a member of the same team. When no owner is supplied, the impediment defaults to the team's **Scrum Master** — the Guide makes them accountable for causing the removal of impediments, so an unowned impediment lands on the accountable party rather than nowhere. A notification is sent to whoever ends up as the owner, provided they are not the reporter.

**Endpoint**

```
POST /api/v1/impediments
```

**Authentication**

- Required

**Request Body**

```json
{
  "teamId": "string (required, team UUID)",
  "sprintId": "string (optional, sprint UUID; must belong to the same team)",
  "title": "string (required)",
  "description": "string (required)",
  "ownerId": "string (optional, user UUID; must be a member of the team)",
  "priority": "string (optional, one of: CRITICAL, HIGH, MEDIUM, LOW; defaults to MEDIUM)",
  "targetDate": "string (optional, ISO date such as 2026-05-15)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "teamId": "550e8400-e29b-41d4-a716-446655440099",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "API dependency blocking dashboard work",
    "description": "The backend API endpoint for dashboard data is not yet available, blocking frontend dashboard development.",
    "reportedById": "550e8400-e29b-41d4-a716-446655440001",
    "ownerId": "550e8400-e29b-41d4-a716-446655440002",
    "status": "OPEN",
    "priority": "MEDIUM",
    "targetDate": null,
    "resolution": null,
    "resolvedAt": null,
    "escalatedAt": null,
    "escalationCount": 0,
    "createdAt": "2026-05-10T10:00:00.000Z",
    "createdBy": "550e8400-e29b-41d4-a716-446655440001",
    "updatedAt": "2026-05-10T10:00:00.000Z",
    "updatedBy": "550e8400-e29b-41d4-a716-446655440001",
    "reportedBy": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "owner": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com"
    },
    "sprint": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Missing Required Fields**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "teamId, title, and description are required"
  }
}
```

**403 Forbidden - Caller is not a member of the team**

```json
{
  "success": false,
  "error": {
    "code": "GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY",
    "message": "The impediment belongs to its Scrum Team: only a member of that team can read or change it."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/impediments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "teamId": "550e8400-e29b-41d4-a716-446655440099",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "API dependency blocking dashboard work",
    "description": "The backend API endpoint for dashboard data is not yet available, blocking frontend dashboard development.",
    "ownerId": "550e8400-e29b-41d4-a716-446655440002",
    "priority": "HIGH",
    "targetDate": "2026-05-15"
  }'
```

---

### Update Impediment

Update an impediment's status, resolution, owner, priority, or target date. Written resolution text is required for **both** terminal states, `RESOLVED` and `CLOSED`: a resolution recorded earlier in the same lifecycle is accepted, so moving `RESOLVED` → `CLOSED` does not require retyping it. Editorial changes (priority, target date, owner) never need a resolution.

`resolvedAt` is stamped when the impediment enters a terminal state and cleared when it leaves it. Every update records `updatedBy`.

**Endpoint**

```
PUT /api/v1/impediments/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Impediment UUID

**Request Body**

```json
{
  "teamId": "string (required, team UUID)",
  "status": "string (optional, one of: OPEN, IN_PROGRESS, RESOLVED, CLOSED)",
  "resolution": "string (optional, required when status is RESOLVED or CLOSED)",
  "ownerId": "string (optional, user UUID; must be a member of the team)",
  "priority": "string (optional, one of: CRITICAL, HIGH, MEDIUM, LOW)",
  "targetDate": "string (optional, ISO date such as 2026-05-15, or null to clear it)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "teamId": "550e8400-e29b-41d4-a716-446655440099",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "API dependency blocking dashboard work",
    "description": "The backend API endpoint for dashboard data is not yet available, blocking frontend dashboard development.",
    "reportedById": "550e8400-e29b-41d4-a716-446655440001",
    "ownerId": "550e8400-e29b-41d4-a716-446655440002",
    "status": "RESOLVED",
    "priority": "HIGH",
    "targetDate": "2026-05-15",
    "resolution": "Backend API endpoint deployed and verified. Frontend integration complete.",
    "resolvedAt": "2026-05-11T14:00:00.000Z",
    "escalatedAt": null,
    "escalationCount": 0,
    "createdAt": "2026-05-10T10:00:00.000Z",
    "createdBy": "550e8400-e29b-41d4-a716-446655440001",
    "updatedAt": "2026-05-11T14:00:00.000Z",
    "updatedBy": "550e8400-e29b-41d4-a716-446655440002",
    "reportedBy": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "owner": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com"
    },
    "sprint": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5"
    }
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
    "message": "teamId is required"
  }
}
```

**400 Bad Request - Resolution Required for a terminal state**

```json
{
  "success": false,
  "error": {
    "code": "GATE_IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED",
    "message": "Reaching a resolved or closed state requires a written resolution. State how the impediment was removed, so closing it cannot lift the Sprint-close gate without evidence."
  }
}
```

**403 Forbidden - Caller is not a member of the team**

```json
{
  "success": false,
  "error": {
    "code": "GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY",
    "message": "The impediment belongs to its Scrum Team: only a member of that team can read or change it."
  }
}
```

**404 Not Found - Impediment Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Impediment not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/impediments/550e8400-e29b-41d4-a716-446655440020 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "teamId": "550e8400-e29b-41d4-a716-446655440099",
    "status": "RESOLVED",
    "resolution": "Backend API endpoint deployed and verified. Frontend integration complete."
  }'
```

---

### Delete Impediment

Delete an impediment by ID. Requires team context via query parameter and is limited to the reporter, the impediment's owner, or the team's Scrum Master — see [Authorization](#authorization). The record is resolved within the named team first, so a wrong-team or already-deleted id is answered with `404` rather than a silent success.

**Endpoint**

```
DELETE /api/v1/impediments/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Impediment UUID

**Query Parameters**

- `teamId` (string, required): Team UUID to verify team access

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Impediment deleted successfully"
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
    "message": "teamId is required"
  }
}
```

**403 Forbidden - Caller is neither the reporter, the owner, nor the Scrum Master**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only the person who reported an impediment, its owner, or the Scrum Master can delete it. The record of what held the team back is evidence."
  }
}
```

**404 Not Found - Impediment not found in this team**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Impediment not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE "https://api.example.com/api/v1/impediments/550e8400-e29b-41d4-a716-446655440020?teamId=550e8400-e29b-41d4-a716-446655440099" \
  -b cookies.txt
```

---

## Error Codes

| Code                                           | HTTP Status | Description                                                                            |
| ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`                             | 400         | Request validation failed or business rule violation                                   |
| `AUTHENTICATION_ERROR`                         | 401         | Authentication required                                                                |
| `AUTHORIZATION_ERROR`                          | 403         | Insufficient permissions                                                               |
| `NOT_FOUND`                                    | 404         | Impediment not found (including an id that belongs to another team)                    |
| `GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY`            | 403         | The caller is not a member of the team that raised the impediment                      |
| `GATE_IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED` | 400         | A terminal transition (`RESOLVED`/`CLOSED`) was attempted without a written resolution |

`GATE_IMPEDIMENTS_UNRESOLVED` (400) is the mirror of the resolution gate: it is raised by the
[Sprints API](./sprints.md) when a Sprint is completed while one of its impediments is still `OPEN`
or `IN_PROGRESS`. The complete, canonical list of gate codes lives in
[Gate Rejections](./README.md#gate-rejections).

## Best Practices

### Impediment Management

1. **Prompt Reporting**: Report impediments as soon as they are identified to minimize sprint impact
2. **Clear Descriptions**: Provide detailed descriptions that help the team understand the blocker
3. **Owner Assignment**: Assign an owner to each impediment for clear accountability; leaving the owner blank hands it to the team's Scrum Master
4. **Resolution Tracking**: Always provide a resolution description when marking an impediment as RESOLVED **or** CLOSED — a terminal state without one is refused
5. **Status Updates**: Keep impediment statuses up to date to reflect current progress
6. **Impact First**: Set a priority so the Scrum Master knows which impediment to remove first, rather than guessing from age alone

### Security

1. **Team Scoping**: All impediment operations require a `teamId`, and the caller must be a member of that team. Cross-team reads, edits and deletes are refused with `403 GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY`, and update/delete additionally resolve the record **within** the named team.
2. **Audit Trail**: Creation and every update are recorded in `createdBy` / `updatedBy`, so the record of what blocked the team is defensible.
3. **Restricted Deletion**: Only the reporter, the owner, or the team's Scrum Master may delete an impediment.
4. **Owner Notifications**: The assigned owner — or the team's Scrum Master when no owner is given — receives a notification automatically.
5. **Escalation**: An unresolved impediment older than `IMPEDIMENT_ESCALATION_THRESHOLD_DAYS` (default `7`) notifies the Scrum Master, and the escalation is recorded in `escalatedAt` / `escalationCount` rather than only observed on a dashboard.

### Impact and Prioritisation

1. **Priority**: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` (default `MEDIUM`). List responses are ordered by priority and then by age, so the page and the Scrum Master dashboard agree on what to remove first.
2. **Target Date**: An optional `targetDate` records when the team intends the impediment to be removed. It does not gate anything; an unresolved impediment past its target date is flagged as overdue.

### Integration Tips

1. **Statistics Dashboard**: Use the `/stats` endpoint to build team-level impediment dashboards
2. **Daily Update Promotion**: Use the [Daily Scrum API](./daily-scrum.md) promote-impediment endpoint to convert daily update impediments into formal records
3. **Sprint Scoping**: Associate impediments with sprints to track blockers within sprint context
4. **Filtering**: Use the `teamId` query parameter consistently to scope results to the current team context

---

**Last Updated**: 2026-09-21

**Related Documentation**

- [Authentication API](./authentication.md)
- [Daily Scrum API](./daily-scrum.md)
- [Sprints API](./sprints.md)
- [Teams API](./teams.md)
