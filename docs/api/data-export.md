# Data Export API

Complete Data Export and Account Management API reference for GDPR-compliant data portability, account deletion, and user data lifecycle management.

## Table of Contents

- [Overview](#overview)
- [GDPR Compliance](#gdpr-compliance)
- [Account Deletion Flow](#account-deletion-flow)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Data Export](#data-export)
    - [Initiate Data Export](#initiate-data-export)
    - [Get Active Exports](#get-active-exports)
    - [Get Export Status](#get-export-status)
    - [Download Export File](#download-export-file)
    - [Cancel Export](#cancel-export)
  - [Account Management](#account-management)
    - [Check Deletion Eligibility](#check-deletion-eligibility)
    - [Delete Account Immediately](#delete-account-immediately)
    - [Schedule Account Deletion](#schedule-account-deletion)
    - [Cancel Scheduled Deletion](#cancel-scheduled-deletion)
    - [Force Delete Account](#force-delete-account)
    - [Get Deletion Status](#get-deletion-status)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Data Export API provides capabilities for:

- Initiating GDPR-compliant data export jobs
- Tracking export job status and progress
- Downloading exported data packages
- Canceling in-progress export jobs
- Managing account deletion with immediate and scheduled options
- Providing a 14-day grace period for scheduled deletions

Data Export endpoints are mounted under `/api/v1/user/export-data`. Account Management endpoints are mounted under `/api/v1/auth`.

## GDPR Compliance

The Data Export API is designed to comply with **GDPR Article 20 - Right to Data Portability**, which grants data subjects the right to receive their personal data in a structured, commonly used, and machine-readable format.

### Key GDPR Principles

- **Right to Data Portability**: Users can request a copy of their personal data in a machine-readable format (JSON)
- **Right to Erasure**: Users can request deletion of their personal data (Article 17)
- **Data Minimization**: Export only includes data that belongs to the requesting user
- **Transparency**: Users are informed about what data is collected and how it is used
- **Consent**: Data processing is based on explicit user consent or legitimate interest

### Export Data Categories

The export package includes the following data categories:

| Category          | Description                                         | Included by Default |
| ----------------- | --------------------------------------------------- | ------------------- |
| **Profile**       | User profile information (name, email, preferences) | Yes                 |
| **Sessions**      | Active and historical session data                  | Yes                 |
| **Notifications** | Notification history and preferences                | Yes                 |
| **Teams**         | Team memberships and roles                          | Yes                 |
| **Backlog**       | Created Product Backlog Items                       | Yes                 |
| **Sprints**       | Sprint participation and contributions              | Yes                 |
| **Audit Log**     | User activity audit trail                           | Yes                 |

### Rate Limiting

To prevent abuse, data export requests are rate-limited:

- **1 export request per hour** per user
- Active exports are counted toward this limit
- Canceling an export does not reset the rate limit

## Account Deletion Flow

Scrumooth provides multiple account deletion pathways to balance user rights with data integrity:

### Deletion Options

| Option               | Effect                                    | Reversible | Grace Period |
| -------------------- | ----------------------------------------- | ---------- | ------------ |
| **Immediate Delete** | Account deleted right away                | No         | None         |
| **Scheduled Delete** | Account marked for deletion after 14 days | Yes        | 14 days      |
| **Force Delete**     | Immediate and permanent deletion          | No         | None         |

### Grace Period

When a user schedules account deletion:

1. The account is marked for deletion but remains active
2. A **14-day grace period** begins
3. During the grace period, the user can cancel the scheduled deletion
4. After the grace period, the account and all associated data are permanently deleted
5. The user receives reminder notifications during the grace period

### Deletion Impact

Account deletion affects the following data:

- **User Profile**: Permanently removed
- **Team Memberships**: Removed from all teams; if the user is the last Product Owner, the team must assign a new one before deletion can proceed
- **Owned Resources**: Product Backlog Items, Sprints, and other resources are reassigned to the team or removed
- **Audit Trail**: Anonymized but retained for compliance purposes
- **Sessions**: All active sessions are terminated immediately

## Authentication

All Data Export and Account Management endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Endpoints

### Data Export

#### Initiate Data Export

Initiate a new data export job. The export is processed asynchronously and the user is notified when it is ready for download.

**Endpoint**

```
POST /api/v1/user/export-data
```

**Authentication**

- Required

**Rate Limit**

- 1 request per hour per user

**Request Body**

```json
{
  "options": {
    "includeSessions": "boolean (optional, default: true)",
    "includeNotifications": "boolean (optional, default: true)",
    "dataCategories": "string[] (optional, specific categories to include)"
  }
}
```

**Success Response**

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{
  "success": true,
  "data": {
    "job": {
      "id": "550e8400-e29b-41d4-a716-446655440200",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "status": "PENDING",
      "options": {
        "includeSessions": true,
        "includeNotifications": true,
        "dataCategories": null
      },
      "createdAt": "2026-04-29T12:00:00.000Z",
      "estimatedCompletionAt": "2026-04-29T12:05:00.000Z"
    }
  }
}
```

**Error Responses**

**429 Too Many Requests - Rate Limit Exceeded**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Export rate limit exceeded. You can request a new export in 45 minutes.",
    "retryAfter": 2700
  }
}
```

**409 Conflict - Active Export Exists**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "An active export job already exists. Cancel it before starting a new one."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/user/export-data \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "options": {
      "includeSessions": true,
      "includeNotifications": true
    }
  }'
```

---

#### Get Active Exports

Get all active (pending or processing) export jobs for the authenticated user.

**Endpoint**

```
GET /api/v1/user/export-data/active
```

**Authentication**

- Required

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "exports": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440200",
        "status": "PROCESSING",
        "progress": 65,
        "options": {
          "includeSessions": true,
          "includeNotifications": true,
          "dataCategories": null
        },
        "createdAt": "2026-04-29T12:00:00.000Z",
        "estimatedCompletionAt": "2026-04-29T12:05:00.000Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/user/export-data/active \
  -b cookies.txt
```

---

#### Get Export Status

Get the status of a specific export job.

**Endpoint**

```
GET /api/v1/user/export-data/status/:jobId
```

**Authentication**

- Required

**Path Parameters**

- `jobId` (string, required): Export job UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "job": {
      "id": "550e8400-e29b-41d4-a716-446655440200",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "status": "COMPLETED",
      "progress": 100,
      "options": {
        "includeSessions": true,
        "includeNotifications": true,
        "dataCategories": null
      },
      "createdAt": "2026-04-29T12:00:00.000Z",
      "completedAt": "2026-04-29T12:04:30.000Z",
      "expiresAt": "2026-05-06T12:04:30.000Z",
      "downloadUrl": "/api/v1/user/export-data/download/550e8400-e29b-41d4-a716-446655440200",
      "fileSize": 2048576
    }
  }
}
```

**Job Status Values**

| Status       | Description                                         |
| ------------ | --------------------------------------------------- |
| `PENDING`    | Job has been created and is waiting to be processed |
| `PROCESSING` | Job is currently being processed                    |
| `COMPLETED`  | Export file is ready for download                   |
| `FAILED`     | Export job failed; user may retry after rate limit  |
| `CANCELLED`  | Export job was cancelled by the user                |
| `EXPIRED`    | Export file has expired and is no longer available  |

**Error Responses**

**404 Not Found - Job Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Export job not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/user/export-data/status/550e8400-e29b-41d4-a716-446655440200 \
  -b cookies.txt
```

---

#### Download Export File

Download the completed export file. The file is available for 7 days after completion.

**Endpoint**

```
GET /api/v1/user/export-data/download/:jobId
```

**Authentication**

- Required

**Path Parameters**

- `jobId` (string, required): Export job UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/zip
Content-Disposition: attachment; filename="scrumooth-export-2026-04-29.zip"

<binary file data>
```

The downloaded ZIP archive contains:

```
scrumooth-export-2026-04-29/
├── manifest.json          # Export metadata and checksums
├── profile.json           # User profile data
├── sessions.json          # Session history
├── notifications.json     # Notification history
├── teams.json             # Team memberships
├── backlog.json           # Product Backlog Items
├── sprints.json           # Sprint participation
└── audit-log.json         # Activity audit trail
```

**Error Responses**

**404 Not Found - Job Not Found or Expired**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Export file not found or has expired"
  }
}
```

**409 Conflict - Export Not Ready**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Export is not yet completed. Current status: PROCESSING"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/user/export-data/download/550e8400-e29b-41d4-a716-446655440200 \
  -b cookies.txt \
  -o scrumooth-export.zip
```

---

#### Cancel Export

Cancel an in-progress export job. Only pending or processing jobs can be cancelled.

**Endpoint**

```
DELETE /api/v1/user/export-data/:jobId
```

**Authentication**

- Required

**Path Parameters**

- `jobId` (string, required): Export job UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Export job cancelled successfully",
    "jobId": "550e8400-e29b-41d4-a716-446655440200"
  }
}
```

**Error Responses**

**404 Not Found - Job Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Export job not found"
  }
}
```

**409 Conflict - Job Cannot Be Cancelled**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot cancel a completed export job"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/user/export-data/550e8400-e29b-41d4-a716-446655440200 \
  -b cookies.txt
```

---

### Account Management

#### Check Deletion Eligibility

Check whether the authenticated user's account is eligible for deletion. Identifies any blockers such as being the last Product Owner of a team.

**Endpoint**

```
GET /api/v1/auth/me/deletion-check
```

**Authentication**

- Required

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "eligible": true,
    "blockers": [],
    "warnings": [
      {
        "type": "TEAM_MEMBERSHIP",
        "message": "You are a member of 2 teams. Your membership will be removed.",
        "teamId": "550e8400-e29b-41d4-a716-446655440000",
        "teamName": "Development Team"
      }
    ]
  }
}
```

**Ineligible Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "eligible": false,
    "blockers": [
      {
        "type": "LAST_PRODUCT_OWNER",
        "message": "You are the last Product Owner of 'Development Team'. Assign a new Product Owner before deleting your account.",
        "teamId": "550e8400-e29b-41d4-a716-446655440000",
        "teamName": "Development Team"
      }
    ],
    "warnings": []
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/auth/me/deletion-check \
  -b cookies.txt
```

---

#### Delete Account Immediately

Delete the authenticated user's account immediately. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/auth/me
```

**Authentication**

- Required

**Request Body**

```json
{
  "confirmation": "DELETE MY ACCOUNT"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Account deleted successfully",
    "deletedAt": "2026-04-29T12:00:00.000Z"
  }
}
```

**Error Responses**

**400 Bad Request - Invalid Confirmation**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Confirmation text does not match. Type 'DELETE MY ACCOUNT' to confirm."
  }
}
```

**409 Conflict - Account Not Eligible**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Account cannot be deleted. You are the last Product Owner of 1 team(s)."
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/auth/me \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "confirmation": "DELETE MY ACCOUNT"
  }'
```

---

#### Schedule Account Deletion

Schedule account deletion with a 14-day grace period. During the grace period, the account remains active and the deletion can be cancelled.

**Endpoint**

```
POST /api/v1/auth/me/schedule-deletion
```

**Authentication**

- Required

**Request Body**

```json
{
  "confirmation": "SCHEDULE DELETION"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Account deletion scheduled",
    "scheduledDeletionAt": "2026-05-13T12:00:00.000Z",
    "gracePeriodEndsAt": "2026-05-13T12:00:00.000Z",
    "canCancel": true
  }
}
```

**Error Responses**

**400 Bad Request - Invalid Confirmation**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Confirmation text does not match. Type 'SCHEDULE DELETION' to confirm."
  }
}
```

**409 Conflict - Deletion Already Scheduled**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Account deletion is already scheduled. Use DELETE /api/v1/auth/me/schedule-deletion to cancel."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/auth/me/schedule-deletion \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "confirmation": "SCHEDULE DELETION"
  }'
```

---

#### Cancel Scheduled Deletion

Cancel a previously scheduled account deletion. Only available during the grace period.

**Endpoint**

```
DELETE /api/v1/auth/me/schedule-deletion
```

**Authentication**

- Required

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Scheduled deletion cancelled successfully",
    "cancelledAt": "2026-04-30T10:00:00.000Z"
  }
}
```

**Error Responses**

**409 Conflict - No Scheduled Deletion**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "No scheduled deletion found to cancel"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/auth/me/schedule-deletion \
  -b cookies.txt
```

---

#### Force Delete Account

Force delete the authenticated user's account immediately and permanently. This action bypasses all checks and is irreversible. Use with extreme caution.

**Endpoint**

```
POST /api/v1/auth/me/force-delete
```

**Authentication**

- Required

**Request Body**

```json
{
  "confirmation": "DELETE MY ACCOUNT"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Account force deleted successfully",
    "deletedAt": "2026-04-29T12:00:00.000Z"
  }
}
```

**Error Responses**

**400 Bad Request - Invalid Confirmation**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Confirmation text does not match. Type 'DELETE MY ACCOUNT' to confirm."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/auth/me/force-delete \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "confirmation": "DELETE MY ACCOUNT"
  }'
```

---

#### Get Deletion Status

Get the current deletion status for the authenticated user's account.

**Endpoint**

```
GET /api/v1/auth/me/deletion-status
```

**Authentication**

- Required

**Success Response**

**Account Active (No Deletion Scheduled)**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "status": "ACTIVE",
    "scheduledDeletionAt": null,
    "gracePeriodEndsAt": null
  }
}
```

**Deletion Scheduled (Within Grace Period)**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "status": "DELETION_SCHEDULED",
    "scheduledDeletionAt": "2026-05-13T12:00:00.000Z",
    "gracePeriodEndsAt": "2026-05-13T12:00:00.000Z",
    "canCancel": true,
    "daysRemaining": 12
  }
}
```

**Status Values**

| Status                 | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `ACTIVE`               | Account is active with no deletion scheduled          |
| `DELETION_SCHEDULED`   | Account is scheduled for deletion within grace period |
| `DELETION_IN_PROGRESS` | Account deletion is being processed                   |

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/auth/me/deletion-status \
  -b cookies.txt
```

---

## Error Codes

| Code                   | HTTP Status | Description                                         |
| ---------------------- | ----------- | --------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed or confirmation mismatch  |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                             |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions                            |
| `NOT_FOUND`            | 404         | Export job or resource not found                    |
| `CONFLICT`             | 409         | Resource conflict (active export, deletion blocker) |
| `RATE_LIMIT_EXCEEDED`  | 429         | Export rate limit exceeded                          |

## Best Practices

### Data Export

1. **Export Before Deletion**: Always initiate a data export before deleting an account to preserve a copy of your data
2. **Selective Export**: Use `dataCategories` to export only the data you need, reducing export time and file size
3. **Download Promptly**: Export files expire after 7 days; download them as soon as they are ready
4. **Verify Integrity**: Check the `manifest.json` file in the export archive to verify data completeness
5. **Rate Limit Awareness**: Plan export requests to avoid hitting the 1-per-hour rate limit

### Account Deletion

1. **Check Eligibility First**: Always call the deletion eligibility check before attempting to delete your account
2. **Resolve Blockers**: Address any blockers (e.g., last Product Owner of a team) before scheduling deletion
3. **Use Scheduled Deletion**: Prefer scheduled deletion over immediate deletion to allow for a cooling-off period
4. **Export Data First**: Request a data export before scheduling deletion; the grace period provides time for the export to complete
5. **Cancel if Needed**: Use the cancellation endpoint within the grace period if you change your mind

### Security

1. **Confirmation Requirement**: All deletion endpoints require explicit confirmation text to prevent accidental deletion
2. **Session Termination**: All active sessions are terminated upon account deletion
3. **Audit Trail**: Account deletion events are logged for compliance purposes
4. **Data Anonymization**: Associated data is anonymized rather than deleted where required for compliance

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Authentication API](./authentication.md)
- [Teams API](./teams.md)
- [Product Backlog API](./product-backlog.md)
