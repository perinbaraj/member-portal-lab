# 6. Customize, review, and accept

[Previous: implement and test](05-implement-and-test.md) ·
[Core roadmap](../core.md) · [Workshop home](../README.md) ·
[Next: acceptance checklist and record](../acceptance.md)

## Purpose and prerequisites

Use a read-only reviewer to find requirement-linked defects, then perform the
browser checks and make the acceptance decision yourself. Finish
[implementation and testing](05-implement-and-test.md) with the intended active
artifacts, a reviewed diff, and actual test/typecheck/build results. Have the app
running and [acceptance.md](../acceptance.md) open.

A reviewer finding is advice for the participant to evaluate. `Converged`, a
clean findings table, and green automated checks are each useful evidence, but
none is a human acceptance decision.

## Actions

1. **Editor — customize one review criterion without expanding permissions.**
   Open [the reviewer profile](../../.github/agents/workshop-reviewer.agent.md).
   Replace its participant customization sentence with a concrete criterion:

   ```text
   Verify that status filtering happens before pagination, totals are
   member-scoped, and changing status resets the UI to page one.
   ```

   Save the file. Keep its tools exactly read/search only:

   ```yaml
   tools: ['read', 'search']
   ```

   Do not add write, terminal, browser execution, or commit tools. Implementation
   fixes and command execution belong to the normal session, not the reviewer.

2. **Terminal and editor — inspect scope before asking for review.**

   ```text
   git status --short
   git diff --stat -- . ':!.github/agents'
   git diff -- . ':!.github/agents'
   ```

   The reviewer profile you just customized is expected to be modified; the
   latter commands exclude it. Expect only planned feature files, plus
   initialized tooling in `.specify`, the active feature under `specs`, and
   generated `.github\skills`. Ordinary diff output does not include new
   untracked files: open those from Source Control and include them in review.

   Explain every unexpected difference, especially package/lock files, ignore
   files, repository configuration, workshop documents, and unrelated feature
   code. Preserve existing work; use selective, understood edits rather than
   reset/clean or a whole-file restore.

3. **Copilot Chat — select `workshop-reviewer` explicitly.** Use the VS Code
   agent picker with the Copilot harness selected. Provide the exact active
   feature directory, current diff (including new-file content), and actual
   command/results from the implementation checkpoint as Chat context. The
   reviewer cannot run `git diff` or tests, so do not merely tell it to run them.

   With those artifacts/evidence attached or pasted, submit:

   ```text
   Review my claims-filter change against the active spec, plan, tasks,
   constitution, and workshops/acceptance.md supplied in this chat.
   Use the supplied current diff, new-file content, and actual test/typecheck/
   build output as evidence. Read the relevant repository source.
   Do not edit files, execute commands, approve the change, or invent results.
   Separate confirmed defects from missing evidence.
   Report actionable requirement-linked findings with severity, file/line,
   violated requirement, evidence, and suggested correction.
   Include proposed fixes for me to accept or reject; do not accept them for me.
   If evidence is missing or stale, state the limitation rather than guessing.
   ```

4. **Editor and Chat — decide what to fix.** Open every cited file/line and
   verify the finding against the requirement. Model line references can be a
   few lines off. Record each finding as accepted or rejected with a reason.
   Missing evidence is not automatically a confirmed defect.

   For accepted fixes, switch back to the **normal implementation agent**:

   ```text
   Apply only the reviewer findings I have explicitly accepted in this chat.
   Keep the change within the active approved claims-filter artifacts.
   Do not implement rejected suggestions, broaden scope, change permissions,
   modify package/configuration files, commit, or push.
   Run the checks affected by these fixes and report exact commands/results.
   Do not perform or mark human browser acceptance or the final decision.
   ```

   Inspect the follow-up diff, rerun the relevant checks, and supply fresh
   evidence for any follow-up review. Stop development processes before API
   tests and restart afterwards. A review with no actionable findings is a valid
   result; record it rather than asking the reviewer to invent a defect.

5. **Browser — perform the authoritative checklist yourself.** Follow every
   item in [Browser evidence](../acceptance.md#browser-evidence), using
   `http://localhost:5173/?pageSize=1`. Do not substitute this overview for the
   detailed checklist:

   - Filter, clear the filter, reach an empty state, and navigate both pages
     of M-10001; verify reset to page one after changing status.
   - Check loading, generic announced failure, recovery, and stale-request
     protection. Browser throttling alone does not prove response ordering;
     inspect cancellation/stale-result handling in
     [ClaimsList](../../src/components/ClaimsList.tsx).
   - Use controls by keyboard and assess labels, focus, and contrast.
   - Switch synthetic members, reopen Claims, and compare results/totals;
     revisit Profile and Prescriptions for unchanged behavior.

   Restore any offline setting or stopped API after a failure check. Follow the
   acceptance contract's [starter quirks and limitations](../acceptance.md#starter-quirks-that-are-not-part-of-this-change):
   the header label can be stale after a member switch, and unrelated screens
   are not an invitation to broaden this change. Record limitations honestly,
   including any observed pagination focus limitation.

6. **Editor — record the human decision.** Complete the
   [human acceptance record](../acceptance.md#human-acceptance-record) in your
   own active feature artifacts or PR draft, not in the shared workshop guide:

   ```text
   Requirement:
   Changed files:
   Automated checks and actual results:
   Browser checks and actual results:
   Reviewer findings accepted/rejected, with reasons:
   Known limitations:
   Decision: accepted / not accepted
   ```

   Name unmet requirements if not accepted. Do not report unperformed checks as
   passes, claim a full frontend typecheck from backend/Vite commands, or publish
   real member data. No commit or push is required.

## Expected output and checkpoint decision

You have a customized read-only reviewer, an evaluated findings handoff,
automated evidence for the final diff, browser evidence, and a human decision.
Human work has **not** been marked complete by an implementation agent.

**Accepted and done** means the requirement works and the evidence supports your
decision. **Not accepted** means stop, preserve the unresolved issues, and use
the buffer/facilitator for bounded recovery. A clean review is not acceptance;
optional workshops do not belong in this exit condition.

## Common blockers and nondestructive recovery

| Blocker | Recovery |
| --- | --- |
| Reviewer is missing from the picker | Confirm repo root, saved `.agent.md`, and Copilot harness; inspect customization diagnostics/reload. Do not convert it into a write-enabled agent. |
| Reviewer asks to execute commands | Decline. Run commands yourself in the normal session and supply the actual results. |
| Reviewer cannot see the diff or test evidence | Attach/paste the current diff, untracked-file content, and results. It should report missing evidence until you do. |
| Finding has a wrong line number or unsupported claim | Open the source and compare the requirement. Ask for clarification or reject with a reason; do not blindly fix it. |
| A fix changes reviewed behavior or breaks a check | Return to the normal implementation session for that accepted fix, inspect the diff, and rerun affected checks. Refresh review/browser evidence for the changed behavior. |
| Browser gate fails or time runs out | Record not accepted and the exact unmet behavior. Preserve artifacts and evidence; do not skip acceptance or start optional features. |

## Official resources

- [VS Code: custom agents and read-only tools](https://code.visualstudio.com/docs/agent-customization/custom-agents)
- [VS Code: review changes](https://code.visualstudio.com/docs/agents/run/review-code-edits)
- [Spec Kit: workflow and convergence](https://github.github.io/spec-kit/quickstart.html)

[Previous: implement and test](05-implement-and-test.md) ·
[Workshop home](../README.md) · [Next: acceptance checklist and record](../acceptance.md)
