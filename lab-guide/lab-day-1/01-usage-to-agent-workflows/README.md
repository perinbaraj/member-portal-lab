# Lab 1: Spec Kit + GitHub Copilot — Prescription Refill

## Objective

Use GitHub Spec Kit with GitHub Copilot to convert a healthcare backlog item into a shippable PR through the **Constitution → Specify → Plan → Tasks → Implement** workflow, delivering **both a backend API and a React frontend UI component**.

**Use Case:** Build a prescription refill feature in the member portal so members can view active prescriptions and request refills without calling the pharmacy. The feature includes a backend API endpoint and a React component in the frontend portal.

## Prerequisites

- VS Code with the GitHub Copilot extension (Chat + Agent mode)
- `uv` installed ([docs.astral.sh/uv](https://docs.astral.sh/uv/))
- GitHub account with Copilot access
- `git` configured
- Starter code running locally (`npm install && npm run dev` from repo root — starts both API + UI)

Install the Specify CLI:

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
specify --version
```

Reference: [github.com/github/spec-kit](https://github.com/github/spec-kit)

## The Backlog Item

> "As a member, I want to request a refill on one of my active prescriptions from the portal so I don't have to call the pharmacy."

## Step-by-step Instructions

### Step 1: Initialize the Project with Copilot Integration

```bash
specify init prescription-refill --integration copilot
cd prescription-refill
code .
```

Spec Kit scaffolds:
- `.specify/` — configuration and per-feature artifact folders
- `.github/prompts/` — Copilot Chat slash-command prompt files for `/speckit.*`
- `templates/` — canonical spec, plan, and tasks templates

Open GitHub Copilot Chat. The `/speckit.*` slash commands are now available.

### Step 2: Establish Project Principles (Constitution)

In Copilot Chat:

```
/speckit.constitution Create principles for a full-stack healthcare member-portal feature. Stack: React 18 + TypeScript frontend and Node.js + Express BFF backend. Focus on HIPAA compliance (no PHI in logs), WCAG 2.1 AA accessibility, performance (p95 < 500 ms for API, FCP < 1.5s frontend), and security (x-member-id header auth). Both frontend and backend are in scope.
```

**Expected output:** `memory/constitution.md` containing:
- HIPAA compliance rules for both layers (no PHI in logs, traces, or error messages)
- Accessibility standards (WCAG 2.1 AA) for React components
- Performance budget (p95 API < 500ms, frontend FCP < 1.5s, bundle < 200KB gzipped)
- Stack constraints (React 18 + TypeScript frontend, Node.js + Express BFF, member-context isolation via x-member-id header)
- Full-stack ownership: frontend and backend are both your responsibility

### Step 3: Create the Spec

In Copilot Chat:

```
/speckit.specify Build a full-stack feature in the member portal. Backend: authenticated members can call GET /api/prescriptions to list active prescriptions, and POST /api/prescriptions/:id/refill to request a refill. Frontend: React component shows the prescription list and a refill button for each. Members should see confirmation. Members should be able to cancel pending refills before processing. Out of scope: changing prescription details, transferring prescriptions, mobile app, prescription editing.
```

**Expected output:** `.specify/specs/001-prescription-refill/spec.md` containing:
- User stories (P1, P2, P3) with Given/When/Then acceptance scenarios
- Edge cases (pharmacy-service down, double-click, zero refills, session expiry, network error on frontend)
- Functional requirements for both backend (FR-001 through FR-008) and frontend (FR-UI-001 through FR-UI-004)
- Key entities: `Prescription`, `RefillRequest`, `Member`
- **Frontend Requirements:**
  - PrescriptionsList component that calls GET /api/prescriptions
  - RefillButton component with loading and success states
  - Error display for failed API calls
  - Responsive design (mobile + desktop)
- Success criteria with measurable outcomes

### Step 4: Clarify Ambiguities

```
/speckit.clarify
```

Copilot asks targeted questions about anything marked `[NEEDS CLARIFICATION]`. Answer them and confirm the spec updates. Run this before planning.

### Step 5: Generate the Technical Plan

In Copilot Chat:

```
/speckit.plan Full-stack: React 18 + TypeScript for the UI (in src/). Node.js + Express for the BFF (in server/). Read prescription data from internal pharmacy-service REST API (OAuth 2.0). Submit refill requests via POST to pharmacy-service /refills. Use Redis for short-term refill-request idempotency. Frontend calls BFF with x-member-id header. Follow the constitution for both layers.
```

**Expected output:** `.specify/specs/001-prescription-refill/plan.md` with:
- Architecture diagram (BFF routes + React components)
- **Backend Plan:**
  - BFF route definitions with request/response shapes (GET /api/prescriptions, POST /api/prescriptions/:id/refill)
  - HIPAA compliance checks (member-context isolation)
  - Redis idempotency logic
- **Frontend Plan:**
  - React component breakdown: PrescriptionsList, RefillButton, LoadingState, ErrorDisplay
  - API service calls (typescript-typed fetch wrappers to BFF)
  - State management (useState for list, loading, error)
  - CSS styling (responsive, WCAG AA contrast)
- Risk register with constitutional violation flags for both layers

### Step 6: Break Down into Tasks

```
/speckit.tasks
```

**Expected output:** `.specify/specs/001-prescription-refill/tasks.md` — tasks grouped by user story, including both backend and frontend:

```markdown
## User Story 1 (P1): View active prescriptions
### Backend
- [ ] T-001: Create GET /api/prescriptions BFF route with x-member-id check
- [ ] T-002: Implement prescription service with member-context isolation
- [ ] T-003: Unit tests for happy path, 401, and empty state

### Frontend
- [ ] T-004: Create PrescriptionsList React component
- [ ] T-005: Implement API service call (src/services/httpClient.ts) for GET /api/prescriptions
- [ ] T-006: Add loading and error states to component
- [ ] T-007: Add WCAG 2.1 AA accessibility labels to list items
- [ ] T-008: Test component with mock API responses

## User Story 2 (P1): Request a refill
### Backend
- [ ] T-009: Create POST /api/prescriptions/{id}/refill BFF route
- [ ] T-010: Add Redis idempotency key per (memberId, prescriptionId, day)
- [ ] T-011: Integration test against mocked pharmacy-service

### Frontend
- [ ] T-012: Create RefillButton React component with disabled state
- [ ] T-013: Add success/error message display
- [ ] T-014: Handle double-click and network errors gracefully
- [ ] T-015: Test component interaction flow
```

### Step 7: Cross-Artifact Consistency Check

```
/speckit.analyze
```

Fix any gaps, contradictions, or coverage holes before implementing.

### Step 8: Implement the P1 Slice Only

```
/speckit.implement
```

Scope to **User Story 1 (P1) only** — viewing active prescriptions on both backend and frontend. This is your first shippable slice.

**Backend Implementation:**
- Add the POST /api/prescriptions/:id/refill route to `server/server.ts` (or create `server/routes/prescriptions.ts`)
- Implement prescription service with mock data
- Add tests

**Frontend Implementation:**
- Create `src/components/PrescriptionsList.tsx` React component
- Update `src/services/httpClient.ts` with getPrescriptions() method
- Add loading and error states
- Style with accessibility in mind

If Copilot drifts, re-anchor:

> "Re-read `spec.md` Section 'User Story 1', `plan.md` backend and frontend sections, and `tasks.md` P1 tasks. Implement both layers. Do not introduce anything outside the spec."

### Step 9: Validate

```bash
npm test
npm run typecheck
```

All checks must pass for the P1 slice.

### Step 10: Open the PR

Create separate PRs or one full-stack PR:

**Option 1 (Recommended):** One full-stack PR
```bash
git checkout -b 001-prescription-refill
git add .
git commit -m "feat: view active prescriptions (US1 P1 slice, full-stack)"
git push -u origin 001-prescription-refill
```

**Option 2:** Separate PRs
```bash
# Backend PR
git checkout -b 001-prescription-refill-backend
git add server/
git commit -m "feat(backend): view active prescriptions endpoint"
git push -u origin 001-prescription-refill-backend

# Frontend PR
git checkout -b 001-prescription-refill-frontend
git add src/
git commit -m "feat(frontend): prescription list component"
git push -u origin 001-prescription-refill-frontend
```

In Copilot Chat:

```
Draft a full-stack PR description. Include: 1) which user story this slice ships, 2) which acceptance scenarios are covered by both backend and frontend, 3) links to test results from both layers, 4) which user stories are deferred to P2/P3.
```

## Exit Criteria

- [ ] `memory/constitution.md`, `spec.md`, `plan.md`, and `tasks.md` exist under `.specify/`
- [ ] Spec contains at least 3 user stories (P1, P2, P3) with Given/When/Then scenarios, including frontend acceptance criteria
- [ ] Plan includes both backend (BFF route definitions) and frontend (React component breakdown)
- [ ] All P1 tasks for both backend and frontend are checked off
- [ ] Backend: GET /api/prescriptions route implemented and tested
- [ ] Frontend: PrescriptionsList component renders and calls the API
- [ ] A PR is open with code and tests for both layers
- [ ] PR description lists covered acceptance scenarios and explicitly calls out which layer ships which feature
- [ ] `npm test` and `npm run typecheck` pass from the repo root

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Constitution | 5 min | Skip it and stack drift will appear later |
| Specify + Clarify | 15 min | Run `/speckit.clarify` before `/speckit.plan` |
| Plan + Tasks | 10 min | Fix `/speckit.analyze` issues before implementing |
| Implement (P1 only) | 30–40 min | Hold the line — P2 and P3 break the discipline |
| Validate + Open PR | 5 min | Have Copilot draft the PR description from the spec |

**The lesson:** discipline over volume. A clean P1 slice grounded in a spec beats a half-built P1+P2+P3.

## Links

- [Spec Kit repo](https://github.com/github/spec-kit)
- [Spec Kit docs](https://github.github.io/spec-kit/)
- [Spec template](https://github.com/github/spec-kit/blob/main/templates/spec-template.md)
