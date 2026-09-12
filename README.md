# 風ぐるま乗換案内

障害者・高齢者・支援者を対象に、地域福祉交通を利用した移動計画を支援するウェブアプリケーションです。

千代田区地域福祉交通「風ぐるま」利用者向けに、時刻表検索・ほかを提供しています。

[ライセンス](#%E3%83%A9%E3%82%A4%E3%82%BB%E3%83%B3%E3%82%B9)を守って好きに使ってください。

## 地域福祉交通とは

大手交通機関が定型な労働者とみなさない人のための移動手段のことです。

## だいじなこと（[constitution](docs/reference/constitution.md) 抜粋）

- ユーザーが必要に応じた目的地を選定できること。
- ユーザーが制約のある手段で無理のない移動計画を得られること。
- ユーザーが移動計画に含まれる障害を事前に得られること。

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

### 設定ファイル

次の3ファイルを置いてください。

```bash
cp app-config.json.example app-config.json
cp .env.local.example .env.local
cp transit-config.json.example transit-config.json
```

`秘密` と `公開` を分けます。`秘密` をコミットしないでください。`公開` に秘密情報を書かないでください。

| ファイル名 | 機密性 | 説明 |
| --- | --- | --- |
| `app-config.json` | 公開 | `appUrl`、`gaMeasurementId`、場所データのURI、会話設定、お知らせ、支援表示を設定します。 |
| `.env.local` | 秘密 | 開発サーバーの設定を置きます。`GOOGLE_MAPS_API_KEY`（必須）、`PUPPETEER_EXECUTABLE_PATH`（任意）を設定します。 |
| `transit-config.json` | 秘密 | GTFS取得URLを設定します。 |
| `.env` | 秘密 | 本番Composeの設定です。`CLOUDFLARE_TUNNEL_TOKEN`などの秘密値を設定します。 |

`app-config.json`がない場合、`npm run dev`、`npm test`、`npm run build`、`npm start`は非ゼロで終了します。Quality Gateだけが`app-config.json.example`を一時コピーし、設定として利用します。

## 開発

ビルド生成物を用意し、開発サーバーを起動します。

```bash
npm run build
npm run dev
```

反復してテストするときは、次のコマンドを使います。

```bash
npm run test:watch
```

経路検索は直通または最大1回乗換の経路を扱います。

## 生成artifact

`npm run build`の`prebuild`が`tsx scripts/generate-location-artifact.ts`を実行し、`app-config.json`の3つのデータURIから検証済みの`public/generated/location-data.json`を生成します。

`public/generated/location-data.json`は生成artifactです。直接編集せず、入力設定を変更して`npm run build`で再生成します。

## 目的別の文書

| 分類 | 目的 | 入口 |
| --- | --- | --- |
| how-to | Google Analytics設定 | [analytics](docs/how-to/analytics.md) |
| how-to | Docker開発・本番構成 | [docker-setup](docs/how-to/docker-setup.md) |
| how-to | SEOの現行実装 | [seo-optimization](docs/how-to/seo-optimization.md) |
| how-to | ライセンス情報の更新 | [license-page](docs/how-to/license-page.md) |
| reference | 開発憲章 | [constitution](docs/reference/constitution.md) |
| reference | ディスカッションの実装事実 | [discussion reference](docs/reference/discussion.md) |
| reference | 評価機能の実装事実 | [evaluation function reference](docs/reference/evaluation-function.md) |
| reference　| 文書執筆規範 | [writing-style](docs/reference/writing-style.md) |
| reference　| 技術スタック | [technology-stack](docs/reference/technology-stack.md) |
| explanation | UI設計の背景 | [frontend design](docs/explanation/frontend-design.md) |

## Quality Gate

[`.github/workflows/quality-gate.yml`](.github/workflows/quality-gate.yml)は`dev`または`master`へのpushとPull Requestを検査します。Node.js 22.xを使い、設定ファイルを一時準備し、`npm ci`、ESLint、strict TypeScript、`npm run build`、production serverの起動、Jestを実行します。

Pull Request後は、最新commitに対する`Quality Gate`のCheckが完了し、成功したことを確認します。失敗時は対象commitとworkflow logを確認してから修正します。

## ライセンス

本ソフトウェアのライセンスは[AGPL-3.0](LICENSE)です。非規範な日本語訳は[こちら](https://gpl.mhatta.org/agpl.ja.html)をご覧ください。
