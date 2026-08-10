# Tasks:Discussion read executor

**Input**:`specs/017-discussion-read-executor/`の設計文書

**Prerequisites**:`plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/discussion-read-executor.md`、`quickstart.md`

**Tests**:仕様と憲章はTDD (Test-Driven Development)を要求する。各実装taskの前に対応するREDテストを追加し、失敗を確認する。

**Organization**:taskはUser Storyごとに分ける。基盤完了後、各Storyは独立して検証できる。

## Phase 1:Setup

**Purpose**:変更前の回帰を確認し、feature専用テストの入口を用意する。

- [ ] T001 現在の関連回帰を実行して記録する: `src/lib/nostr/__tests__/nostr-service.test.ts`、`src/lib/discussion/__tests__/relay-candidate-selector.test.ts`、`src/components/discussion/__tests__/DiscussionReadStatus.test.tsx`
- [ ] T002 `specs/017-discussion-read-executor/quickstart.md`のREDコマンドを実行できるよう、既存Jest設定と対象test pathを確認する

---

## Phase 2:Foundational

**Purpose**:全Storyが使うtransport、参照正規化、executor、read planの境界を作る。

**⚠️ CRITICAL**:このPhaseが終わるまでUser Storyの画面移行を開始しない。

- [ ] T003 [P] `src/lib/nostr/__tests__/nostr-service.test.ts`へ、複数filterが一回の`ndk.subscribe()`と`options.relaySet`を使い、一回のEOSEで完了するREDテストを追加する
- [ ] T004 [P] `src/lib/discussion/__tests__/discussion-reference-resolver.test.ts`を追加し、有効`q` tag、重複、kind違い、空dTag、不正pubkeyのREDテストを追加する
- [ ] T005 [P] `src/lib/discussion/__tests__/discussion-read-executor.test.ts`を追加し、最大3relay、non-EOSE時の一度だけのretry、EOSE時のretry抑止、event ID結合、relay実績合成のREDテストを追加する
- [ ] T006 `src/lib/nostr/nostr-service.ts`を修正し、`collectEventsWithCompletion()`がfilter群を一回の`ndk.subscribe(filters, { relaySet, ... })`へ渡し、第三引数relay setとfilter数EOSE集計を除去する
- [ ] T007 `src/lib/discussion/discussion-reference-resolver.ts`を追加し、`q` tag、naddr、既知Discussion IDを通信なしで`DiscussionReference`へ正規化する
- [ ] T008 `src/lib/discussion/discussion-read-plan.ts`を拡張し、正規化済み参照から複数filterを持つ参照先会話read planを作る
- [ ] T009 `src/lib/discussion/discussion-read-executor.ts`を追加し、relay順位、first attempt、one-time retry、暫定attempt callback、最終result合成を実装する
- [ ] T010 `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts`と`src/lib/discussion/discussion-known-data-cache.ts`を更新し、掲載投稿readと参照先会話readのrelay実績を別target keyで保持する

**Checkpoint**:一回のmulti-filter subscription、参照正規化、completion-aware executor、relay実績分離が単体テストで確認できる。

---

## Phase 3:User Story 1 - 掲載済み会話を会話一覧で見つける (Priority: P1) 🎯 MVP

**Goal**:掲載投稿が見つかっている場合、参照先会話定義のrelay取得が不完全でも、`/discussions`が会話を表示するか、未確定状態を示す。

**Independent Test**:hint relayが無応答でも、設定relayが参照先kind 34550を返すfixtureで、一覧が会話を表示する。両readがEOSEで空の場合だけ空一覧を表示する。

### Tests for User Story 1

- [ ] T011 [P] [US1] `src/components/discussion/__tests__/DiscussionManagementDataProvider.test.tsx`へ、掲載投稿の参照先kind 34550がexecutor経由で表示されるIssue #68 RED回帰テストを追加する
- [ ] T012 [P] [US1] `src/app/discussions/__tests__/page.streaming.test.tsx`へ、非EOSEの参照先readで「会話がまだありません。」を確定表示しないREDテストを追加する
- [ ] T013 [P] [US1] `src/lib/discussion/__tests__/discussion-moderation-snapshot.test.ts`へ、掲載投稿readと承認readのexecutor結果・relay実績を別targetとして保持するREDテストを追加する

### Implementation for User Story 1

- [ ] T014 [US1] `src/lib/discussion/discussion-moderation-snapshot.ts`を変更し、掲載投稿と承認の有限readを`DiscussionReadExecutor`経由にする
- [ ] T015 [US1] `src/components/discussion/DiscussionManagementDataProvider.tsx`を変更し、`getReferencedUserDiscussions()`をResolver→batch read plan→executor resultへ置換する
- [ ] T016 [US1] `src/app/discussions/page.tsx`を変更し、参照形式を再解析せずProviderの正規化済み参照結果とcompletion状態を使う
- [ ] T017 [US1] `src/app/discussions/manage/page.tsx`を変更し、参照先readが非EOSEのとき未取得を「not found」と確定しない
- [ ] T018 [US1] `src/components/discussion/DiscussionReadStatus.tsx`を変更し、一覧の暫定・partial・unavailable状態を日本語、`role="status"`、`aria-live="polite"`、44px再読み込み操作で表示する

**Checkpoint**:`/discussions`と`/discussions/manage`が掲載済み会話の欠落を防ぎ、confirmed emptyだけを空一覧として表示する。

---

## Phase 4:User Story 2 - relay応答が不完全でも状況を判断する (Priority: P2)

**Goal**:全Discussion画面が同じcompletion状態、暫定表示、retry、再読み込みを使う。承認・編集・モデレーター画面は継続購読を開始しない。

**Independent Test**:各画面のinitial readをtimeoutまたはcancelledにし、既存eventsを維持したpartial状態またはunavailable状態を表示する。retry EOSEは警告を消す。

### Tests for User Story 2

- [ ] T019 [P] [US2] `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx`へ、first attemptのeventsを保持しretry EOSEで警告を消すREDテストを追加する
- [ ] T020 [P] [US2] `src/app/settings/__tests__/page.streaming.test.tsx`へ、author readの暫定表示、partial表示、retry EOSEのREDテストを追加する
- [ ] T021 [P] [US2] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`へ、metadataとevaluationのtimeoutがnot foundへ変換されないREDテストを追加する
- [ ] T022 [P] [US2] 承認、編集、モデレーター画面の既存testへ、`streamEventsOnEvent()`、`streamApprovals()`、継続subscriptionを開始しないREDテストを追加する: `src/app/discussions/[naddr]/approve/`、`src/app/discussions/[naddr]/edit/`、`src/app/discussions/[naddr]/moderators/`

### Implementation for User Story 2

- [ ] T023 [US2] `src/app/settings/page.tsx`を変更し、author別kind 34550 readをexecutorと共通status表示へ置換する
- [ ] T024 [US2] `src/components/discussion/DiscussionTabLayout.tsx`を変更し、metadata readの手動relay選別と直接gateway queryをexecutorへ置換する
- [ ] T025 [US2] `src/components/discussion/DiscussionContentDataProvider.tsx`を変更し、投稿・承認initial readのcompletionとrelay実績をexecutorから受け取る
- [ ] T026 [US2] `src/app/discussions/[naddr]/page.tsx`を変更し、evaluation readとuser evaluation historyをexecutor用read planへ置換する
- [ ] T027 [US2] `src/app/discussions/[naddr]/approve/page.tsx`を変更し、`streamEventsOnEvent()`と`streamApprovals()`をexecutorの有限initial readへ置換する
- [ ] T028 [US2] `src/app/discussions/[naddr]/edit/page.tsx`を変更し、moderator-requestの継続購読をexecutorの有限initial readへ置換する
- [ ] T029 [US2] `src/app/discussions/[naddr]/moderators/page.tsx`を変更し、moderator-requestの継続購読をexecutorの有限initial readへ置換する
- [ ] T030 [US2] `src/lib/discussion/__tests__/discussion-read-executor-adoption.test.ts`を追加し、対象画面がexecutorを使いDiscussion readで直接relay選別、gateway query、stream APIを呼ばないことを確認する

**Checkpoint**:設定、詳細、承認、編集、モデレーター、管理が同じ完了型read規則を使い、継続購読を開始しない。

---

## Phase 5:User Story 3 - 複数の掲載参照を一度に解決する (Priority: P3)

**Goal**:複数`q` tagの参照先会話を重複なく一つのread planへまとめ、relay attemptごとに一つのmulti-filter subscriptionで取得する。

**Independent Test**:複数の有効かつ異なる`q` tagと重複tagを含む掲載投稿で、filter群が一回のsubscriptionへ渡され、各会話が一度だけ表示される。

### Tests for User Story 3

- [ ] T031 [P] [US3] `src/lib/discussion/__tests__/discussion-reference-resolver.test.ts`へ、複数`q` tagを一つのbatch planへ変換するREDテストを追加する
- [ ] T032 [P] [US3] `src/lib/nostr/__tests__/nostr-service.test.ts`へ、複数filterが一回のsubscriptionとなりfilterごとに購読しないREDテストを追加する
- [ ] T033 [P] [US3] `src/components/discussion/__tests__/DiscussionManagementDataProvider.test.tsx`へ、複数参照の表示・重複排除・timeout retryのREDテストを追加する

### Implementation for User Story 3

- [ ] T034 [US3] `src/lib/discussion/discussion-reference-resolver.ts`と`src/lib/discussion/discussion-read-plan.ts`を変更し、参照filter batchの順序と重複排除を安定化する
- [ ] T035 [US3] `src/lib/discussion/discussion-read-executor.ts`を変更し、retry時もbatch filtersを変更せず一回のsubscriptionへ渡す
- [ ] T036 [US3] `src/components/discussion/DiscussionManagementDataProvider.tsx`と`src/app/discussions/page.tsx`を変更し、batch resultから重複のない会話一覧を描画する

**Checkpoint**:filter数に比例するsubscription作成を防ぎ、複数参照の会話を取りこぼさない。

---

## Phase 6:Polish & Cross-Cutting Concerns

**Purpose**:全画面の品質、性能、アクセシビリティ、文書を確認する。

- [ ] T037 [P] `src/lib/discussion/__tests__/discussion-read-executor.test.ts`と`src/lib/nostr/__tests__/nostr-service.test.ts`で、attempted relayとsuccessful event relayが混同されないことを追加確認する
- [ ] T038 [P] `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx`と対象画面testsで、WCAG 2.2 SC 4.1.3のstatus通知とSC 2.5.8の再読み込み操作サイズを確認する
- [ ] T039 `specs/017-discussion-read-executor/quickstart.md`のRED、GREEN、手動relay fixtureを実行し、結果を実装PRへ記録する
- [ ] T040 `src/lib/nostr/nostr-service.ts`、`src/lib/discussion/discussion-read-executor.ts`、対象画面でpage分割、続き取得、filter数上限、継続購読を追加していないことを確認する
- [ ] T041 `npm run lint`、`npx tsc --noEmit`、`npm run build`、`git diff --check`を実行する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**:直ちに開始できる。
- **Phase 2**:Phase 1のbaseline確認後に開始する。全User Storyをblockする。
- **US1**:Phase 2後に開始する。Issue #68のMVPである。
- **US2**:Phase 2後に開始できるが、共通一覧状態を再利用するためUS1後の統合を推奨する。
- **US3**:Phase 2後に開始できる。Resolverとtransportの基盤を再利用する。
- **Polish**:採用する全Storyの完了後に実行する。

### User Story Dependencies

```text
Setup → Foundational → US1 (MVP) → US2
                       └──────────→ US3
US2 + US3 → Polish
```

### Parallel Opportunities

- Phase 2のT003、T004、T005は別test fileのため並行できる。
- US1のT011、T012、T013は別test fileのため並行できる。
- US2のT019からT022は別test fileのため並行できる。
- US3のT031からT033は別test fileのため並行できる。
- 実装taskは同じProvider、plan、transportを競合させない順で実行する。

## Implementation Strategy

### MVP First

1. T001からT010でtransport、Resolver、Executorを完成させる。
2. T011からT018で`/discussions`と`/discussions/manage`のIssue #68回帰を解消する。
3. US1のfixtureでhint relay timeoutと設定relay成功を確認する。
4. MVP確認後にUS2とUS3へ進む。

### Incremental Delivery

1. US1で掲載済み会話の欠落を解消する。
2. US2で全Discussion画面を完了型initial readへ統一する。
3. US3で複数参照のmulti-filter最適化を確認する。
4. 最後に全品質gateを実行する。

## Notes

- `[P]`は、未完了taskへの依存を持たず別fileを変更できるtaskだけに付ける。
- 各REDテストは、対応実装の前に失敗を確認する。
- 各logical groupの完了後にcommitする。
- page分割、続き取得、filter数上限は本featureに追加しない。
- User Storyの実装を始める前にFoundational Phaseを完了する。
