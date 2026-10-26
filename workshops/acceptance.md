# Core feature contract and acceptance

This is the requirement boundary, not a prewritten implementation.

## API contract

Extend `GET /api/claims` with:

| Input | Behavior |
| --- | --- |
| `status` omitted | All statuses for the current member |
| `status` supplied | One of `submitted`, `in_review`, `approved`, `denied`, `appealed` |
| `page` omitted | Page 1 |
| `pageSize` omitted | 20 items |
| Explicit paging | Positive integers; maximum page size 100 |
| Invalid status or paging | Generic 400; do not silently clamp or coerce malformed input |

The "All statuses" UI option omits `status`; it does not send `status=all`.
Reject empty or repeated values rather than accepting an arbitrary first value.
An unknown status or out-of-range page size is invalid.

Preserve `claims` and add:

```json
{
  "claims": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Derive the member from the existing authentication middleware. Apply member
scoping, then status filtering, then pagination; calculate totals from that
same scoped and filtered collection. Preserve fixture order.

No matching claims returns 200 with an empty list and zero totals. A page beyond
the last page also returns 200 and an empty list, but retains the actual total
and totalPages. Do not silently move to another page.

Missing authentication remains 401 when `DEV_MEMBER_ID` is not configured.
This list feature has no foreign-member selector. Do not add a query parameter
that lets a caller choose another member, and do not refactor the unrelated
claim-detail route. Do not log member details, diagnoses, medications, or bodies.

## Focused API evidence

Extend the established test file rather than introducing a test framework.

- Default response retains `claims` and includes correct metadata.
- Each supported status returns only matching claims.
- Combined status/paging uses filtered totals and correct page slices.
- Page one, later pages, and out-of-range pages behave correctly.
- Empty matches return the defined empty response.
- Invalid status, empty/repeated values, noninteger/zero/negative paging, and a
  page size above 100 return a generic 400.
- A page size of 100 is accepted.
- Missing authentication returns 401 with the development fallback unset.
- Two members never receive each other's claims or totals.

Use controlled, synthetic test data sufficient for paging. Restore fixture
changes/mocks after each test; avoid contaminating existing tests.

## Browser evidence

Run the app and perform these checks:

1. Open Claims. A labeled status selector defaults to All statuses.
2. Select a status; only matching claims appear and navigation resets to page one.
3. Select a status with no results; an empty message appears and the filter stays
   available so you can return to All statuses.
4. Exercise Previous/Next with a small development page size. Boundary and
   empty-result navigation is disabled correctly.
5. Change filters rapidly; an older request cannot overwrite newer results.
6. Confirm loading feedback and an announced, generic error when a request fails.
7. Operate controls by keyboard and verify associated labels and usable contrast.
8. Switch synthetic members; compare results and totals without mixing contexts.
9. Revisit Profile and Prescriptions; their existing behavior remains unchanged.

Run `npm test`, `npm run typecheck`, and `npm run build`. Use lint only if the
facilitator has established a working lint configuration; the original starter
declares a lint script without its required tooling.

The existing typecheck covers the backend. Vite build is not a full frontend
TypeScript check. Do not present either as proof that every TSX type was checked.

## Human acceptance record

Record a brief summary in your own feature artifacts or PR draft:

```text
Requirement:
Changed files:
Automated checks and actual results:
Browser checks and actual results:
Reviewer findings accepted/rejected, with reasons:
Known limitations:
Decision: accepted / not accepted
```

Do not publish member data or screenshots containing real health information.
