# Increment

An Increment is a concrete, working step toward the Product Goal. It is the **sum of the Product
Backlog items completed during a Sprint**, and it must be in usable condition before it can be
called an Increment: work that is not usable is not an Increment, however much effort it took.

> **Enforced by Scrumooth:** The tool refuses to let a label stand in for evidence. An Increment
> must be **integration-verified against every prior Increment** and its **usable condition attested
> in writing** before it can be verified or delivered; changing what an Increment contains clears
> both, because evidence about one set of work is not evidence about another; and `Delivered` is
> reachable only through the deliver action, which records how the Increment reached users.

## Table of Contents

- [Purpose](#purpose)
- [Key Concepts](#key-concepts)
- [Practical Guidance](#practical-guidance)
- [Gates and Enforcement](#gates-and-enforcement)
- [Best Practices](#best-practices)
- [Related Topics](#related-topics)

---

## Purpose

The Increment is one of the three artifacts of the 2020 Scrum Guide, and it is the reason the Sprint
exists: to produce something usable. Tracking an Increment:

- **Turns "Done" items into a deliverable** — it names exactly which Product Backlog items are in it.
- **Proves usability** — the integration verification and the usability attestation make "usable" a
  claim with evidence behind it.
- **Records delivery** — how the Increment reached users, when, and who delivered it.
- **Keeps the Sprint Review honest** — the Review inspects an Increment the team can stand behind.

---

## Key Concepts

### Statuses

An Increment follows a defined lifecycle from draft through delivery:

```
DRAFT ──► VERIFIED ──► DELIVERED (terminal)
  │           │
  │           └──► Return to DRAFT
  └──► ARCHIVED (terminal)
```

| Status        | Meaning                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **Draft**     | The Increment is being assembled; Product Backlog items can be added or removed                    |
| **Verified**  | Its integration with every prior Increment has passed **and** its usable condition is attested     |
| **Delivered** | It has reached users; the delivery method, the moment and the person who delivered it are recorded |
| **Archived**  | It is retained for historical reference                                                            |

Three rules constrain the lifecycle:

- **Creation always starts at Draft.** A create that declares a later status is refused, so the gates
  are walked rather than skipped.
- **Both verifications are prerequisites.** Changing what an Increment contains clears both, because
  the evidence covered the previous contents; a `Verified` Increment whose contents change returns
  to `Draft`.
- **`Delivered` is reachable only through the deliver action**, which records how the Increment
  reached users and who delivered it. Writing the status directly is refused.

### Contents

An Increment contains **Product Backlog items that are Done** and not already in another Increment.
Its story-point total is derived server-side from the items it contains, so the reported figure
cannot disagree with the contents. A Sprint has at most one open Increment.

### Integration verification

An Increment must be additive: it must integrate with every **prior** Increment. Scrumooth records
integration tests against the Increment chain, and a `Draft` sibling does not count as a prior
Increment — it is one the team has not stood behind yet, so there is nothing for this one to be
additive to.

The team's **first** Increment is exempt, with the basis `FIRST_INCREMENT_EXEMPT`, because there is
no prior Increment to test against. Later verifications record how many prior Increments they
covered.

### Usability attestation

The usable condition is **attested in writing**: what was checked, and where. Whitespace alone is
refused — an attestation that says nothing would satisfy the gate without carrying a fact. This is
what lets the Sprint Review inspect evidence rather than a label.

### Delivery

Increments are delivered through the **deliver action**, which records:

- the **delivery method** — `Sprint Review` (presented at the Review) or `Early Release` (delivered
  before the end of the Sprint);
- the **moment** of delivery; and
- **who** delivered it, with optional notes.

Delivery is independent of the Sprint Review, so it is not refused while the Sprint is still
running: `Early Release` exists precisely so value can reach users before the Review. Delivering is
irreversible, and a delivered or archived Increment is locked.

### Relationship to the Definition of Done

The Increment's items are measured against the team's **Definition of Done**, and the verifications
recorded against each item are captured when the Sprint is completed. The Increment detail page shows
those verifications by item and by category, so the Review can see what "Done" rested on.

---

## Practical Guidance

### Create an Increment

1. Click **Increment** in the sidebar to open the Increment register.
2. Click **Create Increment**.
3. Give it a **name** and, optionally, a **description**, and select the **Sprint** it belongs to.
4. Select the **Product Backlog items** to include — only items in `Done` status that are not already
   in another Increment are eligible.
5. Review the summary (items selected and total story points) and click **Create Increment**.

### Verify the integration

1. Open the Increment and go to the **Increment Integration** panel.
2. Add an integration test against each prior Increment and record its result.
3. When every prior Increment passes, choose **Verify Integration**. The panel shows the chain, the
   counts verified, and how many prior Increments the verification covered.
4. If you later change the contents, the verification is cleared and must be repeated.

### Attest the usable condition

1. Open the **Usable Condition** panel on the Increment detail page.
2. Choose **Record Attestation** and enter the evidence — what you checked and where. For example:
   _"Deployed to staging and exercised end to end by the Product Owner."_
3. Save. The panel then shows who attested it and when.

### Deliver the Increment

1. Open the Increment and click **Deliver Increment**.
2. Choose the **Delivery Method** — `Sprint Review` or `Early Release`.
3. Optionally add notes.
4. Confirm. The delivery records the method, the moment and the delivery.

Delivery is irreversible, so the confirmation states that the Increment will be marked as delivered
to stakeholders.

### Track delivery

The Increment register shows totals for all Increments, active Increments, delivered Increments and
story points, and the team's delivery metrics include the delivery rate and the average story-point
count. If an item's Increment composition was skipped or failed when it was marked Done, the
Sprint's open Increment can be **reconciled** from the Sprint's Done items — the repair never removes
a link, so it cannot silently shrink an Increment that was already presented.

---

## Gates and Enforcement

| Refusal                                       | What it means                                                                    | What to do                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| _Only a member of the team can change this_   | The Increment belongs to its Scrum Team                                          | Ask a member of that team to act on it                        |
| _Integration verification is required_        | The Increment has not been shown to integrate with every prior Increment         | Run the integration tests and verify the chain                |
| _A usability attestation is required_         | The usable condition has no written evidence                                     | Record what was checked and where                             |
| _Deliver through the deliver action_          | `Delivered` was written directly, so the method, moment and person would be lost | Use **Deliver Increment**                                     |
| _A delivered or archived Increment is locked_ | Its record is closed                                                             | Create the next Increment rather than editing a delivered one |

---

## Best Practices

1. **Create the Increment early** in the Sprint's closing work, and add items as they become Done.
2. **Only include Done items** — an Increment is the sum of what the Definition of Done has cleared.
3. **Verify integration before attesting usability**, so delivery is never blocked by an unrecorded
   step.
4. **Attest with real evidence** — name the environment and what was exercised; the Review will read
   it.
5. **Let the server derive the total** — story points are computed from the contents, so they always
   match what the team presents.
6. **Reconcile rather than rebuild** when a composition was missed; reconciliation adds what is
   missing and never removes a link.
7. **Record delivery honestly** — `Sprint Review` and `Early Release` are different facts, and the
   record is irreversible.

---

## Related Topics

- [Product Backlog](./product-backlog.md) — the Done items an Increment is composed of
- [Sprint Board](./sprint-board.md) — where items are taken to Done
- [Sprint Review](./sprint-review.md) — where the Increment is inspected with stakeholders
- [Product Goal](./product-goal.md) — the objective the Increment advances
