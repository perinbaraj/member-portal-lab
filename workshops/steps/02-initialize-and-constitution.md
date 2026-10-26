# 2. Initialize Spec Kit and review the constitution

[Previous: orient](01-orient.md) · [Core roadmap](../core.md) ·
[Workshop home](../README.md) · [Next: specify](03-specify.md)

## Purpose and prerequisites

Add Spec Kit tooling to the existing application, then establish guardrails for
this bounded change. Do not generate a new application or reverse-specify the
whole portal. Finish [orientation](01-orient.md) and
[tool installation prework](../prework.md) first. Know your approved Specify CLI
version and script flavor: `ps`, `py`, or `sh`.

## Actions

1. **Terminal — protect the starting point.** At the repository root:

   ```text
   git branch --show-current
   git status --short
   specify version
   specify init --help
   ```

   Preserve and identify existing work before initializing. If you are still on
   `spec-workshop` in your own checkout, create the local learner branch once:

   ```text
   git switch -c workshop-claims
   ```

   If prework already created your learner branch, stay on it; do not create
   another or switch the shared preparation checkout. The help must include
   `--here`, `--integration`, and `--script`. Keep the version approved in
   prework; do not upgrade mid-workshop.

2. **Terminal — initialize interactively, choosing exactly one command.** Use
   your own terminal at the repository root, **not Copilot's terminal tool**.

   **Windows PowerShell, when prework permits PowerShell helper scripts:**

   ```text
   specify init --here --integration copilot --script ps
   ```

   **Windows with `Restricted` or `AllSigned` execution policy:** use the Python
   flavor with the prework-approved CLI (1.2.3 or later) and Python on `PATH`:

   ```text
   specify init --here --integration copilot --script py
   ```

   **macOS/Linux Bash:**

   ```text
   specify init --here --integration copilot --script sh
   ```

   Read the non-empty-directory merge warning and answer `y` interactively.
   Do not use `--force`. If `.specify` already exists, inspect it and resume the
   existing initialization instead of running init over it.

3. **Editor and terminal — verify files, not just the exit code.** Open VS Code
   Source Control and run:

   ```text
   git status --short
   ```

   Expect `.specify` project files and
   `.github\skills\speckit-...\SKILL.md`. Check that these actually exist.
   An unattended merge prompt can print `Operation cancelled` and still exit
   successfully without creating files. Ordinary `git diff` omits untracked
   files; inspect them in Source Control or Explorer.

   Confirm [application code](../../server/server.ts),
   [package files](../../package.json),
   [shared instructions](../../.github/copilot-instructions.md), and the
   [reviewer profile](../../.github/agents/workshop-reviewer.agent.md) were not
   overwritten. Review new configuration and keep normal tool approvals.

   The CLI's final Agent Folder Security note may suggest ignoring agent
   folders. **Do not add `.github` to `.gitignore`**: it contains the generated
   skills and tracked reviewer. Leave ignore files alone.

4. **Copilot Chat — discover the generated skills.** Open Chat with the
   repository root as the workspace and the Copilot harness selected. Type `/`
   and select the skill from completion. Confirm these are discoverable:

   ```text
   /speckit-constitution
   /speckit-specify
   /speckit-plan
   /speckit-tasks
   /speckit-implement
   /speckit-converge
   ```

   These are **Chat skills, not terminal commands**. Invoke each separately at
   its checkpoint; the list above is not a request to run them all now.

5. **Copilot Chat — generate only the constitution.**

   ```text
   /speckit-constitution
   Read .github/copilot-instructions.md and inspect the existing application.
   Establish principles for a bounded brownfield change: reuse Express,
   Zod, React, the typed HTTP client, synthetic in-memory fixtures, and
   existing Vitest/Supertest tests. Preserve unrelated API and UI behavior.
   Enforce member isolation before filtering, counting, and pagination;
   validate route inputs; use generic errors and never log PHI.
   Require accessible labeled UI controls, focused tests, actual test/build
   evidence, and human acceptance. Do not invent measured performance or
   accessibility results.
   No new packages, Redis service, database, external APIs, deployment,
   or broad refactoring. Retain normal tool approvals and keep the workshop
   reviewer read/search only.
   Do not modify application code or shared Copilot instructions.
   Do not commit or push. Generate the constitution only, and report its path.
   ```

   Review tool requests normally; do not enable blanket approvals to accelerate
   initialization or constitution generation.

6. **Editor — approve the guardrails yourself.** Read
   `.specify\memory\constitution.md` and any reported template updates.
   Remove placeholders and correct invented rules. The constitution must apply,
   not weaken, [repository instructions](../../.github/copilot-instructions.md).
   Existing architecture notes are not a mandate to add services: this list-only
   feature uses the current helper and adds no mutation or Redis service.
   Confirm the diff contains only expected tooling/constitution artifacts.

## Expected output and checkpoint decision

The same starter app now has discoverable Spec Kit skills and a human-reviewed
`.specify\memory\constitution.md`. Initialization has not implemented the filter.

**Proceed** only when the artifacts exist, skills are discoverable, and you have
reviewed the constitution. **Stop** for missing files, unexpected app/config
changes, or weaker privacy and approval rules. Do not treat a successful shell
exit or a generated summary as approval.

## Common blockers and nondestructive recovery

| Blocker | Recovery |
| --- | --- |
| `Operation cancelled`, no `.specify` | Rerun the same selected init command in your interactive terminal and answer the merge prompt. If artifacts already exist, inspect them first rather than rerunning. |
| PowerShell helper blocked | Do not bypass execution policy. If no artifacts were created, use the approved Python flavor; for a partial initialization, preserve files and ask the facilitator to inspect it before changing script flavor. |
| `/speckit-...` not discoverable | Confirm the repo root and generated `SKILL.md` files, save files, and use VS Code customization diagnostics or **Developer: Reload Window**. Do not paste an older `/speckit.*` command layout over the skills. |
| Wrong CLI or missing flags | Return to [prework](../prework.md). Resolve the approved installation; do not improvise an upgrade or disable security settings. |
| Unexpected changes | Compare with action 1's status and inspect each diff. Preserve existing work; do not reset or clean the checkout. Ask the facilitator before correcting generated configuration. |
| Tooling remains unavailable | Pair using an approved working checkout. The references do not replace initialization or constitution review. |

## Official resources

- [Spec Kit: installation and script flavors](https://github.github.io/spec-kit/installation.html)
- [Spec Kit: workflow quickstart](https://github.github.io/spec-kit/quickstart.html)
- [VS Code: Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)

Use these to understand discovery and initialization, not to change the
workshop-approved version.

[Previous: orient](01-orient.md) · [Workshop home](../README.md) ·
[Next: specify](03-specify.md)
