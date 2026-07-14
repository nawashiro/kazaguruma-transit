# Tasks: UI KISS観点の整備

**Input**: Design documents from `/specs/013-ui-kiss-maintenance/`

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/`、`quickstart.md`

**Tests**: AGENTS.mdのTDD方針とspec.md FR-016に従い、変更前に失敗するテストを追加する。

**Scope**: ジオコーディング共通化、ルート意味モデルとPDF状態整理、BusStop projection、Buttonの薄い明示API、対象箇所の回帰検証。`src/app/page.tsx` と `src/app/locations/page.tsx` の大規模分割、009 read基盤、ルビ外部契約、全画面一括移行は対象外。

## Phase 1: Setup (Shared Context)

**Purpose**: 実装前の対象範囲と検証基準を固定する。

- [ ] T001 [P] 対象ソース、既存テスト、009保護テストの現状を `specs/013-ui-kiss-maintenance/quickstart.md` に記録する
- [ ] T002 [P] 共通UI移行対象と直接DaisyUI記述を許容する境界を `specs/013-ui-kiss-maintenance/contracts/ui-component-boundary.md` に確定する
- [ ] T003 [P] PDF APIの使用項目・互換保持項目・廃止条件を `specs/013-ui-kiss-maintenance/contracts/pdf-route-input.md` に確定する

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが利用する共有型と、実装前に失敗する契約テストを用意する。

**⚠️ CRITICAL**: このフェーズ完了前に実装タスクを開始しない。

### Tests First

- [ ] T004 [P] `RouteDisplayModel` の直通・乗換・時刻不明・徒歩区間・経路なしを検証する失敗テストを `src/lib/transit/__tests__/route-display-model.test.ts` に追加する
- [ ] T005 [P] 出発地・目的地共通の空入力・成功・空結果・429・非JSON・通信失敗を検証する失敗テストを `src/lib/location/__tests__/geocoding-search.test.ts` に追加する
- [ ] T006 [P] moderation snapshotからの投稿・承認・評価・代表メモ投影とunknown維持を検証する失敗テストを `src/lib/discussion/__tests__/bus-stop-projection.test.ts` に追加する
- [ ] T007 [P] `Button` の明示状態、iconOnlyのアクセシブルな名前、loading、フォーカス表示、className非解析を検証する失敗テストを `src/components/ui/__tests__/Button.test.tsx` に追加する
- [ ] T008 [P] PDF入力の必須項目、互換保持項目、空経路、APIエラー、生成中解除を検証する失敗テストを `src/components/features/__tests__/RoutePdfExport.test.tsx` と `src/app/api/__tests__/pdf-route-contract.test.ts` に追加する

### Shared Models and Boundaries

- [ ] T009 [P] ルート・停留所・区間・徒歩リンク・メモの共有型を `src/types/route-display.ts` に定義する
- [ ] T010 [P] ジオコーディング検索結果と検索状態の型を `src/lib/location/geocoding-search.ts` に定義する
- [ ] T011 [P] BusStop投影の入力・出力型と009のapprovalStateルールを `src/lib/discussion/bus-stop-projection.ts` に定義する
- [ ] T012 [P] 画面/PDF共有意味モデル、Button境界、PDF互換入力の設計差分を `specs/013-ui-kiss-maintenance/data-model.md`、`specs/013-ui-kiss-maintenance/contracts/` に反映する

**Checkpoint**: 共有契約テストが意図どおり失敗し、型と契約文書が実装対象を一意に示していることを確認する。T031〜T032の共有ルート変換は、US1のT020〜T021より先に実施する前提として扱う。

## Phase 3: User Story 1 - 既存の画面挙動を保ったままUIを単純化する (Priority: P1) 🎯 MVP

**Goal**: 検索、経路表示、PDF、共通UIの整理後も利用者向けの既存状態と操作を維持する。BusStop投影の実装と独立検証はUS2で扱う。

**Independent Test**: `specs/013-ui-kiss-maintenance/quickstart.md` の対象テストと手動受け入れ確認を実行し、検索・経路・PDFのloading/error/empty状態の回帰がないことを確認する。BusStopはUS2の独立テストで確認する。

### Tests for User Story 1

- [ ] T013 [P] [US1] OriginSelectorの検索・GPS・429・空結果・通信失敗を検証するテストを `src/components/features/__tests__/OriginSelector.test.tsx` に追加または更新する
- [ ] T014 [P] [US1] DestinationSelectorの候補選択・検索・429・空結果・通信失敗を検証するテストを `src/components/features/__tests__/DestinationSelector.test.tsx` に追加または更新する
- [ ] T015 [P] [US1] 画面とPDFの直通・乗換・時刻不明・徒歩リンク・メモ意味の一致を検証するテストを `src/components/features/__tests__/IntegratedRouteDisplay.test.tsx` と `src/components/features/__tests__/RoutePdfExport.test.tsx` に追加する
- [ ] T016 [P] [US1] BusStopのpartial、timeout、unknown、承認済み、評価対象、代表メモの表示回帰を検証するテストを `src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx` と `src/components/discussion/__tests__/BusStopMemo.streaming.test.tsx` に追加または更新する

### Implementation for User Story 1

- [ ] T017 [US1] 共通ジオコーディング処理を実装し、空入力・地域補完・fetch・429・空結果・通信失敗を `src/lib/location/geocoding-search.ts` に集約する
- [ ] T018 [US1] OriginSelectorを共通ジオコーディング処理へ移行し、出発地固有のGPS処理とRateLimitModal接続を `src/components/features/OriginSelector.tsx` に残す
- [ ] T019 [US1] DestinationSelectorを共通ジオコーディング処理へ移行し、候補施設表示と検索UIを `src/components/features/DestinationSelector.tsx` に接続する
- [ ] T020 [US1] T031〜T032完了後に共有ルート表示モデルを画面表示へ接続し、既存のカード・徒歩リンク・時刻不明・乗換表示を `src/components/features/IntegratedRouteDisplay.tsx` で維持する
- [ ] T021 [US1] T031〜T032完了後に共有ルート表示モデルをPDFリクエスト生成へ接続し、画面と意味を一致させたPDF入力を `src/components/features/RoutePdfExport.tsx` に実装する
- [ ] T022 [US1] PDF生成状態を単一の生成中状態とエラー状態へ整理し、未使用の死んだエラー分岐を `src/components/features/RoutePdfExport.tsx` から除去する
- [ ] T023 [US1] PDF APIの必須入力・互換保持入力・エラー応答を契約どおりに扱い、未使用項目を新しい意味モデルへ混入させないよう `src/app/api/pdf/generate/route.ts` を整理する

**Checkpoint**: User Story 1の対象画面で既存の利用者シナリオが成立し、PDFの意味整合性と生成中解除が確認できる。

## Phase 4: User Story 2 - 同じ処理を一箇所で保守できる (Priority: P1)

**Goal**: BusStop表示面とPDF用データが共通のsnapshot投影を使い、投稿・承認・評価・代表メモのルールを重複実装しない。

**Independent Test**: 同一moderation snapshot fixtureを詳細表示、メモ表示、PDF用データ変換へ渡し、結果とapprovalStateが一致することを確認する。

### Tests for User Story 2

- [ ] T024 [US2] primary eventとapproval eventを投稿IDで結合し、unknownを未承認へ確定しない契約を `src/lib/discussion/__tests__/bus-stop-projection.test.ts` に追加する
- [ ] T025 [US2] T024完了後に、評価統計とバス停ごとの代表メモ選択を検証するテストを同じ `src/lib/discussion/__tests__/bus-stop-projection.test.ts` に追加する
- [ ] T026 [P] [US2] BusStop表示面とPDF用メモ取得が同じprojection結果を使うことを `src/components/discussion/__tests__/BusStopMemo.streaming.test.tsx` と `src/components/features/__tests__/RoutePdfExport.test.tsx` で検証する

### Implementation for User Story 2

- [ ] T027 [US2] snapshotから投稿・承認・評価統計・代表メモを生成する純粋なprojectionを `src/lib/discussion/bus-stop-projection.ts` に実装する
- [ ] T028 [US2] BusStopDiscussionの個別parse・filter・評価集計を共通projectionへ置き換え、009の `useBusStopModeration` read境界を維持する `src/components/discussion/BusStopDiscussion.tsx`
- [ ] T029 [US2] BusStopMemoの画面用投影とPDF用 `getBusStopMemoData` の重複処理を共通projectionへ置き換える `src/components/discussion/BusStopMemo.tsx`
- [ ] T030 [US2] projectionの入力を追加readなしで固定し、relay選択・completion・partial/unknown・source relayを変更していないことを `src/components/discussion/useBusStopModeration.ts`、`src/lib/discussion/discussion-moderation-snapshot.ts`、`src/lib/nostr/nostr-service.ts` の既存テストと `specs/009-coracle-style-sync/spec.md` の代表ケース対応表で確認する
- [ ] T031 [US2] 画面・PDFのルート時刻と区間を共通変換する純粋な関数を `src/lib/transit/route-display-model.ts` に実装する
- [ ] T032 [US2] `IntegratedRouteDisplay` と `src/app/api/pdf/generate/route.ts` の重複時刻計算・区間選択を共通変換へ置き換える

**Checkpoint**: 同一fixtureから生成したBusStop表示とPDF用データの意味が一致し、009 read契約に差分がない。

## Phase 5: User Story 3 - 仕様上必要な複雑性を壊さずに変更できる (Priority: P1)

**Goal**: 009 Nostr同期、ルビ外部ライブラリ、PDFサーバー生成、認証の必要な境界を保護しながら整理を完了する。

**Independent Test**: 009保護テスト、ルビの既存回帰確認、PDF失敗・再試行テスト、認証モーダルの既存テストを実行し、必要状態の欠落・誤確定・無限待機がないことを確認する。

### Tests for User Story 3

- [ ] T033 [P] [US3] partial、timeout、unknown、重複イベント、承認遅延の回帰テストを `src/lib/discussion/__tests__/discussion-moderation-snapshot.test.ts` と `src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx` に追加または更新する
- [ ] T034 [US3] T008の契約テストを拡張し、PDF APIエラー、空経路、例外後の生成中解除と再試行を `src/components/features/__tests__/RoutePdfExport.test.tsx` と `src/app/api/__tests__/pdf-route-contract.test.ts` で検証する
- [ ] T035 [P] [US3] ルビの利用可能・利用不能・遅延利用可能ケースで通常テキストが欠落しない既存挙動を `src/components/features/__tests__/FirstVisitGuideModal.test.tsx` と対象UIテストで確認する
- [ ] T036 [P] [US3] LoginModalのモード切替、規約同意、認証失敗、閉じる操作の状態分離を `src/components/discussion/__tests__/LoginModal.test.tsx` で確認する

### Implementation for User Story 3

- [ ] T037 [US3] PDF APIの `departures` と `message` を互換保持・未使用・廃止予定として扱う境界と削除条件を `src/app/api/pdf/generate/route.ts` と `specs/013-ui-kiss-maintenance/contracts/pdf-route-input.md` に反映する
- [ ] T038 [US3] 009のrelay read、既知データ、承認結合、completion状態に変更がないことを `src/components/discussion/useBusStopModeration.ts`、`src/lib/discussion/discussion-moderation-snapshot.ts`、`src/lib/nostr/nostr-service.ts` の差分レビューで確認する
- [ ] T039 [US3] RubyWrapperと外部ルビ起動契約を変更せず、`src/components/ui/RubyWrapper.tsx` の既存テストおよび `ruby-text` 利用箇所の代表テストで、遅延起動・通常表示・二重表示なしを確認する。実装変更は行わない

**Checkpoint**: 仕様上保護する複雑性が維持され、部分取得・ルビ・PDF・認証の回帰テストが通過する。

## Phase 6: User Story 4 - 共通UIのルールを予測できる (Priority: P2)

**Goal**: `Button` を薄い明示APIへ整理し、今回変更する利用箇所で暗黙のclassName解析・不要ID・重複状態をなくす。

**Independent Test**: Button単体テストと代表利用箇所のキーボード・ARIA・loading・joined・iconOnly確認を実行する。

### Tests for User Story 4

- [ ] T040 [P] [US4] 通常、secondary、submit、loading、disabled、fullWidth、iconOnly、joined、ARIA属性、フォーカス表示の契約テストを `src/components/ui/__tests__/Button.test.tsx` に追加または更新する
- [ ] T041 [P] [US4] Buttonを利用するOriginSelector、DestinationSelector、PostPreviewのアクセシブルな名前とloading状態を `src/components/features/__tests__/OriginSelector.test.tsx`、`src/components/features/__tests__/DestinationSelector.test.tsx`、`src/components/discussion/__tests__/PostPreview.test.tsx` で検証する

### Implementation for User Story 4

- [ ] T042 [US4] `Button` のPropsとクラス生成を明示状態ベースへ整理し、classNameの `join-item` 解析・不要なuseId・フォーカス無効化を `src/components/ui/Button.tsx` から除去する
- [ ] T043 [US4] iconOnlyのアクセシブルな名前、loadingのdisabled/aria-busy、DaisyUIのrounded規約、ruby-text子要素を `src/components/ui/Button.tsx` と `src/components/ui/__tests__/Button.test.tsx` で整合させる
- [ ] T044 [US4] 今回変更するButton利用箇所を明示APIへ移行し、直接DaisyUI記述を残す箇所の理由を `src/components/features/OriginSelector.tsx`、`src/components/features/DestinationSelector.tsx`、`src/components/discussion/PostPreview.tsx`、`specs/013-ui-kiss-maintenance/contracts/ui-component-boundary.md` に反映する
- [ ] T045 [US4] Input、Tabs、Modal、Error表示の変更対象でARIA・フォーカス・日本語エラー表示を維持し、全画面一括移行を行わないことを `src/components/ui/InputField.tsx`、`src/components/ui/CategoryTabs.tsx`、`src/components/features/RateLimitModal.tsx`、関連テストで確認する

**Checkpoint**: 共通Buttonと今回の代表利用箇所が、明示APIとアクセシビリティ契約を満たす。

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの統合、文書整合性、red-team検証を行う。

- [ ] T046 [P] 共有型、projection、geocoding、Buttonの公開APIとJSDoc・命名・`any` 不使用を `src/types/route-display.ts`、`src/lib/location/geocoding-search.ts`、`src/lib/transit/route-display-model.ts`、`src/lib/discussion/bus-stop-projection.ts` で確認する
- [ ] T047 [P] 仕様・計画・契約・quickstartの対象範囲と実装差分を `specs/013-ui-kiss-maintenance/spec.md`、`plan.md`、`contracts/`、`quickstart.md` で更新する
- [ ] T048 `package.json` の `lint` script による `npm run lint` を実行し、UI・型・アクセシビリティに関する警告を解消する
- [ ] T049 `package.json` の `test` script による `npm test -- --runInBand` を実行し、対象テストと全テストの失敗を修正する
- [ ] T050 `package.json` の `build` script による `npm run build` を実行し、Prisma/GTFS/Next build chainを含むproduction buildを通過させる
- [ ] T051 [P] 009のread境界、ルビ処理、PDF外部環境、大規模ページ非分割、全画面一括移行なしをred-teamレビューし、逸脱があれば `specs/013-ui-kiss-maintenance/quickstart.md` に記録する
- [ ] T052 `specs/013-ui-kiss-maintenance/quickstart.md` の手動受け入れ確認を実施し、検索、経路/PDF、BusStop、Button、ルビ、部分取得の結果を記録する
- [ ] T053 009の代表readシナリオについて、実装前後の開始時間とAPI応答時間のp95を `specs/013-ui-kiss-maintenance/quickstart.md` に記録し、API p95 200ms以下かつ変更前ベースラインから悪化していないことを確認する

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 他のタスクに先行するが、既存コードの調査と文書更新のみ。
- **Foundational (Phase 2)**: Phase 1後に実施。T004〜T008の失敗テストを先に作り、T009〜T012で共有境界を定義する。全ユーザーストーリーをブロックする。
- **User Story 1 (Phase 3)**: Phase 2完了後に実施。ただし、US1のT020〜T021より先にT031〜T032（共有ルート変換）を完了する。検索と表示回帰をMVPとして検証する。
- **User Story 2 (Phase 4)**: Phase 2完了後に開始可能。T031〜T032はUS1のT020〜T021より先に完了し、BusStop projectionはUS2として独立検証する。
- **User Story 3 (Phase 5)**: US1/US2の変更後に実施。保護対象の回帰確認はPhase 2完了後から並行可能。
- **User Story 4 (Phase 6)**: Phase 2完了後に開始可能。Buttonの移行はUS1の利用箇所変更と調整する。
- **Polish (Phase 7)**: US1〜US4の対象タスク完了後に実施する。T053はT048〜T050の検証後に実施する。

### User Story Dependencies

- **US1 (P1)**: Foundationalに依存し、T020〜T021はT031〜T032に依存する。MVPとして検索・経路・PDFを単独検証可能。BusStopはUS2に含める。
- **US2 (P1)**: Foundationalに依存。T031〜T032はUS1のT020〜T021より先に完了し、BusStop projectionはUS2として独立検証する。
- **US3 (P1)**: Foundationalに依存。009・ルビの回帰テストは並行可能だが、最終判定はUS1/US2の変更後に行う。
- **US4 (P2)**: Foundationalに依存。Button単体は独立して実装できるが、対象利用箇所の移行はUS1と調整する。

### Within Each User Story

- Tests tasks MUST be written and fail before the corresponding implementation task.
- Shared types and pure transformations MUST precede component migration.
- Component migration MUST preserve existing external contracts.
- Each checkpoint MUST pass before moving to the next story's integration tasks.

## Parallel Execution Examples

### Foundational

```text
T004 route-display-model.test.ts
T005 geocoding-search.test.ts
T006 bus-stop-projection.test.ts
T007 Button.test.tsx
T008 RoutePdfExport.test.tsx / pdf-route-contract.test.ts
```

これらは別ファイルの失敗テストなので並行実施できる。T009〜T011の共有型・境界定義も対象ファイルが異なるため並行可能である。

### User Story 1

```text
T013 OriginSelector.test.tsx
T014 DestinationSelector.test.tsx
T015 IntegratedRouteDisplay.test.tsx / RoutePdfExport.test.tsx
T016 BusStopDiscussion.streaming.test.tsx / BusStopMemo.streaming.test.tsx
```

実装はT017の共通検索処理を先に行い、T018/T019を並行移行できる。T020〜T023は共有ルートモデルの確定後に進める。

### User Story 2

```text
T024 bus-stop-projection.test.ts
T026 BusStopMemo.streaming.test.tsx / RoutePdfExport.test.tsx
```

T024完了後にT025を同じテストファイルへ追加する。T027のprojection実装後、T028とT029は別コンポーネントで並行可能である。T030はread境界の回帰確認として最後に行う。

### User Story 4

```text
T040 Button.test.tsx
T041 OriginSelector.test.tsx / DestinationSelector.test.tsx / PostPreview.test.tsx
```

T042/T043のButton実装後、T044の対象利用箇所移行とT045の関連UI確認を行う。

## Implementation Strategy

### MVP First

1. Phase 1〜2で失敗テストと共有契約を固定する。
2. T031〜T032で共有ルート変換を先に実装し、Phase 3でジオコーディング、画面ルート、PDF状態の回帰を防ぎながらMVPを成立させる。
3. T013〜T023とquickstartの対象検証を通過した時点で、US1を独立して確認する。

### Incremental Delivery

1. US1: 検索・ルート・PDFの既存挙動を維持する。
2. US2: BusStop projectionとルート変換の重複を減らす。
3. US3: 009・ルビ・PDF・認証の保護境界を回帰確認する。
4. US4: Buttonと対象利用箇所の明示API移行を行う。
5. Polish: lint、全テスト、build、手動確認、red-teamレビューを完了する。

### Explicitly Deferred

- `src/app/page.tsx` の大規模な責務分割
- `src/app/locations/page.tsx` の大規模な責務分割
- 全画面の直接DaisyUIボタン・カード・モーダルの一括移行
- `DiscussionTabLayout` の009通信オーケストレーション全面分割
- `RubyWrapper` の外部ライブラリ契約変更または置換
