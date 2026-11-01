## Context

現在の`docs/`には、現行手順、製品仕様、設計意図、調査記録、外部原文が関心領域別に混在している。現行文書には実装と一致しないコマンド、ルート、設定、外部参照、相対リンクがある。ルートの`AGENTS.md`には、旧憲章と重複する原則、feature固有の技術情報、古いOpenSpec移行前提が混在している。

`docs/accessibility/Understanding/`の外部原文と`archive/v2/`の旧資産は履歴・参照資料として凍結する。アプリケーション実装、package、workflow、CIは今回変更しない。

## Goals / Non-Goals

**Goals:**

- 現行文書をDiátaxisの目的別ディレクトリへ整理する。
- `constitution`、文書執筆規範、技術スタック、開発手順の正本を分ける。
- READMEを初参加者と保守者の入口へ整理する。
- 現行文書の実装・設定・workflow参照と相対リンクを現行化する。
- `AGENTS.md`を正本への最小限の参照へ縮小する。
- 調査報告、ログ、レビューを現行仕様と区別する。

**Non-Goals:**

- アプリケーション実装、package.json、package-lock.jsonの変更。
- GitHub Actions workflow、CI、Docker、生成処理の動作変更。
- `archive/v2/**`の編集。
- `docs/accessibility/Understanding/**`や保存したNIP原文など、外部原文本文の編集。
- 実装側の生成artifact不足、GTFS importの終了コード、設定契約の分散などの修正。
- 外部サービス、リモートbranch、Issue、Pull Requestの変更。

## Decisions

### 現行憲章を短い正本にする

`docs/reference/constitution.md`を新しい現行正本にする。旧憲章からKISS、TDD、Accessibility、プロジェクトの範囲を再編集する。Sync Impact Report、作業言語、検証スコープ、Governance、技術スタック一覧、Nostr・Passkeyの詳細は含めない。

作業言語とOpenSpec成果物の形式は`openspec/config.yaml`に任せる。技術スタックは`docs/reference/technology-stack.md`へ、開発手順とタスク作成時の参照方法は`docs/how-to/development-workflow.md`へ置く。

### 文書の目的別ディレクトリを導入する

次のディレクトリを現行文書の入口にする。

- `docs/tutorials/`: 初学者が学習を完了する文書。現時点で新規作成しない。
- `docs/how-to/`: 開発、Docker、Analytics、SEO、ライセンスなどの目的達成手順。
- `docs/reference/`: 憲章、文書規範、技術スタック、現行仕様、アクセシビリティ、Nostr統合の事実。
- `docs/explanation/`: フロントエンド設計、評価アルゴリズム、設計判断の背景。
- `docs/records/`: 調査、ログ、レビュー、廃止仕様などの履歴資料。

`docs/accessibility/Understanding/**`、保存したNIP原文、`docs/discussion/nosskey.md`、`docs/discussion/nostr-tools.md`は、外部原文の例外として現在の場所と本文を維持する。例外は文書入口で現行仕様と区別する。

### 現行文書の移動と現行化を分ける

移動だけで内容が現行化されたとは扱わない。各文書を実装、設定、生成物、workflowと照合し、現行・履歴・未実装を区別してから移動する。

代表的な移動先は次のとおり。

- 開発handoffと`manual/`、ライセンス保守 → `docs/how-to/`
- 憲章、執筆規範、技術スタック、現行の画面・会話・評価契約 → `docs/reference/`
- フロントエンド設計、Polis解説、whitepaper → `docs/explanation/`
- 調査報告、ログ、レビュー、旧仕様、KISSレビュー → `docs/records/`

移動対象の全パスと削除・統合方針は`tasks.md`のmanifestで固定する。現行文書、README、Issue文書以外の履歴資料については、リンク修正の必要性を個別に判定する。

### READMEとAGENTSを入口に限定する

READMEには目的、前提、初回準備、検証、branch、文書入口を置く。アーキテクチャやドメイン仕様の詳細は対応するreferenceまたはexplanationへ移す。

`AGENTS.md`は、constitution、writing-style、development-workflow、technology-stack、`openspec/`へのリンクだけを置く。TDDやAccessibilityの本文を重複させない。

### 実装側の不整合は文書で隠さない

READMEや手順が実装の不足を発見した場合、存在しない成功経路を記述しない。現行の実際の前提を記述し、実装修正が必要な項目は別Issue候補として記録する。

## Risks / Trade-offs

- **[Risk]** 文書移動で外部からの古いGitHub URLが参照できなくなる。→ **Mitigation:** リポジトリ内の現行リンクを一括更新し、入口文書には新しい正規URLを置く。古いURLの互換性は保証しない。
- **[Risk]** 外部原文の見出しやリンクが執筆規範と一致しない。→ **Mitigation:** 外部原文を凍結例外として明示し、現行文書のリンク検査から分離する。
- **[Risk]** 移動と本文改稿を同時に行うと、意図しない仕様変更を見落とす。→ **Mitigation:** tasksのmanifestで移動、統合、削除、現行化を別タスクに分ける。
- **[Risk]** 実装側の問題を文書変更で覆い隠す。→ **Mitigation:** 実装との不一致を別Issue候補として記録し、今回のNon-Goalsに固定する。
- **[Risk]** READMEを短くしすぎて作業入口を失う。→ **Mitigation:** clone、Node.js 22、設定、初回検証、branch、目的別リンクをQuick startに残す。

## Migration Plan

1. OpenSpecのproposal、spec、design、tasksで移動manifestと正本を固定する。
2. 現行docsを目的別ディレクトリへ移動し、統合・削除対象を記録する。
3. `constitution`、writing-style、technology-stack、development-workflowを作成または更新する。
4. README、AGENTS、現行文書のリンクを更新する。
5. 現行文書のリンク、旧参照、見出し、OpenSpec成果物を検査する。
6. OpenSpecのvalidateと`git diff --check`を実行し、変更範囲を確認する。

## Open Questions

なし。
