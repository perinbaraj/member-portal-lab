# Implementation Plan: Manage Prescription Refills

**Branch**: `001-manage-refills` | **Date**: 2026-06-04 | **Spec**: `/specs/001-manage-refills/spec.md`

**Input**: Feature specification from `/specs/001-manage-refills/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a full-stack prescription management slice that lets authenticated members view active
prescriptions, submit refill requests, and cancel a pending refill before pharmacy processing
begins. The implementation will keep the React client in `src/` backed by the Node.js + Express
BFF in `server/`, move prescription behavior behind a pharmacy service abstraction with OAuth 2.0
token handling, use Redis for short-term refill idempotency, and expose a member-safe contract
that keeps refill workflow state visible without leaking downstream details.

## Technical Context

**Language/Version**: TypeScript 5.6 across the React 18 frontend and Node.js 20+ Express BFF

**Primary Dependencies**: React 18, Vite 5, Express 4.21, Zod 3.23, ioredis 5.4, helmet, cors,
Vitest, Supertest

**Storage**: In-memory mock data for the lab, Redis for short-term idempotency keys and OAuth
token cache, downstream pharmacy-service REST API as system of record

**Testing**: Vitest + Supertest for backend API validation; frontend interaction validation in the
Vite/React test stack adopted for this feature; targeted type-check via `npm run typecheck`

**Target Platform**: Web SPA in modern desktop/mobile browsers plus Node.js BFF on localhost in
development

**Project Type**: Full-stack web application with React SPA frontend and Express BFF backend

**Performance Goals**: Preserve API p95 under 500 ms for prescription list, refill, and cancel
flows; preserve frontend FCP under 1.5 s for the prescriptions experience; show refill or cancel
feedback within 3 seconds for successful actions

**Constraints**: No PHI in logs or generic errors; enforce `x-member-id` member isolation at the
BFF boundary; validate route inputs with Zod; use OAuth 2.0 client credentials for pharmacy-
service access; use Redis `SET NX` style locking for refill idempotency; cancellation only allowed
while refill state is pending

**Scale/Scope**: Single member portal feature slice covering active prescription list display,
one pending refill request per prescription, and cancellation before processing; excludes
prescription editing, transfers, mobile app changes, and broader refill history views

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **PASS**: Backend design will sanitize errors, avoid PHI logging, and keep downstream pharmacy
  failures behind generic member-facing responses.
- **PASS**: Member-context isolation stays in the BFF via `req.auth.memberId`, route-level Zod
  validation, explicit downstream member-context forwarding, and 403 behavior for cross-member
  access attempts.
- **PASS**: Frontend design includes semantic buttons, accessible status messaging, keyboard-
  reachable actions, and announced success/error states for refill and cancellation flows.
- **PASS**: Plan includes concrete performance controls: small per-member list payloads,
  no-history scope, Redis idempotency to collapse duplicate POSTs, and optimistic UI refresh with
  bounded network round trips.
- **PASS**: Validation will cover backend route tests, frontend interaction coverage, type-check,
  and manual end-to-end quickstart scenarios.

**Post-Design Re-Check**: Phase 1 artifacts preserve all gates. The contract keeps PHI out of
generic failures, the data model separates refill workflow state from prescription identity, the
quickstart includes accessibility/security validation, and the integration design preserves the
performance and member-isolation constraints.

## Project Structure

### Documentation (this feature)

```text
specs/001-manage-refills/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── prescriptions.yaml
└── tasks.md
```

### Source Code (repository root)

```text
server/
├── server.ts
├── data.ts
├── types.ts
├── routes/
│   └── prescriptions.ts
├── services/
│   ├── pharmacyService.ts
│   ├── oauthTokenService.ts
│   └── refillIdempotencyService.ts
└── validation/
    └── prescriptions.ts

src/
├── App.tsx
├── App.css
├── types.ts
├── components/
│   └── PrescriptionsList.tsx
└── services/
    └── httpClient.ts

tests/
└── server.test.ts
```

**Structure Decision**: Keep the existing single-repo layout, but refactor prescription behavior
into dedicated backend service and validation modules so the monolithic `server/server.ts` stops
owning business decisions directly. On the frontend, preserve the centralized `httpClient` and
feature-local `PrescriptionsList` component, extending their typed contracts instead of creating a
new state management layer.

## Complexity Tracking

No constitution violations or justified complexity exceptions are required for this feature.
