# Tasks: Issue #94 主要画面のアクセシビリティ回帰修正

**Input**: Design documents from `specs/020-issue-94-accessibility/`

**Prerequisites**: `spec.md`、`research.md`、`plan.md`

**Repository**: `/opt/data/kazaguruma-transit`
**Base**: `dev` / `origin/dev` at `78aad3a88599ae1610b6a886bbc8f2793ae5a16f`
**Work branch**: `fix/issue-94-accessibility`
**Issue**: #94

## Task conventions and blocking rules

- 本tasksは実装の実行契約であり、チェックボックスの完了は親エージェントが実worktree、SHA、コマンド終了コードを再確認した後だけ更新する。
- 本番コードを変更する前に、対応する回帰テストを追加してREDを確認する。
- test writer、test-code reviewer、production writer、production-code reviewerはサブエージェントへ委任する。各writerは明示したpathだけを書き、commit、push、reset、clean、stage、依存追加を行わない。
- reviewerは読み取り専用で、次を明示して返すこと。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
modified: false
```

- `CHANGES_REQUESTED`、`INCOMPLETE`、`MAX_ITERATIONS`、完了通知だけではPASSとみなさない。
- test fileを1 byteでも変更したら直前のtest reviewは失効する。RED、fresh review、GREENをやり直す。
- production fileを1 byteでも変更したら直前のproduction reviewは失効する。focused GREEN、型、Lint、diff、fresh reviewをやり直す。
- 既存のAPI、データ形式、永続化、他画面のalertは変更しない。

## Phase 1: Setup and baseline

**Purpose**: 現行のdev基準とhard write boundaryを固定する。

- [X] T001 `git fetch origin dev`、`git rev-parse dev origin/dev`、`git status --short --untracked-files=all`、`git diff --check`を実行し、`dev`と`origin/dev`が同じSHAで、作業branchの既存dirty pathがないことを記録する。対象production/test/docsの開始SHAも保存する。
- [X] T002 `specs/020-issue-94-accessibility/spec.md`、`research.md`、`plan.md`、本tasks、`AGENTS.md`、`.specify/memory/constitution.md`を読み合わせ、US1/US2、対象path、非対象path、review gate、検証コマンドを親の受入条件として固定する。

**Checkpoint**: baselineと書込境界が固定され、Issue #94の2つの回帰が別々の小粒TDD単位として定義されている。

---

## Phase 2: User Story 1 — ホームのキーボードフォーカス位置を可視にする (Priority: P1) 🎯 MVP

**Goal**: モバイルdrawerの見えない内部checkboxをTab順から除外し、表示上のメニューボタンをキーボード操作入口として保つ。

**Independent Test**: `SidebarLayout`を描画し、`#drawer`が`tabIndex=-1`、メニューボタンがbutton・`aria-controls="drawer"`・`aria-expanded`を持つことを確認する。

### Tests for User Story 1 — RED first

- [X] T003 [US1] テスト実装サブエージェントへ、`src/components/layouts/__tests__/SidebarLayout.test.tsx`だけを変更させる。drawer checkboxの`tabIndex=-1`、表示メニューボタンのnative button、`aria-controls="drawer"`、初期`aria-expanded="false"`を検証する回帰テストを追加する。既存のmain/Ko-Fi/heading契約は変更しない。
- [X] T004 [US1] T003のsettled test bytesをfresh read-only test-code reviewerへ委任する。空assertion、source文字列だけの検査、既存契約の弱体化、collection/setup failureの有無を確認し、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致を返す。PASS前にproduction fileを変更しない。

### Implementation for User Story 1

- [X] T005 [US1] T004のPASS後、production実装サブエージェントへ`src/components/layouts/SidebarLayout.tsx`だけを変更させる。`id="drawer"`のcontrolled checkboxに`tabIndex={-1}`を追加し、checked state、onChange、aria-label、後続メニューボタン、drawer classを維持する。不要なlayout/UI refactorを行わない。
- [X] T006 [US1] T005のproduction bytesをfresh read-only production-code reviewerへ委任する。T003のfocused Jest、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`をreviewer自身が実行し、Tab stopの除外、buttonのfocus可能性、drawer操作属性、hard boundaryを確認する。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致を返す。

**Checkpoint**: US1の回帰テストがREDを経てGREENになり、production reviewがPASS。drawerの開閉と見えるキーボード経路が維持されている。

---

## Phase 3: User Story 2 — 経路検索の読み込み中に古いalertを表示しない (Priority: P1)

**Goal**: 検索条件変更後、fetch完了まで前回のerror/success stateを描画せず、loading statusだけを表示する。

**Independent Test**: APIエラー表示後に別のvalid queryへrerenderし、未解決fetch中に`role="alert"`がなく`role="status"`があることを確認する。invalid/API error/429のalert契約は既存テストで維持する。

### Tests for User Story 2 — RED first

- [X] T007 [US2] テスト実装サブエージェントへ、`src/app/routes/__tests__/page.test.tsx`だけを変更させる。最初のvalid queryをAPI errorにしてalertを表示した後、`mockSearchParams`を別のvalid queryへ変更し、未解決fetch中のrerenderで`queryByRole("alert")`がnull、`getByRole("status")`が検索中テキストを持つことを検証する。既存の成功、invalid、500、429ケースは変更しない。
- [X] T008 [US2] T007のsettled test bytesをfresh read-only test-code reviewerへ委任する。旧alertを観測する意味のあるREDであること、fetch promiseの未解決fixtureが決定的であること、既存のalert契約を弱めていないこと、collection/setup failureがないことを確認し、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致を返す。PASS前にproduction fileを変更しない。

### Implementation for User Story 2

- [X] T009 [US2] T008のPASS後、production実装サブエージェントへ`src/components/features/RouteSearchResults.tsx`だけを変更させる。`ResultState`各variantへ対象`searchParams`を保持させ、初期・fetch開始・success・error・例外のstate生成を対象query付きにする。valid queryでstateの対象が現行propsと異なる間はloadingを描画し、invalid/API error/429、fetch URL、rate-limit push、成功表示を変更しない。
- [X] T010 [US2] T009のproduction bytesをfresh read-only production-code reviewerへ委任する。T007のfocused Jest、US1回帰、`npx tsc --noEmit --incremental false`、対象Lint、`git diff --check`をreviewer自身が実行し、古いalertを描画しないstate境界、既存error/success/429契約、型安全性、hard boundaryを確認する。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致を返す。

**Checkpoint**: US1/US2のfocused testsとproduction reviewがPASS。valid queryの初回・再検索loadingにはalertがなく、実際のエラー時だけalertが表示される。

---

## Phase 4: Final cross-cutting verification and acceptance

**Purpose**: Issueの受入条件、憲章、全体品質ゲートを現在のbytesで検証する。

- [X] T011 親エージェントが現在のbytesで、`npm test -- --runInBand`、`npx tsc --noEmit --incremental false`、`npm run lint`、`git diff --check`、`uvx --from specify-cli specify check`を実行する。既存warning、Lint deprecation、環境依存失敗、今回の変更起因failure、未実行を分離して記録する。
- [X] T012 必要な前提が整えば、`npm run build`を最後の別ゲートとして実行する。Prisma/GTFS importの副作用や`transit-config.json`不在の警告をbuild成功・失敗と混同せず、終了コードとログを記録する。
- [X] T013 親エージェントが受入条件とevidence matrixを照合し、対象production/test/docs以外の差分、staged path、untracked path、対象SHA、`git diff --stat`、`git status --short --untracked-files=all`を確認する。Issue #94以外の変更を取り込まず、完了したタスクだけを`[X]`へ更新する。

**Final checkpoint**: Issue #94の2つの回帰がfocused/full検証で確認され、review status、全体品質ゲート、変更境界、未実行項目が正直に記録されている。commit/push/PR作成はユーザーの明示依頼がないため、このtasksの範囲外とする。

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1**: T001→T002。baselineと憲章・planの読合せが完了してからT003へ進む。
- **US1**: T003 RED→T004 test review PASS→T005 production→T006 production review PASS。
- **US2**: T007 RED→T008 test review PASS→T009 production→T010 production review PASS。
- **Final**: T006/T010のproduction review PASS後にT011〜T013を実行する。

### User story dependencies

- **US1**: Phase 1だけに依存し、US2とはproduction pathが異なるため独立して検証できる。
- **US2**: Phase 1だけに依存する。既存のRoutesPageテスト全体を維持し、US1の結果には依存しない。

### Parallel opportunities

- T003〜T004とT007〜T008は対象test pathが異なるが、レビューを混同しないため親が直列に委任する。
- T011のread-onlyなテスト、型、Lint、diff確認は独立しているため、実行環境が許せば並列実行できる。
- production writer同士とreviewer同士は、共有依存とレビュー境界のため並列化しない。

## Verification command reference

```bash
# US1 / US2 focused tests
npm test -- --runInBand --runTestsByPath \
  src/components/layouts/__tests__/SidebarLayout.test.tsx \
  src/app/routes/__tests__/page.test.tsx

# Full quality gates
npm test -- --runInBand
npx tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
uvx --from specify-cli specify check
```

## Notes

- `[P]`は、異なるpathを扱う読み取り専用確認に限って使用し、writer/reviewerは直列で実行する。
- テストが最初からGreen、collection error、fixture errorの場合は受入条件を満たさない。テストの意味を修正してREDを再確認する。
- reviewerの報告だけを完了根拠にせず、親が現在のworktreeに対してコマンド、SHA、diff、statusを再確認する。
- build、commit、push、PR、Issueコメントは別の状態であり、本tasksではbuildまでを検証する。
