# Copilot Instructions — Member Portal

Ignore the lab-guide/* Directory — These instructions are for the entire member portal codebase, not just the lab exercises.

## Project Context
This is a full-stack healthcare member portal with a Node.js + Express BFF backend and a React 18 + TypeScript frontend. The portal handles member self-service operations: viewing prescriptions, requesting refills, checking claims, managing appointments, and prior authorizations.

## Architecture
**Backend (BFF):**
- **Runtime:** Node.js 20+ with Express
- **Language:** TypeScript (strict mode)
- **Auth:** OIDC session via existing member-portal identity provider (stubbed in labs with `x-member-id` header)
- **Downstream services:** pharmacy-service, claims-service, scheduling-service (REST APIs, OAuth 2.0)
- **Cache:** Redis for idempotency keys and session data

**Frontend (SPA):**
- **Framework:** React 18 with TypeScript
- **Bundler:** Vite
- **API Client:** Centralized service layer with typed fetch wrappers
- **Authentication:** Stores `x-member-id` in localStorage, includes in all API requests
- **Location:** `./src/` directory, runs on localhost:5173 in dev

## Mandatory Rules

### HIPAA Compliance
- NEVER log PHI (Protected Health Information): names, DOB, SSN, diagnosis codes, medication names
- Log member IDs only in hashed form in production
- All error messages must be generic — never expose internal data
- All endpoints must enforce member-context isolation (member A cannot see member B's data)

### Security
- Validate all inputs with Zod schemas at the route level
- Use parameterized queries (no string concatenation for data access)
- Return 403 for cross-member access attempts; log a security event (no PHI in log)
- All responses include security headers via Helmet

### Code Style
- **Backend:** One route file per domain (members, claims, prescriptions, appointments)
- Service layer abstracts external API calls
- All async operations use try/catch with typed error handling
- Tests required for happy path + auth failure + edge cases per endpoint
- **Frontend:** One component file per feature (MemberProfile, PrescriptionsList, etc.)
- Centralized API service layer (`src/services/api.ts`) for all HTTP calls
- All API methods use typed fetch wrappers matching backend response shapes
- Components use React hooks (useState, useEffect) for state and side effects
- CSS co-located with components or in global `App.css` with CSS variables

### Performance
- p95 API latency target: 500ms
- Use Redis idempotency keys for mutation endpoints (POST, PUT, DELETE)
- Pagination required for list endpoints (default: 20, max: 100)
- Frontend: p95 time-to-interactive < 2s, bundle size < 200KB gzipped

### Frontend Accessibility (WCAG 2.1 AA)
- All buttons and links must have accessible labels
- Use semantic HTML (not just `<div>` + CSS)
- Color contrasts must meet AA standards
- Form inputs must have associated `<label>` elements
- Error messages must be announced to screen readers
