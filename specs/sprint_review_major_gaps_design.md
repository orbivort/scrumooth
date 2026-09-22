# Sprint Review Major Gaps — Technical Design

## Problem

The Scrum Guide conformance evaluation for the Sprint Review module
(`temp/review/scrum-guide-module-conformance-evaluation.md`, §3.9) recorded five Major gaps.
Four are closed here; the fifth was confirmed out of scope by the product owner.

| #   | Gap                                                                       | Status                                       |
| --- | ------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Event ordering not enforced (Review before Retrospective, Sprint ended)   | Closed                                       |
| 2   | Key stakeholders not modelled as people (no `userId` on `ReviewAttendee`) | Closed                                       |
| 3   | Backlog adjustments not traceable to the item they produced               | Closed                                       |
| 4   | Completing a Review forces every team member to be marked attended        | **Out of scope** — kept as business as usual |
| 5   | No role or membership gates on any Review write; SM notes ungated         | Closed                                       |

## Design

### 1. Event ordering

Two new gates (`packages/shared/src/constants/gateCodes.ts`):

- `GATE_SPRINT_RETROSPECTIVE_REQUIRES_REVIEW` (400) — thrown by
  `retrospective.service.updateRetrospective` when a Retrospective transitions to `COMPLETED`
  while its Sprint Review is not `completed`. "The Sprint Review is the second-to-last event of
  the Sprint and the Sprint Retrospective concludes the Sprint."
- `GATE_SPRINT_EVENT_BEFORE_END_DATE` (400) — thrown by both the Review completion path
  (`sprintReview.service.updateSprintReview`) and the Retrospective completion path when
  `now < sprint.endDate`.

The Retrospective controller previously flattened every non-`NotFoundError` into a 500, which
would have hidden the gate; it now propagates any `AppError` with its own status and code.

### 2. Stakeholders as people

`ReviewAttendee.userId` (nullable UUID, FK to `users`, `ON DELETE SET NULL`, indexed). The
free-text `name`/`email` stay for genuinely external stakeholders. When a link is set, the
display fields are derived from the account and the account's team role is recorded; a link to a
non-existent user is refused rather than silently stored.

`updateSprintReview` treats `userId` as: string → link/re-link and adopt account fields;
`undefined` → leave the existing link untouched; `null` → detach.

### 3. Backlog adjustment traceability

`BacklogAdjustment.createdPbiId` (nullable UUID, FK to `product_backlog_items`,
`ON DELETE SET NULL`, indexed). `pbiId` keeps its meaning: the item the adjustment _refers to_.

- `POST /sprint-reviews/adjustments/:id/materialize` — creates the item through
  `productBacklogService.createPBI` (so the Product Goal anchor, backlog rank, and workflow
  history are identical to any other item), then links it and sets `implemented = true`. If the
  link write fails, the just-created item is removed so no orphan is left behind.
- `PUT /sprint-reviews/adjustments/:id/link` — links an existing item that belongs to the same
  team.
- `PUT /sprint-reviews/adjustments/:id/implement` — retained for adjustments whose outcome is
  not an item (for example a reorder); it returns a linked adjustment unchanged, because
  `createdPbiId` is the evidence and a manual flag must not contradict it.

### Critical regression guard

`updateSprintReview` previously synced `attendees`, `feedback`, and `backlogAdjustments` with
delete-all-then-recreate, and the frontend resends the whole array on every save. That would have
erased the new `userId`/`createdPbiId` links on every edit. The sync is now id-based inside one
`$transaction`: update rows whose id is present, create rows without one, delete only the ids the
payload omitted, and refuse ids that belong to a different Review.

### 4. Access control

- `GATE_SPRINT_REVIEW_TEAM_MEMBERS_ONLY` (403) — every Review write (create, update/complete,
  delete, feedback, attendee changes, adjustment writes) asserts membership of the team that owns
  the Review. Reads are unchanged (out of scope).
- `GATE_SPRINT_REVIEW_SM_NOTES_SM_ONLY` (403) — `PATCH /sprint-reviews/:id/sm-notes` now requires
  the team's `SCRUM_MASTER`, matching an interface that already hides the editor.

## Security notes

- Authorisation is enforced server-side only; the UI hiding a control is never the gate.
- Every new request body is validated by Zod at the route boundary before it reaches a service.
- Child-collection writes refuse foreign ids, so a caller cannot rewrite another Review's rows by
  passing their ids.
- Gate refusals carry a stable `error.code` and are accounted by the existing refusal middleware.

## Frontend

- `AttendeesSection` gains an optional "registered user" picker that derives name/email/role and
  locks those fields while linked, plus a badge on attributable records.
- `PendingAdjustments` replaces the "prefill the create modal" flow with a direct materialize
  call, adds "link existing item", and keeps "mark done" for adjustments with no produced item.
- The Review page surfaces the linked item on each adjustment.
- All new copy exists in the five supported locales (`de`, `en`, `es`, `fr`, `it`).

## Verification

- `pnpm run typecheck`, `pnpm run lint`, `pnpm run lint:css`, `pnpm run i18n:check` — all clean.
- Backend unit suite: 95 files / 2584 tests pass.
- Frontend affected suites (Sprint Review, Backlog, AttendeesSection, services): pass.
- Backend e2e suites (real HTTP + PostgreSQL):
  - `sprint-review.e2e.test.ts` — 48 pass, including the new ownership refusal, SM-only notes
    (allowed for the Scrum Master, refused for a Developer), materialize, link, and
    foreign-team-link refusal cases.
  - `retrospective.e2e.test.ts` — passes, including Review-before-Retrospective.
  - `sprint-management.e2e.test.ts`, `workflow-operations.e2e.test.ts` — 66 pass.
  - The local `scrumooth_test` database had the new migration applied with
    `prisma migrate deploy` before these runs; other environments need the same.
- The browser walkthrough was not performed (no local dev stack was running). The e2e suites
  above exercise the same gates over the real HTTP stack, which is the stronger check for the
  backend-authored refusals.
