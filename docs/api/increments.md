# Increments API

Complete Increments API reference for product increment management, delivery tracking, and metrics.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Increment Statuses](#increment-statuses)
- [Endpoints](#endpoints)
  - [Get Increments](#get-increments)
  - [Get Increment Metrics](#get-increment-metrics)
  - [Get Increment by ID](#get-increment-by-id)
  - [Create Increment](#create-increment)
  - [Update Increment](#update-increment)
  - [Deliver Increment](#deliver-increment)
  - [Verify Usability](#verify-usability)
  - [Reconcile Sprint Increment](#reconcile-sprint-increment)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Increments API provides comprehensive product increment management capabilities including:

- Increment creation and configuration
- PBI association and story point tracking
- Increment delivery workflow
- Delivery metrics and analytics
- Status lifecycle management

## Authentication

All increment endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Increment Statuses

Increments follow a defined lifecycle from draft through delivery:

```
DRAFT ──► VERIFIED ──► DELIVERED (terminal)
  │           │
  │           └──► Return to DRAFT
  └──► ARCHIVED (terminal)
```

| Status      | Description                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `DRAFT`     | Increment is being assembled; PBIs can be added or removed                                                            |
| `VERIFIED`  | The Increment's integration with every prior Increment has passed **and** its usable condition is attested in writing |
| `DELIVERED` | Increment has reached users; the delivery method, the moment, and the person who delivered it are recorded. Terminal  |
| `ARCHIVED`  | Increment is retained for historical reference. Terminal                                                              |

Three rules constrain the lifecycle, and all three are enforced server-side:

- **Creation always starts at `DRAFT`.** A create that declares a later status is refused, so the gates below are walked rather than skipped.
- **Both verifications are prerequisites.** `VERIFIED` and `DELIVERED` require the integration verification _and_ the usability attestation. Changing what an Increment contains clears both, because evidence about one set of work is not evidence about another; a `VERIFIED` Increment whose contents change returns to `DRAFT`.
- **`DELIVERED` is reachable only through the deliver action**, which records how the Increment reached users and who delivered it. Writing the status directly is refused.

## Authorization

An Increment belongs to its Scrum Team, so every endpoint below requires membership of the team that owns the Increment:

- Collection endpoints (`GET /api/v1/increments`, `GET /api/v1/increments/metrics`, `POST /api/v1/increments`, `POST /api/v1/increments/reconcile`) resolve the team from the `x-team-id` header, the request body, or the query string, and refuse a non-member with `403 GATE_INCREMENT_TEAM_MEMBERS_ONLY`.
- Endpoints addressing a single Increment resolve the owning team from the Increment itself and refuse with the same code.

The Definition of Done that the Increment's items are measured against is governed the same way: reading or changing it, recording a verification against a Product Backlog item, and reading the Sprint's DoD compliance report all require membership of the owning team (`403 GATE_DOD_TEAM_MEMBERS_ONLY`).

## Endpoints

### Get Increments

Get all increments for a team, optionally filtered by sprint.

**Endpoint**

```
GET /api/v1/increments
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Query Parameters**

- `teamId` (string, required): Team UUID to filter increments
- `sprintId` (string, optional): Sprint UUID to filter by specific sprint

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "increments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Sprint 5 Increment",
        "description": "User authentication and profile features",
        "sprintId": "550e8400-e29b-41d4-a716-446655440001",
        "teamId": "550e8400-e29b-41d4-a716-446655440002",
        "includedPBIs": [
          "550e8400-e29b-41d4-a716-446655440003",
          "550e8400-e29b-41d4-a716-446655440004"
        ],
        "totalStoryPoints": 21,
        "status": "DRAFT",
        "createdBy": "550e8400-e29b-41d4-a716-446655440005",
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
    "message": "teamId is required"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/increments?teamId=550e8400-e29b-41d4-a716-446655440002" \
  -b cookies.txt
```

---

### Get Increment Metrics

Get aggregated increment delivery metrics for a team.

**Endpoint**

```
GET /api/v1/increments/metrics
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
    "metrics": {
      "totalIncrements": 12,
      "deliveredIncrements": 10,
      "averageStoryPoints": 18.5,
      "deliveryRate": 0.83
    }
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/increments/metrics?teamId=550e8400-e29b-41d4-a716-446655440002" \
  -b cookies.txt
```

---

### Get Increment by ID

Get detailed information about a specific increment.

**Endpoint**

```
GET /api/v1/increments/:id
```

**Authentication**

- Required

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Increment UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "increment": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5 Increment",
      "description": "User authentication and profile features",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "includedPBIs": [
        "550e8400-e29b-41d4-a716-446655440003",
        "550e8400-e29b-41d4-a716-446655440004"
      ],
      "totalStoryPoints": 21,
      "status": "VERIFIED",
      "createdBy": "550e8400-e29b-41d4-a716-446655440005",
      "createdAt": "2026-04-29T12:00:00.000Z",
      "updatedAt": "2026-04-30T09:00:00.000Z"
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
    "message": "Increment not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/increments/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Create Increment

Create a new product increment associated with a sprint.

**Endpoint**

```
POST /api/v1/increments
```

**Authentication**

- Required
- Scrum Master role recommended

**Rate Limit**

- 100 requests per 15 minutes

**Request Body**

```json
{
  "name": "string (1-200 chars, required)",
  "description": "string (max 2000 chars, optional)",
  "sprintId": "string (UUID, required)",
  "teamId": "string (UUID, required)",
  "includedPBIs": ["string (UUID)"],
  "totalStoryPoints": "number (integer >= 0, optional; derived server-side)",
  "status": "DRAFT (only)",
  "createdBy": "string (UUID, optional)"
}
```

**Validation Rules**

- `name`: 1-200 characters, required
- `description`: Maximum 2000 characters, optional
- `sprintId`: Valid UUID, required; it must belong to the same team as `teamId`
- `teamId`: Valid UUID, required; the caller must be a member of it
- `includedPBIs`: Array of valid UUIDs, defaults to empty array; every item must belong to the team's Product Backlog
- `totalStoryPoints`: Accepted for compatibility but **derived server-side** from the items the Increment contains, so the reported figure cannot disagree with the contents
- `status`: `DRAFT` only. The team's first Increment is automatically marked integration-verified with the basis `FIRST_INCREMENT_EXEMPT`, because there is no prior Increment to test against

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "increment": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5 Increment",
      "description": "User authentication and profile features",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "includedPBIs": [
        "550e8400-e29b-41d4-a716-446655440003"
      ],
      "totalStoryPoints": 13,
      "status": "DRAFT",
      "createdBy": "550e8400-e29b-41d4-a716-446655440005",
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
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

**409 Conflict - Sprint Already Has Increment**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "An increment already exists for this sprint"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/increments \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Sprint 5 Increment",
    "description": "User authentication and profile features",
    "sprintId": "550e8400-e29b-41d4-a716-446655440001",
    "teamId": "550e8400-e29b-41d4-a716-446655440002",
    "includedPBIs": [
      "550e8400-e29b-41d4-a716-446655440003"
    ],
    "totalStoryPoints": 13
  }'
```

---

### Update Increment

Update an existing increment's details, PBIs, or status.

**Endpoint**

```
PUT /api/v1/increments/:id
```

**Authentication**

- Required
- Scrum Master role recommended

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Increment UUID

**Request Body**

```json
{
  "name": "string (1-200 chars, optional)",
  "description": "string (max 2000 chars, optional)",
  "includedPBIs": ["string (UUID)"],
  "totalStoryPoints": "number (integer >= 0, optional; derived server-side)",
  "status": "string (DRAFT|VERIFIED|DELIVERED|ARCHIVED, optional)"
}
```

**Validation Rules**

- Changing `includedPBIs` changes what the Increment contains, so it clears both the integration verification and the usability attestation. A `VERIFIED` Increment whose contents change returns to `DRAFT`.
- `status: "VERIFIED"` requires the integration verification and the usability attestation. In the same call that changes the contents it is refused, because the new contents are not yet covered.
- `status: "DELIVERED"` is refused with `GATE_INCREMENT_DELIVERY_METHOD_REQUIRED`: use the deliver endpoint, which records the method, the moment, and who delivered it.
- A `DELIVERED` or `ARCHIVED` Increment is terminal and cannot be updated at all (`GATE_INCREMENT_LOCKED`).

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "increment": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5 Increment - Updated",
      "description": "Updated description",
      "sprintId": "550e8400-e29b-41d4-a716-446655440001",
      "teamId": "550e8400-e29b-41d4-a716-446655440002",
      "includedPBIs": [
        "550e8400-e29b-41d4-a716-446655440003",
        "550e8400-e29b-41d4-a716-446655440004"
      ],
      "totalStoryPoints": 21,
      "status": "VERIFIED",
      "updatedAt": "2026-04-30T09:00:00.000Z"
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
    "message": "Increment not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/increments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Sprint 5 Increment - Updated",
    "status": "VERIFIED",
    "totalStoryPoints": 21
  }'
```

---

### Deliver Increment

Mark an increment as delivered, recording the delivery method and optional notes.

**Endpoint**

```
POST /api/v1/increments/:id/deliver
```

**Authentication**

- Required
- Scrum Master role recommended

**Rate Limit**

- 100 requests per 15 minutes

**Path Parameters**

- `id` (string, required): Increment UUID

**Request Body**

```json
{
  "deliveryMethod": "string (sprint_review|early_release, required)",
  "notes": "string (max 2000 chars, optional)"
}
```

**Validation Rules**

- `deliveryMethod`: Must be one of `sprint_review` or `early_release`, required
- `notes`: Maximum 2000 characters, optional

**Prerequisites**

Two gates must already hold, and each has its own refusal:

| Code                                               | HTTP | Missing                                                   |
| -------------------------------------------------- | ---- | --------------------------------------------------------- |
| `GATE_INCREMENT_INTEGRATION_VERIFICATION_REQUIRED` | 400  | The integration with every prior Increment has not passed |
| `GATE_INCREMENT_USABILITY_ATTESTATION_REQUIRED`    | 400  | The usable condition has not been attested in writing     |

Delivery is independent of the Sprint Review, so it is not refused because the Sprint is still running: `early_release` exists precisely so value can reach users before the Review.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "increment": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Sprint 5 Increment",
      "status": "DELIVERED",
      "updatedAt": "2026-04-30T14:00:00.000Z"
    },
    "delivery": {
      "incrementId": "550e8400-e29b-41d4-a716-446655440000",
      "deliveryMethod": "sprint_review",
      "notes": "Delivered during Sprint 5 review meeting",
      "deliveredAt": "2026-04-30T14:00:00.000Z"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Invalid Delivery Method**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid delivery method. Must be sprint_review or early_release"
  }
}
```

**409 Conflict - Already Delivered**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Increment has already been delivered"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/increments/550e8400-e29b-41d4-a716-446655440000/deliver \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "deliveryMethod": "sprint_review",
    "notes": "Delivered during Sprint 5 review meeting"
  }'
```

---

### Verify Usability

Record the written attestation that the Increment is **in usable condition** — the evidence a "usable" label cannot carry by itself. Required before the Increment can be marked `VERIFIED` or delivered.

**Endpoint**

```
POST /api/v1/increments/:id/verify-usability
```

**Path Parameters**

- `id` (string, required): Increment UUID

**Request Body**

```json
{
  "evidence": "string (1-2000 chars, required)"
}
```

**Validation Rules**

- `evidence`: Required and non-blank. Whitespace alone is refused (422): an attestation that says nothing would satisfy the gate without carrying a fact.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "DRAFT",
    "usabilityVerified": true,
    "usabilityEvidence": "Deployed to staging and exercised end to end by the Product Owner",
    "usabilityVerifiedAt": "2026-09-22T09:00:00.000Z",
    "usabilityVerifiedBy": "550e8400-e29b-41d4-a716-446655440005",
    "usabilityVerifier": { "id": "…", "firstName": "Ada", "lastName": "Lovelace" }
  }
}
```

**Error Responses**

| Code                               | HTTP | When                                                                |
| ---------------------------------- | ---- | ------------------------------------------------------------------- |
| `GATE_INCREMENT_LOCKED`            | 400  | The Increment is `DELIVERED` or `ARCHIVED`, so its record is closed |
| `GATE_INCREMENT_TEAM_MEMBERS_ONLY` | 403  | The caller is not a member of the team that owns the Increment      |
| `VALIDATION_ERROR`                 | 422  | `evidence` is missing or blank                                      |

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/increments/550e8400-e29b-41d4-a716-446655440000/verify-usability \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"evidence": "Deployed to staging and exercised end to end by the Product Owner"}'
```

---

### Reconcile Sprint Increment

Recompose a Sprint's open Increment from the Sprint's Done items. This is the repair path for a composition that was skipped (the item was not in an active Sprint, or no longer satisfies the active Definition of Done) or that failed when the item was marked Done.

**Endpoint**

```
POST /api/v1/increments/reconcile
```

**Request Body**

```json
{
  "teamId": "string (UUID, required)",
  "sprintId": "string (UUID, required)"
}
```

**Behaviour**

- Adds every Done item of the Sprint that the open Increment is missing and that still satisfies the team's active Definition of Done.
- **Never removes a link**, so it can be run repeatedly and cannot silently shrink an Increment that was already presented.
- Recomputes the Increment's story points from the items it now contains.
- Creates the Sprint's Increment if none is open (a `DRAFT` or `VERIFIED` Increment is open; a `DELIVERED` or `ARCHIVED` one is frozen).
- If the recomposition changes what the Increment contains, its integration verification and usability attestation are cleared, because they covered the previous composition.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "incrementId": "550e8400-e29b-41d4-a716-446655440000",
    "addedPbiIds": ["550e8400-e29b-41d4-a716-446655440003"],
    "skippedPbiIds": [],
    "totalStoryPoints": 13
  }
}
```

**Error Responses**

| Code                               | HTTP | When                                                        |
| ---------------------------------- | ---- | ----------------------------------------------------------- |
| `VALIDATION_ERROR`                 | 422  | A required identifier is missing or malformed               |
| `GATE_INCREMENT_TEAM_MEMBERS_ONLY` | 403  | The caller is not a member of the team that owns the Sprint |
| `NOT_FOUND`                        | 404  | The Sprint does not exist                                   |

---

## Error Codes

| Code                   | HTTP Status | Description                                                      |
| ---------------------- | ----------- | ---------------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400/422     | Request validation failed                                        |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                          |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions                                         |
| `NOT_FOUND`            | 404         | Increment not found                                              |
| `CONFLICT`             | 409         | Resource conflict (e.g., duplicate increment, already delivered) |

### Gate Rejections

A refusal that enforces a Scrum Guide rule carries a stable `GATE_*` code in `error.code`, so a client can branch on it without parsing the localized message. The full list lives in `docs/api/README.md`; the codes this module returns are:

| Code                                               | HTTP | Rule enforced                                                                    |
| -------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| `GATE_INCREMENT_LOCKED`                            | 400  | A delivered or archived Increment is terminal                                    |
| `GATE_INCREMENT_TEAM_MEMBERS_ONLY`                 | 403  | An Increment belongs to its Scrum Team                                           |
| `GATE_INCREMENT_INTEGRATION_VERIFICATION_REQUIRED` | 400  | Nothing is `VERIFIED` or delivered until it is additive to every prior Increment |
| `GATE_INCREMENT_USABILITY_ATTESTATION_REQUIRED`    | 400  | An Increment must be in usable condition, attested in writing                    |
| `GATE_INCREMENT_DELIVERY_METHOD_REQUIRED`          | 400  | Delivery records how value reached users, so it goes through the deliver action  |
| `GATE_DOD_REQUIRED`                                | 400  | A Definition of Done must keep at least one active item                          |
| `GATE_DOD_NOT_VERIFIED`                            | 400  | Nothing is Done until every active Definition of Done item is verified           |
| `GATE_DOD_TEAM_MEMBERS_ONLY`                       | 403  | The Definition of Done belongs to its Scrum Team                                 |

## Best Practices

### Increment Management

1. **Create Early**: Create increments at the start of each sprint to track delivery from the beginning
2. **Associate PBIs**: Link all completed PBIs to the increment for accurate tracking
3. **Let the Server Derive the Total**: `totalStoryPoints` is computed from the items the Increment contains, so it always matches what the team presents
4. **Attest Usability Early**: Record the usable-condition evidence when the work is ready, so it is never the reason a delivery is blocked

### Delivery Workflow

1. **Verify Integration**: Record a passing integration test against every prior Increment, then verify
2. **Attest Usability**: Record what was checked and where, so the Sprint Review inspects evidence rather than a label
3. **Deliver**: The deliver action records the method, the moment, and who delivered the Increment
4. **Reconcile if Needed**: If an item's Increment composition was skipped or failed when it was marked Done, `POST /api/v1/increments/reconcile` repairs it from the Sprint's Done items

### Verification Basis

`integrationVerified` is accompanied by two fields that state what the verification rests on:

- `integrationVerificationBasis`: `FIRST_INCREMENT_EXEMPT` when the team's first Increment had no prior Increment to test against, or `PRIOR_INCREMENTS` when the verification covers the team's prior Increments. It is `null` while the Increment is not verified.
- `integrationVerifiedPriorCount`: how many prior Increments the verification covered (`0` for the exemption).

A `DRAFT` sibling does not count as a prior Increment: it is an Increment the team has not stood behind yet, so there is nothing for this one to be additive to.

### Metrics

1. **Monitor Delivery Rate**: Track the ratio of delivered vs total increments over time
2. **Story Point Trends**: Use averageStoryPoints to forecast future sprint capacity
3. **Team Comparison**: Compare metrics across teams to identify improvement opportunities

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Sprints API](./sprints.md)
- [Sprint Reviews API](./sprint-reviews.md)
- [Product Backlog API](./product-backlog.md)
- [Definition of Done API](./definition-of-done.md)
- [Reports API](./reports.md)
