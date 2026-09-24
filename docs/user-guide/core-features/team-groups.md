# Team Groups and the Shared Definition of Done

A team group is a set of Scrum Teams working together on one product, bound to a single Definition of
Done. It is the product view of the rule in the 2020 Scrum Guide:

> _"If there are multiple Scrum Teams working together on a product, they must mutually define and
> comply with the same Definition of Done."_

## Table of Contents

- [Overview](#overview)
- [Who Can Do What](#who-can-do-what)
- [Creating a Group](#creating-a-group)
- [Reading the Roster](#reading-the-roster)
- [Editing the Shared Definition of Done](#editing-the-shared-definition-of-done)
- [Joining and Leaving](#joining-and-leaving)
- [What Happens to a Team's Own Definition of Done](#what-happens-to-a-teams-own-definition-of-done)
- [Reading Without Leading](#reading-without-leading)
- [Gates You May Meet](#gates-you-may-meet)
- [Boundaries](#boundaries)
- [Best Practices](#best-practices)

---

## Overview

### What a Group Is

A group is a **product-collaboration device**, not a team decomposition:

- The group owns **the only Definition of Done its teams read**. A member team's own definition is
  kept but inert, so the teams cannot drift apart by accident rather than by agreement.
- **Joining records the version the team adopted.** A later change to the shared definition leaves
  that number behind — which is what makes the drift visible.
- A grouped team **cannot edit its own Definition of Done**. A team that could would not be complying
  with the same one, and the change would be invisible to the teams that share it.
- Nothing inside a Scrum Team changes: no sub-teams, no hierarchy, no product-level backlog.

### Where It Lives

| Task                                             | Where                                               |
| ------------------------------------------------ | --------------------------------------------------- |
| Create, rename or delete a group                 | **Settings → Team → Team Groups**                   |
| Read the roster and the version each team holds  | **Settings → Team → Team Groups**                   |
| Edit the Definition of Done they all comply with | **Settings → Team → Team Groups**                   |
| Join or leave a group                            | **Team → Scrum Health → Shared Definition of Done** |
| See which commitment governs your team           | **Team → Scrum Health → Shared Definition of Done** |

The two screens are linked: from the Team page you can jump straight to the group, and the notice on
**Settings → Team → Team Definitions** links to the group that governs the team you are looking at.

### Why Two Screens

A group is shared by several teams, so it does not belong to any one of them. Creating and dissolving
a group, and replacing the commitment every team in it complies with, is a product-level decision and
lives with the other product-wide settings. Whether _this_ team joins is the team's own decision and
lives on the team.

---

## Who Can Do What

Roles are resolved **within the group's own teams**. A Product Owner role held in some other team is
not a role here.

| Action                                       | Who                                                          |
| -------------------------------------------- | ------------------------------------------------------------ |
| See the group directory                      | Any signed-in user                                           |
| Read a group's shared Definition of Done     | Any signed-in user                                           |
| Read a group's roster                        | A member of one of its teams, or the account that created it |
| Create a group                               | Any signed-in user                                           |
| Rename or delete a group                     | Product Owner or Scrum Master of one of its teams            |
| Edit the group's Definition of Done          | Product Owner or Scrum Master of one of its teams            |
| Join or leave the group (from the Team page) | Product Owner or Scrum Master of the team                    |

Before any team has joined, there is no team leadership to consult, so the account that created the
group may act on it. Once teams have joined, the group belongs to their leadership.

---

## Creating a Group

1. Open **Settings → Team → Team Groups**.
2. Choose **New group**.
3. Give it a **name** (up to 100 characters) and, optionally, a **description** (up to 500
   characters) that says which product it is for.
4. Choose **Create group**.

The group is created together with the Definition of Done it will own, so "adopt the shared
Definition of Done" is never a promise about nothing. At that moment the group has no teams, so its
roster is empty — that is the normal starting point, and you are taken straight to it.

Use **Rename** to change the name or the description later. **Delete group** is available only while
no team complies with the group, and the reason is shown next to the button when it is not: removing
a group would take its Definition of Done away from its teams rather than move them to another one.
Every team has to leave first.

---

## Reading the Roster

Selecting a group shows its facts — how many teams it has and which version of the shared Definition
of Done is in force — and the roster of those teams:

| Column      | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| **Team**    | The team that complies with this Definition of Done                                 |
| **Joined**  | When it adopted the group's Definition of Done                                      |
| **Adopted** | The version it adopted when it joined                                               |
| **Status**  | **In step**, or a warning that the version it adopted is no longer the one in force |

A team marked as behind has **not re-adopted a change** made after it agreed. Nothing is broken: the
group still owns one definition, and every team still reads that one. What the warning shows is that
the teams have stopped having _agreed_ to it — which is the part the Guide asks for and the part only
the teams can fix. Ask the team to review the current version, and record the agreement again.

A team shown as **Not recorded** predates the adoption record; it complies with the group's
Definition of Done but the exact version it agreed to was not captured.

---

## Editing the Shared Definition of Done

The **Shared Definition of Done** panel shows the version in force, when it last changed, and the
active criteria with their categories.

1. Choose **Edit shared Definition of Done**.
2. Add, reword, reorder, deactivate or remove criteria. The editor is the same one your team uses for
   its own Definition of Done.
3. Choose **Save Changes**.

One change, seen by every team that shares the commitment, and the version increments. A banner above
the editor states the consequence before you save, because this is the one write in the product that
changes several teams' commitment at once.

Two things worth knowing:

- A criterion you **keep** by editing it in place survives the change, so the verifications recorded
  against it survive too.
- A criterion you **remove** is deleted, and its verifications go with it. The superseded version is
  still preserved in the history, so the change remains auditable — but a removed criterion is one
  nobody can satisfy any more.
- A change that would leave the group's Definition of Done with **no active criterion** is refused:
  an empty checklist would satisfy the Done gate without meaning anything.

After a change, every team in the roster is still shown at the version it adopted. That is the point:
the tool records what was agreed, not what is currently on screen.

---

## Joining and Leaving

Joining is the team's own decision, so it lives on the team.

1. Open **Team → Scrum Health**.
2. In **Shared Definition of Done**, choose the group from the **Group** list.
3. Choose **Review what would be adopted** and read the criteria in full.
4. Choose **Join and adopt version N**.

Step 3 is not decoration: a Definition of Done a team may not read before agreeing to it is not one
it "mutually defined". The join is refused if the version you are shown is no longer the one in force,
so a team can never be recorded as complying with a definition it never saw. In that case, review
again and adopt the current version.

To leave, choose **Leave the group** on the same panel and confirm. Leaving is not a deletion: the
team keeps the Definition of Done it has been complying with, and can then change it on its own.

Only the team's **Product Owner** or **Scrum Master** sees the join and leave controls. Every member
sees which group governs the team and which version it adopted.

---

## What Happens to a Team's Own Definition of Done

| Moment               | The team's own Definition of Done                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Before joining**   | Its own, and editable.                                                                                                    |
| **While in a group** | Kept but **inert**: nothing reads it and the team cannot edit it.                                                         |
| **On leaving**       | Rewritten with the group's criteria — through the ordinary versioned update, so the change is snapshotted like any other. |

A team is therefore never left without a commitment, and never left with a stale definition it
happened to keep. On **Settings → Team → Team Definitions**, a grouped team's Definition of Done is
shown read-only, with a notice pointing at the group where it is changed.

---

## Reading Without Leading

The group directory and every group's shared Definition of Done are readable by any signed-in user.
This is deliberate rather than lax: a team cannot join a collaboration it cannot find, and it cannot
"mutually define" a commitment it is not allowed to read.

If you open a group whose teams you do not lead, you see its Definition of Done in full with a notice
explaining that only its teams' Product Owners and Scrum Masters can change it. Nothing is hidden and
no action is offered that would be refused.

---

## Gates You May Meet

Scrumooth refuses these actions rather than letting a process violation pass silently.

| Message                                             | What it means                                                             | What to do                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| _A group with teams cannot be removed_              | Teams still comply with its Definition of Done                            | Ask each team to leave the group first                          |
| _Only a member team's leadership may change this_   | You do not hold Product Owner or Scrum Master in any of the group's teams | Ask one of those roles on a member team to make the change      |
| _Name the version you are adopting_                 | The version you reviewed is no longer the one in force                    | Review the Definition of Done again and adopt the version shown |
| _A Definition of Done needs at least one criterion_ | Your change would leave no active criterion in force                      | Keep at least one criterion active                              |
| _This team already complies with a group_           | A team belongs to at most one group                                       | Leave the current group before joining another                  |
| _Only the team's own leadership may join or leave_  | You do not hold Product Owner or Scrum Master in that team                | Ask those roles on the team to decide                           |

---

## Boundaries

A group binds the **Definition of Done** of several teams. It does not introduce:

- a product-level Product Backlog, product goal, or product entity;
- product-level reporting, dashboards, or velocity aggregation.

Teams in a group keep their own Product Backlog, Product Goal, Sprints, and reports. That is
deliberate: the Guide's rule here is about one shared commitment, and inventing a product container
around it would change what a Scrum Team is.

---

## Best Practices

### Forming a Group

- Create the group when a **second** team starts work on the same product. One group per product.
- Write the description as the product, not the org chart: "Payments product", not "Payments
  chapter".
- Define the shared Definition of Done with every team present before anyone joins. The group owns
  it; the teams should recognise it.

### Keeping It Honest

- Review the roster's **Status** column after every change to the shared Definition of Done, and
  chase the teams marked as behind.
- Change the shared Definition of Done at the group, never by asking teams to "keep in step" by hand.
- Revisit the commitment in a Retrospective the way you would your own team's, and apply the change
  where every team can see it.

### When to Split a Group

If two teams in a group no longer work on one product, they are no longer bound by the Guide's rule.
Have one of them leave the group; it keeps the Definition of Done it has been complying with and can
then adapt it to its own product.

---

## Related Documentation

- [API: Team Groups](../../api/team-groups.md) — endpoints, gates, and the guarantees that hold under
  concurrency
- [API: Definition of Done](../../api/definition-of-done.md) — the Definition of Done itself
- [Sprint Board](./sprint-board.md) — where "Done" is reached
- [Retrospectives](./retrospectives.md) — where a Definition of Done is usually revised

---

**Last Updated**: September 2026
