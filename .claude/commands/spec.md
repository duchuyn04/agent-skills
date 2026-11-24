---
description: Start spec-driven development; write a structured specification before writing code
disable-model-invocation: true
---

Invoke the duchuyn04-agent-skills:spec-driven-development skill.

Begin by understanding what the user wants to build. Ask clarifying questions about:
1. The objective and target users
2. Core features and acceptance criteria
3. Tech stack preferences and constraints
4. Known boundaries (what to always do, ask first about, and never do)

Then generate a structured spec covering all six core areas: objective, commands, project structure, code style, testing strategy, and boundaries.

If the request bundles several independently testable capabilities, first propose a capability map (module ids, dependency direction, build order) per the skill's Phase 0 and get it approved, then spec each module in dependency order.

Save the spec as SPEC.md in the project root and confirm with the user before proceeding.

## Load these skills when they apply

Only when the condition holds. Skip the rest.

- The request is vague or has several valid readings: invoke `duchuyn04-agent-skills:interview-me` first. If the idea itself is still unformed, invoke `duchuyn04-agent-skills:idea-refine`.
- The spec leans on business terms that need one agreed meaning: invoke `duchuyn04-agent-skills:domain-modeling`.
- The spec depends on a framework or library whose current behavior you are unsure of: invoke `duchuyn04-agent-skills:source-driven-development` and check the official docs before fixing requirements.
