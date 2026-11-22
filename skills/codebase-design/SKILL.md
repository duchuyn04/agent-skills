---
name: codebase-design
description: Gives a shared vocabulary and rules for designing deep modules, meaning a small interface over a lot of behavior, placed at a clean seam and tested through that interface. Use when deciding where a module's interface and seam go, when making new code easy to test without mocking internals, or when a design sketch needs checking against the deletion test. Also use when another skill needs the deep-module terms.
---

# Codebase Design

## Overview

A deep module hides a lot of behavior behind a small interface. Callers learn little and get a lot. Maintainers fix a bug in one place. Tests cross the same interface that callers use.

Spaghetti code is the opposite shape: many shallow modules, each a thin wrapper, so one concept is spread over many files and every change touches all of them. This skill gives the words and the rules to design against that shape. Use the words exactly, because consistent language is what lets two agents or two people agree on a design.

## When to Use

- Choosing where a module's interface and seam go
- Merging a cluster of small modules that always change together
- Making code testable without mocks of internal parts
- Reviewing a design sketch before any code exists
- Another skill (for example `improve-codebase-architecture`) needs the vocabulary

**When NOT to use:**

- Designing a REST or GraphQL contract for outside consumers: use `api-and-interface-design`
- Cleaning up the body of one function: use `code-simplification`
- The code is a throwaway script with one caller

## Vocabulary

Use these terms. Do not swap in "component", "service", "API" or "boundary".

| Term | Meaning | Avoid |
|---|---|---|
| Module | Anything with an interface and an implementation. It can be a function, a class, a package or a slice across tiers. | unit, component, service |
| Interface | Everything a caller must know to use the module correctly: types, invariants, ordering rules, error modes, required configuration, performance traits. | API, signature (both too narrow) |
| Implementation | The code inside the module. | |
| Depth | The behavior a caller or test can use per unit of interface they must learn. Deep means much behavior behind a small interface. Shallow means the interface is nearly as complex as the implementation. | |
| Seam | A place where you can change behavior without editing at that place. It is the location where a module's interface lives. | boundary (overloaded with the DDD bounded context) |
| Adapter | A concrete thing that satisfies an interface at a seam. The word names a role, not what is inside. | |
| Leverage | What callers get from depth: more capability per unit of interface learned. | |
| Locality | What maintainers get from depth: change, bugs, knowledge and verification stay in one place. | |

Relationships: a module has one interface. Depth is measured against that interface. A seam is where the interface lives. An adapter sits at a seam and satisfies the interface. Depth gives leverage to callers and locality to maintainers.

## Deep and shallow

```
Deep module                       Shallow module (avoid)
+---------------------+           +---------------------------------+
|   Small interface   |           |        Large interface          |
+---------------------+           +---------------------------------+
|                     |           |   Thin implementation           |
|  Deep implementation|           |   (passes calls through)        |
|                     |           +---------------------------------+
+---------------------+
```

When you design an interface, ask three questions:

1. Can I reduce the number of methods?
2. Can I simplify the parameters?
3. Can I hide more complexity inside?

## Principles

1. Depth belongs to the interface, not to the implementation. A deep module may be built from small, swappable parts. Those parts stay private. A module can have internal seams for its own tests, plus the external seam at its interface.
2. Apply the deletion test. Imagine deleting the module. If the complexity disappears, the module was a pass-through. If the complexity reappears in N callers, the module earned its place.
3. The interface is the test surface. Callers and tests cross the same seam. A test that must reach past the interface means the module has the wrong shape.
4. One adapter means a hypothetical seam. Two adapters mean a real one. Add a seam only when something truly varies across it.
5. Keep the shape honest about size. Depth is not the ratio of implementation lines to interface lines, because that ratio rewards padding. Measure depth as leverage.

## Designing for testability

1. Accept dependencies, do not create them inside the module.

   ```typescript
   // Dễ test: cổng thanh toán được truyền vào từ ngoài
   function processOrder(order: Order, paymentGateway: PaymentGateway) {}

   // Khó test: module tự tạo dependency thật
   function processOrder(order: Order) {
     const gateway = new StripeGateway();
   }
   ```

2. Return results, do not mutate arguments.

   ```typescript
   // Dễ test: trả về kết quả để test so sánh trực tiếp
   function calculateDiscount(cart: Cart): Discount {}

   // Khó test: sửa trực tiếp dữ liệu truyền vào
   function applyDiscount(cart: Cart): void {
     cart.total -= discount;
   }
   ```

3. Keep the surface small. Fewer methods mean fewer tests. Fewer parameters mean simpler test setup.

## Deepening a cluster of shallow modules

Before merging a cluster, classify what it depends on. The class decides how the merged module is tested across its seam.

| Class | Example | How to deepen |
|---|---|---|
| In-process | Pure computation, in-memory state | Merge the modules. Test through the new interface. No adapter. |
| Local-substitutable | A database with a local stand-in such as PGLite, an in-memory filesystem | Merge. Run the stand-in in the test suite. The seam stays internal. |
| Remote but owned | Your own service across a network | Define a port (an interface) at the seam. Inject the transport as an adapter. Use an HTTP adapter in production and an in-memory adapter in tests. |
| True external | Stripe, Twilio, other third parties | Inject the dependency as a port. Tests supply a mock adapter. |

Seam discipline:

- Do not add a port unless at least two adapters are justified, usually production and test. A seam with one adapter is only indirection.
- Keep internal seams private. Do not widen the interface just because a test uses an internal seam.

Replace tests, do not layer them:

1. Write new tests at the deepened module's interface.
2. Delete the old unit tests on the shallow modules they replace. They now test internals.
3. Assert on outcomes visible through the interface, not on internal state.
4. If a test must change when only the implementation changes, it tests past the interface. Rewrite it.

## Design it twice

The first interface idea is rarely the best. When the user wants to explore alternatives for a chosen module, design it several ways in parallel and compare.

1. Frame the problem for the user first. Write the constraints the interface must satisfy, the dependencies it needs and their class from the table above, and a rough code sketch that makes the constraints concrete. The sketch is not a proposal. Show this, then continue at once while the user reads.
2. Spawn three or more sub-agents in parallel, each with a fresh context. Give each a separate technical brief: file paths, coupling details, dependency class, and what sits behind the seam. Give each a different constraint:
   - Agent 1: minimize the interface to one to three entry points, with maximum leverage per entry point.
   - Agent 2: maximize flexibility for many use cases and extension.
   - Agent 3: optimize for the most common caller, so the default case is trivial.
   - Agent 4, when it applies: design around ports and adapters for the cross-seam dependencies.
3. Put the vocabulary from this skill and the project's `GLOSSARY.md` terms into every brief. Each sub-agent then names things the same way.
4. Run every sub-agent on the main session's model and effort, and copy the house rules into the brief (`../../references/house-rules.md`, section 10).
5. Ask each sub-agent to return: the interface (types, methods, parameters, invariants, ordering, error modes), a usage example, what the implementation hides, the dependency strategy and adapters, and the trade-offs.
6. Present the designs one at a time. Then compare them in prose on depth, locality and seam placement.
7. End with your own recommendation and say why. If parts of two designs combine well, propose the hybrid. Give a strong opinion, not a menu.

## Related skills

- `api-and-interface-design`: contracts for outside consumers, versioning, error semantics
- `domain-modeling`: names for the concepts that make good seams
- `improve-codebase-architecture`: scans an existing codebase for deepening candidates using this vocabulary
- `code-simplification`: reduces complexity inside a module without changing its interface
- `test-driven-development`: writes the tests that cross the interface

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Small modules are always cleaner" | Many small modules with wide interfaces push the complexity onto callers. Run the deletion test: if the complexity reappears across callers, merge. |
| "I will add an interface now in case we swap the implementation later" | One adapter is a hypothetical seam. Add the seam when a second adapter is real, usually the test one. |
| "I extracted a pure function so it is testable" | If the bugs live in how callers use it, the test proves nothing about them. Test through the module that owns the behavior. |
| "Tests need access to the internals" | A test that reaches past the interface couples to the implementation. Change the module's shape or test the outcome. |
| "A layer per concern keeps things tidy" | A layer that only forwards calls is a shallow module. Delete it and see what breaks. |
| "I will say 'service' or 'component', everyone understands" | Mixed words hide whether you mean an interface, a module or a seam. Use the vocabulary. |

## Red Flags

- A change to one concept edits five or more small files
- A module whose interface is as long as its body
- A wrapper whose methods forward arguments to one other call
- An interface or port with a single implementation and no test adapter
- Tests that mock the module's own helpers
- Tests that fail after a refactor that kept behavior the same
- Design discussion that uses "service", "component", "API" and "boundary" for the same thing

## Verification

After designing or changing a module, confirm:

- [ ] The interface lists everything a caller must know, including invariants, ordering and error modes
- [ ] The deletion test result is stated for each module you keep or remove
- [ ] Every seam has two adapters, or the reason for a single adapter is written down
- [ ] Tests cross the module's interface and assert on outcomes
- [ ] Old unit tests of merged shallow modules are deleted, not kept beside the new tests
- [ ] The design and its explanation use only the vocabulary above
