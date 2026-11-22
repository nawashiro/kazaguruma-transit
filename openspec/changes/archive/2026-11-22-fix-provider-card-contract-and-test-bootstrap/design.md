# Design

## Context

server プロジェクトの globalSetup（`scripts/global-setup.mjs`）は、3100の応答確認、データベースのスキーマ作成、production ビルド、`next start` の起動を順に行う。ビルドは `.next/BUILD_ID` が無いときだけ実行する。

`.next` は、中断したビルドが前回の成果物へ上書きすると、`BUILD_ID` を残したまま manifest だけが新しくなる。この状態で `next start` は起動時に `routesManifest.dataRoutes` を読み、`[TypeError: routesManifest.dataRoutes is not iterable]` で落ちる。globalSetup は90秒待って「テスト用の本番サーバが3100で応答しませんでした」と報告するだけなので、原因がビルド成果物なのかコードなのか分からない。

`next start` が起動時に読むのは次のファイルである（`node_modules/next/dist/server/lib/router-utils/filesystem.js`）。

- `routes-manifest.json`: `dataRoutes` と `dynamicRoutes` を配列として走査する。
- `prerender-manifest.json`: `routes` を使う。
- `server/pages-manifest.json`: 必須。読めなければ起動しない。
- `middleware-manifest.json`、`functions-config-manifest.json`、`app-paths-manifest.json`: 読めなければ空として扱う。

jest は globalSetup を transformer 経由で読み込む（`.mjs` でも transpile されていた）。そのため globalSetup を TypeScript にしても動く。

データ提供元カードの視覚契約テスト（`src/app/locations/[category-id]/__tests__/page.visual-contract.test.tsx`）は、カードの文言とリンク本数を完全一致で検証する。文言を変えたコミットがこのテストを更新しなかったため、unit プロジェクトが1件赤のまま残っている。

## Goals / Non-Goals

**Goals:**

- 壊れたビルド成果物を掴んだときに、ビルドを作り直して server プロジェクトを完了させる。
- 揃った成果物があるときはビルドを省略し、現在の実行時間を保つ。
- 成果物の健全性判定を unit テストで固定できる形にする。
- データ提供元カードのテストを現行の画面に追随させ、参照されていない定数を残さない。

**Non-Goals:**

- ソース変更に対する staleness の検出。`src` が `BUILD_ID` より新しければ再ビルドする案は、src を1行変えるたびに1分半のビルドを強いる。CI は常にビルドするので、影響はローカルだけである。
- カードの文言とリンク先の変更。テストを画面に合わせるだけで、表示は変えない。
- CI ワークフローの変更。
- 中断したビルドを起こさない仕組み（ビルドの排他制御など）。

## Decisions

### 再利用の条件を `next start` の manifest の健全性で決める

`BUILD_ID` の存在は必要条件にすぎないので、起動に必要な4つのファイルを確認する。`BUILD_ID` が空でないこと、`routes-manifest.json` の `dataRoutes` と `dynamicRoutes` が配列であること、`prerender-manifest.json` の `routes` がオブジェクトであること、`server/pages-manifest.json` がオブジェクトであること。JSON の解析に失敗した場合も不健全として扱う。

代替案は3つあり、いずれも採らない。

- 常にビルドする: 実行時間が毎回1分半増える。揃った成果物を再利用する現行の利点を捨てる。
- `BUILD_ID` と他のファイルの mtime を比べる: 正常なビルドでも `BUILD_ID` は他のファイルより先に書かれるため、新旧を判別できない。
- Next のバージョンを刻印する: 今回の破損は同じバージョンの中断ビルドで起きるので、検出できない。

### 判定を `scripts/production-build.ts` の純関数にする

`isProductionBuildUsable(nextDir)` として切り出し、`scripts/__tests__/production-build.test.ts` が一時ディレクトリに manifest を組んで検証する。globalSetup はこの関数を呼ぶだけにし、判定の分岐をテスト可能な場所へ集める。

### globalSetup と globalTeardown を TypeScript へ移す

jest の testMatch は `.test.ts` を拾うが `.test.mjs` を拾わない。判定を unit テストで固定するには、globalSetup が import するモジュールを jest の transformer で読める形にする必要がある。`.mjs` のまま `node --test` を併用する案は、テスト実行系が二重になるので採らない。

globalTeardown は globalSetup から `port`、`stateFile`、`pidsListeningOnPort` を import しているため、両方を同時に移す。`jest.config.js` の `globalSetup` と `globalTeardown` のパスも合わせる。

### 視覚契約テストは文言の完全一致とリンクの役割で固定する

データ提供元カードの検証を、現行の3段落と4本のリンク（千代田区区民施設向けデータ、WheelMap、OpenStreetMap、こちらのフォーム）に合わせる。リンクは `role="link"` と `href` で固定する。参照されていない `DATA_PROVIDER_SOURCE_DESCRIPTION` と `DATA_PROVIDER_CORRECTION_DESCRIPTION` は削除し、`DATA_PROVIDER_SOURCE_HREF` はリンクの href として使う。

文言をキーワード一致へ弱める案は採らない。視覚契約テストの役割は、文言の変更を製品判断として可視化することにある。赤くなって当然の変更を検出しなくなる。

## Risks / Trade-offs

- 健全性チェックは4ファイルに限るため、chunk の欠落など別の破損は検出できない → 起動時の manifest 読み込みで落ちる範囲は救える。検出できない破損は従来どおり「サーバが応答しない」として現れる。
- globalSetup の `.ts` 化で jest がモジュールを解決できなくなる可能性 → 実装の最初に `.ts` 化だけを行い、`npm run test:server` で確認する。失敗したら `.mjs` に戻し、判定関数を `.mjs` に置いて、テストだけ `node --test` ではなく jest で読める形を再検討する。
- 判定が厳しすぎると毎回ビルドになる → 正常な `.next` で4ファイルが揃うことを確認するタスクを置く。unit テストは正常系の fixture も固定する。
- 文言の完全一致検証は、文言を変えるたびに赤くなる → 意図した挙動として受け入れる。

## Migration Plan

開発用スクリプトとテストの変更だけなので、配布物への移行はない。問題が出たら `scripts/global-setup.ts`、`scripts/global-teardown.ts`、`jest.config.js` を戻す。

## Open Questions

- ローカルでソースを変えたあとに再ビルドすべきかを、ビルド時間を測ってから決めるか。判定を入れるなら、今回の健全性チェックに条件を1つ足す形になる。
