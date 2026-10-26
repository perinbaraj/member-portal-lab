# Facilitator preparation and delivery

## Keep the scope honest

The branch is a learner starter with a core exercise and two independent optional
workshops. It is not a completed feature, a production healthcare system, or a
guarantee that every participant finishes within a fixed duration.

Keep the core to the six checkpoints in [core.md](core.md). Explain lifecycle
concepts using the change participants are already making. Do not open separate
labs for tools, agent teams, appeals, deployment, or infrastructure during the core.

## Before inviting participants

- Complete [prework](prework.md) in a fresh checkout.
- Verify Copilot account access, the selected VS Code harness, and normal tool
  approval behavior.
- Pin and announce the Specify CLI version (1.2.3, as in prework) and confirm that
  every participant's package source can supply it; otherwise publish an approved
  index or a wheel file for them. Rehearse initialization in a separate disposable
  checkout, including the merge prompt, generated files, and Copilot skill
  discovery.
- Before pinning a newer Spec Kit version, run `specify init` for the rehearsed and
  the new version in two fresh `git init` directories and byte-diff
  `.github\skills`, `.specify\templates`, and the constitution memory. The guide
  hard-codes the `/speckit-*` skill names, the skills layout, and `converge`.
  Rehearsed so far: 1.2.1 (the full core) and 1.2.3 (init, skills, and helper
  scripts; skills and templates were byte-identical to 1.2.1).
- Test the `--script py` fallback on one machine whose execution policy is
  `Restricted` or `AllSigned` (under `AllSigned` the generated `.ps1` helpers fail
  with "not digitally signed"; `Restricted` blocks scripts altogether). On Spec Kit
  1.2.1 the Python helpers for the constitution and tasks steps crash with a
  Unicode error on Windows; 1.2.3 fixes this, which is why the guide pins 1.2.3.
  The macOS/Linux `--script sh` flavour has not been rehearsed.
- Run the exact initialize/constitution/specify/plan/tasks/implement/converge flow.
  For specify and plan, use the reference-grounded prompts in
  [step 3](steps/03-specify.md) and [step 4](steps/04-plan-and-tasks.md), not
  independent blank-page generation. Confirm active scaffolding, ancillary
  planning artifacts, and an executable task checklist are created.
  The default Copilot layout uses `/speckit-...` skills, not older dotted prompts.
- Have participants generate and review the constitution against existing
  repository instructions. Do not check generated scaffolding into the starter.
- Check that `workshop-reviewer` appears in the agent picker and remains read-only.
- Run tests, backend typecheck, and build. The original ESLint script lacks its
  required dependencies/configuration; do not promise a working lint gate.
- Rehearse the complete core feature, browser acceptance, reviewer handoff, and
  recovery process with representative participants.
- If preparing extra completed-solution or checkpoint material, validate it
  separately and label it clearly; do not complete the learner starting point.
- Independently rehearse each optional workshop before advertising it as a
  validated runnable activity.

## What to provide

An environment check, the requirement/acceptance contract, initialization
commands, a constitution prompt, copy-ready feature prompts, and the reviewer
template. [Reference artifacts](reference/README.md) are the default starting
material for guided specification and planning, and also support recovery.
Participants still review and adapt them; adopting an example is not approval.

Use `spec-workshop` as the shared baseline. Learners may create their own local
feature branches. Keep all facilitator workshop-preparation changes associated
with `spec-workshop`; do not modify `main` or another preparation branch.

## Run of show

The event boundary is a **tentative three-hour core plus a one-hour buffer**.
Include welcome, discussion, a break, and wrap-up within the core, not as
unannounced extra time. Installation and account troubleshooting are prework.
Use the buffer for blockers and finishing the same requirement; do not fill it
with extra required labs. This is a delivery target, not a measured completion
claim. Validate delivery with representative participants before promising it.

| Block | Participant instructions | Evidence before proceeding |
| --- | --- | --- |
| Welcome and AIDLC overview | [Workshop home](README.md) | Scope, prework readiness, and guided route understood |
| 1 Orient | [Inspect the existing claims flow](steps/01-orient.md) | Bounded change and affected files identified |
| 2 Initialize and constitution | [Initialize in place](steps/02-initialize-and-constitution.md) | Generated files and guardrails reviewed |
| 3 Specify | [Adapt the reference specification](steps/03-specify.md) | Active specification and quality checklist reviewed |
| 4 Plan and tasks | [Adapt the plan and generate tasks](steps/04-plan-and-tasks.md) | Ancillary artifacts and executable tasks agree |
| Break | Pause at an artifact handoff | Current work saved and next step clear |
| 5 Implement and test | [Bounded implementation](steps/05-implement-and-test.md) | Actual test, typecheck, build, and convergence results |
| 6 Review and accept | [Review and human acceptance](steps/06-review-and-accept.md) | Findings evaluated and browser checks recorded |
| Wrap-up | [Acceptance record](acceptance.md#human-acceptance-record) | Accepted or not accepted, with reasons |
| Buffer if needed | [Nondestructive recovery](reference/README.md#nondestructive-recovery) | Resolve blockers without skipping evidence |

Recovery boundaries:

- After step 4, everyone needs an active `tasks.md`; use the reference breakdown
  through the guided workflow if tasks are missing or overly broad.
- After step 5, test, typecheck, and build must pass. Otherwise help or pair the
  participant; do not skip ahead and report acceptance.
- At any blocked checkpoint, preserve the current files, consult the matching
  reference, and review the reconciliation. Do not discard work or force a
  failed checklist to proceed.
- Independent spec/plan generation is an optional alternative outside the
  guided core, not a second required pass or a buffer assignment.

Agenda coverage: AIDLC and Spec-Driven Development (overview, steps 2-4);
requirement, specification, plan, and tasks (steps 3-4); custom agents (step 6
plus the optional workshop); brownfield work (every block); AI-assisted testing,
review, and human validation (steps 5-6).

## Delivery rules

At each checkpoint ask participants to inspect one concrete output. If someone
is blocked, use the corresponding reference artifact rather than adding an
entire explanatory side lab.

If scope pressure appears, shorten optional explanations or use a reviewed
reference artifact. Do not remove tests, member-isolation requirements,
pagination, review, or human acceptance.

Keep installation troubleshooting in prework, but keep in-repository initialization
and constitution creation in the live exercise: adopting Spec Kit on existing
code is an explicit learning outcome. Do not expand this into a full system
inventory or an extension/workflow setup lab.

Use the normal implementation agent for code and command execution. Use the
custom reviewer only for review. A role's confidence is not test evidence.

## Validation status

Local source checks can establish that the starter still tests and builds and
that documentation targets exist. They do not establish VS Code agent discovery,
successful model execution, browser accessibility, optional-feature correctness,
or participant completion duration. Record those outcomes only after actually
rehearsing them.

One scripted sandbox rehearsal followed `prework.md` and `core.md` end to end on a
throwaway clone, with a person acting as both participant and model: Spec Kit 1.2.1
(full run) and 1.2.3 (init, skills, helper scripts). Tests, typecheck, and build
passed, and a scripted browser run passed the acceptance checks with no automated
accessibility violations. It did **not** exercise VS Code skill discovery or the
agent picker, real model-driven chat and latency, a person performing the browser
checks, screen readers, macOS/Linux, or the optional workshops' implementations.
Treat the run of show as unvalidated until a timed run in VS Code is complete.

## Optional boundary

Offer [custom agents](optional/custom-agents.md) and
[appeal eligibility/drafting](optional/claim-appeals.md) as follow-on work.
The appeals draft is deliberately not submitted, persisted, or presented as an
actual medical-care or insurance action.
