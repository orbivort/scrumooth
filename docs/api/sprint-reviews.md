# Sprint Reviews API

Complete Sprint Reviews API reference for sprint review management, stakeholder feedback, backlog adjustments, and attendee tracking.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Get Sprint Reviews](#get-sprint-reviews)
  - [Get Pending Adjustments](#get-pending-adjustments)
  - [Implement Adjustment](#implement-adjustment)
  - [Get Pending Feedback](#get-pending-feedback)
  - [Address Feedback](#address-feedback)
  - [Get Review by ID](#get-review-by-id)
  - [Create Sprint Review](#create-sprint-review)
  - [Update Sprint Review](#update-sprint-review)
  - [Add Stakeholder Feedback](#add-stakeholder-feedback)
  - [Add Attendee](#add-attendee)
  - [Update Attendee](#update-attendee)
  - [Delete Attendee](#delete-attendee)
  - [Delete Review](#delete-review)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Sprint Reviews API provides comprehensive sprint review management capabilities including:

- Sprint review creation and lifecycle management
- Stakeholder feedback collection and tracking
- Backlog adjustment management and implementation tracking
- Attendee management with role-based tracking
- Review status workflow (in_progress / completed)

## Authentication

All sprint review endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Endpoints

### Get Sprint Reviews

Get sprint reviews for a team, optionally filtered by sprint.

**Endpoint**

```
GET /api/v1/sprint-reviews
```

**Authentication**

- Required

**Query Parameters**

- `teamId` (string, required): Team UUID
- `sprintId` (string, optional): Sprint UUID to filter reviews

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "sprintId": "550e8400-e29b-41d4-a716-446655440001",
        "teamId": "550e8400-e29b-41d4-a716-446655440002",
        "incrementId": "550e8400-e29b-41d4-a716-446655440003",
        "reviewDate": "2026-04-29T12:00:00.000Z",
        "summary": "Sprint 5 review completed successfully",
        "status": "completed",
        "createdAt": "2026-04-29T12:00:00.000Z",
        "updatedAt": "2026-04-29T12:00:00.000Z"
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
        "message": "teamId is required"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/sprint-reviews?teamId=550e8400-e29b-41d4-a716-446655440002" \
  -b cookies.txt
```

---

### Get Pending Adjustments

Get backlog adjustments that have not yet been implemented for a team.

**Endpoint**

```
GET /api/v1/sprint-reviews/adjustments/pending
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
    "adjustments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "action": "add",
        "description": "Add new login feature to backlog",
        "reason": "Stakeholder requested during sprint review",
        "pbiId": null,
        "implemented": false,
        "ownerId": "550e8400-e29b-41d4-a716-446655440005",
        "reviewId": "550e8400-e29b-41d4-a716-446655440000"
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
        "message": "teamId is required"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/sprint-reviews/adjustments/pending?teamId=550e8400-e29b-41d4-a716-446655440002" \
  -b cookies.txt
```

---

### Implement Adjustment

Mark a backlog adjustment as implemented.

**Endpoint**

```
PUT /api/v1/sprint-reviews/adjustments/:id/implement
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Adjustment UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "adjustment": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "action": "add",
      "description": "Add new login feature to backlog",
      "reason": "Stakeholder requested during sprint review",
      "pbiId": "550e8400-e29b-41d4-a716-446655440020",
      "implemented": true,
      "ownerId": "550e8400-e29b-41d4-a716-446655440005",
      "reviewId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Adjustment Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Adjustment not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/sprint-reviews/adjustments/550e8400-e29b-41d4-a716-446655440010/implement \
  -b cookies.txt
```

The manual flag is for adjustments whose outcome is not a backlog item (a reorder, or a removal already performed). An adjustment that has produced an item is returned unchanged: its `createdPbiId` is the evidence, and the flag must not contradict it.

---

### Materialize Adjustment

Create a new Product Backlog item from a Review adjustment, link it, and mark the adjustment implemented. This is what makes "the Product Backlog may also be adjusted" provable: the created item is recorded on the adjustment as `createdPbiId`.

**Endpoint**

```
POST /api/v1/sprint-reviews/adjustments/:id/materialize
```

**Authentication**

- Required — the caller must be a member of the team that owns the Review

**Path Parameters**

- `id` (string, required): Adjustment UUID

**Request Body** (all fields optional; they override the derived defaults)

| Field                | Type   | Description                                                  |
| -------------------- | ------ | ------------------------------------------------------------ |
| `title`              | string | Item title. Defaults to the adjustment description.          |
| `description`        | string | Item description. Defaults to `Reason: <adjustment reason>`. |
| `storyPoints`        | number | Estimate. Only Developers on the team may size an item.      |
| `acceptanceCriteria` | string | Acceptance criteria for the new item.                        |

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "adjustment": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "createdPbiId": "550e8400-e29b-41d4-a716-446655440030",
      "implemented": true
    },
    "pbi": {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "title": "Add new login feature to backlog",
      "status": "NEW",
      "priority": "COULD_HAVE"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Already Materialized**

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "This adjustment has already produced a backlog item"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/sprint-reviews/adjustments/550e8400-e29b-41d4-a716-446655440010/materialize \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "title": "Add new login feature" }'
```

---

### Link Adjustment to Backlog Item

Record an existing Product Backlog item as the outcome of a Review adjustment (for a `modify`, `remove`, `reorder`, or `split` that was carried out against a real item). The item must belong to the same team as the Review.

**Endpoint**

```
PUT /api/v1/sprint-reviews/adjustments/:id/link
```

**Authentication**

- Required — the caller must be a member of the team that owns the Review

**Path Parameters**

- `id` (string, required): Adjustment UUID

**Request Body**

| Field   | Type   | Required | Description               |
| ------- | ------ | -------- | ------------------------- |
| `pbiId` | string | Yes      | Product Backlog item UUID |

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "createdPbiId": "550e8400-e29b-41d4-a716-446655440020",
    "implemented": true,
    "createdPbi": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "title": "Checkout - retry",
      "status": "READY"
    }
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/sprint-reviews/adjustments/550e8400-e29b-41d4-a716-446655440010/link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "pbiId": "550e8400-e29b-41d4-a716-446655440020" }'
```

---

### Get Pending Feedback

Get stakeholder feedback that has not yet been addressed for a team.

**Endpoint**

```
GET /api/v1/sprint-reviews/feedback/pending
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
    "feedback": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "authorName": "Alice Johnson",
        "content": "The dashboard loading time needs improvement",
        "category": "negative",
        "relatedPbiId": "550e8400-e29b-41d4-a716-446655440021",
        "actionRequired": true,
        "actionTaken": null,
        "ownerId": "550e8400-e29b-41d4-a716-446655440005",
        "reviewId": "550e8400-e29b-41d4-a716-446655440000"
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
        "message": "teamId is required"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/sprint-reviews/feedback/pending?teamId=550e8400-e29b-41d4-a716-446655440002" \
  -b cookies.txt
```

---

### Address Feedback

Mark stakeholder feedback as addressed.

**Endpoint**

```
PUT /api/v1/sprint-reviews/feedback/:id/address
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Feedback UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "feedback": {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "authorName": "Alice Johnson",
      "content": "The dashboard loading time needs improvement",
      "category": "negative",
      "relatedPbiId": "550e8400-e29b-41d4-a716-446655440021",
      "actionRequired": true,
      "actionTaken": "Optimized dashboard queries and added caching",
      "ownerId": "550e8400-e29b-41d4-a716-446655440005",
      "reviewId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```

**Error Responses**

**404 Not Found - Feedback Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Feedback not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/sprint-reviews/feedback/550e8400-e29b-41d4-a716-446655440030/address \
  -b cookies.txt
```

---

### Get Review by ID

Get detailed information about a specific sprint review.

**Endpoint**

```
GET /api/v1/sprint-reviews/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Sprint Review UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "review": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "incrementId": "550e8400-e29b-41d4-a716-446655440003",
      "reviewDate": "2026-04-29T12:00:00.000Z",
      "summary": "Sprint 5 review completed successfully",
      "status": "completed",
      "attendees": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440040",
          "name": "John Doe",
          "email": "john@example.com",
          "role": "product_owner",
          "attended": true
        }
      ],
      "feedback": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440030",
          "authorName": "Alice Johnson",
          "content": "Great progress on the dashboard",
          "category": "positive",
          "relatedPbiId": null,
          "actionRequired": false,
          "actionTaken": null,
          "ownerId": null
        }
      ],
      "backlogAdjustments": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440010",
          "action": "add",
          "description": "Add new login feature to backlog",
          "reason": "Stakeholder requested during sprint review",
          "pbiId": null,
          "implemented": false,
          "ownerId": "550e8400-e29b-41d4-a716-446655440005"
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
    "message": "Sprint review not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/sprint-reviews/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Create Sprint Review

Create a new sprint review.

**Endpoint**

```
POST /api/v1/sprint-reviews
```

**Authentication**

- Required

**Request Body**

```json
{
  "sprintId": "string (required, UUID)",
  "teamId": "string (required, UUID)",
  "incrementId": "string (optional, UUID)",
  "reviewDate": "string (required, valid ISO 8601 date)",
  "summary": "string (optional, max 2000 chars)",
  "sprintGoalOutcome": "string (optional, one of: ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED)",
  "sprintGoalNote": "string (optional, max 2000 chars)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "review": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "incrementId": "550e8400-e29b-41d4-a716-446655440003",
      "reviewDate": "2026-04-29T12:00:00.000Z",
      "summary": "Sprint 5 review completed successfully",
      "status": "in_progress",
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

**409 Conflict - Review Already Exists**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "A sprint review already exists for this sprint"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/sprint-reviews \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "sprintId": "550e8400-e29b-41d4-a716-446655440001",
    "teamId": "550e8400-e29b-41d4-a716-446655440002",
    "reviewDate": "2026-04-29T12:00:00.000Z",
    "summary": "Sprint 5 review"
  }'
```

---

### Update Sprint Review

Update an existing sprint review including attendees, feedback, and backlog adjustments.

**Endpoint**

```
PUT /api/v1/sprint-reviews/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Sprint Review UUID

**Request Body**

```json
{
  "summary": "string (optional, max 2000 chars)",
  "status": "string (optional, one of: in_progress, completed)",
  "sprintGoalOutcome": "string (optional, one of: ACHIEVED, PARTIALLY_ACHIEVED, NOT_ACHIEVED)",
  "sprintGoalNote": "string (optional, max 2000 chars)",
  "reviewDate": "string (optional, valid ISO 8601 date)",
  "attendees": [
    {
      "name": "string (required)",
      "email": "string (optional, valid email or empty)",
      "role": "string (required)",
      "attended": "boolean (required)"
    }
  ],
  "feedback": [
    {
      "id": "string (optional, UUID for existing)",
      "authorName": "string (required)",
      "content": "string (required)",
      "category": "string (optional, one of: positive, negative, suggestion, question)",
      "relatedPbiId": "string (optional, UUID)",
      "actionRequired": "boolean (optional)",
      "actionTaken": "string (optional)",
      "ownerId": "string (optional, UUID)"
    }
  ],
  "backlogAdjustments": [
    {
      "id": "string (optional, UUID for existing)",
      "action": "string (required, one of: add, modify, remove, reorder, split)",
      "description": "string (required)",
      "reason": "string (required)",
      "pbiId": "string (optional, UUID)",
      "implemented": "boolean (optional)",
      "ownerId": "string (optional, UUID)"
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
    "review": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "incrementId": "550e8400-e29b-41d4-a716-446655440003",
      "reviewDate": "2026-04-29T12:00:00.000Z",
      "summary": "Updated sprint review summary",
      "status": "completed",
      "sprintGoal": "Ship the review workflow",
      "sprintGoalOutcome": "PARTIALLY_ACHIEVED",
      "sprintGoalNote": "The backlog adjustments slipped into the next Sprint.",
      "updatedAt": "2026-04-29T13:00:00.000Z"
    }
  }
}
```

**The Sprint Goal verdict**

`SprintReview.sprintGoalOutcome` is the Scrum Team's own judgement on whether the Sprint Goal was
met, recorded at the event:

- it is **required** when a Review is completed for a Sprint that has a Sprint Goal, because "the
  Scrum Team discusses ... progress toward the Sprint Goal" -- concluding the event without the
  team's verdict would leave the tool to infer attainment from item completion. Refused with
  `GATE_SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED` (400).
- it is **refused** for a Sprint with no Sprint Goal, since a verdict about nothing would let an
  unassessed Sprint read as assessed -- `GATE_SPRINT_REVIEW_GOAL_OUTCOME_NOT_APPLICABLE` (400).
- the Goal the verdict judged is copied into `SprintReview.sprintGoal` so a later renegotiation
  cannot make the record appear to have assessed a goal it never saw.

A Review completed before the verdict existed simply has none, and is reported as unassessed rather
than as unmet.

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
        "field": "status",
        "message": "Status must be one of: in_progress, completed"
      }
    ]
  }
}
```

**400 Bad Request - Sprint Goal verdict required**

```json
{
  "success": false,
  "error": {
    "code": "GATE_SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED",
    "message": "The Sprint Review is where the team discusses progress toward the Sprint Goal, so completing this Review requires the team's own verdict on it: achieved, partially achieved, or not achieved."
  }
}
```

````

**404 Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint review not found"
  }
}
````

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/sprint-reviews/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "summary": "Updated sprint review summary",
    "status": "completed"
  }'
```

---

### Add Stakeholder Feedback

Add stakeholder feedback to a sprint review.

**Endpoint**

```
POST /api/v1/sprint-reviews/:id/feedback
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Sprint Review UUID

**Request Body**

```json
{
  "authorName": "string (required)",
  "content": "string (required)",
  "category": "string (optional, one of: positive, negative, suggestion, question, default: positive)",
  "relatedPbiId": "string (optional, UUID)",
  "actionRequired": "boolean (optional, default: false)",
  "ownerId": "string (optional, UUID)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "feedback": {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "authorName": "Alice Johnson",
      "content": "The new dashboard feature is very useful",
      "category": "positive",
      "relatedPbiId": null,
      "actionRequired": false,
      "actionTaken": null,
      "ownerId": null,
      "reviewId": "550e8400-e29b-41d4-a716-446655440000"
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
        "field": "authorName",
        "message": "authorName is required"
      }
    ]
  }
}
```

**404 Not Found - Review Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint review not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/sprint-reviews/550e8400-e29b-41d4-a716-446655440000/feedback \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "authorName": "Alice Johnson",
    "content": "The new dashboard feature is very useful",
    "category": "positive"
  }'
```

---

### Add Attendee

Add an attendee to a sprint review.

**Endpoint**

```
POST /api/v1/sprint-reviews/:reviewId/attendees
```

**Authentication**

- Required

**Path Parameters**

- `reviewId` (string, required): Sprint Review UUID

**Request Body**

```json
{
  "name": "string (required, 1-100 chars)",
  "email": "string (optional, valid email or empty)",
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
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "product_owner",
      "attended": true,
      "reviewId": "550e8400-e29b-41d4-a716-446655440000"
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

**404 Not Found - Review Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Sprint review not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/sprint-reviews/550e8400-e29b-41d4-a716-446655440000/attendees \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "role": "product_owner",
    "attended": true
  }'
```

---

### Update Attendee

Update an attendee's information for a sprint review.

**Endpoint**

```
PUT /api/v1/sprint-reviews/attendees/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Attendee UUID

**Request Body**

```json
{
  "name": "string (optional, 1-100 chars)",
  "email": "string (optional, valid email or empty)",
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
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "role": "stakeholder",
      "attended": true,
      "reviewId": "550e8400-e29b-41d4-a716-446655440000"
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
curl -X PUT https://api.example.com/api/v1/sprint-reviews/attendees/550e8400-e29b-41d4-a716-446655440040 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "role": "stakeholder",
    "email": "john.doe@example.com"
  }'
```

---

### Delete Attendee

Remove an attendee from a sprint review.

**Endpoint**

```
DELETE /api/v1/sprint-reviews/attendees/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Attendee UUID

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
curl -X DELETE https://api.example.com/api/v1/sprint-reviews/attendees/550e8400-e29b-41d4-a716-446655440040 \
  -b cookies.txt
```

---

### Delete Review

Delete a sprint review. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/sprint-reviews/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Sprint Review UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Sprint review deleted successfully"
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
    "message": "Sprint review not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/sprint-reviews/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

## Error Codes

| Code                   | HTTP Status | Description                                                |
| ---------------------- | ----------- | ---------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed                                  |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                    |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions                                   |
| `NOT_FOUND`            | 404         | Sprint review, feedback, adjustment, or attendee not found |
| `CONFLICT`             | 409         | Resource conflict (e.g., review already exists)            |

### Gate Rejections

A refusal that enforces a Scrum Guide rule carries a stable `GATE_*` code in `error.code`, so a client can branch on it without parsing the localized message. The full list lives in `docs/api/README.md`; the codes this module returns are:

| Code                                        | HTTP | Rule enforced                                                                                                                                                           |
| ------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATE_SPRINT_REVIEW_TEAM_MEMBERS_ONLY`      | 403  | The Sprint Review is the Scrum Team's own event: recording attendance, feedback, adjustments, or completing it requires membership                                      |
| `GATE_SPRINT_REVIEW_SM_NOTES_SM_ONLY`       | 403  | The Scrum Master's notes are coaching observations: only the team's Scrum Master may read or write them, and `smNotes` is omitted from every other caller's response    |
| `GATE_SPRINT_RETROSPECTIVE_REQUIRES_REVIEW` | 400  | The Retrospective cannot complete before its Sprint Review is completed                                                                                                 |
| `GATE_SPRINT_EVENT_BEFORE_END_DATE`         | 400  | The Review and the Retrospective cannot be completed before the day the Sprint's end date names; a Sprint that has already concluded (cancelled or completed) is exempt |

## Best Practices

### Sprint Review Management

1. **Timely Creation**: Create sprint reviews promptly after the sprint review meeting
2. **Comprehensive Feedback**: Encourage all stakeholders to provide feedback during the review
3. **Action Tracking**: Track all backlog adjustments and ensure they are implemented
4. **Attendance Records**: Maintain accurate attendee records for accountability

### Feedback Handling

1. **Categorization**: Properly categorize feedback (positive, negative, suggestion, question)
2. **Action Items**: Mark feedback as action-required when follow-up is needed
3. **Timely Addressing**: Address pending feedback promptly to maintain stakeholder trust
4. **Link to PBIs**: Associate feedback with relevant product backlog items when applicable

### Backlog Adjustments

1. **Clear Descriptions**: Provide clear descriptions and reasons for all backlog adjustments
2. **Implementation Tracking**: Mark adjustments as implemented once the changes are applied
3. **Ownership**: Assign owners to adjustments to ensure accountability
4. **Prioritization**: Review and prioritize adjustments from sprint reviews in backlog grooming

---

**Last Updated**: 2026-05-10

## Scrum Master notes and their revision history

The Scrum Master's notes on a Review (`smNotes`) are coaching observations about the event, not a
shared field:

- **Read:** `smNotes` is omitted from every response to a caller who is not the team's Scrum Master.
  Hiding the editor was never a gate; withholding the value is.
- **Write:** `PATCH /sprint-reviews/:id/sm-notes` refuses anyone else with
  `GATE_SPRINT_REVIEW_SM_NOTES_SM_ONLY`.
- **History:** `GET /sprint-reviews/:id/sm-notes/revisions?limit=20&offset=0` returns the trail,
  newest first: `{ revisions: [{ revision, content, authorName, createdAt }], total, limit, offset }`.
  Every real edit appends a revision in the same transaction as the update, so a note and its history
  cannot diverge; a write whose text is unchanged appends nothing. `limit` is capped at 100.

Reading the trail is reading the notes, so the same rule applies to it.

**Related Documentation**

- [Authentication API](./authentication.md)
- [Sprints API](./sprints.md)
- [Product Backlog API](./product-backlog.md)
- [Retrospectives API](./retrospectives.md)
