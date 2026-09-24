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

The DoD is the Increment's commitment, so the API holds five rules around it rather than treating it as a setting:

- **It cannot be emptied.** A DoD must keep at least one active item (`400 GATE_DOD_REQUIRED`). An empty checklist would silently satisfy the Done gate — the one call that could defeat the rule the DoD exists to enforce.
- **A Sprint cannot open without it.** Committing a Sprint Backlog (`POST /sprints/:id/backlog`) and starting a Sprint (`POST /sprints/:id/start`) are both refused while the team's governing DoD holds no active item (`400 GATE_DOD_REQUIRED`) — including for a team that has never created one (`400 GATE_DOD_REQUIRED`). A Sprint opened against no commitment is a Sprint whose Increment can never satisfy one.
- **Work cannot be marked Done without it.** A Product Backlog item cannot transition to `DONE` while the team has no active DoD item, and every active item must be verified for it (`400 GATE_DOD_REQUIRED`, `400 GATE_DOD_NOT_VERIFIED`).
- **It belongs to its team.** Reading or changing a team's DoD, recording a verification against one of its items, and reading its Sprint compliance report all require membership of that team (`403 GATE_DOD_TEAM_MEMBERS_ONLY`).
- **It is append-only, and edits are not destructive.** `GET /history` lists every version the DoD has had, newest first, with the current version marked; a change preserves the version it supersedes instead of erasing it. A criterion the payload keeps by id is updated in place, so the verifications recorded against it survive the edit.

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

- The supplied list becomes the new version, and the version is incremented.
- **The version being superseded is preserved**: the update writes an append-only snapshot of it inside the same transaction, so `GET /history` can show what the team previously worked to and who changed it.
- **A DoD with no active item is refused** with `400 GATE_DOD_REQUIRED`.
- **A criterion that survives the edit keeps its row** (see _How the list is applied_), so the verifications recorded against it survive too.

**Path Parameters**

- `teamId` (string, required): Team UUID

**Request Body**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440021 (optional, UUID of an existing criterion)",
      "description": "string (required, 1-500 chars)",
      "category": "string (optional)",
      "isActive": "boolean (required)",
      "order": "number (accepted, ignored: the final order follows list position)"
    }
  ]
}
```

**How the list is applied**

Each criterion's identity decides how it is applied:

- an item carrying an `id` that names a criterion **of this Definition of Done** updates that row in
  place. Every `DoDChecklistVerification` recorded against it survives, so rewording one criterion
  no longer discards the evidence that an item satisfied the others;
- an item with **no `id`** — or with an `id` this Definition of Done does not hold — is inserted as a
  new criterion, under an id the service assigns. An id cannot be used to reach across teams or
  across scopes;
- a criterion **absent from the payload** is deleted, and its verifications go with it. The snapshot
  of the superseded version still records what the criterion said, so the change is auditable even
  though the verifications are gone — a removed criterion is one nobody can satisfy any more.

Send the whole list, with ids for the criteria that already exist. Omitting the ids is read as
"replace every criterion with these new ones": the old rows are deleted, taking their verifications
with them.

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
          "order": 0,
          "defaultKey": null
        },
        {
          "description": "Code is properly documented",
          "category": "documentation",
          "isActive": true,
          "order": 1,
          "defaultKey": "documentation"
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
          "order": 0,
          "defaultKey": null
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

`defaultKey` names the built-in criterion a criterion descends from, so a version stays readable in
the reader's language after the team rewords it; `null` means the team wrote it itself. It is owned by
the service: the write payload has no such field, and an edit preserves whatever the row already
carries. Snapshots written before the field existed report `null`, and the reader falls back to
matching the sentence.

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

| Code                         | HTTP | Rule enforced                                                                                                                                                                |
| ---------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATE_DOD_REQUIRED`          | 400  | A DoD must keep at least one active item; a Sprint Backlog cannot be committed, and a Sprint cannot start, without one; and work cannot be marked Done while a team has none |
| `GATE_DOD_NOT_VERIFIED`      | 400  | A Product Backlog item cannot be marked Done until every active DoD item is verified for it                                                                                  |
| `GATE_DOD_TEAM_MEMBERS_ONLY` | 403  | The DoD belongs to its Scrum Team: reading, changing, or verifying against it requires membership                                                                            |
| `GATE_DOD_GROUP_GOVERNED`    | 409  | A team in a group complies with the group's shared DoD, so it cannot replace its own — see [Team Groups API](./team-groups.md)                                               |

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

## Shared Definition of Done (team groups)

> _"If there are multiple Scrum Teams working together on a product, they must mutually define and
> comply with the same Definition of Done."_

A Definition of Done belongs either to one team (`teamId`) or to the group of Scrum Teams working on
one product (`groupId`) — never both, held by `CHECK ((team_id IS NULL) <> (group_id IS NULL))`. The
`GET` and `PUT` endpoints on `/teams/:teamId/definition-of-done` therefore do not always act on a
team-owned row:

- **Reading** resolves the Definition of Done that _governs_ the team: the group's row when the team
  belongs to a group, otherwise the team's own. The response is still reported under the team that
  asked, so the shape is unchanged.
- **Writing** is refused with `409 GATE_DOD_GROUP_GOVERNED` for a grouped team. A team that could
  still edit its own Definition of Done would not be complying with the same one, and the change
  would be invisible to the teams that share it. Change it at the group:
  `PUT /api/v1/team-groups/:groupId/shared-definition-of-done`.
- **Version history** follows the same resolution, so a group's history stays with the group and a
  team's adoption is visible as `Team.groupDodVersionAtJoin`.
- The same resolution applies to the Done gate: `checkDoDEligibility` and the batch check in
  `incrementAccess.ts` verify against the governing Definition of Done, so the gate and the editor
  cannot disagree about which commitment an item has to satisfy.

A team that leaves a group keeps the Definition of Done it has been complying with: the shared items
are written into its own row through the ordinary versioned update, which is snapshotted like any
other change.

### Where this lives in the product

A group's shared Definition of Done is not edited from a team's own panel — a grouped team is shown
it read-only, with a link to where it is changed. Both the group and its shared Definition of Done
are managed on **Settings → Team → Team Groups**: create, rename and delete a group, read its roster
and the version each team adopted, and replace the commitment every team in it complies with.
Joining and leaving stay on the team, under **Team → Scrum Health → Shared Definition of Done**,
because that decision is the team's own.

See [Team Groups API](./team-groups.md) and
[Team Groups and the Shared Definition of Done](../user-guide/core-features/team-groups.md).

---

**Last Updated**: 2026-09-24

**Related Documentation**

- [Definition of Ready API](./definition-of-ready.md)
- [Teams API](./teams.md)
- [Team Groups API](./team-groups.md)
- [Product Backlog API](./product-backlog.md)
- [Sprints API](./sprints.md)
