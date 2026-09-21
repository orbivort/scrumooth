# scrumooth API Documentation

Welcome to the scrumooth API documentation. Scrumooth is the self-hosted **Scrum Guide enforcement layer**: the rules of the 2020 Scrum Guide are enforced server-side, so the same gates that hold in the interface also hold when you call the API directly — a Sprint cannot close before its Review and Retrospective, only Developers size work, and nothing is Done until its Definition of Done passes. This comprehensive guide provides detailed information about all available API endpoints, authentication methods, request/response formats, and error handling.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Versioning](#api-versioning)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
- [Common Patterns](#common-patterns)
- [Client Integration Examples](#client-integration-examples)
- [Best Practices](#best-practices)

## Getting Started

### Base URL

Scrumooth is **self-hosted**, so there is no public API endpoint. All API requests
are made against **your own deployment**:

```
Self-hosted:  https://<your-domain>/api/v1
Development:  http://localhost:5001/api/v1
```

Replace `<your-domain>` with the hostname of your own instance. For local
development, the backend listens on port `5001` by default (override it with
`PORT` in `packages/backend/.env`).

### Content Type

All API requests and responses use JSON format. Ensure you set the appropriate headers:

```http
Content-Type: application/json
Accept: application/json
```

### Quick Start Example

```bash
# Register a new user
curl -X POST http://localhost:5001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

## Authentication

scrumooth uses JWT (JSON Web Token) based authentication with secure HTTP-only cookies for enhanced security.

### Authentication Methods

#### 1. Cookie-Based Authentication (Recommended)

After successful login, the server sets two HTTP-only cookies:

- `accessToken`: Short-lived token (15 minutes)
- `refreshToken`: Long-lived token (7 days)

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**

```http
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict
Set-Cookie: refreshToken=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json

{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

#### 2. Bearer Token Authentication

For API clients that cannot use cookies, include the access token in the Authorization header:

```http
GET /api/v1/teams
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Refresh

Access tokens expire after 15 minutes. Use the refresh token to obtain a new access token:

```http
POST /api/v1/auth/refresh
Cookie: refreshToken=eyJhbGc...
```

**Response:**

```http
HTTP/1.1 200 OK
Set-Cookie: accessToken=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict
```

### Session Management

- **Idle Timeout**: 30 minutes of inactivity
- **Absolute Timeout**: 24 hours maximum session duration
- **Concurrent Sessions**: Maximum 5 active sessions per user
- **Session Activity**: Activity is tracked automatically

### Logout

```http
POST /api/v1/auth/logout
Cookie: accessToken=eyJhbGc...
```

To logout from all devices:

```http
POST /api/v1/auth/logout-all
Cookie: accessToken=eyJhbGc...
```

## API Versioning

The API uses URL-based versioning. The current version is `v1`.

```
/api/v1/resource
```

### Versioning Strategy

- **Major versions**: Breaking changes (e.g., v1 → v2)
- **Minor versions**: Non-breaking feature additions
- **Patch versions**: Bug fixes and improvements

### Version Lifecycle

- **Current version**: Fully supported with all features
- **Previous version**: Supported for 6 months after new major release
- **Deprecated versions**: No longer supported

## Request/Response Format

### Request Format

All request bodies must be in JSON format:

```json
{
  "field1": "value1",
  "field2": "value2"
}
```

### Response Format

All API responses follow a consistent structure:

#### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2026-04-29T12:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-04-29T12:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Pagination

List endpoints support pagination:

```http
GET /api/v1/teams?page=1&limit=20&sort=createdAt&order=desc
```

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Filtering and Sorting

```http
GET /api/v1/backlog?status=IN_PROGRESS&priority=MUST_HAVE&sort=priority&order=desc
```

## Error Handling

### HTTP Status Codes

| Status Code | Description                                           |
| ----------- | ----------------------------------------------------- |
| 200         | OK - Request successful                               |
| 201         | Created - Resource created successfully               |
| 204         | No Content - Successful request with no response body |
| 400         | Bad Request - Invalid request syntax or parameters    |
| 401         | Unauthorized - Authentication required or failed      |
| 403         | Forbidden - Insufficient permissions                  |
| 404         | Not Found - Resource not found                        |
| 409         | Conflict - Resource conflict (e.g., duplicate email)  |
| 422         | Unprocessable Entity - Validation error               |
| 429         | Too Many Requests - Rate limit exceeded               |
| 500         | Internal Server Error - Server error                  |

### Error Codes

| Code                       | Description                            |
| -------------------------- | -------------------------------------- |
| `VALIDATION_ERROR`         | Request validation failed              |
| `AUTHENTICATION_ERROR`     | Authentication failed                  |
| `AUTHORIZATION_ERROR`      | Insufficient permissions               |
| `NOT_FOUND`                | Resource not found                     |
| `CONFLICT`                 | Resource conflict                      |
| `RATE_LIMIT_EXCEEDED`      | Too many requests                      |
| `SESSION_IDLE_TIMEOUT`     | Session expired due to inactivity      |
| `SESSION_ABSOLUTE_TIMEOUT` | Session expired (max duration reached) |

### Gate Rejections

Scrumooth enforces the 2020 Scrum Guide server-side, so the same gates that hold in the interface also hold when you call the API directly. When a gate refuses an action the response carries `error.code` set to a stable `GATE_*` value, letting a client branch on the refusal without parsing the localized message. The codes are defined in `packages/shared/src/constants/gateCodes.ts`.

| Code                                           | HTTP | Rule enforced                                                                                                                                                                                               |
| ---------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATE_SPRINT_EVENTS_MISSING`                   | 400  | A Sprint cannot close before its Sprint Review and Sprint Retrospective are recorded.                                                                                                                       |
| `GATE_IMPEDIMENTS_UNRESOLVED`                  | 400  | A Sprint cannot close while it still has unresolved impediments.                                                                                                                                            |
| `GATE_IMPEDIMENT_TEAM_MEMBERS_ONLY`            | 403  | An impediment belongs to its Scrum Team: reading or changing one requires membership of the team that raised it.                                                                                            |
| `GATE_IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED` | 400  | Reaching a resolved or closed state requires written resolution text, so an impediment cannot be closed to lift the Sprint-close gate without saying how it was removed.                                    |
| `GATE_DOD_NOT_VERIFIED`                        | 400  | Nothing is Done until every active Definition of Done item is verified.                                                                                                                                     |
| `GATE_LEADERSHIP_ROLE_TAKEN`                   | 409  | A team can hold exactly one Product Owner and one Scrum Master.                                                                                                                                             |
| `GATE_TEAM_SIZE_LIMIT`                         | 409  | A Scrum Team cannot grow past `TEAM_MAX_SIZE`.                                                                                                                                                              |
| `GATE_DEVELOPER_ONLY_SIZING`                   | 403  | Only Developers size Product Backlog items.                                                                                                                                                                 |
| `GATE_DEVELOPER_ONLY_DAILY_SCRUM`              | 403  | Only Developers author or join the Daily Scrum.                                                                                                                                                             |
| `GATE_PRODUCT_OWNER_ONLY_CANCELLATION`         | 403  | Only the Product Owner can cancel an `ACTIVE` Sprint.                                                                                                                                                       |
| `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`        | 403  | Only the Product Owner orders the Product Backlog: the order and the MoSCoW band are their decision.                                                                                                        |
| `GATE_INCREMENT_LOCKED`                        | 400  | A delivered Increment cannot be rewritten.                                                                                                                                                                  |
| `GATE_DEVELOPER_ONLY_SPRINT_BACKLOG`           | 403  | Only Developers save the Sprint Backlog.                                                                                                                                                                    |
| `GATE_PBI_NOT_READY`                           | 400  | A Product Backlog item must be refined to `READY` before it can enter a Sprint.                                                                                                                             |
| `GATE_PRODUCT_GOAL_ALREADY_ACTIVE`             | 409  | A team can pursue only one Product Goal at a time.                                                                                                                                                          |
| `GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL`         | 403  | Only the Product Owner creates, edits, or deletes a Product Goal.                                                                                                                                           |
| `GATE_PRODUCT_GOAL_REQUIRED`                   | 400  | A Sprint cannot start until it is linked to a Product Goal.                                                                                                                                                 |
| `GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG`       | 400  | The Product Backlog is the emergent expression of the Product Goal: items can only be added while an ACTIVE Product Goal exists.                                                                            |
| `GATE_PRODUCT_GOAL_NOT_ACTIVE`                 | 409  | A backlog item may only be linked to the team's single ACTIVE Product Goal.                                                                                                                                 |
| `GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED`          | 409  | A Product Goal cannot be completed without recorded evidence of progress toward it.                                                                                                                         |
| `GATE_PLANNING_PARTICIPATION_REQUIRED`         | 400  | The Sprint Backlog is "created by the collaborative work of the entire Scrum Team": a Sprint cannot start unless planning attendance is recorded and includes the Product Owner and at least one Developer. |
| `GATE_CAPACITY_EXCEEDED`                       | 400  | A Sprint cannot start when the planned work exceeds the capacity recorded during Sprint Planning beyond `SPRINT_CAPACITY_TOLERANCE_PCT`.                                                                    |
| `GATE_SPRINT_DURATION_LIMIT`                   | 400  | "Sprints are fixed length... a Sprint is one month or less": a Sprint may span at most `SPRINT_MAX_DURATION_DAYS` (28 days), and its end date must be after its start date.                                 |
| `GATE_SPRINT_DATES_OVERLAP`                    | 409  | A team runs one Sprint at a time: the dates may not overlap another Sprint (or an unmaterialized generated Sprint) of the same team.                                                                        |
| `GATE_SPRINT_NOT_CONTIGUOUS`                   | 400  | "A new Sprint starts immediately after the conclusion of the previous Sprint": at most the intervening weekend (`SPRINT_CONTIGUITY_MAX_GAP_DAYS`) may separate two Sprints.                                 |
| `GATE_SPRINT_TEAM_MEMBERS_ONLY`                | 403  | The Sprint belongs to its Scrum Team: creating, starting, or replanning it requires membership of the team that owns it.                                                                                    |
| `GATE_SPRINT_GOAL_LOCKED`                      | 400  | The Sprint Goal is a commitment once the Sprint is running: it is only editable while the Sprint is `DRAFT`/`PLANNED`.                                                                                      |
| `GATE_SPRINT_SCOPE_CHANGE_NEEDS_PO`            | 403  | "No changes are made that would endanger the Sprint Goal": only the Product Owner acknowledges a goal-endangering Sprint Backlog change.                                                                    |
| `GATE_SPRINT_SCOPE_CHANGE_ALREADY_PENDING`     | 409  | One goal-endangering change per item may await the Product Owner at a time.                                                                                                                                 |

```json
{
  "success": false,
  "error": {
    "code": "GATE_PRODUCT_GOAL_ALREADY_ACTIVE",
    "message": "An active Product Goal already exists for this team. Fulfil or abandon it before activating another."
  }
}
```

### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse and ensure fair usage.

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1619712000
```

### Rate Limits by Endpoint Type

| Endpoint Type  | Limit        | Window     |
| -------------- | ------------ | ---------- |
| Authentication | 5 requests   | 15 minutes |
| Login          | 10 requests  | 15 minutes |
| API Endpoints  | 100 requests | 15 minutes |
| Notifications  | 200 requests | 15 minutes |

### Rate Limit Exceeded Response

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later."
  }
}
```

## Endpoints

### Authentication

- [Authentication API](./authentication.md) - User registration, login, logout, session management

### Team Management

- [Teams API](./teams.md) - Team creation, member management, roles

### Product Management

- [Product Goals API](./product-goals.md) - Strategic goal management
- [Product Backlog API](./product-backlog.md) - Backlog item management

### Sprint Management

- [Sprints API](./sprints.md) - Sprint planning, execution, tracking
- [Sprint Board API](./sprint-board.md) - Kanban board operations
- [Daily Scrum API](./daily-scrum.md) - Daily standup management
- [Impediments API](./impediments.md) - Impediment tracking

### Sprint Reviews and Retrospectives

- [Sprint Reviews API](./sprint-reviews.md) - Sprint review management
- [Retrospectives API](./retrospectives.md) - Retrospective management
- [Increments API](./increments.md) - Product increment tracking

### Definition of Done/Ready

- [Definition of Done API](./definition-of-done.md) - DoD management
- [Definition of Ready API](./definition-of-ready.md) - DoR management

### Workflow Engine

- [Workflow API](./workflow.md) - Workflow configuration and state transitions

### Notifications

- [Notifications API](./notifications.md) - Notification management

### Reporting

- [Reports API](./reports.md) - Metrics and analytics

### Data Management

- [Data Export API](./data-export.md) - GDPR-compliant data export
- [Account Management API](./account-management.md) - Account deletion and privacy

## Common Patterns

### Authentication Flow

```mermaid
sequenceDiagram
    Client->>API: POST /auth/register
    API->>Client: 201 Created (user data)
    Client->>API: POST /auth/login
    API->>Client: 200 OK (set cookies)
    Client->>API: GET /teams (with cookies)
    API->>Client: 200 OK (teams data)
```

### Error Handling Pattern

```javascript
try {
  const response = await fetch('/api/v1/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamData),
    credentials: 'include', // Include cookies
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle error
    console.error('Error:', data.error);
    return;
  }

  // Success
  console.log('Team created:', data.data);
} catch (error) {
  console.error('Network error:', error);
}
```

### Pagination Pattern

```javascript
async function fetchAllTeams(page = 1, limit = 20) {
  const response = await fetch(`/api/v1/teams?page=${page}&limit=${limit}`, {
    credentials: 'include',
  });

  const data = await response.json();

  if (data.success) {
    console.log(`Page ${page} of ${data.data.pagination.totalPages}`);
    console.log(`Total teams: ${data.data.pagination.total}`);
    return data.data.items;
  }
}
```

## Client Integration Examples

> **Note:** Scrumooth does not currently ship an official SDK or client library.
> Integrate with the API directly over HTTP. The examples below use the standard
> `fetch` API and cURL.

### JavaScript/TypeScript (fetch)

```typescript
const BASE_URL = 'http://localhost:5001/api/v1';

// Login (sets HTTP-only cookies)
const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your-password',
  }),
});

// Get teams (cookies are sent automatically)
const teamsResponse = await fetch(`${BASE_URL}/teams`, {
  credentials: 'include',
});

const { data } = await teamsResponse.json();
console.log(data.items);
```

### cURL Examples

See individual endpoint documentation for detailed cURL examples.

## Best Practices

### Security

1. **Use HTTPS**: Always use HTTPS in production
2. **Secure Cookies**: Prefer cookie-based authentication over tokens
3. **Token Storage**: Never store tokens in localStorage (use HTTP-only cookies)
4. **CSRF Protection**: Include CSRF tokens for state-changing operations
5. **Rate Limiting**: Implement client-side rate limiting to avoid 429 errors

### Performance

1. **Pagination**: Always use pagination for list endpoints
2. **Caching**: Cache responses when appropriate
3. **Batch Operations**: Use bulk endpoints when available
4. **Field Selection**: Request only needed fields

### Error Handling

1. **Check Status Codes**: Always check HTTP status codes
2. **Parse Error Details**: Extract detailed error information
3. **Retry Logic**: Implement exponential backoff for retries
4. **User Feedback**: Provide clear error messages to users

## Changelog

See [CHANGELOG.md](../../CHANGELOG.md) for API version history and changes.

---

**Last Updated**: 2026-08-16  
**API Version**: v1
