# Implementation Plan: ライセンス情報自動生成

**Branch**: `005-license-page-autogen` | **Date**: 2026-02-16 | **Spec**: `/root/nawashiro/kazaguruma-transit/specs/005-license-page-autogen/spec.md`
**Input**: Feature specification from `/specs/005-license-page-autogen/spec.md`

## Summary

ライセンスページを3セクション（本ソフトウェア / オープンデータ / 導入パッケージ）で自動生成する。
本ソフトウェア情報は `package.json` 由来とし、`name` `version` `license` `author` に加えて `repository` `funding` を表示対象にする（値がある場合のみ）。
オープンデータ情報はページ実装から分離したJSON管理に移行し、導入パッケージ情報はライセンス収集ツールのデフォルト挙動で収集する。
UIは既存スタイルを維持しつつ、可能な限り独自部品を増やさず DaisyUI 提供コンポーネントを優先利用する。

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15 (App Router)  
**Primary Dependencies**: DaisyUI 5, Tailwind CSS 4, webpack-license-plugin（導入パッケージライセンス収集）, Prisma（既存）  
**Storage**: 既存SQLite（本機能では新規永続化なし）、`package.json`、オープンデータ用JSONファイル  
**Testing**: Jest + React Testing Library、必要に応じてAPI routeのテスト  
**Target Platform**: Web（Next.js server/client rendering on Node.js）
**Project Type**: Web application（単一Next.jsプロジェクト）  
**Performance Goals**: ライセンスページ表示データの取得と整形はAPI側95パーセンタイル200ms以内  
**Constraints**: WCAG 2.1 AA、TypeScript strict、独自UI部品の増設を最小化してDaisyUIコンポーネント優先、導入パッケージ収集条件はツールデフォルトに一致  
**Scale/Scope**: 1ライセンスページ、3セクション、数十〜数百件の依存パッケージ表示を想定

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [x] **明確な命名**: `ProjectMetadata`, `OpenDataLicenseEntry`, `DependencyLicenseEntry` 等の命名で意図を固定
- [x] **シンプルなロジック**: 収集・整形・表示を分離し、変換ロジックを小関数化する設計
- [x] **構造化された整理**: `src/app/license`（表示）+ `src/lib`（収集/整形）+ `src/types`（型）+ データJSONの構成
- [x] **型安全性**: strict前提、`any` 不使用、JSON読み込み結果も型で検証
- [x] **テスト駆動開発**: ページ表示要件・データ変換要件の失敗テスト先行
- [x] **アクセシビリティ**: セクション見出し、リンクラベル、44pxタッチターゲットを満たす
- [x] **適切なコメント**: 収集仕様や欠落値の扱いに「なぜ」を残す

### 技術制約チェック

- [x] **パフォーマンス**: 表示データ取得の処理をキャッシュ/静的化可能な構成で200ms目標を満たせる
- [x] **データベース**: 新規DB変更なし、Prisma/SQLite制約に抵触しない
- [x] **Nostr統合**: ディスカッション機能ではないため既存Nostr実装へ影響なし

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [x] `npx tsc --noEmit` - TypeScript型チェック
- [x] `npm run lint` - ESLint
- [x] `npm test` - Jestテスト
- [x] `npm run build` - ビルド確認

## Project Structure

### Documentation (this feature)

```text
specs/005-license-page-autogen/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── license-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── license/
│   │   └── page.tsx
│   └── api/
│       └── licenses/
│           └── route.ts
├── components/
│   └── ui/
├── lib/
│   └── license/
├── types/
└── utils/

tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: 既存のNext.js単一プロジェクト構成を維持し、機能追加は `src/app/license` と `src/lib/license` へ閉じ込める。UIは既存 `src/components/ui` と DaisyUI クラス活用を優先し、新規コンポーネント作成は不可避な場合に限定する。

## Phase 0: Research Plan

1. `webpack-license-plugin` を使った依存ライセンス収集で、デフォルト設定準拠を満たす出力方式を確定する
2. `package.json` の `author` `repository` `funding` など可変形式フィールドの正規化方針を確定する
3. オープンデータJSONの最小スキーマと欠損時の表示方針を確定する
4. DaisyUIコンポーネント優先のUI構成方針（Card/List/Collapse等）を確定する

## Phase 1: Design Plan

1. データモデル定義（ProjectMetadata/OpenDataLicenseEntry/DependencyLicenseEntry/LicensePagePayload）
2. ライセンス表示取得APIコントラクト定義（GET /api/licenses）
3. TDDベース実装手順の quickstart 作成
4. agent context 更新

## Phase 2: Task Planning Approach

`/speckit.tasks` では以下を優先する:
- テスト先行タスク（変換ロジック、API、UIレンダリング）
- データソース分離タスク（オープンデータJSON移行）
- DaisyUI適用タスク（既存部品活用優先）
- 完了時検証タスク（tsc/lint/test/build）

## Post-Design Constitution Check

Phase 1成果物確認後の再評価結果: **PASS**（違反なし）
- TDD前提、型安全、アクセシビリティ、構造分離、DaisyUI優先方針を設計に反映済み
- 追加の複雑性正当化は不要

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| なし | N/A | N/A |
