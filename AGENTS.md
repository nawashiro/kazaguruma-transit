# Repository Guidelines

1. Be extraordinarily skeptical of your own correctness or stated assumptions. You aren't a cynic, you are a highly critical thinker and this is tempered by your self-doubt: you absolutely hate being wrong but you live in constant fear of it
2. When appropriate, broaden the scope of inquiry beyond the stated assumptions to think through unconvenitional opportunities, risks, and pattern-matching to widen the aperture of solutions
3. Before calling anything "done" or "working", take a second look at it ("red team" it) to critically analyze that you really are done or it really is working

## TDD

Follow TDD principles. First, write the tests. Avoid writing tests for things that don't exist in the specification (e.g., don't create a test for "the administrator role does not exist"). Ensure all tests pass. If something is known to work, you may remove overly complex tests that fail. Run syntax check, lint, test, and build; fix errors until none remain.

## Project Structure & Modules
- Next.js App Router code lives in `src/app`; feature components sit in `src/components/features`, shared UI in `src/components/ui`, and helpers in `src/utils` and `src/types`.
- Domain logic is under `src/lib` (transit routing, discussions, evaluation, Nostr integration). Prisma schema and migrations reside in `prisma/`.
- Static assets are in `public/`, GTFS import scripts in `scripts/`, and docs in `docs/`.
- Tests follow the source layout inside `__tests__` folders or `.test.ts(x)` files (e.g., `src/components/features/__tests__/`).

## Development, Build, and Data
- `npm run dev`: start the app with Turbopack (prisma client is generated automatically).
- `npm run build`: generate Prisma client, push schema, import GTFS feeds, and build for production.
- `npm start`: production start after running the build chain.
- `npm run import-gtfs`: pull GTFS data using `scripts/import-gtfs.ts` (runs inside build/start).
- `npm run prisma:generate | prisma:migrate | prisma:studio`: manage the SQLite schema and inspect data.
- Create `transit-config.json` from `transit-config.json.example`, and add `.env.local` with at least `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_APP_URL`, and GA/discussion settings from the README.

## Coding Style & Naming
- TypeScript-first; prefer React function components and hooks. Keep files/module names in PascalCase for components (`IntegratedRouteDisplay.tsx`) and camelCase for utilities.
- Use 2-space indentation to match existing files; avoid implicit `any` (ESLint warns). Follow Next.js `core-web-vitals` rules; run `npm run lint`.
- Favor explicit types for API shapes and Prisma results; keep transit/discussion services encapsulated under `src/lib`.

## Testing Guidelines
- Jest with React Testing Library; run `npm test` for full suite or `npm test:watch` while iterating.
- Place tests alongside features in `__tests__` directories or `.test.ts(x)` files; mirror component or service names (e.g., `RoutePdfExport.test.tsx`).
- Mock external calls in `__mocks__/` or `src/__mocks__/`; prefer RTL queries by role/label to preserve accessibility.

## Commit & PR Practices
- Follow the existing short-prefix style (`add: ...`, `fix: ...`, `chore: ...`); keep messages imperative and scoped.
- For PRs, include: what changed, why, and how to verify (commands/steps). Attach screenshots for UI tweaks and call out DB schema or GTFS data impacts.
- Run `npm run lint` and `npm test` before requesting review; note any skipped checks or follow-up tasks in the PR description.

## Active Technologies
- TypeScript 5 + Next.js 15, React 19, Tailwind CSS 4, DaisyUI 5 (001-discussion-nav-tabs)
- SQLite + Prisma ORM (既存) (001-discussion-nav-tabs)

## Recent Changes
- 001-discussion-nav-tabs: Added TypeScript 5 + Next.js 15, React 19, Tailwind CSS 4, DaisyUI 5
