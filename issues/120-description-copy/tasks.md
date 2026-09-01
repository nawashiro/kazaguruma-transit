# Issue #120 実装タスクリスト

**Issue**: [#120](https://github.com/nawashiro/kazaguruma-transit/issues/120)

**入力**: `issues/120-description-copy/investigation.md`、`AGENTS.md`、`.specify/memory/constitution.md`

**Repository**: `/opt/data/kazaguruma-transit`

**Branch**: `fix/issue-120-description-copy`

**Base**: `dev` / `db9294742d674d1d59255d1a8c6c2253857e0614`

## 実行規約

- 作業言語は日本語とする。
- `AGENTS.md` と憲章のClear Naming、Simple Logic、Structured Organization、Type Safety、Test-First Development、Accessibility & UX、Documentation & Commentsを適用する。
- 変更は小さく保ち、UIの表示文言と選択ロジック以外を変更しない。
- TDDでテストを先に変更し、実装前にcollection/setupではない意味のあるREDを確認する。
- テスト作成タスクの直後に、別のfresh read-only subagentによるテストレビューを置く。レビューの必須結果は次のとおり。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

- テストレビュー中はproduction code・test・documentを変更しない。レビュー完了前にproduction codeを変更しない。
- writerは各タスクで明記したhard writable pathsだけを変更し、commit、push、reset、clean、stageを行わない。
- `src/app/page.tsx` の検索処理、`DiscussionManagementProvider` のリレー読み込み、title、loading/partial/error、ARIA、SEO metadata、manifestは変更しない。
- `npm run build` は最終検証で一度だけ実行する。可能ならNode 22.xを使用し、環境差分があれば明記する。

## Phase 1: 現状把握

- [x] T001 `origin/dev`をfetchし、ローカル`dev`を`origin/dev`の`db9294742d674d1d59255d1a8c6c2253857e0614`へ合わせる。Issue本文・コメント・重複PR・関連コード・既存テストを確認し、`issues/120-description-copy/investigation.md`へ現状、根因、受入条件、変更境界を記録した。

**Checkpoint**: 基準SHA、Issue状態、静的文言の現状、リレー由来descriptionの選択箇所、変更対象pathが確定している。

## Phase 2: Contract test (RED → fresh review)

- [x] T002 [TEST] 次のtest pathだけを変更する。ホームにIssue指定の説明文を要求し、管理レイアウトではリレー由来のdescriptionがあっても静的`DEFAULT_DESCRIPTION`を表示する契約へ更新する。titleと既存の状態・タブ・role・reload契約は保持する。実装前にcollection/setupではない意味のあるREDを確認する。実測: focused testは終了コード1、2 suites failed、2 tests failed、8 tests passed、collection/setup failureなし。変更pathは指定2テストのみ。
  - `src/app/__tests__/page.test.tsx`
  - `src/components/discussion/__tests__/DiscussionManagementTabLayout.test.tsx`
  - 実行: `npm test -- --runInBand --runTestsByPath src/app/__tests__/page.test.tsx src/components/discussion/__tests__/DiscussionManagementTabLayout.test.tsx --silent`

- [x] T003 [REVIEW] T002でsettleした2つのtest pathを、別fresh read-only subagentへレビュー委任する。Issue本文の2要件を過不足なく固定し、relay readをモックで隠さず、既存のtitle・状態・ARIA・操作契約を弱めず、vacuous assertionや実装詳細依存になっていないことを確認する。実測: `SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS` / `modified: false`。focused review runは2 suites / 10 tests中2 failed・8 passedの意味あるRED、TypeScript・対象Lint・diff checkは終了コード0。

**Checkpoint**: T002の意味のあるREDとT003の明示的なPASSが揃っている。

## Phase 3: Production implementation

- [x] T004 [IMPL] T003 PASS後、次のproduction pathだけを変更する。実測: ホーム説明をIssue提案文へ変更し、管理レイアウトのdescriptionを`DEFAULT_DESCRIPTION`へ固定した。focused testは2 suites / 10 tests PASS、strict TypeScript・対象Lint・`git diff --check`も終了コード0。
  - `src/app/page.tsx`: `PageHeader`のdescriptionを`千代田区地域福祉交通「風ぐるま」の自動案内サイト`へ変更する。
  - `src/components/discussion/DiscussionManagementTabLayout.tsx`: titleのリレー由来表示は維持し、descriptionだけを`DEFAULT_DESCRIPTION`へ固定する。リレーread、状態表示、role、tab、reload、ARIAは変更しない。
  - 実行: T002のfocused test、strict TypeScript、対象Lint、`git diff --check`

- [x] T005 [REFACTOR/VERIFY] T004後、変更差分を読み直し、Issueの2要件と対象外境界をsource searchで確認する。文言の重複定数化やmetadata変更など、Issueに不要な追加変更は行わない。focused testをsettled bytesへ再実行する。実測: production変更2ファイル、test変更2ファイルだけで、旧ホーム文言とrelay優先式は対象sourceから消え、静的文言・固定式は各1件。build後も未指定tracked pathの差分なし。

**Checkpoint**: 2つの表示契約がGREENで、変更pathが4ファイルに限定されている。

## Phase 4: Parent verification and delivery

- [x] T006 親が`git status --short --untracked-files=all`、`git diff --name-status`、`git diff --check`、変更pathとHEADを再確認する。Issue文書を含め、未指定pathの変更がないことを確認する。実測: tracked変更は指定4ファイル、Issue文書2ファイルは意図した未追跡。HEADは基準SHAのまま、diff checkは終了コード0、buildによる追加差分なし。

- [x] T007 Node 22.x（なければ現行Nodeを明記）で、focused test、`npx tsc --noEmit --incremental false`、`npm run lint`、`npm test -- --runInBand`、`npm run build`を実行する。full Jest/buildの失敗は変更起因、baseline、環境要因に分類し、warningを成功と混同しない。実測: Node 22.23.2 / npm 10.9.8で、focused 2 suites / 10 tests PASS、strict TypeScript exit 0、Lint exit 0、全Jest 139 suites PASS / 2 skipped・857 tests PASS / 13 skipped、build exit 0。GTFSの`transit-config.json`不在表示と既存warningは成功結果から分離した。

- [x] T008 `investigation.md` と `tasks.md`へ、実装内容、RED/GREEN、focused/full test、strict TypeScript、Lint、build、diff/statusを親の実測値だけで追記する。文書更新後に`git diff --check`を再実行する。実測結果と既存warning・GTFS設定不足を両文書へ記録した。

- [ ] T009 最終差分を親が再レビューし、既存の短いprefix規約に従う日本語commitを作成してfeature branchへpushする。PRを作成する場合はbaseを`dev`に明示し、Issue #120をcloseする本文、変更理由、検証結果、未変更範囲を日本語で記載する。PRのtitle/body、head/base、changed filesを読み戻す。

- [ ] T010 pushしたexact SHAのGitHub checksを確認する。未triggerは成功扱いにせず記録し、failureは変更起因・baseline・infrastructureに分類する。mergeは行わない。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010
```

同一pathを複数writerが変更しない。T002のtest変更とT004のproduction変更は分離し、T003のfresh reviewがPASSするまで実装へ進まない。

## 受入条件と検証の対応

| 受入条件 | 主な証拠 |
|---|---|
| ホームの説明文を修正 | T002 RED、T004 focused GREEN、T007 full suite |
| `/discussions`の説明を静的化 | T002 RED、T004 focused GREEN、relay由来文字列非表示のテスト |
| title/状態/ARIA/操作を維持 | 既存TabLayoutテスト、T005 focused、T007 full suite |
| 不要な範囲を変更しない | T006 diff/status/source review |
| 品質ゲート | T007 TypeScript/Lint/Jest/build、T008 docs/diff |
| リモート配送・CI | T009 exact SHA、T010 checks |
