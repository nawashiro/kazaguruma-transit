## 1. 正本と入口を作る

- [x] 1.1 `docs/reference/constitution.md`を新規作成し、旧憲章からKISS、TDD、Accessibility、プロジェクトの範囲だけを現行化して移す。`Sync Impact Report`、作業言語、検証スコープ、技術スタック一覧、ドメイン実装詳細、Governanceを含めず、4つの章と参照リンクを確認する。
- [x] 1.2 `docs/reference/writing-style.md`を新規作成し、参照文書のDiátaxis分類と日本語執筆規範を反映する。引用された「実装・workflow・生成物・testsとの照合」と「文書変更後の検証コマンド」の2段落を本文へ含めず、4つの分類と各表記規則を確認する。
- [x] 1.3 `docs/reference/technology-stack.md`を新規作成し、`package.json`、設定、Dockerfile、workflowと照合した現行の技術スタック、依存、データ境界、生成物、秘密情報の扱いを記載する。存在しない依存、コマンド、実装を記載していないことを確認する。
- [x] 1.4 `AGENTS.md`を憲章、執筆規範、技術スタック、開発手順、`openspec/`への参照だけに置き換える。旧TDD・型安全・命名・feature別技術一覧を重複させず、すべてのリンクが現行パスへ解決することを確認する。
- [x] 1.5 `README.md`をプロジェクト目的、実際のclone URL、Node.js 22、初回設定、初回検証、`dev`からの作業branch、目的別文書入口、Quality Gate入口に整理する。`npm run test:watch`、実際の設定ファイル名、最大1回乗換、生成artifactの前提、CIの実行範囲を実装・workflowと照合し、詳細な設計説明を対応文書へ移す。
- [x] 1.6 `docs/development-handoff.md`を`docs/how-to/development-workflow.md`へ移動し、開発開始、OpenSpecのproposal/spec/design/tasksの順序、task list作成時の参照方法、branch、初回検証、PR後のQuality Gate確認を記載する。`dev`、Node.js 22、実際のCLI、現行OpenSpecパスと一致することを確認する。

## 2. How-to文書を移動・現行化する

- [x] 2.1 `docs/manual/analytics.md`を`docs/how-to/analytics.md`へ移動し、現行の設定入力、実装ファイル、確認方法だけを記載する。`app-config.json`と実装の設定名を照合し、古い入力経路を削除したことを確認する。
- [x] 2.2 `docs/manual/docker_setup.md`を`docs/how-to/docker-setup.md`へ移動し、開発Compose、本番Compose、`.env.local`と`.env`、`transit-config.json`、BuildKit secret、read-only mountを現行化する。`compose.yml`、`compose.prod.yml`、`Dockerfile.dev`、`Dockerfile.prod`と照合し、「コード編集が自動反映する」という誤った説明を削除したことを確認する。
- [x] 2.3 `docs/manual/seo_optimization.md`を`docs/how-to/seo-optimization.md`へ移動し、現行のmetadata、structured data、robots、sitemapだけを記載する。`src/components/layouts/StructuredData.tsx`、`src/app/sitemap.ts`、`public/robots.txt`、実際のlayoutを照合し、存在しないOGP画像、PWA設定、外部ファイル、未確定URLを現行機能として記載していないことを確認する。
- [x] 2.4 `docs/license-page.md`を`docs/how-to/license-page.md`へ移動し、ライセンス情報の生成・確認・更新手順を現行化する。`package.json`、license関連実装、生成artifact、Quality Gateとの関係を照合して確認する。

## 3. ReferenceとExplanationを整理する

- [x] 3.1 `docs/accessibility/WCAG 22 Checklist.md`を`docs/reference/accessibility/wcag-22-checklist.md`へ移動し、現行のWCAG 2.2 AAチェック項目とリポジトリ内のUnderstanding参照を整理する。外部原文本文を変更せず、リンク先が現行ツリーまたは公式URLへ解決することを確認する。
- [x] 3.2 `docs/accessibility/ウェブアクセシビリティ方針.md`を`docs/reference/accessibility/web-accessibility-policy.md`へ移動し、現行のアクセシビリティ方針と対象範囲を記載する。`docs/reference/constitution.md`と方針が競合しないことを確認する。
- [x] 3.3 `docs/spec/screen_transition_design.md`を`docs/reference/screen-transition-design.md`へ移動し、現行Sidebarと実在するroute、GitHub Releasesによる更新情報を反映する。`src/components/layouts/Sidebar.tsx`とroute一覧を照合し、Notionや欠落した画面を削除したことを確認する。
- [x] 3.4 `docs/discussion/spec_v2.md`を`docs/reference/discussion.md`へ移動し、現行の`naddr` route、NIP-72、モデレーター・作成者権限、承認フロー、現在のUIを記載する。`src/app/discussions/`、`app-config.json.example`、Nostr関連実装と照合し、旧`[id]`、環境変数、DaisyUIの誤記を削除したことを確認する。
- [x] 3.5 `docs/discussion/nosskey.md`を上流SDK資料の凍結原文として現行ツリーに残す。本文・パスを変更せず、現行のPasskey仕様や開発手順から正本として案内していないことを確認する。
- [x] 3.6 `docs/discussion/nostr-tools.md`を上流ライブラリ資料の凍結原文として現行ツリーに残す。本文・パスを変更せず、`package.json`の現行依存や`src/lib/nostr/`の実装と混同しない参照導線になっていることを確認する。
- [x] 3.7 `docs/evaluation_function/spec.md`を`docs/reference/evaluation-function.md`へ移動・改稿し、現行のTypeScript評価サービス、Polis合意分析、承認済み投稿の扱いを記載する。`src/lib/evaluation/evaluation-service.ts`、`polis-consensus.ts`、関連テストと照合し、存在しない`ai-on-browther.md`と旧単純ランキングを削除したことを確認する。
- [x] 3.8 `docs/spec/frontend_design.md`を`docs/explanation/frontend-design.md`へ移動し、現行のUI層、feature層、layout、shared UIの設計意図を説明する。`src/app`、`src/components`、`src/lib`の実構成と照合する。
- [x] 3.9 `docs/evaluation_function/polis-consensus-algorithm.md`を`docs/explanation/polis-consensus-algorithm.md`へ移動し、アルゴリズムの背景と現行実装との境界を明示する。理論説明を実装済み機能と混同していないことを確認する。
- [x] 3.10 `docs/evaluation_function/polis-consensus-whitepaper.md`を`docs/explanation/polis-consensus-whitepaper.md`へ移動し、外部研究・設計背景として位置付ける。現行の実装仕様を定義する文書として読めないことを確認する。
- [x] 3.11 `docs/spec/overview.md`の目的・設計思想・プロジェクト範囲を`docs/reference/constitution.md`へ統合し、元ファイルを削除する。全リポジトリの参照を更新し、重複した古いWCAG 2.1・開発方針が残っていないことを確認する。

## 4. Recordsへ履歴資料を移す

- [x] 4.1 `docs/discussion/2025-08-23_compliance-report.md`を`docs/records/2025-08-23-discussion-compliance-report.md`へ移動し、調査時点・状態・現行仕様ではないことを明示する。削除済みの実装や参照を現行機能として読めないことを確認する。
- [x] 4.2 `docs/discussion/2026-01-13-audit-screen-investigation.md`を`docs/records/2026-01-13-audit-screen-investigation.md`へ移動し、調査記録として状態を明示する。現行ツリーにない監査画面・環境変数への参照を現行手順から分離したことを確認する。
- [x] 4.3 `docs/discussion/2026-07-10-009-approval-state-consistency-investigation.md`を`docs/records/2026-07-10-009-approval-state-consistency-investigation.md`へ移動し、調査記録として現行仕様と区別する。現行OpenSpecや実装へのリンクを必要な範囲で更新する。
- [x] 4.4 `docs/discussion/spec.md`を`docs/records/discussion-spec-legacy.md`へ移動し、旧仕様であることを明示する。`nostr-tools`、旧環境変数、旧routeを現行仕様として案内していないことを確認する。
- [x] 4.5 `docs/log/2025-12-01_syntax_error_tracking.md`を`docs/records/2025-12-01-syntax-error-tracking.md`へ移動し、解決済みまたは履歴上の記録であることを明示する。現行auth実装と矛盾する未解決表現を残していないことを確認する。
- [x] 4.6 `docs/log/2025-12-01_test_tracking.md`を`docs/records/2025-12-01-test-tracking.md`へ移動し、当時のテスト記録として現行の品質ゲートと区別する。現行コマンドへの誤った入口を追加していないことを確認する。
- [x] 4.7 `docs/log/memo.md`を`docs/records/memo.md`へ移動し、現行仕様ではない保守メモとして位置付ける。古い実装前提を現行手順へリンクしていないことを確認する。
- [x] 4.8 `docs/reviews/issue-33-code-review.md`を`docs/records/issue-33-code-review.md`へ移動し、レビュー時点の記録として状態を明示する。現行仕様または開発手順の入口から除外したことを確認する。
- [x] 4.9 `docs/ui-kiss-principle-review.md`を`docs/records/ui-kiss-principle-review.md`へ移動し、レビュー時点・対象commit・未検証範囲を明示する。削除済みコンポーネントへのリンクを現行文書のリンクとして残していないことを確認する。

## 5. リンク・凍結範囲・OpenSpec参照を整える

- [x] 5.1 `docs/how-to/`、`docs/reference/`、`docs/explanation/`、`docs/records/`の目的別ディレクトリを作成し、tasks 1〜4の移動manifestとGitの変更名が一致することを確認する。
- [x] 5.2 移動対象の旧パスを参照するREADME、AGENTS、現行docs、Issue作業文書、OpenSpec成果物を検索し、現行参照だけを新パスへ更新する。`archive/v2/**`と凍結した外部原文本文は変更せず、凍結範囲を現行リンク検査から除外する。
- [x] 5.3 `docs/how-to/development-workflow.md`に、OpenSpecのproposal・spec・design・tasksを作成する順序と、tasks作成時に`docs/reference/constitution.md`、`docs/reference/writing-style.md`、実装・テスト・workflowを参照する設計を記載する。現行のOpenSpec CLIと`openspec/`パスを確認する。
- [x] 5.4 READMEと各文書の正本リンクを確認し、`archive/v2/.specify/memory/constitution.md`を現行憲章として案内するリンクを除去する。旧Spec Kitと現行OpenSpecの役割が混同されないことを確認する。

## 6. 統合検証

- [x] 6.1 凍結範囲を除くMarkdownを対象に、目的別ディレクトリ、H1、相対リンク、旧パス、旧コマンド、存在しない実装参照を検査する。現行文書の相対リンクが既存対象または公式URLへ解決し、凍結外のリンク切れが0件であることを確認する。
- [x] 6.2 `openspec status --change modernize-documentation --json`でproposal、spec、design、tasksが完了状態になっていることを確認し、`npx -y @fission-ai/openspec@latest validate --all --json`が成功することを確認する。
- [x] 6.3 `npx tsc --noEmit --incremental false`、`npm run lint`、`npm test -- --runInBand --ci`、`npm run build`を実行し、docs-only変更による実装回帰がないことを確認する。Node.js 22前提や設定不足による環境障害は、成功扱いにせず正確に記録する。
- [x] 6.4 `git diff --check`、`git status --short --untracked-files=all`、`git diff --name-status`を実行し、変更範囲がmanifestどおりで、`archive/v2/**`、外部原文、実装、package、workflow、CIに未承認の変更がないことを確認する。
