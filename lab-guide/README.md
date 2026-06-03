# Optum Madhuri 2026 — GitHub Copilot Pre-Hack Lab Pack

Hands-on lab pack for the Optum Madhuri 2026 pre-hack. Two days of structured GitHub Copilot exercises using a full-stack healthcare member portal, covering Spec Kit workflows, role-based agents, quality gates, and responsible AI governance.

> **Instructions + starter code included.** All labs use the same member portal codebase with both backend (Node.js + Express) and frontend (React 18 + TypeScript) in the root directory.

---

## Contents

- [Starter Guide](#starter-guide)
- [Architecture](#architecture)
- [Day 1 Agenda](#day-1-agenda)
- [Day 2 Agenda](#day-2-agenda)
- [Prerequisites & Preflight Checklist](#prerequisites--preflight-checklist)

---

## Starter Guide

### How to Use This Repo

1. Complete the [Prerequisites & Preflight Checklist](#prerequisites--preflight-checklist) before the session.
2. Start the unified portal: `npm install && npm run dev`
   - This starts **both** the Express API (port 3000) and React UI (port 5173) concurrently.
   - Browser opens automatically. `Ctrl+C` stops everything.
3. Install Spec Kit: `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
4. Work through labs in order — each day builds on the previous.

### Starter Code & Frontend

**Backend (BFF):** Located in `server/`, contains a healthcare member portal in Node.js + Express + TypeScript with:
- Member profiles, claims, and prescription routes (partially implemented)
- In-memory stub data for 3 test members
- Auth middleware (stub using `x-member-id` header)
- Copilot instructions file (`.github/copilot-instructions.md`)
- Intentional TODOs for lab exercises

**Frontend (SPA):** Located in `src/`, contains a React 18 + TypeScript application with:
- Initial components for member profile, prescriptions, and claims
- API service layer connected to backend
- Responsive styling with WCAG 2.1 AA accessibility
- Development server with hot module reloading (Vite)

### Architecture

The workshop introduces a **full-stack architecture** where both the backend API and React frontend evolve through each lab:

```
┌─────────────────────────────────┐
│   Member Portal (Full-Stack)    │
├─────────────┬───────────────────┤
│   React 18  │   Express BFF     │
│   (Vite)    │   (Node.js 20+)   │
│             │                   │
│ Components: │ Routes:           │
│ - Profile   │ - GET /api/...    │
│ - Claims    │ - POST /api/...   │
│ - Prescr.   │ - Types & Auth    │
└─────────────┴───────────────────┘
        ↓                   ↓
   Port 5173          Port 3000
```

**From Day 1 onward, labs include both layers.** A "prescription refill feature" means both a backend endpoint AND a React component. This mirrors real-world full-stack development.

### Lab Workflow (Spec Kit)

All labs follow the [GitHub Spec Kit](https://github.com/github/spec-kit) methodology:
1. **Constitution** — lock project principles (HIPAA, accessibility, performance)
2. **Specify** — define requirements with Given/When/Then scenarios
3. **Plan** — generate file-level implementation plan
4. **Tasks** — break into actionable, checkable items
5. **Implement** — Copilot executes tasks against the spec

### Lab Conventions

- Complete all exit criteria before moving to the next lab
- Commit artifacts to your branch at logical checkpoints
- Use the starter-code Copilot instructions for consistent HIPAA-compliant output
- Demo working evidence: commands, PR checks, reports — not just narrative

### Recommended Team Setup

- Team size: 3–5 participants
- Rotate roles per lab: **Driver**, **Spec Owner**, **Frontend Owner**, **Security/Compliance**, **QA**
- Timebox each step; do not continue when validation fails
- Each lab expects both backend and frontend deliverables (unless explicitly API-only)

### Lab Directories

| Day | Directory | Labs | Healthcare Use Cases |
|---|---|---|---|
| Day 1 | [lab-day-1/](lab-day-1/) | Labs 1–4 | Prescription refill, prior auth, appointments |
| Day 2 | [lab-day-2/](lab-day-2/) | Labs 5–8 | Context engineering, quality gates, AI governance, benefits eligibility |

---

## Day 1 Agenda

**Theme:** Foundations for practical GitHub Copilot workflows — spec-driven development with healthcare use cases.

### Day 1 Outcomes

- Use Spec Kit to convert backlog items into **full-stack** shippable PRs (backend API + React component)
- Practice spec-first implementation with measurable outputs across both layers
- Build role-based agents for **full-stack** healthcare code review (API design, frontend accessibility, HIPAA compliance)
- Execute parallel task decomposition safely with backend and frontend lanes
- Engineer optimal Copilot context for **full-stack** HIPAA-compliant, accessible code

### Day 1 Delivery Flow

| Module | Session | Format | Output |
|---|---|---|---|
| Module 1 | Kickoff, environment checks, objectives | Instructor-led | Starter code running, Spec Kit installed |
| Module 2 | Lab 1: Spec Kit + Copilot — Prescription Refill | Hands-on | Constitution + spec + PR for P1 slice |
| Module 3 | Lab 2: Spec-Driven Dev — Prior Authorization | Hands-on | Spec-grounded implementation with full traceability |
| Module 4 | Lab 3: Role-Based Agents — Multi-Perspective Review | Hands-on | 4 agent personas + merged findings |
| Module 5 | Lab 4: Parallel Decomposition — Appointment Scheduling | Hands-on | 3 lanes merged with passing tests |
| Module 6 | Day 1 retro and prep for Day 2 | Group review | Quality backlog for Day 2 |

### Day 1 Lab Sequence

1. [Lab 1: Spec Kit + Copilot — Prescription Refill](lab-day-1/01-usage-to-agent-workflows/README.md)
2. [Lab 2: Spec-Driven Development — Prior Authorization](lab-day-1/02-spec-driven-development/README.md)
3. [Lab 3: Role-Based Custom Agents — Multi-Perspective Review](lab-day-1/03-role-based-custom-agents/README.md)
4. [Lab 4: Parallel Task Decomposition — Appointment Scheduling](lab-day-1/04-parallel-task-decomposition/README.md)

---

## Day 2 Agenda

**Theme:** Production readiness — quality gates, responsible AI governance, and an end-to-end capstone.

### Day 2 Outcomes

- Integrate GHAS and code scanning into the PR workflow for **full-stack** HIPAA-regulated code (backend + frontend)
- Apply responsible AI governance for **full-stack** healthcare features (both API and UI implications)
- Deliver a capstone feature using all Day 1 and Day 2 practices as a **fully integrated full-stack solution**
- Present evidence-based **full-stack** implementation with quality and governance controls across both layers

### Day 2 Delivery Flow

| Module | Session | Format | Output |
|---|---|---|---|
| Module 1 | Day 1 recap and Day 2 goals | Instructor-led | Prioritized quality backlog |
| Module 2 | Lab 5: Context Engineering — Healthcare Domain | Hands-on | Before/after comparison + reusable templates |
| Module 3 | Lab 6: Quality Gates — GHAS for Healthcare Code | Hands-on | CodeQL workflow + gate policy + fixed findings |
| Module 4 | Lab 7: Responsible AI — Claims Triage Governance | Hands-on | Model evaluation + governance record + incident playbook |
| Module 5 | Capstone: Benefits Eligibility Checker | Team hands-on | Full feature with spec, tests, gates, governance |
| Module 6 | Team demos and validation walkthrough | Demo | Evidence-based 5-minute demo |
| Module 7 | Closeout and post-session action plan | Group review | Next-sprint adoption plan |

### Day 2 Lab Sequence

1. [Lab 5: Context Engineering & Token Optimization — Healthcare Domain](lab-day-2/01-context-engineering-token-optimization/README.md)
2. [Lab 6: Quality Gates — GHAS + Code Scanning](lab-day-2/02-quality-gates-ghas-sonar/README.md)
3. [Lab 7: Responsible AI + Model Governance — Claims Triage](lab-day-2/04-responsible-ai-model-governance/README.md)
4. [Capstone: Benefits Eligibility Checker](lab-day-2/03-capstone/README.md)

---

## Prerequisites & Preflight Checklist

Complete this checklist before starting labs. Mark blockers immediately.

### 1) Environment Readiness

- [ ] Windows 11 / macOS 13+ with admin access
- [ ] VS Code latest stable installed
- [ ] Git CLI installed and available in terminal
- [ ] Node.js 20+ installed (npm included)
- [ ] Python 3.10+ installed (for `uv` and utilities)
- [ ] `uv` installed ([docs.astral.sh/uv](https://docs.astral.sh/uv/))
- [ ] Reliable internet + Teams audio/video tested

### 2) Access and Identity

- [ ] GitHub account can sign in successfully
- [ ] GitHub Copilot license assigned and active
- [ ] VS Code signed in to GitHub
- [ ] Access to your project repository confirmed
- [ ] Can create branch in your fork or assigned repo path

### 3) Project Repo and Workspace

1. Clone and open your project repository:
   ```powershell
   git clone <your-project-repo-url>
   cd <your-project-folder>
   git checkout -b prehack/<your-alias>
   ```
2. Confirm repo health:
   ```powershell
   git --no-pager status
   ```
3. Keep this lab pack available locally for reference:
   - `optum-madhuri-2026\starter-code`
   - `optum-madhuri-2026\lab-day-1`
   - `optum-madhuri-2026\lab-day-2`

### 4) Copilot and Spec Kit Validation

- [ ] GitHub Copilot extension installed in VS Code
- [ ] GitHub Copilot Chat extension installed in VS Code
- [ ] Copilot icon shows active (no auth warning)
- [ ] Chat panel opens and returns response to test prompt
- [ ] Inline suggestion accepted at least once in a scratch file
- [ ] Spec Kit CLI installed: `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git`
- [ ] `specify --version` returns version text

### 5) Validation Commands (Pass/Fail Gate)

Run all commands and capture outputs in notes or screenshots.

```powershell
git --version
node --version
npm --version
python --version
code --version
gh --version
uv --version
specify --version
```

Expected:

- `git`, `node`, `npm`, `python`, `code`, `gh`, `uv`, `specify` return version text
- Node is `20.x` or higher
- VS Code CLI command works from terminal

### 6) Quick Functional Smoke Test

From your project repo root:

```powershell
git --no-pager branch --show-current
git --no-pager remote -v
```

- [ ] Branch name matches pre-hack naming convention
- [ ] Remote origin resolves correctly
- [ ] No authentication prompts fail

### 7) Escalation Before Session

If any gate fails:

1. Capture exact error text.
2. Retry once after sign-out/sign-in (GitHub + VS Code).
3. Raise in pre-hack Teams channel with:
   - machine/OS
   - failing command
   - screenshot/error text
4. Tag facilitator + support owner.
