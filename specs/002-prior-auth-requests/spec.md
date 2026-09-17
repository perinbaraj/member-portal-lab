# Feature Specification: Prior Authorization Requests

**Feature Branch**: `[002-prior-auth-requests]`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Build a prior authorization feature for the member portal. An authenticated member can view their prior auth requests and submit a new one. The submission requires: procedure code, referring provider, clinical justification (free text up to 500 chars), and preferred facility. Members see real-time status (pending, approved, denied, expired). Denied requests show reason and appeal instructions. Out of scope: provider-side submission, auto-adjudication, appeal submission."

## Clarifications

### Session 2026-06-04

- Q: How should real-time status updates be delivered to members? -> A: Auto-refresh polling every 30 seconds while the prior-auth page is open, plus manual refresh control.
- Q: How should denial reason codes be standardized? -> A: Use a fixed denial reason code enum managed by the BFF.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View My Prior Authorization Requests (Priority: P1)

As an authenticated member, I can view a list of my prior authorization requests and each request's current status so I can understand coverage progress without contacting support.

**Why this priority**: Visibility of request status is the core member value and the primary read experience for the feature.

**Independent Test**: Can be fully tested by signing in as one member, opening the prior authorization section, and confirming only that member's requests and statuses are shown.

**Acceptance Scenarios**:

1. **Given** a member has one or more prior authorization requests, **When** the member opens the prior authorization view, **Then** the system shows only that member's requests with status values from pending, approved, denied, or expired.
2. **Given** a member has no prior authorization requests, **When** the member opens the prior authorization view, **Then** the system shows an empty state with clear guidance for submitting a new request.
3. **Given** a member attempts to access another member's prior authorization data, **When** the access is evaluated, **Then** access is denied and no other member request data is exposed.
4. **Given** the prior authorization view remains open, **When** backend status changes occur, **Then** the system refreshes statuses at least every 30 seconds and supports manual refresh on demand.

---

### User Story 2 - Submit A New Prior Authorization Request (Priority: P1)

As an authenticated member, I can submit a new prior authorization request with all required medical and provider context so review can begin immediately.

**Why this priority**: Submission is the primary write action and is required to start the authorization process.

**Independent Test**: Can be fully tested by completing the request form with valid values and verifying a new request appears for that member with an initial pending status.

**Acceptance Scenarios**:

1. **Given** a member provides valid procedure code, referring provider, clinical justification of 1 to 500 characters, and preferred facility, **When** the member submits the request, **Then** the request is created and shown with pending status.
2. **Given** required fields are missing or the clinical justification exceeds 500 characters, **When** the member submits the request, **Then** the request is rejected with clear, accessible validation feedback and no request is created.
3. **Given** a member submits a request successfully, **When** the member returns to the request list, **Then** the new request is visible under that same member context.

---

### User Story 3 - Understand Denials And Next Steps (Priority: P2)

As an authenticated member, I can view denial details and appeal instructions for denied requests so I understand what happened and how to proceed.

**Why this priority**: Denial transparency is essential for trust and compliance, but it depends on the request lifecycle and is secondary to view and submit flows.

**Independent Test**: Can be tested by viewing a denied request and confirming both a member-readable reason and appeal instructions are present.

**Acceptance Scenarios**:

1. **Given** a request is denied, **When** the member views request details, **Then** the system shows a member-readable denial reason, appeal instructions, and an associated machine-readable denial reason code.
2. **Given** a request transitions between statuses, **When** the member views current state, **Then** the displayed status reflects the latest authorized status for that request.

### Edge Cases

- A member submits clinical justification with exactly 500 characters; submission succeeds.
- A member submits clinical justification with 501 characters; submission is rejected with clear validation messaging.
- A request transitions to denied after the member is already viewing the list; status updates without exposing stale or conflicting state.
- A request reaches expired status; member still sees historical request details and status label.
- A member with no requests submits the first request and immediately sees it in their own list.
- Concurrent access or crafted identifiers must not allow any cross-member prior authorization visibility.

### Cross-Cutting Constraints *(mandatory)*

- **Privacy & Compliance**: The feature must prevent PHI exposure in logs, telemetry, and error responses; errors shown to members must remain generic and safe.
- **Security**: All read and write actions must enforce authenticated member context, validate request payloads, and block cross-member access attempts with forbidden outcomes.
- **Auditability & Decision Transparency**: All status transitions must create immutable audit events; denied outcomes must include a machine-readable reason code plus member-readable reason and appeal instructions.
- **Accessibility**: Request list, status updates, validation errors, and denial content must meet WCAG 2.1 AA expectations including keyboard access, semantic labels, and screen-reader announcements.
- **Performance**: The affected member journeys must preserve portal performance budgets for response and page readiness under normal expected usage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authenticated member to view only their own prior authorization requests.
- **FR-002**: The system MUST display each prior authorization request with one current status value from pending, approved, denied, or expired.
- **FR-003**: The system MUST allow an authenticated member to submit a new prior authorization request.
- **FR-004**: The system MUST require procedure code, referring provider, clinical justification, and preferred facility for each new submission.
- **FR-005**: The system MUST reject submissions where clinical justification exceeds 500 characters.
- **FR-006**: The system MUST validate required inputs and provide clear, accessible feedback when validation fails.
- **FR-007**: The system MUST create new requests in pending status.
- **FR-008**: The system MUST prevent members from viewing, creating, or interacting with another member's prior authorization requests.
- **FR-009**: The system MUST show denial details and appeal instructions for denied requests.
- **FR-010**: The system MUST associate each denied request with a machine-readable denial reason code.
- **FR-011**: The system MUST record an immutable audit event for every request status transition, including prior status, next status, actor context, and transition time.
- **FR-012**: The system MUST exclude provider-side submission, automatic adjudication, and direct appeal submission from this feature scope.
- **FR-013**: The system MUST auto-refresh prior authorization statuses at a 30-second interval while the member is on the prior authorization view.
- **FR-014**: The system MUST provide a manual refresh control so members can request immediate status refresh.
- **FR-015**: The system MUST restrict denial reason codes to a fixed enum: `medical_necessity`, `missing_documentation`, `non_covered_service`, `eligibility_issue`, `duplicate_request`, `other`.

### Key Entities *(include if feature involves data)*

- **PriorAuthorizationRequest**: A member-scoped request for procedure coverage review, including request identifier, member identifier, procedure code, referring provider, clinical justification, preferred facility, current status, creation time, and last update time.
- **PriorAuthorizationDecision**: The decision data for a request, including decision status, decision timestamp, member-readable reason, optional appeal instructions, and required denial reason code when denied from the fixed enum: `medical_necessity`, `missing_documentation`, `non_covered_service`, `eligibility_issue`, `duplicate_request`, `other`.
- **StatusTransitionAuditEvent**: An immutable record of a status change for a request, including request identifier, actor context, prior status, next status, timestamp, and correlation metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of authenticated members can view their own prior authorization request list and statuses without assistance.
- **SC-002**: In acceptance testing, 100% of valid submissions create a new pending request and appear in the submitting member's list.
- **SC-003**: In validation testing, 100% of submissions with missing required fields or clinical justification longer than 500 characters are rejected with clear feedback.
- **SC-004**: In security testing, 100% of cross-member access attempts for prior authorization data are blocked without exposing another member's request details.
- **SC-005**: In decision transparency testing, 100% of denied requests include a member-readable reason, appeal instructions, and a machine-readable denial reason code.
- **SC-006**: In audit verification, 100% of tested status transitions generate immutable audit records with prior status, next status, actor context, and timestamp.
- **SC-007**: In accessibility checks, all primary prior-authorization user journeys satisfy WCAG 2.1 AA criteria for labels, keyboard operation, and announced error/status messaging.
- **SC-008**: In status freshness tests, updated prior authorization statuses are reflected within 30 seconds of backend status change while the page is open, and manual refresh updates immediately when new status exists.
- **SC-009**: In decision validation tests, 100% of denied requests use one allowed enum denial reason code and 0 denied requests contain out-of-taxonomy codes.

## Assumptions

- Members are already authenticated before using this feature and have an active member context.
- Real-time status is delivered through 30-second polling while the view is open plus member-initiated manual refresh.
- Appeals are informational only in this scope; members receive instructions but cannot submit appeals through this feature.
- Provider and utilization management teams update decision statuses through existing operational processes outside this feature.
- Out-of-scope capabilities are intentionally deferred to future features and should not be partially implemented here.
