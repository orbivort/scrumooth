# Definition of Done API

Complete Definition of Done (DoD) API reference for managing team DoD criteria, verifying compliance on Product Backlog Items, and tracking sprint-level DoD compliance.

## Table of Contents

- [Overview](#overview)
- [DoD Concepts](#dod-concepts)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Get Team DoD](#get-team-dod)
  - [Update Team DoD](#update-team-dod)
  - [Get DoD Version History](#get-dod-version-history)
  - [Verify DoD for PBI](#verify-dod-for-pbi)
  - [Get DoD Verifications for PBI](#get-dod-verifications-for-pbi)
  - [Get Sprint DoD Compliance](#get-sprint-dod-compliance)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Definition of Done API provides capabilities for:

- Managing a team's Definition of Done criteria
- Tracking DoD version history over time
- Verifying DoD compliance on individual Product Backlog Items
- Retrieving DoD verification records for a PBI
- Generating sprint-level DoD compliance reports

All DoD endpoints are mounted under `/api/v1/teams/:teamId/definition-of-done` for team-level operations and `/api/v1/product-backlog/:id/verify-dod` for PBI-level verification operations.

## DoD Concepts

The **Definition of Done (DoD)** is a shared agreement within a Scrum team on what it means for a Product Backlog Item (PBI) to be complete. It represents a quality gate that every increment must satisfy before it is considered releasable.

### Key Principles

- **Team Agreement**: The DoD is created and maintained by the entire team, ensuring shared ownership of quality standards
- **Transparency**: A clear, visible DoD ensures all stakeholders understand what "done" means
- **Non-Negotiable**: All DoD criteria must be met for a PBI to be considered complete; partial compliance is not sufficient
- **Evolving**: The DoD should be regularly reviewed and improved during retrospectives to raise the quality bar over time
- **Per-Team**: Each team defines its own DoD, which may differ from other teams based on context and maturity

### What the API enforces

The DoD is the Increment's commitment, so the API holds four rules around it rather than treating it as a setting:

- **It cannot be emptied.** A DoD must keep at least one active item (`400 GATE_DOD_REQUIRED`). An empty checklist would silently satisfy the Done gate — the one call that could defeat the rule the DoD exists to enforce.
- **Work cannot be marked Done without it.** A Product Backlog item cannot transition to `DONE` while the team has no active DoD item, and every active item must be verified for it (`400 GATE_DOD_REQUIRED`, `400 GATE_DOD_NOT_VERIFIED`).
- **It belongs to its team.** Reading or changing a team's DoD, recording a verification against one of its items, and reading its Sprint compliance report all require membership of that team (`403 GATE_DOD_TEAM_MEMBERS_ONLY`).
- **It is append-only.** `GET /history` lists every version the DoD has had, newest first, with the current version marked. A change preserves the version it supersedes instead of erasing it.

### Common DoD Criteria Examples

- Code has been peer-reviewed
- Unit tests pass with adequate coverage
- Integration tests pass
- No critical or high-severity defects remain
- Documentation has been updated
- Feature has been demonstrated to stakeholders
- Deployment to staging environment successful

### DoD vs. Acceptance Criteria

| Aspect           | Definition of Done                       | Acceptance Criteria                         |
| ---------------- | ---------------------------------------- | ------------------------------------------- |
| **Scope**        | Applies to all PBIs in the team          | Specific to a single PBI                    |
| **Owner**        | Entire team                              | Product Owner (with team input)             |
| **Purpose**      | Ensures baseline quality across all work | Validates the specific business need is met |
| **Verification** | Checked for every PBI                    | Checked for the specific PBI                |
| **Evolution**    | Evolves through retrospectives           | Defined during backlog refinement           |

## Authentication

All DoD endpoints require authentication. Include the access token in your request:

**Using Cookies (Recommended)**

```http
GET /api/v1/teams/:teamId/definition-of-done
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/teams/:teamId/definition-of-done
Authorization: Bearer eyJhbGc...
```

## Endpoints

### Get Team DoD

Get the current Definition of Done for a team.

**Endpoint**

```
GET /api/v1/teams/:teamId/definition-of-done
```

**Authentication**

- Required
- User must be a team member

**Path Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "definitionOfDone": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "items": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440011",
          "description": "Code has been peer-reviewed",
          "order": 1,
          "createdAt": "2026-04-29T12:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440012",
          "description": "Unit tests pass with adequate coverage",
          "order": 2,
          "createdAt": "2026-04-29T12:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440013",
          "description": "No critical or high-severity defects remain",
          "order": 3,
          "createdAt": "2026-04-29T12:00:00.000Z"
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
    "message": "Team not found"
  }
}
```

**403 Forbidden - Not a Member**

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
curl -X GET https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/definition-of-done \
  -b cookies.txt
```

---

### Update Team DoD

Replace the Definition of Done for a team with a new version.

**Endpoint**

```
PUT /api/v1/teams/:teamId/definition-of-done
```

**Authentication**

- Required
- The caller must be a member of the team. The DoD is "created by the Scrum Team" for its own product, so it is the team's agreement rather than a single role's setting.

**Behaviour**

- All existing items are replaced by the supplied list, and the version is incremented.
- **The version being superseded is preserved**: the update writes an append-only snapshot of it inside the same transaction, so `GET /history` can show what the team previously worked to and who changed it.
- **A DoD with no active item is refused** with `400 GATE_DOD_REQUIRED`.

**Path Parameters**

- `teamId` (string, required): Team UUID

**Request Body**

```json
{
  "items": [
    {
      "description": "string (required, 1-500 chars)"
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
    "definitionOfDone": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "items": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440021",
          "description": "Code has been peer-reviewed by at least one team member",
          "order": 1,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440022",
          "description": "Unit tests pass with at least 80% coverage",
          "order": 2,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440023",
          "description": "Integration tests pass in staging environment",
          "order": 3,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440024",
          "description": "Documentation has been updated",
          "order": 4,
          "createdAt": "2026-04-29T13:00:00.000Z"
        }
      ],
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
        "field": "items[0].description",
        "message": "Description is required"
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

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/definition-of-done \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "items": [
      { "description": "Code has been peer-reviewed by at least one team member" },
      { "description": "Unit tests pass with at least 80% coverage" },
      { "description": "Integration tests pass in staging environment" },
      { "description": "Documentation has been updated" }
    ]
  }'
```

---

### Get DoD Version History

Get the append-only version history of the team's Definition of Done, newest first, so it is auditable over time: what the team previously worked to, when it changed, and who changed it.

**Endpoint**

```
GET /api/v1/teams/:teamId/definition-of-done/history
```

**Authentication**

- Required
- The caller must be a member of the team

**Path Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

The response is an array of versions, newest first. `isCurrent` marks the version the team works to now; every other entry is a preserved snapshot of a superseded version. A team that has never changed its DoD sees exactly one entry.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "version": 3,
      "items": [
        {
          "description": "Code has been peer-reviewed by at least one team member",
          "category": "review",
          "isActive": true,
          "order": 0
        }
      ],
      "createdAt": "2026-09-22T09:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440005",
      "createdByName": "Ada Lovelace",
      "isCurrent": true
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440029",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "version": 2,
      "items": [
        {
          "description": "Unit tests pass with at least 80% coverage",
          "category": "testing",
          "isActive": true,
          "order": 0
        }
      ],
      "createdAt": "2026-08-01T09:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440006",
      "createdByName": "Grace Hopper",
      "isCurrent": false
    }
  ]
}
```

**Error Responses**

**404 Not Found**

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
curl -X GET https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/definition-of-done/history \
  -b cookies.txt
```

---

### Verify DoD for PBI

Verify Definition of Done compliance for a specific Product Backlog Item. Each DoD item can be marked as verified or not verified with optional notes.

**Endpoint**

```
POST /api/v1/product-backlog/:id/verify-dod
```

**Authentication**

- Required
- User must be a team member

**Path Parameters**

- `id` (string, required): Product Backlog Item UUID

**Request Body**

```json
{
  "verifications": [
    {
      "dodItemId": "string (required, UUID of the DoD item)",
      "isVerified": "boolean (required)",
      "notes": "string (optional, max 1000 chars)"
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
    "verification": {
      "id": "550e8400-e29b-41d4-a716-446655440040",
      "pbiId": "550e8400-e29b-41d4-a716-446655440050",
      "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
      "verifications": [
        {
          "dodItemId": "550e8400-e29b-41d4-a716-446655440021",
          "isVerified": true,
          "notes": "Reviewed by Jane Smith"
        },
        {
          "dodItemId": "550e8400-e29b-41d4-a716-446655440022",
          "isVerified": true,
          "notes": "Coverage at 85%"
        },
        {
          "dodItemId": "550e8400-e29b-41d4-a716-446655440023",
          "isVerified": false,
          "notes": "Staging deployment pending"
        },
        {
          "dodItemId": "550e8400-e29b-41d4-a716-446655440024",
          "isVerified": true,
          "notes": null
        }
      ],
      "allVerified": false,
      "createdAt": "2026-04-29T14:00:00.000Z"
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
        "field": "verifications[0].dodItemId",
        "message": "Valid UUID is required"
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
    "message": "Product Backlog Item not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/product-backlog/550e8400-e29b-41d4-a716-446655440050/verify-dod \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "verifications": [
      { "dodItemId": "550e8400-e29b-41d4-a716-446655440021", "isVerified": true, "notes": "Reviewed by Jane Smith" },
      { "dodItemId": "550e8400-e29b-41d4-a716-446655440022", "isVerified": true, "notes": "Coverage at 85%" },
      { "dodItemId": "550e8400-e29b-41d4-a716-446655440023", "isVerified": false, "notes": "Staging deployment pending" },
      { "dodItemId": "550e8400-e29b-41d4-a716-446655440024", "isVerified": true }
    ]
  }'
```

---

### Get DoD Verifications for PBI

Get all DoD verification records for a specific Product Backlog Item.

**Endpoint**

```
GET /api/v1/product-backlog/:id/dod-verifications
```

**Authentication**

- Required
- User must be a team member

**Path Parameters**

- `id` (string, required): Product Backlog Item UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "verifications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440040",
        "pbiId": "550e8400-e29b-41d4-a716-446655440050",
        "verifiedBy": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "firstName": "John",
          "lastName": "Doe"
        },
        "verifications": [
          {
            "dodItemId": "550e8400-e29b-41d4-a716-446655440021",
            "dodItemDescription": "Code has been peer-reviewed by at least one team member",
            "isVerified": true,
            "notes": "Reviewed by Jane Smith"
          },
          {
            "dodItemId": "550e8400-e29b-41d4-a716-446655440022",
            "dodItemDescription": "Unit tests pass with at least 80% coverage",
            "isVerified": true,
            "notes": "Coverage at 85%"
          },
          {
            "dodItemId": "550e8400-e29b-41d4-a716-446655440023",
            "dodItemDescription": "Integration tests pass in staging environment",
            "isVerified": false,
            "notes": "Staging deployment pending"
          },
          {
            "dodItemId": "550e8400-e29b-41d4-a716-446655440024",
            "dodItemDescription": "Documentation has been updated",
            "isVerified": true,
            "notes": null
          }
        ],
        "allVerified": false,
        "createdAt": "2026-04-29T14:00:00.000Z"
      }
    ]
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
    "message": "Product Backlog Item not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/product-backlog/550e8400-e29b-41d4-a716-446655440050/dod-verifications \
  -b cookies.txt
```

---

### Get Sprint DoD Compliance

Get a DoD compliance report for a sprint, showing how many PBIs meet the Definition of Done.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/dod-compliance
```

**Authentication**

- Required
- User must be a team member

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
      "sprintId": "550e8400-e29b-41d4-a716-446655440060",
      "sprintName": "Sprint 5",
      "totalItems": 8,
      "fullyCompliant": 5,
      "partiallyCompliant": 2,
      "nonCompliant": 1,
      "complianceRate": 0.625,
      "items": [
        {
          "pbiId": "550e8400-e29b-41d4-a716-446655440050",
          "pbiTitle": "User authentication flow",
          "allVerified": false,
          "verifiedCount": 3,
          "totalDoDItems": 4,
          "lastVerifiedAt": "2026-04-29T14:00:00.000Z"
        },
        {
          "pbiId": "550e8400-e29b-41d4-a716-446655440051",
          "pbiTitle": "Dashboard analytics widget",
          "allVerified": true,
          "verifiedCount": 4,
          "totalDoDItems": 4,
          "lastVerifiedAt": "2026-04-29T15:00:00.000Z"
        }
      ]
    }
  }
}
```

**Error Responses**

**404 Not Found - Sprint Not Found**

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
curl -X GET https://api.scrumooth.dev/api/v1/sprints/550e8400-e29b-41d4-a716-446655440060/dod-compliance \
  -b cookies.txt
```

---

## Error Codes

| Code                   | HTTP Status | Description                                   |
| ---------------------- | ----------- | --------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed                     |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                       |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions or not a team member |
| `NOT_FOUND`            | 404         | Team, PBI, or sprint not found                |
| `CONFLICT`             | 409         | Resource conflict                             |

### Gate Rejections

| Code                         | HTTP | Rule enforced                                                                                     |
| ---------------------------- | ---- | ------------------------------------------------------------------------------------------------- |
| `GATE_DOD_REQUIRED`          | 400  | A DoD must keep at least one active item, and work cannot be marked Done while a team has none    |
| `GATE_DOD_NOT_VERIFIED`      | 400  | A Product Backlog item cannot be marked Done until every active DoD item is verified for it       |
| `GATE_DOD_TEAM_MEMBERS_ONLY` | 403  | The DoD belongs to its Scrum Team: reading, changing, or verifying against it requires membership |

## Best Practices

### DoD Management

1. **Team Collaboration**: Define DoD items collaboratively during retrospectives to ensure team buy-in
2. **Specific and Measurable**: Write DoD criteria that are unambiguous and verifiable
3. **Regular Review**: Revisit the DoD during each retrospective to adapt to team maturity
4. **Version Awareness**: Use version history to track how the DoD has evolved and why
5. **Minimal but Sufficient**: Avoid overly long DoD lists; focus on criteria that truly matter for quality

### DoD Verification

1. **Verify Early**: Begin DoD verification during development, not just at the end of the sprint
2. **Document Notes**: Use the notes field to capture context for why an item was or was not verified
3. **Honest Assessment**: Mark items as verified only when they truly meet the criteria
4. **All Must Pass**: A PBI is not "done" until all DoD items are verified; partial compliance is not sufficient

### Sprint Compliance

1. **Monitor Trends**: Track DoD compliance across sprints to identify quality trends
2. **Address Gaps**: Use compliance reports to identify systemic quality issues
3. **Celebrate Improvement**: Recognize when compliance rates improve over time

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Definition of Ready API](./definition-of-ready.md)
- [Teams API](./teams.md)
- [Product Backlog API](./product-backlog.md)
- [Sprints API](./sprints.md)
