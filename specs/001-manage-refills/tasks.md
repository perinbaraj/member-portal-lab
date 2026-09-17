# Tasks: Manage Prescription Refills

**Input**: Design documents from `/specs/001-manage-refills/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include backend API tests, frontend interaction tests, and focused validation for accessibility, security, and idempotent refill behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `server/`, `src/`, `tests/` at repository root
- Paths below follow the current member portal structure from `plan.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the repository for full-stack implementation and validation of the refill feature

- [X] T001 Update feature documentation references in specs/001-manage-refills/plan.md, specs/001-manage-refills/research.md, specs/001-manage-refills/data-model.md, specs/001-manage-refills/contracts/prescriptions.yaml, and specs/001-manage-refills/quickstart.md if implementation details change during execution
- [X] T002 Add frontend interaction test dependencies and scripts in package.json for React component validation
- [X] T003 [P] Create backend route, service, and validation folders with indexable module boundaries in server/routes/prescriptions.ts, server/services/pharmacyService.ts, server/services/oauthTokenService.ts, server/services/refillIdempotencyService.ts, and server/validation/prescriptions.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Extend shared prescription and refill workflow types in server/types.ts and src/types.ts to support `prescriptionStatus`, `refillStatus`, safe reason codes, and mutation responses
- [X] T005 [P] Refactor mock prescription and refill workflow data access in server/data.ts to support eligible, pending, processing, and ineligible states plus member-scoped refill lookup helpers
- [X] T006 [P] Implement Zod request validation and typed response helpers for prescription list, refill submit, and refill cancel flows in server/validation/prescriptions.ts
- [X] T007 Implement OAuth token acquisition/cache and pharmacy-service HTTP abstraction in server/services/oauthTokenService.ts and server/services/pharmacyService.ts
- [X] T008 Implement Redis-backed submit/cancel idempotency helpers in server/services/refillIdempotencyService.ts
- [X] T009 Wire PHI-safe prescription routing, generic error mapping, and member-isolation enforcement into server/routes/prescriptions.ts and server/server.ts
- [X] T010 [P] Add foundational API coverage for auth failures, member isolation, and generic error behavior in tests/server.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Active Prescriptions (Priority: P1) 🎯 MVP

**Goal**: Members can view only their active prescriptions with refill workflow status and accessible empty/error states

**Independent Test**: With only this story implemented, an authenticated member can load the prescriptions screen, see member-scoped active prescriptions with correct refill status, and receive accessible empty/error feedback without any refill mutations enabled.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US1] Add backend tests for GET /api/prescriptions happy path, empty state, and unauthorized access in tests/server.test.ts
- [X] T012 [P] [US1] Add frontend interaction tests for list rendering, empty state, and error announcement in src/components/PrescriptionsList.test.tsx
- [X] T013 [P] [US1] Add a focused type-check and route smoke validation step for the read-only prescriptions flow in specs/001-manage-refills/quickstart.md

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement member-scoped active prescription list mapping in server/services/pharmacyService.ts and server/data.ts
- [X] T015 [US1] Implement GET /api/prescriptions in server/routes/prescriptions.ts and mount it from server/server.ts
- [X] T016 [P] [US1] Extend typed fetch support for prescription list responses in src/services/httpClient.ts
- [X] T017 [US1] Rework the prescriptions list UI and accessible empty/error/loading states in src/components/PrescriptionsList.tsx
- [X] T018 [US1] Update consuming app wiring for the prescriptions view in src/App.tsx and src/App.css
- [X] T019 [US1] Validate member isolation, generic errors, and accessible list behavior for the MVP flow in tests/server.test.ts and src/components/PrescriptionsList.test.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Request A Refill (Priority: P2)

**Goal**: Members can submit a refill request for an eligible prescription and receive confirmation without creating duplicates

**Independent Test**: With this story added to US1, an authenticated member can request a refill for an eligible prescription, see the item move to `pending`, and receive confirmation while duplicate submissions are safely collapsed.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Add backend tests for POST /api/prescriptions/:prescriptionId/refill success, duplicate submit, ineligible submit, and cross-member rejection in tests/server.test.ts
- [X] T021 [P] [US2] Add frontend interaction tests for refill button behavior, pending confirmation, and duplicate/ineligible messages in src/components/PrescriptionsList.test.tsx
- [X] T022 [P] [US2] Add validation coverage for submit idempotency and safe response codes in server/services/refillIdempotencyService.ts and specs/001-manage-refills/quickstart.md

### Implementation for User Story 2

- [X] T023 [P] [US2] Implement refill submission workflow and pharmacy-service POST mapping in server/services/pharmacyService.ts
- [X] T024 [US2] Implement POST /api/prescriptions/:prescriptionId/refill with idempotency, validation, and safe error mapping in server/routes/prescriptions.ts
- [X] T025 [P] [US2] Extend refill mutation request/response handling in src/services/httpClient.ts and src/types.ts
- [X] T026 [US2] Add refill request action, confirmation messaging, and pending-state refresh logic in src/components/PrescriptionsList.tsx
- [X] T027 [US2] Update mock refill workflow transitions and duplicate-request behavior in server/data.ts and server/types.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Cancel A Pending Refill (Priority: P3)

**Goal**: Members can cancel a pending refill before processing starts and see late cancellations rejected safely

**Independent Test**: With this story added to US1 and US2, an authenticated member can cancel a pending refill, watch the prescription return to an actionable or ineligible state, and receive a safe conflict response if processing has already started.

### Tests for User Story 3 ⚠️

- [X] T028 [P] [US3] Add backend tests for DELETE /api/prescriptions/:prescriptionId/refill success, no-pending state, and processing-conflict behavior in tests/server.test.ts
- [X] T029 [P] [US3] Add frontend interaction tests for cancel affordance, cancellation confirmation, and late-cancel conflict messaging in src/components/PrescriptionsList.test.tsx
- [X] T030 [P] [US3] Add quickstart validation steps for late cancellation and safe conflict handling in specs/001-manage-refills/quickstart.md

### Implementation for User Story 3

- [X] T031 [P] [US3] Implement cancel workflow and downstream refill cancellation mapping in server/services/pharmacyService.ts
- [X] T032 [US3] Implement DELETE /api/prescriptions/:prescriptionId/refill with pending-state enforcement and conflict handling in server/routes/prescriptions.ts
- [X] T033 [P] [US3] Extend cancel mutation support and status refresh handling in src/services/httpClient.ts and src/types.ts
- [X] T034 [US3] Add pending cancel controls, processing lockout messaging, and UI state reconciliation in src/components/PrescriptionsList.tsx
- [X] T035 [US3] Update mock refill lifecycle transitions for cancellation and processing races in server/data.ts and server/types.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T036 [P] Update developer-facing implementation notes and verification guidance in README.md and specs/001-manage-refills/quickstart.md
- [X] T037 Run code cleanup and refactoring across server/routes/prescriptions.ts, server/services/pharmacyService.ts, server/services/oauthTokenService.ts, server/services/refillIdempotencyService.ts, and src/components/PrescriptionsList.tsx
- [X] T038 [P] Tighten accessibility, security, and PHI-safe error/message coverage in src/components/PrescriptionsList.tsx, src/App.css, and tests/server.test.ts
- [X] T039 [P] Execute full validation for the feature with npm test and npm run typecheck and record any follow-up fixes in specs/001-manage-refills/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2 and delivers the MVP read-only prescription experience
- **User Story 2 (P2)**: Starts after Phase 2 but depends functionally on US1 UI and shared refill workflow types
- **User Story 3 (P3)**: Starts after Phase 2 and depends functionally on US2 refill workflow state existing

### Within Each User Story

- Tests and validation tasks should be written before implementation tasks for that story
- Backend service/data updates precede route handlers
- API client updates precede UI action wiring
- Each story finishes with focused validation on the touched flows before moving on

### Parallel Opportunities

- T003 can run in parallel with T002 after the task list is accepted
- T005, T006, and T010 can run in parallel during Foundational work after shared type decisions in T004
- T011, T012, and T013 can run in parallel for US1
- T014 and T016 can run in parallel for US1 once the GET contract is stable
- T020, T021, and T022 can run in parallel for US2
- T023 and T025 can run in parallel for US2 before UI wiring in T026
- T028, T029, and T030 can run in parallel for US3
- T031 and T033 can run in parallel for US3 before UI wiring in T034
- T036, T038, and T039 can run in parallel in the final polish phase

---

## Parallel Example: User Story 2

```bash
# Launch User Story 2 validation tasks together:
Task: "Add backend tests for POST /api/prescriptions/:prescriptionId/refill in tests/server.test.ts"
Task: "Add frontend interaction tests for refill request behavior in src/components/PrescriptionsList.test.tsx"
Task: "Add submit idempotency validation notes in specs/001-manage-refills/quickstart.md"

# Launch User Story 2 backend/client work together once shared types are in place:
Task: "Implement refill submission workflow in server/services/pharmacyService.ts"
Task: "Extend refill mutation handling in src/services/httpClient.ts and src/types.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run the US1 backend and frontend tests plus type-check
5. Demo the read-only prescriptions experience before enabling mutations

### Incremental Delivery

1. Finish Setup + Foundational work to establish shared contracts, types, validation, and idempotency services
2. Deliver User Story 1 as the MVP read-only prescription experience
3. Add User Story 2 for refill submission and duplicate protection
4. Add User Story 3 for cancellation and late-cancel conflict handling
5. Finish with cross-cutting cleanup, accessibility tightening, and full validation

### Parallel Team Strategy

1. One developer owns backend foundational services and route scaffolding while another adds frontend test infrastructure and list rendering support
2. After Phase 2, one developer can focus on backend refill/cancel mutations while another owns `src/components/PrescriptionsList.tsx` and client-side interaction tests
3. Final polish combines accessibility/security hardening and full regression validation

---

## Notes

- [P] tasks target separate files or independent validation work
- Every story includes executable validation because the feature changes backend behavior and member-facing UI flows
- Keep PHI out of logs, fixtures, and generic errors while implementing and testing
- Preserve member-context isolation on every route and mock data helper
- Use `DELETE /api/prescriptions/:prescriptionId/refill` for cancellation to match the planned contract