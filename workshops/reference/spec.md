# Feature Specification: Claims Status Filter and Pagination

> Starting content for the default guided review/adaptation route, not an approved
> active artifact. Run `/speckit-specify` grounded in this file to create the active
> feature scaffold and requirements checklist; review and correct the result.
> Keep generated active metadata rather than copying this reference header.
> The binding behavior contract is [acceptance](../acceptance.md).

[Workshop home](../README.md) · [Guided workflow](README.md) ·
[Specify checkpoint](../steps/03-specify.md) ·
[Plan and tasks checkpoint](../steps/04-plan-and-tasks.md)

**Feature Branch**: `workshop-claims` (illustrative learner branch, not an active
feature-directory identifier)

**Created**: Reference example; retain the generated date in the active specification.

**Status**: Draft

**Input**: User description: "As a signed-in member, I want to filter my claims by status and move through the results so I can find relevant claims without seeing another member's data. This is a bounded change to the existing application, not a rebuild."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter my claims by status (Priority: P1)

A signed-in member opens Claims, narrows the list to one claim status, and can return
to all statuses.

**Why this priority**: Finding the claims that need attention is the core member need
and is useful on its own.

**Independent Test**: As a member with claims in more than one status, pick a status and
confirm only matching claims appear; pick "All statuses" and confirm claims of every
status can be browsed.

**Acceptance Scenarios**:

1. **Given** a member with claims in several statuses, **When** the member opens Claims,
   **Then** a labeled status selector shows "All statuses" and the first page of that
   member's claims is listed.
2. **Given** the member selects a status, **When** results load, **Then** only claims with
   that status appear and the totals describe only those claims.
3. **Given** the member selects a status with no claims, **When** results load, **Then** an
   empty-state message appears and the selector stays available.

---

### User Story 2 - Navigate pages of results (Priority: P2)

A member moves through a long list page by page and always knows where they are.

**Why this priority**: Paging keeps long lists usable, but the filter alone is still a
useful first slice.

**Independent Test**: With a small page size, move forward and backward through one
member's claims and confirm the page contents, the totals, and the disabled boundary
controls.

**Acceptance Scenarios**:

1. **Given** no paging choice is made, **When** claims load, **Then** the first page shows
   up to 20 claims together with the total number of matching claims and pages.
2. **Given** more than one page of matches, **When** the member selects Next or Previous,
   **Then** the adjacent page appears, Previous is unavailable on the first page, and Next
   is unavailable on the last page.
3. **Given** the member changes the status while on a later page, **When** results load,
   **Then** the view shows page one of the filtered results.
4. **Given** the member changes the filter quickly, **When** an older request finishes
   after a newer one, **Then** the list still reflects the most recent selection.

---

### User Story 3 - Stay private and fail safely (Priority: P3)

Filtering and paging never expose another member's claims or counts, and malformed
requests are rejected without revealing internal details.

**Why this priority**: Privacy applies to every story, but it is proven through the
behaviors above rather than as a separate screen. Its P3 label does not defer privacy
or validation: these are prerequisites for every implementation slice.

**Independent Test**: Request claims as two different members and with malformed filter
and paging values; confirm separate results and a generic rejection.

**Acceptance Scenarios**:

1. **Given** two members, **When** each lists claims with the same filter and page,
   **Then** each sees only their own claims and totals.
2. **Given** an unknown status, an empty or repeated value, a non-whole or non-positive
   page or page size, or a page size above 100, **When** the request is made, **Then** it
   is rejected with a generic error and no adjusted results are returned.
3. **Given** a request with no sign-in identity, **When** claims are requested, **Then**
   access is denied as it is today.
4. **Given** a request for a page past the last page, **When** it is made, **Then** the
   response is an empty list that still reports the true totals.

### Edge Cases

- No claim matches the selected status: an empty list with zero totals, not an error.
- A page past the last page: an empty list with accurate totals; the page is not silently
  changed.
- A page size of exactly 100 is accepted; 101 is rejected.
- A claims request fails: the member sees loading feedback, then a generic error that is
  announced to assistive technology, and the filter stays available.
- Switching between synthetic members never mixes their results or totals.
- A valid small page-size choice in the development page address makes multiple pages
  visible with the starter fixtures; an invalid choice uses the default instead.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Members MUST see only their own claims, optionally narrowed to one of the
  five existing statuses.
- **FR-002**: Omitting the status MUST show all of the member's claims; the interface
  MUST NOT send a placeholder status for "All statuses".
- **FR-003**: Results MUST be paged: page 1 and 20 claims per page by default, with a
  maximum of 100 per page.
- **FR-004**: The member scope MUST be applied first, then the status filter, then
  paging; totals MUST describe the same scoped and filtered set.
- **FR-005**: Each response MUST keep the existing claims list and add the current page,
  page size, total claims, and total pages.
- **FR-006**: Claims MUST keep their existing order within and across pages.
- **FR-007**: Invalid input (unknown status; empty or repeated values; non-whole, zero,
  or negative paging; or a page size above 100) MUST be rejected with a generic error and
  MUST NOT be silently adjusted.
- **FR-008**: No matches, or a page past the last page, MUST return an empty list with
  accurate totals and MUST NOT change the requested page.
- **FR-009**: Requests without a sign-in identity MUST continue to be denied, and callers
  MUST NOT be able to choose another member. Missing authentication remains 401 when
  the existing development identity fallback is unset.
- **FR-010**: The claims view MUST provide a labeled status selector (default "All
  statuses"), Previous and Next controls that are disabled at the boundaries, and the
  first page after any filter change.
- **FR-011**: The view MUST show loading feedback, an empty-state message, and a generic
  error announced to assistive technology, and MUST ignore responses to outdated
  selections. The filter MUST remain available for empty results and errors; loading
  MUST NOT unnecessarily remove controls or disrupt keyboard operation.
- **FR-012**: The feature MUST NOT log member details, diagnoses, medications, or request
  or response bodies.
- **FR-013**: Existing behavior of other routes, the claim detail route, Profile, and
  Prescriptions MUST remain unchanged.
- **FR-014**: The claims view MUST accept the optional development page-address
  `pageSize` choice: a whole number from 1 to 100 requests that page size; any other
  value is ignored and uses the default of 20. This does not relax API validation.

### Key Entities

- **Claim**: A member's claim with an identifier, provider, service date, amount, and one
  of five statuses.
- **Claims page**: The ordered slice of a member's matching claims plus the current page,
  page size, total claims, and total pages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A member can reach any single-status view, and return to all statuses, in
  one selection.
- **SC-002**: In every tested combination of status and page, 0 claims belonging to
  another member are returned or counted.
- **SC-003**: Every invalid-input case in FR-007 is rejected with the same generic message
  and no adjusted results.
- **SC-004**: Changing the filter always shows the first page of the new results, and
  rapid changes never leave an outdated list on screen.
- **SC-005**: The test, typecheck, and build commands pass and a human records the browser
  acceptance result; generated prose alone is not evidence that the feature works.

## Assumptions

- The existing development sign-in mechanism identifies the member, and only synthetic
  data is used.
- The five existing claim statuses are final for this change, and claim detail behavior
  is not refactored.
- Out of scope: refills, appeals, any change that writes data, storage, external
  services, deployment, hosted workflows, broad refactoring, and new dependencies.
- Existing synthetic fixtures suffice: use a page size of 1 to demonstrate multiple
  pages, without changing fixtures or adding data exports.
- Human browser checks, reviewer finding decisions, and final acceptance are separate
  from agent-executable implementation tasks.
