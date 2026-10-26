---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
    prompt: Break the plan into tasks
    send: true
  - label: Create Checklist
    agent: speckit.checklist
    prompt: Create a checklist for the following domain...
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

1. **Setup**: From the repo root, run `.\.specify\scripts\powershell\setup-plan.ps1 -Json` on Windows or `bash .specify/scripts/bash/setup-plan.sh --json` in Bash. Parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. Use the participant's shell without changing execution policy.

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Preserve shared repository instructions; keep feature context in feature artifacts
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after Phase 2 planning. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Resolve questions from local repository evidence**:

   Reuse the established architecture and dependencies. Do not dispatch research
   agents for already-decided technology choices. Ask the participant only about
   material unresolved behavior; do not invent integrations or expand the scope.

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Preserve repository context**:
   - Read `.github/copilot-instructions.md` and the supplied constitution
   - Do not run the agent-context updater or rewrite shared instruction files
   - Keep feature-specific context in this feature's plan and design artifacts

**Output**: data-model.md, /contracts/*, quickstart.md; no shared instruction changes

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
