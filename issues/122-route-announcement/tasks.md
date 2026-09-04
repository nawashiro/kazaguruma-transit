# Issue #122 ルートページのお知らせ実装タスクリスト

- Issue: [#122](https://github.com/nawashiro/kazaguruma-transit/issues/122)
- Repository: `/opt/data/kazaguruma-transit`
- Base: `dev` / `380ef8ad956b289d5033e286b19fdfd110ff68fd`
- Implementation branch: `fix/issue-122-route-announcement`
- Related documents: `investigation.md`、`spec.md`、`plan.md`
- 作業言語: 日本語

## 実行規約

- `AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0を適用する。実務上の正本は`AGENTS.md`である。
- 実装タスクは1タスクにつき1サブエージェントへ委任する。親は依存関係、受入条件、hard write boundary、RED/GREEN、変更path、最終検証を管理する。
- test writerは指定したtest pathだけを変更し、production、設定、Issue文書、lockfile、commit、push、PRを変更しない。
- test reviewerはread-onlyで全pathを変更しない。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致を必須とする。
- production writerは指定production pathだけを変更し、commit、push、PR、mergeを行わない。
- 親はサブエージェントの自己申告だけで完了扱いにせず、現行bytes、差分、書込境界、focusedコマンドを再確認する。
- `[x]`は親が実測して確認したタスクだけに付ける。未実施・未triggerのCIは成功扱いにしない。
- `infomation` alias、旧受賞表示のfallback、Card共通API変更、新規永続化は追加しない。
- `app-config.json`はignoredな配布先固有設定である。親が既存値を保持したまま`announcement`だけを追加するが、commit対象にしない。

## Phase 1: 基準・調査・設計

- [x] **T001 [BASE-VERIFIED]** `origin/dev`をfetchし、既存作業を上書きせずに`dev`へ切り替え、`git pull --ff-only origin dev`を実行した。`dev`と`origin/dev`が`380ef8ad956b289d5033e286b19fdfd110ff68fd`で一致し、開始時の作業ツリーと`git diff --check`がcleanだった。

- [x] **T002 [INVESTIGATE-VERIFIED]** Issue #122の本文・状態・コメント・timeline、番号・症状による重複PR、現行のHome/AwardRecognition/app-config経路、受賞表示の履歴、既存テストをread-onlyで調査し、`investigation.md`へ記録した。根因を「ルートページが受賞専用componentを固定表示し、お知らせ設定の読み取り経路がない」と確定した。

- [x] **T003 [SPEC-PLAN-VERIFIED]** `AGENTS.md`と憲章Version 4.0.0をconstitution gateとして適用し、`spec.md`へユーザーストーリー・機能要件・非対象・受入条件を、`plan.md`へ構成・変更manifest・TDDゲート・最終検証・リスクを日本語で記録した。Issue本文の`infomation`は標準綴り`information`を使う仕様決定として明記した。

- [x] **T004 [TASKS-VERIFIED]** 本ファイルへ、configとUIのtest writer直後のfresh read-only review、production writer、親検証、docs、配送の順序とhard write boundaryを記録した。

**Checkpoint:** Issueの根因、非対象、受入条件、`information`設定契約、テスト／productionの書込境界、RED→review→GREENの順序が確定している。feature branch作成後も、fresh test reviewerのPASSまではproduction codeを変更しない。

## Phase 2: app-config契約（RED → fresh review → GREEN）

- [x] **T005 [TEST-RED-CONFIG-VERIFIED]** `src/lib/config/__tests__/app-config.test.ts`だけを変更し、`announcement`の設定契約を先に追加する。
  - `validConfig`へ`announcement: { information, url }`を追加する。
  - tracked templateに`announcement`と`information`／`url`が存在することを検証する。
  - parserが有効なannouncementをそのまま返すことを検証する。
  - `announcement`欠落、`information`空文字列、`url`空文字列を既存の日本語設定エラーで拒否するケースを追加する。
  - `information`以外の`infomation`を使わない。
  - production、`app-config.json.example`、ignored `app-config.json`、Issue文書、commit、pushは変更しない。
  - 親の実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/lib/config/__tests__/app-config.test.ts`
  - 期待: production未変更のため、template期待値・有効値の戻り値・欠落／空値拒否の少なくとも一部が意味のあるREDになる。collection/setup typo failureではない。

- [x] **T006 [TEST-REVIEW-CONFIG-PASS]** T005直後に別fresh read-only subagentへ、T005のtest pathと`spec.md`／`plan.md`の受入条件だけを渡してレビューさせる。
  - 開始／終了SHA一致、`modified: false`を確認する。
  - `announcement.information`／`url`を実際に検証し、assertionがvacuousでないことを確認する。
  - 欠落と空文字列の拒否がproduction未変更で意味あるREDになることを確認する。
  - 既存のapp-config契約（appUrl、discussion、support、relay、read strategy）を壊していないことを確認する。
  - 必須結果: `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
  - FAILの場合、親はT005直後へ最小の`[TEST-CORRECTION]`タスクを挿入し、fresh review PASSまでT007へ進まない。

- [x] **T007 [IMPLEMENT-CONFIG-VERIFIED]** T006のfresh review PASS後、1サブエージェントへ次のproduction/config変更だけを委任する。
  - Hard write path: `src/lib/config/app-config.ts`、`app-config.json.example`。
  - `AnnouncementAppConfig`を定義し、`AppConfig.announcement`へ追加する。
  - `parseAppConfig`でannouncementをrecordとして取得し、`information`と`url`を非空文字列で検証して返す。
  - exampleへ既存受賞告知を初期値とした`announcement`を追加する。announcement内は`information`と`url`だけにする。
  - 旧設定のfallback、`infomation` alias、URL形式の過剰な独自検証は追加しない。
  - UI、テスト、Issue文書、`Card`、受賞ページ、lockfile、commit、pushは変更しない。
  - 親の実行前に、writerの変更pathとdiffを再確認する。
  - 親はwriter完了後、既存のignored `app-config.json`の全値を保持したままannouncementだけを追加する。追加後にconfig focused GREENを実行する。
  - 実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/lib/config/__tests__/app-config.test.ts`
  - 期待: T005の全テストがGREEN、production/configの許可path以外に差分なし。

**Checkpoint:** parserとtracked exampleのannouncement契約がtest-firstでRED→review PASS→GREENになり、ローカルignored configも既存配布値を保ったまま新しい必須項目を持つ。

## Phase 3: ルートページUI契約（RED → fresh review → GREEN）

- [x] **T008 [TEST-RED-UI-VERIFIED]** `src/app/__tests__/page.test.tsx`だけを変更し、Home経由の新表示契約を先に追加する。
  - `h2`「運営からのお知らせ」を検証する。
  - 見出しを含むsectionが`aria-labelledby`で見出しIDを参照することを検証する。
  - 見出し内のLucide Info SVGが`aria-hidden="true"`であることを検証する。
  - exampleの`information`がlinkのaccessible name／表示テキストになり、`url`が`href`になることを検証する。
  - 旧受賞バッジ画像と`受賞について詳しく見る`リンクがHomeに表示されないことを検証する。
  - 既存の目的地・出発地・日時・検索URL・リセット・fetch非実行テストは維持する。
  - production、config、旧Awardテスト、Issue文書、commit、pushは変更しない。
  - 親の実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/page.test.tsx`
  - 期待: `Announcement`未実装・Home未置換の現行productionで新規assertionが意味あるREDになる。config parserのcollection/setup failureではない。

- [x] **T009 [TEST-REVIEW-UI-FAILED]** T008直後に別fresh read-only subagentへレビューを委任した。開始／終了SHAは`380ef8ad956b289d5033e286b19fdfd110ff68fd`で一致し、`modified: false`だった。focused Jestは`1 suite / 11 tests`中`6 failed / 5 passed`で、旧productionに対する意味あるREDだった。
  - reviewerはh2、sectionの`aria-labelledby`、お知らせlink、旧画像・旧link、既存Home契約を確認した。
  - `VERDICT: FAIL`。`querySelector("svg")`が任意のSVGを受け入れ、Infoであることを識別しない。
  - 固定の受賞名・賞名撤去、およびカードの位置・カードクラスを検証していない。linkもannouncement sectionへscopeされていない。
  - collection/setup/fixture/runtime/`act` warningはなく、TypeScript、対象lint、`git diff --check`は成功した。
  - T010へ進まず、次のtest correctionとfresh reviewを追加する。

- [x] **T008R [TEST-CORRECTION-RED-VERIFIED]** T009のFAIL指摘を反映し、`src/app/__tests__/page.test.tsx`だけを変更する。
  - Info判定を任意の`svg`から特定のLucide Info要素へ狭める。production側で安定した識別子を付ける場合は、その識別子をassertし、別SVG・空SVGではGREENにならない契約にする。
  - 旧productionの固定受賞名・賞名がHomeに残っていないことを検証する。ただしannouncement設定で同じ文言を表示する形に依存しないよう、Homeテストでは中立なmock announcementを用いる。
  - お知らせsectionが`card`、`card-border`、`w-full`、`bg-base-100`、`shadow-sm`を持ち、PageHeaderの直後にあることを検証する。
  - announcement linkをお知らせsection内へscopeし、設定されたinformationの表示テキストとurlの`href`を検証する。
  - h2、ARIA、既存Homeテスト、旧バッジ・旧詳細linkの不在は保持する。
  - production、config、他テスト、Issue docs、commit、pushは禁止。
  - 親の実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/page.test.tsx`
  - 期待: 旧productionで追加assertionを含む意味あるRED。collection/setup typoではないこと。

- [x] **T009R [TEST-REVIEW-UI-PASS-VERIFIED]** T008R直後に、別fresh read-only subagentへ同じtest pathと`spec.md`／`plan.md`を渡す。
  - 開始／終了SHA一致、`modified: false`を確認する。
  - Infoを特定でき、任意SVG・空SVGで通過しないことを確認する。
  - 固定受賞名・賞名、カード構造・位置、section内link、h2／ARIA、旧表示撤去、既存Home契約が検証されていることを確認する。
  - T008Rが旧productionでmeaningful REDとなり、collection/setup/fixture failureではないことを確認する。
  - 必須結果: `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
  - FAILの場合、親はT008R直後へ最小correction taskと再レビューtaskを挿入し、T010へ進まない。

- [x] **T010 [IMPLEMENT-UI-VERIFIED]** T009Rのfresh review PASS後、1サブエージェントへ次のUI変更だけを委任する。
  - Hard write path: `src/components/features/Announcement.tsx`、`src/app/page.tsx`、`src/components/features/AwardRecognition.tsx`（削除）、`src/components/features/__tests__/AwardRecognition.test.tsx`（削除）。
  - `Announcement`は`appConfig.announcement`を静的に読み、既存Ko-fi相当の`card card-border w-full bg-base-100 shadow-sm`構造を使う。
  - `section`と`h2`を`aria-labelledby`で関連付け、`h2`にLucide `Info`を装飾用`aria-hidden`で置く。
  - 見出しテキストとlinkだけを適切な`ruby-text`境界へ置く。Info SVGをRubyfulの書換え対象にしない。
  - `information`を`a`要素の表示テキスト、`url`を`href`として描画する。
  - `Home`の既存AwardRecognition import／renderをAnnouncementへ置き換え、配置と既存検索動作を維持する。
  - ルート専用で不要になったAwardRecognition componentと専用テストを削除する。
  - `/award`、`award-data`、受賞ページ用設定、共通Card、CSS、Nostr、DB、GTFS、認証は変更しない。
  - 親の実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/page.test.tsx src/lib/config/__tests__/app-config.test.ts src/app/award/__tests__/page.test.tsx`
  - 期待: Homeの新規／既存テスト、config、award pageがGREENで、許可path以外に差分なし。

**Checkpoint:** 新規UIテストが旧productionでRED、fresh review PASS後の実装でGREENになり、旧受賞カードだけがルートから消えて受賞ページは維持されている。

- [x] **T010C [TEST-CORRECTION-CARD-TITLE-VERIFIED]** T012の全Jestで、今回追加した`Announcement`の`h2.card-title.inline`により既存のproduction `card-title`件数が21から22になり、`src/app/__tests__/card-title-style-contract.test.ts`が固定件数の期待値で失敗した。このtest pathだけを変更し、productionの実在件数22とテスト説明を同期する。
  - `toHaveLength(21)`の2箇所と、21箇所を記述するテスト名を22へ更新する。
  - 既存の全production `card-title`収集、`inline`違反検出、他のassertionは変更しない。
  - `Announcement`側の`card-title`が`inline`を持つことを検証対象から除外しない。
  - production、Announcement、他のテスト、config、Issue docs、commit、pushは禁止。
  - 実行: `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand --runTestsByPath src/app/__tests__/card-title-style-contract.test.ts`
  - 期待: 現行productionの実数に合わせることで、契約テストがGREENになる。変更前の失敗は今回の新規card-title使用に対する意味ある契約不整合である。

- [x] **T010CR [TEST-REVIEW-CARD-TITLE-PASS-VERIFIED]** T010C直後に別fresh read-only subagentへ、test pathと`Announcement`のcard-title実装だけを渡してレビューさせる。
  - 開始／終了SHA一致、`modified: false`を確認する。
  - 22件への更新が今回の実在するproduction usageだけを反映し、検査範囲やinline判定を弱めていないことを確認する。
  - 必須結果: `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
  - FAILの場合、親はT010C直後へ最小correction taskと再レビューtaskを挿入し、T011へ進まない。

## Phase 4: 親検証・感度確認・記録

- [x] **T011 [PARENT-VERIFY-VERIFIED]** 親が現行bytesを再読込し、manifestと実装を検証する。
  - `git diff --name-status`で許可path以外の変更がないことを確認する。
  - production sourceに`AwardRecognition`参照、`infomation`、旧ルート受賞カードの固定renderがないことを検索する。
  - `src/app/award/page.tsx`、`src/lib/award/award-data.ts`に差分がないことを確認する。
  - `Announcement`のsection／h2／Info／linkのDOM契約をfocused Jestで再確認する。
  - 修正済みproduction差分だけを一時的に旧AwardRecognition import／renderへ戻す隔離確認を行い、新規UIテストが失敗することを確認する。確認後、必ず修正状態へ戻し、focused GREENを再実行する。
  - 感度確認用の旧状態を共有worktreeへ残さない。ignored `app-config.json`の配布値も保持する。

- [x] **T012 [FULL-QUALITY-GATES-VERIFIED]** 親がNode.js `v22.23.2`で次を実行し、終了コードと差分由来／既存環境由来の警告を分けて記録する。`npm run build`はこのタスクで一度だけ実行する。
  - `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npx tsc --noEmit --incremental false`
  - `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run lint`
  - `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm test -- --runInBand`
  - `PATH=/opt/data/toolchains/node-v22.23.2/bin:$PATH npm run build`
  - `git diff --check`
  - `git status --short --branch`
  - 既存の`next lint` deprecated表示、Jest既存warning、`transit-config.json`不足によるGTFS表示は、Issue #122差分の失敗と混同しない。

- [x] **T013 [DOCS-VERIFIED]** `investigation.md`へ実装後の根因確認・RED・review・GREEN・感度確認・品質ゲートを追記する。`plan.md`の実装後検証結果と本tasksの実測結果・受入条件対応を追記する。未実施の検証は成功扱いにしない。

## Phase 5: 配送

- [x] **T014 [DELIVERY-VERIFIED]** 親が変更を確認してcommitし、feature branchをpushした。
  - commit `b7233e2599fd856e0c048485806c0fa2effecda2`: `fix: Issue #122のルート告知をお知らせ設定へ移行`。
  - `fix/issue-122-route-announcement`をGitHubとTangledへpushし、remote branch SHAがcommitと一致することを確認した。
  - GitHub PR [#135](https://github.com/nawashiro/kazaguruma-transit/pull/135)をbase=`dev`で作成した。GitHubからtitle、body、head、base、head SHA、変更13ファイルを読み戻した。
  - Quality Gate run `33861246469` / job `100985951169`はhead SHAに対して`success`だった。Node.js 20 action deprecated annotationは既存workflowの警告として記録した。
  - PRはOPENのまま維持し、merge、Issueのclose、外部サービスへの追加送信は行っていない。
  - 配送記録追補commit `e3598fdb7bc619b97b61ecb683b4b4a927e13dac`をpushし、追補後headに対するQuality Gate run `33862080856` / job `100988583033`も`success`であることを確認した。

## スタイル追補の実測結果

- ユーザー画像を受け、現行DOMをPuppeteer/Chromium（viewport 1100x800）で確認した。修正前は`h2.card-title.inline.gap-0`が`display:block`、Info SVGが`display:block`、見出しspanが別行で、h2高さは70pxだった。Rubyfulはh2全体を処理していなかった。
- T015は既存`page.test.tsx`への`inline-block` class assertion 1件だけを追加した。focused Home testは修正前13/13 passed、追加後1 suite / 12 passed・1 failedの意味あるREDだった。
- T016のfresh read-only reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。過剰なDOM・computed style・Rubyfulテストを追加していないことを確認した。
- T017は`Announcement.tsx`のInfo icon classへ`inline-block`を1つ追加しただけである。親のfocused Home testは1 suite / 13 tests passed。
- 修正後のPuppeteer実測はInfo SVGが`display:inline-block`、見出しspanと同一Y座標、h2高さ46px。修正後スクリーンショットでもアイコンと「運営からのお知らせ」の横並びを目視確認した。
- style追補後の全Jestは2 skipped / 145 passed suites、13 skipped / 915 passed tests。strict TypeScriptとlintはexit 0、buildはexit 0でNext.js 27ページを生成した。既存warning、`next lint`非推奨表示、`transit-config.json`不足表示は差分由来ではない。
- style追補のtracked変更は`src/app/__tests__/page.test.tsx`の1 assertionと`src/components/features/Announcement.tsx`の1 classに限定され、他の既存契約は変更していない。

## 依存関係

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T008R → T009R → T010 → T010C → T010CR → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018
```

- T005のtest writer直後は必ずT006のfresh reviewである。
- T006がPASSするまでT007のproduction変更を開始しない。
- T008のtest writer直後はT009のfresh reviewである。T009がFAILしたため、T008Rの最小補正とT009Rの再レビューを実施する。
- T009RがPASSするまでT010のproduction変更を開始しない。
- T010で追加した`card-title`が既存の有限usage契約に検出されたため、T010Cのtest correctionとT010CRのfresh reviewを行う。
- T010CRがPASSするまでT011の親検証へ進まない。
- test reviewerのFAIL時は、対応するtest taskの直後の修正・再レビューを完了するまで進めない。
- T011〜T014は親が担当し、サブエージェントの自己申告だけで完了扱いにしない。

## 受入条件と証拠task

| 受入条件 | 証拠task |
|---|---|
| exampleとparserに`announcement.information`／`url`がある | T005、T007、T011 |
| 欠落・空文字列が日本語エラーになる | T005、T007 |
| Info付き`h2`「運営からのお知らせ」とnamed sectionがある | T008、T009、T010、T011 |
| `information`がlink本文、`url`がhrefになる | T008、T009、T010 |
| ルートから旧受賞カードが消える | T008、T010、T011 |
| `/award`と既存Home検索機能が維持される | T010、T011、T012 |
| 新規永続化・外部送信・Nostr／DB変更がない | T010、T011 |
| TDD RED→review PASS→GREEN、全品質ゲートが実測済み | T005〜T012 |
| Issue文書、remote SHA、PR/CI状態が現実と一致する | T013、T014 |

## 実測結果

- T005 RED: config test 1 suite / 9 tests中5 failed・4 passed。T006 review: `VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
- T007 GREEN: ignored `app-config.json`へ既存値を保持してannouncementだけを追加後、config test 1 suite / 9 tests passed。
- T008 RED: Home test 1 suite / 11 tests中6 failed・5 passed。T009 reviewはFAIL（任意SVG、固定受賞文言、カード構造・位置、section内linkの不足）。
- T008R RED: 中立mock、`svg.lucide-info`、旧受賞名・賞名、カードクラス・位置、section内linkを追加し、1 suite / 13 tests中8 failed・5 passed。T009R reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
- T010 GREEN: Home、app-config、award pageの3 suites / 25 tests passed。`AwardRecognition`と専用テストを削除し、受賞route/dataは維持した。
- T010C/T010CR: 新規`Announcement`の`card-title`追加で既存契約が21→22へ更新必要となった。件数とテスト名だけを変更し、focused 1 suite / 1 test passed、reviewは`VERDICT: PASS`、`modified: false`、開始／終了SHA一致。
- T011: source/path/静的設定監査はPASS。旧UIへ一時復元した感度確認は13 tests中8 failed・5 passed、修正状態のハッシュ復元と`git diff --check`はPASS。
- T012: strict TypeScript exit 0、lint exit 0、全Jest再実行は2 skipped / 145 passed suites・13 skipped / 915 passed tests、build exit 0（Next.js 27ページ生成）。初回全Jestの一時失敗はcard-title件数契約とDiscussion suiteの非再現失敗として再実行・単独実行で切り分けた。既存warningと`transit-config.json`不足表示は差分由来ではない。
- 配送前の変更は計画済みsource、test、設定例、Issue文書だけで、ignored `app-config.json`は既存配布値を保持してannouncementだけを追加している。

## Phase 6: スタイル回帰の最小追補

ユーザーの実機画像とPuppeteer実測で、`Announcement`のInfo SVGがTailwind preflightにより`display: block`となり、同じ`h2`内の見出しspanを次行へ送っていることを確認した。Rubyfulの見出し全体処理は根因ではない。

- [x] **T015 [TEST-RED-STYLE-VERIFIED]** 既存の`src/app/__tests__/page.test.tsx`のInfoアイコンテストへ、`svg.lucide-info`が`inline-block`を持つclass契約を1 assertionだけ追加する。新規suite、別component、computed styleのmock、他のDOM契約は追加しない。Node.js v22.23.2でfocused Home testを実行し、現行productionのclass不足による1件の意味あるREDを確認する。production、Issue docs、他testは変更しない。

- [x] **T016 [TEST-REVIEW-STYLE-PASS-VERIFIED]** T015直後にfresh read-only reviewerへtest pathだけを渡し、class assertionが画像で確認されたレイアウト欠落だけを表し、既存の見出し・ARIA・link・検索契約を過剰に拡張していないことを確認する。`VERDICT: PASS`、`modified: false`、開始／終了SHA一致を必須とする。

- [x] **T017 [IMPLEMENT-STYLE-VERIFIED]** T016のPASS後、`src/components/features/Announcement.tsx`のInfo iconへ`inline-block`を追加する。h2のDOM構造、見出し文言、`ruby-text`、link、カードclass、他のproductionは変更しない。focused Home testをGREENにする。

- [x] **T018 [VERIFY-STYLE-VERIFIED]** 親がPuppeteerでInfoと見出しspanが同一行になることを再測定し、focused/full Jest、strict TypeScript、lint、build、`git diff --check`、PR/CIを実行・確認する。既存の警告は差分由来のerrorと分離する。
