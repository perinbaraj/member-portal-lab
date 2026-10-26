# 4. Plan and tasks: prepare executable, bounded work

[Previous: specify](03-specify.md) · [Core roadmap](../core.md) ·
[Workshop home](../README.md) · [Next: implement and test](05-implement-and-test.md)

## Purpose and prerequisites

Turn the approved behavior into an architecture-compatible plan and executable
tasks. Finish [specification review](03-specify.md), including its checklist,
and keep the exact active feature directory available. Read the
[reference plan](../reference/plan.md), [reference task guidance](../reference/tasks.md),
and [acceptance contract](../acceptance.md).

Use `/speckit-plan` to adapt the reference and create its normal ancillary
artifacts. Do not replace that workflow with a raw file copy. Tasks come only
after human planning review.

## Actions

1. **Editor — compare the reference plan with the source.** Inspect:

   | Source | Planning implication |
   | --- | --- |
   | [Current claims route](../../server/server.ts) and [data helper](../../server/data.ts) | Extend this list path; keep member scoping and fixture order |
   | [HTTP client](../../src/services/httpClient.ts) and [types](../../src/types.ts) | Preserve `claims` and update the client/view contract together |
   | [ClaimsList](../../src/components/ClaimsList.tsx) and [styles](../../src/App.css) | Add bounded UI state/controls without rewriting other screens |
   | [API tests](../../tests/server.test.ts) | Extend existing Vitest/Supertest patterns |
   | [Package scripts](../../package.json) and [TS configuration](../../tsconfig.json) | Use existing checks and state their coverage honestly |

   Keep library and file choices here, rather than turning the specification
   into an implementation recipe.

2. **Copilot Chat — generate the plan from the reviewed reference.**

   ```text
   /speckit-plan
   Read the ACTIVE approved claims-filter spec and constitution, plus
   workshops/reference/plan.md and workshops/acceptance.md.
   Adapt that reference plan to the existing repository and approved spec.
   Reuse Express, Zod, the member-scoped in-memory helper, React hooks,
   the typed HTTP client, and Vitest/Supertest. Preserve the claims response
   property and update its client/UI consumer for pagination metadata together.
   Use existing synthetic fixtures and pageSize=1 for meaningful pagination
   checks; include the contract's optional browser address pageSize behavior.
   Do not add dependencies, services, Redis, database storage, deployment,
   fixture expansion, or broad route refactors.
   Run the normal planning workflow for this SAME active feature, producing
   plan.md and the required research, data-model, contracts, and quickstart
   artifacts. Include automated verification and describe the separate human
   browser/review/acceptance handoff. Generate planning artifacts only.
   Do not implement, change permissions, commit, or push.
   Report all artifact paths and decisions that need human review.
   ```

3. **Editor — review the whole planning handoff.** Expect the active feature
   directory to contain `plan.md`, `research.md`, `data-model.md`, `contracts\`,
   and `quickstart.md` as well as its existing spec/checklist. Read `plan.md`
   closely and skim every ancillary artifact for contradictions and placeholders.

   Confirm that:

   - Queries use route-level Zod validation, including empty/repeated values,
     and errors remain generic.
   - Member scope precedes status filtering, totals, and slicing; the route has
     no new foreign-member selector.
   - API metadata and the typed client/ClaimsList contract change coherently.
   - UI controls remain available on empty/error states; status changes reset
     page one; obsolete requests cannot replace the latest result.
   - Browser `?pageSize=1` and the default/invalid address behavior match the
     acceptance contract without changing fixture data.
   - The validation plan names real existing commands and includes auth failure,
     malformed inputs, paging boundaries, and member isolation.
   - No new dependency, infrastructure, route-wide refactor, or invented
     performance/accessibility measurement appears.

   Correct the artifacts directly or request a focused revision of the same
   active plan. A plan header labeled "Branch" may identify the feature directory,
   not your Git branch; do not switch branches to make that label match.
   A human must approve this handoff before generating implementation tasks.

4. **Copilot Chat — generate executable tasks, with tests first.**

   ```text
   /speckit-tasks
   Use the SAME active feature's human-reviewed spec, plan, contracts,
   data model, and research. Read workshops/reference/tasks.md for guidance
   and workshops/acceptance.md for coverage; do not copy a reference table.
   Generate tasks.md in the installed Spec Kit executable checkbox format,
   with task IDs, concrete file paths, dependencies, and story/parallel
   markers where appropriate.
   Require focused Vitest/Supertest test tasks BEFORE the implementation
   they cover, including running them to establish the expected failure.
   Keep the API contract and typed client/UI update in one coherent phase.
   Cover validation, filtering, pagination, authentication, member isolation,
   and UI loading/error/empty/stale-response behavior using existing fixtures.
   Include test execution, backend typecheck, and build evidence.
   Omit setup that this project already satisfies.
   Do not create executable checkbox tasks for human browser acceptance,
   reviewer finding decisions, final scope review, or final acceptance.
   Keep those in the separate human acceptance handoff.
   Do not implement, commit, or push.
   ```

5. **Editor — audit `tasks.md` before handing it to an agent.** It must contain
   executable checkboxes, not only a prose table. A task line should have the
   general shape `- [ ] T001 ... concrete action and file path`; retain the
   generated template's appropriate story and parallel markers.

   Check dependency order, especially tests before their code changes and client
   updates with the API contract. Tests should distinguish behavior: an
   unfiltered result or a count that leaks another member must fail, not merely
   check that a constant exists. A red test result is expected during test-first
   work, but unrelated setup failures are not useful feature evidence.

   Ensure real check execution is included. Remove human-only checkbox tasks:
   browser checks, accept/reject reviewer findings, and the final decision belong
   to [checkpoint 6](06-review-and-accept.md), not `/speckit-implement`.
   Do not mark those activities done just because an agent wrote instructions.

6. **Terminal and editor — confirm scope and handoff.**

   ```text
   git status --short
   git diff --stat
   ```

   Inspect new untracked artifacts in Source Control too. At this checkpoint,
   application code should still be unchanged. Read `spec.md`, `plan.md`, and
   `tasks.md` together once and record your approval or unresolved issues.

## Expected output and checkpoint decision

One active feature has a reviewed specification, consistent planning/ancillary
artifacts, and executable checkbox tasks with test-first ordering. Human browser,
review, and acceptance work is clearly separate.

**Proceed** only after the human review confirms agreement and a usable
`tasks.md` exists. **Stop** for missing artifacts, inconsistent contracts,
unchecked requirements, scope expansion, or human work assigned to the agent.

## Common blockers and nondestructive recovery

| Blocker | Recovery |
| --- | --- |
| Plan targets the wrong feature or cannot find prerequisites | Return to [checkpoint 3](03-specify.md) and verify active state and the existing scaffold. Do not create a second folder or switch branches as a workaround. |
| Ancillary artifacts are missing or invented | Ask the same planning session to finish/correct only this feature's normal artifacts using the approved reference. Preserve prior reviewed decisions. |
| Task output is only a table or lacks executable checkboxes | Rerun a focused `/speckit-tasks` correction against the approved artifacts; consult [reference guidance](../reference/README.md). Do not hand the table to implementation. |
| Tests are after implementation or human gates are checkboxes | Reorder the test dependencies and remove human tasks before implementation. Keep the human checklist in [acceptance](../acceptance.md). |
| Tool proposes new packages or services | Reject the expansion and repair the plan/tasks. The starter already has the necessary runtime and test dependencies. |

**Optional alternative, not a second pass:** independent plan generation may
start from the approved specification and existing source instead of the
reference plan. Choose it instead of action 2; ancillary artifacts, human review,
and executable test-first tasks remain mandatory.

## Official resources

- [Spec Kit: planning and task workflow](https://github.github.io/spec-kit/quickstart.html)
- [VS Code: Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)

[Previous: specify](03-specify.md) · [Workshop home](../README.md) ·
[Next: implement and test](05-implement-and-test.md)
