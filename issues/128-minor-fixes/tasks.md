# Issue #128 実装タスクリスト

- Issue: [#128](https://github.com/nawashiro/kazaguruma-transit/issues/128)
- Repository: `/opt/data/kazaguruma-transit`
- Base: `dev` / `0215274d7f642a609a9ae0a26db56aadbd189564`
- Implementation branch: `fix/issue-128-minor-fixes`
- Related documents: `investigation.md`、`plan.md`

## 実行規約

- 作業言語は日本語とする。commit、PR本文、実装記録も日本語にする。
- `AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0を適用する。
- 実装タスクは1タスクにつき1サブエージェントへ委任する。親は依存関係、書込境界、RED/GREEN、変更path、最終検証を管理する。
- テストタスクはproduction codeを書かず、実装前に意味のあるREDを確認する。新規moduleを直接importしてcollection errorにしないよう、必要なら既存のguarded public-boundary loader形式で「module未実装」の失敗をテスト本体へ閉じ込める。
- 各テスト実装タスクの直後に、別fresh read-only reviewerを置く。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致を親が確認するまでproduction taskへ進まない。
- test writerは指定test path以外（production、Issue docs、設定、commit、push、reset、stage、clean）を変更しない。reviewerは全pathを変更しない。
- production writerは指定production pathだけを変更し、既存のNostr／Prisma／GTFS／認証情報経路を変更しない。新規CSS、認証action再実行、URLへの本文埋め込み、旧reason fallbackを追加しない。
- `.card-title`はproduction codeで21箇所を対象とし、既存`inline`ユーティリティを付けるだけにする。
- 下書きは同一タブの`sessionStorage`だけに保存する。認証URL、relay、localStorage、DBへ保存しない。publish成功後だけ削除し、失敗時は残す。
- `npm run build`は最終検証で一度だけ実行する。
- サブエージェントはcommit／push／PR作成を行わない。配送は最終タスクで親が行い、mergeは行わない。

## Phase 1: 調査・憲章にもとづく計画

- [x] T001 [INVESTIGATE] `dev`を`origin/dev`の`0215274d7f642a609a9ae0a26db56aadbd189564`へfast-forwardし、clean状態、Issue #128本文・コメント、重複PR、関連履歴、現行source/test、DaisyUI公式・実installed CSSを確認して`issues/128-minor-fixes/investigation.md`へ記録した。
- [x] T002 [PLAN] `AGENTS.md`と`.specify/memory/constitution.md`の各原則をconstitution gateとして適用し、13項目の受入条件、変更境界、検証計画を`issues/128-minor-fixes/plan.md`へ記録した。

**Checkpoint:** Issueの全項目、根因、非対象、production/testのhard write boundary、RED→review→GREENの順序が確定している。

## Phase 2: 回帰テスト（RED → fresh review）

- [x] T003 [TEST-RED] 評価・表示・レイアウト契約を先に追加する。`src/components/discussion/__tests__/EvaluationComponent.test.tsx`で新しい評価文言、補足文削除、`text-balance`削除、投稿カード外のボタン、article→button group→progress順、コロンなしARIAを固定する。`src/app/routes/__tests__/page.test.tsx`で検索結果説明を固定する。`src/components/features/__tests__/RouteSearchResults.test.tsx`を追加し、loading親に`ruby-text`を置かず、テキストだけをRuby対象にする契約を置く。`src/app/__tests__/layout-boundary-contract.test.ts`のloading例外を削除して直接テキスト混在をREDにする。`src/components/layouts/__tests__/SidebarLayout.test.tsx`でPC右寄せ用クラスを固定する。`src/app/__tests__/card-title-style-contract.test.ts`を追加し、テスト・fixture・docsを除くproductionの全`card-title`使用が`inline`を持つ契約を置く。`src/app/settings/__tests__/page.streaming.test.tsx`で長い説明の一覧短縮契約を追加する。production pathは変更しない。
  - 実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath ...`
  - 期待: collection/setupではなく、旧productionの文言・DOM境界・未対応`.card-title`に対する意味のあるRED。
- [x] T004 [REVIEW-FAILED] T003のtest pathだけを別fresh read-only subagentへレビュー委任した。開始・終了SHA一致、`modified: false`を確認したが、Ruby境界の子孫検証、card-title収集のfail-closed化、RoutesPageのact警告について`VERDICT: FAIL`となったため、production gateは開けなかった。

- [x] T003R [TEST-CORRECTION] T004の指摘を受け、`src/components/features/__tests__/RouteSearchResults.test.tsx`、`src/app/__tests__/card-title-style-contract.test.ts`、`src/app/routes/__tests__/page.test.tsx`、`src/components/layouts/__tests__/SidebarLayout.test.tsx`だけを修正した。spinnerがRuby境界の子孫でないこと、動的className等のcard-title収集漏れ、RoutesPageのasync副作用、menu→theme／`lg:hidden`を契約化し、productionは変更しなかった。Node 22で7 suite / 33 testsを収集し、11 failed / 22 passedの意味あるRED、collection/setup/runtime failureなし、act警告なしを確認した。
- [x] T004R [REVIEW-PASS] T003/T003Rの7 test pathを別fresh read-only subagentへ再レビュー委任した。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA `0215274d7f642a609a9ae0a26db56aadbd189564`一致、status一致、`git diff --check` exit 0を確認した。card-title 21件のfail-closed収集、Ruby境界、async待機、既存契約維持に指摘なし。

- [x] T005 [TEST-RED] 認証・現在URL・下書き・投稿フォーム契約を先に追加した。Node 22で8 suite / 60 testsを収集し、27 failed / 33 passed。旧reason・root固定・下書き未実装に対する意味あるREDで、collection/setup/runtime/act/open-handle failureなし。`src/lib/navigation/__tests__/auth-route.test.ts`をreasonなしの署名へ更新し、reason queryが生成されないことを固定する。`src/lib/navigation/__tests__/current-route.test.ts`と`src/lib/forms/__tests__/use-session-draft.test.tsx`を追加し、安全な現在相対URL（query含む）とsessionStorageの保存・復元・削除・不正JSON無視を固定する。`src/app/login/__tests__/page.test.tsx`と`src/app/signup/__tests__/page.test.tsx`でreason表示がないことを固定する。`src/app/discussions/create/__tests__/page.test.tsx`、`src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`、`src/components/discussion/__tests__/BusStopDiscussion.streaming.test.tsx`で、入力の保存・再訪復元・成功後削除、現在URLのreturnTo、reasonなし、既存の認証副作用なしを固定する。現行テストの古いreason/root期待値は新契約へ更新し、production pathは変更しない。
  - 実行: auth route、current route、draft helper、login/signup、create/detail/bus-stopの関連suiteをNode 22 `--runInBand`で実行する。
  - 期待: collection/setupではなく、reasonが残ること、root固定、下書き未保存を示す意味のあるRED。新規moduleの未実装はtest本体のguarded failureに限定する。
- [x] T006 [REVIEW-FAILED] T005のtest pathをfresh read-only reviewした。SHA/status不変・`modified: false`だったが、detail query付きreturnToとnaddr／bus-stop key分離の検証不足でFAILとなった。sessionStorageがrelay／URLへ漏れない契約、publish失敗時保持、成功時削除、queryを含む現在URL、safe return検証、reason表示廃止、既存auth side effectなしを確認する。必須結果は`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致。親がREDを再実行する。

- [x] T005R [TEST-CORRECTION] T006の指摘を受け、詳細ページのquery付きreturnTo、`naddr-test`／`naddr-other`、`["A"]`／`["B"]`の下書きkey分離を、指定2 test pathだけで補強した。Node 22で8 suite / 62 testsを収集し、29 failed / 33 passed、collection/setup/runtime/act/open-handle failureなし。
- [x] T006R [REVIEW-FAILED] T005/T005Rをfresh read-only reviewした。SHA/status不変・`modified: false`だったが、3フォームのpublish/process失敗後に元payloadを再確認していないためFAILとなった。
- [x] T005RR [TEST-CORRECTION] 3フォームの失敗時保持テストへ、タイトル／説明／本文／バス停タグの元payload assertionを追加した。productionは変更していない。
- [x] T006RR [REVIEW-PASS] T005〜T005RRの8 test pathをfresh read-only reviewした。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA/status一致、focused REDのcollection/setup/runtime/act/open-handle failureなしを確認した。

- [x] T007 [TEST-RED] 制限値・ドメイン表示契約を追加した。Node 22で6 suite / 77 testsを収集し、33 failed / 44 passed。旧500／280、未実装display helper、既存T005 REDによる意味ある失敗で、collection/setup/runtime/act/open-handle failureなし。`src/lib/nostr/__tests__/nostr-utils.test.ts`で投稿本文1000文字境界を、`src/lib/discussion/__tests__/user-creation-flow.test.ts`で会話説明1000文字境界を固定する。`src/lib/discussion/__tests__/display.test.ts`を追加し、会話説明70文字＋`...`の短縮を固定する。関連create/detail/bus-stop/settings testで`maxLength`、counter、長文表示、会話編集500文字非対象を確認する。production pathは変更しない。
  - 実行: limits、display、user-creation-flow、nostr-utils、および関連UI suiteをNode 22 `--runInBand`で実行する。
  - 期待: 500／280の旧上限に対する意味のあるRED。1000文字ちょうどは受け入れ、1001文字は拒否する契約にする。
- [x] T008 [REVIEW-PASS] T007のtest pathをfresh read-only reviewした。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA/status一致、production差分なし、`git diff --check` exit 0。blockerなし。validation・DOM属性・counterが同じ仕様を見ており、会話タイトル／編集仕様を誤って変更する契約になっていないこと、短縮処理が`/discussions`の現行挙動と一致することを確認する。必須結果は`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始・終了SHA一致。親がREDを再実行する。

**Checkpoint:** T003/T003R/T004R、T005/T006、T007/T008の意味あるREDとfresh review PASSが揃った。production codeの変更を開始できる。

## Phase 3: production実装（タスク単位）

- [x] T009 [IMPL-VERIFIED] 共通の小さなヘルパーを実装する。`src/lib/navigation/current-route.ts`に現在pathname＋searchを返す`getCurrentRoute`を追加する。`src/lib/forms/use-session-draft.ts`にunknown JSONの型ガード、sessionStorageのload/save/clear、初回restore後の即時autosave、storage例外の安全な無視を実装する。`src/lib/discussion/limits.ts`に説明／投稿本文1000文字定数を追加し、`src/lib/discussion/display.ts`に70文字短縮関数を追加する。指定された新規helper path以外は変更しない。
- [x] T010 [IMPL-VERIFIED] 認証理由経路を削除する。`src/lib/navigation/auth-route.ts`からreason引数とquery生成を削除し、`src/components/auth/AuthRoutePage.tsx`からreasonの読み取り・status表示を削除する。returnToの安全な検証、認証画面の説明、login/signup切替リンクは維持する。
- [x] T010R [IMPL-CORRECTION] `auth-route.ts`の未使用legacy可変引数を削除し、builderを1引数署名へした。auth関連22 testsはGREENだったが、個別会話モデレーター画面に旧2引数が残りstrict TypeScriptが失敗した。
- [x] T010RR [IMPL-CORRECTION] `src/app/discussions/[naddr]/moderators/page.tsx`の旧reason付き呼び出し2箇所だけを1引数へ修正した。モデレーター申請フォームのdomain `reason` stateは維持し、auth／moderator 34 testsとstrict TypeScriptをGREENにした。

- [x] T011 [IMPL-VERIFIED] 評価UIを修正する。`src/components/discussion/EvaluationComponent.tsx`だけを変更し、既定タイトルを妥当性の文言へ変更、過剰補足文と`text-balance`を削除、投稿articleの外に評価ボタン群を置き、progressのARIAラベルからコロンを除く。既存の評価取得・filter・publish callback、ボタン名・44px領域は維持する。
- [x] T012 [IMPL-VERIFIED] 会話作成フォームを修正する。`src/app/discussions/create/page.tsx`と`src/lib/discussion/user-creation-flow.ts`だけを変更し、`useSessionDraft`でタイトル・説明・モデレーター一覧・入力途中IDを保存／復元／成功後削除し、`getCurrentRoute`を未認証遷移へ使う。説明のvalidation、`maxLength`、counterを共通1000定数へ接続し、タイトル100文字は維持する。
- [x] T013 [IMPL-VERIFIED] 会話詳細の投稿フォームを修正する。`src/app/discussions/[naddr]/page.tsx`だけを変更し、本文・バス停タグ・選択ルートの下書きをnaddr単位で保存／復元／公開成功後削除する。未認証遷移へ`getCurrentRoute`を使い、投稿本文の`maxLength`／counterを1000へ変更する。新規投稿説明、Issue指定placeholder、既定評価文言の利用、既存Nostr publish・optimistic state・loading/errorは維持する。
- [x] T014 [IMPL-VERIFIED] 経路検索のバス停投稿フォームを修正する。`src/components/discussion/BusStopDiscussion.tsx`と`src/lib/nostr/nostr-utils.ts`だけを変更し、バス停集合単位の下書き保存／復元／公開成功後削除、`getCurrentRoute`によるquery付きreturnTo、投稿本文1000文字validation／属性／counter、`このアドバイスは役に立ちますか？`、`利用者へのアドバイスを投稿`を実装する。評価・承認・relay取得経路は変更しない。
- [x] T015 [IMPL-VERIFIED] 検索結果loadingとテーマ切替配置を修正する。`src/components/features/RouteSearchResults.tsx`のstatus親からRuby境界を外し、検索文だけをRuby対象子要素へ置く。`src/app/routes/page.tsx`の説明を`自動作成されたスケジュール`へ変更する。`src/components/layouts/SidebarLayout.tsx`へ`lg:justify-end`を追加し、PCでもThemeToggleを右寄せにする。既存のroute fetch、rate-limit遷移、mobile左右配置は維持する。
- [x] T016 [IMPL-VERIFIED] 会話説明の一覧表示を統一する。`src/app/discussions/page.tsx`と`src/app/settings/page.tsx`だけを変更し、`truncateDiscussionDescription`を使って両方を70文字＋`...`へ統一する。loading、partial、error、認証、リンク、取得経路は維持する。
- [x] T017 [IMPL-VERIFIED] 全production `.card-title`のDaisyUI flex境界を修正する。調査で列挙した未対応18箇所（`src/components/discussion/DiscussionManagementModeratorPage.tsx`、`ModeratorManagementSection.tsx`、`src/components/features/LocationCard.tsx`、`KoFiSupport.tsx`、`src/app/license/page.tsx`、`award/page.tsx`、`settings/page.tsx`、`src/app/discussions/[naddr]/moderators/page.tsx`）の該当classへ既存`inline`を追加する。既にinlineの`Card`、`CarouselCard`、`/discussions`は変更しない。新規CSS・カード構造変更は行わない。

**Checkpoint:** T003/T003R/T004R、T005/T005R/T005RR/T006RR、T007/T008の回帰テストゲートが成立し、T009〜T017のproduction差分も親が再読込・検証済みである。production実装と横断品質ゲートが完了し、文書記録と配送だけが残っている。

## Phase 4: 親検証・記録・配送

- [x] T018 [VERIFY/親-VERIFIED] 各production task後に指定focused suiteを親が再実行し、全production／test／docs pathを再読込する。`git diff --check`、card-title 21箇所、reason残存箇所、500／280残存箇所、storage key境界、query付きreturnToを機械検索・source確認する。production post-review subagentは置かず、親が変更と検証を管理する。
- [x] T019 [VERIFY/親-VERIFIED] Node `v22.23.2`を優先してfocused関連suite、`npx tsc --noEmit --incremental false`、`npm run lint`、全Jestを実行する。collection/setup、fixture、assertion、今回の差分、既存warningを分類する。`npm run build`を一度実行し、Prisma／GTFS／Next buildの終了コードと既存環境表示を分離して記録する。ブラウザ相当probeを試行し、環境制約を記録する。loading、card-title、テーマ、下書き復元はRTL／AST／build結果と実ブラウザ未実測の制約を分離して扱う。
- [x] T020 [DOCS-VERIFIED] `issues/128-minor-fixes/investigation.md`へ実装後の根因確認・RED/GREEN・変更path・検証結果を追記し、`plan.md`は実装方針の記録として保持し、`tasks.md`の各完了taskへ実測証拠を追記する。文書更新後に相対リンク、status、diff checkを確認する。
- [x] T021 [DELIVERY/親-VERIFIED] 実装commit `910426ab6b7c43a68a8f3c63792aab5c9d2042c7`を作成して`origin/fix/issue-128-minor-fixes`へpushした。PR [#129](https://github.com/nawashiro/kazaguruma-transit/pull/129)をbase=`dev`で作成し、GitHubからtitle/body/head/base/filesを読み戻した。`git ls-remote`のremote SHA一致、Quality Gate run `33635483405`のexact SHA success、merge未実施を確認した。

## 依存関係

```text
T001 → T002 → T003 → T004 → T003R → T004R → T005 → T006 → T005R → T006R → T005RR → T006RR → T007 → T008
  → T009 → T010 → T010R → T010RR → T011 → T012 → T013 → T014 → T015 → T016 → T017
  → T018 → T019 → T020 → T021
```

- T003/T003R/T004R、T005/T006、T007/T008は、それぞれtest writer→必要なcorrection→fresh reviewerの順で実行する。
- T004R、T006RR、T008のPASS前にproduction writerを開始しない。
- production taskは同時に同一pathを編集しない。T012〜T014はフォーム境界を分離する。
- T018〜T020は親所有であり、サブエージェントの自己申告だけを完了根拠にしない。

## 受入条件と証拠

| 受入条件 | 証拠task |
|---|---|
| 評価文言、本文の`text-balance`除去、投票ボタン位置、progress ARIA | T003/T004、T011、T018 |
| バス停メモ用語、投稿例、詳細投稿説明 | T003/T004、T014、T018 |
| 認証reason除去と正しいquery付きreturnTo | T005/T006、T010、T012〜T014、T018 |
| 3フォームのsessionStorage下書き保存・復元・成功後削除 | T005/T006、T009、T012〜T014、T018/T019 |
| 会話説明／投稿本文1000文字のvalidation・属性・counter | T007/T008、T009、T012〜T014、T019 |
| 検索結果loading、PC/mobileテーマ右上 | T003/T004、T015、T019 |
| settings説明の70文字短縮 | T003/T004/T007/T008、T016 |
| 全production 21 `.card-title`の`inline` | T003/T004、T017/T018 |
| 既存機能・strict TypeScript・lint・Jest・build | T018/T019 |
| Issue文書・remote branch・exact SHA・CI | T020/T021 |

## 実装戦略

MVPはIssueの利用者影響が大きい評価／投稿／認証復帰／下書き（T009〜T014）とし、各focused GREENを確認する。その後、loading・テーマ・一覧・全card-title（T015〜T017）を統合し、親検証と配送へ進む。既存の設計意図を変える旧fallbackや追加永続化は実装しない。
