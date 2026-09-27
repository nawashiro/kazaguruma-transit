# Issue #93 調査記録

## 基準

- Issue: #93 `fix: 初回読み込み状態で role="alert" を使わない`
- Repository: `/opt/data/kazaguruma-transit`
- Base: `dev` / `origin/dev` at `c772d62f4439e6d8794cbdd4fdeb8c051249a083`
- Work branch: `fix/issue-93-initial-load-status`
- Comments: なし
- Baseline: 関連7 suites、45 tests passed、4 tests skipped

## Root cause

`DiscussionTabLayout`は、初回の会話メタデータ取得を実行する。取得後に会話が見つからない場合、`DiscussionMetaReadState`が`error`を表示する。

`DiscussionMetaReadState.tsx:35-41`は、取得失敗と未検出を`role="alert"`で描画する。これはユーザー操作後の緊急通知ではなく、初回取得結果である。支援技術への割り込みを避けるため、`role="status"`と`aria-live="polite"`を使う。

## Production usage inventory

| 経路 | 発生源 | 現在の意味論 | Issue #93の扱い |
|---|---|---|---|
| 共通会話レイアウト | `src/components/discussion/DiscussionMetaReadState.tsx:35-41` | 初回メタデータ失敗／未検出をalert | statusへ変更 |
| `/discussions/manage` | `src/app/discussions/manage/page.tsx:207-223` | 共通meta errorの重複表示をalert | statusへ変更 |
| `/discussions/[naddr]/moderators` | `src/app/discussions/[naddr]/moderators/page.tsx:262-288` | meta not-foundをalert、partialはstatus | not-foundだけstatusへ変更 |
| `/discussions` | `src/app/discussions/page.tsx:85-93` | 初回moderation read失敗をalert、partialはstatus | statusへ変更 |
| `/discussions/[naddr]` | `src/app/discussions/[naddr]/page.tsx:527-567` | 初回投稿／評価read失敗をalert | statusへ変更 |
| `/discussions/[naddr]/approve` | `src/app/discussions/[naddr]/approve/page.tsx:305-327` | not-found／partialをstatus | 変更しない |

## 操作後エラーの除外

次の状態はユーザー操作に直結するため、assertiveな通知を維持する。

- `src/app/discussions/create/page.tsx:383-386`: 入力検証と会話作成失敗
- `src/app/discussions/[naddr]/page.tsx:853-864`: 投稿フォームの入力検証
- `src/components/discussion/BusStopDiscussion.tsx:214-224`: 投稿操作の検証・送信失敗
- 承認、撤回、モデレーター変更などの操作失敗

## Data-flow evidence

- `DiscussionTabLayout.loadDiscussionData`は初回readを開始し、会話未検出で`setDiscussionError`を呼ぶ。
- `DiscussionContentDataProvider.loadModeration`は初回投稿read失敗で`setError`を呼ぶ。
- `DiscussionManagementDataProvider.loadModeration`は初回一覧read失敗で`setModerationError`を呼ぶ。
- `DiscussionDetailPage`は`contentLoadError`と`evaluationsLoadError`を`postsLoadError`へ統合する。
- これらはユーザー操作後のエラー状態と別の初回取得経路である。

## Verification loop

Baseline command:

```bash
npm test -- --runInBand --runTestsByPath \
  src/components/discussion/__tests__/DiscussionMetaReadState.test.tsx \
  src/app/discussions/__tests__/page.streaming.test.tsx \
  src/app/discussions/manage/__tests__/page.test.tsx \
  'src/app/discussions/[naddr]/__tests__/page.test.tsx' \
  'src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx' \
  'src/app/discussions/[naddr]/moderators/__tests__/page.test.tsx' \
  'src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx'
```

Baseline result: 7 suites passed、45 tests passed、4 tests skipped。既存テストは現在の誤った`alert`契約を保持しているため、test-first変更後にREDとなる。

## Scope boundary

- 新規永続化、API、Nostr read方式、relay戦略、データモデルは変更しない。
- 共通通知コンポーネントは新設しない。
- `alert-error`等の視覚クラス、本文、再試行・再読み込み操作は維持する。
- 役割と`aria-live`だけを、発生源ごとに変更する。
