# Implementation Plan:Discussion read executor

**Branch**:`017-discussion-read-executor` | **Date**:2026-08-10 | **Spec**:[spec.md](./spec.md)

**Input**:Feature specification from `specs/017-discussion-read-executor/spec.md`

## Summary

全Discussion画面のrelay候補選別、completion-aware通信、一度だけのretry、relay実績統合を`DiscussionReadExecutor`へ集約する。画面は`DiscussionReadPlan`と画面固有の表示判定だけを持つ。`DiscussionReferenceResolver`は`q` tag、naddr、既知IDを正規化する。`NostrService`はfilter配列を一つのNDK購読へ渡し、filterごとの個別購読を廃止する。

## Technical Context

**Language/Version**:TypeScript 5 strict mode、React 19、Next.js 15 App Router

**Primary Dependencies**:`@nostr-dev-kit/ndk`、Next.js、React、Jest、React Testing Library

**Storage**:Nostr relayを正本とする。ブラウザ`sessionStorage`は既知eventsとrelay実績だけを保持する。SQLiteとPrismaは本featureで変更しない。

**Testing**:Jest、React Testing Library、既存NDK mock

**Target Platform**:モダンブラウザ。Next.jsクライアント画面。

**Project Type**:Web application

**Performance Goals**:既存構成で測定可能なAPI応答p95を200ms以内に保つ。参照先会話readはrelay attemptごとに一つのmulti-filter購読だけを作る。

**Constraints**:

- relay候補は初回とretryで各1から3件に制限する。
- retryは非EOSE完了時だけ一度実行する。
- EOSE結果に追加retryを行わない。
- page分割、続き取得、filter数上限を導入しない。
- UIは初回eventsを保持し、retryの空結果で消さない。
- 部分取得状態は日本語、`role="status"`、`aria-live="polite"`で通知する。

**Scale/Scope**:Discussion readの全画面を移行する。対象は一覧、設定、詳細、承認、編集、管理である。

## Constitution Check

### Phase 0前

| Gate | Result | 根拠 |
|---|---|---|
| 明確な命名 | Pass | Resolver、Plan、Executor、Attempt、Resultを分離する。 |
| 単純な論理 | Pass | 候補順位、attempt、合成を各関数へ分離する。 |
| 型安全 | Pass |入力、attempt、合成結果をTypeScript型で表す。 |
| Test-first development | Pass | transport、executor、resolver、各画面のREDテストを先に追加する。 |
| Accessibility & UX | Pass | 暫定、retry、partial、再読み込みを状態通知する。 |
| Nostr実装方針 | Pass | relayを正本とし、009のread plan、relay実績、unknown状態を維持する。 |
| パフォーマンス | Pass | filterごとの購読を一つのmulti-filter購読へ置換する。 |

### Phase 1後

| Gate | Result | 設計確認 |
|---|---|---|
| Nostr正本 | Pass | 永続DBを追加しない。 |
| relay実績の分離 | Pass | 掲載投稿と参照先会話で別のread targetとcache keyを使う。 |
| timeoutの意味 | Pass | retry結果を合成し、最終EOSEだけを完了としてUIへ渡す。 |
| 画面責務 | Pass | 画面はfilter、relay URL、`NDKRelaySet`を直接組み立てない。 |
| filter結合 | Pass | 一つのplanのfilter配列を一つの`ndk.subscribe()`へ渡す。 |
| page分割不採用 | Pass | cursor、page state、filter上限を追加しない。 |

## Project Structure

### Documentation

```text
specs/017-discussion-read-executor/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── discussion-read-executor.md
```

### Source Code

```text
src/
├── app/
│   ├── settings/page.tsx
│   └── discussions/
│       ├── [naddr]/page.tsx
│       ├── [naddr]/edit/page.tsx
│       ├── [naddr]/moderators/page.tsx
│       └── manage/page.tsx
├── components/discussion/
│   ├── DiscussionContentDataProvider.tsx
│   ├── DiscussionManagementDataProvider.tsx
│   └── DiscussionTabLayout.tsx
├── lib/discussion/
│   ├── discussion-read-plan.ts
│   ├── discussion-moderation-snapshot.ts
│   ├── relay-candidate-selector.ts
│   ├── discussion-known-data-cache.ts
│   ├── discussion-reference-resolver.ts       # 追加
│   └── discussion-read-executor.ts            # 追加
└── lib/nostr/
    ├── discussion-ndk-gateway.ts
    └── nostr-service.ts
```

**Structure Decision**:既存の単一Next.jsアプリ構造を維持する。Discussion固有の新規ロジックは`src/lib/discussion`へ置く。NDKの単一購読修正は`src/lib/nostr/nostr-service.ts`へ限定する。

## 実装設計

### 1.Reference Resolver

1. `src/lib/discussion/discussion-reference-resolver.ts`を追加する。
2. `normalizeDiscussionId()`と`extractDiscussionFromNaddr()`を使う。
3. `q` tagの`34550:pubkey:dTag`を厳密に解析する。
4. 64桁hex pubkeyと空でないdTagだけを受け入れる。
5. 不正参照を結果から除外する。
6. 一意な参照ごとに`kind=34550`、`authors`、`#d`、`limit=1`のfilterを作る。
7. ResolverはNostr通信を実行しない。

### 2.Transportのmulti-filter化

1. `NostrService.collectEventsWithCompletion()`を変更する。
2. `for (const filter of filters)`を削除する。
3. `this.ndk.subscribe(filters, { closeOnEose: true, ... }, relaySet ?? true)`を一回呼ぶ。
4. EOSEは単一subscriptionの`onEose`で完了する。
5. idle timer、hard timer、event ID重複排除、source relay収集を維持する。
6. `eoseCount`とsubscriptions配列は単一subscription向けに簡素化する。
7. transport単体テストで、filter数が二件以上でも`subscribe`呼出が一回であることを固定する。

### 3.Executor

1. `src/lib/discussion/discussion-read-executor.ts`を追加する。
2. `DiscussionReadPlan`、候補入力、gatewayを受け取る。
3. `rankRelayCandidates()`で全候補を作る。
4. 先頭最大3件をfirst attemptへ渡す。
5. `queryWithCompletion(plan.filters, { relayUrls, idleTimeoutMs, hardTimeoutMs })`を呼ぶ。
6. attempt結果を`onAttemptComplete`で通知する。
7. 非EOSEかつ未試行候補がある場合だけ、次の最大3件を一度retryする。
8. events、source relay、attempted relayをevent IDとURLで重複排除して合成する。
9. retryがEOSEなら最終reasonを`eose`にする。
10. retryが非EOSEなら最終reasonをそのreasonにする。
11. executorは`q` tag、naddr、ID文字列を解析しない。

### 4.Read planとcache境界

1. `discussion-read-plan.ts`を、複数filterのplanを表せるまま拡張する。
2. 参照先会話用のplan作成をResolverの結果へ接続する。
3. 掲載投稿readと参照先会話readで別のtargetとknown-data keyを使う。
4. `attemptedRelayUrls`と`successfulEventRelayUrls`を混同しない。
5. retryが空結果でも既知eventsを削除しない。

### 5.全画面の移行

次の経路から直接gatewayまたは`NostrService`を呼ぶ処理をexecutorへ置換する。

| Area | Current responsibility | Migration |
|---|---|---|
| `/discussions` | `DiscussionManagementDataProvider`が掲載投稿、承認、参照先会話を読む | moderation snapshotと参照先会話readをexecutor経由にする。Resolverで`q` tagをbatch filterへ変換する。 |
| `/discussions/manage` | 同Providerが未承認参照も読む | 一覧と同じread結果を共有し、管理固有の掲載判定だけを残す。 |
| `/settings` | author別kind 34550を直接queryする | author用read planとexecutorを使う。暫定eventsとretry状態を表示する。 |
| Discussion detail | `DiscussionTabLayout`がmetadataを直接queryする | metadata planをexecutorへ渡す。 |
| Detail posts and approval | `DiscussionContentDataProvider`が投稿と承認を読む | moderation snapshotのreadをexecutorへ切り替える。 |
| Detail evaluations | `[naddr]/page.tsx`がevaluationを直接queryする | evaluation planをexecutorへ渡す。 |
| Edit | `[naddr]/edit/page.tsx`のmetadata読取 | metadata planをexecutorへ渡す。 |
| Moderators | `[naddr]/moderators/page.tsx`のmetadata読取 | metadata planをexecutorへ渡す。 |

### 6.UI状態

1. 画面はfirst attempt完了時にeventsを描画する。
2. retry中は暫定状態を`role="status"`と`aria-live="polite"`で通知する。
3. 最終EOSEは警告を消す。
4. 最終非EOSEは既存eventsを残し、再読み込み操作を表示する。
5. 再読み込み操作は44px以上にする。
6. read generationまたはunmount後のcallbackはstateを更新しない。

## REDテスト計画

1. `src/lib/nostr/__tests__/nostr-service.test.ts`
   - 二つのfilterで`ndk.subscribe()`が一回だけ呼ばれる。
   - `onEose`一回でmulti-filter attemptをEOSE完了にする。
   - source relay、重複、timeoutを維持する。
2. `src/lib/discussion/__tests__/discussion-reference-resolver.test.ts`を追加する。
   - 有効`q` tagをcanonical referenceへ変換する。
   - malformed pubkey、空dTag、kind違いを除外する。
   - 重複参照を一つのfilterにする。
3. `src/lib/discussion/__tests__/discussion-read-executor.test.ts`を追加する。
   - 候補順位と最大3relayを使う。
   - 非EOSE時だけsecond attemptを一度実行する。
   - EOSEでretryしない。
   - 初回eventsとretry eventsを結合する。
   - retry EOSEを最終EOSEにする。
4. `src/components/discussion/__tests__/DiscussionManagementDataProvider.test.tsx`
   - 掲載投稿の複数`q` tagを一つのbatch planにする。
   - 初回timeoutで空一覧を確定しない。
5. `src/app/settings/__tests__/page.streaming.test.tsx`
   - author readがexecutor経由になる。
   - retry中の暫定表示とEOSE後の状態を確認する。
6. `src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`と既存edit、moderators、manageテスト
   - 各画面が直接gatewayを呼ばずexecutorを使う。
   - 状態通知と再読み込み操作を確認する。

## 実装順

1. RED:transportのmulti-filterテストを追加する。
2. GREEN:NDK単一購読へ修正する。
3. RED:ResolverとExecutorの単体テストを追加する。
4. GREEN:Resolver、Executor、result合成を実装する。
5. RED:`/discussions`の掲載済み参照欠落回帰テストを追加する。
6. GREEN:Management Providerとsnapshotを移行する。
7. RED/GREEN:設定、詳細、承認、編集、管理を一画面群ずつ移行する。
8. 全回帰、lint、型検査、build、手動relay fixtureを実行する。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| ExecutorとResolverの二つの新規モジュール | 通信、候補選別、入力検証を分離する。 | 一つの巨大なhelperでは画面固有の参照規則と通信規則が再結合する。 |
