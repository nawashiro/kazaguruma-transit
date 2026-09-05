# Issue #118 調査記録

- Issue: [#118](https://github.com/nawashiro/kazaguruma-transit/issues/118)
- タイトル: `fix: なにやら依存の警告がたくさん出ている`
- 状態: open、コメント0件、担当者なし、ラベルなし
- 対象リポジトリ: `nawashiro/kazaguruma-transit`
- 調査日時: 2026-09-05 UTC
- 基準ブランチ: `dev`
- 実装ブランチ: `fix/issue-118-dependency-vulnerabilities`
- 基準SHA: `28929bf9e09d797d2fea27326d30895e5e17f02a`

## 1. 基準状態

`origin/dev` を fetch し、基準SHAを確認してから実装ブランチを作成した。開始時の作業ツリーは clean で、`git diff --check` も終了コード0だった。ローカルの Node 22.23.2 / npm 10.9.8 を、リポジトリの `engines.node: 22.x` に合わせて検証へ使用する。

Issue本文とコメントをGitHubから取得した。本文は次の要件である。

> npmで依存関係にhigh脆弱性が出ている。サーバー側で動くかつ外部から影響を受けるものについては修正する必要がある。それ以外は一旦保留しよう。既存機能を壊さないように気をつける必要がある。

## 2. 重複作業の確認

次の検索を実行した。

- `gh pr list --search "#118" --state all`: 該当なし
- `gh pr list --search "dependency vulnerability" --state all`: 該当なし
- `gh pr list --search "npm audit" --state all`: 該当なし
- `gh pr list --search "依存" --state all`: 既存の別Issueに関するmerged PRのみ
- `gh pr list --search "脆弱" --state all`: 該当なし
- `git log --all --grep='118\|依存\|脆弱' -i`: Issue #118の候補修正コミットなし

Issue #118に紐づく既存PR・候補ブランチ・対象修正コミットは確認できなかった。

## 3. 監査結果

Node 22.23.2 / npm 10.9.8 で基準SHAに対して実行した。

| 範囲 | コマンド | 結果 |
|---|---|---|
| 全依存 | `npm audit --json` | exit 1、22件（high 16 / moderate 5 / low 1） |
| 開発依存除外 | `npm audit --omit=dev --json` | exit 1、20件（high 15 / moderate 4 / low 1） |

基準時の主要な直接依存と解決バージョンは次のとおりである。

| パッケージ | 宣言 / 解決 | 監査上の問題 | 実行経路と判断 |
|---|---|---|---|
| `next` | `^15.5.20` / `15.5.20` | high。App Router Server ActionsのDoS、SSRF等。修正境界は `15.5.21` 以上 | 本番のNext.jsサーバーと全API routeが利用するため修正する |
| `puppeteer` | `^24.6.1` / `24.15.0` | high。`@puppeteer/browsers`、`extract-zip`、`puppeteer-core`を経由 | `src/app/api/pdf/generate/route.ts` の外部POSTからサーバー上で起動するため修正する |
| `sharp` / `postcss` / `nanoid` | Next.js配下を含む | highまたはmoderate。Next.jsの解決更新で同時に更新可能 | Next.js本番経路の解決依存であり、Next.js更新の結果で確認する |
| `prisma` / `@prisma/config` / `deepmerge-ts` | `prisma` devDependency、`@prisma/config`は`devOptional` | high | Prisma CLIのbuild/start前処理であり、外部リクエストから直接到達しない。今回保留 |
| `browserslist` / `fast-uri` | build/license plugin等の依存 | high | 本番リクエスト処理ではなくビルド時の依存。今回保留 |
| `brace-expansion` / `js-yaml` / `ip-address` | GTFS・Puppeteer・開発ツール等に分散 | high | 外部入力を受ける本番処理で対象APIとして使われていることを確認できないものは、直接親の更新結果を除き保留 |
| `lighthouse` | devDependency | 関連依存を含む | アクセシビリティ検査用の開発ツール。今回保留 |

`npm audit fix --dry-run` は、既存の許容範囲内で `next` を15.5.25、`puppeteer`を24.43.1へ更新する提案を返した。しかし監査データ上、Puppeteerの修正境界は25.10.0以上であり、24系への更新だけではhighが残る。このため `npm audit fix --force` は使用せず、対象の直接依存を明示的に更新する。

Puppeteer 25.10.0のNode要件は `>=22.12.0` であり、リポジトリのNode 22.x制約および検証環境の22.23.2を満たす。

## 3.1 修正後監査

直接依存更新後、Node 22.23.2 / npm 10.9.8で再監査した。

| 範囲 | 結果 |
|---|---|
| 全依存 | exit 1、11件（high 8 / moderate 3 / low 0） |
| 開発依存除外 | exit 1、8件（high 6 / moderate 2 / low 0） |

全体auditは非0のままだが、対象の直接依存と対象サブツリーのキーは全体・`--omit=dev`の両方から消えた。対象外として残ったhighは、`prisma`/`@prisma/config`/`deepmerge-ts`、GTFSの`protobufjs-cli`にある`brace-expansion`、webpack/license pluginの`browserslist`/`fast-uri`、および開発系の`js-yaml`/`tar`である。これらはIssue本文の「それ以外は一旦保留」に従い、今回のproduction request経路へ強制的に持ち込まない。

更新後の対象解決値は次のとおりである。

- `next@15.5.25`
- Next.js配下の`postcss@8.5.28`、`sharp@0.35.4`、`nanoid@3.3.18`
- `puppeteer@25.10.0`
- `@puppeteer/browsers@3.2.2`、`puppeteer-core@25.10.0`
- `extract-zip`はPuppeteer 25の解決グラフから除去

## 4. 本番・外部入力経路

### Next.js

`package.json` の `start` は `next start` を実行し、`src/app/api/` に `geocode`、`transit`、`bus-stops`、`licenses`、`pdf/generate` のAPI routeが存在する。公開サーバーのリクエスト処理に使われる直接依存なので、監査でhighとなった15.5.20を15.5.21以上へ更新する。

`next.config.ts` は画像のremote patternとserver webpack pluginだけを設定し、custom server、rewrites、redirectsは設定していない。該当しないNext.js advisoryを無理に再現するのではなく、公開サーバーのフレームワークを修正済みパッチへ揃える。

### PDF生成

`src/components/features/RoutePdfExport.tsx` が `/api/pdf/generate` へPOSTし、route handlerはrate limit後にリクエストJSONからHTMLを生成し、Puppeteerをサーバー上で起動する。依存脆弱性の直接の到達経路を確認できる本番機能である。

Puppeteer 24.15.0の依存は `@puppeteer/browsers@2.10.6`、`puppeteer-core@24.15.0`、`extract-zip@2.0.1`等である。Puppeteer 25.10.0へ更新した。Puppeteer 25では`setContent`の`waitUntil`から`networkidle0`が除外されたため、`load`後に`waitForNetworkIdle({ concurrency: 0, idleTime: 500, timeout: 60000 })`を呼ぶ形へ置き換えた。これは旧待機条件と同じく、0接続を500ms維持してからPDF処理へ進むための型互換対応であり、route handlerの入力・出力・外部API・PDFオプションは変更していない。

### 未使用の直接依存

`transit-departures-widget` は `package.json` とlockfile以外のソース・設定・テストから参照されていない。機能を提供していない直接依存を残す理由がなく、関連する不要な依存サブツリーを削除する。これは外部入力処理の拡張ではなく、機能差分を生まないKISS上の後始末である。

`@types/puppeteer` は「Puppeteer自身が型定義を提供する」stub packageであり、ソースからの直接参照もない。Puppeteer 25へ更新する際に削除し、古い型stubが別バージョンのPuppeteerを要求する状態を避ける。

## 5. 根因と実装境界

根因は、公開サーバーで使う直接依存のlockfile解決値が、npm auditのhigh修正境界未満で固定されていることである。

変更対象は次の5つに限定する。

- `package.json`: `next`を`^15.5.25`（監査境界15.5.21以上）、`puppeteer`を`^25.10.0`へ更新し、Next.js配下の`postcss`を`^8.5.28`へ引き上げ、`transit-departures-widget`とobsoleteな`@types/puppeteer`を削除する。`next`のoverrideで`postcss`と`sharp`の修正済み系列を固定する。
- `package-lock.json`: npmが生成する整合した解決結果へ更新する。
- `src/app/api/pdf/generate/route.ts`: Puppeteer 25の型互換のため、旧`networkidle0`と同値の明示的なnetwork idle待機へ変更する。それ以外の処理は変更しない。
- `__tests__/dependency-security.test.ts`: 対象直接依存とNext.js配下の最低セキュリティ境界を静的契約として追加する。behavior TDDを増やすのではなく、将来のlock/package range後退を検出する最小のguardrailとする。
- `issues/118-dependency-vulnerabilities/`: 本記録、仕様、計画、タスク、検証結果を保存する。

次は変更しない。

- `src/app/api/pdf/generate/route.ts` のnetwork idle待機以外とPDF生成HTML
- `src/components/features/RoutePdfExport.tsx`
- API rate limit、Prisma schema/DB、GTFS処理、Dockerfile
- `prisma`、`lighthouse`、build専用依存のためだけの強制upgrade
- `npm audit fix --force` によるmajor連鎖更新

## 6. 受入条件

1. `next`の宣言範囲が15.5.21以上、`puppeteer`の宣言範囲が25.10.0以上になる。
2. lockfile上のNext.jsとPuppeteer、およびそれらの直接脆弱サブツリーが修正済みバージョンへ解決される。
3. `/api/pdf/generate` の既存リクエスト契約、PDF生成HTML、外部API呼び出し、レート制限、PDFオプションを変更しない。Puppeteer 25の型互換に必要なnetwork idle待機の表現変更だけを許可する。
4. 未使用の`transit-departures-widget`とobsoleteな`@types/puppeteer`を依存宣言・lockfileから除去する。
5. 対象外とした開発・build専用の警告は保留理由を記録し、全監査がゼロになったと誤って報告しない。
6. dependency security guardrail、既存テスト、strict TypeScript、lint、buildをNode 22.xで実行し、結果を記録する。
7. 変更pathが上記境界とIssue文書だけであることを差分で確認する。

## 7. 実装・検証結果

- `package.json`: `next`を`^15.5.25`、`puppeteer`を`^25.10.0`、`postcss`を`^8.5.28`へ更新。Next overrideで`postcss` `^8.5.28`、`sharp` `^0.35.4`を指定した。
- 未使用の`transit-departures-widget`と`@types/puppeteer`を削除した。source/config/test検索で参照はIssue文書とpackage変更以外にない。
- `src/app/api/pdf/generate/route.ts`はPuppeteer 25の型互換のため待機表現だけを変更した。`npm run build`のroute一覧に`/api/pdf/generate`が残り、PDF route関連10 testsがpassした。
- 依存解決: `next@15.5.25`、`puppeteer@25.10.0`、`@puppeteer/browsers@3.2.2`、`puppeteer-core@25.10.0`、`sharp@0.35.4`、`postcss@8.5.28`、`nanoid@3.3.18`。`extract-zip`は解決グラフから消えた。
- `npm ci --dry-run` と `npm ci --omit=dev --dry-run` はともにexit 0。
- dependency security / PDF route / PDF export focused testは3 suites、10 tests pass。
- `npx tsc --noEmit --incremental false`はexit 0。
- `npm run lint`はexit 0。Next.jsのdeprecated noticeと既存ファイルのwarningのみ。
- `npm test -- --runInBand`は最終実行で145 suites pass / 2 skipped、918 tests pass / 13 skipped。途中の全体実行で既存`page.streaming.test.tsx`のtest-order failureが一度出たが、該当suite単独11/11 pass後の全体再実行で解消した。
- `npm run build`はexit 0。`transit-config.json`不在による既存GTFS importエラー表示は継続したが、scriptは終了し、Next production buildまで完了した。
- 修正後auditは全体11件（high 8 / moderate 3）、`--omit=dev` 8件（high 6 / moderate 2）。対象のNext.js/Puppeteer/Sharp/PostCSS/NanoID関連キーは両結果に残っていない。残存highは調査で定義したPrisma、GTFS/build、開発専用範囲として保留する。
