# Docker構成

このプロジェクトは`compose.yml`で開発構成を、`compose.prod.yml`で本番構成を起動します。

Prisma 7でのキャッシュの扱いは[交通キャッシュの再生成](rebuild-transit-cache.md)を参照してください。Dockerfileは依存導入前にschemaを配置し、`npm ci`でクライアントを生成します。

## 起動前の設定

凡例をコピーし、秘密を含むファイルの権限を狭めてください。

```bash
cp app-config.json.example app-config.json
cp .env.local.example .env.local
cp transit-config.json.example transit-config.json
chmod 600 .env.local transit-config.json
```

設定を書き込んでください。設定ファイルがない場合、buildが失敗します。

以下は外部に公開される設定です。秘密を書かないでください。

- `app-config.json`: クライアントアプリ設定です。

以下は秘密を含む設定です。コミットをしないでください。権限を狭めてください。

- `.env.local`: 開発用のサーバー設定です。`GOOGLE_MAPS_API_KEY`などの秘密値を置きます。本番では必要ありません。
- `.env`: 本番用のサーバー設定です。`compose.prod.yml`が読みます。開発では必要ありません。
- `transit-config.json`: GTFS用のサーバー設定です。本番でも開発でも必要です。

## 開発Compose

`compose.yml`は以下に注意してください。

- `.env.local`をcontainerの環境変数へ渡します。
- `NODE_ENV=development`と`DEBUG=true`を設定します。

以下のコマンドで開発コンテナをビルド・起動します。

```bash
docker compose up --build
```

この構成は`npm run dev`を実行しません。`npm run start`を実行するため、コード編集の自動反映を保証しません。コードを変更した後はbuildと起動をやり直してください。。

## 本番Compose

`compose.prod.yml`は以下に注意してください。

- `.env`をcontainerの環境変数へ渡します。
- `NODE_ENV=production`を設定します。
- `cloudflared`を同じnetworkで起動し、`CLOUDFLARE_TUNNEL_TOKEN`を使います。

以下のコマンドで本番コンテナをビルド・起動します。

```bash
docker compose -f compose.prod.yml up --build -d
```

停止するときは次を実行します。

```bash
docker compose -f compose.prod.yml down
```

## セキュリティ更新時の再取得と確認

本番設定を用意した環境で、ベースイメージと Chrome を取得し直してください。通常のビルドでは取得処理のキャッシュを再利用する場合があり、`--no-cache` だけではベースイメージを再取得しません。

```bash
docker compose -f compose.prod.yml build --pull --no-cache app
docker compose -f compose.prod.yml run --rm --no-deps app node --version
docker compose -f compose.prod.yml run --rm --no-deps app google-chrome-stable --version
```

Node.js は 22 系の 22.23.4 以上であることを確認してください。Chrome は実バージョンを[公式 stable 更新情報](https://chromereleases.googleblog.com/search/label/Stable%20updates)と照合してください。確認日時と両方のバージョンを記録し、生成イメージ内の Chrome で PDF を生成して内容と用紙設定を確認してください。

確認したイメージを本番へ反映するときは、コンテナを再作成してください。

```bash
docker compose -f compose.prod.yml up -d --no-build --force-recreate app
docker compose -f compose.prod.yml exec -T app node --version
docker compose -f compose.prod.yml exec -T app google-chrome-stable --version
```

稼働コンテナでも修正条件を満たすことを確認し、日時とバージョンを記録してください。地図、画像表示、PDF 出力を確認してから反映完了としてください。起動時には GTFS の取込が走ります。

Docker または本番設定がない環境では、イメージのビルド、Chrome と PDF の互換性、本番反映を未実施と記録してください。アプリのローカル検証だけでは本番の修正完了を確認できません。古いイメージへ戻すと修正前の脆弱性も復帰します。ロールバックしても DB の以前の状態への復帰は保証されません。
