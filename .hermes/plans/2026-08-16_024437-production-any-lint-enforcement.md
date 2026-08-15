# Production `any` Lint Enforcement Implementation Plan

> **For Hermes:** Execute this plan task-by-task with a fresh implementation agent for each task. The parent agent owns sequencing, acceptance criteria, and final verification.

**Goal:** Make explicit `any` an ESLint error in runtime code, replace every existing runtime-code `any` on `dev` with an intentional type, and keep test-only flexibility as a warning.

**Architecture:** The ESLint flat configuration will use `error` as the default severity for `@typescript-eslint/no-explicit-any`, with a narrow warning override for tests and mocks. Runtime fixes will reuse dependency-provided types, add one shared declaration for the external Rubyful API, and use `Record<string, string>` for the dynamic CSV row instead of weakening the type system.

**Tech Stack:** TypeScript 5 strict mode, Next.js 15 App Router, React 19, ESLint 9 flat config, `@typescript-eslint`, `@nostr-dev-kit/ndk` 3.0.3, Jest, React Testing Library.

---

## Current context and scope

- `origin/dev` was fetched and `git pull --ff-only origin dev` completed with `Already up to date`.
- Refreshed base SHA: `56fb22055384a18d2d205f7f2229ff8c7f8c3534`.
- Work branch: `chore/strict-any-error`, created from `dev` at that SHA.
- Initial worktree was clean.
- Baseline checks on the refreshed base:
  - `npm run lint`: exit 0, with existing `@typescript-eslint/no-explicit-any` warnings plus unrelated warnings.
  - `npx tsc --noEmit`: exit 0.
  - `npm test -- --runInBand`: exit 0, 125 suites passed, 2 skipped; 676 tests passed, 17 skipped.
- Runtime scope is all code under `src` that is not a test file or `__tests__` file. `src/lib/test/test-data-loader.ts` is included because it is imported by runtime UI code for the documented test-mode route.
- Test-only explicit `any` usages, file-level suppressions, Jest matcher expressions such as `expect.any(String)`, and root test mocks are not part of the production replacement work. They must remain warning-level or outside the `next lint` target unless a configuration change accidentally promotes them.

## Existing `any` inventory and recommended fixes

| Location | Current use | Recommended fix | Risk and verification |
|---|---|---|---|
| `src/components/layouts/SidebarLayout.tsx:38` | Casts `window` to `any` to call the third-party `RubyfulV2.init` API. | Add a shared `Window.RubyfulV2` declaration with an explicit `init` options interface, then call `window.RubyfulV2?.init(...)`. | External script may be absent; keep the optional check. Verify sidebar tests, lint, and typecheck. |
| `src/components/ui/RubyWrapper.tsx:9` | `observe` is an untyped React effect dependency list. | Type it as `ReadonlyArray<unknown>` or React's `DependencyList`; preserve the existing dependency behavior. | No runtime behavior change intended. Verify UI tests and lint. |
| `src/components/ui/RubyWrapper.tsx:20` | Casts `window` to `any` only to detect Rubyful. | Reuse the shared `Window.RubyfulV2` declaration and access `window.RubyfulV2`. | Preserve the current no-op behavior when the script is unavailable. Verify UI tests and typecheck. |
| `src/lib/nostr/naddr-utils.ts:57` | Casts `nip19.decode(...).data` to `any` after a runtime `type === "naddr"` check. | Use the `nostr-tools/nip19`/NDK discriminated naddr type, preferably by narrowing the input with the library's naddr guard before decode, then use the narrowed `decoded.data`. | Preserve malformed/non-naddr rejection and the returned `AddressPointer` shape. Verify the existing naddr suite. |
| `src/lib/nostr/nostr-service.ts:918` | Builds an approval-event filter as `any`, even though this module already exports `Filter = NDKFilter<number>`. | Declare `const filter: Filter` and retain the existing optional `limit`/`until` assignments. | Dependency type already models all fields. Verify Nostr service tests and typecheck. |
| `src/lib/test/test-data-loader.ts:69,91` | Uses `any` as a temporary dynamic object while mapping CSV headers to values. | Use `Record<string, string>` for the intermediate row and retain the final `TestComment` boundary cast, or add a minimal validation helper if the agent finds the existing data contract requires it. | Keep CSV parsing/output behavior byte-for-byte equivalent. Verify discussion test-mode consumers and full tests. |

### Non-production inventory decision

The refreshed lint baseline reports 46 warning-level `Unexpected any` diagnostics in runtime and test files. Direct source inventory also finds three file-suppressed test `any` expressions and one root mock handler `any`. The test occurrences are concentrated in `src/**/__tests__/**`, `*.test.ts(x)`, and `__mocks__/`; they intentionally remain warning-level for this change. The ESLint override must make that boundary explicit so a future full ESLint invocation does not treat test doubles as production code. `expect.any(...)` matcher calls are not explicit TypeScript `any` and require no change.

## Implementation tasks

Each task is deliberately narrow. The assigned implementation agent must only modify the listed files, run the listed focused checks, and create one coherent commit. The parent agent will inspect the diff before dispatching the next task.

### Task 1: Make production explicit `any` an ESLint error

**Objective:** Change the default `@typescript-eslint/no-explicit-any` severity to `error` while keeping tests and mocks at `warn`.

**Files:**
- Modify: `eslint.config.mjs`

**Steps:**

1. Change the default rule severity from `warn` to `error`.
2. Keep the existing test override at `warn` and extend it only as needed to cover test mocks (`__mocks__`) without broadening the exception to runtime source.
3. Do not add a global disable or an inline suppression for any runtime file.
4. Run `npm run lint`; it is expected to fail at this intermediate checkpoint on the seven known runtime occurrences, while test occurrences remain warnings.
5. Run `git diff --check` and commit with the repository's short-prefix style, for example `chore: enforce explicit any in production code`.

**Acceptance criteria:** The default rule is `error`; test/mock files are explicitly warning-level; no unrelated lint rule changes are present.

### Task 2: Type the shared Rubyful browser API and SidebarLayout integration

**Objective:** Replace the `SidebarLayout` global `window as any` cast with a reusable declaration for the external Rubyful API.

**Files:**
- Create: `src/types/rubyful.d.ts`
- Modify: `src/components/layouts/SidebarLayout.tsx`

**Steps:**

1. Define the minimal Rubyful initialization options used by this application: selector, default display state, change observation, toggle button class, and on/off button text.
2. Declare `Window.RubyfulV2` as optional with an `init` method accepting those options; do not model unrelated third-party internals.
3. Replace `(window as any).RubyfulV2` with the typed optional property access.
4. Run `npx tsc --noEmit` and `npx jest src/components/layouts/__tests__/SidebarLayout.test.tsx --runInBand`.
5. Run `npm run lint -- --file src/components/layouts/SidebarLayout.tsx` if supported by the installed Next CLI, otherwise run `npm run lint` and record the known remaining runtime errors.
6. Run `git diff --check` and commit only the two assigned files.

**Acceptance criteria:** SidebarLayout compiles without an explicit `any`, the external API remains optional, and no runtime behavior or unrelated global declarations change.

### Task 3: Type RubyWrapper effect dependencies and Rubyful detection

**Objective:** Remove both explicit `any` usages from `RubyWrapper` without changing its effect timing or rendered output.

**Files:**
- Modify: `src/components/ui/RubyWrapper.tsx`

**Steps:**

1. Type `observe` as a React-compatible readonly dependency list (`ReadonlyArray<unknown>` or `DependencyList`).
2. Reuse the global Rubyful declaration from Task 2 for `window.RubyfulV2` detection.
3. Preserve the current `[...observe, delay]` dependency composition and the optional browser check.
4. Run `npx tsc --noEmit` and `npx jest src/components/ui --runInBand`.
5. Run `git diff --check` and commit only the assigned file.

**Acceptance criteria:** `RubyWrapper.tsx` contains no explicit `any`; existing behavior and effect dependencies are preserved; focused UI tests and typecheck pass.

### Task 4: Use the library's discriminated NIP-19 naddr type

**Objective:** Remove the unsafe decode-data cast while retaining all current naddr validation behavior.

**Files:**
- Modify: `src/lib/nostr/naddr-utils.ts`

**Steps:**

1. Inspect the installed `nostr-tools/nip19` type guard/overloads before editing.
2. Narrow the input to the library's `naddr1${string}` type (or use its exported naddr guard) before calling `nip19.decode`.
3. Keep the existing `decoded.type !== "naddr"` defensive check and error handling.
4. Read `identifier`, `pubkey`, `kind`, and `relays` from the narrowed decoded data without `any`.
5. Run `npx jest src/lib/nostr/__tests__/naddr-utils.test.ts --runInBand` and `npx tsc --noEmit`.
6. Run `git diff --check` and commit only the assigned file.

**Acceptance criteria:** Malformed input and non-naddr input still throw through the existing error path; all naddr tests pass; no explicit `any` remains in the file.

### Task 5: Use the existing NDK Filter alias for approval queries

**Objective:** Make the approval-event filter statically conform to the module's existing NDK filter contract.

**Files:**
- Modify: `src/lib/nostr/nostr-service.ts`

**Steps:**

1. Change only the local `getAdminApprovalEvents` filter declaration from `any` to the existing `Filter` alias.
2. Preserve the optional `limit` and `until` semantics and the downstream approval/dTag filtering.
3. Run `npx jest src/lib/nostr/__tests__/nostr-service.test.ts --runInBand` and `npx tsc --noEmit`.
4. Run `git diff --check` and commit only the assigned file.

**Acceptance criteria:** Approval queries still accept `kinds`, `authors`, `limit`, and `until`; focused tests and typecheck pass; no explicit `any` remains in the file.

### Task 6: Type dynamic CSV rows in test-mode data loading

**Objective:** Remove the two temporary `any` objects from the runtime-imported test-mode loader while preserving its CSV mapping behavior.

**Files:**
- Modify: `src/lib/test/test-data-loader.ts`

**Steps:**

1. Replace each temporary `any` row with `Record<string, string>` (or an equally narrow local type).
2. Keep header cleanup, value normalization, row order, and the existing `TestComment` conversion unchanged.
3. Run `npx tsc --noEmit`.
4. Run the focused consumers: `npx jest src/components/discussion/__tests__/DiscussionTabLayout.test.tsx src/components/discussion/__tests__/DiscussionContentDataProvider.test.tsx src/app/discussions/'[naddr]'/__tests__/page.test.tsx --runInBand`.
5. Run `git diff --check` and commit only the assigned file.

**Acceptance criteria:** Test-mode data loading returns the same typed domain objects, no explicit `any` remains in this runtime-imported module, and focused consumers pass.

### Task 7: Parent integration gate and final acceptance review

**Objective:** Confirm the complete branch satisfies the production-only lint contract and has no regressions.

**Owner:** Parent agent (not delegated for implementation).

**Steps:**

1. Inspect every agent commit and verify the changed-file boundary with `git diff --name-only dev...HEAD`.
2. Search runtime source with `rg -n --pcre2 '\bany\b|\bas\s+any\b|<any>' src --glob '!**/__tests__/**' --glob '!**/*.test.ts' --glob '!**/*.test.tsx'`; it must return no explicit TypeScript `any` in production code.
3. Run `npm run lint`; it must exit 0. Remaining warnings may include pre-existing hook/image warnings and test-only `any` warnings, but no runtime `Unexpected any` errors.
4. Run `npx tsc --noEmit`.
5. Run `npm test -- --runInBand` and record the aggregate counts.
6. Run `git diff --check`.
7. Run `npm run build` if the local GTFS/Prisma environment is available; if the build requires unavailable external data or mutates only ignored local artifacts, report that separately rather than masking it as a pass.
8. Re-read the final diff for behavior changes, accidental suppressions, broad type assertions, and unrelated files. The branch is complete only if all required checks pass and the acceptance criteria below are evidenced.

## Final acceptance criteria

- [x] `dev` was fetched/pulled at SHA `56fb22055384a18d2d205f7f2229ff8c7f8c3534` before the work branch was created.
- [x] Work is isolated on `chore/strict-any-error`; `dev` and the existing `chore/strict-any` worktree content were not modified.
- [x] `@typescript-eslint/no-explicit-any` is `error` for runtime code and remains `warn` only for explicitly scoped tests/mocks.
- [x] Runtime source has zero explicit `any` occurrences, including the runtime-imported `src/lib/test/test-data-loader.ts`.
- [x] Test-only `any` uses are not silently promoted to errors or hidden by new broad disables.
- [x] Existing behavior is preserved for Rubyful initialization/detection, naddr decoding, approval-event filtering, and CSV test-mode data.
- [x] `npm run lint`, `npx tsc --noEmit`, `npm test -- --runInBand`, `npm run build`, and `git diff --check` pass on the final worktree.
- [x] Any build limitation or unrelated pre-existing warning is reported explicitly.
- [x] No push, merge, or PR is claimed unless separately requested; this task delivers the local work branch and its verified commits.

## Execution record

- Implementation agents completed Tasks 1–6 in separate commits: `645ae20`, `1ffbe81`, `96cb49f`, `846b0da`, `70e7a14`, and `4083f54`.
- Final branch review found seven changed project files and no changed files outside the planned boundary.
- Final runtime explicit-`any` search returned no matches. Test/mock `any` remains warning-level by design.
- Final checks: `npm run lint` exit 0; `npx tsc --noEmit` exit 0; `npm test -- --runInBand` passed 125 suites / 676 tests with 2 suites / 17 tests skipped; `npm run build` exit 0; `git diff --check dev...HEAD` exit 0.
- `npm run check:no-nostr-tools` also passed. No push, merge, or PR was performed.

## Risks and fallback decisions

- The external Rubyful script is not typed by this repository. Keep the declaration minimal and optional; do not use `unknown` plus an ad-hoc cast at each call site.
- The NDK package currently exposes `NDKFilter<number>` and `nostr-tools` exposes a discriminated `DecodedNaddr`; use those dependency contracts instead of duplicating broad local shapes.
- The test CSV parser currently relies on known fixture headers. `Record<string, string>` removes the unsafe intermediate type without changing the existing final domain assertion; add validation only if the current fixture contract or typecheck demonstrates a concrete need.
- Do not fix unrelated hook/image warnings or rewrite all test mocks in this change. They are outside the requested production-only severity migration.
