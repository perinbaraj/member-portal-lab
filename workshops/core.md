# Core: claims filtering, from requirement to acceptance

Prerequisite: complete [prework](prework.md). Work in your own checkout or feature
branch based on `spec-workshop`. Leave `lab-guide` untouched.

This is one exercise with five checkpoints. Do not start the optional workshops
until the core has been accepted. Do not ask Copilot to implement the whole
repository or fix every pre-existing issue.

## 1. Orient: inspect before changing

Run `npm run dev`, open the Claims view, and locate:

- `server\server.ts`: authentication middleware and `GET /api/claims`.
- `server\data.ts`: the existing member-scoped data helper.
- `src\components\ClaimsList.tsx`: current rendering.
- `src\services\httpClient.ts`: typed HTTP methods.
- `tests\server.test.ts`: the established API tests.
- `.github\copilot-instructions.md`: constraints the change must respect.

In Copilot Chat, ask:

```text
Inspect the claims list flow and repository instructions, excluding lab-guide.
Explain the existing API shape, member scoping, UI consumer, and test conventions.
Identify only the files needed for a status filter with pagination.
Do not edit files or implement the feature.
```

**Checkpoint:** you can explain what already works, what will change, and why
refills, appeals, Redis, deployment, and broad refactoring are out of scope.

## 2. Specify: review the intended behavior

Use the bundled **/speckit.specify** prompt in Copilot Chat:

```text
/speckit.specify
As a signed-in member, I want to filter my claims by status and navigate the
results so I can find relevant claims without seeing another member's data.
Use workshops/acceptance.md as the behavior contract. This is a bounded change
to the existing application, not a rebuild. Exclude lab-guide and optional
workshops. Generate the specification only; do not implement.
```

Select the prompt through chat completion. Follow the invocation shown in
[prework](prework.md); chat prompts are not terminal commands. Spec Kit creates a
numbered learner feature branch and an active directory under `specs`; the shared
`spec-workshop` branch remains the preparation baseline.

Read the generated `spec.md`. Resolve missing behaviors directly or use Spec
Kit's `/speckit.clarify` prompt if questions remain. Check:

- Existing claim statuses, default "All statuses", and empty matches.
- Pagination defaults, limits, totals, and invalid-query behavior.
- Member isolation, generic errors, and no new PHI logging.
- Accessible filter/navigation controls and no unrelated feature work.

**Checkpoint:** a human has reviewed and corrected the specification.

## 3. Plan and tasks: constrain the implementation

Use **/speckit.plan**:

```text
/speckit.plan
Plan the approved claims-filter specification against this repository. Reuse
Express, Zod, the member-scoped in-memory helper, React hooks, the typed HTTP
client, and Vitest/Supertest. Preserve the claims response property and update
its UI consumer for pagination metadata. Do not add dependencies, external
services, Redis, database storage, route-wide refactors, or changes to lab-guide.
Include focused tests and the browser checks in workshops/acceptance.md.
Generate the plan only.
```

Review `plan.md`, then run **/speckit.tasks**. Inspect that the tasks:

- Update the API contract and client together.
- Cover validation, filtering, pagination, member isolation, and UI states.
- Add meaningful tests, not just assertions that constants exist.
- Include test execution and manual acceptance, not just code generation.

**Checkpoint:** `spec.md`, `plan.md`, and `tasks.md` agree and stay within scope.
Use the [reference artifacts](reference/README.md) only if you are blocked.

## 4. Implement and test: execute bounded tasks

Use **/speckit.implement**:

```text
/speckit.implement
Implement the approved tasks for the claims-filter feature only. Follow the
constitution and repository instructions. Keep all fixtures synthetic and leave
lab-guide and optional workshops untouched. Run the relevant checks, repair
failures caused by this change, and report the exact commands and results.
Do not change tool permissions, weaken checks, commit, or push.
```

Review tool requests normally. Inspect the diff rather than assuming generated
code is correct. If Copilot proposes new infrastructure or unrelated cleanup,
reject that expansion and return to the approved tasks.

Stop the development processes before running the starter's API tests, as noted
in prework. Run the checks in [acceptance](acceptance.md), then restart the app. In
particular, use a small page size to demonstrate multiple pages; the starter
fixtures are not large enough to prove the default page size visually.

Optionally use `/speckit.analyze` for artifact consistency. Completion requires
the checks and human acceptance below; this pinned release does not use a
converge command. A clean generation message is not evidence of working behavior.

**Checkpoint:** relevant checks pass and the claims UI demonstrates the approved
contract. Preserve actual command results for the reviewer.

## 5. Customize, review, and accept

Open `.github\agents\workshop-reviewer.agent.md`. Replace its participant
customization sentence with a concrete criterion, for example:

```text
Verify that status filtering happens before pagination, totals are member-scoped,
and changing status resets the UI to page one.
```

Save the file and select **workshop-reviewer** in the VS Code Chat agent picker.
Provide the feature directory and your diff/test evidence:

```text
Review my claims-filter change against the approved spec, plan, tasks, and
workshops/acceptance.md. Use the diff and test results I provide as evidence.
Do not edit files or execute commands. Separate confirmed defects from missing
evidence, and identify requirement-linked findings with file and line references.
```

Read each finding. Accept or reject it with a reason. Switch back to the normal
implementation agent for accepted fixes, then rerun only the relevant checks.
Do not give the reviewer write or terminal tools just to make a handoff work.

Perform the browser acceptance checklist yourself and record:

- What passed and what remains unresolved.
- Which review findings you accepted or rejected, and why.
- Whether the requirement is accepted, with supporting evidence.

**Done:** the feature works, checks support the contract, and a human has accepted
it. Optional workshops are not part of this exit condition.
