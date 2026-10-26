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
- Verify the current official Specify CLI and record the version used for the
  event. Rehearse initialization in a separate disposable checkout, including
  network access, the merge prompt, generated files, and Copilot skill discovery.
- Run the exact initialize/constitution/specify/plan/tasks/implement/converge flow.
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
template. Reference artifacts are available for recovery, not as a substitute
for participant review.

Use `spec-workshop` as the shared baseline. Learners may create their own local
feature branches. Keep all facilitator workshop-preparation changes associated
with `spec-workshop`; do not modify `main` or the existing `lab-guide` content.

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

## Optional boundary

Offer [custom agents](optional/custom-agents.md) and
[appeal eligibility/drafting](optional/claim-appeals.md) as follow-on work.
The appeals draft is deliberately not submitted, persisted, or presented as an
actual medical-care or insurance action.
