# Issue #106 実装タスクリスト

**Issue**: [#106](https://github.com/nawashiro/kazaguruma-transit/issues/106)

**Repository**: `/opt/data/work/kazaguruma-transit-issue-106`

**Branch**: `fix/issue-106-span-gap`

**Base**: `dev` / `d4fda9a6f69cc01452fa58eee3b22181eb51d057`

**関連文書**: `research.md`、`plan.md`

## 実行規約

- 作業言語は日本語とする。
- 憲章・AGENTS.mdの一般原則（TDD、strict TypeScript、アクセシビリティ、検証）は適用する。
- Issue #106の先行文書タスクで、「日本語ボタン文字列を子spanの`ruby-text`へ置く」という過去仕様を`AGENTS.md`と憲章から削除する。憲章はGovernanceに従い`4.0.0`へ更新する。
- 意味・ARIA・レイアウト・参照の責務がないspanだけを削除する。badge、loading、sr-only、label-text、truncate、ID・参照境界などは保持する。
- テスト作成タスクの直後に、別fresh read-only subagentのレビュータスクを置く。レビュー必須結果は次のとおり。

```text
SUBAGENT_STATUS: COMPLETE
VERDICT: PASS
```

- writerは指定したhard writable pathsだけを変更し、commit、push、reset、clean、stageを行わない。
- 親は各返却後にstatus、diff、対象ファイル、SHA、focused testの実測結果を再確認する。
- `src/app/apple-icon.png`、`public/images/map_placeholder.png`は凍結する。`AGENTS.md`と`.specify/memory/constitution.md`はT001aの文書タスクで更新したため、以後の実装writerからは凍結する。
- `npm run build`は最終検証で一度だけ実行する。Nodeは`/opt/data/toolchains/node-v22.23.2/bin`をPATH先頭に置く。

## Phase 1: Investigation and setup

- [x] T001 `origin/dev`をfetchし、ローカル`dev`を`d4fda9a6f69cc01452fa58eee3b22181eb51d057`へfast-forwardした。Issue #106のbody/comments、関連PR検索、規約、production span棚卸し、DaisyUI公式Button/Cardを調査し、`issues/106-span-element-cleanup/{research,plan,tasks}.md`を作成した。worktree初期のLFS由来`src/app/apple-icon.png`差分を凍結対象として記録した。

- [x] T001a Issue #106の過去仕様を削除する。`AGENTS.md`から子spanの`ruby-text`規定を削除し、`.specify/memory/constitution.md`からも削除して版を`3.0.0`から`4.0.0`へ更新する。Sync Impact Reportへ理由、変更・削除項目、follow-upを記録し、両ファイルへ同じ規定が残っていないことを再検索する。

**Checkpoint**: ベースSHA、Issue状態、既存作業なし、span分類、gap-0方針、凍結pathが確定している。

## Phase 2: Contract test (RED → fresh review)

- [ ] T002 [TEST] 次のテストpathだけを変更し、不要span・gap-0・Button境界の契約を追加する。テストはproduction sourceを走査し、属性なしspan、`gap-0`のないDaisyUI `btn` / `card-title`、共通Buttonの自動spanを具体的なpath付きで検出する。既存のDOM契約は新しい親要素境界へ更新する。実装前にcollection/setupではない意味のあるREDを確認する。
  - `src/app/__tests__/span-structure-contract.test.ts`
  - `src/components/ui/__tests__/Button.test.tsx`
  - `src/app/award/__tests__/page.test.tsx`
  - `src/app/routes/__tests__/page.test.tsx`
  - `src/components/features/__tests__/OriginSelector.test.tsx`
  - 実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/span-structure-contract.test.ts src/components/ui/__tests__/Button.test.tsx src/app/award/__tests__/page.test.tsx src/app/routes/__tests__/page.test.tsx src/components/features/__tests__/OriginSelector.test.tsx --silent`

- [ ] T003 [REVIEW] T002でsettleしたテストpathを別fresh read-only subagentへレビュー委任する。確認項目は、属性なしspanとgap漏れを実際のproduction sourceから検出すること、Button/heading/linkの新しいDOM契約が意味のあること、badge/loading/sr-only等を誤って禁止しないこと、vacuous assertionでないこと、既存のaccessible name・イベント契約を弱めていないことである。レビュー中はtest・production・docsを変更しない。`SUBAGENT_STATUS: COMPLETE` と `VERDICT: PASS` が揃うまで実装を開始しない。

**Checkpoint**: T002の意味あるREDとT003の明示的PASSが揃っている。

## Phase 3: Production implementation

- [x] T004 [IMPL-1] T003 PASS後、共有UI・レイアウト・共通Button境界だけを変更する。共通Buttonの自動spanを撤去し、buttonへ`ruby-text gap-0`を付与する。card-title/静的メニューの文字列専用spanを親へ移す。アイコンの表示と操作、aria属性、既存の明示間隔を維持する。実測: 親側で11 suites / 59 tests PASS、対象path内の属性なしspan・btn/card-title gap漏れ0件、diff check PASS。
  - `src/components/ui/Button.tsx`
  - `src/components/ui/Card.tsx`
  - `src/components/ui/CarouselCard.tsx`
  - `src/components/ui/CategoryTabs.tsx`
  - `src/components/ui/ResetButton.tsx`
  - `src/components/layouts/Sidebar.tsx`
  - `src/components/layouts/SidebarLayout.tsx`
  - `src/components/features/OriginSelector.tsx`
  - `src/components/features/RouteCalendarExport.tsx`
  - `src/components/features/RoutePdfExport.tsx`
  - `src/components/features/RouteSearchResults.tsx`
  - `src/components/features/KoFiSupport.tsx`
  - `src/components/discussion/PostPreview.tsx`
  - 実行: shared/feature focused tests、strict TypeScript、対象Lint、`git diff --check`

- [x] T005 [IMPL-2] T003 PASS後、静的ページ・一覧・検索関連だけを変更する。目次リンク、見出し、外部導線、アラートの文字列専用spanを整理し、DaisyUI `btn` / `card-title` に`gap-0`を付与する。リンク先、見出しレベル、一覧データ、ローディング表示を維持する。実測: 親側で10 suites / 63 tests PASS、対象8 production pathの属性なしspan・btn/card-title gap漏れ0件、diff check PASS。
  - `src/app/award/page.tsx`
  - `src/app/beginners-guide/page.tsx`
  - `src/app/usage/page.tsx`
  - `src/app/license/page.tsx`
  - `src/app/settings/page.tsx`
  - `src/app/discussions/page.tsx`
  - `src/app/locations/page.tsx`
  - `src/app/location-detail/[id]/page.tsx`
  - 実行: 対象route/component focused tests、strict TypeScript、対象Lint、`git diff --check`

- [x] T006a [IMPL-3a] T003 PASS後、ディスカッション共通部品・状態表示・操作補助だけを変更する。エラー/partial/statusは`p`等の意味要素へ移し、文字列専用spanとボタン内部spanを撤去する。badge、tab count、form label、sr-only、Rubyful hidden boundaryは保持する。Nostr read/write、permission、router、ARIAを変更しない。実測: 親側で8 suites / 47 tests PASS、対象path内の属性なしspan・btn/card-title gap漏れ0件、diff check PASS。
  - `src/components/discussion/DiscussionReadStatus.tsx`
  - `src/components/discussion/DiscussionMetaReadState.tsx`
  - `src/components/discussion/DiscussionManagementTabLayout.tsx`
  - `src/components/discussion/DiscussionTabLayout.tsx`
  - `src/components/discussion/ModeratorManagementSection.tsx`
  - `src/components/discussion/BusStopDiscussion.tsx`
  - `src/components/discussion/BusStopMemo.tsx`
  - `src/components/discussion/EvaluationComponent.tsx`
  - `src/components/discussion/PermissionGuards.tsx`
  - 実行: 対象discussion component focused tests、strict TypeScript、対象Lint、`git diff --check`

- [x] T006b [IMPL-3b] T006a完了後、ディスカッションroute・認証ページの文字列専用spanとボタン内部spanだけを変更する。既存のread/write、認証、router遷移、ARIA、loading/error/partial状態を維持し、DaisyUI `btn` の`gap-0`を漏らさない。実測: 指定focused 13 suites / 110 tests PASS、対象9 production path内の属性なしspan・btn/card-title gap漏れ0件、strict TypeScript・対象Lint・diff check PASS。
  - `src/components/discussion/DiscussionManagementModeratorPage.tsx`
  - `src/app/discussions/create/page.tsx`
  - `src/app/discussions/manage/page.tsx`
  - `src/app/discussions/[naddr]/page.tsx`
  - `src/app/discussions/[naddr]/approve/page.tsx`
  - `src/app/discussions/[naddr]/edit/page.tsx`
  - `src/app/discussions/[naddr]/moderators/page.tsx`
  - `src/components/auth/AuthenticationForm.tsx`
  - `src/components/auth/AuthRoutePage.tsx`
  - 実行: 対象discussion/auth focused tests、strict TypeScript、対象Lint、`git diff --check`

- [x] T006c [IMPL-3c] T006b完了後、全体契約で残った2つのproduction pathだけを変更する。LocationSuggestionsの属性なしエラーspanを意味要素へ移し、LocationCardの`card-title`へ`gap-0`を追加する。ローディングspinner、truncate、リンク遷移、ロケーション選択動作を変更しない。実測: 3指定suiteを親が再実行し14 tests PASS、Issue専用契約1 suite / 4 tests PASS、対象2 pathのdiff check PASS。
  - `src/components/features/LocationSuggestions.tsx`
  - `src/components/features/LocationCard.tsx`
  - 実行: 対象feature focused tests、strict TypeScript、対象Lint、`git diff --check`

- [x] T007 [IMPL-4] T004〜T006c後、production sourceを再走査して残存する不要spanと`gap-0`漏れだけを、明示したpath内で整理する。責務spanを削除せず、未指定pathを変更しない。契約テストをGREENにするための検証専用タスクであり、追加の仕様を作らない。実測: production TSX 81 filesを再走査し、属性なしspan 0件、btn gap漏れ0件、card-title gap漏れ0件。Issue契約は1 suite / 4 tests PASS。

**Checkpoint**: Issue専用契約がGREEN、属性なしspanが0件、対象btn/card-titleのgap-0漏れ0件、責務spanが保持されている。

## Phase 4: Parent verification and delivery

- [x] T008 親が現行worktreeのstatus、HEAD、変更path、凍結path、`git diff --check`、対象SHAを確認する。`src/app/apple-icon.png`の既存差分をcommitへ混入させない。実測: HEADはベース`d4fda9a6f69cc01452fa58eee3b22181eb51d057`のまま、変更pathはIssueの許可範囲、`src/app/apple-icon.png`は既存差分のまま未stage。

- [x] T009 Node 22.23.2でIssue契約・変更対象focused tests・strict TypeScript・対象Lintを、settled bytesに対して実行する。TDDのRED/GREEN、collection/setup、fixture、既存baselineを分類する。実測: Issue契約1 suite / 4 tests、T004 focused 11 suites / 59 tests、T005 focused 10 suites / 63 tests、T006a focused 8 suites / 47 tests、T006b focused 13 suites / 110 tests、T006c focused 3 suites / 14 testsがPASS。strict TypeScript PASS、対象Lint exit 0。

- [x] T010 Node 22.23.2で`npm test -- --runInBand`、`npm run lint`、`npx tsc --noEmit --incremental false`、`npm run build`を実行する。buildのPrisma/GTFS副作用、warning、環境制約と終了コードを分離して記録する。実測: 全Jest再実行は138 suites PASS / 2 skipped、853 tests PASS / 13 skipped。初回全Jestの1件は`getNostrServiceConfig is not a function` setup failureだったが、単独・ペア・再実行とベースSHAのclean worktreeでは再現しなかった。Lint exit 0、strict TypeScript exit 0、build exit 0。buildでは`transit-config.json`不在による既存GTFS importエラー表示とPrisma update noticeが出たが、Next production buildは完了した。

- [x] T011 `research.md`、`plan.md`、`tasks.md`へ実測した変更path、span件数、focused/full test、strict TypeScript、lint、build、凍結path、statusを反映する。文書変更後に`git diff --check`と相対リンクを確認する。実測結果をresearch/tasksへ追記し、Issue文書の相対リンクとdiff checkを確認した。

- [x] T012 最終差分を親が再レビューし、conventional prefixの日本語commitを作成して`origin/fix/issue-106-span-gap`へpushする。PRを作成する場合はbaseを`dev`に明示し、Issue #106をcloseする本文、変更理由、検証結果、未変更範囲、Node条件を日本語で記載する。PR作成後にtitle/body、head/base、changed filesを読み戻す。実測: commit `cbeb9ae4536460075d1b4dce0e1ae5c675c27586`を作成してpushし、PR #117（base=`dev`、head=`fix/issue-106-span-gap`）を作成した。PR title/body、head SHA、変更ファイルを読み戻した。

- [x] T013 pushしたexact SHAのGitHub checksを確認する。CIが未triggerなら成功扱いにせず「未trigger」と記録する。failureは変更起因・baseline・infrastructureに分類する。mergeはユーザーの明示承認なしに行わない。実測: `cbeb9ae4536460075d1b4dce0e1ae5c675c27586`のQuality Gate run `33244041314` / job `99078265090`は`pass`。PR #117はopenで、mergeしていない。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006a → T006b → T006c → T007 → T008 → T009 → T010 → T011 → T012 → T013
```

同一pathを複数の実装writerが触らない。各writerは指定pathだけを変更し、親は返却ごとに現行bytesを再確認する。T004〜T006cの中間状態をGREENとは呼ばない。

## 受入条件と検証の対応

| 受入条件 | 主な証拠 |
|---|---|
| 属性なしspan 0件 | T002 RED、T007契約GREEN、T008再検索 |
| btn/card-titleのgap-0 | T002 RED、T004〜T006c、T008再検索 |
| Button自動span撤去 | T002 Button RED、T004 focused GREEN |
| 構造・ARIA・操作維持 | T002既存テスト更新、T004〜T006c focused tests、T009/T010 |
| 責務span保持 | T003 review、T007分類再確認、T009/T010 |
| 凍結path不変 | T001記録、T008 status/SHA |
| 文書・憲章ゲート | T001/T001a docs、T011実測同期 |
| リモート配送・CI | T012 exact SHA、T013 checks |

## 実装後検証

- production TSX: 81 files、span開始タグ61、属性なしspan 0、`ruby-text`を含むspan 17、badge span 12、loading span 5、sr-only span 4。
- `AGENTS.md`と憲章の本文には、子spanの`ruby-text`を要求する旧規定が残っていない。憲章は`4.0.0`、Last Amendedは`2026-08-29`。
- Issue専用契約: 1 suite / 4 tests PASS。
- T004 focused: 11 suites / 59 tests PASS。
- T005 focused: 10 suites / 63 tests PASS。
- T006a focused: 8 suites / 47 tests PASS。
- T006b focused: 13 suites / 110 tests PASS。
- T006c focused: 3 suites / 14 tests PASS。
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0。
- Lint: `npm run lint` exit 0。`next lint` deprecation、既存の`any`、`<img>`、Hook依存、今回の変更pathに含まれる既存warningを記録した。
- 全Jest: 初回は`getNostrServiceConfig is not a function`のsetup failureが1件あったが、単独・ペア・再実行と変更前SHAのclean worktreeで再現しなかった。再実行は138 suites PASS / 2 skipped、853 tests PASS / 13 skipped。
- Build: `npm run build` exit 0。Prisma生成・DB push・Next production build成功。`transit-config.json`不在によるGTFS importエラー表示とPrisma update noticeは既存環境上のwarningとして分離した。
- `git diff --check`: PASS。`src/app/apple-icon.png`のLFS由来差分はIssue変更に含めず、未stageのまま保持している。
