# Optional workshop: appeal eligibility and an in-memory draft

**Follow-on work, outside the core and its buffer.** Start from your
[accepted claims-filter feature](../steps/06-review-and-accept.md).
Create a separate learner branch if you want to keep the core outcome unchanged.

This is a complete, bounded read-only-and-UI exercise, not an appeal-submission
system. No Redis, database, GitHub Actions, external service, or new package is
required. Use the existing app, Zod, React, and API test runner.

## Requirement

As a member viewing my own denied claim, I want to understand appeal eligibility
and compose a draft so I can prepare an appeal without submitting it.

## Behavior contract

- Add `GET /api/claims/:claimId/appeal-eligibility`.
- Validate the identifier with a route-level Zod schema matching the repository's
  synthetic claim-ID format; inspect existing fixtures instead of inventing it.
- Return `{ claimId, eligible, reasonCode }` for the member's claim.
- For this exercise only, a denied claim is eligible:
  `eligible: true, reasonCode: "DENIED_CLAIM"`.
- Other own-claim statuses return
  `eligible: false, reasonCode: "STATUS_NOT_ELIGIBLE"`.
- Missing authentication is 401, malformed identifiers are 400, unknown claims are
  404, and known foreign-member claims are 403. Use generic error messages.
- For cross-member attempts, log a generic security-event code without the claim
  ID, member ID, payload, or other sensitive details.
- Keep ownership enforcement in the backend. Do not rely on hiding a button.
- Do not weaken the existing member-scoped data helper. If ownership lookup needs
  a separate internal helper, make the route check ownership before returning data.
- Add an Appeal draft action for eligible claims. Use a labeled reason field,
  required trimmed content, and a maximum of 1,000 characters.
- Keep the draft only in React state. Do not send its contents over the network,
  put them in a URL, persist to storage, or log them.
- Opening a different claim, leaving the draft view, changing member context, or
  reloading discards the draft. Do not reuse another claim's draft.
- Label the action **Save draft in this view**, with an explicit notice that it
  is temporary and **does not submit an appeal**. Announce validation feedback.
- Do not implement POST/PUT/DELETE, actual submission, delivery, durable storage,
  business deadlines, legal eligibility, or a production medical-care workflow.

## Activity 1: specify and challenge assumptions

Use Spec Kit's `/speckit-specify` skill with the requirement and contract above.

```text
/speckit-specify
Specify appeal eligibility and an ephemeral UI draft for the existing Member
Portal. Treat workshops/optional/claim-appeals.md as the scope contract. No appeal
submission, mutation endpoint, persistence, external infrastructure, or new packages.
Identify ownership and draft-lifetime acceptance criteria.
Generate the specification only.
```

Review the specification yourself. Clarify the difference between an actual
appeal and a temporary draft; do not allow the agent to silently add submission.

**Checkpoint:** the spec contains denied/non-denied, foreign/unknown claim,
validation, and draft-clearing cases.

## Activity 2: plan and decompose

Use `/speckit-plan`, then `/speckit-tasks`:

```text
/speckit-plan
Plan the approved optional appeals exercise using the existing Express/Zod
backend, typed HTTP client, React components, and Vitest/Supertest. Add only the
read-only eligibility route and temporary UI draft. Keep the completed core
feature working. Include backend ownership checks, draft isolation, accessibility,
focused tests, and manual acceptance. Do not add dependencies or implement yet.
```

Your task list should separately cover the route/schema, ownership lookup,
typed API method, draft component/state lifecycle, API tests, and browser checks.

**Checkpoint:** no task provisions infrastructure or introduces a mutation route.

## Activity 3: implement and test

Run `/speckit-implement` on the approved tasks. Inspect the diff and run existing
test/build/typecheck commands.

Add focused API cases for:

- Own denied claim: eligible.
- Own non-denied claim: ineligible.
- Missing auth, malformed identifier, and nonexistent claim.
- Another member's claim: 403, generic error, and a PHI-free security event.
- Regression: existing claims filtering and pagination still work.

Do not assert exact production log prose or expose identifiers in test logs.
Use synthetic fixtures and restore all mocks.

Run `/speckit-converge`, review remaining in-scope tasks, and repeat implementation
and convergence until the approved feature converges with evidence.

## Activity 4: customize the reviewer and validate

Add a draft-isolation criterion to your reviewer, then request read-only review
against this optional spec and actual test evidence. Human judgment decides
which findings to fix.

Manually verify:

1. An eligible own claim opens a clearly labeled temporary draft.
2. Blank/whitespace and overlong reasons produce announced validation feedback.
3. A valid draft remains in the current view without making a submission request.
4. Switching claims/member, leaving the view, and reloading do not resurrect drafts.
5. Ineligible claims do not offer drafting, and direct foreign-claim requests fail.
6. Keyboard operation works and the core filter/page controls remain usable.

**Done:** the read-only eligibility contract, focused tests, temporary draft,
review, and human acceptance all pass. Actual appeal submission remains absent.

[Workshop home](../README.md) |
[Core acceptance contract](../acceptance.md)
