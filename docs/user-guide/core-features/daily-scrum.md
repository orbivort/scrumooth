# Daily Scrum

The Daily Scrum is a 15-minute time-boxed event **for the Developers**. Its purpose is to inspect
progress toward the Sprint Goal and adapt the Sprint Backlog, producing an actionable plan for the
next day of work. It is **not** a per-user status report to management.

> **Enforced by Scrumooth:** The event's two commitments are made observable rather than assumed.
> Each record stores the **Sprint Goal as it stood when the record was created**, so a later
> renegotiation cannot rewrite what the event examined; and a record must either list the **Sprint
> Backlog adjustments** the Developers agreed or explicitly acknowledge that none were needed. Only
> **Developers** can author the team's record.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Daily Scrum is used to:

1. **Inspect** progress toward the Sprint Goal.
2. **Adapt** the Sprint Backlog based on that progress.
3. **Produce** an actionable plan for the next day.
4. **Identify** Impediments.

The Daily Scrum is **not** a status report meeting, a problem-solving session, a management reporting
tool, a lengthy discussion, or a per-user "yesterday / today / blockers" submission.

| Aspect           | Guideline                                                                     | How Scrumooth supports it                                                                  |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Duration**     | Maximum 15 minutes                                                            | A fixed 15-minute timebox; only the start time is configurable                             |
| **Frequency**    | Every working day                                                             | The team's working-day pattern and dated non-working days are recorded and counted against |
| **Participants** | Developers (Scrum Master facilitates; Product Owner and Scrum Master observe) | Only Developers can author or join the record                                              |
| **Location**     | Same place and time each day                                                  | The standing commitment (time, time zone, room or meeting link) is recorded per team       |
| **Format**       | Developers choose the structure                                               | A "choose your focus" selector, saved with the record                                      |

---

## Key Concepts

### The team's standing commitment

The Guide has the Daily Scrum held "at the same time and place every working day". That commitment
lives on its own settings page (**Settings → Daily Scrum Schedule**), where — **Scrum Master only** —
the team records:

- the **start time** and the **time zone** it is expressed in;
- the **place** — a room, a validated meeting link, or both;
- the team's **working days** (Monday to Friday by default, but any subset); and
- any **non-working days** — public holidays, company days off, team offsites — as dated exceptions to
  the weekly pattern.

Everyone on the team can read the commitment; only the Scrum Master can change it, because the Scrum
Master is accountable for ensuring the Scrum events take place.

### The cadence strip

The Daily Scrum page shows the commitment in a compact **cadence strip** under the header, alongside
the event's fixed 15-minute timebox. Two honest signals sit in that strip:

- **"Sprint day X of Y"** — progress counted on the team's **own** working days, so a holiday does not
  make the Sprint appear to jump two days at once.
- **"N of M working days recorded"** — how many of the Sprint's due working days carry a Daily Scrum
  record.

When the selected date is not a working day, the strip says so and names the exception. It is an
explanation, not a refusal: the record can still be started, and a Daily Scrum held on a day the
calendar did not expect still counts as held. The calendar **informs, it does not restrict**.

### Team-level record, not per-user reports

The Daily Scrum is stored as a single **team-level record** per Sprint per day, jointly owned by the
Developers. There is no per-user status report. Only team members with the **Developers** role can
record or edit the shared inspect/adapt/plan content; the Product Owner and Scrum Master may attend
and observe but cannot author or modify it. A non-Developer viewing the page sees a read-only notice.

### Developer-chosen structure

The Developers decide how to run the event. Scrumooth offers a **"choose your focus"** selector with
non-mandatory modes:

- **Goal progress** — inspect progress toward the Sprint Goal.
- **Sprint Backlog walk** — review and adapt the Sprint Backlog.
- **Impediment-first** — surface blockers first.
- **Pair-up plan** — plan pairing for the next day.

The chosen focus is saved with the shared record and shown as a read-only badge, so the whole team can
see how the Daily Scrum is being run.

### Inspection has a baseline

Each record stores the Sprint Goal **as it stood when the record was created**. If the Goal is later
renegotiated, the record still shows what was inspected, and says so.

### Adaptation is evidenced

A record must either list the Sprint Backlog adjustments the Developers agreed — each typed as added,
removed, reprioritised, refined or split — or explicitly acknowledge that no adaptation was needed.
The kind of adjustment is a controlled value rather than free text, so the declaration can later be
checked against what the Sprint Backlog actually did.

---

## Practical Guidance

### Open the Daily Scrum

1. Click **Daily Scrum** in the sidebar. The interface shows the Sprint Goal as the primary anchor,
   the date selector, the cadence strip, the team-level record for the selected date, and
   goal-relevant metrics.
2. Use the date selector or the quick-date bar to move between days and read previous records.

### Record the event

On the current day, when no record exists yet, Scrumooth opens the Inspect & Adapt form. Capture the
event's output as a shared team record:

- **Focus** — the structure the Developers chose for this event.
- **Progress toward Sprint Goal** — how the team is progressing toward the Goal.
- **Adaptations (Sprint Backlog)** — what adjustments were agreed, or an acknowledgement that none
  were needed.
- **Plan for next day** — the actionable plan the Developers agreed.

#### Declare the adaptation outcome

Two options are offered as an exclusive pair:

- **"The Sprint Backlog was adapted"** — reveals the adjustment rows. Each row names a Sprint Backlog
  item, the **kind** of adjustment (added, removed, reprioritised, refined or split) and a note
  explaining it.
- **"No adaptation needed today"** — records the considered decision that nothing needed to change,
  without requiring the Developers to invent an adjustment.

A record that declares neither is refused, because the event's stated purpose would be left unproven.
Declaring both at once is contradictory and is also refused.

The state of the affected item — and of its Product Backlog item — is recorded **by the system** at
the moment of the declaration; the client never supplies it.

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

Save the record to store it for the selected date.

### Participation, not reporting

The page shows who has **participated** in the Daily Scrum. This is a neutral signal to support
self-management, **not** a list of who "owes" a status report. Because the event is for the Developers,
the **"Not yet joined"** list tracks **Developers** only; the Product Owner and Scrum Master never
appear as missing. A team-wide signal can be sent to gather the Developers who have not yet joined,
but it never demands an individual report.

### Read the team record

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
│   👥 Joined: Alice, Bob, Carol                           │
└─────────────────────────────────────────────────────────┘
```

The record shows the Sprint Goal **as it stood when the Daily Scrum was held**, labelled "Sprint Goal
inspected at this Daily Scrum". It is a stored snapshot, not a live lookup. If the Goal has since
changed, the record shows both — the Goal that was inspected and the Goal the Sprint now has.

Each adjustment carries a status chip:

- **Reflected in the Sprint Backlog** — the Sprint Backlog has moved in the direction the declaration
  described: a removed item has left, an added one is present, or the item (or its Product Backlog
  item) has changed since the declaration.
- **Declared, not yet reflected** — the declaration is recorded but nothing in the Sprint Backlog has
  moved yet.

The verdict is worked out when the record is read by comparing the state captured at declaration time
with the state now, so it stays truthful as the Sprint Backlog evolves. It is not a reprimand: a
declaration made minutes ago will naturally still read "not yet reflected".

### Goal-relevant metrics

The page shows metrics that reflect **progress toward the Sprint Goal**, not report-completion counts:
Sprint Goal progress, Sprint Backlog items adjusted, Impediments raised, and participants.

### Raise an Impediment

1. State the Impediment clearly during the event, its impact on the work, and a suggested resolution if
   known.
2. Use **Create Impediment** to promote it into a formal [Impediment](./impediment.md) record. The
   formal record carries the same impact fields and audit trail as one reported directly from the
   Impediments page.
3. Assign an owner — leave it blank and it lands on the team's Scrum Master — set a priority and
   optional target date, and update the status as progress is made.

---

## Gates and Enforcement

| Refusal                                        | What it means                                                             | What to do                      |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------- |
| _Only Developers can author the Daily Scrum_   | Someone without the Developers role tried to record or edit the event     | Ask a Developer to record it    |
| _A record must declare the adaptation outcome_ | Neither "adapted" nor "no adaptation needed" was selected                 | Declare one of the two outcomes |
| _Declaring both outcomes is contradictory_     | The record claims the Sprint Backlog was adapted and that none was needed | Choose exactly one              |

---

## Best Practices

### For the Developers

- Start and end on time (maximum 15 minutes).
- Keep the focus on progress toward the Sprint Goal.
- Agree an actionable plan for the next day.
- Raise Impediments clearly, and adapt the Sprint Backlog when reality changes.

### For Scrum Masters

- Facilitate, do not dominate; help keep the event to 15 minutes.
- Note Impediments for follow-up.
- Do **not** turn the event into a status report to management.

### For remote teams

- Use video where possible, and a timer to stay on track.
- Have a speaking order, and consider async participation across time zones.

### Anti-patterns and their signs

| Anti-pattern                   | Why it is a problem   | Solution                        |
| ------------------------------ | --------------------- | ------------------------------- |
| **Status report to manager**   | Not for management    | Team-focused goal inspection    |
| **Problem solving in standup** | Takes too long        | "Take it offline"               |
| **Skipping the event**         | Loses synchronisation | Make it a habit                 |
| **Fixed three questions**      | Limits team autonomy  | Let Developers choose structure |
| **No Impediments raised**      | Issues fester         | Encourage openness              |

**Healthy:** starts and ends on time, everyone participates, focus stays on the Sprint Goal,
Impediments are raised, and the team self-organises after the event.

**Unhealthy:** regularly runs over 15 minutes, only some people speak, per-user status reports to
management, no Impediments ever raised, or management dominates.

---

## Related Topics

- [Sprint Board](./sprint-board.md) — where the day's plan is executed
- [Sprint Planning](./sprint-planning.md) — where the Sprint Goal is set
- [Impediment](./impediment.md) — where a blocker raised here is tracked to removal
- [Sprint Retrospective](./sprint-retrospective.md) — where the process itself is improved
