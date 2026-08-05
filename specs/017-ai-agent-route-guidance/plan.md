# Implementation Plan: AIエージェント向け経路案内

**Branch**: `017-ai-agent-route-guidance` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-ai-agent-route-guidance/spec.md`

## Summary

トップページの既存「非公式」案内カードの直後に、初期状態で閉じたAIエージェント向け案内カードを追加する。既存の `Card` を外枠に用い、その中に DaisyUI の `collapse` スタイルを付与したネイティブの `details`／`summary` を置く。状態管理や新規データは追加せず、要件で指定された3段階の案内と検索結果URL形式を静的に表示する。テストを先に追加し、配置、初期の閉じた状態、開閉、必要文言を検証する。

## Technical Context

**Language/Version**: TypeScript 5（strict）

**Primary Dependencies**: Next.js 15 App Router、React 19、Tailwind CSS 4、DaisyUI 5

**Storage**: N/A（静的な案内表示のみ）

**Testing**: Jest 29、React Testing Library、`@testing-library/user-event`

**Target Platform**: モダンブラウザで利用するレスポンシブWebページ

**Project Type**: Next.js Webアプリケーション

**Performance Goals**: 追加のネットワーク要求・クライアント状態・永続化を発生させず、既存トップページの表示経路を増やさない

**Constraints**: DaisyUI 5 の折りたたみを使用する。初期状態で案内本文全体を隠す。ネイティブHTMLの操作・状態通知を保ち、WCAG 2.2 AA の 1.4.10、2.1.1、2.4.7、4.1.2 に適合する。検索ロジック、URL生成ロジック、永続データは変更しない。

**Scale/Scope**: トップページ1ファイルとその既存ページテスト1ファイル。新規コンポーネント、API、型、DB変更は不要。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Before research | After design |
|------|-----------------|--------------|
| 明確な命名・単一責務 | PASS — 静的な案内は既存のページ内で完結し、新たな抽象化は不要 | PASS — `details` が開閉状態を担い、状態管理関数を追加しない |
| 型安全性 | PASS — 新しい動的データ・外部入力を導入しない | PASS — 既存の型境界を変更しない |
| TDD | PASS — 先にトップページの振る舞いテストを追加する | PASS — テスト対象は配置、初期状態、操作、案内内容に限定する |
| UI・データ層分離 | PASS — UI表示のみでデータ層に触れない | PASS — API、Prisma、Nostr、セッションストレージを変更しない |
| アクセシビリティ | PASS — 該当する WCAG 本文（1.4.10、2.1.1、2.4.7、4.1.2）を確認する | PASS — `details`／`summary` によりキーボード操作と開閉状態の公開をブラウザ標準に委ね、既存の `.collapse-title:focus-visible` を利用する |
| DaisyUI 規約 | PASS — 公式の現行 Collapse ドキュメントを調査する | PASS — `collapse`、`collapse-title`、`collapse-content` の現行構成を使用する。ボタンは追加しない |

複雑性の例外はない。

## Project Structure

### Documentation (this feature)

```text
specs/017-ai-agent-route-guidance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ai-agent-guidance-ui.md
└── tasks.md                         # /speckit-tasks で作成
```

### Source Code (repository root)

```text
src/
└── app/
    ├── page.tsx                     # 案内カードを既存の非公式案内カードの直後に追加
    └── __tests__/
        └── page.test.tsx            # トップページのカード表示・開閉を検証
```

**Structure Decision**: 既存のトップページ固有の静的案内であり、再利用するドメインロジックや状態がないため、`src/app/page.tsx` に留める。テストは同ページに対応する既存の `src/app/__tests__/page.test.tsx` に追加する。

## Complexity Tracking

該当なし。新規プロジェクト、抽象化、状態管理、データ永続化を導入しない。
