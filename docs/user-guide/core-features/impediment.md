# Impediment

An Impediment is anything that blocks the Scrum Team's progress, reduces its effectiveness, or
prevents it from meeting the Sprint Goal. An Impediment belongs to the team that raised it, and the
Scrum Master is accountable for causing its removal — which is why an Impediment with no named owner
lands on the Scrum Master rather than on nobody.

> **Enforced by Scrumooth:** An Impediment is a team record, not a private note. Only members of the
> team can read or change it; a named owner defaults to the team's Scrum Master; both terminal
> states (`Resolved` and `Closed`) require written resolution text; and **an unresolved Impediment
> blocks the Sprint from closing**.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Daily Scrum is where blockers surface; the Impediment record is where they are tracked to
removal. Recording an Impediment:

- **Makes the blocker visible** to the whole team instead of leaving it in one person's head.
- **Names an owner** so removal is somebody's accountability, not everybody's hope.
- **Records the resolution** so "we dealt with it" is backed by what was actually done.
- **Keeps the Sprint honest** — a Sprint cannot be closed while an Impediment is still Open or In
  Progress.

---

## Key Concepts

### Statuses

An Impediment follows a defined lifecycle:

| Status          | Meaning                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| **Open**        | Reported, not yet being addressed                                         |
| **In Progress** | Someone is actively working on it                                         |
| **Resolved**    | The blocker has been removed (requires written resolution)                |
| **Closed**      | The record is closed and no longer relevant (requires written resolution) |

`Resolved` and `Closed` are both terminal for the Sprint-close gate. Because a bare `Closed` would
otherwise lift that gate while saying nothing about removal, **both terminal states require written
resolution text**. Reopening an Impediment (moving it back to `Open` or `In Progress`) clears the
resolution date and makes the Sprint-close gate block again.

```
Open -> In Progress -> Resolved -> Closed
  |                        |
  +------------------------+
   (reopen by changing status)
```

### Priority

Priorities are **Critical**, **High**, **Medium** (default) and **Low**. The Impediment list is
ordered by priority and then by age — Critical first, and within a priority band the longest-waiting
first — so the Scrum Master sees what to remove first rather than only what was reported most
recently.

### Target date

An optional **target date** records when the team intends the Impediment to be removed. It does not
gate anything; an Impediment past its target date is flagged as **overdue**.

### Owner

Every Impediment has an owner. If you leave the owner blank, the Impediment defaults to the team's
**Scrum Master**, and the owner is notified. The owner can be any member of the team.

### Escalation

An Impediment that stays unresolved past the escalation threshold (7 days by default) notifies the
Scrum Master, and the escalation is recorded rather than only observed on a dashboard.

### Team scope

An Impediment is scoped to the team that raised it and can optionally be associated with one of the
team's Sprints. Only members of that team can read or change it.

---

## Practical Guidance

### Report an Impediment

1. Click **Impediments** in the sidebar.
2. Click **Report Impediment**.
3. Fill in the details:

   | Field           | Required | Description                                                       |
   | --------------- | -------- | ----------------------------------------------------------------- |
   | **Title**       | Yes      | Brief description of the blocker (minimum 3 characters)           |
   | **Description** | Yes      | What is blocked and why (minimum 10 characters)                   |
   | **Sprint**      | No       | The Sprint the Impediment affects (defaults to the active Sprint) |
   | **Owner**       | No       | Who will drive removal; blank defaults to the Scrum Master        |
   | **Priority**    | No       | Critical, High, Medium (default) or Low                           |
   | **Target date** | No       | When the team intends it to be removed                            |

4. Click **Create Impediment**. An Impediment reported from the Daily Scrum can be promoted directly
   into a formal record with the same fields.

### Update an Impediment

1. Open the Impediment from the list.
2. Change the status, owner, priority or target date as progress is made.
3. When moving to **Resolved** or **Closed**, enter a written resolution describing how the blocker
   was removed. A resolution recorded earlier in the same lifecycle is accepted, so moving
   `Resolved` to `Closed` does not require retyping it.
4. Save. Every update records who made it.

### Filter and review

Filter the list by status (Open, In Progress, Resolved, Closed) and read the team statistics grouped
by status. The list order is priority first, then age, so the top of the list is the most urgent
blocker.

### Delete an Impediment

Erasing the record of what blocked the team destroys evidence, so deletion is limited to **the
reporter, the owner, or the team's Scrum Master**. The record is resolved within the named team
first, so an id from another team is never silently changed.

---

## Gates and Enforcement

| Refusal                                               | What it means                                                              | What to do                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| _Only a member of the team can read or change this_   | The Impediment belongs to its Scrum Team                                   | Ask a member of that team to act on it                       |
| _A written resolution is required_                    | `Resolved` or `Closed` was chosen without saying how the blocker went away | Describe how the Impediment was removed                      |
| _An unresolved Impediment blocks the Sprint_          | The Sprint is being closed while an Impediment is Open or In Progress      | Resolve or close it with a written resolution before closing |
| _Only the reporter, owner or Scrum Master may delete_ | Deletion would destroy the record of what blocked the team                 | Ask one of those people to delete it, or resolve it instead  |

---

## Best Practices

1. **Report promptly** — raise the Impediment as soon as it is identified to limit the impact.
2. **Describe it clearly** — say what is blocked, by what, and what "removed" would look like.
3. **Name an owner** — leaving it blank hands it to the Scrum Master, which may be right, but do it
   deliberately.
4. **Set a priority** — impact, not recency, decides what the Scrum Master removes first.
5. **Always write the resolution** — a terminal state without one is refused, and "resolved" with no
   record teaches the team nothing.
6. **Keep statuses current** — an Impediment that is actually handled but still marked Open keeps
   the Sprint from closing.
7. **Reopen when it comes back** — reopening restores the Sprint-close gate, which is the point.

---

## Related Topics

- [Daily Scrum](./daily-scrum.md) — where blockers surface and can be promoted to Impediments
- [Sprint Board](./sprint-board.md) — where a blocker shows up as stalled work
- [Sprint Review](./sprint-review.md) — where unresolved blockers are accounted for
