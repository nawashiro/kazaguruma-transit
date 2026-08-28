# Issue #83 タスクリスト

**Issue:** [#83](https://github.com/nawashiro/kazaguruma-transit/issues/83)

**Base:** `dev` / `origin/dev` at `a4007f10631520457f4f30ab6992b4131abbe270`

**Branch:** `fix/issue-83-settings-auth-links`

**Documents:** [`research.md`](./research.md), [`plan.md`](./plan.md)

## 実行ルール

- このファイルは実装契約であり、親エージェントが現行worktree、変更path、SHA、終了コードを再確認した後だけ完了にする。
- test writerは指定されたtest pathだけを変更し、本番コード、他test、文書、設定、commit、push、reset、clean、依存追加を行わない。
- test reviewerは読み取り専用で、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致を明示する。
- testのbyteが変わった場合、そのreviewは失効する。production変更後は親がfocused test、strict TypeScript、lint、diffを実行する。
- production writerは指定production pathだけを変更し、レビュー済みtestを変更しない。
- AGENTS.mdの方針に従い、本番実装後のreview taskは作成せず、親が最終検証を管理する。
- LFS不整合の既存画像は変更しない。

## Phase 1: 事実確認と準備

- [x] T001 Issue本文・全コメント、`AGENTS.md`、`.specify/memory/constitution.md`、既存の認証・settings・moderator・global CSS実装を確認する。
- [x] T002 `git fetch origin dev`、base SHA、branch、clean status、LFS status/fsck、重複PRと関連履歴を確認する。
- [x] T003 baseline対象suiteを実行し、既存GREEN、環境障害（Jest一括SIGBUS、壊れたNext SWC）、LFS障害を記録する。
- [x] T004 `issues/83-settings-auth-links/research.md`と`plan.md`を作成し、憲章gate、受入基準、変更境界、未対応の理由を固定する。

## Phase 2: Slice A — settingsの2認証導線

### RED

- [x] T005 test writerへ、次のtest pathだけを委任する。実測RED: 4 suites、27 tests、20 passed、7 intentional failures、exit 1（テスト追加前のhistorical RED。実装後のcurrent aggregateは4 suites / 28 tests passed）。
  - `src/lib/navigation/__tests__/auth-route.test.ts`（新規）
  - `src/app/settings/__tests__/page.streaming.test.tsx`
  - `src/app/login/__tests__/page.test.tsx`
  - `src/app/signup/__tests__/page.test.tsx`
- [x] T005のREDは、buildSignupRoute、settingsの2つのnative linkとhref、combined CTAの不在、reasonなし、安全なreturnTo、auth route間のreturnTo保持を実際の公開境界で検証する。直接アクセス時の`/signup`・`/login`リンクは既存契約を維持する。

### Test review gate

- [x] T006 T005のsettled test bytesを、T005とは別のfresh read-only test reviewerへ委任する。`VERDICT: PASS`、`modified: false`、SHA一致。
- [x] T006は、空のfixtureや実装詳細だけに依存せず、settingsの実DOM、auth helperの実URL、login/signupの実リンクと既存安全性を検証することを確認する。
- [x] Gate: 明示的な`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、focused REDの期待されたproduction-contract failure、親のSHA/status再確認。

### GREEN

- [x] T007 T006 PASS後、production writerへ次のpathだけを委任する。focused GREEN: 4 suites、28 tests、exit 0。
  - `src/lib/navigation/auth-route.ts`
  - `src/app/settings/page.tsx`
  - `src/components/auth/AuthRoutePage.tsx`
- [x] T007は、共通auth route helper、2つのsettings link、returnTo保持、reasonなしの呼び出しを最小実装する。既存reason表示・safe return validation・認証後のreplaceを削除しない。
- [x] T008 親がSlice Aのfocused GREEN、関連auth/settings suite、strict TypeScript、target lint、`git diff --check`、変更manifestを確認する。Slice A focused GREENとmanifestを確認済み。

## Phase 3: Slice B — 公開モデレーター復帰先

### RED

- [x] T009 test writerへ、次のtest pathだけを委任する。実測RED: 1 suite、1 test、exit 1、期待された重複returnTo。
  - `src/app/discussions/moderator/__tests__/page.test.tsx`（新規）
- [x] T009のREDは、公開`/discussions/moderator`の未認証申請操作を実DOMで実行し、login pathname、`returnTo=/discussions/moderator`、reason/action/payload/draft不在、publish未実行を検証する。個別会話の復帰先契約は変更しないことを既存suiteで確認する。

### Test review gate

- [x] T010 T009のsettled test bytesをfresh read-only test reviewerへ委任する。`VERDICT: PASS`、`modified: false`、SHA一致。
- [x] T010は、公開routeのmanagement provider境界を越えて実コンポーネントの申請操作を検証し、動的routeのfixtureを誤って置き換えていないことを確認する。
- [x] Gate: 明示的な`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、focused RED、親のSHA/status再確認。

### GREEN

- [x] T011 T010 PASS後、production writerへ次のpathだけを委任する。focused GREEN: 1 suite、1 test、exit 0。
  - `src/components/discussion/DiscussionManagementModeratorPage.tsx`
- [x] T011は、公開正規routeを復帰先へ明示し、reasonを渡さず、個別routeの動作やNostr publishを変更しない。
- [x] T012 親がSlice Bのfocused GREEN、個別moderator suite、strict TypeScript、target lint、`git diff --check`、変更manifestを確認する。2 suites、13 tests、exit 0を確認済み。

## Phase 4: Slice C — global文字サイズ・badge・settings余白

### RED

- [x] T013 test writerへ、次のtest pathだけを委任する。実測RED: 3 suites、25 tests、21 passed、4 intentional failures、exit 1（style contract + settingsの新規契約は2 suites / 10 tests、既存font-size complianceは15 tests）。
  - `src/app/__tests__/font-size-compliance.test.ts`
  - `src/app/__tests__/issue-83-style-contract.test.ts`（新規、必要な場合）
  - `src/app/settings/__tests__/page.streaming.test.tsx`
- [x] T013のREDは、global selectorが`code`を含み`span`を含まないこと、production badge利用が`badge-md`を明示すること、settings未認証見出しが`text-lg`でなく内側`py-8`を持たないことを、実ファイルまたは実DOMから検証する。テストコメント・fixtureだけを見てGREENにしない。

- [x] T013R settingsテストの未使用`fireEvent` importだけをtest-onlyで削除し、Slice C focused 2 suites / 10 testsをGREENにした。これによりT014の旧reviewを失効させ、fresh reviewを再実行した。

### Test review gate

- [x] T014 T013のsettled test bytesをfresh read-only test reviewerへ委任する。import cleanup後のfresh reviewも`VERDICT: PASS`、`modified: false`、SHA一致。
- [x] T014は、`span`除外によるbadgeの意図した14pxと、`code`の16pxを混同していないこと、production使用実態に基づく有限manifestであることを確認する。
- [x] Gate: 明示的な`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、focused GREEN、親のSHA/status再確認。

### GREEN

- [x] T015 T014 PASS後、production writerへ次のpathだけを委任する。Slice C focused GREENを確認済み。
  - `src/app/globals.css`
  - `src/app/settings/page.tsx`
  - `src/app/discussions/[naddr]/page.tsx`
  - `src/app/discussions/manage/page.tsx`
  - `src/app/discussions/page.tsx`
  - `src/app/license/page.tsx`
  - `src/components/discussion/ApprovalStatusTabs.tsx`
  - `src/components/discussion/EvaluationComponent.tsx`
  - `src/components/discussion/PostPreview.tsx`
  - `src/components/features/IntegratedRouteDisplay.tsx`
  - `src/components/features/StopTimeDisplay.tsx`
- `src/app/discussions/[naddr]/approve/page.tsx`は既に`badge-md`準拠のためvalidation-onlyであり、write対象にしない。
- [x] T015は、global ruleを`code`へ拡張し`span`を除外し、各badgeへ14pxの`badge-md`を明示し、settingsの`h3.text-lg`と内側`py-8`だけを除く。既存の内容・挙動・アイコン・ページ余白は維持する。
- [x] T016 親がSlice Cのfocused GREEN、font-size/style/settings関連suite、strict TypeScript、target lint、`git diff --check`、変更manifestを確認する。Slice Cは3 suites / 25 tests、Issue関連9-suite combinedは重複除外後66 tests、lint exit 0を確認済み。

## Phase 5: 統合検証

- [x] T017 全in-scope production/test pathのdiffをレビューし、受入基準AC-1〜AC-7、reason経路、個別moderator route、PageHeader、LFS非変更を確認する。実差分がapproved manifestのsubsetで、unexpected pathがないことを確認済み。approve pageはvalidation-onlyで変更なし。
- [x] T018 `npm test -- --runInBand`を実行する。一括SIGBUS、timeout、collection/setup error、既存failureを成功扱いせず、必要ならsuite分割結果とともに記録する。136 suites passed、2 skipped、844 tests passed、13 skipped、exit 0。
- [x] T019 `node node_modules/typescript/lib/tsc.js --noEmit --incremental false`、`npm run lint`、`npm run build`、`git diff --check`を実行する。lint exit 0、`git diff --check` exit 0。strict TypeScriptは未変更の`react-icons/*`宣言不足5件でexit 2、buildはGTFS importの未配置`transit-config.json`と後続の同じ型エラーでexit 1。コンパイル単体の成功とは扱わない。`.env.local`も未配置。
- [x] T020 作業ツリー、staged/untracked path、production/test/docs manifest、LFS status/fsck、SHA、diff statを最終確認し、文書の完了状態を実測結果に合わせる。status 23件（tracked modified 17件、untracked 6件）、staged 0件、`git diff --check` exit 0、LFS既存不整合2件を確認済み。

## Phase 6: Delivery

- [ ] T021 repositoryのGit identityとbranchを確認し、in-scope docs、tests、productionだけを`git add`して日本語の短いprefix commitを作成する。strict TypeScript/buildの既存baseline blockerを明記した上で実施する。
- [ ] T022 feature branchをpushし、local SHAと`origin/fix/issue-83-settings-auth-links` SHAを一致確認する。
- [ ] T023 base=`dev`、head SHA、title/body、変更ファイルを読み返してIssue #83に紐づくPRを作成する。PR作成後、PRの状態・head SHA・checksをGitHubから確認する。
- [ ] T024 CIが未triggerなら成功扱いにせず、実行中・失敗・未実行を正確に報告する。CI失敗時はログを確認し、今回の差分由来かbaseline/環境由来かを分類する。

## 依存関係

```text
T001-T004
  → T005 RED → T006 PASS → T007 GREEN → T008
  → T009 RED → T010 PASS → T011 GREEN → T012
  → T013 RED → T014 PASS → T015 GREEN → T016
  → T017 → T018/T019 → T020 → T021 → T022 → T023 → T024
```

## 受入基準チェック

- [x] AC-1 settingsに「ログイン」「アカウント作成」の2リンクがある。
- [x] AC-2 各リンクが`/settings`へ安全に復帰し、reason/action-like stateを渡さない。
- [x] AC-3 auth route切替でsafe `returnTo`を保持する。
- [x] AC-4 公開moderator routeの復帰先が`/discussions/moderator`である。
- [x] AC-5 `code`は16px、global `span`指定はなく、badgeは`badge-md`を利用側で明示する。
- [x] AC-6 settings未認証表示はデフォルト16pxで内側`py-8`がない。
- [x] AC-7 既存認証reason、loading/error、PageHeader、個別moderator routeに回帰がない。
- [ ] AC-8 TypeScript、lint、test、build、diff check、branch/remote SHA/CI状態を実測記録する。
