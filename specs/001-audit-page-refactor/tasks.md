# Tasks: 監査ページリファクタリングと表示不具合修正

**Input**: Design documents from `/specs/001-audit-page-refactor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDDアプローチに基づき、各フェーズにテストタスクを含む。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

> **Constitution Compliance**: すべてのタスクは `.specify/memory/constitution.md` の原則(明確な命名、シンプルなロジック、型安全性、TDD、アクセシビリティ、適切なコメント)に準拠して実装してください。各タスク完了後、`tsc`, `lint`, `test` がすべて成功することを確認してください。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `src/` at repository root
- **Tests**: `__tests__/` directories within source, or root `tests/` directory
- Next.js App Router: `src/app/discussions/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存プロジェクトへの型追加とフォルダ構造準備

- [x] T001 [P] Add AuditPageState interface in src/types/discussion.ts
- [x] T002 [P] Create audit page directory structure: src/app/discussions/audit/ and src/app/discussions/[naddr]/audit/
- [x] T003 Verify TypeScript compilation passes with `npx tsc --noEmit`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational Phase

- [x] T004 [P] Write test for DiscussionTabLayout component in tests/components/discussion/DiscussionTabLayout.test.tsx (ARIA attributes, keyboard navigation, active state)
- [x] T005 [P] Write test for AuditLogSection independent Discussion loading in tests/components/discussion/AuditLogSection.test.tsx

### Implementation for Foundational Phase

- [x] T006 Create DiscussionTabLayout component in src/components/discussion/DiscussionTabLayout.tsx (usePathname, role="tablist", aria-selected, keyboard navigation with Arrow/Home/End keys)
- [x] T007 Modify AuditLogSection to support loadDiscussionIndependently prop in src/components/discussion/AuditLogSection.tsx (add kind:34550 fetching logic when prop is true)
- [x] T008 Add error handling wrapper with try-catch and logging to loadIndividualAuditData and loadDiscussionListAuditData in src/components/discussion/AuditLogSection.tsx
- [x] T009 Verify all foundational tests pass with `npm test`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 監査履歴の閲覧（会話詳細） (Priority: P1) 🎯 MVP

**Goal**: 会話詳細の監査ページ（`/discussions/[naddr]/audit`）を独立したページとして提供し、投稿提出・承認イベントがタイムラインに正しく表示される

**Independent Test**: 会話詳細の監査ページに直接アクセスし、投稿提出・承認イベントがタイムスタンプ順でタイムラインに表示されることを確認する

### Tests for User Story 1

- [x] T010 [P] [US1] Write page test for /discussions/[naddr]/audit in tests/app/discussions/[naddr]/audit/page.test.tsx (renders AuditLogSection, URL direct access works)

### Implementation for User Story 1

- [x] T011 [US1] Create audit page component in src/app/discussions/[naddr]/audit/page.tsx (extract naddr from params, pass loadDiscussionIndependently=true to AuditLogSection)
- [x] T012 [US1] Update layout to include DiscussionTabLayout in src/app/discussions/[naddr]/layout.tsx (wrap children with tab navigation)
- [x] T013 [US1] Remove audit tab toggle state from existing page in src/app/discussions/[naddr]/page.tsx (refactor to use only main content)
- [x] T014 [US1] Verify User Story 1 tests pass and page renders correctly with `npm test && npm run dev`

**Checkpoint**: User Story 1 complete - 会話詳細監査ページが独立して動作する

---

## Phase 4: User Story 2 - 会話一覧への収録リクエストの監査（会話一覧） (Priority: P1)

**Goal**: 会話一覧の監査ページ（`/discussions/audit`）を独立したページとして提供し、収録リクエストと承認/却下がタイムラインに表示される

**Independent Test**: 会話一覧の監査ページに直接アクセスし、収録リクエストと承認/却下がタイムラインに表示されることを確認する

### Tests for User Story 2

- [x] T015 [P] [US2] Write page test for /discussions/audit in tests/app/discussions/audit/page.test.tsx (renders AuditLogSection with isDiscussionList=true)

### Implementation for User Story 2

- [x] T016 [US2] Create audit page component in src/app/discussions/audit/page.tsx (use NEXT_PUBLIC_DISCUSSION_LIST_NADDR, pass isDiscussionList=true to AuditLogSection)
- [x] T017 [US2] Add DiscussionTabLayout to discussions list pages by updating src/app/discussions/layout.tsx or creating wrapper
- [x] T018 [US2] Remove audit tab toggle state from existing page in src/app/discussions/page.tsx (refactor to use only main content)
- [x] T019 [US2] Verify User Story 2 tests pass and page renders correctly with `npm test && npm run dev`

**Checkpoint**: User Story 2 complete - 会話一覧監査ページが独立して動作する

---

## Phase 5: User Story 3 - 会話・監査タブの切り替え (Priority: P2)

**Goal**: タブUIで会話コンテンツと監査ログを簡単に切り替えられ、アクティブなタブが視覚的に明確に区別される（WCAG 2.1 AA準拠）

**Independent Test**: タブをクリック/キーボードで操作し、URLが変わり、対応するコンテンツが表示されることを確認する

### Tests for User Story 3

- [x] T020 [P] [US3] Write keyboard navigation test for DiscussionTabLayout in tests/components/discussion/DiscussionTabLayout.test.tsx (Arrow, Tab, Enter, Home, End keys)
- [x] T021 [P] [US3] Write accessibility test for tab touch targets (minimum 44px×44px) in tests/components/discussion/DiscussionTabLayout.test.tsx

### Implementation for User Story 3

- [x] T022 [US3] Ensure DiscussionTabLayout has proper ARIA attributes and keyboard handlers in src/components/discussion/DiscussionTabLayout.tsx (if not already complete in T006)
- [x] T023 [US3] Add CSS for focus-visible outline and minimum touch target size in src/components/discussion/DiscussionTabLayout.tsx or global styles
- [x] T024 [US3] Test browser Back/Forward navigation between main and audit pages manually
- [x] T025 [US3] Verify User Story 3 tests pass with `npm test`

**Checkpoint**: User Story 3 complete - タブナビゲーションがアクセシブルに動作する

---

## Phase 6: User Story 4 - エラー時の適切なフィードバック (Priority: P2)

**Goal**: データ取得エラー時にユーザーフレンドリーな日本語メッセージと再試行ボタンを表示する

**Independent Test**: ネットワークエラーをシミュレートし、エラーメッセージと再試行ボタンが表示され、再試行でデータが取得されることを確認する

### Tests for User Story 4

- [x] T026 [P] [US4] Write error state test for AuditLogSection in tests/components/discussion/AuditLogSection.test.tsx (error message display, retry button)

### Implementation for User Story 4

- [x] T027 [US4] Add error state UI with Japanese message and retry button to src/components/discussion/AuditLogSection.tsx
- [x] T028 [US4] Implement retry functionality (reset state and call loadAuditData again) in src/components/discussion/AuditLogSection.tsx
- [x] T029 [US4] Add logging for error conditions using logger in src/components/discussion/AuditLogSection.tsx
- [x] T030 [US4] Verify User Story 4 tests pass with `npm test`

**Checkpoint**: User Story 4 complete - エラー時に適切なフィードバックが表示される

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and cleanup

- [x] T031 Run full TypeScript type check with `npx tsc --noEmit`
- [x] T032 Run ESLint and fix any warnings with `npm run lint`
- [x] T033 Run all tests with `npm test`
- [x] T034 Verify production build succeeds with `npm run build`
- [x] T035 Manual testing: Verify all acceptance scenarios from spec.md
- [x] T036 Remove any unused code from old tab toggle implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion - can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on US1 and US2 completion (needs tab navigation in place)
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) completion - can run in parallel with US1/US2/US3
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - MVP target
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - can run in parallel with US1
- **User Story 3 (P2)**: Should complete after US1 and US2 to test tab navigation end-to-end
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - independent of other stories

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Implementation tasks follow test tasks
- Story complete before moving to next priority (or parallel if staffed)

### Parallel Opportunities

**Phase 1 (Setup):**
- T001 and T002 can run in parallel

**Phase 2 (Foundational):**
- T004 and T005 can run in parallel (tests)

**Phase 3-6 (User Stories):**
- US1 (Phase 3) and US2 (Phase 4) can run in parallel
- US4 (Phase 6) can run in parallel with US1/US2/US3
- Within each story, test tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1 & 2 in Parallel

```bash
# Launch US1 and US2 tests in parallel:
Task: T010 [US1] "Write page test for /discussions/[naddr]/audit"
Task: T015 [US2] "Write page test for /discussions/audit"

# After tests written, launch implementations:
# Developer A: US1 implementation (T011, T012, T013, T014)
# Developer B: US2 implementation (T016, T017, T018, T019)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009)
3. Complete Phase 3: User Story 1 (T010-T014)
4. **STOP and VALIDATE**: Test `/discussions/[naddr]/audit` independently
5. Deploy/demo if ready - 会話詳細監査ページが動作する

### Full Implementation

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → First milestone
3. Add User Story 2 (in parallel with US1 if possible) → Test independently → Second milestone
4. Add User Story 3 → Test independently → Tab navigation complete
5. Add User Story 4 → Test independently → Error handling complete
6. Complete Polish phase → Full feature ready

### Recommended Order (Single Developer)

1. Phase 1: Setup (30 min)
2. Phase 2: Foundational (2 hours)
3. Phase 3: User Story 1 - MVP (2 hours)
4. Phase 4: User Story 2 (1.5 hours)
5. Phase 5: User Story 3 (1 hour)
6. Phase 6: User Story 4 (1 hour)
7. Phase 7: Polish (1 hour)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance: Run `tsc`, `lint`, `test` after each phase completion
