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
  - [Add Action Item](#add-action-item)
  - [Update Action Item](#update-action-item)
  - [Delete Action Item](#delete-action-item)
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
- Action item tracking with status management and sprint backlog integration
- Attendee management with role-based tracking
- Definition of Done evolution notes

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

## Error Codes

| Code                   | HTTP Status | Description                                                           |
| ---------------------- | ----------- | --------------------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed                                             |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                               |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions                                              |
| `NOT_FOUND`            | 404         | Retrospective, item, action item, or attendee not found               |
| `CONFLICT`             | 409         | Resource conflict (e.g., retrospective already exists, already voted) |

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
4. **Author Attribution**: Encourage authors to identify themselves for follow-up discussions

### Action Item Tracking

1. **Clear Ownership**: Every action item must have an assigned owner
2. **Realistic Deadlines**: Set achievable due dates for action items
3. **Sprint Backlog Integration**: Add high-priority action items to the sprint backlog using `addedToSprintBacklog` and `relatedSprintId`
4. **Status Updates**: Regularly update action item status to maintain momentum
5. **Pending Review**: Review pending action items at the start of each retrospective

### Definition of Done Evolution

1. **Document Changes**: Use `dodEvolutionNotes` to track how the Definition of Done evolves
2. **Team Agreement**: Ensure DoD changes are agreed upon by the entire team
3. **Incremental Improvement**: Make small, incremental improvements rather than large overhauls

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Authentication API](./authentication.md)
- [Sprints API](./sprints.md)
- [Sprint Reviews API](./sprint-reviews.md)
- [Teams API](./teams.md)
