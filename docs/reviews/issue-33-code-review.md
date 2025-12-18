# Issue 33 コードレビュー

- Issue: https://github.com/nawashiro/kazaguruma-transit/issues/33
- 対象: 検索結果表示時に発生する Nostr リクエストの形式不整合（`#a` が naddr を含む）
- 期待: `#a` は `kind:pubkey:dTag` の hex 参照（例: `34550:...:-989250`）
- 実際: `#a` に `...:naddr1...` が混入し、承認イベントが取得できない

## 主要な指摘（重大度順）

### High
1) `resolveDiscussionId` が `:` を含む文字列を「既に正規化済み」とみなして無条件で通すため、`34550:pubkey:naddr1...` のような誤形式が温存される
- 影響: UI 側が誤形式を生成した場合でも、正規化が一切行われず `#a` の検索が外れる
- 参照: `src/lib/config/discussion-config.ts:24`

2) 参照系の取得 API が `discussionId` を正規化せずそのまま `#a` フィルタに投入している
- 影響: 呼び出し元が naddr/nostr URI/誤形式を渡すと、Issue 33 のように `#a` が壊れる
- 不整合: `getCommunityPostsToDiscussionList` だけが naddr 変換済みで、他の取得系が放置されている
- 参照: `src/lib/nostr/nostr-service.ts:240`, `src/lib/nostr/nostr-service.ts:263`, `src/lib/nostr/nostr-service.ts:276`, `src/lib/nostr/nostr-service.ts:291`, `src/lib/nostr/nostr-service.ts:330`, `src/lib/nostr/nostr-service.ts:783`

### Medium
3) `discussionId` のフォーマット検証が読み取り側・解析側に無く、誤形式が連鎖的に伝播する
- `parsePostEvent` / `parseApprovalEvent` は `discussionId` を「値があれば良い」と判断し、ID の妥当性を見ていない
- 参照: `src/lib/nostr/nostr-utils.ts:32`, `src/lib/nostr/nostr-utils.ts:82`

4) 仕様に対するテストが不足しており、`naddr` → `kind:pubkey:dTag` の変換漏れが検出できない
- 変換の単体テストはあるが、`#a` フィルタに渡す値が正しい形式かを保証するテストが無い
- 参照: `src/lib/nostr/__tests__/naddr-utils.test.ts`

## 追加の懸念点（第三者視点）

- 変換の責務がコンポーネント側に散在しているため、実装者が「どこで正規化されるか」を誤解しやすい
- 正規化の責務がどこにも一元化されていないため、今後の修正でも同種のバグが再発しやすい

## 推奨アクション（非実装レビュー提案）

- `discussionId` を「読み取り API の入口で必ず正規化する」方針に統一し、naddr/nostr URI/誤形式を明示的に弾く
- `resolveDiscussionId` で `kind:pubkey:dTag` の厳密検証を行い、`naddr1...` を含む形式をエラー扱いにする
- `#a` フィルタに渡される値を検証するテスト（特にバス停検索／メモ表示の経路）を追加する

## 質問/前提（確認が必要）

- `NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID` に `naddr` ではなく `nostr:naddr` を渡す運用は存在するか
- 既存データに `dTag` として `naddr` 文字列が紛れ込んでいないか（既存イベントの棚卸し）
