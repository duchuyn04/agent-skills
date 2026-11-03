---
name: planning-and-task-breakdown
description: Breaks work into ordered tasks. Use when you have a spec or clear requirements and need to break work into implementable tasks. Use when a task feels too large to start, when you need to estimate scope, or when parallel work is possible.
---

# Planning and Task Breakdown

## Overview

Decompose work into small, verifiable tasks with explicit acceptance criteria. Good task breakdown is the difference between an agent that completes work reliably and one that produces a tangled mess. Every task should be small enough to implement, test, and verify in a single focused session.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human
- The implementation order isn't obvious

**When NOT to use:** Single-file changes with obvious scope, or when the spec already contains well-defined tasks.

## The Planning Process

### Step 1: Enter Plan Mode

Before writing any code, operate in read-only mode:

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document saved to `tasks/[module]/plan.md` and a task list recorded in the task list target (see Output Files; default `tasks/[module]/todo.md`), not implementation.

### Step 2: Identify the Dependency Graph

Map what depends on what:

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

Implementation order follows the dependency graph bottom-up: build foundations first.

The edge from "API endpoints" to "Frontend API client" is the one to cut when a feature has UI and backend work. Write the API contract and shared fixtures first. Then the UI tasks depend on the contract, not on the endpoint tasks, and the two tracks run in parallel. See "Parallel Frontend and Backend Tracks" below.

### Step 3: Slice Vertically

Instead of building all the database, then all the API, then all the UI: build one complete feature path at a time:

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

Each vertical slice delivers working, testable functionality.

### Step 4: Write Tasks

Each task follows this structure, whether it lands in the markdown task list or as an item in an external tracker (see Output Files):

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

**Verification:**
- [ ] Tests pass: [the repository's focused-test command]
- [ ] Build succeeds: [the repository's build command]
- [ ] Manual check: [description of what to verify]

**Dependencies:** [Task numbers this depends on, or "None"]

**Track:** [backend | frontend | shared] (only when the plan uses parallel tracks)

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 files | Large: 5+ files]
```

### Step 5: Order and Checkpoint

Arrange tasks so that:

1. Dependencies are satisfied (build foundation first)
2. Each task leaves the system in a working state
3. Verification checkpoints occur after every 2-3 tasks
4. High-risk tasks are early (fail fast)

Add explicit checkpoints to the task list target:

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1-2 | One component or endpoint | Add a new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering and pagination |
| **XL** | 8+ | **Too large: break it down further** | - |

If a task is L or larger, it should be broken into smaller tasks. An agent performs best on S and M tasks.

**When to break a task down further:**
- It would take more than one focused session (roughly 2+ hours of agent work)
- You cannot describe the acceptance criteria in 3 or fewer bullet points
- It touches two or more independent subsystems (e.g., auth and billing)
- You find yourself writing "and" in the task title (a sign it is two tasks)

## Output Files

- **Plan document:** Save the implementation plan to `tasks/[module]/plan.md`. This is always a markdown file: design decisions, risks, and open questions don't map cleanly onto individual tracker issues.
- **Task list:** Record each task in the **task list target** (defined below).

### One Folder per Module

Every plan lives in its own subfolder of `tasks/`. Never write the plan or the task list directly under `tasks/`.

1. Name the folder after the module or the batch of work the plan covers, in kebab-case. Use the module id from the spec or capability map when one exists, for example `tasks/support-desk/`. A cross-cutting batch gets its own name, for example `tasks/rest-routes/`.
2. Create `tasks/` and `tasks/[module]/` if they do not exist.
3. Pick a short task ID prefix for the module, for example `SD` for `support-desk`. Number its tasks `SD-01`, `SD-02`, and so on.
4. Keep every file of the plan in that folder: `tasks/[module]/plan.md`, `tasks/[module]/todo.md`, and when they exist `todo-backend.md`, `todo-frontend.md` and `api-contract.md`.
5. Keep `tasks/README.md` as the index of all module folders. Create it with the first module. Give it one row per folder with the folder, its content and task ID prefix, and its status. Update the status when the module finishes a phase or a checkpoint.

A minimal `tasks/README.md`:

```markdown
# Plans and task lists

Each subfolder is one module or one batch of work. Each folder holds the plan (decisions, dependency graph, phases, progress) and the task list (tasks with acceptance criteria).

| Folder | Content | Status |
|---|---|---|
| `support-desk/` | `support-desk` module (prefix `SD`) | Phase 2 in progress |
```

If the repository already keeps a plan or a task list directly under `tasks/` from older work, do not move it on your own. Ask the user whether to move it into a module folder.

**Never overwrite an incomplete plan.** Before writing `tasks/[module]/plan.md` or `tasks/[module]/todo.md`, check whether they already exist and still contain unchecked tasks:

- Same work being replanned (the user asked to revise or extend this plan) → update the existing files in place.
- Different work → **stop and ask.** The unchecked tasks may be mid-build in another session. Do not delete, overwrite, or rename the existing files on your own; present the conflict and let the user decide (finish the old plan first, explicitly discard it, or tell you where the new plan should go).

The same rule applies to an external task list target: never bulk-close or delete another plan's open tracker items to make room for new ones.

### Task List Target

The task list target is where tasks and checkpoints are recorded. It is defined once, here; every other reference in this skill defers to it.

- **Default: a checklist-style markdown file at `tasks/[module]/todo.md`.** This is the convention the `/build` command and other downstream tooling expect. Use it unless the project says otherwise.
- **External tracker:** if the project's agent rules (`CLAUDE.md`, `AGENTS.md`, etc.) or the user designate an issue tracker (e.g. GitHub Issues, Jira, Linear, `bd`/beads), create one tracker item per task instead of writing `tasks/[module]/todo.md`. Map the Step 4 structure onto the tracker's fields: acceptance criteria and verification steps in the item body, dependencies via the tracker's linking mechanism (`bd dep add`, "blocked by", etc.). Record Step 5 checkpoints as tracker items too, or as a checklist in the plan document if the tracker has no natural equivalent.

When using an external tracker, note it in `tasks/[module]/plan.md` (e.g. "Tasks tracked in Linear project FOO") so downstream steps and future sessions know where to look, and keep the plan document's Task List section as an ordered index of tracker item IDs or links rather than a duplicate checklist.

**Parallel tracks:** when the plan splits work into a backend track and a frontend track, the markdown target becomes three files:

- `tasks/[module]/todo.md`: shared conventions, checkpoints, and the tasks where the tracks meet;
- `tasks/[module]/todo-backend.md`: the backend track;
- `tasks/[module]/todo-frontend.md`: the frontend track.

The Task List section of the plan document stays the single progress board. `/build` reads `tasks/[module]/todo.md`, so start each track's session by naming its track file as the task list.

## Plan Document Template

```markdown
# Implementation Plan: [Feature/Project Name]

## Summary
[Plain-language summary a beginner can follow: what we build, for whom, and the order of work. Explain each technical term at first use.]

## Overview
[One paragraph summary of what we're building]

## Architecture Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [Question needing human input]
```

When tasks live in an external tracker, keep the Task List section above as an ordered index of tracker item IDs or links instead of a duplicate checklist.

Put each task on its own line in the Task List, never a whole phase on one line. Two people who tick tasks on different branches then edit different lines, and git merges their ticks without conflicts.

The plan document is prose, so the house rules for Markdown apply: load the `humanizer:humanizer` skill before writing it, and follow the controlled-writing rules in `../../references/house-rules.md`.

## Parallelization Opportunities

When multiple agents or sessions are available:

- **Safe to parallelize:** Independent feature slices, tests for already-implemented features, documentation
- **Must be sequential:** Database migrations, shared state changes, dependency chains
- **Needs coordination:** Features that share an API contract (define the contract first, then parallelize)

### Parallel Frontend and Backend Tracks

When a feature has UI work and backend work, plan two tracks that share only a written contract. The full method is in `../../references/parallel-frontend-backend.md`. In the plan:

1. Add a task that writes the API contract and the shared fixtures, or write them during planning.
2. Add one contract-checker task per track: a backend helper that compares real responses with fixtures, and a frontend helper that reads fixtures and serves fake routes.
3. Make UI tasks depend on the frontend helper and earlier UI tasks only. Record any removed backend dependency as history.
4. Give every backend task that adds a route a contract-test criterion.
5. Mark UI criteria that need the real backend with "Verify end to end in <E2E task>".
6. Make the end-to-end tasks depend on both tracks. Require that they run against the real backend with no fake routes.
7. Draw the dependency graph as two columns, one per track, plus the meeting point.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll figure it out as I go" | That's how you end up with a tangled mess and rework. 10 minutes of planning saves hours. |
| "The tasks are obvious" | Write them down anyway. Explicit tasks surface hidden dependencies and forgotten edge cases. |
| "Planning is overhead" | Planning is the task. Implementation without a plan is just typing. |
| "I can hold it all in my head" | Context windows are finite. Written plans survive session boundaries and compaction. |
| "The old `tasks/[module]/plan.md` is stale, I'll just replace it" | Unchecked tasks may be mid-build in another session. Overwriting them destroys work state that exists nowhere else. Stop and ask. |
| "The UI can't start until the endpoint exists" | It can start once the contract and fixtures exist. Waiting serializes two people's work. |

## Red Flags

- Starting implementation without a written task list
- Overwriting a `tasks/[module]/plan.md` or `tasks/[module]/todo.md` that still has unchecked tasks for different work, without asking
- Writing `tasks/[module]/todo.md` when the project has designated an external tracker (or scattering tasks across both)
- Tasks that say "implement the feature" without acceptance criteria
- No verification steps in the plan
- All tasks are XL-sized
- No checkpoints between tasks
- Dependency order isn't considered
- A UI task depends on a backend task in a feature that has no API contract yet
- Several tasks share one checkbox line in the Task List

## Verification

Before starting implementation, confirm:

- [ ] Every task has acceptance criteria
- [ ] Every task has a verification step
- [ ] Task dependencies are identified and ordered correctly
- [ ] Tasks are recorded in the task list target (default `tasks/[module]/todo.md`)
- [ ] No pre-existing incomplete plan was overwritten without explicit user confirmation
- [ ] No task touches more than ~5 files
- [ ] Checkpoints exist between major phases
- [ ] Each task has its own line in the Task List
- [ ] A feature with UI and backend work has an API contract, shared fixtures, and no UI task that waits on a backend task
- [ ] The plan opens with a plain-language summary
- [ ] The human has reviewed and approved the plan

## See Also

Acceptance criteria are per-task and answer "did we build the right thing?". They sit on top of the project-wide Definition of Done, the standing bar every task clears before it counts as done. See `../../references/definition-of-done.md`.
