# Daily Scrum API

Complete Daily Scrum API reference for the team-level, goal-focused Daily Scrum (`/api/v1/daily-scrums`).

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Team-Level Daily Scrum Endpoints](#team-level-daily-scrum-endpoints)
  - [Get Today's Daily Scrum](#get-todays-daily-scrum)
  - [Get Daily Scrums for Sprint](#get-daily-scrums-for-sprint)
  - [Get Cadence](#get-cadence)
  - [Create Daily Scrum](#create-daily-scrum)
  - [Get Daily Scrum by ID](#get-daily-scrum-by-id)
  - [Update Daily Scrum](#update-daily-scrum)
  - [Record Participation](#record-participation)
  - [Get Participation](#get-participation)
  - [Send Team-Wide Signal](#send-team-wide-signal)
  - [Promote Impediment from Daily Scrum](#promote-impediment-from-daily-scrum)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Daily Scrum is a 15-minute event for the Developers to inspect progress toward the Sprint Goal and adapt the Sprint Backlog. Scrumooth models this as a **team-level record** per Sprint per day, not a per-user status report.

### Team-Level Daily Scrum (`/api/v1/daily-scrums`)

The team-level API provides:

- A single team-level Daily Scrum record per Sprint per date
- Goal-focused fields (`progressNotes`, `adaptationsNotes`, `planForNextDay`)
- Developer-chosen structure (`focusMode`) saved with the record
- An immutable **Sprint Goal snapshot** (`sprintGoal`) recording the goal the event inspected
- **Required adaptation evidence**: one or more typed Sprint Backlog adjustments (`backlogAdjustments`) or an explicit `noAdaptationNeeded` acknowledgement
- A computed per-adjustment **reflection verdict** reporting whether the Sprint Backlog has moved since the declaration
- Participation tracking (who contributed, not who "owes" a report)
- A neutral team-wide signal to gather the Developers
- Impediment promotion from the Daily Scrum to a formal record
- The team's standing cadence ([`/api/v1/daily-scrum-schedule`](./daily-scrum-schedule.md)) and its calendar-derived progress (`GET /:sprintId/cadence`)

## Authentication

All daily scrum endpoints require authentication. Include the access token in your request:

Reading endpoints are open to any team member. Because the Daily Scrum is an event for the Developers (Scrum Guide), the write endpoints that create, update, or record participation for a Daily Scrum require the caller to hold the **Developers** role in the sprint's team. A non-Developer (e.g. Product Owner or Scrum Master) receives `403 Forbidden` when attempting these operations.

**Using Cookies (Recommended)**

```http
GET /api/v1/daily-scrums/:sprintId/today
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/daily-scrums/:sprintId/today
Authorization: Bearer eyJhbGc...
```

## Team-Level Daily Scrum Endpoints

### Get Today's Daily Scrum

Get the team-level Daily Scrum for a sprint, defaulting to today.

**Endpoint**

```
GET /api/v1/daily-scrums/:sprintId/today
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Query Parameters**

- `date` (string, optional): Date in YYYY-MM-DD format. Defaults to today.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "scrumDate": "2026-05-10",
    "progressNotes": "On track toward the Sprint Goal",
    "adaptationsNotes": "Reassigned password-reset to Carol",
    "planForNextDay": "Carol and Bob pair on password-reset email",
    "focusMode": "goal",
    "participants": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "user": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        }
      }
    ],
    "backlogAdjustments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440040",
        "sprintBacklogItemId": "550e8400-e29b-41d4-a716-446655440050",
        "action": "reassigned",
        "sprintBacklogItem": {
          "id": "550e8400-e29b-41d4-a716-446655440050",
          "pbiId": "550e8400-e29b-41d4-a716-446655440060",
          "pbi": { "id": "550e8400-e29b-41d4-a716-446655440060", "title": "Password reset" }
        }
      }
    ]
  }
}
```

When no record exists for the date, `data` is `null`.

---

### Get Daily Scrums for Sprint

Get all team-level Daily Scrums for a sprint, optionally filtered by date.

**Endpoint**

```
GET /api/v1/daily-scrums/:sprintId
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Query Parameters**

- `date` (string, optional): Date in YYYY-MM-DD format

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "sprintId": "550e8400-e29b-41d4-a716-446655440000",
      "scrumDate": "2026-05-10",
      "progressNotes": "On track toward the Sprint Goal",
      "adaptationsNotes": null,
      "planForNextDay": "Pair on feature Y",
      "focusMode": "impediment",
      "participants": [],
      "backlogAdjustments": []
    }
  ]
}
```

---

### Get Cadence

Get the team's standing Daily Scrum commitment and its calendar-derived progress for a date, composed into one payload so the page needs no follow-up calls.

**Endpoint**

```
GET /api/v1/daily-scrums/:sprintId/cadence?date=2026-05-10
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Query Parameters**

- `date` (string, optional): `YYYY-MM-DD`. Defaults to today.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "schedule": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "teamId": "550e8400-e29b-41d4-a716-446655440001",
      "timezone": "Europe/Berlin",
      "startMinute": 570,
      "location": "Room 4",
      "locationUrl": null,
      "workingDays": [1, 2, 3, 4, 5],
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-05-01T08:00:00.000Z"
    },
    "calendar": {
      "workingDays": [1, 2, 3, 4, 5],
      "nonWorkingDays": ["2026-05-01"]
    },
    "date": "2026-05-10",
    "isWorkingDay": false,
    "nonWorkingDayName": "Labour Day",
    "sprintProgress": { "dayNumber": 6, "totalDays": 9 },
    "held": 5,
    "expected": 9,
    "missedDates": ["2026-05-04"]
  }
}
```

`schedule` is `null` while the team has not recorded a commitment. `held` counts every Daily Scrum record the Sprint holds, including one recorded on a day the calendar did not expect — the Developers decide when it is worth meeting. `missedDates` lists only expected working days that have **already passed** without a record, so a Sprint still running is never reported as having fallen behind.

`dayNumber` and `totalDays` are counted on the team's own working days, not on calendar days.

**Error Responses**

**404 Not Found - Sprint Not Found**

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Sprint not found" }
}
```

---

### Create Daily Scrum

Create the team-level Daily Scrum for a sprint on today's date. Only one record per Sprint per day is allowed.

**Endpoint**

```
POST /api/v1/daily-scrums/:sprintId
```

**Authentication**

- Required
- The caller must hold the **Developers** role in the sprint's team

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Request Body**

```json
{
  "scrumDate": "string (optional, YYYY-MM-DD; defaults to today)",
  "progressNotes": "string (optional, max 2000 chars)",
  "adaptationsNotes": "string (optional, max 2000 chars)",
  "planForNextDay": "string (required, max 2000 chars)",
  "focusMode": "'goal' | 'backlog' | 'impediment' | 'pair' (optional, null to clear)",
  "noAdaptationNeeded": "boolean (optional; acknowledge that no Sprint Backlog adaptation was needed)",
  "backlogAdjustments": [
    {
      "sprintBacklogItemId": "string (required, item UUID in this Sprint's Sprint Backlog)",
      "actionType": "'ADDED' | 'REMOVED' | 'REPRIORITIZED' | 'REFINED' | 'SPLIT' (required)",
      "action": "string (required, max 500 chars)"
    }
  ]
}
```

**Adaptation evidence (required).** The Guide states the purpose of the event is to adapt the Sprint Backlog, so a record must declare its outcome:

- `backlogAdjustments` with at least one entry, **or**
- `noAdaptationNeeded: true`

Sending both is contradictory and refused. `sprintGoal` is **not** accepted from the client: it is snapshotted from the Sprint at creation and never rewritten, so a caller cannot record having inspected a goal the Sprint never had. The creator is automatically recorded as a participant.

Each adjustment's state — the item's `updatedAt`, and its Product Backlog item's `status` and `updatedAt` — is read by the server at declaration time. The client never supplies it.

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "scrumDate": "2026-05-10",
    "progressNotes": "On track toward the Sprint Goal",
    "planForNextDay": "Pair on feature Y",
    "sprintGoal": "Deliver the reporting module",
    "noAdaptationNeeded": false,
    "participants": [],
    "backlogAdjustments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "sprintBacklogItemId": "550e8400-e29b-41d4-a716-446655440002",
        "pbiId": "550e8400-e29b-41d4-a716-446655440003",
        "pbiTitleAtAdjustment": "Password reset email",
        "actionType": "REPRIORITIZED",
        "action": "Brought forward before the review",
        "reflection": "REFLECTED",
        "reflectionBasis": "ITEM_UPDATED",
        "createdAt": "2026-05-10T09:12:00.000Z",
        "updatedAt": "2026-05-10T09:12:00.000Z",
        "sprintBacklogItem": {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "pbiId": "550e8400-e29b-41d4-a716-446655440003",
          "pbi": { "id": "550e8400-e29b-41d4-a716-446655440003", "title": "Password reset email" }
        }
      }
    ]
  }
}
```

`reflection` is `REFLECTED` when the Sprint Backlog has moved in the direction the declaration described, and `PENDING_REFLECTION` while nothing has moved yet. It is computed on read, not stored, so it stays truthful as the Sprint Backlog evolves. `reflectionBasis` names the observed evidence.

**Error Responses**

**400 Bad Request - Adaptation Evidence Required**

Returned when the record declares neither an adjustment nor an acknowledgement that none was needed, or when it declares both.

```json
{
  "success": false,
  "error": {
    "code": "GATE_DAILY_SCRUM_ADAPTATION_REQUIRED",
    "message": "A Daily Scrum must declare its adaptation outcome: at least one Sprint Backlog adjustment, or an explicit acknowledgement that none was needed."
  }
}
```

**409 Conflict - Record Already Exists**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "A Daily Scrum already exists for today. Please edit the existing record."
  }
}
```

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

---

### Get Daily Scrum by ID

Get a single team-level Daily Scrum by its identifier.

**Endpoint**

```
GET /api/v1/daily-scrums/record/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Daily Scrum UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "scrumDate": "2026-05-10",
    "progressNotes": "On track toward the Sprint Goal",
    "adaptationsNotes": null,
    "planForNextDay": "Pair on feature Y",
    "focusMode": "goal",
    "participants": [],
    "backlogAdjustments": []
  }
}
```

---

### Update Daily Scrum

Update the team-level Daily Scrum by ID.

**Endpoint**

```
PUT /api/v1/daily-scrums/record/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Daily Scrum UUID

**Request Body**

Same shape as the create request body, minus `scrumDate` (the record's date is fixed). `sprintGoal` is never accepted and never updated: the inspected baseline is written once, at creation.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "sprintId": "550e8400-e29b-41d4-a716-446655440000",
    "scrumDate": "2026-05-10",
    "progressNotes": "On track toward the Sprint Goal",
    "planForNextDay": "Adapted plan",
    "sprintGoal": "Deliver the reporting module",
    "noAdaptationNeeded": false,
    "participants": [],
    "backlogAdjustments": []
  }
}
```

When `backlogAdjustments` is provided, the existing adjustments are replaced wholesale, and each replacement re-takes the state snapshot it will later be judged against — the declaration is new, so its baseline is the state at the new declaration.

**Adaptation evidence** is checked against the record's **resulting** state, not the payload alone. Editing only the next-day plan on a record that already carries evidence is accepted; an edit that would leave the record with neither adjustments nor an acknowledgement is refused with the same `GATE_DAILY_SCRUM_ADAPTATION_REQUIRED` code as create. Setting `noAdaptationNeeded: true` together with `backlogAdjustments: []` is the supported way to switch a record from adjustments to an acknowledgement.

---

### Record Participation

Record the current user as a participant of a team-level Daily Scrum. This reflects contribution without creating a per-user report.

**Endpoint**

```
POST /api/v1/daily-scrums/record/:id/participate
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Daily Scrum UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": { "id": "550e8400-e29b-41d4-a716-446655440010" }
}
```

---

### Get Participation

Get participation for a sprint on a date, without status-report framing.

**Endpoint**

```
GET /api/v1/daily-scrums/:sprintId/participation
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Query Parameters**

- `date` (string, required): Date in YYYY-MM-DD format

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "dailyScrum": { "id": "550e8400-e29b-41d4-a716-446655440010" },
    "participants": [
      { "id": "550e8400-e29b-41d4-a716-446655440030", "userId": "550e8400-e29b-41d4-a716-446655440001", "userName": "John Doe" }
    ],
    "nonParticipants": [
      { "userId": "550e8400-e29b-41d4-a716-446655440002", "userName": "Jane Smith" }
    ]
  }
}
```

---

### Send Team-Wide Signal

Send a neutral team-wide Daily Scrum signal to gather the Developers who have **not yet joined** today's Daily Scrum. Because the Daily Scrum is a Developers-only event (Scrum Guide), the signal targets only non-joined Developers — Product Owner and Scrum Master are excluded, as are Developers who have already joined. It does not demand an individual report from anyone.

**Endpoint**

```
POST /api/v1/daily-scrums/:sprintId/team-signal
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sentCount": 2,
    "message": "Daily Scrum signal sent to 2 team members"
  }
}
```

**Notes**

- `sentCount` is the number of Developers who have not yet joined the Daily Scrum for today.
- The Product Owner, Scrum Master, and Developers who already joined do not receive the signal.

---

### Promote Impediment from Daily Scrum

Promote an impediment raised in a Daily Scrum into a formal Impediment record.

**Endpoint**

```
POST /api/v1/daily-scrums/:id/promote-impediment
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Daily Scrum UUID

**Request Body**

```json
{
  "title": "string (required, 3-200 chars)",
  "description": "string (required, 10-2000 chars)",
  "ownerId": "string (optional, user UUID)",
  "priority": "string (optional, one of: CRITICAL, HIGH, MEDIUM, LOW; defaults to MEDIUM)",
  "sprintId": "string (optional, sprint UUID; defaults to the Daily Scrum's sprint)",
  "targetDate": "string (optional, ISO date; empty value clears it)"
}
```

The team is derived server-side from the Daily Scrum record, so the body carries no `teamId`.
`priority` is the API's enum member, not a display label: `"High"` is rejected with 422
`VALIDATION_ERROR` as surely as any other unknown member.

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "dailyScrum": { "id": "550e8400-e29b-41d4-a716-446655440010" },
    "impediment": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "title": "API access blocked",
      "status": "OPEN"
    }
  }
}
```

## Error Codes

| Code                                   | HTTP Status | Description                                                                                         |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`                     | 400         | Request validation failed or business rule violation                                                |
| `GATE_DAILY_SCRUM_ADAPTATION_REQUIRED` | 400         | The record declares neither a Sprint Backlog adjustment nor that none was needed (or declares both) |
| `AUTHENTICATION_ERROR`                 | 401         | Authentication required                                                                             |
| `AUTHORIZATION_ERROR`                  | 403         | Insufficient permissions                                                                            |
| `GATE_DEVELOPER_ONLY_DAILY_SCRUM`      | 403         | The caller is not a Developer on the sprint's team                                                  |
| `NOT_FOUND`                            | 404         | Sprint or Daily Scrum record not found                                                              |
| `CONFLICT`                             | 409         | A Daily Scrum already exists for that Sprint and date                                               |

Message keys the API resolves into the response `message`:

| Key                                               | Raised when                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `validation:dailyScrum.planRequired`              | `planForNextDay` is missing or blank (create and update)                 |
| `validation:dailyScrum.adaptationRequired`        | The resulting record would carry no adaptation evidence                  |
| `validation:dailyScrum.adaptationExclusive`       | The record both lists adjustments and acknowledges that none were needed |
| `validation:dailyScrum.adjustmentItemNotInSprint` | An adjustment names an item that is not in this Sprint's Sprint Backlog  |
| `validation:dailyScrum.developersOnly`            | A non-Developer attempts to author or join the record                    |

## Best Practices

### Daily Update Management

1. **Timely Submissions**: Encourage team members to submit updates at the start of each working day
2. **Concise Updates**: Keep yesterdayWork, todayWork, and impediment descriptions clear and concise
3. **Impediment Promotion**: Promote impediments to formal records when they require team attention or tracking
4. **Reminder Etiquette**: Use the send-reminder endpoint judiciously; avoid spamming team members

### Security

1. **Author-Only Edits**: Only the update author can modify or delete their daily updates
2. **Audit Trail**: All daily update changes are tracked with createdBy and updatedBy fields
3. **Team Scoping**: Daily updates are scoped to sprints within the team context

### Integration Tips

1. **Date Filtering**: Use the `date` query parameter to retrieve updates for specific days rather than fetching all
2. **Team Status**: Use the team-status endpoint to build daily standup dashboards showing who has and has not submitted
3. **Impediment Workflow**: After promoting an impediment, use the Impediments API to track resolution progress

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Authentication API](./authentication.md)
- [Impediments API](./impediments.md)
- [Sprints API](./sprints.md)
- [Teams API](./teams.md)
