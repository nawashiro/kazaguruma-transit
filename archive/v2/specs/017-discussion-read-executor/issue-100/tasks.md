# Issue #100 新規コメント対応タスクリスト

## 対象

- 関連仕様: `specs/017-discussion-read-executor/`
- issue文書: `specs/017-discussion-read-executor/issue-100/`
- canonicalな詳細モデレーターroute: `/discussions/[naddr]/moderators`
- Issueコメントの単数形 `/discussions/[naddr]/moderator` は、production sourceに存在しない表記として扱う。alias/redirectは本タスクの対象外。
- 本タスクリストは、既存Issue #100対応後に追加されたコメントへの追補である。Work Unit 0〜5の完了記録は既存対応の履歴として残し、Work Unit 6以降を今回の未実装範囲とする。

## Constitution Check

- [x] `AGENTS.md` と `.specify/memory/constitution.md` を確認した。
- [x] 新規`spec.md`を作成せず、関連仕様配下の`issue-100/`に設計とタスクを置く。
- [x] TypeScript strict、UI/data/service分離、明確な命名、単純なロジックを維持する。
- [x] 挙動変更はテストを先にREDにし、freshなtest review後に本番コードを変更する。
- [x] `tasks.md`では各test chapterの直後にfresh read-only test review gateを置く。
- [x] 憲章v2.0.0に従い、本番実装後の必須subagent review taskは置かない。
- [x] UIの状態通知は既存の日本語、`role="status"`、`aria-live="polite"`、44px以上の操作領域を維持する。
- [x] executor、relay選択、retry、completion、provenance、cache形式、永続化は変更しない。

## 調査・設計完了記録

- [x] Issue #100本文と追加コメントを確認した。
- [x] `origin/dev`、作業branch、HEAD、作業treeを確認した。
- [x] 実在routeが`/discussions/[naddr]/moderators`であり、単数形routeが存在しないことを確認した。
- [x] `/discussions/moderator`が`DiscussionManagementShell`経由でmanagement content readを開始する一方、detail moderatorsがcontent readを開始しないことを確認した。
- [x] 問題の核心を、Nostr transportではなくpathname whitelistによる共有read lifecycleの分岐と特定した。
- [x] KISS再設計として、layoutから明示する`DiscussionDataScope`へcore read判定を集約する方針を`design.md`へ記録した。
- [x] 現行focused baselineを実行した: 4 suites / 43 tests passed。

## 実装タスク: Work Unit 6 — detail scopeのRED

### 6A. Test implementation

- [x] T001 `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx` のdetail moderatorsケースを、旧「content readを開始しない」契約から「共有content readを開始する」契約へ変更する。
- [x] T002 `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx` で、canonical route `/discussions/naddr-test/moderators`をdetail fixtureとして使用し、metadata readと`loadDiscussionModerationSnapshot`が各1回開始することを検証する。
- [x] T003 `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx` のdetail editケースも、同じdetail scopeの共有content lifecycleに参加する契約へ更新する。画面固有のmoderator-request readの検証はこの変更に混ぜない。
- [x] T004 `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx` に、`/discussions/naddr-test` → `/discussions/naddr-test/moderators` → `/discussions/naddr-test` のrerender fixtureを追加する。EOSEで完了した共有content readがtab遷移後に再実行されず、postsが保持されることを検証する。
- [x] T005 `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx` の既存content status契約を、取得済みposts・非EOSE・reload buttonのpublic boundaryとして維持し、route lifecycleの責務をProviderテストへ限定する。
- [x] T006 Work Unit 6Aのfocused REDを実行する。旧pathname whitelistが残る現行productionでは、detail moderatorsの共有content read契約が失敗することを確認する。collection/setup failureを意図したREDとして扱わない。

### 6B. Test implementation fresh review gate

- [x] T007 Work Unit 6Aのテスト変更だけをfresh read-only reviewerへ渡す。Issueコメント、canonical route、scope設計、共有read一回、tab遷移後のposts保持、EOSE/非EOSE境界をレビュー対象に明記する。
- [x] T008 reviewerに`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、focused REDのexit codeと失敗理由を要求する。対象テストのSHAを親で再計算し、reviewerが書き込んでいないことを確認する。FAILまたはbyte変更時はT001〜T006を修正してfresh reviewをやり直す。

## 実装タスク: Work Unit 7 — scope境界のproduction GREEN

- [x] T009 `src/components/discussion/DiscussionDataProvider.tsx` に`DiscussionDataScope = "management" | "detail"`とProvider propを追加する。既存テストの移行負担を抑えるため、内部defaultはdetailとし、production layoutは明示的にscopeを渡す。
- [x] T010 `src/components/discussion/DiscussionManagementShell.tsx` から`DiscussionDataProvider`へ`scope="management"`を渡し、global management routeのread targetが変わらないことを保つ。
- [x] T011 `src/app/discussions/[naddr]/layout.tsx` から`DiscussionDataProvider`へ`scope="detail"`を渡し、detail child route全体で同じscopeを使う。
- [x] T012 `src/components/discussion/DiscussionDataProvider.tsx` の`managementScope`、target naddr、content read判定をscopeから導出する。pathnameの`CONTENT_PATHS`と`shouldLoadDetailContent()`によるcore content read whitelistを削除する。
- [x] T013 `src/components/discussion/DiscussionDataProvider.tsx` のload effect依存関係から、detail tabのpathname変更だけで共有content readを再計算する経路を除去する。scope、discussion identity、generation guardをread lifecycleの境界として保つ。
- [x] T014 T001〜T006のfocused testをsettled production bytesでGREENにする。detail moderators/editの共有content readが各layout lifecycleで一度だけ開始され、main→moderators→mainで重複しないことを確認する。

## 実装タスク: Work Unit 8 — 画面固有readとの境界回帰

### 8A. Test implementation

- [x] T015 `src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx` で、モデレーター申請のfilter・completion・generation guardが引き続き画面固有readとして動作することを確認する。共有contentのpostsを申請stateへ流用するテストは追加しない。
- [x] T016 `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx` で、detail scopeの共有content completionが非EOSEの場合、postsを消さずに`completionReason`とProviderのreload境界を保持することを検証する。
- [x] T017 Work Unit 8Aのfocused REDを実行し、production変更前の不足を確認する。Work Unit 6のreview済みテストを変更した場合は、該当test reviewを無効としてT007〜T008をやり直す。

### 8B. Test implementation fresh review gate

- [x] T018 Work Unit 8Aのテスト変更だけをfresh read-only reviewerへ渡し、画面固有moderator-request readと共有content readの責務混同がないことを確認する。
- [x] T019 `SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、test count、focused exit code、対象SHAを確認する。テストbyteが変わった場合はT015〜T017を再実行してfresh reviewを取得する。

## 実装タスク: Work Unit 9 — 受入検証

- [x] T020 Work Unit 6〜8のfocused testsを、`--runTestsByPath`でsettled bytesに対して再実行する。
- [x] T021 `npx tsc --noEmit --incremental false`を実行し、TypeScript strictの成功を確認する。
- [x] T022 `npm run lint`を実行し、non-zero failureをwarningと混同せず分類する。
- [x] T023 `npm test -- --runInBand`を実行し、full Jestの実数を記録する。
- [x] T024 `npm run build`を実行し、Next.js production buildの成功を確認する。
- [x] T025 `git diff --check`、untrackedを含むstatus、変更パス、対象テスト・productionファイルの差分を確認する。今回の実装でNostr executor、relay選択、単数形alias、DB/Prismaが変更されていないことを検索で確認する。
- [x] T026 `design.md`、本タスクリスト、実装・検証結果の用語（canonical route、scope、shared content、画面固有read）が矛盾していないことを確認する。失敗は原因を分類し、該当Work Unitだけを再開する。

## 依存関係と実装順

```text
Work Unit 6A (T001-T006)
  -> Work Unit 6B (T007-T008)
  -> Work Unit 7 (T009-T014)
  -> Work Unit 8A (T015-T017)
  -> Work Unit 8B (T018-T019)
  -> Work Unit 9 (T020-T026)
```

- T001〜T006はテストだけを変更する。production変更は禁止する。
- T007〜T008のfresh reviewがPASSになるまで、T009以降のproduction変更を開始しない。
- T009〜T014のproduction manifestは`DiscussionDataProvider.tsx`、`DiscussionManagementShell.tsx`、`src/app/discussions/[naddr]/layout.tsx`に限定する。
- Work Unit 8のtest変更は、Work Unit 6のreview済みbyteを変更するため、別のfresh reviewを必要とする。
- 実装者は既存の`DiscussionReadExecutor`、`DiscussionReadPlan`、`discussion-moderation-snapshot`、Nostr transportを変更しない。

## 実装後の受入条件

- [x] detail moderatorsの直接アクセスとmainからのtab遷移で共有content readが同じscope契約を使う。
- [x] main→moderators→mainで、EOSE済みreadの重複実行と誤った再読み込みstatusが発生しない。
- [x] 非EOSEでは取得済みposts、status通知、reload callbackが保持される。
- [x] global moderator routeの既存の一覧表示、参照先batch read、画面固有申請readが変わらない。
- [x] `DiscussionReadStatus`、executor、transport、relay provenance、cache、DB/Prismaに不要な変更がない。
- [x] 全focused/full検証が成功する。

## 検証記録

- focused tests: 4 suites / 45 tests passed
- detail provider tests: 1 suite / 22 tests passed
- strict TypeScript: `npx tsc --noEmit --incremental false` exit 0
- lint: `npm run lint` exit 0。既存warningと`next lint` deprecation noticeのみ
- full Jest: 130 passed, 2 skipped / 801 passed, 17 skipped
- build retry: `NODE_OPTIONS=--max-old-space-size=1536 NEXT_TELEMETRY_DISABLED=1 npm run build` exit 0
- build note: `transit-config.json`が環境にないためGTFS importは設定読み込みエラーを出したが、既存scriptは処理を継続し、Next.js production buildは成功した
- initial build attempt: 通常の`npm run build`はNext.js build中にexit 137（SIGKILL/OOM疑い）で終了したため、メモリ上限を指定して再実行した
- whitespace/status: `git diff --check` exit 0。変更は本issueの設計・tasksと、Provider/shell/detail layout/testの6 pathsのみ

## 配達

実装・検証は完了した。commit、push、PR更新は次の配達手順で実施する。
