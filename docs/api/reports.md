# Reports API

Complete Reports API reference for reporting and analytics endpoints. These endpoints are distributed across existing API route groups rather than forming a separate route group.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Available Reports](#available-reports)
- [Endpoints](#endpoints)
  - [Get Burndown Chart Data](#get-burndown-chart-data)
  - [Get DoD Compliance Report](#get-dod-compliance-report)
  - [Get Increment Delivery Metrics](#get-increment-delivery-metrics)
  - [Get Impediment Statistics](#get-impediment-statistics)
  - [Get Sprint Velocity Data](#get-sprint-velocity-data)
  - [Get Pending Action Items](#get-pending-action-items)
- [Burndown Charts](#burndown-charts)
- [Velocity Tracking](#velocity-tracking)
- [DoD Compliance](#dod-compliance)
- [Increment Metrics](#increment-metrics)
- [Impediment Analytics](#impediment-analytics)
- [Action Item Tracking](#action-item-tracking)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Reports API documents the reporting and analytics endpoints available through existing API routes. These endpoints are not a separate route group but are gathered from various endpoints across the API, providing insights into sprint progress, team velocity, Definition of Done compliance, increment delivery, impediment resolution, and retrospective action items.

## Authentication

All report endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Available Reports

| Report                | Endpoint                                                       | Route Group    | Description                                                    |
| --------------------- | -------------------------------------------------------------- | -------------- | -------------------------------------------------------------- |
| Burndown Chart        | `GET /api/v1/sprints/:sprintId/burndown`                       | Sprints        | Sprint progress with ideal vs actual task lines                |
| DoD Compliance        | `GET /api/v1/sprints/:sprintId/dod-compliance`                 | Sprints        | Definition of Done compliance percentage                       |
| Increment Metrics     | `GET /api/v1/increments/metrics?teamId=uuid`                   | Increments     | Delivery rate and story point metrics                          |
| Impediment Statistics | `GET /api/v1/impediments/stats?teamId=uuid`                    | Impediments    | Impediment counts and resolution time                          |
| Sprint Velocity       | `GET /api/v1/sprints?teamId=uuid`                              | Sprints        | Sprint history with story points for velocity                  |
| Action Item Tracking  | `GET /api/v1/retrospectives/team/:teamId/pending-action-items` | Retrospectives | Pending vs completed retrospective action items                |
| Team Reports          | `GET /api/v1/reports/velocity?teamId=uuid`                     | Reports        | Planned vs completed points per Sprint, with provenance        |
| Sprint History        | `GET /api/v1/reports/sprint-history?teamId=uuid`               | Reports        | Per-Sprint record: Sprint Goal verdict, points, items, members |
| Team Metrics          | `GET /api/v1/reports/metrics?teamId=uuid`                      | Reports        | The observed record: average, range, coverage, verdicts        |
| Observations          | `GET /api/v1/reports/insights?teamId=uuid`                     | Reports        | Signals to inspect, each naming the evidence behind it         |

## Reports Module (`/api/v1/reports`)

Four read-only endpoints, each scoped to one team and answered in the request's locale. They are the
team's own observed history read back for inspection, so nothing here is a target and no figure is
turned into an alert.

### Access control

The team is resolved from `teamId`, and the caller's membership of it is verified twice: by the
team-context middleware on the route, and again in the service layer before the report cache is
consulted. The second check matters because the cache is keyed by team alone and shared across
callers -- answering from it first would hand a non-member another caller's payload.

| Code                             | HTTP | Meaning                                                   |
| -------------------------------- | ---- | --------------------------------------------------------- |
| `GATE_REPORTS_TEAM_MEMBERS_ONLY` | 403  | A report belongs to the Scrum Team whose history it reads |

Every read is recorded in the audit log as `REPORTS.VIEW` with the team and the report name, never
with the payload. A request with no usable `teamId` is answered `400 BAD_REQUEST` by the
team-context gate, which runs before any handler.

### Where the numbers come from

A closed Sprint's points are read from the immutable record written at the moment it closed, never
from the live Product Backlog item statuses: a status change made later must not rewrite what a
Sprint delivered. Where that record does not exist -- Sprints closed before it was introduced --
completion is rebuilt from the recorded status history of the Sprint's own items, taking the latest
transition at or before the Sprint's end date, so an item reopened afterwards still counts as done
at the time.

Every point therefore carries a `provenance`:

| `provenance`    | Meaning                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| `recorded`      | Frozen when the Sprint closed                                                |
| `reconstructed` | Derived from the Sprint's recorded status history                            |
| `in_progress`   | The Sprint is still running; the reading is live and will be frozen at close |
| `not_available` | The evidence does not survive                                                |

A `not_available` point is returned as `null` and left out of every average. It is never reported as
`0`: a missing observation and an observation of nothing are different facts. For the same reason an
average over no observable Sprints is `null`, not `0`.

### `GET /api/v1/reports/velocity`

```json
{
  "success": true,
  "data": {
    "points": [
      {
        "sprintId": "019...",
        "sprintName": "Sprint-2w-2601",
        "status": "COMPLETED",
        "plannedPoints": 21,
        "completedPoints": 18,
        "provenance": "recorded"
      },
      {
        "sprintId": "019...",
        "sprintName": "Sprint-2w-2602",
        "status": "COMPLETED",
        "plannedPoints": null,
        "completedPoints": null,
        "provenance": "not_available"
      }
    ],
    "averageCompletedPoints": 18,
    "observedSprints": 1,
    "unavailableSprints": 1
  }
}
```

`averageCompletedPoints` is an average of the evidence, not a figure to plan to: the Guide names no
metric as a target, and a Sprint's capacity is a judgement the Developers make about the work in
front of them.

### `GET /api/v1/reports/sprint-history`

One entry per Sprint, newest first, over the last ten Sprints the team has:

```json
{
  "success": true,
  "data": [
    {
      "id": "019...",
      "name": "Sprint-2w-2601",
      "startDate": "2026-01-05T00:00:00.000Z",
      "endDate": "2026-01-16T00:00:00.000Z",
      "status": "COMPLETED",
      "sprintGoal": "Ship the reports view",
      "plannedPoints": 21,
      "completedPoints": 18,
      "provenance": "recorded",
      "itemCount": 5,
      "completedItemCount": 4,
      "sprintGoalOutcome": "PARTIALLY_ACHIEVED",
      "sprintGoalNote": "Impediment tracking slipped into the next Sprint.",
      "teamMembers": 5,
      "impediments": 1
    }
  ]
}
```

`sprintGoalOutcome` is the Scrum Team's own recorded verdict -- `ACHIEVED`, `PARTIALLY_ACHIEVED`, or
`NOT_ACHIEVED` -- and is `null` when the Sprint Goal was never assessed. It is **never** derived from
`completedItemCount`: a Sprint can meet its Goal without completing every item, and complete every
item without meeting its Goal. Sprints whose completion could not be established carry `null` points
and `provenance: "not_available"`.

### `GET /api/v1/reports/metrics`

The observed record over the last ten closed Sprints.

```json
{
  "success": true,
  "data": {
    "averageCompletedPoints": 19.5,
    "observedSprints": 6,
    "totalSprints": 10,
    "minCompletedPoints": 12,
    "maxCompletedPoints": 26,
    "completionRate": 67,
    "sprintGoalAssessed": 4,
    "sprintGoalVerdicts": { "achieved": 2, "partiallyAchieved": 1, "notAchieved": 1 },
    "itemCompletion": { "totalItems": 42, "completedItems": 35, "rate": 83 },
    "impediments": { "resolved": 7, "total": 9 }
  }
}
```

- `completionRate` is a points-completion signal only -- the share of _observed_ Sprints whose
  planned points were fully delivered. It is not an assertion that the Sprint Goal was met; only
  the team's recorded verdict says that.
- `sprintGoalAssessed` counts Sprints carrying a recorded verdict, so coverage is visible next to
  the distribution rather than implied by it.
- `itemCompletion` is published beside the verdicts, under its own label, because it is useful and
  it is a different fact.

### `GET /api/v1/reports/insights`

```json
{
  "success": true,
  "data": [
    {
      "id": "completed-points-history",
      "kind": "observation",
      "icon": "history",
      "title": "Completed points history",
      "description": "Across the last 6 observed Sprints the team completed 19.5 points on average...",
      "evidence": "Read from each Sprint's closing record (6 recorded, 0 reconstructed from status history)"
    }
  ]
}
```

`kind` is descriptive: `observation` states a fact about the team's own record, `attention` points at
work the team may want to inspect (aging impediments, Definition of Done gaps, churn that endangers
the Sprint Goal). There is deliberately no positive/negative kind and no velocity alert: a signal
about the team's history is not a grade, and labelling one would turn the number behind it into a
target. Every signal carries the `evidence` it was read from, so the claim can be checked rather
than trusted.

Insight copy is translated server-side from the request's locale.

## Endpoints

### Get Burndown Chart Data

Get burndown chart data for a specific sprint, including ideal and actual progress lines.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/burndown
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
    "burndown": {
      "sprintId": "550e8400-e29b-41d4-a716-446655440030",
      "startDate": "2026-04-28T00:00:00.000Z",
      "endDate": "2026-05-11T23:59:59.000Z",
      "idealLine": [
        { "date": "2026-04-28", "remaining": 20 },
        { "date": "2026-04-29", "remaining": 18 },
        { "date": "2026-04-30", "remaining": 16 },
        { "date": "2026-05-01", "remaining": 14 },
        { "date": "2026-05-02", "remaining": 12 },
        { "date": "2026-05-05", "remaining": 10 },
        { "date": "2026-05-06", "remaining": 8 },
        { "date": "2026-05-07", "remaining": 6 },
        { "date": "2026-05-08", "remaining": 4 },
        { "date": "2026-05-09", "remaining": 2 },
        { "date": "2026-05-11", "remaining": 0 }
      ],
      "actualLine": [
        { "date": "2026-04-28", "remaining": 20 },
        { "date": "2026-04-29", "remaining": 19 },
        { "date": "2026-04-30", "remaining": 17 },
        { "date": "2026-05-01", "remaining": 15 },
        { "date": "2026-05-02", "remaining": 14 },
        { "date": "2026-05-05", "remaining": 11 },
        { "date": "2026-05-06", "remaining": 8 },
        { "date": "2026-05-07", "remaining": 5 },
        { "date": "2026-05-08", "remaining": 3 },
        { "date": "2026-05-09", "remaining": 1 }
      ],
      "tasksTotal": 20,
      "tasksCompleted": 19
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
    "message": "Sprint not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/sprints/550e8400-e29b-41d4-a716-446655440030/burndown \
  -b cookies.txt
```

---

### Get DoD Compliance Report

Get Definition of Done compliance report for a specific sprint.

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
      "totalPBIs": 10,
      "compliantPBIs": 8,
      "complianceRate": 80.0,
      "itemResults": [
        {
          "pbiId": "550e8400-e29b-41d4-a716-446655440040",
          "title": "User login page",
          "compliant": true,
          "checklistResults": [
            { "criterion": "Code reviewed", "passed": true },
            { "criterion": "Unit tests written", "passed": true },
            { "criterion": "Documentation updated", "passed": true }
          ]
        },
        {
          "pbiId": "550e8400-e29b-41d4-a716-446655440041",
          "title": "Password reset flow",
          "compliant": false,
          "checklistResults": [
            { "criterion": "Code reviewed", "passed": true },
            { "criterion": "Unit tests written", "passed": false },
            { "criterion": "Documentation updated", "passed": false }
          ]
        }
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
    "message": "Sprint not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/sprints/550e8400-e29b-41d4-a716-446655440030/dod-compliance \
  -b cookies.txt
```

---

### Get Increment Delivery Metrics

Get increment delivery metrics for a specific team.

**Endpoint**

```
GET /api/v1/increments/metrics
```

**Authentication**

- Required
- User must be a team member

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
      "averageStoryPoints": 23.5,
      "deliveryRate": 83.3
    }
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
    "message": "teamId query parameter is required"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/increments/metrics?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Get Impediment Statistics

Get impediment statistics for a specific team.

**Endpoint**

```
GET /api/v1/impediments/stats
```

**Authentication**

- Required
- User must be a team member

**Query Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "stats": {
      "open": 3,
      "inProgress": 2,
      "resolved": 15,
      "closed": 10,
      "averageResolutionTime": "2.5 days"
    }
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
    "message": "teamId query parameter is required"
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/impediments/stats?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Get Sprint Velocity Data

Get sprint history with story points for velocity calculation.

**Endpoint**

```
GET /api/v1/sprints
```

**Authentication**

- Required
- User must be a team member

**Query Parameters**

- `teamId` (string, required): Team UUID - filters sprints by team for velocity calculation

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "sprints": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "name": "Sprint 5",
        "status": "COMPLETED",
        "startDate": "2026-04-28T00:00:00.000Z",
        "endDate": "2026-05-11T23:59:59.000Z",
        "storyPointsCommitted": 25,
        "storyPointsCompleted": 23
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440031",
        "name": "Sprint 4",
        "status": "COMPLETED",
        "startDate": "2026-04-14T00:00:00.000Z",
        "endDate": "2026-04-27T23:59:59.000Z",
        "storyPointsCommitted": 20,
        "storyPointsCompleted": 20
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440032",
        "name": "Sprint 3",
        "status": "COMPLETED",
        "startDate": "2026-03-31T00:00:00.000Z",
        "endDate": "2026-04-13T23:59:59.000Z",
        "storyPointsCommitted": 22,
        "storyPointsCompleted": 18
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/sprints?teamId=550e8400-e29b-41d4-a716-446655440000" \
  -b cookies.txt
```

---

### Get Pending Action Items

Get pending action items from retrospectives for a specific team.

**Endpoint**

```
GET /api/v1/retrospectives/team/:teamId/pending-action-items
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
    "actionItems": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440050",
        "description": "Improve code review process",
        "retrospectiveId": "550e8400-e29b-41d4-a716-446655440051",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
        "status": "PENDING",
        "createdAt": "2026-04-29T12:00:00.000Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440052",
        "description": "Set up automated testing pipeline",
        "retrospectiveId": "550e8400-e29b-41d4-a716-446655440053",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440004",
        "status": "IN_PROGRESS",
        "createdAt": "2026-04-22T10:00:00.000Z"
      }
    ],
    "summary": {
      "total": 8,
      "pending": 3,
      "inProgress": 2,
      "completed": 3,
      "completionRate": 37.5
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

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/retrospectives/team/550e8400-e29b-41d4-a716-446655440000/pending-action-items \
  -b cookies.txt
```

---

## Burndown Charts

Burndown charts visualize sprint progress by plotting remaining work over time.

### Data Format

The burndown endpoint returns two data series:

- **idealLine**: A linear descent from total tasks to zero, representing the planned progress
- **actualLine**: The real-time remaining task count per day, reflecting actual team progress

### Ideal vs Actual Lines

| Aspect         | Ideal Line                                | Actual Line                                  |
| -------------- | ----------------------------------------- | -------------------------------------------- |
| Calculation    | Linear: `total - (total / days) * day`    | Count of incomplete tasks at end of each day |
| Purpose        | Baseline for comparison                   | Shows real progress and deviations           |
| Interpretation | On-track when actual is at or below ideal | Behind schedule when actual is above ideal   |

### How to Render

1. Plot dates on the X-axis and remaining tasks on the Y-axis
2. Draw the ideal line as a straight diagonal from top-left to bottom-right
3. Plot the actual line as a step/line chart overlaying the ideal
4. Shade the area between the lines to highlight deviation
5. Use green when actual is at or below ideal, red when above

## Velocity Tracking

Velocity is a description of what a team has delivered, calculated from its own closed Sprints. It
is history, not a target: the 2020 Scrum Guide names no metric as a target, and a number that is
policed stops being an observation.

### How to Calculate from Sprint History

1. Read `GET /api/v1/reports/velocity?teamId=uuid`, which returns one point per Sprint together with
   the evidence each point rests on.
2. Average `completedPoints` over the points whose `provenance` is not `not_available`.

```
averageCompletedPoints = Sum(completedPoints for observed Sprints) / observed Sprints
```

The endpoint performs exactly that calculation and returns it as `averageCompletedPoints`, together
with `observedSprints` and `unavailableSprints`, so a consumer does not have to re-derive it.

### Example

| Sprint   | Story Points Planned | Story Points Completed | Provenance      |
| -------- | -------------------- | ---------------------- | --------------- |
| Sprint 3 | 22                   | 18                     | `recorded`      |
| Sprint 4 | 20                   | 20                     | `recorded`      |
| Sprint 5 | 25                   | 23                     | `recorded`      |
| Sprint 6 | 21                   | —                      | `not_available` |

**Average completed points** = (18 + 20 + 23) / 3 = **20.3 story points**, over three observed
Sprints. Sprint 6 is excluded rather than counted as zero.

### Recommendations

- Read the average with its coverage: an average over three of ten Sprints answers a different
  question from an average over all ten.
- Never compare the figure across teams. Story points are estimates made by the people doing the
  work, and a cross-team comparison turns them into a currency.
- Never use the figure as a target or a capacity guarantee for the next Sprint. Capacity is a
  judgement the Developers make about the work in front of them.

## DoD Compliance

Definition of Done compliance measures how many product backlog items meet all DoD criteria within a sprint.

### Compliance Percentage

```
Compliance Rate = (compliantPBIs / totalPBIs) * 100
```

### How It Is Calculated

1. Fetch the DoD compliance report using `GET /api/v1/sprints/:sprintId/dod-compliance`
2. Each PBI is checked against every DoD criterion
3. A PBI is considered compliant only if **all** criteria pass
4. The `complianceRate` field provides the overall percentage
5. The `itemResults` array provides per-PBI breakdown with per-criterion results

### Interpreting Results

| Compliance Rate | Interpretation                             |
| --------------- | ------------------------------------------ |
| 90-100%         | Excellent - team consistently meets DoD    |
| 70-89%          | Good - minor improvements needed           |
| 50-69%          | Needs attention - review DoD criteria      |
| Below 50%       | Critical - team may need DoD re-evaluation |

## Increment Metrics

Increment delivery metrics track the team's ability to deliver working software.

### Delivery Rate

```
Delivery Rate = (deliveredIncrements / totalIncrements) * 100
```

### Story Points Delivered

The `averageStoryPoints` metric represents the mean story points delivered per increment across the measured period. This complements sprint velocity by measuring actual delivered value rather than sprint-level completion.

### Key Metrics

| Metric                | Description                                    |
| --------------------- | ---------------------------------------------- |
| `totalIncrements`     | Total increments planned or created            |
| `deliveredIncrements` | Increments successfully delivered and accepted |
| `averageStoryPoints`  | Average story points per delivered increment   |
| `deliveryRate`        | Percentage of increments delivered (0-100%)    |

## Impediment Analytics

Impediment statistics provide visibility into blockers and their resolution patterns.

### Resolution Time

The `averageResolutionTime` metric indicates how long it typically takes to resolve an impediment from the time it is reported. Lower values indicate a more responsive team.

### Team Impact

| Stat         | Description                                         |
| ------------ | --------------------------------------------------- |
| `open`       | Impediments reported but not yet being addressed    |
| `inProgress` | Impediments currently being worked on               |
| `resolved`   | Impediments resolved but not yet verified as closed |
| `closed`     | Impediments fully resolved and verified             |

### Analysis Tips

- A high `open` count may indicate insufficient attention to blockers
- A high `inProgress` count with low `resolved` may indicate impediments are stuck
- Track `averageResolutionTime` trends over time to measure improvement
- Correlate impediment spikes with sprint velocity drops to identify impact

## Action Item Tracking

Action items from retrospectives track improvement commitments made by the team.

### Pending vs Completed Rate

```
Completion Rate = (completed / total) * 100
```

The `summary` object in the pending action items response provides:

- `total`: All action items across retrospectives
- `pending`: Items not yet started
- `inProgress`: Items currently being worked on
- `completed`: Items fully resolved
- `completionRate`: Percentage of items completed

### Tracking Recommendations

1. **Review Regularly**: Check pending action items at each retrospective
2. **Assign Owners**: Every action item should have a designated assignee
3. **Set Deadlines**: Action items without deadlines tend to remain pending
4. **Limit WIP**: Avoid too many in-progress items simultaneously
5. **Celebrate Completion**: Acknowledge completed action items to reinforce improvement culture

## Error Codes

| Code                             | HTTP Status | Description                                               |
| -------------------------------- | ----------- | --------------------------------------------------------- |
| `VALIDATION_ERROR`               | 400         | Request validation failed                                 |
| `BAD_REQUEST`                    | 400         | No usable team context on a `/reports/*` request          |
| `AUTHENTICATION_ERROR`           | 401         | Authentication required                                   |
| `AUTHORIZATION_ERROR`            | 403         | Insufficient permissions or not a team member             |
| `GATE_REPORTS_TEAM_MEMBERS_ONLY` | 403         | A report belongs to the Scrum Team whose history it reads |
| `NOT_FOUND`                      | 404         | Sprint, team, or resource not found                       |

## Best Practices

### Report Consumption

1. **Caching**: Cache report data on the client side with appropriate stale times (e.g., 5 minutes for burndown, 15 minutes for metrics)
2. **Selective Fetching**: Only fetch reports that are currently displayed to the user
3. **Date Ranges**: Use team-specific queries to limit data scope and improve performance
4. **Error Handling**: Gracefully handle report endpoints that may return empty data for new teams, and render a `null` point as an explicit gap rather than as zero

### Data Interpretation

1. **Context Matters**: Always interpret figures in the context of team size, Sprint length, work
   type, and the coverage the response reports
2. **Descriptive, Not Directive**: The Guide uses no metric as a target. Read delivered points as a
   record of what happened, and inspect the work behind a change rather than the number itself
3. **Combined Signals**: Read several observations together (e.g. delivered points, impediment age,
   Definition of Done compliance) instead of optimising any one of them
4. **Goal Attainment Is Recorded, Never Inferred**: take Sprint Goal attainment from the team's own
   verdict in `sprintGoalOutcome`, not from item completion

### Security

1. **Access Control**: every `/reports/*` endpoint requires membership of the team being read, and
   answers a non-member with `GATE_REPORTS_TEAM_MEMBERS_ONLY` (403). The check runs on the route and
   again in the service layer, before the report cache is consulted
2. **Data Isolation**: reports are scoped to the single team named in `teamId`; there is no
   cross-team or installation-wide report
3. **Audit Trail**: every report read is logged as `REPORTS.VIEW` with the team and the report name

---

**Last Updated**: 2026-09-22

**Related Documentation**

- [Authentication API](./authentication.md)
- [Sprints API](./sprints.md)
- [Impediments API](./impediments.md)
- [Retrospectives API](./retrospectives.md)
- [Definition of Done API](./definition-of-done.md)
