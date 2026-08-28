# Issue #108 実装タスクリスト

**Issue**: [#108](https://github.com/nawashiro/kazaguruma-transit/issues/108)

**入力**: `.hermes/issue-108/investigation.md`、`AGENTS.md`、`.specify/memory/constitution.md`

**Repository**: `/opt/data/work/kazaguruma-transit-issue-108`

**Branch**: `chore/issue-108-lucide`

**Base**: `dev` / `616610daa08f73f473f776dc7d46827896d7b888`

## 実行規約

- 本リストは親エージェントが進捗・受入条件・書込境界・検証結果を管理する実行契約である。チェックを付けるのは、親が実ファイルと終了コードを再確認した後だけとする。
- 作業言語は日本語。実装は必ず TDD とし、テストを先に追加して意味のあるREDを確認する。
- テスト作成タスクの直後に、別のfresh read-only subagentによるテストレビューを置く。レビューの必須結果は次のとおり。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

- `CHANGES_REQUESTED`、`INCOMPLETE`、`MAX_ITERATIONS`、完了通知、別byte状態での実行結果はレビューPASSではない。
- 本番実装後のレビュータスクは置かない。親が、現行bytes、対象path、focused GREEN、strict TypeScript、Lint、`git diff --check`、全体検証を確認する。
- writerは指定したhard writable pathsだけを変更し、commit、push、reset、clean、stage、依存関係の勝手な追加を行わない。依存追加が明記されたタスクだけpackage metadataを変更できる。
- 以下は凍結する。
  - `src/app/icon.svg`（Next.js静的アプリ用アイコン。UIアイコンではないため保持）
  - `src/app/apple-icon.png`（worktree作成時のLFS pointer差分。Issue変更ではない）
  - 上記以外の、各タスクで明記していないファイル
- 変更後の親検証で未指定pathが見つかった場合、そのタスクは未完了として差し戻す。
- `npm run build` はPrisma/GTFS副作用を伴うため最終検証で一度だけ実行する。Nodeは `/opt/data/toolchains/node-v22.23.2/bin` をPATH先頭に置く。

## Phase 1: Investigation and setup

- [x] T001 `origin/dev`をfetchし、ローカル`dev`を`616610daa08f73f473f776dc7d46827896d7b888`へ更新してから、`chore/issue-108-lucide` worktreeを作成する。`git status --short --untracked-files=all`でLFS pointer差分を記録し、`.hermes/issue-108/investigation.md`へIssue、憲章、20ファイル/23 import、SVG残存、依存関係、検証結果を記録した。

- [x] T002 Node 22.23.2で`npm install --no-audit --no-fund`を完了し、既存の focused accessibility contract、strict TypeScript、Lint、diff checkを実行する。Node 26でのbetter-sqlite3失敗とNode 22での成功をinvestigationへ分離記録する。tracked source/packageの変更は発生させない。

**Checkpoint**: ベースSHA、Issue状態、旧importの全対象、静的app iconの除外、LFS差分、Node実行条件が確定している。

## Phase 2: Contract test (RED → review)

- [x] T003 [TEST] `src/app/__tests__/icon-library-contract.test.ts` を新規作成する。production source（`src/app`・`src/components`配下、`__tests__`除外）とroot `package.json`を読み、次を検証する。
  - production codeに`@heroicons/react` / `react-icons`のimportまたは参照がない。
  - production codeに手書きSVG断片（少なくとも`xmlns="http://www.w3.org/2000/svg"`、`<path`、`<circle`、`<polyline`等）がない。
  - `package.json`に`lucide-react`があり、旧2ライブラリが直接dependenciesからない。
  - production sourceに`lucide-react`の利用がある。
  - `src/app/icon.svg`をUI source scanへ含めない。
  テストはsource文字列の曖昧な一括置換ではなく、決定的にpathと失敗対象を出す。変更前実行で、collection/setupではなく旧import・package・SVG断片を理由にREDになることを確認する。書込境界はこのtest fileのみ。
  実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/icon-library-contract.test.ts --silent`

- [x] T004 [REVIEW] T003でsettleした`src/app/__tests__/icon-library-contract.test.ts`を、別fresh read-only subagentへレビュー委任する。確認項目は、実在する旧import・依存関係・SVG残存を検出すること、Lucide導入を要求すること、静的app icon/LFS差分を誤検出しないこと、production/test境界、テスト自身の自己合格やvacuous assertionがないこと、RED理由が実装不足であること。テスト・production・package・docsを変更せず、`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS` を返すまでT005以降を開始しない。実測: 1 suite / 5 tests中1 PASS・4 RED、review `PASS`。

**Checkpoint**: T003の意味あるREDとT004の明示的PASSが揃っている。

## Phase 3: Lucide migration

### 3-A. Shared UI and layout

- [x] T005 [US1] T004 PASS後、次のproduction filesだけを変更し、旧importをLucideへ置換する。`className`、サイズ、色、装飾アイコンの`aria-hidden`、既存操作を保つ。依存追加を含むため`package.json`と`package-lock.json`をこのタスクで更新し、`lucide-react`を導入する。ただし旧2直接依存の削除は全source移行後のT009で行う。実測: shared focused 5 suites / 29 tests、TypeScript、Lint、diff checkがPASS。
  - `src/components/ui/NpubDisplay.tsx`
  - `src/components/ui/ThemeToggle.tsx`
  - `src/components/ui/InputField.tsx`
  - `src/components/ui/CarouselCard.tsx`
  - `src/components/layouts/Sidebar.tsx`
  - `src/components/layouts/SidebarLayout.tsx`
  - `package.json`
  - `package-lock.json`
  代表対応: `Check`、`Clipboard`、`Moon`、`Sun`、`TriangleAlert`、`ArrowLeft`、`ArrowRight`、`House`、`CircleHelp`、`BookOpen`、`FileText`、`RefreshCw`、`Rocket`、`Info`、`MapPin`、`MessageCircle`、`Settings`、`Trophy`、`Heart`、`Menu`。実行: shared component focused tests、strict TypeScript、対象Lint、`git diff --check`。

### 3-B. Feature components

- [x] T006 [US1] T005完了後、次のfeature filesだけを変更し、react-icons/HeroiconsをLucideへ置換する。既存の検索・GPS・PDF・カレンダー操作、loading時の表示、accessible nameを変えない。過去の手書きSVGコメントも、存在するファイルで削除する。実測: feature focused 5 suites / 31 tests、TypeScript、Lint、diff checkがPASS。
  - `src/components/features/RoutePdfExport.tsx`
  - `src/components/features/RouteCalendarExport.tsx`
  - `src/components/features/OriginSelector.tsx`
  - `src/components/features/DestinationSelector.tsx`
  - `src/components/features/LocationSuggestions.tsx`
  実行: feature focused tests、strict TypeScript、対象Lint、`git diff --check`。

### 3-C. App routes

- [x] T007 [US1] T006完了後、次のroute filesだけを変更し、HeroiconsをLucideへ置換する。状態メッセージ、form/Link、Nostr read/write、router遷移、`aria-hidden`を保持する。過去の手書きSVGコメントは存在するファイルで削除する。実測: route focused 6 suites / 51 tests、TypeScript、Lint、diff checkがPASS。
  - `src/app/locations/page.tsx`
  - `src/app/settings/page.tsx`
  - `src/app/discussions/create/page.tsx`
  - `src/app/discussions/manage/page.tsx`
  - `src/app/discussions/[naddr]/approve/page.tsx`
  - `src/app/discussions/[naddr]/edit/page.tsx`
  実行: affected route/component focused tests、strict TypeScript、対象Lint、`git diff --check`。

### 3-D. Discussion components

- [x] T008 [US1] T007完了後、次のdiscussion filesだけを変更し、HeroiconsをLucideへ置換する。評価・権限案内・タブナビゲーションの既存状態、role、label、callbackを保持し、手書きSVGコメントは削除する。実測: discussion focused 3 suites / 25 tests、TypeScript、Lint、diff checkがPASS。
  - `src/components/discussion/DiscussionRoleCard.tsx`
  - `src/components/discussion/DiscussionTabLayout.tsx`
  - `src/components/discussion/EvaluationComponent.tsx`
  実行: affected discussion focused tests、strict TypeScript、対象Lint、`git diff --check`。

### 3-E. Dependency and dead-markup cleanup

- [x] T009 [US1] T008完了後、production source全体の旧importが0件であることを確認してから、`package.json`と`package-lock.json`から`@heroicons/react`と`react-icons`を削除する。T006/T007/T008で指定した4ファイル以外に残る死んだSVG markup断片があれば、該当する明示pathだけを修正する。`src/app/icon.svg`は変更しない。実行: `npm uninstall @heroicons/react react-icons --no-audit --no-fund`（Node 22）、契約テスト、`npm ls @heroicons/react react-icons lucide-react --depth=0`、strict TypeScript、対象Lint、`git diff --check`。実測: 契約1 suite / 5 tests、TypeScript、Lint、diff checkがPASS、`npm ls`はLucideのみ。
  書込境界: `package.json`、`package-lock.json`、T006/T007/T008で明記済みのSVGコメント含有sourceのみ。未指定sourceの変更は禁止。

**Checkpoint**: Issue専用icon contractがGREEN、旧packageが直接依存から消え、production sourceの旧import・手書きSVG断片が0件である。

## Phase 4: Parent verification and delivery

- [x] T010 親エージェントが現行worktreeを再確認する。`git status --short --untracked-files=all`、`git diff --name-status`、`git diff --check`、変更pathのSHA-256を取り、凍結対象（`src/app/icon.svg`、`src/app/apple-icon.png`）が不変であること、依存・source・test・docsの変更が受入範囲内であることを確認する。旧import、`xmlns`、手書きSVG断片、旧package名をproductionとpackageで再検索する。実測: 旧import・SVG断片0件、凍結path保持、未指定source変更なし。

- [x] T011 親エージェントがNode 22.23.2でfocused suite、`PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false`、`PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint`、`PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand` を実行する。全Jestの失敗は変更起因か、pre-existing baselineか、環境起因かを分類し、baseline再現なしに成功扱いしない。実測: TypeScript/Lint/各focusedはPASS、full Jestは136 PASS・1 FAIL・2 skipped suitesで、唯一の色監査FAILはベースSHAでも再現。

- [x] T012 `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build` を最終ゲートとして実行し、Prisma/GTFS副作用とwarningを結果から分離して記録する。buildが変更と無関係な環境要因で失敗した場合は、代替成功を捏造せず明示する。実測: exit 0。`transit-config.json`不在のGTFS importエラー表示、既存warning、Next production build成功を分離記録。

- [x] T013 `.hermes/issue-108/investigation.md` の結論・検証結果と `tasks.md` の実績を、親側の実測値だけで更新する。Issue、憲章、除外path、Node条件、RED/GREEN、full test、lint、typecheck、build、statusを同期する。文書の末尾空白と相対リンクを確認する。実測: 実装後検証、baseline比較、full Jest/build、未commit状態を両文書へ反映。

- [ ] T014 変更差分を親が再レビューし、conventional prefixの日本語commitを作成して`origin/chore/issue-108-lucide`へpushする。PRを作成する場合はbaseを`dev`に明示し、Issue #108をcloseする本文、変更理由、検証結果、未変更範囲、Node 22条件を日本語で記載する。PR作成後にtitle/body、head/base、changed filesを読み戻す。

- [ ] T015 pushしたexact SHAに対してGitHub checksを確認する。CIが未triggerなら成功扱いにせず「未trigger」と報告し、failureならログを調査して変更起因・baseline・infrastructureを分類する。mergeはユーザーの明示承認なしに行わない。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009
T009 → T010 → T011 → T012 → T013 → T014 → T015
```

同一pathを複数writerが触らない。T005〜T009は内容上分割しているが、旧importが残る中間状態をGREENと呼ばない。各writer完了後、親は必ず次のタスクへ進む前に現行bytesとfocused検証を再確認する。

## 受入条件と検証の対応

| 受入条件 | 主な証拠 |
|---|---|
| 旧import 0件 | T003 RED、T009契約GREEN、T010 production再検索 |
| 旧package削除 | T003 RED、T009 `npm uninstall`/`npm ls`、T010 package確認 |
| Lucide利用 | T003契約、T005〜T008 imports、T009 GREEN |
| SVG断片除去 | T003 RED、T006〜T009 cleanup、T010再検索 |
| 既存挙動維持 | T005〜T008 focused tests、T011 full Jest |
| static icon/LFS差分保持 | T010 status/SHA |
| repository品質 | T011 TypeScript/Lint/Jest、T012 build、T013 docs/diff |
