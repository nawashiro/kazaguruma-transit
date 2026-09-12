# Implementation Plan: 監査ページリファクタリングと表示不具合修正

**Branch**: `001-audit-page-refactor` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-audit-page-refactor/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

監査画面でコンテンツが表示されない不具合を修正し、会話ページと監査ページを独立したURLを持つ別ページに分離する。主な技術的アプローチ：
1. ストリーミングの競合状態を解消（承認ストリームEOSE後に投稿ストリーム開始）
2. エラーハンドリングとログ出力を追加
3. Next.js App Routerのネストされたレイアウトを使用してタブナビゲーションを共通化
4. 監査ページでkind:34550を独自に取得するロジックを追加

## Technical Context

**Language/Version**: TypeScript 5 (strict mode)
**Primary Dependencies**: Next.js 15 (App Router), React 19, DaisyUI 5, Tailwind CSS 4, nostr-tools
**Storage**: N/A（Nostrリレーサーバーから直接取得）
**Testing**: Jest + React Testing Library
**Target Platform**: Web (デスクトップ・モバイル対応)
**Project Type**: web（Next.js App Router）
**Performance Goals**: 監査ページ初回表示3秒以内
**Constraints**: WCAG 2.1 AA準拠、キーボードアクセシブル、日本語UI
**Scale/Scope**: 既存ページのリファクタリング、新規2ページ追加（`/discussions/audit`、`/discussions/[naddr]/audit`）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [x] **明確な命名**: 新規作成される変数・関数・コンポーネント名は意図が明確か?
  - `loadDiscussionForAudit()` - 監査ページ用のDiscussion取得
  - `AuditPage` - 監査専用ページコンポーネント
  - `DiscussionTabLayout` - タブナビゲーション共通レイアウト
  - `isAuditDataError` - エラー状態の判定
- [x] **シンプルなロジック**: 複雑なロジックは小さな関数に分解される設計か?
  - 承認ストリーム → 投稿ストリームの順次実行を明確に分離
  - エラーハンドリングを独立した関数として抽出
- [x] **構造化された整理**: ファイルは適切なディレクトリ(`src/lib/`, `src/components/`等)に配置されるか?
  - `src/app/discussions/audit/page.tsx` - 会話一覧監査ページ
  - `src/app/discussions/[naddr]/audit/page.tsx` - 会話詳細監査ページ
  - `src/components/discussion/DiscussionTabLayout.tsx` - タブレイアウト
- [x] **型安全性**: TypeScript strict モードで型定義が明確か? `any` は使用されないか?
  - 既存の型定義（`Discussion`, `PostApproval`, `DiscussionPost`）を再利用
  - 新規のエラー状態型を追加
- [x] **テスト駆動開発**: テストファーストで開発される計画か? (仕様に基づくテストのみ)
  - 各ページの表示テスト
  - エラーハンドリングのテスト
  - タブナビゲーションのアクセシビリティテスト
- [x] **アクセシビリティ**: UIコンポーネントはWCAG 2.1 AA基準を満たすか? (ARIA属性、44px×44pxタッチターゲット)
  - タブにrole="tab", aria-selected属性
  - キーボードナビゲーション対応（Arrow, Tab, Enter）
  - 最小44px×44pxのタッチターゲット
- [x] **適切なコメント**: 「なぜ」を説明するコメント、JSDocが計画されているか?
  - ストリーミング順序変更の理由をコメント
  - エラーハンドリングの意図を説明

### 技術制約チェック

- [x] **パフォーマンス**: API応答は95パーセンタイルで200ms以内に収まる設計か?
  - N/A（Nostrリレーへの直接接続、バックエンドAPIなし）
- [x] **データベース**: Prisma ORMとSQLiteの制約内で実装可能か?
  - N/A（DBアクセスなし、Nostrリレーのみ使用）
- [x] **Nostr統合**: 既存のNIP-72/NIP-25実装と整合性があるか? (ディスカッション機能の場合)
  - 既存のNostrServiceを再利用
  - kind:34550, kind:4550, kind:1111/1の取得パターンを維持

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [x] `npx tsc --noEmit` - TypeScript型チェック
- [x] `npm run lint` - ESLint
- [x] `npm test` - Jestテスト
- [x] `npm run build` - ビルド確認

## Project Structure

### Documentation (this feature)

```text
specs/001-audit-page-refactor/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── discussions/
│       ├── page.tsx                    # 既存: 会話一覧ページ（メイン）
│       ├── layout.tsx                  # 既存: discussions共通レイアウト
│       ├── audit/
│       │   └── page.tsx                # 新規: 会話一覧監査ページ
│       └── [naddr]/
│           ├── page.tsx                # 既存: 会話詳細ページ（メイン）
│           ├── layout.tsx              # 既存 → 修正: タブナビゲーション追加
│           └── audit/
│               └── page.tsx            # 新規: 会話詳細監査ページ
├── components/
│   └── discussion/
│       ├── AuditLogSection.tsx         # 既存 → 修正: 独自のDiscussion取得追加
│       ├── AuditTimeline.tsx           # 既存: 変更なし
│       └── DiscussionTabLayout.tsx     # 新規: タブナビゲーションコンポーネント
└── lib/
    └── nostr/
        └── nostr-service.ts            # 既存: 変更なし（既存APIを使用）

tests/
├── app/
│   └── discussions/
│       ├── audit/
│       │   └── page.test.tsx           # 新規: 会話一覧監査ページテスト
│       └── [naddr]/
│           └── audit/
│               └── page.test.tsx       # 新規: 会話詳細監査ページテスト
└── components/
    └── discussion/
        ├── AuditLogSection.test.tsx    # 既存 → 追加: エラーハンドリングテスト
        └── DiscussionTabLayout.test.tsx # 新規: タブナビゲーションテスト
```

**Structure Decision**: Next.js App Routerの規約に従い、`audit/`サブディレクトリに新規ページを追加。タブナビゲーションは共通コンポーネントとして`src/components/discussion/`に配置。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

該当なし - すべての憲章チェック項目に準拠。
