# Design

## Context

実行されていないテストは2本あり、性質が違う。

- `scripts/__tests__/button-color-scope.test.mjs`: `src/app/globals.css` を postcss で解析し、`--color-primary` 系と `--focus-color` 系の宣言が `.transit-button` と `.my-toggle` の内側に留まることを見る。外部プロセスもブラウザも要らない。
- `scripts/__tests__/skip-link-targets.test.mjs`: puppeteer で2テーマ×4幅のページを開き、スキップリンクがヘッダーの操作要素と重ならず `main` へ移動することを見る。HTTPで応答するアプリが要る。

どちらも `node:test` で書かれている。jest の unit プロジェクトは jsdom で動き、`npm test` と Quality Gate が実行する。puppeteer は 25.16.0 で `"type": "module"` のESMのみを配る。

`start-server-and-test` は既に devDependency にあり、`accessibility:ci` が `dev` サーバの起動と後始末に使っている。`/` はビルド時に静的生成される（`○ /`）ため、実行時に交通DBを読まない。

## Goals / Non-Goals

**Goals:**

- 2本のテストを、決まったコマンドから実行できる状態にする。
- 外部プロセスもブラウザも要らない検査を、既存の `npm test` に合流させる。
- ブラウザ検証を Quality Gate で実行する。
- テスト実行系を1つに増やさない。`node:test` は jest で扱えない検証だけに残す。

**Non-Goals:**

- ブラウザ検証の対象ページを増やすこと。今はトップページのスキップリンクだけ。
- `accessibility:ci` のランナーや閾値の変更。
- 交通DBを要する画面のブラウザ検証。`next start` の静的配信で足りる範囲に限る。
- puppeteer を jest の transformer に通すための設定追加。

## Decisions

### `button-color-scope` は jest の unit プロジェクトへ移す

`node:test` の `test` / `assert` を jest の `it` / `expect` に置き換えるだけで、検査内容は変えない。pure なCSS検査なので jsdom で足りる。`npm test` と Quality Gate が既に unit プロジェクトを実行しており、新しいコマンドもCIの変更も要らない。

`node:test` のまま `npm run test:scripts` を足す案は採らない。ランナーが2つになり、`npm test` を実行した人が片方の失敗を見落とす。

### `skip-link-targets` は `node:test` のまま専用コマンドで実行する

puppeteer を jest で読むには `transformIgnorePatterns` に puppeteer を足し、ESMのまま配られるパッケージ全体を変換することになる。起動が遅く、内部の動的 import で壊れやすい。jest の `browser` プロジェクトを新設する案も、同じ変換問題を抱えたまま実行系だけ増える。

`npm run test:skip-link` を `start-server-and-test` で組み、`node --test` で1ファイルを実行する。`accessibility:ci` と同じ道具立てで、後始末も任せられる。

### ブラウザ検証のサーバは `next start` を使う

`npm start` は `prisma generate` と `import-gtfs` を挟み、交通DBのスキーマを前提にする。`npm run dev` は要求のたびにコンパイルし、検証対象が配布物ではなく開発サーバになる。Quality Gate は直前に `npm run build` を済ませているので、`next start` でビルド済みのアプリを配信するのが最も短く、検証したいものと一致する。

ローカルではビルドが要る。`npm run test:skip-link` の前提として `npm run build` を先に実行することを `docs/reference/technology-stack.md` に書く。

### Quality Gate のステップは Jest のあとに置く

速く落ちる検査を先に並べる。ブラウザ検証はビルドとJestの後、合成した `transit-config.json` を削除するステップの前に置く。

## Risks / Trade-offs

- ブラウザ検証が約13秒かかる（2テーマ×4幅、`networkidle2` 待ち） → Quality Gate の20分予算に対して十分小さい。実行時間を削るためにテーマや幅を減らすと検査の意味が薄れるので、そのままにする。
- CIにChromiumが要る → puppeteer は `npm ci` のインストール時にChromiumを取得する。既に `--no-sandbox` を渡している。
- `next start` が古いビルドを配信すると、検証が現在のソースを見ない → Quality Gate はビルド直後に実行する。ローカルはビルドを前提とする旨を文書に書く。
- ローカルで3000ポートが埋まっていると起動に失敗する → `start-server-and-test` が待ち時間で落ちる。エラーメッセージはポート待ちのままなので、原因を文書に書く。
