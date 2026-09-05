# Issue #118 実装計画

## 1. 前提とconstitution gate

- 基準: `origin/dev` / `28929bf9e09d797d2fea27326d30895e5e17f02a`
- 実装ブランチ: `fix/issue-118-dependency-vulnerabilities`
- 作業言語: 日本語
- 正本: `AGENTS.md`。Core PrinciplesのClear Naming、Simple Logic、Structured Organization、Type Safety、Test-First Development、Documentation & Commentsを適用する。
- 憲章: `.specify/memory/constitution.md`。`dev`起点、親による受入条件・書込境界・検証結果の管理、完了前のcanonical verificationを適用する。
- 今回は依存関係の解決値と宣言を直すsecurity maintenanceであり、業務ロジックのTDDを中心にしない。ただし将来の後退を検出する既存security testの最小guardrailは先に更新し、変更後に実行する。

## 2. 設計

### 2.1 変更方針

1. `next`は監査のhigh修正境界である15.5.21以上へ宣言を引き上げ、npmの実解決結果では`^15.5.25` / `15.5.25`となった。
2. `puppeteer`は24系のままではhigh修正境界に届かないため、`^25.10.0` / `25.10.0`へmajor更新する。Puppeteer 25で型が変わったnetwork idle待機だけ、route側を同値のAPIへ適応する。
3. Next.js配下の`postcss`、`sharp`、`nanoid`とPuppeteer配下のブラウザ依存は、package managerのlockfile更新と`next` overrideで修正済み系列へ解決させる。
4. 参照がない`transit-departures-widget`と型stubの`@types/puppeteer`は、upgradeではなく削除する。
5. Prisma、Lighthouse、GTFS、license plugin等の開発/build専用経路は、Issue本文の「それ以外は一旦保留」に従い触らない。

### 2.2 書込マニフェスト

許可するpathは次だけとする。

- `package.json`
- `package-lock.json`
- `src/app/api/pdf/generate/route.ts`（Puppeteer 25のnetwork idle待機の型互換のみ）
- `__tests__/dependency-security.test.ts`
- `issues/118-dependency-vulnerabilities/investigation.md`
- `issues/118-dependency-vulnerabilities/spec.md`
- `issues/118-dependency-vulnerabilities/plan.md`
- `issues/118-dependency-vulnerabilities/tasks.md`

凍結するpathは次のとおり。

- `src/**`（ただし`src/app/api/pdf/generate/route.ts`のnetwork idle待機の型互換だけを許可）
- `next.config.ts`
- `Dockerfile*`、composeファイル
- `prisma/**`、`scripts/**`
- 既存spec/docs（Issue専用文書を除く）

## 3. 実行手順

### Phase 1: 契約を先に固定

既存の`__tests__/dependency-security.test.ts`へ、package manifestのrangeとインストール済みmanifestのversionを検査する小さなsecurity contractを追加する。対象はNext.js、PuppeteerおよびNext.jsの本番サブ依存だけに限定し、仮想的な全依存の固定リストやfull audit zeroをテストしない。

実装前に次を実行する。

```bash
PATH=/opt/data/toolchains/node-v22.23.2-linux-x64/bin:$PATH \
  npm test -- --runInBand --runTestsByPath __tests__/dependency-security.test.ts --silent
```

既存テストがpassした場合は、今回の変更のREDを作るために脆弱境界を要求する契約へ更新したことを記録し、production sourceはまだ変更しない。

### Phase 2: 依存関係更新

Node 22.xでnpmを実行し、次の直接更新・削除を行う。

```bash
PATH=/opt/data/toolchains/node-v22.23.2-linux-x64/bin:$PATH \
  PUPPETEER_SKIP_DOWNLOAD=true \
  npm install next@^15.5.21 puppeteer@^25.10.0 --save
PATH=/opt/data/toolchains/node-v22.23.2-linux-x64/bin:$PATH \
  npm uninstall transit-departures-widget --save
PATH=/opt/data/toolchains/node-v22.23.2-linux-x64/bin:$PATH \
  npm uninstall @types/puppeteer --save-dev
```

実際にはnpmが`next@^15.5.25`を書き込み、`postcss@^8.5.28`と`next`配下の`postcss`/`sharp` overrideを追加した。Puppeteer 25の型互換としてrouteの待機表現だけを変更した。

`npm install`/`npm uninstall`が更新するlockfileはnpmの生成結果をそのまま利用する。`--force`、手動lockfile編集、無関係なmajor updateは行わない。

### Phase 3: 親による検証

1. `git diff --name-status`と`git diff --check`で書込境界を確認する。
2. `npm ls next puppeteer @puppeteer/browsers puppeteer-core extract-zip sharp postcss nanoid --all`で解決値を確認する。
3. `npm audit --omit=dev --json`を再実行し、対象のhighが消えたことと、保留対象の残存を分離する。
4. `dependency-security.test.ts`、PDF route contract、関連既存テストを実行する。
5. `npx tsc --noEmit --incremental false`、`npm run lint`、`npm test -- --runInBand`、`npm run build`をNode 22.xで実行する。
6. build後のlock/package/test/docs以外の差分がないことを確認する。

## 4. リスクと緩和

| リスク | 緩和 |
|---|---|
| Puppeteer 24→25で型/APIが変わる | routeのnetwork idle待機だけをPuppeteer 25 APIへ適応し、strict TypeScript、全Jest、production build、module resolutionを実行する |
| Node要件不足 | Node 22.23.2を使用し、Puppeteer 25.10.0の`>=22.12.0`を満たすことを確認する |
| npm installが無関係なlockfileを更新する | 変更前後のpathと依存差分を確認し、対象外なら戻すのではなく、コマンドの対象を狭めて再生成する |
| auditが全体では非0のままになる | Issueの対象境界と保留理由を監査結果へ記録し、全体zeroとは報告しない |
| 未使用依存の削除が隠れたruntime importを壊す | source、config、testを事前検索し、`npm test`・typecheck・buildで確認する |

## 5. 完了判定

次をすべて満たしたときだけ完了とする。

- 受入基準を満たす差分がある。
- 対象の直接依存が修正済み境界へ解決される。
- security guardrail、既存テスト、strict TypeScript、lint、buildが実測passする。
- audit残存項目をscope付きで記録している。
- 変更path、diff check、commit/push後のremote SHA、PR head、CIを親が読み戻して確認している。

## 6. 実施結果

- Node 22.23.2 / npm 10.9.8で`npm ci`がexit 0。`npm ls`で対象依存のinvalid/missing/extraneousはない。
- security focused testは3 suites / 10 tests pass。strict TypeScript、lint、全Jest（145 pass / 2 skipped、918 tests pass / 13 skipped）、buildはいずれもexit 0。
- 全体auditは11件（high 8 / moderate 3）、`--omit=dev`は8件（high 6 / moderate 2）。対象のNext.js、Puppeteer、Sharp、PostCSS、NanoID系列にhighは残っていない。残存分はIssue本文に従って保留した。
- build時の`transit-config.json`不在メッセージは既存GTFS importの環境警告であり、buildはNext production buildまでexit 0で完了した。
- Puppeteer 25の型互換のため、PDF routeのnetwork idle待機だけを同値のAPIへ適応した。その他のPDF処理・API契約は変更していない。
