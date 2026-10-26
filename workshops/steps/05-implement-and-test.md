# 5. Implement and test: execute bounded tasks

[Previous: plan and tasks](04-plan-and-tasks.md) · [Core roadmap](../core.md) ·
[Workshop home](../README.md) · [Next: review and accept](06-review-and-accept.md)

## Purpose and prerequisites

Implement the reviewed tasks, inspect the resulting code, and collect real
verification evidence. Finish [planning and task review](04-plan-and-tasks.md):
the correct feature is active, the requirements checklist is complete, and
`tasks.md` contains executable, test-first work without human-only gates.

Keep the [acceptance contract](../acceptance.md), active artifacts, and
[package scripts](../../package.json) available. Stop your development processes
before API tests: [server.ts](../../server/server.ts) starts its listener when
the test file imports it, so another process on port 3000 can cause a conflict.

## Actions

1. **Terminal — establish a reviewable starting point.**

   ```text
   git status --short
   git diff --stat
   ```

   Note expected tooling and feature artifacts from earlier checkpoints. In the
   development terminal, use `Ctrl+C` to stop your `npm run dev` processes.
   Do not terminate unrelated processes or ask the agent to change the server's
   listener architecture merely to avoid the workshop port caveat.

2. **Copilot Chat — execute only the approved feature tasks.**

   ```text
   /speckit-implement
   Implement the approved executable tasks for the ACTIVE claims-filter
   feature only. Follow the constitution, repository instructions, and
   workshops/acceptance.md. Keep all fixtures synthetic and unchanged.
   Honor test-first task order: add/run the focused tests before their
   implementation and record the expected failures, then implement and rerun.
   Run the relevant checks, repair failures caused by this change, and
   report exact commands and actual results, including any checks not run.
   Do not expand scope or implement optional workshops.
   Do not create or modify ignore files, package files, or other repository
   configuration. Do not change tool permissions, weaken checks, commit,
   or push. Do not tick or perform human browser/reviewer/acceptance gates.
   If a required checklist or planning prerequisite is incomplete, stop and
   report it rather than bypassing the gate.
   ```

   Review tool approvals normally. Inspect test-first evidence while the session
   runs; a checked task is not proof the described test ran.

3. **Editor and terminal — inspect the diff.**

   ```text
   git status --short
   git diff --stat
   git diff
   ```

   Inspect untracked files through Source Control too. Compare changed files
   with your plan and open the relevant source:
   [route](../../server/server.ts), [client](../../src/services/httpClient.ts),
   [types](../../src/types.ts), [ClaimsList](../../src/components/ClaimsList.tsx),
   [styles](../../src/App.css), and [tests](../../tests/server.test.ts).

   Check member-scope/filter/count/slice order, generic validation errors,
   compatibility of the `claims` response property, stale-request handling, and
   accessible controls. Decline unrelated cleanup, infrastructure, dependency,
   permission, or configuration changes. Preserve earlier work; do not reset
   the whole checkout to remove one unwanted edit.

4. **Terminal — run the actual automated gates yourself.** With development
   processes stopped, run each separately at the repository root:

   ```text
   npm test
   npm run typecheck
   npm run build
   ```

   Read each exit status and output; record the exact command, result, and
   failures or limitations in your feature evidence. On Windows, use `npm.cmd`
   consistently if the existing policy blocks npm's PowerShell shim.

   - `npm test` runs the existing Vitest/Supertest suite, including the focused
     tests added for the contract. Use existing fixtures and `pageSize=1`.
   - `npm run typecheck` checks the backend under
     [tsconfig.json](../../tsconfig.json).
   - `npm run build` runs the configured TypeScript build plus Vite. Vite
     transpilation is **not a full frontend TSX typecheck**. Do not present these
     commands as proof that every frontend type or accessibility rule was checked.
   - Do not add lint tooling. The starter lint script references undeclared
     ESLint tooling; use lint only if the facilitator has separately established
     a working configuration.

   Repair failures caused by this change and rerun affected checks; record any
   pre-existing failure separately instead of broadening the feature. The final
   handoff must describe results for the final reviewed code, not an earlier diff.

5. **Copilot Chat — run bounded convergence after the checks.**

   ```text
   /speckit-converge
   Compare only the ACTIVE claims-filter code with its reviewed spec, plan,
   tasks, and workshops/acceptance.md. Report requirement-linked gaps;
   do not expand scope or treat missing human acceptance as executable work.
   Do not claim to run tests or accept the feature. Preserve human ownership
   of browser checks, reviewer finding decisions, and final acceptance.
   ```

   This skill compares artifacts/code and can append work to `tasks.md`; it
   **does not run tests**. Inspect its changes. Accept only in-scope gaps and
   remove any human-only task it added. Use the normal implementation session
   for accepted tasks, then rerun affected checks.

   Run convergence for **at most two passes total**. A `Converged` message means
   the artifacts and code agree, not that checks passed or a human accepted
   behavior. If substantive gaps remain after the second pass, stop and ask
   the facilitator to help resolve them rather than starting an unbounded loop.
   `/speckit-analyze` is an optional artifact-consistency aid, not another gate.

6. **Terminal, then browser — restart and establish readiness for acceptance.**

   ```text
   npm run dev
   ```

   After readiness messages, open `http://localhost:5173/?pageSize=1` and select
   Claims. The starter has at most two claims per member; page size 20 will not
   show a second page. Your implementation of the contract's optional address
   parameter makes this demonstration possible without changing fixtures.

   Confirm the controls and results appear; the full browser checklist and
   human decision remain [checkpoint 6](06-review-and-accept.md). Do not tick
   browser acceptance in `tasks.md`.

## Expected output and checkpoint decision

You have a bounded implementation diff, real test/typecheck/build results,
reviewed convergence output, and a running claims UI ready for human review.
Preserve exact results and any limitations for the reviewer.

**Proceed** only when the required automated checks pass for the current change
and no unresolved in-scope implementation gaps block review. **Stop** for failing
checks, incomplete requirements, or unreviewed scope changes. The recovery buffer
supports fixing blockers, not skipping gates.

## Common blockers and nondestructive recovery

| Blocker | Recovery |
| --- | --- |
| Checklist gate stops implementation | Return to [specification review](03-specify.md), fix the underlying spec/checklist, and resume the same feature. Do not answer "yes" to proceed over incomplete requirements. |
| `EADDRINUSE` or API listener failure | Stop development processes you started in their terminal, then rerun tests. Ask the facilitator about any unknown port owner; do not disable tests or kill unrelated processes. |
| Missing-auth test unexpectedly succeeds | Check whether `DEV_MEMBER_ID` is set in the test environment. The contract requires it unset for missing-auth evidence; preserve/restore your environment and do not weaken authentication assertions. |
| No second page appears | Use the browser address `?pageSize=1` and synthetic member M-10001 with All statuses. Check the approved client/API behavior rather than adding claims. |
| New tasks include browser acceptance | Remove those executable tasks and retain the separate [human checklist](../acceptance.md). Agents cannot mark a human observation complete. |
| Checks or convergence remain unresolved | Preserve the diff, exact failing commands, and remaining requirement gaps; use the facilitator and the buffer. Do not claim success, delete tests, or restart feature generation. |

## Official resources

- [Spec Kit: implement and convergence workflow](https://github.github.io/spec-kit/quickstart.html)
- [VS Code: review changes](https://code.visualstudio.com/docs/agents/run/review-code-edits)

[Previous: plan and tasks](04-plan-and-tasks.md) · [Workshop home](../README.md) ·
[Next: review and accept](06-review-and-accept.md)
