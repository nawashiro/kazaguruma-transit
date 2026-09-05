# Issue #118 実装タスクリスト

**Issue**: [#118](https://github.com/nawashiro/kazaguruma-transit/issues/118)

**Repository**: `/opt/data/kazaguruma-transit`

**Branch**: `fix/issue-118-dependency-vulnerabilities`

**Base**: `dev` / `28929bf9e09d797d2fea27326d30895e5e17f02a`

## 実行規約

- 作業言語は日本語とする。
- `AGENTS.md` と `.specify/memory/constitution.md` の命名、型安全性、単純性、文書化、検証方針を適用する。
- 今回はsecurity maintenanceであり、behavior TDDを作業の中心にしない。ただし既存security testを後退防止のcontractとして先に更新し、依存変更前に意味のある境界確認を行う。
- writerは自分のhard writable pathsだけを変更し、commit、push、reset、clean、stageを行わない。
- `src/**`（ただし`src/app/api/pdf/generate/route.ts`のnetwork idle待機の型互換だけを許可）、Docker、Prisma、GTFS、Lighthouse、既存spec/docs（本Issue文書を除く）は凍結する。
- `npm audit fix --force`と手動lockfile編集は禁止する。
- build後も対象外の差分がないことを親が確認する。

## Phase 1: 基準・調査・設計

- [x] T001 `origin/dev`をfetchし、`28929bf9e09d797d2fea27326d30895e5e17f02a`を基準に実装ブランチを作成した。開始時のstatusとdiff checkはclean。
  - writable: なし
  - evidence: Node 22.23.2 / npm 10.9.8で全audit 22件（high 16）、`--omit=dev` 20件（high 15）を確認。

- [x] T002 Issue本文・コメント・既存PR・keyword重複・関連履歴・依存の実行経路を調査し、対象をNext.jsとPDF APIのPuppeteerへ限定した。未使用の直接依存と型stubも削除候補として記録した。
  - writable: `issues/118-dependency-vulnerabilities/investigation.md`
  - evidence: Issue open/comments 0、#118候補PRなし、`/api/pdf/generate`が外部POSTからPuppeteerを起動することを確認。

- [x] T003 `spec.md`、`plan.md`、本`tasks.md`を作成し、security境界、非ゴール、hard writable paths、凍結paths、検証コマンドを確定した。
  - writable: `issues/118-dependency-vulnerabilities/spec.md`, `issues/118-dependency-vulnerabilities/plan.md`, `issues/118-dependency-vulnerabilities/tasks.md`
  - evidence: 設計上の対象は`package.json`、`package-lock.json`、security test、Issue文書だけ。

**Checkpoint**: T001〜T003で基準SHA、監査件数、外部到達経路、対象・対象外、書込境界が確定している。

## Phase 2: Security contract

- [x] T004 [TEST] `__tests__/dependency-security.test.ts`だけを変更し、次を契約化した。
  - `package.json`の`next`が`^15.5.21`以上である。
  - `package.json`の`puppeteer`が`^25.10.0`以上である。
  - 解決済みmanifestのNext.js/Puppeteer versionが同じ境界を満たす。
  - Next.js配下の`postcss`、`sharp`、`nanoid`が修正済み境界を満たす。
  - `transit-departures-widget`と`@types/puppeteer`を宣言しない。
  - 既存のPostCSS契約を弱めない。
  - writable: `__tests__/dependency-security.test.ts`
  - frozen: `package.json`, `package-lock.json`, `src/**`, Issue文書
  - evidence: 旧依存状態で意味のあるRED（宣言2 failures、解決2 failures）を確認し、collection/setup errorはなかった。

- [x] T005 [VERIFY] T004の変更bytesを親が読み、テストが実在のpackage manifest/installed packageを検査し、固定された脆弱path一覧やvacuous assertionに依存しないことを確認した。今回の小さなsecurity contractでは、別production writerへの委任は行わなかった。
  - writable: なし
  - frozen: T004以外の全path
  - evidence: `git diff --check` exit 0。旧境界でRED、更新後にfocused test passを確認。

**Checkpoint**: T004〜T005のcontract確認後まで依存更新を開始しない。

## Phase 3: 依存関係修正

- [x] T006 [DEPENDENCY] 次のpackage manifestだけをnpmで更新し、lockfileを生成した。
  - `next`: `^15.5.25`（監査境界15.5.21以上）
  - `puppeteer`: `^25.10.0`
  - `postcss`: `^8.5.28`
  - 削除: `transit-departures-widget`
  - 削除: `@types/puppeteer`
  - `next` override: `postcss: ^8.5.28`, `sharp: ^0.35.4`
  - writable: `package.json`, `package-lock.json`
  - frozen: `__tests__/dependency-security.test.ts`, `src/**`, Docker、Prisma、GTFS、Lighthouse
  - command: Node 22で`PUPPETEER_SKIP_DOWNLOAD=true npm install`と対象packageの`npm uninstall`を実行した。
  - evidence: package.jsonの直接依存差分とnpm生成lockfileを確認。`npm audit fix --force`、手動lockfile編集、無関係なmajor更新は行っていない。

- [x] T006B [COMPAT] Puppeteer 25の型互換のため、`src/app/api/pdf/generate/route.ts`のHTML待機だけを変更した。
  - `setContent`の`waitUntil: "networkidle0"`を`waitUntil: "load"`へ変更した。
  - 続けて`waitForNetworkIdle({ concurrency: 0, idleTime: 500, timeout: 60000 })`を呼び、旧待機条件の意味を維持した。
  - writable: `src/app/api/pdf/generate/route.ts`の上記待機部分だけ
  - frozen: PDF入力契約、HTML生成、外部API、rate limit、PDF option、その他`src/**`
  - evidence: strict TypeScript、PDF route/PDF export focused test、buildがpass。

- [x] T007 [VERIFY] T006/T006B直後に依存解決と書込境界を親が確認した。
  - writable: なし
  - verify: `npm ls next puppeteer @puppeteer/browsers puppeteer-core extract-zip sharp postcss nanoid --all`、`npm ci`、`git diff --name-status`、`git diff --check`。
  - evidence: clean installはexit 0。`next@15.5.25`、`puppeteer@25.10.0`、`@puppeteer/browsers@3.2.2`、`puppeteer-core@25.10.0`、`sharp@0.35.4`、`postcss@8.5.28`、`nanoid@3.3.18`。`extract-zip`・削除依存はabsent。

## Phase 4: 機能非破壊・監査検証

- [x] T008 [SECURITY] Node 22.xで`npm audit --omit=dev --json`と全体`npm audit --json`を再実行し、対象highの解消と保留highを区別した。
  - writable: `issues/118-dependency-vulnerabilities/investigation.md`, `issues/118-dependency-vulnerabilities/tasks.md`
  - frozen: production source、package manifest/lock（検証中は変更しない）
  - evidence: 全体11件（high 8 / moderate 3）、`--omit=dev` 8件（high 6 / moderate 2）。対象の`next`、`puppeteer`、`puppeteer-core`、`@puppeteer/browsers`、`extract-zip`、`sharp`、`postcss`、`nanoid`は両結果に残らない。残存highはPrisma、GTFS/build、開発系として保留し、audit zeroとは報告しない。

- [x] T009 [TEST] security contract、PDF route contract、Puppeteer import解決に関係する既存テストを実行した。
  - writable: なし
  - verify: `npm test -- --runInBand --runTestsByPath __tests__/dependency-security.test.ts src/app/api/__tests__/pdf-route-contract.test.ts src/components/features/__tests__/RoutePdfExport.test.tsx --silent`
  - evidence: Node 22.23.2で3 suites / 10 tests pass。Puppeteer importも`launch`と`executablePath`の存在を確認した。

- [x] T010 [QUALITY] canonical quality gatesをNode 22.xで実行した。
  - writable: なし（buildが生成するignored/artifactは差分確認対象）
  - verify: `npx tsc --noEmit --incremental false`、`npm run lint`、`npm test -- --runInBand`、`npm run build`
  - evidence: strict TypeScript exit 0、lint exit 0、全Jestは145 suites pass / 2 skipped、918 tests pass / 13 skipped、build exit 0。lintとbuildには既存warningおよび`transit-config.json`不在によるGTFS設定エラー表示があるが、各コマンドは成功終了した。

- [x] T011 [REDTEAM] 親が最終差分を再レビューし、Puppeteer 25のNode要件、未使用依存の参照なし、PDF routeの待機変更以外の凍結、lockfile整合、audit分類をもう一度確認した。
  - writable: `issues/118-dependency-vulnerabilities/investigation.md`, `issues/118-dependency-vulnerabilities/plan.md`, `issues/118-dependency-vulnerabilities/tasks.md`
  - verify: `git status --short --untracked-files=all`、`git diff --stat`、`git diff --check`、source search、manifest/lock JSON整合。
  - evidence: 許可したtracked pathは`__tests__/dependency-security.test.ts`、`package-lock.json`、`package.json`、`src/app/api/pdf/generate/route.ts`のみ。clean `npm ci`後の対象treeにinvalid/missing/extraneousなし。対象外sourceの変更なし。

## Phase 5: 配送

- [ ] T012 [DELIVERY] 最終manifestだけをcommitし、feature branchへpushする。PRはbase `dev`、Issue #118をcloseする本文、変更理由、対象外、実測テスト、残存auditを日本語で記載する。
  - writable: Git metadata、許可済みIssue文書
  - frozen: 未レビューの全path
  - verify: commit SHA、remote branch SHA、PR head/base/title/body/filesを読み戻す。mergeはしない。

- [ ] T013 [CI] pushしたexact SHAのGitHub checksを確認し、terminal stateだけを報告する。watcher timeoutや未triggerを成功扱いしない。
  - writable: `issues/118-dependency-vulnerabilities/tasks.md`, `issues/118-dependency-vulnerabilities/investigation.md`
  - verify: `gh pr checks` / `gh run view`でhead SHA一致を確認。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T006B → T007 → T008 → T009 → T010 → T011 → T012 → T013
```

T004〜T005は本番sourceのbehavior testではなく、今回のsecurity範囲を将来も維持するための最小contractである。同一pathを複数writerが変更せず、親が全実測結果を管理する。
