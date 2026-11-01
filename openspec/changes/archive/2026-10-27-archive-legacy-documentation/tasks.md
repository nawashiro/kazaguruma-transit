## 1. 計画成果物と対象範囲

- [x] 1.1 `proposal.md`、`design.md`、`tasks.md`、`.openspec.yaml`を読み直し、docs-only changeとして`skip_specs: true`が設定され、`archive/v2/`と実装領域がNon-Goalsに含まれることを確認する。
- [x] 1.2 `docs/accessibility/Understanding/`、`docs/discussion/`、`docs/records/`、`issues/`の移動対象一覧を取得し、対象外の`archive/v2/`と完了済みOpenSpec成果物がmanifestに混入していないことを確認する。

## 2. 開発入口の削除

- [x] 2.1 `docs/how-to/development-workflow.md`を削除し、`AGENTS.md`と`README.md`から同ファイルへのリンクを除去する。検索結果に現行文書からの参照が残らず、`archive/v2/`と完了済みOpenSpec成果物は変更されていないことを確認する。
- [x] 2.2 `README.md`の`docs//constitution.md`を`docs/reference/constitution.md`へ修正する。対象ファイルが存在し、READMEの該当リンクが解決することを確認する。

## 3. 外部資料の移動

- [x] 3.1 `docs/accessibility/Understanding/`を`external-docs/accessibility/Understanding/`へ`git mv`する。移動前後のファイル一覧、ファイルサイズ、SHA-256が一致し、外部原文本文に差分がないことを確認する。
- [x] 3.2 `docs/discussion/`を`external-docs/discussion/`へ`git mv`する。NIP原文、`nosskey.md`、`nostr-tools.md`の本文に差分がなく、元ディレクトリが残っていないことを確認する。
- [x] 3.3 `docs/reference/accessibility/wcag-22-checklist.md`と`docs/reference/accessibility/web-accessibility-policy.md`の現行参照を新しい`external-docs/accessibility/Understanding/`パスへ更新する。すべての現行リンクが移動先へ解決し、W3C公式URLは変更されていないことを確認する。

## 4. 履歴資料とIssue資料の移動

- [x] 4.1 `docs/records/`の全資料を`archive/v1/`へ`git mv`する。移動前後のファイル一覧、ファイルサイズ、SHA-256が一致し、履歴本文を改稿していないことを確認する。
- [x] 4.2 `issues/`の全資料を`archive/v3/issues/`へ`git mv`する。Issueディレクトリの階層、本文、実測証跡を保ち、移動前後のファイル一覧、ファイルサイズ、SHA-256が一致することを確認する。
- [x] 4.3 移動した履歴資料とIssue資料を現行作業入口として案内するリンクを追加しない。README、`AGENTS.md`、現行`docs/`に旧`issues/`入口がなく、`archive/v2/`内の履歴参照を変更していないことを確認する。
- [x] 4.4 `docs/reference/writing-style.md`の履歴資料の配置先を`archive/v1/`へ更新する。文書分類の現行説明が、外部資料の`external-docs/`と履歴資料のarchiveを区別していることを確認する。

## 5. 統合検証

- [x] 5.1 現行範囲（README、`AGENTS.md`、現行`docs/`、`.github/`、`openspec/`の未完了change）を対象に、削除した`docs/how-to/development-workflow.md`、旧`docs/accessibility/Understanding/`、旧`docs/discussion/`、旧`docs/records/`、旧`issues/`への意図しない参照を検索する。許可する旧パスは凍結した`archive/v2/`、`archive/v1/`、`archive/v3/`、完了済みchangeの記録だけとする。
- [x] 5.2 現行文書のMarkdown相対リンクを検査し、外部資料の新パスと現行referenceへのリンク切れがないことを確認する。archive配下の記録本文に残る旧リンクは履歴証拠として検査対象外にする。
- [x] 5.3 `npx -y @fission-ai/openspec@latest validate --all --json`を実行し、`archive-legacy-documentation`の`skip_specs: true`を含む全changeがvalidateを通過することを確認する。
- [x] 5.4 `git diff --check`、`git status --short --untracked-files=all`、`git diff --name-status`を実行する。変更が計画した文書、リンク、移動先に限定され、`src/`、tests、package、Docker、workflow、CI、`archive/v2/`に差分がないことを確認する。
