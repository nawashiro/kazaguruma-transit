# Tasks: Coracle-Style Selected Partial Sync

**Input**: `specs/009-coracle-style-sync/plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: 仕様と`AGENTS.md`がTDDを要求するため、各ストーリーのテストを先に追加する。

## Phase 1: Setup

**Purpose**: 既存の通信境界と観測点を確認し、009用の型を追加する。

- [X] T001 `src/lib/config/discussion-config.ts` に範囲検証付き`DiscussionReadStrategyConfig`とrelay上限・timeout・重複read抑制windowの環境設定を追加する
- [X] T002 [P] `src/lib/discussion/discussion-read-plan.ts` に画面目的別`DiscussionReadTarget`とread plan型を定義する
- [X] T003 [P] `src/lib/discussion/discussion-known-data-cache.ts` にversion付きsessionStorageキャッシュ型を定義する
- [X] T004 [P] `src/lib/discussion/relay-candidate-selector.ts` にrelay候補の優先根拠型を定義する

## Phase 2: Foundational

**Purpose**: すべての画面が利用するread plan、relay選別、既知データ、状態表示の共通基盤を実装する。

**CRITICAL**: このフェーズを完了するまで画面固有の実装を開始しない。

- [ ] T005 [P] `src/lib/config/__tests__/discussion-config.test.ts` に`DiscussionReadStrategyConfig`の既定値、範囲丸め、無効timeoutのfallbackテストを追加する
- [X] T006 [P] `src/lib/discussion/__tests__/relay-candidate-selector.test.ts` にhint・成功実績・設定・既定relayの優先順、重複排除、3件上限、購読前1回だけのフォールバックを含む失敗テストを追加する
- [X] T007 [P] `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` にメタデータ暫定表示、relay結果での更新、version不一致破棄の失敗テストを追加する
- [X] T008 [P] `src/lib/discussion/__tests__/discussion-read-plan.test.ts` に各targetのkind/tag/limit、安定ソート規則、auditの`until` cursor契約テストを追加する
- [ ] T009 [P] `src/lib/nostr/__tests__/nostr-service.test.ts` に`NDKRelaySet`を第3引数で渡す選別read、同一イベントIDの受信元relay情報保持、観測値の失敗テストを追加する
- [X] T010 `src/lib/discussion/relay-candidate-selector.ts` に優先順位付きrelay選別と購読前フォールバックを実装する
- [X] T011 `src/lib/discussion/discussion-known-data-cache.ts` にsessionStorageの安全なread/write・TTL検査・新しいrelay結果のマージを実装する
- [X] T012 `src/lib/discussion/discussion-read-plan.ts` に画面目的別filter、limit、timeout、監査cursor、安定ソート規則の生成を実装する
- [X] T013 `src/lib/nostr/nostr-service.ts` と `src/lib/nostr/discussion-ndk-gateway.ts` に`NDKRelaySet.fromRelayUrls()`を用いる選別read、source relay収集、重複数、観測ログを実装する
- [X] T014 [P] `src/components/discussion/DiscussionReadStatus.tsx` にloading/partial/unavailable/not-foundの日本語状態通知と再読み込みUIを実装する
- [X] T015 `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx` にARIA live region、部分取得・取得不能・再読み込みのテストを追加する
- [ ] T016 `src/lib/discussion/discussion-read-plan.ts` と `src/lib/nostr/discussion-ndk-gateway.ts` に近似filter・同一relayへの短時間の重複read抑制を実装する
- [X] T017 `src/lib/config/__tests__/discussion-config.test.ts` `src/lib/discussion/__tests__/discussion-read-plan.test.ts` `src/lib/discussion/__tests__/relay-candidate-selector.test.ts` `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` を実行してFoundationを検証する

## Phase 3: User Story 1 - 会話画面を待たされずに開く (P1)

**Goal**: 会話詳細のメタデータ、ナビゲーション、投稿作成導線を、本文・承認の取得完了を待たず利用可能にする。

**Independent Test**: 一部relayがtimeoutしても会話メタデータまたは既知メタデータを表示し、部分取得の状態と再読み込みを表示する。

- [ ] T018 [P] [US1] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` にtimeout時の暫定メタデータ、Not Foundとの区別、状態通知の失敗テストを追加する
- [ ] T019 [P] [US1] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` にメタデータ表示中の投稿領域loading、フォーム値・フォーカス維持の失敗テストを追加する
- [ ] T020 [P] [US1] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` に3秒以上遅延するrelayで2秒以内に利用可能になる観測テストを追加する
- [X] T021 [US1] `src/components/discussion/DiscussionTabLayout.tsx` を`discussion-meta` read planと既知メタデータで更新し、relay結果で置換する
- [X] T022 [US1] `src/app/discussions/[naddr]/page.tsx` をapproval/evaluationの独立read planへ更新し、メタデータを待つ全画面skeletonを排除する
- [X] T023 [US1] `src/components/discussion/DiscussionReadStatus.tsx` を詳細レイアウトと本文へ統合し、部分取得・取得不能の再読み込みを接続する
- [X] T024 [US1] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` と `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` を実行してストーリーを検証する

## Phase 4: User Story 2 - 必要なrelayだけから取得する (P2)

**Goal**: 一覧、詳細、承認、監査、編集が目的外イベントを読まず、relay候補を3件以下に選別する。

**Independent Test**: 各画面で実行されたread planを観測し、kind/tag/limit/relay数が契約どおりであることを確認する。

- [X] T025 [P] [US2] `src/app/discussions/__tests__/page.streaming.test.tsx` に一覧が個別投稿を取得しないread planテストを追加する
- [X] T026 [P] [US2] `src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx` と `src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx` に目的別filter・relay上限のテストを追加する
- [X] T027 [P] [US2] `src/components/discussion/__tests__/AuditLogSection.test.tsx` に初回・追加取得とも`limit: 10`、追加時に古い`until`を使う失敗テストを追加する
- [X] T028 [US2] `src/app/discussions/page.tsx` を`discussion-list` read plan経由に変更する
- [X] T029 [US2] `src/app/discussions/[naddr]/approve/page.tsx` と `src/app/discussions/[naddr]/edit/page.tsx` を承認・編集用read plan経由に変更する
- [X] T030 [US2] `src/components/discussion/AuditLogSection.tsx` を`discussion-audit` read plan経由に変更し、初回・追加のrelay実取得を最大10件にする
- [X] T031 [US2] `src/app/discussions/page.tsx` `src/app/discussions/[naddr]/approve/page.tsx` `src/app/discussions/[naddr]/edit/page.tsx` `src/components/discussion/AuditLogSection.tsx` の対象テストを実行する

## Phase 5: User Story 3 - 重複や再描画で画面が重くならない (P3)

**Goal**: 同一イベントが複数relayから来ても1件として反映し、短時間の連続到着でもフォームとフォーカスを失わない。

**Independent Test**: 同一IDを3回受けても投稿・承認・監査の表示と集計が1件であること、入力中の投稿フォームが維持されることを確認する。

- [ ] T032 [P] [US3] `src/lib/nostr/__tests__/nostr-service.test.ts` に複数relay由来のイベント重複・source relay蓄積テストを追加する
- [ ] T033 [P] [US3] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` に連続イベント到着中の投稿フォーム値・フォーカス維持テストを追加する
- [ ] T034 [P] [US3] `src/components/discussion/__tests__/AuditLogSection.test.tsx` に監査イベントの重複排除テストを追加する
- [ ] T035 [US3] `src/app/discussions/[naddr]/page.tsx` に同一内容のstate更新を抑制するイベントマージを実装する
- [ ] T036 [US3] `src/components/discussion/AuditLogSection.tsx` を共通イベントマージに統合し、ID重複を表示・集計しないようにする
- [ ] T037 [US3] `src/lib/nostr/nostr-service.ts` に重複受信でもrelay hint/source実績を保管する実装を完了する
- [ ] T038 [US3] 該当のNostr・詳細・監査テストを実行して重複排除とフォーカス維持を検証する
- [ ] T039 [US3] `src/lib/nostr/__tests__/nostr-service.test.ts` と `src/components/discussion/__tests__/AuditLogSection.test.tsx` に到着順が逆転・同時刻の投稿、承認、評価、監査イベントの安定ソートテストを追加する

## Phase 6: User Story 4 - 再訪問時に既知データを活かす (P4)

**Goal**: 再訪問で既知メタデータを暫定表示し、新しいrelay結果で更新する。

**Independent Test**: 初回readの結果をキャッシュ後、同一会話を再訪問すると先に暫定タイトルが表示され、後続の新しい会話定義で置換されることを確認する。

- [ ] T040 [P] [US4] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` にsessionStorageからの暫定タイトルとrelay結果での更新テストを追加する
- [ ] T041 [P] [US4] `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` に既知イベントIDの重複排除とrelay成功実績のテストを追加する
- [X] T042 [US4] `src/components/discussion/DiscussionTabLayout.tsx` で既知メタデータを即時表示し、`usedKnownData`を部分取得状態へ渡す
- [ ] T043 [US4] `src/app/discussions/[naddr]/page.tsx` と `src/components/discussion/AuditLogSection.tsx` で既知イベントを暫定入力としてマージし、relay取得を常に継続する
- [X] T044 [US4] `src/lib/discussion/discussion-known-data-cache.ts` からrelay成功実績をrelay選別へ渡す接続を実装する
- [ ] T045 [US4] 既知データ関連テストを実行して、cache単独でNot Found/承認状態を確定しないことを検証する

## Phase 7: Polish and Cross-Cutting Concerns

- [ ] T046 [P] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` に詳細画面が目的外イベントを読まないread plan契約テストを追加する
- [ ] T047 [P] `src/lib/discussion/__tests__/discussion-read-performance.test.ts` に20試行で19回以上が2秒以内にmetadataを表示する遅延relayテストを追加する
- [ ] T048 [P] `src/lib/discussion/__tests__/discussion-read-performance.test.ts` に20試行で18回以上が1秒以内に既知metadataを表示する再訪問テストを追加する
- [ ] T049 [P] `src/lib/discussion/__tests__/permission-system.test.ts` と既存Discussion画面テストで、NIP-01/09/25/72イベント解釈と投稿・承認・評価・モデレーター権限の回帰を検証する
- [ ] T050 [P] `specs/009-coracle-style-sync/quickstart.md` に実測したrelay数、timeout、監査ページングの検証結果を追記する
- [ ] T051 [P] `src/lib/discussion/discussion-read-plan.ts` と `src/lib/nostr/nostr-service.ts` の観測ログを確認し、イベント数・重複数・完了理由・経過時間を保守者が読めるよう整える
- [ ] T052 `src/components/discussion/DiscussionReadStatus.tsx` と全統合箇所をキーボード・スクリーンリーダー観点で確認する
- [X] T053 `npx tsc --noEmit && npm run lint && npm test && npm run build` を `/home/navi/kazaguruma-transit` で実行する

## Dependencies and Execution Order

- Phase 1 -> Phase 2 -> US1/US2/US3/US4 -> Polish。
- US1はFoundation完了後のMVP。US2とUS3はUS1と独立して開始できるが、同じread plan基盤を使う。US4はFoundation完了後に開始できるが、US1のメタデータ統合と合わせて確認する。

## Parallel Opportunities

- Foundation: T005-T008、T013。
- US1: T016-T018。
- US2: T023-T025。
- US3: T030-T032。
- US4: T037-T038。

## Implementation Strategy

1. Phase 1-2でread planと観測可能な共通基盤を完成させる。
2. US1を実装・検証し、部分取得時でも会話画面を使えるMVPを届ける。
3. US2からUS4を順に統合し、最終品質ゲートを実行する。
