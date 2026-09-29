# Account Management API

Complete Account Management API reference for account deletion, scheduled deletion, privacy controls, and consent management.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Account Deletion Options](#account-deletion-options)
- [Grace Period](#grace-period)
- [Deletion Impact](#deletion-impact)
- [Endpoints](#endpoints)
  - [Check Deletion Eligibility](#check-deletion-eligibility)
  - [Delete Account Immediately](#delete-account-immediately)
  - [Schedule Account Deletion](#schedule-account-deletion)
  - [Cancel Scheduled Deletion](#cancel-scheduled-deletion)
  - [Force Delete Account](#force-delete-account)
  - [Get Deletion Status](#get-deletion-status)
  - [Record Consent](#record-consent)
  - [Get Consent History](#get-consent-history)
  - [Get Latest Consent](#get-latest-consent)
  - [Withdraw All Consent](#withdraw-all-consent)
  - [Get Consent by ID](#get-consent-by-id)
- [Privacy Controls](#privacy-controls)
- [GDPR Compliance](#gdpr-compliance)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Account Management API provides comprehensive account lifecycle and privacy capabilities including:

- Account deletion with multiple strategies (immediate, scheduled, forced)
- Grace period management with cancellation support
- Deletion eligibility checks
- Consent recording and history tracking
- Consent withdrawal
- GDPR-compliant data handling

## Authentication

All account management endpoints require authentication unless otherwise noted. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Account Deletion Options

Scrumooth provides three account deletion strategies to balance user control with data safety:

| Option           | Endpoint                                 | Confirmation Required | Grace Period | Reversible | Use Case                                     |
| ---------------- | ---------------------------------------- | --------------------- | ------------ | ---------- | -------------------------------------------- |
| **Immediate**    | `DELETE /api/v1/auth/me`                 | `"DELETE MY ACCOUNT"` | None         | No         | User wants instant removal                   |
| **Scheduled**    | `POST /api/v1/auth/me/schedule-deletion` | `"SCHEDULE DELETION"` | 14 days      | Yes        | User wants time to reconsider                |
| **Force Delete** | `POST /api/v1/auth/me/force-delete`      | `"DELETE MY ACCOUNT"` | Bypassed     | No         | Admin or compliance-driven immediate removal |

### Choosing a Deletion Strategy

- **Immediate Deletion**: Best for users who are certain about leaving. The account and associated data are removed right away with no recovery option.
- **Scheduled Deletion**: Recommended for most users. Provides a 14-day grace period during which the deletion can be cancelled. The account remains accessible during the grace period.
- **Force Delete**: Intended for compliance or administrative scenarios where a grace period is not applicable. Bypasses the grace period entirely.

## Grace Period

When a user schedules account deletion, a 14-day grace period begins:

### How It Works

1. **Scheduling**: User requests scheduled deletion with confirmation text `"SCHEDULE DELETION"`
2. **Grace Period Starts**: The account is marked for deletion with a `scheduledDeletionDate` and `gracePeriodEnds` timestamp
3. **During Grace**: The account remains fully functional; the user can continue using Scrumooth
4. **Cancellation**: The user can cancel the scheduled deletion at any time before the grace period ends
5. **Auto-Deletion**: After the grace period expires, the account is automatically and permanently deleted

### Grace Period Timeline

```
Day 0                          Day 14
  |------------------------------|
  Schedule     Can Cancel        Auto-Delete
  Deletion     Anytime           (Irreversible)
```

### Grace Period Details

- **Duration**: 14 calendar days from the scheduling timestamp
- **Access**: Full account access is maintained during the grace period
- **Notifications**: Email reminders are sent at day 7 and day 13
- **Cancellation**: Available via `DELETE /api/v1/auth/me/schedule-deletion` until the grace period ends
- **Status Check**: Use `GET /api/v1/auth/me/deletion-status` to monitor the current state

## Deletion Impact

### Data Removed on Deletion

The following data is permanently deleted when an account is removed:

- User profile (name, email, avatar)
- Authentication credentials (password hash, tokens)
- User preferences and settings
- Session data and cookies
- Notification preferences
- Consent records

### Data Anonymized on Deletion

The following data is anonymized (personally identifiable information removed) to maintain data integrity:

- Sprint history contributions (replaced with "Deleted User")
- Retrospective feedback (author field anonymized)
- Audit log entries (user reference replaced with anonymized ID)
- Task comments (author field anonymized)

### Team Impact

| Scenario                           | Behavior                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| User is the sole member of a team  | Team and all associated data are deleted                 |
| User is the last Product Owner     | Deletion is blocked; must transfer role first            |
| User is a member of multiple teams | User is removed from all teams; teams remain intact      |
| User owns active sprints           | Sprint ownership transfers to Scrum Master or next Admin |
| User has pending tasks             | Tasks are reassigned to the team backlog (unassigned)    |

## Endpoints

### Check Deletion Eligibility

Check if the authenticated user's account is eligible for deletion.

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
    "eligible": true
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
    "reason": "You are the last administrator of 1 team(s). Transfer ownership before deleting your account.",
    "activeTeams": 1,
    "pendingSprints": 0
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/auth/me/deletion-check \
  -b cookies.txt
```

---

### Delete Account Immediately

Permanently delete the authenticated user's account. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/auth/me
```

**Authentication**

- Required

**Request Body**

```json
{
  "confirmation": "string (required, must exactly match: DELETE MY ACCOUNT)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Account deleted successfully"
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
    "message": "Confirmation text does not match. Please type DELETE MY ACCOUNT to confirm."
  }
}
```

**403 Forbidden - Not Eligible**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Account is not eligible for deletion. You are the last administrator of 1 team(s)."
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

### Schedule Account Deletion

Schedule account deletion with a 14-day grace period. The account remains accessible during the grace period.

**Endpoint**

```
POST /api/v1/auth/me/schedule-deletion
```

**Authentication**

- Required

**Request Body**

```json
{
  "confirmation": "string (required, must exactly match: SCHEDULE DELETION)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Account deletion scheduled. You can cancel within the grace period.",
    "scheduledDeletionDate": "2026-05-24T10:00:00.000Z",
    "gracePeriodEnds": "2026-05-24T10:00:00.000Z"
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
    "message": "Confirmation text does not match. Please type SCHEDULE DELETION to confirm."
  }
}
```

**409 Conflict - Already Scheduled**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Account deletion is already scheduled"
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

### Cancel Scheduled Deletion

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
    "message": "Scheduled deletion cancelled"
  }
}
```

**Error Responses**

**404 Not Found - No Scheduled Deletion**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No scheduled deletion found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/auth/me/schedule-deletion \
  -b cookies.txt
```

---

### Force Delete Account

Force delete the authenticated user's account, bypassing the grace period. This action is irreversible.

**Endpoint**

```
POST /api/v1/auth/me/force-delete
```

**Authentication**

- Required

**Request Body**

```json
{
  "confirmation": "string (required, must exactly match: DELETE MY ACCOUNT)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Account permanently deleted"
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
    "message": "Confirmation text does not match. Please type DELETE MY ACCOUNT to confirm."
  }
}
```

**403 Forbidden - Not Eligible**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Account is not eligible for deletion. You are the last administrator of 1 team(s)."
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

### Get Deletion Status

Get the current deletion status for the authenticated user's account.

**Endpoint**

```
GET /api/v1/auth/me/deletion-status
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
    "status": "scheduled",
    "scheduledDate": "2026-05-24T10:00:00.000Z",
    "gracePeriodEnds": "2026-05-24T10:00:00.000Z",
    "canCancel": true
  }
}
```

**No Deletion Scheduled Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "status": "none",
    "canCancel": false
  }
}
```

**Status Values**

| Status            | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `none`            | No deletion scheduled                                 |
| `scheduled`       | Deletion is scheduled and within the grace period     |
| `in_grace_period` | Grace period is active; deletion has not yet occurred |

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/auth/me/deletion-status \
  -b cookies.txt
```

---

### Record Consent

Record a user's consent preference. Uses optional authentication middleware, so authentication is not strictly required.

**Endpoint**

```
POST /api/v1/consent/record
```

**Authentication**

- Optional (uses `optionalAuth` middleware)

**Request Body**

```json
{
  "consentType": "string (required, one of: cookie_consent, marketing_consent, analytics_consent)",
  "action": "string (required, one of: accept_all, reject_all, custom, withdrawn)",
  "preferences": {
    "essential": "boolean (optional, default: true)",
    "analytics": "boolean (optional, default: false)",
    "marketing": "boolean (optional, default: false)"
  },
  "version": "string (required)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "consent": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "consentType": "cookie_consent",
      "action": "custom",
      "preferences": {
        "essential": true,
        "analytics": true,
        "marketing": false
      },
      "version": "1.0.0",
      "createdAt": "2026-05-10T12:00:00.000Z"
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
        "field": "consentType",
        "message": "Must be one of: cookie_consent, marketing_consent, analytics_consent"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/consent/record \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "consentType": "cookie_consent",
    "action": "custom",
    "preferences": {
      "essential": true,
      "analytics": true,
      "marketing": false
    },
    "version": "1.0.0"
  }'
```

---

### Get Consent History

Get the authenticated user's consent history.

**Endpoint**

```
GET /api/v1/consent/history
```

**Authentication**

- Required

**Query Parameters**

- `limit` (integer, optional): Number of records to return (default: 20, max: 50)
- `offset` (integer, optional): Number of records to skip (default: 0)

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "consents": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "consentType": "cookie_consent",
        "action": "custom",
        "preferences": {
          "essential": true,
          "analytics": true,
          "marketing": false
        },
        "version": "1.0.0",
        "createdAt": "2026-05-10T12:00:00.000Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "consentType": "analytics_consent",
        "action": "accept_all",
        "preferences": {
          "essential": true,
          "analytics": true,
          "marketing": true
        },
        "version": "1.0.0",
        "createdAt": "2026-05-09T08:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 2
    }
  }
}
```

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/consent/history?limit=10&offset=0" \
  -b cookies.txt
```

---

### Get Latest Consent

Get the authenticated user's most recent consent record.

**Endpoint**

```
GET /api/v1/consent/latest
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
    "consent": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "consentType": "cookie_consent",
      "action": "custom",
      "preferences": {
        "essential": true,
        "analytics": true,
        "marketing": false
      },
      "version": "1.0.0",
      "createdAt": "2026-05-10T12:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found - No Consent Record**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No consent record found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/consent/latest \
  -b cookies.txt
```

---

### Withdraw All Consent

Withdraw all consent for the authenticated user. This revokes all previously granted consent preferences.

**Endpoint**

```
POST /api/v1/consent/withdraw
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
    "message": "All consent withdrawn successfully"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/consent/withdraw \
  -b cookies.txt
```

---

### Get Consent by ID

Get a specific consent record by its ID. Uses optional authentication middleware.

**Endpoint**

```
GET /api/v1/consent/:consentId
```

**Authentication**

- Optional (uses `optionalAuth` middleware)

**Path Parameters**

- `consentId` (string, required): Consent record UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "consent": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "consentType": "cookie_consent",
      "action": "custom",
      "preferences": {
        "essential": true,
        "analytics": true,
        "marketing": false
      },
      "version": "1.0.0",
      "createdAt": "2026-05-10T12:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found - Consent Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Consent record not found"
  }
}
```

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/consent/550e8400-e29b-41d4-a716-446655440010 \
  -b cookies.txt
```

---

## Privacy Controls

Scrumooth provides comprehensive privacy controls aligned with GDPR requirements:

### Data Export

Users can request a full export of their personal data. This includes:

- Profile information
- Team memberships and roles
- Sprint participation history
- Task assignments and comments
- Consent history
- Audit log entries

### Consent Management

Users have full control over their consent preferences:

- **Granular Control**: Choose which categories of data processing to allow (essential, analytics, marketing)
- **Version Tracking**: Each consent record includes the version of the privacy policy at the time of consent
- **History**: Full history of consent changes is maintained and accessible
- **Withdrawal**: Consent can be withdrawn at any time without affecting service access for essential features

### Account Deletion

Users can delete their accounts through multiple strategies:

- **Immediate Deletion**: For users who want instant removal
- **Scheduled Deletion**: With a 14-day grace period for reconsideration
- **Force Delete**: For compliance-driven immediate removal

## GDPR Compliance

Scrumooth is designed to comply with the General Data Protection Regulation (GDPR). The following rights are supported:

### Right to Access (Article 15)

Users can access all their personal data through the API. Use the data export feature to retrieve a complete copy.

### Right to Rectification (Article 16)

Users can update their profile information at any time through the profile management endpoints.

### Right to Erasure (Article 17)

Users can request deletion of their account and personal data through the deletion endpoints. Three strategies are available:

- Immediate deletion for instant removal
- Scheduled deletion with a 14-day grace period
- Force deletion for compliance-driven scenarios

### Right to Restrict Processing (Article 18)

Users can withdraw consent for non-essential data processing (analytics, marketing) while maintaining essential service functionality.

### Right to Data Portability (Article 20)

Users can export their data in a machine-readable format through the data export feature.

### Right to Object (Article 21)

Users can object to specific types of data processing by withdrawing consent for those categories.

### Consent Requirements

| Requirement           | Implementation                                                      |
| --------------------- | ------------------------------------------------------------------- |
| Explicit consent      | Confirmation text must match exactly for deletion operations        |
| Granular consent      | Separate preferences for essential, analytics, and marketing        |
| Consent versioning    | Each consent record includes the privacy policy version             |
| Consent withdrawal    | Users can withdraw consent at any time via the withdraw endpoint    |
| Consent audit trail   | Full history of consent changes is maintained and accessible        |
| Lawful basis tracking | Each consent type is tied to a specific lawful basis for processing |

## Error Codes

| Code                   | HTTP Status | Description                                                  |
| ---------------------- | ----------- | ------------------------------------------------------------ |
| `VALIDATION_ERROR`     | 400         | Request validation failed (e.g., invalid confirmation)       |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                                      |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions or account not eligible             |
| `NOT_FOUND`            | 404         | Resource not found (e.g., no scheduled deletion, no consent) |
| `CONFLICT`             | 409         | Resource conflict (e.g., deletion already scheduled)         |

## Best Practices

### Account Deletion

1. **Check Eligibility First**: Always call the deletion-check endpoint before attempting deletion
2. **Prefer Scheduled Deletion**: Recommend the scheduled deletion option to give users time to reconsider
3. **Handle Team Ownership**: Ensure the user transfers team ownership before deletion if they are the last administrator
4. **Clear Client State**: After successful deletion, clear all local storage, cookies, and cached data on the client side

### Consent Management

1. **Record Consent Early**: Record consent as soon as the user interacts with the consent banner
2. **Track Versions**: Always include the current privacy policy version when recording consent
3. **Respect Preferences**: Honor the user's consent preferences in all data processing activities
4. **Provide Clear Options**: Offer granular consent choices rather than all-or-nothing options

### Security

1. **Confirmation Requirement**: All destructive operations require exact confirmation text to prevent accidental deletion
2. **Grace Period**: Leverage the grace period to protect users from impulsive decisions
3. **Audit Trail**: All account and consent changes are logged for compliance and security review
4. **Cookie Cleanup**: Account deletion endpoints clear all authentication cookies

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Authentication API](./authentication.md)
- [Teams API](./teams.md)
- [User Profile API](./user-profile.md)
