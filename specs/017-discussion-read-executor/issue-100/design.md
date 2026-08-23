# Issue #100 設計: モデレーター画面の共有readと再読み込み導線

## Issue

- Repository: `nawashiro/kazaguruma-transit`
- Issue: [#100](https://github.com/nawashiro/kazaguruma-transit/issues/100)
- Title: `fix: 取得経路の共通化（タブとコンテンツ）が /moderator だけ漏れている可能性`
- 調査時点: 2026-08-23
- Issue本文へのコメント: なし

## 調査結果

### 基準と重複作業

- `origin/dev` を取得し、ローカル `dev` と `origin/dev` はともに `2781e83d24538657b900f291b815ab3b3b9c8d82` だった。
- 作業開始時の `dev` は clean だった。
- Issue番号検索では Issue #100 に対応するPRは見つからなかった。取得できた #72 は既存の Issue #68 対応のmerge済みPRであり、本Issueの重複作業ではない。
- `git log -S` で `CONTENT_PATHS` と moderator tab の既存テストを確認した。Issue #68 の共有化後、moderator tabだけは「listing posts/approvalsを遅延読込する」設計のまま除外されている。

### 現在の経路

- `/discussions` と `/discussions/manage` は `DiscussionManagementShell` → `DiscussionDataProvider` → `loadDiscussionModerationSnapshot` の共有content readを使う。
- `/discussions/moderator` も同じ `DiscussionManagementShell` と `DiscussionDataProvider` の下で描画されるが、`DiscussionDataProvider` の `CONTENT_PATHS` から外れている。そのため、一覧投稿・承認の共有readだけが開始されない。
- `/discussions/[naddr]/moderators` は実在する詳細モデレーター画面のパスであり、Issue本文の `/moderator` 表記とは異なる。詳細側は共有 `DiscussionDataProvider` によるmetadata readを使い、モデレーター申請だけを画面固有の完了型executor readで取得している。投稿一覧contentを使わないため、詳細側のcontent read除外は今回変更しない。
- `src/app/discussions/page.tsx` は一覧取得が部分状態のとき「再読み込みしてください」と表示するが、その警告には操作要素がない。`DiscussionManagementState` には `reloadModeration` が存在する。
- `src/app/discussions/[naddr]/page.tsx` は共有contentの `completionReason` と `reload` を表示境界へ渡していない。metadataの部分状態には導線があるが、投稿contentの部分状態には利用者向けの再読み込み導線がない。
- `DiscussionReadStatus` は非EOSE状態に日本語のstatusと44px以上の再読み込みボタンを表示できるため、詳細contentの表示にはこの既存部品を使う。

### 再現・ベースライン

- `npm test -- --runInBand src/components/discussion/__tests__/DiscussionDataProvider.test.tsx`
  - PASS: 20 tests
  - 既存テストは `/discussions/moderator` で `loadDiscussionModerationSnapshot` が呼ばれないことを期待しており、Issue #100の疑わしい挙動を固定している。
- moderator関連の既存テストはPASSした。
- `git diff --check` はcleanだった。

## 仕様判断

### In scope

1. `/discussions/moderator` を `/discussions` と `/discussions/manage` と同じ共有management content readの対象にする。
2. `/discussions` の一覧contentが部分取得または取得不能のとき、既存の `reloadModeration` を呼ぶ再読み込みボタンを表示する。
3. `/discussions/[naddr]` の投稿contentが非EOSEのとき、取得済み投稿を残したまま `DiscussionReadStatus` と共有 `reload` による再読み込み導線を表示する。
4. 既存の初回最大3relay、限定retry、completion、relay provenance、承認判定を変更しない。

### Out of scope

- Issue本文の単数形 `/discussions/[naddr]/moderator` に対応する新規routeやaliasの追加。現行routeは `/discussions/[naddr]/moderators` であり、詳細画面のmetadata/application readは既に共通executor境界を使用している。
- 詳細モデレーター画面で未使用の投稿contentを追加取得すること。
- `DiscussionReadExecutor`、`DiscussionReadPlan`、Nostr transportのretry規則やrelay選択規則の変更。
- ページ分割、cursor、永続化、DB/Prisma schemaの変更。
- `window.location.reload()` による全ページ再読み込みへの置換。既存Providerのread generationとcache境界を使う。

## 受入条件

- `/discussions/moderator` の `DiscussionDataProvider` はmetadata readに加えてmanagement content readを一度開始する。
- `/discussions/moderator` の共有content readが部分状態になっても、空一覧/不存在を確定せず、Providerの状態を保持する。
- `/discussions` の部分取得警告またはcontent取得エラーに、accessible name `再読み込み` の44px以上のbuttonがあり、クリックで `reloadModeration` が一度呼ばれる。
- 詳細ページのcontent readが `idle-timeout`、`hard-timeout`、`cancelled` の場合、取得済みcontentを残したstatusと再読み込みbuttonを表示する。EOSEでは表示しない。
- 新しいテストは実装前にREDとなり、テスト実装のfresh read-only reviewを通過する。
- focused test、TypeScript strict、lint、全Jest、build、`git diff --check` が成功する。

## 変更対象の想定

- Test:
  - `src/components/discussion/__tests__/DiscussionDataProvider.test.tsx`
  - `src/app/discussions/__tests__/page.streaming.test.tsx`
  - `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`
- Production:
  - `src/components/discussion/DiscussionDataProvider.tsx`
  - `src/app/discussions/page.tsx`
  - `src/app/discussions/[naddr]/page.tsx`

## リスクと軽減策

- moderator tabでcontent readを開始すると通信量が増える。既存の共有management readと同じ一回のsnapshot lifecycleを使い、executorやfilterを増やさない。
- 詳細ページにstatusを追加すると、metadata statusとcontent statusが同時に表示され得る。content statusは投稿content領域の直前に限定し、metadataの既存表示責務を変更しない。
- partial状態で再読み込みすると旧世代の結果が混ざる可能性がある。既存 `DiscussionDataProvider.reload` のgeneration管理をそのまま利用し、ページ側で独自stateを作らない。

## 憲章チェック

- `AGENTS.md` と `.specify/memory/constitution.md` を確認済み。
- TypeScript strict、既存のUI/data/service分離、明確な命名、単純なロジックを維持する。
- テスト先行で、各小さな挙動を RED → fresh test review → 最小実装 → GREEN の順に進める。
- statusは `role="status"` / `aria-live="polite"`、buttonは既存の `min-h-[44px]` 契約を使う。
- 新規仕様書は作成せず、この関連仕様ディレクトリ内の `issue-100/` に設計とタスクリストを保存する。
