# Day 1 Labs — Foundations & Workflow

**Theme:** Foundations for practical GitHub Copilot workflows — from spec-driven development to parallel execution, using healthcare use cases.

## Starter Code

All labs use the healthcare member portal (backend + frontend) from a single command:

```bash
npm install
npm run dev
```

This starts **both** the Express API (`:3000`) and React UI (`:5173`) concurrently. Your browser opens automatically. `Ctrl+C` stops everything.

> **One terminal. One command. Done.**

## Spec Kit

Labs 1–4 use [GitHub Spec Kit](https://github.com/github/spec-kit) for structured development. Install once:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
specify --version
```

## Outcomes

- Use Spec Kit to convert backlog items into **full-stack** shippable PRs (backend + frontend)
- Practice spec-first development with measurable outputs across API and UI layers
- Build role-based agents for healthcare **full-stack** code review (security, API design, frontend accessibility, HIPAA)
- Execute parallel task decomposition safely with backend and frontend lanes
- Engineer optimal Copilot context for **full-stack** HIPAA-compliant, accessible code

## Delivery Flow

| Module | Session | Format | Output |
|---|---|---|---|
| Module 1 | Kickoff, environment checks, objectives | Instructor-led | Confirmed tool readiness and starter-code running |
| Module 2 | Lab 1: Spec Kit + Copilot — Prescription Refill | Hands-on | Constitution + spec + PR for P1 slice |
| Module 3 | Lab 2: Spec-Driven Dev — Prior Authorization | Hands-on | Spec-grounded implementation with traceability |
| Module 4 | Lab 3: Role-Based Agents — Multi-Perspective Review | Hands-on | 4 agent personas + merged findings |
| Module 5 | Lab 4: Parallel Decomposition — Appointment Scheduling | Hands-on | 3 lanes merged with passing tests |
| Module 6 | Day 1 retro and prep for Day 2 | Group review | Quality backlog for Day 2 |

## Lab Sequence

1. [Lab 1: Spec Kit + Copilot — Prescription Refill](01-usage-to-agent-workflows/README.md)
2. [Lab 2: Spec-Driven Development — Prior Authorization](02-spec-driven-development/README.md)
3. [Lab 3: Role-Based Custom Agents — Multi-Perspective Review](03-role-based-custom-agents/README.md)
4. [Lab 4: Parallel Task Decomposition — Appointment Scheduling](04-parallel-task-decomposition/README.md)
