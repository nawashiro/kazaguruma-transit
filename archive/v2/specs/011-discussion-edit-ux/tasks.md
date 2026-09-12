---

description: "会話編集画面UX改善の実装タスク"

---

# Tasks: 会話編集画面UX改善

**Input**: Design documents from `/specs/011-discussion-edit-ux/`

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/ui-state-contract.md`、`quickstart.md`

**Tests**: AGENTS.mdのTDD方針に従い、各ストーリーのテストを実装前に追加する。

**Organization**: ユーザーストーリーごとに独立して実装・検証できるように整理する。

## Phase 1: Setup（共有準備）

**目的**: 既存の会話UI構成とテスト対象を確認し、変更範囲を固定する。

- [X] T001 [P] 仕様011の対象ファイルと既存テストの対応表を作成する（`specs/011-discussion-edit-ux/plan.md`、`src/components/discussion/DiscussionTabLayout.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T002 [P] 既存のタブ、認証、権限、取得状態、ルビ切替のテスト実行方法を確認する（`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`、`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。
- [X] T003 [P] 仕様011のUI契約とクイックスタート検証条件を実装タスクへ照合する（`specs/011-discussion-edit-ux/contracts/ui-state-contract.md`、`specs/011-discussion-edit-ux/quickstart.md`）。

## Phase 2: Foundational（共通基盤）

**目的**: 3タブ、権限、取得状態を共通の型・表示責務として扱うための前提を整える。

**⚠️ 重要**: このフェーズ完了までユーザーストーリーの実装を開始しない。

- [X] T004 [P] 3タブ（会話・監査ログ・編集）の表示名、遷移先、選択条件をUI契約と照合して実装対象を確定する（`specs/011-discussion-edit-ux/contracts/ui-state-contract.md`、`src/components/discussion/DiscussionTabLayout.tsx`）。
- [X] T005 [P] 権限理由とログイン導線を同一文脈で表示する共通UIの責務を定義する（`src/components/discussion/PermissionGuards.tsx`、必要に応じて`src/components/discussion/LoginRequiredAction.tsx`）。
- [X] T006 [P] 会話取得状態（loading・delayed・success・not-found・error）と表示条件の対応を整理する（`src/components/discussion/DiscussionTabLayout.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T007 [P] 共通タブテストで3タブのパスモック、ARIA検証、キーボードイベントを再利用できるテスト準備を整える（`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`）。
- [X] T008 [P] 既存の編集ページテストで利用する未ログイン・非作成者・作成者の認証モック切替を準備する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。

**Checkpoint**: 共通タブ・権限・取得状態の責務とテスト方針が確定し、各ストーリーを独立して実装できる。

## Phase 3: User Story 1 - モバイルで会話を編集する（Priority: P1）🎯 MVP

**Goal**: 幅320px以上の画面で横スクロールなしに編集フォームと主要操作を利用できるようにする。

**Independent Test**: 幅390pxおよび幅320pxの画面で編集ページを開き、横方向オーバーフローがなく、フォームと主要操作が画面内に収まり、ルビ切替が入力UIを覆わないことを確認する。

### Tests for User Story 1（TDD: 実装前に追加）

- [X] T009 [P] [US1] 幅390px相当の編集レイアウトで主要操作が画面外へ出ないことを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.responsive.test.tsx`）。
- [X] T010 [P] [US1] 主要操作が狭い幅で縦積みまたは折り返しになることを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.responsive.test.tsx`）。
- [X] T011 [P] [US1] ルビ切替コントロールが編集フォームと共存し、重要な入力操作を覆わないためのDOM・クラス契約テストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.responsive.test.tsx`、`src/app/globals.css`）。

### Implementation for User Story 1

- [X] T012 [US1] 編集カード、フォーム、モデレーター入力を親コンテナ幅内に収めるレスポンシブレイアウトへ変更する（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T013 [US1] 保存・掲載申請・削除の操作群を狭い画面で縦積みまたは折り返し、各ボタンのラベルと44px以上の操作領域を維持する（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T014 [US1] モデレーター入力と追加ボタンが幅320px以上で横溢れしない配置へ変更する（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T015 [US1] 固定ルビ切替コントロールの位置またはページ側の安全余白を調整し、入力欄・リサイズ操作・主要操作との重なりを防ぐ（`src/app/globals.css`、必要に応じて`src/app/layout.tsx`）。
- [X] T016 [US1] 幅320px・390px・1440pxのレスポンシブテストを実行し、横方向オーバーフローが0件であることを確認する（`specs/011-discussion-edit-ux/quickstart.md`）。

**Checkpoint**: US1単体でモバイル編集画面が横スクロールなく利用できる。

## Phase 4: User Story 2 - 未ログイン状態から編集を開始する（Priority: P1）

**Goal**: 未ログインユーザーが権限不足の理由を理解し、権限メッセージ内のログインボタンから認証を開始できるようにする。

**Independent Test**: 未ログイン状態で編集ページと編集タブを開き、権限メッセージ内にログインボタンが1つだけ表示され、押下で既存のログインモーダルが開くことを確認する。ログイン済み非作成者ではログイン案内が表示されないことも確認する。

### Tests for User Story 2（TDD: 実装前に追加）

- [X] T017 [P] [US2] 未ログイン状態で権限メッセージとログインボタンが表示され、同一操作群内で重複しないことを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。
- [X] T018 [P] [US2] ログインボタン押下で`LoginModal`が開き、編集ページの文脈が維持されることを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。
- [X] T019 [P] [US2] ログイン済み非作成者には「会話作成者のみ編集できます」と表示し、未ログイン向けログイン案内を出さないことを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。

### Implementation for User Story 2

- [X] T020 [US2] 権限メッセージ内に単一のログインボタンを表示し、`showLoginModal`を開く処理を追加する（`src/app/discussions/[naddr]/edit/page.tsx`、`src/components/discussion/PermissionGuards.tsx`）。
- [X] T021 [US2] 編集タブを全ユーザーへ表示し、編集権限がない場合は遷移先で権限理由とログイン導線を表示する（`src/components/discussion/DiscussionTabLayout.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T022 [US2] ログインモーダル閉鎖後も編集ページ、入力済みフォーム値、現在のタブ文脈を保持する（`src/app/discussions/[naddr]/edit/page.tsx`、`src/components/discussion/LoginModal.tsx`）。
- [X] T023 [US2] 権限状態ごとの編集・掲載申請・削除・昇格申請・昇格審査の操作可否が既存ルールと一致することを回帰確認する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`、`src/lib/discussion/__tests__/permission-system.test.ts`）。

**Checkpoint**: US2単体で未ログイン・非作成者・作成者の導線と権限表示が一貫する。

## Phase 5: User Story 3 - 編集画面の情報を理解して操作する（Priority: P2）

**Goal**: 会話編集、掲載申請、モデレーター管理、危険な操作を区別し、「会話に戻る」専用リンクなしで3タブから移動できるようにする。

**Independent Test**: 編集ページで「会話」「監査ログ」「編集」の3タブ、4つの操作グループ、読み取り専用の会話ID、確認付きの削除を確認し、重複した戻るリンクがないことを検証する。

### Tests for User Story 3（TDD: 実装前に追加）

- [X] T024 [P] [US3] 詳細・監査ログ・編集の各パスで3タブと選択状態が正しいことを検証するテストを追加する（`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`）。
- [X] T025 [P] [US3] 3タブのArrowLeft・ArrowRight・Home・End移動と44pxタッチ領域を検証するテストを更新する（`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`）。
- [X] T026 [P] [US3] 編集ページに「会話に戻る」専用リンクがなく、操作グループ見出しと危険な操作見出しが存在することを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。
- [X] T027 [P] [US3] 削除ボタンが確認ダイアログを経由し、通常の編集操作と分離されていることを検証するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`）。

### Implementation for User Story 3

- [X] T028 [US3] `DiscussionTabLayout`のタブ定義、選択判定、キーボード移動を3タブ対応へ実装する（`src/components/discussion/DiscussionTabLayout.tsx`）。
- [X] T029 [US3] 編集ページ直前の「会話に戻る」リンクを削除し、会話詳細への移動を「会話」タブへ一本化する（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T030 [US3] 編集ページを会話情報編集、掲載申請、モデレーター管理、危険な操作の視覚的セクションへ整理する（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T031 [US3] 削除操作を危険な操作セクションへ移し、作成者だけが確認ダイアログを開ける既存認可を維持する（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T032 [US3] 会話IDを読み取り専用の識別情報として明示し、編集入力と誤認しない表示へ整える（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T033 [US3] 単一のmainランドマークと論理的な見出し階層になるよう、レイアウト側とページ側のmain構造を整理する（`src/components/discussion/DiscussionTabLayout.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`）。

**Checkpoint**: US3単体で編集ページの情報構造とタブナビゲーションが理解可能で、削除誤操作を防げる。

## Phase 6: User Story 4 - データ取得状態を正しく理解する（Priority: P2）

**Goal**: 読み込み中・遅延・成功・不存在・エラーを区別し、正常な会話を早期に「見つかりません」と表示しない。

**Independent Test**: 各取得状態をモックして、状態ごとの見出し・説明・再試行または一覧への戻り操作が契約どおり表示されることを検証する。

### Tests for User Story 4（TDD: 実装前に追加）

- [X] T034 [P] [US4] 読み込み中は「会話が見つかりません」を表示せず、読み込み状態を表示するテストを追加する（`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`、`src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`）。
- [X] T035 [P] [US4] 遅延・タイムアウト時に警告と再試行操作を表示するテストを追加する（`src/components/discussion/__tests__/DiscussionReadStatus.test.tsx`、`src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`）。
- [X] T036 [P] [US4] 取得完了後の不存在状態だけに「会話が見つかりません」を表示するテストを追加する（`src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`）。
- [X] T037 [P] [US4] 再試行時に古い会話情報と不存在・遅延表示が混在しないことを検証するテストを追加する（`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`）。

### Implementation for User Story 4

- [X] T038 [US4] `DiscussionTabLayout`の取得完了理由と会話有無の表示条件を整理し、loading中の不存在表示を防ぐ（`src/components/discussion/DiscussionTabLayout.tsx`）。
- [X] T039 [US4] 編集ページのloading・遅延・不存在・error分岐を共通取得状態契約に合わせる（`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T040 [US4] 再試行時の状態初期化と既知データ利用を確認し、古い表示の混在を防ぐ（`src/components/discussion/DiscussionTabLayout.tsx`、`src/lib/discussion/discussion-known-data-cache.ts`）。
- [X] T041 [US4] 取得状態の日本語説明、role、aria-live、再試行操作をアクセシブルに整える（`src/components/discussion/DiscussionReadStatus.tsx`、`src/components/discussion/DiscussionTabLayout.tsx`）。

**Checkpoint**: US4単体で取得状態を誤認せず、必要な再試行または一覧復帰ができる。

## Phase 7: Polish & Cross-Cutting Concerns

**目的**: 全ストーリー横断のアクセシビリティ、回帰、ビルド、実機相当検証を完了する。

- [X] T042 [P] 全対象ページでユーザー向けテキスト14px以上、ルビ補助テキスト、フォーカス表示、44px操作領域を確認する（`src/app/globals.css`、`src/components/discussion/DiscussionTabLayout.tsx`、`src/app/discussions/[naddr]/edit/page.tsx`）。
- [X] T043 [P] 会話詳細・監査ログ・編集の3タブをデスクトップ、タブレット、幅390px、幅320pxで目視検証する（`specs/011-discussion-edit-ux/quickstart.md`）。
- [X] T044 [P] 既存の会話編集、監査ログ、認証、権限、Nostr取得テストを回帰実行する（`src/app/discussions/[naddr]/__tests__/`、`src/app/discussions/[naddr]/audit/__tests__/`、`src/app/discussions/[naddr]/edit/__tests__/`、`src/components/discussion/__tests__/`）。
- [X] T045 [P] `npm run lint` を実行し、UI変更に伴う型・アクセシビリティ・スタイル警告を解消する（`src/app/discussions/[naddr]/edit/page.tsx`、`src/components/discussion/DiscussionTabLayout.tsx`）。
- [X] T046 [P] `npm test -- --runInBand` を実行し、全テストを通過させる（リポジトリルート）。
- [X] T047 [P] `npm run build` を実行し、生成・ビルドチェーンを通過させる（リポジトリルート）。
- [X] T048 実装結果を仕様011のSuccess Criteriaとquickstartの合格条件へ照合し、未達項目を修正して記録する（`specs/011-discussion-edit-ux/spec.md`、`specs/011-discussion-edit-ux/quickstart.md`）。
- [X] T049 [P] 未ログイン導線と主要編集シナリオの構造化ユーザビリティ検証を、幅320px・390px・1440pxで実施し、SC-004・SC-006の達成率を記録する（`specs/011-discussion-edit-ux/quickstart.md`）。

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 依存なし。
- **Phase 2 Foundational**: Phase 1完了後。全ユーザーストーリーをブロックする。
- **Phase 3 US1**: Phase 2完了後。MVPの最優先ストーリー。
- **Phase 4 US2**: Phase 2完了後。US1と異なる権限導線を独立実装できる。
- **Phase 5 US3**: Phase 2完了後。共通タブ基盤を使うため、T028はT004・T007の後に実施する。
- **Phase 6 US4**: Phase 2完了後。取得状態の共通責務を使うため、T038はT006の後に実施する。
- **Phase 7 Polish**: 対象ストーリーの実装とテスト完了後。

### User Story Dependencies

- **US1 (P1)**: Phase 2のみ依存。独立してMVPとして検証可能。
- **US2 (P1)**: Phase 2のみ依存。既存のLoginModalを利用し、US1とは独立して検証可能。
- **US3 (P2)**: Phase 2に依存。US1のレスポンシブ変更と同じ編集ページを変更するため、同時編集する場合はファイル単位で調整する。
- **US4 (P2)**: Phase 2に依存。DiscussionTabLayoutの状態表示を共有するため、US3と同時編集する場合は競合を避ける。

### Parallel Opportunities

- Phase 1のT001〜T003は並列実行可能。
- Phase 2のT004〜T008は、同一ファイルの実装競合を避ければ並列調査・テスト準備可能。実装本体はT028、ストーリー固有テストはT024・T025で行う。
- 各ストーリーのテストタスクは、同一テストファイルを変更しない単位で並列実行可能。
- Phase 2完了後は、US1とUS2を並列実装できる。US3とUS4は共通レイアウトへの変更があるため、担当を分ける場合も統合前に競合解消が必要。
- Phase 7のT042〜T047は、実装変更が凍結された後に並列検証可能。T049は検証環境準備後、T048は全検証完了後に実施する。

## Parallel Example: User Story 1

```text
Task: T009 レスポンシブ主要操作のテストを追加
Task: T010 主要操作の折り返しテストを追加
Task: T011 ルビ切替との重なりテストを追加
```

## Parallel Example: User Story 2

```text
Task: T017 未ログイン権限メッセージのテストを追加
Task: T018 ログインモーダル起動のテストを追加
Task: T019 非作成者の権限表示テストを追加
```

## Parallel Example: User Story 3

```text
Task: T024 3タブ選択状態のテストを追加
Task: T025 3タブのキーボード移動テストを更新
Task: T026 編集ページのセクション・リンクテストを追加
Task: T027 削除確認フローのテストを追加
```

## Parallel Example: User Story 4

```text
Task: T034 loading状態のテストを追加
Task: T035 遅延状態のテストを追加
Task: T036 不存在状態のテストを追加
Task: T037 再試行状態のテストを追加
```

## Implementation Strategy

### MVP First

1. Phase 1 Setupを完了する。
2. Phase 2 Foundationalを完了する。
3. US1のTDDテストとレスポンシブ実装を完了する。
4. 幅320px・390px・1440pxで独立検証する。
5. 合格後、US2へ進む。

### Incremental Delivery

1. US1でモバイル編集を利用可能にする。
2. US2で未ログインユーザーの次の行動を明確にする。
3. US3でタブと編集画面の情報構造を整理する。
4. US4で取得状態の誤認を防ぐ。
5. Polishでアクセシビリティ、回帰、lint、全テスト、buildを完了する。

## Notes

- すべてのタスクは `- [ ] Txxx` 形式で、ユーザーストーリータスクには `[USn]`、並列可能なタスクには `[P]` を付ける。
- テストは実装前に追加し、最初は失敗することを確認してから実装する。
- Nostrイベント、認証方式、認可ルール、Prismaスキーマは変更しない。
- 実装完了時に、スクリーンショットとブラウザ幅別の検証結果をレビュー記録へ残す。
