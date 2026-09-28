# Frontend mock backend

A mock backend that answers real HTTP requests, so the application runs end to end
without a server. MSW intercepts the traffic in the browser (development, demo
builds, E2E) and in Node (Vitest), and one registry of handlers serves all of them.

The application is unaware of it: pages, hooks and domain services are unchanged,
and in mock mode they exercise the real axios client, its interceptors, CSRF
handling and the 401 refresh flow.

## Layers

| Layer               | Directory   | Rule                                                                                               |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| Frozen seed         | `fixtures/` | Pure fictional data. Never mutated, and never imports from `store/` or `handlers/`.                |
| Working copy        | `store/`    | A small typed database seeded from `fixtures/`, plus the acting session. Knows nothing about HTTP. |
| Endpoint responders | `handlers/` | Translate requests into store reads/writes. One module per domain group.                           |
| Shared plumbing     | `support/`  | Envelope builders, URL matching, latency, ids, scenario presets.                                   |

Generation (fixtures) is therefore separate from consumption (store, handlers):
changing demo content touches `fixtures/` only, and changing an endpoint contract
touches that domain's handler only.

## Adding a domain

1. Add the seed data to `fixtures/` as plain exported constants.
2. Add the collection to `store/db.ts` so handlers can read and write it.
3. Add `handlers/<domain>.handlers.ts` returning responses built with
   `support/envelope.ts`.
4. Register the module in `handlers/index.ts`, keeping static path segments
   before `:id` routes — MSW stops at the first handler that responds.
5. Add a contract test next to the handler (or in `__tests__/`) proving the
   success and the failure shapes. `handlers/notifications.handlers.test.ts` is a
   worked example: it calls the domain service through the real axios client and
   asserts each response body as a whole, which is what catches an envelope that
   looks right and parses as `undefined`.

## Endpoint paths

Never hardcode an origin. Build every path with `support/http.ts` `apiUrl()`,
which resolves `VITE_API_URL` against the running origin. That keeps a single
handler set matching in jsdom, on `localhost:5173` and on GitHub Pages under a
sub-path.

## Flags

| Variable               | Effect                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| `VITE_USE_MOCK_API`    | `'true'` enables mock mode. Explicit opt-in; anything else leaves it off. |
| `VITE_MOCK_LATENCY_MS` | Simulated latency per mocked response. `0` disables it.                   |

Mock mode is opt-in and a production-mode build refuses to enable it — see the
guard in `vite.config.ts`. Demo builds use `--mode demo`, backed by `.env.demo`.

## The demo's clock

The seed is anchored to one fixed day — Friday 25 September 2026 — and the
browser's clock is frozen on the same instant while mock mode is on. The anchor
is `fixtures/clock.ts`; the freeze is `demoClock.ts`, installed by `main.tsx`
before the app renders.

Both halves are needed, and neither is enough alone. The Daily Scrum page asks
the API for the record of _its_ day, so a seed written on fixed dates is only
ever found if the interface agrees about which day it is; and a seed anchored to
the visitor's clock reads differently on every run, in every timezone, and on a
weekend shows the empty state the team's calendar legitimately implies.

Frozen together, the demo shows the same Sprints, the same events and the same
Daily Scrum history whenever it is opened. Only the default is frozen: explicit
`new Date(...)`, `Date.parse`, `Date.UTC` and the methods of an existing `Date`
behave exactly as usual.

## The Sprint calendar

A Sprint's name carries its window — `Sprint-3w-2613 (2026-09-14 – 2026-10-02)` —
so a name and a window that came from different places print a date range that
contradicts the dates beside it. `fixtures/cadence.ts` holds that calendar: the
first Monday in January, a window every cadence length, each closed on the Friday
before a weekend, which is what the backend's generator walks. The seed and the
`sprintConfig` handlers both read it, so the list a visitor is shown and the year
the generator lays out cannot describe two different calendars.

The teams work to different cadences, three weeks and four weeks, which is what
gives them different sequence numbers and puts their running Sprints at different
points of their own windows. Both are long enough that the frozen day is not the
last day of either, which is what leaves the board a Sprint in flight.

## Exercising failure paths

Arm a failure once and every handler short-circuits with it:

```js
const { setScenario } = await import('/src/mocks/support/scenarios');
setScenario('offline'); // or 'slow', 'server-error', 'unauthorized', 'forbidden', 'rate-limit'
setScenario('none'); // clear
```

`offline` rejects the request the way a dropped connection does, rather than
answering `503`, so the interface's real network path is what gets exercised.

## Looking at an empty inbox

The seed gives every persona activity, so a populated bell is what signing in always
shows — and the empty state, the other half of the notification feature, is not
reachable by using the demo. Arm it to answer the inbox endpoints as a brand-new
account's would be answered:

```js
const { setInboxEmpty } = await import('/src/mocks/support/inbox');
setInboxEmpty(true); // the bell goes quiet and the inbox shows its empty state
setInboxEmpty(false); // back to the seeded inbox
```

Arming it affects the list, the unread count and the per-record actions together, so
the surfaces cannot disagree about whether anything is waiting.

## Demonstrating the role matrix

The demo has two teams and six sign-in personas: one per role per team. One person
deliberately holds a different role in each team — `kade-orvane` is the Product Owner
of Team Cindra and the Scrum Master of Team Pell — so switching team is enough to
see a different set of permissions, without editing a fixture.

The teams have more Developers than the panel offers cards for. Those members stay
in the universe and are reached from inside the product; a second Developer card
would sign in with the same role, into the same team, and prove nothing the first
one does not.

Every persona signs in with the same published password (`DEMO_PASSWORD` in
`fixtures/personas.ts`).

## Coverage

Every endpoint the application calls is served from here:

| Domain                  | Module                                            |
| ----------------------- | ------------------------------------------------- |
| auth, privacy, params   | `auth` · `privacy` · `systemParams`               |
| teams and groups        | `teams` · `teamGroups`                            |
| backlog and definitions | `productGoals` · `productBacklog` · `definitions` |
| sprints                 | `sprints` · `sprintBacklog`                       |
| Daily Scrum             | `dailyScrum` · `dailyScrumSchedule`               |
| events and timeboxes    | `impediments` · `timebox`                         |
| Sprint closure          | `increments` · `sprintReview` · `retrospectives`  |
| Scrum Master surfaces   | `smDashboard` · `healthCheck` · `facilitation`    |
| reporting               | `reports` · `sprintConfig`                        |
| notifications           | `notifications`                                   |

A module serves the whole endpoint family, including the parts the interface does
not call yet: `notifications` answers `DELETE /notifications/:id`, which no screen
exposes, because a mock that only served what the interface happens to use could not
answer the next screen that does. Each domain's contract test says which shapes are
pinned.

`handlers/index.ts` is the single ordered registry: MSW stops at the first
handler that responds, so a literal path segment has to be registered before a
`:id` route that would swallow it. Each module already orders its own routes that
way; the registry only decides which domain is consulted first.

A refusal carries the gate code and status the real API would return, read from
the shared `GATE_DEFINITIONS` contract rather than chosen per call site, so the
interface can present the rule, the Guide clause and the recovery for it. A gate
a module does not model is a gate the real API does not have either — inventing
one here would make the demo refuse something the product allows.
