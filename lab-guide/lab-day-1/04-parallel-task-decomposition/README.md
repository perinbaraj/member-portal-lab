# Lab 4: Parallel Task Decomposition — Appointment Scheduling

## Objective

Decompose a healthcare feature into independent parallel workstreams, execute them concurrently with Copilot, and safely merge results — demonstrating how Spec Kit tasks map to parallel lanes. Execute backend and frontend lanes in parallel.

**Use Case:** Build an appointment scheduling feature that lets members view upcoming appointments, book new ones with available providers, and cancel existing appointments. Implement the backend API and React UI in parallel lanes, then merge.

## Prerequisites

- Completion of Labs 1–3
- Spec Kit CLI installed
- Starter code running with existing routes functional
- Familiarity with Spec Kit `/speckit.tasks` output format

## The Backlog Item

> "As a member, I want to schedule, view, and cancel appointments with in-network providers so I can manage my healthcare visits without calling the office."

## Step-by-step Instructions

### Step 1: Spec and Plan (Fast Pass)

Run the Spec Kit workflow for this feature (apply what you learned in Labs 1–2):

```bash
specify init appointment-scheduling --integration copilot
```

```
/speckit.specify Build an appointment scheduling feature. Members can: view upcoming appointments, book an appointment with an in-network provider (selecting date/time from available slots), and cancel an appointment with at least 24h notice. Cancellation within 24h shows a warning but still allows it. Out of scope: recurring appointments, waitlist, provider-side management, insurance pre-verification.
```

```
/speckit.plan Use Express BFF with new routes under /api/appointments. Add a scheduling-service that wraps the downstream provider-availability API. Use Zod for input validation. Follow HIPAA rules from constitution.
```

```
/speckit.tasks
```

### Step 2: Identify Three Parallel Lanes

From the task list, assign tasks to independent lanes:

| Lane | Owner | Tasks | Files Owned |
|---|---|---|---|
| **Lane A: API Implementation** | Developer 1 | T-001 through T-005 | `src/routes/appointments.ts`, `src/services/scheduling-service.ts` |
| **Lane B: Tests** | Developer 2 | T-006 through T-009 | `tests/appointments.test.ts`, test fixtures |
| **Lane C: Validation + Docs** | Developer 3 | T-010 through T-012 | Zod schemas, API docs, error catalog |

### Step 3: Define Lane Contracts

Before lanes execute, agree on contracts:

```
Define the interface contract between Lane A (implementation) and Lane B (tests). Include:
- Route paths and HTTP methods
- Request/response shapes as TypeScript interfaces
- Error response format
- Status codes for each scenario
```

**Expected output:** A shared `types/appointments.ts` interface file that all lanes import.

### Step 4: Execute Lanes in Parallel

Each lane runs independently. If working solo, run sequentially with strict file isolation.

**Lane A prompt:**

```
/speckit.implement Implement only the appointment API routes (tasks T-001 through T-005). Create src/routes/appointments.ts and src/services/scheduling-service.ts. Do not create test files. Follow the type contracts in types/appointments.ts.
```

**Lane B prompt:**

```
Write tests for the appointment scheduling API based on the acceptance scenarios in spec.md. Test file: tests/appointments.test.ts. Use the type contracts in types/appointments.ts. Do not implement the routes — import them from src/routes/appointments.ts (they will be provided by Lane A).
```

**Lane C prompt:**

```
Create Zod validation schemas for all appointment API request bodies based on spec.md. File: src/schemas/appointments.ts. Also create an error catalog documenting all error codes and messages for the appointment feature. File: docs/appointment-errors.md.
```

### Step 5: Merge in Planned Order

Merge order matters. Follow this sequence:

1. **First:** Lane C (schemas + docs) — no dependencies
2. **Second:** Lane A (routes + services) — imports schemas from Lane C
3. **Third:** Lane B (tests) — imports routes from Lane A

After each merge:

```bash
npm run typecheck
npm test
```

### Step 6: Resolve Conflicts

If merge conflicts occur:
1. Document the conflict (which lanes, which files)
2. Identify root cause (shared file? missing contract?)
3. Fix using the spec as the source of truth
4. Record in retrospective notes

### Step 7: Validate Integrated State

```bash
npm test
npm run typecheck
npm run lint
```

All green = successful parallel execution.

### Step 8: Retrospective

Document:
- What parallelized well? (independent files, clear contracts)
- What caused friction? (shared types, missing contract details)
- What would you change for next time?

## Exit Criteria

- [ ] Spec, plan, and tasks exist for the appointment feature
- [ ] Three lanes were defined with explicit file ownership
- [ ] Interface contracts were agreed before lane execution
- [ ] Each lane produced working output independently
- [ ] Merge order was followed (C → A → B)
- [ ] All tests pass after integration
- [ ] No merge conflicts remain unresolved
- [ ] Retrospective notes identify at least one improvement

## Time Budget

| Phase | Time | Notes |
|---|---|---|
| Spec + Plan + Tasks | 10 min | Fast pass — reuse Lab 1/2 muscle memory |
| Define lanes + contracts | 10 min | Critical — skipping this causes merge pain |
| Execute 3 lanes | 25 min | ~8 min each if running sequentially |
| Merge + validate | 10 min | Follow the order, run checks after each |
| Retrospective | 5 min | Feed learnings into Day 2 capstone |

**The lesson:** Parallel execution is fast only when contracts are explicit. A 10-minute contract definition saves 30 minutes of merge debugging.
