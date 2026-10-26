# Prework: prepare before the event

Complete this before the core workshop. Installation and account troubleshooting
are not part of the hands-on event.

## Required

- Node.js 22 LTS with npm, Git, and VS Code.
- GitHub Copilot access in VS Code, signed in and able to use Chat agent tools.
- PowerShell on Windows, or Bash on macOS/Linux.
- Python 3.11+, uv, and Specify CLI 1.2.3 (installation below).
- A local checkout of the `spec-workshop` branch.
- Internet access for Copilot and for package installation (`npm ci`, Python tooling).

There is no Redis server, Docker, database, GitHub Actions setup, cloud account,
or healthcare-service credential to configure.

## 1. Clone the workshop branch and open VS Code

Install missing prerequisites from their official sources:
[Git](https://git-scm.com/downloads),
[Node.js](https://nodejs.org/en/download),
[VS Code](https://code.visualstudio.com/download), and
[Python](https://www.python.org/downloads/).
Follow [uv installation](https://docs.astral.sh/uv/getting-started/installation/)
for the Python tool manager. Verify
[Copilot access in VS Code](https://code.visualstudio.com/docs/copilot/setup)
before continuing.

In a terminal, choose a parent folder for your own checkout, then run:

```text
git clone --branch spec-workshop --single-branch https://github.com/perinbaraj/member-portal-lab.git
cd member-portal-lab
git branch --show-current
git status --short
code .
```

Expected: branch `spec-workshop`, no local changes in a fresh clone, and VS Code
opens the folder containing `package.json`, `server`, `src`, and `workshops`.
If `code` is not on PATH, use VS Code's **File > Open Folder** to open that folder.
Use **Terminal > New Terminal** for the remaining terminal commands.

If you already have a checkout with local work, do not reset or clean it to follow
these steps. Use a separate clone or ask the facilitator to help preserve it.
If cloning reports no such branch or an access error, check the URL, GitHub
access, and that the facilitator has published `spec-workshop`; do not silently
substitute `main`. Workshop preparation stays on `spec-workshop`; you will create
your own local learner branch in [step 2](steps/02-initialize-and-constitution.md).

## 2. Verify the starter

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

The first npm command on a fresh machine can take several minutes (for example
while antivirus software scans `node_modules`). Run `npm ci` before the event,
not during it.

The baseline has six API smoke tests. The existing TypeScript configuration
checks the backend; Vite transpiles the frontend but is not a full TSX typecheck.
The original lint script references undeclared ESLint tooling, so lint is not an
advertised workshop gate. Do not install extra tooling just to follow the guide.

Then run:

```text
npm run dev
```

Open `http://localhost:5173`, then Profile, Claims, and Prescriptions. Expected:
all three views load; Claims has no filter yet. The Vite
proxy forwards `/api` to the backend on port 3000. Use only the synthetic members
provided by the starter. Do not copy real member information into the app.

Stop the development processes before running `npm test`: the starter imports
and starts its API listener during tests, so another process on port 3000 can
cause a conflict. Use separate terminal windows for editing and development.

## 3. Install the tool, not the project scaffolding

Install Python 3.11+ and uv using the
[official installation guide](https://github.github.io/spec-kit/installation.html).
Then run in a terminal:

```text
python --version
uv --version
uv tool install --force specify-cli==1.2.3
specify version
specify init --help
```

`specify version` must print `1.2.3`, the version this workshop was rehearsed with
(use another version only if your facilitator tells you to before the event).
`--force` replaces an older uv-managed copy. If another tool installed Specify,
upgrade or remove that copy instead of keeping two installations. Do not upgrade
after the event starts. Version 1.2.1 generates identical skills and templates and
works with the default `--script ps`, but its Python helpers can crash on Windows;
use it only if the facilitator confirms that your approved package source cannot
supply 1.2.3.

The CLI help must include `--here`, `--integration`, and `--script`. This workshop
uses the default Copilot skills layout, with `/speckit-...` commands, not the older
`/speckit.*` prompt layout.

If the install fails with a TLS, certificate, proxy, or "no matching version"
error, use your organization's approved package index
(`uv tool install --force --default-index <approved-index-url> specify-cli==1.2.3`)
or a wheel file your facilitator supplies
(`uv tool install --force <path-to-wheel>`). Do not disable TLS verification,
install from an untrusted source, or change security settings to make the download
work. Tell the facilitator if neither option works.

**Windows only: check your PowerShell execution policy.**

```text
Get-ExecutionPolicy
```

If it prints `Restricted` or `AllSigned`, the PowerShell helper scripts that Spec
Kit generates will not run. In the core exercise use the Python flavour
(`--script py`) instead of `--script ps`. It uses the Python you already
installed (`python` must be on your PATH) and needs Spec Kit 1.2.3 or later. Do
not change your execution policy or approve a policy-bypass workaround for the
workshop. If neither flavour works, pair with a neighbour and tell the facilitator.
Any other value, such as `RemoteSigned`, works with `--script ps`. macOS/Linux
participants use `--script sh`.

**Do not run `specify init` in this checkout yet.** Participants initialize the
existing repository and generate its constitution during the core workshop.
This starter deliberately contains no generated `.specify` files or Spec Kit
skills, agents, or prompts. Missing `/speckit-...` skills before initialization
is expected.

Initialization uses assets bundled with the installed CLI, so it should not need
network access; Copilot still does. Resolve proxy, certificate, package-index, or
account-access problems before the event using approved configuration; do not
disable TLS or tool approval controls.

## 4. Verify the custom reviewer

Open `.github\agents\workshop-reviewer.agent.md`, then select
**workshop-reviewer** in VS Code Chat's agent picker. If it does not appear,
confirm you opened the repository root, saved the file, and selected the Copilot
harness. Use VS Code's customization diagnostics/reload only as needed.

See the [reviewer profile](../.github/agents/workshop-reviewer.agent.md) and
[VS Code custom-agent documentation](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
if discovery is blocked. The profile allows read/search tools only. Keep that
boundary; command execution belongs to the normal implementation session.

## Ready means

The app runs locally, baseline checks work, `specify version` prints `1.2.3` (or the
version your facilitator named), you know which script flavour you will use
(`ps`, `py`, or `sh`), and the reviewer can be selected. The repository is still
uninitialized for Spec Kit. Tell the facilitator about a setup blocker before the
event.

If blocked during the workshop, use [reference recovery](reference/README.md)
without discarding your work.

**Next:** [1. Orient in the application](steps/01-orient.md) |
[Workshop home](README.md)
