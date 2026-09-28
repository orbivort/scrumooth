# Product Goal

The Product Goal is the long-term objective the Scrum Team works toward. It describes a future state
of the product that provides value, and it is the **commitment** the Product Backlog is ordered
against: the backlog exists to serve the Product Goal, and the Product Goal is what tells the team
what "next" is for.

> **Enforced by Scrumooth:** The Product Goal is the Product Owner's accountability under the 2020
> Scrum Guide, and the tool holds that line. Only the Product Owner can create, edit, delete or
> change the status of a goal; only one goal can be `Active` at a time; a goal cannot be completed
> without recorded evidence of progress; and the Product Backlog cannot grow without an `Active` goal
> for its items to serve.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

A Product Goal:

- **Describes a future state** of the product that provides value to customers and stakeholders.
- **Provides focus** — it gives the Scrum Team one direction rather than a list of unrelated wishes.
- **Guides ordering** — it helps the Product Owner decide which Product Backlog items come next.
- **Measures progress** — it shows how far the product has come across many Sprints.
- **Aligns stakeholders** — it creates a shared understanding of what the product is for.

### Product Goal and Sprint Goal

The two goals operate at different ranges and belong to different accountabilities:

| Aspect          | Product Goal                 | Sprint Goal                   |
| --------------- | ---------------------------- | ----------------------------- |
| **Timeframe**   | Long-term (multiple Sprints) | Short-term (one Sprint)       |
| **Scope**       | Strategic objective          | Tactical focus for the Sprint |
| **Ownership**   | Product Owner                | Entire Scrum Team             |
| **Flexibility** | Adjusted as the team learns  | Fixed for the Sprint          |
| **Commitment**  | For the Product Backlog      | For the Sprint Backlog        |

---

## Key Concepts

### One goal at a time

A team holds **at most one `Active` Product Goal**. The team must fulfil or abandon the active goal
before taking on the next one. This is the tool's reading of the Guide's "one objective at a time":
a team spread across several objectives has no single answer to "why this work now".

### Goal statuses

A Product Goal progresses through four states:

| Status        | Meaning                                  | Actions available       |
| ------------- | ---------------------------------------- | ----------------------- |
| **New**       | Goal is defined but work has not started | Edit, Activate, Delete  |
| **Active**    | The team is actively working toward it   | Edit, Complete, Abandon |
| **Completed** | Goal has been achieved and evidenced     | View                    |
| **Abandoned** | Goal is no longer being pursued          | View                    |

`Completed` and `Abandoned` are **terminal**: a goal cannot be reactivated. To pursue the objective
again, create a new goal. Terminal goals stay in the list so the team keeps its history.

### Goal fields

| Field                   | Required | Description                               |
| ----------------------- | -------- | ----------------------------------------- |
| **Title**               | Yes      | Clear, concise name for the goal          |
| **Description**         | No       | What achieving the goal means             |
| **Target Date**         | No       | When the team aims to achieve it          |
| **Success Metrics**     | No       | How the team will measure success         |
| **Strategic Alignment** | No       | How the goal connects to company strategy |

### Who may do what

| Action                                   | Who                            |
| ---------------------------------------- | ------------------------------ |
| Create, edit, activate, complete, delete | Product Owner                  |
| Abandon                                  | Product Owner                  |
| View goals, progress and status history  | Every member of the Scrum Team |

The Product Owner is accountable for developing and explicitly communicating the Product Goal. Every
team member can still read goals, their progress and their status history.

### Linking Product Backlog items

The Product Goal gives context to Product Backlog items. An item can only be linked to the team's
single `Active` goal, and **adding a backlog item requires an `Active` goal to anchor it**. An item
that names no goal adopts the active one automatically. The link is not decoration: it is how the
team answers "which objective does this serve?".

### Progress indicators

Scrumooth shows how a goal is progressing:

- **Linked items progress** — the completion status of the goal's backlog items, rolled up into an
  overall percentage.
- **Sprint progress** — which Sprints have contributed to the goal.
- **Timeline** — the target date against the work completed so far.

---

## Practical Guidance

### Create a Product Goal

> **Note:** Creating a goal is a **Product Owner** action. Every team member can view goals.

1. Click **Product Goal** in the sidebar; the goals page lists existing goals.
2. Click **Create Goal** (or the **+** icon).
3. Fill in the goal details — title is required; description, target date, success metrics and
   strategic alignment are optional but recommended.
4. Click **Create**. The goal appears with `New` status.

**A good goal:**

```
Title: Launch Customer Self-Service Portal
Description: Enable customers to manage their accounts, view invoices,
             and submit support requests without contacting support.
Target Date: Q3 2026
Success Metrics:
  - 50% reduction in support calls
  - 10,000 monthly active users
  - Customer satisfaction score above 4.0
Strategic Alignment: Supports the company goal of reducing operational costs
```

**Avoid:**

```
Title: Improve the product
Description: Make it better
(Too vague, not measurable)
```

### Activate a goal

1. Open the goal to view its details.
2. Click **Activate** (or change the status to `Active`).
3. Only one goal can be active at a time — fulfil or abandon the active goal first.

### Complete a goal

1. Record the evidence first: a Sprint Review assessment or measured success-metric values.
   **Completion is refused until evidence exists** — a goal is not "done" because someone says so.
2. Open the goal and click **Complete**.
3. Document the outcome.

### Abandon a goal

1. Open the goal and click **Abandon**.
2. Abandoning keeps the history for future reference and does not affect linked backlog items.

### Link backlog items to the goal

1. **From an item**: when creating or editing a Product Backlog item, select the active Product Goal
   from the dropdown.
2. **From the goal**: open the goal to see every linked item and the progress they represent.

### Track progress

Open a goal to see its linked items, the Sprints that contributed, the overall completion
percentage, and the target date on the timeline.

---

## Gates and Enforcement

Scrumooth refuses these actions rather than letting a process violation pass silently:

| Refusal                                            | What it means                                                   | What to do                                                      |
| -------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| _Only the Product Owner may change a goal_         | Create, edit, delete and status changes are the Product Owner's | Ask the Product Owner to make the change                        |
| _A team can have only one active Product Goal_     | Another goal is already `Active`                                | Complete or abandon the active goal first                       |
| _A goal needs recorded evidence before it is Done_ | Nothing shows the objective was achieved                        | Record a Sprint Review assessment or measure the success metric |
| _The Product Backlog needs an active Product Goal_ | No goal is `Active`, so new items have nothing to serve         | Activate a goal                                                 |

---

## Best Practices

### Writing effective goals

1. **Be specific and measurable.**

   ```
   Avoid: "Improve user experience"
   Better: "Reduce average task completion time by 30%"
   ```

2. **Use time-bound targets.**

   ```
   Avoid: "Eventually support mobile"
   Better: "Launch iOS app by Q2 2026"
   ```

3. **Align with business value** — connect the goal to company objectives and document the "why".
4. **Limit active goals** — focus on one active goal; the team must fulfil or abandon an objective
   before taking on the next.

### Managing goals

1. **Review regularly** — assess progress in the Sprint Review and adjust based on learning.
2. **Communicate with stakeholders** — use the goal to communicate the roadmap and gather feedback.
3. **Stay flexible** — adapt the goal as the team learns; do not treat it as a fixed contract, but
   document the reasons for change.

### Common mistakes

| Mistake                     | Better approach                      |
| --------------------------- | ------------------------------------ |
| Too many active goals       | Focus on one active goal at a time   |
| Vague success metrics       | Define specific, measurable outcomes |
| Never updating goals        | Review and adjust each Sprint        |
| Goals without backlog items | Ensure goals have supporting work    |
| Ignoring stakeholder input  | Regularly validate with stakeholders |

---

## Related Topics

- [Product Backlog](./product-backlog.md) — create items that serve the goal
- [Sprint Planning](./sprint-planning.md) — plan Sprints aligned with the goal
- [Sprint Review](./sprint-review.md) — assess progress toward the goal
