# Design

## Context

現行の公開アプリ設定は、Git管理しない `app-config.json` と、Git管理する `app-config.json.example` の1組で動いている。`src/lib/config/app-config.ts` がJSONを静的importして実行時検証し、server componentとclient componentの両方がこのモジュールを読む。そのため設定値はビルド時に確定し、ブラウザ配信物にも焼き込まれる。

`scripts/ensure-app-config.mjs` は `app-config.json` の存在だけを検証し、無ければ非ゼロで終了する。テンプレートのコピーは Quality Gate だけが行う。Dockerイメージはビルドコンテキスト全体をコピーするため、開発機の設定ファイルがそのままイメージに入る。

`next build` は `NODE_ENV` が未設定なら `production` を立てる（`next` CLIのpreAction）。`Dockerfile.dev` は `NODE_ENV=development` をビルドの後に設定しているので、ビルド自体は本番ビルドとして走る。`prebuild` は `next build` より前に走るため、`NODE_ENV` はまだ立っていない。

開発機には `app-config.prod.json` という未追跡ファイルがあり、本番の値（公開URL、本番の管理者鍵、本番のお知らせ）を保持している。

## Goals / Non-Goals

**Goals:**

- 開発用と本番用の設定を別ファイルにし、ビルド時にどちらか一方を選ぶ。
- 開発用Dockerイメージでも開発用設定が焼き込まれる。
- 設定を直接読むビルドスクリプトが、アプリと同じ選択結果を使う。
- 設定の型・検証・公開境界を変えない。

**Non-Goals:**

- 実行時に設定ファイルを読み直す仕組み（設定はビルド時に確定したままにする）。
- 2ファイルのマージや部分的override（`app-config.local.json` が `app-config.json` を上書きする方式）。
- 配布先ごとに異なる設定をGitへ入れること。
- `AppConfig` の項目、検証規則、`transit-config.json`・`.env` の扱いの変更。
- `next dev` 以外の開発サーバーやホットリロードの改善。

## Decisions

### 実ファイル2つとテンプレート1つにし、実ファイルはどちらもGit管理しない

`app-config.local.json`（開発用）と `app-config.json`（本番用）を置き、`.gitignore` に両方を追加する。追跡するテンプレートは `app-config.json.example` の1つだけとし、現在の開発用の値（localhost、検証用の管理者鍵、開発用お知らせ）を載せる。開発用と本番用の実ファイルは、どちらもこのテンプレートをコピーして作る。未追跡の `app-config.prod.json` は削除する。

テンプレートを環境ごとに2つ持つ案は採らない。2つのテンプレートは共通項目を二重に持ち、片方だけ更新されるずれが起きる。開発用の値を既定にした1つのテンプレートなら、開発用ファイルはコピーだけで済み、本番用ファイルは配布先の値を書き換える箇所が明確になる。

`app-config.local.json` が `app-config.json` を上書きするマージ方式は採らない。上書き項目だけを書いたファイルは、どの値が効いているかをファイル単体から読み取れなくなる。2ファイルに同じ形を要求すれば、検証も差分の確認も1ファイルずつで済む。

### 選択はビルド時の定数とし、`next.config.ts` で `APP_CONFIG_ENV` を配信物へ固定する

`src/lib/config/app-config.ts` は両方のJSONを静的importし、選択された側を検証して公開する。

```ts
const rawAppConfig =
  process.env.APP_CONFIG_ENV === "production"
    ? productionAppConfig
    : localAppConfig;
```

`APP_CONFIG_ENV` の解決は `next.config.ts` が行い、`env` でserver/client両方の配信物へ同じ値を渡す。

- `APP_CONFIG_ENV` が `local` / `production` ならその値。
- 未設定なら `NODE_ENV === "production"` を production、それ以外を local。
- それ以外の値は設定エラーとしてビルドを失敗させる（日本語で有効値を示す）。

Jestには `next.config.ts` が介在しないため、`app-config.ts` の `APP_CONFIG_ENV` は未定義となり、開発用設定を読む。`npm test` は `NODE_ENV=test` なので開発用設定を読む。未知の値の拒否は `next.config.ts` とビルドスクリプトが使う解決関数が担う。

代替案を2つ検討した。

- **webpack/turbopackのaliasとJestのmoduleNameMapper**: 選んだファイルだけを解決でき、未選択のJSONは配信物に入らない。しかし `next dev --turbopack` と `next build` とJestと `tsc` の4箇所へ同じ対応表を置くことになり、`tsc` は結局どちらかの実ファイルを必要とする。設定1つのために構成が4箇所へ増えるので採らない。
- **`ensure-app-config.mjs` が選んだ設定を固定パスへコピーする**: import先を1つにできるが、生成物が増え、どの設定が入っているかがファイル名から分からなくなる。現行の「検証はするが生成しない」境界も崩れるので採らない。

### 2ファイルとも常に必要とし、存在検証は現行のまま失敗させる

静的importは両方のJSONを解決するため、開発だけ・本番だけの環境でも2ファイルが要る。`scripts/ensure-app-config.mjs` は2ファイルの存在を確認し、不足するパスを日本語で列挙して非ゼロで終了する。テンプレートからの自動生成はしない。

開発機が本番用ファイルを持つ負担は1回のコピーで済む。代わりにalias方式のような構成の複雑さを避け、どのコマンドでも同じ検証結果になる。

### 未選択の設定は配信物から落とす

本番ビルドで `process.env.APP_CONFIG_ENV` が `production` に置換され、条件式ごと未使用側が落ちるため、配信物へ入る設定は選択された1ファイルだけになる。解決関数を呼ぶ形では開発用設定が本番の `.next` に残ったため、`app-config.ts` では条件式を直接書き、関数呼び出しを挟まない。

実測では、本番ビルドの `.next` に開発用お知らせと検証用の管理者公開鍵は現れず、開発用ビルドの `.next` には本番の公開URLが現れなかった。開発サーバー（Turbopack）も開発用設定を使った。

### ビルドスクリプトは同じ解決関数を使い、`prebuild` が明示的に本番を渡す

`NODE_ENV` は `next build` の内部で立つため、`prebuild` の時点では未設定である。位置情報artifactの生成が開発用設定を読み、本体が本番用設定で焼かれると、artifactと表示がずれる。

- 共通の解決関数を `src/lib/config/app-config-environment.ts` に置き、`next.config.ts`、`app-config.ts`、ビルドスクリプトが使う。
- `package.json` の `prebuild` は `APP_CONFIG_ENV` を引き継ぎ、未設定なら `production` を渡す（`APP_CONFIG_ENV=${APP_CONFIG_ENV:-production}`）。
- `update-destinations` は対話的な開発用途なので、`NODE_ENV` が `production` でない限り開発用設定を読む。

### 開発用Dockerイメージはビルド時に `local` を選ぶ

`Dockerfile.dev` はビルドの前に `ENV APP_CONFIG_ENV=local` を置く。これで本番ビルドとして走るイメージの中にも開発用設定が焼き込まれる。`Dockerfile.prod` は何も指定せず、既定の production に任せる。

### Quality Gate とコントラクトテストを2ファイル構成へ合わせる

Quality Gate は1つのテンプレートを2ファイルへコピーする。契約テストは、`.gitignore` が2ファイルを無視すること、`app-config.json.example` だけが存在し検証を通ること、CIのコピー手順が2ファイルを用意することを確認する。

## Risks / Trade-offs

- [開発機に本番用ファイルが要る] → エラーメッセージで不足パスを示し、docsの手順に2行の `cp` を書く。
- [未選択の設定が配信物に残る] → 条件式を直接書く形で落ちることを実測した。再び残る変更を入れるときは、ビルド後に `.next` を確認する。
- [`APP_CONFIG_ENV` が値の受け渡しに使われる] → 選択子だけを受け付け、それ以外の値をビルドで失敗させる。設定値はJSONだけに置く。
- [`NODE_ENV=development` を立てたまま `npm run build` を実行する] → Next.jsは非標準の `NODE_ENV` を警告し、選択規則どおり開発用設定でビルドする。意図した選択であることをdocsに書く。
- [設定ファイル名の変更で既存の手順が動かない] → **BREAKING** として提案へ記載し、docsとリリースノートで移行手順を示す。
- [`app-config.local.json` の開発用鍵を本番と取り違える] → テンプレートの `appUrl` で見分けられるようにし、検証とテストで形の一致を保つ。

## Migration Plan

1. 解決関数を追加し、存在検証を2ファイルへ広げる。
2. 開発用の値で `app-config.json.example` を追跡し、開発機の `app-config.json` を `app-config.local.json` へ、本番値を `app-config.json` へ移し、`app-config.prod.json` を削除する。
3. `app-config.ts` の読み込み元を2ファイルへ切り替え、`next.config.ts` で `APP_CONFIG_ENV` を固定する。
4. ビルドスクリプト、`prebuild`、`Dockerfile.dev`、Quality Gate を同じ選択規則へ合わせる。
5. docsとテストを更新し、build・test・lint・型検査を通す。

ロールバックは、`app-config.ts` と `next.config.ts` を単一ファイルの読み込みへ戻し、docsとCIの手順を戻す。設定値は `app-config.local.json` から `app-config.json` へ戻せばよい。
