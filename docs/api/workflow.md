# Workflow API

Complete Workflow API reference for status transition management, workflow configuration, and state machine operations.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Workflow Entity Types](#workflow-entity-types)
- [Endpoints](#endpoints)
  - [Validate Transition](#validate-transition)
  - [Execute Status Change](#execute-status-change)
  - [Create Workflow (Admin)](#create-workflow-admin)
  - [Add Workflow State (Admin)](#add-workflow-state-admin)
  - [Add Workflow Transition (Admin)](#add-workflow-transition-admin)
  - [Get Status Change History](#get-status-change-history)
  - [Get Allowed Transitions](#get-allowed-transitions)
  - [Get Workflow States](#get-workflow-states)
  - [Get Workflow Transitions](#get-workflow-transitions)
  - [Get Workflow by Entity Type](#get-workflow-by-entity-type)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Workflow API provides a configurable state machine engine for managing entity status transitions across the Scrumooth platform. Capabilities include:

- Transition validation before execution
- Status change execution with audit trail
- Workflow configuration for administrators
- State and transition introspection
- Full status change history tracking

## Authentication

All workflow endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

**Admin Endpoints**: The three `/admin/*` endpoints additionally require the `admin` role via `requireRoles('admin')`.

## Workflow Entity Types

The workflow engine manages status transitions for the following entity types:

| Entity Type          | Key                    | Common States                          |
| -------------------- | ---------------------- | -------------------------------------- |
| Product Goal         | `product_goal`         | NEW, ACTIVE, COMPLETED, ABANDONED      |
| Product Backlog Item | `product_backlog_item` | NEW, REFINED, READY, IN_PROGRESS, DONE |
| Sprint               | `sprint`               | PLANNING, ACTIVE, COMPLETED, CANCELLED |
| Task                 | `task`                 | TODO, IN_PROGRESS, DONE                |
| Increment            | `increment`            | DRAFT, VERIFIED, DELIVERED, ARCHIVED   |

## Endpoints

### Validate Transition

Validate whether a status transition is allowed without executing it. Useful for UI state management and pre-flight checks.

**Endpoint**

```
POST /api/v1/workflows/validate
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "entityType": "string (required)",
  "entityId": "string (UUID, required)",
  "fromStatus": "string (required)",
  "toStatus": "string (required)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "valid": true,
    "allowedTransitions": [
      "IN_PROGRESS",
      "DONE"
    ]
  }
}
```

**Error Responses**

**400 Bad Request - Invalid Transition**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "allowedTransitions": ["IN_PROGRESS", "DONE"]
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/workflows/validate \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityType": "product_backlog_item",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "fromStatus": "NEW",
    "toStatus": "REFINED"
  }'
```

---

### Execute Status Change

Execute a status transition for an entity. This records the change in the audit history.

**Endpoint**

```
POST /api/v1/workflows/status-change
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "entityType": "string (required)",
  "entityId": "string (UUID, required)",
  "newStatus": "string (required)",
  "reason": "string (optional)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "transition": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "entityType": "product_backlog_item",
      "entityId": "550e8400-e29b-41d4-a716-446655440000",
      "fromStatus": "NEW",
      "toStatus": "REFINED",
      "changedBy": "550e8400-e29b-41d4-a716-446655440005",
      "changedAt": "2026-04-29T14:00:00.000Z",
      "reason": "Backlog refinement completed"
    }
  }
}
```

**Error Responses**

**403 Forbidden - Transition Not Allowed**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Transition from DONE to NEW is not allowed"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/workflows/status-change \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityType": "product_backlog_item",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "newStatus": "REFINED",
    "reason": "Backlog refinement completed"
  }'
```

---

### Create Workflow (Admin)

Create a new workflow configuration for an entity type. Requires administrator role.

**Endpoint**

```
POST /api/v1/workflows/admin/create
```

**Authentication**

- Required
- Product Owner role required

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "entityType": "string (required)",
  "name": "string (required)",
  "description": "string (optional)",
  "states": [
    {
      "name": "string (required)",
      "description": "string (optional)",
      "order": "number (required)"
    }
  ],
  "transitions": [
    {
      "fromState": "string (required)",
      "toState": "string (required)",
      "requiredRole": "string (optional)"
    }
  ]
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "workflow": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "entityType": "custom_entity",
      "name": "Custom Approval Workflow",
      "description": "Multi-step approval process",
      "states": [
        { "name": "SUBMITTED", "order": 1 },
        { "name": "UNDER_REVIEW", "order": 2 },
        { "name": "APPROVED", "order": 3 },
        { "name": "REJECTED", "order": 4 }
      ],
      "transitions": [
        { "fromState": "SUBMITTED", "toState": "UNDER_REVIEW" },
        { "fromState": "UNDER_REVIEW", "toState": "APPROVED" },
        { "fromState": "UNDER_REVIEW", "toState": "REJECTED" }
      ],
      "createdAt": "2026-04-29T12:00:00.000Z"
    }
  }
}
```

**Error Responses**

**403 Forbidden - Not Admin**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Product Owner role required"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/workflows/admin/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityType": "custom_entity",
    "name": "Custom Approval Workflow",
    "states": [
      { "name": "SUBMITTED", "order": 1 },
      { "name": "APPROVED", "order": 2 }
    ],
    "transitions": [
      { "fromState": "SUBMITTED", "toState": "APPROVED" }
    ]
  }'
```

---

### Add Workflow State (Admin)

Add a new state to an existing workflow. Requires administrator role.

**Endpoint**

```
POST /api/v1/workflows/admin/states
```

**Authentication**

- Required
- Product Owner role required

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "workflowId": "string (UUID, required)",
  "name": "string (required)",
  "description": "string (optional)",
  "order": "number (required)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "state": {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "workflowId": "550e8400-e29b-41d4-a716-446655440020",
      "name": "IN_REVIEW",
      "description": "Item is being reviewed",
      "order": 3,
      "createdAt": "2026-04-29T12:00:00.000Z"
    }
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/workflows/admin/states \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "workflowId": "550e8400-e29b-41d4-a716-446655440020",
    "name": "IN_REVIEW",
    "description": "Item is being reviewed",
    "order": 3
  }'
```

---

### Add Workflow Transition (Admin)

Add a new transition rule to an existing workflow. Requires administrator role.

**Endpoint**

```
POST /api/v1/workflows/admin/transitions
```

**Authentication**

- Required
- Product Owner role required

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "workflowId": "string (UUID, required)",
  "fromState": "string (required)",
  "toState": "string (required)",
  "requiredRole": "string (optional)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "transition": {
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "workflowId": "550e8400-e29b-41d4-a716-446655440020",
      "fromState": "SUBMITTED",
      "toState": "IN_REVIEW",
      "requiredRole": null,
      "createdAt": "2026-04-29T12:00:00.000Z"
    }
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/workflows/admin/transitions \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "workflowId": "550e8400-e29b-41d4-a716-446655440020",
    "fromState": "SUBMITTED",
    "toState": "IN_REVIEW"
  }'
```

---

### Get Status Change History

Get the full status change history for a specific entity.

**Endpoint**

```
GET /api/v1/workflows/:entityType/:entityId/history
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `entityType` (string, required): The entity type (e.g., `product_backlog_item`)
- `entityId` (string, required): The entity UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "history": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "entityType": "product_backlog_item",
        "entityId": "550e8400-e29b-41d4-a716-446655440000",
        "fromStatus": "NEW",
        "toStatus": "REFINED",
        "changedBy": "550e8400-e29b-41d4-a716-446655440005",
        "changedAt": "2026-04-29T14:00:00.000Z",
        "reason": "Backlog refinement completed"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "entityType": "product_backlog_item",
        "entityId": "550e8400-e29b-41d4-a716-446655440000",
        "fromStatus": "REFINED",
        "toStatus": "READY",
        "changedBy": "550e8400-e29b-41d4-a716-446655440005",
        "changedAt": "2026-04-30T10:00:00.000Z",
        "reason": null
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/workflows/product_backlog_item/550e8400-e29b-41d4-a716-446655440000/history" \
  -b cookies.txt
```

---

### Get Allowed Transitions

Get all allowed transitions from a given status for an entity type.

**Endpoint**

```
GET /api/v1/workflows/:entityType/allowed-transitions/:fromStatus
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `entityType` (string, required): The entity type
- `fromStatus` (string, required): The current status

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "transitions": [
      {
        "fromStatus": "NEW",
        "toStatus": "REFINED",
        "requiredRole": null
      },
      {
        "fromStatus": "NEW",
        "toStatus": "DONE",
        "requiredRole": "admin"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/workflows/product_backlog_item/allowed-transitions/NEW" \
  -b cookies.txt
```

---

### Get Workflow States

Get all defined states for an entity type's workflow.

**Endpoint**

```
GET /api/v1/workflows/:entityType/states
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `entityType` (string, required): The entity type

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "states": [
      { "name": "NEW", "description": "Newly created item", "order": 1 },
      { "name": "REFINED", "description": "Refined and estimated", "order": 2 },
      { "name": "READY", "description": "Ready for sprint", "order": 3 },
      { "name": "IN_PROGRESS", "description": "Currently being worked on", "order": 4 },
      { "name": "DONE", "description": "Completed", "order": 5 }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/workflows/product_backlog_item/states" \
  -b cookies.txt
```

---

### Get Workflow Transitions

Get all defined transitions for an entity type's workflow.

**Endpoint**

```
GET /api/v1/workflows/:entityType/transitions
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `entityType` (string, required): The entity type

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "transitions": [
      { "fromState": "NEW", "toState": "REFINED", "requiredRole": null },
      { "fromState": "REFINED", "toState": "READY", "requiredRole": null },
      { "fromState": "READY", "toState": "IN_PROGRESS", "requiredRole": null },
      { "fromState": "IN_PROGRESS", "toState": "DONE", "requiredRole": null },
      { "fromState": "IN_PROGRESS", "toState": "READY", "requiredRole": null }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/workflows/product_backlog_item/transitions" \
  -b cookies.txt
```

---

### Get Workflow by Entity Type

Get the complete workflow configuration for an entity type, including all states and transitions.

**Endpoint**

```
GET /api/v1/workflows/:entityType
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `entityType` (string, required): The entity type

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "workflow": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "entityType": "product_backlog_item",
      "name": "Product Backlog Item Workflow",
      "states": [
        { "name": "NEW", "description": "Newly created item", "order": 1 },
        { "name": "REFINED", "description": "Refined and estimated", "order": 2 },
        { "name": "READY", "description": "Ready for sprint", "order": 3 },
        { "name": "IN_PROGRESS", "description": "Currently being worked on", "order": 4 },
        { "name": "DONE", "description": "Completed", "order": 5 }
      ],
      "transitions": [
        { "fromState": "NEW", "toState": "REFINED", "requiredRole": null },
        { "fromState": "REFINED", "toState": "READY", "requiredRole": null },
        { "fromState": "READY", "toState": "IN_PROGRESS", "requiredRole": null },
        { "fromState": "IN_PROGRESS", "toState": "DONE", "requiredRole": null }
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
    "message": "Workflow not found for entity type: unknown_entity"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/workflows/product_backlog_item" \
  -b cookies.txt
```

---

## Error Codes

| Code                   | HTTP Status | Description                                                        |
| ---------------------- | ----------- | ------------------------------------------------------------------ |
| `VALIDATION_ERROR`     | 400         | Request validation failed                                          |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                            |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions (admin role required for admin endpoints) |
| `NOT_FOUND`            | 404         | Workflow or entity not found                                       |
| `CONFLICT`             | 409         | Transition not allowed or workflow already exists                  |

## Best Practices

### Transition Management

1. **Validate Before Executing**: Always call `/validate` before `/status-change` to provide clear feedback to users
2. **Provide Reasons**: Include a reason for status changes to maintain a clear audit trail
3. **Check Allowed Transitions**: Use `/allowed-transitions` to dynamically render UI state options
4. **Cache Workflow Config**: Cache the results of `/states` and `/transitions` as they rarely change

### Admin Configuration

1. **Plan Before Creating**: Design your state machine on paper before creating workflows via the API
2. **Set Required Roles**: Use `requiredRole` on transitions to enforce role-based state changes
3. **Test Thoroughly**: Use `/validate` to test all transitions after configuration changes
4. **Document Custom Workflows**: Maintain external documentation for any custom workflow configurations

### Performance

1. **Batch History Requests**: History endpoints can return large datasets; consider pagination for entities with many transitions
2. **Use Specific Endpoints**: Prefer `/states` or `/transitions` over the full `/workflow` endpoint when you only need one
3. **Minimize Admin Calls**: Admin endpoints are rate-limited the same as user endpoints; batch configuration changes when possible

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Product Goals API](./product-goals.md)
- [Product Backlog API](./product-backlog.md)
- [Sprints API](./sprints.md)
- [Increments API](./increments.md)
- [API Specifications](../architecture/api-specifications.md)
