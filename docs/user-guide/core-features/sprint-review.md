# Sprint Review

The Sprint Review is held at the end of the Sprint to inspect the Increment and adapt the Product Backlog if needed.

## Table of Contents

- [Overview](#overview)
- [Before the Review](#before-the-review)
- [Conducting the Review](#conducting-the-review)
- [Demonstrating Work](#demonstrating-work)
- [Gathering Feedback](#gathering-feedback)
- [Backlog Adjustments](#backlog-adjustments)
- [Review Documentation](#review-documentation)
- [Best Practices](#best-practices)

---

## Overview

### Purpose of Sprint Review

The Sprint Review is used to:

1. **Inspect** the Product Increment delivered
2. **Demonstrate** completed work to stakeholders
3. **Collaborate** on what to do next
4. **Adapt** the Product Backlog based on feedback

### What It Is NOT

The Sprint Review is **not**:

- A "sign-off" meeting
- A presentation only
- A status meeting
- A gate to pass

> **Note**: "Not a gate" describes the Review's nature — a collaborative working session, not an approval checkpoint for the Increment. It does not mean the Review is optional in Scrumooth: the Sprint cannot be closed until the Sprint Review has been recorded.

### Key Characteristics

| Aspect           | Guideline                           |
| ---------------- | ----------------------------------- |
| **Duration**     | Maximum 2 hours for 2-week sprint   |
| **Participants** | Scrum Team + Stakeholders           |
| **Focus**        | Increment inspection and adaptation |
| **Outcome**      | Updated Product Backlog             |

---

## Before the Review

### Preparation Checklist

**Developers:**

- [ ] All "Done" items are ready to demonstrate
- [ ] Demo environment is prepared
- [ ] Demo script/story is clear
- [ ] Technical issues resolved

**Product Owner:**

- [ ] Stakeholders invited
- [ ] Sprint Goal reviewed
- [ ] Backlog items prepared for discussion
- [ ] Next sprint priorities identified

**Scrum Master:**

- [ ] Meeting scheduled and room prepared
- [ ] Stakeholders confirmed attendance
- [ ] Previous review notes available

### Items to Demonstrate

Prepare demonstrations for:

- Completed backlog items (meeting DoD)
- New features
- Bug fixes
- Technical improvements (if relevant to stakeholders)

### Items NOT to Demonstrate

Don't demonstrate:

- Incomplete items
- Items not meeting DoD
- Internal refactoring (unless relevant)
- Work in progress

---

## Conducting the Review

### Accessing Sprint Review

1. Navigate to "Sprint Review" in the sidebar
2. Select the completed sprint
3. The review interface displays

### Review Agenda

A typical Sprint Review follows this structure:

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

### Creating a Sprint Review Record

1. Click "Create Sprint Review"
2. Fill in basic details:
   - **Sprint**: Select the completed sprint
   - **Date**: Review date
   - **Facilitator**: Usually Scrum Master
   - **Attendees**: Add participants

3. Save to create the review record

---

## Demonstrating Work

### Demo Best Practices

**Preparation:**

- Test the demo beforehand
- Have a backup plan if demo fails
- Prepare demo data
- Know the acceptance criteria

**During Demo:**

- Start with the Sprint Goal
- Show the user journey
- Let stakeholders try it
- Answer questions

**Demo Script Example:**

```
1. Introduction
   "Today we'll show the user authentication features
    we completed this sprint."

2. Demo Flow
   "First, let me show the new registration flow..."
   [Demonstrate registration]

   "Now, here's the password reset feature..."
   [Demonstrate password reset]

3. Stakeholder Participation
   "Would you like to try the registration yourself?"

4. Q&A
   "Any questions about what you've seen?"
```

### Handling Demo Issues

If the demo doesn't work:

- Stay calm
- Explain what it should do
- Show screenshots/video if available
- Note it as an impediment to fix
- Move to next item

---

## Gathering Feedback

### Feedback Collection

During and after demonstrations:

1. **Encourage Questions**
   - "What do you think?"
   - "Does this meet your needs?"
   - "Any concerns?"

2. **Document Feedback**
   - Note all comments
   - Capture who said what
   - Record suggestions

3. **Clarify Understanding**
   - Repeat back what you heard
   - Ask follow-up questions
   - Ensure alignment

### Feedback Types

| Type               | Example                          | Action                           |
| ------------------ | -------------------------------- | -------------------------------- |
| **Positive**       | "This is exactly what we needed" | Note for team morale             |
| **Change Request** | "Can we also add...?"            | Add to backlog                   |
| **Concern**        | "This might confuse users"       | Discuss, may create item         |
| **New Idea**       | "What if we could...?"           | Add to backlog for consideration |
| **Priority Shift** | "We need X sooner than Y"        | Re-prioritize backlog            |

### Recording Feedback

In the Sprint Review interface:

1. Click "Add Feedback"
2. Enter details:
   - **From**: Who provided the feedback
   - **Content**: The feedback itself
   - **Type**: Suggestion, concern, change request, etc.
   - **Action**: What to do with it

3. Save the feedback

---

## Backlog Adjustments

### Why Adjust the Backlog?

Based on review feedback, you might:

- Add new items
- Remove items no longer needed
- Re-prioritize existing items
- Update item descriptions
- Change release plans

### Making Adjustments

1. **During the Review**:
   - Discuss proposed changes
   - Get stakeholder agreement
   - Note changes to make

2. **After the Review**:
   - Navigate to Product Backlog
   - Make agreed adjustments:
     - Add new items
     - Update priorities
     - Modify descriptions

3. **Document Changes**:
   - In the review record
   - Note rationale for changes

### Backlog Adjustment Example

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

---

## Review Documentation

### Creating Review Notes

Document the review for future reference:

1. **Sprint Summary**
   - What was planned vs. delivered
   - Sprint Goal achievement
   - Key metrics (velocity, etc.)

2. **Demonstration Notes**
   - What was shown
   - How it was received
   - Any issues during demo

3. **Feedback Summary**
   - All feedback collected
   - Action items from feedback
   - Who is responsible

4. **Backlog Changes**
   - Items added/removed/changed
   - Rationale for changes

### Review Record Fields

| Field                   | Description                                                                    |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Sprint**              | Which sprint was reviewed                                                      |
| **Date**                | When the review occurred                                                       |
| **Attendees**           | Who participated (tracked with name, email, role, attendance status)           |
| **Summary**             | Overall outcome including items demonstrated and next steps                    |
| **Feedback**            | Stakeholder input (categorized as Positive, Negative, Suggestion, or Question) |
| **Backlog Adjustments** | Changes made to the backlog based on review                                    |

> **Note**: Details about items demonstrated and next steps should be captured in the **Summary** field. The Increment delivered during the sprint is automatically linked to the review record.

---

## Best Practices

### For Product Owners

**Before:**

- Invite relevant stakeholders
- Prepare the agenda
- Know what was delivered

**During:**

- Facilitate stakeholder engagement
- Capture feedback
- Guide backlog discussions

**After:**

- Update the backlog
- Communicate changes to stakeholders
- Prepare for next sprint

### For Developers

**Before:**

- Prepare demos
- Test the demo environment
- Know the acceptance criteria

**During:**

- Demonstrate confidently
- Answer technical questions
- Listen to feedback

**After:**

- Incorporate feedback
- Celebrate achievements

### For Stakeholders

**Your Role:**

- Attend and participate actively
- Provide constructive feedback
- Ask questions
- Collaborate on priorities

**Tips:**

- Come prepared with questions
- Focus on value, not implementation
- Be specific in feedback
- Understand constraints

---

## Common Mistakes to Avoid

| Mistake                 | Impact                 | Solution                      |
| ----------------------- | ---------------------- | ----------------------------- |
| No stakeholders         | Missed feedback        | Invite and confirm attendance |
| Demo-only format        | No collaboration       | Encourage discussion          |
| Showing incomplete work | False expectations     | Only show "Done" items        |
| No backlog updates      | Wasted feedback        | Act on feedback immediately   |
| Too long                | Stakeholders disengage | Stay within time box          |

---

## Example Sprint Review

### Scenario: E-commerce Team

**Sprint 5 Review**

**Attendees:**

- Scrum Team (5)
- Product Manager
- Marketing Lead
- Customer Support Lead

**Sprint Goal:** "Enable customers to save items for later purchase"

**Delivered:**

- ✅ Save to wishlist
- ✅ View wishlist
- ✅ Remove from wishlist
- ✅ Wishlist count badge
- ✅ Move to cart
- ❌ Share wishlist (not completed)

**Demonstration:**

1. Showed adding items to wishlist from product page
2. Demonstrated wishlist management page
3. Let stakeholders try the feature
4. Showed wishlist badge in header

**Feedback:**

- Marketing: "Love it! Can we add social sharing?"
- Support: "Users will want to create multiple wishlists"
- PM: "Move to cart is smooth, good UX"

**Backlog Adjustments:**

- Added: "Share wishlist" (re-prioritized to Must Have)
- Added: "Multiple wishlists" (Should Have)
- Added: "Wishlist analytics" (Could Have)

**Next Sprint Preview:**

- Payment integration
- Share wishlist (carry over)

---

**Related Topics**:

- [Sprint Planning](./sprint-planning.md) - Plan the next sprint
- [Retrospectives](./retrospectives.md) - Improve the process
- [Product Backlog](./product-backlog.md) - Manage work items
