# Implementation Plan: 会話タブナビゲーション修正

**Branch**: `001-discussion-nav-tabs` | **Date**: 2026-01-18 | **Spec**: /root/nawashiro/kazaguruma-transit/specs/001-discussion-nav-tabs/spec.md
**Input**: Feature specification from `/specs/001-discussion-nav-tabs/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

会話詳細ページのタブレイアウト内に承認/編集リンクを条件付きで配置し、旧ブロック表示と「会話に戻る」導線を撤去する。説明ブロックは常時表示し、作成者・モデレーター・ユーザーの条件に応じた文面へ切り替える。

## Technical Context

**Language/Version**: TypeScript 5
**Primary Dependencies**: Next.js 15, React 19, Tailwind CSS 4, DaisyUI 5
**Storage**: SQLite + Prisma ORM (既存)
**Testing**: Jest + React Testing Library
**Target Platform**: Web (モダンブラウザ)
**Project Type**: Webアプリ (Next.js App Router)
**Performance Goals**: 会話関連の主要な画面遷移が2秒以内に完了する
**Constraints**: API応答はp95で200ms以内、UIはWCAG 2.1 AAに準拠
**Scale/Scope**: 会話詳細/編集/承認ページのナビゲーション変更に限定

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [x] **明確な命名**: 新規作成される変数・関数・コンポーネント名は意図が明確か?
- [x] **シンプルなロジック**: 複雑なロジックは小さな関数に分解される設計か?
- [x] **構造化された整理**: ファイルは適切なディレクトリ(`src/lib/`, `src/components/`等)に配置されるか?
- [x] **型安全性**: TypeScript strict モードで型定義が明確か? `any` は使用されないか?
- [x] **テスト駆動開発**: テストファーストで開発される計画か? (仕様に基づくテストのみ)
- [x] **アクセシビリティ**: UIコンポーネントはWCAG 2.1 AA基準を満たすか? (ARIA属性、44px×44pxタッチターゲット)
- [x] **適切なコメント**: 「なぜ」を説明するコメント、JSDocが計画されているか?

### 技術制約チェック

- [x] **パフォーマンス**: API応答は95パーセンタイルで200ms以内に収まる設計か?
- [x] **データベース**: Prisma ORMとSQLiteの制約内で実装可能か?
- [x] **Nostr統合**: 既存のNIP-72/NIP-25実装と整合性があるか? (ディスカッション機能の場合)

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [x] `npx tsc --noEmit` - TypeScript型チェック
- [x] `npm run lint` - ESLint
- [x] `npm test` - Jestテスト
- [x] `npm run build` - ビルド確認

## Project Structure

### Documentation (this feature)

```text
specs/001-discussion-nav-tabs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── discussions/
│       └── [naddr]/
│           ├── layout.tsx
│           ├── page.tsx
│           ├── edit/
│           │   └── page.tsx
│           └── approve/
│               └── page.tsx
├── components/
│   └── discussion/
│       ├── DiscussionTabLayout.tsx
│       └── __tests__/
│           └── DiscussionTabLayout.test.tsx
└── lib/
    └── discussion/
        └── __tests__/
```

**Structure Decision**: Next.js App Router の単一プロジェクト構成に従い、会話関連のUIは `src/app/discussions` と `src/components/discussion` に集約する。

## Complexity Tracking

違反なし。

## Phase 0: Outline & Research

### Research Tasks

- 既存の権限判定とタブナビゲーションの実装位置を調査し、変更点を最小化する
- 旧ブロック表示と「会話に戻る」導線の出現箇所を洗い出す

### Output

- `research.md` を作成し、判断内容と理由を整理する

## Phase 1: Design & Contracts

### Data Model

- 既存の「会話」と「ユーザー権限」を利用し、データモデルの追加・変更は行わない

### API Contracts

- 新規APIは追加しないため、契約変更はなしと明示する

### Quickstart

- 変更点の確認手順とテストコマンドを記載する

### Agent Context Update

- `.specify/scripts/bash/update-agent-context.sh codex` を実行して文脈を更新する

## Constitution Check (Post-Design)

- [x] 主要な設計判断は憲章の原則に準拠している
- [x] 追加の複雑性は発生していない

## Phase 2: Implementation Planning

- タブレイアウト内リンクの差し込み位置、説明ブロックの常時表示化、旧導線撤去の順で作業分解する
- 既存テストの追加・更新対象を明確化する
