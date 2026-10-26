# Guided reference artifacts and recovery

The default core journey is **review and adapt**, not blank-page generation.
These examples provide the content for the active specification and plan that
Spec Kit creates. They are not active feature artifacts, an approved solution,
or a completed application; `spec-workshop` remains the unfinished starter.

[Workshop home](../README.md) ·
[Specify checkpoint](../steps/03-specify.md) ·
[Plan and tasks checkpoint](../steps/04-plan-and-tasks.md) ·
[Binding behavior contract](../acceptance.md)

| Artifact | Use |
| --- | --- |
| [Reference specification](spec.md) | Starting content for guided specification and human scope review |
| [Reference implementation plan](plan.md) | Starting approach for guided planning against the existing code |
| [Example executable tasks](tasks.md) | Compare generated checkbox tasks, dependencies, and test-first ordering |

## Prerequisites

Complete [prework](../prework.md),
[orientation](../steps/01-orient.md), and
[initialization and constitution](../steps/02-initialize-and-constitution.md)
in your own checkout. The documented tool version is **Spec Kit 1.2.3**.
Initialization must have created `.specify` and Copilot's `/speckit-*` skills,
and you must have reviewed `.specify\memory\constitution.md` against repository
instructions. Keep normal tool approvals and the reviewer's read/search-only
permissions. Do not initialize a new application.

Use the following prompts in **Copilot Chat**, not a terminal. They preserve
Spec Kit's scaffold and helper prerequisites while adapting the supplied content.
Keep the reference directory here; never copy it wholesale into `specs`, rename
it as your active feature, or overwrite an existing learner feature.

## 1. Establish the active specification

At [checkpoint 3](../steps/03-specify.md), select the chat skill and submit:

```text
/speckit-specify
Use workshops/reference/spec.md as the starting specification and
workshops/acceptance.md as the binding behavior contract. This is guided
scaffolding and adaptation, not an independent blank-page specification.
Create the active feature directory and requirements checklist through the
normal skill workflow. Preserve all behavior, member isolation, pagination,
UI resilience, and exclusions; adapt the reference to this checkout.
Do not implement, modify application code, change permissions, commit, or push.
```

Inspect the feature directory actually reported by the skill under `specs`;
do not guess its name or assume it matches your Git branch. It must contain
`spec.md` and `checklists\requirements.md`. Retain its generated metadata, not
the reference's illustrative metadata or reference-navigation links. Stay on
your learner branch; no Git extension is required for this workshop.

Read the active specification against [acceptance](../acceptance.md), answer
any clarification questions from that contract, and correct omissions yourself
or with a bounded follow-up. Resolve every requirements-checklist item by
reviewing and fixing the spec, not by blindly ticking boxes. Implementation
must not bypass an incomplete checklist.

## 2. Establish the plan and required supporting artifacts

After human specification review, at
[checkpoint 4](../steps/04-plan-and-tasks.md) submit:

```text
/speckit-plan
Plan the active approved claims-filter specification, using
workshops/reference/plan.md as the starting approach and
workshops/acceptance.md as the binding behavior contract. Follow the normal
planning workflow to create plan.md, research.md, data-model.md, contracts/,
and quickstart.md in the active feature directory. Adapt them to the existing
code and constitution. Reuse existing dependencies and synthetic fixtures;
keep member isolation, API/client compatibility, pagination, and resilient UI.
Generate planning artifacts only. Do not implement, expand scope, change
permissions, commit, or push.
```

Read `plan.md` and inspect all supporting artifacts. Remove invented
infrastructure, unresolved placeholders, and any conflicting behavior. Check
the API response, typed client, and UI consumer together. `contracts` describes
the existing local HTTP API, not a new downstream service. `data-model.md`
describes existing claims and pagination metadata, not new persistence.
`quickstart.md` describes checks and the later human browser handoff, not
claimed results. If any required artifact is missing, finish this workflow
before generating tasks.

## 3. Generate and review executable tasks

Only after human plan review, submit:

```text
/speckit-tasks
Generate tasks for the active approved specification, plan, and supporting
artifacts. Use workshops/reference/tasks.md as a format and coverage example,
not a file to copy unchanged. Write unique - [ ] T001-style checkbox tasks
with concrete file paths and dependencies. Include tasks to add meaningful
Vitest/Supertest tests and run them to observe expected failures before the
implementation they cover. Keep the API contract and typed client in one phase.
Include actual npm test, npm run typecheck, and npm run build execution.
Do not invent setup already satisfied by this app or new dependencies.
Exclude human browser checks, reviewer customization, finding decisions,
scope approval, and final acceptance from executable checkbox tasks.
Do not implement, change permissions, commit, or push.
```

Compare the active `tasks.md` with [the example](tasks.md). It must be an
agent-executable checkbox list, not just a task table. Check that tests come
before their implementation, prerequisites are explicit, and tasks address
the contract without fixture changes or unrelated refactors. Human review,
browser evidence, and acceptance remain in
[checkpoint 6](../steps/06-review-and-accept.md); they cannot be agent-completed.

Proceed to [implementation and testing](../steps/05-implement-and-test.md)
only when the active specification, plan, supporting artifacts, and tasks are
coherent and human-reviewed. Generated text alone is not implementation evidence.

### Optional independent generation

Learners who want additional practice may ask the same skills to generate the
specification and plan from the requirement and existing code without using the
reference content. The scaffold, supporting artifacts, human reviews, task
format, and acceptance contract remain mandatory. Choose one route; independent
generation is not a second required pass after guided adaptation.

## Nondestructive recovery

1. Keep your current checkout and files intact.
2. Read the reference artifact for the checkpoint where you are blocked.
3. Ask Copilot to reconcile your active artifact with the approved contract, and
   review the proposed changes yourself before proceeding. Use the relevant
   skill above to restore missing scaffold or supporting artifacts; copying a
   reference `spec.md`, `plan.md`, or `tasks.md` alone does not create them.
4. If your checkout is unusable, make a separate clone of the repository, check
   out `spec-workshop`, complete prework, and repeat the initialization and
   constitution checkpoint there. Do not reset or clean your original checkout.
5. Do not copy an authentication token, environment file, or member data into a
   recovery checkout.

## Validation status

The [facilitator report](../facilitator.md#validation-status) records a prior
scripted sandbox run with a person acting as both participant and model:
1.2.1 for the full flow, and 1.2.3 for initialization, skills, and helpers.
It is not evidence of live VS Code skill discovery, real model-driven execution
or timing, human browser/accessibility testing, or participant completion.
The newly documented guided adaptation route is not a new end-to-end rehearsal.

During this documentation update, the local `specify version` reported
`0.9.4.dev0`, not 1.2.3. An isolated
`uv tool run --from specify-cli==1.2.3 specify version` attempt failed downloading
package metadata from PyPI's file host with a TLS handshake error. No TLS or
execution-policy bypass and no global upgrade was used. Consequently a fresh
1.2.3 initialization/helper run was **not** verified here. Do not substitute
the installed version's output as proof of the documented version's behavior.
Resolve package access through the facilitator's approved source and rehearse
in a separate disposable checkout before advertising the route as validated.
