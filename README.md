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

`秘密` と `公開` を分けます。`秘密` をコミットしないでください。`公開` に秘密情報を書かないでください。

記入例は `${filename}.example` のファイルをご覧ください。

| ファイル名 | 機密性 | 説明 |
| --- | --- | --- |
| `app-config.json` | 公開 | アプリの各種設定です。提供URL、Google Analytics、場所データのURI、会話設定、お知らせ、支援表示を設定します。 |
| `.env.local` | 秘密 | 開発サーバーの設定です。`GOOGLE_MAPS_API_KEY`（必須）、`PUPPETEER_EXECUTABLE_PATH`（任意）を設定します。 |
| `transit-config.json` | 秘密 | GTFS取得URLを設定します。 |
| `.env` | 秘密 | 本番サーバーの設定です。`CLOUDFLARE_TUNNEL_TOKEN`などの秘密値を設定します。 |

設定ファイルがない場合、`npm run dev`、`npm test`、`npm run build`、`npm start`は非ゼロで終了します。

## 開発

ビルド生成物を用意し、開発サーバーを起動します。

```bash
npm run build # サーバー起動にはビルド生成物が必要
npm run dev
```

反復してテストするときは、次のコマンドを使います。

```bash
npm run test:watch
```

経路検索は直通または最大1回乗換の経路を扱います。

## 目的別の文書

| 分類 | 目的 |
| --- | --- |
| how-to | [Google Analytics設定](docs/how-to/analytics.md) |
| how-to | [Docker開発・本番構成](docs/how-to/docker-setup.md) |
| how-to | [SEOの現行実装](docs/how-to/seo-optimization.md) |
| how-to | [ライセンス情報の更新](docs/how-to/license-page.md) |
| reference | [開発憲章](docs/reference/constitution.md) |
| reference | [ディスカッションの実装事実](docs/reference/discussion.md) |
| reference | [評価機能の実装事実](docs/reference/evaluation-function.md) |
| reference　| [文書執筆規範](docs/reference/writing-style.md) |
| reference　| [技術スタック](docs/reference/technology-stack.md) |
| reference | [WCAG 2.2チェックリスト](docs/reference/accessibility/wcag-22-checklist.md) |
| reference | [ウェブアクセシビリティ方針](docs/reference/accessibility/web-accessibility-policy.md) |
| reference | [画面遷移設計](docs/reference/screen-transition-design.md) |
| explanation | [UI設計の背景](docs/explanation/frontend-design.md) |
| explanation | [Polisに着想を得た合意分析](docs/explanation/polis-consensus-algorithm.md) |
| explanation | [Polisの理論背景と本アプリの適用範囲](docs/explanation/polis-consensus-whitepaper.md) |

## Quality Gate

[`.github/workflows/quality-gate.yml`](.github/workflows/quality-gate.yml)は`dev`または`master`へのpushとPull Requestを検査します。

- Node.js 22.x
- 設定ファイルを一時準備
- `npm ci`
- ESLint
- strict TypeScript
- `npm run build`
- production serverの起動
- Jest

## ライセンス

本ソフトウェアのライセンスは[AGPL-3.0](LICENSE)です。非規範な日本語訳は[こちら](https://gpl.mhatta.org/agpl.ja.html)をご覧ください。
