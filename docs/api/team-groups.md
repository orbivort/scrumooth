# Team Groups API

A **team group** is a set of Scrum Teams working together on one product, bound to a single
Definition of Done.

The 2020 Scrum Guide:

> _"If there are multiple Scrum Teams working together on a product, they must mutually define and
> comply with the same Definition of Done."_

Scrumooth modelled a team and a team-owned Definition of Done, so two teams on one product could
hold two different Definitions of Done and nothing could express the rule. A group makes it
structural:

- The **group owns the only Definition of Done row** its teams read. A member team's own row is
  retained but inert, so the teams cannot diverge by construction rather than by agreement.
- **Joining records the version adopted** (`Team.groupDodVersionAtJoin`). A later change to the
  shared Definition of Done leaves that number behind, which is what makes the drift visible.
- A grouped team **cannot edit its own Definition of Done**
  (`409 GATE_DOD_GROUP_GOVERNED`): a team that could would not be complying with the same one, and
  the change would be invisible to the teams that share it.
- A group is a **product-collaboration device, not a team decomposition**: nothing inside a Scrum
  Team changes, so _"no sub-teams or hierarchies"_ is not infringed.

## Where this lives in the product

| Task                                           | Screen                                              | Endpoints                                                       |
| ---------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| Browse and manage groups, read the roster      | **Settings → Team → Team Groups**                   | `GET/POST /team-groups`, `GET/PUT/DELETE /team-groups/:groupId` |
| Read and replace the shared Definition of Done | **Settings → Team → Team Groups**                   | `GET/PUT /team-groups/:groupId/shared-definition-of-done`       |
| Join or leave a group                          | **Team → Scrum Health → Shared Definition of Done** | `POST/DELETE /teams/:teamId/group`                              |

A grouped team's own Definition of Done panel (**Settings → Team → Team Definitions**) becomes
read-only and links to the group that governs it, so the interface never offers an edit the API would
refuse with `GATE_DOD_GROUP_GOVERNED`.

See the [Team Groups user guide](../user-guide/core-features/team-groups.md) for the same rules told
from a user's point of view.

## Authentication

All endpoints require authentication. What each caller may then do is decided by the group's own
roster: a role held in some other team is not a role here.

## Reading a group

| Endpoint                                                     | Who                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `GET /api/v1/team-groups`                                    | Any authenticated caller — the directory                                          |
| `GET /api/v1/team-groups/:groupId/shared-definition-of-done` | Any authenticated caller — the commitment a joining team would adopt              |
| `GET /api/v1/team-groups/:groupId`                           | A member of one of the group's teams, or the account that created it — the roster |

The two open reads are open by necessity rather than indifference: a team cannot join a
collaboration it cannot find, and it cannot _mutually define_ a Definition of Done it is not allowed
to read before agreeing to it. The directory is deliberately thin (name, description, team count,
shared Definition of Done version), and the roster remains the group's own business
(`403 GATE_TEAM_GROUP_MEMBERS_ONLY`).

## Writing

| Endpoint                                                     | Who                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `POST /api/v1/team-groups`                                   | Any authenticated caller — the group is created together with the Definition of Done it will own      |
| `PUT /api/v1/team-groups/:groupId`                           | Product Owner or Scrum Master of one of its teams                                                     |
| `DELETE /api/v1/team-groups/:groupId`                        | Product Owner or Scrum Master of one of its teams; `409 GATE_TEAM_GROUP_NOT_EMPTY` while teams remain |
| `PUT /api/v1/team-groups/:groupId/shared-definition-of-done` | Product Owner or Scrum Master of one of its teams                                                     |

Before any team has joined, there is no team leadership to consult, so the account that created the
group may act on it. Once teams have joined, the group belongs to their leadership.

### Create a group

```http
POST /api/v1/team-groups
Content-Type: application/json

{
  "name": "Payments product",
  "description": "Two teams, one product, one Definition of Done."
}
```

```json
{
  "success": true,
  "data": {
    "id": "0199a2c1-...",
    "name": "Payments product",
    "description": "Two teams, one product, one Definition of Done.",
    "teamCount": 0,
    "dodVersion": 1,
    "teams": [],
    "definitionOfDone": {
      "groupId": "0199a2c1-...",
      "version": 1,
      "updatedAt": "2026-09-24T12:00:00.000Z",
      "items": [
        {
          "id": "...",
          "description": "Code is peer-reviewed and approved",
          "category": "review",
          "isActive": true,
          "order": 0
        }
      ]
    }
  }
}
```

A group is created **with** a Definition of Done, because "adopt the shared Definition of Done" is
only a meaningful act if there is one to adopt.

### Replace the shared Definition of Done

```http
PUT /api/v1/team-groups/:groupId/shared-definition-of-done
Content-Type: application/json

{
  "items": [
    { "description": "Code is peer-reviewed and approved", "category": "review", "isActive": true, "order": 0 },
    { "description": "Deployed to staging and demonstrated", "category": "delivery", "isActive": true, "order": 1 }
  ]
}
```

Refused with `400 GATE_DOD_REQUIRED` when the new version would hold no active item, and every
superseded version is preserved in the append-only history exactly as a team's own Definition of
Done is. One change, seen by every team that shares the commitment.

## Joining and leaving

A team's membership is a team sub-resource, so it is addressed on the team:

```http
POST /api/v1/teams/:teamId/group
Content-Type: application/json

{ "groupId": "0199a2c1-...", "acknowledgedDodVersion": 1 }
```

```json
{
  "success": true,
  "data": {
    "id": "0199a2c1-...",
    "name": "Payments product",
    "teamCount": 1,
    "dodVersion": 1
  }
}
```

| Refusal                                            | When                                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `403 GATE_TEAM_GROUP_LEADERSHIP_ONLY`              | The caller is not the team's Product Owner or Scrum Master                                                                                                     |
| `409 GATE_TEAM_GROUP_ALREADY_MEMBER`               | The team already complies with a group's Definition of Done                                                                                                    |
| `400 GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED` | `acknowledgedDodVersion` is missing, or is not the version in force. The refusal names the version in force, so the recovery is "review it and adopt that one" |

```http
DELETE /api/v1/teams/:teamId/group
```

Leaving is not a deletion of anything: the team's own Definition of Done is rewritten with the items
it has been complying with — through the ordinary versioned update, so the change is snapshotted like
any other — and only then is the membership cleared. A team is never left without a commitment, or
with whichever inert row it happened to keep.

## Errors

```json
{
  "success": false,
  "error": {
    "code": "GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED",
    "message": "Joining a group means adopting its shared Definition of Done. Name the version you are adopting — the group's current version is 2 — so the team's compliance is recorded rather than assumed."
  }
}
```

All gate codes are listed in the [API overview](./README.md#gate-rejections).

## Guarantees that hold under concurrency

- **One shared Definition of Done per group**: `definition_of_done.groupId` is unique, and
  `CHECK ((team_id IS NULL) <> (group_id IS NULL))` means a Definition of Done always has exactly one
  owner and can never be owned by nobody.
- **A group cannot be removed out from under its teams**: `teams.groupId` is
  `ON DELETE RESTRICT`. A join that wins the race against a delete is therefore refused by the
  database and reported as `409 GATE_TEAM_GROUP_NOT_EMPTY` rather than as a server error.
- **Membership is recorded whole or not at all**: `CHECK ((group_id IS NULL) = (group_joined_at IS
NULL) AND (group_id IS NULL) = (group_dod_version_at_join IS NULL))`.

## Documented limitation

`docs/api/reports.md` and the README scope reports and dashboards to a single team. A group binds the
_Definition of Done_ of several teams; it does not introduce a product-level backlog, product-level
reporting, or a product entity. Teams in a group keep their own Product Backlog, Product Goal,
Sprints and reports.
