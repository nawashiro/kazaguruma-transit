# Docker構成

このプロジェクトは`compose.yml`で開発構成を、`compose.prod.yml`で本番構成を起動します。

## 起動前の設定

```bash
cp app-config.json.example app-config.json
cp .env.local.example .env.local
cp transit-config.json.example transit-config.json
chmod 600 .env.local transit-config.json
```

- `app-config.json`は配布先固有の公開設定です。Gitで管理しません。
- `.env.local`は開発用のサーバー設定です。`GOOGLE_MAPS_API_KEY`などの秘密値を置きます。
- `.env`は本番用のサーバー設定です。`compose.prod.yml`が読みます。
- `transit-config.json`はGTFS用のサーバー設定です。URL queryの秘密情報を含められるため、GitとDocker build contextへ入れません。

`app-config.json`がない場合、Dockerfileの検証でbuildが失敗します。Dockerfileはexampleをコピーしません。

## 開発Compose

`compose.yml`は次の構成を使います。

- `Dockerfile.dev`をBuildKitでbuildします。
- `.env.local`をcontainerの環境変数へ渡します。
- `NODE_ENV=development`と`DEBUG=true`を設定します。
- `npm run start`でcontainerを起動します。
- `transit-config.json`を`/app/transit-config.json`へread-only bind mountします。
- mountにSELinuxの`Z`ラベルを指定します。

```bash
docker compose up --build
```

この構成は`npm run dev`を実行しません。`npm run start`を実行するため、コード編集の自動反映を保証しません。コードを変更した後はbuildと起動を確認します。

## 本番Compose

`compose.prod.yml`は次の構成を使います。

- `Dockerfile.prod`をbuildします。
- `.env`をcontainerの環境変数へ渡します。
- `NODE_ENV=production`を設定します。
- `npm run start`でcontainerを起動し、停止後に再起動します。
- `transit-config.json`をread-only bind mountします。
- `cloudflared`を同じnetworkで起動し、`CLOUDFLARE_TUNNEL_TOKEN`を使います。

```bash
docker compose -f compose.prod.yml up --build -d
```

停止するときは次を実行します。

```bash
docker compose -f compose.prod.yml down
```

## BuildKit secret

`compose.yml`と`compose.prod.yml`はbuild secret `transit_config`へhostの`./transit-config.json`を渡します。

`Dockerfile.dev`と`Dockerfile.prod`は、次のbuild stepだけでsecretをmountします。

```dockerfile
RUN --mount=type=secret,id=transit_config,target=/app/transit-config.json,required=true npm run build
```

secretはimage layerへ保存しません。`.dockerignore`も`transit-config.json`をbuild contextから除外します。

## runtime mountの確認

Composeはbuild後のcontainerへ`transit-config.json`をread-onlyでmountします。アプリは読み取れますが、containerから秘密設定を書き換えません。

```yaml
volumes:
  - type: bind
    source: ./transit-config.json
    target: /app/transit-config.json
    read_only: true
    bind:
      selinux: Z
```

設定変更後は、該当するComposeコマンドを`--build`付きで再実行します。コード編集の自動反映を前提にしません。
