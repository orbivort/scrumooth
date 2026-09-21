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

| Aspect           | Guideline                                                                     | How Scrumooth supports it                                                                   |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Duration**     | Maximum 15 minutes                                                            | A fixed 15-minute timebox; only the start time is configurable                              |
| **Frequency**    | Every working day                                                             | The team's working-day pattern and dated non-working days are recorded, and counted against |
| **Participants** | Developers (Scrum Master facilitates; Product Owner and Scrum Master observe) | Only Developers can author or join the record                                               |
| **Location**     | Same place and time each day                                                  | The standing commitment (time, time zone, room or meeting link) is recorded per team        |
| **Format**       | Developers choose the structure                                               | A "choose your focus" selector, saved with the record                                       |

The Developers can select whatever structure and techniques they want, as long as the Daily Scrum focuses on progress toward the Sprint Goal and produces an actionable plan. Scrumooth supports this by letting the team choose its focus rather than mandating a fixed set of questions.

Two further commitments the Guide attaches to the event are made observable rather than assumed:

- **Inspection has a baseline.** Each record stores the Sprint Goal **as it stood when the record was created**. A later renegotiation of the goal cannot rewrite what a past Daily Scrum appears to have examined.
- **Adaptation is evidenced.** A record must either list the Sprint Backlog adjustments the Developers agreed (each typed as added, removed, reprioritised, refined or split) or explicitly acknowledge that no adaptation was needed.

The calendar **informs, it does not restrict**. Scrumooth never blocks a team from holding or recording its Daily Scrum on a day the calendar does not expect — the Developers are the ones who decide when it is worth meeting.

---

## Conducting the Daily Scrum

### Accessing Daily Scrum

1. Click "Daily Scrum" in the sidebar
2. The Daily Scrum interface displays:
   - The **Sprint Goal** as the primary anchor
   - The date selector
   - The **cadence strip** — the standing time and place, and "Sprint day X of Y"
   - The team-level Daily Scrum record for the selected date
   - Goal-relevant metrics (goal progress, backlog items adjusted, participants)

### The Team's Standing Commitment

The Guide has the Daily Scrum held "at the same time and place every working day". That commitment lives on its own Settings page (`Settings → Daily Scrum Schedule`), where — **Scrum Master only** — the team records:

- the **start time** and the **time zone** it is expressed in;
- the **place**: a room, a validated meeting link, or both;
- the team's **working days** (Monday to Friday by default, but any subset), and
- any **non-working days** — public holidays, company days off, team offsites — as dated exceptions to the weekly pattern.

Everyone on the team can read the commitment; only the Scrum Master can change it, because the Scrum Master is accountable for ensuring the Scrum events take place.

The Daily Scrum page shows the commitment in a compact **cadence strip** under the header, alongside the event's fixed 15-minute timebox. Two honest signals sit in that strip:

- **"Sprint day X of Y"** — progress counted on the team's **own** working days, so a holiday does not make the sprint appear to jump two days at once.
- **"N of M working days recorded"** — how many of the Sprint's due working days carry a Daily Scrum record.

When the selected date is not a working day for the team, the strip says so plainly and names the exception. It is an explanation, not a refusal: the record can still be started, and a Daily Scrum held on a day the calendar did not expect still counts as held.

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

- **Focus** — the structure the Developers chose for this event
- **Progress toward Sprint Goal** — how is the team progressing toward the goal?
- **Adaptations (Sprint Backlog)** — what adjustments to the Sprint Backlog were agreed, or an acknowledgement that none were needed
- **Plan for next day** — the actionable plan the Developers agreed for the next day

#### Declaring the adaptation outcome

The Guide states the purpose of the event is to **adapt the Sprint Backlog**, so the record has to say what the Developers concluded. Two options are offered as an exclusive pair:

- **"The Sprint Backlog was adapted"** — reveals the adjustment rows. Each row names a Sprint Backlog item, the **kind** of adjustment (added, removed, reprioritised, refined or split) and a note explaining it.
- **"No adaptation needed today"** — records the considered decision that nothing needed to change, without requiring the Developers to invent an adjustment.

A record that declares neither is refused, because the event's stated purpose would be left unproven. Declaring both at once is treated as contradictory input and is also refused — the choice is between the two, never both.

The kind of adjustment is a controlled value rather than free text so that the declaration can later be checked against what the Sprint Backlog actually did. The state of the affected item — and of its Product Backlog item — is recorded **by the system** at the moment of the declaration; the client never supplies it.

```
Progress toward Sprint Goal:
  We completed the user authentication API; the checkout flow is ~80% done.

Adaptation outcome:  The Sprint Backlog was adapted
  - Removed from the Sprint Backlog · Profile page
    Moved out of this Sprint; it is not needed for the goal.
  - Reprioritised · Password reset email
    Brought forward so it can be finished before the review.

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
│   ● Sprint Goal inspected at this Daily Scrum            │
│     Deliver the reporting module                         │
│   ● Progress toward Sprint Goal                          │
│     We completed the auth API; checkout is ~80% done.    │
│   ● Sprint Backlog adjustments                           │
│     [Reprioritised] Password reset email                 │
│       Brought forward before the review                  │
│       ✓ Reflected in the Sprint Backlog                  │
│   ● Plan for next day                                    │
│     Carol + Bob pair on password reset; Alice tests.     │
│   👥 Joined: Alice, Bob, Carol                            │
└─────────────────────────────────────────────────────────┘
```

#### The goal that was inspected

The record shows the Sprint Goal **as it stood when the Daily Scrum was held**, labelled "Sprint Goal inspected at this Daily Scrum". It is a stored snapshot, not a live lookup: a goal renegotiated later in the Sprint cannot retroactively rewrite what the event examined.

If the Sprint Goal has since changed, the record says so and shows both — the goal that was inspected and the goal the Sprint now has. Neither replaces the other.

#### Reflected, or declared but not yet reflected

Each adjustment carries a status chip:

- **Reflected in the Sprint Backlog** — the Sprint Backlog has moved in the direction the declaration described: a removed item has left the Sprint Backlog, an added one is present, or the item (or its Product Backlog item) has changed since the declaration.
- **Declared, not yet reflected** — the declaration is recorded but nothing in the Sprint Backlog has moved yet.

The verdict is worked out **when the record is read**, comparing the state captured at declaration time with the state now. It therefore stays truthful as the Sprint Backlog evolves, and it is the same verdict the Scrum Master dashboard rolls up per Sprint. It is not a reprimand: a declaration made minutes ago will naturally still read "not yet reflected".

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
