# Spec Delta

## Purpose

公開アプリ設定を開発用と本番用の2ファイルに分け、実行環境に合うファイルをビルド時に選び、公開値だけを扱う境界を保つ。

## ADDED Requirements

### Requirement: 環境別の公開設定ファイル

公開アプリ設定 MUST `app-config.local.json`（開発用）と `app-config.json`（本番用）の2ファイルで管理する。どちらもGit管理してはならず（MUST NOT）、同じ形（`AppConfig`）と検証規則を持たなければならない（MUST）。

#### Scenario: 開発用と本番用を別ファイルに置く

- **WHEN** 開発機と配布先の公開設定を用意する
- **THEN** 開発機は `app-config.local.json`、配布先は `app-config.json` を編集し、互いの値を混ぜない

#### Scenario: 実ファイルをGit管理しない

- **WHEN** `.gitignore` を確認する
- **THEN** `app-config.local.json` と `app-config.json` はどちらも無視され、テンプレートだけが追跡される

### Requirement: 実行環境による設定の選択

アプリはビルド時に、`NODE_ENV` が `production` なら `app-config.json`、`development` と `test` を含むそれ以外なら `app-config.local.json` を読み込まなければならない（MUST）。`APP_CONFIG_ENV` が `local` または `production` のときに限り、その値を選択に優先する（MUST）。`APP_CONFIG_ENV` にそれ以外の値が与えられたときは、設定エラーとして失敗しなければならない（MUST）。

#### Scenario: 開発サーバーは開発用設定を読む

- **WHEN** `npm run dev` を実行する
- **THEN** アプリは `app-config.local.json` の値を使う

#### Scenario: 本番ビルドは本番用設定を読む

- **WHEN** `npm run build` を実行する
- **THEN** アプリは `app-config.json` の値を使う

#### Scenario: テストは開発用設定を読む

- **WHEN** `npm test` を実行する
- **THEN** アプリは `app-config.local.json` の値を使う

#### Scenario: 開発用Dockerイメージは開発用設定を焼き込む

- **WHEN** `APP_CONFIG_ENV=local` を指定したビルドを実行する
- **THEN** `NODE_ENV` に関係なく `app-config.local.json` の値が使われる

#### Scenario: 未知の選択値を拒否する

- **WHEN** `APP_CONFIG_ENV=staging` でビルドする
- **THEN** ビルドは設定エラーで失敗し、有効な値を示す

### Requirement: 選択された設定の公開境界

アプリがブラウザへ配信する設定は、公開情報だけを含まなければならない（MUST）。選択されなかった側のファイルの値は配信しなくてよいが、配信する場合も公開情報に限る。`NEXT_PUBLIC_*` 環境変数と、`transit-config.json`・API key・Cloudflare token を設定ファイルへ含めてはならない（MUST NOT）。

#### Scenario: 本番ビルドに秘密を入れない

- **WHEN** 本番ビルドを実行する
- **THEN** 設定ファイルに秘密の項目はなく、既存のsecret mountがそのまま使われる

### Requirement: 設定ファイルの存在検証

`npm run dev`、`npm test`、`npm run build`、`npm start`、Dockerイメージのビルド MUST 2つの設定ファイルの存在を検証し、不足時は日本語で不足するパスを示して失敗する。検証はテンプレートからの自動生成を行ってはならず（MUST NOT）、CIだけがテンプレートのコピーを行う（MUST）。

#### Scenario: 設定ファイルがないまま起動する

- **WHEN** `app-config.local.json` を置かずに `npm run dev` を実行する
- **THEN** コマンドは不足するパスを示して非ゼロで終了し、ファイルを作らない

#### Scenario: CIがテンプレートから2ファイルを用意する

- **WHEN** Quality Gate が設定を準備する
- **THEN** `app-config.json.example` を `app-config.json` と `app-config.local.json` へコピーし、build と test がその後のステップで成功する

### Requirement: ビルドスクリプトの設定選択

設定を直接読むビルド用スクリプト MUST アプリと同じ選択規則で設定ファイルを読む。位置情報artifactの生成は、実行中のビルドが使う環境の設定と一致しなければならない（MUST）。

#### Scenario: 本番ビルドのartifact生成が本番用設定を使う

- **WHEN** `npm run build` がartifactを生成する
- **THEN** 取得先URIは `app-config.json` の値と一致する

#### Scenario: 開発機の目録更新が開発用設定を使う

- **WHEN** `npm run update-destinations` を `NODE_ENV=production` 以外で実行する
- **THEN** 取得先URIは `app-config.local.json` の値と一致する

### Requirement: Git管理するテンプレート

リポジトリ MUST `app-config.json.example` だけを追跡し、開発用の値（`appUrl` は `http://localhost:3000`）を持つテンプレートとする。`app-config.json` と `app-config.local.json` は、どちらもこのテンプレートから作らなければならない（MUST）。テンプレートは設定検証を通らなければならない（MUST）。

#### Scenario: テンプレートから開発設定を作る

- **WHEN** `cp app-config.json.example app-config.local.json` を実行する
- **THEN** 検証を通る開発用設定ができ、開発サーバーが起動する

#### Scenario: テンプレートから本番設定を作る

- **WHEN** `cp app-config.json.example app-config.json` を実行し、`appUrl` などの配布先の値へ書き換える
- **THEN** 検証を通る本番用設定ができ、本番ビルドが成功する

#### Scenario: テンプレートは1つだけ追跡する

- **WHEN** リポジトリの追跡ファイルを確認する
- **THEN** `app-config.json.example` だけが追跡され、`app-config.local.json.example` は存在しない
