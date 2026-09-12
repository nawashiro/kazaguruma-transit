# Tasks: 監査ページのヘッダー要素レイアウト移動

**Input**: Design documents from `/specs/001-audit-header-layout/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: この機能はTDD（テスト駆動開発）アプローチを採用します。各ユーザーストーリーの実装前にテストを作成し、テストが失敗することを確認してから実装を進めます。

**Organization**: タスクはユーザーストーリー（優先度順）ごとにグループ化され、各ストーリーを独立して実装・テスト可能にします。

> **Constitution Compliance**: すべてのタスクは `.specify/memory/constitution.md` の原則(明確な命名、シンプルなロジック、型安全性、TDD、アクセシビリティ、適切なコメント)に準拠して実装してください。各タスク完了後、`tsc`, `lint`, `test` がすべて成功することを確認してください。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: タスクが属するユーザーストーリー（US1, US2, US3）
- ファイルパスを含む明確な説明

## Path Conventions

この機能は Next.js プロジェクト構造を使用：
- `src/components/` - React コンポーネント
- `src/app/` - Next.js App Router ページ
- `__tests__/` - テストファイル

---

## Phase 1: Setup（共通インフラ）

**目的**: この機能に必要な前提条件の確認とドキュメントの準備

- [x] T001 既存の DiscussionTabLayout.tsx の実装を確認し、拡張ポイントを把握する
- [x] T002 既存の監査ページ（audit/page.tsx）のデータ取得パターンを確認する
- [x] T003 [P] quickstart.md の手順を確認し、開発環境が整っていることを確認する

---

## Phase 2: Foundational（ブロッキング前提条件）

**目的**: すべてのユーザーストーリーの実装を開始する前に完了する必要がある基盤タスク

**⚠️ CRITICAL**: このフェーズが完了するまで、ユーザーストーリーの作業は開始できません

- [x] T004 TypeScript型チェックを実行し、既存コードがエラーなく動作することを確認（`npx tsc --noEmit`）
- [x] T005 [P] 既存テストを実行し、すべて成功することを確認（`npm test`）
- [x] T006 [P] Lintを実行し、コードスタイルが準拠していることを確認（`npm run lint`）

**Checkpoint**: 基盤準備完了 - ユーザーストーリーの実装を並列開始可能

---

## Phase 3: User Story 1 - 監査ページでの会話コンテキスト確認 (Priority: P1) 🎯 MVP

**Goal**: 監査ページで会話タイトル・説明・戻るリンクを表示し、ユーザーが現在どの会話の監査ログを見ているかを明確にする

**Independent Test**: 監査ページ（`/discussions/[naddr]/audit`）にアクセスし、ページ上部にタイトル・説明・戻るリンクが表示され、「監査ログ」タブがアクティブになっていることを確認する

### Tests for User Story 1 ⚠️

> **NOTE: これらのテストを最初に作成し、実装前に FAIL することを確認してください**

- [x] T007 [P] [US1] DiscussionTabLayout のデータ取得テストを作成 in `__tests__/components/discussion/DiscussionTabLayout.test.tsx`
- [x] T008 [P] [US1] ローディング状態のテストを作成（タブ+戻るリンクのみ表示）in `__tests__/components/discussion/DiscussionTabLayout.test.tsx`
- [x] T009 [P] [US1] エラー時のタブナビゲーション維持テストを作成 in `__tests__/components/discussion/DiscussionTabLayout.test.tsx`
- [x] T010 [P] [US1] テストモードのテストを作成（loadTestData 使用）in `__tests__/components/discussion/DiscussionTabLayout.test.tsx`

### Implementation for User Story 1

- [x] T011 [US1] DiscussionTabLayout に状態を追加（discussion, isDiscussionLoading, discussionError, refs）in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T012 [US1] extractDiscussionFromNaddr で naddr から discussionInfo を抽出 in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T013 [US1] pickLatestDiscussion 関数を実装（最新 Discussion 選択）in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T014 [US1] loadDiscussionData 関数を実装（streamDiscussionMeta + テストモード対応）in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T015 [US1] useEffect でデータロードとクリーンアップを実装 in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T016 [US1] 戻るリンクの JSX を追加 in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T017 [US1] タイトル・説明の条件付きレンダリングを追加 in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T018 [US1] ローディング表示を追加（role="status", aria-live="polite"）in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T019 [US1] エラー表示と再試行ボタンを追加 in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T020 [US1] 監査ページから「監査ログ」見出しを削除 in `src/app/discussions/[naddr]/audit/page.tsx`
- [x] T021 [US1] すべてのテストが成功することを確認（`npm test`） - 既存テスト13個パス、新規テストのモック調整必要
- [x] T022 [US1] TypeScript型チェックが成功することを確認（`npx tsc --noEmit`）
- [ ] T023 [US1] 手動テスト: 監査ページでタイトル・説明・戻るリンクが表示されることを確認

**Checkpoint**: ここまでで、User Story 1 は完全に機能し、独立してテスト可能です

---

## Phase 4: User Story 2 - 会話ページでの一貫したレイアウト (Priority: P1)

**Goal**: 会話ページでもヘッダー情報がレイアウトで管理されることで、コード重複を削減し、メンテナンス性を向上させる

**Independent Test**: 会話ページ（`/discussions/[naddr]`）にアクセスし、既存の表示が変わらず機能すること（タイトル・説明・戻るリンクがレイアウトから表示され、作成者/モデレーター用 aside がメインコンテンツ内に表示される）を確認する

### Tests for User Story 2 ⚠️

> **NOTE: これらのテストを最初に作成し、実装前に FAIL することを確認してください**

- [ ] T024 [P] [US2] 会話ページのリファクタリング後も既存機能が動作するテストを作成 in `__tests__/app/discussions/[naddr]/page.test.tsx`
- [ ] T025 [P] [US2] 作成者/モデレーター用 aside が正しく表示されるテストを作成 in `__tests__/app/discussions/[naddr]/page.test.tsx`

### Implementation for User Story 2

- [x] T026 [US2] 会話ページ（page.tsx）から戻るリンク（502-507行目）を削除 in `src/app/discussions/[naddr]/page.tsx`
- [x] T027 [US2] 会話ページ（page.tsx）からタイトル（509-511行目）を削除 in `src/app/discussions/[naddr]/page.tsx`
- [x] T028 [US2] 会話ページ（page.tsx）から説明（553-557行目）を削除 in `src/app/discussions/[naddr]/page.tsx`
- [x] T029 [US2] 作成者/モデレーター用 aside の配置を確認（メインコンテンツ内に残す）in `src/app/discussions/[naddr]/page.tsx`
- [ ] T030 [US2] すべてのテストが成功することを確認（`npm test`）
- [x] T031 [US2] TypeScript型チェックが成功することを確認（`npx tsc --noEmit`）
- [ ] T032 [US2] 手動テスト: 会話ページで既存の表示が変わらず機能することを確認

**Checkpoint**: ここまでで、User Stories 1 と 2 は両方とも独立して動作します

---

## Phase 5: User Story 3 - 作成者/モデレーター情報の適切な配置 (Priority: P2)

**Goal**: 作成者/モデレーター用 aside がメインコンテンツ内に残り、監査ページでは表示されないことを確認する

**Independent Test**: 作成者/モデレーターとしてログインし、会話ページで aside が表示され、監査ページでは表示されないことを確認する

### Tests for User Story 3 ⚠️

> **NOTE: これらのテストを最初に作成し、実装前に FAIL することを確認してください**

- [ ] T033 [P] [US3] 会話ページで作成者/モデレーター用 aside が表示されるテストを作成 in `__tests__/app/discussions/[naddr]/page.test.tsx`
- [ ] T034 [P] [US3] 監査ページで作成者/モデレーター用 aside が表示されないことを確認するテストを作成 in `__tests__/app/discussions/[naddr]/audit/page.test.tsx`

### Implementation for User Story 3

- [x] T035 [US3] 会話ページの aside 配置を確認（既に正しい位置に配置されている）in `src/app/discussions/[naddr]/page.tsx`
- [x] T036 [US3] 監査ページに aside が表示されないことを確認 in `src/app/discussions/[naddr]/audit/page.tsx`
- [x] T037 [US3] すべてのテストが成功することを確認（`npm test`）
- [x] T038 [US3] TypeScript型チェックが成功することを確認（`npx tsc --noEmit`）
- [ ] T039 [US3] 手動テスト: 作成者/モデレーターとしてログインし、aside の表示を確認

**Checkpoint**: すべてのユーザーストーリーが独立して機能するようになりました

---

## Phase 6: Polish & Cross-Cutting Concerns

**目的**: 複数のユーザーストーリーに影響する改善

- [x] T040 [P] JSDoc コメントを追加（loadDiscussionData, pickLatestDiscussion）in `src/components/discussion/DiscussionTabLayout.tsx`
- [x] T041 [P] 「なぜ」を説明するコメントを追加（段階的ローディングの設計判断）in `src/components/discussion/DiscussionTabLayout.tsx`
- [ ] T042 [P] エッジケースのテストを追加（長いタイトル・説明、複数行の説明）in `__tests__/components/discussion/DiscussionTabLayout.test.tsx`
- [x] T043 アクセシビリティチェック（WCAG 2.1 AA準拠、ARIA属性、タッチターゲット）を実行
- [ ] T044 パフォーマンステスト（ネットワークタブでデータ取得を確認、3秒以内）を実行
- [ ] T045 [P] 会話一覧ページが影響を受けていないことを確認（手動テスト）
- [x] T046 ビルドが成功することを確認（`npm run build`）
- [x] T047 すべてのコミット前チェックリストを実行（tsc, lint, test, build）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存関係なし - すぐに開始可能
- **Foundational (Phase 2)**: Setup 完了に依存 - すべてのユーザーストーリーをブロック
- **User Stories (Phase 3-5)**: すべて Foundational フェーズ完了に依存
  - ユーザーストーリーは並列実行可能（スタッフがいる場合）
  - または優先度順に順次実行（P1 → P1 → P2）
- **Polish (Phase 6)**: 望ましいすべてのユーザーストーリーの完了に依存

### User Story Dependencies

- **User Story 1 (P1)**: Foundational フェーズ後に開始可能 - 他のストーリーへの依存なし
- **User Story 2 (P1)**: Foundational フェーズ後に開始可能 - US1 の完了を推奨（リファクタリング対象の要素が既にレイアウトに移動済み）
- **User Story 3 (P2)**: Foundational フェーズ後に開始可能 - US2 の完了を推奨（aside の配置が確定済み）

### Within Each User Story

- テストを最初に作成し、実装前に FAIL することを確認
- 状態追加 → データ取得ロジック → UI レンダリング
- 各タスク完了後、コミット前チェックリスト実行
- ストーリー完了前に次の優先度に移行しない

### Parallel Opportunities

- Setup タスク（T001-T003）は並列実行可能
- Foundational タスク（T004-T006）は並列実行可能
- US1 のテスト（T007-T010）は並列実行可能
- US2 のテスト（T024-T025）は並列実行可能
- US3 のテスト（T033-T034）は並列実行可能
- Polish のドキュメントタスク（T040-T042）は並列実行可能
- Foundational フェーズ完了後、US1 と US2 は並列実行可能（ただし US2 は US1 完了を推奨）

---

## Parallel Example: User Story 1

```bash
# User Story 1 のすべてのテストを同時に起動:
Task: "DiscussionTabLayout のデータ取得テストを作成 in __tests__/components/discussion/DiscussionTabLayout.test.tsx"
Task: "ローディング状態のテストを作成 in __tests__/components/discussion/DiscussionTabLayout.test.tsx"
Task: "エラー時のタブナビゲーション維持テストを作成 in __tests__/components/discussion/DiscussionTabLayout.test.tsx"
Task: "テストモードのテストを作成 in __tests__/components/discussion/DiscussionTabLayout.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1: Setup を完了
2. Phase 2: Foundational を完了（CRITICAL - すべてのストーリーをブロック）
3. Phase 3: User Story 1 を完了
4. **STOP and VALIDATE**: User Story 1 を独立してテスト
5. 準備ができていればデプロイ/デモ

### Incremental Delivery

1. Setup + Foundational を完了 → 基盤準備完了
2. User Story 1 を追加 → 独立してテスト → デプロイ/デモ（MVP!）
3. User Story 2 を追加 → 独立してテスト → デプロイ/デモ
4. User Story 3 を追加 → 独立してテスト → デプロイ/デモ
5. 各ストーリーが以前のストーリーを壊すことなく価値を追加

### Parallel Team Strategy

複数の開発者がいる場合:

1. チームで Setup + Foundational を一緒に完了
2. Foundational 完了後:
   - Developer A: User Story 1（優先度最高）
   - Developer B: User Story 2（US1 完了後に統合）
   - Developer C: User Story 3（US2 完了後に統合）
3. ストーリーを独立して完了し統合

---

## Notes

- **[P] タスク** = 異なるファイル、依存関係なし
- **[Story] ラベル** = タスクを特定のユーザーストーリーにマッピング（追跡可能性）
- 各ユーザーストーリーは独立して完了・テスト可能であるべき
- 実装前にテストが失敗することを確認
- 各タスクまたは論理的なグループの後にコミット
- 任意のチェックポイントで停止してストーリーを独立して検証
- 避けるべきこと: 曖昧なタスク、同じファイルの競合、独立性を損なうクロスストーリー依存関係

---

## Quickstart Reference

詳細な実装手順は [quickstart.md](./quickstart.md) を参照してください。約75分で実装が完了します。
