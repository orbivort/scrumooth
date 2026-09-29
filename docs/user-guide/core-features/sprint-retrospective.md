# Sprint Retrospective

The Sprint Retrospective is the event where the Scrum Team inspects **how it worked** and plans
concrete improvements for the next Sprint. It concludes the Sprint, and it is a working session, not
a report: the team leaves with action items it owns.

> **Enforced by Scrumooth:** The room is the Scrum Team. A Sprint Retrospective can only be read or
> changed by members of the team whose Sprint it concludes, and the Scrum Master's coaching notes are
> visible only to that team's Scrum Master. If the team chooses an anonymous retrospective, item
> authors are never stored at all — the choice cannot be changed once the retrospective exists — and
> a completed retrospective is a read-only record.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Sprint Retrospective is used to:

1. **Inspect** how the last Sprint went — individuals, interactions, processes, tools and the
   Definition of Done.
2. **Identify** what went well and what to improve.
3. **Create** a plan for improvements to be enacted in the next Sprint.
4. **Commit** to specific, owned actions rather than general intentions.

It is **not** a blame session, a complaint meeting, a list of problems only, or an optional event.

| Aspect           | Guideline                             |
| ---------------- | ------------------------------------- |
| **Duration**     | Maximum 1.5 hours for a 2-week Sprint |
| **Participants** | Scrum Team only (no stakeholders)     |
| **Focus**        | Process, people, tools, relationships |
| **Outcome**      | Actionable improvement items          |
| **Safety**       | A safe space for honest discussion    |

---

## Key Concepts

### Participants and confidentiality

Only the Scrum Team takes part. The Scrum Master facilitates. A retrospective is scoped to the team
whose Sprint it concludes: no other team, and no stakeholder, can read it. The Scrum Master's
coaching notes about the event are readable and writable only by that team's Scrum Master.

### Anonymity is chosen once

When the retrospective is created, the team chooses whether it is anonymous:

- **Anonymous** — item authors are not recorded at all. No one, including the Scrum Master, can
  attribute an item afterwards.
- **Attributed** — items are attributed to the logged-in user who added them.

The choice cannot be changed once the retrospective exists.

### Format and categories

Scrumooth implements the **What Went Well / What to Improve** format with three categories:

| Category                | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| **What Went Well**      | Celebrate successes and positive outcomes |
| **What Didn't Go Well** | Identify challenges and issues faced      |
| **What to Improve**     | Suggest actionable improvements           |

### Dot voting

Every item carries a vote button. Team members vote for the items they believe matter most; items are
sorted by vote count, and voting is disabled once the retrospective is completed. Votes focus the
discussion on the top items rather than trying to address everything at once.

### Action items

An action item is the commitment that keeps a retrospective from being a conversation. A good one is
specific, measurable, assigned, time-bound and within the team's control. Action items follow their
own workflow — **Pending**, **In Progress**, **Completed** or **Cancelled** — and outstanding ones
carry forward until they are resolved.

### Inspecting the Definition of Done

The Guide names the Definition of Done among the things this event inspects. The retrospective page
therefore carries a **Definition of Done inspection** panel, where the team decides, for each
criterion, to **keep**, **change** or **retire** it, or to **add** a missing one, and records what it
concluded and why. Applying the change updates the Definition of Done through the same versioned
machinery used elsewhere: the version increments, the superseded version is kept in history, and an
**Adopted vN** chip records which version this event produced. A Definition of Done cannot be
emptied — retiring every criterion is refused.

---

## Practical Guidance

### Before the retrospective

**Scrum Master:**

- Schedule the event and prepare the format.
- Gather Sprint data — Sprint Goal achievement, velocity against plan, Impediments encountered.
- Review the previous actions so they can be inspected rather than forgotten.
- Prepare the environment for a safe discussion.

**Team members:**

- Reflect on the Sprint, what went well and what to improve.
- Consider the status of previous action items.

### Open the retrospective

1. Click **Sprint Retrospective** in the sidebar and select the completed Sprint.
2. If none exists yet, click **Create Retrospective**, choose whether the event is anonymous, and
   confirm.
3. Read the **Prime Directive** aloud to set the tone:

   > "Regardless of what we discover, we understand and truly believe that everyone did the best job
   > they could, given what they knew at the time, their skills and abilities, the resources
   > available, and the situation at hand."

### Collect feedback

1. Under each category column, click **+** to add an item; be specific and constructive, and focus on
   issues rather than people.
2. Review the items together and cluster similar ones.
3. Discuss each cluster: what happened, why it happened, and what can be done about it.
4. **Vote** on the items that matter most, then concentrate the discussion on the top three to five.

### Create action items

1. Click **Add Action Item** in the retrospective.
2. Fill in the title, owner, due date, description, and the retrospective item that prompted it.
3. Save. The action appears in the retrospective and in the action-item tracking view.

### Carry an improvement into the Product Backlog

Outstanding action items appear on the Product Backlog page in the **Pending Action from
Retrospective** panel. Each offers three outcomes:

| Action                 | What it does                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **Create Item**        | Creates a Product Backlog item from the improvement and records the link             |
| **Link existing item** | Records an existing Product Backlog item as the outcome of the improvement           |
| **Mark Added**         | For improvements whose outcome is not an item at all (a process change, for example) |

The link is the evidence: the panel shows which item carries the improvement. Once a link exists,
**Mark Added** is disabled, because an improvement cannot be both carried by an item and marked as
never added. Creating the item requires an **Active Product Goal**, exactly like creating an item by
hand on the Product Backlog page.

### Inspect the Definition of Done

1. Read the criteria the team currently works to.
2. Decide on each criterion — **Keep**, **Change** (with the new wording) or **Retire** — and add any
   missing one.
3. Record what the team concluded and why in the notes field.
4. **Save reflection** keeps the decisions on the retrospective without changing the Definition of
   Done, so a deliberate "we inspected it and kept it" stays visible.
5. **Apply to Definition of Done** previews exactly what will change, with the version transition,
   and only then writes it.

### Review previous actions

At the start of each retrospective, review the previous action items and their status — completed, in
progress, not started or no longer relevant — and discuss whether they helped. Keep incomplete items
visible; do not let them disappear.

---

## Gates and Enforcement

| Refusal                                       | What it means                                                   | What to do                                                   |
| --------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| _Only the Scrum Team can read this_           | The retrospective belongs to the team whose Sprint it concludes | Access it as a member of that team                           |
| _An empty Definition of Done is refused_      | Every criterion would be retired, so Done would mean nothing    | Keep at least one criterion active                           |
| _An improvement needs an active Product Goal_ | Creating a Product Backlog item requires an Active Product Goal | Activate a goal, then create the item                        |
| _A completed retrospective is read-only_      | Its items, actions and reflection are a record                  | Create the next Sprint's retrospective instead of editing it |

---

## Best Practices

### For the Scrum Master

- Create a safe environment; encourage everyone to speak and time-box each section.
- Keep the discussion constructive and focused on actionable outcomes.
- Do not let it become a blame session or a complaint list, and do not dominate it.
- Never skip the retrospective, and never let action items be forgotten.

### For team members

- Be honest but constructive; focus on process, not people.
- Offer solutions, not just problems.
- Come prepared, listen actively, and follow through on commitments.

### Signs of a healthy Sprint Retrospective

- Action items are specific and owned, and last Sprint's are reviewed first.
- The same issues do not recur Sprint after Sprint because root causes are addressed.
- The Definition of Done is genuinely revisited, not rubber-stamped.

---

## Related Topics

- [Sprint Review](./sprint-review.md) — where the product, not the process, is inspected
- [Sprint Planning](./sprint-planning.md) — where retrospective actions are applied
- [Daily Scrum](./daily-scrum.md) — where adaptations surface during the Sprint
- [Impediment](./impediment.md) — a recurring blocker usually has a root cause worth a retrospective
