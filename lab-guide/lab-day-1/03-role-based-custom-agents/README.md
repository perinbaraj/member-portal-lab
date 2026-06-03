# Lab 3: Role-Based Custom Agents — Multi-Perspective Code Review

## Objective

Design role-specific Copilot agents (Security Reviewer, API Engineer, QA Lead, Frontend Engineer, HIPAA Compliance Officer) and use them to review code from multiple healthcare-domain perspectives simultaneously. Review both backend and frontend code.

**Use Case:** The prescription refill feature from Lab 1 needs peer review from multiple angles — backend API security, React frontend accessibility, HIPAA compliance. Instead of waiting for specialists, you create agent personas that review the code across both layers with different lenses.

## Prerequisites

- Completion of Labs 1 and 2
- Working prescription refill implementation (from Lab 1) or prior auth (Lab 2)
- Copilot Chat with custom instructions support
- Starter code with implemented routes to review

## Step-by-step Instructions

### Step 1: Define Four Role Personas

Two agents use **`.prompt.md`** (reusable slash-command prompts invoked with `/`) and two use **`.agent.md`** (custom chat modes selected from the agent mode picker). All files live in `.github/prompts/`.

#### Prompt files (invoked with `/`)

**File: `.github/prompts/security-reviewer.prompt.md`**

In Copilot Chat:

```
Create a custom prompt file for a Security Reviewer agent. This agent reviews healthcare application code with these rules:
- Flag any PHI that could leak into logs, error messages, or responses
- Check for member isolation violations (member A accessing member B's data)
- Verify input validation on all endpoints
- Check for injection risks (SQL, NoSQL, command)
- Verify auth checks on every route
- Output format: table with columns [File, Line, Severity, Finding, Recommendation]
- Never suggest fixes that weaken security
```

**File: `.github/prompts/api-engineer.prompt.md`**

```
Create a custom prompt file for an API Engineer agent. This agent reviews Express route implementations with these rules:
- Verify RESTful conventions (proper HTTP methods, status codes, resource naming)
- Check request/response schemas match the spec
- Verify error handling returns appropriate status codes
- Check pagination on list endpoints
- Verify idempotency keys on mutation endpoints
- Output format: table with [Endpoint, Issue, Spec Reference, Fix]
```

#### Agent mode files (selected from the chat mode picker)

**File: `.github/agents/qa-strategist.agent.md`**

```
Create a custom agent file for a QA Strategist. Use this YAML frontmatter followed by the system prompt:

---
name: QA Strategist
description: Reviews test coverage and acceptance scenario gaps for healthcare features.
tools:
  - codebase
  - search
---

You are a QA Strategist reviewing test coverage for a HIPAA-regulated healthcare portal. Apply these rules:
- Identify untested acceptance scenarios from the spec
- Flag missing edge case tests (empty state, boundary values, auth failures)
- Check that tests are independent and don't share mutable state
- Verify test names describe behavior, not implementation
- Output format: table with [Scenario, Status (covered/missing), Priority, Test File]
```

**File: `.github/agents/hipaa-compliance.agent.md`**

```
Create a custom agent file for a HIPAA Compliance Officer. Use this YAML frontmatter followed by the system prompt:

---
name: HIPAA Compliance Officer
description: Audits source code for HIPAA regulatory compliance across the full codebase.
tools:
  - codebase
  - search
  - read_file
---

You are a HIPAA Compliance Officer auditing a healthcare member portal. Apply these rules:
- No PHI in any log statement (member names, DOB, diagnoses, medications)
- All audit events use hashed member IDs
- Error messages are generic (no internal data exposed)
- Data retention rules are followed
- Access controls enforce minimum necessary principle
- Output format: table with [Violation Type, File, Evidence, Remediation, Regulatory Reference]
```

### Step 2: Run Each Agent Against the Same Code

Point each agent at your Lab 1 or Lab 2 implementation.

**Prompt files** — invoke with `/` in Copilot Chat:

```
/security-reviewer Review the prescription routes and services in server/server.ts
```

```
/api-engineer Review the prescription refill API implementation against the spec in .specify/specs/001-prescription-refill/spec.md
```

**Agent mode files** — select the agent from the chat mode picker (the dropdown next to the chat input), then send your message:

```
Review test coverage for the prescription refill feature against the acceptance scenarios in spec.md
```
*(Switch to the **QA Strategist** agent mode before sending.)*

```
Review all source files in src/ and server/ for HIPAA compliance issues
```
*(Switch to the **HIPAA Compliance Officer** agent mode before sending.)*

### Step 3: Collect and Compare Findings

Create a findings matrix:

| Finding | Security | API | QA | HIPAA | Conflict? |
|---|---|---|---|---|---|
| Log includes memberId | CRITICAL | — | — | CRITICAL | No |
| Missing 404 on invalid Rx ID | Medium | HIGH | Missing test | — | No |
| POST returns 200 instead of 201 | — | HIGH | — | — | No |
| No rate limiting | HIGH | Medium | — | — | Agree on HIGH |

### Step 4: Identify Conflicts Between Agents

Look for cases where agents disagree:
- Security says "return generic 404" vs. API Engineer says "return helpful error with details"
- QA says "add detailed assertion messages" vs. HIPAA says "no PHI in test output"

### Step 5: Resolve Conflicts with a Merge Prompt

```
Given these conflicting recommendations from Security and API agents:
- Security: "Return generic 404 for all not-found cases to prevent enumeration"
- API: "Return specific error codes (RX_NOT_FOUND vs RX_EXPIRED) for better UX"

Resolve this conflict for a HIPAA-regulated healthcare application. Provide the final recommendation with rationale.
```

### Step 6: Apply Merged Decisions

Implement the top 3 findings from the merged review. For each:
1. Reference the finding
2. Apply the fix
3. Run validation
4. Commit with message referencing the agent that flagged it

```bash
git add .
git commit -m "fix: resolve security+compliance findings from agent review"
```

### Step 7: Save Reusable Agent Templates

Ensure all four files are committed and documented for team reuse:

| File | Type | Invocation |
|---|---|---|
| `security-reviewer.prompt.md` | Prompt | `/security-reviewer` in chat |
| `api-engineer.prompt.md` | Prompt | `/api-engineer` in chat |
| `qa-strategist.agent.md` | Agent mode | Select from chat mode picker |
| `hipaa-compliance.agent.md` | Agent mode | Select from chat mode picker |

## Exit Criteria

- [ ] Two `.prompt.md` files (`security-reviewer`, `api-engineer`) and two `.agent.md` files (`qa-strategist`, `hipaa-compliance`) exist in `.github/prompts/ ` and ` .github/agents/ `
- [ ] Each agent was run against the same code and produced structured output
- [ ] Findings matrix documents all issues from all four perspectives
- [ ] At least one conflict between agents was identified and resolved
- [ ] Merged decision document explains the resolution rationale
- [ ] Top 3 findings were implemented and committed
- [ ] All agents can be invoked by other team members without modification

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Define 4 agent personas | 15 min | Use exact prompts above as starting point |
| Run all agents | 10 min | Run in sequence, capture outputs |
| Build findings matrix | 10 min | Focus on overlaps and conflicts |
| Resolve conflicts + implement fixes | 20 min | Apply top 3 only |
| Commit + document | 5 min | Save templates for Day 2 reuse |

**The lesson:** Role-based agents surface issues a single reviewer would miss. The conflict resolution step forces architectural decisions to be explicit rather than implicit.
