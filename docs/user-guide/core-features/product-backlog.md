# Product Backlog

The Product Backlog is an ordered list of everything that might be needed in the product. It is the single source of work for the Scrum Team and evolves throughout the product's lifecycle.

## Table of Contents

- [Understanding the Product Backlog](#understanding-the-product-backlog)
- [Backlog Item Components](#backlog-item-components)
- [Ordering the Backlog](#ordering-the-backlog)
- [MoSCoW Prioritization](#moscow-prioritization)
- [Creating Backlog Items](#creating-backlog-items)
- [Managing the Backlog](#managing-the-backlog)
- [Views and Filtering](#views-and-filtering)
- [Bulk Operations](#bulk-operations)
- [Estimation and Story Points](#estimation-and-story-points)
- [Best Practices](#best-practices)

---

## Understanding the Product Backlog

### What is the Product Backlog?

The Product Backlog is:

- **Ordered**: Items have a position, and the Product Owner decides what is next
- **Dynamic**: Constantly evolving based on learning and feedback
- **Detailed Appropriately**: Higher-priority items are more refined
- **Single Source of Truth**: All work comes from the backlog

### Backlog Ownership

| Role              | Responsibility                                                            |
| ----------------- | ------------------------------------------------------------------------- |
| **Product Owner** | Owns the backlog, **orders** it (position and MoSCoW band), ensures value |
| **Developers**    | Size the items, clarify requirements, add technical items                 |
| **Scrum Master**  | Facilitates refinement, removes impediments to backlog management         |

---

## Backlog Item Components

Each backlog item contains several components:

### Required Fields

| Field        | Description             | Example                             |
| ------------ | ----------------------- | ----------------------------------- |
| **Title**    | Brief, descriptive name | "User can reset password via email" |
| **Priority** | MoSCoW classification   | Must Have                           |
| **Status**   | Current workflow state  | Ready                               |

Every item also has a **position** in the backlog order, assigned by the system when the item is created (it is appended to the end) and changed by the Product Owner from there — see [Ordering the Backlog](#ordering-the-backlog).

### Optional Fields

| Field                   | Description                       | When to Use                             |
| ----------------------- | --------------------------------- | --------------------------------------- |
| **Description**         | Detailed requirements and context | Complex items                           |
| **Story Points**        | Effort estimate                   | After team discussion                   |
| **Labels**              | Categorization tags               | For filtering and grouping              |
| **Product Goal**        | Link to strategic objective       | When item supports a goal               |
| **Acceptance Criteria** | Definition of done for this item  | All items (recommended)                 |
| **Business Value**      | Relative value score (numeric)    | For ROI calculations and prioritization |

> **Note**: Business Value is a numeric field that can be used to calculate ROI (Business Value ÷ Story Points) for prioritization decisions. This field is available in the item details but may not be prominently displayed in all views.

---

## Ordering the Backlog

The Product Backlog is an **ordered** list, and ordering it is the Product Owner's accountability. Scrumooth stores that order rather than inferring it.

### What the order is

- Every item has a **position** (its `rank`) in the team's backlog. The list view numbers the rows from the top, so the backlog reads top-to-bottom as "what is next".
- **MoSCoW priority is a categorisation, not the order.** Two Must Haves still have a first and a second. The board groups items into MoSCoW columns, and within each column the items are in the stored order.
- A **new item is appended to the end** of the backlog, so creating one never inserts it into the middle of the Product Owner's sequence.
- **Deleting an item leaves a gap** in the numbering until the next reorder tidies it up; the order itself is unchanged.

### How to change the order

| Action                     | How                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move an item to a position | Drag the card onto another card in the board; drop on the **upper half** to place it before that item, the **lower half** to place it after. The insertion line shows where it will land.       |
| Move an item between bands | Drag the card into another MoSCoW column — the band and the position change together.                                                                                                           |
| Move without a mouse       | In the list view use the ▲/▼ controls in the **Position** column; on the board, focus a card, press **Space** to grab, **←/→** to change the MoSCoW band, **Space** to drop, **Esc** to cancel. |
| Change the MoSCoW band     | The MoSCoW selector in the item's edit dialog.                                                                                                                                                  |

### Who may order

Only the **Product Owner** orders the Product Backlog. Anyone else sees the order as read-only: the position column has no move controls, cards cannot be dragged, and the MoSCoW selector is disabled with an explanation. The rule is enforced by the server as well, so it holds even if the request is made directly against the API — a refusal comes back as `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`.

Everything else about an item stays collaborative: any team member can create, edit, delete and move items through the workflow, and the **Developers** are the only ones who size them.

---

## MoSCoW Prioritization

Scrumooth uses MoSCoW prioritization to help teams focus on what matters most.

### Priority Levels

| Priority        | Color     | Meaning                    | When to Use                                     |
| --------------- | --------- | -------------------------- | ----------------------------------------------- |
| **Must Have**   | 🔴 Red    | Critical for success       | Non-negotiable, without these the product fails |
| **Should Have** | 🟠 Orange | Important but not critical | High value, could be deferred if necessary      |
| **Could Have**  | 🟢 Green  | Nice to have               | Low effort, enhances user experience            |
| **Won't Have**  | ⚪ Gray   | Not this release           | Acknowledged but explicitly out of scope        |

### Prioritization Guidelines

**Must Have Criteria:**

- Without this, the product doesn't solve the core problem
- Legal or compliance requirement
- Critical path for other features
- Contractual obligation

**Should Have Criteria:**

- High business value
- Important for user satisfaction
- Not a critical path dependency
- Could be deferred one sprint if necessary

**Could Have Criteria:**

- Low effort, high delight factor
- "Nice to have" enhancements
- Polish and refinements
- Quick wins

**Won't Have Criteria:**

- Good idea but not now
- Requires more research
- Not aligned with current goals
- Explicitly out of scope for this release

### Example Prioritization

For an e-commerce checkout feature:

| Item                     | Priority    | Rationale                      |
| ------------------------ | ----------- | ------------------------------ |
| Shopping cart            | Must Have   | Core functionality             |
| Payment processing       | Must Have   | Essential for sales            |
| Order confirmation email | Must Have   | Legal requirement              |
| Save cart for later      | Should Have | Reduces abandonment            |
| Apply discount codes     | Should Have | Increases conversion           |
| Gift wrapping option     | Could Have  | Nice to have                   |
| Cryptocurrency payment   | Won't Have  | Not aligned with target market |

---

## Creating Backlog Items

### Step-by-Step

1. **Navigate to Product Backlog**
   - Click "Product Backlog" in the sidebar
   - The backlog page displays

2. **Create New Item**
   - Click "Create Item" or the "+" button
   - The creation modal opens

3. **Fill in Item Details**

   **Title** (Required):
   - Use clear, action-oriented language
   - Start with a verb when appropriate
   - Be specific about what needs to be done

   **Description**:
   - Use the User Story format (see below)
   - Include acceptance criteria
   - Add technical notes if relevant

   **Priority**:
   - Select MoSCoW priority
   - Consider dependencies and value

   **Story Points**:
   - Estimate effort (optional)
   - Use Fibonacci sequence: 1, 2, 3, 5, 8, 13, 21

   **Labels**:
   - Add relevant tags
   - Examples: "frontend", "backend", "bug", "feature", "security"

4. **Save the Item**
   - Click "Create"
   - Item appears in the backlog

### User Story Format

Write items using the user story format:

```
As a [type of user],
I want [some goal],
So that [some reason].
```

**Examples:**

```
As a customer,
I want to save items to a wishlist,
So that I can purchase them later.
```

```
As a Product Owner,
I want to view audit logs,
So that I can investigate security incidents.
```

### Acceptance Criteria

Define clear acceptance criteria using Given-When-Then format:

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

---

## Managing the Backlog

### Item Statuses

Backlog items progress through these states:

| Status          | Meaning                                | Next Step                  |
| --------------- | -------------------------------------- | -------------------------- |
| **New**         | Just created, needs refinement         | Add details, estimate      |
| **Refined**     | Details added, needs final preparation | Verify readiness           |
| **Ready**       | Refined and ready for sprint           | Include in sprint planning |
| **In Progress** | Currently being worked on              | Complete the work          |
| **Done**        | Completed and verified                 | Potentially release        |

> **Note**: If an item is blocked by an impediment, track it using the Impediments feature rather than a status change.

> **Ready is a gate, not a label**: an item must be refined to **Ready** before it can enter a Sprint. Adding a New or Refined item to a Sprint is refused — at Sprint Planning, when the Sprint starts, and when the item is added to an active Sprint — with a message naming the items that are not ready yet.

### Refining Items

Backlog refinement (formerly "grooming") is an ongoing activity:

1. **Add Details**
   - Clarify acceptance criteria
   - Add technical specifications
   - Include design mockups or references

2. **Estimate**
   - Assign story points
   - Use planning poker with the team
   - Re-estimate if scope changes

3. **Re-order and re-band**
   - Move an item to a different position based on new information
   - Confirm its MoSCoW band still describes it
   - Align with the Product Goal

4. **Split Large Items**
   - Items > 13 points should be split
   - Each part should deliver value
   - Maintain clear acceptance criteria

### Moving Items

- **Drag and Drop** (Product Owner): move an item to a position in the order, and/or into another MoSCoW band — see [Ordering the Backlog](#ordering-the-backlog)
- **Position controls** (Product Owner): the ▲/▼ buttons in the list view's Position column move an item one place
- **Status Change**: move items through the workflow (any team member)
- **Sprint Assignment**: add an item to a Sprint once it is Ready

---

## Views and Filtering

### Available Views

Scrumooth provides multiple views for the backlog:

#### List View

- Traditional list format, in the backlog order
- A **Position** column numbers the items top-to-bottom and holds the ▲/▼ move controls (Product Owner)
- Shows all items in a table with their status, band, value, estimate and labels
- Best for: overview, bulk operations, and reordering without a mouse

#### Board View

- Columns for the four MoSCoW bands, with each column in the backlog order
- Drag a card onto another card to set its position (drop on the upper half for before, the lower half for after); drag into another column to change the band as well
- Best for: seeing the shape of the backlog and ordering it by hand

### Filtering Options

Filter the backlog by:

| Filter           | Options                       |
| ---------------- | ----------------------------- |
| **Priority**     | Must, Should, Could, Won't    |
| **Status**       | New, Ready, In Progress, etc. |
| **Labels**       | Any assigned label            |
| **Product Goal** | Linked goal                   |
| **Sprint**       | Assigned sprint               |
| **Assignee**     | Team member                   |

### Order

The backlog is shown in **the order the Product Owner set**, not sorted by an attribute:

- The stored order (each item's position) is always the order of record, in both views.
- The MoSCoW band groups the board's columns; within a column the position still decides the sequence.
- Filtering and searching narrow what is shown without changing the order.
- Changing the order is the Product Owner's decision — see [Ordering the Backlog](#ordering-the-backlog).

---

## Bulk Operations

### Bulk Upload

Import multiple items at once:

1. Click "Bulk Upload" button
2. Download the CSV template
3. Fill in your items following the format:

   ```csv
   Title,Description,Priority,StoryPoints,Labels
   "User login","As a user, I want to log in...","MUST_HAVE",5,"frontend,auth"
   "Password reset","As a user, I want to reset...","MUST_HAVE",3,"frontend,auth"
   ```

4. Upload the completed CSV
5. Preview and confirm import

### Bulk Edit

Select multiple items to:

- Add/remove labels
- Assign to sprint (Ready items only)
- Change status
- Link to product goal

Changing the MoSCoW band of an item is a Product Owner action, so it is not offered as a bulk operation.

---

## Estimation and Story Points

### Story Point Scale

Scrumooth uses the Fibonacci sequence as the recommended scale for estimation:

| Points | Complexity      | Example                           |
| ------ | --------------- | --------------------------------- |
| **1**  | Trivial         | Fix typo, update config           |
| **2**  | Simple          | Add form field, simple query      |
| **3**  | Straightforward | New page, basic feature           |
| **5**  | Moderate        | Complex form, integration         |
| **8**  | Complex         | New module, significant feature   |
| **13** | Very Complex    | Major feature, consider splitting |
| **21** | Epic            | Too large, should be split        |

> **Note**: While the Fibonacci sequence (1, 2, 3, 5, 8, 13, 21) is recommended and commonly used, the system accepts any numeric value between 1 and 100. Teams can choose to enforce Fibonacci during planning poker discussions, but the system provides flexibility for teams that use alternative estimation scales.

### Estimation Best Practices

1. **Use Planning Poker**
   - Team estimates together
   - Discuss differences
   - Reach consensus

2. **Relative Sizing**
   - Compare to known items
   - "Is this bigger or smaller than X?"
   - Build a baseline of reference stories

3. **Re-estimate When Needed**
   - If understanding changes
   - After partial implementation
   - Don't be afraid to adjust

---

## Best Practices

### Backlog Health

A healthy backlog is:

- **DEEP**: Detailed appropriately, Estimated, Emergent, Prioritized
- **Ordered**: The top of the list is genuinely the next work, not just the highest band
- **Refined**: Top items are ready for sprint
- **Sized**: Items are appropriately estimated
- **Valuable**: Items deliver clear value

### Regular Activities

**Daily:**

- Update item status as work progresses
- Log impediments blocking items

**Weekly (Refinement):**

- Review and refine upcoming items
- Add acceptance criteria
- Estimate new items
- Re-prioritize based on learning

**Per Sprint:**

- Review items not completed
- Update priorities based on sprint review feedback
- Add new items from stakeholder input

### Common Mistakes to Avoid

| Mistake                           | Impact                       | Solution                         |
| --------------------------------- | ---------------------------- | -------------------------------- |
| Too many "Must Have" items        | Everything is priority       | Be ruthless in prioritization    |
| Leaving everything in one band    | Nothing says what is next    | Order the items inside the band  |
| No acceptance criteria            | Unclear when done            | Always include criteria          |
| Items too large                   | Cannot complete in sprint    | Split into smaller items         |
| Not refining regularly            | Sprint planning takes longer | Schedule regular refinement      |
| Planning items that are not Ready | Sprint Planning is refused   | Refine to Ready before selecting |
| Ignoring technical debt           | System degrades              | Include technical items          |

---

## Example Backlog

Here's an example of a well-structured backlog:

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

**Related Topics**:

- [Product Goals](./product-goals.md) - Link items to strategic objectives
- [Sprint Planning](./sprint-planning.md) - Select items for sprint
- [Sprint Board](./sprint-board.md) - Track item progress during sprint
