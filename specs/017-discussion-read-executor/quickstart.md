# 検証手順

## 前提

1. リポジトリのrootで実行する。
2. `dev`が最新であることを確認する。
3. Node.js依存関係を利用可能にする。

## RED確認

実装前に次の回帰テストを追加して失敗を確認する。

```bash
npm test -- --runInBand src/lib/nostr/__tests__/nostr-service.test.ts
npm test -- --runInBand src/lib/discussion/__tests__/discussion-read-executor.test.ts
npm test -- --runInBand src/components/discussion/__tests__/DiscussionManagementDataProvider.test.tsx
npm test -- --runInBand src/app/settings/__tests__/page.streaming.test.tsx
```

確認項目:

- filter配列が一つのNDK購読になる。
- 複数`q` tagが一つのread planへ結合される。
- 初回timeout後に次候補最大3relayへ一度だけretryする。
- 初回eventsを保持したままretry eventsを結合する。
- retry EOSEが部分取得表示を解除する。
- `/settings`、`/discussions`、詳細、承認、編集、管理がexecutorを使う。

## GREEN確認

```bash
npm test -- --runInBand src/lib/nostr/__tests__/nostr-service.test.ts
npm test -- --runInBand src/lib/discussion/__tests__/discussion-read-executor.test.ts
npm test -- --runInBand src/components/discussion
npm test -- --runInBand src/app/settings src/app/discussions
npm run lint
npx tsc --noEmit
npm run build
```

## 手動確認

1. relay hintだけを無応答にするfixtureを使う。
2. 次候補relayだけから掲載投稿とkind 34550を返す。
3. `/discussions`を開く。
4. 初回結果または部分取得状態を確認する。
5. retry後に会話が表示され、EOSEなら警告が消えることを確認する。
6. `/settings`、詳細、承認、編集、管理でも同じ状態表示と再読み込み動作を確認する。

## 対象外確認

- page分割を追加しない。
- 続き取得を追加しない。
- filter数上限を追加しない。
