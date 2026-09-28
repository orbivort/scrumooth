# Sprint Review

The Sprint Review is held at the end of the Sprint to **inspect the Increment** and **adapt the
Product Backlog** if needed. It is a collaborative working session with stakeholders, not a sign-off
or a presentation.

> **Enforced by Scrumooth:** The Review is the Scrum Team's own event, so recording attendance,
> leaving feedback, adjusting the Product Backlog and completing the Review all require membership of
> the team that owns it. Completing the Review also requires two things the Guide implies: if the
> Sprint has a Sprint Goal, the team must record its own **verdict on whether the Goal was met** — the
> tool will not infer attainment from item completion — and the Review **cannot be completed before
> the day the Sprint's end date names**. A Sprint cannot be closed until its Review has been recorded.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Sprint Review is used to:

1. **Inspect** the Increment delivered.
2. **Demonstrate** completed work to stakeholders.
3. **Collaborate** on what to do next.
4. **Adapt** the Product Backlog based on feedback.

It is **not** a "sign-off" meeting, a presentation only, a status meeting, or a gate to pass. "Not a
gate" describes the Review's nature — a collaborative working session, not an approval checkpoint for
the Increment. It does not mean the Review is optional: the Sprint cannot be closed until the Review
has been recorded.

| Aspect           | Guideline                           |
| ---------------- | ----------------------------------- |
| **Duration**     | Maximum 2 hours for a 2-week Sprint |
| **Participants** | Scrum Team + stakeholders           |
| **Focus**        | Increment inspection and adaptation |
| **Outcome**      | Updated Product Backlog             |

---

## Key Concepts

### What the Review inspects

The Review inspects the [Increment](./increment.md) — the sum of the Product Backlog items completed
during the Sprint that are in usable condition. Only work that meets the Definition of Done is
demonstrated; incomplete work and internal refactoring are not, unless the latter is relevant to
stakeholders.

### The team's verdict on the Sprint Goal

The Review records the Scrum Team's own assessment of whether the Sprint Goal was met. The tool will
not infer attainment from the number of completed items, because "we finished the checklist" and "we
achieved the objective" are different claims.

### Feedback and backlog adaptation

Feedback gathered during the Review is the input to Product Backlog adaptation. Scrumooth categorises
it so it can be acted on:

| Type               | Example                          | Action                       |
| ------------------ | -------------------------------- | ---------------------------- |
| **Positive**       | "This is exactly what we needed" | Note for team morale         |
| **Change request** | "Can we also add...?"            | Add to the Product Backlog   |
| **Concern**        | "This might confuse users"       | Discuss; may create an item  |
| **New idea**       | "What if we could...?"           | Add to the Product Backlog   |
| **Priority shift** | "We need X sooner than Y"        | Re-order the Product Backlog |

### The Review record

The Review is stored as a record with these fields:

| Field                   | Description                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| **Sprint**              | Which Sprint was reviewed                                                                            |
| **Date**                | When the Review occurred                                                                             |
| **Attendees**           | Who participated, with name, email, role and attendance status                                       |
| **Summary**             | The overall outcome, including items demonstrated and next steps                                     |
| **Feedback**            | Stakeholder input, categorised as positive, negative, suggestion or question                         |
| **Backlog adjustments** | Changes made to the Product Backlog based on the Review                                              |
| **Sprint Goal outcome** | The team's recorded verdict on whether the Sprint Goal was met (required when the Sprint has a Goal) |

The Increment delivered during the Sprint is automatically linked to the Review record.

### The Scrum Master's notes

The Review carries a separate notes field for the Scrum Master's coaching observations about the
event. It is readable and writable only by the team's Scrum Master and is omitted from every other
caller's view.

---

## Practical Guidance

### Before the Review

**Developers:**

- All "Done" items are ready to demonstrate, and the demo environment is prepared.
- The demo script or story is clear, and technical issues are resolved.

**Product Owner:**

- Stakeholders are invited, the Sprint Goal is reviewed, and Product Backlog items are prepared for
  discussion.
- Next Sprint priorities are identified.

**Scrum Master:**

- The event is scheduled and the room is prepared; stakeholder attendance is confirmed.
- Previous Review notes are available.

### Open the Review

1. Click **Sprint Review** in the sidebar and select the completed Sprint.
2. Click **Create Sprint Review** and record the basic details: the Sprint, the date, the facilitator
   (usually the Scrum Master) and the attendees.
3. Save to create the record.

### Run the agenda

```
┌─────────────────────────────────────────────────────────┐
│ SPRINT REVIEW AGENDA                                    │
├─────────────────────────────────────────────────────────┤
│ 1. Welcome & Context (5 min)                            │
│    - Sprint Goal reminder                               │
│    - What was planned                                   │
│                                                         │
│ 2. Increment Demonstration (60-90 min)                  │
│    - Demo completed features                            │
│    - Stakeholders try the product                       │
│    - Questions and clarifications                       │
│                                                         │
│ 3. Review & Discussion (15-30 min)                      │
│    - What went well                                     │
│    - What wasn't completed and why                      │
│    - Stakeholder feedback                               │
│                                                         │
│ 4. Backlog Adaptation (10-15 min)                       │
│    - Discuss next priorities                            │
│    - Add/update backlog items                           │
│    - Timeline adjustments                               │
└─────────────────────────────────────────────────────────┘
```

### Demonstrate the Increment

- **Prepare** — test the demo beforehand, have a backup plan, prepare demo data and know the
  acceptance criteria.
- **During the demo** — start with the Sprint Goal, show the user journey, let stakeholders try it and
  answer questions.
- **If the demo fails** — stay calm, explain what it should do, show screenshots or video if
  available, note it as an Impediment to fix, and move on.

### Gather feedback

1. **Encourage questions** — "What do you think?", "Does this meet your needs?", "Any concerns?"
2. **Document feedback** — note all comments, capture who said what, and record suggestions.
3. **Clarify understanding** — repeat back what you heard, ask follow-ups and confirm alignment.
4. In the interface, click **Add Feedback** and record **From**, **Content**, **Type** and the
   **Action** to take, then save.

### Record the Sprint Goal outcome

Record the team's verdict on whether the Sprint Goal was met. If the Sprint has a Goal, the Review
cannot be completed without it.

### Adapt the Product Backlog

1. **During the Review** — discuss proposed changes, get stakeholder agreement, and note the changes
   to make: add items, remove items no longer needed, re-order existing items, update descriptions, or
   change release plans.
2. **After the Review** — open the [Product Backlog](./product-backlog.md) and make the agreed
   adjustments.
3. **Document the changes** — record them in the Review, with the rationale.

```
Based on review feedback:

Added:
- "Export to PDF" (Could Have) - Stakeholder request
- "Bulk edit users" (Should Have) - Efficiency improvement

Removed:
- "Social login" - No longer needed per stakeholder

Re-prioritized:
- "Advanced search" moved from Could to Should Have
- "Email templates" moved from Should to Must Have
```

### Document the Review

Capture the Sprint summary (planned versus delivered, Sprint Goal achievement, key metrics), the
demonstration notes, the feedback summary and the backlog changes. Details about items demonstrated
and next steps belong in the **Summary** field.

---

## Gates and Enforcement

| Refusal                                             | What it means                                                    | What to do                                        |
| --------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| _Only the Scrum Team can change this Review_        | A non-member tried to record attendance, feedback or adjustments | Ask a member of the team to make the change       |
| _Record the Sprint Goal outcome_                    | The Sprint has a Goal and no verdict was recorded                | Record whether the Goal was met                   |
| _The Review cannot complete before the Sprint ends_ | The Sprint's end date has not arrived                            | Hold the Review on or after the Sprint's end date |
| _A Sprint cannot close without its Review_          | The Sprint is being closed with no Review recorded               | Conduct and record the Sprint Review              |

---

## Best Practices

### For Product Owners

- **Before** — invite relevant stakeholders, prepare the agenda, and know what was delivered.
- **During** — facilitate stakeholder engagement, capture feedback and guide backlog discussions.
- **After** — update the Product Backlog, communicate the changes and prepare for the next Sprint.

### For Developers

- **Before** — prepare demos, test the demo environment and know the acceptance criteria.
- **During** — demonstrate confidently, answer technical questions and listen to feedback.
- **After** — incorporate feedback and mark the achievement.

### For stakeholders

Attend and participate actively, provide constructive feedback, ask questions and collaborate on
priorities. Come prepared with questions, focus on value rather than implementation, be specific, and
understand the constraints.

### Common mistakes

| Mistake                 | Impact                 | Solution                      |
| ----------------------- | ---------------------- | ----------------------------- |
| No stakeholders         | Missed feedback        | Invite and confirm attendance |
| Demo-only format        | No collaboration       | Encourage discussion          |
| Showing incomplete work | False expectations     | Only show "Done" items        |
| No backlog updates      | Wasted feedback        | Act on feedback immediately   |
| Too long                | Stakeholders disengage | Stay within the time box      |

### Example

A team reviews Sprint 5 with the Sprint Goal "enable customers to save items for later purchase". Five
of six items are delivered; "Share wishlist" is not. Stakeholders ask for social sharing and multiple
wishlists, and the Product Owner re-orders "Share wishlist" to Must Have and adds the others to the
Product Backlog. The team records that the Sprint Goal was met.

---

## Related Topics

- [Increment](./increment.md) — the artifact the Review inspects
- [Sprint Planning](./sprint-planning.md) — where the next Sprint is planned
- [Sprint Retrospective](./sprint-retrospective.md) — where the process is improved
- [Product Backlog](./product-backlog.md) — where the Review's feedback lands
