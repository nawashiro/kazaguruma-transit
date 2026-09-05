# Issue #121 受賞データの不要な抽象化削減 タスクリスト

- Issue: [#121](https://github.com/nawashiro/kazaguruma-transit/issues/121)
- Repository: `/opt/data/kazaguruma-transit`
- Base: `dev` / `74d26f189f5db683a2cefae5d5fdc576c3a9638f`
- Implementation branch: `fix/issue-121-award-data-kiss`
- Related documents: `investigation.md`、`spec.md`、`plan.md`
- 作業言語: 日本語

## 実行規約

- `AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0を適用する。実務上の正本は`AGENTS.md`である。
- Issueの対象は`src/lib/award/award-data.ts`の不要な専用データ抽象化である。合理的な`PageHeader`は維持する。
- `award-data.ts`は最新基準でconsumerが`AwardPage`の1つだけなので削除する。別のshared data object、JSON、utility、fallbackは作らない。
- #122で統合済みのホーム運営告知、`PageHeader`、route metadata、Sidebar、sitemap、CSS、設定、依存関係、Nostr、Prisma/SQLite、GTFS、認証は変更しない。
- `[x]`は親が実際のbytes、diff、コマンド結果を検証したtaskだけに付ける。
- test writerは指定test pathだけ、production writerは指定production pathだけを変更し、commit・push・PRは行わない。
- test reviewerはread-onlyで、必ず次を返す。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
modified: false
```

- review後にtest bytesを変更した場合、前のreviewは無効とし、再RED・fresh reviewを行う。
- `npm run build`は最終品質ゲートで一度だけ実行する。

## Phase 1: 基準・調査・設計

- [x] **T001 [BASE-INVESTIGATE-VERIFIED]** `origin/dev`をfetchし、`74d26f189f5db683a2cefae5d5fdc576c3a9638f`からfeature branchを作成した。Issue #121の本文・状態・コメント、Issue番号／症状／award検索の重複PR、現行`award/page.tsx`、`award-data.ts`のconsumer、#122統合後の履歴、`AGENTS.md`、憲章、既存テストをread-onlyで確認した。基準focused testは1 suite / 3 tests passed、初回の古いAwardRecognition path指定はENOENTとして分離記録した。

- [x] **T002 [SPEC-PLAN-TASKS-VERIFIED]** `issues/121-award-data-kiss/`に`investigation.md`、`spec.md`、`plan.md`、`tasks.md`を作成した。`PageHeader`維持、`award-data.ts`削除、静的値のpage内直接記述、受入条件、hard write boundary、RED→review→GREEN、最終検証を日本語で固定した。

**Checkpoint:** Issueの対象を「静的受賞文書専用の`award-data.ts`削除」に確定し、`PageHeader`、metadata、ホーム告知、依存関係、他の表示経路を対象外とした。

## Phase 2: 回帰契約（RED → fresh review）

- [x] **T003 [TEST-RED-VERIFIED]** `src/app/award/__tests__/page.test.tsx`だけを変更した。
  - `node:fs`と`node:path`の必要な関数を追加する。
  - `src/app/award/page.tsx`のsourceに`@/lib/award/award-data`のimportがないことを検証する。
  - `src/lib/award/award-data.ts`が存在しないことを検証する。
  - 既存の受賞内容、画像、外部リンク、h1/h2、style assertionを削除・弱体化しない。
  - production、他test、Issue docs、設定、lockfile、commit、pushは禁止。
  - 親が次を実行する。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/award/__tests__/page.test.tsx --silent
```

  - 期待: 旧productionでは新規contractが`award-data` import／ファイル存在を検出して意味のあるREDになる。collection/setup errorではない。
  - Hard write path: `src/app/award/__tests__/page.test.tsx`

- [x] **T004 [TEST-REVIEW-PASS-VERIFIED]** T003のsettled test bytesをfresh read-only reviewerが確認し、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致となった。
  - Issue #121の「受賞文書専用の不要なデータ構造を除去する」要件を直接固定しているか確認する。
  - source pathが実際のproduction fileを読み、旧実装でvacuousにならずREDになるか確認する。
  - 既存の表示・画像・外部リンク・ARIA・style契約を削除／弱体化していないか確認する。
  - `PageHeader`を誤って禁止するテストになっていないことを確認する。
  - `git status`、`git diff --check`、開始／終了SHAを確認し、全path無変更を証明する。
  - 必須結果: `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
  - FAILならT003直後に最小correction taskを挿入し、RED→再レビューを完了するまでT005へ進まない。

**Checkpoint:** T003の意味あるREDとT004の明示的PASSが揃うまでproductionを変更しない。

## Phase 3: production実装（GREEN）

- [x] **T005 [IMPLEMENT-GREEN-VERIFIED]** T004 PASS後、次のproduction pathだけを1サブエージェントへ委任した。`page.tsx`へ静的値を戻し、`award-data.ts`を削除した。focused Jestは1 suite / 5 tests passed。
  - Hard write paths: `src/app/award/page.tsx`、`src/lib/award/award-data.ts`（削除）。
  - `page.tsx`の`@/lib/award/award-data` importと定数参照を削除する。
  - 受賞名、賞名、選出区分、授与日、発行者、作品紹介URL、バッジ確認URL、バッジ画像URLをpage JSXへ直接記述する。
  - `PageHeader`のimportと呼び出しは維持する。
  - カード構造、画像属性、alt、linkのaccessible name、`target`、`rel`、既存class、文章、metadataの表示を維持する。
  - new data module、local aggregate object、fallback、API、fetch、永続化は追加しない。
  - test、Issue docs、共通component、Home、config、lockfile、commit、pushは禁止。
  - writer完了後、親が変更pathとdiffを確認し、focused testをGREENとして再実行する。

- [x] **T006 [PARENT-VERIFY-GREEN]** 親がT005の自己申告を信用せず、現行bytesとscoped diffを再確認した。許可manifest内のproduction差分、data module不在、PageHeader維持、focused Jest 5/5 GREEN、diff checkを確認した。
  - `git diff --name-status`がtest、page、data削除、Issue docsだけであることを確認する。
  - `git grep -n 'award-data\|AWARD_' -- ':!issues/*' ':!specs/*'`でproduction consumerと旧export参照が0件であることを確認する。
  - `PageHeader`、`award/layout.tsx`、`src/app/page.tsx`に差分がないことを確認する。
  - focused Jestを再実行し、既存3 testsと新規contractがGREENになることを確認する。
  - `git diff --check`を実行する。

**Checkpoint:** 共有データmoduleが消え、受賞ページの表示契約がGREENで、production差分がmanifest内に限定されている。

## Phase 4: 感度確認・品質・文書

- [x] **T007 [SENSITIVITY-VERIFIED]** 新規contractを旧productionへ一時復元して実行し、2 failed / 3 passedの意味あるREDを確認した。修正版へ復元後に5 passedのGREEN、page hash一致、data module不在、`git diff --check`を確認した。
  - T005で変更した`page.tsx`と削除した`award-data.ts`を一時ディレクトリへ退避する。
  - `origin/dev`のpageとdata moduleを許可pathへ一時復元する。
  - focused Jestを実行し、新規contractがRED、既存の表示テストが意味のある範囲で動くことを確認する。
  - `finally`相当で修正後のbytesを復元し、SHA／ハッシュまたはdiffを比較する。
  - 修正状態でfocused GREENと`git diff --check`を再実行する。旧状態を共有worktreeへ残さない。

- [x] **T008 [QUALITY-GATES-VERIFIED]** Node.js 22.23.2で品質ゲートを実行した。strict TypeScript exit 0、lint exit 0、全Jestは2 skipped / 145 passed suites・13 skipped / 916 passed tests、build exit 0、`git diff --check` exit 0。lint/buildの既存warning、`next lint`非推奨表示、`transit-config.json`欠如によるGTFS import表示は失敗と分離した。

```bash
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand
PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build
git diff --check
git status --short --untracked-files=all
```

  - `npm run build`は一度だけ実行する。
  - `transit-config.json`不足、既存warning、`next lint`非推奨表示は終了コードと分離して記録する。

- [x] **T009 [DOCS-VERIFIED]** `investigation.md`と`plan.md`へ、RED、fresh review、GREEN、感度確認、focused/full Jest、strict TypeScript、lint、build、diff/statusの親実測を追記した。古いAwardRecognition pathのENOENTは成功扱いせず、`PageHeader`維持と#122非対象を記録した。
  - RED、review、GREEN、感度確認、focused/full Jest、strict TypeScript、lint、build、diff/statusを実際の出力で記録する。
  - 古いAwardRecognition pathのENOENTを成功扱いしない。
  - 変更path、consumer検索、PageHeader維持、Issue #122非対象を明記する。
  - docs更新後に相対link、placeholder、末尾空白、`git diff --check`を確認する。

## Phase 5: 配送

- [ ] **T010 [DELIVERY]** 親が最終diffを再レビューし、日本語の短いprefix commitを作成してfeature branchをpushする。
  - commit message例: `fix: 受賞ページの不要なデータ抽象化を削除`
  - `origin/fix/issue-121-award-data-kiss`のremote SHAとlocal `HEAD`を一致させる。
  - PRを作成する場合はbase=`dev`、Issue #121を本文で明示し、title、body、head、base、head SHA、changed filesをGitHubから読み戻す。
  - merge、Issue closeは行わない。

- [ ] **T011 [CI]** PRを作成した場合、push後のexact head SHAに対するGitHub Actionsを終端まで確認する。
  - pendingをsuccess扱いしない。
  - failureは今回のdiff、baseline、infrastructureへ分類する。
  - PRとCIの実測状態を本ファイルと`investigation.md`へ追記する。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011
```

T004のfresh review PASS前にT005を開始しない。test bytesが変わった場合、前のreviewは無効である。T006〜T011は親が実測して完了扱いにする。

## 受入条件と証拠task

| 受入条件 | 証拠task |
|---|---|
| `page.tsx`が`award-data`をimportしない | T003 RED、T005、T006 |
| `award-data.ts`が削除される | T005、T006、T007 |
| 既存表示値・画像・リンク・ARIAを維持する | T006、T008 |
| `PageHeader`、metadata、ホーム告知を維持する | T006、T008 |
| TDDとfresh test reviewを満たす | T003、T004、T006 |
| 旧実装で回帰testが失敗する | T003、T007 |
| 品質ゲートを通過する | T008 |
| docs、remote SHA、PR、exact-SHA CIを確認する | T009〜T011 |
