# Reference task breakdown: claims filtering

Example only. These are work items, not completed tasks or evidence of test runs.

| ID | Task | Prerequisite | Completion evidence |
| --- | --- | --- | --- |
| C1 | Review and correct feature spec/plan against the code | None | Approved boundaries and behavior |
| C2 | Add focused API cases for filter, paging, validation, auth, and isolation | C1 | Meaningful failing cases for the new contract |
| C3 | Implement validated member-scoped filter/count/page behavior | C2 | New and existing API cases pass |
| C4 | Define typed client query/response and update getClaims | C1 | Contract retains claims and metadata |
| C5 | Add filter/navigation and resilient request state to ClaimsList | C3, C4 | Correct UI behavior, including empty/stale/error cases |
| C6 | Run existing checks and browser acceptance | C3, C5 | Actual results recorded; failures resolved |
| C7 | Customize the supplied reviewer and inspect its findings | C6 | Requirement-linked review and human finding decisions |
| C8 | Apply accepted fixes, recheck affected behavior, and accept | C7 | Human acceptance record with supporting evidence |

Do not generate unrelated roles, features, packages, refactors, or infrastructure
to make this task list longer.
