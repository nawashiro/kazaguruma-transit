## Why

`docs/`、`issues/`、`archive/v2/`に、現行の入口、外部から取り込んだ原文、調査・Issue作業の履歴が混在している。OpenSpecの標準手順を重複して説明する`docs/how-to/development-workflow.md`も、現行のREADME、CI、CLIから独立した正本になっていない。

今回、もう使用しない外部資料と作業記録を現行ツリーから分離し、現行文書の入口を小さくする。

## What Changes

- **BREAKING** `docs/how-to/development-workflow.md`を削除する。
- README、`AGENTS.md`、現行文書から削除対象への入口を除去する。
- **BREAKING** `docs/accessibility/Understanding/`を`external-docs/accessibility/Understanding/`へ移動する。
- **BREAKING** `docs/discussion/`を`external-docs/discussion/`へ移動する。
- **BREAKING** `docs/records/`の全資料を`archive/v1/`へ移動する。
- **BREAKING** `issues/`の全資料を`archive/v3/issues/`へ移動する。
- 外部原文、履歴資料、Issue作業資料の本文は変更しない。
- 現行文書の相対リンクだけを新しい外部資料パスへ更新する。
- `archive/v2/`と完了済みOpenSpec changeの成果物は変更しない。
- READMEに残る`docs//constitution.md`の参照を現行の`docs/reference/constitution.md`へ修正する。

## Capabilities

### New Capabilities

- なし。これは製品動作を変更しないdocs-onlyの配置整理である。

### Modified Capabilities

- なし。外部API、画面挙動、開発時の実行契約を変更しない。

## Impact

- README、`AGENTS.md`、現行`docs/reference/`のリンクと文書案内を変更する。
- `external-docs/`、`archive/v1/`、`archive/v3/issues/`を新しい資料保管先として追加する。
- 旧パスへのリポジトリ内リンクは、現行文書の範囲で新パスへ置換する。凍結したアーカイブと移動後の履歴本文は対象外とする。
- アプリケーション実装、テスト、依存関係、生成artifact、workflow、外部Issue、Pull Request、リモート状態は変更しない。
