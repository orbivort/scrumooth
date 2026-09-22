# Product Backlog API

Complete Product Backlog API reference for managing product backlog items (PBIs), the backlog's persisted order, prioritization, reordering, and Definition of Done/Ready verification.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [PBI Statuses](#pbi-statuses)
- [MoSCoW Prioritization](#moscow-prioritization)
- [Product Backlog Order](#product-backlog-order)
- [Authorization Model](#authorization-model)
- [Refinement Gate: READY Before a Sprint](#refinement-gate-ready-before-a-sprint)
- [Endpoints](#endpoints)
  - [Get Product Backlog](#get-product-backlog)
  - [Create PBI](#create-pbi)
  - [Get PBI by ID](#get-pbi-by-id)
  - [Update PBI](#update-pbi)
  - [Update PBI Priority](#update-pbi-priority)
  - [Delete PBI](#delete-pbi)
  - [Get Tasks for PBI](#get-tasks-for-pbi)
  - [Reorder PBIs](#reorder-pbis)
  - [Verify Definition of Done](#verify-definition-of-done)
  - [Get DoD Verifications](#get-dod-verifications)
  - [Verify Definition of Ready](#verify-definition-of-ready)
  - [Get DoR Verifications](#get-dor-verifications)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Product Backlog API provides comprehensive product backlog management capabilities including:

- Product backlog item (PBI) creation and management
- A persisted backlog order (`rank`), read top-to-bottom and maintained by the Product Owner
- MoSCoW prioritization (MUST_HAVE, SHOULD_HAVE, COULD_HAVE, WONT_HAVE) as a categorisation of that order
- Positional reordering (relative to a neighbour, or as a complete ordered list)
- Definition of Done (DoD) verification tracking
- Definition of Ready (DoR) verification tracking
- The refinement gate that keeps items that are not `READY` out of a Sprint
- Task association with backlog items
- Label-based categorization and filtering

### Response Envelope

Every response carries a `success` flag. A collection read puts the array directly in `data` and `pagination` as a sibling; a single-resource call puts the resource object in `data`.

```json
{
  "success": true,
  "data": [{ "id": "880e8400-e29b-41d4-a716-446655440000", "rank": 1 }],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

```json
{ "success": true, "data": { "id": "880e8400-e29b-41d4-a716-446655440000", "rank": 1 } }
```

The per-endpoint examples below focus on the payload each endpoint is about, so treat the object shown under `data` as that payload — except for the collection read, where the array _is_ `data` and `pagination` sits beside it.

## Authentication

All product backlog endpoints require authentication. Include the access token in your request:

**Using Cookies (Recommended)**

```http
GET /api/v1/product-backlog
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/product-backlog
Authorization: Bearer eyJhbGc...
```

## PBI Statuses

Product backlog items follow a defined lifecycle with five statuses:

| Status          | Description                                         |
| --------------- | --------------------------------------------------- |
| **NEW**         | Item has been created but not yet refined           |
| **REFINED**     | Item has been discussed and details clarified       |
| **READY**       | Item meets Definition of Ready and can be pulled in |
| **IN_PROGRESS** | Item is currently being worked on in a sprint       |
| **DONE**        | Item meets Definition of Done and is complete       |

### Status Flow

```
NEW ──→ REFINED ──→ READY ──→ IN_PROGRESS ──→ DONE
```

## MoSCoW Prioritization

The product backlog uses the MoSCoW method for prioritization:

| Priority        | Description                                            |
| --------------- | ------------------------------------------------------ |
| **MUST_HAVE**   | Critical items required for success                    |
| **SHOULD_HAVE** | Important but not critical; can be deferred            |
| **COULD_HAVE**  | Desirable but not necessary; nice to have              |
| **WONT_HAVE**   | Not planned for current iteration; explicitly excluded |

## Product Backlog Order

The Product Backlog is "an emergent, ordered list of what is needed to improve the product", and ordering it is the Product Owner's accountability. Every item therefore carries a persisted position:

- **`rank`** — a dense, 1-based position within the team's backlog. It is the **order of record**: reads return the backlog ordered by `rank`, so the list reads top-to-bottom as "what is next".
- MoSCoW `priority` is a _categorisation rendered on top of_ that order, not the order itself. Two Must Haves still have a first and a second.
- A new item is **appended to the end** of the order (it receives the highest `rank`), so creating an item never inserts itself into the middle of the Product Owner's decision.
- `POST /product-backlog/reorder` rewrites the order. Ranks stay dense (1..N) across the team's backlog; deleting an item leaves a gap until the next reorder re-densifies it.

Ordering is expressed in two shapes, so a filtered or paginated view can move an item without holding the whole backlog:

```json
{ "pbiIds": ["uuid-3", "uuid-1", "uuid-2"] }
```

```json
{ "pbiId": "uuid-3", "targetPbiId": "uuid-1", "position": "before" }
```

The first is the canonical form and must contain **every** item of the team's backlog; a partial list is refused rather than silently scrambling the ranks of the items it omits. The second names one move relative to a neighbour. Both are capped at 500 items and both return the resulting order.

## Authorization Model

Scrumooth enforces the Scrum Guide's accountabilities server-side, so the same rules hold when you call the API directly as when you use the interface:

| Action                                               | Who may do it   | Refusal on misuse                           |
| ---------------------------------------------------- | --------------- | ------------------------------------------- |
| Create / update / delete a PBI, workflow transitions | Any team member | `403 AUTHORIZATION_ERROR` (not a member)    |
| Set or change `storyPoints`                          | Developers      | `403 GATE_DEVELOPER_ONLY_SIZING`            |
| Change the MoSCoW `priority`, or reorder the backlog | Product Owner   | `403 GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER` |
| Save the Sprint Backlog / plan items into a Sprint   | Developers      | `403 GATE_DEVELOPER_ONLY_SPRINT_BACKLOG`    |
| Enter a Sprint with an item that is not `READY`      | Nobody          | `400 GATE_PBI_NOT_READY`                    |

Refusals that encode a Scrum Guide gate carry a stable `error.code` so a client can branch on them without parsing the localized message; the full list is in [Gate Rejections](./README.md#gate-rejections).

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER",
    "message": "Only the Product Owner orders the Product Backlog: changing an item's MoSCoW priority or its position is the Product Owner's decision."
  }
}
```

## Refinement Gate: READY Before a Sprint

An item must be refined to `READY` before it can enter a Sprint. The same rule is applied on every path into a Sprint, so the paths cannot disagree:

- saving the Sprint Backlog or a Sprint Planning draft (`PUT /sprints/:id/backlog`, `PUT /sprints/:id/backlog/draft`),
- starting the Sprint (a planned item that was moved back out of `READY` is refused), and
- adding an item to an active Sprint.

All of them refuse with `400 GATE_PBI_NOT_READY` and name the offending items. The Definition of Ready checklist is a team agreement rather than a Scrum Guide artifact, so the checklist itself is **not** a gate: `READY` is the workflow status refinement produces.

## Endpoints

### Get Product Backlog

Get all product backlog items for a team with filtering and pagination.

**Endpoint**

```
GET /api/v1/product-backlog
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Query Parameters**

- `teamId` (string, required): Team UUID to filter items by
- `status` (string, optional): Filter by status - one of: NEW, REFINED, READY, IN_PROGRESS, DONE
- `labels` (string, optional): Filter by labels (comma-separated)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "teamId": "550e8400-e29b-41d4-a716-446655440000",
        "goalId": "660e8400-e29b-41d4-a716-446655440000",
        "title": "User registration with email verification",
        "description": "As a new user, I want to register with email verification so that my account is secure.",
        "storyPoints": 5,
        "priority": "MUST_HAVE",
        "businessValue": 90,
        "labels": ["auth", "security"],
        "acceptanceCriteria": "1. User can register with email\n2. Verification email is sent\n3. Account is activated after verification",
        "status": "READY",
        "rank": 1,
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
curl -X GET "https://api.scrumooth.dev/api/v1/product-backlog?teamId=550e8400-e29b-41d4-a716-446655440000&status=READY&limit=10" \
  -b cookies.txt
```

---

### Create PBI

Create a new product backlog item. Any Scrum Team member may create one: the item is appended to the end of the team's backlog order and anchored to the team's active Product Goal. Only the story-point estimate is reserved to the Developers.

**Endpoint**

```
POST /api/v1/product-backlog
```

**Authentication**

- Required
- Team membership required (the specific rule is stated per endpoint below)

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "teamId": "string (required, UUID)",
  "goalId": "string (optional, UUID)",
  "title": "string (required, 1-200 chars)",
  "description": "string (optional, max 5000 chars)",
  "storyPoints": "integer (optional, 1-100)",
  "priority": "string (optional, one of: MUST_HAVE, SHOULD_HAVE, COULD_HAVE, WONT_HAVE)",
  "businessValue": "integer (optional, 1-100)",
  "labels": "string[] (optional)",
  "acceptanceCriteria": "string (optional, max 5000 chars)",
  "status": "string (optional, one of: NEW, REFINED, READY, IN_PROGRESS, DONE)"
}
```

**Validation Rules**

- `teamId`: Required, must be a valid UUID
- `goalId`: Optional, must be a valid UUID if provided
- `title`: Required, must be between 1 and 200 characters
- `description`: Optional, maximum 5000 characters
- `storyPoints`: Optional, must be between 1 and 100
- `priority`: Optional, defaults to `SHOULD_HAVE` if not provided
- `businessValue`: Optional, must be between 1 and 100
- `labels`: Optional, array of strings
- `acceptanceCriteria`: Optional, maximum 5000 characters
- `status`: Optional, defaults to `NEW` if not provided

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "goalId": "660e8400-e29b-41d4-a716-446655440000",
      "title": "User registration with email verification",
      "description": "As a new user, I want to register with email verification so that my account is secure.",
      "storyPoints": 5,
      "priority": "MUST_HAVE",
      "businessValue": 90,
      "labels": ["auth", "security"],
      "acceptanceCriteria": "1. User can register with email\n2. Verification email is sent\n3. Account is activated after verification",
      "status": "NEW",
      "rank": 1,
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

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "You are not a member of this team"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/product-backlog \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "teamId": "550e8400-e29b-41d4-a716-446655440000",
    "goalId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "User registration with email verification",
    "description": "As a new user, I want to register with email verification so that my account is secure.",
    "storyPoints": 5,
    "priority": "MUST_HAVE",
    "businessValue": 90,
    "labels": ["auth", "security"],
    "acceptanceCriteria": "1. User can register with email\n2. Verification email is sent\n3. Account is activated after verification"
  }'
```

---

### Get PBI by ID

Get detailed information about a specific product backlog item.

**Endpoint**

```
GET /api/v1/product-backlog/:id
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "goalId": "660e8400-e29b-41d4-a716-446655440000",
      "title": "User registration with email verification",
      "description": "As a new user, I want to register with email verification so that my account is secure.",
      "storyPoints": 5,
      "priority": "MUST_HAVE",
      "businessValue": 90,
      "labels": ["auth", "security"],
      "acceptanceCriteria": "1. User can register with email\n2. Verification email is sent\n3. Account is activated after verification",
      "status": "READY",
      "rank": 1,
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
    "message": "Product backlog item not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Update PBI

Update a product backlog item. Any team member may update an item's content and move it through the workflow (refine, Ready, In Progress, Done); the story-point estimate is reserved to the Developers, and changing the MoSCoW priority requires the Product Owner (see [Authorization model](#authorization-model)).

**Endpoint**

```
PUT /api/v1/product-backlog/:id
```

**Authentication**

- Required
- Team membership required (the specific rule is stated per endpoint below)

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "goalId": "string (optional, UUID)",
  "title": "string (optional, 1-200 chars)",
  "description": "string (optional, max 5000 chars)",
  "storyPoints": "integer (optional, 1-100)",
  "priority": "string (optional, one of: MUST_HAVE, SHOULD_HAVE, COULD_HAVE, WONT_HAVE)",
  "businessValue": "integer (optional, 1-100)",
  "labels": "string[] (optional)",
  "acceptanceCriteria": "string (optional, max 5000 chars)",
  "status": "string (optional, one of: NEW, REFINED, READY, IN_PROGRESS, DONE)"
}
```

**Validation Rules**

- `goalId`: Optional, must be a valid UUID if provided
- `title`: Optional, must be between 1 and 200 characters if provided
- `description`: Optional, maximum 5000 characters
- `storyPoints`: Optional, must be between 1 and 100
- `priority`: Optional, must be a valid MoSCoW value
- `businessValue`: Optional, must be between 1 and 100
- `labels`: Optional, array of strings
- `acceptanceCriteria`: Optional, maximum 5000 characters
- `status`: Optional, must be a valid status value

**Transition to `DONE`**

`DONE` is gated on the team's Definition of Done, and the gate is enforced here rather than only in the interface:

- The team must have at least one active DoD item, otherwise the transition is refused with `400 GATE_DOD_REQUIRED`. An emptied DoD must not become a way through the gate.
- Every active DoD item must be verified for this item, otherwise the transition is refused with `400 GATE_DOD_NOT_VERIFIED`.

**Composition of the Sprint Increment**

When the update transitions the item to `DONE`, the Increment of its active Sprint absorbs it. That composition is deliberately non-fatal — a composition failure never rolls back the Done write — but it is never silent: the response carries a sibling `composition` field reporting the outcome.

```json
{
  "success": true,
  "data": {
    "item": { "…": "the Product Backlog item, unchanged" },
    "composition": {
      "status": "COMPOSED",
      "incrementId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

| `composition.status`        | Meaning                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `COMPOSED`                  | The item joined the Sprint's open Increment                                               |
| `SKIPPED_NO_ACTIVE_SPRINT`  | The item is not part of an active Sprint, so it has no Sprint Increment to join           |
| `SKIPPED_ITEM_NOT_ELIGIBLE` | The item no longer satisfies every active Definition of Done item                         |
| `FAILED`                    | Composition failed; `reason` explains, and `POST /api/v1/increments/reconcile` repairs it |

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "goalId": "660e8400-e29b-41d4-a716-446655440000",
      "title": "User registration with email verification",
      "description": "Updated description with additional context.",
      "storyPoints": 8,
      "priority": "MUST_HAVE",
      "businessValue": 95,
      "labels": ["auth", "security", "onboarding"],
      "acceptanceCriteria": "1. User can register with email\n2. Verification email is sent\n3. Account is activated after verification\n4. Resend verification option available",
      "status": "REFINED",
      "rank": 1,
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
        "field": "storyPoints",
        "message": "Story points must be between 1 and 100"
      }
    ]
  }
}
```

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "You are not a member of this team"
  }
}
```

**404 Not Found**

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
curl -X PUT https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "description": "Updated description with additional context.",
    "storyPoints": 8,
    "businessValue": 95,
    "labels": ["auth", "security", "onboarding"],
    "status": "REFINED"
  }'
```

---

### Update PBI Priority

Update the priority of a product backlog item. Requires the Product Owner: the MoSCoW band is part of how the backlog is ordered, and ordering is the Product Owner's accountability.

**Endpoint**

```
PUT /api/v1/product-backlog/:id/priority
```

**Authentication**

- Required
- Team membership required (the specific rule is stated per endpoint below)

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "priority": "string (required, one of: MUST_HAVE, SHOULD_HAVE, COULD_HAVE, WONT_HAVE)"
}
```

**Validation Rules**

- `priority`: Required, must be one of: MUST_HAVE, SHOULD_HAVE, COULD_HAVE, WONT_HAVE

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "item": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "title": "User registration with email verification",
      "priority": "MUST_HAVE",
      "status": "READY",
      "updatedAt": "2026-04-29T14:00:00.000Z"
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
        "field": "priority",
        "message": "Priority must be one of: MUST_HAVE, SHOULD_HAVE, COULD_HAVE, WONT_HAVE"
      }
    ]
  }
}
```

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "You are not a member of this team"
  }
}
```

**404 Not Found**

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
curl -X PUT https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000/priority \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "priority": "MUST_HAVE"
  }'
```

---

### Delete PBI

Delete a product backlog item. Any team member may delete an item that is not In Progress, not Done, and not committed to a Sprint. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/product-backlog/:id
```

**Authentication**

- Required
- Team membership required (the specific rule is stated per endpoint below)

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Product backlog item deleted successfully"
  }
}
```

**Error Responses**

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "You are not a member of this team"
  }
}
```

**404 Not Found**

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
curl -X DELETE https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Get Tasks for PBI

Get all tasks associated with a product backlog item.

**Endpoint**

```
GET /api/v1/product-backlog/:id/tasks
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

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
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "title": "Create registration form component",
        "description": "Build the registration form with email and password fields",
        "status": "DONE",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440002",
        "createdAt": "2026-04-29T12:00:00.000Z",
        "updatedAt": "2026-04-30T09:00:00.000Z"
      },
      {
        "id": "990e8400-e29b-41d4-a716-446655440002",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "title": "Implement email verification service",
        "description": "Set up email verification token generation and validation",
        "status": "IN_PROGRESS",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440003",
        "createdAt": "2026-04-29T12:00:00.000Z",
        "updatedAt": "2026-04-29T15:00:00.000Z"
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
    "message": "Product backlog item not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000/tasks \
  -b cookies.txt
```

---

### Reorder PBIs

Reorder product backlog items within the backlog. Requires the Product Owner: "the Product Owner orders Product Backlog items".

**Endpoint**

```
POST /api/v1/product-backlog/reorder
```

**Authentication**

- Required
- Team membership required (the specific rule is stated per endpoint below)

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

Two shapes are accepted (see [Product Backlog Order](#product-backlog-order)). Supply exactly one of them:

```json
{
  "pbiIds": ["string (required, UUID array — the team's complete backlog in the requested order)"]
}
```

```json
{
  "pbiId": "string (required, UUID)",
  "targetPbiId": "string (required, UUID)",
  "position": "string (required, one of: before, after)"
}
```

**Validation Rules**

- `pbiIds`: Required in the list shape. A non-empty array of valid UUIDs (maximum 500), containing **every** item of the team's backlog exactly once. A partial or duplicated list is refused with `400` rather than applied partially.
- `pbiId` / `targetPbiId`: Required in the positional shape, and must differ (an item cannot move relative to itself).
- All named items must exist and belong to the same team's backlog.
- The caller must be the team's Product Owner.

**Success Response**

The resulting order is returned, so a client reconciles against what was actually written instead of an unverified success message.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "rank": 1,
        "priority": "MUST_HAVE"
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "rank": 2,
        "priority": "SHOULD_HAVE"
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440002",
        "rank": 3,
        "priority": "COULD_HAVE"
      }
    ]
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
        "field": "pbiIds",
        "message": "At least one PBI is required"
      }
    ]
  }
}
```

**400 Bad Request - Incomplete or duplicated list**

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "A full reorder must contain every item of the team's Product Backlog: expected 12, received 3. To reorder a filtered view, send a positional move (pbiId, targetPbiId, position) instead."
  }
}
```

**403 Forbidden - Not the Product Owner**

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER",
    "message": "Only the Product Owner orders the Product Backlog: changing an item's MoSCoW priority or its position is the Product Owner's decision."
  }
}
```

**403 Forbidden - Not a team member**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "You are not a member of this team"
  }
}
```

**Example Request**

Reorder the whole backlog:

```bash
curl -X POST https://api.scrumooth.dev/api/v1/product-backlog/reorder \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pbiIds": [
      "880e8400-e29b-41d4-a716-446655440000",
      "880e8400-e29b-41d4-a716-446655440001",
      "880e8400-e29b-41d4-a716-446655440002"
    ]
  }'
```

Move one item directly before another (works from a filtered or paginated view):

```bash
curl -X POST https://api.scrumooth.dev/api/v1/product-backlog/reorder \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pbiId": "880e8400-e29b-41d4-a716-446655440002",
    "targetPbiId": "880e8400-e29b-41d4-a716-446655440000",
    "position": "before"
  }'
```

---

### Verify Definition of Done

Record Definition of Done checklist items as verified (or not) for a product backlog item. This is what lets the item reach `DONE`: the Done gate refuses the transition until every active DoD item is verified for it.

**Endpoint**

```
POST /api/v1/product-backlog/:id/verify-dod
```

**Authentication**

- Required
- The caller must be a member of the team that owns the item. A verification is a statement about the team's own commitment, so a non-member who could write one could decide that another team's work is Done (`403 GATE_DOD_TEAM_MEMBERS_ONLY`).

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "verifications": [
    {
      "dodItemId": "string (required, UUID)",
      "isVerified": "boolean (required)",
      "notes": "string (optional)"
    }
  ]
}
```

**Validation Rules**

- `verifications`: Required, must be a non-empty array
- `dodItemId`: Required, must be a valid UUID referencing a DoD item
- `isVerified`: Required, boolean indicating verification status
- `notes`: Optional, string with additional context

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "verifications": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440001",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dodItemId": "bb0e8400-e29b-41d4-a716-446655440001",
        "isVerified": true,
        "notes": "All unit tests passing with 95% coverage",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T17:00:00.000Z"
      },
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440002",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dodItemId": "bb0e8400-e29b-41d4-a716-446655440002",
        "isVerified": false,
        "notes": "Code review still pending",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T17:00:00.000Z"
      }
    ]
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
        "field": "verifications",
        "message": "verifications must be a non-empty array"
      }
    ]
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

**404 Not Found**

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
curl -X POST https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000/verify-dod \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "verifications": [
      {
        "dodItemId": "bb0e8400-e29b-41d4-a716-446655440001",
        "isVerified": true,
        "notes": "All unit tests passing with 95% coverage"
      },
      {
        "dodItemId": "bb0e8400-e29b-41d4-a716-446655440002",
        "isVerified": false,
        "notes": "Code review still pending"
      }
    ]
  }'
```

---

### Get DoD Verifications

Get all Definition of Done verifications for a product backlog item.

**Endpoint**

```
GET /api/v1/product-backlog/:id/dod-verifications
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "verifications": [
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440001",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dodItemId": "bb0e8400-e29b-41d4-a716-446655440001",
        "dodItem": {
          "id": "bb0e8400-e29b-41d4-a716-446655440001",
          "title": "Unit tests written and passing",
          "description": "All code must have unit tests with adequate coverage"
        },
        "isVerified": true,
        "notes": "All unit tests passing with 95% coverage",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T17:00:00.000Z"
      },
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440002",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dodItemId": "bb0e8400-e29b-41d4-a716-446655440002",
        "dodItem": {
          "id": "bb0e8400-e29b-41d4-a716-446655440002",
          "title": "Code review completed",
          "description": "All code must be reviewed by at least one other developer"
        },
        "isVerified": false,
        "notes": "Code review still pending",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T17:00:00.000Z"
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
    "message": "Product backlog item not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000/dod-verifications \
  -b cookies.txt
```

---

### Verify Definition of Ready

Verify Definition of Ready checklist items for a product backlog item. Requires Scrum Master role.

**Endpoint**

```
POST /api/v1/product-backlog/:id/verify-dor
```

**Authentication**

- Required
- Scrum Master role required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "verifications": [
    {
      "dorItemId": "string (required, UUID)",
      "isVerified": "boolean (required)",
      "notes": "string (optional)"
    }
  ]
}
```

**Validation Rules**

- `verifications`: Required, must be a non-empty array
- `dorItemId`: Required, must be a valid UUID referencing a DoR item
- `isVerified`: Required, boolean indicating verification status
- `notes`: Optional, string with additional context

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "verifications": [
      {
        "id": "cc0e8400-e29b-41d4-a716-446655440001",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dorItemId": "dd0e8400-e29b-41d4-a716-446655440001",
        "isVerified": true,
        "notes": "Acceptance criteria clearly defined",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T18:00:00.000Z"
      },
      {
        "id": "cc0e8400-e29b-41d4-a716-446655440002",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dorItemId": "dd0e8400-e29b-41d4-a716-446655440002",
        "isVerified": true,
        "notes": "Dependencies identified and resolved",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T18:00:00.000Z"
      }
    ]
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
        "field": "verifications",
        "message": "verifications must be a non-empty array"
      }
    ]
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

**404 Not Found**

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
curl -X POST https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000/verify-dor \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "verifications": [
      {
        "dorItemId": "dd0e8400-e29b-41d4-a716-446655440001",
        "isVerified": true,
        "notes": "Acceptance criteria clearly defined"
      },
      {
        "dorItemId": "dd0e8400-e29b-41d4-a716-446655440002",
        "isVerified": true,
        "notes": "Dependencies identified and resolved"
      }
    ]
  }'
```

---

### Get DoR Verifications

Get all Definition of Ready verifications for a product backlog item.

**Endpoint**

```
GET /api/v1/product-backlog/:id/dor-verifications
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Product backlog item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "verifications": [
      {
        "id": "cc0e8400-e29b-41d4-a716-446655440001",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dorItemId": "dd0e8400-e29b-41d4-a716-446655440001",
        "dorItem": {
          "id": "dd0e8400-e29b-41d4-a716-446655440001",
          "title": "Acceptance criteria defined",
          "description": "Clear and testable acceptance criteria must be documented"
        },
        "isVerified": true,
        "notes": "Acceptance criteria clearly defined",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T18:00:00.000Z"
      },
      {
        "id": "cc0e8400-e29b-41d4-a716-446655440002",
        "pbiId": "880e8400-e29b-41d4-a716-446655440000",
        "dorItemId": "dd0e8400-e29b-41d4-a716-446655440002",
        "dorItem": {
          "id": "dd0e8400-e29b-41d4-a716-446655440002",
          "title": "Dependencies identified",
          "description": "All dependencies on other items or teams must be identified"
        },
        "isVerified": true,
        "notes": "Dependencies identified and resolved",
        "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
        "verifiedAt": "2026-04-29T18:00:00.000Z"
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
    "message": "Product backlog item not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/product-backlog/880e8400-e29b-41d4-a716-446655440000/dor-verifications \
  -b cookies.txt
```

---

## Error Codes

| Code                                    | HTTP Status | Description                                                                    |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`                      | 400         | Request validation failed                                                      |
| `BAD_REQUEST`                           | 400         | The request is well-formed but refused (e.g. an incomplete reorder)            |
| `AUTHENTICATION_ERROR`                  | 401         | Authentication required                                                        |
| `AUTHORIZATION_ERROR`                   | 403         | Insufficient permissions                                                       |
| `NOT_FOUND`                             | 404         | Product backlog item not found                                                 |
| `CONFLICT`                              | 409         | Resource conflict                                                              |
| `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER` | 403         | Only the Product Owner orders the backlog (position and MoSCoW band)           |
| `GATE_PBI_NOT_READY`                    | 400         | A Product Backlog item must be `READY` before it can enter a Sprint            |
| `GATE_DEVELOPER_ONLY_SIZING`            | 403         | Only Developers set story points                                               |
| `GATE_DOD_REQUIRED`                     | 400         | The team must keep at least one active DoD item before work can be marked Done |
| `GATE_DOD_NOT_VERIFIED`                 | 400         | An item cannot be marked Done until every active DoD item is verified for it   |
| `GATE_DOD_TEAM_MEMBERS_ONLY`            | 403         | Reading or changing a team's DoD, or verifying against it, requires membership |

The `GATE_*` codes are the Scrum Guide gates described in [Authorization Model](#authorization-model); the complete, canonical list lives in [Gate Rejections](./README.md#gate-rejections).

## Best Practices

### Backlog Management

1. **Regular Refinement**: Schedule regular backlog refinement sessions to keep items up to date
2. **Clear Acceptance Criteria**: Define testable acceptance criteria for every PBI
3. **Story Points**: Estimate story points during refinement, not during sprint planning
4. **MoSCoW Prioritization**: Use MoSCoW to communicate priority clearly to stakeholders
5. **Order, don't just band**: Keep the top of the backlog ordered with `POST /product-backlog/reorder` so the Developers know what to pull next — a Must Have band is a category, not a position

### Definition of Done/Ready

1. **Refine to READY before pulling an item in**: an item that is not `READY` is refused at Sprint Planning, when the Sprint starts, and when it is added mid-Sprint
2. **DoD Before Closing**: Verify Definition of Done before marking items as complete
3. **Document Notes**: Add notes to verifications for audit and context
4. **Team Agreement**: DoD and DoR should be agreed upon by the entire team

### Security

1. **Access Control**: Any team member creates, edits and deletes PBIs; the Product Owner owns the order and the MoSCoW band; the Developers own the estimate
2. **Audit Trail**: All backlog changes are logged with user and timestamp
3. **Team Isolation**: Backlog items are scoped to teams and cannot be accessed cross-team

---

**Last Updated**: 2026-09-21

**Related Documentation**

- [Authentication API](./authentication.md)
- [Product Goals API](./product-goals.md)
- [Teams API](./teams.md)
- [Definition of Done API](./definition-of-done.md)
- [Definition of Ready API](./definition-of-ready.md)
