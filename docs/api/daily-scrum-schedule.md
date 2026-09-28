# Daily Scrum Schedule API

API reference for the team's standing Daily Scrum commitment and its working-day calendar (`/api/v1/daily-scrum-schedule`).

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Schedule Endpoints](#schedule-endpoints)
  - [Get Schedule](#get-schedule)
  - [Save Schedule](#save-schedule)
- [Non-Working Day Endpoints](#non-working-day-endpoints)
  - [List Non-Working Days](#list-non-working-days)
  - [Add Non-Working Day](#add-non-working-day)
  - [Delete Non-Working Day](#delete-non-working-day)
- [Validation Rules](#validation-rules)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The 2020 Scrum Guide has the Daily Scrum held "at the same time and place every working day". A record of the event is not the same thing as a commitment to hold it, so Scrumooth persists the commitment itself — **one row per team** — and derives the number of Daily Scrums a Sprint should hold from the team's own calendar instead of assuming five per week.

The module is made of two records:

- **`DailyScrumSchedule`** — the standing commitment: start time, the IANA time zone that time is expressed in, the place (a room, a validated meeting link, or both), and the ISO weekday numbers the team works.
- **`TeamNonWorkingDay`** — dated exceptions to the weekly pattern: public holidays, company days off, team offsites. Only exceptions are stored; the weekly pattern stays the default.

**The schedule deliberately stores no duration.** The Daily Scrum is a fixed 15-minute timebox ([`timeboxFor`](../../packages/shared/src/utils/timebox.ts)) that does not scale with Sprint length, so only the start is configurable. A configurable duration would contradict the Guide's timebox and is out of scope.

**The calendar informs; it does not restrict.** Nothing here gates a Daily Scrum: a team may hold and record the event on any day, and a record on a day the calendar did not expect still counts as held. The calendar is used to explain ("today is not a working day for this team"), to count ("Sprint day X of Y"), and to evidence ("3 of 5 due working days recorded").

Consumers: the cadence payload is composed by [`GET /api/v1/daily-scrums/:sprintId/cadence`](./daily-scrum.md#get-cadence), and the same calendar drives the expected-count and missed-date figures on the Scrum Master dashboard.

## Authentication

All endpoints require authentication, and every request must name the team — `teamId` in the query string for `GET`/`DELETE`, in the body for `POST`/`PUT`, or via the `X-Team-Id` header. The team-context middleware accepts any of these, then looks the caller up as a member of the named team before the request reaches a handler, so a caller cannot read or write another team's schedule by supplying a different identifier. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

There are two permission levels:

- **Reading** (`GET`) is open to any member of the team. A cadence nobody can see is not a commitment.
- **Writing** (`PUT`, `POST`, `DELETE`) requires the **Scrum Master** role in that team, because the Scrum Master is accountable for ensuring the Scrum events take place. A Developer or Product Owner attempting a write receives `403 Forbidden`.

## Schedule Endpoints

### Get Schedule

Get the team's standing commitment.

**Endpoint**

```
GET /api/v1/daily-scrum-schedule
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "teamId": "550e8400-e29b-41d4-a716-446655440001",
    "timezone": "Europe/Berlin",
    "startMinute": 570,
    "location": "Room 4",
    "locationUrl": null,
    "workingDays": [1, 2, 3, 4, 5],
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-05-01T08:00:00.000Z"
  }
}
```

`data` is **`null`** while the team has not recorded a commitment. Callers should treat that as "not yet configured" rather than as an error, and should fall back to the Monday-to-Friday week.

`startMinute` is the start of the event as **minutes after local midnight** in `timezone` (0-1439). The API stores an offset rather than a formatted time so it has one unambiguous shape and the interface owns how the time is displayed.

---

### Save Schedule

Record or revise the team's commitment. One row per team, so this is an upsert: the first call creates it and later calls revise it.

**Endpoint**

```
PUT /api/v1/daily-scrum-schedule
```

**Authentication**

- Required, **Scrum Master** role in the team

**Request Body**

```json
{
  "timezone": "Europe/Berlin",
  "startMinute": 570,
  "location": "Room 4",
  "locationUrl": null,
  "workingDays": [1, 2, 3, 4, 5]
}
```

- `startMinute` (integer, required): 0-1439.
- `timezone` (string, optional): an IANA zone the runtime can resolve. Defaults to `UTC`.
- `location` (string, optional, max 200 chars): a room or other plain-text place.
- `locationUrl` (string, optional, max 2048 chars): a meeting link. Must be a URL with an `http` or `https` protocol.
- `workingDays` (number[], optional): a non-empty, deduplicated subset of `1`-`7` (ISO weekday numbers, `1` = Monday). Defaults to `[1, 2, 3, 4, 5]`. Normalised to Monday-first order.

**At least one of `location` or `locationUrl` is required.** The place is half the commitment the Guide names, so a schedule that records neither is refused.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "teamId": "550e8400-e29b-41d4-a716-446655440001",
    "timezone": "Europe/Berlin",
    "startMinute": 570,
    "location": "Room 4",
    "locationUrl": null,
    "workingDays": [1, 2, 3, 4, 5],
    "createdAt": "2026-05-01T08:00:00.000Z",
    "updatedAt": "2026-06-02T09:30:00.000Z"
  }
}
```

Every write records `updatedBy` (and `createdBy` on the first write) with the acting user's identifier.

**Error Responses**

**400 Bad Request - Invalid schedule**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Choose a time zone the system recognises."
  }
}
```

Raised for an unresolvable time zone, a start minute outside 0-1439, an empty or out-of-range working week, no place at all, an over-long place, or a `locationUrl` that is not an `http`/`https` URL.

**403 Forbidden - Scrum Master role required**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "This action requires the SCRUM_MASTER role"
  }
}
```

---

## Non-Working Day Endpoints

### List Non-Working Days

List the team's dated exceptions within a bounded window.

**Endpoint**

```
GET /api/v1/daily-scrum-schedule/non-working-days?from=2026-01-01&to=2026-12-31
```

**Query Parameters**

- `from` (string, optional): `YYYY-MM-DD`. Defaults to 1 January of the current year.
- `to` (string, optional): `YYYY-MM-DD`. Defaults to 31 December of the current year.

The window is **capped at one year**. A wider request is refused rather than served, because an unbounded read has no useful interpretation for a calendar.

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440021",
      "teamId": "550e8400-e29b-41d4-a716-446655440001",
      "date": "2026-05-01",
      "name": "Labour Day",
      "createdAt": "2026-04-02T10:00:00.000Z"
    }
  ]
}
```

Returned in ascending date order.

---

### Add Non-Working Day

Record a dated exception. A team records an exception only when a day differs from its weekly pattern.

**Endpoint**

```
POST /api/v1/daily-scrum-schedule/non-working-days
```

**Authentication**

- Required, **Scrum Master** role in the team

**Request Body**

```json
{
  "date": "2026-05-01",
  "name": "Labour Day"
}
```

- `date` (string, required): `YYYY-MM-DD`, and a date that actually exists.
- `name` (string, optional, max 120 chars): a label; `null` is accepted.

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440021",
    "teamId": "550e8400-e29b-41d4-a716-446655440001",
    "date": "2026-05-01",
    "name": "Labour Day",
    "createdAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**Error Responses**

**409 Conflict - Day already recorded**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "That day is already recorded as a non-working day."
  }
}
```

The `(teamId, date)` unique index is the arbiter, so two Scrum Masters adding the same holiday concurrently produce one row and one `409` — never a duplicate.

---

### Delete Non-Working Day

Remove a recorded exception.

**Endpoint**

```
DELETE /api/v1/daily-scrum-schedule/non-working-days/:id
```

**Authentication**

- Required, **Scrum Master** role in the team

**Path Parameters**

- `id` (string, required): non-working day UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": null
}
```

The delete is scoped to `(id, teamId)`: a member of one team cannot delete another team's exception, and a caller cannot learn whether a row it does not own exists. Deleting an exception that is not in the caller's team returns `404 Not Found`.

---

## Validation Rules

| Field                | Rule                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `timezone`           | Must be resolvable by `Intl`; the check degrades safely where `Intl.supportedValuesOf` is absent |
| `startMinute`        | Integer, 0-1439                                                                                  |
| `workingDays`        | Non-empty, deduplicated subset of `1`-`7`; normalised to Monday-first order                      |
| `location`           | At most 200 characters                                                                           |
| `locationUrl`        | URL with an `http` or `https` protocol allowlist                                                 |
| place (either field) | At least one of `location` or `locationUrl` must be present                                      |
| non-working `date`   | `YYYY-MM-DD` and a real calendar date                                                            |
| non-working `name`   | At most 120 characters                                                                           |
| list window          | `from`/`to` `YYYY-MM-DD`, `from` not after `to`, span at most one year                           |

## Error Codes

| Code                   | HTTP Status | Description                                                      |
| ---------------------- | ----------- | ---------------------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed, including an over-wide listing window |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                          |
| `AUTHORIZATION_ERROR`  | 403         | The caller does not hold the Scrum Master role in the team       |
| `NOT_FOUND`            | 404         | The non-working day is not in the caller's team                  |
| `CONFLICT`             | 409         | That date is already recorded as a non-working day               |

Message keys the API resolves into the response `message`:

| Key                                                | Raised when                                            |
| -------------------------------------------------- | ------------------------------------------------------ |
| `validation:dailyScrumSchedule.timezoneInvalid`    | The time zone is not one the system recognises         |
| `validation:dailyScrumSchedule.startMinuteInvalid` | The start minute is outside 0-1439                     |
| `validation:dailyScrumSchedule.workingDaysInvalid` | The working week is empty or out of range              |
| `validation:dailyScrumSchedule.placeRequired`      | Neither a room nor a meeting link was given            |
| `validation:dailyScrumSchedule.placeTooLong`       | The room exceeds 200 characters                        |
| `validation:dailyScrumSchedule.locationUrlInvalid` | The meeting link is not a valid `http`/`https` address |
| `validation:dailyScrumSchedule.dateInvalid`        | The date is not a valid `YYYY-MM-DD` date              |
| `validation:dailyScrumSchedule.dateDuplicate`      | That date is already recorded for this team            |
| `validation:dailyScrumSchedule.nameTooLong`        | The name exceeds 120 characters                        |
| `validation:dailyScrumSchedule.windowTooWide`      | The listing window exceeds one year                    |

## Best Practices

### Recording the Commitment

1. **Record it once, together.** Set the schedule in the team's first Sprint so the commitment is visible from the start; the cadence strip on the Daily Scrum page shows "not yet configured" until it exists.
2. **Use the team's real working week.** If the team does not work Fridays, say so — "Sprint day X of Y" and the Scrum Master dashboard both count on this pattern, and a wrong pattern produces wrong-but-confident numbers.
3. **Add exceptions, not whole calendars.** Only days that differ from the weekly pattern need a row: public holidays, company days off, team offsites.

### Reading the Cadence

1. **Treat `held` / `expected` as a signal, never a score.** The calendar evidences what happened; it does not judge the team for meeting on a different day, or for a Sprint still in flight.
2. **Read `missedDates` only past today.** A Sprint that started this morning has missed nothing; the endpoint already excludes days that have not arrived.
3. **Fall back gracefully.** When `schedule` is `null`, use the Monday-to-Friday week rather than failing — that is what the backend does.

---

**Last Updated**: 2026-09-21

**Related Documentation**

- [Daily Scrum API](./daily-scrum.md)
- [Sprints API](./sprints.md)
- [Teams API](./teams.md)
- [Authentication API](./authentication.md)
