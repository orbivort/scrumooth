# Retrospectives API

Complete Retrospectives API reference for sprint retrospective management, retro items, voting, action items, and attendee tracking.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Get Retrospectives for Team](#get-retrospectives-for-team)
  - [Get Pending Action Items](#get-pending-action-items)
  - [Get Retrospective by ID](#get-retrospective-by-id)
  - [Get Retrospective by Sprint](#get-retrospective-by-sprint)
  - [Create Retrospective](#create-retrospective)
  - [Add Item](#add-item)
  - [Vote on Item](#vote-on-item)
  - [Remove Vote](#remove-vote)
  - [Update Item](#update-item)
  - [Delete Item](#delete-item)
  - [Update Retrospective](#update-retrospective)
  - [Apply Definition of Done Changes](#apply-definition-of-done-changes)
  - [Add Action Item](#add-action-item)
  - [Update Action Item](#update-action-item)
  - [Delete Action Item](#delete-action-item)
  - [Materialize Action Item](#materialize-action-item)
  - [Link Action Item to an Existing Item](#link-action-item-to-an-existing-item)
  - [Add Attendee](#add-attendee)
  - [Update Attendee](#update-attendee)
  - [Delete Attendee](#delete-attendee)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Retrospectives API provides comprehensive sprint retrospective management capabilities including:

- Retrospective creation and lifecycle management (DRAFT, IN_PROGRESS, COMPLETED)
- Retro item management with categories (WENT_WELL, DIDNT_GO_WELL, IMPROVEMENT)
- Item voting for team prioritization
- Action item tracking with status management and provable Product Backlog follow-through
- Attendee management with role-based tracking
- Definition of Done inspection: per-criterion reflection (keep / change / retire) and applying the
  accepted changes to the team's Definition of Done
- Optional anonymity, chosen at creation and honoured server-side

## Authentication

All retrospective endpoints require authentication. Include the access token in your request:

**Using Cookies (Recommended)**

```http
GET /api/v1/retrospectives/team/550e8400-e29b-41d4-a716-446655440002
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/retrospectives/team/550e8400-e29b-41d4-a716-446655440002
Authorization: Bearer eyJhbGc...
```

### Ownership

A Retrospective belongs to the Scrum Team whose Sprint it concludes. **Every read and every write
requires membership of that team**, and a non-member is refused with
`GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY` (403). This covers the pending action items feed the Backlog
page reads, and it is not negotiable by role: an account with a global administrator role that is not
a member of the team cannot read or change the Retrospective over the API.

The Scrum Master's notes (`smNotes`) are additionally private to the team's Scrum Master:

- they are omitted from every response for anyone else — including other members of the team; and
- `PATCH /retrospectives/:id/sm-notes` refuses anyone else with
  `GATE_RETROSPECTIVE_SM_NOTES_SM_ONLY` (403).

### Anonymity

`isAnonymous` is chosen when the Retrospective is created and cannot be changed afterwards.

- When it is `true`, an item's author is **not stored at all**: `authorId`, `authorName` and
  `createdBy` are `null` in every response, for every caller, including the Scrum Master.
- Authorship is never taken from the request body. `authorId`/`authorName` are not accepted on
  `POST /retrospectives/:retroId/items`; the author is the authenticated caller, and in an anonymous
  Retrospective there is no author to record.
- A Retrospective cannot be flipped to anonymous after contributions were made, because that would
  leave the authors it already recorded attached to a record that claims to have none.

## Endpoints

### Get Retrospectives for Team

Get all retrospectives for a specific team.

**Endpoint**

```
GET /api/v1/retrospectives/team/:teamId
```

**Authentication**

- Required

**Path Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "retrospectives": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "sprintId": "550e8400-e29b-41d4-a716-446655440001",
        "teamId": "550e8400-e29b-41d4-a716-446655440002",
        "facilitatorId": "550e8400-e29b-41d4-a716-446655440003",
        "retroDate": "2026-04-29T12:00:00.000Z",
        "status": "COMPLETED",
        "summary": "Team identified key areas for improvement",
        "createdAt": "2026-04-29T12:00:00.000Z",
        "updatedAt": "2026-04-29T12:00:00.000Z"
      }
    ]
  }
}
```

**Error Responses**

**404 Not Found - Team Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Team not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/retrospectives/team/550e8400-e29b-41d4-a716-446655440002 \
  -b cookies.txt
```

---

### Get Pending Action Items

Get all pending action items for a specific team across retrospectives.

**Endpoint**

```
GET /api/v1/retrospectives/team/:teamId/pending-action-items
```

**Authentication**

- Required

**Path Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "actionItems": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "title": "Improve code review process",
        "description": "Implement a structured code review checklist",
        "ownerId": "550e8400-e29b-41d4-a716-446655440003",
        "dueDate": "2026-05-15T00:00:00.000Z",
        "status": "PENDING",
        "addedToSprintBacklog": false,
        "relatedSprintId": null,
        "retroId": "550e8400-e29b-41d4-a716-446655440000"
      }
    ]
  }
}
```

**Error Responses**

**404 Not Found - Team Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Team not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/retrospectives/team/550e8400-e29b-41d4-a716-446655440002/pending-action-items \
  -b cookies.txt
```

---

### Get Retrospective by ID

Get detailed information about a specific retrospective.

**Endpoint**

```
GET /api/v1/retrospectives/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Retrospective UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "retrospective": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "facilitatorId": "550e8400-e29b-41d4-a716-446655440003",
      "retroDate": "2026-04-29T12:00:00.000Z",
      "status": "IN_PROGRESS",
      "summary": null,
      "dodEvolutionNotes": null,
      "items": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440020",
          "category": "WENT_WELL",
          "content": "Team collaboration improved significantly",
          "authorId": "550e8400-e29b-41d4-a716-446655440003",
          "authorName": "Jane Smith",
          "votes": 3
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440021",
          "category": "DIDNT_GO_WELL",
          "content": "Sprint planning took too long",
          "authorId": "550e8400-e29b-41d4-a716-446655440004",
          "authorName": "Bob Wilson",
          "votes": 5
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440022",
          "category": "IMPROVEMENT",
          "content": "Timebox sprint planning to 4 hours max",
          "authorId": "550e8400-e29b-41d4-a716-446655440004",
          "authorName": "Bob Wilson",
          "votes": 7
        }
      ],
      "actionItems": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440010",
          "title": "Improve code review process",
          "description": "Implement a structured code review checklist",
          "ownerId": "550e8400-e29b-41d4-a716-446655440003",
          "dueDate": "2026-05-15T00:00:00.000Z",
          "status": "PENDING",
          "addedToSprintBacklog": false,
          "relatedSprintId": null
        }
      ],
      "attendees": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440030",
          "name": "Jane Smith",
          "email": "jane@example.com",
          "role": "scrum_master",
          "attended": true
        }
      ],
      "createdAt": "2026-04-29T12:00:00.000Z",
      "updatedAt": "2026-04-29T12:00:00.000Z"
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
    "message": "Retrospective not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Get Retrospective by Sprint

Get the retrospective for a specific sprint.

**Endpoint**

```
GET /api/v1/retrospectives/sprint/:sprintId
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
    "retrospective": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "facilitatorId": "550e8400-e29b-41d4-a716-446655440003",
      "retroDate": "2026-04-29T12:00:00.000Z",
      "status": "IN_PROGRESS",
      "createdAt": "2026-04-29T12:00:00.000Z",
      "updatedAt": "2026-04-29T12:00:00.000Z"
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
    "message": "No retrospective found for this sprint"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/retrospectives/sprint/550e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### Create Retrospective

Create a new sprint retrospective.

**Endpoint**

```
POST /api/v1/retrospectives
```

**Authentication**

- Required

**Request Body**

```json
{
  "sprintId": "string (required, UUID)",
  "teamId": "string (required, UUID)",
  "facilitatorId": "string (required, UUID)",
  "retroDate": "string (optional, valid ISO 8601 date)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "retrospective": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "facilitatorId": "550e8400-e29b-41d4-a716-446655440003",
      "retroDate": "2026-04-29T12:00:00.000Z",
      "status": "DRAFT",
      "createdAt": "2026-04-29T12:00:00.000Z",
      "updatedAt": "2026-04-29T12:00:00.000Z"
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
        "field": "sprintId",
        "message": "sprintId is required"
      }
    ]
  }
}
```

**409 Conflict - Retrospective Already Exists**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "A retrospective already exists for this sprint"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/retrospectives \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "sprintId": "550e8400-e29b-41d4-a716-446655440001",
    "teamId": "550e8400-e29b-41d4-a716-446655440002",
    "facilitatorId": "550e8400-e29b-41d4-a716-446655440003",
    "retroDate": "2026-04-29T12:00:00.000Z"
  }'
```

---

### Add Item

Add a retrospective item (what went well, what didn't go well, or improvement).

**Endpoint**

```
POST /api/v1/retrospectives/:retroId/items
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID

**Request Body**

```json
{
  "category": "string (required, one of: WENT_WELL, DIDNT_GO_WELL, IMPROVEMENT)",
  "content": "string (required, 1-500 chars)",
  "authorId": "string (optional, UUID)",
  "authorName": "string (optional)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "category": "WENT_WELL",
      "content": "Team collaboration improved significantly",
      "authorId": "550e8400-e29b-41d4-a716-446655440003",
      "authorName": "Jane Smith",
      "votes": 0,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
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
        "field": "category",
        "message": "Category must be one of: WENT_WELL, DIDNT_GO_WELL, IMPROVEMENT"
      }
    ]
  }
}
```

**404 Not Found - Retrospective Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Retrospective not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "category": "WENT_WELL",
    "content": "Team collaboration improved significantly",
    "authorName": "Jane Smith"
  }'
```

---

### Vote on Item

Vote on a retrospective item to indicate prioritization.

**Endpoint**

```
POST /api/v1/retrospectives/:retroId/items/:itemId/vote
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID
- `itemId` (string, required): Item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "category": "IMPROVEMENT",
      "content": "Timebox sprint planning to 4 hours max",
      "authorId": "550e8400-e29b-41d4-a716-446655440004",
      "authorName": "Bob Wilson",
      "votes": 8,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Item Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Item not found"
  }
}
```

**409 Conflict - Already Voted**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "You have already voted on this item"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/items/550e8400-e29b-41d4-a716-446655440020/vote \
  -b cookies.txt
```

---

### Remove Vote

Remove a vote from a retrospective item.

**Endpoint**

```
DELETE /api/v1/retrospectives/:retroId/items/:itemId/vote
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID
- `itemId` (string, required): Item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "category": "IMPROVEMENT",
      "content": "Timebox sprint planning to 4 hours max",
      "authorId": "550e8400-e29b-41d4-a716-446655440004",
      "authorName": "Bob Wilson",
      "votes": 7,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Vote Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Vote not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/items/550e8400-e29b-41d4-a716-446655440020/vote \
  -b cookies.txt
```

---

### Update Item

Update a retrospective item's content.

**Endpoint**

```
PUT /api/v1/retrospectives/:retroId/items/:itemId
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID
- `itemId` (string, required): Item UUID

**Request Body**

```json
{
  "content": "string (optional, 1-500 chars)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "category": "WENT_WELL",
      "content": "Updated: Team collaboration improved significantly this sprint",
      "authorId": "550e8400-e29b-41d4-a716-446655440003",
      "authorName": "Jane Smith",
      "votes": 3,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Item Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Item not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/items/550e8400-e29b-41d4-a716-446655440020 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "content": "Updated: Team collaboration improved significantly this sprint"
  }'
```

---

### Delete Item

Delete a retrospective item.

**Endpoint**

```
DELETE /api/v1/retrospectives/:retroId/items/:itemId
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID
- `itemId` (string, required): Item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Item deleted successfully"
  }
}
```

**Error Responses**

**404 Not Found - Item Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Item not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/items/550e8400-e29b-41d4-a716-446655440020 \
  -b cookies.txt
```

---

### Update Retrospective

Update an existing retrospective. At least one field is required.

**Endpoint**

```
PUT /api/v1/retrospectives/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Retrospective UUID

**Request Body**

```json
{
  "summary": "string (optional, 10-1000 chars, no HTML)",
  "dodEvolutionNotes": "string (optional, 10-2000 chars, no HTML)",
  "status": "string (optional, one of: DRAFT, IN_PROGRESS, COMPLETED)"
}
```

> **Note:** At least one field must be provided. HTML tags are not allowed in `summary` or `dodEvolutionNotes`.

`dodReflections` is the structured counterpart of `dodEvolutionNotes`: what the team decided about
each Definition of Done criterion. It is bounded (at most 100 criteria) and a `CHANGE` decision must
state its new wording:

```json
{
  "dodEvolutionNotes": "Our Definition of Done missed the deployment step",
  "dodReflections": [
    {
      "dodItemId": "…",
      "description": "Unit tests pass",
      "decision": "CHANGE",
      "proposedDescription": "Unit tests pass with 80% coverage"
    },
    { "dodItemId": "…", "description": "Manual sign-off", "decision": "RETIRE" },
    { "dodItemId": null, "description": "Deployed to staging", "decision": "KEEP" }
  ]
}
```

Two fields are deliberately **not** updatable here: `status` is limited to the documented lifecycle
transitions (the `COMPLETED` transition is gated by the Sprint Review and the Sprint's end date), and
`isAnonymous` is fixed at creation.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "retrospective": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "facilitatorId": "550e8400-e29b-41d4-a716-446655440003",
      "retroDate": "2026-04-29T12:00:00.000Z",
      "status": "COMPLETED",
      "summary": "Team identified key areas for improvement in sprint planning",
      "dodEvolutionNotes": "Added new DoD criteria: all PRs require at least 2 approvals",
      "updatedAt": "2026-04-29T13:00:00.000Z"
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
        "field": "summary",
        "message": "Summary must be between 10 and 1000 characters"
      }
    ]
  }
}
```

**400 Bad Request - No Fields Provided**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "At least one field must be provided for update"
  }
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Retrospective not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "summary": "Team identified key areas for improvement in sprint planning",
    "dodEvolutionNotes": "Added new DoD criteria: all PRs require at least 2 approvals",
    "status": "COMPLETED"
  }'
```

---

### Add Action Item

Add an action item to a retrospective.

**Endpoint**

```
POST /api/v1/retrospectives/:retroId/action-items
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID

**Request Body**

```json
{
  "title": "string (required, 1-200 chars)",
  "description": "string (optional, max 1000 chars)",
  "ownerId": "string (required, UUID)",
  "dueDate": "string (optional, valid ISO 8601 date)",
  "status": "string (optional, one of: PENDING, IN_PROGRESS, COMPLETED, CANCELLED)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "actionItem": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "title": "Improve code review process",
      "description": "Implement a structured code review checklist",
      "ownerId": "550e8400-e29b-41d4-a716-446655440003",
      "dueDate": "2026-05-15T00:00:00.000Z",
      "status": "PENDING",
      "addedToSprintBacklog": false,
      "relatedSprintId": null,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
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
        "message": "Title must be between 1 and 200 characters"
      }
    ]
  }
}
```

**404 Not Found - Retrospective Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Retrospective not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/action-items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Improve code review process",
    "description": "Implement a structured code review checklist",
    "ownerId": "550e8400-e29b-41d4-a716-446655440003",
    "dueDate": "2026-05-15T00:00:00.000Z",
    "status": "PENDING"
  }'
```

---

### Update Action Item

Update an action item in a retrospective.

**Endpoint**

```
PUT /api/v1/retrospectives/:retroId/action-items/:actionItemId
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID
- `actionItemId` (string, required): Action Item UUID

**Request Body**

```json
{
  "title": "string (optional, 1-200 chars)",
  "description": "string (optional, max 1000 chars)",
  "status": "string (optional, one of: PENDING, IN_PROGRESS, COMPLETED, CANCELLED)",
  "dueDate": "string | null (optional, valid ISO 8601 date or null to clear)",
  "addedToSprintBacklog": "boolean (optional)",
  "relatedSprintId": "string | null (optional, UUID or null to clear)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "actionItem": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "title": "Improve code review process",
      "description": "Implement a structured code review checklist",
      "ownerId": "550e8400-e29b-41d4-a716-446655440003",
      "dueDate": "2026-05-20T00:00:00.000Z",
      "status": "IN_PROGRESS",
      "addedToSprintBacklog": true,
      "relatedSprintId": "550e8400-e29b-41d4-a716-446655440001",
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Action Item Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Action item not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/action-items/550e8400-e29b-41d4-a716-446655440010 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "IN_PROGRESS",
    "addedToSprintBacklog": true,
    "relatedSprintId": "550e8400-e29b-41d4-a716-446655440001"
  }'
```

---

### Delete Action Item

Delete an action item from a retrospective.

**Endpoint**

```
DELETE /api/v1/retrospectives/:retroId/action-items/:actionItemId
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID
- `actionItemId` (string, required): Action Item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Action item deleted successfully"
  }
}
```

**Error Responses**

**404 Not Found - Action Item Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Action item not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/action-items/550e8400-e29b-41d4-a716-446655440010 \
  -b cookies.txt
```

---

### Add Attendee

Add an attendee to a retrospective.

**Endpoint**

```
POST /api/v1/retrospectives/:retroId/attendees
```

**Authentication**

- Required

**Path Parameters**

- `retroId` (string, required): Retrospective UUID

**Request Body**

```json
{
  "name": "string (required, 1-100 chars)",
  "email": "string (optional, valid email)",
  "role": "string (required, one of: product_owner, scrum_master, developers, stakeholder)",
  "attended": "boolean (optional, default: true)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "attendee": {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "scrum_master",
      "attended": true,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
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
        "message": "Name must be between 1 and 100 characters"
      }
    ]
  }
}
```

**404 Not Found - Retrospective Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Retrospective not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440000/attendees \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "scrum_master",
    "attended": true
  }'
```

---

### Update Attendee

Update an attendee's information for a retrospective.

**Endpoint**

```
PUT /api/v1/retrospectives/attendees/:attendeeId
```

**Authentication**

- Required

**Path Parameters**

- `attendeeId` (string, required): Attendee UUID

**Request Body**

```json
{
  "name": "string (optional, 1-100 chars)",
  "email": "string (optional, valid email)",
  "role": "string (optional, one of: product_owner, scrum_master, developers, stakeholder)",
  "attended": "boolean (optional)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "attendee": {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "role": "developers",
      "attended": true,
      "retroId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Attendee Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Attendee not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/retrospectives/attendees/550e8400-e29b-41d4-a716-446655440030 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "role": "developers",
    "email": "jane.smith@example.com"
  }'
```

---

### Delete Attendee

Remove an attendee from a retrospective.

**Endpoint**

```
DELETE /api/v1/retrospectives/attendees/:attendeeId
```

**Authentication**

- Required

**Path Parameters**

- `attendeeId` (string, required): Attendee UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Attendee removed successfully"
  }
}
```

**Error Responses**

**404 Not Found - Attendee Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Attendee not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/retrospectives/attendees/550e8400-e29b-41d4-a716-446655440030 \
  -b cookies.txt
```

---

## Apply Definition of Done Changes

Apply the Definition of Done changes this Retrospective recorded.

> "The Scrum Team inspects … their Definition of Done … and identifies the most helpful changes to
> improve its effectiveness."

The change set is the **reflection persisted on the Retrospective** (`dodReflections`), not the
request body, so the endpoint takes no body and a client cannot substitute a different set of
changes for the one the team agreed.

```http
POST /api/v1/retrospectives/550e8400-e29b-41d4-a716-446655440001/apply-dod-changes
Cookie: accessToken=eyJhbGc...
X-CSRF-Token: <token>
```

**Success Response** (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "COMPLETED",
    "dodVersionAtPush": 4
  }
}
```

`dodVersionAtPush` records the Definition of Done version this Retrospective produced: the evidence
that the adaptation loop closed. The Definition of Done itself is written by the Definition of Done
service, so the version bump, the superseded-version snapshot and the rule that a Definition of Done
can never be emptied all behave exactly as they do on the team's Definition tab.

**Behaviour**

- Criteria decided `KEEP` are preserved, `CHANGE` rewrites them with `proposedDescription`, and
  `RETIRE` removes them.
- A reflection with `dodItemId: null` appends a new criterion.
- Criteria the reflection does not mention are left exactly as they were: only what the team
  inspected is changed.

**Errors**

| Code                                     | HTTP Status | When                                                                        |
| ---------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `GATE_RETROSPECTIVE_DOD_CHANGES_MISSING` | 400         | The Retrospective recorded no reflection to apply                           |
| `GATE_DOD_REQUIRED`                      | 400         | The reflection would retire every criterion, leaving the DoD unable to gate |
| `GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY`   | 403         | The caller is not a member of the team that owns the Retrospective          |

---

## Materialize Action Item

Create a Product Backlog item from an outstanding action item and record the link.

> "The most impactful improvements are addressed as soon as possible. They may even be added to the
> Sprint Backlog for the next Sprint."

The link is the evidence: `addedToSprintBacklog` alone was an assertion nobody could check. The item
is created through the Product Backlog service, so its Product Goal anchor, backlog position and
workflow history are identical to a hand-made item, and `relatedSprintId` is set to the team's
ACTIVE Sprint.

```http
POST /api/v1/retrospectives/action-items/550e8400-e29b-41d4-a716-446655440040/materialize
Cookie: accessToken=eyJhbGc...
X-CSRF-Token: <token>
```

**Success Response** (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "title": "Improve CI pipeline",
    "addedToSprintBacklog": true,
    "relatedSprintId": "550e8400-e29b-41d4-a716-446655440010",
    "productBacklogItemId": "550e8400-e29b-41d4-a716-446655440050",
    "productBacklogItem": {
      "id": "550e8400-e29b-41d4-a716-446655440050",
      "title": "Improve CI pipeline"
    }
  }
}
```

The created item carries the label `retro-action`. If the link cannot be written, the just-created
item is removed so no orphan is left behind.

**Errors**

| Code                                     | HTTP Status | When                                                                |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------- |
| `GATE_RETROSPECTIVE_ACTION_ITEM_LINKED`  | 409         | The improvement already has a linked backlog item                   |
| `GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG` | 400         | The team has no ACTIVE Product Goal, so a backlog item cannot exist |
| `GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY`   | 403         | The caller is not a member of the team                              |

---

## Link Action Item to an Existing Item

Record an existing Product Backlog item as the outcome of an action item.

```http
PUT /api/v1/retrospectives/action-items/550e8400-e29b-41d4-a716-446655440040/link
Cookie: accessToken=eyJhbGc...
X-CSRF-Token: <token>
Content-Type: application/json

{
  "pbiId": "550e8400-e29b-41d4-a716-446655440050"
}
```

The item must belong to the same team: linking across teams would let one team's Retrospective claim
another team's work.

**Errors**

| Code                                    | HTTP Status | When                                              |
| --------------------------------------- | ----------- | ------------------------------------------------- |
| `GATE_RETROSPECTIVE_ACTION_ITEM_LINKED` | 409         | The improvement already has a linked backlog item |
| `VALIDATION_ERROR`                      | 422         | `pbiId` is missing or not a UUID                  |
| `NOT_FOUND`                             | 404         | The item or action item does not exist            |
| `GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY`  | 403         | The caller is not a member of the team            |

Once an improvement is linked, `addedToSprintBacklog` is no longer writable as `false` through
`PUT /retrospectives/:retroId/action-items/:actionItemId`: the link is the evidence and the manual
flag must not contradict it.

---

## Error Codes

| Code                   | HTTP Status | Description                                                           |
| ---------------------- | ----------- | --------------------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed                                             |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                               |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions                                              |
| `NOT_FOUND`            | 404         | Retrospective, item, action item, or attendee not found               |
| `CONFLICT`             | 409         | Resource conflict (e.g., retrospective already exists, already voted) |

Gate refusals carry a stable `error.code` (see
[docs/api/README.md](./README.md#gate-rejections)):

| Gate Code                                   | HTTP Status | Rule                                                                                                                                               |
| ------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATE_RETROSPECTIVE_TEAM_MEMBERS_ONLY`      | 403         | The Retrospective is the Scrum Team's own event: reading or changing one requires membership of the team whose Sprint it concludes.                |
| `GATE_RETROSPECTIVE_SM_NOTES_SM_ONLY`       | 403         | The Scrum Master's notes are coaching observations: only the team's Scrum Master may read or write them.                                           |
| `GATE_RETROSPECTIVE_ACTION_ITEM_LINKED`     | 409         | An improvement carried by a linked backlog item cannot be marked as unaddressed.                                                                   |
| `GATE_RETROSPECTIVE_DOD_CHANGES_MISSING`    | 400         | Applying Definition of Done changes requires a recorded reflection.                                                                                |
| `GATE_SPRINT_RETROSPECTIVE_REQUIRES_REVIEW` | 400         | The Retrospective cannot be completed before its Sprint Review is completed.                                                                       |
| `GATE_SPRINT_EVENT_BEFORE_END_DATE`         | 400         | Neither event can be completed before the day the Sprint's end date names; a Sprint that has already concluded (cancelled or completed) is exempt. |

## Best Practices

### Retrospective Facilitation

1. **Timely Creation**: Create retrospectives promptly after the sprint ends
2. **Facilitator Assignment**: Assign a neutral facilitator to ensure balanced discussion
3. **Safe Environment**: Encourage honest and constructive feedback
4. **Timeboxing**: Keep retrospectives within the recommended timebox

### Item Management

1. **Balanced Categories**: Encourage items across all three categories (WENT_WELL, DIDNT_GO_WELL, IMPROVEMENT)
2. **Specific Content**: Items should be specific and actionable rather than vague
3. **Voting Discipline**: Use voting to prioritize the most impactful items
4. **Author Attribution**: Authors are recorded from the caller's session when the Retrospective is
   named, and not recorded at all when it is anonymous. Do not ask the team to add names in the item
   text: in an anonymous Retrospective that would defeat the point of the setting

### Action Item Tracking

1. **Clear Ownership**: Every action item must have an assigned owner
2. **Realistic Deadlines**: Set achievable due dates for action items
3. **Provable Follow-through**: Turn a high-priority improvement into work with
   `POST /retrospectives/action-items/:id/materialize` (creates and links an item) or
   `PUT /retrospectives/action-items/:id/link` (links an existing one). Reserve the manual
   "mark as added" for improvements whose outcome is not an item at all — once a link exists, the
   flag cannot contradict it
4. **Status Updates**: Regularly update action item status to maintain momentum
5. **Pending Review**: Review pending action items at the start of each retrospective

### Definition of Done Evolution

1. **Inspect, then decide**: Record a reflection for each criterion (`KEEP`, `CHANGE`, `RETIRE`)
   rather than only a narrative. The reflection is kept even when the team changes nothing, so "we
   inspected our Definition of Done and kept it" is as visible as "we retired a criterion"
2. **Apply What Is Accepted**: `POST /retrospectives/:id/apply-dod-changes` writes the accepted
   changes through the Definition of Done service, bumping its version and keeping the superseded
   version in the history. `dodVersionAtPush` then records which version the Retrospective produced
3. **Document Changes**: Use `dodEvolutionNotes` for the reasoning behind the decisions
4. **Team Agreement**: Ensure DoD changes are agreed upon by the entire team
5. **Incremental Improvement**: Make small, incremental improvements rather than large overhauls

---

**Last Updated**: 2026-09-22

## Scrum Master notes: revision history

`GET /retrospectives/:id/sm-notes/revisions?limit=20&offset=0` returns the notes history for the
event, newest first (`{ revisions, total, limit, offset }`). Only the team's Scrum Master may read it
(`GATE_RETROSPECTIVE_SM_NOTES_SM_ONLY`), and every real write appends a revision in the same
transaction as the update. The audit trail records that the notes changed, by whom and how long they
are — never the note body.

**Related Documentation**

- [Authentication API](./authentication.md)
- [Sprints API](./sprints.md)
- [Sprint Reviews API](./sprint-reviews.md)
- [Teams API](./teams.md)
