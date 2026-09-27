# Tasks: アクセシビリティ違反の修正

**Input**: Design documents from `/specs/015-accessibility-violation-fix/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [accessibility-ui-contract.md](./contracts/accessibility-ui-contract.md), [quickstart.md](./quickstart.md)

**Implementation order**: TDD。各ストーリーのテストを先に追加し、失敗を確認してから実装する。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存の依存関係・検証基盤を確認し、アクセシビリティ契約テストを追加できる状態にする。

- [x] T001 [P] 既存の依存関係とテスト実行条件を `package.json` と `jest.config.*` に記録する
- [x] T002 [P] WCAG 2.2 AA の参照基準と現状違反の対応表を `specs/015-accessibility-violation-fix/contracts/accessibility-ui-contract.md` に反映し、DaisyUI変更時に公式DaisyUI Skill/Pluginを参照する手順を記録する
- [x] T003 変更前の回帰ベースラインとして `npm test -- --runInBand` と `npm run lint` を実行し、結果を `specs/015-accessibility-violation-fix/quickstart.md` に記録する

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ストーリーが共有する静的監査、サイズ、名前、状態の契約をテストで固定する。

- [x] T004 [P] 誤った `area-selected`、手書きインライン SVG、ラベルのない対象入力が残らないことを検証する静的契約テストを `src/app/__tests__/accessibility-source-contract.test.ts` に追加する
- [x] T005 [P] 共通 `Button` のアクセシブルな名前、44px 最小サイズ、loading/disabled 状態、可視フォーカスクラスを検証するテストを `src/components/ui/__tests__/Button.test.tsx` に追加する
- [x] T006 [P] 入力の可視ラベル、説明、エラー、`aria-invalid`、`aria-describedby` の契約を検証するテストを `src/components/ui/__tests__/InputField.test.tsx` に追加する
- [x] T007 [P] タブの `aria-selected`、`aria-controls`、`tabpanel` 関連付け、矢印/Home/End キーボード操作を検証する共通テストを `src/components/ui/__tests__/CategoryTabs.test.tsx` に追加する
- [x] T008 [P] WCAG本文参照先、実装判断、対象外基準の記録を `specs/015-accessibility-violation-fix/research.md` と `specs/015-accessibility-violation-fix/quickstart.md` で確認する

**Checkpoint**: 共通契約テストが修正前の違反を検出して失敗することを確認してからユーザーストーリーへ進む。

## Phase 3: User Story 1 - 主要操作を支援技術で利用する (Priority: P1) 🎯 MVP

**Goal**: 設定、場所検索、会話作成・編集の主要操作を、キーボードと読み上げで完了できるようにする。

**Independent Test**: 設定・場所検索・会話フォームのテストで、主要操作の名前・ラベル・フォーカス・結果通知を確認する。

### Tests for User Story 1 (TDD: implementation前に追加)

- [x] T009 [P] [US1] サイドバー開閉、キーボード到達性、スキップリンク、可視フォーカスの失敗ケースを `src/components/layouts/__tests__/SidebarLayout.test.tsx` に追加する
- [x] T010 [P] [US1] ログインモーダルのタブ状態、閉じる操作、フォーム名、モーダルフォーカス契約を `src/components/discussion/__tests__/LoginModal.test.tsx` に追加する
- [x] T011 [P] [US1] 出発地選択の fieldset/legend 関連付けとキーボード操作を `src/components/features/__tests__/OriginSelector.test.tsx` に追加する
- [x] T012 [P] [US1] 場所検索住所入力の可視ラベル、検索結果、検索エラー通知を `src/app/locations/__tests__/page.test.tsx` に追加し、設定画面の主要操作の名前・フォーカス・結果通知を `src/app/settings/__tests__/page.streaming.test.tsx` に追加する

### Implementation for User Story 1

- [x] T013 [US1] サイドバー開閉をネイティブなキーボード操作可能コントロールに整理し、本文スキップ先とフォーカス表示を `src/components/layouts/SidebarLayout.tsx` で修正する
- [x] T014 [US1] ログインモーダルの `area-selected` を正しい選択状態属性へ修正し、タブ名・モーダル名・説明・閉じる操作を `src/components/discussion/LoginModal.tsx` で整合させる
- [x] T015 [US1] 出発地選択の凡例関連付けを正し、検索入力と現在地操作の名前・説明・フォーカスを `src/components/features/OriginSelector.tsx` で修正する
- [x] T016 [US1] 住所検索入力へ可視ラベルを追加し、検索状態とエラーを支援技術へ通知できるよう `src/app/locations/page.tsx` で修正する
- [x] T017 [US1] 設定画面、会話作成画面、会話編集画面の主要操作に不足している名前・説明・エラー関連付けを `src/app/settings/page.tsx`、`src/app/discussions/create/page.tsx`、`src/app/discussions/[naddr]/edit/page.tsx` で修正する

**Checkpoint**: US1 のテストと既存フォームテストが成功し、キーボードだけで主要操作を完了できる。

## Phase 4: User Story 2 - 小さな操作を確実に実行する (Priority: P1)

**Goal**: モデレーター削除、モーダル閉じる、承認などの操作を、44px 以上の操作領域と対象を識別できる名前で実行できるようにする。

**Independent Test**: 会話作成・編集のモデレーター削除、場所詳細・レート制限・初回案内モーダルの操作を、キーボードとポインターで実行する。

### Tests for User Story 2 (TDD: implementation前に追加)

- [x] T018 [P] [US2] 会話作成画面のモデレーター削除ボタンが対象ユーザーを名前に含み、44px 以上であることを `src/app/discussions/create/__tests__/page.test.tsx` に追加する
- [x] T019 [P] [US2] 会話編集画面のモデレーター削除ボタンが対象ユーザーを名前に含み、44px 以上であることを `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx` に追加する
- [x] T020 [P] [US2] 場所詳細、レート制限、初回案内モーダルの閉じる・主要操作の名前、サイズ、フォーカスを `src/components/features/__tests__/LocationDetailModal.test.tsx`、`RateLimitModal.test.tsx`、`FirstVisitGuideModal.test.tsx` に追加する

### Implementation for User Story 2

- [x] T021 [US2] 会話作成・編集のモデレーター削除操作を 44px 以上へ拡大し、対象ユーザーを含むアクセシブルな名前を `src/app/discussions/create/page.tsx` と `src/app/discussions/[naddr]/edit/page.tsx` で設定する
- [x] T022 [US2] 場所詳細モーダルの閉じる、ここへ行く、背景閉じる操作を 44px 以上かつ一意な名前に `src/components/features/LocationDetailModal.tsx` で修正する
- [x] T023 [US2] レート制限・初回案内モーダルの閉じる・主要操作を 44px 以上にし、開閉時フォーカスを `src/components/features/RateLimitModal.tsx` と `src/components/features/FirstVisitGuideModal.tsx` で整合させる
- [x] T024 [US2] 承認管理の承認・取消、モデレーター管理の追加・削除・確認、評価の賛成・反対操作の名前・サイズ・フォーカスを `src/app/discussions/manage/page.tsx`、`src/app/discussions/[naddr]/approve/page.tsx`、`src/app/discussions/[naddr]/moderators/page.tsx`、`src/components/discussion/EvaluationComponent.tsx` で修正する

**Checkpoint**: US2 のテストが成功し、対象を誤認せず全操作をキーボードとポインターで実行できる。

## Phase 5: User Story 4 - 状態とページ構造を正しく把握する (Priority: P1)

**Goal**: 同一ページタブ、ページ遷移ナビゲーション、フォームエラー、読み込み・成功・失敗状態を正しい名前・役割・値で提供する。

**Independent Test**: ログイン、カテゴリ、承認、会話ナビゲーションを切り替え、選択状態・パネル・状態メッセージを読み上げで把握する。

### Tests for User Story 4 (TDD: implementation前に追加)

- [x] T025 [P] [US4] 同一ページタブの選択状態・tabpanel 関連付け・キーボード操作を `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` と `src/components/discussion/__tests__/DiscussionListTabLayout.test.tsx` に追加する
- [x] T026 [P] [US4] ページ遷移ナビゲーションを通常リンクとして扱い、タブ役割を誤用しない契約を `src/components/discussion/__tests__/DiscussionManagementTabLayout.test.tsx` に追加する
- [x] T027 [P] [US4] 承認画面のタブ・tabpanel、読み込み・空状態・エラー状態を `src/app/discussions/manage/__tests__/page.test.tsx` と `src/app/discussions/[naddr]/approve/__tests__/page.test.tsx` に追加する
- [x] T028 [P] [US4] ステータスとエラーが一度だけ通知され、入力へ関連付くことを `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx`、`DiscussionMetaReadState.test.tsx`、`src/components/ui/__tests__/InputField.test.tsx` で追加確認する

### Implementation for User Story 4

- [x] T029 [US4] ページ遷移用の会話ナビゲーションから不要な tab role を除き、リンク名・現在ページ・フォーカス順を `src/components/discussion/DiscussionTabLayout.tsx` と `src/components/discussion/DiscussionManagementTabLayout.tsx` で整理する
- [x] T030 [US4] 同一ページ内のカテゴリ切替を完全な tab/tabpanel 契約へ修正し、全カテゴリの panel ID と選択状態を `src/components/ui/CategoryTabs.tsx` と `src/components/features/LocationSuggestions.tsx` で統一する
- [x] T031 [US4] 承認管理の loading 状態を含む tab/tabpanel 関連付け、名前、選択状態を `src/app/discussions/manage/page.tsx` と `src/app/discussions/[naddr]/approve/page.tsx` で修正する
- [x] T032 [US4] 動的な読み込み・成功・失敗・エラーの role、live region、`aria-describedby` を `src/components/discussion/DiscussionReadStatus.tsx`、`src/components/discussion/DiscussionMetaReadState.tsx`、`src/components/ui/InputField.tsx`、`src/app/locations/page.tsx`、`src/app/discussions/manage/page.tsx`、`src/app/discussions/[naddr]/approve/page.tsx`、`src/app/discussions/[naddr]/edit/page.tsx` で整理する
- [x] T033 [US4] ページタイトル、見出し、main landmark、スキップ先、フォーカス順の共通契約を `src/app/layout.tsx`、各 `src/app/**/layout.tsx`、`src/components/layouts/SidebarLayout.tsx` で回帰確認・修正する

**Checkpoint**: US4 の読み上げ・DOM契約テストが成功し、状態・役割・値が視覚クラスだけに依存しない。

## Phase 6: User Story 3 - 一貫した視覚表現と代替情報を得る (Priority: P2)

**Goal**: 手書きインライン SVG を除去し、装飾アイコンと意味伝達アイコンを一貫した代替情報で提供する。

**Independent Test**: 共通レイアウト、設定、ログイン、会話作成、評価、場所検索のアイコンを検査し、重複通知されず必要な意味が日本語テキストで伝わる。

### Tests for User Story 3 (TDD: implementation前に追加)

- [x] T034 [P] [US3] 手書きインライン SVG が対象ソースに残らず、装飾アイコンが `aria-hidden` で扱われることを `src/app/__tests__/accessibility-source-contract.test.ts` に追加する
- [x] T035 [P] [US3] アイコン付き評価、ログイン、テーマ切替、場所候補の代替情報と重複読み上げを `src/components/discussion/__tests__/EvaluationComponent.test.tsx`、`LoginModal.test.tsx`、`src/components/ui/__tests__/ThemeToggle.test.tsx`、`src/components/features/__tests__/LocationSuggestions.test.tsx` に追加する

### Implementation for User Story 3

- [x] T036 [P] [US3] 共通レイアウト、テーマ切替、ユーザーID表示の手書き SVG を既存アイコンコンポーネントへ置換し、装飾属性を `src/components/layouts/SidebarLayout.tsx`、`src/components/ui/ThemeToggle.tsx`、`src/components/ui/NpubDisplay.tsx` で整える
- [x] T037 [P] [US3] 設定画面と会話作成画面の手書き SVG を既存アイコンコンポーネントへ置換し、状態テキストを `src/app/settings/page.tsx` と `src/app/discussions/create/page.tsx` で維持する
- [x] T038 [P] [US3] ログイン・評価・場所候補の手書き SVG を既存アイコンコンポーネントへ置換し、意味伝達と装飾の扱いを `src/components/discussion/LoginModal.tsx`、`src/components/discussion/EvaluationComponent.tsx`、`src/components/features/LocationSuggestions.tsx` で統一する
- [x] T039 [P] [US3] 場所検索ページと場所モーダルに残る手書き SVG を置換し、エラー・成功のテキスト代替を `src/app/locations/page.tsx` と `src/components/features/LocationDetailModal.tsx` で整える

**Checkpoint**: US3 の静的契約テストが成功し、対象範囲に手書きインライン SVG とアイコンだけの意味伝達が残らない。

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー横断の視覚・回帰・品質確認を完了する。

- [x] T040 通常テキスト、非テキストUI、境界線、フォーカス表示のコントラストをライト・ダークテーマで測定し、必要な色を `src/app/globals.css` と対象コンポーネントで修正する
- [x] T041 200%文字拡大、狭い画面幅、横スクロール、フォーカス順をPuppeteerまたはブラウザ手動検証で確認し、必要なレイアウトを `src/app/globals.css` と対象ページで修正する
- [x] T042 [P] 低コントラスト候補と44px未満候補を静的検索し、確認結果を `specs/015-accessibility-violation-fix/quickstart.md` に記録する
- [x] T043 既存のページ・コンポーネント・フォーム・タブ回帰テストと、認証・会話・場所データ・画面遷移・永続化形式を変更していないことの契約確認を `npm test -- --runInBand` で実行し、失敗を修正する
- [x] T044 TypeScript、lint、production build を `npm run lint` と `npm run build` で実行し、エラーを修正する
- [x] T045 クイックスタート全項目、WCAG本文参照、憲章ゲート、実装監査項目を `specs/015-accessibility-violation-fix/quickstart.md` と `specs/015-accessibility-violation-fix/checklists/requirements.md` に反映する

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。T001〜T003 は並列実行可能だが、T003 のベースラインは後続テスト設計の参考にする。
- **Foundational (Phase 2)**: Phase 1 完了後。T004〜T008 は並列実行可能で、全ストーリーをブロックする。
- **US1 (Phase 3)**: Phase 2 完了後。MVPとして最初に完了させる。
- **US2 (Phase 4)**: Phase 2 完了後。US1 と独立して進められる。
- **US4 (Phase 5)**: Phase 2 完了後。共通タブ契約を使うため T007 完了後に開始する。
- **US3 (Phase 6)**: Phase 2 完了後。静的契約 T004 完了後に開始する。
- **Polish (Phase 7)**: US1〜US4 の実装完了後。

### User Story Dependencies

- **US1 (P1)**: Foundational のみ依存。MVP。
- **US2 (P1)**: Foundational のみ依存。US1 と並列可能。
- **US4 (P1)**: Foundational、共通タブテスト T007 に依存。US1/US2 と並列可能。
- **US3 (P2)**: Foundational、静的契約 T004 に依存。US1/US2/US4 と並列可能だが、共通ファイルの競合を避ける。

### Within Each User Story

- テストタスクを先に実行し、修正前に失敗することを確認する。
- テストが対象ファイルの実装変更を要求した後、実装タスクを実行する。
- Checkpoint の独立テストを通過してから次ストーリーへ進む。

## Parallel Execution Examples

### MVP / User Story 1

```text
T009 SidebarLayout 契約テスト
T010 LoginModal 契約テスト
T011 OriginSelector 契約テスト
T012 locations page 契約テスト
```

テスト完了後、T013〜T016 は対象ファイルが分かれるため並列実装できる。T017 は会話ページの共通回帰確認としてその後に実行する。

### Remaining Stories

```text
US2: T018, T019, T020 → T021, T022, T023, T024
US4: T025, T026, T027, T028 → T029, T030, T031, T032, T033
US3: T034, T035 → T036, T037, T038, T039
```

US2、US4、US3 は Foundational 完了後に担当を分けて並列実行できる。ただし同一ファイルを変更するタスクは並列に実行しない。

## Implementation Strategy

### MVP First

1. Phase 1〜2 を完了し、共通契約テストが違反を検出することを確認する。
2. US1 のテストを先に追加して失敗させる。
3. 設定、場所検索、会話作成・編集の主要操作を修正する。
4. US1 の独立テスト、全既存テスト、lint を実行してMVPを検証する。

### Incremental Delivery

1. US2 で小型操作とタッチターゲットを是正する。
2. US4 でタブ、状態、ページ構造を是正する。
3. US3 で全対象範囲のアイコンと代替情報を統一する。
4. Phase 7 でコントラスト、200%拡大、リフロー、buildを確認する。

## Format Validation

- 全タスクは `- [ ] T###` で開始する。
- ユーザーストーリー内の全タスクは `[US1]`〜`[US4]` ラベルを持つ。
- 並列実行可能なタスクのみ `[P]` を付ける。
- 全タスクの説明に対象ファイルまたはコマンドのパスを含める。
- タスクIDは T001〜T045 の連番である。
