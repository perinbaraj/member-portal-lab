# Core: claims filtering, from requirement to acceptance

Start with [prework](prework.md), then follow the six linked checkpoints in order
in your own checkout or learner branch based on `spec-workshop`. The application
is an unfinished brownfield starter: you implement one bounded claims-filter and
pagination change, not a replacement portal.

The event boundary is a **tentative three-hour core plus a one-hour buffer**.
Installation is prework. Use the buffer for recovery, review, and completion,
not additional required features; checkpoint readiness, not elapsed time, decides
whether to proceed.

| Checkpoint | Activity | Evidence before moving on |
| --- | --- | --- |
| [1. Orient](steps/01-orient.md) | Inspect the running app, code, and requirement boundary | Explain the current claims flow and intended change without edits |
| [2. Initialize and constitution](steps/02-initialize-and-constitution.md) | Initialize Spec Kit in place; create and review guardrails | Generated tooling and a reviewed constitution; app unchanged |
| [3. Specify](steps/03-specify.md) | Generate the active feature scaffold using the reference specification | Human-reviewed active `spec.md` and complete requirements checklist |
| [4. Plan and tasks](steps/04-plan-and-tasks.md) | Adapt the reference plan; generate executable tasks | Consistent planning artifacts and test-first checkbox tasks |
| [5. Implement and test](steps/05-implement-and-test.md) | Implement bounded tasks; inspect the diff and run checks | Actual test/typecheck/build results and reviewed convergence gaps |
| [6. Review and accept](steps/06-review-and-accept.md) | Customize the read-only reviewer; evaluate findings and check behavior | Browser evidence and an explicit human acceptance decision |

## One guided route

[Acceptance](acceptance.md) is the behavior contract.
[Reference artifacts](reference/README.md) are inputs to supported Spec Kit
generation, not files to copy into an arbitrary folder or automatic approval.
The core uses `/speckit-specify` to establish the active feature and checklist,
then `/speckit-plan` to create planning artifacts from the reviewed reference
plan, then `/speckit-tasks` to generate executable work. Humans review each
handoff. Independent blank-page specification/plan generation is an optional
alternative, not a second required exercise.

Each detailed page labels terminal, Chat, editor, and browser actions, gives a
stop decision, and includes nondestructive recovery. If blocked, preserve your
work, identify the unmet checkpoint, and use its recovery instructions with the
facilitator. Do not skip tests, member isolation, pagination, review, or human
acceptance to catch up. A generated success message is not working evidence.

No new packages, Redis service, database, external APIs, deployment, broad
refactoring, commits, or pushes are required. Retain normal tool approvals.
The reviewer stays read/search only; browser checks and acceptance remain human
work, never agent-completable tasks.

[Workshop home](README.md) · [Begin checkpoint 1](steps/01-orient.md) ·
[Acceptance checklist](acceptance.md)
