# Member Portal Workshop Constitution

## I. One bounded brownfield change

Reuse the existing Express/TypeScript backend, React frontend, typed HTTP client,
in-memory fixtures, and Vitest/Supertest tests. The core feature is claims status
filtering with pagination. Do not rebuild the application, add infrastructure or
packages, or inspect/change lab-guide. Optional workshops have separate contracts
and are not conditions of core completion.

## II. Member isolation and privacy

Follow `.github/copilot-instructions.md`. Derive member context from the existing
authentication middleware. Scope data before filtering, counting, or pagination.
Use route-level Zod validation and generic errors. Log no PHI; never place real
member data or secrets in prompts, fixtures, or artifacts.

For the optional eligibility route, known cross-member attempts return 403 and
produce a generic security event without sensitive identifiers. Do not weaken
existing ownership helpers or depend on frontend visibility for authorization.

## III. Compatibility and accessibility

Preserve unrelated endpoints and UI behavior. Keep the existing claims property
when adding pagination metadata and update its typed consumer at the same time.
Use labeled semantic controls, accessible empty/loading/error feedback, and
announced errors. Avoid stale results and drafts crossing request/member contexts.

## IV. Evidence before acceptance

Add focused happy-path, authentication, ownership, validation, and edge-case tests
for the behavior introduced. Use the existing runner. Run the documented checks,
report their actual results, and manually verify the browser acceptance criteria.
Do not claim frontend typechecking from the backend-only TypeScript config.
Generation success or agent confidence is not verification.

## V. Explicit agent boundaries and human decisions

Review specifications, plans, tasks, code, and findings before accepting them.
The workshop reviewer is read/search only. Use the ordinary implementation session
for commands and accepted fixes. Retain normal tool permissions and approvals.
Do not commit, push, deploy, or expand scope without the participant's request.

## Dependency and workflow boundary

Use local runtimes and the bundled Spec Kit prompts/scripts. No Redis service,
database, Docker, GitHub Actions, external API, or cloud deployment is needed.
Do not add mutation endpoints: optional appeals are a read-only eligibility API
plus a draft held only in React state, with no submission or persistence.
This avoids introducing a mutation path that would require Redis idempotency
under the repository's existing rules.

## Governance

This constitution applies the existing repository rules to the approved workshop
scope; it does not replace or weaken them. Proposed scope or dependency changes
require human agreement. Keep feature-specific decisions in generated feature
artifacts, not in shared repository instructions.

**Version**: 1.0.0
