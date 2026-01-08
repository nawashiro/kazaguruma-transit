<!--
Sync Impact Report
- Version change: N/A (template) -> 0.1.0
- Modified principles: Template placeholders -> I. Essential Rider Value; II. Type-Safe Code Quality; III. Test-First Discipline (Non-Negotiable); IV. Accessible, Consistent UX; V. Performance & Reliability Budgets
- Added sections: None (filled existing template sections)
- Removed sections: None
- Templates requiring updates:
  - updated .specify/templates/plan-template.md
  - updated .specify/templates/spec-template.md
  - updated .specify/templates/tasks-template.md
- Follow-up TODOs:
  - TODO(RATIFICATION_DATE): original adoption date not found in repo
-->
# Chiyoda Transit Demo Constitution

## Core Principles

### I. Essential Rider Value
This product MUST prioritize a single best route for Kazaguruma riders with the
minimum required inputs. New features MUST be justified by direct rider value and
MUST not introduce unrelated transit noise or complex multi-route output.

### II. Type-Safe Code Quality
All new code MUST use TypeScript with explicit types for API responses, forms, and
shared models in `src/types`. Implicit `any` is forbidden. `npm run lint` and
`npx tsc --noEmit` MUST pass with zero errors or warnings before merge.

### III. Test-First Discipline (Non-Negotiable)
Behavior changes MUST be driven by tests written before implementation using Jest
and React Testing Library. Follow red-green-refactor and keep tests independent
and user-journey focused. Any exception requires documented rationale in the
spec/plan and a compensating validation step.

### IV. Accessible, Consistent UX
User interfaces MUST follow WCAG 2.2 AA and WAI-ARIA guidance, with keyboard
navigation and meaningful labels for all interactive elements. Use Tailwind +
DaisyUI and the established component structure to preserve visual and behavioral
consistency across screens.

### V. Performance & Reliability Budgets
Each feature MUST define measurable performance targets (e.g., route search
latency, API response time, UI render time) in its spec and MUST not regress them.
Prefer simple, predictable algorithms; treat GTFS data as a cache and avoid heavy
queries in user-facing request paths.

## Quality & User Experience Standards

- Use 2-space indentation and keep modules small, focused, and typed end-to-end.
- UI components live in `src/components/ui`, features in `src/components/features`,
  and layouts in `src/components/layouts`.
- Accessibility checks are part of review; ARIA roles, labels, and focus order are
  required for new UI.
- UX copy and interaction patterns must remain consistent across pages.

## Development Workflow & Verification

- TDD flow: write failing tests, implement the minimum change, then refactor.
- Required checks before merge: `npm run lint`, `npx tsc --noEmit`, `npm test`.
- Run `npm run build` when changes touch Prisma, GTFS import, or production build
  behavior.
- Any deviation from this workflow must be recorded in the spec and reviewed.

## Governance

- This constitution supersedes other guidelines when conflicts exist.
- Amendments require updating this file, the Sync Impact Report, and related
  templates; versioning follows semver (MAJOR for breaking governance changes,
  MINOR for new or expanded rules, PATCH for clarifications).
- Every PR/review MUST include a constitution compliance check, with any waiver
  documented and approved in the feature spec.

**Version**: 0.1.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date not found in repo | **Last Amended**: 2026-01-09




