# Definition of Ready API

Complete Definition of Ready (DoR) API reference for managing team DoR criteria and verifying readiness of Product Backlog Items before sprint planning.

## Table of Contents

- [Overview](#overview)
- [DoR Concepts](#dor-concepts)
- [Authorization](#authorization)
- [Endpoints](#endpoints)
  - [Get Team DoR](#get-team-dor)
  - [Update Team DoR](#update-team-dor)
  - [Get DoR Version History](#get-dor-version-history)
  - [Verify DoR for PBI](#verify-dor-for-pbi)
  - [Get DoR Verifications for PBI](#get-dor-verifications-for-pbi)
- [Gate rejections](#gate-rejections)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Definition of Ready API provides capabilities for:

- Managing a team's Definition of Ready criteria
- Reading the Definition of Ready in force, and the version it carries
- Verifying DoR compliance on individual Product Backlog Items
- Retrieving DoR verification records for a PBI

All DoR endpoints are mounted under `/api/v1/teams/:teamId/definition-of-ready` for team-level operations and `/api/v1/product-backlog/:id/verify-dor` for PBI-level verification operations.

## DoR Concepts

The **Definition of Ready (DoR)** is a shared agreement within a Scrum team on what conditions must be met before a Product Backlog Item (PBI) can be selected for a sprint. It ensures work brought into a sprint is well-understood, properly refined, and ready for implementation.

### It is a complementary practice, not a Scrum Guide artifact

The 2020 Scrum Guide names exactly three artifacts — the Product Backlog, the Sprint Backlog and the Increment — with the **Definition of Done** as the Increment's commitment. The Definition of Ready is not one of them: it is a team's own agreement, and Scrumooth presents it as such. It is **not** a Guide rule, and the gate it produces below is **not** claimed as Guide conformance.

### It is nonetheless enforced

Scrumooth enforces the agreement as the team's own commitment. Committing a Sprint Backlog (`POST /sprints/:id/backlog`) or starting a Sprint (`POST /sprints/:id/start`) is **refused** while any selected item still has an unverified active readiness criterion, and refused outright while the team has no active criterion at all. A definition that could be ignored at the moment it matters would be decorative, so the agreement made in refinement is applied at the boundary. See [Gate rejections](#gate-rejections).

### Key Principles

- **Prevents Waste**: Items that are not ready waste sprint capacity when the team discovers missing information mid-sprint
- **Shared Understanding**: The DoR ensures the team and Product Owner have a common understanding of what "ready" means
- **Refinement Guide**: The DoR serves as a checklist during backlog refinement to assess PBI readiness
- **Applied, not merely advisory**: The agreement is read by the service when a Sprint Backlog is committed and when a Sprint starts. Verifying an item is still the team's own judgement — the tool records the verdict, it does not invent one — but an unverified criterion stops the boundary rather than warning about it
- **Cannot be emptied**: The agreement must keep at least one active criterion, so its gate can never pass vacuously
- **Per-Team**: Each team defines its own DoR, which may differ from other teams based on context and maturity. There is no group- or organization-level readiness agreement

### Common DoR Criteria Examples

- User story has clear acceptance criteria
- Dependencies have been identified and resolved
- Design mockups or wireframes are available
- Story has been estimated by the team
- Story is small enough to be completed within a sprint
- Product Owner is available to answer questions

### DoR vs. DoD

| Aspect              | Definition of Ready                                                 | Definition of Done                                         |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Guide status**    | Complementary practice; not a 2020 Scrum Guide artifact             | The Increment's commitment, named in the Guide             |
| **Timing**          | Applied when a Sprint Backlog is committed and when a Sprint starts | Applied when a PBI is marked Done, and reported per Sprint |
| **What it gates**   | Committing a Sprint Backlog and opening a Sprint                    | Marking a PBI Done, and Increment composition              |
| **Strictness**      | Every active criterion must be verified for every selected item     | Every active criterion must be verified for that item      |
| **Who maintains**   | The team's Scrum Master (the agreement itself)                      | The Scrum Team, member by member (the agreement itself)    |
| **Who records it**  | Any team member, per criterion, per PBI                             | Any team member, per criterion, per PBI                    |
| **Version history** | Append-only snapshots of every superseded version                   | Append-only snapshots of every superseded version          |
| **Focus**           | Preparedness and clarity                                            | Quality and completeness                                   |

### When to Verify DoR

- **Backlog Refinement**: During refinement sessions, the team assesses DoR readiness
- **Sprint Planning**: Before committing to items, verify they meet DoR criteria
- **Continuous**: Product Owner and team can verify DoR at any time as understanding evolves

## Authorization

All DoR endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

**Who may do what.** The agreement belongs to the team it describes, so every operation is scoped to
the caller's role _in that team_ — never to a role held in some other team:

| Operation                                          | Rule                                             | Refusal                                                                                |
| -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Reading the agreement, or one item's verifications | Membership of the item's/the team's Scrum Team   | `403 GATE_DOR_TEAM_MEMBERS_ONLY`                                                       |
| Recording a readiness verification                 | Membership of the item's Scrum Team              | `403 GATE_DOR_TEAM_MEMBERS_ONLY`                                                       |
| Replacing the agreement                            | The team's **Scrum Master** (membership implied) | `403 GATE_DOR_SCRUM_MASTER_ONLY`, or `403 GATE_DOR_TEAM_MEMBERS_ONLY` for a non-member |

Recording the verdict stays a team activity — the Developers and the Product Owner assess readiness
together during refinement — while _maintaining the agreement itself_ is the Scrum Master's, so one
person owns what "ready" means and the checklist cannot drift under the team mid-refinement. The
Definition of Done is deliberately different: the Guide says the _Scrum Team_ creates it, so its
agreement stays member-editable.

## Endpoints

### Get Team DoR

Get the current Definition of Ready for a team.

**Endpoint**

```
GET /api/v1/teams/:teamId/definition-of-ready
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
    "definitionOfReady": {
      "id": "550e8400-e29b-41d4-a716-446655440110",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "items": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440111",
          "description": "User story has clear acceptance criteria",
          "order": 1,
          "createdAt": "2026-04-29T12:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440112",
          "description": "Dependencies have been identified and resolved",
          "order": 2,
          "createdAt": "2026-04-29T12:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440113",
          "description": "Story has been estimated by the team",
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
curl -X GET https://api.example.com/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/definition-of-ready \
  -b cookies.txt
```

---

### Update Team DoR

Replace the Definition of Ready for a team. Requires the team's Scrum Master.

**Endpoint**

```
PUT /api/v1/teams/:teamId/definition-of-ready
```

**Authorization**

- Required
- The caller must be the team's Scrum Master (`403 GATE_DOR_SCRUM_MASTER_ONLY` otherwise)

**Path Parameters**

- `teamId` (string, required): Team UUID

**Request Body**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440121 (optional, UUID of an existing criterion)",
      "description": "string (required, 1-500 chars)",
      "category": "string (optional)",
      "isActive": "boolean (required)",
      "order": "number (accepted, ignored: the final order follows list position)"
    }
  ]
}
```

**How the list is applied**

The payload is the agreement's new state, and each criterion's identity decides how it is applied:

- an item carrying an `id` that names a criterion **of this agreement** updates that row in place;
  every readiness verification recorded against it survives the edit, so rewording one criterion no
  longer discards the evidence for the others;
- an item with **no `id`** — or with an `id` this agreement does not hold — is inserted as a new
  criterion, under an id the service assigns;
- a criterion **absent from the payload** is deleted, and its verifications go with it. The version
  being replaced is preserved as a snapshot first, so what the criterion said is still readable in the
  history, but a removed criterion is gone from the live agreement: retiring one loses the verdicts
  recorded against it.

The resulting agreement must keep **at least one active criterion** (`400 GATE_DOR_REQUIRED`
otherwise), so the Sprint boundary rule it feeds can never be emptied away. Sending `items: []`, or
a list where every criterion is `isActive: false`, is refused and writes nothing.

For a body that only needs to reword one criterion, send its `id` alongside the new description;
sending the whole list without ids is read as "replace every criterion with these new ones".

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "definitionOfReady": {
      "id": "550e8400-e29b-41d4-a716-446655440110",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "items": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440121",
          "description": "User story has clear and testable acceptance criteria",
          "order": 1,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440122",
          "description": "Dependencies have been identified and resolved",
          "order": 2,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440123",
          "description": "Design mockups or wireframes are available",
          "order": 3,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440124",
          "description": "Story has been estimated by the team",
          "order": 4,
          "createdAt": "2026-04-29T13:00:00.000Z"
        },
        {
          "id": "550e8400-e29b-41d4-a716-446655440125",
          "description": "Story is small enough to be completed within a sprint",
          "order": 5,
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
curl -X PUT https://api.example.com/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/definition-of-ready \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "items": [
      { "description": "User story has clear and testable acceptance criteria" },
      { "description": "Dependencies have been identified and resolved" },
      { "description": "Design mockups or wireframes are available" },
      { "description": "Story has been estimated by the team" },
      { "description": "Story is small enough to be completed within a sprint" }
    ]
  }'
```

---

### Get DoR Version History

Get the append-only version history of a team's Definition of Ready, newest first.

**The DoR keeps a real history.** Every replacement first preserves the version it is about to
supersede, so the versions the team changed its mind about remain readable — the same treatment the
Definition of Done receives, and for the same reason: an enforced agreement whose earlier versions
vanish is one the team cannot inspect. A team that has never changed its readiness agreement sees one
entry: the version in force.

The response is an array of version snapshots. The version in force is the first entry and carries
`isCurrent: true`; every entry behind it comes from a snapshot. Each entry holds the criteria as they
stood, so a criterion that was later reworded or retired is still legible in the version that held it.
There are no paging parameters.

**Endpoint**

```
GET /api/v1/teams/:teamId/definition-of-ready/history
```

**Authorization**

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
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440110",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "version": 2,
      "items": [
        {
          "description": "Clear title and description provided",
          "category": "acceptance",
          "isActive": true,
          "order": 0,
          "defaultKey": "clearTitle"
        },
        {
          "description": "Dependencies have been identified and resolved",
          "category": "dependencies",
          "isActive": true,
          "order": 1,
          "defaultKey": null
        }
      ],
      "createdAt": "2026-04-29T13:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "createdByName": "Sam Master",
      "isCurrent": true
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440199",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "version": 1,
      "items": [
        {
          "description": "Clear title and description provided",
          "category": "acceptance",
          "isActive": true,
          "order": 0,
          "defaultKey": "clearTitle"
        }
      ],
      "createdAt": "2026-04-29T12:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "createdByName": "Sam Master",
      "isCurrent": false
    }
  ]
}
```

An empty array means the team has no readiness agreement yet.

`defaultKey` names the built-in criterion a criterion descends from, so it stays readable in the
reader's language after it is reworded; `null` means the team wrote it itself, and it is then shown
exactly as written. The field is absent from snapshots written before it existed, which read as null.

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
curl -X GET https://api.example.com/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/definition-of-ready/history \
  -b cookies.txt
```

---

### Verify DoR for PBI

Verify Definition of Ready compliance for a specific Product Backlog Item. Each DoR item can be marked as verified or not verified with optional notes.

This is the call that unblocks the Sprint boundary: a selected item whose active criteria are all
verified is a selected item the team may commit. An item recorded as `isVerified: false` counts as
unmet, exactly like one nobody has assessed.

**Endpoint**

```
POST /api/v1/product-backlog/:id/verify-dor
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
      "dorItemId": "string (required, UUID of the DoR item)",
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
      "id": "550e8400-e29b-41d4-a716-446655440140",
      "pbiId": "550e8400-e29b-41d4-a716-446655440150",
      "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
      "verifications": [
        {
          "dorItemId": "550e8400-e29b-41d4-a716-446655440121",
          "isVerified": true,
          "notes": "Acceptance criteria defined in Jira ticket"
        },
        {
          "dorItemId": "550e8400-e29b-41d4-a716-446655440122",
          "isVerified": true,
          "notes": "No external dependencies"
        },
        {
          "dorItemId": "550e8400-e29b-41d4-a716-446655440123",
          "isVerified": false,
          "notes": "Wireframes still in progress"
        },
        {
          "dorItemId": "550e8400-e29b-41d4-a716-446655440124",
          "isVerified": true,
          "notes": "Estimated at 5 story points"
        },
        {
          "dorItemId": "550e8400-e29b-41d4-a716-446655440125",
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
        "field": "verifications[0].dorItemId",
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
curl -X POST https://api.example.com/api/v1/product-backlog/550e8400-e29b-41d4-a716-446655440150/verify-dor \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "verifications": [
      { "dorItemId": "550e8400-e29b-41d4-a716-446655440121", "isVerified": true, "notes": "Acceptance criteria defined" },
      { "dorItemId": "550e8400-e29b-41d4-a716-446655440122", "isVerified": true, "notes": "No external dependencies" },
      { "dorItemId": "550e8400-e29b-41d4-a716-446655440123", "isVerified": false, "notes": "Wireframes still in progress" },
      { "dorItemId": "550e8400-e29b-41d4-a716-446655440124", "isVerified": true, "notes": "Estimated at 5 story points" },
      { "dorItemId": "550e8400-e29b-41d4-a716-446655440125", "isVerified": true }
    ]
  }'
```

---

### Get DoR Verifications for PBI

Get all DoR verification records for a specific Product Backlog Item.

**Endpoint**

```
GET /api/v1/product-backlog/:id/dor-verifications
```

**Authentication**

- Required
- User must be a team member

**Path Parameters**

- `id` (string, required): Product Backlog Item UUID

**Success Response**

One entry per recorded criterion — the response is a flat list of verification rows, not a grouped
report:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440140",
      "pbiId": "550e8400-e29b-41d4-a716-446655440150",
      "dorItemId": "550e8400-e29b-41d4-a716-446655440121",
      "isVerified": true,
      "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
      "verifiedAt": "2026-04-29T14:00:00.000Z",
      "notes": "Acceptance criteria defined in Jira ticket",
      "createdAt": "2026-04-29T14:00:00.000Z",
      "dorItem": {
        "id": "550e8400-e29b-41d4-a716-446655440121",
        "description": "User story has clear and testable acceptance criteria",
        "category": "acceptance"
      }
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440141",
      "pbiId": "550e8400-e29b-41d4-a716-446655440150",
      "dorItemId": "550e8400-e29b-41d4-a716-446655440122",
      "isVerified": false,
      "verifiedBy": "550e8400-e29b-41d4-a716-446655440001",
      "verifiedAt": "2026-04-29T14:00:00.000Z",
      "notes": "Wireframes still in progress",
      "createdAt": "2026-04-29T14:00:00.000Z",
      "dorItem": {
        "id": "550e8400-e29b-41d4-a716-446655440122",
        "description": "Dependencies have been identified and resolved",
        "category": "dependencies"
      }
    }
  ]
}
```

Only criteria that have been recorded appear; a criterion nobody has assessed has no row, and an
unrecorded criterion is what the Sprint boundary treats as unmet.

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
curl -X GET https://api.example.com/api/v1/product-backlog/550e8400-e29b-41d4-a716-446655440150/dor-verifications \
  -b cookies.txt
```

---

## Gate rejections

These are the readiness agreement's rules. When one refuses an action the response carries the
stable `error.code` below, so an integrator can branch on the refusal without parsing the localized
message. The canonical list of every gate in the product lives in
[`docs/api/README.md`](./README.md#gate-rejections).

| Code                         | HTTP | When                                                                                                                                      | Rule                                                                                                |
| ---------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GATE_DOR_REQUIRED`          | 400  | Replacing the agreement with no active criterion; committing a Sprint Backlog or starting a Sprint while the team has no active criterion | The agreement must keep at least one active criterion, so its gate can never pass vacuously         |
| `GATE_DOR_NOT_VERIFIED`      | 400  | Committing a Sprint Backlog or starting a Sprint while a selected item has an unverified active criterion                                 | The team's own agreement is applied at the boundary; the refusal names the items that are not ready |
| `GATE_DOR_TEAM_MEMBERS_ONLY` | 403  | Reading the agreement or a verification, or recording one, as a non-member                                                                | The agreement belongs to the team it describes                                                      |
| `GATE_DOR_SCRUM_MASTER_ONLY` | 403  | Replacing the agreement as a member who is not the team's Scrum Master                                                                    | One owner for what "ready" means                                                                    |

The last two are authorization, not process rules. The first two **can refuse the Guide's Sprint
Planning and Sprint start** — which is the point of enforcing a complementary practice, and is
disclosed in the project README outside its Guide-gate table so the distinction stays visible.

## Error Codes

| Code                   | HTTP Status | Description                                   |
| ---------------------- | ----------- | --------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed                     |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                       |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions or not a team member |
| `NOT_FOUND`            | 404         | Team or PBI not found                         |
| `CONFLICT`             | 409         | Resource conflict                             |

Gate refusals are returned with the reason codes listed under
[Gate rejections](#gate-rejections) rather than a generic `AUTHORIZATION_ERROR`, so the specific rule
that refused is machine-readable.

## Best Practices

### DoR Management

1. **Team Collaboration**: Agree the criteria collaboratively so the whole Scrum Team shares one understanding of readiness — then let the Scrum Master keep the written list current
2. **Practical Criteria**: Write DoR criteria that are practical and verifiable, not aspirational. Every criterion you add is one the team must verify for every item it commits
3. **Regular Review**: Revisit the DoR as the team matures. The Retrospective is the natural place: inspect whether each criterion still earns its keep
4. **Keep the identities**: When rewording a criterion, send its `id` so the row is updated rather than replaced — that is what preserves the verifications already recorded against it
5. **Balance**: The agreement is enforced at the Sprint boundary, so a criterion nobody can reasonably satisfy will block planning. Write the fewest criteria that genuinely protect the team

### DoR Verification

1. **Verify During Refinement**: Assess readiness during backlog refinement, well before the Sprint Backlog is committed
2. **Document Notes**: Use the notes field to capture context for why an item was or was not verified
3. **Enforced, not advisory**: An unverified active criterion refuses the Sprint Backlog commit and the Sprint start. If the team decides an item is ready anyway, the honest record is `isVerified: true` with a note explaining the judgement — not an unverified criterion that blocks the boundary
4. **Product Owner Involvement**: The Product Owner should be actively involved in ensuring DoR criteria are met
5. **Update as Understanding Evolves**: Re-verify DoR as the team's understanding of a PBI deepens

### Sprint Planning

1. **Use as Input**: The verification results are exactly what the commit gate reads, so review them before committing rather than discovering them through a refusal
2. **Risk Assessment**: Items that do not meet all DoR criteria carry higher risk; factor this into sprint commitments
3. **Continuous Improvement**: Track patterns of DoR non-compliance to identify systemic refinement gaps

---

**Last Updated**: 2026-09-22

**Related Documentation**

- [Definition of Done API](./definition-of-done.md)
- [Teams API](./teams.md)
- [Product Backlog API](./product-backlog.md)
- [Sprints API](./sprints.md)
- [Gate rejections (canonical list)](./README.md#gate-rejections)
