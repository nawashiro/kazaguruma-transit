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
8. `/approve`で承認操作後に空のstream EOSEを返すfixtureを使い、楽観的な承認済み表示が未承認へ戻らないことを確認する。
9. キャッシュを削除して再読み込みし、承認イベントを返したrelayが候補に含まれるまで`unknown`または再読取状態になり、候補枯渇後だけ未承認になることを確認する。
10. 問い合わせただけでイベントを返さないrelayが成功実績へ保存されず、イベント発見元relayだけが次回候補の成功実績になることを確認する。
11. 一覧、管理、BusStopDiscussion、BusStopMemoで同一primary投稿と承認`e`タグを返すfixtureを使い、詳細・承認・監査を含む全画面の承認状態が一致することを確認する。
12. 承認イベントを初回候補外relayだけに配置し、候補追加read後に各画面が`unknown`から`approved`へ更新されることを確認する。
13. 同一会話の別投稿を指す承認（`a`一致、`e`不一致）を監査mapperへ渡し、承認済み偽陽性が発生しないことを確認する。
14. 承認read遅延中のBusStop表示と評価画面で、投稿が未承認・空結果として確定除外されず、承認完了後に評価・統計へ反映されることを確認する。
15. 管理・BusStop系で承認・撤回権限と、重複イベント3件の表示件数1件を回帰確認する。

## Verification Record

2026-07-10に以下を実行した。

- `npx tsc --noEmit`: 成功
- `npm test -- --runInBand`: 成功（既存のReact `act`警告とlint警告はあるが、テスト失敗なし）
- `npm run lint`: 成功（既存の警告のみ）
- `npm run build`: 成功

2026-07-11の承認状態整合性フォローアップで以下も実行した。

- `npx tsc --noEmit`: 成功
- `npm test -- --runInBand`: 成功（365テスト成功、既存警告のみ）
- `npm run lint`: 成功（既存警告のみ）
- `npm run build`: 成功

監査ログのテストでは初回・追加readとも`limit: 10`、追加readは前ページ最古イベントより古い`until`を使用することを確認済み。read planのrelay上限は1-3に範囲検証され、relay hintと設定relayから選別される。
