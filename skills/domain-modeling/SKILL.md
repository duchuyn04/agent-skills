---
name: domain-modeling
description: Builds and sharpens a project's domain model by challenging vague terms, testing them with edge-case scenarios, and writing the result into GLOSSARY.md and the decision record at once. Use when the same concept has several names in the code or the conversation, when the user uses an overloaded term, when writing or editing a GLOSSARY.md, or when a design decision needs recording. Not for only reading the glossary to pick names.
---

# Domain Modeling

## Overview

Code reads well when its names match the language of the business. Code turns into spaghetti when one concept has three names, or one name covers three concepts, and every reader must guess. This skill is the active habit of fixing that: challenge terms, test them with scenarios, and write the answer down the moment it is settled.

Reading `GLOSSARY.md` to choose a name is a one-line habit any skill can do. Use this skill when you are changing the model, not only consuming it.

## When to Use

- The user says "account" and the code has both `User` and `Customer`
- A new feature introduces a concept the glossary does not define
- Two modules disagree on what a word means
- You are writing or editing `GLOSSARY.md`
- A design choice is hard to reverse and a future reader will ask why

**When NOT to use:**

- Choosing a variable name inside one function: follow house rules section 5
- Writing an API contract: use `api-and-interface-design`
- Recording a decision with no domain meaning: use `documentation-and-adrs` directly

## File layout

Most repositories have one context:

```
/
|-- GLOSSARY.md
|-- docs/
|   `-- adr/
|       |-- 0001-event-sourced-orders.md
|       `-- 0002-postgres-for-write-model.md
`-- src/
```

When a `GLOSSARY-MAP.md` exists at the root, the repository has several contexts. The map lists where each lives and how they relate:

```
/
|-- GLOSSARY-MAP.md
|-- docs/adr/                 (decisions for the whole system)
`-- src/
    |-- ordering/
    |   |-- GLOSSARY.md
    |   `-- docs/adr/         (decisions for this context)
    `-- billing/
        |-- GLOSSARY.md
        `-- docs/adr/
```

Create files lazily. Write `GLOSSARY.md` when the first term is settled. Create `docs/adr/` when the first decision needs recording. If several contexts exist, find which one the topic belongs to. Ask when it is unclear.

## Process

Run these steps during the conversation, not after it.

1. Challenge against the glossary. When a term conflicts with `GLOSSARY.md`, say so at once: "Your glossary defines cancellation as X, but you seem to mean Y. Which one?"
2. Sharpen fuzzy words. When a term is vague or overloaded, propose one precise term: "You say account. Do you mean the Customer or the User? They are different things."
3. Test with concrete scenarios. Invent edge cases that force a precise answer: "A customer cancels one line of a three-line order. Is that a cancellation of the Order or a change to it?"
4. Cross-check the code. When the user describes how something works, compare it with the code and report conflicts: "The code cancels whole Orders, but you said partial cancellation exists. Which one is right?"
5. Update `GLOSSARY.md` inline. Write each term as soon as it is settled. Do not batch.
6. Offer a decision record only when all three conditions hold (see below).

## GLOSSARY.md format

```md
# {Context name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**:
A request from a customer to buy items, accepted by the shop.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account
```

Rules for the file:

- Pick one best word per concept and list the rejected words under `_Avoid_`.
- Keep each definition to one or two sentences. Define what the thing is, not what it does.
- Include only terms specific to this context. General programming ideas such as timeouts, error types and utility patterns do not belong, even when the project uses them a lot.
- Group terms under subheadings when natural clusters appear.
- Keep implementation details out. `GLOSSARY.md` is not a spec, a scratch pad or a list of decisions.

A `GLOSSARY-MAP.md` lists the contexts and their relations:

```md
# Glossary map

## Contexts

- [Ordering](./src/ordering/GLOSSARY.md): receives and tracks customer orders
- [Billing](./src/billing/GLOSSARY.md): creates invoices and takes payments

## Relationships

- Ordering to Billing: Ordering emits `OrderPlaced`, Billing consumes it to create an invoice
- Ordering and Billing share the types `CustomerId` and `Money`
```

## When to offer a decision record

Offer a decision record only when all three are true:

1. It is hard to reverse. Changing your mind later has a real cost.
2. It is surprising without context. A future reader will wonder why it was done this way.
3. It came from a real trade-off. Genuine alternatives existed and one was chosen for specific reasons.

If one condition is missing, skip the record. Easy decisions get reversed. Unsurprising ones need no explanation. A choice with no alternative has nothing to record.

What usually qualifies: the architectural shape, how contexts talk to each other, technology with lock-in, which context owns which data, deliberate deviations from the obvious path, constraints that the code does not show (compliance, partner contracts), and rejected options whose rejection is not obvious.

Follow the `documentation-and-adrs` skill for the file location, numbering and template. Match the repository's existing ADR convention first. When the repository has none, use `docs/adr/0001-slug.md`.

## Using the glossary in code

- Name modules, types and files with glossary terms. If the glossary defines "Order", write "the Order intake module", not "the OrderHandler" and not "the Order service".
- Rename code that uses an `_Avoid_` word when the change is part of the task. Do not rename unrelated code (see `using-agent-skills`, scope discipline).
- Use the terms as names for seams. A good seam usually sits where one glossary concept ends and another begins. See `codebase-design`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "Everyone knows what 'account' means here" | Two people know two different things. The code will show both meanings within a month. Ask which one. |
| "I will update the glossary at the end" | Terms settled in conversation are forgotten by the end. Write each one when it is settled. |
| "A glossary entry can explain how it is implemented" | Implementation details change and make the glossary wrong. Keep it to meaning. |
| "Every decision deserves an ADR" | Records that nobody needs bury the ones that matter. Apply the three-part test. |
| "Synonyms are harmless" | Each synonym is a new concept to a reader. Pick one word and list the others under `_Avoid_`. |
| "The code is the documentation" | Code shows what happens. It does not show which of two similar words is the right one. |

## Red Flags

- One concept appears under two or more names in the code
- One name is used for two different concepts in different modules
- A class named `Manager`, `Handler`, `Helper` or `Data` with no glossary term behind it
- `GLOSSARY.md` holds method names, table columns or configuration
- A decision record for a choice that is easy to reverse
- A hard-to-reverse choice with surprising effects and no record
- The conversation changed a term and the file did not

## Verification

After a modeling session, confirm:

- [ ] Every term settled in the session is in `GLOSSARY.md`, with `_Avoid_` words where synonyms existed
- [ ] No glossary entry describes implementation
- [ ] Each conflict between the code and the user's description was surfaced, with the answer recorded
- [ ] Every decision record meets all three conditions and follows the repository's ADR convention
- [ ] New names in code use glossary terms
