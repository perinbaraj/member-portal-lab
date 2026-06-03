# Lab 5: Context Engineering & Token Optimization — Healthcare Domain

## Objective

Improve Copilot output quality by engineering precise context packs — sending only high-signal healthcare domain context while eliminating noise across both backend and frontend. Demonstrate measurable improvement in output quality.

**Use Case:** Optimize prompts for the full-stack member portal codebase (backend + frontend) so Copilot produces HIPAA-compliant, spec-aligned, accessible code without unnecessary token waste or hallucinated dependencies.

## Prerequisites

- Completion of Labs 1–4
- Working member portal with multiple implemented features
- Copilot Chat in VS Code
- `.github/copilot-instructions.md` file in the repo

## Step-by-step Instructions

### Step 1: Establish a Baseline (Bad Prompt)

Run a deliberately broad, low-context prompt and capture the result:

```
Add a feature to handle claims appeals in the member portal. Make it work with the existing code.
```

**Record:**
- How many files did Copilot try to change?
- Did it follow HIPAA rules? (Check for PHI in logs)
- Did it match existing code patterns? (Express routes, service layer, Zod)
- Did it introduce dependencies not in `package.json`?
- How many corrections were needed?

Score: ___ / 5 (1 = unusable, 5 = production-ready)

### Step 2: Identify Context Signals

What makes a prompt produce good healthcare code? The signals are:

| Signal | Example | Why |
|---|---|---|
| Spec reference | "Per FR-003 in spec.md..." | Grounds output in requirements |
| File paths | "In server/server.ts..." | Eliminates guessing about structure |
| Type definitions | "Use the Claim interface from types/index.ts" | Prevents invented types |
| Constitution rules | "Follow HIPAA rules: no PHI in logs" | Enforces compliance |
| Existing patterns | "Follow the pattern in prescriptions.ts" | Ensures consistency |
| Non-goals | "Do NOT add a frontend component" | Prevents scope creep |
| Output format | "Return only the TypeScript code for the route file" | Reduces noise |

### Step 3: Build a Minimum Effective Context Pack

Create a reusable template:

```markdown
## Context Pack Template

**Task:** [one-sentence description]

**Spec Reference:** [link to spec section or acceptance scenario]

**Target File:** [exact path, e.g., server/server.ts or server/routes/claims.ts]

**Existing Pattern:** [reference file to follow, e.g., the prescriptions route in server/server.ts]

**Type Contracts:** [import from types/index.ts — list relevant interfaces]

**Constitution Rules:**
- No PHI in logs or error messages
- Member isolation enforced
- Input validation via Zod
- Return appropriate HTTP status codes

**Non-Goals:**
- [what NOT to do]

**Output Format:**
- [what you want back — code only, or explanation + code]
```

### Step 4: Re-run with Context Pack

```
Task: Add a POST /api/claims/:claimId/appeal endpoint that lets a member submit an appeal for a denied claim.

Spec Reference: The member provides a reason (string, max 1000 chars) and optional supporting document reference. Only denied claims can be appealed. A claim can only be appealed once.

Target File: server/server.ts (add to existing claims routes, or create server/routes/claims.ts)

Existing Pattern: Follow the pattern of the prescriptions route in server/server.ts for route structure, error handling, and response format.

Type Contracts: Use the Claim interface from server/types.ts. Add an Appeal interface with: appealId, claimId, memberId, reason, status (submitted/in_review/decided), submittedAt.

Constitution Rules:
- No PHI in log statements
- Validate memberId matches claim owner (403 if not)
- Validate input with Zod schema
- Return 201 on success, 400 on validation error, 404 on claim not found, 409 if already appealed

Non-Goals:
- Do NOT modify the frontend
- Do NOT add file upload handling
- Do NOT change existing claim routes

Output Format: TypeScript code for the new route handler + Zod schema + updated types. Separate by file.
```

**Record:**
- Output quality score: ___ / 5
- Corrections needed: ___
- HIPAA violations: ___
- Scope drift: ___

### Step 5: Compare Results

| Metric | Baseline (Step 1) | Optimized (Step 4) | Improvement |
|---|---|---|---|
| Quality score (1–5) | | | |
| Corrections needed | | | |
| HIPAA violations | | | |
| Files touched | | | |
| Unwanted dependencies | | | |
| Follows existing patterns | | | |

### Step 6: Add Token Efficiency Controls

Further optimize by adding constraints:

```
Additional constraints:
- Respond with code only, no explanation unless the code has a non-obvious design choice
- Keep the implementation under 80 lines per file
- If unsure about a decision, ask rather than assume
```

Re-run and compare token usage and output quality.

### Step 7: Create Team Context Pack Library

Save two reusable templates:

1. **Bug fix template** — fast, narrow, single-file focus
2. **Feature template** — spec-grounded, multi-file, constitution-aware

Commit both as `.github/prompts/context-pack-bugfix.md` and `.github/prompts/context-pack-feature.md`.

### Step 8: Optimize `copilot-instructions.md`

Review the existing `.github/copilot-instructions.md` file. Does it contain:
- Enough to enforce HIPAA rules automatically?
- Project structure hints?
- Too much noise that dilutes important rules?

Refine it based on what you learned about effective signals.

## Exit Criteria

- [ ] Baseline prompt recorded with quality score
- [ ] Optimized prompt recorded with quality score
- [ ] Before/after comparison shows measurable improvement
- [ ] Context pack template is documented and reusable
- [ ] At least 2 saved prompt templates (bugfix + feature)
- [ ] `copilot-instructions.md` reviewed and optimized
- [ ] Token efficiency constraints tested

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Baseline (bad prompt) | 5 min | Intentionally run a broad prompt |
| Identify signals | 5 min | Review the signal table |
| Build context pack | 10 min | Use the template |
| Optimized run + compare | 15 min | Score both, fill comparison table |
| Token efficiency + templates | 15 min | Create reusable team assets |
| Optimize copilot-instructions | 10 min | Feeds into Day 2 capstone |

**The lesson:** Context is the highest-leverage input to Copilot. A 5-line context pack outperforms a 50-line vague prompt. In healthcare, precise context also prevents compliance violations.
