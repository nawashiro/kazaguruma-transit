## Why

READMEと現行docsは、実装・設定・workflowの更新に追随できていない。誤ったコマンド、旧ルートや旧設定への参照、壊れた相対リンク、現行文書と履歴資料の混在があり、初参加者と保守者が正本を判断しにくい。文書を実装成果物として現行化し、文書体系と開発規約の入口を一本化する。

## What Changes

- `docs/reference/constitution.md`を現行の憲章として追加する。
- 憲章にはKISS、TDD、Accessibility、プロジェクトの範囲だけを残す。
- `docs/reference/writing-style.md`にDiátaxisと日本語文書の執筆規範を追加する。
- `docs/reference/technology-stack.md`に現行の技術スタックと主要な制約を整理する。
- 開発・運用手順を`docs/how-to/`へ移し、OpenSpecのタスクリストから参照できる形にする。
- 現行docsを`how-to`、`reference`、`explanation`、`records`へ分類し、実装とリンクを現行化する。
- READMEを目的、初回準備、最初の検証、作業入口、文書入口に整理する。
- `AGENTS.md`を憲章、執筆規範、開発手順、`openspec/`への参照だけに縮小する。
- `archive/v2/`と外部原文の本文は変更しない。
- 文書と実装・CIの不一致は、実装を変更せず、別Issue候補として記録する。

## Capabilities

### New Capabilities

- `documentation-governance`: 文書の分類、正本、入口、現行化の規約を定義する。

### Modified Capabilities

なし。

## Impact

- README、`AGENTS.md`、`docs/`の現行文書、OpenSpec変更成果物を変更する。
- 文書移動に伴い、リポジトリ内の現行参照リンクを更新する。
- アプリケーションの実装、依存関係、データ、workflow、CIの動作は変更しない。
- 旧Spec Kit資産と外部原文は履歴・参照資料として維持する。
