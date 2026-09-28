# Product Goals API

Complete Product Goals API reference for managing product goals, strategic alignment, and goal lifecycle tracking.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Goal Statuses](#goal-statuses)
- [Endpoints](#endpoints)
  - [Get Product Goals](#get-product-goals)
  - [Get Active Product Goal](#get-active-product-goal)
  - [Create Product Goal](#create-product-goal)
  - [Get Product Goal by ID](#get-product-goal-by-id)
  - [Update Product Goal](#update-product-goal)
  - [Delete Product Goal](#delete-product-goal)
  - [Get Status History](#get-status-history)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Product Goals API provides comprehensive product goal management capabilities including:

- Goal creation with strategic alignment
- Goal lifecycle management (NEW, ACTIVE, COMPLETED, ABANDONED)
- Active goal tracking per team
- Status history and audit trail
- Success metrics definition

## Authentication

All product goal endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Goal Statuses

Product goals follow a defined lifecycle with four statuses:

| Status        | Description                                      |
| ------------- | ------------------------------------------------ |
| **NEW**       | Goal has been created but not yet activated      |
| **ACTIVE**    | Goal is currently being worked on by the team    |
| **COMPLETED** | Goal has been successfully achieved              |
| **ABANDONED** | Goal has been abandoned and is no longer pursued |

### Status Transitions

```
NEW ──→ ACTIVE ──→ COMPLETED
  │        │
  │        └──→ ABANDONED
  └──→ ABANDONED
```

## Endpoints

### Get Product Goals

Get all product goals for a team with pagination.

**Endpoint**

```
GET /api/v1/product-goals
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Query Parameters**

- `teamId` (string, required): Team UUID to filter goals by
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "goals": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "teamId": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Increase user engagement by 30%",
        "description": "Improve the onboarding flow and add gamification features to drive user engagement metrics.",
        "targetDate": "2026-09-30T00:00:00.000Z",
        "successMetrics": "Monthly active users increased by 30%; session duration increased by 15%",
        "strategicAlignment": "GROWTH",
        "status": "ACTIVE",
        "createdBy": "550e8400-e29b-41d4-a716-446655440001",
        "createdAt": "2026-04-29T12:00:00.000Z",
        "updatedAt": "2026-04-29T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
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
    "message": "Validation failed",
    "details": [
      {
        "field": "teamId",
        "message": "teamId is required"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/product-goals?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Get Active Product Goal

Get the currently active product goal for a team. Only one goal can be active per team at a time.

**Endpoint**

```
GET /api/v1/product-goals/active
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Query Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "goal": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Increase user engagement by 30%",
      "description": "Improve the onboarding flow and add gamification features to drive user engagement metrics.",
      "targetDate": "2026-09-30T00:00:00.000Z",
      "successMetrics": "Monthly active users increased by 30%; session duration increased by 15%",
      "strategicAlignment": "GROWTH",
      "status": "ACTIVE",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "createdAt": "2026-04-29T12:00:00.000Z",
      "updatedAt": "2026-04-29T12:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found - No Active Goal**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No active product goal found for this team"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/product-goals/active?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Create Product Goal

Create a new product goal for a team. Requires Product Owner role.

**Endpoint**

```
POST /api/v1/product-goals
```

**Authentication**

- Required
- Product Owner role required

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "teamId": "string (required, UUID)",
  "title": "string (required, 1-200 chars)",
  "description": "string (optional, max 5000 chars)",
  "targetDate": "string (optional, ISO 8601 datetime)",
  "successMetrics": "string (optional, max 1000 chars)",
  "strategicAlignment": "string (optional, max 100 chars)",
  "status": "string (optional, one of: NEW, ACTIVE, COMPLETED, ABANDONED)"
}
```

**Validation Rules**

- `teamId`: Required, must be a valid UUID
- `title`: Required, must be between 1 and 200 characters
- `description`: Optional, maximum 5000 characters
- `targetDate`: Optional, must be a valid ISO 8601 datetime
- `successMetrics`: Optional, maximum 1000 characters
- `strategicAlignment`: Optional, maximum 100 characters
- `status`: Optional, defaults to `NEW` if not provided

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "goal": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Increase user engagement by 30%",
      "description": "Improve the onboarding flow and add gamification features to drive user engagement metrics.",
      "targetDate": "2026-09-30T00:00:00.000Z",
      "successMetrics": "Monthly active users increased by 30%; session duration increased by 15%",
      "strategicAlignment": "GROWTH",
      "status": "NEW",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
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
        "field": "title",
        "message": "Title is required"
      }
    ]
  }
}
```

**403 Forbidden - Product Owner Role Required**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL",
    "message": "Only the Product Owner can create, edit, or delete a Product Goal."
  }
}
```

**409 Conflict - Active Goal Already Exists**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_GOAL_ALREADY_ACTIVE",
    "message": "An active Product Goal already exists for this team. Fulfil or abandon it before activating another."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/product-goals \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "teamId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Increase user engagement by 30%",
    "description": "Improve the onboarding flow and add gamification features to drive user engagement metrics.",
    "targetDate": "2026-09-30T00:00:00.000Z",
    "successMetrics": "Monthly active users increased by 30%; session duration increased by 15%",
    "strategicAlignment": "GROWTH",
    "status": "NEW"
  }'
```

---

### Get Product Goal by ID

Get detailed information about a specific product goal.

**Endpoint**

```
GET /api/v1/product-goals/:id
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product goal UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "goal": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Increase user engagement by 30%",
      "description": "Improve the onboarding flow and add gamification features to drive user engagement metrics.",
      "targetDate": "2026-09-30T00:00:00.000Z",
      "successMetrics": "Monthly active users increased by 30%; session duration increased by 15%",
      "strategicAlignment": "GROWTH",
      "status": "ACTIVE",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
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
    "message": "Product goal not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/product-goals/660e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Update Product Goal

Update a product goal. Requires Product Owner role.

**Endpoint**

```
PUT /api/v1/product-goals/:id
```

**Authentication**

- Required
- Product Owner role required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product goal UUID

**Request Body**

```json
{
  "title": "string (optional, 1-200 chars)",
  "description": "string (optional, max 5000 chars)",
  "targetDate": "string (optional, ISO 8601 datetime)",
  "successMetrics": "string (optional, max 1000 chars)",
  "strategicAlignment": "string (optional, max 100 chars)",
  "status": "string (optional, one of: NEW, ACTIVE, COMPLETED, ABANDONED)"
}
```

**Validation Rules**

- `title`: Optional, must be between 1 and 200 characters if provided
- `description`: Optional, maximum 5000 characters
- `targetDate`: Optional, must be a valid ISO 8601 datetime
- `successMetrics`: Optional, maximum 1000 characters
- `strategicAlignment`: Optional, maximum 100 characters
- `status`: Optional, must be a valid status transition

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "goal": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Increase user engagement by 35%",
      "description": "Updated description with revised targets.",
      "targetDate": "2026-10-31T00:00:00.000Z",
      "successMetrics": "Monthly active users increased by 35%",
      "strategicAlignment": "GROWTH",
      "status": "ACTIVE",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "createdAt": "2026-04-29T12:00:00.000Z",
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
        "field": "title",
        "message": "Title must be between 1 and 200 characters"
      }
    ]
  }
}
```

**403 Forbidden - Product Owner Role Required**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL",
    "message": "Only the Product Owner can create, edit, or delete a Product Goal."
  }
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product goal not found"
  }
}
```

**409 Conflict - Active Goal Already Exists**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_GOAL_ALREADY_ACTIVE",
    "message": "An active Product Goal already exists for this team. Fulfil or abandon it before activating another."
  }
}
```

**409 Conflict - Evidence Required to Complete**

A Product Goal is the commitment of the Product Backlog, so completing it is an assertion unless the team has something to inspect: a qualifying Sprint Review assessment or measured success-metric values recorded as a Product Goal snapshot.

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED",
    "message": "A Product Goal cannot be completed without evidence. Record a Sprint Review assessment or measured success-metric values for this goal first."
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/product-goals/660e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Increase user engagement by 35%",
    "description": "Updated description with revised targets.",
    "targetDate": "2026-10-31T00:00:00.000Z"
  }'
```

---

### Delete Product Goal

Delete a product goal. Requires Product Owner role. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/product-goals/:id
```

**Authentication**

- Required
- Product Owner role required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product goal UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Product goal deleted successfully"
  }
}
```

**Error Responses**

**403 Forbidden - Product Owner Role Required**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL",
    "message": "Only the Product Owner can create, edit, or delete a Product Goal."
  }
}
```

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product goal not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/product-goals/660e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Get Status History

Get the status change history for a product goal.

**Endpoint**

```
GET /api/v1/product-goals/:id/status-history
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product goal UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "history": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440001",
        "goalId": "660e8400-e29b-41d4-a716-446655440000",
        "fromStatus": "NEW",
        "toStatus": "ACTIVE",
        "changedBy": "550e8400-e29b-41d4-a716-446655440001",
        "changedAt": "2026-04-29T14:00:00.000Z",
        "reason": "Team ready to start working on this goal"
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "goalId": "660e8400-e29b-41d4-a716-446655440000",
        "fromStatus": null,
        "toStatus": "NEW",
        "changedBy": "550e8400-e29b-41d4-a716-446655440001",
        "changedAt": "2026-04-29T12:00:00.000Z",
        "reason": null
      }
    ]
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
    "message": "Product goal not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/product-goals/660e8400-e29b-41d4-a716-446655440000/status-history \
  -b cookies.txt
```

---

## Error Codes

| Code                                   | HTTP Status | Description                                                       |
| -------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `VALIDATION_ERROR`                     | 400         | Request validation failed                                         |
| `AUTHENTICATION_ERROR`                 | 401         | Authentication required                                           |
| `AUTHORIZATION_ERROR`                  | 403         | Insufficient permissions                                          |
| `NOT_FOUND`                            | 404         | Product goal not found                                            |
| `CONFLICT`                             | 409         | Resource conflict (e.g., active goal already exists)              |
| `GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL` | 403         | Only the Product Owner may create, edit, or delete a Product Goal |
| `GATE_PRODUCT_GOAL_ALREADY_ACTIVE`     | 409         | Another Product Goal of the team is already `ACTIVE`              |
| `GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED`  | 409         | Completing a Product Goal requires recorded evidence of progress  |

Two further gates guard the backlog side of the Product Goal. They are raised by the
[Product Backlog API](./product-backlog.md), not by these endpoints, and are listed here because they
are part of the same commitment:

- `GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG` (400) — a team with no `ACTIVE` Product Goal cannot add
  backlog items, because the backlog is the emergent expression of the goal.
- `GATE_PRODUCT_GOAL_NOT_ACTIVE` (409) — a backlog item can only be linked to the team's single
  `ACTIVE` Product Goal.

## Best Practices

### Goal Management

1. **One Active Goal**: Only one Product Goal can be active per team at a time — enforced by the API
2. **Clear Metrics**: Define measurable success metrics when creating goals
3. **Strategic Alignment**: Tag goals with strategic alignment for reporting
4. **Target Dates**: Set realistic target dates to maintain team focus

### Status Transitions

1. **NEW to ACTIVE**: Activate a goal only when the team is ready to commit. A team can hold one `ACTIVE` goal at a time — activating a second is refused with `GATE_PRODUCT_GOAL_ALREADY_ACTIVE`.
2. **ACTIVE to COMPLETED**: Mark completed only when success metrics are met. Completion is refused with `GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED` unless a Sprint Review assessment or measured success-metric values have been recorded, so a completed goal is inspectable rather than asserted.
3. **Abandoning Goals**: Document the reason when abandoning a goal
4. **Status History**: Review status history during retrospectives

### Security

1. **Access Control**: Only Product Owners can create or update goals
2. **Audit Trail**: All goal changes are logged with status history
3. **Team Isolation**: Goals are scoped to teams and cannot be accessed cross-team

---

**Last Updated**: 2026-09-28

**Related Documentation**

- [Authentication API](./authentication.md)
- [Product Backlog API](./product-backlog.md)
- [Teams API](./teams.md)
