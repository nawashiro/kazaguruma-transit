# Issue #131 投票時DOMエラー修正 実装タスクリスト

- Issue: [#131](https://github.com/nawashiro/kazaguruma-transit/issues/131)
- Repository: `/opt/data/kazaguruma-transit`
- Base: `dev` / `b2d28b0347309725c6eac29b06a3d06c7ac420a1`
- Implementation branch: `fix/issue-131-vote-dom-error`
- Related documents: `investigation.md`、`plan.md`

## 実行規約

- 作業言語は日本語とする。commit、PR本文、実装記録も日本語にする。
- `AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0を適用する。
- 実装タスクは1タスクにつき1サブエージェントへ委任する。親は依存関係、受入条件、書込境界、RED/GREEN、変更path、最終検証を管理する。
- test writerは指定test pathだけを変更し、production、Issue文書、設定、commit、push、reset、stage、cleanを変更しない。
- test reviewerはread-onlyで全pathを変更しない。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致を必須結果とする。
- production writerは`src/components/discussion/EvaluationComponent.tsx`だけを変更し、Nostr、認証、DB、Rubyful初期化、共通Button、CSSを変更しない。
- サブエージェントはcommit、push、PR作成を行わない。配送は親が担当し、mergeは行わない。
- `[x]`はサブエージェントの自己申告ではなく、親が現行bytes・path・コマンド結果を確認した後だけ付ける。
- `npm run build`は最終検証で一度だけ実行する。

## Phase 1: 基準・調査・計画

- [x] **T001 [BASE-VERIFIED]** `chore/issue-121-award-page-kiss`の未コミット変更を`git stash push --include-untracked -m "wip: Issue #121 before Issue #131"`で退避し、`dev`へ切り替え、`git fetch origin dev`と`git pull --ff-only origin dev`を実行する。`dev`と`origin/dev`が`b2d28b0347309725c6eac29b06a3d06c7ac420a1`で一致し、cleanであることを確認した。退避したstashと既存Issue #121作業は変更しない。

- [x] **T002 [INVESTIGATE-VERIFIED]** Issue #131本文・コメント・状態、Issue番号／症状による重複PR、現行の`EvaluationComponent`、詳細ページの評価callback、SidebarLayoutのRubyful初期化、Rubyful v2固定scriptのDOM置換、関連履歴をread-onlyで調査し、`issues/131-vote-dom-error/investigation.md`へ記録する。根因を「Rubyfulの`innerHTML`置換と、投票でReactが更新するbutton／本文の子ノード境界の衝突」として、Nostr publish起因と区別する。

- [x] **T003 [PLAN-VERIFIED]** `AGENTS.md`と憲章Version 4.0.0のClear Naming、Simple Logic、Structured Organization、Type Safety、TDD、Accessibility & UX、Documentation & Comments、Rubyful DOM境界、範囲制約をconstitution gateとして適用し、受入条件AC-01〜AC-08、変更manifest、TDD／最終検証／リスクを`issues/131-vote-dom-error/plan.md`へ記録する。

- [x] **T004 [TASKS-VERIFIED]** 本タスクリストへtest writer直後のfresh read-only test reviewer、production writer、親検証、docs、配送の順序と各hard write boundaryを記録する。

**Checkpoint:** Issueの根因、非対象、受入条件、test／productionの書込境界、RED→review→GREENの順序が確定している。production変更はまだ開始しない。

## Phase 2: 回帰テスト（RED → fresh review）

- [x] **T005 [TEST-RED-VERIFIED]** `src/components/discussion/__tests__/EvaluationComponent.test.tsx`だけを変更し、Rubyful v2の実挙動（対象要素の`innerHTML`をRuby markupへ置換）を模した回帰テストを追加した。親が旧productionで9 tests中8 pass・追加テストのみ`NotFoundError` 4件の意味あるRED、変更path、`git diff --check`を再確認した。
  - 2件の承認済み投稿をwrapperでrenderし、callback成功後に評価済みIDをstateへ追加して次の投稿へ切り替える。
  - 初回render後に`.ruby-text`要素を外部DOM変更で置換してから「はい」を押し、`removeChild`例外が発生しないことを確認する。
  - 評価対象本文の動的`p`と評価button自身が`.ruby-text`対象でないことを確認する。
  - button直下の固定ラベル`span.ruby-text`が常時存在し、loading遷移でラベル／アイコンのhost要素を削除しないことを確認する。
  - 次投稿本文と既存の`(postId, "+")` callbackが維持されることを確認する。
  - production、Issue文書、設定、lockfileは変更しない。
  - 実行: `npm test -- --runInBand --runTestsByPath src/components/discussion/__tests__/EvaluationComponent.test.tsx`
  - 期待: production未変更の基準では、新規テストがRubyful相当の外部DOM置換後のReact commit失敗またはDOM境界不一致として意味のあるREDになる。collection/setup typo failureではない。

- [x] **T006 [REVIEW-FAILED]** T005完了後、別fresh read-only subagentへ`src/components/discussion/__tests__/EvaluationComponent.test.tsx`とIssue／planの受入条件だけを渡してレビューさせた。開始／終了SHA一致、`modified: false`、Issueの実DOM ownership collisionを再現する意味あるRED、Rubyful相当の`textContent`→`innerHTML`置換、2投稿切り替え、callback、固定ラベル境界は確認できた。一方、`_postId`／`_rating`の未使用によるlint違反と、loading classの明示assertion不足が見つかったため、production gateは開けなかった。
  - 実測: focused Jestは`1 suite failed / 9 tests: 8 passed, 1 failed`、失敗は`NotFoundError` 4件。strict TypeScriptと`git diff --check`は成功。
  - reviewer結果: `SUBAGENT_STATUS: COMPLETE`、`VERDICT: FAIL`、`modified: false`、開始／終了SHA一致。
  - テストがIssueの投票時`removeChild`を実DOM操作で再現し、単なるclass snapshotではない。
  - 旧productionでは失敗し、修正後にだけ成功する。assertionがvacuousでない。
  - button全体、動的本文、固定ラベルのRuby境界を区別している。
  - 2投稿の切り替え、callback、loading、既存8テストを壊していない。
  - test path以外の変更がなく、開始／終了SHAとstatusが一致する。
  - 必須結果: `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致。
  - reviewerがFAILの場合、親は指摘を反映する最小の`[TEST-CORRECTION]` taskを本リスト直後へ追加し、再度fresh review PASSを得るまでT007へ進まない。

- [x] **T006R [TEST-CORRECTION-VERIFIED]** T006の指摘を反映し、`src/components/discussion/__tests__/EvaluationComponent.test.tsx`だけを修正した。未使用引数を除去し、評価中の両buttonへ`loading` class assertionを追加した。親がlint、strict TypeScript、focused RED、path boundary、`git diff --check`を再確認した。
  - `_postId`／`_rating`を未使用のまま宣言せず、callbackの実引数を検証する形で使う。
  - 評価中の「はい」「いいえ」が`disabled`だけでなく既存の`loading` classも持つことを明示assertする。
  - Rubyful相当mutation、2投稿切り替え、動的本文／button自身と固定labelの境界、既存8テストは保持する。
  - production、Issue文書、設定、index、commit、pushは変更しない。
  - 実行: `npm test -- --runInBand --runTestsByPath src/components/discussion/__tests__/EvaluationComponent.test.tsx` と test pathのlint確認。
  - 期待: 旧productionでは追加テストが引き続き`NotFoundError`でRED、collection/setup/fixture failureなし、lint違反なし。

- [x] **T006RR [TEST-REVIEW-PASS]** T006R完了直後、別fresh read-only subagentへ同じtest pathを再レビューさせた。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致を確認した。未使用引数・lint違反はなく、loading／disabled、Rubyful相当mutation後の意味ある`NotFoundError` RED、button自身／動的本文／固定labelの境界、2投稿切り替え、callback、既存8テストの契約に指摘はなかった。production実装へ進行可能と判定した。

**Checkpoint:** T005の意味あるRED、T006Rの修正、T006RRのfresh review PASSが揃うまで、production codeは変更しない.

## Phase 3: production実装

- [x] **T007 [IMPL-VERIFIED]** `src/components/discussion/EvaluationComponent.tsx`だけを変更し、T005で固定したDOM契約を満たす最小実装を行った。動的本文の`p`とbutton自身から`.ruby-text`を外し、Lucide SVGと「はい」「いいえ」の固定`span.ruby-text`を常時保持して評価中は`sr-only`で隠す構造へ変更した。親がproduction diff、path boundary、focused GREEN 9/9、strict TypeScript、対象ESLint、`git diff --check`を再確認した。
  - 評価対象本文の動的`p`から`.ruby-text`を外す。
  - 評価button自身から`.ruby-text`を外す。
  - Lucide SVGと固定評価ラベルのchild hostを常時renderし、loading時はclassで視覚的に隠す。固定ラベルだけを常時マウントした`span.ruby-text`に置く。
  - 既存の`evaluatingPost`、disabled、loading、callback、評価対象filter、random order、progress、ARIA、44px領域を維持する。
  - `onEvaluate`、Nostr event、親state、外部Rubyful script、共通CSSは変更しない。
  - 実装前にT006のPASS証跡とT005のREDを親が確認する。
  - production writerはcommit／push／PRを行わない。
  - 親の実行: focused Jestを再実行し、T005がGREEN、既存テストもPASSすることを確認する。

**Checkpoint:** T005の回帰テストが修正前RED・修正後GREENで、親が現行source／testの差分と書込boundaryを確認している。

## Phase 4: 親検証・記録・配送

- [x] **T008 [VERIFY-PARENT-VERIFIED]** 親が現行worktreeを再読込し、変更pathがmanifest内であること、button自身／動的本文に`.ruby-text`が残っていないこと、固定ラベルspanが常時mountされることを確認した。focused GREEN後にproduction差分だけを旧状態へ戻した隔離確認で回帰testが`NotFoundError` 4件のREDとなり、修正復元後のfocused GREENを再確認した。全Jestは144 suites passed・2 skipped、901 tests passed・13 skipped、strict TypeScriptとlintはexit 0、buildはexit 0、`git diff --check`はexit 0だった。buildでは`transit-config.json`不足による既存GTFS import表示を環境要因として記録した。
  - focused: `npm test -- --runInBand --runTestsByPath src/components/discussion/__tests__/EvaluationComponent.test.tsx`
  - strict TypeScript: `npx tsc --noEmit --incremental false`
  - lint: `npm run lint`
  - full Jest: `npm test -- --runInBand`
  - build: `npm run build`（このタスクで一度だけ）
  - `git diff --check`
  - `git status --short --branch`
  - focused GREEN後に、テスト対象のRuby境界修正だけを隔離的に旧状態へ戻して回帰testが失敗することを確認し、必ず修正状態へ戻してfocused GREENを再確認する。共有作業treeへ未検証の旧状態を残さない。
  - 可能なら既存Puppeteer／開発サーバーで`/discussions/[naddr]`のRuby ON状態における「はい」「いいえ」操作を送信なしで確認する。外部relay publishや実ユーザー操作は行わない。実ブラウザを実行できない場合は未実測理由を記録する。

- [x] **T009 [DOCS-VERIFIED]** `issues/131-vote-dom-error/investigation.md`へ実装後の根因確認、T005 RED、T006 review、T007 GREEN、T008全検証、実ブラウザ確認可否を追記した。`plan.md`へ検証結果を追記し、`tasks.md`へ実測結果とTDD／review証跡を反映した。日本語、相対リンク、`git diff --check`を確認した。

- [ ] **T010 [DELIVERY-PARENT]** 親が変更pathを再確認し、日本語の既存prefix styleでcommitする。`origin/fix/issue-131-vote-dom-error`へpushし、GitHubでbase=`dev`のPRを作成する場合は、問題・根因・方針・テスト・リスク・非対象を日本語で記載する。GitHubからPRのtitle/body/head/base/filesを読み戻し、`git ls-remote`でremote SHAを確認する。CIのexact head SHAに対するcheckを`gh pr checks`／`gh run view`で確認し、mergeは行わない。CI未実行・失敗・環境障害は成功と扱わず、実際の状態を記録する。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T006R → T006RR → T007 → T008 → T009 → T010
```

- T005はtest pathだけを変更する。
- T006はT005直後に置くread-only reviewであり、PASS前にproduction変更を開始しない。
- T007はproduction pathだけを変更する。
- T008〜T010は親が担当し、サブエージェントの自己申告だけで完了扱いにしない。
- T006がFAILした場合は、T005とT006の間に最小修正taskとそのfresh reviewを挿入する。

## 受入条件と証拠

| 受入条件 | 証拠task |
|---|---|
| Rubyful相当の`innerHTML`置換後も投票で`removeChild`例外がない | T005、T007、T008 |
| 動的本文とbutton自身がRubyful対象でない | T005、T007、T008 |
| 固定評価ラベルのみ安定した`span.ruby-text`境界になる | T005、T007、T008 |
| 次の投稿へ切り替わり、callbackが維持される | T005、T007、T008 |
| existing evaluation behavior、ARIA、loading、touch targetが維持される | T005、T007、T008 |
| focused/full Jest、strict TypeScript、lint、buildが実行済み | T008 |
| Issue文書、feature branch、remote SHA、PR/CI状態が現実と一致する | T009、T010 |
