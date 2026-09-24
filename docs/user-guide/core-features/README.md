# Core Feature Guides

This section provides comprehensive guides for all core features of Scrumooth. Each guide explains how to use the feature effectively and includes best practices.

## Feature Overview

| Feature                                 | Purpose                                 | Primary Users               |
| --------------------------------------- | --------------------------------------- | --------------------------- |
| [Product Goals](./product-goals.md)     | Strategic direction and objectives      | Product Owner               |
| [Product Backlog](./product-backlog.md) | Work item management and prioritization | Product Owner, Developers   |
| [Sprint Planning](./sprint-planning.md) | Sprint preparation and commitment       | Scrum Team (facilitated)    |
| [Sprint Board](./sprint-board.md)       | Daily work tracking (Kanban)            | Developers                  |
| [Daily Scrum](./daily-scrum.md)         | Daily synchronization                   | Developers                  |
| [Sprint Review](./sprint-review.md)     | Demonstration and feedback              | Scrum Team + Stakeholders   |
| [Retrospectives](./retrospectives.md)   | Process improvement                     | Scrum Team (facilitated)    |
| [Team Groups](./team-groups.md)         | One Definition of Done for a product    | Product Owner, Scrum Master |

## Scrum Framework in Scrumooth

Scrumooth enforces the Scrum framework as defined in the [2020 Scrum Guide](https://scrumguides.org/):

```
┌──────────────────────────────────────────────────────────────┐
│                    Product Goal                              │
│                         │                                    │
│                         ▼                                    │
│              ┌─────────────────────┐                         │
│              │  Product Backlog    │                         │
│              └─────────────────────┘                         │
│                         │                                    │
│           ┌─────────────┼─────────────┐                      │
│           ▼             ▼             ▼                      │
│      ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│      │ Sprint 1│  │ Sprint 2│  │ Sprint 3│  ...              │
│      └─────────┘  └─────────┘  └─────────┘                   │
│           │             │             │                      │
│           ▼             ▼             ▼                      │
│      ┌─────────┐  ┌─────────┐  ┌─────────┐                   │
│      │Increment│  │Increment│  │Increment│                   │
│      └─────────┘  └─────────┘  └─────────┘                   │
│                         │                                    │
│                         ▼                                    │
│              ┌─────────────────────┐                         │
│              │   Product (Done)    │                         │
│              └─────────────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

## Sprint Lifecycle

Each sprint follows this lifecycle:

```
┌─────────────────────────────────────────────────────────────────┐
│                      SPRINT LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Sprint Planning ──▶ 2. Sprint Execution ──▶ 3. Sprint Review│
│         │                      │                       │        │
│         │                      │                       │        │
│         │                      ▼                       │        │
│         │              Daily Scrum                     │        │
│         │              (each day)                      │        │
│         │                      │                       │        │
│         │                      ▼                       │        │
│         │              Sprint Board                    │        │
│         │              (track progress)                │        │
│         │                                              │        │
│         └──────────────────────────────────────────────┘        │
│                              │                                  │
│                              ▼                                  │
│                    4. Retrospective                             │
│                       (improve)                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Navigation

### For Product Owners

- [Product Goals](./product-goals.md) - Define and track strategic objectives
- [Product Backlog](./product-backlog.md) - Manage and prioritize work
- [Sprint Planning](./sprint-planning.md) - Plan sprints with the team
- [Sprint Review](./sprint-review.md) - Gather stakeholder feedback
- [Team Groups](./team-groups.md) - Hold one Definition of Done across the teams on a product

### For Scrum Masters

- [Sprint Planning](./sprint-planning.md) - Facilitate planning sessions
- [Daily Scrum](./daily-scrum.md) - Run effective daily standups
- [Sprint Review](./sprint-review.md) - Facilitate review meetings
- [Retrospectives](./retrospectives.md) - Guide process improvement
- [Team Groups](./team-groups.md) - Keep several teams on one shared Definition of Done

### For Developers

- [Sprint Board](./sprint-board.md) - Track and update work
- [Daily Scrum](./daily-scrum.md) - Participate in standups
- [Product Backlog](./product-backlog.md) - Understand and estimate work

## Common Workflows

### Starting a New Sprint

1. Navigate to **Sprint Planning**
2. Review and prioritize **Product Backlog**
3. Select items for the sprint
4. Define the **Sprint Goal**
5. Verify team capacity
6. Start the sprint
7. Track on **Sprint Board**

### Daily Routine

1. Check **Sprint Board** for current status
2. Attend **Daily Scrum** and provide updates
3. Update task status on the board
4. Log any **Impediments** encountered
5. Continue work toward sprint goal

### Ending a Sprint

1. Complete all **Definition of Done** criteria
2. Conduct **Sprint Review** with stakeholders
3. Hold **Retrospective** with the team
4. Document action items
5. Plan the next sprint

## Best Practices

### General

- **Keep it simple**: Start with basic features, add complexity as needed
- **Inspect and adapt**: Regularly review and improve your process
- **Transparency**: Share information openly with the team
- **Time-boxing**: Respect sprint boundaries and ceremony time limits

### For Effective Sprints

- Maintain consistent sprint length
- Don't change sprint goals mid-sprint
- Leave capacity buffer for unexpected work
- Complete items fully before starting new ones
- Update the board daily

### For Team Collaboration

- Communicate blockers immediately
- Participate actively in ceremonies
- Support team members facing challenges
- Share knowledge and help onboard new members

---

**Next**: Choose a feature guide above to learn more.
