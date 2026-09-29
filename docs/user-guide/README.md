# Scrumooth User Guide

Welcome to the Scrumooth User Guide. Scrumooth is the self-hosted **Scrum Guide enforcement layer**: the rules of the 2020 Scrum Guide are enforced server-side, so a Sprint cannot be closed before its Review and its Sprint Retrospective, only Developers size the work, and "Done" means the Definition of Done has been met.

> **Judge a Scrum tool by the rules it keeps, not by the boards it draws.**

---

## About This Guide

This guide covers how to use Scrumooth, from creating your account to running a full Sprint.

- **What Scrumooth is, and why it is built this way:** [The Manifesto](../../README.md#the-manifesto)
- **Everything Scrumooth enforces:** [What Scrumooth Enforces](../../README.md#what-scrumooth-enforces)
- **The complete feature list:** [Features](../../README.md#features)
- **Scrum itself — its events, roles and artifacts:** the [2020 Scrum Guide](https://scrumguides.org/)

### Who Should Use This Guide?

This guide is designed for all Scrumooth users:

| Role               | Start with                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product Owners** | [Getting Started](./getting-started/README.md), [Product Goal](./core-features/product-goal.md), [Product Backlog](./core-features/product-backlog.md)                                                              |
| **Scrum Masters**  | [Getting Started](./getting-started/README.md), [Sprint Planning](./core-features/sprint-planning.md), [Impediment](./core-features/impediment.md), [Sprint Retrospective](./core-features/sprint-retrospective.md) |
| **Developers**     | [Getting Started](./getting-started/README.md), [Sprint Board](./core-features/sprint-board.md), [Daily Scrum](./core-features/daily-scrum.md), [Increment](./core-features/increment.md)                           |

---

## Documentation Structure

```
user-guide/
├── README.md                    # This file - Overview and navigation
├── getting-started/             # New user onboarding
│   └── README.md                # Step-by-step setup guide
└── core-features/               # Feature-specific guides
    ├── README.md                # Feature overview
    ├── product-goal.md          # Product Goal guide
    ├── product-backlog.md       # Product Backlog guide
    ├── sprint-planning.md       # Sprint Planning guide
    ├── sprint-board.md          # Sprint Board (Kanban) guide
    ├── daily-scrum.md           # Daily Scrum guide
    ├── impediment.md            # Impediment guide
    ├── increment.md             # Increment guide
    ├── sprint-review.md         # Sprint Review guide
    └── sprint-retrospective.md  # Sprint Retrospective guide
```

---

## Quick Navigation

### I'm New to Scrumooth

**Start here**: [Getting Started Guide](./getting-started/README.md)

1. [Create your account](./getting-started/README.md#step-1-account-registration)
2. [Set up your team](./getting-started/README.md#step-2-team-setup)
3. [Create your first Product Goal](./getting-started/README.md#step-3-create-your-first-product-goal)
4. [Add Product Backlog items](./getting-started/README.md#step-4-add-backlog-items)
5. [Plan your first Sprint](./getting-started/README.md#step-5-plan-your-first-sprint)

### I Need Help with a Specific Feature

| Feature              | Guide                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| Product Goal         | [Product Goal Guide](./core-features/product-goal.md)                 |
| Product Backlog      | [Product Backlog Guide](./core-features/product-backlog.md)           |
| Sprint Planning      | [Sprint Planning Guide](./core-features/sprint-planning.md)           |
| Sprint Board         | [Sprint Board Guide](./core-features/sprint-board.md)                 |
| Daily Scrum          | [Daily Scrum Guide](./core-features/daily-scrum.md)                   |
| Impediment           | [Impediment Guide](./core-features/impediment.md)                     |
| Increment            | [Increment Guide](./core-features/increment.md)                       |
| Sprint Review        | [Sprint Review Guide](./core-features/sprint-review.md)               |
| Sprint Retrospective | [Sprint Retrospective Guide](./core-features/sprint-retrospective.md) |

---

## Scrum Roles in Scrumooth

A team holds exactly one Product Owner and one Scrum Master, and only Developers size work. What each role may do follows from the 2020 Scrum Guide:

| Role              | What the role may do in Scrumooth                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Product Owner** | Order the Product Backlog and set its MoSCoW band, own the Product Goal, run the Sprint Review, cancel a Sprint                     |
| **Scrum Master**  | Facilitate events, maintain the Definition of Ready, own unassigned Impediments and the escalation notice, keep coaching notes      |
| **Developers**    | Size Product Backlog items, save the Sprint Backlog, execute and update work, author the Daily Scrum, verify and deliver Increments |

Each feature guide names the gates that apply to the actions it describes.

---

## Common Tasks

### Starting a New Sprint

1. Review the [Sprint Planning Guide](./core-features/sprint-planning.md).
2. Ensure Product Backlog items are refined to Ready and estimated.
3. Define a clear Sprint Goal.
4. Select items based on team capacity.
5. Save the Sprint Backlog, start the Sprint and track it on the Sprint Board.

### Daily Work Routine

1. Check the [Sprint Board](./core-features/sprint-board.md) for your tasks.
2. Participate in the [Daily Scrum](./core-features/daily-scrum.md).
3. Update task status as you progress.
4. Raise an [Impediment](./core-features/impediment.md) immediately when something blocks the team.

### Ending a Sprint

1. Complete the work and verify the Definition of Done for each item.
2. Compose and deliver the [Increment](./core-features/increment.md).
3. Conduct the [Sprint Review](./core-features/sprint-review.md) with stakeholders.
4. Hold the [Sprint Retrospective](./core-features/sprint-retrospective.md) with the team.
5. Document action items for improvement, then plan the next Sprint.

---

## Getting Help

- **In application:** look for help icons (💡), hover field tooltips, and press **?** for keyboard shortcuts.
- **Documentation:** the feature guides above, and the [REST API reference](../api/README.md) for integrations.
- **Issues:** search the [GitHub issue tracker](https://github.com/orbivort/scrumooth/issues) before filing a new report.

---

**Ready to get started?** Head to the [Getting Started Guide](./getting-started/README.md) to begin.
