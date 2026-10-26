# Member Portal — Starter Code

A lean healthcare member portal (Express API + React frontend) used as the base for lab exercises.

## Spec-driven workshop

The `spec-workshop` branch is an **unfinished learner starter**, not a completed
solution. Start with the [workshop guide](workshops/README.md).

- **Core:** one claims status-filter/pagination change, from Spec Kit specification
  through implementation, testing, a custom reviewer agent, and human acceptance.
  Designed for the 3-3.5-hour event; setup is prework.
- **Optional:** [multiple custom agents](workshops/optional/custom-agents.md) and
  [appeal eligibility and drafting](workshops/optional/claim-appeals.md).
  Neither is required to complete the core workshop.
- **Infrastructure:** local runtimes and development tools only. No Redis server,
  database, Docker, GitHub Actions, paid cloud resources, or external healthcare APIs.

Keep the existing `lab-guide` materials separate from this workshop.

## Quick Start

```bash
npm install
npm run dev
```

This starts:
- **API** on http://localhost:3000 (Express)
- **UI** on http://localhost:5173 (Vite + React, proxies `/api` to the backend)

## Test Members

| Member ID | Name            | Plan              |
|-----------|-----------------|-------------------|
| M-10001   | Sarah Johnson   | Gold PPO          |
| M-10002   | James Williams  | Silver HMO        |
| M-10003   | Maria Garcia    | Gold PPO          |

## API Endpoints

All `/api/*` routes require the `x-member-id` header.

```bash
curl -H "x-member-id: M-10001" http://localhost:3000/api/members/me
curl -H "x-member-id: M-10001" http://localhost:3000/api/claims
curl -H "x-member-id: M-10001" http://localhost:3000/api/prescriptions
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + UI concurrently |
| `npm run dev:api` | Backend only |
| `npm run dev:ui` | Frontend only |
| `npm run build` | Compile backend + build frontend |
| `npm test` | Run API tests |

## Project Structure

```
starter-code/
+-- server/          # Express backend
|   +-- server.ts    # Routes + middleware (single file)
|   +-- data.ts      # In-memory mock data
|   +-- types.ts     # TypeScript interfaces
+-- src/             # React frontend
|   +-- main.tsx     # Entry point
|   +-- App.tsx      # Main app component
|   +-- App.css      # Styles
|   +-- types.ts     # Frontend type definitions
|   +-- components/  # UI components
|   +-- services/    # API client
+-- tests/           # API tests (Vitest + Supertest)
+-- index.html       # Vite HTML entry
+-- package.json     # Single unified package
+-- tsconfig.json    # Backend TypeScript config
+-- vite.config.ts   # Frontend build config
```
