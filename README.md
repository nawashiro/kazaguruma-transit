# 風ぐるま乗換案内

千代田区の地域福祉交通「風ぐるま」の経路検索と時刻表を提供する非公式ウェブアプリです。

## 前提

- Git
- Node.js 22.x
- npm

## 初回準備

### Cloneと依存関係

```bash
git clone https://github.com/nawashiro/kazaguruma-transit
cd kazaguruma-transit
git switch dev
npm ci
```

既存のcheckoutでは、変更前に状態を確認します。

```bash
git status --short --branch
git switch dev
git pull --ff-only origin dev
git switch -c docs/<short-task-name>
```

### 設定ファイル

公開設定とサーバー設定を分けます。

```bash
cp app-config.json.example app-config.json
cp .env.local.example .env.local
cp transit-config.json.example transit-config.json
```

- `app-config.json`に配布先の`appUrl`、`gaMeasurementId`、場所データのURI、会話設定、お知らせ、支援表示を設定します。このファイルは公開設定ですが、Gitで管理しません。
- `.env.local`にサーバー専用の設定を置きます。少なくとも`GOOGLE_MAPS_API_KEY`を設定し、必要に応じて`PUPPETEER_EXECUTABLE_PATH`を追加します。
- `transit-config.json`にGTFS取得設定を置きます。URL queryに秘密情報を含められるため、Git、公開JSON、client bundleへ入れません。
- 本番Composeは`.env`を読みます。`CLOUDFLARE_TUNNEL_TOKEN`などの秘密値を`.env`へ置き、リポジトリへ保存しません。

`app-config.json`がない場合、`npm run dev`、`npm test`、`npm run build`、`npm start`は非ゼロで終了します。これらのコマンドは`app-config.json.example`から自動生成しません。Quality Gateだけがcheckout内へ一時コピーを作ります。

### 変更前の検証

設定ファイルを用意した後、変更前の状態で次を実行します。

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm test -- --runInBand --ci
```

## 開発

```bash
npm run dev
```

`npm run dev`は`app-config.json`の存在を確認し、Prisma Clientを生成してTurbopackを起動します。`predev`は場所データartifactを生成しません。`public/generated/location-data.json`がない場合は、先に`npm run build`を実行します。

反復してテストするときは、次のコマンドを使います。

```bash
npm run test:watch
```

経路検索は直通または最大1回乗換の経路を扱います。

## 生成artifact

`npm run build`の`prebuild`が`tsx scripts/generate-location-artifact.ts`を実行し、`app-config.json`の3つのデータURIから検証済みの`public/generated/location-data.json`を生成します。

`public/generated/location-data.json`は生成artifactです。直接編集せず、入力設定を変更して`npm run build`で再生成します。

## 目的別の文書

| 目的 | 入口 |
| --- | --- |
| 開発、OpenSpec、検証 | [development-workflow](docs/how-to/development-workflow.md) |
| Google Analytics設定 | [analytics](docs/how-to/analytics.md) |
| Docker開発・本番構成 | [docker-setup](docs/how-to/docker-setup.md) |
| SEOの現行実装 | [seo-optimization](docs/how-to/seo-optimization.md) |
| ライセンス情報の更新 | [license-page](docs/how-to/license-page.md) |
| ディスカッションの実装事実 | [discussion reference](docs/reference/discussion.md) |
| 評価機能の実装事実 | [evaluation function reference](docs/reference/evaluation-function.md) |
| UI設計の背景 | [frontend design](docs/explanation/frontend-design.md) |
| 開発原則 | [constitution](docs/reference/constitution.md) |
| 文書執筆規範 | [writing-style](docs/reference/writing-style.md) |
| 技術スタック | [technology-stack](docs/reference/technology-stack.md) |

開発原則、執筆規範、技術スタックは対応する正本を参照します。履歴資料を現行仕様の入口にしません。

## Quality Gate

[`.github/workflows/quality-gate.yml`](.github/workflows/quality-gate.yml)は`dev`または`master`へのpushとPull Requestを検査します。Node.js 22.xを使い、設定ファイルを一時準備し、`npm ci`、ESLint、strict TypeScript、`npm run build`、production serverの起動、Jestを実行します。

Pull Request後は、最新commitに対する`Quality Gate`のCheckが完了し、成功したことを確認します。失敗時は対象commitとworkflow logを確認してから修正します。

## ライセンス

本ソフトウェアのライセンスは[AGPL-3.0](LICENSE)です。
