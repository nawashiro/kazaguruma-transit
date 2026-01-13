<!--
Sync Impact Report
Version: N/A (template) -> 1.0.0
Modified Principles:
- Template placeholder -> I. Readability Before Cleverness
- Template placeholder -> II. Domain Boundaries & Explicit Types
- Template placeholder -> III. Test-First Discipline (NON-NEGOTIABLE)
- Template placeholder -> IV. Accessibility & Japanese UX Fidelity
- Template placeholder -> V. Data Integrity & Operational Visibility
Added Sections:
- Architecture & Data Constraints
- Development Workflow & Quality Gates
Removed Sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ⚠ .specify/templates/commands/*.md (directory missing)
Follow-up TODOs:
- TODO(RATIFICATION_DATE): Original adoption date not found in repo history.
-->
# Kazaguruma Transit Constitution

## Core Principles

### I. Readability Before Cleverness
Code MUST be readable without mental decoding: clear names, small functions,
explicit control flow, and no surprising side effects. Prefer clarity over
micro-optimizations; remove dead code; avoid one-letter variables outside short
loops. Comments explain intent or constraints, not restated code. Rationale:
transit logic and discussion flows are safety-critical for users and require
fast onboarding and accurate reviews.

### II. Domain Boundaries & Explicit Types
Domain logic MUST live in `src/lib`, feature UI in `src/components/features`,
shared UI in `src/components/ui`, and routing/UI entrypoints in `src/app`.
All public data shapes MUST be explicitly typed (no implicit `any`), and API
contracts MUST be validated at boundaries. Rationale: strict boundaries keep
transit, Nostr, and evaluation logic auditable and prevent UI-layer coupling.

### III. Test-First Discipline (NON-NEGOTIABLE)
TDD is mandatory: write tests first, ensure they fail, then implement and
refactor. Use Jest + React Testing Library and place tests alongside features
in `__tests__` or `.test.ts(x)` files. Mock external services in `__mocks__/`
or `src/__mocks__/`. Rationale: correctness in route planning and discussion
permissions cannot be inferred by inspection alone.

### IV. Accessibility & Japanese UX Fidelity
All UI MUST be accessible: ARIA labels, keyboard navigation, focus states, and
semantic elements are required. Japanese text rendering MUST respect `ruby-text`
styling and layout, and user-facing copy MUST be clear and consistent with the
service context. Rationale: the app serves the public and must be usable by a
wide range of riders.

### V. Data Integrity & Operational Visibility
GTFS imports, Prisma schema changes, and Nostr protocol handling MUST be
versioned and validated; breaking changes require migration notes. Errors and
critical flows MUST be logged with enough context to debug route queries and
discussion moderation. Rationale: data drift or silent failures directly harm
user trust.

## Architecture & Data Constraints

- Next.js App Router source lives in `src/app`, with feature UI in
  `src/components/features` and shared UI in `src/components/ui`.
- Domain services stay under `src/lib` (transit routing, discussions,
  evaluation, Nostr integration).
- Prisma + SQLite are the source of truth for GTFS data; imports run via
  `scripts/import-gtfs.ts` during build/start.
- External images use `<img>` (not Next `<Image>`) when required by remote URL
  limitations.

## Development Workflow & Quality Gates

- Follow TDD: tests first, failing before implementation, then refactor.
- Quality gates: `npx tsc --noEmit`, `npm run lint`, `npm test`, and
  `npm run build` must pass before declaring work done.
- Reviews MUST confirm readability, accessibility, and data-boundary compliance.
- Use 2-space indentation, TypeScript-first patterns, and React function
  components with hooks.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

This constitution supersedes other guidance. Amendments require updating this
file, a rationale in the change description, and a version bump per semver:
MAJOR for incompatible principle changes, MINOR for new principles/sections,
PATCH for clarifications. Each plan/spec MUST include a constitution check, and
reviews MUST verify compliance. Runtime guidance lives in `AGENTS.md` and
`CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): Original adoption date not found in repo history. | **Last Amended**: 2026-01-13
