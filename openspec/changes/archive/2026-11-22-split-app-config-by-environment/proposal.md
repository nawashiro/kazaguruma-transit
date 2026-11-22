# Proposal

## Why

公開アプリ設定がいまは `app-config.json` 1本しかなく、開発機の値（localhost、検証用のNostr鍵、開発用のお知らせ）と配布先の値（公開URL、本番の管理者鍵、本番のお知らせ）を同じファイルへ書くしかない。配布先の設定を切り替えるたびに手で書き換えることになり、開発中に本番の設定が混ざる。

## What Changes

- 公開アプリ設定を環境別の2ファイルへ分ける。`app-config.local.json` を開発用、`app-config.json` を本番用とする。どちらもGit管理しない。
- Git管理するテンプレートを2つにする。`app-config.local.json.example` は現在の `app-config.json`（localhostと検証用鍵）から、`app-config.json.example` は現在の `app-config.prod.json`（公開URLと本番の鍵）から作る。
- 読み込むファイルをビルド時に `NODE_ENV` で選ぶ。`production` は本番、`development` と `test` は開発。`APP_CONFIG_ENV` で明示的に上書きできるようにし、開発用Dockerイメージは `local` を指定する。
- `scripts/ensure-app-config.mjs` は2ファイルの存在を検証する。不足があれば日本語でパスを示して失敗し、テンプレートからの自動生成はしない（現行の境界を維持）。
- 設定を直接読むビルドスクリプト（位置情報artifactの生成、目的地目録の更新）も同じ選択規則を使う。
- Quality Gate は2つのテンプレートをコピーしてから build と test を実行する。
- 設定の形（`AppConfig`）と検証は変えない。`app-config.ts` の読み込み元だけを環境別にする。
- **BREAKING**: 設定ファイルの名前と用意するファイル数が変わる。`app-config.prod.json` は廃止し、既存の開発用 `app-config.json` は `app-config.local.json` へ移す。開発機では両方のファイルを用意しないと `npm run dev` も `npm run build` も始まらない。

## Capabilities

### New Capabilities

- `app-config`: 公開アプリ設定の環境別ファイル、選択規則、存在検証、Git管理するテンプレート、公開値だけを扱う境界。

### Modified Capabilities

なし。`quality-gate` の起動条件は変わらず、CIのコピー手順は実装の詳細として扱う。

## Impact

- 変更: `src/lib/config/app-config.ts`、`next.config.ts`、`scripts/ensure-app-config.mjs`、`scripts/generate-location-artifact.ts`、`scripts/update-destinations.ts`、`Dockerfile.dev`、`.github/workflows/quality-gate.yml`、`.gitignore`、`app-config.json.example`、関連するテスト。
- 追加: `app-config.local.json.example`、設定ファイルのパスを決める共通モジュール。
- 削除: `app-config.prod.json`（未追跡のローカルファイル）。
- 文書: `README.md`、`docs/how-to/`（analytics、docker-setup、update-destinations、update-location-data、seo-optimization、discussion）、`docs/reference/technology-stack.md`。
- 変えないもの: 設定の型と検証、`transit-config.json` と `.env` の扱い、`NEXT_PUBLIC_*` を使わない方針、Dockerのsecret mount。
