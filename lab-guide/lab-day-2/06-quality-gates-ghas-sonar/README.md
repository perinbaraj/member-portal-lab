# Lab 6: Quality Gates — GHAS + Code Scanning for Healthcare Code

## Objective

Integrate GitHub Advanced Security (GHAS) code scanning and quality checks into the PR workflow for **both backend and frontend code**. Treat gate failures as first-class feedback — especially PHI leakage, injection vulnerabilities, missing auth checks, accessibility violations, and HIPAA violations.

**Use Case:** The member portal team opens a PR for the prescription refill feature across both backend and frontend. Before merge, automated security and quality scanning must catch: PHI in logs, SQL injection risks, missing auth checks (backend); missing accessibility labels, console errors, security vulnerabilities (frontend); and code quality issues across both layers.

## Prerequisites

- Completion of Day 1 labs (Labs 1–5)
- A feature branch with at least one implemented feature (prescription refill, prior auth, or appointments)
- GitHub repository with GHAS enabled (or ability to enable it)
- Copilot Chat available

> **Setup Note:** This lab requires pushing to a GitHub remote. If you haven't already, create a GitHub repository and add it as a remote:
> ```bash
> git remote add origin https://github.com/<your-org>/member-portal-lab.git
> ```
> The `npm run lint` script exists in `package.json` but ESLint is **not yet installed** — configuring it is part of this lab (Step 2).

## Step-by-step Instructions

### Step 1: Create a Branch with Intentional Issues

Create a test branch with small, controlled security/quality issues to trigger scanning:

```bash
git checkout -b lab6-quality-gates
```

In Copilot Chat:

```
Add these intentional issues to the prescription route for testing quality gates (I will fix them after scanning catches them):
1. A console.log that includes the member's full name and date of birth
2. A route that doesn't check auth before returning data
3. A string-concatenated query instead of parameterized
4. A hardcoded API key in the service file
Keep each issue to 1-2 lines so they're easy to find and fix.
```

Commit and push:

```bash
git add .
git commit -m "test: intentional issues for quality gate validation"
git push -u origin lab6-quality-gates
```

### Step 2: Enable Code Scanning

Create `.github/workflows/codeql.yml`:

```
Create a GitHub Actions workflow that runs CodeQL analysis on push and PR for TypeScript/JavaScript. Include:
- Trigger on push to main and PRs
- CodeQL init with javascript language
- Autobuild step
- CodeQL analyze step
Also create a basic ESLint config that flags console.log statements and enforces strict TypeScript.
```

### Step 3: Open the PR and Trigger Scans

```bash
gh pr create --title "feat: prescription refill (with quality gate test)" --body "Testing quality gates"
```

Wait for checks to complete. Review the findings.

### Step 4: Review GHAS / CodeQL Findings

In the PR, review the Security tab findings:

```
Review the CodeQL findings on this PR. For each finding, explain:
1. What the vulnerability is
2. Why it matters in a HIPAA-regulated healthcare app
3. The severity (critical/high/medium/low)
4. The specific fix
Format as a table.
```

**Expected findings:**

| # | Finding | HIPAA Impact | Severity | Fix |
|---|---|---|---|---|
| 1 | PHI in log statement | Violates §164.312 — audit controls | CRITICAL | Remove PHI, log hashed memberId only |
| 2 | Missing auth check | Unauthorized PHI access | CRITICAL | Add authMiddleware before route |
| 3 | String concatenation (injection) | Data breach risk | HIGH | Use parameterized query |
| 4 | Hardcoded secret | Credential exposure | HIGH | Move to environment variable |

### Step 5: Fix Findings and Re-run

Fix each finding:

```
Fix all four quality gate findings. For each fix:
1. Remove the PHI from the log — log only a hashed member ID
2. Add auth middleware to the unprotected route
3. Replace string concatenation with parameterized approach
4. Move the API key to process.env and add to .env.example
Follow the patterns in the existing codebase.
```

```bash
git add .
git commit -m "fix: resolve quality gate findings (PHI, auth, injection, secret)"
git push
```

### Step 6: Confirm Gates Pass

Check that:
- CodeQL shows 0 critical/high findings
- ESLint passes
- TypeScript compiles cleanly
- Tests still pass

```bash
npm run lint
npm run typecheck
npm test
```

### Step 7: Define Team Quality Gate Policy

Create a quality gate policy document:

```
Create a quality gate policy for our healthcare team based on what we learned. Include:
- Blocking criteria (what prevents merge)
- Warning criteria (what requires review but doesn't block)
- Exception process (break-glass with approval and expiration)
- HIPAA-specific rules (PHI in logs is always blocking)
Format as a markdown document.
```

Save as `docs/quality-gate-policy.md`.

### Step 8: Add a Copilot Review Agent (Bonus)

Create a PR review prompt that runs the security reviewer agent from Lab 3 against every PR:

```
Create a .github/prompts/pr-review.prompt.md that instructs Copilot to review PRs with these checks:
- No PHI in any log, error message, or comment
- All routes have auth middleware
- All inputs validated with Zod
- No hardcoded secrets
- Tests exist for the happy path and auth failure
Output: approve/request-changes with specific findings.
```

## Exit Criteria

- [ ] Branch with intentional issues was created and pushed
- [ ] CodeQL workflow runs on PRs
- [ ] At least 3 security/quality findings were detected by scanning
- [ ] All critical and high findings were fixed
- [ ] Gates pass after fixes (0 critical/high, lint clean, types clean)
- [ ] Quality gate policy document exists with HIPAA-specific rules
- [ ] Team can explain the difference between blocking and warning findings

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Create intentional issues | 5 min | Keep them small and obvious |
| Set up CodeQL + ESLint | 10 min | Use Copilot to generate the workflow |
| Open PR + review findings | 10 min | Document each finding |
| Fix + re-run | 15 min | One commit per fix category |
| Gate policy document | 10 min | This carries forward to capstone |
| Bonus: PR review agent | 10 min | Optional but feeds into capstone |

**The lesson:** Quality gates catch what humans miss — especially in healthcare where a single PHI leak is a reportable incident. Automate the non-negotiable checks so reviewers can focus on design decisions.
