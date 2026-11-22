---
name: improve-codebase-architecture
description: Scans an existing codebase for deepening opportunities, meaning clusters of shallow modules that can become deep ones, presents them as a visual HTML report, then works through the candidate the user picks. Use when one concept is spread over many small files across the codebase, when modules are tangled or leak across their seams, or when the user asks for an architecture review or a refactoring plan across modules.
---

# Improve Codebase Architecture

## Overview

Find architectural friction and propose deepening opportunities: refactors that turn shallow modules into deep ones. The aim is code that is testable and easy for a person or an agent to navigate.

The review uses two inputs:

- The vocabulary and principles of the `codebase-design` skill (module, interface, depth, seam, adapter, leverage, locality, the deletion test). Use these words in every finding. Do not drift into "component", "service", "API" or "boundary".
- The project's domain language in `GLOSSARY.md` and the decisions in `docs/adr/`. Domain terms name good seams. Existing ADRs record decisions this review must not reopen without a strong reason.

This skill finds and ranks candidates. It does not change code and does not design interfaces yet.

## When to Use

- The user reports spaghetti code, tangled dependencies or "I cannot find where X happens"
- A change keeps touching many small files for one concept
- Tests exist but bugs hide in how functions are called, not inside them
- A part of the codebase is untested or hard to test through its current interface
- The user asks for an architecture review before a larger refactor

**When NOT to use:**

- Simplifying one function or file: use `code-simplification`
- Reviewing a diff before merge: use `code-review-and-quality`
- Designing a new module from scratch: use `codebase-design`
- Planning a data or API migration: use `deprecation-and-migration`

## Process

### 1. Explore

Decide where to look before you look. Deepening a module pays off when the module changes again, so give extra weight to recently active areas.

1. If the user named a direction (a module, a subsystem, a pain point), take it and skip step 2.
2. Otherwise run `git log --oneline` over a good stretch of history. Find the hot spots: files and folders that keep coming up. Look there first. If the changes are scattered with no hot spot, widen the search.
3. Read `GLOSSARY.md` and the ADRs for the area you will touch.
4. Spawn a sub-agent with a fresh context to walk the codebase. Run it on the main session's model and effort, and copy the house rules into its brief (`../../references/house-rules.md`, section 10). Tell it to explore freely and note where it feels friction:
   - Where does understanding one concept mean jumping between many small modules?
   - Where is a module shallow, with an interface nearly as complex as its implementation?
   - Where was a pure function extracted for testing while the real bugs hide in how it is called (no locality)?
   - Where do tightly coupled modules leak across their seams?
   - Which parts are untested, or hard to test through their interface?
5. Apply the deletion test to each shallow suspect. Would deleting the module concentrate the complexity, or only move it? A "concentrates" answer is the signal you want.

### 2. Present candidates as an HTML report

1. Write one self-contained HTML file outside the repository, so nothing lands in the project. Use `$TMPDIR`, falling back to `/tmp` (or `%TEMP%` on Windows). Name it `architecture-review-<timestamp>.html`, so each run gets a fresh file.
2. Open the file for the user (`xdg-open`, `open` or `start`, by platform) and tell them its absolute path.
3. Give each candidate a card with:
   - Files: the files and modules involved
   - Problem: why the current structure causes friction
   - Solution: a plain description of what would change
   - Benefits: stated as locality and leverage, plus how the tests improve
   - Before and after diagram, drawn side by side
   - Recommendation strength: `Strong`, `Worth exploring` or `Speculative`
4. End with a Top recommendation: which candidate to tackle first and why.
5. Use `GLOSSARY.md` terms for the domain and `codebase-design` terms for the architecture. If the glossary defines "Order", write "the Order intake module", not "the FooBarHandler" and not "the Order service".
6. Handle ADR conflicts with care. Surface a candidate that contradicts an ADR only when the friction is real enough to reopen it. Mark it in the card, for example: "contradicts ADR-0007, but worth reopening because ...". Do not list every refactor an ADR forbids.

The full scaffold, diagram patterns and style rules are in [references/html-report.md](references/html-report.md). Read it before you write the file.

Do not propose interfaces yet. When the file is written, ask: "Which of these would you like to explore?"

### 3. Work through the chosen candidate

When the user picks a candidate, walk the decision tree with them, one question at a time, using the method of the `interview-me` skill. Cover the constraints, the dependencies and their class (see the deepening table in `codebase-design`), the shape of the deepened module, what sits behind the seam, and which tests survive.

Update the domain model as decisions settle, following the `domain-modeling` skill:

- A deepened module named after a concept missing from `GLOSSARY.md`: add the term. Create the file if it does not exist.
- A fuzzy term sharpened in the conversation: update `GLOSSARY.md` right then.
- The user rejects a candidate for a load-bearing reason: offer an ADR, for example "Want me to record this as an ADR so future architecture reviews do not suggest it again?". Offer it only when a future explorer would need the reason. Skip reasons like "not now" and reasons that are obvious.
- The user wants alternative interfaces: use the design-it-twice procedure in `codebase-design`.

When the design is settled, hand the work to `planning-and-task-breakdown` for the slices, then `incremental-implementation` and `test-driven-development` to build. Keep behavior unchanged until a test proves the new interface equal to the old one. Use the replace-do-not-layer test strategy from `codebase-design`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I will propose the new interfaces in the report, it saves a round" | The user has not picked a candidate. Interfaces proposed early get thrown away. Present candidates first. |
| "Every module is a candidate, list them all" | A long flat list hides the strong ones. Rank by the deletion test and by recent change. |
| "I do not need the history, I can see the code" | Hot spots come from history. Without them you review stable code that nobody touches. |
| "The ADR forbids it, but I will suggest it anyway" | Suggest it only when the friction is real, and mark the conflict. |
| "A diagram is decoration, prose is enough" | The report exists to show shape. If a diagram needs a paragraph, redraw the diagram. |
| "Calling these 'services' is clearer to the user" | The words are how two people agree on a design. Use the `codebase-design` vocabulary. |

## Red Flags

- The report was written inside the repository
- Candidates describe a new interface or a code change
- Candidates use "component", "service", "API" or "boundary" as architecture terms
- No candidate states the deletion test result
- The review ignored `GLOSSARY.md` and `docs/adr/`
- The sub-agent ran on a different model or effort than the main session, with no instruction from the user
- A candidate has no before and after diagram

## Verification

After the review, confirm:

- [ ] The scope came from the user's direction or from commit history, and the report says which
- [ ] The HTML file sits outside the repository and its absolute path was given to the user
- [ ] Every candidate has files, problem, solution, benefits, a before and after diagram, and a strength badge
- [ ] Every candidate states the deletion test result
- [ ] The text uses `codebase-design` terms for the architecture and `GLOSSARY.md` terms for the domain
- [ ] ADR conflicts are marked, and no ADR was reopened without real friction
- [ ] No interface was proposed before the user picked a candidate
- [ ] Terms and decisions settled afterwards were written to `GLOSSARY.md` or an ADR
