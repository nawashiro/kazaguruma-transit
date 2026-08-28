# Issue #98 タスクリスト

**Issue:** [#98](https://github.com/nawashiro/kazaguruma-transit/issues/98)

**Base:** `dev` / `origin/dev` at `9be674d62af5db40723d324a2f6ca2db666bce83`

**Branch:** `fix/issue-98-no-auto-navigation`

**Documents:** [`spec.md`](./spec.md), [`research.md`](./research.md), [`plan.md`](./plan.md)

## 実行ルール

- このファイルは実装契約であり、親エージェントが現行worktree、変更path、SHA、終了コードを再確認した後だけ完了にする。
- 実装タスクは1タスク1サブエージェントへ委任し、親エージェントが受入条件・書込境界・依存関係を管理する。
- test writer は指定されたtest pathだけを変更し、本番コード、他test、文書、設定、commit、push、reset、cleanを行わない。
- test reviewer は読み取り専用とし、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始／終了SHA一致を明示する。レビュー後にtest byteが変わった場合、レビューは失効する。
- production writer は指定されたproduction pathだけを変更し、レビュー済みtestと文書を変更しない。
- 本番実装後のreview taskは作成せず、憲章に従って親エージェントが最終検証を管理する。
- 既存のLFS不整合や未関係のdirty pathが発生しても、reset、clean、上書きで解消しない。

## Phase 1: 調査・設計

- [x] T001 Issue #98本文・コメント・状態・関連PRを確認し、Issue本文が保存後自動遷移の抑制と明示リンクを求めていることを記録する。
- [x] T002 `dev`を`origin/dev`へfast-forwardし、clean状態、`AGENTS.md`、`.specify/memory/constitution.md`、README、既存編集ページ実装・テストを確認する。
- [x] T003 `spec.md`、`research.md`、`plan.md`を作成し、根因、受入基準、非対象、変更manifest、検証計画を固定する。
- [x] T004 変更前の編集ページfocused testを`npm test -- --runInBand --runTestsByPath "src/app/discussions/[naddr]/edit/__tests__/page.test.tsx"`で実行し、1 suite / 8 tests PASSを記録する。

## Phase 2: US1 保存成功後の明示遷移

### RED

- [x] T005 [US1] `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`だけを変更し、保存成功後に「会話が更新されました」と詳細リンクが表示され、2秒以上経過しても`router.push`が呼ばれないことをfake timersで検証する。既存の署名・publish検証を維持し、focused testを意図したproduction-contract failureでREDにする。実測RED: 1 suite / 8 tests、7 passed / 1 intentional failure、exit 1。

### Test review gate

- [x] T006 [US1] T005のsettled test bytesを、T005とは別のfresh read-only reviewerへ委任する。実DOMの成功画面、リンクのtag/name/href、タイマー経過後の非遷移、既存publish検証、空fixtureでないことを確認し、`VERDICT: PASS`、`modified: false`、SHA一致を得る。実測: 1 suite / 8 tests、7 passed / 1 intentional production-contract failure、exit 1。レビューSHA: start/end `bb8fd5c10cbec4ef6a2b147510b3c22f94641785cc375ca1429141621661c63c`。

### GREEN

- [x] T007 [US1] T006 PASS後、`src/app/discussions/[naddr]/edit/page.tsx`だけを変更する。保存成功後の`setTimeout`自動遷移を削除し、詳細画面へのネイティブ`Link`を追加する。削除・掲載申請・認証・エラー経路は変更しない。実測focused GREEN: 1 suite / 8 tests、exit 0。
- [x] T008 [US1] 親がT007後のsettled bytesを再読し、focused GREEN、関連編集suite、strict TypeScript、対象Lint、`git diff --check`、変更manifest、受入基準AC-1〜AC-5を確認する。実測: 編集関連3 suites / 16 tests PASS、`npx tsc --noEmit` PASS、対象`npx eslint` PASS、`git diff --check` PASS。自動遷移検索では保存成功分岐の`setTimeout`/詳細`router.push`は消え、削除・認証・掲載申請の既存遷移だけが残る。

## Phase 3: 統合検証

- [x] T009 `src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`を含む関連Jest suiteを実行し、今回のREDが解消され、既存回帰がないことを確認する。実測: 全Jest `npm test -- --runInBand` は 136 suites passed / 2 skipped、844 tests passed / 13 skipped、exit 0。編集関連3 suites / 16 testsもPASS。
- [x] T010 `npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build`、`git diff --check`を実行する。失敗時は終了コードと原因をbaseline・環境障害・今回の差分に分類する。実測: `npx tsc --noEmit` exit 0、`npm run lint` exit 0（既存warningのみ）、`npm test` exit 0（136 suites passed / 2 skipped、844 tests passed / 13 skipped）、`npm run build` exit 0（GTFS importは`transit-config.json`不在を表示したが既存スクリプトが継続し、Next buildは完了）、`git diff --check` exit 0。
- [x] T011 親が最終red-team確認を行い、自動遷移の残存検索、リンクURL、差分path、staged/untracked path、SHA、branchを再確認する。実測: 対象ページ内の保存成功後`setTimeout`・詳細向け`router.push`・旧案内文は0件、staged pathは0件、対象pathは本番1・テスト1・Issue文書4、対象SHAは64桁hex、末尾空白なし、branchは`fix/issue-98-no-auto-navigation`、HEADは`origin/dev`の祖先。

## Phase 4: Delivery

- [x] T012 in-scope docs、test、productionだけをstageし、日本語の短いprefix commitを作成する。無関係な変更を含めない。実施済み: 6ファイルのみをstageし、`fix: Issue #98の編集保存後自動遷移を廃止` を作成した。
- [ ] T013 feature branchをpushし、local SHAとremote branch SHAを一致確認する。
- [ ] T014 base=`dev`、head SHA、title/body、変更ファイルを読み返してIssue #98に紐づくPRを作成し、PRの状態・head SHA・checksをGitHubから確認する。CI未trigger・実行中・失敗を成功扱いしない。

## 依存関係

```text
T001-T004
  → T005 RED → T006 PASS → T007 GREEN → T008
  → T009/T010 → T011 → T012 → T013 → T014
```

## 受入基準チェック

- [x] AC-1 保存成功メッセージが表示され続ける。編集ページテストで成功画面の残存を確認。
- [x] AC-2 時間経過だけで詳細画面へ自動遷移しない。fake timersで2001ms経過後の`router.push`非呼出しを確認。
- [x] AC-3 会話詳細への明示リンクがある。実DOMでname「会話画面に戻る」、href `/discussions/naddr1discussion` を確認。
- [x] AC-4 保存の署名・publish・成功表示が維持される。編集ページテストで`signEvent`、`publishSignedEvent`、成功メッセージを確認。
- [x] AC-5 削除・掲載申請・未認証導線に回帰がない。全Jestおよび編集関連3 suiteがPASS。
