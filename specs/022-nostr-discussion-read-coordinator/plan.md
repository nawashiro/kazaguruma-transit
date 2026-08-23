# Implementation Plan: Discussion read lifecycleの単純化

**Branch**: `refactor/nostr-discussion-read-coordinator` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/022-nostr-discussion-read-coordinator/spec.md`

## Summary

`DiscussionReadExecutor`を、Discussion固有ではなくNostr基盤である実態に合わせて`NostrReadExecutor`へ改名・配置する。relay候補の意味づけ、attempt分割、retry、NDK通信の契約は変更しない。

その上位に、詳細route用と一覧route用の二つのdomain read coordinatorを置く。各coordinatorは既存executorをphaseごとに順序づけて呼び、一つのroute-scoped snapshotとして公開する。ページや子routeはNostr readを開始しない。

詳細snapshotには通常投稿、moderator request、approval、evaluationを含める。ユーザー固有の評価状態は同じevaluation結果から導出する。relay実績はcoordinator内のphase別provenanceと、version 2のsessionStorage cacheへ保持する。

## Technical Context

**Language/Version**: TypeScript 5 strict、Node.js 22.x

**Primary Dependencies**: Next.js 15 App Router、React 19、`@nostr-dev-kit/ndk`、Jest、React Testing Library、既存`NostrService`、既存`DiscussionNdkGateway`

**Storage**: Nostr relayを正本とする。ブラウザ`sessionStorage`の既知データcacheをversion 2へ更新する。SQLite/Prismaは変更しない。

**Testing**: Jest、React Testing Library、既存NDK mock。TDDで契約テストを先に追加する。

**Target Platform**: Next.jsクライアント画面、モダンブラウザ

**Project Type**: Next.js web application

**Performance Goals**:

- 同じroute sessionで、同一論理phaseのNostr readを一回だけ開始する。
- 子route遷移で追加readを開始しない。
- 既存executorのrelay attempt上限、retry回数、completion観測を変更しない。
- 取得速度の改善は本featureの主目的とせず、取得の一貫性と重複排除を優先する。

**Constraints**:

- relay候補配列の構築はProvider/coordinatorの責務として維持する。
- `NostrReadExecutor`は受け取ったrelay候補の順序、初回最大3件、非EOSE時の限定retry、event/provenance mergeを維持する。
- `NostrService`がNDK通信、EOSE、timeout、subscription停止を所有する。
- 新規DB永続化は行わない。
- partial状態で未確認のapprovalを確定表示しない。
- UIは日本語、`role="status"`、`aria-live="polite"`、44px以上のreload操作を維持する。

**Scale/Scope**:

- 対象: `/discussions`、`/discussions/manage`、`/discussions/moderator`、`/discussions/[naddr]`、`approve`、`moderators`、`edit`、関連readテスト。
- `/settings`はexecutor renameによるimport/API移行と回帰確認の対象とする。
- 既存のNostr transportの挙動変更、relay単位readへの再設計、pagination導入は対象外。

## Constitution Check

### Phase 0前

| Gate | Result | 根拠 |
|---|---|---|
| 明確な命名 | Pass | `NostrReadExecutor`を基盤、coordinatorをdomain、snapshotを共有結果として分離する。 |
| 単純なロジック | Pass | 複数Contextとページ固有readをroute-scoped coordinatorへ集約する。 |
| Structured Organization | Pass | `src/lib/nostr`に基盤、`src/lib/discussion`にdomain、`src/components/discussion`にpresentation adapterを置く。 |
| 型安全 | Pass | phase別provenance、read state、snapshotを明示的な型で表す。 |
| Test-first development | Pass | coordinator、cache、rename、route境界のREDテストを先に追加する。各test実装直後にfresh read-only test reviewを置く。 |
| Accessibility & UX | Pass | loading/partial/error/reloadの日本語UIと既存アクセシビリティ契約を維持する。 |
| Nostr方針 | Pass | executorとNostrServiceを維持し、relay正本とsessionStorage暫定cacheを継続する。 |

### Phase 1後

| Gate | Result | 設計根拠 |
|---|---|---|
| executor責務 | Pass | relay候補の意味づけは上位、attempt/retry/mergeはNostr基盤executorに残す。 |
| transport隠蔽 | Pass | coordinatorとpageはNDK/NostrServiceへ直接触れず、既存executorを呼ぶ。 |
| snapshot境界 | Pass | phase callbackをUI完了状態に使わず、coordinatorが最終stateを確定する。 |
| relay provenance | Pass | metadata/content/evaluation/referenceをcacheとsession内で区別する。 |
| persistence | Pass | DB変更なし。cacheはsessionStorage v2へ限定する。 |
| page責務 | Pass | pagesはselector、表示、action dispatchだけを持つ。 |
| accessibility | Pass | status、aria-live、reload target、disabled actionをquickstartとtasksで検証する。 |

## Project Structure

### Documentation

```text
specs/022-nostr-discussion-read-coordinator/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── read-coordinator.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code

```text
src/
├── app/
│   ├── discussions/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── manage/page.tsx
│   │   ├── moderator/page.tsx
│   │   └── [naddr]/
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── approve/page.tsx
│   │       ├── moderators/page.tsx
│   │       └── edit/page.tsx
│   └── settings/page.tsx
├── components/discussion/
│   ├── DiscussionDetailProvider.tsx
│   ├── DiscussionManagementProvider.tsx
│   ├── DiscussionDataProvider.tsx              # 段階的削除または薄い互換adapter
│   ├── DiscussionContentDataProvider.tsx       # no-read adapterへ整理後削除
│   └── DiscussionManagementDataProvider.tsx    # no-read adapterへ整理後削除
├── lib/nostr/
│   ├── nostr-read-executor.ts
│   ├── nostr-service.ts
│   └── discussion-ndk-gateway.ts
└── lib/discussion/
    ├── discussion-read-plan.ts
    ├── discussion-detail-read-coordinator.ts
    ├── discussion-management-read-coordinator.ts
    ├── discussion-moderation-snapshot.ts
    ├── discussion-known-data-cache.ts
    └── discussion-reference-resolver.ts
```

**Structure Decision**: 既存単一Next.js構造を維持する。executorと共通read型は`src/lib/nostr`へ移し、Discussion固有のfilter生成・snapshot・cache・coordinatorは`src/lib/discussion`へ置く。UI providerはroute familyごとに二つだけを正本とする。

## Implementation Boundaries

### 1. Nostr基盤rename

- `discussion-read-executor.ts`を`nostr-read-executor.ts`へ移す。
- `executeDiscussionRead`を`executeNostrRead`へ改名する。
- `DiscussionReadTransport`、`DiscussionReadResult`、`RelayAttempt`などの基盤型をNostr名へ改名する。
- Discussion固有の`DiscussionReadTarget`とfilter生成は`discussion-read-plan.ts`へ残す。
- 実行アルゴリズム、relay candidate input、初回3relay、限定retry、completion、merge、provenanceの挙動は変更しない。

### 2. Detail coordinator

- `readDiscussionDetail()`を追加し、metadata → content → approvals → evaluationsの順序を一箇所で管理する。
- `loadDiscussionModerationSnapshot()`のphase callbackをUI公開契約から外す。
- primary contentから通常投稿とmoderator requestを分離して返す。
- evaluation結果から`userEvaluationIds`を導出する。
- `DiscussionDetailProvider`は一つの`DiscussionDetailModel`だけをContextで公開する。
- `page.tsx`、`approve`、`moderators`、`edit`から直接readとgateway queryを除去する。

### 3. Management coordinator

- `readDiscussionManagement()`を追加し、掲載metadata、掲載content、approval、q参照解決、参照先metadataを順序づける。
- `/discussions`、`manage`、`moderator`を同じ`DiscussionManagementProvider`へ接続する。
- `DiscussionManagementTabLayout`はsnapshot selectorを使い、独自readを持たない。

### 4. Cache and provenance

- `discussion-known-data-cache.ts`のcache versionを2へ上げる。
- `successfulEventRelayUrls`と`successfulRelays`の曖昧なunionをphase別`relayProvenance`へ置き換える。
- 旧v1 cacheは安全に無視し、readは継続する。
- cacheはmetadata/content/evaluation/referenceのsuccessful relay候補だけを保存する。source eventごとの詳細provenanceは現在readの結果に保持し、cacheへ過剰に保存しない。

### 5. UI contract

- 初期readのphase完了をページの独立loading完了として扱わない。
- snapshot stateが`ready`になるまで初期表示はloadingとする。
- `partial`は取得済みデータを表示できるが、unknown approvalのactionを無効化する。
- reloadはroute familyのread session全体を再実行する。
- 旧`meta`、`content`、`management`の複数reload APIは、段階的に単一`reload()`へ寄せる。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Detail/Managementの二つのcoordinator | データの対象と業務判定が異なるため | 一つのscope付き巨大Providerは現在の責務混在を再現する。 |
| phase別relay provenance | metadata成功relayとcontent成功relayの混同を防ぐため | 一つのrelay配列ではcache候補の意味が失われる。 |
| snapshot確定までの初期loading | phase callbackによる並行readと誤確定を防ぐため | streaming暫定表示はUI状態機械を複雑化し、今回の主問題を温存する。 |

## Verification Strategy

1. Nostr renameの型・import・executor既存テストを先にRED/GREENで移行する。
2. cache phase provenanceの純粋関数テストを追加する。
3. detail coordinatorのphase順序、moderator request共有、user evaluation導出をfixtureで検証する。
4. management coordinatorのreference dedupeとpartial空一覧抑止を検証する。
5. 各pageの直接read消失と既存UI stateをrouteテストで検証する。
6. focused Jest、strict TypeScript、lint、全Jest、build、`git diff --check`を実行する。
