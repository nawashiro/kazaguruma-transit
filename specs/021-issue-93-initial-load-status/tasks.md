# Tasks: Issue #93 初回取得状態の非割り込み化

**Type:** 既存機能のfix。新規`spec.md`は作成しない。

**Repository:** `/opt/data/kazaguruma-transit`

**Base:** `dev` / `origin/dev` at `c772d62f4439e6d8794cbdd4fdeb8c051249a083`

**Work branch:** `fix/issue-93-initial-load-status`

## Blocking rules

- 本tasksは実装契約である。完了チェックは親が現行worktree、SHA、終了コードを再確認した後だけ更新する。
- test writerは指定test pathだけを変更する。本番コード、他test、docs、commit、push、reset、clean、依存追加を行わない。
- production writerは指定production pathだけを変更する。test、docs、API、Nostr、DB、relay設定を変更しない。
- reviewerは読み取り専用で、`SUBAGENT_STATUS: COMPLETE`、`VERDICT: PASS`、`modified: false`、開始終了SHA一致を返す。
- test bytesが変わったらtest reviewを失効させる。production bytesが変わったらproduction reviewを失効させる。
- `alert-error`、本文、ボタン、再試行・再読み込み動作は維持する。役割と`aria-live`だけを変更する。

## Phase 1: Investigation and boundary

- [X] T001 Issue #93、`AGENTS.md`、`.specify/memory/constitution.md`、research、planを読み、初回取得状態と操作後エラーの境界を固定する。
- [X] T002 現行の関連7 suitesをbaselineとして実行し、7 suites passed、45 tests passed、4 tests skipped、既存warningを記録する。

**Checkpoint:** Issue #93の初回取得系5経路、除外する操作後エラー、hard write boundaryを固定する。

## Phase 2: Unit 1 — 共通メタデータ状態

- [X] T003 test writerへ`src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx`だけを委任し、error状態を`role="status"`、`aria-live="polite"`、本文・`alert-error`・再試行ボタン維持としてREDにする。
- [X] T004 T003のsettled test bytesをfresh read-only test reviewerへ委任し、既存loading・partial status契約を弱めていないことを確認する。
- [X] T005 T004 PASS後、production writerへ`src/components/discussion/DiscussionMetaReadState.tsx`だけを委任し、errorのrole/live属性を最小変更する。
- [X] T006 T005後、production reviewerへUnit 1のproduction bytesを委任し、focused test、型、target lint、diff check、scopeを確認する。

## Phase 3: Unit 2 — 管理画面の重複メタデータ状態

- [X] T007 test writerへ`src/app/discussions/manage/__tests__/page.test.tsx`と`src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx`だけを委任し、metadata error/not-foundをstatus＋politeへ変更するREDを作る。partial statusとreloadを維持する。
- [X] T008 T007のsettled test bytesをfresh read-only test reviewerへ委任し、管理画面の操作・partial・reload契約を確認する。
- [X] T009 T008 PASS後、production writerへ`src/app/discussions/manage/page.tsx`と`src/app/discussions/[naddr]/moderators/page.tsx`だけを委任し、metadata not-found/errorの重複表示をstatus＋politeへ変更する。
- [X] T010 T009後、production reviewerへUnit 2のproduction bytesを委任し、focused tests、型、target lint、diff check、他の操作後alert非変更を確認する。

## Phase 4: Unit 3 — 会話一覧の初回read状態

- [X] T011 test writerへ`src/app/discussions/__tests__/page.streaming.test.tsx`だけを委任し、moderation read errorをstatus＋politeで表示する契約へ変更する。partial statusと一覧表示契約を維持する。
- [X] T012 T011のsettled test bytesをfresh read-only test reviewerへ委任し、初回read errorだけを対象にしていることを確認する。
- [X] T013 T012 PASS後、production writerへ`src/app/discussions/page.tsx`だけを委任し、moderation load errorをstatus＋politeへ変更する。
- [X] T014 T013後、production reviewerへUnit 3のproduction bytesを委任し、focused test、型、target lint、diff check、scopeを確認する。

## Phase 5: Unit 4 — 会話詳細の初回投稿・評価read状態

- [X] T015 test writerへ`src/app/discussions/[naddr]/__tests__/page.test.tsx`だけを委任し、初回投稿・評価read errorをstatus＋politeで表示する契約へ変更する。投稿入力検証のassertive alertを維持する。
- [X] T016 T015のsettled test bytesをfresh read-only test reviewerへ委任し、初回read errorと操作後validation errorを混同していないことを確認する。
- [X] T017 T016 PASS後、production writerへ`src/app/discussions/[naddr]/page.tsx`だけを委任し、初回投稿・評価read errorの2箇所をstatus＋politeへ変更する。
- [X] T018 T017後、production reviewerへUnit 4のproduction bytesを委任し、focused test、型、target lint、diff check、操作後alert非変更を確認する。

## Phase 6: Final verification and delivery

- [X] T019 親がfocused aggregate、full Jest、strict TypeScript、full Lint、`git diff --check`、Spec Kit checkを実行し、既存warningと今回のfailureを分離する。
- [X] T020 必要な前提が整えば`npm run build`を実行し、`transit-config.json`不在などの環境依存ログと終了コードを分離する。
- [X] T021 親がcurrent bytes、production/test/docs以外の差分、staged/untracked path、SHA、diff stat、statusを確認し、完了タスクだけを`[X]`へ更新する。
- [ ] T022 ローカル検証後、Issue #93の変更をcommit・pushし、GitHub/Tangledの対象SHAとGitHub CIの実行状態を確認する。CI未実行を成功扱いしない。

**Final checkpoint:** 初回取得系だけが非割り込みstatusになり、操作後エラー、本文、視覚クラス、再試行・再読み込み動作が維持され、push後SHAとCI状態が記録されている。
