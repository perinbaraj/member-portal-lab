# Reference specification: filter my claims

Example only. The binding learner behavior contract is
[`workshops/acceptance.md`](../acceptance.md).

## User outcome

A signed-in member can select a claim status, browse matching results, and return
to all statuses without viewing another member's claims or totals.

## Functional requirements

1. Extend the existing claims list, not the entire portal.
2. Omitted status means all existing statuses. A supplied status is exactly one
   supported value from the current claim type.
3. Paging defaults to page 1 with 20 items; the largest accepted size is 100.
4. Invalid/empty/repeated query values return generic 400 responses.
5. Preserve the `claims` response property and add page, pageSize, total, and
   totalPages inside `pagination`.
6. Scope by the authenticated member before status filtering, counting, or paging.
7. Preserve fixture order. Return 200 for empty matches and out-of-range pages;
   totals remain accurate and no page is silently clamped.
8. Keep missing-auth behavior intact; add no member-selector query.
9. Provide a labeled status selector, Previous/Next controls, appropriate disabled
   states, loading feedback, accessible empty/error states, and first-page reset
   after status changes.
10. Prevent stale responses from replacing the latest selected filter/page.

## Acceptance examples

- Given mixed statuses for the current member, selecting `denied` displays only
  that member's denied claims and counts only those claims.
- Given three matching claims and a page size of two, page one contains two,
  page two contains one, and page three is empty with total 3 and totalPages 2.
- Given no matching claims, the filter remains available and navigation is
  disabled; the API reports zero totals.
- Given an invalid status, a repeated parameter, or page size 101, the API returns
  a generic 400.
- Given two members, changing context never exposes the other's results or totals.

## Exclusions

Refills, appeals, mutations, storage, external APIs, deployment, hosted workflows,
parallel orchestration, broad refactoring, new dependencies, and `lab-guide`.

## Evidence

Focused API tests, existing regression checks, browser acceptance, read-only
review findings, and a human acceptance decision. Generated prose alone is not
evidence that the implementation works.
