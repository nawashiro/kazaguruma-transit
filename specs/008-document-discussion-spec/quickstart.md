# Quickstart - Discussion NDK Migration

## Goal

`nostr-tools`依存を撤去し、discussion機能をNDK中心へ移行する。  
UIはDaisyUI責務を優先し、独自UIの役割重複を禁止する。

## 1. Preparation

1. 依存追加・整理
   - `@nostr-dev-kit/ndk` を導入
   - `nostr-tools` を依存から削除
2. 影響調査
   - `rg -n "nostr-tools" src`
   - `rg -n "from .*lib/nostr" src --glob '!src/lib/nostr/**'`
3. 既存NIP要件確認
   - `docs/discussion/NIP-01.md`
   - `docs/discussion/NIP-18.md`
   - `docs/discussion/NIP-25.md`
   - `docs/discussion/NIP-72.md`

## 2. Implementation Order (TDD)

1. 失敗テスト追加（Red）
   - `nostr-tools` importゼロ検証テスト/静的チェック
   - NIP契約テスト（kind/tag/content）
   - 監査ログ10件ページング仕様テスト
2. NDK Gateway実装（Green）
   - 接続/購読/発行/署名をNDK APIで統合
   - UI層へはDTOのみ返却
3. 呼び出し側移行
   - `src/lib/discussion`
   - `src/lib/auth`
   - `src/app/discussions/**`
   - `src/components/discussion/**`
   - `src/types/discussion.ts`
4. DaisyUI責務統一
   - 承認/監査/管理UIで`disabled + 理由文`を統一
   - loading/empty/errorの表示要件を全対象画面へ適用
5. リファクタ（Refactor）
   - `src/lib/nostr`外のNostrロジック除去
   - 命名/コメント/型の見直し

## 3. Communication Flow Verification

対象ユースケースごとに次の通信フローを確認する:

1. UIイベント（例: 投稿承認ボタン押下）
2. UseCase層がNDK Gatewayメソッド呼び出し
3. NDKがrelayへpublish/subscribe
4. 応答イベントをGatewayでDTO化
5. UI状態更新（success/error + DaisyUI表現）

最低確認対象:

- 会話作成
- 掲載申請（kind:1111、`a`/`q`タグが揃うこと）
- 投稿承認/撤回
- 昇格申請/審査（kind:1111、`t=moderator-request` + `a`/`p`タグで通常投稿と区別できること）
- 会話編集画面（全ユーザー閲覧可）で現在モデレーター（Mnemonic code）と昇格申請ユーザー一覧を閲覧できること
- 会話作成者のみが会話編集画面でモデレーター追加・削除できること
- 会話一覧監査ログでは掲載申請 requested と昇格申請 requested を追跡できること
- 会話詳細監査ログでは投稿 submitted と昇格申請 requested を追跡できること
- 監査画面では承認済み/未承認をイベント種別ではなくコンテンツ修飾として表示できること
- 監査画面で承認済み表示時に承認者のMnemonic codeを表示できること
- 表示するMnemonic codeがBIP39日本語で、先頭3フレーズのみであること
- 監査ログ初回10件 + 追加10件読込
- FR-008の合意形成分析は既存 `evaluationService.analyzeConsensus` を再利用し、新規アルゴリズム実装なしで表示回帰を確認すること

## 4. UI Verification (DaisyUI First)

- ボタン: `btn`系列で状態表示、独自ボタン禁止
- タブ: `tabs` または `join`
- モーダル: `modal`
- フォーム: `input`, `textarea`, `select`, `checkbox`
- ステータス: `alert`, `badge`, `loading`
- タイムライン: DaisyUI提供コンポーネント優先
- ページング: DaisyUIのButton/Join構成で実装

## 5. Exit Criteria

1. `rg -n "nostr-tools" src` が0件
2. `npx tsc --noEmit` 成功
3. `npm run lint` 成功
4. `npm test` 成功
5. `npm run build` 成功
6. 主要NIP契約テストが全件成功

## Addendum (2026-03-01): 読込完了判定の検証

- 初回読込でEOSE未着でも無期限待機しないことを確認する。
- 受信状態を次の3種類で識別してログ出力する:
  - 逐次受信中（イベント到着継続）
  - 沈黙待機中（イベント未到着/長時間未更新）
  - 完了（`completionReason` 付き）
- `completionReason` は `eose` / `idle-timeout` / `hard-timeout` / `cancelled` を使用する。
- `Not Found` は `completionReason` と受信件数に基づいて確定し、単純タイムアウトのみで確定しない。
- 監査ログの 10件再クエリ要件（FR-021/FR-024）は従来どおり維持する。
- 詳細運用は [`notes/eose-and-timeout-observability.md`](/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/notes/eose-and-timeout-observability.md) を参照。
