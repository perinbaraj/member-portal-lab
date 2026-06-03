# Capstone Lab: End-to-End Healthcare Feature Delivery

## Objective

Deliver a **production-ready full-stack feature** for the member portal by combining all practices from Days 1 and 2: Spec Kit workflow, role-based agents, parallel decomposition, context engineering, quality gates, and AI governance. Both backend API and React frontend UI are in scope.

**Use Case:** Build a **Benefits Eligibility Checker** — members can verify whether a specific procedure or service is covered by their plan before scheduling, reducing surprise bills and denied claims. Feature includes a backend API and a React form/results UI.

## Prerequisites

- Completion of Labs 1–7
- Team roles assigned: **Driver**, **Spec Owner**, **Frontend Owner**, **Security/Compliance**, **QA**, **Governance Lead**
- Starter code with all Day 1 features working (`npm run dev` — runs both backend and frontend)
- GHAS/CodeQL workflow active
- Role-based agent prompts from Lab 3 ready
- Context pack templates from Lab 5 ready

## Step-by-step Instructions

### Phase 1: Specify (20 min)

#### Step 1: Initialize and Spec

```bash
specify init benefits-eligibility --integration copilot
```

```
/speckit.specify Build a benefits eligibility checker for the member portal. An authenticated member can check whether a procedure is covered by their plan. The member provides: procedure code or keyword search, and optional provider. The system returns: coverage status (covered/not covered/partially covered), estimated member responsibility (copay/coinsurance), any prior auth requirement, and in-network vs out-of-network distinction. Out of scope: real-time cost estimation, provider directory, plan enrollment changes.
```

#### Step 2: Clarify and Lock

```
/speckit.clarify
```

#### Step 3: Validate Constitution Alignment

```
/speckit.constitution Verify the benefits eligibility feature aligns with: HIPAA compliance (no PHI in logs), member isolation, WCAG 2.1 AA accessibility, and p95 < 500ms performance budget.
```

### Phase 2: Plan and Decompose (20 min)

#### Step 4: Generate Plan

```
/speckit.plan Full-stack implementation: Express BFF and React 18 frontend. Backend: Add routes under /api/eligibility, create a benefits-service wrapping the downstream benefits-determination API. Use Zod for validation. Frontend: Create EligibilityChecker React component with form input (procedure code search), results display (coverage status, cost estimate, auth requirement), and error handling. Both layers use the context pack template for optimal prompting.
```

#### Step 5: Generate and Assign Tasks

```
/speckit.tasks
```

#### Step 6: Define Parallel Lanes

| Lane | Owner | Scope | Files |
|---|---|---|---|
| A: API + Service | Driver | Routes, service layer, types | `src/routes/eligibility.ts`, `src/services/benefits-service.ts` |
| B: Frontend Component | Frontend Owner | React component, API integration, styling | `src/components/EligibilityChecker.tsx`, `src/services/api.ts` (update) |
| C: Tests + Validation | QA | Unit tests (backend + frontend), integration tests | `tests/eligibility.test.ts`, component tests |
| D: Security + Governance | Security/Compliance | Auth checks, PHI audit, governance record, a11y review | Security/HIPAA review, a11y audit |

Define contracts before starting:

```
Define the TypeScript interface contract for the benefits eligibility feature. Include: request types (procedure lookup, eligibility response), error types, and the BenefitsEligibility entity. All lanes will import these types.
```

### Phase 3: Build (55 min)

#### Step 7: Execute Lane A (Backend Implementation)

Use context pack template from Lab 5:

```
Task: Implement GET /api/eligibility/check endpoint and POST /api/eligibility/search endpoint.

Spec Reference: User Story 1 (check by procedure code) and User Story 2 (search by keyword).

Target Files: src/routes/eligibility.ts, src/services/benefits-service.ts

Existing Pattern: Follow src/routes/prescriptions.ts for route structure.

Type Contracts: Import from types/eligibility.ts (defined in lane contracts).

Constitution Rules: No PHI in logs, member isolation, Zod validation, proper HTTP status codes.

Non-Goals: No real benefits API call (use stub data).
```

```
/speckit.implement
```

#### Step 8: Execute Lane B (Frontend Component)

Use context pack template from Lab 5:

```
Task: Create EligibilityChecker React component in ../../starter-code/frontend/src/components/EligibilityChecker.tsx

Spec Reference: User Story 1 (search and display) and User Story 2 (result formatting).

Target Files: frontend/src/components/EligibilityChecker.tsx, frontend/src/services/api.ts

Existing Pattern: Follow frontend/src/components/PrescriptionsList.tsx for structure.

Type Contracts: Import EligibilityRequest, EligibilityResponse types from ../starter-code/src/types/eligibility.ts

Component Features: Form for procedure search, loading state, results display (coverage status, cost, auth requirement), error handling, WCAG 2.1 AA accessibility.

Non-Goals: No real benefits calculation (component displays mock API responses).
```

```
/speckit.implement
```

#### Step 9: Execute Lane C (Tests)

```
Write comprehensive tests for the eligibility API based on the acceptance scenarios in spec.md. Cover:
- Happy path: valid procedure code returns coverage info
- Auth failure: no x-member-id returns 401
- Not found: unknown procedure code returns 404
- Partial coverage: procedure with coinsurance shows member responsibility
- Prior auth required: response indicates PA needed
- Search: keyword returns matching procedures
File: tests/eligibility.test.ts
```

#### Step 9: Execute Lane C (Tests)

**Backend Tests:**
```
Write comprehensive tests for the eligibility API based on the acceptance scenarios in spec.md. Cover:
- Happy path: valid procedure code returns coverage info
- Auth failure: no x-member-id returns 401
- Not found: unknown procedure code returns 404
- Partial coverage: procedure with coinsurance shows member responsibility
- Prior auth required: response indicates PA needed
- Search: keyword returns matching procedures
File: tests/eligibility.test.ts
```

**Frontend Tests:**
```
Write tests for the EligibilityChecker component:
- Component renders form with search input
- Form submission calls API with correct payload
- Loading state displays while API responds
- Success: results display coverage status and cost estimate
- Error: error message displays on API failure
- Accessibility: ARIA labels present, keyboard navigation works
Use React Testing Library and mock the API service.
File: frontend/src/components/__tests__/EligibilityChecker.test.tsx
```

#### Step 10: Execute Lane D (Security + Governance)

Run the security reviewer and HIPAA compliance agents from Lab 3:

```
@workspace /security-reviewer Review src/routes/eligibility.ts and src/services/benefits-service.ts
```

```
@workspace /hipaa-compliance Review all files modified in this feature for HIPAA compliance (backend + frontend)
```

**Frontend Accessibility & Security:**

```
@workspace /frontend-reviewer Review frontend/src/components/EligibilityChecker.tsx for WCAG 2.1 AA accessibility compliance and security (no sensitive data in console logs, proper error handling).
```

Create governance record:

```
Create a governance decision record for the benefits eligibility checker. This feature uses a rules-based lookup (not AI/ML) so governance is simpler, but still requires: data classification of inputs/outputs, logging rules (both layers), member isolation confirmation, frontend accessibility compliance (WCAG 2.1 AA), and sign-off.
```

### Phase 4: Integrate (20 min)

#### Step 11: Merge Lanes

Follow merge order: **D → A → B → C** (schemas/docs first, backend implementation, frontend implementation, tests last).

After each merge:
```bash
cd starter-code && npm run typecheck && npm test
cd frontend && npm run type-check
```

Resolve any conflicts using the spec as source of truth.

### Phase 5: Quality Gate (20 min)

#### Step 12: Run Full Quality Checks

**Backend:**
```bash
cd starter-code
npm run lint
npm run typecheck
npm test
```

**Frontend:**
```bash
cd frontend
npm run lint
npm run type-check
```

**Combined PR:**
```bash
git add starter-code/
git commit -m "feat: benefits eligibility checker (capstone, full-stack)"
git push -u origin capstone-benefits-eligibility
gh pr create --title "feat: benefits eligibility checker (full-stack)" --body "Capstone delivery - backend API + React UI"
```

Wait for CodeQL scan (covers both backend and frontend). Review findings. Fix any critical/high issues.

#### Step 12: Run Quality Gate Review

```
Review this PR against the team quality gate policy (docs/quality-gate-policy.md). Report: pass/fail for each gate criterion, any findings that need attention, and overall merge readiness.
```

### Phase 6: Demo Prep (10 min)

#### Step 13: Build Evidence Bundle

Collect:
- [ ] `spec.md` — requirements and acceptance scenarios
- [ ] `plan.md` — architecture and file changes
- [ ] `tasks.md` — task completion status
- [ ] Agent review outputs (security, HIPAA, QA findings)
- [ ] Quality gate results (CodeQL, lint, tests)
- [ ] Governance decision record
- [ ] PR with passing checks

#### Step 14: Prepare 5-Minute Demo

Structure:
1. **Problem** (30s): What does the member need?
2. **Spec** (60s): How we defined it (show spec.md)
3. **Build** (90s): Live demo of the API working
4. **Quality** (60s): Show gate results — what was caught and fixed
5. **Governance** (30s): What controls are in place
6. **Lessons** (30s): What the team would do differently

## Exit Criteria

- [ ] Spec Kit artifacts exist: constitution, spec, plan, tasks
- [ ] Parallel lanes were defined with explicit contracts
- [ ] Implementation passes all tests and type checks
- [ ] CodeQL/GHAS shows 0 critical/high findings
- [ ] Role-based agents reviewed the code (security + HIPAA)
- [ ] Governance decision record is complete
- [ ] PR is open with passing quality gates
- [ ] 5-minute demo prepared with evidence (not just narrative)
- [ ] Team retrospective identifies at least 2 improvements for next sprint

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Specify (Steps 1–3) | 20 min | Don't skip clarify — ambiguity kills capstone |
| Plan + Decompose (Steps 4–6) | 20 min | Contracts before coding |
| Build (Steps 7–9) | 55 min | Parallel if possible, sequential if solo |
| Integrate (Step 10) | 20 min | C → A → B merge order |
| Quality Gate (Steps 11–12) | 20 min | Fix issues, don't defer them |
| Demo Prep (Steps 13–14) | 10 min | Evidence-based, not slide-based |

**Total:** ~145 min (2h 25min)

**The lesson:** This is how production features ship — spec-grounded, quality-gated, governance-approved, and evidence-demonstrated. The workflow is the deliverable, not just the code.
