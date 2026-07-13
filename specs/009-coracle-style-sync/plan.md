# Implementation Plan: Coracle-Style Selected Partial Sync

**Branch**: `009-coracle-style-sync` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/009-coracle-style-sync/spec.md`

## Summary

Discussion/Nostr画面の取得を、画面目的別の小さな read plan に統一する。既存の NDK gateway、completion-aware read、ID重複排除を再利用し、relay候補の選別、取得結果の観測、ブラウザ内の既知データ、部分取得状態の表示を追加する。NIP-01/09/25/72のイベント解釈、投稿・承認・評価・モデレーターの権限判定は変更しない。

### 2026-07-10 承認状態整合性フォローアップ

009完了後の調査で、詳細・承認・監査が異なるrelay候補と異なる投稿復元経路を使用し、同一のkind 4550承認を相反して表示できることを確認した。フォローアップでは、共通の moderation snapshot をread境界に追加し、三画面でrelay候補入力とevent IDによる投稿・承認結合を共有する。初回3 relayの性能制約は保持するが、partial又はtimeout時の未観測承認は`unknown`として扱い、未承認と確定しない。限定再読取は未試行候補を最大3 relayずつ用い、EOSE又は候補枯渇で停止する。監査は主イベント10件のページングと、同じページの主イベントIDだけを対象にする最大10件の関連承認照会を分離する。

調査の根拠、対象範囲、受入条件は [承認状態不整合の調査と修正計画](../../docs/discussion/2026-07-10-009-approval-state-consistency-investigation.md) に記録する。

### 2026-07-11 承認画面の再読取・キャッシュ整合性フォローアップ

追加調査で、`/approve` は初回3 relayのstream結果をそのまま状態の正本として扱い、承認操作後の楽観更新も後続の空または古いstream結果で上書きされ得ることを確認した。`/naddr` は同じ承認イベントを別のcompletion-aware readで発見してキャッシュへrelay実績を追加するため、先に`/naddr`を開いた場合だけ`/approve`が承認済みになる経路が生じる。これはgateway API自体の違反ではなく、画面ごとのread境界と状態統合の不一致である。

修正では、共通moderation readを唯一の承認状態導出境界とし、`/approve`も投稿イベントを正本にして承認イベントを`e`タグで結合する。初回3 relayは維持し、承認未観測時は候補が尽きるまで限定再読取し、それでも確定できない場合は`unknown`を表示する。キャッシュの`attemptedRelayUrls`と、イベントを実際に返した`successfulRelayUrls`を分離し、問い合わせただけのrelayを成功実績として優先しない。承認操作後のローカルイベントはread結果へIDマージし、古いstream EOSEが承認済み状態を消さないようにする。

### 2026-07-11 全Discussion画面の承認整合性フォローアップ

追加調査で、一覧は承認イベント本文から投稿を復元し、管理・BusStopDiscussion・BusStopMemoは投稿streamと承認streamを独立に再構築していることを確認した。これらはrelay遅延・空結果・別event IDにより、承認済み投稿の欠落、未承認化、または別投稿の承認済み表示を起こし得る。評価画面も`post.approved`だけを入力にするため、上流の未観測状態を確定的な除外として伝播する。

Phase 9では、全Discussion表示面を共通moderation snapshotへ接続し、承認判定を投稿IDと`e`タグの一致に限定する。一覧・管理・BusStop系はprimary投稿readと対象投稿ID承認readを同一read世代で結合し、partial/timeout中は`unknown`を維持する。キャッシュ保存は全readでsource relay実績を用い、評価・集計は`approved`だけを確定入力としつつ`unknown`を再取得後に再評価できる状態にする。

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Next.js 15 App Router
**Primary Dependencies**: `@nostr-dev-kit/ndk`, DaisyUI 5, Tailwind CSS 4
**Storage**: Nostr relay（正本）、ブラウザ `sessionStorage`（暫定既知データとrelay実績）、SQLite/Prisma（対象外）
**Testing**: Jest, React Testing Library, TypeScript, ESLint
**Target Platform**: モダンブラウザ（デスクトップ・モバイル）
**Project Type**: Next.js単一Webアプリ
**Performance Goals**: 遅延relayがあっても詳細のメタデータを2秒以内に利用可能にし、初回relay数を既定3以下にする
**Constraints**: relay読み取りの範囲を画面目的ごとに限定する。`NDKRelaySet.fromRelayUrls()`を生成し、`ndk.subscribe()`のrelay set引数でreadごとに限定する。タイムアウトをNot Foundに変換しない。投稿・承認・評価の権限モデルを変更しない。
**Scale/Scope**: `src/lib/nostr`のread境界、Discussion一覧・詳細・承認・監査・編集画面、および関連テスト

## Constitution Check

*GATE: Pass before research and re-check after design.*

- [x] 明確な命名: `DiscussionReadPlan`、`DiscussionReadResult`、`RelayCandidateSelector`を利用し、画面用途とNostr通信を混在させない。
- [x] 単純なロジック: filter構築、relay選別、キャッシュ、UI状態を別モジュールに分ける。
- [x] 構造化: Nostr取得は`src/lib/nostr`、read planは`src/lib/discussion`、UI状態は`src/components/discussion`または各画面に置く。
- [x] 型安全性: `any`を使わず、完了理由と画面用途はunion型で表す。
- [x] テストファースト: read plan、relay選別、部分取得、監査ページング、既知データのテストを実装前に追加する。
- [x] アクセシビリティ: 状態変化は日本語の`role="status"`/`aria-live="polite"`で通知し、再読み込みは44px以上の操作対象にする。
- [x] 最終検証: `npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build`を実行する。

**Gate Result (Pre-Research)**: PASS

### Approval Consistency Design Decisions

- `discussionGateway.queryWithCompletion()`はcompletion、relay候補、重複排除を保持する通信境界として再利用する。009違反にならないよう、呼び出し側の全readで選別済み`relayUrls`を渡す。
- `/approve`のstreamを独自の承認状態計算に使わず、共通moderation snapshotの更新入力として扱う。投稿と承認の到着順で状態を確定しない。
- 承認イベント本文から投稿を再構成しない。投稿イベントをcanonical sourceとし、承認イベントの`e`タグが投稿IDに一致した場合だけ承認済みとする。
- 空の取得結果は既存の承認を削除する根拠にしない。read世代とイベントIDでマージし、明示的な撤回イベントの解決だけが承認を取り消す。
- `successfulEventRelayUrls`は対象イベントを返したrelayからのみ更新し、単に問い合わせたrelayは`attemptedRelayUrls`へ記録する。`NostrService`の`relayUrls`（問い合わせ対象）を成功実績として保存してはならず、`sourceRelayUrlsByEventId`から対象イベントの発見relayを導出する。旧`successfulRelays`は読み取り互換に限定し、新規保存しない。
- relay実績移行は、Layout/Audit、一覧/管理、BusStop系の3つのread境界単位に分割し、各単位でsource relayテストとキャッシュ再訪問テストを完了してから次へ進む。
- 一覧・管理・BusStopMemo・BusStopDiscussion・評価対象抽出もmoderation snapshotの利用者であり、独自の承認判定、承認本文からの投稿復元、空streamによる確定更新を実装してはならない。
- `audit-timeline-mapper`は監査表示の共通結合境界として扱い、`a`タグを承認照合キーに使わない。

## Project Structure

```text
src/
├── app/discussions/
│   ├── page.tsx
│   └── [naddr]/
│       ├── page.tsx
│       ├── approve/page.tsx
│       ├── audit/page.tsx
│       └── edit/page.tsx
├── components/discussion/
│   ├── DiscussionReadStatus.tsx
│   ├── DiscussionTabLayout.tsx
│   └── AuditLogSection.tsx
├── lib/discussion/
│   ├── discussion-read-plan.ts
│   ├── discussion-known-data-cache.ts
│   ├── discussion-moderation-snapshot.ts
│   └── relay-candidate-selector.ts
└── lib/nostr/
    ├── nostr-service.ts
    └── discussion-ndk-gateway.ts

specs/009-coracle-style-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/discussion-read-contract.md
└── tasks.md
```

**Structure Decision**: NDKの接続・購読実装は既存`NostrService`に維持し、画面目的別filterとrelay選別を`src/lib/discussion`へ追加する。UIは取得結果を表示するだけとし、filterやrelay URLを直接組み立てない。

### Relay Set and Strategy Configuration

`NostrService`は選別済みURLから`NDKRelaySet.fromRelayUrls(relayUrls, ndk)`を作り、各`ndk.subscribe(filter, options, relaySet)`へ渡す。最初の候補集合は最大3件であり、候補が不足する場合はread開始前に設定済みrelay、続いて既定relayを補ってから同じ上限内で作る。read開始後に全relayへ拡大する再試行はしない。

保守者向けの値は`src/lib/config/discussion-config.ts`の`DiscussionReadStrategyConfig`へ集約する。環境変数は`NEXT_PUBLIC_DISCUSSION_READ_RELAY_LIMIT`（既定3、許容1-3）、`NEXT_PUBLIC_DISCUSSION_READ_IDLE_TIMEOUT_MS`（未指定時は既存timeout）、`NEXT_PUBLIC_DISCUSSION_READ_HARD_TIMEOUT_MS`（idleより大きい値のみ採用）、`NEXT_PUBLIC_DISCUSSION_READ_DEDUP_WINDOW_MS`（既定250）を使う。通常利用者へ設定UIは提供しない。

### Measured Success Criteria

SC-001はJestの決定論的relay mockで20回試行し、3秒遅延relayと即時relayの組合せで19回以上が2秒以内にmetadataを表示できることを確認する。SC-006は既知メタデータがある再訪問を20回試行し、18回以上が1秒以内に暫定metadataを表示できることを確認する。計測は各テストで`performance.now()`を記録し、失敗回数と最大値を出力する。

## Phase 0 Research Output

`research.md`に、既存コードとCoracle/Welshman調査記録から確定した、少数relay・timeout・重複排除・既知データの扱いを記録する。

## Phase 1 Design & Contracts Output

- `data-model.md`: read plan、relay候補、取得結果、既知データ、UI状態の型・遷移。
- `contracts/discussion-read-contract.md`: 各画面のfilter、上限、relay優先順位、状態表示契約。
- `quickstart.md`: 遅延relay、重複、監査追加取得、再訪問の検証手順。

## Post-Design Constitution Re-Check

- [x] relay戦略は一箇所で調整でき、各画面に重複しない。
- [x] 既知データは暫定表示に限定し、relay結果で必ず訂正可能である。
- [x] タイムアウトは部分取得状態に変換され、Not Found確定と区別される。
- [x] アクセシビリティ確認とTDDがタスクに含まれる。
- [x] 承認画面の楽観更新、候補relay再読取、キャッシュの試行/成功分離、投稿ID結合をテスト計画に含める。
- [x] 一覧、管理、BusStop系、評価、監査mapperの承認結合とunknown保留をPhase 9のテスト・実装計画に含める。
- [x] read世代による古いEOSEの破棄、unknownの件数・UI契約、成功relayフィールド移行をPhase 9の計画に含める。

**Gate Result (Post-Design)**: PASS
