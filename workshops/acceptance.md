# Core feature contract and acceptance

This is the requirement boundary, not a prewritten implementation.

Read this contract during [specification review](steps/03-specify.md) and
[planning](steps/04-plan-and-tasks.md). Return for the automated evidence in
[step 5](steps/05-implement-and-test.md) and the human checks in
[step 6](steps/06-review-and-accept.md). Adopting a reference artifact or receiving
a clean agent review does not itself accept the feature.

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

## Synthetic fixtures and page size

The starter's synthetic claims are enough; no mocking, fixture changes, or new
exports from `server\data.ts` are needed.

| Member | Claims (status) |
| --- | --- |
| M-10001 | CLM-50001 (approved), CLM-50002 (in_review) |
| M-10002 | CLM-50003 (denied) |
| M-10003 | CLM-50004 (submitted) |

No member has more than two claims, so the default page size of 20 never shows a
second page. In API tests use `pageSize=1`: M-10001 then has two pages. For the
browser, the claims view also reads an optional `pageSize` from the page address,
for example `http://localhost:5173/?pageSize=1`. A whole number from 1 to 100 is
sent to the API as the page size; anything else is ignored and the default of 20
applies. The API still validates `pageSize` exactly as described above.

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

Use the existing synthetic fixtures and `pageSize=1` (see above). If you change a
fixture or a mock, restore it after each test so existing tests are not
contaminated.

## Browser evidence

These checks are performed and recorded by the participant, not checked off by
the implementation agent in `tasks.md`. An unresolved requirement means the
feature is not accepted, even if the event or its buffer has ended.

Run the app with `npm run dev` and open `http://localhost:5173/?pageSize=1`.
Switching member reloads the page and returns to Profile, so click Claims again
after each switch. Perform these checks:

1. Open Claims. A labeled status selector defaults to All statuses.
2. Select a status; only matching claims appear and navigation resets to page one.
3. Select a status with no results; an empty message appears and the filter stays
   available so you can return to All statuses.
4. Exercise Previous/Next. As M-10001 with all statuses, page 1 of 2 shows
   CLM-50001, Next shows CLM-50002, and Previous returns. Boundary and
   empty-result navigation is disabled correctly. Without `?pageSize=`, both
   claims appear on one page.
5. Change filters rapidly; an older request cannot overwrite newer results.
   Browser throttling cannot reliably reorder responses, so verify this by code
   inspection: the effect must cancel or ignore the previous request when the
   status or page changes (for example with an `AbortController` or a stale-result
   guard). Optionally ask the implementation agent for a temporary, clearly marked
   delay for one status in the API, switch quickly between that status and
   another, confirm the newer result stays, then remove the delay and rerun the
   tests.
6. Confirm loading feedback and an announced, generic error when a request fails.
   Force a failure with DevTools (Network > Offline), or run `npm run dev:api` and
   `npm run dev:ui` in two terminals instead of `npm run dev` and stop only the
   API. The message must be generic and announced to assistive technology (for
   example `role="alert"`), and the status selector must stay usable. Restore the
   network or restart the API afterwards.
7. Operate controls by keyboard and verify associated labels and usable contrast.
   After you activate Next or Previous from the keyboard, focus must stay on a
   usable control and not be lost mid-list because the buttons were disabled while
   loading. Known limitation: a natively `disabled` button you activate at the
   first or last page cannot keep focus, so focus falls to the page body. Record
   that under Known limitations unless you choose `aria-disabled` or move focus
   deliberately.
8. Switch synthetic members; compare results and totals without mixing contexts
   (M-10001: CLM-50001 and CLM-50002; M-10002: CLM-50003; M-10003: CLM-50004).
9. Revisit Profile and Prescriptions; their existing behavior remains unchanged.

### Starter quirks that are not part of this change

- The header button reads `Member: M-10001` after every reload, even when another
  member is active, and the app returns to Profile. Identify the member by the
  claims shown. Do not fix this in the claims-filter change.
- The starter `.error` style (red text on pink) is about 3.4:1, below the 4.5:1 AA
  threshold, and Profile and Prescriptions share it. If your new error message
  reuses `.error`, override the colour only inside the claims view, for example
  `.claims-list .error { color: #842029; }` (about 7:1). Do not change `.error`
  globally.

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

[Back to review and acceptance](steps/06-review-and-accept.md) |
[Workshop home](README.md)
