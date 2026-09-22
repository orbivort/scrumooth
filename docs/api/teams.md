# Teams API

Complete Teams API reference for team management, member administration, and team-specific configurations.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Team Roles](#team-roles)
- [Endpoints](#endpoints)
  - [Get User Teams](#get-user-teams)
  - [Get My Teams](#get-my-teams)
  - [Create Team](#create-team)
  - [Get Team by ID](#get-team-by-id)
  - [Update Team](#update-team)
  - [Delete Team](#delete-team)
  - [Add Member](#add-member)
  - [Remove Member](#remove-member)
  - [Update Member Role](#update-member-role)
  - [Get My Role](#get-my-role)
  - [Select Team](#select-team)
- [Definition of Done/Ready](#definition-of-doneready)
- [Error Codes](#error-codes)

## Overview

The Teams API provides comprehensive team management capabilities including:

- Team creation and configuration
- Member invitation and role management
- Team context management
- Definition of Done (DoD) and Definition of Ready (DoR) management
- Team-specific settings and workflows

## Authentication

All team endpoints require authentication. Include the access token in your request:

**Using Cookies (Recommended)**

```http
GET /api/v1/teams
Cookie: accessToken=eyJhbGc...
```

**Using Bearer Token**

```http
GET /api/v1/teams
Authorization: Bearer eyJhbGc...
```

## Team Roles

Scrumooth uses role-based access control (RBAC) with three distinct roles:

| Role              | Permissions                                                                    |
| ----------------- | ------------------------------------------------------------------------------ |
| **Product Owner** | Full team management, product backlog, product goals, sprint cancellation      |
| **Scrum Master**  | Manage team members, DoD/DoR, facilitate ceremonies                            |
| **Developers**    | Size work, save the Sprint Backlog, author the Daily Scrum, update board tasks |

### Role Hierarchy

```
Product Owner
    └── Scrum Master
            └── Developers
```

## Endpoints

### Get User Teams

Get all teams the authenticated user is a member of.

**Endpoint**

```
GET /api/v1/teams
```

**Authentication**

- Required

**Query Parameters**

- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `sort` (string, optional): Sort field (default: createdAt)
- `order` (string, optional): Sort order - asc/desc (default: desc)

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "teams": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Development Team",
        "description": "Main development team",
        "createdAt": "2026-04-29T12:00:00.000Z",
        "createdBy": "550e8400-e29b-41d4-a716-446655440001",
        "updatedAt": "2026-04-29T12:00:00.000Z",
        "members": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "userId": "550e8400-e29b-41d4-a716-446655440001",
            "role": "PRODUCT_OWNER",
            "user": {
              "id": "550e8400-e29b-41d4-a716-446655440001",
              "email": "admin@example.com",
              "firstName": "John",
              "lastName": "Doe",
              "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=John"
            }
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/teams \
  -b cookies.txt
```

---

### Get My Teams

Get current user's teams with their roles.

**Endpoint**

```
GET /api/v1/teams/my-teams
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
    "teams": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Development Team",
        "description": "Main development team",
        "role": "PRODUCT_OWNER",
        "joinedAt": "2026-04-29T12:00:00.000Z"
      }
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/teams/my-teams \
  -b cookies.txt
```

---

### Create Team

Create a new team. The creator automatically becomes the Product Owner.

**Endpoint**

```
POST /api/v1/teams
```

**Authentication**

- Required

**Request Body**

```json
{
  "name": "string (required, 1-100 chars)",
  "description": "string (optional, max 500 chars)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "team": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Development Team",
      "description": "Main development team",
      "createdAt": "2026-04-29T12:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "updatedAt": "2026-04-29T12:00:00.000Z",
      "members": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "userId": "550e8400-e29b-41d4-a716-446655440001",
          "role": "PRODUCT_OWNER",
          "joinedAt": "2026-04-29T12:00:00.000Z"
        }
      ]
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
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

**409 Conflict - Team Name Exists**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Team name already exists"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/teams \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Development Team",
    "description": "Main development team for Scrumooth"
  }'
```

---

### Get Team by ID

Get detailed information about a specific team.

**Endpoint**

```
GET /api/v1/teams/:teamId
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
    "team": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Development Team",
      "description": "Main development team",
      "createdAt": "2026-04-29T12:00:00.000Z",
      "createdBy": "550e8400-e29b-41d4-a716-446655440001",
      "updatedAt": "2026-04-29T12:00:00.000Z",
      "members": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "userId": "550e8400-e29b-41d4-a716-446655440001",
          "role": "PRODUCT_OWNER",
          "joinedAt": "2026-04-29T12:00:00.000Z",
          "user": {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "email": "admin@example.com",
            "firstName": "John",
            "lastName": "Doe",
            "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=John"
          }
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
curl -X GET https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Update Team

Update team information. Requires Product Owner role.

**Endpoint**

```
PUT /api/v1/teams/:teamId
```

**Authentication**

- Required
- Product Owner role required

**Path Parameters**

- `teamId` (string, required): Team UUID

**Request Body**

```json
{
  "name": "string (optional, 1-100 chars)",
  "description": "string (optional, max 500 chars)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "team": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Updated Team Name",
      "description": "Updated description",
      "updatedAt": "2026-04-29T13:00:00.000Z"
    }
  }
}
```

**Error Responses**

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Product Owner role required"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Updated Team Name",
    "description": "Updated team description"
  }'
```

---

### Delete Team

Delete a team. Requires Product Owner role. This action is irreversible.

**Endpoint**

```
DELETE /api/v1/teams/:teamId
```

**Authentication**

- Required
- Product Owner role required

**Path Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Team deleted successfully"
  }
}
```

**Error Responses**

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Product Owner role required"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### Add Member

Add a new member to the team. Requires Scrum Master or Product Owner role.

**Endpoint**

```
POST /api/v1/teams/:teamId/members
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `teamId` (string, required): Team UUID

**Request Body**

```json
{
  "email": "string (required, valid email)",
  "role": "string (required, one of: PRODUCT_OWNER, SCRUM_MASTER, DEVELOPERS)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "member": {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "userId": "550e8400-e29b-41d4-a716-446655440004",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "DEVELOPERS",
      "joinedAt": "2026-04-29T14:00:00.000Z",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "email": "developer@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane"
      }
    }
  }
}
```

**Error Responses**

**404 Not Found - User Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found with this email"
  }
}
```

**409 Conflict - Already a Member**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "User is already a member of this team"
  }
}
```

**409 Conflict - Team Size Limit Reached**

The Scrum Team has reached its configured maximum number of members (default `10`, configurable via `TEAM_MAX_SIZE`). No additional members can be added.

```json
{
  "success": false,
  "error": {
    "code": "TEAM_SIZE_LIMIT_REACHED",
    "message": "This team has reached the maximum size of 10 members. No additional members can be added."
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/members \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "developer@example.com",
    "role": "DEVELOPERS"
  }'
```

---

### Remove Member

Remove a member from the team. Requires Scrum Master or Product Owner role.

**Endpoint**

```
DELETE /api/v1/teams/:teamId/members/:memberId
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `teamId` (string, required): Team UUID
- `memberId` (string, required): Member ID (not user ID)

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Member removed successfully"
  }
}
```

**Error Responses**

**404 Not Found - Member Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Member not found"
  }
}
```

**403 Forbidden - Cannot Remove Last Admin**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Cannot remove the last administrator"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440003 \
  -b cookies.txt
```

---

### Update Member Role

Update a team member's role. Requires Scrum Master or Product Owner role.

**Endpoint**

```
PUT /api/v1/teams/:teamId/members/:memberId
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `teamId` (string, required): Team UUID
- `memberId` (string, required): Member ID

**Request Body**

```json
{
  "role": "string (required, one of: PRODUCT_OWNER, SCRUM_MASTER, DEVELOPERS)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "member": {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "userId": "550e8400-e29b-41d4-a716-446655440004",
      "teamId": "550e8400-e29b-41d4-a716-446655440000",
      "role": "SCRUM_MASTER",
      "joinedAt": "2026-04-29T14:00:00.000Z",
      "updatedAt": "2026-04-29T15:00:00.000Z"
    }
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/members/550e8400-e29b-41d4-a716-446655440003 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "role": "SCRUM_MASTER"
  }'
```

---

### Get My Role

Get the current user's role in a specific team.

**Endpoint**

```
GET /api/v1/teams/:teamId/my-role
```

**Authentication**

- Required

**Path Parameters**

- `teamId` (string, required): Team UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "role": "PRODUCT_OWNER",
    "permissions": [
      "team:read",
      "team:update",
      "team:delete",
      "member:manage",
      "backlog:manage",
      "sprint:manage"
    ]
  }
}
```

**Example Request**

```bash
curl -X GET https://api.scrumooth.dev/api/v1/teams/550e8400-e29b-41d4-a716-446655440000/my-role \
  -b cookies.txt
```

---

### Select Team

Select a team for the current session context.

**Endpoint**

```
POST /api/v1/teams/select-team
```

**Authentication**

- Required

**Request Body**

```json
{
  "teamId": "string (required, team UUID)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Team selected successfully",
    "team": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Development Team"
    }
  }
}
```

**Example Request**

```bash
curl -X POST https://api.scrumooth.dev/api/v1/teams/select-team \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "teamId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

## Definition of Done/Ready

For Definition of Done and Definition of Ready endpoints, see:

- [Definition of Done API](./definition-of-done.md)
- [Definition of Ready API](./definition-of-ready.md)

## Error Codes

| Code                      | HTTP Status | Description                                                |
| ------------------------- | ----------- | ---------------------------------------------------------- |
| `VALIDATION_ERROR`        | 400         | Request validation failed                                  |
| `AUTHENTICATION_ERROR`    | 401         | Authentication required                                    |
| `AUTHORIZATION_ERROR`     | 403         | Insufficient permissions                                   |
| `NOT_FOUND`               | 404         | Team or member not found                                   |
| `CONFLICT`                | 409         | Resource conflict (e.g., duplicate name, already a member) |
| `TEAM_SIZE_LIMIT_REACHED` | 409         | Team has reached its maximum member size                   |

## Best Practices

### Team Management

1. **Role Assignment**: Assign minimum required roles to team members
2. **Member Management**: Regularly review team membership
3. **Team Naming**: Use clear, descriptive team names
4. **Documentation**: Keep team descriptions up to date

### Security

1. **Access Control**: Verify user permissions before operations
2. **Audit Trail**: All team changes are logged
3. **Member Validation**: Only invite verified users
4. **Role Hierarchy**: Respect role hierarchy when managing members

---

**Last Updated**: 2026-05-10

## Scrum Values health checks

A health check is a survey of the team's own judgement of how it lives the five Scrum Values. It is
opened by the team's Scrum Master and answered by the team.

| Endpoint                              | Method | Who                                                |
| ------------------------------------- | ------ | -------------------------------------------------- |
| `/teams/:teamId/health-checks`        | POST   | The team's Scrum Master                            |
| `/teams/:teamId/health-checks/latest` | GET    | Any member of the team                             |
| `/teams/:teamId/health-check-trend`   | GET    | The team's Scrum Master                            |
| `/health-checks/:id/responses`        | POST   | Any member of the team the survey belongs to       |
| `/health-checks/:id/results`          | GET    | The Scrum Master of the team the survey belongs to |

**The resource's own team governs access, and nothing else does.** Results and trend aggregate the
team's own scores, so they are readable only by the Scrum Master _of that team_: a Scrum Master of
another team is refused with `GATE_HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY`, and answering a survey or
looking up its status requires membership of the team being surveyed
(`GATE_HEALTH_CHECK_TEAM_MEMBERS_ONLY`). The check is resolved from the health check's own team,
because the results route carries no `teamId` — a generic role guard there would fall back to
"holds this role in any team", which is exactly the defect this rule closes.

Results are aggregate-only: per-value averages and response counts, never an individual score.

**Related Documentation**

- [Authentication API](./authentication.md)
- [Product Backlog API](./product-backlog.md)
- [Sprints API](./sprints.md)
