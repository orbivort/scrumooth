# Product Backlog

The Product Backlog is an **ordered list of everything that might be needed in the product**. It is
the single source of work for the Scrum Team and the commitment it serves is the
[Product Goal](./product-goal.md). It is dynamic: it changes as the team learns, and the Product
Owner is accountable for its content, availability and ordering.

> **Enforced by Scrumooth:** The order is stored, not inferred. Only the **Product Owner** may order
> the Product Backlog or change an item's MoSCoW band, and the rule is enforced by the server so it
> holds even against the API. An item must be refined to **Ready** before it can enter a Sprint, and
> an item can reach **Done** only once every active Definition of Done criterion has been verified
> for it.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Product Backlog is:

- **Ordered** — every item has a position, and the Product Owner decides what is next.
- **Dynamic** — it evolves with learning, feedback and the market.
- **Detailed appropriately** — higher-priority items are more refined than lower ones.
- **The single source of truth** — all work the team takes on comes from the backlog.

| Role              | Responsibility                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| **Product Owner** | Owns the backlog and **orders** it (position and MoSCoW band), ensures value |
| **Developers**    | Size the items, clarify requirements, add technical items                    |
| **Scrum Master**  | Facilitates refinement, removes impediments to backlog management            |

---

## Key Concepts

### Item components

Each Product Backlog item contains:

**Required fields**

| Field        | Description             | Example                             |
| ------------ | ----------------------- | ----------------------------------- |
| **Title**    | Brief, descriptive name | "User can reset password via email" |
| **Priority** | MoSCoW classification   | Must Have                           |
| **Status**   | Current workflow state  | Ready                               |

Every item also has a **position** in the backlog order. The system assigns it when the item is
created — appended to the end — and the Product Owner changes it from there.

**Optional fields**

| Field                   | Description                       | When to use                             |
| ----------------------- | --------------------------------- | --------------------------------------- |
| **Description**         | Detailed requirements and context | Complex items                           |
| **Story Points**        | Effort estimate                   | After team discussion                   |
| **Labels**              | Categorisation tags               | For filtering and grouping              |
| **Product Goal**        | Link to the strategic objective   | When the item supports a goal           |
| **Acceptance Criteria** | Definition of done for this item  | All items (recommended)                 |
| **Business Value**      | Relative value score (numeric)    | For ROI calculations and prioritisation |

Business Value can be used to calculate ROI (Business Value ÷ Story Points) for prioritisation
decisions.

### Ordering the backlog

The Product Backlog is an **ordered** list, and ordering it is the Product Owner's accountability.

- Every item has a **position** in the team's backlog. The list view numbers the rows from the top,
  so the backlog reads top-to-bottom as "what is next".
- **MoSCoW priority is a categorisation, not the order.** Two Must Haves still have a first and a
  second, and within each board column the items are in the stored order.
- A **new item is appended to the end**, so creating one never inserts it into the middle of the
  Product Owner's sequence.
- **Deleting an item leaves a gap** in the numbering until the next reorder tidies it up; the order
  itself is unchanged.

| Action                     | How                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move an item to a position | Drag the card onto another card in the board; drop on the **upper half** to place it before that item, the **lower half** to place it after. The insertion line shows where it will land.       |
| Move an item between bands | Drag the card into another MoSCoW column — the band and the position change together.                                                                                                           |
| Move without a mouse       | In the list view use the ▲/▼ controls in the **Position** column; on the board, focus a card, press **Space** to grab, **←/→** to change the MoSCoW band, **Space** to drop, **Esc** to cancel. |
| Change the MoSCoW band     | The MoSCoW selector in the item's edit dialog.                                                                                                                                                  |

Only the **Product Owner** orders the Product Backlog. Anyone else sees the order as read-only: the
position column has no move controls, cards cannot be dragged, and the MoSCoW selector is disabled
with an explanation. Everything else about an item stays collaborative: any team member can create,
edit, delete and move items through the workflow, and only **Developers** size them.

### MoSCoW prioritisation

| Priority        | Colour    | Meaning                    | When to use                                     |
| --------------- | --------- | -------------------------- | ----------------------------------------------- |
| **Must Have**   | 🔴 Red    | Critical for success       | Non-negotiable; without these the product fails |
| **Should Have** | 🟠 Orange | Important but not critical | High value, could be deferred if necessary      |
| **Could Have**  | 🟢 Green  | Nice to have               | Low effort, enhances user experience            |
| **Won't Have**  | ⚪ Gray   | Not this release           | Acknowledged but explicitly out of scope        |

**Guidelines:**

- **Must Have** — the product does not solve the core problem without it; a legal, compliance or
  contractual requirement; or a critical path for other features.
- **Should Have** — high business value and important for satisfaction, but deferrable by a Sprint if
  necessary.
- **Could Have** — low effort, high delight: polish, refinements and quick wins.
- **Won't Have** — a good idea that is not now: needs research, is not aligned with the current goal,
  or is explicitly out of scope for this release.

### Item statuses

| Status          | Meaning                                | Next step                  |
| --------------- | -------------------------------------- | -------------------------- |
| **New**         | Just created, needs refinement         | Add details, estimate      |
| **Refined**     | Details added, needs final preparation | Verify readiness           |
| **Ready**       | Refined and ready for a Sprint         | Include in Sprint Planning |
| **In Progress** | Currently being worked on              | Complete the work          |
| **Done**        | Completed and verified                 | Compose into the Increment |

If an item is blocked by an Impediment, track it with the [Impediment](./impediment.md) record rather
than a status change.

### Estimation and story points

Scrumooth recommends the Fibonacci sequence:

| Points | Complexity      | Example                           |
| ------ | --------------- | --------------------------------- |
| **1**  | Trivial         | Fix a typo, update config         |
| **2**  | Simple          | Add a form field, simple query    |
| **3**  | Straightforward | New page, basic feature           |
| **5**  | Moderate        | Complex form, integration         |
| **8**  | Complex         | New module, significant feature   |
| **13** | Very complex    | Major feature; consider splitting |
| **21** | Epic            | Too large; should be split        |

Fibonacci is recommended and commonly used, but the system accepts any numeric value between 1 and
100, so a team that uses another scale is not blocked.

---

## Practical Guidance

### Create an item

1. Click **Product Backlog** in the sidebar; the backlog page opens with list and board views.
2. Click **Create Item** (or **+**).
3. Fill in the details:
   - **Title** (required) — clear, action-oriented language.
   - **Description** — use the user-story format and include acceptance criteria.
   - **Priority** — select the MoSCoW band.
   - **Story Points** — estimate effort (can be refined later).
   - **Labels** — add relevant tags.
   - **Product Goal** — the active goal the item serves.
4. Click **Create**. The item is appended to the end of the backlog in `New` status.

### Write the item well

Use the user-story format:

```
As a [type of user],
I want [some goal],
So that [some reason].
```

Define acceptance criteria with Given-When-Then:

```
Given [initial context],
When [action occurs],
Then [expected outcome].
```

**Example:**

```
Given I am a logged-in user on the product page,
When I click "Add to Wishlist",
Then the product appears in my wishlist,
And I see a confirmation message.
```

### Refine the item

Refinement is ongoing work, not a phase:

1. **Add details** — clarify acceptance criteria, add technical notes and references.
2. **Estimate** — assign story points, using planning poker with the team; re-estimate if scope
   changes.
3. **Re-order and re-band** — move the item to a different position and confirm its MoSCoW band still
   describes it.
4. **Split large items** — anything above 13 points should be split, and each part should still
   deliver value.

### Bulk upload

1. Click **Bulk Upload** and download the CSV template.
2. Fill in the items:

   ```csv
   Title,Description,Priority,StoryPoints,Labels
   "User login","As a user, I want to log in...","MUST_HAVE",5,"frontend,auth"
   "Password reset","As a user, I want to reset...","MUST_HAVE",3,"frontend,auth"
   ```

3. Upload the completed file, review the preview and confirm the import.

### Bulk edit

Select multiple items to add or remove labels, assign them to a Sprint (Ready items only), change
their status, or link them to a Product Goal. Changing the MoSCoW band is a Product Owner action, so
it is not offered as a bulk operation.

### Views and filtering

- **List view** — a table in the backlog order, with a **Position** column that numbers the items and
  holds the ▲/▼ move controls. Best for overview, bulk operations and reordering without a mouse.
- **Board view** — columns for the four MoSCoW bands, each column in the backlog order. Best for
  seeing the shape of the backlog and ordering it by hand.

Filter by priority, status, labels, Product Goal, Sprint or assignee. Filtering and searching narrow
what is shown **without changing the order**: the stored order is always the order of record, in both
views.

### Move an item through its life

- **Drag and drop** (Product Owner) — set the position, and/or move the item into another MoSCoW
  band.
- **Position controls** (Product Owner) — the ▲/▼ buttons move an item one place.
- **Status change** (any team member) — move the item through the workflow.
- **Sprint assignment** — add an item to a Sprint once it is Ready.

---

## Gates and Enforcement

| Refusal                                                    | What it means                                                                 | What to do                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| _Only the Product Owner may order the Product Backlog_     | Someone other than the Product Owner tried to move an item or change its band | Ask the Product Owner to make the change                      |
| _The Product Backlog needs an active Product Goal_         | No Product Goal is `Active`, so a new item has nothing to serve               | Activate a Product Goal before adding items                   |
| _An item must be Ready to enter a Sprint_                  | The selected item is still `New` or `Refined`                                 | Refine it and record the readiness criteria as verified       |
| _Nothing is Done until the Definition of Done is verified_ | The item's Done criteria have not all been verified                           | Verify every active Definition of Done criterion for the item |

---

## Best Practices

### Backlog health

A healthy backlog is:

- **DEEP** — Detailed appropriately, Estimated, Emergent, Prioritised.
- **Ordered** — the top of the list is genuinely the next work, not just the highest band.
- **Refined** — the top items are ready for a Sprint.
- **Sized** — items are appropriately estimated.
- **Valuable** — every item delivers clear value.

### Regular activities

- **Daily** — update item status as work progresses; log Impediments blocking items.
- **Weekly (refinement)** — review and refine upcoming items, add acceptance criteria, estimate new
  items and re-prioritise based on learning.
- **Per Sprint** — review items not completed, update priorities from Sprint Review feedback, and add
  new items from stakeholder input.

### Common mistakes

| Mistake                           | Impact                       | Solution                         |
| --------------------------------- | ---------------------------- | -------------------------------- |
| Too many "Must Have" items        | Everything is a priority     | Be ruthless in prioritisation    |
| Leaving everything in one band    | Nothing says what is next    | Order the items inside the band  |
| No acceptance criteria            | Unclear when done            | Always include criteria          |
| Items too large                   | Cannot complete in a Sprint  | Split into smaller items         |
| Not refining regularly            | Sprint Planning takes longer | Schedule regular refinement      |
| Planning items that are not Ready | Sprint Planning is refused   | Refine to Ready before selecting |
| Ignoring technical debt           | The system degrades          | Include technical items          |

### Example backlog

| Title               | Priority    | Points | Status      | Labels           |
| ------------------- | ----------- | ------ | ----------- | ---------------- |
| User authentication | Must Have   | 8      | Done        | auth, security   |
| Password reset      | Must Have   | 3      | Done        | auth             |
| User profile page   | Should Have | 5      | In Progress | frontend         |
| Email notifications | Should Have | 5      | Ready       | backend          |
| Dark mode           | Could Have  | 3      | Ready       | frontend, polish |
| Social login        | Could Have  | 8      | New         | auth             |
| Export to PDF       | Won't Have  | 5      | New         | feature          |

---

## Related Topics

- [Product Goal](./product-goal.md) — the commitment the backlog serves
- [Sprint Planning](./sprint-planning.md) — where Ready items are selected
- [Sprint Board](./sprint-board.md) — where items are taken to Done
- [Increment](./increment.md) — what the Done items become
