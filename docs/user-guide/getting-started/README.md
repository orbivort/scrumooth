# Getting Started with Scrumooth

Welcome to Scrumooth, the self-hosted Scrum Guide enforcement layer. This guide will walk you through everything you need to know to get started, from creating your account to planning your first sprint.

## Table of Contents

- [What is Scrumooth?](#what-is-scrumooth)
- [Quick Start Overview](#quick-start-overview)
- [Step 1: Account Registration](#step-1-account-registration)
- [Step 2: Team Setup](#step-2-team-setup)
- [Step 3: Create Your First Product Goal](#step-3-create-your-first-product-goal)
- [Step 4: Add Backlog Items](#step-4-add-backlog-items)
- [Step 5: Plan Your First Sprint](#step-5-plan-your-first-sprint)
- [Next Steps](#next-steps)

---

## What is Scrumooth?

Scrumooth is a self-hosted, open-source web application for teams that run Scrum. It turns the rules of the 2020 Scrum Guide into gates the backend enforces — a Sprint cannot be closed before its Review and its Retrospective, only Developers size the work, and "Done" means the Definition of Done has been met. It provides tools for:

- **Product Goals** - Define and track strategic objectives
- **Product Backlog** - Manage and prioritize work items
- **Sprint Planning** - Plan iterations with capacity management
- **Sprint Execution** - Track progress with Kanban boards
- **Daily Scrum** - Coordinate daily standups
- **Sprint Reviews** - Gather feedback and demonstrate work
- **Retrospectives** - Reflect and improve processes

### Who Should Use This Guide?

This guide is designed for:

- **Product Owners** - Who will manage the product backlog and goals
- **Scrum Masters** - Who will facilitate ceremonies and remove impediments
- **Developers** - Who will execute the work

---

## Quick Start Overview

Here's the typical workflow to get started with Scrumooth:

```
Register Account → Create Team → Invite Members →
Create Product Goal → Add Backlog Items → Plan Sprint → Execute!
```

**Estimated Time**: 15-30 minutes for initial setup

---

## Step 1: Account Registration

### Creating Your Account

1. **Navigate to the Login Page**
   - Open Scrumooth in your web browser
   - You'll see the login/registration page

2. **Switch to Registration Mode**
   - Click the "Register" or "Sign Up" link/tab
   - The registration form will appear

3. **Fill in Your Details**
   - **First Name**: Your given name
   - **Last Name**: Your family name
   - **Email**: A valid email address (used for notifications and password reset)
   - **Password**: Create a strong password (minimum 12 characters)
     - Password strength indicator will help you create a secure password
     - Include uppercase, lowercase, numbers, and special characters for best security

4. **Accept Terms and Conditions**
   - Check the terms acceptance checkbox
   - You must accept the terms to proceed

5. **Submit Registration**
   - Click the "Register" or "Create Account" button
   - Upon success, you'll be automatically logged in

### Password Requirements

Your password should be:

- At least 12 characters long
- Include a mix of uppercase and lowercase letters
- Include at least one number
- Include at least one special character (!@#$%^&\* etc.)

### Logging In

For subsequent visits:

1. Navigate to the login page
2. Enter your email and password
3. Click "Login"
4. You'll be redirected to your dashboard or team page

### Password Recovery

If you forget your password:

1. Click "Forgot Password" on the login page
2. Enter your registered email address
3. Check your email for a password reset link
4. Click the link and create a new password

> **Note**: Password reset links expire after 1 hour for security.

---

## Step 2: Team Setup

After registration, you'll need to create or join a team. Teams are the fundamental unit of organization in Scrumooth.

### Creating a Team

1. **Navigate to Team Management**
   - After registration, you may be automatically redirected to the team page
   - Or click "Team" in the sidebar navigation

2. **Create New Team**
   - Click the "Create Team" or "New Team" button
   - A team creation modal will appear

3. **Fill in Team Details**
   - **Team Name**: A unique name for your team (e.g., "Product Development Team")
   - **Description** (optional): A brief description of your team's purpose

4. **Save the Team**
   - Click "Create" or "Save"
   - You'll automatically become the team Product Owner

### Inviting Team Members

Once your team is created, invite members to join:

1. **Access Team Management**
   - Go to Settings → Team Management
   - Or navigate to your Team page

2. **Invite Members**
   - Click "Invite Member" or similar button
   - Enter the email address of the person you want to invite
   - Select their role (see roles below)

3. **Member Roles**

   | Role              | Permissions                                                                                                                 |
   | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
   | **Product Owner** | Manage backlog, goals, reviews, team settings, cancel a Sprint                                                              |
   | **Scrum Master**  | Facilitate ceremonies, retrospectives, and own unassigned impediments; notified when one ages past the escalation threshold |
   | **Developers**    | Size work, save the Sprint Backlog, update tasks, author the Daily Scrum                                                    |

4. **Invitation Process**
   - Invited members receive an email with registration instructions
   - They must complete registration to join the team
   - Pending invitations appear in the team management area

### Switching Between Teams

If you're a member of multiple teams:

1. Use the **Team Switcher** in the sidebar or header
2. Select the team you want to work with
3. All data and views update to show the selected team's content

---

## Step 3: Create Your First Product Goal

Product goals provide strategic direction for your team's work. They help align backlog items with business objectives.

### What is a Product Goal?

A Product Goal:

- Describes a future state of the product
- Provides focus for the Scrum Team
- Guides the creation of Product Backlog items
- Can be achieved through multiple Sprints

### Creating a Product Goal

1. **Navigate to Product Goals**
   - Click "Product Goals" in the sidebar navigation
   - The Product Goals page displays

2. **Create New Goal**
   - Click the "Create Goal" or "New Goal" button
   - A goal creation modal appears

3. **Fill in Goal Details**
   - **Title**: A clear, concise name for the goal
     - Example: "Launch Mobile Application MVP"
   - **Description** (optional): Detailed description of what achieving this goal means
   - **Target Date** (optional): When you hope to achieve this goal
   - **Success Metrics** (optional): How you'll measure success
     - Example: "1000 active users within 30 days of launch"
   - **Strategic Alignment** (optional): How this goal aligns with company strategy

4. **Save the Goal**
   - Click "Create" or "Save"
   - The goal appears in your Product Goals list

### Goal Statuses

Product goals progress through these states:

| Status        | Meaning                                 |
| ------------- | --------------------------------------- |
| **New**       | Goal is defined but work hasn't started |
| **Active**    | Actively working toward this goal       |
| **Completed** | Goal has been successfully achieved     |
| **Abandoned** | Goal is no longer being pursued         |

### Tips for Effective Goals

- **Be Specific**: "Increase user engagement" is vague; "Increase daily active users by 25%" is specific
- **Be Measurable**: Include metrics that indicate success
- **Be Realistic**: Set achievable targets within reasonable timeframes
- **Limit Active Goals**: Focus on 1-3 active goals at a time to maintain focus

---

## Step 4: Add Backlog Items

The Product Backlog is an ordered list of everything needed in the product. It's the single source of work for the Scrum Team.

### Understanding Backlog Items

Each backlog item contains:

- **Title**: Brief description of the work
- **Description**: Detailed explanation and acceptance criteria
- **Priority**: MoSCoW classification (Must/Should/Could/Won't have)
- **Story Points**: Estimate of effort (using Fibonacci: 1, 2, 3, 5, 8, 13, 21)
- **Labels**: Tags for categorization (e.g., "frontend", "bug", "feature")
- **Status**: Current state in the workflow

### MoSCoW Prioritization

Scrumooth uses MoSCoW prioritization to help focus on what matters most:

| Priority        | Meaning                 | When to Use                       |
| --------------- | ----------------------- | --------------------------------- |
| **Must Have**   | Critical for success    | Non-negotiable requirements       |
| **Should Have** | Important but not vital | High-value items that could wait  |
| **Could Have**  | Nice to have            | Low-risk, low-effort enhancements |
| **Won't Have**  | Not in this release     | Acknowledged but deferred         |

### Creating a Backlog Item

1. **Navigate to Product Backlog**
   - Click "Product Backlog" in the sidebar
   - The backlog page displays with list and board views

2. **Create New Item**
   - Click "Create Item" or the "+" button
   - A creation modal appears

3. **Fill in Item Details**
   - **Title**: Clear, concise description
     - Example: "User can reset password via email"
   - **Description**: Detailed requirements
     - Include acceptance criteria
     - Add any technical notes
   - **Priority**: Select MoSCoW priority
   - **Story Points**: Estimate effort (optional, can refine later)
   - **Labels**: Add relevant tags
   - **Product Goal** (optional): Link to a product goal

4. **Save the Item**
   - Click "Create" or "Save"
   - The item appears in your backlog

### Writing Good Backlog Items

**Use User Story Format:**

```
As a [type of user],
I want [some goal],
So that [some reason].
```

**Example:**

```
As a registered user,
I want to reset my password via email,
So that I can regain access if I forget my password.
```

**Include Acceptance Criteria:**

```
Given I am on the login page,
When I click "Forgot Password" and enter my email,
Then I receive a password reset link within 5 minutes.
```

### Bulk Upload

For importing many items at once:

1. Click the "Bulk Upload" button
2. Download the template CSV
3. Fill in your items following the template format
4. Upload the completed CSV file
5. Review the preview and confirm import

---

## Step 5: Plan Your First Sprint

A Sprint is a time-boxed iteration (typically 2-4 weeks) where the team commits to delivering a potentially releasable product increment.

### Sprint Planning Overview

Sprint planning involves:

1. **Defining Sprint Goal**: What the team aims to achieve
2. **Selecting Backlog Items**: Which items to work on
3. **Capacity Planning**: How much work the team can handle
4. **Task Breakdown**: Decomposing items into tasks

### Creating a Sprint

1. **Navigate to Sprint Planning**
   - Click "Sprint Planning" in the sidebar
   - The planning page displays

2. **Start Sprint Creation**
   - Click "Create Sprint" or "Plan Sprint"
   - A sprint planning modal appears

3. **Set Sprint Details**
   - **Sprint Name**: Identifiable name
     - Example: "Sprint 1: User Authentication"
   - **Start Date**: When the sprint begins
   - **End Date**: When the sprint ends (typically 2 weeks from start)
   - **Sprint Goal**: Clear objective for this sprint
     - Example: "Complete user authentication flow including password reset"

4. **Configure Sprint Duration**
   - Sprint length is configurable in Settings → Sprint Configuration
   - Common durations: 1, 2, 3, or 4 weeks
   - Maintain consistent sprint length for predictability

### Selecting Backlog Items

1. **View Available Items**
   - The planning page shows backlog items ready for sprint
   - Items are sorted by priority (Must Have first)

2. **Add Items to Sprint**
   - Drag items from the backlog to the sprint
   - Or click items to add them
   - Watch the capacity indicator

3. **Capacity Planning**
   - Click "Team Capacity" to see available capacity
   - Each team member's availability is shown
   - Total capacity is calculated in story points or hours
   - Don't overcommit - leave buffer for unexpected work

### Starting the Sprint

1. **Review Sprint Backlog**
   - Ensure selected items align with sprint goal
   - Verify total story points fit within capacity
   - Check all items have acceptance criteria

2. **Start Sprint**
   - Click "Start Sprint"
   - Confirm the sprint details
   - The sprint becomes active

3. **Navigate to Sprint Board**
   - After starting, you're redirected to the Sprint Board
   - This is where you'll track daily progress

### Sprint Planning Checklist

Before starting your sprint, verify:

- [ ] Sprint goal is clear and achievable
- [ ] Selected items support the sprint goal
- [ ] Total work fits within team capacity
- [ ] All items have acceptance criteria
- [ ] Dependencies are identified and resolved
- [ ] Team is committed to the sprint goal

---

## Next Steps

Congratulations! You've completed the basic setup. Here's what to do next:

### Daily Activities

1. **Daily Scrum** - Hold daily standups to synchronize the team
   - Navigate to "Daily Scrum" in the sidebar
   - Each member shares: What I did, What I'll do, Blockers

2. **Sprint Board** - Track progress throughout the sprint
   - Use the Kanban board to move items through workflow
   - Update task status as work progresses

3. **Impediments** - Track and resolve blockers
   - Navigate to "Impediments" to log and manage blockers for the active Sprint
   - Set a priority (Critical, High, Medium, Low) and an optional target date, so the Scrum Master knows what to remove first
   - Assign an owner: leave it blank and the impediment defaults to the team's Scrum Master, who is notified
   - Both **Resolved** and **Closed** require written resolution text. An unresolved impediment blocks the Sprint from closing, and the Scrum Master is notified when one ages past the escalation threshold
   - Only the reporter, the owner, or the Scrum Master can delete an impediment, and every impediment is scoped to the team that raised it

### End of Sprint

1. **Sprint Review** - Demonstrate completed work
   - Navigate to "Sprint Review"
   - Record attendees, feedback, and backlog adjustments

2. **Retrospective** - Reflect and improve
   - Navigate to "Retrospectives"
   - Discuss what went well, what to improve, action items

3. **Next Sprint** - Repeat the planning process

### Explore More Features

- **Reports** - View velocity, burndown charts, and metrics
- **Notifications** - Stay updated on team activities
- **Settings** - Configure team definitions, workflow, and more

### Getting Help

- **In-App Help**: Look for help icons (💡) throughout the application
- **Core Features**: Learn more in the [Core Feature Guides](../core-features/README.md)

---

**You're ready to start using Scrumooth!**

Remember: Scrum is about inspection and adaptation. Start simple, inspect frequently, and adapt your process based on what you learn.
