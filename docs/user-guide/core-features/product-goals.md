# Product Goals

Product Goals provide strategic direction for your product development. They represent the long-term objectives that guide the creation of Product Backlog items and help align the team's work with business value.

## Table of Contents

- [What is a Product Goal?](#what-is-a-product-goal)
- [Creating Product Goals](#creating-product-goals)
- [Managing Goals](#managing-goals)
- [Linking to Backlog Items](#linking-to-backlog-items)
- [Tracking Progress](#tracking-progress)
- [Best Practices](#best-practices)

---

## What is a Product Goal?

A Product Goal describes a future state of the product that provides value to customers and stakeholders. It:

- **Provides Focus**: Gives the Scrum Team a clear direction
- **Guides Prioritization**: Helps decide which backlog items to work on
- **Measures Progress**: Shows how far the product has come
- **Aligns Stakeholders**: Creates shared understanding of objectives

### Product Goal vs. Sprint Goal

| Aspect          | Product Goal                      | Sprint Goal             |
| --------------- | --------------------------------- | ----------------------- |
| **Timeframe**   | Long-term (multiple sprints)      | Short-term (one sprint) |
| **Scope**       | Strategic objective               | Tactical focus          |
| **Ownership**   | Product Owner                     | Entire Scrum Team       |
| **Flexibility** | Can be adjusted based on learning | Fixed for the sprint    |

---

## Creating Product Goals

### Step-by-Step

> **Note**: Creating, editing, and deleting a Product Goal is a **Product Owner** action. The
> Product Owner is accountable for developing and explicitly communicating the Product Goal.
> Every team member can still view goals, their progress, and their status history.

1. **Navigate to Product Goals**
   - Click "Product Goals" in the sidebar
   - The goals page displays existing goals

2. **Create New Goal**
   - Click the "Create Goal" button (or "+" icon)
   - The goal creation modal opens

3. **Fill in Goal Details**

   | Field                   | Required | Description                           |
   | ----------------------- | -------- | ------------------------------------- |
   | **Title**               | Yes      | Clear, concise name for the goal      |
   | **Description**         | No       | Detailed explanation of the goal      |
   | **Target Date**         | No       | When you aim to achieve this goal     |
   | **Success Metrics**     | No       | How you'll measure success            |
   | **Strategic Alignment** | No       | How this connects to company strategy |

4. **Save the Goal**
   - Click "Create" to save
   - The goal appears in the list with "New" status

### Example Goals

**Good Example:**

```
Title: Launch Customer Self-Service Portal
Description: Enable customers to manage their accounts, view invoices,
             and submit support requests without contacting support.
Target Date: Q3 2026
Success Metrics:
  - 50% reduction in support calls
  - 10,000 monthly active users
  - Customer satisfaction score > 4.0
Strategic Alignment: Supports company goal of reducing operational costs
```

**Avoid:**

```
Title: Improve the product
Description: Make it better
(Too vague, not measurable)
```

---

## Managing Goals

### Goal Statuses

Product goals progress through these states:

| Status        | When to Use                               | Actions Available       |
| ------------- | ----------------------------------------- | ----------------------- |
| **New**       | Goal is defined but work hasn't started   | Edit, Activate, Delete  |
| **Active**    | Team is actively working toward this goal | Edit, Complete, Abandon |
| **Completed** | Goal has been successfully completed      | View                    |
| **Abandoned** | Goal is no longer being pursued           | View                    |

> **Note**: `Completed` and `Abandoned` are terminal states — a goal cannot be reactivated. To
> pursue the objective again, create a new goal.

### Changing Goal Status

Only the Product Owner can change a goal's status.

1. **Activate a Goal**
   - Click on the goal to view details
   - Click "Activate" or change status to "Active"
   - Only one goal can be active at a time — fulfil or abandon the active goal first

2. **Complete a Goal**
   - When success metrics are met
   - Click "Complete" or change status to "Completed"
   - Document the outcome

3. **Abandon a Goal**
   - If circumstances change or goal is no longer relevant
   - Click "Abandon"
   - This helps maintain history for future reference

### Editing Goals

1. Click on the goal to open details
2. Click "Edit" button
3. Modify fields as needed
4. Click "Save"

> **Note**: Be cautious about changing active goals significantly. Consider the impact on ongoing sprint work.

---

## Linking to Backlog Items

Product goals provide context for backlog items. Linking them helps the team understand how individual work items contribute to larger objectives.

### How to Link

1. **From Backlog Item**:
   - When creating or editing a backlog item
   - Select a Product Goal from the dropdown
   - The item now shows the goal relationship

2. **From Product Goal**:
   - View goal details
   - See all linked backlog items
   - Track progress based on item completion

### Benefits of Linking

- **Traceability**: See how work connects to strategy
- **Prioritization**: Focus on items that advance goals
- **Progress Tracking**: Measure goal progress by completed items
- **Communication**: Help stakeholders understand the roadmap

---

## Tracking Progress

### Progress Indicators

Scrumooth provides several ways to track goal progress:

1. **Linked Items Progress**
   - View all backlog items linked to the goal
   - See completion status of each item
   - Overall progress percentage calculated automatically

2. **Sprint Progress**
   - See which sprints have contributed to the goal
   - Track velocity toward goal completion

3. **Timeline View**
   - Target date shows on timeline
   - Visual indicator of progress vs. timeline

### Progress Bar

The goal progress bar shows:

- **Green**: Completed items
- **Blue**: In-progress items
- **Gray**: Not started items

---

## Best Practices

### Writing Effective Goals

1. **Be Specific and Measurable**

   ```
   ❌ "Improve user experience"
   ✅ "Reduce average task completion time by 30%"
   ```

2. **Use Time-Bound Targets**

   ```
   ❌ "Eventually support mobile"
   ✅ "Launch iOS app by Q2 2026"
   ```

3. **Align with Business Value**
   - Connect goals to company objectives
   - Ensure stakeholders understand the value
   - Document the "why" behind each goal

4. **Limit Active Goals**
   - Focus on one active goal at a time
   - The team must fulfil or abandon an objective before taking on the next
   - Complete goals before starting new ones

### Goal Management

1. **Regular Review**
   - Review goals in Sprint Review
   - Assess progress toward success metrics
   - Adjust based on learning

2. **Stakeholder Communication**
   - Share goal progress with stakeholders
   - Use goals to communicate roadmap
   - Get feedback on goal priorities

3. **Flexibility**
   - Be willing to adapt goals based on learning
   - Don't treat goals as fixed contracts
   - Document reasons for changes

### Common Mistakes to Avoid

| Mistake                     | Better Approach                      |
| --------------------------- | ------------------------------------ |
| Too many active goals       | Focus on one active goal at a time   |
| Vague success metrics       | Define specific, measurable outcomes |
| Never updating goals        | Review and adjust each sprint        |
| Goals without backlog items | Ensure goals have supporting work    |
| Ignoring stakeholder input  | Regularly validate with stakeholders |

---

## Example Workflow

### Scenario: E-commerce Platform

**Goal 1: Launch MVP** (Completed)

```
Title: Launch E-commerce MVP
Target Date: Q1 2026
Success Metrics:
  - Product catalog functional
  - Checkout process complete
  - 100 beta users
Status: Completed
```

**Goal 2: Scale Operations** (Active)

```
Title: Scale to 10,000 Daily Users
Target Date: Q2 2026
Success Metrics:
  - Handle 10,000 concurrent users
  - Page load time < 2 seconds
  - 99.9% uptime
Status: Active
```

**Goal 3: Mobile Experience** (New)

```
Title: Launch Mobile Apps
Target Date: Q3 2026
Success Metrics:
  - iOS and Android apps in app stores
  - 4.5+ star rating
  - 50% of orders from mobile
Status: New
```

---

**Related Topics**:

- [Product Backlog](./product-backlog.md) - Create items that support your goals
- [Sprint Planning](./sprint-planning.md) - Plan sprints aligned with goals
- [Sprint Review](./sprint-review.md) - Review progress toward goals
