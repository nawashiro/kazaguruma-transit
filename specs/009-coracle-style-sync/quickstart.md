# Quickstart Validation

## Prerequisites

```bash
cd /home/navi/kazaguruma-transit
npm ci
cp transit-config.json.example transit-config.json # 未作成の場合
```

`.env.local`にDiscussion用のrelay設定を入れ、`NEXT_PUBLIC_DISCUSSIONS_ENABLED=true`にする。

## Automated Validation

```bash
npm test -- discussion-read-plan relay-candidate-selector
npm test -- page.streaming AuditLogSection
npx tsc --noEmit
npm run lint
npm test
npm run build
```

期待値:

1. 同一イベントIDを複数relayが返しても結果は1件。
2. timeoutは`partial`または`unavailable`で、Not Foundではない。
3. auditの初回・追加filterは`limit: 10`で、追加時に前ページより古い`until`を持つ。
4. 既知メタデータは初期表示されるが、relay結果で更新される。

## Manual Validation

```bash
npm run dev
```

1. 会話詳細を開き、遅延relayを模したテストでタイトル・ナビゲーションを先に確認する。
2. 部分取得の日本語メッセージと`再読み込み`をキーボード・スクリーンリーダーで確認する。
3. 監査画面で`さらに過去10件を表示`を実行し、ブラウザログで新しい`until`と`limit: 10`を確認する。
4. 同じ会話を再訪問し、暫定メタデータが先に表示され、その後relay取得で更新されることを確認する。
