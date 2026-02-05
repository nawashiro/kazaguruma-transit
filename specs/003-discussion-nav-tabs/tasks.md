---

description: "Task list for feature implementation"
---

# Tasks: 会話タブナビゲーション修正

**Input**: Design documents from `/specs/001-discussion-nav-tabs/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: 仕様にTDDが明記されているためテストタスクを含める。

**Organization**: ユーザーストーリーごとに独立して実装・検証できるように分割する。

> **Constitution Compliance**: すべてのタスクは `.specify/memory/constitution.md` の原則(明確な命名、シンプルなロジック、型安全性、TDD、アクセシビリティ、適切なコメント)に準拠して実装してください。各タスク完了後、`tsc`, `lint`, `test` がすべて成功することを確認してください。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能 (異なるファイル、依存なし)
- **[Story]**: 対象ユーザーストーリー (US1, US2, US3, US4)
- 各タスクに具体的なファイルパスを含める

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 共通テスト準備

- [x] T001 `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に役割別レンダリングの共通セットアップ関数を追加する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーで共有するUI構造の下準備

- [x] T002 `src/components/discussion/DiscussionTabLayout.tsx` のタブ領域内に「説明ブロック」を挿入できる構造へ整理する

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 作成者のタブナビゲーション (Priority: P1) 🎯 MVP

**Goal**: 作成者が承認/編集リンクをタブレイアウトで確認し、順序どおりに遷移できる

**Independent Test**: 作成者として会話詳細を表示し、承認→編集の順でリンクが表示されることを確認する

### Tests for User Story 1 (TDD)

- [x] T003 [US1] 作成者表示時のリンク順序と遷移先を検証するテストを `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に追加する

### Implementation for User Story 1

- [x] T004 [US1] 作成者条件で承認/編集リンクを表示するタブ項目を `src/components/discussion/DiscussionTabLayout.tsx` に実装する

**Checkpoint**: User Story 1 should be functional and testable independently

---

## Phase 4: User Story 2 - モデレーターのタブナビゲーション (Priority: P2)

**Goal**: モデレーターが承認リンクのみをタブレイアウトで確認できる

**Independent Test**: モデレーターとして会話詳細を表示し、承認リンクのみが表示されることを確認する

### Tests for User Story 2 (TDD)

- [x] T005 [US2] モデレーター表示時に編集リンクが出ないことを検証するテストを `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に追加する

### Implementation for User Story 2

- [x] T006 [US2] モデレーター条件では承認リンクのみを表示するロジックを `src/components/discussion/DiscussionTabLayout.tsx` に反映する

**Checkpoint**: User Story 2 should be functional and testable independently

---

## Phase 5: User Story 3 - 権限説明の理解 (Priority: P3)

**Goal**: 役割に応じた説明ブロックがタブ最下部に常時表示される

**Independent Test**: 役割別に会話詳細を表示し、説明文が一致することを確認する

### Tests for User Story 3 (TDD)

- [x] T007 [US3] 作成者/モデレーター/ユーザーの説明文を検証するテストを `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に追加する

### Implementation for User Story 3

- [x] T008 [US3] 説明ブロック(常時表示)を `src/components/discussion/DiscussionTabLayout.tsx` に実装し、役割で文面を切り替える

**Checkpoint**: User Story 3 should be functional and testable independently

---

## Phase 6: User Story 4 - 旧導線の撤去 (Priority: P3)

**Goal**: 旧ブロック表示と「会話に戻る」導線を削除する

**Independent Test**: 会話詳細/編集/承認ページで旧導線が存在しないことを確認する

### Tests for User Story 4 (TDD)

- [x] T009 [US4] 旧ブロック表示が表示されないことを検証するテストを `src/app/discussions/[naddr]/__tests__/page.test.tsx` に追加する
- [x] T010 [P] [US4] 編集ページで「会話に戻る」が表示されないことを検証するテストを `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx` に追加する
- [x] T011 [P] [US4] 承認ページで「会話に戻る」が表示されないことを検証するテストを `src/app/discussions/[naddr]/approve/__tests__/page.test.tsx` に追加する

### Implementation for User Story 4

- [x] T012 [US4] 旧ブロック表示を `src/app/discussions/[naddr]/page.tsx` から削除する
- [x] T013 [P] [US4] 「会話に戻る」導線を `src/app/discussions/[naddr]/edit/page.tsx` から削除する
- [x] T014 [P] [US4] 「会話に戻る」導線を `src/app/discussions/[naddr]/approve/page.tsx` から削除する

**Checkpoint**: User Story 4 should be functional and testable independently

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと横断的確認

- [ ] T015 [P] `specs/001-discussion-nav-tabs/quickstart.md` の手順どおりに動作確認を行い、必要なら手順を更新する
- [ ] T016 [P] 追加・変更されたUIのWCAG 2.1 AA観点チェックを行い、必要なら `src/components/discussion/DiscussionTabLayout.tsx` と関連ページを調整する
- [ ] T017 [P] 主要な画面遷移が2秒以内に完了するかを確認し、必要なら原因を記録する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし
- **Foundational (Phase 2)**: Setup 完了が前提
- **User Stories (Phase 3-6)**: Foundational 完了が前提
- **Polish (Phase 7)**: 主要ストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundational完了後に着手可能 (MVP)
- **US2 (P2)**: US1と同一ファイルのため連続実施が安全
- **US3 (P3)**: US1/US2と同一ファイルのため連続実施が安全
- **US4 (P3)**: 他ストーリーと独立 (別ページ中心)

### Parallel Opportunities

- US4の編集/承認ページ対応は並列可能 (T010/T011, T013/T014)
- US4のテスト/実装はUS1-3と並列可能 (別ファイル中心)

---

## Parallel Example: User Story 4

```bash
Task: "編集ページで『会話に戻る』が表示されないことを検証するテストを src/app/discussions/[naddr]/edit/__tests__/page.test.tsx に追加する"
Task: "承認ページで『会話に戻る』が表示されないことを検証するテストを src/app/discussions/[naddr]/approve/__tests__/page.test.tsx に追加する"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2 を完了
2. Phase 3 を完了
3. US1 を単独で検証

### Incremental Delivery

1. US1 → US2 → US3 を順次完了
2. US4 を並行または後続で完了
3. 最終確認として Phase 7 を実施
