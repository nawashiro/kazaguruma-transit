# Tasks: ブックマーク可能な経路検索結果

## Phase 1: Setup

- [x] T001 既存014の対象外範囲と憲章を照合し `specs/016-bookmarkable-route-results/plan.md` に設計gateを記録する

## Phase 2: Foundational

- [x] T002 `src/lib/transit/__tests__/route-search-query.test.ts` にURL round-trip、範囲、日時、真偽値検証を先に追加する
- [x] T003 `src/lib/transit/route-search-query.ts` に単一の検索URL/API URL codecを実装する
- [x] T004 `src/lib/transit/route-result-model.ts` に既存API結果から表示モデルへの純粋変換を移す

## Phase 3: User Story 1 - 検索結果を固有URLで開く

**Independent Test**: 入力完了後にGET結果URLへ遷移し、結果ページがGET APIを呼んで結果を表示する。

- [x] T005 [US1] `src/app/__tests__/page.test.tsx` を検索ボタンのURL遷移と入力ページ非取得の期待へ先に変更する
- [x] T006 [P] [US1] `src/app/api/__tests__/transit-get.test.ts` にGET route queryと400契約を先に追加する
- [x] T007 [P] [US1] `src/app/routes/__tests__/page.test.tsx` に有効URLのloading、結果、結果なしを先に追加する
- [x] T008 [US1] `src/app/page.tsx` を入力と結果URL生成だけへ縮小する
- [x] T009 [US1] `src/app/api/transit/route.ts` に既存処理を再利用するGETを追加する
- [x] T010 [US1] `src/components/features/RouteSearchResults.tsx` と `src/app/routes/page.tsx` に結果取得・表示責務を実装する

## Phase 4: User Story 2 - 結果URLをブックマーク・共有する

**Independent Test**: URL直接アクセスと再renderで全条件が復元され、localStorageよりURLが優先される。

- [x] T011 [US2] `src/app/routes/__tests__/page.test.tsx` に直接アクセス、全query条件、再読み込み相当の再現性を追加する
- [x] T012 [US2] `src/components/features/RouteSearchResults.tsx` でURLを検索条件の唯一の正本として固定する

## Phase 5: User Story 3 - 不正な結果URLから復帰する

**Independent Test**: 不正URLでfetchせず日本語alertと入力ページへのリンクを表示する。

- [x] T013 [US3] `src/app/routes/__tests__/page.test.tsx` に不足・範囲外・不正日時と復帰導線を先に追加する
- [x] T014 [US3] `src/components/features/RouteSearchResults.tsx` に不正URLと検索失敗のアクセシブルな復帰表示を実装する

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T015 [P] `src/app/__tests__/page.test.tsx` と `src/app/routes/__tests__/page.test.tsx` でPDF、カレンダー、rate limit、メモ・会話の回帰を確認する
- [x] T016 `specs/016-bookmarkable-route-results/quickstart.md` に実測した検証結果を記録する
- [x] T017 `npx tsc --noEmit`、`npm run lint`、`npm test -- --runInBand`、`npm run build`を実行し全エラーを解消する
- [x] T018 差分をred-teamし、URL再現性、GET安全性、KISS/DRY、既存POST互換を再確認する
- [x] T019 coherent milestoneをgit commitする

## Dependencies

T002→T003→T004。US1は基盤完了後、US2はUS1後、US3はcodec完成後に実行可能。検証とcommitは全story後。

## Implementation Strategy

MVPはUS1。テストを先に失敗させ、codec、入力遷移、GET API、結果ページの順に実装する。US2/US3で共有・不正URLを強化する。
