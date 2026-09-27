# Issue #68 relay候補入力簡素化タスクリスト

## Constitution Check

- [x] `AGENTS.md` と憲章を確認した。
- [x] TypeScript strict、既存のレイヤー分離、明確な命名、単純なロジックを維持する。
- [x] 仕様書ではなく、関連 spec `specs/017-discussion-read-executor/issue-68/` に設計・タスクを置く。
- [x] TDD で RED → GREEN → REFACTOR を実行する。
- [x] テスト実装後と本番実装後に、fresh なサブエージェントの read-only review を行う。
- [x] UI変更はないため、既存のアクセシビリティ契約を変更しない。

## Task 1: 共通 executor 契約の RED

- [x] `src/lib/discussion/__tests__/discussion-read-executor.test.ts` を変更し、`candidates` ではなく Provider が決めた `relayUrls` を渡す契約にする。
- [x] 初回3件・retry次3件の既存挙動を `relayUrls` 順序で検証する。
- [x] `relayHints` を含まない `DiscussionReadPlan` fixture にする。
- [x] focused test を実行し、production code が旧契約のため RED になることを確認する。

## Task 2: テスト実装の fresh review

- [x] Task 1 のテストファイルだけを対象に、fresh read-only サブエージェントへ仕様適合レビューを委任する。
- [x] レビュー後、テストの書込境界と現在バイトを再確認する。
- [x] 必要な修正を行った場合、Task 1 の RED を再実行する。

## Task 3: executor と read plan の最小実装

- [x] `src/lib/discussion/discussion-read-executor.ts` から `RelayCandidateSelectorInput` と候補源統合を削除する。
- [x] `ExecuteDiscussionReadInput` を `relayUrls: string[]` 契約へ変更する。
- [x] `src/lib/discussion/discussion-read-plan.ts` から `relayHints` と引数を削除する。
- [x] executor は Provider が渡した URL 配列を初回・retryへ分割するだけにする。
- [x] focused executor/plan tests を GREEN にする。

## Task 4: 本番実装の fresh review

- [x] Task 3 の production diff を fresh read-only サブエージェントへレビュー委任する。
- [x] review 対象の current diff とテスト結果を確認する。
- [x] production review 後に focused tests を再実行する。

## Task 5: moderation snapshot 契約を単純化

- [x] `src/lib/discussion/discussion-moderation-snapshot.ts` の入力を `relayUrls: string[]` に変更する。
- [x] snapshot 内の候補源配列、`rankRelayCandidates`、候補源の意味付けを削除する。
- [x] snapshot の primary/approval read が同じ `relayUrls` を使うことをテストで検証する。
- [x] `DiscussionContentDataProvider` と `useBusStopModeration` を Provider 側の URL 配列へ移行する。

## Task 6: 全 executor 利用箇所を移行

- [x] `DiscussionManagementDataProvider` は一覧 NADDR relay hint を掲載投稿 read に渡さず、設定 read relay を `relayUrls` として渡す。
- [x] `DiscussionManagementDataProvider` の参照先 read を設定 read relay の `relayUrls` へ移行する。
- [x] `DiscussionTabLayout`、`settings`、詳細、承認、編集、モデレーターの各呼び出しを `relayUrls` 契約へ移行する。
- [x] 全 production source に `candidates:`、`relayHints:`、旧候補源引数の利用が残っていないことを検索で確認する。

## Task 7: 旧候補選択経路の整理

- [x] `DiscussionReadExecutor`、`DiscussionModerationSnapshot`、`DiscussionReadPlan` が `relay-candidate-selector` に依存しないことを確認する。
- [x] `relay-candidate-selector.ts` の export が production で不要になったため、既存テストと合わせて削除した。
- [x] 今回不要な `relayLimit` の二重管理を整理した。

## Task 8: 最終検証

- [x] 関連 focused tests を実行する。
- [x] `npx tsc --noEmit --incremental false` を実行する。
- [x] `npm run lint` を実行する。
- [x] `npm test -- --runInBand` を実行する。
- [x] `npm run build` を実行する。
- [x] `git diff --check` と status を確認する。
- [x] 設計・タスク・実装が受入条件を満たすことを確認する。
