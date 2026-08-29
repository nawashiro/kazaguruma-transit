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
- ブラウザ上のcomputed layoutが必要な場合は、既存の開発サーバーを再利用せず、readiness確認済みの隔離ポートで補助確認する。静的契約テストをブラウザ検証の代替にはしない。

## Phase 6: DaisyUI grid境界の追加調査と修正

- [x] F001 [INVESTIGATION] PR #117の現行production TSX 81ファイルをAST走査し、alert 43件（直接テキスト13件）、status 48件（直接テキスト15件）、menu項目12件、label/legend 29件（直接テキスト6件）を分類した。SidebarのRubyful後grid分割と、`div.alert`/非`p` statusの匿名grid item問題を、現行版・変更前版のcomputed style・スクリーンショット・制御probeで確認した。変更対象と安全な保持対象を確定し、提案2のflex化を除外した。

- [x] F002 [DOC] F001の結果を`research.md`、`plan.md`、`tasks.md`へ追記した。方針1（Sidebarの単一ラベルwrapper復元）と方針3（alert/statusの直接テキストを意味要素へ移行）を実装境界として確定した。実装writerは方針2のDaisyUI表示方式変更を行わない。

- [x] F003 [TEST] 次のテストpathだけを変更し、Sidebarの単一label wrapper、`div.alert`/非`p` statusの直接テキスト不在、既存statusメッセージの意味要素境界を契約する。実装前にcollection/setupではない意味のあるREDを確認する。実測: 4 suites / 19 tests中14 PASS、5 RED。REDはalert/status直接テキスト26件、Sidebar wrapper不足12件、2つのloading statusの`p.ruby-text`不足で、collection/setup failureはなかった。
  - `src/app/__tests__/layout-boundary-contract.test.ts`
  - `src/components/layouts/__tests__/Sidebar.test.tsx`
  - `src/components/discussion/__tests__/DiscussionReadStatus.test.tsx`
  - `src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`
  - 実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/layout-boundary-contract.test.ts src/components/layouts/__tests__/Sidebar.test.tsx src/components/discussion/__tests__/DiscussionReadStatus.test.tsx src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx --silent`

- [x] F004 [REVIEW] F003でsettleしたテストpathを別fresh read-only subagentへレビュー委任する。DaisyUIのmenu/alert gridを直接上書きせず、既存label/ARIA/callback契約を弱めず、AST境界が実productionを網羅し、vacuous assertionでないことを確認する。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致が揃うまで実装を開始しない。前回reviewはSidebarの`gap-0`個別禁止とmenu限定summary selectorのfalse negative指摘により無効。修正後のfresh reviewを要する。実測: reviewer `sa-0-5cdcab3d` が`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS`を返した。4 suites / 19 tests PASS、collection/setup failureなし、strict TypeScript・full lint・diff check PASS、開始終了SHA一致、変更なし。

- [x] F005a [IMPL-1] F004 PASS後、Sidebarのmenu itemだけを変更する。`src/components/layouts/Sidebar.tsx`の12項目について、親の`ruby-text gap-0`を外し、アイコン以外を1つの直接子`span.ruby-text`へ戻す。DaisyUIのmenu grid、summaryの矢印、リンク先、クリック動作を変更しない。実測: Sidebar focused 1 suite / 9 tests PASS、production wrapper 12件、parent ruby-text/gap-0 0件、diff check PASS。

- [x] F005b [IMPL-2] F005a完了後、alertコンテナの直接テキストだけを指定path内で意味要素へ移す。`div.alert`の直接テキストを`p.ruby-text`等へ変更し、role/aria-live/message/button callbackを維持する。`p.alert`、label/legend、badge/loading/sr-only等は変更しない。実測: 実在する8 suites / 43 tests PASS、対象8 pathの`div.alert`直接テキスト0件、strict TypeScript・対象Lint・diff check PASS。初回指定には存在しないtest pathがあったため、実在pathへ補正して実行した。
  - `src/app/discussions/page.tsx`
  - `src/app/locations/page.tsx`
  - `src/app/settings/page.tsx`
  - `src/components/auth/AuthenticationForm.tsx`
  - `src/components/features/LocationSuggestions.tsx`
  - `src/components/features/RouteCalendarExport.tsx`
  - `src/components/features/RoutePdfExport.tsx`
  - `src/components/features/RouteSearchResults.tsx`
  - 実行: 対象alert focused tests、strict TypeScript、対象Lint、`git diff --check`

- [x] F005c [IMPL-3] F005b完了後、非alert statusの直接テキストだけを指定path内で意味要素へ移す。spinnerと文言の表示、role/aria-live、loading/error状態を維持する。実測: 親側の実在7 suites / 54 tests PASS、strict TypeScript exit 0、full lint exit 0、diff check PASS。`RouteSearchResults.tsx:171`のflex+spinner statusは安全分類どおり再編集していない。
  - `src/app/login/page.tsx`
  - `src/app/signup/page.tsx`
  - `src/app/discussions/[naddr]/page.tsx`
  - `src/app/discussions/[naddr]/moderators/page.tsx`
  - `src/components/discussion/DiscussionManagementModeratorPage.tsx`
  - `src/components/discussion/DiscussionReadStatus.tsx`
  - `src/components/discussion/DiscussionMetaReadState.tsx`
  - 実行: 対象status focused tests、strict TypeScript、対象Lint、`git diff --check`

- `src/components/features/RouteSearchResults.tsx`のloading statusは`flex`コンテナでspinnerと文言を横並びにする既存構造であり、DaisyUI gridの直接テキスト崩れには該当しない。F005bで同じファイルのalertを変更済みのため、F005cでは再編集しない。

- [x] F006 親が現行bytesを再走査し、`div.alert`/非`p` statusの直接テキスト0件（flex loading statusとして明示除外した`RouteSearchResults.tsx:171`を除く）、Sidebarのmenu label wrapper 12件、label/legendの保持、DaisyUI表示方式の非変更を確認する。390px/desktopの隔離ブラウザprobeでSidebarと代表的alertを再計測する。実測: 独立production reviewer `sa-0-4d810b3d` が`SUBAGENT_STATUS: COMPLETE` / `VERDICT: PASS`を返した。16 production pathをレビューし、81 TSXのsource probeで対象direct text 0件、Sidebar wrapper 12件、親ruby/gap-0 0件、CSS/display override 0件を確認。contract 4 suites / 19 tests、strict TypeScript、lint、diff check PASS。開始終了SHA・status一致、staged pathなし、変更なし。

- [x] F007 Node 22.23.2で追加focused tests、strict TypeScript、lint、全Jest、buildを実行し、初回失敗・baseline・warning・終了コードを分類する。ブラウザprobeと`git diff --check`を含めてtasks/researchへ記録する。実測: focusedはcontract 4 suites / 19 tests、alert 8 suites / 43 tests、status 7 suites / 54 tests、全Jestは139 suites PASS / 2 skipped、856 tests PASS / 13 skipped。strict TypeScript、lint、build、diff checkはexit 0。ブラウザは390px幅でSidebarのDaisyUI grid列とalert制御probeを確認し、横溢れなし。GTFS importの`transit-config.json`不在表示と既存Lint warningsは失敗と分離して記録した。

- [ ] F008 最終差分を親が確認し、PR #117へ日本語の修正commitをpushする。push後にPR head/base/filesを読み戻し、exact SHAのQuality Gateを終端まで確認する。mergeは行わない。

### Phase 6 依存関係

```text
F001 → F002 → F003 → F004 → F005a → F005b → F005c → F006 → F007 → F008
```

F003のテストレビュー直後にF005a以降のproduction writerを開始する。同一pathを複数writerが変更せず、F005a〜F005cの中間状態はGREENとは呼ばない。
