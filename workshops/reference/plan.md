# Reference implementation plan: claims filtering

Example only. Keep the existing architecture and dependencies.

## Approach

Extend the current list route with Zod-validated query parameters. Obtain claims
using the existing member-scoped helper, filter by status, compute metadata, then
slice the requested page. Update the typed client and ClaimsList consumer together.

## Files and changes

| File | Bounded change |
| --- | --- |
| `server\server.ts` | Query schema, generic 400 handling, filter/count/page response |
| `src\types.ts` | Query/page response types where needed |
| `src\services\httpClient.ts` | Encode optional filter/page parameters and retain metadata |
| `src\components\ClaimsList.tsx` | Filter/page state, labeled controls, fetch lifecycle, stale-response protection |
| `src\App.css` | Only necessary styles for the new controls |
| `tests\server.test.ts` | Default/filter/page/validation/auth/isolation coverage |

Preserve `getClaimsForMember` ownership semantics. Do not add another storage or
service abstraction when the change uses in-memory fixtures only.

## Compatibility and failure behavior

- Retain the existing `claims` property and update its current consumer.
- Do not alter other routes or feature components.
- Filter before paging and derive totals from the same member-scoped set.
- Reject malformed query values; do not accidentally coerce arrays to strings.
- Keep controls mounted for empty results and announce generic request errors.
- Reset paging on status change; ignore or cancel obsolete requests.

## Validation

Use Vitest/Supertest and isolated synthetic fixtures for meaningful page slices.
Run the existing test, backend typecheck, and build scripts. Complete the browser
checks in `workshops\acceptance.md`; do not claim frontend typechecking from the
backend-only TypeScript config or Vite transpilation.

## Handoff

Supply the approved artifacts, intended diff, and actual validation results to the
read-only workshop reviewer. Humans decide which findings to fix and whether to
accept the requirement.
