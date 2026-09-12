## Purpose

このCapabilityは、リポジトリの現行文書を読者の目的ごとに分類し、実装と一致する正本・入口・開発規約を提供する。履歴資料と外部原文を現行仕様と混同させない。

## ADDED Requirements

### Requirement: 現行文書は目的別に配置する

現行のチュートリアル、作業手順、事実の参照、設計意図を示す文書は、それぞれ`docs/tutorials/`、`docs/how-to/`、`docs/reference/`、`docs/explanation/`のいずれかに配置することをMUSTとする。履歴の記録は`docs/records/`に配置し、現行の手順や仕様として扱ってはならない。

#### Scenario: 新しい現行文書を追加する

- **WHEN** 執筆者が現行文書を追加または移動する
- **THEN** 文書を内容に対応する目的別ディレクトリへ配置する

#### Scenario: 履歴資料を参照する

- **WHEN** 読者が調査報告、ログ、レビューを参照する
- **THEN** 文書を現行の手順や仕様と区別できる

### Requirement: 現行文書は正本と一致する

現行文書は、実装、設定、生成物、workflowが提供する現在の動作とコマンドだけを現行機能として記述することをMUSTとする。未実装、廃止済み、または履歴上の内容は、その状態を明示しなければならない。

#### Scenario: 実装と文書を照合する

- **WHEN** 保守者が現行文書の機能または手順を確認する
- **THEN** 文書の記述を対応する実装、設定、生成物、workflowと照合できる

#### Scenario: 廃止済みの参照を読む

- **WHEN** 文書が廃止済みの実装、設定、ルートを扱う
- **THEN** 文書は内容を現行機能として表示せず、履歴または廃止を明示する

### Requirement: 現行文書の入口を提供する

READMEは、プロジェクトの目的、clone URL、前提環境、初回準備、最初の検証、作業branch、目的別の文書入口を提供することをMUSTとする。詳細な設計仕様や履歴をREADMEへ重複して記載してはならない。

#### Scenario: 初参加者が作業を開始する

- **WHEN** 初参加者がREADMEの先頭から作業を開始する
- **THEN** 前提環境を準備し、初回検証を実行し、`dev`から作業branchを作る入口を見つけられる

#### Scenario: 目的別の文書を探す

- **WHEN** 読者が開発、運用、仕様、設計の詳細を探す
- **THEN** READMEから対応する文書へ移動できる

### Requirement: 現行の開発規約を一つの正本にする

`docs/reference/constitution.md`は、KISS、TDD、Accessibility、プロジェクトの範囲を現行の開発原則として提供することをMUSTとする。憲章は旧Spec Kitの正本関係、作業言語、検証スコープ、技術スタック一覧、ドメイン実装詳細を重複して保持してはならない。

#### Scenario: エージェントが開発原則を読む

- **WHEN** エージェントまたは開発者が開発原則を確認する
- **THEN** `AGENTS.md`から現行憲章へ移動でき、旧憲章を現行の正本として扱わない

#### Scenario: 開発原則と実装詳細を区別する

- **WHEN** 読者が技術スタックまたはドメイン仕様を確認する
- **THEN** `docs/reference/technology-stack.md`または対応するドメインreferenceへ移動できる

### Requirement: 現行文書のリンクを維持する

現行文書内の相対リンクは、現行ツリーに存在する対象または明示された公式URLを参照することをMUSTとする。凍結した外部原文と`archive/v2/`の履歴リンクは、この要件の対象外として明示しなければならない。

#### Scenario: 文書を移動する

- **WHEN** 保守者が現行文書のパスを変更する
- **THEN** 現行文書、README、作業手順、OpenSpec成果物の参照リンクを更新する

#### Scenario: リンクを検査する

- **WHEN** 保守者が現行文書のリンクを検査する
- **THEN** 凍結範囲を除く相対リンクが存在する対象または公式URLへ解決する

### Requirement: 外部原文と履歴資産を保全する

`archive/v2/**`と、リポジトリに保存した外部原文（`docs/accessibility/Understanding/**`、NIP原文、`docs/discussion/nosskey.md`、`docs/discussion/nostr-tools.md`）の本文・パスは変更してはならない。これらを現行の製品仕様、開発手順、正本として案内しないことをMUSTとする。

#### Scenario: 旧Spec Kit資産を参照する

- **WHEN** 読者が`archive/v2/`を開く
- **THEN** 資産を履歴資料として扱い、現行OpenSpecの入口と混同しない

#### Scenario: 外部原文を参照する

- **WHEN** 読者が保存された外部原文を読む
- **THEN** 原文の内容をプロジェクト固有の現行仕様と混同しない
