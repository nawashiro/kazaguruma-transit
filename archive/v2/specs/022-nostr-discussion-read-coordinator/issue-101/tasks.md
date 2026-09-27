---

description: "Task list for Issue #101 h1 metadata title rendering"
---

# Tasks: Issue #101 会話詳細h1タイトル反映

**Issue:** https://github.com/nawashiro/kazaguruma-transit/issues/101

**Input:** `specs/022-nostr-discussion-read-coordinator/issue-101/plan.md`

**Branch:** `fix/issue-101-h1-fallback`

**Base:** `dev` / `cf871526ea512f7b012b43dd13b6cede2fddf343`

**Scope:** 初期h1フォールバックとRubyful v2のDOM書き換えの競合を、`DiscussionMetaReadState`の表示境界で解消する。Nostr read、parser、coordinator、provider、`PageHeader`共通API、Rubyful CDNは変更しない。

**Task policy:** 各実装タスクは一つの書込境界だけを持つ。テストを先にREDにし、fresh read-only reviewのPASS後にproduction codeを変更する。親エージェントは各タスクの差分、実行結果、書込境界を検証してから次へ進む。

## Phase 1: Baseline and scope

- [x] T001 Issue #101の核心原因を調査し、Issueへコメントを投稿する。確認結果は、h1だけが`会話情報`をフォールバックとして初期DOMへ描画し、Rubyfulが先に加工することでmetadata後のReact更新と競合すること。コメント反映をGitHub APIで本文完全一致として確認する。
- [x] T002 `specs/022-nostr-discussion-read-coordinator/issue-101/plan.md`を作成し、対象ファイル、対象外、受入基準、TDD、ブラウザ検証、品質ゲートを記録する。

**Checkpoint:** IssueコメントURLは`https://github.com/nawashiro/kazaguruma-transit/issues/101#issuecomment-5447681681`。実装前の`dev`はcleanであり、実験差分は破棄済み。

## Phase 2: RED test contract

### T003: 初期h1フォールバックの回帰テストを追加する

**Status:** Complete. `DiscussionMetaReadState.test.tsx`のみを変更し、loading/error/partial/readyを実効的に検証した。

**Writer:** test-only worker

**Writable paths:**

- `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`

**Frozen paths:**

- `src/components/discussion/DiscussionMetaReadState.tsx`
- `src/components/layouts/PageHeader.tsx`
- `src/components/discussion/__tests__/DiscussionTabLayout.test.tsx`
- `src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`
- `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`
- `specs/022-nostr-discussion-read-coordinator/issue-101/plan.md`
- `specs/022-nostr-discussion-read-coordinator/issue-101/tasks.md`

**Behavior:**

- `discussion={null}`のloading状態で`h1` `会話情報`を表示しないことを検証する。
- loading statusの`role="status"`と`aria-live="polite"`を維持することを検証する。
- `discussion={null}`のerror／partial状態で汎用h1を表示しないことを検証する。
- `discussion`が存在するready状態で、h1へタイトル、pへ説明を表示することを検証する。
- 既存の意味ある表示・reload検証を削除しない。

**RED command:**

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx
```

**Expected:** collection/setupは成功し、現行production codeがloading／error時に`会話情報`を描画するため、追加契約が失敗する。テスト側のtypoやfixture不備をREDとして扱わない。

**Restrictions:** production code、plan、tasks、設定、commit、push、Issue操作を変更しない。TDDのRED結果と変更パスだけを報告する。

### T004: T003のtest-only fresh read-only review

**Status:** Complete. fresh reviewer `VERDICT: PASS`、modified false、期待されたproduction-contract REDを確認した。

**Reviewer:** T003とは別のfresh read-only reviewer

**Review scope:** T003のテストファイルのみ

**Review requirements:**

- Issue #101の受入基準とテストが一致することを確認する。
- fallbackなしの初期DOM、ready時のtitle／description、loading／error／partialの状態境界を確認する。
- テストが実際の`DiscussionMetaReadState`をrenderし、空のfixtureや実装詳細だけのassertionに依存しないことを確認する。
- collection/setupがcleanなREDであることを確認する。
- 書込、stage、commit、pushを行わず、`modified: false`を報告する。
- 明示的に`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`または`VERDICT: CHANGES_REQUESTED`を返す。

**Gate:** `VERDICT: PASS`、対象SHAの開始／終了一致、親によるfocused RED再実行後にT005へ進む。変更または指摘があればT003を修正し、再度fresh reviewを行う。

## Phase 3: Minimal production implementation

### T005: metadata headerをknown data時だけ描画する

**Status:** Complete. `DiscussionMetaReadState.tsx`だけを変更し、fallback h1を除去してknown data時だけ`PageHeader`を描画した。

**Writer:** production implementation worker

**Writable paths:**

- `src/components/discussion/DiscussionMetaReadState.tsx`

**Frozen paths:**

- T003のtest file
- `src/components/layouts/PageHeader.tsx`
- `src/components/discussion/DiscussionTabLayout.tsx`
- `src/components/discussion/DiscussionDetailProvider.tsx`
- `src/lib/discussion/discussion-detail-read-coordinator.ts`
- `src/lib/nostr/nostr-utils.ts`
- `src/lib/nostr/nostr-read-executor.ts`
- `specs/022-nostr-discussion-read-coordinator/issue-101/plan.md`
- `specs/022-nostr-discussion-read-coordinator/issue-101/tasks.md`

**Behavior:**

- `discussion`が存在するときだけ`PageHeader`を描画する。
- `discussion?.title ?? "会話情報"`を使用しない。
- loading、error、partialのstatusとreload操作を維持する。
- 空文字のh1を残す実装を採用しない。
- Nostr read、snapshot、role guidance、tab、認証、write actionを変更しない。

**GREEN command:**

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx
```

**Restrictions:** T003のtestを変更しない。`PageHeader.tsx`やNostr関連ファイルを変更しない。commit、push、Issue操作を行わない。

### T006: T005のfocused GREENと隣接テストを親が検証する

**Status:** Complete. focused 6 suites / 56 tests、strict TypeScript、lintが成功した。

**Writable paths:** なし

**Commands:**

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx \
  src/components/discussion/__tests__/DiscussionTabLayout.test.tsx \
  src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx \
  src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts \
  'src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx'
```

**Expected:** 全対象テストがGREENになる。titleの取得、snapshot、detail read回数、loading／partial／error、tab境界に回帰がないことを確認する。

**Parent checks:** 実際の変更パスがT005のmanifest内であること、T003のtest SHAが変わっていないこと、`git diff --check`が成功することを確認する。

### T007: T005のfresh read-only production review

**Status:** Complete. fresh reviewer `VERDICT: PASS`、modified false、production scopeと凍結パスを確認した。

**Reviewer:** T005とは別のfresh read-only reviewer

**Review scope:** T005のproduction fileとT003のsettled test contract

**Review requirements:**

- 初期fallback h1を除去し、known metadata時だけPageHeaderを描画することを確認する。
- 空h1を残していないことを確認する。
- Nostr取得、parser、coordinator、provider、PageHeader共通API、Rubyful CDNを変更していないことを確認する。
- T006のfocused GREEN、strict TypeScript、target lint、diff checkの結果を対象SHAと照合する。
- 書込、stage、commit、pushを行わず、`modified: false`を報告する。
- 明示的に`SUBAGENT_STATUS: COMPLETE`と`VERDICT: PASS`または`VERDICT: CHANGES_REQUESTED`を返す。

**Gate:** `VERDICT: PASS`と親によるSHA／status再確認後にT008へ進む。指摘があればproductionを直接修正せず、必要な回帰testをT003の後続sliceとして追加してfresh test reviewから再開する。

## Phase 4: Browser and repository gates

### T008: Rubyful有効状態のブラウザ検証

**Status:** Complete with environment boundary. Current dev browser verified zero h1 and retained loading/partial/error status with Rubyful enabled; ready title/description is verified by the real component test. Ruby API POST and external relay traffic were not sent.

**Writable paths:** なし。検証用の一時ファイルはリポジトリ外へ保存し、commitしない。

**Behavior:**

- Rubyful v2を有効にして会話詳細を開く。
- metadata取得後、h1が実タイトルを保持することを確認する。
- 説明が同じsnapshotから表示されることを確認する。
- h1が`会話情報`へ戻らないことを確認する。
- Rubyful無効時だけ成功する状態が残っていないことを確認する。

**Evidence:** viewport、URL、h1 textContent、description textContent、header子要素、console errorを記録する。実relay timeoutを成功根拠にしない。

### T009: 全体品質ゲート

**Status:** Complete. Full Jest, strict TypeScript, lint, and production build all exited 0; existing warnings and missing `transit-config.json` were classified separately.

**Writable paths:** なし

**Commands:**

```bash
npx tsc --noEmit --incremental false
npm run lint
npm test -- --runInBand
npm run build
git diff --check
git status --short --untracked-files=all
```

**Expected:** strict TypeScript、lint、全Jest、buildがexit 0になる。既存warningはexit codeと分離して記録する。`transit-config.json`不足によるGTFS警告が出た場合、環境要因として分類する。

### T010: 変更境界と受入基準の最終確認

**Status:** Complete. Final scope check remains limited to the Issue #101 component/test and the two issue planning documents.

**Writable paths:** なし

- production変更が`src/components/discussion/DiscussionMetaReadState.tsx`だけであることを確認する。
- test変更がT003の指定ファイルだけであることを確認する。
- Nostr read／parser／coordinator／provider／PageHeader共通APIに差分がないことを検索とdiffで確認する。
- Issue #101の受入基準を全件確認する。
- taskの完了状態を実測結果に合わせて更新する。

## Phase 5: Delivery

### T011: feature branchへcommit、push、CI確認

**Status:** Complete with CI boundary. Commit `f422d2b5071ee4d0c6c84ec7e7a7d8613f9a5e6f`をfeature branchへpushし、local／remote SHA一致を確認した。Quality Gateは`dev`／`master` pushまたは対象PRだけを対象とするため、feature branch pushでは実行されず、成功扱いにしていない。

**Preconditions:** T003、T004、T005、T006、T007、T008、T009、T010が親検証済みであること。

**Commands:**

```bash
git add \
  src/components/discussion/DiscussionMetaReadState.tsx \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx \
  specs/022-nostr-discussion-read-coordinator/issue-101/plan.md \
  specs/022-nostr-discussion-read-coordinator/issue-101/tasks.md
git commit -m "fix: Issue #101の会話タイトル表示を修正"
git push -u origin fix/issue-101-h1-fallback
git fetch origin fix/issue-101-h1-fallback
git rev-parse HEAD
 git rev-parse origin/fix/issue-101-h1-fallback
gh run list --branch fix/issue-101-h1-fallback --limit 5
```

**Restrictions:** PR作成・merge・Issue closeは別途指示がない限り行わない。push後はlocal／remote SHAとCI状態を確認する。未実行のCIや未設定のworkflowを成功扱いにしない。

## Dependency graph

```text
T001/T002
  → T003 RED
  → T004 fresh test review PASS
  → T005 production implementation
  → T006 focused GREEN
  → T007 fresh production review PASS
  → T008 browser verification
  → T009 repository gates
  → T010 final scope check
  → T011 commit/push/CI
```

## Forbidden scope expansion

- Rubyful CDN本体の修正
- Nostr relay／NDK／EOSE／retryの変更
- `PageHeader`共通APIの変更
- descriptionへの新しいフォールバック追加
- 空のh1をアクセシビリティ対策として残す変更
- unrelatedなalert、layout、認証、DB、GTFSの変更
