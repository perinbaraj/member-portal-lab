# Tasks: Prior Authorization Requests

**Input**: Design documents from /specs/002-prior-auth-requests/

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include test tasks whenever the feature changes backend behavior, member journeys, accessibility behavior, privacy controls, or security-critical logic.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create baseline feature files and shared typing scaffolds required by all stories.

- [X] T001 Create prior-auth route, service, and validation module stubs in server/routes/priorAuth.ts, server/services/priorAuthService.ts, and server/validation/priorAuth.ts
- [X] T002 [P] Create frontend prior-auth component and test stubs in src/components/PriorAuthForm.tsx and src/components/PriorAuthForm.test.tsx
- [X] T003 [P] Add prior-auth type scaffolds in server/types.ts and src/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement core infrastructure that MUST be complete before any user story work.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Implement in-memory prior-auth request and audit-event stores with helper accessors in server/data.ts
- [X] T005 [P] Define denial reason enum, request status union, and audit event interfaces in server/types.ts and src/types.ts
- [X] T006 [P] Implement Zod schemas for create payload, requestId params, status, and denial reason code in server/validation/priorAuth.ts
- [X] T007 Wire prior-auth router mounting and shared auth-context enforcement entrypoint in server/server.ts
- [X] T008 [P] Extend typed API client methods for list, detail, and create operations in src/services/httpClient.ts
- [X] T009 Add shared generic-error mapping and hashed security event logging helper for prior-auth route failures in server/routes/priorAuth.ts
- [X] T010 [P] Add foundational backend coverage for auth failure and member isolation guardrails in tests/server.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - View My Prior Authorization Requests (Priority: P1) MVP

**Goal**: Members can view only their own prior-auth requests with current status, 30-second auto-refresh, and manual refresh.

**Independent Test**: With only this story implemented, an authenticated member can open prior-auth view, see only their records, and observe status updates through polling/manual refresh.

### Tests for User Story 1

- [X] T011 [P] [US1] Add backend tests for GET /api/prior-auth success, empty state, and member-scope filtering in tests/server.test.ts
- [X] T012 [P] [US1] Add backend tests for GET /api/prior-auth/:requestId not-found and cross-member forbidden behavior in tests/server.test.ts
- [X] T013 [P] [US1] Add frontend tests for list rendering, empty state, and status badge semantics in src/components/PriorAuthForm.test.tsx
- [X] T014 [P] [US1] Add frontend tests for 30-second polling and manual refresh behavior in src/components/PriorAuthForm.test.tsx

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement list and detail query methods with member ownership checks in server/services/priorAuthService.ts
- [X] T016 [US1] Implement GET /api/prior-auth and GET /api/prior-auth/:requestId endpoints in server/routes/priorAuth.ts
- [X] T017 [P] [US1] Implement prior-auth list UI, status badges, and empty state rendering in src/components/PriorAuthForm.tsx
- [X] T018 [US1] Implement 30-second auto-refresh lifecycle and manual refresh control in src/components/PriorAuthForm.tsx
- [X] T019 [US1] Integrate prior-auth view into application shell navigation/render path in src/App.tsx
- [X] T020 [US1] Add prior-auth view styles for readable status presentation and accessible focus states in src/App.css

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Submit A New Prior Authorization Request (Priority: P1)

**Goal**: Members can submit valid prior-auth requests with required fields and receive accessible validation feedback.

**Independent Test**: With this story implemented, a member can submit a valid request that appears as pending, while invalid payloads are rejected with clear feedback.

### Tests for User Story 2

- [X] T021 [P] [US2] Add backend tests for POST /api/prior-auth success and pending default status in tests/server.test.ts
- [X] T022 [P] [US2] Add backend tests for missing required fields and clinicalJustification length > 500 rejection in tests/server.test.ts
- [X] T023 [P] [US2] Add frontend tests for required-field validation messaging and submit success flow in src/components/PriorAuthForm.test.tsx
- [X] T024 [P] [US2] Add frontend test for list refresh after successful submission in src/components/PriorAuthForm.test.tsx

### Implementation for User Story 2

- [X] T025 [P] [US2] Implement create request command path, pending initialization, and creation audit event emission in server/services/priorAuthService.ts
- [X] T026 [US2] Implement POST /api/prior-auth endpoint with Zod validation and safe error mapping in server/routes/priorAuth.ts
- [X] T027 [P] [US2] Implement submission form fields and accessible validation state handling in src/components/PriorAuthForm.tsx
- [X] T028 [US2] Implement submit action wiring to typed client create method in src/services/httpClient.ts and src/components/PriorAuthForm.tsx
- [X] T029 [US2] Implement post-submit state refresh and pending status confirmation message in src/components/PriorAuthForm.tsx

**Checkpoint**: User Stories 1 and 2 work independently and together.

---

## Phase 5: User Story 3 - Understand Denials And Next Steps (Priority: P2)

**Goal**: Members can view denial reason details, appeal instructions, and status transitions backed by auditable events and fixed denial code enum.

**Independent Test**: With this story implemented, denied requests always show allowed machine-readable denial codes plus member-readable reason and appeal guidance.

### Tests for User Story 3

- [X] T030 [P] [US3] Add backend tests validating denied response includes allowed denial reason enum and appeal instructions in tests/server.test.ts
- [X] T031 [P] [US3] Add backend tests validating immutable audit event creation for every status transition in tests/server.test.ts
- [X] T032 [P] [US3] Add frontend tests for denied status detail rendering and assistive announcement behavior in src/components/PriorAuthForm.test.tsx

### Implementation for User Story 3

- [X] T033 [P] [US3] Implement denial decision enrichment and fixed enum enforcement in server/services/priorAuthService.ts
- [X] T034 [US3] Implement denial detail response shaping for list/detail endpoints in server/routes/priorAuth.ts
- [X] T035 [P] [US3] Implement denied-state UI section for reason and appeal instructions in src/components/PriorAuthForm.tsx
- [X] T036 [US3] Implement immutable transition audit append helpers and status transition usage in server/data.ts and server/services/priorAuthService.ts

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story hardening, validation, and release-readiness checks.

- [X] T037 [P] Add contract and quickstart consistency updates for implemented behavior in specs/002-prior-auth-requests/contracts/prior-auth.yaml and specs/002-prior-auth-requests/quickstart.md
- [X] T038 Run full backend and frontend validation suite and resolve regressions in tests/server.test.ts and src/components/PriorAuthForm.test.tsx
- [X] T039 [P] Perform accessibility regression sweep for prior-auth interactions and update styles as needed in src/App.css and src/components/PriorAuthForm.tsx
- [X] T040 Verify performance and freshness targets for prior-auth list/detail refresh workflows in specs/002-prior-auth-requests/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies - can start immediately.
- Foundational (Phase 2): Depends on Setup completion - blocks all user stories.
- User Stories (Phases 3-5): Depend on Foundational completion.
- Polish (Phase 6): Depends on all required user stories.

### User Story Dependencies

- User Story 1 (P1): Starts after Foundational; no dependency on other stories.
- User Story 2 (P1): Starts after Foundational; integrates with US1 list refresh but remains independently testable via create API + component flow.
- User Story 3 (P2): Starts after Foundational and depends on status/decision fields exposed by US1 and US2 paths.

### Within Each User Story

- Tests are authored and run before implementation tasks.
- Backend model/service logic precedes route/controller wiring.
- Frontend rendering precedes integration and polish steps.
- Story-level checkpoint validation is required before moving forward.

## Parallel Opportunities

- Setup tasks marked [P] can run in parallel.
- Foundational tasks T005, T006, T008, and T010 can run in parallel after T004.
- In US1, backend tests and frontend tests (T011-T014) can run in parallel.
- In US2, backend and frontend test tasks (T021-T024) can run in parallel.
- In US3, backend and frontend test tasks (T030-T032) can run in parallel.
- Polish tasks T037 and T039 can run in parallel.

## Parallel Example: User Story 1

- Run T011 and T013 together to validate backend list behavior and frontend list rendering.
- Run T012 and T014 together to validate secure detail access and refresh mechanics.
- Run T015 and T017 together after tests to build backend query logic and frontend list UI in parallel.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently against list, member isolation, and refresh behavior.
4. Demo or release MVP slice.

### Incremental Delivery

1. Deliver US1 for read visibility and freshness.
2. Deliver US2 for request submission.
3. Deliver US3 for denial transparency and auditability hardening.
4. Finish with Phase 6 cross-cutting checks.

### Parallel Team Strategy

1. Team completes Setup and Foundational phases together.
2. Developer A drives US1, Developer B drives US2, Developer C drives US3 once prerequisites are ready.
3. Converge in Polish for end-to-end validation and non-functional quality gates.
