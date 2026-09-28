# Sprint Board API

Complete Sprint Board API reference for Kanban-style board operations, task management, and real-time sprint board interactions.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Board Layout](#board-layout)
- [Endpoints](#endpoints)
  - [Get Board Data](#get-board-data)
  - [Update Task Status](#update-task-status)
  - [Create Task](#create-task)
  - [Update Task](#update-task)
  - [Delete Task](#delete-task)
  - [Add PBI to Sprint](#add-pbi-to-sprint)
  - [Remove PBI from Sprint](#remove-pbi-from-sprint)
  - [Get Burndown Chart Data](#get-burndown-chart-data)
  - [Get DoD Compliance](#get-dod-compliance)
- [Drag-and-Drop Pattern](#drag-and-drop-pattern)
- [Real-Time Update Considerations](#real-time-update-considerations)
- [Error Codes](#error-codes)
- [Best Practices](#best-practices)

## Overview

The Sprint Board API provides Kanban-style board operations for sprint execution. It is a companion to the [Sprints API](./sprints.md), focusing specifically on the interactive board experience:

- Board data retrieval with tasks grouped by status columns
- Task status updates for drag-and-drop interactions
- Task CRUD operations within the board context
- Sprint backlog management (add/remove PBIs)
- Burndown chart data for progress visualization
- Definition of Done compliance checking

The board presents tasks in three status columns: **TODO**, **IN_PROGRESS**, and **DONE**. Tasks are associated with product backlog items (PBIs) and can be moved between columns to reflect their current state.

## Authentication

All sprint board endpoints require authentication. See [Authentication](./README.md#authentication) for the cookie and bearer-token forms.

## Board Layout

The sprint board organizes tasks into three status columns:

```
+-------------------+-------------------+-------------------+
|       TODO        |    IN_PROGRESS    |        DONE       |
+-------------------+-------------------+-------------------+
| - Task A          | - Task D          | - Task G          |
| - Task B          | - Task E          | - Task H          |
| - Task C          | - Task F          |                   |
+-------------------+-------------------+-------------------+
```

Each task is associated with a PBI. The board can optionally group tasks by their parent PBI for a more structured view.

### Task Status Values

| Status        | Description                       | Column      |
| ------------- | --------------------------------- | ----------- |
| `TODO`        | Task has not been started         | TODO        |
| `IN_PROGRESS` | Task is currently being worked on | IN_PROGRESS |
| `DONE`        | Task has been completed           | DONE        |

## Endpoints

### Get Board Data

Get all tasks for a sprint, suitable for rendering the Kanban board grouped by status.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/tasks
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
    "tasks": [
      {
        "id": "990e8400-e29b-41d4-a716-446655440001",
        "sprintId": "660e8400-e29b-41d4-a716-446655440000",
        "pbiId": "880e8400-e29b-41d4-a716-446655440001",
        "title": "Implement login API endpoint",
        "description": "Create the POST /api/v1/auth/login endpoint",
        "status": "IN_PROGRESS",
        "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
        "estimatedHours": 8,
        "remainingHours": 4,
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-03T10:00:00.000Z",
        "pbi": {
          "id": "880e8400-e29b-41d4-a716-446655440001",
          "title": "User login page",
          "priority": "MUST",
          "storyPoints": 5
        },
        "assignee": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "firstName": "John",
          "lastName": "Doe",
          "avatarUrl": "https://api.dicebear.com/7.x/avataaars/svg?seed=John"
        }
      }
    ]
  }
}
```

**Frontend Grouping Example**

After retrieving tasks, group them by status on the frontend:

```typescript
const groupedTasks = tasks.reduce(
  (acc, task) => {
    const column = task.status; // 'TODO' | 'IN_PROGRESS' | 'DONE'
    acc[column] = acc[column] ?? [];
    acc[column].push(task);
    return acc;
  },
  {} as Record<TaskStatus, Task[]>
);
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
curl -X GET https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks \
  -b cookies.txt
```

---

### Update Task Status

Update the status of a task, typically triggered by a drag-and-drop action on the board.

**Endpoint**

```
PUT /api/v1/sprints/:sprintId/tasks/:taskId
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `taskId` (string, required): Task UUID

**Request Body (Status Update)**

```json
{
  "status": "string (required, one of: TODO, IN_PROGRESS, DONE)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "task": {
      "id": "990e8400-e29b-41d4-a716-446655440001",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440001",
      "title": "Implement login API endpoint",
      "status": "IN_PROGRESS",
      "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
      "estimatedHours": 8,
      "remainingHours": 4,
      "updatedAt": "2026-05-03T10:00:00.000Z"
    }
  }
}
```

**Error Responses**

**400 Bad Request - Invalid Status**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task status. Must be one of: TODO, IN_PROGRESS, DONE"
  }
}
```

**404 Not Found - Task Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

---

### Create Task

Create a new task on the sprint board. The task will appear in the TODO column by default.

**Endpoint**

```
POST /api/v1/sprints/:sprintId/tasks
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Request Body**

```json
{
  "pbiId": "string (required, UUID of the parent PBI)",
  "title": "string (required, 1-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "assigneeId": "string (optional, UUID of team member)",
  "estimatedHours": "number (optional, positive value)",
  "remainingHours": "number (optional, min 0)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "task": {
      "id": "990e8400-e29b-41d4-a716-446655440002",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440001",
      "title": "Write unit tests for login",
      "description": "Cover all edge cases for the login endpoint",
      "status": "TODO",
      "assigneeId": "550e8400-e29b-41d4-a716-446655440001",
      "estimatedHours": 4,
      "remainingHours": 4,
      "createdAt": "2026-05-02T08:00:00.000Z",
      "updatedAt": "2026-05-02T08:00:00.000Z"
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
        "field": "title",
        "message": "Title is required"
      }
    ]
  }
}
```

**404 Not Found - PBI Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product backlog item not found"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pbiId": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Write unit tests for login",
    "description": "Cover all edge cases for the login endpoint",
    "estimatedHours": 4,
    "remainingHours": 4
  }'
```

---

### Update Task

Update task details on the sprint board (title, description, assignee, hours, status).

**Endpoint**

```
PUT /api/v1/sprints/:sprintId/tasks/:taskId
```

**Authentication**

- Required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `taskId` (string, required): Task UUID

**Request Body**

```json
{
  "title": "string (optional, 1-200 chars)",
  "description": "string (optional, max 2000 chars)",
  "assigneeId": "string (optional, UUID of team member)",
  "status": "string (optional, one of: TODO, IN_PROGRESS, DONE)",
  "estimatedHours": "number (optional, positive value)",
  "remainingHours": "number (optional, min 0)"
}
```

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "task": {
      "id": "990e8400-e29b-41d4-a716-446655440001",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440001",
      "title": "Implement login API endpoint",
      "description": "Create the POST /api/v1/auth/login endpoint with JWT support",
      "status": "IN_PROGRESS",
      "assigneeId": "550e8400-e29b-41d4-a716-446655440002",
      "estimatedHours": 12,
      "remainingHours": 6,
      "updatedAt": "2026-05-04T16:00:00.000Z"
    }
  }
}
```

**Error Responses**

**404 Not Found - Task Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found"
  }
}
```

**Example Request**

```bash
curl -X PUT https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "description": "Create the POST /api/v1/auth/login endpoint with JWT support",
    "assigneeId": "550e8400-e29b-41d4-a716-446655440002",
    "estimatedHours": 12,
    "remainingHours": 6
  }'
```

---

### Delete Task

Delete a task from the sprint board. Requires Scrum Master role.

**Endpoint**

```
DELETE /api/v1/sprints/:sprintId/tasks/:taskId
```

**Authentication**

- Required
- Scrum Master role required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `taskId` (string, required): Task UUID

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "Task deleted successfully"
  }
}
```

**Error Responses**

**404 Not Found - Task Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Task not found"
  }
}
```

**403 Forbidden - Insufficient Permissions**

```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Scrum Master role required"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### Add PBI to Sprint

Add a product backlog item to the sprint, making its tasks visible on the board. Requires Scrum Master or Product Owner role.

**Endpoint**

```
POST /api/v1/sprints/:sprintId/backlog-items
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID

**Request Body**

```json
{
  "pbiId": "string (required, UUID of the product backlog item)",
  "reason": "string (optional, max 500 chars)"
}
```

**Success Response**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "backlogItem": {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "pbiId": "880e8400-e29b-41d4-a716-446655440003",
      "addedAt": "2026-05-05T10:00:00.000Z",
      "addedBy": "550e8400-e29b-41d4-a716-446655440001",
      "reason": "Critical bug fix needed for release"
    },
    "message": "PBI added to sprint backlog successfully"
  }
}
```

**Error Responses**

**404 Not Found - PBI Not Found**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Product backlog item not found"
  }
}
```

**409 Conflict - PBI Already in Sprint**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "PBI is already in the sprint backlog"
  }
}
```

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-items \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "pbiId": "880e8400-e29b-41d4-a716-446655440003",
    "reason": "Critical bug fix needed for release"
  }'
```

---

### Remove PBI from Sprint

Remove a product backlog item from the sprint board. Requires Scrum Master or Product Owner role.

**Endpoint**

```
DELETE /api/v1/sprints/:sprintId/backlog-items/:pbiId
```

**Authentication**

- Required
- Scrum Master or Product Owner role required

**Path Parameters**

- `sprintId` (string, required): Sprint UUID
- `pbiId` (string, required): Product backlog item UUID

**Request Body**

```json
{
  "taskAction": "string (required, one of: delete, return_to_backlog, keep_in_sprint)",
  "reason": "string (optional, max 500 chars)"
}
```

**Task Action Values**

| Action              | Description                                      |
| ------------------- | ------------------------------------------------ |
| `delete`            | Delete all associated tasks from the sprint      |
| `return_to_backlog` | Return tasks to the product backlog              |
| `keep_in_sprint`    | Keep tasks in the sprint but unlink from the PBI |

**Success Response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "message": "PBI removed from sprint backlog successfully",
    "taskAction": "return_to_backlog"
  }
}
```

**Error Responses**

**404 Not Found - PBI Not in Sprint**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "PBI is not in the sprint backlog"
  }
}
```

**400 Bad Request - Invalid Task Action**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task action. Must be one of: delete, return_to_backlog, keep_in_sprint"
  }
}
```

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/backlog-items/880e8400-e29b-41d4-a716-446655440003 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "taskAction": "return_to_backlog",
    "reason": "Scope reduced for this sprint"
  }'
```

---

### Get Burndown Chart Data

Get burndown chart data for the sprint, used to visualize progress on the board.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/burndown
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
    "burndown": {
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "sprintName": "Sprint 1",
      "startDate": "2026-05-01T00:00:00.000Z",
      "endDate": "2026-05-14T23:59:59.000Z",
      "totalHours": 80,
      "dataPoints": [
        {
          "date": "2026-05-01",
          "remainingHours": 80,
          "idealRemaining": 80
        },
        {
          "date": "2026-05-02",
          "remainingHours": 72,
          "idealRemaining": 74.29
        },
        {
          "date": "2026-05-03",
          "remainingHours": 65,
          "idealRemaining": 68.57
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
curl -X GET https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/burndown \
  -b cookies.txt
```

---

### Get DoD Compliance

Get the Definition of Done compliance report for the sprint, displayed on the board to indicate readiness.

**Endpoint**

```
GET /api/v1/sprints/:sprintId/dod-compliance
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
    "compliance": {
      "sprintId": "660e8400-e29b-41d4-a716-446655440000",
      "overallCompliant": true,
      "compliancePercentage": 85.7,
      "items": [
        {
          "pbiId": "880e8400-e29b-41d4-a716-446655440001",
          "pbiTitle": "User login page",
          "compliant": true,
          "checks": [
            {
              "criterion": "All unit tests pass",
              "passed": true
            },
            {
              "criterion": "Code review completed",
              "passed": true
            },
            {
              "criterion": "Documentation updated",
              "passed": false
            }
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
curl -X GET https://api.example.com/api/v1/sprints/660e8400-e29b-41d4-a716-446655440000/dod-compliance \
  -b cookies.txt
```

---

## Drag-and-Drop Pattern

The sprint board supports drag-and-drop interactions for moving tasks between status columns. The following pattern describes the recommended frontend implementation:

### Flow

1. **User drags a task card** from one column to another
2. **Frontend optimistically updates** the UI to reflect the new status
3. **API request is sent** to update the task status via `PUT /api/v1/sprints/:sprintId/tasks/:taskId`
4. **On success**, the optimistic update is confirmed
5. **On failure**, the optimistic update is reverted and an error is displayed

### Implementation Example

```typescript
async function handleTaskDrop(taskId: string, newStatus: TaskStatus) {
  // 1. Optimistically update the UI
  queryClient.setQueryData(['sprint', sprintId, 'tasks'], (old: TasksData) => {
    const tasks = old.data.tasks.map((task) =>
      task.id === taskId ? { ...task, status: newStatus } : task
    );
    return { ...old, data: { ...old.data, tasks } };
  });

  // 2. Send API request
  try {
    await updateTask(sprintId, taskId, { status: newStatus });
  } catch (error) {
    // 3. Revert on failure
    queryClient.invalidateQueries({ queryKey: ['sprint', sprintId, 'tasks'] });
    showToast('Failed to update task status', 'error');
  }
}
```

### Considerations

- **Debounce rapid drops**: If a user rapidly moves a task between columns, debounce the API call to the final position
- **Conflict handling**: If another user has updated the task, the server returns the current state; merge or prompt the user
- **Animation**: Provide smooth transition animations during drag-and-drop for a polished experience
- **Accessibility**: Ensure keyboard-based task movement is also supported (e.g., using arrow keys to change status)

## Real-Time Update Considerations

Currently, the sprint board relies on polling for updates. Future enhancements will introduce WebSocket support for real-time collaboration.

### Current Approach: Polling

```typescript
// Poll for board updates every 30 seconds
const { data } = useQuery({
  queryKey: ['sprint', sprintId, 'tasks'],
  queryFn: () => fetchSprintTasks(sprintId),
  refetchInterval: 30_000,
  staleTime: 10_000,
});
```

### Future: WebSocket Integration

The planned WebSocket integration will provide:

- **Live task status changes**: Instant updates when any team member moves a task
- **Live task creation/deletion**: Real-time board updates when tasks are added or removed
- **Presence indicators**: Show which team members are currently viewing the board
- **Conflict notifications**: Alert users when concurrent edits occur

**Planned WebSocket Events**

| Event                 | Direction      | Payload                            |
| --------------------- | -------------- | ---------------------------------- |
| `task:status_changed` | Server->Client | `{ taskId, newStatus, changedBy }` |
| `task:created`        | Server->Client | `{ task }`                         |
| `task:updated`        | Server->Client | `{ task }`                         |
| `task:deleted`        | Server->Client | `{ taskId }`                       |
| `pbi:added`           | Server->Client | `{ pbiId, sprintId }`              |
| `pbi:removed`         | Server->Client | `{ pbiId, sprintId }`              |
| `board:subscribe`     | Client->Server | `{ sprintId }`                     |
| `board:unsubscribe`   | Client->Server | `{ sprintId }`                     |

## Error Codes

| Code                   | HTTP Status | Description                                          |
| ---------------------- | ----------- | ---------------------------------------------------- |
| `VALIDATION_ERROR`     | 400         | Request validation failed or invalid task status     |
| `AUTHENTICATION_ERROR` | 401         | Authentication required                              |
| `AUTHORIZATION_ERROR`  | 403         | Insufficient permissions for the requested operation |
| `NOT_FOUND`            | 404         | Sprint, task, or PBI not found                       |
| `CONFLICT`             | 409         | Resource conflict (e.g., PBI already in sprint)      |

## Best Practices

### Board Interactions

1. **Optimistic Updates**: Use optimistic UI updates for drag-and-drop to maintain responsiveness
2. **Error Recovery**: Always implement rollback logic for failed status updates
3. **Debounce Rapid Changes**: Prevent excessive API calls from rapid drag-and-drop actions
4. **Visual Feedback**: Provide clear visual indicators for loading, success, and error states

### Task Management

1. **Task Granularity**: Create tasks that represent 1-2 days of work for better tracking
2. **Assignee Clarity**: Always assign tasks to specific team members to avoid ambiguity
3. **Hour Tracking**: Update remaining hours daily for accurate burndown data
4. **Status Accuracy**: Keep task statuses current to reflect the true state of the sprint

### Collaboration

1. **Concurrent Editing**: Handle conflicts gracefully when multiple users edit the board
2. **Communication**: Use the board as a communication tool during Daily Scrum
3. **Scope Changes**: Document reasons when adding or removing PBIs mid-sprint
4. **DoD Compliance**: Regularly check compliance to ensure quality standards are met

### Performance

1. **Polling Interval**: Use 30-second polling intervals for board data in the current implementation
2. **Selective Refetch**: Only refetch board data after mutations, not on a fixed schedule
3. **Pagination**: For large sprints, consider paginating tasks to reduce payload size
4. **Caching**: Leverage TanStack Query caching to minimize unnecessary network requests

---

**Last Updated**: 2026-05-10

**Related Documentation**

- [Sprints API](./sprints.md)
- [Authentication API](./authentication.md)
- [Teams API](./teams.md)
- [Product Backlog API](./product-backlog.md)
