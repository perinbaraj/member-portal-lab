<!--
Sync Impact Report
Version change: 0.0.0 -> 1.0.0
Modified principles:
- None -> I. Privacy-Safe Member Data Handling
- None -> II. Verified Member Context And Route Security
- None -> III. Accessible Member Experience By Default
- None -> IV. Performance Budgets Are Feature Requirements
- None -> V. Contracted Quality Gates Across Frontend And Backend
Added sections:
- Implementation Constraints
- Delivery Workflow And Review Gates
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ⚠ pending .specify/templates/commands/*.md (directory not present in this workspace)
Follow-up TODOs:
- None
-->

# Member Portal Constitution

## Core Principles

### I. Privacy-Safe Member Data Handling
Every backend route, frontend view, and supporting workflow MUST treat protected health
information as restricted data. PHI MUST NOT be written to logs, analytics, error payloads,
test fixtures intended for shared diagnostics, or client-visible telemetry. Production-safe
observability MUST use generic messages and hashed or surrogate member identifiers when an
identifier is required. Features that cannot demonstrate PHI-safe failure handling are not
ready for review.

Rationale: This portal operates in a healthcare context where accidental disclosure through
logs and diagnostics is a primary compliance risk.

### II. Verified Member Context And Route Security
All application behavior MUST execute inside an explicit member context derived from the
approved authentication mechanism, currently the `x-member-id` header in lab mode and the
portal identity provider in production architecture. Backend routes MUST validate inputs at
the boundary, enforce member isolation on every read and write, return 403 for cross-member
access attempts, and emit security events without PHI. Frontend code MUST use the centralized
typed API client and MUST NOT bypass member-context propagation.

Rationale: The core security failure for a member portal is data leakage across members, so
member-context enforcement must be systemic rather than feature-specific.

### III. Accessible Member Experience By Default
User-facing functionality MUST meet WCAG 2.1 AA for supported experiences. Semantic HTML,
keyboard accessibility, programmatic labels, screen-reader-announced error states, and
contrast-compliant visual design are release criteria rather than polish work. Accessibility
acceptance scenarios MUST be present in specifications for any feature that adds or changes UI.

Rationale: Members depend on the portal for essential healthcare tasks, so accessibility is a
functional requirement with direct user impact.

### IV. Performance Budgets Are Feature Requirements
Each feature MUST preserve or improve the system performance budget. Backend work MUST be
designed to keep API p95 latency below 500 ms for the affected route class. Frontend work MUST
be designed to keep first contentful paint below 1.5 seconds for the affected experience in the
target environment. Plans and tasks MUST include the caching, pagination, payload shaping,
rendering, or loading strategies needed to stay within budget.

Rationale: Member self-service flows lose trust quickly when core journeys feel slow, and
performance regressions are cheaper to prevent during design than after release.

### V. Contracted Quality Gates Across Frontend And Backend
Every change MUST be specified, implemented, and validated as a full-stack slice when it
touches user journeys. Backend work MUST include route-level validation, typed error handling,
and tests for happy path, auth failure, and relevant edge cases. Frontend work MUST use typed
service wrappers, feature-local components, and explicit loading and error states. No feature is
complete until the affected code paths have executable validation appropriate to the change.

Rationale: This repository is intentionally full-stack, so quality gates must cover both the BFF
and the React client rather than allowing one side to drift.

## Implementation Constraints

- The mandated stack is React 18 with TypeScript on the frontend and Node.js with Express on the
	backend BFF.
- Backend route boundaries MUST validate request data with Zod and preserve Helmet-backed
	security headers.
- Service integrations MUST live behind backend service abstractions and frontend typed fetch
	wrappers rather than ad hoc network calls.
- Mutation endpoints MUST plan for idempotency support, and list endpoints MUST define
	pagination defaults and maximums.
- Shared development artifacts MUST not rely on lab-guide content as a source of truth for
	production behavior.

## Delivery Workflow And Review Gates

- Specifications MUST describe user stories, edge cases, privacy constraints, accessibility
	expectations, security implications, and measurable performance outcomes for both frontend and
	backend impact.
- Implementation plans MUST fail the Constitution Check unless they show how the feature avoids
	PHI logging, preserves member isolation, meets WCAG 2.1 AA expectations, and stays within the
	500 ms API p95 and 1.5 s FCP budgets.
- Task lists MUST include work for validation, accessibility checks, security enforcement, and
	performance verification whenever those concerns are affected by the feature.
- Reviews MUST reject features that defer compliance-critical behavior into unspecified follow-up
	work.

## Governance

This constitution overrides conflicting local habits and template defaults for the member portal
repository. Amendments require an updated constitution file, a clear Sync Impact Report,
propagated template changes for any affected workflow artifacts, and reviewer agreement that the
version bump matches the scope of governance change. Semantic versioning applies to this
document: MAJOR for incompatible governance changes or removed principles, MINOR for new
principles or materially expanded obligations, and PATCH for clarifications that do not change
expected behavior. Compliance review is mandatory during planning, implementation review, and any
release readiness check for affected features. Runtime development guidance in `.github/copilot-
instructions.md` and repository templates MUST remain aligned with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-06-04 | **Last Amended**: 2026-06-04
