# Issue #100 実装タスクリスト

## Constitution Check

- [x] `AGENTS.md` と `.specify/memory/constitution.md` を確認した。
- [x] 関連仕様 `specs/017-discussion-read-executor/` 配下に `issue-100/` を作成し、`spec.md` は新規作成しない。
- [x] TypeScript strict、UI/data/service分離、明確な命名、単純なロジックを維持する。
- [x] 挙動変更はテストを先にREDにし、freshなテスト実装レビュー後に本番コードを変更する。
- [x] UIの状態通知は日本語、`role="status"`、`aria-live="polite"`、44px以上の操作領域を維持する。
- [x] executorのrelay選択、retry、completion、provenance、永続化は変更しない。

## Work Unit 0: ドキュメントと作業境界

- [x] `origin/dev` のfreshness、Issue本文・コメント、重複PR、関連spec、現行コードを確認する。
- [x] `design.md` に観測事実、スコープ、受入条件、out of scope、リスクを記録する。
- [x] このファイルを作成し、各テストの直後にfresh test review gateを置く。
- [x] 作業ブランチを `fix/issue-100-moderator-read-reload` とする。

## Work Unit 1: `/discussions/moderator` の共有content read

### 1A. REDテスト

- [x] `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx` の既存「moderator tabはmanagement contentを読まない」ケースを、Issue #100の契約である「共有content readを開始する」へ置き換える。
- [x] `/discussions/moderator`、`NEXT_PUBLIC_DISCUSSION_LIST_NADDR`、設定済みread relayという実際の管理route条件をfixtureにする。
- [x] `loadDiscussionModerationSnapshot` が1回呼ばれ、metadata readとは別の共有content lifecycleが開始されることを検証する。
- [x] focused testを実行し、productionの `CONTENT_PATHS` が未変更のため旧挙動との差分でREDになることを確認する。

### 1B. テスト実装のfresh review gate

- [x] Work Unit 1Aのテストファイルだけをfresh read-only reviewerへ渡す。
- [x] reviewerにはIssue #100の受入条件、実行コマンド、書込禁止、対象ファイルのSHAを提示し、`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS` を要求する。
- [x] reviewerの変更有無、SHA、REDの失敗理由を親で再確認する。FAILなら本番コードへ進まずテストを修正し、REDとreviewをやり直す。

### 1C. 最小実装

- [x] `src/components/discussion/DiscussionDataProvider.tsx` のmanagement content対象に `/discussions/moderator` を追加する。
- [x] executor、snapshot、relay URL、retry、参照先batch filterのコードは変更しない。
- [x] Work Unit 1Aのfocused testをGREENにする。

## Work Unit 2: `/discussions` の部分取得再読み込み導線

### 2A. REDテスト

- [x] `src/app/discussions/__tests__/page.streaming.test.tsx` のmanagement mockに `reloadModeration` を追加する。
- [x] primary listingがpartial、または参照先definitionがpartialで空表示を抑止する既存ケースに、accessible name `再読み込み` のbuttonが存在する契約を追加する。
- [x] button clickで `reloadModeration` が1回呼ばれることを検証する。
- [x] focused testを実行し、現行pageにbuttonがないためREDになることを確認する。

### 2B. テスト実装のfresh review gate

- [x] Work Unit 2Aのテストファイルだけをfresh read-only reviewerへ渡す。
- [x] reviewerには既存のpartial/empty抑止契約を弱めず、buttonの存在とcallbackだけを追加する境界を指定する。
- [x] `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、テスト実行結果を確認する。FAILならテストのみ修正して再レビューする。

### 2C. 最小実装

- [x] `src/app/discussions/page.tsx` で `reloadModeration` を取得し、2つのpartial warningに既存DaisyUI button契約で再読み込み操作を追加する。
- [x] empty/not-found判定、表示対象filter、一覧の掲載条件は変更しない。
- [x] Work Unit 2Aのfocused testをGREENにする。

## Work Unit 3: 詳細contentの部分取得再読み込み導線

### 3A. REDテスト

- [x] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` のcontent mockに `completionReason` と `reload` を追加する。
- [x] metadataは取得済み、投稿contentは取得済みだが `idle-timeout` のケースで、投稿contentの暫定statusと `再読み込み` buttonが表示される契約を追加する。
- [x] button clickで共有content `reload` が1回呼ばれることを検証する。
- [x] EOSEではcontent statusが表示されないことを既存または追加ケースで確認する。
- [x] focused testを実行し、現行detail pageがcontent completionを表示していないためREDになることを確認する。

### 3B. テスト実装のfresh review gate

- [x] Work Unit 3Aのテストファイルだけをfresh read-only reviewerへ渡す。
- [x] reviewerにはmetadata timeoutの既存契約と混同せず、投稿contentのstatus境界を検証することを指定する。
- [x] `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、テスト実行結果を確認する。FAILならテストのみ修正して再レビューする。

### 3C. 最小実装

- [x] `src/app/discussions/[naddr]/page.tsx` で `completionReason` と `reload` を共有contentから取得する。
- [x] 投稿contentの表示前に既存 `DiscussionReadStatus` を配置し、partial状態と再読み込み操作を表示する。
- [x] metadataの表示、投稿・評価のロード、評価用executor、投稿操作の挙動を変更しない。
- [x] Work Unit 3Aのfocused testをGREENにする。

## Work Unit 4: 受入検証

- [x] Work Unit 1〜3のfocused testsをsettled bytesで再実行する。
- [x] `npx tsc --noEmit --incremental false` を実行する。
- [x] `npm run lint` を実行する。
- [x] `npm test -- --runInBand` を実行する。
- [x] `npm run build` を実行する。
- [x] `git diff --check`、untrackedを含むstatus、変更パス、差分を確認する。
- [x] `design.md` と本タスクリストが実装・検証結果と矛盾していないことを確認する。
- [x] 失敗があれば原因を分類し、該当Work Unitだけを再開する。baseline/infrastructure failureを成功扱いしない。

### Verification record

- focused suites: 6 suites / 47 tests passed
- full Jest: 130 passed, 2 skipped / 798 passed, 17 skipped
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0
- lint: `npm run lint` exit 0; existing warnings only
- build: `npm run build` exit 0
- whitespace: `git diff --check` exit 0

## Work Unit 5: 配達

- [ ] 受入条件と検証結果を確認して、`fix: restore moderator discussion reads` など既存prefixに従うcommitを作成する。
- [ ] feature branchをoriginへpushする。
- [ ] PRを作成し、Issue #100をリンクする。本文に変更理由、検証コマンド、scope外、CI状態を明記する。
- [ ] PRのbase/head SHA、変更ファイル、checksを読み戻して確認する。
- [ ] CIはlive stateで確認し、未実行・pending・failureをsuccessと報告しない。
