# Scrum Guide Conformance — Decided Positions

Scrumooth turns the rules of the 2020 Scrum Guide into gates the backend enforces, and it is explicit
about the places where it deliberately does not. This document records the decisions behind that line,
so that an absence is a decision rather than an oversight.

Each entry states the Guide's rule, what the product does, and — where the product stops short — what
it would take to go further.

## 1. The Definition of Done is the Increment's commitment

**The Guide**: _"The Definition of Done is a formal description of the state of the Increment when it
meets the quality measures required for the product."_ It is the commitment the Increment is measured
against, and _"the Developers are required to conform to the Definition of Done."_

**What the product does**

- The Definition of Done is authored on the Team module's **Definition tab** (`/team?tab=definition`),
  where the team is, by any member of that team. It is not a settings screen, and it is not one role's
  private configuration — a commitment that only its authors can read is not one its conformers can
  keep.
- A Sprint cannot be committed or started while the Definition of Done holds no active criterion, and
  no Product Backlog item can reach `DONE` while any of its active criteria is unverified.
- Every superseded version is preserved as an append-only snapshot, so a version badge opens the
  history it names rather than asserting one.

**Why it is not in Settings**: administration is not the same act as commitment. A Definition of Done
configured under Settings reads as a setting, which is exactly what the Guide says it is not.

## 2. Multiple Scrum Teams on one product share one Definition of Done

**The Guide**: _"If there are multiple Scrum Teams working together on a product, they must mutually
define and comply with the same Definition of Done."_

**What the product does**

- A team group owns the only Definition of Done its member teams read (`dodScope.ts` resolves the
  scope), and the database holds the ownership as a `CHECK` constraint: a Definition of Done belongs to
  a team or to a group, never both and never neither.
- A grouped team's own row is retained but inert, and a team-scoped write while grouped is refused with
  `409 GATE_DOD_GROUP_GOVERNED`. The interface never offers that write — the section routes the save to
  the group instead — so the refusal is a defence of the invariant rather than an error path.
- The shared agreement is read and changed on a member team's Definition tab, by the Product Owner or
  Scrum Master of any team in the group. There is no group administrator: the group is a shape the
  teams' own agreements take, not an organisation above them.

### "Mutually define" is the version acknowledgement

**Decided position.** Mutual definition is implemented as an explicit act recorded at the moment a team
joins: the team reads the shared agreement in full and names the version it is adopting, and the API
refuses a version that is not the one in force (`400 GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED`).
The adopted version is stored on the team (`Team.groupDodVersionAtJoin`), so a change made afterwards
leaves a visible drift until the team adopts the new version — and the drift is shown on the team's own
Definition tab and in the group's roster.

This is the product's reading, and it is stated in the interface where the agreement is reviewed rather
than only here: version acknowledgement is what "mutually define" means in this tool.

**What it would take to go further**: a change to a shared Definition of Done could require review by
the leadership of more than one member team before it takes effect. That would model "mutually" more
literally at the cost of a second approval step on every edit; it is not implemented.

## 3. The Definition of Ready is a complementary practice, not a Guide artifact

**The Guide**: names exactly three artifacts — the Product Backlog, the Sprint Backlog and the
Increment — with the Definition of Done as the Increment's commitment. It contains no Definition of
Ready. Refinement is _"the act of breaking down and further defining Product Backlog items into
smaller, more precise items"_, and the Guide calls it an ongoing activity.

**What the product does**

- The readiness agreement is presented as a complementary practice **in the product's own copy**, next
  to the criteria it holds, and never as a Guide artifact.
- It is enforced at the Sprint boundary: committing a Sprint Backlog or starting a Sprint is refused
  while a selected item still has an unverified active criterion, and refused outright while the team
  has no active criterion at all.
- It is maintained by the team's **Scrum Master** (`403 GATE_DOR_SCRUM_MASTER_ONLY`). The Guide makes
  the Scrum Master accountable for coaching the team in effective practices, so the agreement it
  enforces is theirs to maintain; team members record the verdicts per item.
- It keeps its own append-only version history, like the Definition of Done, so the claim that the
  agreement changed is inspectable.

**Decided position on authority.** The Definition of Done is editable by any team member and the
Definition of Ready by the Scrum Master alone. That asymmetry is deliberate and is stated in the
product rather than left to be discovered: the first is the Scrum Team's commitment under the Guide,
the second is one role's declared practice. The copy therefore never calls the readiness agreement "the
team's agreement".

## 4. Organization-wide minimum Definition of Done — out of scope

**The Guide**: _"If the Definition of Done is part of the organization's standards, all Scrum Teams
must follow it as a minimum."_

**Decided position: deliberately not modelled.** `DefinitionOfDone` is owned by a team or by a team
group; there is no organization scope, and no way to express "an organizational standard that every
team's Definition of Done must include as a floor".

**Why the omission is deliberate**

- The Guide's sentence describes an organization that already has standards. Scrumooth is self-hosted
  and single-organization-per-installation, so the nearest honest equivalent of "the organization's
  standards" is the group — and a group already carries the multi-team rule that the sentence exists to
  protect.
- A half-modelled organization scope is worse than none: a floor that is not enforced at every write
  path would let a team adopt a Definition of Done that silently omits the standard while the interface
  reported compliance.

**What it would take to implement it**: a third `DefinitionOfDone` scope (`organizationId`) marked as a
floor rather than an owner, composition logic that merges the floor into every team's and group's
effective Definition of Done at read time, a write-path check that refuses a version dropping a floor
criterion, and interface copy that distinguishes the floor's criteria from the team's own. The
`CHECK ((team_id IS NULL) <> (group_id IS NULL))` constraint would have to become a three-way
exclusive-or, which is a migration on a live table.

## 5. Where each claim can be inspected

| Claim                                           | Where it is verified                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| The Definition of Done cannot be emptied        | `400 GATE_DOD_REQUIRED` from `writeDefinitionOfDone`                             |
| No item reaches `DONE` unverified               | `400 GATE_DOD_NOT_VERIFIED` from the backlog service                             |
| A grouped team cannot diverge                   | `409 GATE_DOD_GROUP_GOVERNED`, plus the `CHECK` on `definition_of_done`          |
| Versions are append-only                        | `dod_version_snapshots`, and now `dor_version_snapshots`                         |
| Mutual definition is an act                     | `Team.groupDodVersionAtJoin`, `400 GATE_TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED` |
| The readiness agreement is not a Guide artifact | The copy on the Definition tab, and `docs/api/definition-of-ready.md`            |
| The organization-minimum case is out of scope   | Section 4 of this document                                                       |

---

**Last Updated**: 2026-09-24
**Maintainers**: Orbivort
