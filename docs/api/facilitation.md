# Facilitation API

The Scrum Master's facilitation record, beyond the Scrum events themselves:

1. **the coaching log** — the Scrum Master's private record of coaching the team in
   self-management and cross-functionality;
2. **working agreements** — the agreements the team makes with itself about how it works;
3. **the cross-functionality assessment** — the team-level judgement of whether it collectively
   holds the skills its work needs.

Each exists because the 2020 Scrum Guide names the thing and nothing else in the product could
express it: the first two Scrum Master services ("coaching the team in self-management and
cross-functionality") leave no trace in any artifact, and _"collectively they have all the skills
necessary to create value each Sprint"_ had no representation at all.

**Base path:** `/api/v1/facilitation`

## Authorization

| Resource                       | Read                    | Write                   |
| ------------------------------ | ----------------------- | ----------------------- |
| Coaching log                   | The team's Scrum Master | The team's Scrum Master |
| Working agreements             | Any member of the team  | Any member of the team  |
| Cross-functionality assessment | Any member of the team  | The team's Scrum Master |

The two asymmetries are deliberate:

- **The coaching log is private** because it holds a Scrum Master's working notes about a team's
  struggles with self-management. It is the Scrum Master's material, not a published assessment of
  the team, so it is serialized only for the team's Scrum Master.
- **Working agreements belong to the team** because self-management means the team decides how it
  works. Every member can add or amend one, and authorship is recorded.
- **The assessment is recorded by the Scrum Master and read by the team**, on the same footing as
  the Scrum Values health check: it is a team-level signal for inspection, not an appraisal of
  individuals.

All three are team-scoped in the service layer: a non-member is refused with
`GATE_FACILITATION_TEAM_MEMBERS_ONLY`, and a member who is not the Scrum Master is refused with
`GATE_COACHING_SM_ONLY` or `GATE_CROSS_FUNCTIONALITY_SM_ONLY` where those rules apply.

## Coaching log

```http
GET    /api/v1/facilitation/coaching?teamId=<uuid>&limit=50&offset=0
POST   /api/v1/facilitation/coaching
PUT    /api/v1/facilitation/coaching/:id
DELETE /api/v1/facilitation/coaching/:id
```

```json
{
  "teamId": "3b1f…",
  "topic": "CROSS_FUNCTIONALITY",
  "note": "Paired two developers on the migration tooling.",
  "sprintId": "1c9a…",
  "followUpDate": "2026-10-02"
}
```

- `topic` is `SELF_MANAGEMENT`, `CROSS_FUNCTIONALITY` or `OTHER`.
- `sprintId` is optional and must belong to the same team.
- `limit` defaults to 50 and is capped at 200; `offset` defaults to 0. The read returns
  `{ entries, total, limit, offset }`, newest first.

The write is audited with the entry's identifier, team, topic and note _length_ — never the note
body, which is why the log is private in the first place.

## Working agreements

```http
GET /api/v1/facilitation/working-agreements?teamId=<uuid>
POST /api/v1/facilitation/working-agreements
PUT  /api/v1/facilitation/working-agreements/:id
```

```json
{
  "teamId": "3b1f…",
  "title": "No meetings before 10:00",
  "description": "Focused work in the morning."
}
```

- `PUT` accepts `title`, `description` and `status` (`ACTIVE` | `RETIRED`).
- **Retirement replaces deletion**: moving an agreement to `RETIRED` stamps `retiredAt` and keeps it
  visible (muted) in the list, because a working agreement that silently disappears hides the fact
  that the team changed its mind. Moving it back to `ACTIVE` clears the stamp.
- Authorship is returned as `createdByName` / `updatedByName`, resolved in one query per page rather
  than one per row.

## Cross-functionality assessment

```http
GET  /api/v1/facilitation/cross-functionality?teamId=<uuid>
GET  /api/v1/facilitation/cross-functionality/:id
POST /api/v1/facilitation/cross-functionality
```

```json
{
  "teamId": "3b1f…",
  "summary": "The team can build and test the frontend; the migration tooling depends on one person.",
  "skills": [
    { "name": "Database migrations", "coverage": "NONE", "note": "Nobody has run the tooling." },
    { "name": "React", "coverage": "COVERED" },
    {
      "name": "Accessibility testing",
      "coverage": "PARTIAL",
      "note": "One person, recently trained."
    }
  ]
}
```

- `coverage` is `NONE`, `PARTIAL` or `COVERED`. At least one skill is required, at most 50 are
  accepted.
- Each write records a **new** assessment; there is no update or delete. The signal's value is that
  it is a sequence of judgements over time, and rewriting one would rewrite history.
- The read returns the latest assessment with its per-skill rows, a derived `coverage` summary
  (`total`, `covered`, `partial`, `gaps`), and up to 20 earlier assessments with their coverage
  counts so a trend can be seen without a query per assessment.
- **No per-person skill inventory exists anywhere in this API.** Recording who can do what would
  turn a composition signal into an appraisal of individuals.

## Gate rejections

| Code                                  | HTTP | When                                                                               |
| ------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `GATE_FACILITATION_TEAM_MEMBERS_ONLY` | 403  | The caller is not a member of the team the record belongs to                       |
| `GATE_COACHING_SM_ONLY`               | 403  | The coaching log was read or written by someone other than the team's Scrum Master |
| `GATE_CROSS_FUNCTIONALITY_SM_ONLY`    | 403  | An assessment was recorded by someone other than the team's Scrum Master           |

## Privacy and the data export

Coaching entries, working agreements, barrier stakeholder actions and cross-functionality
assessments are **team facilitation records**, and they carry authorship. They follow the same
policy as the rest of the repository's activity data: they are excluded from the GDPR data export,
which covers the personal data of the requester rather than the team's facilitation history. This
is stated here rather than left implicit, because a reader of the export should be able to tell why
a note they wrote is not in it.
