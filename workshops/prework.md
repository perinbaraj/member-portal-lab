# Prework: prepare before the event

Complete this before the core workshop. Installation and account troubleshooting
are not part of the hands-on event.

## Required

- Node.js 22 LTS with npm, Git, and VS Code.
- GitHub Copilot access in VS Code, signed in and able to use Chat agent tools.
- PowerShell on Windows, or Bash on macOS/Linux.
- A local checkout of the `spec-workshop` branch.
- Internet access for Copilot and initial dependency installation.

There is no Redis server, Docker, database, GitHub Actions setup, cloud account,
or healthcare-service credential to configure.

## 1. Verify the starter

From the repository root:

```text
git branch --show-current
node --version
npm --version
npm ci
npm test
npm run typecheck
npm run build
```

Use `npm.cmd` instead of `npm` on Windows if your existing PowerShell policy
blocks npm's `.ps1` shim; do not change execution policy for the workshop.

The baseline has six API smoke tests. The existing TypeScript configuration
checks the backend; Vite transpiles the frontend but is not a full TSX typecheck.
The original lint script references undeclared ESLint tooling, so lint is not an
advertised workshop gate. Do not install extra tooling just to follow the guide.

Then run:

```text
npm run dev
```

Open `http://localhost:5173`, then Profile, Claims, and Prescriptions. The Vite
proxy forwards `/api` to the backend on port 3000. Use only the synthetic members
provided by the starter. Do not copy real member information into the app.

Stop the development processes before running `npm test`: the starter imports
and starts its API listener during tests, so another process on port 3000 can
cause a conflict. Use separate terminal windows for editing and development.

## 2. Use the pinned Spec Kit scaffolding

This branch uses the official **Spec Kit v0.0.90 Copilot prompt layout**, checked
in from its standalone release templates. It is deliberately pinned rather than
tracking the latest installation layout.

The generated prompt files and local scripts are already included. Participants
do not need Python, uv, the Specify CLI, or a fresh Spec Kit installation.
Do not run `specify init --force` over this branch.

In VS Code Copilot Chat, type `/speckit` and confirm these prompt commands appear:

```text
/speckit.specify
/speckit.clarify
/speckit.plan
/speckit.tasks
/speckit.implement
/speckit.analyze
```

These are **chat prompt commands**, not terminal commands. The core uses specify,
plan, tasks, and implement; clarify resolves actual questions, and analyze is an
optional consistency aid. This pinned release does not use the newer
`/speckit-<command>` skills layout or require a converge command.

Open the supplied `.specify\memory\constitution.md`. It provides project rules;
you do not need to generate a new constitution during the core event.

The agent definitions include Windows PowerShell and Bash command alternatives.
Use the matching command for your operating system; do not change execution policy
or bypass shell/tool permission controls. Provenance and local adaptations are
documented in [the upstream notice](../.specify/UPSTREAM.md).

## 3. Verify the custom reviewer

Open `.github\agents\workshop-reviewer.agent.md`, then select
**workshop-reviewer** in VS Code Chat's agent picker. If it does not appear,
confirm you opened the repository root, saved the file, and selected the Copilot
harness. Use VS Code's customization diagnostics/reload only as needed.

The profile allows read/search tools only. Keep that boundary; command execution
belongs to the normal implementation session.

## Ready means

The app runs locally, baseline checks work, Spec Kit prompts are discoverable,
the constitution is present, and the reviewer can be selected. Tell the
facilitator about a setup blocker before the event.

If blocked during the workshop, use [reference recovery](reference/README.md)
without discarding your work.
