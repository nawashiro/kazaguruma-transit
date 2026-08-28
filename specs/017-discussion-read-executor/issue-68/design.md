# Issue #68 relay候補入力の簡素化設計

## 目的

`/discussions` と `/settings` の read 経路で、relay候補源の扱いが暗黙に異なる問題を解消する。共通 read 層が `hints`、`recommended`、`successful`、`configured`、`defaults` の意味を知る構造をやめ、各 Provider が利用する relay URL の順序を決定する。

## 現状の問題

`DiscussionReadExecutor` は複数の候補源を受け取り、候補の優先順位と初回・retry の分割を内部で行っている。`DiscussionManagementDataProvider` は一覧 NADDR の relay hint をこの候補源へ渡しているため、`/discussions` の掲載投稿 read が設定 relay より先に一覧 NADDR の hint relay を読む。

この結果、hint relay が `EOSE` で空結果を返すと、executor の仕様上、設定 relay への retry は行われない。`/settings` は設定 relay を直接読むため、同じ kind 34550 が画面間で異なる結果になる。

## 設計方針

### 1. 共通 read API は順序済み relay URL だけを受け取る

`executeDiscussionRead` の入力を次へ単純化する。

```ts
interface ExecuteDiscussionReadInput {
  plan: DiscussionReadPlan;
  relayUrls: string[];
  onAttemptComplete?: (attempt: RelayAttempt) => void;
}
```

executor の責務は次に限定する。

- 渡された relay URL の順序を保持する
- 初回最大3件と retry 最大3件へ分割する
- completion-aware read を実行する
- event、relay provenance、attempt を統合する

relay URL の意味、候補源、優先順位は解釈しない。

### 2. Read plan から relay hint を削除する

`DiscussionReadPlan` は filter と timeout を表す値とし、relay URL を保持しない。`createDiscussionReadPlan` の `relayHints` 引数も削除する。

### 3. Moderation snapshot は Provider が決めた relay URL を受け取る

`loadDiscussionModerationSnapshot` の入力は `relayUrls: string[]` とする。掲載投稿 read と承認 read は、同じ Provider が決めた URL 列を使う。

snapshot 層は候補源を順位付けしない。`relay-candidate-selector.ts` の `rankRelayCandidates` を snapshot、executor、Provider の共通自動選択に使わない。

### 4. Provider が relay 方針を決める

- `/discussions` の `DiscussionManagementDataProvider` は、一覧 NADDR の relay hint を掲載投稿 read の候補に入れない。設定済み read relay を URL 配列として渡す。
- `/settings` は既存どおり設定済み read relay を渡す。
- 個別会話の Provider/page は、現在の挙動を維持する必要がある場合、NADDR hint・cache 成功 relay・設定 relay の順序をその Provider 内で明示的に組み立てる。
- 共通層へ候補源の名前を再導入しない。

### 5. 既存の通信契約を維持する

次は変更しない。

- 初回最大3 relay、retry 最大3 relay
- 初回 `EOSE` 後は retry しない既存仕様
- timeout、completion reason、attempt 履歴
- source relay provenance
- pending read coalescing
- 置換可能イベントの canonical deduplication

今回変更するのは、候補源を共通層へ渡す契約と `/discussions` Provider の relay URL 選択だけである。

## 受入条件

- `DiscussionReadPlan` に `relayHints` が存在しない。
- `executeDiscussionRead` に候補源配列を渡さず、Provider が決めた `relayUrls` だけを受け取る。
- `loadDiscussionModerationSnapshot` に `hints`、`recommended`、`successful`、`configured`、`defaults` を渡さない。
- `/discussions` の掲載投稿 read は一覧 NADDR の relay hint に依存しない。
- executor の初回・retry分割、イベント統合、provenance が既存どおり動作する。
- 全ての既存 executor 利用箇所が新しい契約へ移行する。
- 関連テスト、型検査、lint、全テストが成功する。

## スコープ外

- `EOSE` 空結果時の retry 規則変更
- relay の障害判定や健康度モデルの追加
- 新しい relay 候補選択抽象化の導入
- `/discussions` の表示条件（掲載投稿、qタグ、承認）の変更
- `relay-candidate-selector.ts` の既存単体テストを、今回の契約変更以上に拡張すること
