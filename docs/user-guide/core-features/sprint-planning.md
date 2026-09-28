# Sprint Planning

Sprint Planning is the event where the Scrum Team defines the **Sprint Goal** and selects the Product
Backlog items to work on during the coming Sprint. It answers three questions: **why** this Sprint is
valuable, **what** can be delivered, and **how** the work will be achieved.

> **Enforced by Scrumooth:** A Sprint cannot be committed or started on promises alone. Starting a
> Sprint requires a saved Sprint Backlog, a recorded Definition of Done with at least one active
> criterion, a Definition of Ready met by every selected item, recorded planning participation that
> includes the Product Owner and at least one Developer, and a plan within the recorded capacity.
> Only **Developers** may save the Sprint Backlog.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

Sprint Planning is used to:

1. **Define the Sprint Goal** — the single objective the Sprint serves.
2. **Select the Product Backlog items** that move the team toward it.
3. **Plan how** the selected work will be achieved, including its decomposition into tasks.
4. **Commit** as a team, within the recorded capacity, to a Sprint Backlog.

### Participants and time box

| Role              | Responsibility                                                 |
| ----------------- | -------------------------------------------------------------- |
| **Product Owner** | Presents the backlog, clarifies requirements, negotiates scope |
| **Developers**    | Size the work, plan how to achieve the Sprint Goal             |
| **Scrum Master**  | Facilitates, ensures Scrum practices are followed              |

- **Duration**: maximum 8 hours for a 4-week Sprint (2 hours per week of Sprint).
- **Typical**: 2–4 hours for a 2-week Sprint.

---

## Key Concepts

### The two team commitments

Beyond the readiness of the items themselves, Scrumooth will not commit a Sprint Backlog — or start a
Sprint — until two team-level agreements are in place. Both are read on **Team → Definition**, and
the Start dialog names which one is missing:

| Agreement               | What is required                                                                                                                                    | Who maintains it                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Definition of Done**  | The team has at least one active criterion. The first read of a team's Definition of Done is seeded with a sensible default list to review and save | Any member of the Scrum Team — the Guide says the Scrum Team creates the Definition of Done |
| **Definition of Ready** | Every selected item has verified every active readiness criterion                                                                                   | The team's Scrum Master maintains the list; any team member records the verdicts per item   |

The Definition of Ready is a **complementary practice, not a 2020 Scrum Guide artifact** — the
Guide's three artifacts are the Product Backlog, the Sprint Backlog and the Increment. Scrumooth says
so on the checklist itself and enforces it as the team's own agreement rather than borrowing the
Guide's authority.

### Capacity and velocity

Capacity is the work the team can realistically take on:

```
Capacity = Available time × Team members × Focus factor
```

Factors that affect it include team size and availability, holidays and vacations, meetings and
overhead, and support work. Capacity is **recorded, not just displayed**: saving the plan persists
the per-member figures for this Sprint, and resuming the plan reloads the figures the team agreed on.
Capacity stays editable while the Sprint is being planned and becomes read-only once it is active.

Velocity is shown as a **descriptive average of recently completed Sprints**, computed from each
Sprint's own committed and completed backlog. It is an observation of what happened, not a commitment
target:

- Only **completed** Sprints are averaged; the in-flight Sprint has no final velocity yet.
- If no Sprint has completed, the metric says so instead of showing a fabricated number.
- The average is a starting point for the conversation, never a quota.

### Planning participation

The Guide says the Sprint Backlog is "created by the collaborative work of the entire Scrum Team", so
Scrumooth records **who planned**. The **Planning Participation** panel lists the team roster and any
guests, and lets a Developer mark each person present or absent. Attendance can only be edited while
the Sprint is being planned. To start a Sprint, the recorded participation must include the
**Product Owner and at least one Developer**.

### The Sprint Goal

A good Sprint Goal is:

- **Specific** — clear and well-defined.
- **Measurable** — the team can tell when it is achieved.
- **Achievable** — within the Sprint's capacity.
- **Relevant** — aligned with the Product Goal.
- **Time-bound** — achievable within the Sprint.

```
Good: "Complete user registration flow including email verification"
Good: "Enable shopping cart functionality with add, remove and update"
Poor: "Work on various features" (too vague)
Poor: "Finish everything in the backlog" (unrealistic)
```

---

## Practical Guidance

### Before planning

**Product Owner:**

- Backlog is refined and ordered; top items have acceptance criteria and estimates; dependencies are
  identified; the Product Goal is clear.

**Developers:**

- The previous Sprint is complete or near complete; team capacity is known; technical context is
  understood.

**Scrum Master:**

- The event is scheduled and prepared; previous Sprint metrics are available.

Items ready for a Sprint have a clear description and acceptance criteria, a story-point estimate,
no blocking dependencies, and `Ready` status in the Product Backlog.

### Open planning and set the parameters

1. Click **Sprint Planning** in the sidebar. The interface shows the Sprint selector, the available
   Product Backlog items, the Sprint Backlog area and the active Product Goal.
2. Select an existing Sprint — marked `Active`, `Upcoming` or `Done` — or create one in the sprint
   settings.
3. Review the previous Sprint: its velocity, any carry-over items, what went well and what to improve,
   and any capacity changes.
4. Set the Sprint parameters:

   | Parameter       | Description            | Recommendation              |
   | --------------- | ---------------------- | --------------------------- |
   | **Sprint Name** | Identifiable name      | "Sprint N: [Theme]"         |
   | **Start Date**  | When it begins         | Typically the next day      |
   | **End Date**    | When it ends           | Based on the Sprint length  |
   | **Sprint Goal** | The Sprint's objective | Clear, achievable, valuable |

   Click the edit icon next to the Sprint Goal to set it in the Edit Sprint Goal modal.

### Record capacity

1. Click **Team Capacity** in the planning interface.
2. The modal lists each member and their available hours (editable), and calculates the total.
3. Adjust individual hours for vacations or part-time availability, then save.

   | Member    | Available hours     |
   | --------- | ------------------- |
   | Alice     | 80 hours            |
   | Bob       | 64 hours (vacation) |
   | Carol     | 80 hours            |
   | **Total** | **224 hours**       |

4. Use the total to guide the commitment, and read the velocity average as a descriptive comparison.

### Select items and record participation

1. Add Product Backlog items to the Sprint Backlog by dragging them, or with keyboard navigation.
2. Watch the capacity indicator as you add items:

   ```
   ┌─────────────────────────────────────────┐
   │ Sprint Capacity                         │
   │ ████████████████░░░░░░░ 35/40 points    │
   │ 35 selected | 5 remaining | 40 total    │
   └─────────────────────────────────────────┘
   ```

3. Review and adjust: reorder the Sprint Backlog, remove items, and confirm every item supports the
   Sprint Goal.
4. Verify dependencies before committing.
5. In the **Planning Participation** panel, mark each person present or absent. **Developers** record
   attendance; other roles can see the record but not change it.

**Include:** items supporting the Sprint Goal, high-priority Ready items, agreed technical debt items,
and bugs found in the previous Sprint.

**Avoid:** items without acceptance criteria, items with blocking dependencies, items larger than half
the Sprint, and items not aligned with the goal.

### Define the Sprint Goal

Write the goal with the team, in one or two sentences that say what the Sprint will achieve. The Goal
gives focus, coherence, room to negotiate scope and a clear objective to reach. A Sprint with no Goal
cannot be started.

### Save the Sprint Backlog

As a **Developer**, save the plan explicitly:

1. Select the items and break them into tasks.
2. Click **Save Sprint Backlog** in the Sprint actions toolbar.
3. A confirmation toast confirms the save.

Behavior notes:

- While the save runs, the button shows **Saving Sprint Backlog...** and is disabled.
- The button is disabled when no items are selected or when the Sprint is already `Active` or
  `Completed`, because the Sprint Backlog is then locked.
- Saving is **idempotent**: each save replaces the previously saved backlog with the current
  selection.
- A saved Sprint Backlog is **required before the Sprint can start**.

### Resume an interrupted plan

Planning state is auto-saved to the server as the team works (debounced), and pending changes are
flushed if the page is closed. Re-opening Sprint Planning for the same Sprint reloads the saved draft
— the selected items, their tasks and assignees, and the working Sprint Goal — and a notice confirms
the draft was resumed. The draft is shared across the team, because it is stored server-side. Auto-
save and **Save Sprint Backlog** persist the **draft** only; starting the Sprint is the single,
explicit commit that turns the draft into the committed Sprint Backlog.

### Start the Sprint

Before starting, verify:

- [ ] Sprint Goal is defined and agreed.
- [ ] The Sprint Backlog has been saved.
- [ ] Planning participation is recorded — the Product Owner and at least one Developer are present.
- [ ] The team has an active Definition of Done.
- [ ] Every selected item meets the team's Definition of Ready.
- [ ] Capacity has been recorded and the selected items fit within it.
- [ ] Dependencies are resolved or planned for.

Then click **Start Sprint**, review the details in the modal, and confirm. The Sprint becomes
`Active`, items and tasks move to the Sprint Board, and the app redirects there.

---

## Gates and Enforcement

If the Start action is unavailable, the dialog names the reason:

| Refusal                                  | What it means                                                                | What to do                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| _A Sprint needs a Sprint Goal_           | No Goal has been recorded                                                    | Define the Sprint Goal                                                    |
| _The Sprint Backlog must be saved_       | The plan exists only as a draft                                              | Click **Save Sprint Backlog** after any change                            |
| _Planning participation is incomplete_   | The Product Owner or a Developer is not recorded as present                  | Record attendance in the Planning Participation panel                     |
| _The team needs a Definition of Done_    | The team has no active Done criterion                                        | Open **Team → Definition**, review the criteria and save                  |
| _The Definition of Ready is not met_     | One or more selected items have unmet readiness criteria                     | Verify the outstanding criteria, or remove those items from the selection |
| _The plan exceeds the recorded capacity_ | The selection is over capacity beyond the configured tolerance (default 10%) | Reduce the selection or correct the recorded capacity                     |

The same rules are enforced by the server, so the API cannot open a Sprint that the interface would
refuse.

---

## Best Practices

1. **Time-box strictly** — keep to the limit, use a visible timer and defer detailed discussions.
2. **Collaborate actively** — everyone participates, questions are asked early, concerns are raised.
3. **Focus on value** — prioritise by value, and make the Sprint Goal meaningful.
4. **Be realistic** — do not overcommit; leave buffer for the unexpected.

### Common mistakes

| Mistake                 | Impact                            | Solution                       |
| ----------------------- | --------------------------------- | ------------------------------ |
| Overcommitting          | Incomplete Sprint, demoralisation | Use 80–90% of average velocity |
| No Sprint Goal          | Lack of focus, scope creep        | Always define a goal           |
| Selecting unready items | Delays, confusion                 | Only select refined items      |
| Ignoring capacity       | Unrealistic expectations          | Account for availability       |
| Gold-plating            | Wasted effort                     | Focus on acceptance criteria   |

### Anti-patterns to avoid

- **"Fill the Sprint"** — do not add items just to fill capacity; every item should support the goal.
- **"Product Owner decides alone"** — the team commits, it is not assigned work.
- **"No discussion"** — planning is for clarification; surface risks and dependencies.
- **"Copy last Sprint"** — each Sprint is unique; consider the current context.

### Example session

A team of four developers and one QA on a 2-week Sprint, with an average velocity of 35 points and one
member on vacation:

```
Normal capacity:        35 points
Vacation adjustment:    -8 points
Buffer (10%):           -3 points
Target commitment:      ~24 points

Sprint Goal: "Enable customers to save items for later purchase"
```

| Item                 | Points | Priority |
| -------------------- | ------ | -------- |
| Save to wishlist     | 5      | Must     |
| View wishlist        | 3      | Must     |
| Remove from wishlist | 2      | Must     |
| Wishlist count badge | 3      | Should   |
| Move to cart         | 5      | Should   |
| Share wishlist       | 5      | Could    |
| **Total**            | **23** |          |

---

## Related Topics

- [Product Backlog](./product-backlog.md) — the source of Sprint items
- [Sprint Board](./sprint-board.md) — where the committed work is tracked
- [Daily Scrum](./daily-scrum.md) — daily inspection and adaptation
- [Sprint Review](./sprint-review.md) — where the Sprint's outcome is inspected
