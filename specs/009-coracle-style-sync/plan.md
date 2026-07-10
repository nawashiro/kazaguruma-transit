# Implementation Plan: Coracle-Style Selected Partial Sync

**Branch**: `009-coracle-style-sync` | **Date**: 2026-07-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/009-coracle-style-sync/spec.md`

## Summary

Discussion/Nostr画面の取得を、画面目的別の小さな read plan に統一する。既存の NDK gateway、completion-aware read、ID重複排除を再利用し、relay候補の選別、取得結果の観測、ブラウザ内の既知データ、部分取得状態の表示を追加する。NIP-01/09/25/72のイベント解釈、投稿・承認・評価・モデレーターの権限判定は変更しない。

### 2026-07-10 承認状態整合性フォローアップ

009完了後の調査で、詳細・承認・監査が異なるrelay候補と異なる投稿復元経路を使用し、同一のkind 4550承認を相反して表示できることを確認した。フォローアップでは、共通の moderation snapshot をread境界に追加し、三画面でrelay候補入力とevent IDによる投稿・承認結合を共有する。初回3 relayの性能制約は保持するが、partial又はtimeout時の未観測承認は`unknown`として扱い、未承認と確定しない。監査は主イベント10件のページングと関連承認照会を分離する。

調査の根拠、対象範囲、受入条件は [承認状態不整合の調査と修正計画](../../docs/discussion/2026-07-10-009-approval-state-consistency-investigation.md) に記録する。

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

**Gate Result (Post-Design)**: PASS
