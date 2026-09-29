# Sprint Board

The Sprint Board is the visual tool the Developers use to track work during a Sprint. It shows every
Sprint Backlog item and task as a card moving through the team's workflow, so progress toward the
Sprint Goal is visible at a glance. It is reached from **Active Sprint** in the sidebar.

> **Enforced by Scrumooth:** The Sprint Backlog is the Developers' plan. Only Developers may save the
> Sprint Backlog or move board tasks, and a Product Backlog item must be refined to `Ready` before it
> can enter a Sprint. Once the Sprint is running the **Sprint Goal is locked**: a Sprint Backlog
> change that would endanger it is not applied silently — it stays pending until the Product Owner
> acknowledges it. An item can be marked Done only once every active Definition of Done criterion has
> been verified for it.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Sprint Board provides:

- **Visual status** — see all work at a glance.
- **Workflow tracking** — move items and tasks through stages.
- **WIP limits** — prevent overloading any stage.
- **Progress visibility** — track Sprint progress in real time.

---

## Key Concepts

### Columns and workflow

The board displays columns representing workflow stages:

```
┌──────────┬──────────────┬───────────┬──────────┐
│  TO DO   │ IN PROGRESS  │  REVIEW   │   DONE   │
├──────────┼──────────────┼───────────┼──────────┤
│  [Item]  │  [Item]      │  [Item]   │  [Item]  │
│  [Task]  │  [Task]      │  [Task]   │  [Task]  │
└──────────┴──────────────┴───────────┴──────────┘
```

| Column          | Meaning                | Who moves work here          |
| --------------- | ---------------------- | ---------------------------- |
| **To Do**       | Ready to start         | Default for new tasks        |
| **In Progress** | Being worked on        | Developer starts work        |
| **Review**      | Awaiting review        | Developer submits for review |
| **Done**        | Completed and verified | Developer confirms complete  |

Tasks move along the four columns To Do → In Progress → Review → Done. A Product Backlog item's own
status follows the longer lifecycle New → Refined → Ready → In Progress → Done.

### Tasks and items

**Product Backlog items** are user-facing features, estimated in story points and carrying acceptance
criteria. **Tasks** are the technical work needed to complete an item, estimated in hours and assigned
to specific Developers. Breaking an item into tasks is how the Developers plan the "how".

| Task                              | Estimate | Assignee |
| --------------------------------- | -------- | -------- |
| Create reset token service        | 2h       | Alice    |
| Build reset email template        | 1h       | Bob      |
| Create reset password page        | 3h       | Alice    |
| Add validation and error handling | 2h       | Carol    |
| Write unit tests                  | 2h       | Bob      |
| Write integration tests           | 2h       | Carol    |

### The Sprint Goal is locked

Once the Sprint is running, the Sprint Goal does not change silently. A Sprint Backlog change that
would endanger the Goal is held as pending until the Product Owner acknowledges it, so the Developers'
plan and the Goal stay in step.

### Definition of Done

The Definition of Done is the checklist that must be complete before an item counts as Done. The active
criteria load inline when an item is promoted to Done, and a team with no active criterion is refused:
an empty checklist must not become a way through the gate.

### Burndown

The burndown chart shows the remaining work over time, with an ideal line and an actual line:

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

- **Below the ideal line** — ahead of schedule.
- **Above the ideal line** — behind schedule.
- **Flat line** — no progress; investigate.

---

## Practical Guidance

### Open the board

1. Click **Active Sprint** in the sidebar; the Sprint Board for the current Sprint displays.
2. Optionally group work into **swimlanes** by assignee, by MoSCoW priority, or by parent item.

### View and act on a card

Click any card to open its detail modal: title and description, acceptance criteria, story points,
assignee, labels, and comments or activity. Quick actions:

| Action            | How                                          |
| ----------------- | -------------------------------------------- |
| **Edit**          | Click the edit icon or open the detail modal |
| **Assign**        | Click the assignee field                     |
| **Add comment**   | Use the comment field in the detail modal    |
| **Change status** | Drag the card or use the status dropdown     |
| **Delete**        | From the detail modal, with confirmation     |

### Create and complete tasks

1. Open a Product Backlog item's detail and click **Add Task**.
2. Fill in the title, description, estimate (hours) and assignee, then save.
3. Move the task to **In Progress** when work starts.
4. Move it to **Review** when it is ready for a reviewer.
5. The reviewer checks the work against the Definition of Done checklist, and the task moves to
   **Done** when the review is complete and accepted.

### Mark a Product Backlog item as Done

An item is Done only when **all of its child tasks are Done**:

1. Open the item's preview from the board.
2. Review the tasks — the preview shows a "ready to done" banner once all child tasks are complete.
3. Click **Mark as Done**. The system re-checks every child task and lists any that are incomplete.
4. Complete the Definition of Done checklist, which loads inline. Verify each active criterion.
5. Confirm. The verification is recorded and the item's status becomes Done.

Marking an item Done is restricted to **Developers**.

### Move cards

**With a mouse or touch:** press and hold a card, drag it to the target column, and release. The status
updates automatically. A valid drop zone highlights green; an invalid drop shows red or no highlight;
a WIP-limit warning highlights yellow.

**Bulk move:** hold **Shift** and click to select multiple cards, drag them together, and drop them in
the target column.

### Filter the board

Filter by assignee (including "Unassigned"), priority, item type (Product Backlog item, task, bug) and
labels. Quick filters include **My Work**, **Blocked** and **High Priority**. Toggle between board,
list and timeline views where configured.

### Read the burndown

Use the chart daily to check whether the team is on track, in Sprint Planning to inform the next
Sprint, and to spot sudden flat lines that indicate a blocker.

### Keyboard shortcuts

**Navigation:** **Tab** / **Shift + Tab** move focus; **Enter** opens the selected task or activates a
button; **Escape** closes a modal or cancels an action.

**Task actions:** **→** / **←** move a task between columns; **Space** starts dragging; **e** edits the
selected task; **d** deletes it.

**Board actions:** **n** creates a task; **b** toggles the burndown chart; **s** focuses the search
box; **?** shows the keyboard help dialog.

---

## Gates and Enforcement

| Refusal                                                    | What it means                                                 | What to do                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| _Only Developers may move board tasks_                     | Someone without the Developers role tried to change the board | Ask a Developer to make the change                           |
| _An item must be Ready to enter a Sprint_                  | An unready item was selected for the Sprint                   | Refine it in the Product Backlog before it is committed      |
| _Sprint Backlog changes to the Goal need acknowledgement_  | A change that would endanger the Sprint Goal was proposed     | The Product Owner acknowledges or rejects the pending change |
| _Nothing is Done until the Definition of Done is verified_ | The item's Done criteria are incomplete                       | Verify every active criterion, or complete the missing work  |

---

## Best Practices

### Daily habits

1. **At the start of the day** — move yesterday's completed work and start new tasks.
2. **Throughout the day** — move tasks as you progress and add comments for context.
3. **At the end of the day** — make sure the board reflects reality and update estimates if needed.

### Keep the board healthy

**Do:** move cards promptly when status changes, add comments for important context, keep tasks small
and completable, and verify the Definition of Done before marking Done.

**Don't:** let cards sit in "In Progress" too long, skip the Definition of Done checklist, move items
backward without reason, or overload a single column.

### Respect WIP limits

Work-in-progress limits prevent multitasking, focus on completion and expose bottlenecks. Typical
limits are three items in progress per person and two in review or testing in total. When a limit is
reached, finish something before starting new work, help others complete theirs, and raise an
Impediment if the team is blocked.

### Troubleshooting

- **Card won't move** — check the workflow rules, your permissions, and any blocking dependency.
- **Cards are missing** — check the active filters, the Sprint assignment, and archived items.
- **Slow performance** — reduce visible cards with filters and collapse completed items.

---

## Related Topics

- [Sprint Planning](./sprint-planning.md) — where the Sprint Backlog is committed
- [Daily Scrum](./daily-scrum.md) — where the board's progress is inspected and adapted
- [Increment](./increment.md) — what the Done items compose into
- [Impediment](./impediment.md) — where a stalled card's blocker is recorded
