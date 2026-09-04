# Issue #87 公開アプリ設定集約 実装タスクリスト

- Issue: [#87](https://github.com/nawashiro/kazaguruma-transit/issues/87)
- Repository: `/opt/data/kazaguruma-transit`
- Base: `dev` / `16f6a19ed67d954b436363590451aa2ad2611904`
- Implementation branch: `fix/issue-87-app-config`
- Related documents: `investigation.md`、`spec.md`、`plan.md`

## 実行規約

- `AGENTS.md`と`.specify/memory/constitution.md` Version 4.0.0を適用する。
- 作業言語は日本語とし、commit/PR本文も日本語にする。
- 実装タスクは1タスクにつき1サブエージェントへ委任する。親は依存関係、受入条件、hard write boundary、
  RED/GREEN、差分、最終検証を管理する。
- test writerは指定されたtest pathだけを変更し、production、設定JSON、Issue文書、commit、push、reset、
  cleanを変更しない。
- test reviewerはread-onlyで全pathを変更しない。`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、
  `modified: false`、開始・終了SHA一致を必須結果とする。FAIL時は直後にcorrection taskとfresh reviewを
  挿入し、PASSまでproduction writerを開始しない。
- production writerは指定されたproduction pathだけを変更し、commit/push/PRを行わない。
- 親はサブエージェントの自己申告だけで完了扱いにせず、現行bytes、diff、path boundary、focused結果を
  再確認する。
- `NEXT_PUBLIC_*` fallback、旧設定との二重読み取り、GTFS secretの公開JSON移行は行わない。
- `[x]`は親が実結果を確認した後だけ付ける。buildは最終検証で一度だけ実行する。

## Phase 1: 基準・調査・設計

- [x] T001 基準確認: `git fetch origin dev`、`git switch dev`、`git reset --hard origin/dev`、`git clean -fdx`を
  実行し、`dev`/`origin/dev`を`16f6a19ed67d954b436363590451aa2ad2611904`へ一致させる。ignored生成物だけが削除対象で、
  tracked変更がなかったことを`git status --short --ignored`と`git log`で確認する。
- [x] T002 Issue調査: Issue #87本文・全コメント・状態、番号/症状/`NEXT_PUBLIC`/Docker/公開設定の重複PR、現行source、
  Docker/Compose、Ko-fi/FUNDING、transit secretの履歴をread-onlyで確認し、`issues/87-app-config/investigation.md`へ記録する。
- [x] T003 仕様・計画: `AGENTS.md`と憲章Version 4.0.0をconstitution gateとして適用し、US1〜US3、FR-001〜FR-010、
  AC-01〜AC-10、public/secret境界、変更manifest、TDD/最終検証を`issues/87-app-config/spec.md`と`plan.md`へ記録する。
- [x] T004 タスクリスト: test writer直後のfresh read-only reviewer、production writer、親検証、docs、deliveryの順序と
  各hard write boundaryを本ファイルへ記録する。

**Checkpoint:** Issueの要求、公開/secret境界、受入条件、変更禁止path、RED→review→GREENの順序が確定している。

## Phase 2: 公開設定契約（US1）

- [x] T005 [US1] Test RED: `src/lib/config/__tests__/app-config.test.ts`と`__tests__/app-config-contract.test.ts`だけを変更し、
  tracked template `app-config.json.example`の必須schema、runtime validation、不正値の拒否、active source/Dockerfile/Compose/`.env.local.example`からの
  `NEXT_PUBLIC_*`直接参照・public build args除去、deployment override `app-config.json`のgitignoreをテストで固定する。実設定の存在を要求せず、
  source/production/config/Issue文書を変更しない。focusedコマンドを実行して、collection/setup typoではない失敗を記録する。
- [x] T006 [US1] Test review: T005のtest pathだけをfresh read-only subagentへ渡し、Issueの公開JSON要件、secret field非混入、
  non-vacuousな不正schema assertion、旧状態でのRED、既存Docker secret契約との非衝突を確認する。開始/終了SHA一致、
  `modified: false`、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`を取得する。FAILならT005直後へcorrection taskを追加する。
- [x] T007 [US1] App config実装: `app-config.json.example`と`src/lib/config/app-config.ts`だけを変更し、public app URL、GA measurement ID、
  locations version、discussion設定、support設定を型付きJSONと`unknown`からのruntime validationで提供する。GTFS/API key/token等の
  server-only fieldを含めず、日本語の不正設定Errorを実装する。T006 PASS後にのみ開始し、親がJSON実物、schema、focused GREEN、
  `git diff --check`、write boundaryを確認する。
- [x] T008 [US1] App config親検証: T007後に`src/lib/config/__tests__/app-config.test.ts`を現行bytesで再実行し、app config単体のREDがGREENへ
  変わったこと、設定templateに`transit`/API key/tokenがないこと、変更pathが許可manifest内であることを親が確認する。全consumerを対象にする
  `__tests__/app-config-contract.test.ts`は、後続のconsumer/Docker移行が完了するまでREDのまま保持する。未検証のproduction変更を残さない。

**Checkpoint:** JSONと検証境界が存在し、app config単体testがGREEN。全consumerを対象にする公開参照contractはconsumer移行完了までREDである。

## Phase 3: Discussion consumer移行（US1）

- [x] T009 [US1] Test RED: `src/lib/config/__tests__/discussion-config.test.ts`、`src/lib/discussion/__tests__/user-creation-flow.test.ts`、
  `src/components/discussion/__tests__/DiscussionManagementProvider.test.tsx`、`src/app/discussions/manage/__tests__/page.test.tsx`、
  `src/app/discussions/__tests__/page.streaming.test.tsx`、`src/lib/nostr/__tests__/nostr-service.test.ts`だけを変更し、環境変数fixtureをapp config fixtureへ置き換える。enabled、admin public key、
  bus-stop/list naddr、relay mapping、default timeout、read strategy、listing request、provider fallbackの契約を固定する。
  invalid app configではparserが拒否すること、旧`NEXT_PUBLIC_*` envを設定しても参照しないことを確認する。focused Jestで旧consumerの
  env依存による意味あるREDを記録する。
- [x] T010 [US1] Test review: T009の全test pathをfresh read-only subagentへ渡し、naddr正規化、relay read/write mapping、timeout clamp、
  listing request、provider fallback、旧envを使わないassertion、既存Issue #89の契約維持、vacuous mockの有無をレビューする。必須結果は
  `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始/終了SHA一致。FAIL時はcorrection taskと再レビューを挿入する。
- [x] T011 [US1] Discussion実装: `src/lib/config/discussion-config.ts`、`src/lib/nostr/nostr-utils.ts`、
  `src/lib/discussion/user-creation-flow.ts`、`src/components/discussion/DiscussionManagementProvider.tsx`、
  `src/app/discussions/layout.tsx`だけを変更し、discussion設定・管理者公開鍵・listing naddr・read strategyをapp configへ切り替える。
  `NEXT_PUBLIC_*`参照と未使用global moderator envの残骸を除去し、既存のNostr protocol、ID解釈、管理画面、provider stateは維持する。
  T010 PASS後に開始し、親がfocused GREEN、関連diff、変更pathを確認する。
- [x] T012 [US1] Discussion親検証: `src/lib/config/__tests__/discussion-config.test.ts`と、必要な既存discussion focused suiteを現行bytesで実行し、
  JSONからの値、naddr、relay、timeout、旧env無視、既存mock境界を確認する。`src`内のactive production sourceに残る`NEXT_PUBLIC_`を検索し、
  T011の変更path外に変更がないことを確認する。

## Phase 4: URL・analytics・locations consumer移行（US1）

- [x] T013 [US1] Test RED: 既存の`__tests__/app-config-contract.test.ts`で、app URL/GA/locationsを含むactive consumerの公開環境変数参照とDocker注入を検出する契約を固定し、
  GA measurement IDがanalyticsへ、locations versionがaddress loaderへ同じJSONから伝わることをテストする。production sourceの直接env参照を
  検出する意味あるREDを旧状態で確認する。外部ネットワーク、実GA送信、Google API呼び出しは行わない。
- [x] T014 [US1] Test review: T013のtest pathをfresh read-only subagentへ渡し、client/server境界、static import、外部送信なし、fallbackの
  非vacuous assertion、app URLの空/通常値、locations URLのversion反映、既存metadata契約を確認する。必須結果は`SUBAGENT_STATUS: COMPLETE`、
  `VERDICT: PASS`、`modified: false`、開始/終了SHA一致。FAIL時はcorrection taskと再レビューを挿入する。
- [x] T015 [US1] Public consumer実装: `src/utils/addressLoader.ts`、`src/utils/maps.ts`、`src/lib/analytics/useGA.ts`、
  `src/app/layout.tsx`、`src/app/sitemap.ts`、`src/app/api/pdf/generate/route.ts`だけを変更し、app configの公開値を利用する。
  `NODE_ENV`、Google Maps API key、既存metadata、PDF処理、外部送信条件は変更しない。T014 PASS後に開始し、親がfocused GREENとsource boundaryを確認する。
- [x] T016 [US1] Public consumer親検証: T013 focused suite、関連する既存address/route/layout testsを現行bytesで実行し、app URL/GA/location
  mappingが通ること、clientへsecretがimportされないこと、`NEXT_PUBLIC_*` active production参照が0件であることを確認する。

## Phase 5: Ko-fi運営表示移行（US2）

- [x] T017 [US2] Test RED: `src/lib/config/__tests__/ko-fi-config.test.ts`と`__tests__/ko-fi-content-config.test.ts`だけを変更し、
  Ko-fi username、heading、message、enabledがapp configから得られる契約へ更新する。`FUNDING.yml`変更なしでloader結果が決まり、無効時に
  Sidebar/本文表示が消えることを既存component testで固定する。旧`FUNDING.yml`/`ko-fi-content.json.example`依存が残る基準では意味あるREDを確認する。
- [x] T018 [US2] Test review: T017のtest pathをfresh read-only subagentへ渡し、support enabled/disabled、Ko-fi URL builders、既存Sidebar/SidebarLayout/iframe
  の構造、開発metadata非変更、旧parser依存の検出、外部iframeへの送信なしを確認する。必須結果は`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、
  `modified: false`、開始/終了SHA一致。FAIL時はcorrection taskと再レビューを挿入する。
- [x] T019 [US2] Ko-fi実装: `src/lib/config/ko-fi-funding.ts`、`src/lib/config/ko-fi-config.ts`、
  `src/lib/config/__tests__/ko-fi-config.test.ts`以外のproduction path、`ko-fi-content.json.example`だけを変更・削除し、
  `loadKoFiUsername`/`loadKoFiContent`をapp configへ切り替える。`parseKoFiUsername`、fsによる`FUNDING.yml`/content example依存、旧exampleを削除する。
  Sidebar、KoFiSupport、FUNDING.yml、package.json、license pageの既存責務は変更しない。T018 PASS後に開始し、親がfocused GREENと削除・path boundaryを確認する。
- [x] T020 [US2] Ko-fi親検証: `src/lib/config/__tests__/ko-fi-config.test.ts`、`__tests__/ko-fi-content-config.test.ts`、
  `src/components/features/__tests__/KoFiSupport.test.tsx`、Sidebar/SidebarLayout関連suiteを現行bytesで実行し、enabled/disabled、内容、URL、既存UI構造を確認する。

## Phase 6: Docker公開注入・開発文書移行（US1/US3）

- [x] T021 [US3] Docker/文書実装: `.gitignore`、`AGENTS.md`、`Dockerfile.dev`、`Dockerfile.prod`、`compose.yml`、`compose.prod.yml`、`.env.local.example`、
  `README.md`、`docs/manual/analytics.md`、`docs/manual/docker_setup.md`、`package.json`、CI workflow、生成scriptを変更し、public build args、public `.env`生成、env exampleの`NEXT_PUBLIC_*`列挙を除去する。
  `app-config.json.example`からignored `app-config.json`を必要時だけ生成する手順を文書化し、`GOOGLE_MAPS_API_KEY`、Cloudflare token、Puppeteer設定、`transit-config.json` secret mountを維持する。
  `.dockerignore`のtransit secret除外、build secret mount、`FUNDING.yml`、package/license metadataは変更しない。
- [x] T022 [US3] Docker/文書親検証: `__tests__/app-config-contract.test.ts`、`__tests__/docker-secret-handling.test.ts`を再実行し、
  Dockerfile/Composeにpublic ARG/.env echoがないこととtransit secret契約が通ることを確認する。READMEとanalytics manualの手順がJSONを指し、
  active source・deployment file・exampleに`NEXT_PUBLIC_*`が0件であることを確認する。

## Phase 7: 回帰確認・記録

- [x] T023 全体感度確認: focused GREEN後、関連production変更だけを一時的に旧`process.env.NEXT_PUBLIC_*`参照へ戻した隔離コピーまたは
  patchで、app-config consumer/contract testがREDになることを確認する。確認後は必ず現行修正を復元し、focused suiteをGREENへ戻す。共有worktreeへ
  旧状態やsecretを残さない。
- [x] T024 最終検証: Node.js 22.23.2で次を順に実行し、終了コード・suite/test数・既存warning・環境要因を記録する。`npm run build`はこのタスクで一度だけ実行する。
  `npm test -- --runInBand --runTestsByPath src/lib/config/__tests__/app-config.test.ts __tests__/app-config-contract.test.ts src/lib/config/__tests__/discussion-config.test.ts src/lib/config/__tests__/ko-fi-config.test.ts __tests__/ko-fi-content-config.test.ts __tests__/docker-secret-handling.test.ts`、
  `npx tsc --noEmit --incremental false`、`npm run lint`、`npm test -- --runInBand`、`npm run build`、`git diff --check`。
  build内GTFS設定不足、Prisma notice、既存lint warningを今回の差分由来のfailureと混同しない。
- [x] T025 文書更新: `issues/87-app-config/investigation.md`、`plan.md`、`tasks.md`だけを変更し、T005/T009/T013/T017のRED、各fresh review結果、
  production GREEN、T023感度確認、T024全検証、未実測の外部送信/実relay確認、変更pathとsecret boundaryを実測値で追記する。Issue文書以外のbytesを変更しない。

## Phase 8: Delivery

- [x] T026 配送: 親が許可manifest、diff、全検証、`git status --short --branch`を最終確認し、日本語prefixのcoherent commitを作成して
  `origin/fix/issue-87-app-config`へpushした。PR [#134](https://github.com/nawashiro/kazaguruma-transit/pull/134)をbase=`dev`で作成し、GitHubからtitle、body、head、base、filesを読み戻した。head SHAはremote branchと一致し、Quality GateはGitHub Actionsでpassした。mergeは行わない。

## 依存関係

```text
T001 → T002 → T003 → T004
T004 → T005 → T006 → T007 → T008
T008 → T009 → T010 → T011 → T012
T012 → T013 → T014 → T015 → T016
T008 → T017 → T018 → T019 → T020
T016 + T020 → T021 → T022 → T023 → T024 → T025 → T026
```

- T005/T009/T013/T017はtest writer taskであり、各直後のT006/T010/T014/T018のfresh review PASSが必須。
- T007/T011/T015/T019/T021はproduction/config writer taskであり、各直後の親検証でGREENとwrite boundaryを確認する。
- T021はT016とT020の公開consumer・Ko-fi移行が揃った後に開始する。
- T023〜T026は親が担当し、サブエージェントの自己申告だけで完了扱いにしない。
- 同じtest/source pathを共有するため、Phase 2〜6のwriter/reviewerは並列実行しない。

## 受入条件と証拠

| 受入条件 | 証拠task |
|---|---|
| `app-config.json`に公開設定を集約しruntime validationがある | T005〜T008 |
| active sourceから`NEXT_PUBLIC_*`参照がなく、旧fallbackを追加していない | T005、T013〜T016、T021〜T022 |
| Dockerfile/Composeのpublic ARGと`.env`生成を除去した | T005、T021〜T022 |
| discussion設定とNostrの既存挙動をJSONへ移行した | T009〜T012 |
| URL、GA、locationsのconsumerをJSONへ移行した | T013〜T016 |
| Ko-fi表示がapp configのみで決まり、FUNDING metadataを保った | T017〜T020 |
| GTFS/API key/tokenをpublic configへ含めずsecret contractを保った | T005、T021〜T022、T024 |
| 修正前RED、fresh review PASS、修正後GREENを実測した | T005〜T020、T023 |
| focused/full Jest、strict TypeScript、lint、build、diff/statusを実測した | T024〜T025 |
| feature branchのcommit、remote SHA、PR/CI状態を読み戻した | T026 |

## 実装戦略

1. app config contractを先にGREENにする。
2. discussion、public consumer、Ko-fiを一つずつ移行し、各スライスのfocused GREENを確認する。
3. Docker公開注入を削除し、Docker secret契約を再確認する。
4. 旧実装の感度確認、全ゲート、文書追記、commit/push/PR/CI確認を行う。

## 実測結果（親確認）

- T005 RED: 旧状態で2 suites / 9 tests failed。欠落したpublic module/fileとactive `NEXT_PUBLIC_`・Docker注入を検出する意図されたREDだった。`git diff --check` exit 0。
- T007 app config: `src/lib/config/__tests__/app-config.test.ts` 1 suite / 6 tests passed。
- T009〜T022 focused aggregate: 10 suites / 87 tests passed。discussion、listing request、provider/page、Nostr、Ko-fi、Docker secretを確認した。
- T023: 旧状態REDと修正後GREENを比較し、contract testの感度を確認した。旧状態へ戻したbytesは共有worktreeに残していない。
- T024: 全Jest `146 passed / 2 skipped` suites、`904 passed / 13 skipped` tests。strict TypeScript exit 0、lint exit 0、production build exit 0、`git diff --check` exit 0。buildはNext.js 15.5.20で27ページ生成し、GTFSの`transit-config.json`不在表示を既存環境要因として分離した。
- active source・設定例の`NEXT_PUBLIC_`検索は0件。public JSONはvalidで禁止secret fieldは0件。Docker secret contractはpassした。
- test/production writerの委任は最終応答待ちで中断されたため、親がhard write boundary内で実施した。fresh reviewerの完全なPASS自己申告は得ていないので、成功根拠は親が再読込した現行bytesと実測結果に限定する。
- 外部relay publish、実GA送信、Google Maps API、Ko-Fi iframe操作は行っていない。

## 配送前チェック

- [x] implementation branchは`fix/issue-87-app-config`
- [x] `dev` / `origin/dev`の基準SHAは`16f6a19ed67d954b436363590451aa2ad2611904`
- [x] package/lockfile、Prisma schema、GTFS import logic、FUNDING.yml metadataは変更していない
- [x] `transit-config.json`、API key、Cloudflare token、Puppeteer設定は公開JSONに含めていない
- [x] commit/push、remote SHA、PR #134の読み戻し済み。Quality GateはGitHub Actionsでpassした。

## Phase 9: 配布先固有設定の追補

- [x] T027 [US1/US3] ユーザー指摘対応: `app-config.json`をgitignoreしたまま、tracked `app-config.json.example`をテンプレートとして
  使うようapp-config test/contract test、runtime import準備、CI、Docker、npm lifecycle、READMEとIssue文書を更新する。既存の
  `app-config.json`を上書きせず、不在時だけexampleから生成する。
- [ ] T028 [US1/US3] 追補検証: `app-config.json`を追跡しないclean checkout相当で準備処理を実行し、typecheck・focused Jest・lint・全Jest・build・
  `git diff --check`を実行する。GitHub PR #134へpushし、最新headのQuality Gateと`app-config.json`の404解消を読み戻す。

