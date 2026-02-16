# Issue 33 コードレビュー

- Issue: https://github.com/nawashiro/kazaguruma-transit/issues/33
- 対象: 検索結果表示時に発生する Nostr リクエストの形式不整合（`#a` が naddr を含む）
- 期待: `#a` は `kind:pubkey:dTag` の hex 参照（例: `34550:...:-989250`）
- 実際: `#a` に `...:naddr1...` が混入し、承認イベントが取得できない

## 先に結論（最新コード前提）

- `normalizeDiscussionId` を中心に、`naddr` からの正規化と誤形式の拒否が実装済みで、Issue の再現経路は縮小されています。
- ただし、`#a` フィルタを UI で直接組み立てる箇所が複数あり、上流が壊れている場合の防波堤が不足しています。

## 主要な指摘（重大度順）

### High
該当なし（現行コードでは明確な再現経路を特定できず）

### Medium
1) UI で `#a` を直接構築する経路があり、正規化の境界が曖昧
- 現状は `getDiscussionConfig()` が正規化済みを返す前提だが、呼び出し側が誤った `discussionId` を渡した場合に UI でそのままフィルタを組み立てる経路が残る
- 参照: `src/components/discussion/BusStopMemo.tsx`, `src/components/discussion/BusStopDiscussion.tsx`, `src/components/discussion/AuditLogSection.tsx`, `src/app/discussions/[naddr]/approve/page.tsx`, `src/app/discussions/manage/page.tsx`

2) `parseDiscussionEvent` が `dTag` を検証せず `discussionId` を組み立てるため、異常値の伝播が起きうる
- `event.tags` に `dTag` として誤形式が混入すると、そのまま `discussionId` として UI に流通し、別箇所で `#a` として利用される可能性がある
- 参照: `src/lib/nostr/nostr-utils.ts`

### Low
3) `normalizeDiscussionId` が `:` / `naddr1` を含む `dTag` を拒否するため、NIP-33 の「自由な識別子」との互換性が下がる
- ポリシーとしては妥当だが、将来 dTag に `:` を含めたい場合に「静かに失敗」しやすい
- 参照: `src/lib/nostr/naddr-utils.ts`

4) 誤形式時の挙動がサイレントに空配列返却となり、障害検知が遅れる
- `normalizeDiscussionIdForRead` のエラーをログのみで潰し、UI 上は「データが無い」に見える
- 参照: `src/lib/nostr/nostr-service.ts`

## 既存の良い点（確認済み）

- `naddr` → `kind:pubkey:dTag` の正規化と `naddr` 混入の拒否が明示的にテストされている
- 参照: `src/lib/config/__tests__/discussion-config.test.ts`, `src/lib/nostr/__tests__/nostr-service.test.ts`, `src/lib/nostr/__tests__/nostr-utils.test.ts`

## 推奨アクション（非実装レビュー提案）

- `#a` を構築する前に必ず `normalizeDiscussionId` を通す小さなユーティリティを作り、UI/サービスの境界を統一する
- `parseDiscussionEvent` でも `normalizeDiscussionId` 相当の検証を追加し、異常値の流通を抑止する
- サイレント失敗の経路に UI での警告（もしくはメトリクス）を追加し、早期発見できるようにする

## 質問/前提（確認が必要）

- `dTag` に `:` を含む運用を将来許容する想定はあるか
- `discussionId` を UI に渡す経路で「正規化済みを保証する契約」が明文化されているか
