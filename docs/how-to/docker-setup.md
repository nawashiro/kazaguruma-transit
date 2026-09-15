# Docker構成

このプロジェクトは`compose.yml`で開発構成を、`compose.prod.yml`で本番構成を起動します。

## 起動前の設定

凡例をコピーし、秘密を含むファイルの権限を狭めてください。

```bash
cp app-config.json.example app-config.json
cp .env.local.example .env.local
cp transit-config.json.example transit-config.json
chmod 600 .env.local transit-config.json
```

設定を書き込んでください。

- `app-config.json`はクライアント設定です。公開されるので、秘密を書かないでください。
- `.env.local`は開発用のサーバー設定です。`GOOGLE_MAPS_API_KEY`などの秘密値を置きます。本番では必要ありません。
- `.env`は本番用のサーバー設定です。`compose.prod.yml`が読みます。開発では必要ありません。
- `transit-config.json`はGTFS用のサーバー設定です。URL queryの秘密情報を含められるため、GitとDocker build contextへ入れません。

設定ファイルがない場合、buildが失敗します。

## 開発Compose

`compose.yml`は以下に注意してください。

- `.env.local`をcontainerの環境変数へ渡します。
- `NODE_ENV=development`と`DEBUG=true`を設定します。

以下のコマンドで開発コンテナをビルド・起動します。

```bash
docker compose up --build
```

この構成は`npm run dev`を実行しません。`npm run start`を実行するため、コード編集の自動反映を保証しません。コードを変更した後はbuildと起動を確認します。

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
