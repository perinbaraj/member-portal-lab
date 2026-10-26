# Optional workshop: build a small role-specific agent team

**Follow-on work, outside the core and its buffer.** Start with the
[reviewed core specification and plan](../steps/04-plan-and-tasks.md).
You may do this before implementing the core code; testing/review activities
can continue once an implementation exists.

Use the same VS Code Copilot Chat session tools. No hosted workflow, GitHub
Actions, Redis, MCP server, extra runtime, or new npm package is needed.

## Requirement

Create two additional agents with distinct responsibilities and demonstrate a
human-controlled analyst -> implementation -> test -> review handoff. Reuse the
core reviewer as the third specialized role. This is not parallel orchestration.

## Activity 1: design the boundaries

Before writing profiles, define each role's input, output, allowed tools, and stop:

| Role | Input | Output and stop condition |
| --- | --- | --- |
| Requirement analyst | Requirement, repository context, existing spec | Ambiguities, acceptance criteria, and scope risks; no code edits |
| Test specialist | Approved spec/plan and current implementation | Focused tests and actual results; no production-code edits |
| Reviewer | Approved artifacts, diff, and supplied evidence | Requirement-linked findings; no edits or command execution |

Do not create a role just to duplicate another role. Keep the ordinary
implementation agent responsible for production-code fixes.

## Activity 2: author the analyst

Create `.github\agents\workshop-analyst.agent.md` using:

```markdown
---
name: workshop-analyst
description: Challenge the workshop requirement and return reviewable acceptance criteria.
tools: ['read', 'search']
---
Read the requested feature and repository instructions.
Do not edit files, execute commands, or implement.
Return unresolved questions, acceptance criteria, exclusions, and relevant files.
Distinguish facts observed in code from assumptions. Stop after this handoff.
```

Customize it with a domain criterion: member-scoped results and totals must not
leak across members. Select it in the VS Code agent picker and ask it to challenge
the core requirement. Decide which suggestions belong in the spec yourself.

**Checkpoint:** the analyst produces useful questions without editing anything.

## Activity 3: author the test specialist

Create `.github\agents\workshop-test-specialist.agent.md`:

```markdown
---
name: workshop-test-specialist
description: Add focused workshop tests and report results without editing production code.
tools: ['read', 'search', 'edit', 'execute']
---
Read the approved spec, plan, repository instructions, and existing test file.
Edit only tests for the requested feature.
Use the existing runner; do not install packages, weaken checks, modify production
code, change tool permissions, commit, or push.
Run focused tests through normal approval controls and report actual results.
For a production bug, return a failing test and a handoff instead of fixing it.
Stop after test evidence and unresolved failures.
```

The instructions constrain its work, but are not a filesystem sandbox. Review
tool requests and diffs; tool availability is not authorization to edit any file.

Ask it for a small missing case, such as filtered totals with `pageSize=1`, based
on your current implementation. If existing tests already cover that behavior,
have it identify another justified gap rather than duplicate coverage.

**Checkpoint:** tests are meaningful, only intended test files changed, and
failures are reported honestly. Read-only roles still have no execute/edit tools.

## Activity 4: run an explicit handoff

1. Give the analyst the requirement. Review and update the spec yourself.
2. Give the ordinary implementation agent the approved spec/plan/tasks.
3. Give the test specialist the implementation and a bounded coverage question.
4. Give `workshop-reviewer` the approved artifacts, diff, and actual results.
5. Accept/reject findings and use the implementation agent for approved fixes.

Pass artifact paths and concise evidence between roles. Do not rely on another
agent having access to an earlier chat's hidden context.

## Acceptance and review

- All profiles are discoverable in the VS Code agent picker.
- Analyst and reviewer tool lists are read/search only.
- Test specialist has a narrow file/task boundary and reports real runner output.
- Each handoff names inputs, expected outputs, and a stop condition.
- Production fixes return to the implementation role.
- Tool approvals remain enabled and humans evaluate the results.
- No new infrastructure, packages, cloud workflows, or automatic commits appear.

Record one example where you corrected an agent's assumption or rejected a
finding. **Done** means the role boundaries worked and the handoffs helped, not
that the team generated the most files or invoked the most agents.

[Workshop home](../README.md) |
[Core review and acceptance](../steps/06-review-and-accept.md)
