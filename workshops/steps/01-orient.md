# 1. Orient: inspect before changing

[Previous: prework](../prework.md) · [Core roadmap](../core.md) ·
[Workshop home](../README.md) · [Next: initialize and constitution](02-initialize-and-constitution.md)

## Purpose and prerequisites

Understand the running claims flow before asking an agent to change it. Complete
[prework](../prework.md): the repository is open at its root in VS Code,
dependencies and approved tools are installed, and baseline checks have run.
Use your own checkout based on `spec-workshop`; do not modify a shared preparation
checkout. No Spec Kit initialization is needed yet.

The [acceptance contract](../acceptance.md) defines the one change. Keep it open
beside these instructions. Refills, appeals, storage, external services,
deployment, and broad refactoring are outside this core.

## Actions

1. **Terminal — establish your starting point.** In a VS Code terminal at the
   repository root, run:

   ```text
   git rev-parse --show-toplevel
   git branch --show-current
   git status --short
   ```

   Confirm this is your workshop checkout based on `spec-workshop` (or the learner
   branch prepared from it). Record any existing edits before continuing. A clean
   status produces no lines; existing edits are not permission to discard work.

2. **Terminal, then browser — inspect the starter.** In a development terminal:

   ```text
   npm run dev
   ```

   Wait for the API and Vite readiness messages, then open
   `http://localhost:5173`. Visit Profile, Claims, and Prescriptions using only
   the provided synthetic members. The starter Claims view lists the current
   member's claims but has no status filter or pagination controls. Do not
   implement missing refill or appeal routes.

   Keep this terminal available so you can stop your development processes with
   `Ctrl+C` before later API tests. On Windows, use `npm.cmd` instead of `npm`
   if the existing policy blocks npm's PowerShell shim; do not change the policy.

3. **Editor — trace only the relevant source.** Open:

   | Source | What to locate |
   | --- | --- |
   | [Repository instructions](../../.github/copilot-instructions.md) | Privacy, input validation, member isolation, and accessibility rules |
   | [API routes](../../server/server.ts) | Existing authentication middleware and `GET /api/claims` |
   | [Synthetic data helper](../../server/data.ts) | `getClaimsForMember` already restricts the collection to one member |
   | [Claims view](../../src/components/ClaimsList.tsx) | Fetch effect and loading/error/empty/list rendering |
   | [HTTP client](../../src/services/httpClient.ts) | Header context and current `getClaims()` return shape |
   | [UI types](../../src/types.ts) | Existing claim status union |
   | [API tests](../../tests/server.test.ts) | Vitest/Supertest conventions and current smoke coverage |

   The route currently responds with `{ claims }`; the client unwraps that into
   `Claim[]`. Adding metadata therefore needs a coordinated API/client/view
   change. Keep the existing member-scoped helper and fixture order.

4. **Copilot Chat — request an explanation, not edits.** In the normal Copilot
   session, submit:

   ```text
   Inspect the claims list flow and .github/copilot-instructions.md.
   Explain the existing API response, authentication/member scoping, typed
   client return value, UI consumer, and Vitest/Supertest test conventions.
   Read workshops/acceptance.md and identify only the source files needed
   for its claims status filter and pagination requirement.
   Distinguish current behavior from behavior we still need to implement.
   Do not edit files, run installation, initialize Spec Kit, commit, or push.
   ```

   Read the cited files yourself. Treat an agent's explanation as a starting
   point, not proof that the application does something.

5. **Editor — state the bounded change in your own words.** Compare the
   explanation with [acceptance](../acceptance.md). You should be able to explain:

   - Member scoping must precede filtering, totals, and page slicing.
   - The response retains `claims` and adds pagination metadata, so its consumer
     must change with it.
   - A labeled filter, usable paging controls, and loading/error/empty behavior
     are part of the change, not just a backend query.
   - Existing fixtures are sufficient: later checks use `pageSize=1` to show
     multiple pages rather than growing the data set.

## Expected output and checkpoint decision

You have a running starter, a known Git baseline, and an explanation tied to the
actual source and contract. **No feature code has changed.** Run
`git status --short` again if there is any doubt.

**Proceed** when you can describe the current route/client/view flow and the
scope boundary. **Stop** if the app or baseline checks do not work, the checkout
is wrong, or the agent has already started unrelated implementation.

## Common blockers and nondestructive recovery

| Blocker | Recovery |
| --- | --- |
| No app at the expected address | Inspect the development terminal and return to [prework](../prework.md). Use the actual Vite address only after confirming the API proxy works. |
| Port already in use | Stop only development processes you started, using their terminal's `Ctrl+C`. Ask the facilitator about an unknown owner; do not kill unrelated processes. |
| Existing edits or an unexpected file change | Inspect Source Control and preserve the work. Do not run reset/clean or restore a whole file to hide the difference. |
| Agent proposes a rebuild or new infrastructure | Decline the edit request and repeat action 4 with the bounded requirement. |
| Member label looks wrong after switching | Read the [starter quirks](../acceptance.md#starter-quirks-that-are-not-part-of-this-change). Identify the synthetic member by the returned claims and reopen Claims after a switch. |

## Official resources

- [VS Code: use Chat](https://code.visualstudio.com/docs/chat/chat-overview)
- [Spec Kit: spec-driven development quickstart](https://github.github.io/spec-kit/quickstart.html)

These explain the tools; the local acceptance contract remains the workshop's
requirement boundary.

[Previous: prework](../prework.md) · [Workshop home](../README.md) ·
[Next: initialize and constitution](02-initialize-and-constitution.md)
