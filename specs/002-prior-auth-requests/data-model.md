# Data Model: Prior Authorization Requests

## Entity: PriorAuthorizationRequest

**Purpose**: Member-scoped request record for prior authorization submission and status tracking.

**Fields**:
- `requestId` (`string`): Stable prior authorization request identifier.
- `memberId` (`string`): Owning member ID from authenticated context.
- `procedureCode` (`string`): Submitted procedure code.
- `referringProvider` (`string`): Submitted provider descriptor.
- `clinicalJustification` (`string`): Member-entered justification, 1-500 characters.
- `preferredFacility` (`string`): Submitted facility descriptor.
- `status` (`pending | approved | denied | expired`): Current request status.
- `createdAt` (`string`): ISO timestamp when request was created.
- `updatedAt` (`string`): ISO timestamp for latest status or content mutation.

**Validation Rules**:
- `memberId` MUST always equal `req.auth.memberId`.
- `clinicalJustification` MUST be between 1 and 500 characters.
- Required creation fields: `procedureCode`, `referringProvider`, `clinicalJustification`, `preferredFacility`.
- New requests MUST start in `pending`.

## Entity: PriorAuthorizationDecision

**Purpose**: Decision details attached to a request once status leaves `pending`.

**Fields**:
- `requestId` (`string`): Foreign key to `PriorAuthorizationRequest`.
- `status` (`approved | denied | expired`): Decision state.
- `decisionAt` (`string`): Decision timestamp.
- `memberReason` (`string | null`): Member-safe decision reason text.
- `appealInstructions` (`string | null`): Member-facing next-step guidance for denied states.
- `denialReasonCode` (`medical_necessity | missing_documentation | non_covered_service | eligibility_issue | duplicate_request | other | null`): Required when `status = denied`, otherwise null.

**Validation Rules**:
- `denialReasonCode` MUST be non-null when `status = denied`.
- `denialReasonCode` MUST be null for non-denied states.
- `appealInstructions` SHOULD be present for denied states.

## Entity: StatusTransitionAuditEvent

**Purpose**: Immutable audit record for every status transition.

**Fields**:
- `eventId` (`string`): Stable unique audit event identifier.
- `requestId` (`string`): Related prior authorization request.
- `memberId` (`string`): Request owner.
- `actorType` (`member | system | reviewer`): Transition actor classification.
- `fromStatus` (`pending | approved | denied | expired | null`): Prior status (`null` for creation).
- `toStatus` (`pending | approved | denied | expired`): New status.
- `occurredAt` (`string`): Transition timestamp.
- `reasonCode` (`string | null`): Optional machine-readable transition reason.

**Validation Rules**:
- Events are append-only and never updated/deleted.
- Every status change MUST emit exactly one audit event.
- Event payload MUST not include PHI text.

## Relationships

- One `PriorAuthorizationRequest` belongs to exactly one member.
- One `PriorAuthorizationRequest` may have zero or one current `PriorAuthorizationDecision`.
- One `PriorAuthorizationRequest` has one-to-many `StatusTransitionAuditEvent` records.

## State Transitions

- `null -> pending`: Created by member submission.
- `pending -> approved`: Reviewer/system approval.
- `pending -> denied`: Reviewer/system denial with required denial reason code.
- `pending -> expired`: System expiry after validity window.
- `approved -> expired`: System expiry after approval validity window.

No transitions return to `pending` in this scope.
