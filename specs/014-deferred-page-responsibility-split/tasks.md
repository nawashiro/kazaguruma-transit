# Tasks: 後続ページ責務分離

**Input**: Design documents from `/specs/014-deferred-page-responsibility-split/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/responsibility-boundaries.md](./contracts/responsibility-boundaries.md), [quickstart.md](./quickstart.md)

**Tests**: AGENTS.mdのTDD方針とspec.md FR-013に従い、各段階の実装前に失敗するテストを追加・更新する。

**Scope**: 経路検索ページ、場所一覧ページ、会話タブの順に責務を分離する。URL・ディープリンク・履歴、Nostr/PDF/認証/ルビ契約、既存の見た目を維持する。全画面一括UI移行、新規永続化、RubyWrapper置換は対象外。

## Phase 1: Setup (Shared Context)

**Purpose**: 実装前の契約とベースラインを固定する。

- [X] T001 `specs/014-deferred-page-responsibility-split/quickstart.md` に、現在の経路検索・場所一覧・会話タブの対象テストと実行環境のベースライン記録欄を追加する
- [X] T002 `specs/014-deferred-page-responsibility-split/contracts/responsibility-boundaries.md` と `specs/013-ui-kiss-maintenance/contracts/` を照合し、今回変更する責務境界と変更しない外部契約を確定する
- [X] T003 [P] `src/app/__tests__/page.test.tsx`、`src/app/locations/__tests__/page.test.tsx`、`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` の既存シナリオを実装前ベースラインとして確認する

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが共有する型、状態遷移、回帰テストの基盤を先に固定する。

**⚠️ CRITICAL**: このフェーズ完了前にページ責務の実装を開始しない。

### Tests First

- [X] T004 [P] `src/lib/transit/__tests__/route-search-state.test.ts` に、入力・loading・success・empty・rate-limited・error・resetと古い検索結果の破棄を検証する失敗テストを追加する
- [X] T005 [P] `src/lib/location/__tests__/location-list-state.test.ts` に、loading・ready・カテゴリ変更・位置情報失敗・空結果・詳細失敗と古い要求の破棄を検証する失敗テストを追加する
- [X] T006 [P] `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx` に、known-data・loading・partial・unknown・completion・error・reloadの表示境界を検証する失敗テストを追加する
- [X] T007 [P] `src/app/__tests__/page-navigation-contract.test.tsx` に、目的地ディープリンク、履歴置換、再検索、リセットの外部挙動を検証する失敗テストを追加する

### Shared Boundaries

- [X] T008 `src/lib/transit/route-search-state.ts` に、経路検索状態と最新要求だけを採用する遷移境界の型・純粋関数を定義する
- [X] T009 `src/lib/location/location-list-state.ts` に、場所一覧状態とカテゴリ・位置・詳細要求を分離する遷移境界の型・純粋関数を定義する
- [X] T010 `src/components/discussion/DiscussionMetaReadState.tsx` に、既存の会話メタデータ結果を表示境界へ渡す型と状態契約を定義する
- [X] T011 `specs/014-deferred-page-responsibility-split/data-model.md` と `specs/014-deferred-page-responsibility-split/contracts/responsibility-boundaries.md` に、実装で確定した入出力名と変更しない契約を反映する

**Checkpoint**: T004〜T007が意図どおり失敗し、T008〜T010の共有境界が各責務の入力・出力と外部契約を一意に示す。

## Phase 3: User Story 1 - 経路検索ページを安全に分割する (Priority: P1) 🎯 MVP

**Goal**: 経路検索ページの入力、検索、結果、PDF、BusStopメモ、エラーを分離し、外部挙動を維持する。

**Independent Test**: `src/app/__tests__/page.test.tsx` と経路関連の対象テストで、ディープリンク、検索成功、経路なし、429、通信失敗、再検索、リセット、PDF出力を確認できる。

### Tests for User Story 1

- [X] T012 [P] [US1] `src/app/__tests__/page.test.tsx` に、検索前・検索中・成功・経路なし・APIエラー・通信エラー・レート制限の画面シナリオを追加または更新する
- [X] T013 [P] [US1] `src/app/__tests__/page-navigation-contract.test.tsx` に、目的地ディープリンクの読み込み、既存履歴の置換、再検索・リセット後の状態を追加する
- [X] T014 [P] [US1] `src/components/features/__tests__/IntegratedRouteDisplay.test.tsx` と `src/components/features/__tests__/RoutePdfExport.test.tsx` に、直通・乗換・時刻不明・徒歩区間・メモ意味の一致を追加する
- [X] T015 [P] [US1] `src/lib/transit/__tests__/route-search-state.test.ts` に、検索中のリセット・連続検索で古い結果を破棄するケースを追加する

### Implementation for User Story 1

- [X] T016 [US1] `src/app/page.tsx` の経路API呼び出し・応答変換・検索状態を、`src/lib/transit/route-search-state.ts` と既存の経路表示モデルへ移し、ページ入口をURL初期化とイベント接続だけの調整役にする
- [X] T017 [US1] `src/lib/transit/route-search-state.ts` を `src/app/page.tsx` へ接続し、最新要求だけを採用して古い要求が現在状態を更新しないようにする。ページ入口にAPI応答変換を戻さない
- [X] T018 [US1] `src/app/page.tsx` の目的地初期化、履歴置換、はやさ優先設定、リセット処理をページ入口の外部互換境界として整理する
- [X] T019 [US1] `src/app/page.tsx` の入力表示、検索操作、結果表示、BusStopメモ表示を責務ごとの既存コンポーネントへ接続し、見た目と日本語状態表示を維持する
- [X] T020 [US1] `src/app/page.tsx` と `src/components/features/RoutePdfExport.tsx` の接続を確認し、PDF入力・生成中・空経路・APIエラー・再試行契約を変更しない
- [X] T021 [US1] `src/app/__tests__/page.test.tsx`、`src/app/__tests__/page-navigation-contract.test.tsx`、`src/components/features/__tests__/RoutePdfExport.test.tsx` を実行し、ページ再読み込みなしの復帰を含むUS1のCheckpointを満たす

**Checkpoint**: 経路検索の既存URL・履歴・表示・エラー・PDF意味が維持され、対象テストが通過する。ここをMVPとして独立リリース候補にする。

## Phase 4: User Story 2 - 場所一覧ページを安全に分割する (Priority: P1)

**Goal**: 場所データ取得、カテゴリ、距離計算、位置検索、詳細表示を分離し、一覧の継続利用性を維持する。

**Independent Test**: `src/app/locations/__tests__/page.test.tsx` と場所データ・位置処理の対象テストで、カテゴリ、位置情報、住所検索、空・失敗、詳細モーダルを確認できる。

### Tests for User Story 2

- [X] T022 [P] [US2] `src/app/locations/__tests__/page.test.tsx` に、初期読み込み、最初のカテゴリ選択、カテゴリ切替、場所なし、詳細表示・閉じるシナリオを追加または更新する
- [X] T023 [US2] `src/app/locations/__tests__/page.test.tsx` に、現在地の成功・拒否・失敗、住所検索成功・空結果・レート制限・通信失敗を追加する
- [X] T024 [P] [US2] `src/lib/location/__tests__/location-list-state.test.ts` に、カテゴリ・位置・詳細要求が競合した場合に古い結果を破棄するケースを追加する
- [X] T025 [P] [US2] `src/components/ui/__tests__/CategoryTabs.test.tsx` と `src/components/features/__tests__/RateLimitModal.test.tsx` で、選択状態、ARIA、フォーカス、日本語エラーを確認する

### Implementation for User Story 2

- [X] T026 [US2] `src/app/locations/page.tsx` の場所データ取得とGeoJSON分類を `src/lib/location/location-list-state.ts` の状態境界へ移し、ページ入口を状態・イベント接続だけの調整役にする
- [X] T027 [US2] `src/lib/location/location-list-state.ts` に距離計算・距離順変換・距離グループ化を移し、既存の単位・丸め・並べ替え順を保つ
- [X] T028 [US2] `/api/geocode`、現在地取得、詳細取得の処理を `src/lib/location/location-list-state.ts` の位置・詳細要求境界へ整理し、ページ入口に外部取得を残さず、失敗時も可能な一覧操作を維持する
- [X] T029 [US2] `src/app/locations/page.tsx` の場所カードと詳細モーダル開閉を、選択状態と表示責務へ分離し、既存のrouter遷移とアクセシブルな名前を維持する
- [X] T030 [US2] `src/app/locations/page.tsx` で直接記述するUIと共通UIの利用境界を整理し、`specs/014-deferred-page-responsibility-split/contracts/responsibility-boundaries.md` に理由を記録する
- [X] T031 [US2] `src/app/locations/__tests__/page.test.tsx`、`src/lib/location/__tests__/location-list-state.test.ts`、`src/components/ui/__tests__/CategoryTabs.test.tsx` を実行し、ページ再読み込みなしの復帰を含むUS2のCheckpointを満たす

**Checkpoint**: 場所一覧の取得・分類・距離・詳細の失敗が一覧全体を壊さず、カテゴリ・位置・モーダル・router遷移と既存表示が維持される。

## Phase 5: User Story 3 - 会話タブの取得境界を分離する (Priority: P1)

**Goal**: 会話タブの表示とメタデータ取得を分離し、009のread契約を維持する。

**Independent Test**: `DiscussionTabLayout`の既存テスト、009のread/cacheテスト、画面レイアウトテストで、タブ操作とknown/partial/unknown/completion/error/reloadを確認できる。

### Tests for User Story 3

- [X] T032 [P] [US3] `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx` に、known-data、取得中、partial、unknown、completion、取得失敗、reloadの状態表示を追加する
- [X] T033 [P] [US3] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に、取得境界分離後もタブ、戻るリンク、子コンテンツ、ARIA、Arrow/Home/End、44px操作領域が維持されるケースを追加する
- [X] T034 [P] [US3] `src/app/discussions/[naddr]/__tests__/layout.test.tsx` に、動的naddr、既存URL、取得中のナビゲーション維持、エラー後の再試行を追加または更新する
- [X] T035 [P] [US3] `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts`、`src/lib/discussion/__tests__/relay-candidate-selector.test.ts`、`src/lib/nostr/__tests__/nostr-service.test.ts` に、既存read契約と古い要求の結果混入なしを追加または更新する

### Implementation for User Story 3

- [X] T036 [US3] `src/components/discussion/DiscussionMetaReadState.tsx` に、表示が消費する会話メタデータ状態とreload操作の境界を実装する
- [X] T037 [US3] `src/components/discussion/DiscussionTabLayout.tsx` のタブ・戻るリンク・子コンテンツ表示を、会話メタデータ取得の実装詳細から分離し、表示側をナビゲーションと状態受け渡しだけの調整役にする
- [X] T038 [US3] 会話メタデータ取得を `src/components/discussion/DiscussionMetaReadState.tsx` の境界へ接続し、`createDiscussionReadPlan`、known-data cache、relay候補選択、completion、partial/unknownの既存契約を変えずに維持する
- [X] T039 [US3] `src/components/discussion/DiscussionTabLayout.tsx` のload sequence、cleanup、reload、エラー表示を整理し、古い取得結果が新しい状態へ混入しないことを保証する
- [X] T040 [US3] `src/components/discussion/DiscussionTabLayout.tsx` の直接DaisyUI記述と共通UI利用範囲を確認し、全画面一括移行を行わず契約文書へ理由を反映する
- [X] T041 [US3] `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`、`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`、009保護テストを実行し、ページ再訪なしのreload復帰を含むUS3のCheckpointを満たす

**Checkpoint**: 会話タブの表示操作が利用可能なまま、009 readのknown/partial/unknown/completion/重複排除/relay意味に差分がない。

## Phase 6: User Story 4 - 分割後の共通UI境界を保つ (Priority: P2)

**Goal**: 3段階で変更したUIのアクセシビリティと共通UI境界を横断確認し、全画面一括移行を避ける。

**Independent Test**: 分割対象の代表画面で、role/label/ARIA/focus/loading/error/keyboardと14px下限を自動・手動で確認できる。

### Tests for User Story 4

- [X] T042 [P] [US4] `src/components/ui/__tests__/Button.test.tsx`、`src/components/ui/__tests__/CategoryTabs.test.tsx`、`src/components/ui/__tests__/InputField.test.tsx` に、分割対象で使用するloading、disabled、selected、invalid、focus、ARIA契約を追加または更新する
- [X] T043 [P] [US4] `src/app/__tests__/font-size-compliance.test.ts` に、分割対象ページのユーザー向け文字サイズ14px下限を確認するケースを追加または更新する
- [X] T044 [P] [US4] `src/app/__tests__/page.test.tsx`、`src/app/locations/__tests__/page.test.tsx`、`src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` に、キーボード操作、タッチターゲット、エラー再試行の代表ケースを追加する

### Implementation for User Story 4

- [X] T045 [US4] `src/app/page.tsx`、`src/app/locations/page.tsx`、`src/components/discussion/DiscussionTabLayout.tsx` の変更箇所を `contracts/responsibility-boundaries.md` と照合し、共通UIを使う範囲・直接DaisyUIを残す理由・追加状態の有無を確定する
- [X] T046 [US4] 分割対象で発生したアクセシビリティまたは明らかな表示不具合だけを修正し、見た目の再設計・全画面一括移行・RubyWrapper変更を行わない
- [X] T047 [US4] `specs/014-deferred-page-responsibility-split/quickstart.md` に、実装前後のテスト結果、URL互換、手動確認、性能p95、未確認の環境依存を記録する

**Checkpoint**: 分割対象のUIがARIA、フォーカス、キーボード、44px操作領域、日本語案内、14px下限を満たし、対象外のUI移行が混入していない。

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの統合、red-team、最終検証を行う。

- [X] T048 [P] 共有状態型、境界関数、表示コンポーネントの公開APIについて、命名、JSDoc、`unknown`/型ガード、`any`不使用を `src/lib/`、`src/components/`、`src/types/` で確認する
- [X] T049 [P] `src/app/page.tsx`、`src/app/locations/page.tsx`、`src/components/discussion/DiscussionTabLayout.tsx` の差分を確認し、URL・履歴・Nostr・PDF・認証・ルビ契約の意図しない変更がないことを記録する
- [X] T050 [P] `specs/014-deferred-page-responsibility-split/spec.md`、`plan.md`、`data-model.md`、`contracts/`、`quickstart.md` の要件・設計・実装範囲を相互に照合する
- [X] T051 `npx tsc --noEmit` を実行し、型エラーを解消する
- [X] T052 `npm run lint` を実行し、今回の変更に起因するlint・アクセシビリティエラーを解消する
- [X] T053 `npm test -- --runInBand` を実行し、全テストの失敗を解消する
- [X] T054 `npm run build` を実行し、Prisma/GTFS/Next.jsのproduction build chainを通過させる
- [X] T055 `specs/014-deferred-page-responsibility-split/quickstart.md` の手動受け入れ確認を実施し、デスクトップ・モバイル、ディープリンク、一覧、会話タブ、PDF、実relayの確認結果を記録する
- [X] T056 `specs/014-deferred-page-responsibility-split/quickstart.md` の同一環境測定手順で `/api/transit` と `/api/geocode` の代表シナリオを実装前後に測定し、p95 200ms以内かつベースライン比10%超の悪化なしを判定する

**Checkpoint**: 型検査、lint、全テスト、build、手動確認、red-team、性能判定が完了し、014仕様の成功基準を検証可能な状態になる。

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: すべての作業に先行する。
- **Foundational (Phase 2)**: Phase 1完了後に実施し、全ユーザーストーリーをブロックする。
- **US1 (Phase 3)**: Phase 2完了後に開始する。MVPとしてUS1のCheckpoint完了までを最小実装範囲とする。
- **US2 (Phase 4)**: US1のCheckpoint完了後に開始する。場所一覧の既存テスト・契約を独立して通過させる。
- **US3 (Phase 5)**: US2のCheckpoint完了後に開始する。009保護テストの差分確認を必須とする。
- **US4 (Phase 6)**: US1〜US3の各対象変更後に実施する。共通UIの一括移行はしない。
- **Polish (Phase 7)**: US1〜US4のCheckpoint完了後に実施する。

### User Story Dependencies

- **US1 (P1)**: Foundationalに依存。独立したMVP。
- **US2 (P1)**: US1に依存。段階導入順と、先行段階で確立したテスト・契約確認を再利用する。
- **US3 (P1)**: US2に依存。Nostrの複雑性を最後に扱い、画面回帰の原因を限定する。
- **US4 (P2)**: US1〜US3の変更箇所に依存。横断的なアクセシビリティと境界確認。

### Within Each User Story

- Tests MUST be written or updated before the corresponding implementation task.
- Shared state types and pure transitions MUST precede page wiring.
- Page wiring MUST preserve URL, history, display, and external service contracts.
- Each story checkpoint MUST pass before starting the next story.

## Parallel Execution Examples

### Foundational

```text
T004 route-search-state.test.ts
T005 location-list-state.test.ts
T006 DiscussionMetaReadState.test.tsx
T007 page-navigation-contract.test.tsx
```

### US1

```text
T012 page.test.tsx
T013 page-navigation-contract.test.tsx
T014 IntegratedRouteDisplay.test.tsx / RoutePdfExport.test.tsx
T015 route-search-state.test.ts
```

T016〜T018の境界整理後、T019〜T020を接続し、T021でUS1を検証する。

### US2

```text
T022 locations/page.test.tsx
T023 locations/page.test.tsx（別シナリオ追加のためT022完了後）
T024 location-list-state.test.ts
T025 CategoryTabs.test.tsx / RateLimitModal.test.tsx
```

同一テストファイルへ追記するT022とT023は並列実行しない。T026〜T029の境界整理後にT030、T031へ進む。

### US3

```text
T032 DiscussionMetaReadState.test.tsx
T033 DiscussionTabLayout.test.tsx
T034 discussions/[naddr]/layout.test.tsx
T035 discussion-known-data-cache.test.ts / relay-candidate-selector.test.ts / nostr-service.test.ts
```

T036〜T039の取得境界整理後にT040、T041へ進む。

### US4

```text
T042 Button.test.tsx / CategoryTabs.test.tsx / InputField.test.tsx
T043 font-size-compliance.test.ts
T044 page.test.tsx / locations/page.test.tsx / DiscussionTabLayout.test.tsx
```

同一テストファイルに追記する場合は、重複編集を避けて順序を調整する。

## Implementation Strategy

### MVP First

1. Phase 1〜2でベースライン、共有状態、契約テストを固定する。
2. T012〜T021で経路検索ページだけを分割し、URL・履歴・PDF・エラーを検証する。
3. US1のCheckpoint完了時点をMVP候補とする。

### Incremental Delivery

1. US1: 経路検索ページの責務分離。
2. US2: 場所一覧ページの責務分離。
3. US3: 会話タブのメタデータ取得境界分離。
4. US4: 変更対象に限った共通UI・アクセシビリティ確認。
5. Polish: 型、lint、全テスト、build、手動確認、性能、red-team。

### Explicitly Deferred

- 全画面の直接DaisyUIボタン・カード・モーダルの一括移行
- RubyWrapperの外部ライブラリ契約変更または置換
- Nostr read基盤、relay選択、イベント形式、既知データ形式の再設計
- URL構造の再設計
- 新規永続化、キャッシュ層、ユーザー向け機能の追加
