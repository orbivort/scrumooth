# Sprint Board

The Sprint Board is a visual tool for tracking work during a sprint. It uses a Kanban-style interface to show the status of all sprint items and tasks.

## Table of Contents

- [Overview](#overview)
- [Board Layout](#board-layout)
- [Working with the Board](#working-with-the-board)
- [Task Management](#task-management)
- [Drag and Drop](#drag-and-drop)
- [Filters and Views](#filters-and-views)
- [Burndown Chart](#burndown-chart)
- [Definition of Done](#definition-of-done)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Best Practices](#best-practices)

---

## Overview

### What is the Sprint Board?

The Sprint Board provides:

- **Visual Status**: See all work at a glance
- **Workflow Tracking**: Move items through stages
- **WIP Limits**: Prevent overloading stages
- **Progress Visibility**: Track sprint progress in real-time

### Accessing the Board

1. Navigate to "Active Sprint" in the sidebar
2. The Sprint Board displays automatically
3. Shows all items and tasks for the current sprint

---

## Board Layout

### Standard Columns

The board displays columns representing workflow stages:

```
┌──────────┬──────────────┬───────────┬──────────┐
│  TO DO   │ IN PROGRESS  │  REVIEW   │   DONE   │
├──────────┼──────────────┼───────────┼──────────┤
│          │              │           │          │
│  [Item]  │  [Item]      │  [Item]   │  [Item]  │
│          │              │           │          │
│  [Task]  │  [Task]      │  [Task]   │  [Task]  │
│          │              │           │          │
└──────────┴──────────────┴───────────┴──────────┘
```

### Column Definitions

| Column          | Meaning                | Who Moves Items Here         |
| --------------- | ---------------------- | ---------------------------- |
| **To Do**       | Ready to start         | Default for new tasks        |
| **In Progress** | Being worked on        | Developer starts work        |
| **Review**      | Awaiting review        | Developer submits for review |
| **Done**        | Completed and verified | Developer confirms complete  |

> **Note**: The Sprint Board uses a four-column workflow for tasks: To Do → In Progress → Review → Done. For backlog items, the full ItemStatus workflow is: New → Refined → Ready → In Progress → Done.

### Swimlanes (Optional)

The board can show swimlanes to organize work:

- **By Assignee**: See each person's work
- **By Priority**: Group by MoSCoW priority
- **By Item**: Tasks grouped under parent item

---

## Working with the Board

### Viewing Item Details

1. **Click on any card** to open the detail modal
2. View full item information:
   - Title and description
   - Acceptance criteria
   - Story points
   - Assignee
   - Labels
   - Comments/activity log

### Quick Actions

From the card or detail view:

| Action            | How                                   |
| ----------------- | ------------------------------------- |
| **Edit**          | Click edit icon or detail modal       |
| **Assign**        | Click assignee field                  |
| **Add Comment**   | Use comment field in detail modal     |
| **Change Status** | Drag card or use status dropdown      |
| **Delete**        | From detail modal (with confirmation) |

---

## Task Management

### Tasks vs. Backlog Items

**Backlog Items:**

- User-facing features
- Estimated in story points
- Have acceptance criteria

**Tasks:**

- Technical work to complete an item
- Estimated in hours
- Assigned to specific developers

### Creating Tasks

1. Open a backlog item detail
2. Click "Add Task"
3. Fill in task details:
   - **Title**: What needs to be done
   - **Description**: Technical details
   - **Estimate**: Hours (optional)
   - **Assignee**: Who will do it

4. Save the task

### Task Example

For backlog item "User can reset password":

| Task                              | Estimate | Assignee |
| --------------------------------- | -------- | -------- |
| Create reset token service        | 2h       | Alice    |
| Build reset email template        | 1h       | Bob      |
| Create reset password page        | 3h       | Alice    |
| Add validation and error handling | 2h       | Carol    |
| Write unit tests                  | 2h       | Bob      |
| Write integration tests           | 2h       | Carol    |

### Completing Tasks

1. Move task to "In Progress" when starting
2. Do the work
3. Move task to "Review" when ready for a reviewer
4. Reviewer checks the work against the Definition of Done checklist (if configured)
5. Move to "Done" when the review is complete and accepted

### Marking a PBI as Done

A backlog item (PBI) is considered done only when **all of its child tasks are Done**. Once every task under the PBI is in the Done column, the board flags the PBI as "ready to done" and you can promote it to **Done** from the board:

1. **Open the PBI preview** by clicking the PBI card on the board.
2. **Review the tasks** — the preview shows a "ready to done" banner once all child tasks are complete.
3. **Click "Mark as Done"** — the system re-checks that every child task is Done. If any are incomplete, it lists them and blocks the transition.
4. **Complete the Definition of Done checklist** — the active DoD criteria load inline in the preview. Verify each one.
5. **Confirm** — this records the DoD verification and updates the PBI status to **Done**. The board refreshes automatically.

> **Note**: Marking a PBI Done is restricted to **Developers**, and the DoD checklist must be fully verified before the transition is allowed.

---

## Drag and Drop

### Moving Cards

**Using Mouse:**

1. Click and hold on a card
2. Drag to the target column
3. Release to drop
4. Status updates automatically

**Using Touch (Mobile):**

1. Tap and hold on a card
2. Drag to target column
3. Release to drop

### Drag Feedback

- **Valid drop zone**: Column highlights green
- **Invalid drop**: Column shows red or no highlight
- **WIP limit warning**: Yellow highlight if approaching limit

### Bulk Move

Select multiple cards:

1. Hold Shift and click cards to select
2. Drag all selected cards together
3. Drop in target column

---

## Filters and Views

### Filtering the Board

Filter by:

| Filter        | Options                              |
| ------------- | ------------------------------------ |
| **Assignee**  | Specific team member or "Unassigned" |
| **Priority**  | Must, Should, Could, Won't           |
| **Item Type** | Backlog Item, Task, Bug              |
| **Labels**    | Any assigned label                   |

### View Options

Toggle between:

- **Board View**: Kanban columns (default)
- **List View**: Table format
- **Timeline View**: Calendar-style (if configured)

### Quick Filters

Use quick filter buttons:

- **My Work**: Show only your assigned items
- **Blocked**: Show only blocked items
- **High Priority**: Must Have items only

---

## Burndown Chart

### What is the Burndown Chart?

The burndown chart shows:

- **Remaining work** over time
- **Ideal progress** line
- **Actual progress** line

### Reading the Chart

```
Work
│
│ ╲ Ideal
│  ╲
│   ╲╱╲╱╲ Actual
│    ╲ ╱
│     ╲
│      ╲
└──────────────── Time
  Start        End
```

- **Below ideal line**: Ahead of schedule
- **Above ideal line**: Behind schedule
- **Flat line**: No progress (investigate!)

### Using Burndown Data

- **Daily check**: Are we on track?
- **Sprint planning**: Inform next sprint
- **Impediment identification**: Sudden flat spots indicate blockers

---

## Definition of Done

### What is Definition of Done (DoD)?

DoD is a checklist that must be complete before an item is considered "Done".

### Accessing DoD

1. Open item detail
2. Click "Definition of Done" tab
3. See checklist items

### Completing DoD

1. Work through each checklist item
2. Check off completed items
3. All items must be checked to mark item as Done

### Example DoD Checklist

```
□ Code complete
□ Unit tests written
□ Code reviewed
□ Documentation updated
□ QA tested
□ Acceptance criteria met
□ No critical bugs
```

### DoD Verification Modal

When moving to Done:

1. DoD modal appears if items unchecked
2. Confirm all items are complete
3. Or return to complete remaining items

---

## Keyboard Shortcuts

Speed up your workflow with keyboard shortcuts:

### Navigation

| Shortcut        | Action                                |
| --------------- | ------------------------------------- |
| **Tab**         | Move focus to next element            |
| **Shift + Tab** | Move focus to previous element        |
| **Enter**       | Open selected task or activate button |
| **Escape**      | Close modal or cancel action          |

### Task Actions

| Shortcut            | Action                                   |
| ------------------- | ---------------------------------------- |
| **→** (Right Arrow) | Move task to next column                 |
| **←** (Left Arrow)  | Move task to previous column             |
| **Space**           | Start dragging task (use arrows to move) |
| **e**               | Edit selected task                       |
| **d**               | Delete selected task                     |

### Board Actions

| Shortcut | Action                    |
| -------- | ------------------------- |
| **n**    | Create new task           |
| **b**    | Toggle burndown chart     |
| **s**    | Focus search box          |
| **?**    | Show keyboard help dialog |

> Press **?** on the board to see all shortcuts.

---

## Best Practices

### Daily Board Habits

1. **Update at start of day**
   - Move yesterday's completed work
   - Start new tasks

2. **Update throughout the day**
   - Move tasks as you progress
   - Add comments for context

3. **End of day check**
   - Ensure board reflects reality
   - Update estimates if needed

### Keeping the Board Healthy

**Do:**

- Move cards promptly when status changes
- Add comments for important context
- Keep tasks small and completable
- Verify DoD before marking Done

**Don't:**

- Let cards sit in "In Progress" too long
- Skip the DoD checklist
- Move items backward without reason
- Overload any single column

### WIP (Work In Progress) Limits

Respect WIP limits to:

- Prevent multitasking
- Focus on completion
- Identify bottlenecks

**Example WIP Limits:**

- In Progress: 3 per person
- In Review: 2 total
- Testing: 2 total

When limit is reached:

- Finish something before starting new
- Help others complete their work
- Raise impediment if blocked

---

## Troubleshooting

### Common Issues

**Card won't move:**

- Check workflow rules (some transitions may be restricted)
- Verify you have permission
- Check for blocking dependencies

**Missing cards:**

- Check filters (may be hidden)
- Verify sprint assignment
- Check archived/completed items

**Slow performance:**

- Reduce visible cards with filters
- Collapse completed items
- Check network connection

---

**Related Topics**:

- [Sprint Planning](./sprint-planning.md) - Select items for sprint
- [Daily Scrum](./daily-scrum.md) - Daily synchronization
