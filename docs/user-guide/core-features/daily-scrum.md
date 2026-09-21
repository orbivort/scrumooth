# Daily Scrum

The Daily Scrum is a 15-minute time-boxed event **for the Developers**. Its purpose is to inspect progress toward the Sprint Goal and adapt the Sprint Backlog, producing an actionable plan for the next day of work. It is **not** a per-user status report to management.

## Table of Contents

- [Overview](#overview)
- [Conducting the Daily Scrum](#conducting-the-daily-scrum)
- [Recording the Daily Scrum](#recording-the-daily-scrum)
- [Viewing the Team Record](#viewing-the-team-record)
- [Identifying Impediments](#identifying-impediments)
- [Best Practices](#best-practices)
- [Common Anti-Patterns](#common-anti-patterns)

---

## Overview

### Purpose of Daily Scrum

The Daily Scrum is used to:

1. **Inspect** progress toward the Sprint Goal
2. **Adapt** the Sprint Backlog based on that progress
3. **Produce** an actionable plan for the next day
4. **Identify** impediments

### What It Is NOT

The Daily Scrum is **not**:

- A status report meeting
- A problem-solving session
- A management reporting tool
- A lengthy discussion
- A per-user "yesterday / today / blockers" submission

### Key Characteristics

| Aspect           | Guideline                                                                     |
| ---------------- | ----------------------------------------------------------------------------- |
| **Duration**     | Maximum 15 minutes                                                            |
| **Frequency**    | Every working day                                                             |
| **Participants** | Developers (Scrum Master facilitates; Product Owner and Scrum Master observe) |
| **Location**     | Same place and time each day                                                  |
| **Format**       | Developers choose the structure                                               |

The Developers can select whatever structure and techniques they want, as long as the Daily Scrum focuses on progress toward the Sprint Goal and produces an actionable plan. Scrumooth supports this by letting the team choose its focus rather than mandating a fixed set of questions.

---

## Conducting the Daily Scrum

### Accessing Daily Scrum

1. Click "Daily Scrum" in the sidebar
2. The Daily Scrum interface displays:
   - The **Sprint Goal** as the primary anchor
   - The date selector
   - The team-level Daily Scrum record for the selected date
   - Goal-relevant metrics (goal progress, backlog items adjusted, participants)

### Team-Level Record

The Daily Scrum is stored as a single **team-level record** per Sprint per day, jointly owned by the Developers. There is no per-user status report.

Because the Daily Scrum is an event **for the Developers** (Scrum Guide), only team members with the **Developers** role can record or edit the shared inspect/adapt/plan content. The Product Owner and Scrum Master may attend and observe the record, but they cannot author or modify it — this keeps the Developers' plan self-managed. A non-Developer viewing the page sees a read-only notice instead of the record/edit actions.

### Developer-Chosen Structure

The Developers decide how to run the Daily Scrum. Scrumooth offers a **"choose your focus"** selector with non-mandatory modes:

- **Goal progress** — inspect progress toward the Sprint Goal
- **Sprint Backlog walk** — review and adapt the Sprint Backlog
- **Impediment-first** — surface blockers first
- **Pair-up plan** — plan pairing for the next day

The focus selector is **part of the Inspect & Adapt edit form**, so only a Developer can choose the structure while recording. The chosen focus is saved with the shared team record and displayed as a read-only badge on the record view — so the whole team (including the Product Owner and Scrum Master) can see how the Daily Scrum is being run.

---

## Recording the Daily Scrum

### Starting the Record

On the current day, when no record exists yet, Scrumooth opens the Inspect & Adapt form.

### The Inspect & Adapt Form

The form captures the Daily Scrum's output as a shared team record:

- **Progress toward Sprint Goal** — how is the team progressing toward the goal?
- **Adaptations (Sprint Backlog)** — what adjustments to the Sprint Backlog were agreed?
- **Sprint Backlog adjustments (optional)** — link adjustments to specific Sprint Backlog items
- **Plan for next day** — the actionable plan the Developers agreed for the next day

```
Progress toward Sprint Goal:
  We completed the user authentication API; the checkout flow is ~80% done.

Adaptations (Sprint Backlog):
  Reassigned the password-reset item to Carol; moved profile page out of this sprint.

Plan for next day:
  Carol and Bob pair on password-reset email; Alice starts performance testing.
```

4. **Save the record** — the team-level record is stored for the selected date.

### Participation, Not Reporting

The page shows who has **participated** in the Daily Scrum. This is a neutral signal to support self-management, **not** a list of who "owes" a status report. A team-wide signal can be sent to gather the Developers who have **not yet joined**, but it never demands an individual report from anyone.

Because the Daily Scrum is a Developers-only event, the **"Not yet joined"** list tracks **Developers** only. The Product Owner and Scrum Master attend to observe but are not expected to "join" or author the record, so they never appear as missing. The team-wide signal follows the same rule: it is sent only to the Developers who have not yet joined, so the notification count matches the "Not yet joined" card.

---

## Viewing the Team Record

### Team Record View

The Daily Scrum page shows the shared team-level record:

```
┌─────────────────────────────────────────────────────────┐
│ Daily Scrum - January 15, 2026                           │
│ Sprint Goal: Deliver the reporting module                │
├─────────────────────────────────────────────────────────┤
│ Inspect & Adapt                                          │
│   ● Progress toward Sprint Goal                          │
│     We completed the auth API; checkout is ~80% done.    │
│   ● Adaptations (Sprint Backlog)                         │
│     Reassigned password-reset to Carol.                  │
│   ● Plan for next day                                    │
│     Carol + Bob pair on password reset; Alice tests.     │
│   👥 Joined: Alice, Bob, Carol                            │
└─────────────────────────────────────────────────────────┘
```

### History

View previous days:

- Click a date in the quick-date bar or the date selector
- See the team-level record for each day
- Track the team's progress over time

### Goal-Relevant Metrics

The page shows metrics that reflect **progress toward the Sprint Goal**, not report-completion counts:

- Sprint Goal progress %
- Sprint Backlog items adjusted
- Impediments raised
- Participants

---

## Identifying Impediments

### What is an Impediment?

An impediment is anything that:

- Blocks progress on work items
- Reduces team effectiveness
- Prevents meeting the Sprint Goal

### Raising Impediments

1. **During Daily Scrum**:
   - Clearly state the impediment
   - Indicate impact on work
   - Suggest resolution if known

2. **Promote to a formal record**:
   - Use "Create Impediment" to promote an impediment raised in the Daily Scrum into a formal Impediment record
   - The formal record carries the same impact fields and audit trail as one reported directly from the Impediments page, so the Scrum Master can act on it either way

3. **Track Resolution**:
   - Assign an owner — leave it blank and the impediment lands on the team's Scrum Master, who is accountable for causing its removal
   - Set a priority (Critical, High, Medium, Low) and, if the team wants one, a target date
   - Update the status as progress is made. Both **Resolved** and **Closed** require written resolution text, and an unresolved impediment blocks the Sprint from being closed
   - The Scrum Master is notified automatically once an impediment stays unresolved past the escalation threshold

---

## Best Practices

### For the Developers

- Start and end on time (max 15 minutes)
- Keep the focus on progress toward the Sprint Goal
- Agree on an actionable plan for the next day
- Raise impediments clearly
- Adapt the Sprint Backlog when reality changes

### For Scrum Masters

- Facilitate, do not dominate
- Help keep the event to 15 minutes
- Note impediments for follow-up
- Do **not** turn the event into a status report to management

### For Remote Teams

- Use video when possible
- Use a timer to stay on track
- Have a speaking order
- Consider async participation for time zones

---

## Common Anti-Patterns

### Problems to Avoid

| Anti-Pattern                   | Why It's a Problem    | Solution                        |
| ------------------------------ | --------------------- | ------------------------------- |
| **Status report to manager**   | Not for management    | Team-focused goal inspection    |
| **Problem solving in standup** | Takes too long        | "Take it offline"               |
| **Skipping standup**           | Loses synchronization | Make it a habit                 |
| **Fixed three questions**      | Limits team autonomy  | Let Developers choose structure |
| **No impediments raised**      | Issues fester         | Encourage openness              |

### Signs of a Healthy Daily Scrum

- ✅ Starts and ends on time
- ✅ Everyone participates
- ✅ Focus on the Sprint Goal
- ✅ Impediments are raised
- ✅ Team self-organizes and adapts after

### Signs of an Unhealthy Daily Scrum

- ❌ Regularly runs over 15 minutes
- ❌ Only some people speak
- ❌ Per-user status reports to management
- ❌ No impediments ever raised
- ❌ Management dominates

---

**Related Topics**:

- [Sprint Board](./sprint-board.md) - Track work progress
- [Sprint Planning](./sprint-planning.md) - Set the Sprint Goal
- [Retrospectives](./retrospectives.md) - Improve the process
