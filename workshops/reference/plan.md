# Implementation Plan: Claims Status Filter and Pagination

Starting approach for guided adaptation, not an active plan or completed feature.
Use `/speckit-plan` after the active specification and requirements checklist exist
and a human has reviewed them. Keep generated active metadata and paths.

[Workshop home](../README.md) · [Guided workflow](README.md) ·
[Specify checkpoint](../steps/03-specify.md) ·
[Plan and tasks checkpoint](../steps/04-plan-and-tasks.md) ·
[Binding behavior contract](../acceptance.md)

## Summary and technical context

Extend the existing claims list only. Reuse Node/Express, TypeScript, Zod,
`getClaimsForMember`, React hooks, the centralized typed HTTP client, and the
existing Vitest/Supertest runner. The data is already synthetic and in memory.
No new package, service layer, route-wide refactor, Redis service, database,
external API, deployment, or mutation is needed.

The current list route returns `{ claims }`, the HTTP client unwraps it to
`Claim[]`, and `ClaimsList` consumes that array. Update the API, client types,
and consumer as one coherent change; do not leave the UI expecting the old
client return type. Reuse `Claim['status']` rather than inventing statuses.

## Constitution check

Confirm the active constitution enforces existing repository instructions:

| Guardrail | Planned application |
| --- | --- |
| Member isolation | Authenticated context only; scope before filter, count, and slice |
| Input safety | Route-level Zod validation; generic errors; no malformed-value coercion |
| Privacy | No PHI, member details, or request/response-body logging |
| Accessible, resilient UI | Labels, keyboard operation, visible state, generic announced errors, stale-response protection |
| Bounded brownfield work | Preserve unrelated routes and screens; use existing packages and fixtures |
| Evidence and permissions | Test-first work, actual checks, normal approvals, read/search-only reviewer, human acceptance |

These are gates for all stories, not optional work postponed until User Story 3.
Do not weaken the constitution or change permissions to make a gate pass.

## Active artifacts required before tasks

Have `/speckit-plan` create the following in the **active feature directory**;
adapting this reference file alone is insufficient.

| Artifact | Required bounded content |
| --- | --- |
| `plan.md` | This approach reconciled with the active spec, constitution, and actual code |
| `research.md` | Existing-code findings and decisions on query validation, API/client compatibility, page-size parsing, and obsolete-request handling |
| `data-model.md` | Existing Claim shape and query/pagination response types; no new storage |
| `contracts\` | Local `GET /api/claims` request/response, validation, auth, and empty/out-of-range semantics |
| `quickstart.md` | Commands, synthetic-member/page-size examples, actual evidence location, and later human acceptance handoff |

Resolve unknowns and template placeholders before `/speckit-tasks`. Supporting
artifacts must agree with the active spec and [acceptance](../acceptance.md);
they must not claim tests or browser checks have already passed.

## API contract and processing order

Validate optional `status`, `page`, and `pageSize` without accepting arrays,
objects, repeated values, empty strings, or malformed numbers. The five statuses
are `submitted`, `in_review`, `approved`, `denied`, and `appealed`. Omitted
`status` means all statuses; `status=all` is invalid. Default to page 1 and size
20 only when omitted. Explicit paging is positive whole numbers; size 100 is
valid and 101 is invalid. Reject invalid input with a generic 400, never clamp.

Use the existing authentication middleware and `req.auth` member context.
Obtain claims with `getClaimsForMember`, filter by status, compute totals, then
slice in the existing order. Do not accept a foreign-member selector. Missing
auth remains 401 with `DEV_MEMBER_ID` unset. Do not refactor claim detail.

Preserve `claims` and add
`pagination: { page, pageSize, total, totalPages }`, with `totalPages` equal to
the ceiling of filtered total divided by page size. No matches returns 200
with `claims: []`, total 0, and totalPages 0. A page beyond the end returns 200
with `claims: []`, the actual totals, and the requested page unchanged.

## Files and bounded changes

| File | Change |
| --- | --- |
| `tests\server.test.ts` | Test-first API default/status/paging/validation/auth/isolation cases using existing fixtures |
| `server\server.ts` | Only the claims-list query schema and validated scoped/filter/count/page response |
| `src\types.ts` | Typed query, pagination, and claims-page response |
| `src\services\httpClient.ts` | Typed `getClaims` options, encoded query, member header, and full page response |
| `src\components\ClaimsList.tsx` | Filter/page/page-size state, controls, metadata, and request lifecycle |
| `src\App.css` | Only styles needed for claims controls and scoped accessible state feedback |

No fixture changes or new exports from `server\data.ts` are needed. For two
pages use M-10001 with `pageSize=1`; do not mock or mutate data just to create
more claims. Tests must not leak environment or other modified state.

## Client and UI behavior

- Send filter and paging through the existing HTTP client, retaining the member
  header; return the full typed response rather than discarding pagination.
- Initialize the optional browser-address `pageSize` to a whole number from 1
  to 100 or default 20. Reject malformed address values by using the default,
  not by forwarding them. The API independently validates its stricter inputs.
- Start with All statuses and page 1. Omit the status query for All statuses.
  Change filter and reset page together so an old page cannot become current.
- Render labeled filter, Previous/Next, current page/totals, and claims. Disable
  navigation at boundaries and for empty results without inventing a page 1
  of 0. Keep filtering usable for empty and failed results.
- Keep controls mounted during requests. Show loading feedback, avoid needless
  keyboard-focus loss, and announce a generic error, not a raw error payload.
- Cancel or ignore obsolete requests so stale success, error, or completion
  callbacks cannot overwrite the current selection's data or loading state.
- Keep the claims error contrast AA-compliant with a claims-scoped style if
  needed; do not change the shared `.error` style for other features.

## Test-first sequence and validation

Generate concrete checkbox tasks with the [task example](tasks.md) as a guide.
Add focused API tests first and run them to establish expected contract failures
before implementation. Cover every supported status (including empty matches),
default metadata, filtered totals, size-1 page slices, stable order, empty and
out-of-range pages, malformed/repeated values, size 100/101, missing auth, and
two-member isolation of both results and totals. Unset the development fallback
for missing-auth evidence and restore any test-managed environment state.

Keep API and typed-client work in one phase, then update the UI consumer and
resilient lifecycle. Reuse existing test tooling; do not add a frontend framework
just to make the task list longer. Browser behavior is subsequently checked by
the participant, not marked complete by the implementation agent.

Stop development processes before API tests: importing the existing server also
starts a listener, so a running development API can cause a port conflict.
Run `npm test`, `npm run typecheck`, and `npm run build`; record actual commands
and outcomes and repair failures caused by the change. Do not invent a lint
gate: the starter lacks the lint tooling/configuration. Typecheck covers the
backend, and Vite transpilation is not a full frontend TypeScript check.

## Human handoff, separate from executable tasks

After implementation and real checks, follow
[review and acceptance](../steps/06-review-and-accept.md) and the single
[acceptance checklist](../acceptance.md). A participant customizes the
read/search-only reviewer, evaluates findings, operates the browser and keyboard,
and records actual outcomes, limitations, and the acceptance decision. The
implementation agent cannot approve scope, decide findings, or accept the feature.
No generation or convergence result substitutes for this handoff.
