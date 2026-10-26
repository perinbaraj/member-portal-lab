# Prework: prepare before the event

Complete this before the core workshop. Installation and account troubleshooting
are not part of the hands-on event.

## Required

- Node.js 22 LTS with npm, Git, and VS Code.
- GitHub Copilot access in VS Code, signed in and able to use Chat agent tools.
- PowerShell on Windows, or Bash on macOS/Linux.
- Python 3.11+, uv, and the current Specify CLI (installation below).
- A local checkout of the `spec-workshop` branch.
- Internet access for Copilot, package installation, and Spec Kit initialization.

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

## 2. Install the tool, not the project scaffolding

Install Python 3.11+ and uv using the
[official installation guide](https://github.github.io/spec-kit/installation.html).
Then run in a terminal:

```text
python --version
uv --version
uv tool install specify-cli
specify version
specify init --help
```

If uv reports that Specify is already installed, compare `specify version` with
the current official release. Upgrade that uv-managed installation with
`uv tool upgrade specify-cli` if needed, then check the version again. If another
tool installed Specify, follow the official upgrade guide for that tool instead
of creating a second installation.

The current CLI help must include `--here`, `--integration`, and `--script`.
This workshop uses the default Copilot skills layout, with `/speckit-...`
commands, not the older `/speckit.*` prompt layout. Facilitators verify a common
current version before the event; do not upgrade midway through the exercise.

**Do not run `specify init` in this checkout yet.** Participants initialize the
existing repository and generate its constitution during the core workshop.
This starter deliberately contains no generated `.specify` files or Spec Kit
skills, agents, or prompts. Missing `/speckit-...` skills before initialization
is expected.

The event needs network access to official Spec Kit sources. Resolve proxy,
certificate, package-index, or account-access problems before the event using
approved configuration; do not disable TLS or tool approval controls.

## 3. Verify the custom reviewer

Open `.github\agents\workshop-reviewer.agent.md`, then select
**workshop-reviewer** in VS Code Chat's agent picker. If it does not appear,
confirm you opened the repository root, saved the file, and selected the Copilot
harness. Use VS Code's customization diagnostics/reload only as needed.

The profile allows read/search tools only. Keep that boundary; command execution
belongs to the normal implementation session.

## Ready means

The app runs locally, baseline checks work, the current Specify CLI is available,
and the reviewer can be selected. The repository is still uninitialized for
Spec Kit. Tell the facilitator about a setup blocker before the event.

If blocked during the workshop, use [reference recovery](reference/README.md)
without discarding your work.
