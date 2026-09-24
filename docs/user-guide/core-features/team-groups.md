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
- [Where the Shared Definition of Done Is Changed](#where-the-shared-definition-of-done-is-changed)
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

| Task                                                    | Where                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| Create, rename or delete a group                        | **Settings → Team → Team Groups**                           |
| Read the roster and the version each team holds         | **Settings → Team → Team Groups**                           |
| Read and change the Definition of Done they comply with | **Team → Definition** (the scope ribbon above the criteria) |
| Join or leave a group                                   | **Team → Definition** (the scope ribbon)                    |
| See which commitment governs your team                  | **Team → Definition** (the scope ribbon above the criteria) |

### Why It Lives With the Team

The Definition of Done is the Increment's commitment, not an administrative setting, so it is read and
changed where the team is — on the **Definition tab**, with the Sprint it gates in view. The tab's own
navigation names the three agreements the team holds itself to and enters the page at the one you mean.
The scope statement directly above the criteria states which Definition of Done governs the team: its
own, or the one it shares with the other teams in its group. Opening that statement is where a team's
leadership reviews the shared agreement, changes it, adopts one or leaves.

**Settings → Team Groups** does what an administration screen should: it creates, renames and deletes
a group, and shows its roster with the version each team adopted. It states which commitment governs
the group's teams and links to where that commitment is authored.

Two answers to "where do I change our Definition of Done?" was one too many: the answer is always the
Definition tab of a team.

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

## Where the Shared Definition of Done Is Changed

Open **Team → Definition** on any team in the group. The scope ribbon above the criteria says the
agreement is shared, names the group and how many teams comply with it, and links to the group's own
screen.

1. Choose **Edit DoD**. (Only the group's teams' Product Owners and Scrum Masters see the control.)
2. Add, reword, reorder, deactivate or remove criteria. It is the same editor a team uses for its own
   Definition of Done — the commitment is one commitment, so the editing is one editing.
3. Choose **Save Changes**.

One change, seen by every team that shares the commitment, and the shared version increments. A banner
above the editor states the consequence before you save, because this is the one write in the product
that changes several teams' commitment at once.

**Review the shared agreement** in the scope ribbon reads the criteria in full without entering the
editor, and **Manage the group** goes to the roster.

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

Joining is the team's own decision, and it is taken next to the commitment it decides.

1. Open **Team → Definition**.
2. In the scope ribbon, choose the group from the **Team group** list.
3. Choose **Review** and read the criteria in full.
4. Choose **Adopt vN**.

Step 3 is not decoration: a Definition of Done a team may not read before agreeing to it is not one it
"mutually defined". The ribbon states plainly what this product means by mutual definition — the teams
adopt a named version, and a change made afterwards is shown as drift until this team adopts the new
one.

If the version moved between your review and your confirmation, the join is refused. The refusal
appears in place with the rule and a **Review the current version** control that reads the version now
in force and adopts it — so a team can never be recorded as complying with a definition it never saw,
and never has to guess how to recover.

To leave, choose **Leave the group** in the same ribbon and confirm. Leaving is not a deletion: the
team keeps the Definition of Done it has been complying with, and can then change it on its own.

Only the team's **Product Owner** or **Scrum Master** sees the adopt and leave controls. Every member
sees which group governs the team, which version it adopted, and whether that version is still the one
in force.

---

## What Happens to a Team's Own Definition of Done

| Moment               | The team's own Definition of Done                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Before joining**   | Its own, and editable.                                                                                                    |
| **While in a group** | Kept but **inert**: nothing reads it and the team cannot edit it.                                                         |
| **On leaving**       | Rewritten with the group's criteria — through the ordinary versioned update, so the change is snapshotted like any other. |

A team is therefore never left without a commitment, and never left with a stale definition it
happened to keep. On **Team → Definition**, a grouped team's Definition of Done is shown with its
scope stated above the criteria, and it is edited there — the same editor, writing to the group —
rather than from a separate screen.

---

## Reading Without Leading

The group directory and every group's shared Definition of Done are readable by any signed-in user.
This is deliberate rather than lax: a team cannot join a collaboration it cannot find, and it cannot
"mutually define" a commitment it is not allowed to read.

If you open a group whose teams you do not lead, **Settings → Team Groups** still shows you which
version governs its teams and the roster, and a notice explains that only its teams' Product Owners
and Scrum Masters can change it. On **Team → Definition**, a member who does not lead sees the
commitment in full with a sentence naming who maintains it. Nothing is hidden and no action is offered
that would be refused.

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
