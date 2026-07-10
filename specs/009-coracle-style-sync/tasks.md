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

- [X] T005 [P] `src/lib/config/__tests__/discussion-config.test.ts` に`DiscussionReadStrategyConfig`の既定値、範囲丸め、無効timeoutのfallbackテストを追加する
- [X] T006 [P] `src/lib/discussion/__tests__/relay-candidate-selector.test.ts` にhint・成功実績・設定・既定relayの優先順、重複排除、3件上限、購読前1回だけのフォールバックを含む失敗テストを追加する
- [X] T007 [P] `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` にメタデータ暫定表示、relay結果での更新、version不一致破棄の失敗テストを追加する
- [X] T008 [P] `src/lib/discussion/__tests__/discussion-read-plan.test.ts` に各targetのkind/tag/limit、安定ソート規則、auditの`until` cursor契約テストを追加する
- [X] T009 [P] `src/lib/nostr/__tests__/nostr-service.test.ts` に`NDKRelaySet`を第3引数で渡す選別read、同一イベントIDの受信元relay情報保持、観測値の失敗テストを追加する
- [X] T010 `src/lib/discussion/relay-candidate-selector.ts` に優先順位付きrelay選別と購読前フォールバックを実装する
- [X] T011 `src/lib/discussion/discussion-known-data-cache.ts` にsessionStorageの安全なread/write・TTL検査・新しいrelay結果のマージを実装する
- [X] T012 `src/lib/discussion/discussion-read-plan.ts` に画面目的別filter、limit、timeout、監査cursor、安定ソート規則の生成を実装する
- [X] T013 `src/lib/nostr/nostr-service.ts` と `src/lib/nostr/discussion-ndk-gateway.ts` に`NDKRelaySet.fromRelayUrls()`を用いる選別read、source relay収集、重複数、観測ログを実装する
- [X] T014 [P] `src/components/discussion/DiscussionReadStatus.tsx` にloading/partial/unavailable/not-foundの日本語状態通知と再読み込みUIを実装する
- [X] T015 `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx` にARIA live region、部分取得・取得不能・再読み込みのテストを追加する
- [X] T016 `src/lib/discussion/discussion-read-plan.ts` と `src/lib/nostr/discussion-ndk-gateway.ts` に近似filter・同一relayへの短時間の重複read抑制を実装する
- [X] T017 `src/lib/config/__tests__/discussion-config.test.ts` `src/lib/discussion/__tests__/discussion-read-plan.test.ts` `src/lib/discussion/__tests__/relay-candidate-selector.test.ts` `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` を実行してFoundationを検証する

## Phase 3: User Story 1 - 会話画面を待たされずに開く (P1)

**Goal**: 会話詳細のメタデータ、ナビゲーション、投稿作成導線を、本文・承認の取得完了を待たず利用可能にする。

**Independent Test**: 一部relayがtimeoutしても会話メタデータまたは既知メタデータを表示し、部分取得の状態と再読み込みを表示する。

- [X] T018 [P] [US1] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` にtimeout時の暫定メタデータ、Not Foundとの区別、状態通知の失敗テストを追加する
- [X] T019 [P] [US1] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` にメタデータ表示中の投稿領域loading、フォーム値・フォーカス維持の失敗テストを追加する
- [X] T020 [P] [US1] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` に3秒以上遅延するrelayで2秒以内に利用可能になる観測テストを追加する
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

- [X] T032 [P] [US3] `src/lib/nostr/__tests__/nostr-service.test.ts` に複数relay由来のイベント重複・source relay蓄積テストを追加する
- [X] T033 [P] [US3] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` に連続イベント到着中の投稿フォーム値・フォーカス維持テストを追加する
- [X] T034 [P] [US3] `src/components/discussion/__tests__/AuditLogSection.test.tsx` に監査イベントの重複排除テストを追加する
- [X] T035 [US3] `src/app/discussions/[naddr]/page.tsx` に同一内容のstate更新を抑制するイベントマージを実装する
- [X] T036 [US3] `src/components/discussion/AuditLogSection.tsx` を共通イベントマージに統合し、ID重複を表示・集計しないようにする
- [X] T037 [US3] `src/lib/nostr/nostr-service.ts` に重複受信でもrelay hint/source実績を保管する実装を完了する
- [X] T038 [US3] 該当のNostr・詳細・監査テストを実行して重複排除とフォーカス維持を検証する
- [X] T039 [US3] `src/lib/nostr/__tests__/nostr-service.test.ts` と `src/components/discussion/__tests__/AuditLogSection.test.tsx` に到着順が逆転・同時刻の投稿、承認、評価、監査イベントの安定ソートテストを追加する

## Phase 6: User Story 4 - 再訪問時に既知データを活かす (P4)

**Goal**: 再訪問で既知メタデータを暫定表示し、新しいrelay結果で更新する。

**Independent Test**: 初回readの結果をキャッシュ後、同一会話を再訪問すると先に暫定タイトルが表示され、後続の新しい会話定義で置換されることを確認する。

- [X] T040 [P] [US4] `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx` にsessionStorageからの暫定タイトルとrelay結果での更新テストを追加する
- [X] T041 [P] [US4] `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` に既知イベントIDの重複排除とrelay成功実績のテストを追加する（成功実績は対象イベントを返したrelayに限定する）
- [X] T042 [US4] `src/components/discussion/DiscussionTabLayout.tsx` で既知メタデータを即時表示し、`usedKnownData`を部分取得状態へ渡す
- [X] T043 [US4] `src/app/discussions/[naddr]/page.tsx` と `src/components/discussion/AuditLogSection.tsx` で既知イベントを暫定入力としてマージし、relay取得を常に継続する
- [X] T044 [US4] `src/lib/discussion/discussion-known-data-cache.ts` からrelay成功実績をrelay選別へ渡す接続を実装する（問い合わせ済みrelayとは別フィールドとして扱う）
- [X] T045 [US4] 既知データ関連テストを実行して、cache単独でNot Found/承認状態を確定しないことを検証する

## Phase 7: Polish and Cross-Cutting Concerns

- [X] T046 [P] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` に詳細画面が目的外イベントを読まないread plan契約テストを追加する
- [X] T047 [P] `src/lib/discussion/__tests__/discussion-read-performance.test.ts` に20試行で19回以上が2秒以内にmetadataを表示する遅延relayテストを追加する
- [X] T048 [P] `src/lib/discussion/__tests__/discussion-read-performance.test.ts` に20試行で18回以上が1秒以内に既知metadataを表示する再訪問テストを追加する
- [X] T049 [P] `src/lib/discussion/__tests__/permission-system.test.ts` と既存Discussion画面テストで、NIP-01/09/25/72イベント解釈と投稿・承認・評価・モデレーター権限の回帰を検証する
- [X] T050 [P] `specs/009-coracle-style-sync/quickstart.md` に実測したrelay数、timeout、監査ページングの検証結果を追記する
- [X] T051 [P] `src/lib/discussion/discussion-read-plan.ts` と `src/lib/nostr/nostr-service.ts` の観測ログを確認し、イベント数・重複数・完了理由・経過時間を保守者が読めるよう整える
- [X] T052 `src/components/discussion/DiscussionReadStatus.tsx` と全統合箇所をキーボード・スクリーンリーダー観点で確認する
- [X] T053 `npx tsc --noEmit && npm run lint && npm test && npm run build` を `/home/navi/kazaguruma-transit` で実行する

## Phase 8: 承認状態の画面間整合性（009フォローアップ）

**Purpose**: relay候補と投稿・承認の結合経路の違いで、監査だけが承認済みを観測し、詳細又は承認画面が未承認と表示する不整合を解消する。

- [X] T054 [P] `src/lib/discussion/__tests__/relay-candidate-selector.test.ts` に、初回3 relay、partial時の未試行候補最大3 relay、EOSE又は候補枯渇で停止する承認状態readの候補契約テストを追加する
- [X] T055 [P] `src/lib/discussion/__tests__/discussion-moderation-snapshot.test.ts` を追加し、同一投稿IDのkind 4550が観測された場合の`approved`、partial又は再照会候補ありで未観測の場合の`unknown`、全候補からEOSEを受信後も未観測の場合だけの`unapproved`を検証する失敗テストを追加する
- [X] T056 [P] `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx` に、承認状態が`unknown`へ遷移した際の日本語文言、`role="status"`又は`aria-live`、再試行ボタンのアクセシブル名を検証する失敗テストを追加する
- [ ] T057 [P] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx`、`src/components/discussion/__tests__/AuditLogSection.test.tsx` に、configured/successful relayだけが承認を返すfixtureで三画面の承認状態が一致する失敗テストを追加する。共通snapshotの横断テストで同一判定を検証し、承認操作後に空またはtimeoutのstream EOSEが届いても楽観的な承認済み状態へ戻らないケース、全候補EOSE後にのみ`unapproved`となるケースを含める
- [X] T058 `src/lib/discussion/` に共通moderation read・スナップショット・event ID結合を実装し、全呼び出し元がhint、recommended、successful、configured、defaultを同じ候補入力として渡すようにする。streamを承認状態の確定境界にせず、completion-aware readの完了理由でpartial/timeout/EOSEを判定する
- [X] T059 `src/components/discussion/DiscussionReadStatus.tsx` と統合箇所に、`unknown`状態の日本語通知、アクセシブルな状態変化、再試行導線を実装する
- [X] T060 `src/app/discussions/[naddr]/page.tsx` と `src/app/discussions/[naddr]/approve/page.tsx` を共通moderation snapshotへ移行し、partial/timeout中の未観測承認を未承認と確定表示しないようにする。承認イベント本文を投稿の正本にせず、primary eventへ`e`タグで結合する
- [X] T061 `src/components/discussion/AuditLogSection.tsx` を主イベント10件のreadと、当該主イベントIDだけを`#e`で対象にする最大10件の承認readへ分離し、共通snapshotで承認状態を表示するようにする
- [X] T062 T054-T061のテスト、`npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build` を実行し、結果を`quickstart.md`へ追記する
- [X] T063 `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts` と関連画面テストに、問い合わせ済みrelayとイベント発見relayを分離し、`sourceRelayUrlsByEventId`由来の成功実績だけを保存し、キャッシュ削除後も承認状態をrelay readだけで再現できることを追加する

## Phase 9: 全Discussion画面の承認状態整合性

**Purpose**: 一覧、管理、BusStop系、評価・集計を含む全Discussion表示面で、投稿canonical source・承認`e`タグ結合・relay状態を共通化する。

- [X] T064 [P] `src/lib/discussion/__tests__/audit-timeline-mapper.test.ts` に、同じ`a`タグだが異なる`e`タグの承認を偽陽性にしないテストを追加する
- [ ] T065 [P] `src/app/discussions/__tests__/page.streaming.test.tsx`、`src/app/discussions/manage/__tests__/page.test.tsx`、`src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx`、`src/components/discussion/__tests__/BusStopMemo.streaming.test.tsx` に、承認遅延・別relay・空streamで`unknown`を維持し、承認到着後に`approved`へ更新するfixtureを追加する
- [ ] T066 [P] `src/components/discussion/__tests__/EvaluationComponent.test.tsx` に、`unknown`投稿を確定的に未承認除外せずsnapshot更新後に再評価できるテストを追加する
- [X] T067 `src/app/discussions/page.tsx` をprimary投稿/会話イベントと承認snapshotの結合へ移行し、承認イベント本文からの投稿復元を廃止する
- [ ] T068 `src/app/discussions/manage/page.tsx` の独立post/approval stream再構築を共通moderation readへ移行し、空・timeout・古いEOSEで承認状態を巻き戻さないようにする
- [X] T069 `src/components/discussion/BusStopDiscussion.tsx` と`src/components/discussion/BusStopMemo.tsx`を共通moderation readへ移行し、承認read完了前に投稿を除外せず、`unknown`状態を保留する
- [ ] T070 `src/components/discussion/EvaluationComponent.tsx` と統計入力を、`approved`確定投稿と`unknown`保留投稿に分離し、承認snapshot更新後に再計算する
- [ ] T071 `src/lib/discussion/audit-timeline-mapper.ts` の承認解決を`approval.e === event.id`へ限定し、会話`a`タグを投稿承認のfallbackに使わない
- [ ] T072 [P] `src/components/discussion/DiscussionTabLayout.tsx` と`src/components/discussion/AuditLogSection.tsx`のcache保存を`sourceRelayUrlsByEventId`由来の`successfulEventRelayUrls`へ統一し、問い合わせ対象relayを成功実績として保存しない。旧`successfulRelays`は読み取り互換のみとする
- [ ] T076 [P] `src/app/discussions/page.tsx` と`src/app/discussions/manage/page.tsx`のcache保存を`sourceRelayUrlsByEventId`由来の`successfulEventRelayUrls`へ統一し、問い合わせ対象relayを成功実績として保存しない
- [ ] T077 [P] `src/components/discussion/BusStopDiscussion.tsx` と`src/components/discussion/BusStopMemo.tsx`のcache保存契約を共通化し、`successfulEventRelayUrls`だけを次回relay候補へ渡す
- [ ] T073 `src/app/discussions/[naddr]/edit/page.tsx` の承認/未承認表示を共通snapshotの状態契約と照合し、未観測状態を`unapproved`として確定しない。readGenerationで古い結果を破棄する
- [ ] T074 全Discussion画面の同一fixture横断テスト、権限回帰、撤回、重複排除、フォーム/フォーカス維持を実行する
- [ ] T075 `npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build`を実行し、結果を`quickstart.md`へ追記する

## Dependencies and Execution Order

- Phase 1 -> Phase 2 -> US1/US2/US3/US4 -> Polish。
- US1はFoundation完了後のMVP。US2とUS3はUS1と独立して開始できるが、同じread plan基盤を使う。US4はFoundation完了後に開始できるが、US1のメタデータ統合と合わせて確認する。
- Phase 8はT054-T057の失敗テスト後にT058を実装し、T059、T060、T061、T063、T062の順に進める。T054-T057は並行可能だが、T063はT058のread結果契約に依存する。
- Phase 9はT064-T066の失敗テスト後にT067-T073、T076、T077を実装し、T074、T075で全体検証する。T064-T066は並行可能だが、T067-T073、T076、T077は共通snapshot契約の確定後に開始する。T071はT064完了後、T072、T076、T077は各read境界の移行後に完了とする。

## Parallel Opportunities

- Foundation: T005-T008、T013。
- US1: T016-T018。
- US2: T023-T025。
- US3: T030-T032。
- US4: T037-T038。
- Phase 8: T054-T057。
- Phase 9: T064-T066。

## Implementation Strategy

1. Phase 1-2でread planと観測可能な共通基盤を完成させる。
2. US1を実装・検証し、部分取得時でも会話画面を使えるMVPを届ける。
3. US2からUS4を順に統合し、最終品質ゲートを実行する。
