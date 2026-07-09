<!--
Sync Impact Report:
- Version Change: 1.0.0 -> 1.1.0
- Reason: Move operational Core Principles to AGENTS.md to avoid duplicating agent instructions.
- Modified Principles:
  * Core Principles now delegate to AGENTS.md.
- Added Sections:
  * Authority Model
- Removed Sections:
  * Inline detailed Core Principles duplicated in AGENTS.md
- Templates Status:
  ✅ plan-template.md: Constitution Check can use this file as the Spec Kit bridge
  ✅ spec-template.md: User stories and requirements unchanged
  ✅ tasks-template.md: Task organization unchanged
- Follow-up TODOs: None
-->

# Kazaguruma Transit Constitution

This file exists for GitHub Spec Kit compatibility. The operational source of truth for coding agents is `AGENTS.md`.

## Authority Model

Agents MUST read and follow `AGENTS.md` before planning or implementing changes. If this file and `AGENTS.md` conflict, `AGENTS.md` wins.

## Core Principles

Core Principles live in `AGENTS.md` under `## Core Principles`:

1. Clear Naming
2. Simple Logic
3. Structured Organization
4. Type Safety
5. Test-First Development
6. Accessibility & UX
7. Documentation & Comments

Spec Kit workflows should use these principles as constitution gates when creating `spec.md`, `plan.md`, and `tasks.md`.

## Technology Stack & Constraints

- **Framework**: Next.js 15 (App Router), React 19
- **Language**: TypeScript 5 strict mode
- **UI**: Tailwind CSS 4 + DaisyUI 5
- **Database**: SQLite + Prisma ORM
- **Testing**: Jest + React Testing Library
- **Distributed protocol**: Nostr (NIP-72, NIP-25)
- **Performance**: API response p95 should stay within 200ms where the existing architecture makes that measurable.
- **GTFS data**: GTFS import runs during the build/start chain.
- **External images**: External URL images may use `<img>` when Next.js `<Image>` is unsuitable.
- **Button styling**: If DaisyUI cupcake rounding fails, use `rounded-full dark:rounded-sm`.
- **Japanese text**: Ruby display uses the existing ruby text utilities/classes.
- **Security**: Preserve API rate limiting.

## Development Workflow

- Normal development branch: `dev`
- Release branch: `master`
- Feature work starts from `dev`
- Run the repository checks listed in `AGENTS.md` before treating a change as ready
- When using Spec Kit, create/update artifacts in this order: `spec.md`, `plan.md`, `tasks.md`, implementation, verification

**Version**: 1.1.0 | **Ratified**: 2026-01-13 | **Last Amended**: 2026-07-09
