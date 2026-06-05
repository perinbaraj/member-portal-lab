# Quickstart: Prior Authorization Requests

Use this guide to validate member prior authorization listing, submission, denial transparency, and
status freshness behavior end to end. API shapes are in [contracts/prior-auth.yaml](contracts/prior-auth.yaml), and domain/state rules are in [data-model.md](data-model.md).

## Prerequisites

- Node.js 20+
- Dependencies installed with `npm install`
- Development environment using existing member-context header behavior (`x-member-id`)

## Start The App

```bash
npm run dev
```

Expected outcome:
- BFF available at `http://localhost:3000`
- UI available at `http://localhost:5173`

## Validation Scenario 1: View Member-Scoped Prior Authorization Requests

1. Open the UI as a valid member.
2. Navigate to the prior authorization section.
3. Confirm list and statuses render.

Expected outcome:
- Only the authenticated member's requests are shown.
- Each request shows one status from `pending`, `approved`, `denied`, `expired`.
- Empty-state guidance appears when no requests exist.

## Validation Scenario 2: Submit A New Request

1. Provide procedure code, referring provider, clinical justification, and preferred facility.
2. Submit the form.
3. Return to or refresh the request list.

Expected outcome:
- Request creation succeeds and appears with `pending` status.
- Missing required fields are rejected with accessible validation messages.
- Clinical justification > 500 chars is rejected.

## Validation Scenario 3: Denial Transparency

1. Use test data containing at least one denied request.
2. Open denied request details.

Expected outcome:
- Member-readable denial reason is visible.
- Appeal instructions are visible.
- Machine-readable denial reason code is present and from allowed enum values.

## Validation Scenario 4: Status Freshness

1. Keep prior-auth page open for at least one polling cycle.
2. Trigger a backend status change using test data.
3. Verify automatic refresh behavior.
4. Trigger manual refresh.

Expected outcome:
- Status changes appear within 30 seconds while page is open.
- Manual refresh updates status immediately when newer data exists.

Performance/freshness checks:
- List and detail API responses should meet the portal p95 target of <= 500 ms in local validation.
- The interval between automatic status refresh calls remains 30 seconds.
- Manual refresh should trigger a new list fetch immediately after activation.

## Validation Scenario 5: Security, Privacy, Accessibility

Run backend and frontend tests:

```bash
npm test
npm run test:ui
npm run typecheck
```

Then verify manually:
- Missing `x-member-id` is rejected.
- Cross-member request access is denied with safe errors.
- No PHI appears in backend logs.
- Keyboard users can submit forms and trigger refresh.
- Validation and status messages are announced to assistive technologies.

## Validation Scenario 6: API Contract Smoke Checks

```bash
curl -H "x-member-id: M-10001" http://localhost:3000/api/prior-auth
curl -X POST -H "x-member-id: M-10001" -H "Content-Type: application/json" \
  -d '{"procedureCode":"27447","referringProvider":"Dr. Alvarez","clinicalJustification":"Post-traumatic knee degeneration with failed conservative treatment.","preferredFacility":"Central Ortho Center"}' \
  http://localhost:3000/api/prior-auth
curl -H "x-member-id: M-10001" http://localhost:3000/api/prior-auth/PAR-10001
```

Expected outcome:
- Responses conform to [contracts/prior-auth.yaml](contracts/prior-auth.yaml).
- Member isolation is preserved on list/detail/create.
- Denied records include allowed denial reason enum codes and appeal instructions.
