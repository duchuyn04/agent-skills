# Parallel Frontend and Backend Work

How to plan and build a feature so the frontend and backend tracks run at the same time without waiting for each other. Both tracks build against one written API contract and one set of shared fixtures. They meet at the end-to-end tests, which run against the real backend.

Skills that use this reference: `spec-driven-development`, `planning-and-task-breakdown`, `api-and-interface-design`, `incremental-implementation`, `frontend-ui-engineering`, `test-driven-development`.

## When to Use

- A feature has UI work and backend work, and the UI tasks currently depend on backend tasks.
- Two people or two agents will work on the same feature at once.
- The UI needs data shapes that the spec does not define yet.

**When NOT to use:** a change that touches only one side, or a feature small enough that one person finishes both sides in one sitting. The contract and fixtures cost more than they save there.

## The Artifacts

| Artifact | Default location | Purpose |
|---|---|---|
| API contract | `tasks/[module]/api-contract.md` | The data shape of every route and realtime event the feature adds or changes |
| Shared fixtures | `spec/fixtures/[module]/*.json` | Example requests, responses and events that both sides test against |
| Shared task list | `tasks/[module]/todo.md` | Shared conventions, finished foundation tasks, checkpoints, end-to-end tasks, acceptance |
| Backend task list | `tasks/[module]/todo-backend.md` | Tasks of the backend track |
| Frontend task list | `tasks/[module]/todo-frontend.md` | Tasks of the frontend track |
| Progress board | "Task List" section of `tasks/[module]/plan.md` | The only place that shows which tasks are done |

Follow the repository's existing layout when it already has a place for specs, plans or fixtures.

## The Contract

Write the contract before either track starts a task that depends on it.

For each route, record:

- method and path, and the permission it needs;
- request fields with type, limits and nullability;
- response status and response fields with type and nullability;
- every error code the route can return, with HTTP status and the condition;
- the fixture file and example names that illustrate the route;
- the backend task that builds it and the frontend task that uses it;
- an "Available since" column: the backend task that made the route real, or "not yet".

For each realtime event (SSE, WebSocket), record the event name, the data shape, the backend task that emits it and what the client does when it arrives.

Contract rules that keep the two sides from drifting:

- Use one success envelope and one error envelope for the whole feature, for example `{ data }` and `{ error: { code, message, details? } }`.
- A nullable field is always present with the value `null`. The backend never omits the key.
- Write timestamps as ISO 8601 in UTC. Write enum values the same way everywhere.
- Unknown realtime event names are ignored by the client, so the backend can add events without breaking older clients.
- Values that wait on an open question still get a fixed shape. The backend returns `null` or an empty list until the question is settled, and the contract states what the UI shows meanwhile. The frontend never waits on an open question that only changes values.
- List proposed limits (lengths, ranges, page sizes) in a "Proposed limits" section for the user to approve. Both sides build against the proposed values.
- End the file with a dated change log.

## Shared Fixtures

Fixtures are JSON files that both test suites read from the same path. Use one file per area of the contract.

```json
{
  "description": "Example requests and responses for the customer routes.",
  "examples": [
    {
      "name": "create conversation the first time",
      "method": "POST",
      "path": "/api/support/conversations",
      "request": null,
      "status": 201,
      "response": { "data": { "id": "c-1", "status": "open", "session": null } }
    }
  ]
}
```

Event fixtures use `{ "description": "...", "events": [{ "name": "...", "data": {} }] }`.

Include at least one success example and the main error examples for each route.

## Contract Tests on Both Sides

Add one small task per track before the feature tasks:

1. **Backend contract checker.** A test helper that loads a fixture example by file and name, then compares a real response with it. The helper checks the HTTP status, the exact key set, and the value kind (string, number, boolean, object, array) at every path. It does not compare values, because IDs and timestamps differ on each run. A `null` on either side matches any kind. The error message names the key path, for example `data.session.status`.
2. **Frontend fixture reader and fake routes.** A unit-test helper that loads fixture examples, and an end-to-end helper that serves a fixture example for a route that the backend does not have yet. The same helper can serve a stream of fixture events.

Then every backend task that adds a route adds a contract test against its fixture examples, and every frontend task adds a unit test that its runtime schema (for example `zod`) parses every fixture example it uses. Prove each contract test with one mutation: remove a key or change a type and watch it fail.

## Splitting the Task List

1. Keep shared material in `todo.md`: conventions, finished foundation tasks, checkpoints, and the tasks where the tracks meet.
2. Move each track's tasks into `todo-backend.md` or `todo-frontend.md`, with the track's own conventions at the top.
3. Make every UI task depend on the frontend fixture task and on earlier UI tasks only. Write the old backend dependency as history, for example "Before <date> this task waited on BE-07."
4. Give each backend task acceptance criteria for its contract test and for any contract field it adds.
5. Mark UI criteria that need the real backend with "Verify end to end in <E2E task>". A UI task passes when that criterion works against fixtures.
6. Make the end-to-end tasks depend on both tracks. Give them two criteria: the spec runs against the real backend, and the spec contains no fake route for the feature's paths.

## The Progress Board

The "Task List" section of `plan.md` is the single progress board. Put each task on its own line, grouped by track:

```markdown
Backend track (`todo-backend.md`):
- [ ] BE-04 open a waiting session
- [ ] BE-05 callback requests

Frontend track (`todo-frontend.md`):
- [ ] FE-07 customer chat page
```

One line per task matters for git. Two people tick different lines on different branches, and git merges the ticks without conflicts. A single line listing a whole phase conflicts on every tick.

When a task passes:

1. Tick its acceptance criteria in the track's task file.
2. Tick its line on the progress board.
3. Update the "Available since" cell in the contract when the task made a route real.

## Knowing When to Remove Fake Data

The frontend gets two signals.

**Automatic signal.** Before the end-to-end fake-route helper installs fake data, it reads the backend's route listing, for example the OpenAPI document at `/api/openapi/v1.json`. If the listing already has that method and path, the helper fails the test with a message such as "Backend already has `POST /api/support/callback-requests`. Remove the fake data for this route." Match concrete paths against templated paths, so `/conversations/abc/csat` matches `/conversations/{id}/csat`. Read the listing once per run.

**Human signal.** The "Available since" cell in the contract and the ticked line on the progress board.

Two rules make the automatic signal reliable:

- The frontend never calls the browser-level fake-route API (for example Playwright's `page.route`) directly for the feature's paths. Only the helper may install fake routes, because only the helper checks the backend first.
- Every new backend route appears in the route listing.

The signals reach the frontend branch in this order:

1. The backend track merges a task into the main branch after the user approves it.
2. The frontend track merges the main branch into its branch at least once a day.
3. The frontend runs its end-to-end tests.
4. The helper fails on the route the backend just finished.
5. The frontend removes the helper call for that route.
6. The frontend runs the end-to-end tests again against the real route.

If step 6 fails, the two tracks read the contract differently. Compare both sides with the contract before changing code.

Fake realtime events have no automatic signal when the event endpoint already exists. The end-to-end tasks where the tracks meet check real events.

## Changing the Contract

Do not change a data shape in code before changing the contract. The other side would read wrong data and no test would say so.

1. Edit the contract and the fixture files in the same commit.
2. Add a line to the contract's change log.
3. Name the change in the task handoff for the other track.
4. Run the contract tests on both sides.

The side that has not updated sees its contract test fail, and updates its code until the test passes.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The frontend can start once the backend is done" | That serializes the work. A written contract lets both sides start on day one. |
| "We'll agree on the shape in chat" | Chat is not testable. Fixtures that both suites load are. |
| "I'll call `page.route` directly, it's just one test" | That fake route never warns when the backend lands, so the end-to-end test keeps passing against fake data. |
| "One line per phase is tidier on the board" | It conflicts on every tick when two branches update it. |
| "The value isn't decided, so the UI has to wait" | Fix the shape now and return `null` until the value is decided. |

## Red Flags

- A UI task lists a backend task as a dependency.
- A response field is omitted instead of returned as `null`.
- A route exists in code but not in the contract, or the reverse.
- The end-to-end tasks still contain fake routes for the feature.
- Two people tick the same line of the progress board.
- A shape change lands in code without a fixture change in the same commit.

## Verification

- [ ] Every route and event of the feature is in the contract, with fixture examples.
- [ ] No UI task depends on a backend task.
- [ ] Both contract helpers exist and each has a passing mutation check.
- [ ] Each task is on its own line on the progress board.
- [ ] The end-to-end tasks run against the real backend with no fake routes for the feature.
