---

description: "Task list for Discussion read lifecycle simplification"
---

# Tasks: Discussion read lifecycleの単純化

**Input**: Design documents from `/specs/022-nostr-discussion-read-coordinator/`

**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/read-coordinator.md`、`quickstart.md`

**Tests**: TDDを明示したfeatureであるため、各behaviorはテストを先に追加し、REDを確認してから実装する。テスト実装タスクの直後にfresh read-only test reviewを置く。

## Phase 1: Setup

**Purpose**: featureの対象と現在のclean基点を固定する。

- [x] T001 `specs/022-nostr-discussion-read-coordinator/spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/read-coordinator.md`、`quickstart.md`の用語を照合し、`NostrReadExecutor`、`DiscussionDetailSnapshot`、`DiscussionManagementSnapshot`、phase別relay provenanceの名称を一致させる。 Verified: feature docs reviewed after implementation; historical `DiscussionReadExecutor` mentions are explicitly described as the pre-rename name.
- [x] T002 [P] `src`全体で`discussion-read-executor`、`executeDiscussionRead`、`DiscussionReadResult`、`successfulEventRelayUrls`、`successfulRelays`の利用箇所を棚卸しし、実装対象と保護対象を`specs/022-nostr-discussion-read-coordinator/`へ記録する。 Verified: exact old executor/API references are 0 in source; test fixtures use the new Nostr API.
- [x] T003 [P] 現在の`dev`由来feature branch、dirty paths、既存focused/full検証baselineを確認し、実装前の検証記録を`specs/022-nostr-discussion-read-coordinator/quickstart.md`または実装メモへ追記する。 Verified: branch `refactor/nostr-discussion-read-coordinator` was created from clean `dev` HEAD `4068268455bebe9e69ff16715317938587255077`; baseline and current verification are recorded in this task ledger.

---

## Phase 2: Foundational

**Purpose**: Nostr基盤の名称とcache契約を、domain coordinator変更前に固定する。

- [x] T004 `src/lib/nostr/__tests__/nostr-read-executor.test.ts`を作成し、既存executorの初回relay最大3件、non-EOSE時の一度だけのretry、EOSE時のretryなし、event/provenance mergeを新しいNostr基盤名でREDにする。後続rename実装後のfocused result: 1 suite / 2 tests passed。
- [x] T005 `src/lib/nostr/__tests__/nostr-read-executor.test.ts`のRED結果を、`NostrReadExecutor`がDiscussion固有ではなく、正規化済みfilterとrelay候補だけを扱うこと、relay候補の意味づけをexecutorへ移さないこと、既存attempt契約を壊していないことをfresh read-only reviewerへ渡す。対象test以外を書き込ませない。 Fresh review: PASS、modified: false、SHA-256 `844887286bfef157ce88ee02a78189cb8616c65b46005cc229342a2371a25e2a`。
- [x] T006 `src/lib/nostr/nostr-read-executor.ts`へexecutorと基盤型を移し、`executeNostrRead`、`NostrReadTransport`、`NostrReadResult`、`NostrReadAttempt`へ改名する。実行アルゴリズム、relay候補順序、retry上限、merge結果を変更しない。
- [x] T007 全production/test importを`src/lib/nostr/nostr-read-executor.ts`と新しい型名へ移行し、`src/lib/discussion/discussion-read-plan.ts`にはDiscussion固有のtarget/filter生成だけを残す。旧ファイル名・旧exportの残存を検索で確認する。
- [x] T008 `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts`へReadCacheV2のphase別relay provenance、v1無視、期限切れ・壊れたcacheのfail-softをREDで追加する。
- [x] T009 `src/lib/discussion/__tests__/discussion-known-data-cache.test.ts`のcache schema REDをfresh read-only reviewerへ渡し、metadata/content/evaluation/referenceのrelay実績混同が検出されること、既存event cacheの暫定性を保持することを確認する。対象test以外を書き込ませない。 Fresh review: PASS、modified: false、SHA-256 `de064de16df1e1675762f2d4bd58d1749d701dffcbff8dea3ed09a41b77accca`。
- [x] T010 `src/lib/discussion/discussion-known-data-cache.ts`のcache versionをv2へ変更し、`relayProvenance`をphase別に保存・復元する。旧v1フィールドは安全に無視し、cacheなしでもreadが継続する契約を実装する。

**Checkpoint**: Nostr executor rename、既存attempt契約、phase別cache schemaがfocused testでGREENになること。

---

## Phase 3: User Story 1 - 詳細snapshot (Priority: P1) 🎯 MVP

**Goal**: `/discussions/[naddr]`の詳細readを一つのroute-scoped snapshotへ集約する。

**Independent Test**: metadata、content、approval、evaluationの決定的fixtureを使い、detail coordinatorがphaseを順序どおり一度ずつ実行し、child route用selectorが追加readを開始しないことを確認する。

### Tests for User Story 1

- [x] T011 [P] [US1] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`へmetadata→content→approval→evaluationのphase順序、final snapshot commit、partial/error状態をREDで追加する。Focused RED verified: exact detail aggregate collected 6 suites/40 tests; coordinator contract failures are intentional while the production module is absent.
- [x] T012 [P] [US1] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`へmoderator requestのcontent readからの分離とuserEvaluationIdsのevaluation結果からの導出をREDで追加する。Focused RED verified: the same collected aggregate reports the missing coordinator public boundary, with no collection/setup failure.
- [x] T013 [P] [US1] `src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`へ同一naddrのmain→approve→moderators→edit遷移でread回数が増えないpublic provider契約をREDで追加する。Focused RED verified: the provider public-boundary RED is intentional; TypeScript and scoped ESLint collect cleanly.
- [x] T014 [P] [US1] `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`と`src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`へ、ページ固有moderator request readを開始せずsnapshot selectorを使う契約をREDで追加する。Focused RED verified: both pages fail only on their current independent-read/retry behavior.
- [x] T015 [P] [US1] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`と`approve/__tests__/page.streaming.test.tsx`へ、ページから直接gateway/NostrService readを開始せず、final snapshotのloading/partial/readyを表示する契約をREDで追加する。Focused RED verified: detail page direct-evaluation reads remain intentional RED; approve suite passes。
- [x] T016 [US1] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`、`src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx`、`src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`のtest変更だけをfresh read-only reviewerへ渡し、phase順序、重複read 0件、moderator request共有、user evaluation導出、stale generation、public rendered boundaryを確認する。対象test以外を書き込ませない。 Final review chain T016A/T016B: PASS。
- [x] T016A [US1] T016のfresh reviewで指摘された`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`の評価fixture矛盾、`moderators/__tests__/page.test.tsx`と`edit/__tests__/page.streaming.test.tsx`のsnapshot申請fixture不足、`discussion-detail-read-coordinator.test.ts`のvacuous moderator-request assertion、detail stale-generation不足をテストだけで修正し、再現可能なintentional REDへ戻す。Production codeは変更しない。 Verified: exact focused aggregate collected 6 suites/41 tests with no collection/setup/fixture failures; 28 passed and 13 intentional production-boundary RED failures (coordinator/provider public modules absent, and current pages' direct reads).
- [x] T016B [US1] T016Aで修正したdetail test pathsを別fresh read-only reviewerへ再提出し、前回blocking findingsが解消され、hash、RED理由、collection/setup状態が再確認されるまでT017以降へ進まない。対象test以外を書き込ませない。 Fresh review: PASS、modified: false、6 suites/41 tests、28 passed/13 intentional RED、blocking findingsなし。

### Implementation for User Story 1

- [x] T017 [US1] `src/lib/discussion/discussion-detail-read-coordinator.ts`へ詳細read coordinatorと`DiscussionDetailSnapshot`生成を実装し、既存`executeNostrRead`へphaseごとのreadを委譲する。
- [x] T018 [US1] `src/lib/discussion/discussion-moderation-snapshot.ts`をcoordinator契約に合わせ、primary contentから通常投稿・moderator requestを分離し、phase callbackをUI完了状態として要求しないAPIへ整理する。
- [x] T019 [US1] `src/components/discussion/DiscussionDetailProvider.tsx`を追加し、naddr identity、generation、single model、phase別provenance、reload、mutation reducerを管理する。
- [x] T020 [US1] `src/app/discussions/[naddr]/layout.tsx`を`DiscussionDetailProvider`へ接続し、既存`DiscussionDataProvider`のdetail scopeとno-read compatibility adapterの依存を除去する。
- [x] T021 [US1] `src/app/discussions/[naddr]/page.tsx`からevaluation read、user evaluation全件read、known-data relay候補組立て、generation管理を除去し、`DiscussionDetailProvider`のsnapshot selectorを使う。
- [x] T022 [US1] `src/app/discussions/[naddr]/approve/page.tsx`をsnapshot selectorと単一reload/actionへ移行し、直接Nostr readを持たない状態を確認する。
- [x] T023 [US1] `src/app/discussions/[naddr]/moderators/page.tsx`と`src/app/discussions/[naddr]/edit/page.tsx`からmoderator request専用readを除去し、snapshotの`moderatorRequests`を使う。publish actionは既存Nostr write境界を維持する。
- [x] T024 [US1] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`、`src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`approve/__tests__/page.streaming.test.tsx`、`moderators/__tests__/page.test.tsx`、`edit/__tests__/page.streaming.test.tsx`のfocused testsをGREENにし、main/approve/moderators/editのread回数、partial action disabled、stale result防止を確認する。

**Checkpoint**: 詳細route familyが一つのsnapshotを使い、子routeのNostr readが0件になること。

---

## Phase 4: User Story 2 - 掲載snapshot (Priority: P1)

**Goal**: `/discussions`、`manage`、`moderator`の掲載データを一つのsnapshotへ集約する。

**Independent Test**: 掲載投稿、approval、重複q参照、参照先metadata fixtureで、一覧snapshotと3画面のselectorを検証する。

### Tests for User Story 2

- [x] T025 [P] [US2] `src/lib/discussion/__tests__/discussion-management-read-coordinator.test.ts`へ掲載metadata→listing content→approval→q reference→referenced metadataの順序とreference dedupeをREDで追加する。Verified: exact focused aggregate collected cleanly; 1 suite/2 tests fail only with the intentional missing `discussion-management-read-coordinator` public-module RED。
- [x] T026 [P] [US2] `src/components/discussion/__tests__/DiscussionManagementProvider.test.tsx`へ`/discussions`、`/manage`、`/moderator`間で一つのsnapshotを共有し、追加readがない契約をREDで追加する。Verified: exact focused aggregate collected cleanly; 1 suite/2 tests fail only with the intentional missing `DiscussionManagementProvider` public-module RED。
- [x] T027 [P] [US2] `src/app/discussions/__tests__/page.streaming.test.tsx`と`src/app/discussions/manage/__tests__/page.test.tsx`へpartial空一覧抑止、ready空一覧、reloadのpublic UI契約をREDで追加する。Verified: the two page suites collected 20 tests; 14 existing tests pass and 6 new tests fail only because current pages do not consume the shared public management hook。
- [x] T028 [US2] `src/lib/discussion/__tests__/discussion-management-read-coordinator.test.ts`、`src/components/discussion/__tests__/DiscussionManagementProvider.test.tsx`、`src/app/discussions/__tests__/page.streaming.test.tsx`、`src/app/discussions/manage/__tests__/page.test.tsx`のtest変更だけをfresh read-only reviewerへ渡し、reference dedupe、partial空一覧抑止、source relay phase分離、public rendered boundaryを確認する。対象test以外を書き込ませない。 Final review chain T028A〜T028F: test-code PASS。
- [x] T028A [US2] T028のfresh reviewで指摘された`src/app/discussions/__tests__/page.streaming.test.tsx`と`src/app/discussions/manage/__tests__/page.test.tsx`の非識別fixture、`DiscussionManagementProvider.test.tsx`の`/moderator`実route境界不足、`discussion-management-read-coordinator.test.ts`のpending reference契約矛盾をテストだけで修正し、正しいSHA-256とintentional REDを再記録する。Production codeは変更しない。 Final corrected fixtures are covered by T028C/T028F.
- [x] T028B [US2] T028Aで修正したmanagement test pathsを別fresh read-only reviewerへ再提出し、fixtureが新public modelを実際に識別し、pending/public reference契約とmoderator route境界が明確になるまでT029以降へ進まない。対象test以外を書き込ませない。 Initial review findings were resolved by T028C/T028F.
- [x] T028C [US2] T028Bのfresh reviewで指摘された`src/app/discussions/__tests__/page.streaming.test.tsx`と`src/app/discussions/manage/__tests__/page.test.tsx`のnew `useDiscussionManagement` default model不足をテストだけで修正し、既存legacy fixtureをnew modelへ明示的に投影する。approved/pending q referenceをnew modelで用意し、public `/discussions`のapproved-only表示と`manage`のpending reference保持をnew model経由で検証する。Production codeは変更しない。 Verified: exact no-cache management aggregate collected 4 suites/26 tests with 13 passed and 13 intentional
- [x] T028D [US2] T028Cで修正したmanagement test pathsを別fresh read-only reviewerへ再提出し、既存テストがproduction移行後もGREEN-capableで、public filteringがnew model経由で検出できること、hashとRED理由が正しいことを確認する。対象test以外を書き込ませない。 Initial CHANGES_REQUESTED finding was repaired by T028E; final test-code PASS is recorded at T028F.
- [x] T028E [US2] `src/app/discussions/__tests__/page.streaming.test.tsx`の既存reload assertions 2件をnew `useDiscussionManagement` modelのreload spyへ修正し、legacy reload assertionを必要な互換性検証として混同せず分離する。Production codeは変更しない。
- [x] T028F [US2] T028Eで修正したmanagement test pathsを別fresh read-only reviewerへ再提出し、new model reload spyだけでGREEN-capableであること、hashとRED理由が正しいことを確認する。対象test以外を書き込ませない。 Fresh review: TEST_CODE_VERDICT PASS、modified: false、4 suites/26 tests、11 passed/15 intentional RED、blocking test findingsなし。Correct manage-page SHA-256: `c08e8699b6a3d71620e8d7b2b3b8e8b3d6263d34acada7e16493858cca71cfa8`。

### Implementation for User Story 2

- [x] T029 [US2] `src/lib/discussion/discussion-management-read-coordinator.ts`へ掲載snapshot coordinatorを追加し、既存`DiscussionReferenceResolver`と`executeNostrRead`を接続する。
- [x] T030 [US2] `src/components/discussion/DiscussionManagementProvider.tsx`を追加し、掲載snapshot、single state、phase別provenance、generation、reloadを管理する。
- [x] T031 [US2] `src/app/discussions/layout.tsx`、`src/components/discussion/DiscussionManagementTabLayout.tsx`、`DiscussionListTabLayout.tsx`を新Providerのselector境界へ接続する。
- [x] T032 [US2] `src/app/discussions/page.tsx`と`manage/page.tsx`、`moderator/page.tsx`から直接read・旧management state依存を除去し、掲載snapshot selectorだけを使う。
- [x] T033 [US2] `src/components/discussion/DiscussionDataProvider.tsx`、`DiscussionContentDataProvider.tsx`、`DiscussionManagementDataProvider.tsx`をno-read互換adapterへ縮小するか、全runtime参照を除去して削除する。旧`scope`分岐が残っていないことを検索で確認する。
- [x] T034 [US2] `src/lib/discussion/__tests__/discussion-management-read-coordinator.test.ts`、`src/components/discussion/__tests__/DiscussionManagementProvider.test.tsx`、`src/app/discussions/__tests__/page.streaming.test.tsx`、`src/app/discussions/manage/__tests__/page.test.tsx`のfocused testsをGREENにし、一覧3routeのsnapshot共有、reference dedupe、partial/error/ready表示を確認する。

**Checkpoint**: 一覧route familyが一つの掲載snapshotを使い、画面ごとの掲載readが0件になること。

---

## Phase 5: User Story 3 - 状態・relay provenance (Priority: P1)

**Goal**: read sessionの状態とsuccessful relayをroute/domainに混入させず、phase別に安全に保持する。

**Independent Test**: phase別successful relay、partial/error、reload/stale generation、sessionStorage利用不可のfixtureを実行する。

### Tests for User Story 3

- [x] T035 [P] [US3] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`と`discussion-management-read-coordinator.test.ts`へmetadata/content/evaluation/referenceのsuccessful relayがphase別にsession provenanceへ保存されるREDを追加する。 Verified: coordinator focused tests 2 suites/9 tests passed; partial/error provenance retention is covered.
- [x] T036 [P] [US3] `src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`と`DiscussionManagementProvider.test.tsx`へreload中の旧generation無視、partial action disabled、sessionStorage unavailableのREDを追加する。 Verified: provider focused tests collected 2 suites/12 tests; 10 passed and 2 intentional partial-action REDs, while stale reload/storage cases passed.
- [x] T037 [P] [US3] `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`と`src/app/discussions/__tests__/page.streaming.test.tsx`へloading/partial/error/readyのstatus、aria-live、reload button境界をREDで追加する。 Verified: page focused tests collected 2 suites/18 tests; 17 passed and 1 intentional management-loading status RED.
- [x] T038 [US3] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`、`discussion-management-read-coordinator.test.ts`、`src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`、`DiscussionManagementProvider.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`src/app/discussions/__tests__/page.streaming.test.tsx`のtest変更だけをfresh read-only reviewerへ渡し、phase別relay provenance、stale result、unknown approval、アクセシビリティ状態の検出力を確認する。対象test以外を書き込ませない。 Final review via T038B: PASS。
- [x] T038A [US3] T038のfresh reviewで指摘された`DiscussionDetailProvider.test.tsx`と`DiscussionManagementProvider.test.tsx`の非実効sessionStorage fail-softテストをcache契約へ重複させず整理し、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`のerror fixtureを`snapshot: null`へ、cold-start loading fixtureをnew detail modelのloading境界へ修正する。Production codeは変更しない。 Verified: exact `--no-cache --runInBand --runTestsByPath` aggregate collected 6 suites/37 tests with 32 passed and 5 intentional production-contract REDs; collection/setup/fixture state clean.
- [x] T038B [US3] T038Aで修正した状態・provenance・アクセシビリティtest pathsを別fresh read-only reviewerへ再提出し、partial action safety、snapshot null error、new model loading、phase別relay provenanceが実効的に検証されるまでT039以降へ進まない。対象test以外を書き込ませない。 Fresh review: PASS、modified: false、6 suites/37 tests、32 passed/5 intentional RED、blocking findingsなし。

### Implementation for User Story 3

- [x] T039 [US3] `src/components/discussion/DiscussionReadStatus.tsx`、`DiscussionMetaReadState.tsx`および詳細/一覧画面のstate表示をsingle route state契約へ整理し、phase callback依存を除去する。 Verified: new detail loading/error and public management loading boundaries expose Japanese `role="status"`/`aria-live="polite"` states with existing soft-alert classes and 44px reload controls.
- [x] T040 [US3] `src/lib/discussion/discussion-known-data-cache.ts`とcoordinatorのcache接続をphase別provenanceへ更新し、metadata relayとcontent relayの混入を防ぐ。 Verified: detail/management coordinator provenance and cache aggregate preserve phase-local relay arrays; no Nostr transport changes.
- [x] T041 [US3] mutation reducerとread session generation guardをdetail/management providerへ接続し、古いread結果がsnapshotとoptimistic eventを上書きしないことを確認する。 Verified: detail and management provider tests reject approval add/remove outside ready sessions while stale generation tests remain GREEN.
- [x] T042 [US3] `src/lib/discussion/__tests__/discussion-detail-read-coordinator.test.ts`、`discussion-management-read-coordinator.test.ts`、`src/components/discussion/__tests__/DiscussionDetailProvider.test.tsx`、`DiscussionManagementProvider.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`src/app/discussions/__tests__/page.streaming.test.tsx`のfocused testsをGREENにし、アクセシビリティ属性とphase別relay provenanceを検証する。 Verified: US3 6 suites/37 tests, detail 6 suites/45 tests, management 4 suites/31 tests, cache 1 suite/5 tests, strict TypeScript, lint, and diff-check all passed.

**Checkpoint**: partial/ready/errorの確定境界とsuccessful relayのphase分離がGREENになること。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全体検証、古い責務の除去、文書整合を行う。

- [x] T043 [P] `src`全体で旧`discussion-read-executor`、`executeDiscussionRead`、ページからの直接Nostr read、`getEvaluations(user.pubkey)`の対象route参照を検索し、許可されたcompatibility adapter以外を0件にする。 Verified: old executor/API references are 0; discussion route pages retain only Nostr write actions, while the sole `getEvaluations(user.pubkey)` is `BusStopDiscussion.tsx` outside the target route family; focused detail/management aggregates are GREEN.
- [x] T044 [P] `specs/022-nostr-discussion-read-coordinator/spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/read-coordinator.md`、`quickstart.md`、`tasks.md`の実装結果と用語を照合し、未実装の計画を完了扱いにしない。 Verified: current implementation matches the route-scoped snapshot, Nostr executor rename, phase provenance, and state contracts; historical pre-rename terminology is labeled as historical.
- [x] T045 `npm test -- --runInBand --runTestsByPath`でdetail、management、executor、cache、settingsのfocused aggregateを実行し、suite/test数とexit codeを記録する。 Verified: exact aggregate 14 suites / 93 tests passed, exit 0.
- [x] T046 `npx tsc --noEmit --incremental false`を実行し、strict TypeScriptの成功を確認する。 Verified: exit 0.
- [x] T047 `npm run lint`を実行し、warningとnon-zero failureを分類する。 Verified: exit 0; existing warnings and `next lint` deprecation notice remain non-blocking.
- [x] T048 `npm test -- --runInBand`を実行し、全Jestのsuite/test数とskip数を記録する。中断・timeoutを成功扱いにしない。 Verified: 135 suites passed, 2 skipped; 832 tests passed, 17 skipped; exit 0.
- [x] T049 `npm run build`を実行し、Next.js production buildのexit codeを確認する。GTFS設定警告など既存環境要因は別分類する。 Verified: `NODE_OPTIONS=--max-old-space-size=1536 NEXT_TELEMETRY_DISABLED=1 npm run build` exit 0; existing missing `transit-config.json` caused GTFS import warning but Next.js production build completed.
- [x] T050 `git diff --check`、status、変更パス、旧API検索、branch HEADを確認し、tasksの完了チェックを実測結果に合わせて更新する。 Verified: branch `refactor/nostr-discussion-read-coordinator`, base HEAD `4068268455bebe9e69ff16715317938587255077`, no staged paths, diff check clean, old executor/API exact references 0.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1)は全phaseの前提。
- Foundational (Phase 2)はNostr rename/cache契約を固定し、User Storyをブロックする。
- US1 (Phase 3)とUS2 (Phase 4)はcoordinator実装として分離できるが、共通rename/cache後に着手する。
- US3 (Phase 5)はUS1/US2のprovider stateが存在してから着手する。
- Polish (Phase 6)はUS1〜US3のfocused GREEN後に行う。

### User Story Dependencies

- **US1**: Phase 2完了後に開始可能。detail routeのMVP。
- **US2**: Phase 2完了後に開始可能。US1と並列に設計可能だが、共通cache/renameを共有するため実装は順序化する。
- **US3**: US1/US2のprovider stateに依存する。

### Within Each User Story

- テストを先に追加し、意図したREDを確認する。
- テスト実装直後にfresh read-only test reviewを実行する。
- review PASS、対象testの書込境界確認後にproduction implementationを始める。
- production implementation後はfocused GREEN、strict typecheck、lintを実行する。
- 本番実装後の必須subagent reviewは置かない。AGENTS/constitutionの方針に従い、検証と親のdiff管理で閉じる。

## Parallel Opportunities

- T002/T003は読み取りのみで並列可能。
- T004とT008は別ファイルのtest REDとして並列可能だが、renameの方針確認後に開始する。
- T011〜T015は別test pathsで並列可能。ただしT016のreview前にproduction変更を始めない。
- T025〜T027、T035〜T037も別test pathsで並列可能。
- T043/T044は実装完了後の読み取り専用監査として並列可能。

## Implementation Strategy

### MVP First

1. Phase 1〜2でNostr基盤renameとcache v2を確定する。
2. Phase 3でdetail snapshotを完成させる。
3. detail focused tests、strict TypeScript、lintを実行する。
4. Phase 4以降へ進む前にdetail routeの重複readが0件であることを確認する。

### Incremental Delivery

1. Nostr executor rename/cache v2
2. detail coordinator/provider
3. management coordinator/provider
4. single route stateとphase別provenance
5. 全体検証と古い責務の削除

## Notes

- `[P]`は別ファイルかつ未完了タスクへの依存がない場合だけ付ける。
- 各test reviewの対象はテスト実装だけとし、production codeを変更させない。
- `NostrReadExecutor`と`NostrService`の既存通信契約を変更するtaskは本tasksに含めない。
- 実装開始後、完了したtaskだけを`[x]`へ変更する。
