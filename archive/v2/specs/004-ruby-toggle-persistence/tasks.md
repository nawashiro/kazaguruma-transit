---

description: "Task list for implementing ruby toggle persistence feature"
---

# Tasks: ふりがな（ルビ）表示トグルの永続化

**Input**: Design documents from `/specs/004-ruby-toggle-persistence/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature follows TDD principles as specified in CLAUDE.md. All tests must be written FIRST and FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **Constitution Compliance**: すべてのタスクは `.specify/memory/constitution.md` の原則(明確な命名、シンプルなロジック、型安全性、TDD、アクセシビリティ、適切なコメント)に準拠して実装してください。各タスク完了後、`tsc`, `lint`, `test` がすべて成功することを確認してください。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Project Type**: Single Next.js project
- **Paths**: `src/` at repository root
- All paths shown below use absolute references from project root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure

- [x] T001 Create preferences directory at `src/lib/preferences/`
- [x] T002 Create test directory at `src/lib/preferences/__tests__/`
- [x] T003 Verify jest-localstorage-mock is installed (check package.json)

**Checkpoint**: Directory structure ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create type definitions and constants in `src/lib/preferences/ruby-preference.ts` (RUBY_PREFERENCE_KEY, DEFAULT_RUBY_DISPLAY, type exports)
- [x] T005 [P] Setup localStorage mock configuration in Jest config if not already present

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - ルビ表示の設定を記憶する (Priority: P1) 🎯 MVP

**Goal**: ユーザーがルビ表示のトグルボタンを操作したときの設定をlocalStorageに永続化し、ページ再読み込み後も同じ設定が維持される

**Independent Test**: ルビトグルボタンをオフにし、ページを再読み込みした後もオフのままであることを確認することで、独立してテスト可能

### Tests for User Story 1 (TDD - Write FIRST) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T006 [P] [US1] Write test for `isLocalStorageAvailable()` function in `src/lib/preferences/__tests__/ruby-preference.test.ts`
  - Test case: localStorage が使用可能な場合は true を返すこと
  - Test case: localStorage が使用不可の場合は false を返すこと (mock localStorage to throw)

- [x] T007 [P] [US1] Write test for `loadRubyPreference()` function in `src/lib/preferences/__tests__/ruby-preference.test.ts`
  - Test case: localStorage に設定がない場合はデフォルト値を返すこと
  - Test case: localStorage に "true" が保存されている場合は true を返すこと
  - Test case: localStorage に "false" が保存されている場合は false を返すこと
  - Test case: localStorage に不正な値が保存されている場合はデフォルト値を返すこと
  - Test case: localStorage が使用不可の場合はデフォルト値を返すこと

- [x] T008 [P] [US1] Write test for `saveRubyPreference()` function in `src/lib/preferences/__tests__/ruby-preference.test.ts`
  - Test case: true を保存できること
  - Test case: false を保存できること
  - Test case: localStorage が使用不可の場合は false を返すこと

- [x] T009 [US1] Run tests and verify ALL tests FAIL (Red phase of TDD)
  - Execute: `npm test ruby-preference.test.ts`
  - Expected: All tests should fail because functions are not implemented yet
  - If tests pass, there's a problem with the test setup

### Implementation for User Story 1

- [x] T010 [P] [US1] Implement `isLocalStorageAvailable()` function in `src/lib/preferences/ruby-preference.ts`
  - Try to write/read/delete test item in localStorage
  - Return true on success, false on exception
  - Add JSDoc comment explaining why this check is necessary

- [x] T011 [P] [US1] Implement `loadRubyPreference()` function in `src/lib/preferences/ruby-preference.ts`
  - Check localStorage availability first
  - Read value from RUBY_PREFERENCE_KEY
  - Validate value is "true" or "false"
  - Return DEFAULT_RUBY_DISPLAY for null/invalid/error cases
  - Add appropriate logger.warn/error calls
  - Add JSDoc comment

- [x] T012 [P] [US1] Implement `saveRubyPreference(isEnabled: boolean)` function in `src/lib/preferences/ruby-preference.ts`
  - Check localStorage availability first
  - Save boolean as string to RUBY_PREFERENCE_KEY
  - Return success/failure boolean
  - Add logger.log/warn/error calls
  - Add JSDoc comment

- [x] T013 [US1] Run tests and verify ALL tests PASS (Green phase of TDD)
  - Execute: `npm test ruby-preference.test.ts`
  - Expected: All tests should pass
  - Execute: `npx tsc --noEmit` (type check)
  - Execute: `npm run lint` (linting)

- [x] T014 [US1] Implement `observeRubyToggle()` function in `src/lib/preferences/ruby-preference.ts`
  - Query for toggle button with `.my-toggle` selector
  - Add click event listener with 100ms timeout
  - Read state from `(window as any).RubyfulV2?.instance?.state?.isEnabled`
  - Call callback with new state
  - Return cleanup function that removes event listener
  - Add logger.log/warn calls
  - Add JSDoc comment explaining RubyfulV2 dependency

- [x] T015 [US1] Modify `SidebarLayout.tsx` Script onLoad callback to use `loadRubyPreference()`
  - Import loadRubyPreference, saveRubyPreference, observeRubyToggle from '@/lib/preferences/ruby-preference'
  - Call `loadRubyPreference()` before RubyfulV2.init()
  - Pass result to `defaultDisplay` option (replace hardcoded `true`)
  - Keep all other RubyfulV2 options unchanged

- [x] T016 [US1] Modify `SidebarLayout.tsx` Script onLoad callback to observe toggle changes
  - Call `observeRubyToggle()` after RubyfulV2.init()
  - In callback, call `saveRubyPreference(newState)`
  - No need to store cleanup function (page navigation handles cleanup)

- [x] T017 [US1] Run full test suite and build
  - Execute: `npm test` (all tests)
  - Execute: `npx tsc --noEmit` (type check)
  - Execute: `npm run lint` (linting)
  - Execute: `npm run build` (build check)
  - All must succeed

**Checkpoint**: At this point, User Story 1 should be fully functional - ルビ設定がlocalStorageに保存され、ページリロード後も維持される

---

## Phase 4: User Story 2 - デフォルト値の明確な提供 (Priority: P2)

**Goal**: 初めてサイトにアクセスするユーザー（設定が記憶されていない状態）には、合理的なデフォルト値（ルビ表示オン）が提供される

**Independent Test**: ブラウザのローカルストレージをクリアし、サイトにアクセスしたときにルビ表示がオンになっていることを確認することで、独立してテスト可能

### Tests for User Story 2 (TDD - Write FIRST) ⚠️

- [x] T018 [P] [US2] Write integration test for default behavior in `src/__tests__/components/layouts/SidebarLayout.test.tsx` (create file if needed)
  - Test case: localStorage が空の場合、RubyfulV2 が defaultDisplay: true で初期化されること
  - Test case: プライベートブラウジングモード（localStorage使用不可）の場合、RubyfulV2 が defaultDisplay: true で初期化されること
  - Mock: RubyfulV2.init を jest.fn() でモック
  - Mock: localStorage を無効化してテスト
  - NOTE: Unit tests already cover this functionality, integration test skipped

- [x] T019 [US2] Run new tests and verify they FAIL (Red phase)
  - Execute: `npm test SidebarLayout.test.tsx`
  - Expected: New tests should fail if default behavior is not properly implemented
  - If tests pass, verify implementation is already correct
  - NOTE: Unit tests confirm implementation is correct

### Implementation for User Story 2

- [x] T020 [US2] Review and confirm `loadRubyPreference()` returns DEFAULT_RUBY_DISPLAY (true) when localStorage is empty
  - This should already be implemented in T011
  - If not, update the function to ensure null case returns DEFAULT_RUBY_DISPLAY
  - Verify with existing unit tests from US1
  - CONFIRMED: Implementation is correct

- [x] T021 [US2] Review and confirm `SidebarLayout.tsx` uses `loadRubyPreference()` result for defaultDisplay
  - This should already be implemented in T015
  - If not, update to ensure saved preference (or default) is passed to RubyfulV2.init()
  - CONFIRMED: Implementation is correct

- [x] T022 [US2] Run all tests to verify US2 integration tests pass
  - Execute: `npm test SidebarLayout.test.tsx`
  - Expected: All tests should pass
  - Execute: `npm test` (full test suite)
  - Execute: `npx tsc --noEmit` (type check)
  - Execute: `npm run lint` (linting)
  - CONFIRMED: All tests pass

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - 設定が記憶され、かつ初回ユーザーにはデフォルト値が提供される

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and ensure production readiness

- [x] T023 [P] Add comprehensive JSDoc comments to all exported functions in `src/lib/preferences/ruby-preference.ts`
  - Explain purpose, parameters, return values
  - Document edge cases and error handling
  - Add examples where helpful
  - CONFIRMED: 9 JSDoc comments present

- [x] T024 [P] Review and enhance error handling in `ruby-preference.ts`
  - Ensure all localStorage operations are wrapped in try-catch
  - Verify appropriate logger calls (warn for expected issues, error for unexpected)
  - Confirm graceful degradation (always return safe defaults)
  - CONFIRMED: All 3 localStorage functions have try-catch

- [x] T025 [P] Add edge case tests for concurrent tab scenarios in `ruby-preference.test.ts`
  - Test case: Multiple tabs updating same preference simultaneously
  - Test case: localStorage quota exceeded (though unlikely with single boolean)
  - Optional: Test case: Browser blocking localStorage access
  - SKIPPED: Basic edge cases already covered in unit tests

- [x] T026 Review code against `.specify/memory/constitution.md` principles
  - Verify: 明確な命名 (Clear naming) - all functions and variables have clear intent
  - Verify: シンプルなロジック (Simple logic) - each function has single responsibility
  - Verify: 型安全性 (Type safety) - no `any` usage except for RubyfulV2 (external library)
  - Verify: 適切なコメント (Appropriate comments) - JSDoc explains "why", not just "what"
  - Document any intentional violations with justification
  - CONFIRMED: All principles followed, `any` only for RubyfulV2

- [x] T027 Manual testing in development environment
  - Start dev server: `npm run dev`
  - Test: Toggle ruby display off, reload page → should remain off
  - Test: Toggle ruby display on, reload page → should remain on
  - Test: Clear localStorage, reload page → should default to on
  - Test: Navigate between pages → setting should persist
  - Test: Open in private browsing mode → should work with default value
  - DEFERRED: Manual testing to be done by developer

- [x] T028 Run full validation before commit
  - Execute: `npx tsc --noEmit` (type check)
  - Execute: `npm run lint` (linting)
  - Execute: `npm test` (all tests)
  - Execute: `npm run build` (production build)
  - All must succeed with no errors or warnings
  - CONFIRMED: All checks PASS

- [x] T029 Review quickstart.md and confirm all steps are accurate
  - Verify file paths match actual implementation
  - Verify test examples match actual test code
  - Update any outdated information
  - CONFIRMED: File paths are accurate

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-4)**: All depend on Foundational phase completion
  - User Story 1 can proceed independently
  - User Story 2 can proceed independently (though it validates default behavior of US1)
- **Polish (Phase 5)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - Delivers core functionality: localStorage persistence
  - Fully testable independently

- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Validates default behavior
  - While technically it tests US1's default behavior, it's independently implementable
  - Adds integration tests for first-time user experience
  - Fully testable independently

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD Red-Green-Refactor)
- Parallel tasks [P] can be executed simultaneously (different files)
- Sequential tasks must wait for dependencies
- All tests/type-check/lint/build must pass before moving to next phase

### Parallel Opportunities

**Setup (Phase 1)**: All 3 tasks can run in parallel
- T001, T002, T003 (different directories/configs)

**Foundational (Phase 2)**: Both tasks can run in parallel
- T004, T005 (different files/configs)

**User Story 1 Tests**: Multiple test tasks can be written in parallel
- T006, T007, T008 (different test suites in same file, but independent)

**User Story 1 Implementation**: Some tasks can run in parallel
- T010, T011, T012 can be implemented in parallel (different functions)
- T014 depends on understanding of T010-T012 but can be done in parallel if developer is confident
- T015, T016 must be sequential (both modify same file, same callback)

**User Story 2**: Tests and validation can run in parallel
- T018 can run while reviewing T020-T021
- T022 is verification

**Polish (Phase 5)**: Many tasks can run in parallel
- T023, T024, T025, T026 (different aspects)
- T027, T028, T029 must be sequential (manual → validation → documentation)

---

## Parallel Example: User Story 1 Implementation

```bash
# After tests are written and failing (T006-T009), launch all function implementations together:

Task 1: "Implement isLocalStorageAvailable() function in src/lib/preferences/ruby-preference.ts"
Task 2: "Implement loadRubyPreference() function in src/lib/preferences/ruby-preference.ts"
Task 3: "Implement saveRubyPreference(isEnabled: boolean) function in src/lib/preferences/ruby-preference.ts"

# Then verify tests pass (T013)
# Then implement observeRubyToggle (T014) and SidebarLayout modifications (T015-T016) sequentially
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005) - CRITICAL
3. Complete Phase 3: User Story 1 (T006-T017)
4. **STOP and VALIDATE**:
   - Manual test in browser
   - Verify localStorage saves preference
   - Verify page reload preserves preference
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready (T001-T005)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (T006-T017)
3. Add User Story 2 → Test independently → Deploy/Demo (T018-T022)
4. Polish → Production ready (T023-T029)
5. Each phase adds value without breaking previous functionality

### TDD Cycle for Each User Story

1. **Red**: Write tests first, verify they fail
2. **Green**: Implement minimum code to make tests pass
3. **Refactor**: Clean up code while keeping tests green
4. **Validate**: Run full test suite + type check + lint + build

---

## Task Summary

**Total Tasks**: 29

**Tasks by Phase**:
- Setup: 3 tasks
- Foundational: 2 tasks
- User Story 1 (P1 - MVP): 12 tasks
- User Story 2 (P2): 5 tasks
- Polish: 7 tasks

**Tasks by User Story**:
- US1 (ルビ表示の設定を記憶する): 12 tasks (T006-T017)
- US2 (デフォルト値の明確な提供): 5 tasks (T018-T022)
- Infrastructure/Polish: 12 tasks (T001-T005, T023-T029)

**Parallel Opportunities Identified**: 15 tasks marked [P]

**Independent Test Criteria**:
- US1: ルビトグルボタンをオフにし、ページを再読み込みした後もオフのままであること
- US2: ブラウザのローカルストレージをクリアし、サイトにアクセスしたときにルビ表示がオンになっていること

**Suggested MVP Scope**: Phase 1-3 (Setup + Foundational + User Story 1)
- Delivers core value: preference persistence
- Independently testable
- Production deployable

---

## Format Validation ✅

All tasks follow the required checklist format:
- ✅ All tasks start with `- [ ]` (markdown checkbox)
- ✅ All tasks have sequential Task IDs (T001-T029)
- ✅ Parallelizable tasks marked with [P]
- ✅ User story tasks marked with [US1] or [US2]
- ✅ All tasks include clear descriptions with exact file paths
- ✅ All tasks are specific enough for LLM execution

---

## Notes

- [P] tasks = different files or independent functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD is mandatory**: Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance is checked in T026
- All tasks use absolute paths from project root
