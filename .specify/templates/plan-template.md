# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

この機能は `.specify/memory/constitution.md` の原則に準拠していることを確認してください:

### 必須チェック項目

- [ ] **明確な命名**: 新規作成される変数・関数・コンポーネント名は意図が明確か?
- [ ] **シンプルなロジック**: 複雑なロジックは小さな関数に分解される設計か?
- [ ] **構造化された整理**: ファイルは適切なディレクトリ(`src/lib/`, `src/components/`等)に配置されるか?
- [ ] **型安全性**: TypeScript strict モードで型定義が明確か? `any` は使用されないか?
- [ ] **テスト駆動開発**: テストファーストで開発される計画か? (仕様に基づくテストのみ)
- [ ] **アクセシビリティ**: UIコンポーネントはWCAG 2.1 AA基準を満たすか? (ARIA属性、44px×44pxタッチターゲット)
- [ ] **適切なコメント**: 「なぜ」を説明するコメント、JSDocが計画されているか?

### 技術制約チェック

- [ ] **パフォーマンス**: API応答は95パーセンタイルで200ms以内に収まる設計か?
- [ ] **データベース**: Prisma ORMとSQLiteの制約内で実装可能か?
- [ ] **Nostr統合**: 既存のNIP-72/NIP-25実装と整合性があるか? (ディスカッション機能の場合)

### コミット前チェックリスト遵守

実装完了時に以下がすべて成功することを確認する計画があるか?
- [ ] `npx tsc --noEmit` - TypeScript型チェック
- [ ] `npm run lint` - ESLint
- [ ] `npm test` - Jestテスト
- [ ] `npm run build` - ビルド確認

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
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
