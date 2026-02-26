# Tasks: Discussion NDK Migration

**Input**: Design documents from `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: この機能はspec/planでTDDが明示されているため、各ユーザーストーリーで先行テストタスクを含める。

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- [P]: Can run in parallel (different files, no direct dependency)
- [Story]: User story label ([US1], [US2], [US3])
- Every task includes explicit file path(s)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: NDK/DaisyUI移行に向けた初期整備と開発ガードの導入

- [X] T001 依存関係から `nostr-tools` を削除し `@nostr-dev-kit/ndk` を確認する in `/root/nawashiro/kazaguruma-transit/package.json`
- [X] T002 `nostr-tools` 再導入を防ぐ静的チェックコマンドを追加する in `/root/nawashiro/kazaguruma-transit/package.json`
- [X] T003 [P] Discussion用NDK境界ファイルを作成する in `/root/nawashiro/kazaguruma-transit/src/lib/nostr/discussion-ndk-gateway.ts`
- [X] T004 [P] Discussion監査DTOの型定義を追加する in `/root/nawashiro/kazaguruma-transit/src/types/discussion.ts`
- [X] T005 DaisyUI優先利用ポリシーをdiscussion実装ガイドに追記する in `/root/nawashiro/kazaguruma-transit/docs/discussion/spec_v2.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリー実装前に必要な共通基盤

**⚠️ CRITICAL**: このフェーズ完了までUS実装を開始しない

- [X] T006 NDK接続/購読/発行/署名の共通インターフェースを定義する in `/root/nawashiro/kazaguruma-transit/src/lib/nostr/discussion-ndk-gateway.ts`
- [X] T007 [P] Nostrイベント→表示用DTO変換（list/detail audit共通）を実装する in `/root/nawashiro/kazaguruma-transit/src/lib/discussion/audit-timeline-mapper.ts`
- [X] T008 [P] BIP39日本語ニーモニック先頭3フレーズ整形ユーティリティを実装する in `/root/nawashiro/kazaguruma-transit/src/lib/nostr/mnemonic-utils.ts`
- [X] T009 `src/lib/nostr` 外の `nostr-tools` 参照をNDK境界呼び出しへ置換する（auth/discussion/types） in `/root/nawashiro/kazaguruma-transit/src/lib/auth/auth-context.tsx` `/root/nawashiro/kazaguruma-transit/src/lib/discussion/user-creation-flow.ts` `/root/nawashiro/kazaguruma-transit/src/types/discussion.ts`
- [X] T010 会話一覧監査/会話詳細監査のイベント種別最小化ルール（requested/submitted）を共通化する in `/root/nawashiro/kazaguruma-transit/src/lib/discussion/audit-timeline-mapper.ts`
- [X] T011 [P] 権限なし操作の `disabled + 理由文` 表示ヘルパーを共通化する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/PermissionGuards.tsx`
- [X] T012 [P] Foundationの回帰テスト（nostr-tools不使用、mnemonic表示ルール）を追加する in `/root/nawashiro/kazaguruma-transit/src/lib/nostr/__tests__/nostr-service.test.ts` `/root/nawashiro/kazaguruma-transit/src/lib/discussion/__tests__/integration.test.ts`
- [X] T013 Foundation完了時点の型・lint・テストを通す in `/root/nawashiro/kazaguruma-transit` (run `npx tsc --noEmit && npm run lint && npm test`)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 会話を閲覧し投稿・評価する (Priority: P1) 🎯 MVP

**Goal**: 会話閲覧、投稿、評価をNDK経由で成立させる

**Independent Test**: 会話詳細へアクセスし、投稿作成後に承認済み投稿へ賛否評価できることを確認

### Tests for User Story 1 (write first, must fail first)

- [X] T014 [P] [US1] 会話一覧/詳細の表示契約テストを追加する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/__tests__/page.streaming.test.tsx` `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`
- [X] T015 [P] [US1] 投稿作成・評価フローのサービステストを追加する in `/root/nawashiro/kazaguruma-transit/src/lib/discussion/__tests__/integration.test.ts`
- [X] T016 [P] [US1] 承認済み投稿のみ評価対象かつ既存FR-008（合意形成分析）表示を維持するUIテストを追加する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/__tests__/EvaluationComponent.test.tsx` `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/__tests__/page.streaming.test.tsx`

### Implementation for User Story 1

- [X] T017 [US1] 会話一覧の取得ロジックをNDK境界経由へ移行する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/page.tsx`
- [X] T018 [US1] 会話詳細の取得ロジックをNDK境界経由へ移行しつつ既存FR-008分析呼び出し（`evaluationService.analyzeConsensus`）を再利用する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/page.tsx`
- [X] T019 [P] [US1] 投稿作成のイベント組み立て（kind:1111優先、kind:1後方互換読取）を実装する in `/root/nawashiro/kazaguruma-transit/src/lib/discussion/user-creation-flow.ts`
- [X] T020 [P] [US1] 投稿評価（NIP-25 kind:7）の送信処理を実装する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/EvaluationComponent.tsx`
- [X] T021 [US1] 会話詳細の投稿表示で承認済みのみ表示するフィルタを実装する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/BusStopDiscussion.tsx`
- [X] T022 [US1] 未ログイン時の投稿/評価操作にログイン導線を統一する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/LoginModal.tsx`
- [X] T023 [US1] ローディング/空/エラー状態を会話一覧・詳細・合意形成分析表示に適用する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/DiscussionTabLayout.tsx` `/root/nawashiro/kazaguruma-transit/src/components/discussion/BusStopDiscussion.tsx` `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/page.tsx`

**Checkpoint**: US1 should be fully functional and independently testable

---

## Phase 4: User Story 2 - 会話を作成し後から掲載申請する (Priority: P2)

**Goal**: 会話作成と掲載申請の分離、および編集画面からの掲載申請

**Independent Test**: 会話作成後に編集画面から掲載申請が生成されることを確認

### Tests for User Story 2 (write first, must fail first)

- [X] T024 [P] [US2] 会話作成画面のUUID非入力・作成成功表示テストを追加する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/create/__tests__/page.test.tsx`
- [X] T025 [P] [US2] 編集画面からの掲載申請発行テストを追加する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/edit/__tests__/page.test.tsx`
- [X] T026 [P] [US2] 掲載申請イベント（kind:1111 + a/q）の契約テストを追加する in `/root/nawashiro/kazaguruma-transit/src/lib/nostr/__tests__/nostr-service.test.ts`

### Implementation for User Story 2

- [X] T027 [US2] 会話作成で内部UUID生成・ユーザー非表示を徹底する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/create/page.tsx`
- [X] T028 [US2] 作成成功時に会話URLと開始案内を表示する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/create/page.tsx`
- [X] T029 [US2] 掲載申請発行ロジック（kind:1111 + a/q）を実装する in `/root/nawashiro/kazaguruma-transit/src/lib/discussion/user-creation-flow.ts`
- [X] T030 [US2] 編集画面の掲載申請操作を作成者限定で実装する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/edit/page.tsx`
- [X] T031 [US2] 一覧管理画面で掲載申請の承認/撤回（NIP-09 kind:5）を実装する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/manage/page.tsx`
- [X] T032 [US2] 会話一覧機能無効時のナビゲーション非表示を設定連動で実装する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/layout.tsx` `/root/nawashiro/kazaguruma-transit/src/lib/config/discussion-config.ts`

**Checkpoint**: US2 should be fully functional and independently testable

---

## Phase 5: User Story 3 - 全ユーザー公開の承認・監査画面で役割に応じて操作する (Priority: P3)

**Goal**: 承認/監査の全員閲覧、会話編集画面でのモデレーター申請管理、監査の修飾表示

**Independent Test**: 全員閲覧・権限制御・監査10件ページング・承認者ニーモニック修飾表示を確認

### Tests for User Story 3 (write first, must fail first)

- [X] T033 [P] [US3] 承認画面の権限別UI（disabled + 理由文）テストを追加する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/approve/__tests__/page.streaming.test.tsx`
- [ ] T034 [P] [US3] 会話一覧監査/会話詳細監査の10件ページングテストを追加する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/audit/__tests__/page.test.tsx` `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/audit/__tests__/page.test.tsx`
- [X] T035 [P] [US3] 会話編集画面のモデレーター管理表示/操作権限テストを追加する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/edit/__tests__/page.streaming.test.tsx`
- [ ] T036 [P] [US3] 監査修飾（approvedByMnemonic: BIP39日本語3語）テストを追加する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/__tests__/AuditLogSection.test.tsx`

### Implementation for User Story 3

- [X] T037 [US3] 承認画面を全ユーザー閲覧可能にし承認操作は権限者のみに制御する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/approve/page.tsx`
- [ ] T038 [US3] 権限なしユーザー向けの操作不能UI（disabled + 理由文）を全承認操作に適用する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/PermissionGuards.tsx`
- [X] T039 [US3] モデレーター昇格申請の作成（kind:1111 + a/p + t=moderator-request）を実装する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/edit/page.tsx`
- [X] T040 [US3] 会話編集画面で昇格申請一覧取得API連携を実装する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/edit/page.tsx`
- [ ] T041 [US3] 会話編集画面で現在モデレーター一覧（BIP39日本語3語）表示を実装する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/DiscussionTabLayout.tsx`
- [X] T042 [US3] 会話作成者のみモデレーター追加/削除可能な操作制御を実装する in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/edit/page.tsx`
- [ ] T043 [US3] 昇格審査でkind:34550モデレーター集合更新（approved/unapproved）を実装する in `/root/nawashiro/kazaguruma-transit/src/lib/nostr/discussion-ndk-gateway.ts`
- [ ] T044 [US3] 会話一覧監査を `listing-requested/promotion-requested` のみ表示にする in `/root/nawashiro/kazaguruma-transit/src/app/discussions/audit/page.tsx`
- [ ] T045 [US3] 会話詳細監査を `post-submitted/promotion-requested` のみ表示にする in `/root/nawashiro/kazaguruma-transit/src/app/discussions/[naddr]/audit/page.tsx`
- [ ] T046 [US3] 監査修飾情報（approvalState/approvedByPubkey/approvedByMnemonic）の導出を実装する in `/root/nawashiro/kazaguruma-transit/src/lib/discussion/audit-timeline-mapper.ts`
- [ ] T047 [US3] 監査UIで承認者ニーモニック（BIP39日本語3語）を表示する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/AuditLogSection.tsx` `/root/nawashiro/kazaguruma-transit/src/components/discussion/AuditTimeline.tsx`
- [ ] T048 [US3] 会話一覧監査/詳細監査の「さらに過去10件」読み込みと重複排除を実装する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/AuditLogSection.tsx`

**Checkpoint**: US3 should be fully functional and independently testable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー横断の品質担保と最終調整

- [ ] T049 [P] ドキュメント整合（spec/plan/data-model/contracts/quickstart）を更新する in `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/spec.md` `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/plan.md` `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/data-model.md` `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/contracts/openapi.yaml` `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/quickstart.md`
- [ ] T050 [P] `nostr-tools` 参照ゼロを再検証する in `/root/nawashiro/kazaguruma-transit` (run `rg -n "nostr-tools" src`)
- [ ] T051 パフォーマンス観点（監査10件ページング、UI応答p95）の確認結果を記録する in `/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/quickstart.md`
- [ ] T052 アクセシビリティ最終確認（disabled理由文、操作導線、44pxターゲット）を反映する in `/root/nawashiro/kazaguruma-transit/src/components/discussion/PermissionGuards.tsx` `/root/nawashiro/kazaguruma-transit/src/components/discussion/AuditLogSection.tsx`
- [ ] T053 型・lint・テスト・ビルドの最終検証を実施する in `/root/nawashiro/kazaguruma-transit` (run `npx tsc --noEmit && npm run lint && npm test && npm run build`)

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependency
- Foundational (Phase 2): depends on Phase 1
- User Stories (Phase 3-5): depend on Phase 2 completion
- Polish (Phase 6): depends on all selected user stories

### User Story Dependencies

- **US1 (P1)**: Foundational完了後すぐ着手可能（MVP）
- **US2 (P2)**: Foundational完了後に着手可能、US1非依存で独立テスト可能
- **US3 (P3)**: Foundational完了後に着手可能、US1/US2と並行可能だが監査UI統合時に調整が必要

### Within Each User Story

- テストタスクを先に作成して失敗確認（Red）
- DTO/モデル相当の整備 -> サービス/ゲートウェイ -> ページ/UI統合
- ストーリー単位で独立テストを完了してから次へ進む

### Parallel Opportunities

- Phase 1: T003, T004, T005
- Phase 2: T007, T008, T011, T012
- US1: T014, T015, T016, T019, T020
- US2: T024, T025, T026
- US3: T033, T034, T035, T036
- Polish: T049, T050

---

## Parallel Example: User Story 1

```bash
# Tests in parallel (US1)
T014 / T015 / T016

# Implementation in parallel after basic wiring
T019 / T020
```

## Parallel Example: User Story 2

```bash
# Tests in parallel (US2)
T024 / T025 / T026
```

## Parallel Example: User Story 3

```bash
# Tests in parallel (US3)
T033 / T034 / T035 / T036

# Audit implementation in parallel after mapper baseline
T044 / T045
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1-2
2. Complete Phase 3 (US1)
3. Validate US1 independently and demo

### Incremental Delivery

1. Add US2 and validate independently
2. Add US3 and validate independently
3. Run Phase 6 final quality gates

### Team Parallel Strategy

1. 共同でPhase 1-2を完了
2. 以降、担当分割
   - Dev A: US1
   - Dev B: US2
   - Dev C: US3
3. ストーリーごとに独立検証後に統合
