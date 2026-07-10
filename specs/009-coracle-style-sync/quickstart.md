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
5. naddr hint上位3 relayには承認がなく、configured又は成功実績relayだけにkind 4550があるfixtureで、詳細、承認、監査のすべてが同じ承認済み状態になることを確認する。
6. 上記fixtureで候補relayがtimeoutした場合、詳細・承認画面が「未承認」と断定せず、部分取得又は承認情報確認中と表示することを確認する。
7. 承認の作成時刻が表示対象の投稿10件より古いfixtureでauditを開き、投稿IDに結び付く承認状態が表示されることを確認する。

## Verification Record

2026-07-10に以下を実行した。

- `npx tsc --noEmit`: 成功
- `npm test -- --runInBand`: 成功（既存のReact `act`警告とlint警告はあるが、テスト失敗なし）
- `npm run lint`: 成功（既存の警告のみ）
- `npm run build`: 成功

監査ログのテストでは初回・追加readとも`limit: 10`、追加readは前ページ最古イベントより古い`until`を使用することを確認済み。read planのrelay上限は1-3に範囲検証され、relay hintと設定relayから選別される。
