# Quickstart: Manage Prescription Refills

Use this guide to validate the prescription list, refill submission, and cancellation experience
end to end after implementation. Contract details live in [contracts/prescriptions.yaml](contracts/prescriptions.yaml), and domain rules live in [data-model.md](data-model.md).

## Prerequisites

- Node.js 20+
- Running Redis instance reachable by the BFF configuration used for idempotency/token cache
- Pharmacy-service sandbox or mock endpoint configured for list and refill operations
- Dependencies installed with `npm install`

## Start The App

```bash
npm run dev
```

Expected outcome:
- BFF available at `http://localhost:3000`
- UI available at `http://localhost:5173`

## Validation Scenario 1: View Active Prescriptions

1. Open the UI as a member with active prescriptions.
2. Navigate to the prescriptions section.
3. Confirm the page renders a list of active prescriptions, with refill status and action controls.

Expected outcome:
- Only the signed-in member's prescriptions appear.
- Prescriptions with available refill action show `Request Refill`.
- Prescriptions already pending or processing show non-destructive status messaging.
- Empty-state messaging appears when the member has no active prescriptions.

## Validation Scenario 2: Request A Refill

1. Select an eligible prescription.
2. Trigger `Request Refill` in the UI.
3. Refresh the prescription list or await optimistic UI refresh.

Expected outcome:
- Member sees confirmation that the refill request is pending.
- The same prescription now shows `pending` workflow state and cancel affordance.
- Repeated rapid submissions do not create duplicate refill requests.

## Validation Scenario 3: Cancel A Pending Refill

1. Start from a prescription with a pending refill.
2. Trigger the cancel action.
3. Refresh the list.

Expected outcome:
- Member sees confirmation that the pending refill was canceled.
- The prescription returns to `eligible` or `ineligible`, depending on remaining business rules.
- Duplicate cancel attempts are handled safely without inconsistent UI state.

## Validation Scenario 4: Late Cancellation Is Blocked

1. Use test data where the refill transitions from `pending` to `processing` before the cancel
   request is handled.
2. Attempt to cancel the refill.

Expected outcome:
- The BFF returns a conflict outcome per the contract.
- The UI shows a safe, member-readable message that the refill can no longer be changed.
- The prescription card updates to the `processing` state.

## Validation Scenario 5: Auth, Security, And Accessibility

Run the backend tests and type-check:

```bash
npm test
npm run test:ui
npm run typecheck
```

Then verify manually:
- Missing `x-member-id` header is rejected.
- Cross-member access attempts are blocked with safe error responses.
- Keyboard users can reach refill and cancel controls.
- Success and error messages are announced to screen readers.
- No PHI appears in logs during request success or failure flows.

## Validation Scenario 6: API Contract Smoke Checks

Use curl or an API client against the BFF:

```bash
curl -H "x-member-id: M-10001" http://localhost:3000/api/prescriptions
curl -X POST -H "x-member-id: M-10001" http://localhost:3000/api/prescriptions/RX-70001/refill
curl -X DELETE -H "x-member-id: M-10001" http://localhost:3000/api/prescriptions/RX-70001/refill
```

Expected outcome:
- Responses match the schemas in [contracts/prescriptions.yaml](contracts/prescriptions.yaml).
- Duplicate submit behavior is safely collapsed.
- Cancel requests fail with a conflict when the refill is already processing.