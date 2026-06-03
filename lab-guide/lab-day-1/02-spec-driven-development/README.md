# Lab 2: Spec-Driven Development — Prior Authorization Request

## Objective

Use the Spec Kit workflow to specify, plan, and implement a prior authorization request feature — demonstrating that spec-first development produces higher-quality code with less rework. Build **both the backend API and React frontend UI**.

**Use Case:** Members need to submit prior authorization requests for procedures that require insurance approval before the service is provided. The feature includes a backend endpoint and a React form component for members to request authorization.

## Prerequisites

- Completion of Lab 1
- Starter code running (`npm run dev` from repo root — starts both API + UI)
- Spec Kit CLI installed (`specify --version`)
- Copilot Chat with `/speckit.*` commands available

## The Backlog Item

> "As a member, I want to submit a prior authorization request for a recommended procedure so I know whether my insurance will cover it before I schedule the service."

## Step-by-step Instructions

### Step 1: Initialize the Feature

```bash
specify init prior-authorization --integration copilot
```

### Step 2: Establish Principles (or Reuse Lab 1 Constitution)

If you already have a constitution from Lab 1, link it:

```
/speckit.constitution Extend the existing constitution to include: prior auth decisions must include a denial reason code, all status transitions must be auditable, and members must never see another member's auth requests.
```

### Step 3: Create the Spec

In Copilot Chat:

```
/speckit.specify Build a prior authorization feature for the member portal. An authenticated member can view their prior auth requests and submit a new one. The submission requires: procedure code, referring provider, clinical justification (free text up to 500 chars), and preferred facility. Members see real-time status (pending, approved, denied, expired). Denied requests show reason and appeal instructions. Out of scope: provider-side submission, auto-adjudication, appeal submission.
```

**Expected spec content:**
- **User Story 1 (P1):** View prior auth requests — list with status badges
- **User Story 2 (P1):** Submit a new prior auth request — form with validation
- **User Story 3 (P2):** View denial details and appeal instructions
- Edge cases: duplicate submissions, expired auths, concurrent edits
- Entities: `PriorAuthorization`, `Member`, `Provider`

### Step 4: Clarify and Refine

```
/speckit.clarify
```

Expect questions about:
- What happens when a member submits for a procedure already pending?
- Is there a time limit for prior auth validity?
- Can members edit a pending request?

Answer each, confirm spec updates.

### Step 5: Generate the Plan

```
/speckit.plan Full-stack: Express BFF in server/ and React component in src/. Backend: Add routes under /api/prior-auth, store requests in-memory. Validate inputs with Zod. Frontend: Create PriorAuthForm React component with request submission and status tracking. Follow HIPAA rules: no PHI in logs, member isolation enforced. Both layers follow accessibility and security constitution.
```

**Expected plan sections:**

**Backend:**
- New route file: `server/routes/prior-auth.ts`
- New service file: `server/services/prior-auth-service.ts`
- Zod validation schemas for request body
- Status transition state machine
- Error handling pattern

**Frontend:**
- New React component: `src/components/PriorAuthForm.tsx`
- API service integration in `src/services/httpClient.ts`
- Form with procedure code input, submit button, status display
- Error and success state messaging

### Step 6: Generate Tasks

```
/speckit.tasks
```

**Expected tasks:**
```markdown
## User Story 1 (P1): View prior auth requests
- [ ] T-001: Create GET /api/prior-auth route
- [ ] T-002: Implement prior-auth-service with in-memory store
- [ ] T-003: Add Zod schema for PriorAuthorization type
- [ ] T-004: Tests: happy path, empty list, 401

## User Story 2 (P1): Submit new request
- [ ] T-005: Create POST /api/prior-auth route
- [ ] T-006: Input validation (procedure code, provider, justification length)
- [ ] T-007: Duplicate submission guard
- [ ] T-008: Tests: valid submit, validation errors, duplicate
```

### Step 7: Analyze for Gaps

```
/speckit.analyze
```

Fix issues before implementation.

### Step 8: Implement P1 Slice

```
/speckit.implement
```

Scope to User Stories 1 and 2 only. Validate after each task:

```bash
npm test
npm run typecheck
```

### Step 9: Verify Spec Traceability

Open the implemented code and confirm:
- Each route maps to a functional requirement ID
- Each test maps to an acceptance scenario
- No code exists that isn't in the plan

### Step 10: Open PR with Spec-Grounded Description

```bash
git checkout -b 002-prior-authorization
git add .
git commit -m "feat: prior authorization request (US1+US2 P1 slice)"
git push -u origin 002-prior-authorization
```

```
Draft a PR description from spec.md and tasks.md. List acceptance scenarios covered, requirements implemented, and what's deferred to P2.
```

## Exit Criteria

- [ ] `spec.md` contains at least 3 user stories with Given/When/Then scenarios
- [ ] `spec.md` includes explicit non-goals and edge cases
- [ ] `plan.md` maps to specific files in the codebase
- [ ] All P1 tasks are implemented and checked off
- [ ] Every acceptance criterion for P1 has a corresponding test
- [ ] No code exists outside the plan scope
- [ ] `npm test` and `npm run typecheck` pass
- [ ] PR description links requirements to implementation

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Specify + Clarify | 15 min | Iterate until acceptance criteria are testable |
| Plan + Tasks + Analyze | 10 min | Don't skip analyze — it catches drift |
| Implement (P1 only) | 30 min | If you're touching P2 scope, stop and re-read the spec |
| Validate + PR | 5 min | PR description is Copilot-drafted from artifacts |

**The lesson:** A spec with testable criteria eliminates "what did you mean?" during implementation. The spec is the single source of truth — not the conversation.

## Links

- [Spec Kit repo](https://github.com/github/spec-kit)
- [Spec Kit docs](https://github.github.io/spec-kit/)
- [Spec template](https://github.com/github/spec-kit/blob/main/templates/spec-template.md)
