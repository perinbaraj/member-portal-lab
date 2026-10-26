# Spec-driven brownfield workshop

**One requirement, one implementation, one review.** Use the existing Member
Portal to practice a complete, bounded AI-assisted development lifecycle in
VS Code with GitHub Copilot Chat.

This branch intentionally contains neither generated Spec Kit scaffolding nor
the claims-filter implementation. Learners initialize Spec Kit in the existing
repository, create the constitution, write the specification, review the plan
and tasks, implement the change, and decide whether to accept the result.

## Choose a path

| Path | Activity | Starting point |
| --- | --- | --- |
| Required prework | [Prepare and verify the environment](prework.md) | This branch |
| Core event | [Claims filtering: requirement to accepted change](core.md) | Verified starter |
| Optional workshop | [Build multiple role-specific custom agents](optional/custom-agents.md) | Core spec and plan; code completion is not required |
| Optional workshop | [Appeal eligibility and an in-memory draft](optional/claim-appeals.md) | Completed core feature |
| Reference only | [Recovery and example artifacts](reference/README.md) | Use only if blocked or comparing outcomes |
| Facilitator only | [Preparation and delivery checklist](facilitator.md) | Before the event |

The core is designed for the 3-3.5-hour event, including discussion and recovery.
Optional workshops are separate follow-on activities, not an extra checklist
inside the event. Completing optional work is not a condition of core completion.

## What you will practice

1. Inspect brownfield code and repository instructions.
2. Initialize Spec Kit in place and establish project guardrails.
3. Turn a requirement into a specification, implementation plan, and tasks.
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
