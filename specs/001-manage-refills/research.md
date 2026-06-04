# Research: Manage Prescription Refills

## Decision: Use a backend pharmacy service abstraction with OAuth 2.0 client credentials and a cached service token

**Rationale**: The BFF is the confidential client for the internal pharmacy-service, so it should
acquire a service token with client credentials, cache that token in Redis with a small expiry
buffer, and keep all token management out of route handlers. This fits the current architecture,
lets the frontend stay on the `x-member-id` member-context contract, and isolates downstream
integration details in `server/services/`.

**Alternatives considered**:
- Direct fetch calls from route handlers: rejected because it tangles OAuth, retries, and error
  sanitation into `server/server.ts`.
- Frontend-to-pharmacy direct calls: rejected because it would bypass BFF member-context,
  security, and HIPAA-safe error handling rules.
- Per-member delegated downstream tokens: rejected for this lab feature because the BFF-to-
  service integration only needs service credentials plus explicit member context.

## Decision: Model refill workflow state separately from base prescription status

**Rationale**: Existing prescription status values (`active`, `expired`, `discontinued`) do not
capture refill lifecycle rules. The smallest member-visible model that supports the requested
behavior is a separate `refillStatus` with `eligible`, `pending`, `processing`, and `ineligible`.
This keeps prescription identity stable, makes UI rules explicit, and lets cancellation be tied to
the refill workflow without redefining the whole prescription record.

**Alternatives considered**:
- Reusing base prescription status for refill lifecycle: rejected because it conflates clinical
  prescription state with refill workflow state.
- A two-state model (`eligible` or `pending` only): rejected because it cannot represent the rule
  that cancellation is blocked once processing begins.
- A larger historical state model exposed to the member: rejected because history views are out of
  scope and would add avoidable complexity.

## Decision: Expose cancellation as a BFF operation on the prescription refill subresource

**Rationale**: The member acts on a visible prescription card, not on an internal refill request
  identifier, so the BFF contract should remain prescription-oriented. The contract will use
  `POST /api/prescriptions/{prescriptionId}/refill` to submit and `DELETE /api/prescriptions/{prescriptionId}/refill`
  to cancel the current pending refill for that member. The BFF can translate that into whatever
  downstream `/refills` operations the pharmacy-service requires.

**Alternatives considered**:
- Exposing refill-request identifiers directly in the UI contract: rejected because it leaks
  backend workflow detail into the member experience.
- Using a `POST .../cancel` action endpoint: rejected because `DELETE` on the refill subresource
  better matches the requested cancellation semantics.
- Omitting cancel from the BFF and relying on list refresh only: rejected because cancellation is
  an explicit user requirement.

## Decision: Use Redis-backed idempotency for refill submission, with a shorter-lived variant for cancellation

**Rationale**: Refill submission is a mutation that must tolerate retries without duplicate
pharmacy requests. The BFF should create a Redis idempotency key scoped to the member, the
prescription, and the action, with atomic lock semantics (`SET NX`) before calling pharmacy-
service. Refill requests should use a 24-hour TTL to collapse same-day duplicates; cancellation
requests should use a shorter 1-hour window because they are time-sensitive and only valid while
pending.

**Alternatives considered**:
- No idempotency layer: rejected because rapid retries could create duplicate refill requests.
- Client-supplied idempotency only: rejected because the current frontend contract does not send
  an idempotency token and the BFF still needs server-side race protection.
- Persisting full request bodies in Redis: rejected because it increases PHI exposure risk and is
  unnecessary for this feature.

## Decision: Return generic client-facing errors and machine-readable workflow codes

**Rationale**: The constitution requires generic errors with no PHI leakage, but the frontend
still needs enough structure to present useful member feedback. The BFF should map downstream
errors to a compact response envelope with a generic `error`, a user-safe `message`, and optional
codes like `REFILL_ALREADY_PENDING`, `REFILL_INELIGIBLE`, or `REFILL_ALREADY_PROCESSING`.

**Alternatives considered**:
- Returning raw downstream messages: rejected because it can leak service details or PHI.
- Returning only status codes: rejected because the frontend would lose the ability to present
  specific but still safe workflow feedback.
- Logging full failure context for debugging: rejected because medication names and other PHI must
  not appear in logs.