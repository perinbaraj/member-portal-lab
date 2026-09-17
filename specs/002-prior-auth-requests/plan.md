# Implementation Plan: Prior Authorization Requests

**Branch**: `001-prescription-refill` | **Date**: 2026-06-04 | **Spec**: `/specs/002-prior-auth-requests/spec.md`

**Input**: Feature specification from `/specs/002-prior-auth-requests/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a full-stack prior authorization feature that lets authenticated members list their own
prior authorization requests, submit new requests with required fields, and view denial
transparency details. The implementation uses Express BFF routes under `/api/prior-auth` with
Zod validation, in-memory request/audit storage for this lab scope, and a React `PriorAuthForm`
flow with 30-second status polling plus manual refresh while preserving HIPAA-safe logging,
member isolation, accessibility, and constitution-aligned auditability requirements.

## Technical Context

**Language/Version**: TypeScript 5.6 across Node.js 20+ Express backend and React 18 frontend

**Primary Dependencies**: Express 4.21, React 18, Vite 5, Zod 3.23, helmet, cors, Vitest,
Supertest, React Testing Library

**Storage**: In-memory collections in `server/data.ts` for `PriorAuthorizationRequest` and
append-only `StatusTransitionAuditEvent` records; no new persistent database in this feature

**Testing**: Vitest + Supertest for API routes and member-isolation/error behaviors; React
component and interaction tests via existing UI test stack (`npm run test:ui`)

**Target Platform**: Browser-based SPA (desktop/mobile) with Node.js BFF on localhost in dev

**Project Type**: Full-stack web application (React SPA + Express BFF)

**Performance Goals**: Preserve API p95 < 500 ms for prior-auth endpoints; preserve frontend
FCP < 1.5 s for prior-auth views; reflect status changes within 30 seconds while the page is
open and immediately on manual refresh

**Constraints**: No PHI in logs or detailed error payloads, strict member ownership enforcement,
route-level Zod validation, denial reason enum enforcement, immutable status transition auditing,
and out-of-scope exclusions (provider submission, auto-adjudication, appeal submission)

**Scale/Scope**: Single member-facing prior-auth slice with list/detail/create/status visibility
for in-memory lab data; excludes reviewer workflows, provider portals, external orchestration,
and database migration concerns

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **PASS**: Backend design keeps errors generic and avoids PHI logging, with member-safe response
  envelopes and hashed member IDs for security events.
- **PASS**: Member-context isolation is enforced by deriving ownership from `req.auth.memberId`
  only and returning 403 on cross-member access attempts.
- **PASS**: Authorization endpoints are member-scoped for list/read/create, ensuring another
  member's request data is never returned.
- **PASS**: Frontend experience includes semantic form controls, accessible labels, keyboard
  support, and announced validation/status feedback.
- **PASS**: Design preserves performance budget through lightweight member-scoped queries and
  30-second polling cadence plus on-demand manual refresh.
- **PASS**: Denial outcomes require fixed machine-readable reason codes and every status
  transition emits an immutable audit event.
- **PASS**: Plan includes executable backend and frontend validation for auth, security,
  accessibility, and feature behavior.

**Post-Design Re-Check**: PASS. Phase 1 artifacts define immutable audit entities, fixed denial
reason code taxonomy, member-scoped contract rules, and quickstart validation covering security,
accessibility, and status freshness requirements.

## Project Structure

### Documentation (this feature)

```text
specs/002-prior-auth-requests/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── prior-auth.yaml
└── tasks.md
```

### Source Code (repository root)

```text
server/
├── server.ts
├── data.ts
├── types.ts
├── routes/
│   ├── prescriptions.ts
│   └── priorAuth.ts
├── services/
│   ├── pharmacyService.ts
│   └── priorAuthService.ts
└── validation/
    ├── prescriptions.ts
    └── priorAuth.ts

src/
├── App.tsx
├── App.css
├── types.ts
├── components/
│   ├── PrescriptionsList.tsx
│   └── PriorAuthForm.tsx
└── services/
    └── httpClient.ts

tests/
└── server.test.ts
```

**Structure Decision**: Preserve the existing monorepo layout and add a dedicated prior-auth route,
validation module, backend service, frontend feature component, and typed API client methods.
This keeps domain concerns isolated without introducing new package boundaries.

## Complexity Tracking

No constitution violations or complexity exemptions are required for this feature.
