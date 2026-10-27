## Context

前回の`modernize-documentation`でDiátaxis分類と現行文書の入口を整えたが、その後も次の資料が現行ツリーに残っている。

- W3C WCAG Understandingの保存原文
- Nostr NIP、`nosskey`、`nostr-tools`の外部資料
- 調査、レビュー、旧仕様の履歴資料
- Issueごとの調査、仕様、計画、タスク、検証記録
- OpenSpec標準の流れとプロジェクト固有の検証手順を混在させた開発ワークフロー

外部原文と履歴資料は参照用であり、現行仕様や現行手順の入口ではない。今回の変更は物理的な配置と現行リンクの整理だけを扱う。

## Goals / Non-Goals

**Goals:**

- 現行`docs/`から外部原文と使用しない作業資料を分離する。
- 外部原文を`external-docs/`という名前で識別できるようにする。
- 履歴資料を`archive/v1/`、Issue作業資料を`archive/v3/issues/`へ集約する。
- 現行README、`AGENTS.md`、アクセシビリティ参照から旧パスを除去する。
- 移動対象の本文bytesを変更せず、移動と内容改稿を分離する。

**Non-Goals:**

- アプリケーション実装、テスト、package、Docker、workflow、CIの変更。
- OpenSpecやエージェントの標準手順を新しい現行how-toへ再記述すること。
- W3C、Nostr、SDK資料の翻訳、更新、要約、本文修正。
- `archive/v2/`、完了済み`modernize-documentation`成果物、GitHub Issue、Pull Requestの変更。
- GitHub上のIssueやPRをclose、merge、更新すること。

## Decisions

### 外部資料は`external-docs/`直下に置く

次の既存階層を保ったまま移動する。

```text
external-docs/
├── accessibility/
│   └── Understanding/
└── discussion/
```

`external-docs/`は、保存資料を製品仕様や現行の正本と混同しないための名前である。元の階層を保つことで、取り込み本文内の相対参照を不必要に変更しない。外部資料の本文は凍結する。

### 履歴資料とIssue資料を世代別archiveへ移す

`docs/records/*`は`archive/v1/`直下へ移す。`issues/*`は`archive/v3/issues/`へ移す。後者は現行作業として使用しないことが確定したため、IssueやPRのリモート状態に関係なくローカル資料のスナップショットとして扱う。移動はディレクトリ構造を保ち、Issue資料の本文と実測証跡を改稿しない。

移動後の履歴本文に残る旧パスや記録時点の状態は、履歴の証拠として保持する。現行リンク検査では`archive/v1/`、`archive/v2/`、`archive/v3/`を凍結範囲として扱う。

### 開発ワークフローは削除し、正本を分散させない

OpenSpecのproposal、spec、design、tasksの標準的な順序はCLIとエージェントが判断できる。プロジェクト固有の実行契約は、README、`.github/workflows/quality-gate.yml`、`package.json`、設定ファイルを正本とする。重複した`development-workflow.md`は削除する。

READMEと`AGENTS.md`から削除対象へのリンクを除去する。READMEの壊れた`docs//constitution.md`参照は、既存の正本`docs/reference/constitution.md`へ直す。

### 現行リンクだけを更新する

次の現行文書の外部資料参照を新パスへ更新する。

- `docs/reference/accessibility/wcag-22-checklist.md`
- `docs/reference/accessibility/web-accessibility-policy.md`
- `docs/reference/writing-style.md`

移動後の履歴本文、外部原文、`archive/v2/`、完了済みOpenSpec changeの成果物は更新しない。古いパスを履歴資料の証拠として残すことを許容する。

## Risks / Trade-offs

- **[Risk]** 旧GitHub URLや旧リポジトリパスから資料を探す利用者が迷う。→ **Mitigation:** 現行READMEとreference文書に新しい入口を置き、旧パスの互換コピーは作らない。
- **[Risk]** 凍結した履歴本文の相対リンクが新しい配置で解決しない。→ **Mitigation:** 履歴本文を改稿せず、archive配下を現行リンク検査から除外する。必要になった場合は別の履歴資料再構成changeで扱う。
- **[Risk]** Issue資料に記録された`open`状態が現行作業と誤認される。→ **Mitigation:** `archive/v3/issues/`を現行作業入口として案内せず、ローカル履歴スナップショットとして扱う。
- **[Risk]** 大量のrenameで外部原文の本文差分を見落とす。→ **Mitigation:** 移動前後のファイル一覧、サイズ、sha256を比較し、本文差分がないことを確認する。
- **[Risk]** 文書だけの変更で実装検証を過剰実行する。→ **Mitigation:** OpenSpec validate、リンク検査、diff hygieneを必須とし、実装回帰テストは変更範囲に応じて不要と判定する。

## Migration Plan

1. OpenSpecの計画成果物を完成させ、移動先と凍結範囲を固定する。
2. 移動前の対象ファイル一覧、bytes、sha256を保存または検証可能な形で取得する。
3. `git mv`で外部資料、履歴資料、Issue資料を指定先へ移動する。
4. README、`AGENTS.md`、現行reference文書の旧パスを更新する。
5. 旧現行パスの参照、リンク切れ、本文差分、変更範囲を検査する。
6. OpenSpec validateと`git diff --check`を実行し、アプリケーション領域に変更がないことを確認する。

Rollbackは、移動対象をGitのrename差分として元のディレクトリへ戻し、現行リンクを旧パスへ戻す。外部サービスへのrollbackは不要である。

## Open Questions

なし。
