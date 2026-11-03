---
description: Break work into small verifiable tasks with acceptance criteria and dependency ordering
disable-model-invocation: true
---

Invoke the duchuyn04-agent-skills:planning-and-task-breakdown skill.

Read the existing spec (SPEC.md or equivalent) and the relevant codebase sections. Then:

1. Enter plan mode: read only, no code changes
2. Identify the dependency graph between components
3. Slice work vertically (one complete path per task, not horizontal layers)
4. Write tasks with acceptance criteria and verification steps
5. Add checkpoints between phases
6. Present the plan for human review

Pick the module folder tasks/[module]/, where [module] is the kebab-case id of the module or batch of work the plan covers (for example tasks/support-desk/). Create the folder if it does not exist. Never write the plan or the task list directly under tasks/.

Save the plan to tasks/[module]/plan.md and task list to tasks/[module]/todo.md. Add or update the module's row in tasks/README.md: folder, content with the task ID prefix, and status.

If tasks/[module]/plan.md or tasks/[module]/todo.md already exists with unchecked tasks for different work, stop and ask before writing: never silently overwrite an incomplete plan.
