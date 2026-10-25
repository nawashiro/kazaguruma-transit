# Design

## Context

調査基準は 2026-10-24 UTC、`dev` の `837fd2c` とする。前回の調査記録は `archive/v3/issues/118-dependency-vulnerabilities/investigation.md` にある。今回の目的は proposal.md に記す。

| 監査範囲 | critical | high | moderate | 合計 |
|---|---:|---:|---:|---:|
| `npm audit --json` | 1 | 18 | 6 | 25 |
| `npm audit --omit=dev --json` | 1 | 15 | 5 | 21 |

件数は npm の検出パッケージ数であり、固有の脆弱性数ではない。親依存への波及も含む。開発依存を除いても、起動時の Prisma CLI やビルド用ツールが依存グラフに残る。

ローカルの実行版は Node.js 22.23.4 である。両 Dockerfile は `node:22-slim` を使い、Google 配布元から Chrome stable の deb を取得する。本番イメージと稼働コンテナの実バージョンは未確認である。

## Goals / Non-Goals

**Goals:**

- 公開サーバーの修正を、同一メジャー内の依存更新と既存契約の検証で進める。
- ロックファイル上の分類と、攻撃者の入力が届く処理を区別する。
- アプリの検証完了と、本番ランタイムの反映完了を区別する。

**Non-Goals:**

- 監査件数をゼロにするための強制メジャー更新。
- Prisma schema、GTFS 入力契約、PDF HTML の設計変更。
- Node.js 24 系への移行、CI の起動条件変更、定期監査の新設。
- この計画作成に伴う本番再起動やデプロイ。

## Decisions

### 1. Next.js と sharp の修正条件を明示する

| 対象 | 現在の解決値 | 更新条件 | 根拠 |
|---|---|---|---|
| Next.js | 15.5.25 | 15.5.28 以上の 15.5 系 | Server Actions の DoS と画像処理の RCE の修正版 |
| sharp | 0.35.4 | 0.35.5 以上の 0.35 系 | 画像処理用の上流ライブラリの修正版 |

アプリは App Router と `src/lib/maps/` の Server Actions を使う。DoS の利用条件に該当する。画像処理の RCE は glibc ベースの Linux に関係するが、現設定で悪意ある SVG が処理へ届く経路は未確認である。

Next.js 16 への移行は不要である。既存の sharp override は宣言下限も更新する。`^0.35.4` は修正版を許容するが、古いロック解決値を排除しない。`eslint-config-next` は同じ 15.5.28 に揃え、lint の互換性を確認する。

Next.js のキャッシュ汚染警告も更新で解消する。Pages Router とルート直下の catch-all は調査範囲で見つからず、これらの警告を本アプリで攻撃成立済みとは扱わない。

### 2. 地図・PDF の依存を互換範囲で更新する

Google Maps SDK は Axios 1.18.1 と follow-redirects 1.16.0 を使う。Axios は 1.20.0 以上、follow-redirects は 1.16.1 以上へ解決する。既存の宣言範囲を優先し、不要な直接依存や override を追加しない。

地図の接続先は Google の固定エンドポイントである。攻撃者による接続先の指定、HTTP/2 の選択、プロトタイプ汚染の前提は確認していない。更新は公開経路の依存保守として実施し、各警告の悪用成立を断定しない。

Puppeteer は同じ 25 系の 25.16.0 を更新候補とする。公開された Node 要件 `>=22.12.0` は現在の開発環境で満たす。PDF 経由で使う依存の更新として検証し、Zod の警告が消えるかは更新後の解決結果で判定する。

Zod 3.25.76 の警告は chromium-bidi 経由である。現在の PDF 処理は Chrome を起動し、WebDriver BiDi を明示選択しない。HTTP リクエストの配列が問題の検証処理へ到達する経路は未確認である。Zod 4 の強制 override は行わない。

互換対応は地図・PDF の既存動作を保つ変更に限定する。メジャー移行や入力契約の変更が必要な場合は、その依存を保留し、理由と残存警告を記録する。

### 3. その他の警告は用途と攻撃条件で保留する

| 検出パッケージ | 実際の用途・条件 | 今回の判断 |
|---|---|---|
| prisma、@prisma/config、deepmerge-ts | build/start の CLI 設定処理。問題は循環オブジェクトのマージを要求する | Prisma 7 への更新を保留する |
| gtfs、csv-parse | GTFS 取込は `columns: true` を使い、設定の `csvOptions` を適用する。問題の `group_columns_by_name` 指定は追跡対象のコード・設定にない | 配布先独自の設定は未確認。GTFS の更新は今回保留する |
| query-string、decode-uri-component | Google Maps SDK の URL 処理 | 外部の不正入力がデコード処理へ届くか未確認。互換更新で残る場合は保留する |
| brace-expansion、markdown-it | GTFS 配下の protobufjs-cli・JSDoc、または検査ツール | 公開リクエストからの利用経路を確認していないため保留する |
| browserslist、baseline-browser-mapping、fast-uri、source-map-js | webpack/license、PostCSS、Babel などのビルド処理 | 公開 API の処理として扱わず、対象依存の更新に伴う変更以外は保留する |
| @humanfs/node、joi、js-yaml、tar | ESLint、Jest、開発用ツール等 | 開発依存として保留する |

対象の親依存を更新した結果、上記の警告が自然に消える場合は、その結果を記録する。保留は安全性の保証を意味しない。更新後の監査には残る全パッケージの用途と判断を記す。

### 4. Node.js と Chrome は取得し直した実体を確認する

Node.js 22.23.4 は 10月21日のセキュリティ修正版であり、ローカルでは導入済みである。本番の Node.js 22 系もこの版以上を今回の最低確認条件とする。Chrome は確認時点の公式 stable セキュリティ情報と実バージョンを照合する。

`docker compose -f compose.prod.yml build --pull --no-cache app` でベースイメージと Chrome の取得をやり直す。通常のビルドは取得処理のキャッシュを再利用する場合がある。`--no-cache` だけではベースイメージの再取得を保証しない。

生成イメージは `docker compose -f compose.prod.yml run --rm --no-deps app node --version` と、同じ形式の `google-chrome-stable --version` で確認する。これらはアプリの通常起動コマンドを置き換える。本番反映後は `exec -T app` でも両方の版を確認する。

手順は既存の `docs/how-to/docker-setup.md` へ集約する。Dockerfile の固定版や新しい監視機構は追加しない。取得された版が修正条件を満たさない場合は、反映完了と報告せず、原因を調査する。

### 5. 最低修正版の検査と機能検証を分ける

既存の `__tests__/dependency-security.test.ts` は古い修正下限でも成功する。宣言下限と実解決値の検査を新しい条件へ改め、変更前の依存で失敗することを先に確認する。

地図・画像・PDF は既存テストと実行確認で検証する。依存の版検査だけで機能の互換性を保証しない。互換対応で動作を変更する場合は、意味のあるテストで失敗を確認してから実装する。

## Risks / Trade-offs

- 互換範囲の更新でも地図通信や PDF 待機が変わるリスク → 関連テスト、strict TypeScript、lint、build、PDF 出力を確認する。
- Puppeteer と外部 Chrome の組合せが変わるリスク → 生成イメージ内の実 Chrome で PDF を確認する。
- 本番イメージには npm 監査外の OS・Chrome 脆弱性も残るリスク → 再取得と版照合を行い、イメージ全体の監査は未実施なら明記する。
- 外部の地図 API キーや Docker が使えず検証が不足するリスク → 成功した検証と未実施の検証を分け、本番反映時の確認項目を残す。
- 古いイメージへ戻すと修正前の脆弱性も復帰するリスク → ロールバック時に既知のリスクを明示し、修正版の再反映を優先する。

## Migration Plan

1. 既存依存で最低修正版のテストが失敗することを確認する。
2. 対象依存とロックファイルを更新し、関連検証と再監査を実行する。
3. Docker の再取得・版確認手順を文書化する。実行環境がなければ検証を未実施と記録する。
4. 本番反映時に、運用者が新イメージを検証してコンテナを再作成する。
5. 運用者が稼働版、地図、画像、PDF を確認する。

本番反映は別の実行段階とする。この変更は DB schema を変更しない。起動処理は GTFS の取込を行うため、ロールバックで DB の以前の状態への復帰は保証しない。

## References

- [Next.js 10月14日の更新](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
- [Server Actions の DoS](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r)
- [画像処理の RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
- [Node.js 22.23.4](https://nodejs.org/en/blog/release/v22.23.4)
- [Docker のビルドと再取得](https://docs.docker.com/build/building/best-practices/)
- [Puppeteer リリース](https://github.com/puppeteer/puppeteer/releases)
- [Axios の公開依存情報](https://github.com/axios/axios/blob/v1.x/package.json)
- [csv-parse の攻撃条件](https://github.com/advisories/GHSA-8cw4-87c7-c6xx)
- [deepmerge-ts の攻撃条件](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- [Zod の警告](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

## Verification Results

確認日は 2026-10-24 UTC。以下はローカル検証の結果であり、本番反映は未実施である。

### Resolved dependencies

| 対象 | 更新後の解決値 |
|---|---|
| Next.js / eslint-config-next | 15.5.28 / 15.5.28 |
| sharp / Linux x64 の libvips 配布物 | 0.35.5 / 1.3.4 |
| Google Maps SDK → Axios → follow-redirects | 3.4.2 → 1.20.0 → 1.16.1 |
| Puppeteer / puppeteer-core | 25.16.0 / 25.16.0 |
| chromium-bidi → Zod | 157.0.8090-0 → 4.6.7 |

`npm ls next sharp axios follow-redirects puppeteer puppeteer-core chromium-bidi zod --all` で確認した。Puppeteer の Node 要件は `npm view puppeteer@25.16.0 engines --json` で `>=22.12.0` と確認し、実行環境の 22.23.4 が満たした。Axios と follow-redirects は既存の依存範囲で更新し、直接依存や override は追加しなかった。Zod の警告は Puppeteer 更新に伴って消えた。

### Audit results

`npm audit --json` と `npm audit --omit=dev --json` をクリーン導入後に実行した。

| 監査範囲 | critical | high | moderate | 合計 |
|---|---:|---:|---:|---:|
| 全依存 | 0 | 11 | 6 | 17 |
| `--omit=dev` | 0 | 8 | 5 | 13 |

両方の監査に Next.js、sharp、Axios、follow-redirects、Puppeteer、Zod の警告は残らなかった。残存する全17パッケージの評価は次のとおりである。「本番」は `--omit=dev` の検出を示し、公開リクエストからの到達性を意味しない。

| 検出パッケージ | 分類・依存経路 | 攻撃条件・用途と保留理由 |
|---|---|---|
| prisma、@prisma/config、deepmerge-ts | 本番。@prisma/client → prisma 6.19.3 → @prisma/config 6.19.3 → deepmerge-ts 7.1.5 | 循環オブジェクトのマージでスタックを消費する。build/start の CLI 設定処理であり、HTTP 入力からの到達性は未確認。Prisma 7 移行は対象外。 |
| gtfs、csv-parse | 本番。gtfs 4.17.5 → csv-parse 6.1.0 | `columns` と `group_columns_by_name` を使う処理でプロトタイプを置換する条件がある。追跡対象のコード・設定には後者の指定がない。配布先独自設定は未確認。GTFS 更新は対象外。 |
| query-string、decode-uri-component | 本番。Google Maps SDK 3.4.2 → query-string 7.1.3 → decode-uri-component 0.2.2 | 不正なパーセントエンコードのデコードで CPU を消費する。外部入力の到達性は未確認。SDK の既存範囲の更新では残り、強制 override は保留。 |
| brace-expansion | 本番は gtfs → gtfs-realtime-bindings → protobufjs-cli → glob → minimatch → 2.1.2。開発用の @eslint/eslintrc 配下は 1.1.16、eslint-config-next 配下は 2.1.2 | 悪意ある展開式が大量の配列、再帰、二次時間の書換えを発生させる。CLI・検査処理から公開リクエストへの到達性は未確認。関連ツールの更新は対象外。 |
| markdown-it | 本番。gtfs → gtfs-realtime-bindings → protobufjs-cli → jsdoc → 14.3.0 | smartquotes、HTML、リンク参照、linkify の細工された入力で二次時間の処理が発生する。JSDoc 用であり、公開入力の到達性は未確認。関連ツールの更新は対象外。 |
| browserslist | 本番。webpack-license-plugin → webpack → 4.28.1。開発用 Babel も利用する | 異なる問い合わせ結果の蓄積でメモリを消費し、不正な統計入力で例外・プロトタイプへの書込みが生じる。ビルド用途であり、外部入力の到達性は未確認。ビルド依存の一括更新は対象外。 |
| baseline-browser-mapping | 本番。webpack → browserslist → 2.9.19 | 不正な問い合わせがプロセス終了を引き起こす。ビルド用途であり、公開入力の到達性は未確認。ビルド依存の一括更新は対象外。 |
| fast-uri | 本番。webpack-license-plugin → webpack → schema-utils → ajv / ajv-formats → 3.1.3 | バックスラッシュ、パーセントエンコード、IPv6、ポート、相対参照の正規化差異がホスト混同や SSRF の条件となる。ビルド時のスキーマ処理であり、公開入力の到達性は未確認。ビルド依存の一括更新は対象外。 |
| source-map-js | 本番。postcss → 1.2.1。開発用 Tailwind も利用する | 細工された indexed source map の section offset でイベントループを占有する。CSS ビルド用途であり、公開入力の到達性は未確認。ビルド依存の一括更新は対象外。 |
| @humanfs/node | 開発のみ。eslint → 0.16.6 | 再帰コピーが symlink をたどり、元ディレクトリ外のファイルをコピーする。検査ツールの更新は対象外。 |
| joi | 開発のみ。start-server-and-test → wait-on → 18.2.3 | 不正な messages、rename の template、isoDate 入力でプロトタイプ置換や正規表現の長時間処理が発生する。テスト起動補助の更新は対象外。 |
| js-yaml | 開発のみ。@eslint/eslintrc → 4.3.0、Jest → @istanbuljs/load-nyc-config → 3.15.0 | `!!omap` と空の merge source を使う YAML で CPU を消費する。検査用設定の処理であり、開発依存の更新は対象外。 |
| tar | 開発のみ。@tailwindcss/postcss → @tailwindcss/oxide → 7.5.20 | 長いパスと member selection を含む tar の再帰でスタックを消費する。開発用ビルドツールの更新は対象外。 |

依存経路は `npm ls @humanfs/node prisma @prisma/config deepmerge-ts baseline-browser-mapping brace-expansion browserslist csv-parse decode-uri-component fast-uri gtfs joi js-yaml markdown-it query-string source-map-js tar --all` で照合した。保留は安全性の保証ではない。

### Functional and runtime checks

- 更新した最低修正版テストは、旧依存で4件中3件失敗し、更新後は4件成功した。
- `npm ci --include=dev`、`npm run lint`、`npx tsc --noEmit --incremental false`、`npm run build` は成功した。lint と build は既存コードの警告を出した。
- `next start --hostname 127.0.0.1 --port 3100` で本番モードのローカルサーバーを起動し、`npm test -- --runInBand` は174スイート・1,456テスト成功、2スイート・13テストスキップとなった。サーバーを要する location-pages の2スイートも成功した。
- PDF 入力契約、PDF 出力操作、経路検索表示、ジオコーディングの関連4スイート・14テストは成功した。
- 実 Google Maps SDK と Axios の adapter を使い、通信応答だけをローカルで代替した。Directions の固定 URL、座標、徒歩指定、日本語指定、返却 polyline と Static Map の URL を確認した。不正座標のエラー応答も確認した。
- sharp で32×24の SVG を16×12の PNG へ変換し、画像の形式と寸法を確認した。
- Google Maps API キーがないため、Google との実通信と地図画像の表示は未確認。SDK・URL の実行確認と関連 Jest を代替にした。
- Docker コマンドがないため、本番構成イメージの再取得付きビルドとイメージ内の Node.js・Chrome の確認は未実施。
- `google-chrome-stable` と Puppeteer の既定 Chrome 実体がないため、実 Chrome の PDF 出力は未確認。生成イメージ内の PDF 内容・用紙設定と Chrome の修正状況は、本番反映時の確認項目として残る。
- Compose のサービス名 `app`、起動コマンド、Dockerfile.prod の Chrome 配置と版確認コマンドを静的に照合した。Compose 自体の実行検証とイメージ全体の OS 監査は未実施。

`git diff --check` と `openspec validate refresh-runtime-dependency-security --strict` は成功した。差分は依存宣言・ロック、最低修正版テスト、Docker 手順とこの変更の計画文書に限る。

本番へのデプロイ、再起動、稼働コンテナの確認は行っていない。
