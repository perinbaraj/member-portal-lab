# Day 2 Labs — Quality, Governance & Capstone

**Theme:** Production readiness — quality gates, responsible AI governance, and an end-to-end capstone using the healthcare member portal.

## Starter Code

Continue using the full-stack member portal from Day 1:

```bash
npm run dev
# Starts both API (:3000) + UI (:5173) — browser opens automatically
```

Keep it running throughout Day 2. `Ctrl+C` to stop, same command to restart.

## Outcomes

- Integrate GHAS and code scanning into the PR workflow for **full-stack** HIPAA-regulated code (backend + frontend)
- Apply responsible AI governance for healthcare **full-stack** features (API + UI)
- Deliver a capstone feature using all Day 1 and Day 2 practices as a **fully integrated full-stack solution**
- Present evidence-based **full-stack** implementation with quality and governance controls across API and UI layers

## Delivery Flow

| Module | Session | Format | Output |
|---|---|---|---|
| Module 1 | Day 1 recap and Day 2 goals | Instructor-led | Prioritized quality backlog |
| Module 2 | Lab 5: Context Engineering — Healthcare Domain | Hands-on | Before/after comparison + reusable templates |
| Module 3 | Lab 6: Quality Gates — GHAS for Healthcare Code | Hands-on | CodeQL workflow + gate policy + fixed findings |
| Module 4 | Lab 7: Hands-on Copilot + Codex Workflow | Hands-on | Codex generation + Copilot review + human approval gate |
| Module 5 | Capstone: Benefits Eligibility Checker | Team hands-on | Full feature with spec, tests, gates, and governance |
| Module 6 | Team demos and validation walkthrough | Demo | Evidence-based 5-minute demo |
| Module 7 | Closeout and post-session action plan | Group review | Next-sprint adoption plan |

## Lab Sequence

1. [Lab 5: Context Engineering & Token Optimization — Healthcare Domain](05-context-engineering-token-optimization/README.md)
2. [Lab 6: Quality Gates — GHAS + Code Scanning](06-quality-gates-ghas-sonar/README.md)
3. [Lab 7: Hands-on Copilot + Codex Third-Party Model Workflow](07-third-party-model-codex-basics/README.md)
4. [Capstone: Benefits Eligibility Checker](capstone/README.md)
