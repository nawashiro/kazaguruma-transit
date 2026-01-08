# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] Scope aligns to Essential Rider Value (single best route, minimal inputs).
- [ ] Type safety plan covers typed API/forms and no implicit any.
- [ ] Test plan follows TDD with Jest/RTL; exceptions documented.
- [ ] UX plan covers WCAG 2.2 AA, ARIA, and DaisyUI/Tailwind consistency.
- [ ] Performance targets defined and measurable in spec.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
笏懌楳笏 plan.md              # This file (/speckit.plan command output)
笏懌楳笏 research.md          # Phase 0 output (/speckit.plan command)
笏懌楳笏 data-model.md        # Phase 1 output (/speckit.plan command)
笏懌楳笏 quickstart.md        # Phase 1 output (/speckit.plan command)
笏懌楳笏 contracts/           # Phase 1 output (/speckit.plan command)
笏披楳笏 tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
笏懌楳笏 models/
笏懌楳笏 services/
笏懌楳笏 cli/
笏披楳笏 lib/

tests/
笏懌楳笏 contract/
笏懌楳笏 integration/
笏披楳笏 unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
笏懌楳笏 src/
笏・  笏懌楳笏 models/
笏・  笏懌楳笏 services/
笏・  笏披楳笏 api/
笏披楳笏 tests/

frontend/
笏懌楳笏 src/
笏・  笏懌楳笏 components/
笏・  笏懌楳笏 pages/
笏・  笏披楳笏 services/
笏披楳笏 tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
笏披楳笏 [same as backend above]

ios/ or android/
笏披楳笏 [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

