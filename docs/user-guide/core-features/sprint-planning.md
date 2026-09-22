# Sprint Planning

Sprint Planning is the ceremony where the Scrum Team defines the Sprint Goal and selects Product Backlog items to work on during the upcoming Sprint.

## Table of Contents

- [Overview](#overview)
- [Before Planning](#before-planning)
- [Conducting Sprint Planning](#conducting-sprint-planning)
- [Capacity Planning](#capacity-planning)
- [Selecting Backlog Items](#selecting-backlog-items)
- [Defining the Sprint Goal](#defining-the-sprint-goal)
- [Saving the Sprint Backlog](#saving-the-sprint-backlog)
- [Resuming Planning](#resuming-planning)
- [Starting the Sprint](#starting-the-sprint)
- [Best Practices](#best-practices)

---

## Overview

### Purpose of Sprint Planning

Sprint Planning answers:

1. **What** can be delivered in the upcoming Sprint?
2. **How** will the work be achieved?
3. **Why** is this work valuable (Sprint Goal)?

### Participants

| Role              | Responsibility                                             |
| ----------------- | ---------------------------------------------------------- |
| **Product Owner** | Presents backlog, clarifies requirements, negotiates scope |
| **Developers**    | Size the work, plan how to achieve the Sprint Goal         |
| **Scrum Master**  | Facilitates, ensures Scrum practices are followed          |

### Time Box

- **Duration**: Maximum 8 hours for a 4-week sprint (2 hours per week of sprint)
- **Typical**: 2-4 hours for a 2-week sprint

---

## Before Planning

### Preparation Checklist

**Product Owner:**

- [ ] Backlog is refined and prioritized
- [ ] Top items have acceptance criteria
- [ ] Items are estimated (story points)
- [ ] Dependencies are identified
- [ ] Product Goal is clear

**Developers:**

- [ ] Previous sprint is complete or near complete
- [ ] Team capacity is known
- [ ] Technical context is understood

**Scrum Master:**

- [ ] Meeting is scheduled
- [ ] Room/tools are prepared
- [ ] Previous sprint metrics available (velocity)

### Backlog Readiness

Items ready for sprint have:

- Clear description and acceptance criteria
- Story point estimate
- No blocking dependencies
- "Ready" status in the backlog

### The team's two commitments

Beyond the READY status of the items themselves, Scrumooth refuses to commit a Sprint Backlog — and
refuses to start a Sprint — until two team-level agreements are in place. Both live in
**Settings → Team Definitions**, and the Start dialog explains which one is missing instead of
failing silently.

| Agreement               | What is required                                                                                                                                                          | Who maintains it                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Definition of Done**  | The team has at least one active criterion. A team that has never opened Team Definitions has none, so the first visit creates a sensible default list to review and save | Any member of the Scrum Team — the Guide says the Scrum Team creates the Definition of Done |
| **Definition of Ready** | Every selected item has verified every active readiness criterion                                                                                                         | The team's Scrum Master maintains the list; any team member records the verdicts per item   |

The Definition of Ready is a **complementary practice, not a 2020 Scrum Guide artifact** — the
Guide's three artifacts are the Product Backlog, the Sprint Backlog and the Increment. Scrumooth
says so on the checklist itself, and enforces it as the team's own agreement rather than borrowing
the Guide's authority.

**If you are refused**, the message names the rule and the items involved:

- _no Definition of Done_ → open **Team Definitions → Definition of Done**, review the defaults, save.
  The refusal is the same one you would meet when marking an item Done, moved one event earlier: a
  Sprint opened against no commitment is a Sprint whose Increment can never satisfy one.
- _Definition of Ready not met_ → the refusal names the items that are not ready. Verify the
  outstanding criteria in the backlog (each item's readiness checklist), or remove those items from
  the selection. An item nobody has assessed counts as unmet, exactly like one recorded as not
  verified.

---

## Conducting Sprint Planning

### Step 1: Navigate to Sprint Planning

1. Click "Sprint Planning" in the sidebar
2. The planning interface displays:
   - Sprint selector (current, upcoming, or past sprints)
   - Product backlog items available for selection
   - Sprint backlog area for selected items
   - Active Product Goal (if set)

### Step 2: Select or Create a Sprint

1. Use the sprint dropdown to select an existing sprint
2. Sprints are categorized as:
   - **[Active]**: Currently running sprint
   - **[Upcoming]**: Future sprints
   - **[Done]**: Completed sprints
3. For new sprints, ensure they are pre-configured in sprint settings

### Step 3: Review Previous Sprint

Before planning the new sprint:

1. Review velocity from previous sprints
2. Identify carry-over items (if any)
3. Discuss what went well and what to improve
4. Note any capacity changes (vacations, new members)

### Step 4: Set Sprint Parameters

Configure the sprint:

| Parameter       | Description        | Recommendation              |
| --------------- | ------------------ | --------------------------- |
| **Sprint Name** | Identifiable name  | "Sprint N: [Theme]"         |
| **Start Date**  | When sprint begins | Typically next day          |
| **End Date**    | When sprint ends   | Based on sprint length      |
| **Sprint Goal** | Sprint objective   | Clear, achievable, valuable |

**Editing Sprint Goal:**

- Click the edit icon next to the sprint goal
- Enter or update the goal in the Edit Sprint Goal modal
- Save to update

**Example:**

```
Sprint Name: Sprint 5: Payment Integration
Start Date: January 15, 2026
End Date: January 29, 2026
Sprint Goal: Complete payment processing flow including credit card and PayPal
```

---

## Capacity Planning

### Understanding Capacity

Capacity = Available time × Team members × Focus factor

**Factors affecting capacity:**

- Team size and availability
- Holidays and vacations
- Meetings and overhead
- Technical debt and support

### Using the Capacity Tool

1. Click "Team Capacity" button in the planning interface
2. The Team Capacity modal displays:
   - List of team members
   - Available hours per member (editable)
   - Total team capacity calculation

   | Member    | Available Hours     |
   | --------- | ------------------- |
   | Alice     | 80 hours            |
   | Bob       | 64 hours (vacation) |
   | Carol     | 80 hours            |
   | **Total** | **224 hours**       |

3. Adjust individual member hours as needed (e.g., for vacations)
4. Use the total to guide sprint commitment

> **Capacity is recorded, not just displayed.** Saving the plan persists the capacity per member
> for this Sprint, and resuming the plan reloads the figures the team agreed on (instead of a
> default 40 hours). The capacity card shows whether the figures are already recorded. Capacity
> stays editable while the Sprint is being planned; once the Sprint is active it is read-only.

### Velocity-Based Planning

Velocity is shown as a **descriptive average of recently completed Sprints**, computed from
each Sprint's own committed and completed backlog — it is an observation of what happened, not
a commitment target:

```
Average Velocity: 40 story points (last 4 completed Sprints)
Team Capacity: Normal (no vacations)
Recommended Commitment: 35-40 story points (leave buffer)
```

- Only **completed** Sprints are averaged; the in-flight Sprint has no final velocity yet.
- The average is a starting point for the conversation, never a quota.
- If no Sprint has completed yet, the metric says so instead of showing a fabricated number.

> **Tip**: Don't commit to more than 80-90% of average velocity to allow for unexpected work.

---

## Recording Planning Participation

The 2020 Scrum Guide says the Sprint Backlog is "created by the collaborative work of the entire
Scrum Team", so Scrumooth records **who planned**. The **Planning Participation** panel on the
planning page lists the team roster (and any guests), and lets a Developer mark each person as
present or absent.

- **Developers** record attendance; other roles can see the record but not change it.
- Attendance can only be edited while the Sprint is being planned.
- The panel header states plainly whether the record is complete.

To start a Sprint, the recorded participation must include **the Product Owner and at least one
Developer** marked present. If either is missing, the Start dialog explains exactly who is
missing and the Start action stays disabled.

---

## Selecting Backlog Items

### Selection Process

1. **View Available Items**
   - Product backlog items are displayed in the left panel
   - Items show title, story points, and MoSCoW priority
   - Only "Ready" items should be selected

2. **Add Items to Sprint**
   - Drag items from the product backlog to the sprint backlog area
   - Alternatively, use keyboard navigation for accessibility
   - Watch the capacity indicator as you add items

3. **Review and Adjust**
   - Reorder items within the sprint backlog as needed
   - Remove items by dragging them back or using remove action
   - Ensure selected items support the Sprint Goal

4. **Verify Dependencies**
   - Ensure dependent items are included
   - Check for external dependencies
   - Resolve blockers before committing

### Capacity Indicator

The planning interface shows sprint capacity:

```
┌─────────────────────────────────────────┐
│ Sprint Capacity                         │
│ ████████████████░░░░░░░ 35/40 points   │
│ 35 selected | 5 remaining | 40 total   │
└─────────────────────────────────────────┘
```

- **Green**: Within capacity
- **Yellow**: Near capacity (80-90%)
- **Red**: Over capacity

### Item Details

When viewing backlog items, you can see:

- **Title**: Item description
- **Story Points**: Effort estimate
- **Priority**: MoSCoW classification (Must/Should/Could/Won't)
- **Status**: Ready, In Progress, etc.
- **Ready Checklist**: Confirmation of item readiness

### Item Selection Guidelines

**Include:**

- Items supporting the Sprint Goal
- High-priority items ready for development
- Technical debt items (if agreed)
- Bugs discovered in previous sprint

**Avoid:**

- Items without acceptance criteria
- Items with blocking dependencies
- Items larger than half the sprint (split them)
- Items not aligned with the goal

---

## Defining the Sprint Goal

### What Makes a Good Sprint Goal?

A Sprint Goal should be:

- **Specific**: Clear and well-defined
- **Measurable**: Can determine when achieved
- **Achievable**: Within sprint capacity
- **Relevant**: Aligned with Product Goal
- **Time-bound**: Achievable within the sprint

### Examples

**Good Sprint Goals:**

```
✅ "Complete user registration flow including email verification"
✅ "Enable shopping cart functionality with add, remove, and update"
✅ "Integrate payment gateway and process first test transaction"
```

**Poor Sprint Goals:**

```
❌ "Work on various features" (too vague)
❌ "Finish everything in the backlog" (unrealistic)
❌ "Improve performance" (not measurable)
```

### Sprint Goal Benefits

- **Focus**: Team knows what's important
- **Coherence**: Items work together toward a purpose
- **Flexibility**: Can negotiate scope within the goal
- **Motivation**: Clear objective to achieve

---

## Saving the Sprint Backlog

Your planning work is preserved in two complementary ways, so you never lose progress and can always resume where you left off.

### The "Save Sprint Backlog" Button

As a **Developer**, you can explicitly save the current plan at any time:

1. Select the items you want in the sprint backlog and break them down into tasks.
2. Click **"Save Sprint Backlog"** in the sprint actions toolbar.
3. The selected items and their task decomposition are saved for the sprint, and a confirmation toast confirms the save.

Behavior notes:

- While the save is running, the button shows **"Saving Sprint Backlog..."** and is disabled.
- The button is disabled when no items are selected or when the sprint is already **Active** or **Completed** — in those states the Sprint Backlog is locked and cannot be modified.
- Saving is **idempotent**: each save replaces the previously saved backlog for that sprint with the current selection.
- A saved Sprint Backlog is **required before you can start the sprint** — the "Start Sprint" button stays disabled until the backlog has been saved (see [Starting the Sprint](#starting-the-sprint)).

### Automatic Draft Saving

- **Incremental auto-save**: As you select backlog items, draft task assignments, or update the Sprint Goal, the planning state is saved to the server automatically (debounced). You do **not** need to remember to save before leaving.
- **Unload flush**: If you close the page or navigate away mid-planning, any pending changes are flushed so nothing is lost.
- The explicit **"Save Sprint Backlog"** button captures a reviewable snapshot of the plan; the auto-save keeps that snapshot up to date continuously in the background.

---

## Resuming Planning

Sprint Planning is a collaborative ceremony. To honor the Scrum Guide's principle that the **Sprint Backlog** is a persistent, highly-visible artifact owned by the Developers, Scrumooth lets you resume an interrupted session seamlessly.

### Re-entering the Planning Page

When you (or another Developer) open Sprint Planning for the same sprint again:

1. The saved planning draft is loaded automatically.
2. The **selected items, their tasks (including assignees), and the working Sprint Goal** are restored and pre-filled in the interface.
3. A notice confirms the draft was resumed, so you can continue exactly where you left off — even after closing the page, switching sprints, or signing out.
4. If no saved draft exists for the sprint yet, the planning page starts from a clean slate.

### Shared and Collaborative

Because the draft is stored server-side, it is **shared across the team**. Any Developer who opens the sprint sees the same plan. This reflects the Developers' collective selection and decomposition of the work, as Scrum expects.

### Commit Remains Explicit

Auto-save and the **"Save Sprint Backlog"** button persist the **draft** only. Starting the Sprint remains the single, explicit commit action that transitions the sprint to **Active** and turns the draft into the committed Sprint Backlog used on the Sprint Board.

> **Note**: Saving the Sprint Backlog is available to Developers. Other team members can view the plan, but only Developers can modify the sprint backlog draft.

---

## Starting the Sprint

### Pre-Start Checklist

Before starting the sprint, verify:

- [ ] Sprint Goal is defined and agreed
- [ ] **The Sprint Backlog has been saved** (required — "Start Sprint" stays disabled until you save)
- [ ] **Planning participation is recorded** — the Product Owner and at least one Developer are marked present
- [ ] **The team has an active Definition of Done** (Team Definitions; a team that has never opened the page has none)
- [ ] **Every selected item meets the team's Definition of Ready** — otherwise the Start dialog names the items that are not ready
- [ ] Capacity has been recorded and the selected items fit within it (a plan may exceed the recorded capacity by up to the configured tolerance, default 10%)
- [ ] All items have acceptance criteria
- [ ] Team commits to the sprint backlog
- [ ] Dependencies are resolved or planned for
- [ ] Sprint dates are correct

### Starting the Sprint

1. **Review the Sprint Backlog**
   - All team members agree
   - Product Owner approves scope
   - Sprint Goal is clear

2. **Click "Start Sprint"**
   - "Start Sprint" is only enabled after the Sprint Backlog has been saved. If you change the plan after saving, click **"Save Sprint Backlog"** again before starting.
   - The Start Sprint modal opens
   - Review sprint details (name, dates, goal)
   - Review selected backlog items and tasks
   - Confirm to start the sprint

3. **After Confirmation**
   - Sprint status changes to "Active"
   - Items and tasks move to the Sprint Board
   - Automatic redirect to Sprint Board

> **If the Start action is unavailable**, the dialog names the reason: a missing Sprint Goal or
> unsaved Sprint Backlog, incomplete planning participation (the Product Owner or a Developer is
> not recorded as present), or a plan that exceeds the recorded capacity beyond the configured
> tolerance. The same rules are enforced by the server, so the API cannot open a Sprint that the
> interface would refuse.

### After Starting

**Immediately:**

- Create initial tasks for backlog items (if not auto-generated)
- Set up any needed technical context
- Clarify questions about acceptance criteria

**Daily:**

- Update task status on the board
- Participate in Daily Scrum
- Raise impediments immediately

---

## Best Practices

### Effective Planning Sessions

1. **Time-Box Strictly**
   - Keep to the time limit
   - Use a visible timer
   - Defer detailed discussions

2. **Collaborate Actively**
   - Everyone participates
   - Ask clarifying questions
   - Raise concerns early

3. **Focus on Value**
   - Prioritize by value, not just "keep busy"
   - Ensure Sprint Goal is meaningful
   - Consider stakeholder needs

4. **Be Realistic**
   - Don't overcommit
   - Account for uncertainty
   - Leave buffer for the unexpected

### Common Mistakes to Avoid

| Mistake                 | Impact                            | Solution                     |
| ----------------------- | --------------------------------- | ---------------------------- |
| Overcommitting          | Incomplete sprint, demoralization | Use 80% of velocity          |
| No Sprint Goal          | Lack of focus, scope creep        | Always define a goal         |
| Selecting unready items | Delays, confusion                 | Only select refined items    |
| Ignoring capacity       | Unrealistic expectations          | Account for availability     |
| Gold-plating            | Wasted effort                     | Focus on acceptance criteria |

### Sprint Planning Anti-Patterns

**Avoid:**

1. **"Fill the Sprint"**
   - Don't add items just to fill capacity
   - Every item should support the goal

2. **"Product Owner Decides Alone"**
   - Team must commit, not be assigned
   - Collaborative decision-making

3. **"No Discussion"**
   - Planning is for clarification
   - Surface risks and dependencies

4. **"Copy Last Sprint"**
   - Each sprint is unique
   - Consider current context

---

## Example Planning Session

### Scenario: E-commerce Team

**Team Context:**

- 4 developers, 1 QA
- 2-week sprint
- Average velocity: 35 points
- One member on vacation (reduced capacity)

**Planning Steps:**

1. **Review Capacity**

   ```
   Normal capacity: 35 points
   Vacation adjustment: -8 points
   Buffer (10%): -3 points
   Target commitment: ~24 points
   ```

2. **Define Sprint Goal**

   ```
   "Enable customers to save items for later purchase"
   ```

3. **Select Items**

   | Item                 | Points | Priority |
   | -------------------- | ------ | -------- |
   | Save to wishlist     | 5      | Must     |
   | View wishlist        | 3      | Must     |
   | Remove from wishlist | 2      | Must     |
   | Wishlist count badge | 3      | Should   |
   | Move to cart         | 5      | Should   |
   | Share wishlist       | 5      | Could    |
   | **Total**            | **23** |          |

4. **Verify and Commit**
   - Team agrees to 23 points
   - Sprint Goal is achievable
   - Start sprint

---

**Related Topics**:

- [Product Backlog](./product-backlog.md) - Source of sprint items
- [Sprint Board](./sprint-board.md) - Track sprint progress
- [Daily Scrum](./daily-scrum.md) - Daily synchronization
- [Sprint Review](./sprint-review.md) - Review sprint outcome
