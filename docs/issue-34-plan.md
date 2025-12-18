# Issue #34 実装計画（ルート検索結果ページの4550取得最適化）

## 1. 目的と理解

- ルート検索結果ページ（`src/app/page.tsx`）で表示するバス停メモは、まず kind 1111/1 の投稿を取得し、その投稿に紐づく kind 4550（承認）だけを取得する必要がある。
- 現状は `BusStopMemo` のストリーミング処理で `streamApprovals` を使っており、`#e` を付けずに discussion 全体の4550を取得してしまうため、不要な通信が発生している。

## 2. 問題点（第三者視点・リスクの洗い出し）

- **通信量の肥大化**: `#e` がないため全承認イベントが対象となり、リレーとクライアント双方に負荷がかかる。
- **UIの遅延/ジッタ**: 不要な承認イベントが流入することで、フィルタ後処理が増え、描画更新の頻度が高まる。
- **将来的な拡張への悪影響**: ディスカッション参加者が増えると指数的に無駄が増える。
- **設計の一貫性不足**: `getApprovalsForPosts` は `#e` を使っているのに、ストリーミング側が統一されていない。

## 3. 目標（成功条件）

- ルート検索結果ページで 4550 取得リクエストに `#e` が含まれる。
- 投稿 EOSE 後に「その投稿IDに紐づく承認のみ」を取得する流れになる。
- UIの表示内容・仕様は変えず、通信を最小化する。

## 4. 方針（リーダブルコード / 禅の精神）

- **Simple is better than complex**: ロジックの状態分岐は最小限にする。
- **Explicit is better than implicit**: 「投稿取得完了→承認取得」依存関係を明示。
- **Small is beautiful**: `BusStopMemo` の責務は「取得タイミングの制御」に限定し、具体的なフィルタ構築はサービス側を使う。

## 5. 実装方針（分割設計）

1. `BusStopMemo` で投稿ストリームの EOSE 到達時点に、取得済み投稿ID一覧を確定（OnEose）。
2. `streamApprovalsForPosts` を使って `#e` 付き購読を開始（OnEvent）。
3. 「投稿が0件」の場合は承認ストリームを開始しない（即時Eose扱い）。

## 6. TDD での進め方（失敗→成功の流れ）

### 6.1 追加・更新するテスト

- `src/components/discussion/__tests__/BusStopMemo.streaming.test.tsx`
- **新規テスト**: 投稿の EOSE 後に `streamApprovalsForPosts` が呼ばれること。

### 6.2 失敗確認

1. 上記テストを先に追加。
2. 現行コードでは `streamApprovals` が呼ばれるためテストが失敗することを確認。

### 6.3 実装

- `src/components/discussion/BusStopMemo.tsx` の `loadMemoData` を修正。
- 既存の `streamApprovals` を撤去。
- `streamApprovalsForPosts` を投稿IDに基づいて開始。

### 6.4 成功確認

1. テスト再実行し全て成功。
2. `npm run lint` / `npm test` / `npm run build` を通して回帰がないことを確認。

## 7. 検証観点（レッドチーム視点）

- `#e` フィルタが空配列にならないか。
- 投稿0件時に承認ストリームが誤って走らないか。
- 再購読が連打にならないか。
- UIの結果が従来と一致しているか（表示内容の変化がないか）。

## 8. 影響範囲

- 修正対象: `src/components/discussion/BusStopMemo.tsx`
- テスト対象: `src/components/discussion/__tests__/BusStopMemo.streaming.test.tsx`
- Nostrサービスは既存API（`streamApprovalsForPosts`）を利用し、追加変更は最小限。
