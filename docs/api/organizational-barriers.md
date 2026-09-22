# Organizational Barriers API

The register of barriers the Scrum Team cannot remove by itself.

The 2020 Scrum Guide gives the Scrum Master a service beyond the team: _"serving the organization
... removing barriers between stakeholders and Scrum Teams."_ The team's own **impediments** record
what blocks it from the inside; an **organizational barrier** records what blocks it from outside
and therefore needs someone with organizational authority. A barrier and its stakeholder actions
are deliberately a separate aggregate from an impediment:

- a barrier's owner may be anyone, including a stakeholder who is not on the team;
- its resolution is an agreement with the organization, not a team decision;
- it survives the deletion of the impediment it was escalated from, because the barrier is now the
  organization's problem rather than the team's record.

**Base path:** `/api/v1/organizational-barriers`

## Authorization

| Act                                                            | Who                                                                   |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Read the register, one barrier, or the escalatable impediments | A member of the team the register belongs to                          |
| Raise, amend, resolve, close or delete a barrier               | The team's Scrum Master                                               |
| Record, complete or delete a stakeholder action                | The team's Scrum Master                                               |
| Escalate an impediment into a barrier                          | The team's Scrum Master, and only for an impediment of that same team |

Authorization is enforced in the service layer, resolved from the _barrier's own team_ — a role held
in another team does not satisfy it. Routes that carry a `teamId` also assert the team context
before the handler runs, so a non-member is refused with the module's gate code rather than a
generic 403.

## Register

### List barriers

```http
GET /api/v1/organizational-barriers?teamId=<uuid>&status=OPEN&priority=HIGH
```

Returns the team's barriers, ordered impact-first (CRITICAL → LOW) and oldest-first within an impact
band. `status` and `priority` are optional filters.

```json
{
  "success": true,
  "data": [
    {
      "id": "0f0c1a6e-…",
      "teamId": "3b1f…",
      "sourceImpedimentId": "a71c…",
      "sourceImpedimentTitle": "Staging environment unavailable for two weeks",
      "title": "Staging environment is provisioned by another department",
      "description": "The team cannot verify an Increment before the Sprint Review.",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "ownerId": "9d2a…",
      "ownerName": "Ada Lovelace",
      "raisedById": "51be…",
      "raisedByName": "Grace Hopper",
      "targetDate": "2026-10-15T00:00:00.000Z",
      "resolution": null,
      "resolvedAt": null,
      "ageDays": 12,
      "isOverdue": false,
      "createdAt": "2026-09-10T09:00:00.000Z",
      "updatedAt": "2026-09-24T09:00:00.000Z"
    }
  ]
}
```

### Register counts

```http
GET /api/v1/organizational-barriers/stats?teamId=<uuid>
```

```json
{
  "success": true,
  "data": { "open": 1, "inProgress": 1, "resolved": 0, "closed": 0, "overdue": 1 }
}
```

`overdue` counts barriers past their target date that are neither `RESOLVED` nor `CLOSED`.

### Impediments available to escalate

```http
GET /api/v1/organizational-barriers/escalatable-impediments?teamId=<uuid>
```

Returns the team's `OPEN` and `IN_PROGRESS` impediments with their escalation state already
resolved (`escalatedBarrierId` / `escalatedBarrierTitle` are `null` when the impediment has not been
carried beyond the team). One query, no per-row probe.

### Read one barrier

```http
GET /api/v1/organizational-barriers/:id
```

Includes the stakeholder actions taken against the barrier, oldest first:

```json
{
  "success": true,
  "data": {
    "id": "0f0c1a6e-…",
    "title": "Staging environment is provisioned by another department",
    "actions": [
      {
        "id": "2f41…",
        "barrierId": "0f0c1a6e-…",
        "description": "Meet the platform group to agree a standing staging slot",
        "ownerId": "9d2a…",
        "ownerName": "Ada Lovelace",
        "dueDate": "2026-09-30T00:00:00.000Z",
        "status": "OPEN",
        "completedAt": null,
        "daysUntilDue": 8,
        "createdAt": "2026-09-24T09:00:00.000Z",
        "updatedAt": "2026-09-24T09:00:00.000Z"
      }
    ]
  }
}
```

`daysUntilDue` is negative once the due date has passed and `null` when no due date is set.

## Writes

### Raise a barrier

```http
POST /api/v1/organizational-barriers
Content-Type: application/json

{
  "teamId": "3b1f…",
  "title": "Procurement takes six weeks to sign a licence",
  "description": "The licence the team needs is bought through a process longer than a Sprint.",
  "priority": "CRITICAL",
  "ownerId": "9d2a…",
  "targetDate": "2026-10-15"
}
```

`ownerId` must be a user of the installation (the register has to be able to name who is
accountable); it does **not** have to be a team member. `targetDate` is an ISO date or timestamp.

### Escalate an impediment

```http
POST /api/v1/organizational-barriers/escalate
Content-Type: application/json

{
  "teamId": "3b1f…",
  "impedimentId": "a71c…",
  "title": "Staging is provisioned by another department",
  "priority": "HIGH",
  "ownerId": "9d2a…"
}
```

What the escalation does, in one transaction:

1. creates the barrier, linked to the impediment (`sourceImpedimentId` is **unique**, so the same
   impediment cannot be escalated twice — a racing second request is refused with
   `GATE_ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED` and names the barrier that won);
2. stamps the impediment's `escalatedAt` and increments `escalationCount`, so the impediment itself
   records that it was carried beyond the team;
3. notifies the barrier's owner (`ORGANIZATIONAL_BARRIER`), unless the owner is the caller.

Anything omitted from the body is carried over from the impediment (title, description, priority,
owner, and the impediment's Sprint is not used).

### Amend a barrier

```http
PUT /api/v1/organizational-barriers/:id
Content-Type: application/json

{ "status": "RESOLVED", "resolution": "The licence was signed on 20 September." }
```

- Any of `title`, `description`, `priority`, `ownerId`, `targetDate` may be amended.
- Reaching `RESOLVED` or `CLOSED` **requires** a written `resolution`
  (`GATE_ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED`). `resolvedAt` is stamped when the barrier
  reaches a terminal state, and cleared when it is reopened.

### Delete a barrier

```http
DELETE /api/v1/organizational-barriers/:id
```

Deleting a barrier deletes its stakeholder actions with it (cascading delete). Removing a barrier
that was escalated from an impediment does not delete the impediment; the impediment's
`escalatedAt` stamp remains as the record that it was once carried beyond the team.

## Stakeholder actions

Barrier removal is a sequence of conversations and decisions with people outside the team, so each
is recorded as its own row with an owner and a due date.

```http
POST   /api/v1/organizational-barriers/:id/actions
PUT    /api/v1/organizational-barriers/actions/:actionId
DELETE /api/v1/organizational-barriers/actions/:actionId
```

```json
{ "description": "Meet the platform group", "ownerId": "9d2a…", "dueDate": "2026-09-30" }
```

`PUT` accepts `description`, `status` (`OPEN` | `DONE` | `CANCELLED`), `ownerId` and `dueDate`.
Moving an action to `DONE` stamps `completedAt`; moving it back clears the stamp, so "done" is a
fact with a date rather than a checkbox.

## Gate rejections

| Code                                              | HTTP | When                                                           |
| ------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `GATE_ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY`   | 403  | The caller is not a member of the team the register belongs to |
| `GATE_ORGANIZATIONAL_BARRIER_SM_ONLY`             | 403  | The caller is not the team's Scrum Master                      |
| `GATE_ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED` | 400  | A terminal status was requested without a written resolution   |
| `GATE_ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED`   | 409  | The impediment already has a barrier                           |
| `GATE_ORGANIZATIONAL_BARRIER_SOURCE_NOT_OF_TEAM`  | 403  | The impediment belongs to another team                         |

## What the register does not do

- **No automatic escalation.** Nothing raises a barrier on the team's behalf: the Scrum Master
  decides that a problem is beyond the team. The dashboard surfaces aged impediments and offers the
  action; it does not take it.
- **No per-person scoring.** The register records who is accountable for removing a barrier; it
  produces no metric about the owner.
- **Owner selection in the interface** lists the team's members, because the installation has no
  user directory endpoint to search. An owner outside the team can be set through this API today;
  the interface limitation is recorded as a residual improvement in the module's evaluation.
