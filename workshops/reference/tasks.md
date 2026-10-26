# Tasks: Claims Status Filter and Pagination

Example of an implementation-compatible task list, **not** completed work or
evidence of checks. Have `/speckit-tasks` generate the active list from the
human-reviewed active artifacts; use this example to check format and coverage.

[Workshop home](../README.md) · [Guided workflow](README.md) ·
[Specify checkpoint](../steps/03-specify.md) ·
[Plan and tasks checkpoint](../steps/04-plan-and-tasks.md) ·
[Binding behavior contract](../acceptance.md)

## Prerequisites and format

The active feature must already contain `spec.md`, a resolved
`checklists\requirements.md`, `plan.md`, `research.md`, `data-model.md`,
`contracts\`, and `quickstart.md`. Do not run implementation from this reference
directory or copy it as an active workspace. Adapt file paths and decisions to
the active checkout without changing the behavior contract.

Every executable task below uses `- [ ] Tnnn`, with a story label where relevant
and concrete paths. IDs are unique. Tasks run in the order shown, with the
explicit dependencies below; none are marked `[P]` because these changes share
files and depend on each other. The project already exists: no install,
infrastructure, new framework, fixture generation, or broad setup phase is needed.

## Phase 1: Test-first contract and privacy gates

These tests gate **all** user stories, including US3; privacy is not deferred
until the last UI phase. Use existing synthetic fixtures and size-1 pages.

- [ ] T001 Add missing-auth and two-member claims-list isolation tests in tests\server.test.ts; assert both claims and pagination totals with the same filter/page, unset DEV_MEMBER_ID for missing-auth evidence, and restore test-managed environment state.
- [ ] T002 Add default metadata, all five supported statuses, omitted-status, and empty-match API cases in tests\server.test.ts using existing fixtures without new server\data.ts exports.
- [ ] T003 Add pageSize=1 first/later/out-of-range page cases, stable order, filtered totals, and size-100 acceptance in tests\server.test.ts.
- [ ] T004 Add generic-400 API cases for unknown/empty/repeated status, empty/repeated paging, malformed/noninteger/zero/negative paging, and pageSize=101 in tests\server.test.ts.
- [ ] T005 Run npm test -- server.test.ts for T001–T004 in tests\server.test.ts, with development processes stopped because server\server.ts starts a listener; confirm new-contract failures and record actual failure evidence in the active feature's quickstart.md before implementation.

**Gate:** T001–T005 precede production changes. Preserve existing passing
behavior; a missing dependency, port conflict, or syntax error is not the
expected failing evidence for the new contract.

## Phase 2: Coordinated API and typed-client contract (US1 foundation)

- [ ] T006 [US1] Implement claims-list Zod query validation and generic 400s in server\server.ts, then member-scope/filter/count/page in stable order; retain claims and add exact pagination metadata, preserving empty/out-of-range behavior and existing auth without touching claim detail.
- [ ] T007 [US1] Add typed claims query, pagination, and page-response shapes in src\types.ts using the existing Claim status union.
- [ ] T008 [US1] Update getClaims in src\services\httpClient.ts to encode optional status/page/pageSize, omit status for All statuses, preserve the member header, and return the full typed claims-page response.
- [ ] T009 [US1] Update src\components\ClaimsList.tsx for the page response and labeled status selection; default to All statuses, reset page on filter changes, and keep filter controls available for empty/error states.
- [ ] T010 [US1] Run npm test -- server.test.ts after T006–T009 and resolve change-caused API failures in server\server.ts or tests\server.test.ts; record actual results in the active feature's quickstart.md.

**Gate:** The server contract, types, client, and consumer change together.
Do not hand off an array-returning client to a page-response consumer or vice
versa. All foundational auth/validation/isolation tests must now pass.

## Phase 3: Navigate the matching claims (US2)

- [ ] T011 [US2] Add page state, current page/totals, and Previous/Next controls in src\components\ClaimsList.tsx; send the selected page, disable boundary/empty navigation, and keep the page-one reset consistent with status changes.
- [ ] T012 [US2] Parse optional pageSize from the browser address in src\components\ClaimsList.tsx: use a whole number from 1 to 100, otherwise default 20; send the chosen size so existing M-10001 fixtures demonstrate two pages at pageSize=1 without data changes.

**Gate:** T011–T012 depend on T006–T010. API paging tests were added before
implementation in T003. Browser acceptance is a later human activity.

## Phase 4: Fail safely without stale UI (US3)

- [ ] T013 [US3] Guard the request lifecycle in src\components\ClaimsList.tsx by cancelling or ignoring obsolete success/error/completion callbacks; prevent stale data or loading state after rapid status/page changes or unmount.
- [ ] T014 [US3] Complete loading, empty, and generic announced-error states in src\components\ClaimsList.tsx; keep controls mounted and usable without unnecessary loading-time keyboard-focus loss.
- [ ] T015 [US3] Apply only necessary claims-scoped accessible control/error styles in src\App.css, maintaining AA contrast without changing shared error styling for Profile or Prescriptions.

**Gate:** T013–T015 depend on T009 and T011–T012. No UI phase may weaken the
already-tested member isolation or validation.

## Phase 5: Automated verification and evidence

- [ ] T016 Run npm test, npm run typecheck, and npm run build after T001–T015; record exact outcomes and change-caused repairs in the active feature's quickstart.md, noting backend-only typecheck and no full TSX typecheck from Vite build.

**Dependencies:** T002 follows T001; T003 follows T002; T004 follows T003; T005
follows T004. T006 follows T005; T007 follows T006; T008 follows T007; T009
follows T008; T010 follows T009. T011 follows T010; T012 follows T011; T013
follows T012; T014 follows T013; T015 follows T014; T016 follows T015.
These are deliberately serial phases, not permission to run shared-file edits
in parallel. If a check exposes a change-caused failure, repair the relevant
task's files and rerun the affected check before recording success.

## Human work after implementation — not executable checkbox tasks

The participant performs [checkpoint 6](../steps/06-review-and-accept.md):
customizes the read/search-only reviewer, evaluates findings and scope, operates
the browser and keyboard using [acceptance](../acceptance.md), and records
actual results, known limitations, and the final acceptance decision.

Do not convert any of those decisions or manual checks into `Tnnn` checkbox
tasks. If review identifies an accepted in-scope code defect, add a separate
concrete test/fix task and rerun affected checks; the human decision itself
remains outside agent execution. A completed checkbox list is not acceptance.
