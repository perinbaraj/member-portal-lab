# 3. Specify: adapt the reference into an active feature

[Previous: initialize and constitution](02-initialize-and-constitution.md) ·
[Core roadmap](../core.md) · [Workshop home](../README.md) ·
[Next: plan and tasks](04-plan-and-tasks.md)

## Purpose and prerequisites

Establish the feature's active Spec Kit scaffold, then review the intended
behavior before any implementation. Finish
[initialization and constitution review](02-initialize-and-constitution.md).
Keep the [reference specification](../reference/spec.md) and
[acceptance contract](../acceptance.md) open.

The default core is **reference-grounded generation**: `/speckit-specify` reads
both documents and adapts the reference into the active feature. Do not manually
copy a file into an arbitrary `specs` folder; that can omit active-feature state
or the required checklist. See [reference guidance](../reference/README.md).

## Actions

1. **Editor — read the reference as a draft, not an approval.** Compare
   [reference/spec.md](../reference/spec.md) with
   [acceptance.md](../acceptance.md). Locate user stories, edge cases,
   requirements, and success criteria. The contract is authoritative if an
   example disagrees. In particular, distinguish empty matches from a page beyond
   the last page, and member-scoped totals from a count across all members.

   The specification describes behavior; the next checkpoint makes endpoint,
   query-parameter, library, and file-level decisions.

2. **Copilot Chat — create the scaffold and adapted specification together.**
   Select `/speckit-specify` from Chat completion, then submit:

   ```text
   /speckit-specify
   Read workshops/reference/spec.md AND workshops/acceptance.md before writing.
   As a signed-in member, I want to filter my claims by status and navigate
   results so I can find relevant claims without seeing another member's data.
   Use the reference specification as the starting draft and acceptance.md
   as the binding behavior contract. Adapt the reference to this existing
   application and the reviewed constitution; do not start a second blank-page
   specification or copy example headers/placeholders unchanged.
   Use the normal Spec Kit feature-creation workflow to establish the ACTIVE
   feature directory/state and its requirements checklist. Write the adapted
   spec.md there. Keep it behavior-focused; implementation design comes later.
   Exclude optional workshops and unrelated features. Do not implement,
   change application code, alter permissions, commit, or push.
   Report the exact active feature directory, specification and checklist
   paths, unresolved questions, and any assumptions for human review.
   ```

   Approve only bounded artifact-generation operations. The current skills use
   active feature state rather than requiring a Git feature branch; stay on
   your learner branch. No Git extension is required.

3. **Editor and terminal — verify the active handoff.** Record the exact
   directory reported by the skill; use that same directory throughout the
   remaining checkpoints. Inspect Explorer and Source Control, then run:

   ```text
   git branch --show-current
   git status --short
   ```

   Expect an active feature under `specs`, containing `spec.md` and
   `checklists\requirements.md`, plus active-feature state in `.specify`.
   Inspect `.specify\feature.json` to confirm it points to the intended feature.
   Do not invent a numbered directory or infer the active feature from the Git
   branch name. Generated headers must describe the actual feature and date,
   not an example branch or an instruction such as "set when you adopt it."

   If a feature already exists, inspect/resume it rather than creating a second
   feature to hide a partial result.

4. **Copilot Chat — resolve one bounded clarification round if needed.** The
   skill may ask up to three questions. Answer from
   [acceptance](../acceptance.md); do not add requirements to make an ambiguity
   disappear. If the artifact still has unresolved questions, use:

   ```text
   /speckit-clarify
   Read the active claims-filter specification and workshops/acceptance.md.
   Resolve only ambiguities in this bounded requirement using that contract.
   Do not expand scope, weaken privacy or validation, or implement anything.
   If the contract cannot answer a question, identify it for human resolution.
   ```

   This is a repair of the same specification, not another generation path.

5. **Editor — review and correct the active `spec.md`.** Check the generated
   stories and requirements against the contract:

   - All five existing statuses, default All statuses, and usable empty matches.
   - Default/maximum page sizes, totals, stable order, and out-of-range pages.
   - Generic rejection of malformed, empty, repeated, or unsupported inputs.
   - Authentication and member isolation before filtering, totals, and slicing.
   - Accessible controls, loading/error/empty states, page-one reset on status
     change, and protection against stale responses.
   - Small-page-size browser demonstration with existing synthetic fixtures.
   - No unrelated route or feature work, infrastructure, packages, or PHI logs.

   Inspect the existing [claim types](../../src/types.ts),
   [route](../../server/server.ts), and [member-scoped helper](../../server/data.ts)
   when a generated assumption about the starter seems wrong. Do not change
   those source files at this checkpoint.

6. **Editor — complete the requirements checklist honestly.** Open the active
   `checklists\requirements.md`. Resolve unchecked items by correcting the
   specification and re-evaluating the checklist, not by ticking boxes over
   missing behavior. Remove template placeholders and unresolved
   `[NEEDS CLARIFICATION]` items. Record that a human has reviewed the spec.

## Expected output and checkpoint decision

There is **one identified active feature**, its adapted `spec.md`, and a complete
requirements-quality checklist. You can map its behavior to
[acceptance](../acceptance.md). Application code is unchanged.

**Proceed** when a human has corrected and reviewed the specification and all
requirements checklist items are genuinely satisfied. **Stop** for unresolved
behavior, a missing checklist, stale active-feature state, or unexplained scope.
`/speckit-implement` later checks checklist completeness; do not bypass that gate.

## Common blockers and nondestructive recovery

| Blocker | Recovery |
| --- | --- |
| Reference was ignored or has recovery/example prose in the active spec | Ask the same session to adapt the existing active spec from both required documents and remove placeholders. Review the result; do not create another feature. |
| A `spec.md` exists but active state or checklist is missing | Preserve it and ask the normal session to inspect the installed feature-creation helpers and finish the scaffold for this same feature with normal approvals. Use the facilitator if uncertain; copying more Markdown does not fix state. |
| Active state points elsewhere | Stop before planning. Have the session inspect and reconcile the intended existing feature and state; do not switch Git branches or blindly overwrite `.specify\feature.json`. |
| Questions exceed the contract | Ask the facilitator to resolve the requirement. Do not assume new infrastructure, fixture expansion, or a new member selector. |
| You are blocked on drafting | Use [reference guidance](../reference/README.md) to repair the same guided invocation. Do not skip the scaffold or human review to catch up. |

**Optional alternative, not additional core work:** participants choosing
independent specification generation may ask `/speckit-specify` to draft from
the user need and acceptance contract without using the reference as its starting
draft. Choose that route *instead of* action 2, not after it, and retain exactly
the same scaffold, checklist, and human review gates.

## Official resources

- [Spec Kit: active features and specification workflow](https://github.github.io/spec-kit/quickstart.html)
- [VS Code: invoke and inspect Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills)

[Previous: initialize and constitution](02-initialize-and-constitution.md) ·
[Workshop home](../README.md) · [Next: plan and tasks](04-plan-and-tasks.md)
