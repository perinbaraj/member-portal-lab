# Research: Prior Authorization Requests

## Decision: Keep prior authorization data in in-memory arrays with append-only audit events for this feature scope

**Rationale**: The repository already uses in-memory mock data in the BFF for feature labs. An in-memory `PriorAuthorizationRequest[]` plus append-only `StatusTransitionAuditEvent[]` provides deterministic behavior, simple tests, and full traceability without introducing database infrastructure during this slice.

**Alternatives considered**:
- Persistent database tables: rejected for this scope because setup complexity is not required for the current feature increment.
- Event-sourcing framework: rejected as unnecessary complexity relative to the required auditability outcomes.

## Decision: Enforce denial reason codes with a fixed BFF-owned enum

**Rationale**: The clarified spec requires fixed denial reason taxonomy. A strict enum (`medical_necessity`, `missing_documentation`, `non_covered_service`, `eligibility_issue`, `duplicate_request`, `other`) keeps downstream behavior consistent and enables deterministic UI handling and analytics.

**Alternatives considered**:
- Free-form pass-through codes from downstream: rejected due to inconsistency and validation risk.
- Human-readable reason only: rejected because constitution and spec require machine-readable denial codes.

## Decision: Member isolation is enforced entirely by auth-context ownership checks in every prior-auth endpoint

**Rationale**: The safest pattern in this codebase is deriving owner identity exclusively from `req.auth.memberId`, never from request body/query, and filtering every list/read/write by that member. Cross-member attempts return 403 and emit a security event with a hashed member ID.

**Alternatives considered**:
- Client-side filtering: rejected because it is not a security boundary.
- Optional owner parameter in API: rejected because it enables accidental cross-member data leaks.

## Decision: Implement real-time status via 30-second polling plus manual refresh in the React feature

**Rationale**: The clarified requirement prefers predictable freshness over transport complexity. Polling every 30 seconds while the view is mounted, plus a manual refresh action, satisfies status freshness without WebSocket/SSE complexity.

**Alternatives considered**:
- WebSocket or SSE updates: rejected for this scope due to additional infrastructure and lifecycle complexity.
- Manual-only refresh: rejected because it does not satisfy the accepted clarification.

## Decision: Use Zod route schemas for create payloads and status-safe response envelopes with generic error messaging

**Rationale**: Route-level Zod validation aligns with constitution and existing backend patterns. Generic member-safe errors avoid PHI leakage, while machine-readable codes preserve deterministic frontend behavior.

**Alternatives considered**:
- Ad hoc validation in handlers: rejected due to maintainability and inconsistency.
- Raw downstream error pass-through: rejected due to security/privacy risk.

## Decision: Keep the implementation as a full-stack slice under existing project structure

**Rationale**: The codebase already splits backend routes/services and frontend components/services. Adding `server/routes/priorAuth.ts`, `server/services/priorAuthService.ts`, `server/validation/priorAuth.ts`, and `src/components/PriorAuthForm.tsx` keeps cohesion and traceability with minimal structural disruption.

**Alternatives considered**:
- New module/package boundary: rejected as unnecessary for this scope.
- Monolithic changes in `server/server.ts` and `src/App.tsx`: rejected because it reduces maintainability.
