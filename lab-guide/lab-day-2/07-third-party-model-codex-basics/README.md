# Lab 7: Hands-on Copilot + Codex Third-Party Model Workflow

## Use Case

You are piloting Codex through Copilot workflows for two basic tasks:
1. Test generation for backend and frontend paths
2. Documentation drafting for implementation and release notes

The goal is not "one-shot perfect output." The goal is a repeatable human-in-the-loop workflow that is fast, safe, and auditable.

## Prerequisites

- Completion of Lab 6
- VS Code with Copilot Chat enabled
- Access to a Codex-capable model option through your approved Copilot/model routing setup
- Project runs locally (`npm run dev`)
- Tests can run locally (`npm test` or your team test command)

## Lab Artifacts (Create During This Lab)

- `lab-guide/lab-day-2/07-third-party-model-codex-basics/codex-prompt-log.md`
- `lab-guide/lab-day-2/07-third-party-model-codex-basics/codex-review-checklist.md`
- `lab-guide/lab-day-2/07-third-party-model-codex-basics/codex-decision-note.md`

## Step-by-step Instructions

### Step 1: Baseline and Scope the Exercise

1. Start the app and test baseline.
2. Choose two targets:
	- One backend test scenario (example: auth or member isolation behavior)
	- One documentation deliverable (example: endpoint behavior summary)
3. Record baseline status in `codex-prompt-log.md`.

In Copilot Chat, ask:

```text
Create a scoped plan for a hands-on Codex pilot in this repo.
I need:
1) one backend test-generation task,
2) one documentation-drafting task,
3) acceptance criteria for each,
4) risks to watch during generation.
Keep scope to 45 minutes of implementation work.
```

### Step 2: Task A (Hands-on) - Generate Tests with Codex

Switch to your Codex model option and run a focused prompt against the selected test target.

Prompt example:

```text
Generate tests for this target behavior in this codebase.
Constraints:
- Do not invent APIs or fields not present in the repo.
- Cover happy path, auth failure, and one edge case.
- Keep tests deterministic.
- Return a unified diff patch only.
Also explain assumptions in 5 bullets.
```

Apply the proposed test changes manually (review each hunk), then run tests.

Record in `codex-prompt-log.md`:
- Prompt used
- Files changed
- What passed/failed
- Assumptions Codex made

### Step 3: Task B (Hands-on) - Draft Documentation with Codex

Use Codex to draft a technical note for the exact changes made in Step 2.

Prompt example:

```text
Draft a technical note for the tests we added.
Include:
1) behavior covered,
2) known limitations,
3) why these tests matter for HIPAA-safe engineering,
4) follow-up tests to add later.
Keep it concise and repo-specific.
```

Save/refine output into `codex-review-checklist.md` as a "Draft Summary" section.

### Step 4: Copilot Review Pass (Non-Generation Role)

Now use Copilot as reviewer (not generator) to critique Codex output.

Prompt example:

```text
Review these Codex-generated tests and docs for:
1) correctness against actual code,
2) missing edge cases,
3) insecure or non-compliant guidance,
4) unclear wording.
Return findings by severity: high, medium, low.
```

Update `codex-review-checklist.md` with:
- Findings
- Required fixes
- Accepted risks

### Step 5: Iteration Loop - Fix with Codex, Verify with Copilot

Run one more Codex generation pass to address review findings, then verify again.

Rules for this loop:
- Max 2 iteration cycles
- Every cycle must include test execution
- Reject output that introduces unknown dependencies or fabricated repo details

Track before/after quality in `codex-prompt-log.md`:

| Metric | Iteration 1 | Iteration 2 |
|---|---|---|
| Test pass rate |  |  |
| Findings count |  |  |
| Manual edits needed |  |  |

### Step 6: Lightweight Governance Gate

Before considering output "ready," run a short governance gate.

In Copilot Chat:

```text
Create a go/no-go checklist for accepting Codex-generated engineering output in this repo.
Must include:
- secret/PHI exposure checks,
- test reliability checks,
- human approval checkpoint,
- traceability of prompts and edits.
Keep it to 10 checks max.
```

Save the checklist in `codex-review-checklist.md` and mark pass/fail per item.

### Step 7: Decision Note and Incident Drill

Create `codex-decision-note.md` with:
- What Codex did well
- Where Copilot review caught issues
- Decision: APPROVED FOR LIMITED USE / CONDITIONAL / NOT APPROVED
- Scope limits (where Codex is not allowed yet)

Then run a mini incident drill:

```text
Simulate an incident where a Codex-generated test missed an authorization edge case.
Give me a 1-hour response plan with:
1) detection,
2) rollback/containment,
3) root cause,
4) prevention updates.
```

Add the response plan to `codex-decision-note.md`.

## Exit Criteria

- [ ] Team completed one Codex-generated test task and one Codex-generated documentation task
- [ ] All generated code/docs were reviewed with Copilot using an explicit checklist
- [ ] Prompt and iteration history captured in `codex-prompt-log.md`
- [ ] Final governance gate completed with pass/fail outcomes
- [ ] Decision note completed with explicit allow/deny scope
- [ ] Team can explain the workflow: "Codex generates, Copilot validates, human approves"

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Baseline + scope | 5 min | Pick one test target + one doc target |
| Codex test generation | 15 min | Generate, apply, run tests |
| Codex doc drafting | 10 min | Draft and align to actual changes |
| Copilot review + iteration | 15 min | Review findings and improve once or twice |
| Governance gate + decision note | 10 min | Final pass/fail and scope decision |
| Incident drill | 5 min | Practice response readiness |

**The lesson:** The winning pattern is not model-only output. It is a controlled workflow where Codex accelerates creation, Copilot improves quality, and humans own the final decision.
