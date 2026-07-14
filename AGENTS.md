# Repository Guidelines

1. Be extraordinarily skeptical of your own correctness or stated assumptions. You aren't a cynic, you are a highly critical thinker and this is tempered by your self-doubt: you absolutely hate being wrong but you live in constant fear of it
2. When appropriate, broaden the scope of inquiry beyond the stated assumptions to think through unconvenitional opportunities, risks, and pattern-matching to widen the aperture of solutions
3. Before calling anything "done" or "working", take a second look at it ("red team" it) to critically analyze that you really are done or it really is working

## TDD

Follow TDD principles. First, write the tests. Avoid writing tests for things that don't exist in the specification (e.g., don't create a test for "the administrator role does not exist"). Ensure all tests pass. If something is known to work, you may remove overly complex tests that fail. Run syntax check, lint, test, and build; fix errors until none remain.

## Core Principles

These principles are the operational source of truth for agents working in this repository. `.specify/memory/constitution.md` exists for GitHub Spec Kit compatibility and should point back here instead of duplicating these rules.

### Clear Naming

- Names must express intent and behavior. Prefer names like `findNearestStop()`, `canApprovePost()`, and `isDbInitialized`.
- Boolean values should start with `is`, `can`, or `has`.
- Function names should use action verbs, such as `calculateDistance()`, `formatTime()`, and `validateInput()`.
- Use domain language for business logic (`Discussion`, `Evaluation`, `Transit`) and avoid mixing it with incidental technical wording.
- Avoid nonstandard abbreviations. Use `user` instead of `usr`, and `message` instead of `msg`.

### Simple Logic

- Keep functions single-purpose and small.
- Use guard clauses and early returns to reduce nesting.
- Avoid more than three nested control-flow levels; extract functions when logic gets deeper.
- Replace magic numbers with named constants such as `RATE_LIMIT_WINDOW_MS` or `WALKING_SPEED_KM_H`.
- Extract complex conditions into named predicates such as `isTimeInRange()` or `isActiveService()`.

### Structured Organization

- Keep UI, service, and data layers separate. UI components must not access the database directly.
- Put shared types in `src/types/` and avoid duplicate local type definitions.
- Component files use PascalCase. Services and utilities use kebab-case. Tests use `*.test.ts(x)` or `__tests__/`.
- Place related code close together, but keep reusable domain behavior in `src/lib`.

### Type Safety

- Preserve TypeScript strictness.
- Avoid `any`; use `unknown` plus type guards when the shape is not known.
- Prefer explicit interfaces for object shapes and public API payloads.
- Use discriminated unions where a `type` field drives behavior.
- Distinguish `null` from `undefined` deliberately.

### Test-First Development

- Write tests before implementation when changing behavior.
- Test only behavior that exists in the specification or user request.
- Keep tests readable and scenario-oriented.
- Run typecheck, lint, tests, and build before marking work complete.

### Accessibility & UX

- Interactive UI needs appropriate accessible names and states, such as `aria-label`, `aria-pressed`, and `aria-expanded`.
- Mobile touch targets should be at least 44px by 44px where practical.
- Pages and user-facing workflows need loading and error states.
- Error messages should be understandable Japanese where users see them.
- Preserve responsive behavior across desktop, tablet, and mobile.

### Documentation & Comments

- Code should be self-documenting; comments explain why, not what.
- Add JSDoc for public APIs, complex functions, and non-obvious types.
- Note concrete WCAG references when implementing accessibility-specific behavior.
- Explain workarounds and `@ts-expect-error` usage.
- Delete unused code instead of commenting it out. Git keeps the history.

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
- DaisyUIの実装・置換では、導入済みの公式DaisyUI Skill/Plugin（`saadeghi/daisyui`、`daisyui@daisyui`）を必ず参照し、その指示に従う。Skill/Pluginが利用できない場合に限り、使用するコンポーネントの公式ドキュメント（https://daisyui.com/components/）を確認し、現行バージョンのクラス名・構造・アクセシビリティ要件に従う。
- Use 2-space indentation to match existing files; avoid implicit `any` (ESLint warns). Follow Next.js `core-web-vitals` rules; run `npm run lint`.
- Favor explicit types for API shapes and Prisma results; keep transit/discussion services encapsulated under `src/lib`.
- Do not repeat a page's active tab as a main heading. In selectable user cards, put a checkbox after the identity/content and give its visible purpose (for example, `許可` or `削除`) next to it; its accessible name must include the target user.
- DaisyUI action buttons use `rounded-full dark:rounded-sm`; put Japanese button text inside a child `<span className="ruby-text">` rather than applying `ruby-text` to the button itself, so Tailwind spacing does not interfere with ruby rendering.

## Testing Guidelines

- Jest with React Testing Library; run `npm test` for full suite or `npm test:watch` while iterating.
- Place tests alongside features in `__tests__` directories or `.test.ts(x)` files; mirror component or service names (e.g., `RoutePdfExport.test.tsx`).
- Mock external calls in `__mocks__/` or `src/__mocks__/`; prefer RTL queries by role/label to preserve accessibility.

## Commit & PR Practices

- Follow the existing short-prefix style (`add: ...`, `fix: ...`, `chore: ...`); keep messages imperative and scoped.
- Commit at appropriate, coherent milestones so completed work is recoverable and reviewable; do not leave a finished task uncommitted without a concrete reason.
- For PRs, include: what changed, why, and how to verify (commands/steps). Attach screenshots for UI tweaks and call out DB schema or GTFS data impacts.
- Run `npm run lint` and `npm test` before requesting review; note any skipped checks or follow-up tasks in the PR description.

## Active Technologies
- TypeScript 5 strict、React 19、Next.js 15 App Router + Tailwind CSS 4、DaisyUI 5、Jest、React Testing Library、既存のNostr gateway/service、Puppeteer、Google Maps Services (013-ui-kiss-maintenance)
- 新規永続化なし。既存のNostr relay、sessionStorage、SQLite/Prismaを変更せず利用する (013-ui-kiss-maintenance)
- TypeScript 5 strict、React 19、Next.js 15 App Router + Tailwind CSS 4、DaisyUI 5、既存のNostr gateway/service、Prisma/SQLite、Jest、React Testing Library (014-deferred-page-responsibility-split)

- TypeScript 5, React 19, Next.js 15 (App Router) + DaisyUI 5, Tailwind CSS 4, webpack-license-plugin（導入パッケージライセンス収集）, Prisma（既存） (005-license-page-autogen)
- 既存SQLite（本機能では新規永続化なし）、`package.json`、オープンデータ用JSONファイル (005-license-page-autogen)
- TypeScript 5.x (strict), React 19, Next.js 15 App Router + `@nostr-dev-kit/ndk`, `nosskey-sdk`, DaisyUI 5 + Tailwind CSS 4, Prisma/SQLite（既存） (008-document-discussion-spec)
- Nostr relay群（イベント本体）、ブラウザローカル（Passkey/PWKキャッシュ）、SQLite（GTFS等既存アプリデータ） (008-document-discussion-spec)
- TypeScript 5 strict, React 19, Next.js 15 App Router + `@nostr-dev-kit/ndk`, DaisyUI 5, Tailwind CSS 4 (009-coracle-style-sync)
- Nostr relay（正本）、ブラウザ `sessionStorage`（暫定既知データとrelay実績）、SQLite/Prisma（対象外） (009-coracle-style-sync)
- TypeScript 5.x（strict） + Next.js 15、React 19、Tailwind CSS 4、DaisyUI 5 (010-ui-font-compliance)
- N/A（UI表示のみで永続データの変更なし） (010-ui-font-compliance)
- TypeScript 5 strict、React 19、Next.js 15 App Router + Tailwind CSS 4、DaisyUI 5、既存の認証コンテキスト、Nostrサービス、React Testing Library、Jest (011-discussion-edit-ux)
- N/A（本機能では新規永続化なし。既存の会話データ取得とブラウザ上の一時状態を利用） (011-discussion-edit-ux)
- TypeScript 5.x（strict） + Next.js 15 App Router、React 19、Tailwind CSS 4、DaisyUI 5、@nostr-dev-kit/ndk、nosskey-sdk (012-public-moderator-management)
- Nostrリレーが正本。ブラウザの既知データキャッシュは既存方針の範囲でのみ利用。新規永続ストレージなし。 (012-public-moderator-management)

## Recent Changes

- 005-license-page-autogen: Added TypeScript 5, React 19, Next.js 15 (App Router), DaisyUI 5, Tailwind CSS 4, and webpack-license-plugin based license aggregation
- 008-document-discussion-spec: Added TypeScript 5.x (strict), React 19, Next.js 15 App Router + `@nostr-dev-kit/ndk`, `nosskey-sdk`, DaisyUI 5 + Tailwind CSS 4, Prisma/SQLite（既存）
