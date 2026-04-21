# Census

Census is a form-builder and assessment app with:

- a React + Vite frontend
- a Bun server
- SQLite persistence via `bun:sqlite`
- Nostr-based admin authentication
- organizations, workspaces, forms, public form publishing, and analytics

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind, Framer Motion, Radix UI
- Backend: Bun server in `server/server.ts`
- Database: SQLite file at `server/do-the-other-stuff.sqlite`
- Auth: Nostr extension login and bunker login
- Tests: Vitest + Testing Library

## Prerequisites

- Node.js 24 or newer
- npm 11 or newer
- Bun 1.3 or newer

## Install

```bash
npm install
```

## Commands

```bash
npm run dev
```

Runs the Vite frontend and the Bun API server together.

- Frontend: `http://localhost:5173`
- API server: `http://localhost:3002`

```bash
npm run dev:client
```

Runs only the Vite frontend.

```bash
npm run dev:server
```

Runs only the Bun server on `http://localhost:3002`.

```bash
npm run typecheck
```

Runs TypeScript checking.

```bash
npm test
```

Runs the Vitest suite once.

```bash
npm run build
```

Builds the frontend into `build/`, which matches what the Bun server serves in production mode.

```bash
npm start
```

Starts the Bun server. It serves static assets from `build/` when present, otherwise from `public/`.

```bash
npm run start:local
```

Starts the Bun server with `PORT=3002` explicitly, which is useful in local environments that already export a different `PORT`.

## Runtime Notes

- Vite proxies `/api` requests to `http://localhost:3002` during frontend development.
- The Bun server listens on `PORT`, defaulting to `3002`.
- `npm run dev:server` and `npm run start:local` pin `PORT=3002` for stable local development.
- In Wingman-style hosted development, the Vite frontend uses the assigned `PORT` so the external proxy can reach the app.
- Sessions are stored in SQLite and use the `session_id` cookie.
- Session TTL is controlled by `SESSION_TTL_SECONDS`.
- Secure session cookies can be forced with `SESSION_COOKIE_SECURE=true`.
- AI form-spec generation uses OpenRouter when `OPENROUTER_API_KEY` is configured.
- `OPENROUTER_MODEL` is optional. If unset, the server currently defaults to `openai/gpt-4.1-mini`.

## Architecture

Request flow during development:

1. The browser talks to the Vite frontend.
2. Vite serves the React app and proxies `/api` requests to the Bun server.
3. The Bun server handles auth, forms, responses, leads, workspaces, and organizations.
4. Data is stored in SQLite through prepared statements in `server/services/*`.

Form flow model:

1. Form structure is stored as JSON schema in the `forms` table.
2. The builder edits that schema on the client.
3. Shared helpers in `shared/` define schema validation and runtime question flow.
4. Public forms and analytics both depend on the same flow rules for branching and terminal-step detection.

AI form generation model:

1. A plain-English markdown brief is submitted to the Bun server.
2. The server calls OpenRouter for structured `AiFormSpec` output.
3. Shared validation checks the generated `AiFormSpec`.
4. A deterministic compiler converts the validated AI spec into `FormSchemaV0`.
5. The resulting schema can then be persisted as a draft form through normal Census flows.

Current AI endpoint:

- `POST /api/ai/forms/spec`
  - auth required
  - input: `{ brief: string, model?: string }`
  - output: validated `AiFormSpec`, compiled `FormSchemaV0`, and resolved model name

Response model:

1. Responses are persisted incrementally as a user moves through a form.
2. Draft responses are stored with `completed = 0`.
3. Final submissions are stored with `completed = 1`.
4. Analytics use saved response metadata plus schema-aware terminal detection instead of numeric question ordering heuristics.
5. Server-side scoring is validated against submitted answers:
   - `yes/no` questions add weight only for `yes`
   - non-boolean question types add weight when a valid non-empty answer is present
6. Server-side submission validation enforces configured multiple-choice options, numeric min/max bounds, and date formats.

## Verification

The current baseline verification flow is:

```bash
npm run typecheck
npm test
npm run build
```

## Project Layout

```text
src/                         Frontend application
src/pages/                   App routes and screens
src/components/              Shared UI and auth components
src/data/                    Local seed form data and loaders
src/types/                   Shared frontend types
server/                      Bun server, routes, services, and SQLite setup
public/                      Static assets and embed script
build/                       Frontend build output
```

## Current Limitations

- The build is now split into route-level and library-level chunks, but there is still room for future performance tuning if the product grows materially.
