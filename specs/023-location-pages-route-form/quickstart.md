# 検証ガイド

## 前提

- Node.js 22.xを使う。現環境のNode.jsは`v26.5.1`なので、最終検証はNode.js 22.x環境でも再実行する。
- `app-config.json`を用意する。
- `transit-config.json`と必要な環境変数を用意する。
- 本番ビルドはDBを変更する既存`npm run build`を使わない。隔離コピーを使う。

## 単体・画面テスト

```bash
node node_modules/jest/bin/jest.js --runInBand --no-cache --watch=false --coverage=false
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run lint -- --no-cache
git diff --check
```

期待結果: すべて成功する。テストはURL parser、スナップショット生成、カテゴリ・詳細ページ、フォーム、GPS・名前検索失敗、既存の結果URL契約を含む。

## 生成データの確認

1. 正常fixtureで生成CLIを実行する。
2. JSONが全カテゴリ、全詳細施設、トップ候補、町字を含むことを確認する。
3. 取得失敗、形式不正、ID重複、カテゴリ衝突のfixtureごとにCLIが非zeroで終了し、直前の成果物を壊さないことを確認する。

## 隔離した本番生成

1. 作業ツリーを一時ディレクトリへ複製する。
2. fixtureを使って生成CLIを実行する。
3. `node node_modules/next/dist/bin/next build`を直接実行する。
4. `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3079`で起動する。
5. サーバー側とブラウザ側のCDNアクセスを拒否する。
6. 生成JSONのカテゴリ数・施設数と照合し、全カテゴリURL・全詳細URL・一覧URLを巡回する。
7. `node scripts/verify-location-pages.mjs --mode runtime --base-url http://127.0.0.1:3079`を実行する。

期待結果: 既知カテゴリ・詳細URLは`generateStaticParams`でSSGされた本文をHTTP 200で表示する。未知URLは`dynamicParams = false`によりHTTP 404の共通ページへ送られ、見出し「ページが見つかりません」、本文「お探しのページは見つかりませんでした。」を表示する。共通404に`/locations`への戻るリンクは設けない。施設CDN取得は発生しない。初回T057の隔離Next runtimeではsegment not-found/default 404でFAILだった。T060の`dynamicParams = true`とsafe decodeは当時の修正であり、現在の最終方針では採用しない。ユーザー修正後のfresh runtime PASSはまだ確認していない。

## 操作とアクセシビリティ

Chromiumを`/usr/bin/chromium`で起動する。

1. JavaScript無効で、一覧→カテゴリ→詳細→所属カテゴリのリンクを確認する。
2. `destination`だけ、全条件、値の重複、不正座標、不正日時、不正真偽値のURLを直接開く。
3. URLが保存値より優先し、有効値を消さないことを確認する。
4. 日時を先に操作し、候補選択、出発地選択、地点の「なおす」、送信を行う。無関係の入力が消えないことを確認する。
5. 429以外の検索失敗・GPS拒否時に、該当項目の案内と他入力の保持を確認する。
6. キーボードだけで各入力、ラジオ、候補、なおす、最終送信を完了する。編集後フォーカス、見えるラベル、項目別エラー、44px操作領域、320px幅を確認する。
