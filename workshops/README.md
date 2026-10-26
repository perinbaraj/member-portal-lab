# Spec-driven brownfield workshop

**One requirement, one implementation, one review.** Use the existing Member
Portal to practice a complete, bounded AI-assisted development lifecycle in
VS Code with GitHub Copilot Chat.

This branch intentionally contains neither generated Spec Kit scaffolding nor
the claims-filter implementation. Learners initialize Spec Kit in the existing
repository, create the constitution, review and adapt a reference specification
and plan, generate tasks, implement the change, and decide whether to accept it.

## Start here

Complete [setup and environment verification](prework.md) before the event.
Then follow the six linked guides in order. Each contains numbered actions,
copy-ready terminal commands and Chat prompts, expected outputs, and recovery.

| Step | Detailed participant guide | Exit checkpoint |
| --- | --- | --- |
| 1 | [Orient in the brownfield application](steps/01-orient.md) | Explain the existing claims flow and change boundary |
| 2 | [Initialize Spec Kit and the constitution](steps/02-initialize-and-constitution.md) | Review generated tooling and project guardrails |
| 3 | [Review and adapt the specification](steps/03-specify.md) | Approve behavior against the acceptance contract |
| 4 | [Review the plan and generate tasks](steps/04-plan-and-tasks.md) | Approve consistent, bounded implementation tasks |
| 5 | [Implement, test, and check convergence](steps/05-implement-and-test.md) | Working change with actual automated evidence |
| 6 | [Customize the reviewer and accept the feature](steps/06-review-and-accept.md) | Human review decisions and acceptance record |

Keep the [behavior contract and acceptance checklist](acceptance.md) open beside
your work. Use [guided reference artifacts and recovery](reference/README.md)
throughout steps 3 and 4, not only when blocked. The [core roadmap](core.md)
provides a compact view of the same journey.

## Event boundary

The event has a **tentative three-hour core plus a one-hour buffer**, with
welcome, discussion, a break, and wrap-up inside the core boundary. Installation
and account troubleshooting are prework. The buffer is for recovery and finishing
the same feature, not additional required exercises. This is a delivery target,
not a claim that participant completion has been timed and validated.

The default is guided adaptation of reference spec/plan material through Spec
Kit. Independent blank-page generation is an optional alternative, not another
required pass. Never cut tests, member isolation, pagination, review, or human
acceptance to catch up. Facilitators use the [run of show](facilitator.md#run-of-show).

## Follow-on work and facilitator resources

| Path | Activity | Starting point |
| --- | --- | --- |
| Optional | [Build multiple role-specific custom agents](optional/custom-agents.md) | Reviewed core spec and plan |
| Optional | [Appeal eligibility and an in-memory draft](optional/claim-appeals.md) | Accepted core feature |
| Facilitator | [Preparation, delivery, and validation status](facilitator.md) | Before inviting participants |

Follow-on workshops are outside the required core and buffer. Completing them
is not a condition of core completion.

## What you will practice

1. Inspect brownfield code and repository instructions.
2. Initialize Spec Kit in place and establish project guardrails.
3. Evaluate and adapt a specification and plan, then produce executable tasks.
4. Use bounded Copilot agent execution to implement and test those tasks.
5. Customize one read-only reviewer agent.
6. Evaluate evidence and make a human acceptance decision.

Here, "agentic workflow" means this sequential execution and handoff. It does not
mean GitHub Actions, a parallel agent fleet, or unattended permission bypasses.

## Dependency boundary

The app uses its existing Node.js dependencies and in-memory fixtures. Spec Kit is
a local development tool, not an application service. Copilot needs the usual
account access and network connectivity.

No path requires a Redis service, database, Docker, cloud deployment, MCP server,
or CI workflow. The existing `ioredis` package is unused by these activities.
Appeals are eligibility checks and drafts only: nothing is submitted or persisted.

Use only the repository's synthetic fixtures. Do not paste real member data,
health information, tokens, or credentials into prompts or workshop artifacts.
