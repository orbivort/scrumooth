# Notifications API

Complete Notifications API reference for managing user notifications, read status, and direct messaging.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Notification Types](#notification-types)
- [Endpoints](#endpoints)
  - [Get Notifications](#get-notifications)
  - [Get Unread Count](#get-unread-count)
  - [Send Message](#send-message)
  - [Mark as Read](#mark-as-read)
  - [Mark All as Read](#mark-all-as-read)
  - [Delete Notification](#delete-notification)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Notifications API provides comprehensive notification management capabilities including:

- Notification listing with filtering and pagination
- Unread notification count tracking
- Direct messaging between team members
- Read status management (individual and bulk)
- Notification deletion

All notification endpoints are subject to a dedicated rate limit of **200 requests per 15 minutes**.

## Authentication

All notification endpoints require authentication. Include the access token in your request:

**Using Cookies (Recommended)**

```http
GET /api/v1/notifications
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/notifications
Authorization: Bearer eyJhbGc...
```

## Notification Types

Notifications are categorized by type. The following types are supported:

| Type                            | Description                                                       |
| ------------------------------- | ----------------------------------------------------------------- |
| `TEAM_INVITATION`               | The user has been added to a team                                 |
| `TEAM_REMOVAL`                  | The user has been removed from a team                             |
| `TASK_ASSIGNMENT`               | A task, review feedback or a backlog adjustment is theirs         |
| `IMPEDIMENT_ASSIGNMENT`         | The user owns an impediment                                       |
| `IMPEDIMENT_ESCALATION`         | An impediment has gone unresolved past its threshold              |
| `DAILY_SCRUM_SIGNAL`            | The team has been signalled to gather for the Daily Scrum         |
| `TEAM_CREATED`                  | The user created a team                                           |
| `TEAM_UPDATED`                  | A team the user belongs to was updated                            |
| `TEAM_DELETED`                  | A team the user belongs to was deleted                            |
| `DIRECT_MESSAGE`                | A team member sent the user a direct message                      |
| `ACCOUNT_DELETION_SCHEDULED`    | A Product Owner in the user's team scheduled account deletion     |
| `ACCOUNT_DELETION_CANCELLED`    | That scheduled deletion was cancelled                             |
| `ORGANIZATIONAL_BARRIER`        | The user owns a barrier that lies outside the team                |
| `SPRINT_BACKLOG_CHANGE_PENDING` | A goal-endangering Sprint Backlog change awaits the Product Owner |

This list is the Prisma `NotificationType` enum. `NOTIFICATION_TYPES` in
`packages/shared` and the client's `NotificationType` enum are kept in step with it,
and `packages/frontend/src/types/notification.types.test.ts` fails when they drift.

### Localized notifications

A notification created through `NotificationService.createLocalized` stores both the
text rendered in the recipient's locale and the canonical i18n context it was rendered
from:

- `title` / `message` — rendered text, for email and push, and the interface's fallback.
- `messageKey` — the message's i18n key.
- `params` — `{ titleKey, titleParams, messageKey, messageParams }`.

The interface re-translates from `params` at display time, so switching language
re-labels notifications that already exist instead of leaving them frozen in the
language they were created in.

## Endpoints

### Get Notifications

Get notifications for the authenticated user with optional filtering and pagination.

**Endpoint**

```
GET /api/v1/notifications
```

**Authentication**

- Required

**Query Parameters**

- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 50, capped at the deployment's `NOTIFICATION_MAX_PAGE_SIZE`, 10–100)
- `type` (string, optional): Filter by notification type (see [Notification Types](#notification-types))
- `isRead` (boolean, optional): Filter by read status - true/false

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "type": "TASK_ASSIGNMENT",
        "title": "New task assigned: \"Implement login page\"",
        "message": "In sprint \"Sprint 5\"",
        "messageKey": "newTaskAssignedMessage",
        "params": {
          "titleKey": "newTaskAssignedTitle",
          "titleParams": { "taskTitle": "Implement login page" },
          "messageKey": "newTaskAssignedMessage",
          "messageParams": { "taskTitle": "Implement login page", "sprintName": "Sprint 5" }
        },
        "data": {
          "taskId": "550e8400-e29b-41d4-a716-446655440020",
          "sprintId": "550e8400-e29b-41d4-a716-446655440030",
          "pbiId": "550e8400-e29b-41d4-a716-446655440040"
        },
        "isRead": false,
        "readAt": null,
        "createdAt": "2026-04-29T12:00:00.000Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440011",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "type": "DIRECT_MESSAGE",
        "title": "Message from Tobin Veleth",
        "message": "Can you review the PR when you get a chance?",
        "messageKey": "directMessageBody",
        "params": {
          "titleKey": "directMessageTitle",
          "titleParams": { "senderName": "Tobin Veleth" },
          "messageKey": "directMessageBody",
          "messageParams": { "message": "Can you review the PR when you get a chance?" }
        },
        "data": { "senderId": "550e8400-e29b-41d4-a716-446655440002" },
        "isRead": true,
        "readAt": "2026-04-28T09:05:00.000Z",
        "createdAt": "2026-04-28T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2,
      "totalPages": 1
    },
    "unreadCount": 1
  }
}
```

`limit` defaults to 50 and is capped at the deployment's `NOTIFICATION_MAX_PAGE_SIZE`
(10–100). `unreadCount` counts the whole inbox, not just the page returned.
`pagination` carries exactly `page`, `limit`, `total` and `totalPages`.

**Example Request**

```bash
curl -X GET "https://api.scrumooth.dev/api/v1/notifications?type=TASK_ASSIGNMENT&isRead=false" \
  -b cookies.txt
```

---

### Get Unread Count

Get the count of unread notifications for the authenticated user.

**Endpoint**

```
GET /api/v1/notifications/unread-count
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
    "count": 5,
    "lastCheckedAt": "2026-04-29T14:00:00.000Z"
  }
}
```

The count is wrapped in the standard envelope, like every other notification
endpoint: the interface reads `data.count`.

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/notifications/unread-count \
  -b cookies.txt
```

---

### Send Message

Send a direct message to a team member. Creates a notification for the recipient.

**Endpoint**

```
POST /api/v1/notifications/send-message
```

**Authentication**

- Required

**Request Body**

```json
{
  "recipientId": "string (required, user UUID)",
  "message": "string (required, message content)"
}
```

**Success Response**

The message is stored as the recipient's `DIRECT_MESSAGE` notification, with
`params.titleKey = "directMessageTitle"` and `params.messageKey = "directMessageBody"`,
so the title re-labels itself with the recipient's interface language while the body
stays the sender's own words.

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "notification": {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "userId": "550e8400-e29b-41d4-a716-446655440004",
      "type": "DIRECT_MESSAGE",
      "title": "Message from Tobin Veleth",
      "message": "Hey, can you review the PR when you get a chance?",
      "messageKey": "directMessageBody",
      "params": {
        "titleKey": "directMessageTitle",
        "titleParams": { "senderName": "Tobin Veleth" },
        "messageKey": "directMessageBody",
        "messageParams": { "message": "Hey, can you review the PR when you get a chance?" }
      },
      "data": { "senderId": "550e8400-e29b-41d4-a716-446655440001" },
      "isRead": false,
      "createdAt": "2026-04-29T14:00:00.000Z"
    }
  }
}
```

The endpoint answers `200`, not `201`: it records a notification rather than creating
an addressable resource.

**Error Responses**

**400 Bad Request - Missing Field**

```json
{
  "success": false,
  "error": {
    "message": "Recipient ID and message are required"
  }
}
```

**404 Not Found - Recipient Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Recipient not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/notifications/send-message \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "recipientId": "550e8400-e29b-41d4-a716-446655440004",
    "message": "Hey, can you review the PR when you get a chance?"
  }'
```

---

### Mark as Read

Mark a single notification as read.

**Endpoint**

```
PATCH /api/v1/notifications/:id/read
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Notification UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "notification": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "type": "TASK_ASSIGNMENT",
      "title": "New task assigned: \"Implement login page\"",
      "message": "In sprint \"Sprint 5\"",
      "isRead": true,
      "readAt": "2026-04-29T14:05:00.000Z",
      "createdAt": "2026-04-29T12:00:00.000Z"
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
    "message": "Notification not found"
  }
}
```

**Example Request**

```bash
curl -X PATCH https://api.scrumooth.dev/api/v1/notifications/550e8400-e29b-41d4-a716-446655440010/read \
  -b cookies.txt
```

---

### Mark All as Read

Mark all notifications as read, or only specific notifications if IDs are provided.

**Endpoint**

```
PATCH /api/v1/notifications/mark-all-read
```

**Authentication**

- Required

**Request Body**

```json
{
  "notificationIds": "array of UUIDs (optional - if provided, only marks those as read)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "updatedCount": 5
  }
}
```

**Example Request**

Mark all notifications as read:

```bash
curl -X PATCH https://api.scrumooth.dev/api/v1/notifications/mark-all-read \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

Mark specific notifications as read:

```bash
curl -X PATCH https://api.scrumooth.dev/api/v1/notifications/mark-all-read \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "notificationIds": [
      "550e8400-e29b-41d4-a716-446655440010",
      "550e8400-e29b-41d4-a716-446655440011",
      "550e8400-e29b-41d4-a716-446655440012"
    ]
  }'
```

---

### Delete Notification

Delete a notification. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/notifications/:id
```

**Authentication**

- Required

**Path Parameters**

- `id` (string, required): Notification UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Notification deleted successfully"
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
    "message": "Notification not found"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/notifications/550e8400-e29b-41d4-a716-446655440010 \
  -b cookies.txt
```

---

## Error Codes

| Code                  | HTTP Status | Description                                     |
| --------------------- | ----------- | ----------------------------------------------- |
| `BAD_REQUEST`         | 400         | A required field is missing (see Send Message)  |
| `UNAUTHORIZED`        | 401         | Authentication required                         |
| `FORBIDDEN`           | 403         | Insufficient permissions                        |
| `NOT_FOUND`           | 404         | Notification or recipient not found             |
| `VALIDATION_ERROR`    | 422         | Request validation failed, with `error.details` |
| `RATE_LIMIT_EXCEEDED` | 429         | Notification rate limit exceeded (200/15min)    |

The codes are the ones `AppError` subclasses in `packages/backend/src/utils/errors.ts`
carry; the interface branches on `error.code`, so a code that does not match is a
failure it cannot present.

## Best Practices

### Notification Management

1. **Polling Frequency**: Poll unread count at reasonable intervals (e.g., every 30 seconds) rather than continuous polling
2. **Bulk Operations**: Use `mark-all-read` with `notificationIds` for batch updates instead of individual PATCH requests
3. **Filtering**: Use the `type` and `isRead` query parameters to reduce payload size and improve performance
4. **Pagination**: Always use pagination when fetching notifications to avoid large responses

### Direct Messaging

1. **Recipient Validation**: Ensure the recipient is a team member before sending a message
2. **Message Content**: Keep messages concise and relevant to the project
3. **Rate Limiting**: Respect the 200 requests per 15 minutes rate limit to avoid throttling

### Security

1. **Access Control**: Users can only access and manage their own notifications
2. **Audit Trail**: All notification actions are logged
3. **Input Validation**: Message content is validated and sanitized on the server

---

**Last Updated**: 2026-09-27

**Related Documentation**

- [Authentication API](./authentication.md)
- [Teams API](./teams.md)
- [Sprints API](./sprints.md)
