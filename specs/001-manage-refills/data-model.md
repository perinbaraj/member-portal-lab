# Data Model: Manage Prescription Refills

## Entity: PrescriptionView

**Purpose**: Member-facing representation of an active prescription in the portal.

**Fields**:
- `prescriptionId` (`string`): Stable identifier used by the BFF and UI.
- `memberId` (`string`): Authenticated member owner; never sourced from the client body.
- `medicationName` (`string`): Displayed to the authenticated member only; excluded from logs.
- `dosage` (`string`): Displayed to the authenticated member only.
- `lastFilledDate` (`string`): Member-facing date label.
- `refillsRemaining` (`number`): Non-negative count used for eligibility messaging.
- `prescriptionStatus` (`active | expired | discontinued`): Underlying prescription state.
- `refillStatus` (`eligible | pending | processing | ineligible`): Member-visible refill workflow
  state.
- `refillStatusReason` (`string | null`): Safe explanatory reason such as `NO_REFILLS_REMAINING`
  or `ALREADY_PENDING`.
- `pendingRefillRequestedAt` (`string | null`): Timestamp shown only when a refill is pending or
  processing.

**Validation Rules**:
- `memberId` must match `req.auth.memberId` on every request.
- `refillsRemaining` must be zero or greater.
- `refillStatus = eligible` is valid only when `prescriptionStatus = active` and
  `refillsRemaining > 0` and no current pending/processing refill exists.
- `refillStatus = ineligible` is required when the prescription is inactive or has no available
  refill action.

## Entity: RefillRequest

**Purpose**: Backend representation of a refill workflow for a specific prescription/member pair.

**Fields**:
- `refillRequestId` (`string`): Internal confirmation identifier from the BFF or pharmacy-service.
- `prescriptionId` (`string`): Foreign key to `PrescriptionView`.
- `memberId` (`string`): Member owner.
- `status` (`pending | processing | canceled`): Workflow state tracked by the BFF contract.
- `requestedAt` (`string`): Submission timestamp.
- `updatedAt` (`string`): Last workflow change timestamp.
- `canceledAt` (`string | null`): Present only when canceled.
- `downstreamReference` (`string | null`): Pharmacy-service correlation identifier; never surfaced
  in generic UI errors.

**Validation Rules**:
- Only one non-terminal refill request may exist per `memberId + prescriptionId` at a time.
- Cancellation is valid only when `status = pending`.
- Transition to `processing` is system-driven and blocks cancellation.

**State Transitions**:
- `pending -> canceled` when the member cancels before downstream processing begins.
- `pending -> processing` when pharmacy-service accepts the request for fulfillment.
- `processing` is terminal for this feature's member-facing scope; later fulfillment completion is
  represented by the next refreshed prescription view rather than a new portal workflow screen.

## Entity: RefillIdempotencyRecord

**Purpose**: Short-lived Redis record that prevents duplicate submit/cancel mutations.

**Fields**:
- `key` (`string`): Derived from member identity, prescription identity, and action.
- `action` (`submit | cancel`): Mutation type.
- `memberHash` (`string`): Hashed member identifier used for safe cache scoping.
- `prescriptionId` (`string`): Target prescription.
- `responseStatus` (`pending | canceled | duplicate`): Cached mutation outcome.
- `responseCode` (`string`): Safe machine-readable result code.
- `expiresAt` (`string`): TTL boundary.

**Validation Rules**:
- Submit records use a 24-hour TTL.
- Cancel records use a 1-hour TTL.
- Records must not store medication names, dosage text, or raw downstream error payloads.

## Entity: PharmacyServiceTokenCache

**Purpose**: Redis-backed cache entry for the OAuth 2.0 access token used by the BFF.

**Fields**:
- `serviceName` (`string`): `pharmacy-service`.
- `accessToken` (`string`): Cached service token.
- `scope` (`string`): OAuth scope granted.
- `expiresAt` (`string`): Token expiry with refresh buffer.

**Validation Rules**:
- Token refresh must occur before expiry.
- Tokens are stored only server-side and never exposed to the React client.

## Relationships

- One `PrescriptionView` belongs to one member.
- One `PrescriptionView` may have zero or one active `RefillRequest` in this feature scope.
- One `RefillRequest` may have zero or more short-lived `RefillIdempotencyRecord` entries over its
  lifecycle.
- One `PharmacyServiceTokenCache` serves many pharmacy-service calls across members.