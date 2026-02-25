# Implementation Plan: Discussion NDK Migration

**Branch**: `008-document-discussion-spec` | **Date**: 2026-02-25 | **Spec**: [/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/spec.md](/root/nawashiro/kazaguruma-transit/specs/008-document-discussion-spec/spec.md)
**Input**: Feature specification from `/specs/008-document-discussion-spec/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

既存discussion機能を、`nostr-tools`依存を全面廃止して`nostr-dev-kit (NDK)`へ移行する。Nostr通信責務はNDKへ集約し、UIはDaisyUIコンポーネントを第一選択とする。会話作成/掲載申請の分離、全ユーザー閲覧可能な承認・監査UI、10件単位の監査ログページング、昇格申請フローを維持したまま、NIP-01/18/25/72準拠動作をNDK APIで再構成する。FR-008（合意形成分析）は既存実装（`src/lib/evaluation/evaluation-service.ts`, `src/lib/evaluation/polis-consensus.ts`）を再利用し、新規アルゴリズム実装は行わない。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (strict), React 19, Next.js 15 App Router  
**Primary Dependencies**: `@nostr-dev-kit/ndk`, `nosskey-sdk`, DaisyUI 5 + Tailwind CSS 4, Prisma/SQLite（既存）  
**Storage**: Nostr relay群（イベント本体）、ブラウザローカル（Passkey/PWKキャッシュ）、SQLite（GTFS等既存アプリデータ）  
**Testing**: Jest + React Testing Library + TypeScript型チェック + ESLint  
**Target Platform**: Web（モダンブラウザ、モバイル含む）
**Project Type**: 単一Webアプリ（Next.jsモノリポ構成）  
**Performance Goals**: 既存要件維持（UI表示操作はp95 200ms内の体感応答、監査追加読込は1操作ごと10件）  
**Constraints**: `nostr-tools`利用禁止、Nostr責務はNDK優先、UI責務はDaisyUI優先、NIP-01/18/25/72整合性維持  
**Scale/Scope**: discussion関連のNostr連携層と依存UI/型/認証境界を対象（`src/lib/nostr`外への漏れを含め全面移行）

### NDK-First Communication Flow

1. UI（DaisyUIコンポーネント）でユーザー操作を受ける。  
2. Discussionユースケース層がNDKラッパーへ要求を渡す。  
3. NDKがRelay接続・購読・発行・シグナー連携（署名）を処理する。  
4. Relay応答イベントをNDKイベントモデルで受領し、アプリ用DTOへ変換する。  
5. UIへ状態反映（loading/empty/error/successを明示）。

境界ルール:
- UIは`kind/tag/filter`組み立てを直接持たない（NDK層へ委譲）。
- NDK責務（接続、サブスク、発行、イベント管理）を自前実装で侵害しない。
- DaisyUI責務（ボタン、タブ、モーダル、フォーム、バッジ、タイムライン等）を自前実装で侵害しない。
- 昇格申請は `kind:1111 + t=moderator-request + a/p`、一覧掲載申請は `kind:1111 + a/q` を最低判別条件として扱う。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [x] **明確な命名**: NDK境界とDiscussionユースケースを命名で分離（例: `DiscussionNdkGateway`, `ApprovalTimelineService`）
- [x] **シンプルなロジック**: relay接続、イベント変換、UI状態管理を分割し責務を単一化
- [x] **構造化された整理**: Nostr処理は`src/lib/nostr`配下へ収束し、UIは`src/components/discussion`へ維持
- [x] **型安全性**: `nostr-tools`の`Event`型依存を除去し、NDK型+アプリDTOへ移行
- [x] **テスト駆動開発**: 既存discussionテストを先に更新し、失敗確認後に実装移行する計画
- [x] **アクセシビリティ**: DaisyUIコンポーネント利用を前提に、ARIA属性/44pxタッチターゲットを維持
- [x] **適切なコメント**: NIP由来制約とNDK採用判断の「なぜ」をコメント/JSDocで補強

### 技術制約チェック

- [x] **パフォーマンス**: NDKの購読・バッファを活用し、10件単位読込で初期表示負荷を制御
- [x] **データベース**: discussion機能は主にrelay依存でありPrisma/SQLite制約を侵害しない
- [x] **Nostr統合**: NIP-72/NIP-25/NIP-18/NIP-01整合をNDKイベント生成/購読で維持

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [x] `npx tsc --noEmit` - TypeScript型チェック
- [x] `npm run lint` - ESLint
- [x] `npm test` - Jestテスト
- [x] `npm run build` - ビルド確認

**Gate Result (Pre-Research)**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── app/
│   ├── discussions/
│   └── settings/
├── components/
│   └── discussion/
├── lib/
│   ├── nostr/              # NDK統合の中核（漏れ込みを集約）
│   ├── discussion/
│   ├── auth/
│   └── config/
└── types/

__tests__/
src/**/__tests__/

specs/008-document-discussion-spec/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── openapi.yaml
```

**Structure Decision**: 既存Next.js単一プロジェクト構造を維持し、Nostr境界の再編対象を`src/lib/nostr`中心に限定する。`src/lib/nostr`外で`nostr-tools`型/機能を直接参照している箇所を徹底的に排除する。

## Phase 0 Research Output

- research.mdを作成し、以下を確定:
  - NDK機能マッピング（接続・購読・発行・署名・イベントモデル）
  - DaisyUIコンポーネント選定指針（Button/Tab/Modal/Form/Timeline/Pagination）
  - `nostr-tools`漏れ込み調査結果と移行方針
  - NIP-01/18/25/72への適合戦略

## Phase 1 Design & Contracts Output

- data-model.md: discussionドメインのイベント/表示/権限モデル更新
- contracts/openapi.yaml: UIアクションをREST契約として明文化（論理契約）
- quickstart.md: NDK移行実装/検証手順と通信フロー確認手順

## Post-Design Constitution Re-Check

- [x] NDK優先原則が設計に反映され、重複実装回避方針が明記されている
- [x] DaisyUI優先原則がUIコンポーネント方針に反映されている
- [x] テストファーストと最終4チェック（tsc/lint/test/build）が実行計画に含まれる
- [x] NIP整合性検証ポイント（kind/tag/filter）が契約とデータモデルで検証可能

**Gate Result (Post-Design)**: PASS

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
